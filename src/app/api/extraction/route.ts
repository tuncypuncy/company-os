import {
  requireUser,
  sameOrigin,
  limitedBody,
  errorResponse,
  HttpError,
} from "@/lib/auth";
import { attachmentType } from "@/lib/validation";
import { extractDocument } from "@/lib/extraction";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    await requireUser();
    const bytes = await limitedBody(request, 10 * 1024 * 1024);
    const type = attachmentType(bytes);
    if (!type) throw new HttpError(400, "Upload a valid PDF, PNG or JPG");
    try {
      return Response.json(await extractDocument(bytes, type), {
        headers: { "Cache-Control": "private, no-store" },
      });
    } catch {
      throw new HttpError(
        422,
        "Local extraction is unavailable or this document could not be read. Manual review remains available.",
      );
    }
  } catch (e) {
    return errorResponse(e);
  }
}
