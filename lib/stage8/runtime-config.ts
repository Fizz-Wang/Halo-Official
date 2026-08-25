export interface ReleaseContext {
  readonly active: boolean;
  readonly origin: string | null;
  readonly reason:
    | "active"
    | "release-mode-disabled"
    | "release-approval-missing"
    | "missing-origin"
    | "invalid-origin"
    | "request-origin-mismatch";
}

export const releaseActiveHeader = "x-halo-release-active";
export const releaseOriginHeader = "x-halo-release-origin";
export const cspNonceHeader = "x-halo-csp-nonce";

export interface ReleaseInput {
  readonly releaseMode?: string;
  readonly releaseApproved?: string;
  readonly canonicalOrigin?: string;
  readonly requestUrl?: string;
}

function isIpAddress(hostname: string) {
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) return true;
  return hostname.includes(":");
}

export function parseApprovedOrigin(value: string | undefined): string | null {
  if (!value || value !== value.trim()) return null;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  const hostname = parsed.hostname.toLowerCase();
  const blockedHostname =
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".invalid") ||
    hostname.endsWith(".workers.dev") ||
    hostname.endsWith(".pages.dev") ||
    isIpAddress(hostname);

  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.port ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash ||
    blockedHostname
  ) {
    return null;
  }

  return parsed.origin;
}

export function resolveReleaseContext(input: ReleaseInput): ReleaseContext {
  if (input.releaseMode !== "production") {
    return { active: false, origin: null, reason: "release-mode-disabled" };
  }

  if (input.releaseApproved !== "true") {
    return { active: false, origin: null, reason: "release-approval-missing" };
  }

  if (!input.canonicalOrigin) {
    return { active: false, origin: null, reason: "missing-origin" };
  }

  const origin = parseApprovedOrigin(input.canonicalOrigin);
  if (!origin) {
    return { active: false, origin: null, reason: "invalid-origin" };
  }

  if (input.requestUrl) {
    let requestOrigin: string;
    try {
      requestOrigin = new URL(input.requestUrl).origin;
    } catch {
      return { active: false, origin: null, reason: "request-origin-mismatch" };
    }
    if (requestOrigin !== origin) {
      return { active: false, origin: null, reason: "request-origin-mismatch" };
    }
  }

  return { active: true, origin, reason: "active" };
}
