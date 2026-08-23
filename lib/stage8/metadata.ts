import type { Metadata } from "next";
import type { ActiveSitePage } from "../site-content";
import type { ReleaseContext } from "./runtime-config";

export function buildPageMetadata(
  page: ActiveSitePage,
  release: ReleaseContext,
): Metadata {
  const mayIndex = release.active && page.seo.robots === "index, follow";
  return {
    title: { absolute: page.seo.title },
    description: page.seo.description ?? undefined,
    alternates: page.seo.canonicalPath
      ? { canonical: page.seo.canonicalPath }
      : undefined,
    openGraph: {
      title: page.seo.title,
      description: page.seo.description ?? undefined,
      ...(release.active && release.origin
        ? {
            images: [
              {
                url: new URL("/og.png", release.origin),
                width: 1730,
                height: 909,
                alt: "Abstract Halo Database architecture with connected data nodes",
              },
            ],
          }
        : {}),
      ...(release.active && release.origin && page.seo.canonicalPath
        ? { url: new URL(page.seo.canonicalPath, release.origin) }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: page.seo.title,
      description: page.seo.description ?? undefined,
      ...(release.active && release.origin
        ? { images: [new URL("/og.png", release.origin)] }
        : {}),
    },
    robots: { index: mayIndex, follow: true },
  };
}
