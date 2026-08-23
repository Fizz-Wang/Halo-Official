import { headers } from "next/headers";
import {
  cspNonceHeader,
  releaseActiveHeader,
  releaseOriginHeader,
  resolveReleaseContext,
  type ReleaseContext,
} from "./runtime-config";

export async function readRequestCspNonce(): Promise<string | null> {
  return (await headers()).get(cspNonceHeader);
}

export async function readRequestReleaseContext(): Promise<ReleaseContext> {
  const requestHeaders = await headers();
  const active = requestHeaders.get(releaseActiveHeader) === "1";
  return resolveReleaseContext({
    releaseMode: active ? "production" : undefined,
    releaseApproved: active ? "true" : undefined,
    canonicalOrigin: active ? requestHeaders.get(releaseOriginHeader) ?? undefined : undefined,
  });
}
