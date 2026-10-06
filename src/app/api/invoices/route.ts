import { limitedBody } from "@/lib/auth";
import { randomUUID, createHash } from "node:crypto";
import { storeFile, removeFile, type StoredFile } from "@/lib/storage";
import path from "node:path";
import { actorTransaction, appMode } from "@/lib/db";
import { errorResponse, HttpError, requireUser, sameOrigin } from "@/lib/auth";
import { invoiceSchema, attachmentType } from "@/lib/validation";
import { postInvoice } from "@/lib/invoices";
export const runtime = "nodejs";
export async function POST(request: Request) {
  let stored: StoredFile | undefined;
  try {
    sameOrigin(request);
    const user = await requireUser();
    const length = Number(request.headers.get("content-length") || 0);
    if (length > 11 * 1024 * 1024)
      throw new HttpError(413, "Maximum upload size is 10 MB");
    if (!request.headers.get("content-type")?.startsWith("multipart/form-data"))
      throw new HttpError(400, "Use multipart/form-data for invoices");
    const bounded = await limitedBody(request, 11 * 1024 * 1024);
    const form = await new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: new Uint8Array(bounded),
    }).formData();
    const raw = form.get("data");
    if (typeof raw !== "string")
      throw new HttpError(400, "Invoice details are required");
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      throw new HttpError(400, "Invalid invoice details");
    }
    const parsed = invoiceSchema.safeParse(json);
    if (!parsed.success)
      throw new HttpError(400, parsed.error.issues[0].message);
    if (parsed.data.createRules && user.role !== "OWNER")
      throw new HttpError(403, "Only the owner can create cost rules");
    const file = form.get("file");
    let attachment:
      | {
          id: string;
          name: string;
          type: string;
          key: string;
          size: number;
          hash: string;
          provider: string;
          bucket: string | null;
        }
      | undefined;
    if (file instanceof File && file.size) {
      if (file.size > 10 * 1024 * 1024)
        throw new HttpError(413, "Maximum upload size is 10 MB");
      const buffer = Buffer.from(await file.arrayBuffer());
      const type = attachmentType(buffer);
      if (!type)
        throw new HttpError(
          400,
          "Only valid PDF, JPG or PNG files are accepted",
        );
      const key = randomUUID();
      stored = await storeFile(key, buffer, type);
      attachment = {
        provider: stored.storage_provider,
        bucket: stored.storage_bucket,
        id: randomUUID(),
        name: path.basename(file.name).slice(0, 200),
        type,
        key,
        size: buffer.length,
        hash: createHash("sha256").update(buffer).digest("hex"),
      };
    }
    const id = await actorTransaction(user.id, async (tx) => {
      const id = await postInvoice(
        tx,
        json,
        user.id,
        appMode() === "demo" ? "DEMO" : "MANUAL",
      );
      if (attachment)
        await tx.query(
          "INSERT INTO invoice_attachments(id,invoice_id,original_name,mime_type,storage_key,size_bytes,sha256,storage_provider,storage_bucket) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
          [
            attachment.id,
            id,
            attachment.name,
            attachment.type,
            attachment.key,
            attachment.size,
            attachment.hash,
            attachment.provider,
            attachment.bucket,
          ],
        );
      return id;
    });
    return Response.json(
      {
        id,
        message:
          "Invoice confirmed. One linked payment obligation was created.",
      },
      { status: 201 },
    );
  } catch (e) {
    if (stored)
      await removeFile(stored).catch(() =>
        console.error(
          "Attachment cleanup failed; reconcile orphaned storage objects",
        ),
      );
    if (e instanceof Error && e.message.includes("overlapping cost rule"))
      return Response.json({ error: e.message }, { status: 409 });
    if (
      e instanceof Error &&
      (e.message === "Unknown entity or store" ||
        e.message === "Product does not belong to this store brand")
    )
      return Response.json({ error: e.message }, { status: 400 });
    return errorResponse(e);
  }
}
