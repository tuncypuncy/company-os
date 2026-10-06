export class IntegrationError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export type Transport = (url: string, init?: RequestInit) => Promise<Response>;
export async function apiJson<T>(
  url: string,
  init: RequestInit,
  transport: Transport = fetch,
): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    let response: Response;
    try {
      response = await transport(url, {
        ...init,
        redirect: "error",
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw new IntegrationError(
        "NETWORK",
        "Provider request failed or timed out",
      );
    }
    if ((response.status === 429 || response.status >= 500) && attempt < 2) {
      const delay = Math.min(
        1500,
        Math.max(
          100,
          Number(response.headers.get("retry-after") || 0) * 1000 ||
            200 * (attempt + 1),
        ),
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }
    if (!response.ok)
      throw new IntegrationError(
        String(response.status),
        response.status === 401 || response.status === 403
          ? "Provider rejected credentials or permissions"
          : "Provider API returned an error",
      );
    try {
      return (await response.json()) as T;
    } catch {
      throw new IntegrationError("PAYLOAD", "Provider returned invalid JSON");
    }
  }
  throw new IntegrationError("RETRIES", "Provider retry limit reached");
}
export function credential(name: string, platform: string) {
  if (
    !new RegExp("^" + platform + "_[A-Z0-9_]+$").test(name) ||
    name.startsWith("NEXT_PUBLIC_")
  )
    throw new IntegrationError(
      "CONFIG",
      "Use an approved server-side credential variable name",
    );
  const value = process.env[name];
  if (!value)
    throw new IntegrationError("NOT_CONNECTED", name + " is not configured");
  return value;
}
