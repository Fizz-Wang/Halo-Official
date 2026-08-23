"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import {
  isPublicLinkActive,
  normalizeInternalPath,
} from "./linkActivation";

const COMPACT_NAVIGATION_QUERY = "(max-width: 1399px)";

export interface HeaderLink {
  kind: "link";
  id?: string;
  label: string;
  href: string;
  active?: boolean;
  current?: boolean;
  presentation?: "default" | "utility" | "primary";
}

export interface HeaderGroup {
  kind: "group";
  id?: string;
  label: string;
  href: string;
  disclosureLabel: string;
  links: readonly Omit<HeaderLink, "kind" | "presentation">[];
  active?: boolean;
  current?: boolean;
}

export type HeaderItem = HeaderLink | HeaderGroup;

export interface HeaderProps {
  brand: {
    label: "Halo Database";
    href?: "/";
  };
  items: readonly HeaderItem[];
  currentPath?: string;
  className?: string;
  primaryNavigationLabel?: "Primary";
  menuLabel?: "Menu";
  closeMenuLabel?: "Close menu";
}

function classNames(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

function subscribeToHydration() {
  return () => undefined;
}

function subscribeToCompactRange(callback: () => void) {
  const query = window.matchMedia(COMPACT_NAVIGATION_QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function getCompactRangeSnapshot() {
  return window.matchMedia(COMPACT_NAVIGATION_QUERY).matches;
}

function itemIsActive(item: Pick<HeaderLink, "active" | "href">) {
  return isPublicLinkActive(item.href, item.active);
}

function itemIsCurrent(
  item: Pick<HeaderLink, "current" | "href">,
  currentPath?: string,
) {
  if (typeof item.current === "boolean") return item.current;
  return currentPath
    ? normalizeInternalPath(item.href) === normalizeInternalPath(currentPath)
    : false;
}

function activeItems(items: readonly HeaderItem[]) {
  return items
    .filter(itemIsActive)
    .map((item) =>
      item.kind === "group"
        ? { ...item, links: item.links.filter(itemIsActive) }
        : item,
    );
}

interface NavigationGroupProps {
  group: HeaderGroup;
  currentPath?: string;
  onOpen: (details: HTMLDetailsElement) => void;
}

function NavigationGroup({
  group,
  currentPath,
  onOpen,
}: NavigationGroupProps) {
  return (
    <li className="nav-group">
      <a
        aria-current={itemIsCurrent(group, currentPath) ? "page" : undefined}
        className="nav-link"
        href={group.href}
      >
        {group.label}
      </a>
      <details
        className="nav-disclosure"
        data-nav-group
        onToggle={(event) => {
          if (event.currentTarget.open) onOpen(event.currentTarget);
        }}
      >
        <summary aria-label={group.disclosureLabel} className="nav-toggle">
          <span className="nav-toggle-label">{group.disclosureLabel}</span>
        </summary>
        <div className="nav-panel">
          <ul>
            {group.links.map((link, index) => (
              <li key={link.id ?? `${link.href}-${index}`}>
                <a
                  aria-current={
                    itemIsCurrent(link, currentPath) ? "page" : undefined
                  }
                  className="nav-link"
                  href={link.href}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </details>
    </li>
  );
}

export function Header({
  brand,
  items,
  currentPath,
  className,
  primaryNavigationLabel = "Primary",
  menuLabel = "Menu",
  closeMenuLabel = "Close menu",
}: HeaderProps) {
  const headerRef = useRef<HTMLElement>(null);
  const brandRef = useRef<HTMLAnchorElement>(null);
  const menuRef = useRef<HTMLDetailsElement>(null);
  const menuSummaryRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const menuHeadingId = `${useId()}-menu-heading`;
  const enhanced = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const compact = useSyncExternalStore(
    subscribeToCompactRange,
    getCompactRangeSnapshot,
    () => false,
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const previousCompactRef = useRef(compact);
  const visibleItems = activeItems(items);
  const destinationItems = visibleItems.filter(
    (item) => item.kind === "group" || item.presentation === "default" || !item.presentation,
  );
  const actionItems = visibleItems.filter(
    (item) => item.kind === "link" &&
      (item.presentation === "utility" || item.presentation === "primary"),
  );

  useEffect(() => {
    if (!enhanced || !compact || !menuOpen) return;

    const previousOverflow = document.body.style.overflow;
    const background = Array.from(
      document.querySelectorAll<HTMLElement>(
        "body > .skip-link, body > .breadcrumbs, body > .site-main, body > .site-footer, .site-header > .header-inner > .brand-link, .primary-menu > .menu-button",
      ),
    ).map((element) => ({ element, inert: element.inert }));

    document.body.style.overflow = "hidden";
    background.forEach(({ element }) => {
      element.inert = true;
    });
    const frame = requestAnimationFrame(() => closeButtonRef.current?.focus());

    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      background.forEach(({ element, inert }) => {
        element.inert = inert;
      });
    };
  }, [compact, enhanced, menuOpen]);

  useEffect(() => {
    const wasCompact = previousCompactRef.current;
    previousCompactRef.current = compact;
    if (!enhanced || !wasCompact || compact || !menuOpen) return;

    setMenuOpen(false);
    closeNavigationGroups();
    requestAnimationFrame(() => brandRef.current?.focus());
  }, [compact, enhanced, menuOpen]);

  useEffect(() => {
    if (!menuRef.current) return;
    menuRef.current.open = !enhanced || !compact || menuOpen;
  }, [compact, enhanced, menuOpen]);

  useEffect(() => {
    if (!enhanced || compact) return;

    const closeFromOutside = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) {
        closeNavigationGroups();
      }
    };
    document.addEventListener("pointerdown", closeFromOutside);
    return () => document.removeEventListener("pointerdown", closeFromOutside);
  }, [compact, enhanced]);

  function closeNavigationGroups(except?: HTMLDetailsElement) {
    headerRef.current
      ?.querySelectorAll<HTMLDetailsElement>("details[data-nav-group][open]")
      .forEach((details) => {
        if (details !== except) details.open = false;
      });
  }

  function handleGroupOpen(details: HTMLDetailsElement) {
    if (enhanced) closeNavigationGroups(details);
  }

  function closeMenu(restoreFocus = true) {
    if (menuRef.current) menuRef.current.open = false;
    setMenuOpen(false);
    closeNavigationGroups();
    if (restoreFocus) {
      requestAnimationFrame(() => menuSummaryRef.current?.focus());
    }
  }

  function handleHeaderKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      const target = event.target as HTMLElement;
      const openGroup = target.closest<HTMLDetailsElement>(
        "details[data-nav-group][open]",
      );

      if (openGroup) {
        event.preventDefault();
        event.stopPropagation();
        openGroup.open = false;
        openGroup.querySelector<HTMLElement>("summary")?.focus();
        return;
      }

      if (enhanced && compact && menuOpen) {
        event.preventDefault();
        event.stopPropagation();
        closeMenu();
        return;
      }
    }

    if (
      event.key !== "Tab" ||
      !enhanced ||
      !compact ||
      !menuOpen ||
      !menuRef.current
    ) {
      return;
    }

    const panel = menuRef.current.querySelector<HTMLElement>(".menu-panel");
    const focusable = Array.from(
      panel?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    ).filter((element) => element.getClientRects().length > 0);

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function handleFocusLeave(event: FocusEvent<HTMLElement>) {
    if (!enhanced || compact) return;
    const next = event.relatedTarget as Node | null;
    headerRef.current
      ?.querySelectorAll<HTMLDetailsElement>("details[data-nav-group][open]")
      .forEach((details) => {
        if (!next || !details.contains(next)) details.open = false;
      });
  }

  function renderNavigationItem(item: HeaderItem, index: number) {
    if (item.kind === "group") {
      return (
        <NavigationGroup
          currentPath={currentPath}
          group={item}
          key={item.id ?? `${item.href}-${index}`}
          onOpen={handleGroupOpen}
        />
      );
    }

    return (
      <li className="menu-section" key={item.id ?? item.href}>
        <a
          aria-current={itemIsCurrent(item, currentPath) ? "page" : undefined}
          className={classNames(
            "nav-link",
            item.presentation === "utility" && "nav-link-utility",
            item.presentation === "primary" && "button button-primary",
          )}
          href={item.href}
        >
          {item.label}
        </a>
      </li>
    );
  }

  return (
    <header
      className={classNames("site-header", className)}
      ref={headerRef}
    >
      <div className="header-inner">
        <a className="brand-link" href={brand.href ?? "/"} ref={brandRef}>
          {brand.label}
        </a>

        {/* Native details is the single delegated disclosure/focus boundary. */}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
        <details
          className={classNames("primary-menu", enhanced && "is-enhanced")}
          open={!enhanced || !compact || menuOpen}
          onBlurCapture={handleFocusLeave}
          onKeyDown={handleHeaderKeyDown}
          onToggle={(event) => {
            if (enhanced && compact) setMenuOpen(event.currentTarget.open);
          }}
          ref={menuRef}
        >
          <summary className="menu-button" ref={menuSummaryRef}>
            {menuLabel}
          </summary>
          <div
            aria-labelledby={
              enhanced && compact && menuOpen ? menuHeadingId : undefined
            }
            aria-modal={enhanced && compact && menuOpen ? true : undefined}
            className="menu-panel"
            role={enhanced && compact && menuOpen ? "dialog" : undefined}
          >
            <div className="menu-panel-inner">
              {enhanced && compact ? (
                <div className="menu-panel-head">
                  <h2 id={menuHeadingId}>{menuLabel}</h2>
                  <button
                    className="menu-close"
                    onClick={() => closeMenu()}
                    ref={closeButtonRef}
                    type="button"
                  >
                    {closeMenuLabel}
                  </button>
                </div>
              ) : null}
              <nav
                aria-label={primaryNavigationLabel}
                className="primary-navigation"
              >
                <div className="navigation-layout">
                  <ul className="nav-list nav-list-destinations">
                    {destinationItems.map(renderNavigationItem)}
                  </ul>
                  <ul className="nav-list nav-list-actions">
                    {actionItems.map(renderNavigationItem)}
                  </ul>
                </div>
              </nav>
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}
