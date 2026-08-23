import type { AnchorHTMLAttributes, ReactNode } from "react";
import { isPublicLinkActive } from "./linkActivation";

export type ButtonLinkVariant = "primary" | "secondary" | "link";

export interface ButtonLinkProps
  extends Omit<
    AnchorHTMLAttributes<HTMLAnchorElement>,
    "children" | "className" | "href"
  > {
  href: string;
  label: ReactNode;
  variant?: ButtonLinkVariant;
  active?: boolean;
  className?: string;
}

export interface CTAAction
  extends Omit<ButtonLinkProps, "active" | "className"> {
  id?: string;
  active?: boolean;
  className?: string;
}

export interface CTAGroupProps {
  actions: readonly CTAAction[];
  className?: string;
}

function classNames(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function ButtonLink({
  href,
  label,
  variant = "primary",
  active,
  className,
  ...anchorProps
}: ButtonLinkProps) {
  if (!isPublicLinkActive(href, active)) {
    return null;
  }

  return (
    <a
      {...anchorProps}
      className={classNames(
        "button",
        variant === "primary" && "button-primary",
        variant === "secondary" && "button-secondary",
        variant === "link" && "button-link",
        className,
      )}
      href={href}
    >
      {label}
    </a>
  );
}

export function CTAGroup({ actions, className }: CTAGroupProps) {
  const visibleActions = actions.filter((action) =>
    isPublicLinkActive(action.href, action.active),
  );

  if (visibleActions.length === 0) {
    return null;
  }

  return (
    <div className={classNames("cta-group", className)}>
      {visibleActions.map((action, index) => (
        <ButtonLink
          {...action}
          key={action.id ?? `${action.href}-${index}`}
        />
      ))}
    </div>
  );
}

export function LinkList({ actions, className }: CTAGroupProps) {
  const visibleActions = actions.filter((action) =>
    isPublicLinkActive(action.href, action.active),
  );

  if (visibleActions.length === 0) {
    return null;
  }

  return (
    <ul className={classNames("link-list", className)}>
      {visibleActions.map((action, index) => (
        <li key={action.id ?? `${action.href}-${index}`}>
          <ButtonLink {...action} variant="link" />
        </li>
      ))}
    </ul>
  );
}
