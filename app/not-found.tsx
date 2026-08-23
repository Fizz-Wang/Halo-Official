import type { Metadata } from "next";
import { getPageByPath } from "../lib/site-content";
import {
  ExperienceLayer,
  Footer,
  Header,
  NotFound,
  SkipLink,
} from "./components";
import { footerGroups, headerItems } from "./shell-data";

export const metadata: Metadata = {
  title: { absolute: "Page not found | Halo Database" },
  robots: { index: false, follow: true },
};

export default function NotFoundPage() {
  const page = getPageByPath("/404/");

  if (!page) {
    throw new Error("The frozen 404 content is missing from the registry.");
  }

  return (
    <>
      <SkipLink targetId="main-content" />
      <Header brand={{ label: "Halo Database", href: "/" }} items={headerItems} />
      <NotFound
        actions={actionsFor(page)}
        body={<p>{page.hero.lead}</p>}
        heading={page.hero.h1}
      />
      <Footer
        brand={{ label: "Halo Database", href: "/" }}
        groups={footerGroups}
      />
      <ExperienceLayer />
    </>
  );
}

function actionsFor(page: NonNullable<ReturnType<typeof getPageByPath>>) {
  return page.hero.actions.map((action, index) => ({
    id: `${index}-${action.href}`,
    href: action.href,
    label: action.label,
    variant:
      action.kind === "primary"
        ? ("primary" as const)
        : action.kind === "text"
          ? ("link" as const)
          : ("secondary" as const),
  }));
}
