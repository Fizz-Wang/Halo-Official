import type { ActiveSitePage } from "../site-content";
import type { ReleaseContext } from "./runtime-config";

export const baseSitemapEligibility = [
  { id: "P01", path: "/", canonicalPath: "/" },
  { id: "P02", path: "/product/", canonicalPath: "/product/" },
  { id: "P23", path: "/product/architecture/", canonicalPath: "/product/architecture/" },
  { id: "P03", path: "/oracle-migration-evaluation/", canonicalPath: "/oracle-migration-evaluation/" },
  { id: "P04", path: "/product/compatibility/", canonicalPath: "/product/compatibility/" },
  { id: "P05", path: "/product/availability-recovery/", canonicalPath: "/product/availability-recovery/" },
  { id: "P24", path: "/product/distributed/", canonicalPath: "/product/distributed/" },
  { id: "P06", path: "/product/operations/", canonicalPath: "/product/operations/" },
  { id: "P25", path: "/product/data-platform/", canonicalPath: "/product/data-platform/" },
  { id: "P07", path: "/evaluation/", canonicalPath: "/evaluation/" },
  { id: "P08", path: "/resources/", canonicalPath: "/resources/" },
  { id: "P09", path: "/resources/documentation/", canonicalPath: "/resources/documentation/" },
  { id: "P10", path: "/resources/evidence/", canonicalPath: "/resources/evidence/" },
  { id: "P11", path: "/resources/evaluation-checklist/", canonicalPath: "/resources/evaluation-checklist/" },
  { id: "P14", path: "/company/", canonicalPath: "/company/" },
  { id: "P27", path: "/contact-us/", canonicalPath: "/contact-us/" },
  { id: "P13", path: "/partners/", canonicalPath: "/partners/" },
  { id: "P26", path: "/open-halo/", canonicalPath: "/open-halo/" },
] as const;

export interface RobotsPolicy {
  readonly allow: readonly string[];
  readonly disallow: readonly string[];
  readonly sitemap: string | null;
}

export function buildRobotsPolicy(context: ReleaseContext): RobotsPolicy {
  if (!context.active || !context.origin) {
    return { allow: [], disallow: ["/"], sitemap: null };
  }
  return {
    allow: ["/"],
    disallow: [],
    sitemap: new URL("/sitemap.xml", context.origin).href,
  };
}

export function buildSitemapUrls(
  context: ReleaseContext,
  pages: readonly ActiveSitePage[],
): readonly string[] {
  if (!context.active || !context.origin) return [];

  return [...new Set(
    baseSitemapEligibility.map((eligible) => {
      const page = pages.find(
        (candidate) =>
          candidate.id === eligible.id &&
          candidate.path === eligible.path &&
          candidate.seo.robots === "index, follow" &&
          candidate.seo.canonicalPath === eligible.canonicalPath,
      );
      return page ? new URL(eligible.canonicalPath, context.origin!).href : null;
    }).filter((url): url is string => url !== null),
  )].sort();
}
