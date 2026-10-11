import { X509Certificate } from "node:crypto";
import { createSecureContext } from "node:tls";
import { z } from "zod";
import { setupTargets } from "./live-provisioning";

// Never emit arbitrary properties (including message, stack, host, detail or SQL).
const codes = new Set([
  "28P01",
  "28000",
  "42501",
  "3D000",
  "42P01",
  "42710",
  "42704",
  "53300",
  "53400",
  "57014",
  "57P01",
  "08000",
  "08001",
  "08003",
  "08004",
  "08006",
  "080P01",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "ENETUNREACH",
  "EHOSTUNREACH",
  "CERT_HAS_EXPIRED",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "ERR_TLS_CERT_SIGNATURE_ALGORITHM_UNSUPPORTED",
  "ERR_SSL_CERTIFICATE_VERIFY_FAILED",
  "CONFIG_INVALID",
  "TLS_NOT_ENCRYPTED",
  "TLS_NOT_AUTHORIZED",
  "RUNTIME_IDENTITY_MISMATCH",
  "READINESS_CHECK_FAILED",
]);
const http = new Set([400, 401, 403, 404, 409, 422, 429, 500, 502, 503, 504]);
export class SetupError extends Error {
  constructor(public readonly code: string) {
    super("Setup check failed");
  }
}
export function safeErrorCodes(error: unknown): string[] {
  const found = new Set<string>(),
    seen = new Set<object>();
  function visit(value: unknown, depth: number) {
    if (!value || typeof value !== "object" || depth > 5 || seen.has(value))
      return;
    seen.add(value);
    // Only inspect data properties: an error supplied by a provider may have getters.
    const read = (key: string) =>
      Object.getOwnPropertyDescriptor(value, key)?.value as unknown;
    const code = read("code");
    if (typeof code === "string" && codes.has(code)) found.add(code);
    for (const key of ["status", "statusCode"]) {
      const status = read(key);
      const n =
        typeof status === "number"
          ? status
          : typeof status === "string" && /^\d{3}$/.test(status)
            ? Number(status)
            : NaN;
      if (http.has(n)) found.add("HTTP_" + n);
    }
    visit(read("cause"), depth + 1);
    const errors = read("errors");
    if (Array.isArray(errors))
      for (const child of errors.slice(0, 10)) visit(child, depth + 1);
  }
  visit(error, 0);
  return found.size ? [...found].sort() : ["UNKNOWN_ERROR"];
}
export function requireVerifiedTls(socket: {
  encrypted?: boolean;
  authorized?: boolean;
}) {
  if (socket.encrypted !== true) throw new SetupError("TLS_NOT_ENCRYPTED");
  if (socket.authorized !== true) throw new SetupError("TLS_NOT_AUTHORIZED");
}
export function configurationResults(env: NodeJS.ProcessEnv) {
  const results: {
    setting: string;
    check: string;
    result: "PASS" | "FAIL" | "OPTIONAL_UNSET";
  }[] = [];
  const check = (
    setting: string,
    label: string,
    test: () => boolean,
    optional = false,
  ) => {
    let ok = false;
    try {
      ok = test();
    } catch {
      /* Do not serialize parsing errors. */
    }
    results.push({
      setting,
      check: label,
      result:
        optional && !env[setting] ? "OPTIONAL_UNSET" : ok ? "PASS" : "FAIL",
    });
  };
  check("APP_MODE", "live_mode", () => env.APP_MODE === "live");
  check(
    "APP_ORIGIN",
    "confirmed_origin",
    () => env.APP_ORIGIN === "https://company-os-eight-iota.vercel.app",
  );
  check(
    "PRIVATE_STORAGE_PROVIDER",
    "supabase_provider",
    () => env.PRIVATE_STORAGE_PROVIDER === "supabase",
  );
  for (const setting of [
    "DATABASE_MIGRATION_URL",
    "DATABASE_URL",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "BOOTSTRAP_EMAIL",
    "BOOTSTRAP_NAME",
  ])
    check(setting, "present", () => !!env[setting]?.trim());
  for (const setting of ["DATABASE_MIGRATION_URL", "DATABASE_URL"])
    check(setting, "postgres_url_with_credentials", () => {
      const u = new URL(env[setting]!);
      return (
        ["postgres:", "postgresql:"].includes(u.protocol) &&
        !!u.hostname &&
        !!decodeURIComponent(u.username) &&
        !!decodeURIComponent(u.password) &&
        u.pathname.length > 1 &&
        !u.hash
      );
    });
  check("SUPABASE_URL", "project_https_format", () => {
    const u = new URL(env.SUPABASE_URL!);
    return (
      u.protocol === "https:" &&
      /^[a-z]{20}\.supabase\.co$/.test(u.hostname) &&
      !u.port &&
      !u.username &&
      !u.password &&
      u.pathname === "/" &&
      !u.search &&
      !u.hash
    );
  });
  check("DATABASE_URL", "runtime_password_policy", () =>
    /^[\x21-\x7e]{24,256}$/.test(
      decodeURIComponent(new URL(env.DATABASE_URL!).password),
    ),
  );
  check(
    "DATABASE_TARGETS",
    "same_project_session_endpoint_and_separate_runtime_login",
    () => {
      setupTargets(
        env.DATABASE_MIGRATION_URL!,
        env.DATABASE_URL!,
        env.SUPABASE_URL!,
      );
      return true;
    },
  );
  check(
    "SUPABASE_SERVICE_ROLE_KEY",
    "nonempty_no_whitespace_auth_not_yet_verified",
    () =>
      !!env.SUPABASE_SERVICE_ROLE_KEY &&
      !/\s/.test(env.SUPABASE_SERVICE_ROLE_KEY),
  );
  check(
    "BOOTSTRAP_EMAIL",
    "email_format",
    () =>
      z.email().safeParse(env.BOOTSTRAP_EMAIL?.trim().toLowerCase()).success,
  );
  check(
    "BOOTSTRAP_NAME",
    "name_policy",
    () => !!env.BOOTSTRAP_NAME?.trim() && env.BOOTSTRAP_NAME.length <= 200,
  );
  check(
    "BOOTSTRAP_PASSWORD",
    "password_policy_required_only_for_new_owner",
    () =>
      !!env.BOOTSTRAP_PASSWORD &&
      env.BOOTSTRAP_PASSWORD.length >= 14 &&
      env.BOOTSTRAP_PASSWORD.length <= 256,
    true,
  );
  check(
    "DATABASE_CA_CERT",
    "pem_trust_syntax",
    () => {
      const ca = env.DATABASE_CA_CERT!;
      if (!ca.includes("-----BEGIN CERTIFICATE-----")) return false;
      const certificates = ca.match(
        /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g,
      );
      if (!certificates?.length) return false;
      for (const certificate of certificates) new X509Certificate(certificate);
      createSecureContext({ ca });
      return true;
    },
    true,
  );
  check(
    "SUPABASE_STORAGE_BUCKET",
    "bucket_identifier_default_if_unset",
    () =>
      /^[a-zA-Z0-9_-]+$/.test(
        env.SUPABASE_STORAGE_BUCKET || "company-os-invoices",
      ),
    true,
  );
  return results;
}

export async function connectWithDiagnostics<T>(
  connect: () => Promise<T>,
  tlsFailure: () => void,
): Promise<T> {
  try {
    return await connect();
  } catch (error) {
    if (
      safeErrorCodes(error).some((code) =>
        /^(CERT_|DEPTH_|SELF_SIGNED_|UNABLE_|ERR_TLS_|ERR_SSL_)/.test(code),
      )
    )
      tlsFailure();
    throw error;
  }
}
