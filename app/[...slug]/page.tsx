import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { activePaths, getPageByPath } from "../../lib/site-content";
import { buildPageMetadata } from "../../lib/stage8/metadata";
import { readRequestReleaseContext } from "../../lib/stage8/request-context";
import { SitePage } from "../site-page";

interface RouteProps {
  params: Promise<{ slug: string[] }>;
}

function routePath(slug: readonly string[]) {
  return `/${slug.join("/")}/`;
}

export function generateStaticParams() {
  return activePaths
    .filter((path) => path !== "/" && path !== "/404/")
    .map((path) => ({
      slug: path.split("/").filter(Boolean),
    }));
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getPageByPath(routePath(slug));

  if (!page || page.id === "P20") {
    return {
      title: { absolute: "Page not found | Halo Database" },
      robots: { index: false, follow: true },
    };
  }

  return buildPageMetadata(page, await readRequestReleaseContext());
}

export default async function PublicRoute({ params }: RouteProps) {
  const { slug } = await params;
  const page = getPageByPath(routePath(slug));

  if (!page || page.id === "P20") {
    notFound();
  }

  return <SitePage page={page} />;
}
