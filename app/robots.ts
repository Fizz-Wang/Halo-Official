import type { MetadataRoute } from "next";
import { buildRobotsPolicy } from "../lib/stage8/discovery";
import { readRequestReleaseContext } from "../lib/stage8/request-context";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const policy = buildRobotsPolicy(await readRequestReleaseContext());
  return {
    rules: {
      userAgent: "*",
      ...(policy.allow.length > 0 ? { allow: [...policy.allow] } : {}),
      ...(policy.disallow.length > 0 ? { disallow: [...policy.disallow] } : {}),
    },
    ...(policy.sitemap ? { sitemap: policy.sitemap } : {}),
  };
}

