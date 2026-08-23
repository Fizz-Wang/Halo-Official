import { isPublicLinkActive } from "./linkActivation";

export interface BreadcrumbItem {
  id?: string;
  label: string;
  href?: string;
  active?: boolean;
  current?: boolean;
}

export interface BreadcrumbsProps {
  items: readonly BreadcrumbItem[];
  className?: string;
}

function classNames(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  const visibleItems = items.filter((item) =>
    isPublicLinkActive(item.href, item.active),
  );

  if (visibleItems.length === 0) {
    return null;
  }

  const explicitCurrentIndex = visibleItems.findIndex((item) => item.current);
  const currentIndex =
    explicitCurrentIndex >= 0 ? explicitCurrentIndex : visibleItems.length - 1;

  return (
    <nav
      aria-label="Breadcrumb"
      className={classNames("breadcrumbs", className)}
    >
      <ol>
        {visibleItems.map((item, index) => {
          const isCurrent = index === currentIndex;

          return (
            <li key={item.id ?? `${item.label}-${index}`}>
              {isCurrent ? (
                <span aria-current="page">{item.label}</span>
              ) : item.href ? (
                <a href={item.href}>{item.label}</a>
              ) : (
                <span>{item.label}</span>
              )}
              {index < visibleItems.length - 1 ? (
                <span aria-hidden="true" className="breadcrumb-separator">
                  /
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
