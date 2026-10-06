import { loadFile, type StoredFile } from "@/lib/storage";
import { getDb } from "@/lib/db";
import { requireUser, errorResponse, HttpError } from "@/lib/auth";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const { rows } = await (
      await getDb()
    ).query<
      {
        storage_key: string;
        mime_type: string;
        original_name: string;
      } & StoredFile
    >(
      "SELECT storage_key,mime_type,original_name,storage_provider,storage_bucket FROM invoice_attachments WHERE id=$1 UNION ALL SELECT a.storage_key,a.mime_type,a.original_name,a.storage_provider,a.storage_bucket FROM expense_attachments a JOIN expenses e ON e.id=a.expense_id WHERE a.id=$1 AND ($2=true OR (e.recognition<>'PERSONAL' AND e.category !~* 'payroll|salary|tax|vat|dividend|distribution|owner|contribution'))",
      [id, user.role === "OWNER"],
    );
    const a = rows[0];
    if (!a) throw new HttpError(404, "Attachment not found");
    if (!/^[a-f0-9-]{36}$/.test(a.storage_key))
      throw new HttpError(500, "Invalid attachment key");
    const file = await loadFile(a);
    return new Response(file, {
      headers: {
        "Content-Type": a.mime_type,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(a.original_name)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
