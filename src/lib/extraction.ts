import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, rm, readdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
const run = promisify(execFile);
let activeExtractions = 0;
export function extractionProposal(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((v) => v.trim())
    .filter(Boolean);
  const reference =
    text.match(
      /invoice\s*(?:number|no\.?|#|:)?\s*[:#]?\s*([A-Z0-9][A-Z0-9/_-]{2,50})/i,
    )?.[1] ?? null;
  const amounts = [
    ...text.matchAll(
      /(?:total|amount due|balance due)\s*[:]?\s*(?:USD|EUR|GBP|[$€£])?\s*([\d,]+\.\d{2})/gi,
    ),
  ].map((m) => m[1].replaceAll(",", ""));
  return {
    vendorCandidate: lines[0]?.slice(0, 120) ?? null,
    invoiceReferenceCandidate: reference,
    totalCandidates: [...new Set(amounts)].slice(0, 10),
    text: text.slice(0, 30000),
    status: "UNREVIEWED",
    method: "LOCAL_OCR_OR_TEXT",
  };
}
export async function extractDocument(bytes: Buffer, type: string) {
  if (activeExtractions >= 2) throw new Error("Extraction capacity reached");
  activeExtractions++;
  let dir: string | undefined;
  try {
    dir = await mkdtemp(path.join(os.tmpdir(), "company-os-extract-"));
    const file = path.join(
      dir,
      type === "application/pdf"
        ? "source.pdf"
        : type === "image/png"
          ? "source.png"
          : "source.jpg",
    );
    await writeFile(file, bytes, { mode: 0o600 });
    let text: string;
    if (type === "application/pdf") {
      const result = await run(
        process.env.PDFTOTEXT_BINARY || "/usr/bin/pdftotext",
        ["-f", "1", "-l", "5", "-layout", file, "-"],
        {
          timeout: 20000,
          maxBuffer: 512 * 1024,
          env: { PATH: process.env.PATH, NODE_ENV: process.env.NODE_ENV },
        },
      );
      text = result.stdout;
      if (!text.trim()) {
        const started = Date.now();
        await run(
          process.env.PDFTOPPM_BINARY || "/usr/bin/pdftoppm",
          [
            "-f",
            "1",
            "-l",
            "5",
            "-scale-to",
            "1800",
            "-png",
            file,
            path.join(dir, "page"),
          ],
          {
            timeout: 20000,
            maxBuffer: 512 * 1024,
            env: { PATH: process.env.PATH, NODE_ENV: process.env.NODE_ENV },
          },
        );
        const pages = (await readdir(dir))
          .filter((p) => /^page-\d+\.png$/.test(p))
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
          .slice(0, 5);
        const texts: string[] = [];
        for (const page of pages) {
          const remaining = 20000 - (Date.now() - started);
          if (remaining <= 0)
            throw new Error("Scanned PDF extraction timed out");
          const result = await run(
            process.env.TESSERACT_BINARY || "/usr/bin/tesseract",
            [path.join(dir, page), "stdout", "-l", "eng"],
            {
              timeout: remaining,
              maxBuffer: 512 * 1024,
              env: {
                PATH: process.env.PATH,
                NODE_ENV: process.env.NODE_ENV,
                OMP_THREAD_LIMIT: "1",
              },
            },
          );
          texts.push(result.stdout);
        }
        text = texts.join("\n");
      }
    } else {
      const result = await run(
        process.env.TESSERACT_BINARY || "/usr/bin/tesseract",
        [file, "stdout", "-l", "eng"],
        {
          timeout: 20000,
          maxBuffer: 512 * 1024,
          env: {
            PATH: process.env.PATH,
            NODE_ENV: process.env.NODE_ENV,
            OMP_THREAD_LIMIT: "1",
          },
        },
      );
      text = result.stdout;
    }
    return extractionProposal(text);
  } finally {
    activeExtractions--;
    if (dir) await rm(dir, { recursive: true, force: true });
  }
}
