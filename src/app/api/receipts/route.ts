import { randomUUID, createHash } from "node:crypto";
import path from "node:path";
import {
  requireUser,
  sameOrigin,
  limitedBody,
  HttpError,
  errorResponse,
} from "@/lib/auth";
import { getDb, actorTransaction } from "@/lib/db";
import { storeFile, removeFile, type StoredFile } from "@/lib/storage";
import { attachmentType } from "@/lib/validation";
export const runtime = "nodejs";
export async function POST(request: Request) {
  let stored: StoredFile | undefined;
  try {
    sameOrigin(request);
    const user = await requireUser();
    if (!request.headers.get("content-type")?.startsWith("multipart/form-data"))
      throw new HttpError(400, "Upload a reviewed receipt");
    const bytes = await limitedBody(request, 11 * 1024 * 1024);
    const form = await new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: new Uint8Array(bytes),
    }).formData();
    const expenseId = form.get("expenseId"),
      file = form.get("file");
    if (
      typeof expenseId !== "string" ||
      !(file instanceof File) ||
      !file.size ||
      file.size > 10 * 1024 * 1024 ||
      form.get("confirmed") !== "true"
    )
      throw new HttpError(
        400,
        "Confirm the receipt belongs to this expense; maximum 10 MB",
      );
    const expense = (
      await (
        await getDb()
      ).query<{ category: string; recognition: string }>(
        "SELECT category,recognition FROM expenses WHERE id=$1",
        [expenseId],
      )
    ).rows[0];
    if (!expense) throw new HttpError(404, "Expense not found");
    if (
      user.role !== "OWNER" &&
      (expense.recognition === "PERSONAL" ||
        /payroll|salary|tax|vat|dividend|distribution|owner|contribution/i.test(
          expense.category,
        ))
    )
      throw new HttpError(403, "Owner permission required");
    const buffer = Buffer.from(await file.arrayBuffer()),
      type = attachmentType(buffer);
    if (!type) throw new HttpError(400, "Use a valid PDF, PNG or JPG");
    stored = await storeFile(randomUUID(), buffer, type);
    const id = randomUUID();
    await actorTransaction(user.id, (tx) =>
      tx.query(
        "INSERT INTO expense_attachments(id,expense_id,original_name,mime_type,storage_key,size_bytes,sha256,storage_provider,storage_bucket,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
        [
          id,
          expenseId,
          path.basename(file.name).slice(0, 200),
          type,
          stored!.storage_key,
          buffer.length,
          createHash("sha256").update(buffer).digest("hex"),
          stored!.storage_provider,
          stored!.storage_bucket,
          user.id,
        ],
      ),
    );
    return Response.json({ id }, { status: 201 });
  } catch (e) {
    if (stored)
      await removeFile(stored).catch(() =>
        console.error("Receipt cleanup requires reconciliation"),
      );
    return errorResponse(e);
  }
}
