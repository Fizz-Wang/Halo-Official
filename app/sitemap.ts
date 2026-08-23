import type { MetadataRoute } from "next";
import { activeSitePages } from "../lib/site-content";
import { buildSitemapUrls } from "../lib/stage8/discovery";
import { readRequestReleaseContext } from "../lib/stage8/request-context";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const urls = buildSitemapUrls(
    await readRequestReleaseContext(),
    activeSitePages,
  );
  return urls.map((url) => ({ url }));
}

