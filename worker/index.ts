/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { activePaths } from "../lib/site-content";
import {
  cspNonceHeader,
  releaseActiveHeader,
  releaseOriginHeader,
  resolveReleaseContext,
  resolveStandaloneProxyUrl,
} from "../lib/stage8/runtime-config";

const activeHtmlPaths: ReadonlySet<string> = new Set(activePaths);

const activeSlashlessPaths = new Set(
  [...activeHtmlPaths]
    .filter((path) => path !== "/" && path !== "/404/")
    .map((path) => path.slice(0, -1)),
);

const legacyHtmlRedirects: ReadonlyMap<string, string> = new Map([
  ["/product/performance-diagnostics/", "/product/operations/"],
  ["/product/performance-diagnostics", "/product/operations/"],
]);

const dormantAcquisitionPaths: ReadonlySet<string> = new Set([
  "/request-poc/",
  "/contact-sales/",
  "/request-demo/",
  "/partners/apply/",
]);

const dormantAcquisitionSlashlessPaths: ReadonlySet<string> = new Set(
  [...dormantAcquisitionPaths].map((path) => path.slice(0, -1)),
);

const dormantAcquisitionPrivatePrefixes = [
  "/api/acquisition",
  "/api/forms",
  "/forms/state",
] as const;

function isDormantAcquisitionPrivatePath(pathname: string) {
  return (
    dormantAcquisitionPaths.has(pathname) ||
    dormantAcquisitionSlashlessPaths.has(pathname) ||
    dormantAcquisitionPrivatePrefixes.some((prefix) =>
      pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  );
}

function isDormantAcquisitionStatePath(pathname: string) {
  return dormantAcquisitionPrivatePrefixes.some((prefix) =>
    pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function createCspNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...bytes));
}

function createContentSecurityPolicy(nonce: string) {
  return [
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "media-src 'self'",
    "frame-src 'none'",
  ].join("; ");
}

function finalizeResponse(
  request: Request,
  response: Response,
  releaseActive: boolean,
  contentSecurityPolicy: string,
) {
  const headers = new Headers(response.headers);
  const pathname = new URL(request.url).pathname;
  const contentType = headers.get("content-type") ?? "";
  const isHtml = /^text\/html(?:;|$)/i.test(contentType);

  headers.set("Content-Security-Policy", contentSecurityPolicy);
  headers.set("Permissions-Policy", "camera=(), geolocation=(), microphone=(), payment=(), usb=()");
  headers.set(
    "Referrer-Policy",
    isDormantAcquisitionPrivatePath(pathname)
      ? "no-referrer"
      : "strict-origin-when-cross-origin",
  );
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");

  if (
    !releaseActive ||
    isDormantAcquisitionPrivatePath(pathname) ||
    response.status >= 400
  ) {
    headers.set("X-Robots-Tag", "noindex, follow");
  } else {
    headers.delete("X-Robots-Tag");
  }

  if (isHtml) {
    headers.set("Cache-Control", "private, no-store");
  } else if (
    response.status >= 400 ||
    isDormantAcquisitionPrivatePath(pathname) ||
    ((!releaseActive) && (pathname === "/robots.txt" || pathname === "/sitemap.xml"))
  ) {
    headers.set("Cache-Control", "private, no-store");
  } else if (
    (response.status >= 300 && response.status < 400) ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  ) {
    headers.set("Cache-Control", "public, max-age=0, must-revalidate");
  }

  return new Response(request.method === "HEAD" ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function isFrameworkOrAssetPath(pathname: string) {
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/_vinext/") ||
    pathname.startsWith("/api/")
  ) {
    return true;
  }

  const finalSegment = pathname.split("/").filter(Boolean).at(-1) ?? "";
  return finalSegment.includes(".");
}

interface Env {
  SITE_RELEASE_MODE?: string;
  SITE_RELEASE_APPROVED?: string;
  SITE_CANONICAL_ORIGIN?: string;
  /** Provisioned for the dormant Stage 8 adapter; no request path uses it. */
  DB?: unknown;
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env | undefined, ctx: ExecutionContext): Promise<Response> {
    // Vinext's standalone Node server does not inject a Cloudflare bindings
    // object. Keep preview releases functional there while preserving the
    // binding-first behavior used by hosted Workers.
    const runtimeEnv = env ?? ({} as Env);
    const url = new URL(request.url);
    const releaseRequestUrl = env === undefined
      ? resolveStandaloneProxyUrl({
          requestUrl: request.url,
          forwardedProto: request.headers.get("x-forwarded-proto"),
          forwardedHost: request.headers.get("x-forwarded-host"),
        })
      : request.url;
    const release = resolveReleaseContext({
      releaseMode: runtimeEnv.SITE_RELEASE_MODE ?? process.env.SITE_RELEASE_MODE,
      releaseApproved:
        runtimeEnv.SITE_RELEASE_APPROVED ?? process.env.SITE_RELEASE_APPROVED,
      canonicalOrigin:
        runtimeEnv.SITE_CANONICAL_ORIGIN ?? process.env.SITE_CANONICAL_ORIGIN,
      requestUrl: releaseRequestUrl,
    });
    const cspNonce = createCspNonce();
    const contentSecurityPolicy = createContentSecurityPolicy(cspNonce);
    const applicationHeaders = new Headers(request.headers);
    applicationHeaders.delete(releaseActiveHeader);
    applicationHeaders.delete(releaseOriginHeader);
    applicationHeaders.delete(cspNonceHeader);
    applicationHeaders.delete("Content-Security-Policy");
    applicationHeaders.set(cspNonceHeader, cspNonce);
    applicationHeaders.set("Content-Security-Policy", contentSecurityPolicy);
    if (release.active && release.origin) {
      applicationHeaders.set(releaseActiveHeader, "1");
      applicationHeaders.set(releaseOriginHeader, release.origin);
    }
    const applicationRequest = new Request(request, { headers: applicationHeaders });

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      const response = await handleImageOptimization(request, {
        fetchAsset: (path) => runtimeEnv.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await runtimeEnv.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
      return finalizeResponse(
        request,
        response,
        release.active,
        contentSecurityPolicy,
      );
    }

    if (isDormantAcquisitionStatePath(url.pathname)) {
      return finalizeResponse(
        request,
        new Response(null, { status: 404, statusText: "Not Found" }),
        release.active,
        contentSecurityPolicy,
      );
    }

    const legacyTarget = legacyHtmlRedirects.get(url.pathname);
    if (
      legacyTarget &&
      (request.method === "GET" || request.method === "HEAD")
    ) {
      const target = new URL(legacyTarget, request.url);
      target.search = url.search;
      return finalizeResponse(
        request,
        new Response(null, {
          status: 308,
          headers: { Location: target.pathname + target.search },
        }),
        release.active,
        contentSecurityPolicy,
      );
    }

    const isKnownHtmlPath =
      activeHtmlPaths.has(url.pathname) || activeSlashlessPaths.has(url.pathname);

    if (
      (dormantAcquisitionPaths.has(url.pathname) ||
        dormantAcquisitionSlashlessPaths.has(url.pathname)) &&
      request.method !== "GET" &&
      request.method !== "HEAD"
    ) {
      const routeIsPublic =
        activeHtmlPaths.has(url.pathname) ||
        activeSlashlessPaths.has(url.pathname);
      return finalizeResponse(
        request,
        new Response(null, {
          status: routeIsPublic ? 405 : 404,
          statusText: routeIsPublic ? "Method Not Allowed" : "Not Found",
          headers: routeIsPublic ? { Allow: "GET, HEAD" } : undefined,
        }),
        release.active,
        contentSecurityPolicy,
      );
    }

    if (
      (request.method === "GET" || request.method === "HEAD") &&
      !isKnownHtmlPath &&
      !isFrameworkOrAssetPath(url.pathname)
    ) {
      const notFoundUrl = new URL("/404/", request.url);
      const notFoundRequest = new Request(notFoundUrl, applicationRequest);
      const response = await handler.fetch(notFoundRequest, runtimeEnv, ctx);
      const notFoundResponse = new Response(response.body, {
        status: 404,
        statusText: "Not Found",
        headers: response.headers,
      });
      return finalizeResponse(
        request,
        notFoundResponse,
        release.active,
        contentSecurityPolicy,
      );
    }

    const response = await handler.fetch(applicationRequest, runtimeEnv, ctx);
    return finalizeResponse(
      request,
      response,
      release.active,
      contentSecurityPolicy,
    );
  },
};

export default worker;
