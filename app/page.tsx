import type { Metadata } from "next";
import { getPageByPath } from "../lib/site-content";
import { buildPageMetadata } from "../lib/stage8/metadata";
import { readRequestReleaseContext } from "../lib/stage8/request-context";
import { SitePage } from "./site-page";

const homePage = getPageByPath("/");

if (!homePage) {
  throw new Error("The frozen Home content is missing from the registry.");
}

const home = homePage;

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata(home, await readRequestReleaseContext());
}

export default function Home() {
  return <SitePage page={home} />;
}
