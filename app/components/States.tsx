import type { ReactNode } from "react";
import { CTAGroup, type CTAAction } from "./ButtonLink";
import { Footer, type FooterLink } from "./Footer";
import { HaloDatabaseFlow } from "./HaloDatabaseFlow";
import { SkipLink } from "./SkipLink";

export interface ReducedStateProps {
  heading: ReactNode;
  body: ReactNode;
  actions: readonly CTAAction[];
  legalLinks?: readonly FooterLink[];
  legalGroupLabel?: "Legal";
  brand?: {
    label: "Halo Database";
    href?: "/";
  };
  mainId?: string;
  className?: string;
}

export interface NotFoundProps {
  heading: ReactNode;
  body: ReactNode;
  actions: readonly CTAAction[];
  mainId?: string;
  className?: string;
}

function classNames(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function ReducedState({
  heading,
  body,
  actions,
  legalLinks = [],
  legalGroupLabel = "Legal",
  brand = { label: "Halo Database", href: "/" },
  mainId = "main-content",
  className,
}: ReducedStateProps) {
  const activeLegalLinks = legalLinks.filter((link) => link.active !== false);

  return (
    <>
      <SkipLink targetId={mainId} />
      <header className="site-header">
        <div className="header-inner">
          <a className="brand-link" href={brand.href ?? "/"}>
            {brand.label}
          </a>
        </div>
      </header>
      <main
        className={classNames("site-main", "reduced-state", className)}
        id={mainId}
      >
        <h1 tabIndex={-1}>{heading}</h1>
        <div className="reduced-state-body">{body}</div>
        <CTAGroup actions={actions} />
      </main>
      <Footer
        groups={
          activeLegalLinks.length > 0
            ? [
                {
                  id: "legal",
                  label: legalGroupLabel,
                  links: activeLegalLinks,
                },
              ]
            : []
        }
      />
    </>
  );
}

export function NotFound({
  heading,
  body,
  actions,
  mainId = "main-content",
  className,
}: NotFoundProps) {
  return (
    <main className="site-main" id={mainId}>
      <section
        className={classNames("reduced-state", "reduced-state--experience", className)}
        data-reveal="state"
      >
        <h1>{heading}</h1>
        <div className="reduced-state-body">{body}</div>
        <CTAGroup actions={actions} />
        <HaloDatabaseFlow variant="reduced" />
      </section>
    </main>
  );
}
