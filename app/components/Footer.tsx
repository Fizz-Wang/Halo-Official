import {
  isPublicLinkActive,
  normalizeInternalPath,
} from "./linkActivation";

export interface FooterLink {
  id?: string;
  label: string;
  href: string;
  active?: boolean;
  current?: boolean;
}

export interface FooterGroup {
  id?: string;
  label: string;
  links: readonly FooterLink[];
  active?: boolean;
}

export interface FooterProps {
  groups: readonly FooterGroup[];
  brand?: {
    label: string;
    href: string;
  };
  currentPath?: string;
  className?: string;
}

function classNames(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

function normalizePath(value: string) {
  return normalizeInternalPath(value);
}

function isActive(link: FooterLink) {
  return isPublicLinkActive(link.href, link.active);
}

function isCurrent(link: FooterLink, currentPath?: string) {
  if (typeof link.current === "boolean") {
    return link.current;
  }

  return currentPath
    ? normalizePath(link.href) === normalizePath(currentPath)
    : false;
}

export function Footer({
  groups,
  brand,
  currentPath,
  className,
}: FooterProps) {
  const activeGroups = groups
    .filter((group) => group.active !== false)
    .map((group) => ({
      ...group,
      links: group.links.filter(isActive),
    }))
    .filter((group) => group.links.length > 0);

  if (!brand && activeGroups.length === 0) {
    return null;
  }

  return (
    <footer className={classNames("site-footer", className)}>
      <div className="footer-inner">
        {brand ? (
          <a className="brand-link" href={brand.href}>
            {brand.label}
          </a>
        ) : null}
        {activeGroups.length > 0 ? (
          <nav aria-label="Footer">
            <div className="footer-grid">
              {activeGroups.map((group, groupIndex) => (
                <section
                  className="footer-group"
                  key={group.id ?? `${group.label}-${groupIndex}`}
                >
                  <h2>{group.label}</h2>
                  <ul>
                    {group.links.map((link, linkIndex) => (
                      <li key={link.id ?? `${link.href}-${linkIndex}`}>
                        <a
                          aria-current={
                            isCurrent(link, currentPath) ? "page" : undefined
                          }
                          href={link.href}
                        >
                          {link.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </nav>
        ) : null}
      </div>
    </footer>
  );
}
