import { useId, type ReactNode } from "react";
import { ButtonLink } from "./ButtonLink";

export interface SectionProps {
  id?: string;
  eyebrow?: ReactNode;
  heading?: ReactNode;
  headingLevel?: "h2" | "h3";
  intro?: ReactNode;
  children: ReactNode;
  className?: string;
}

export interface CalloutProps {
  heading?: ReactNode;
  headingLevel?: "h2" | "h3";
  children: ReactNode;
  id?: string;
  className?: string;
}

export interface CardProps {
  eyebrow?: ReactNode;
  heading: ReactNode;
  headingLevel?: "h2" | "h3";
  children?: ReactNode;
  link?: {
    label: ReactNode;
    href: string;
    active?: boolean;
  };
  id?: string;
  className?: string;
}

export interface CardGridProps {
  children: ReactNode;
  className?: string;
}

export interface ComparisonColumn {
  id: string;
  label: ReactNode;
}

export interface ComparisonRow {
  id?: string;
  cells: readonly ReactNode[];
}

export interface ComparisonTableProps {
  caption: ReactNode;
  columns: readonly ComparisonColumn[];
  rows: readonly ComparisonRow[];
  scrollLabel?: string;
  rowHeaderColumn?: number;
  className?: string;
}

export interface MethodStep {
  id?: string;
  number?: ReactNode;
  heading: ReactNode;
  description: ReactNode;
  output?: ReactNode;
  active?: boolean;
}

export interface MethodStepsProps {
  steps: readonly MethodStep[];
  headingLevel?: "h2" | "h3";
  className?: string;
}

export interface ChecklistGroup {
  id?: string;
  heading: ReactNode;
  items: readonly ReactNode[];
  active?: boolean;
}

export interface ChecklistProps {
  groups: readonly ChecklistGroup[];
  headingLevel?: "h2" | "h3";
  className?: string;
}

function classNames(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function Section({
  id,
  eyebrow,
  heading,
  headingLevel = "h2",
  intro,
  children,
  className,
}: SectionProps) {
  const generatedId = useId();
  const headingId = heading
    ? id
      ? `${id}-heading`
      : `${generatedId}-heading`
    : undefined;
  const Heading = headingLevel;

  return (
    <section
      aria-labelledby={headingId}
      className={classNames("section", className)}
      id={id}
    >
      {eyebrow ? <p className="section-eyebrow">{eyebrow}</p> : null}
      {heading ? <Heading id={headingId}>{heading}</Heading> : null}
      {intro ? <div className="section-intro">{intro}</div> : null}
      {children}
    </section>
  );
}

export function Callout({
  heading,
  headingLevel = "h2",
  children,
  id,
  className,
}: CalloutProps) {
  const generatedId = useId();
  const headingId = heading
    ? id
      ? `${id}-heading`
      : `${generatedId}-heading`
    : undefined;
  const Heading = headingLevel;

  return (
    <aside
      aria-labelledby={headingId}
      className={classNames("callout", className)}
      id={id}
    >
      {heading ? <Heading id={headingId}>{heading}</Heading> : null}
      {children}
    </aside>
  );
}

export function Card({
  eyebrow,
  heading,
  headingLevel = "h3",
  children,
  link,
  id,
  className,
}: CardProps) {
  const generatedId = useId();
  const headingId = id ? `${id}-heading` : `${generatedId}-heading`;
  const Heading = headingLevel;

  return (
    <article
      aria-labelledby={headingId}
      className={classNames("card", className)}
      id={id}
    >
      {eyebrow ? <p className="card-eyebrow">{eyebrow}</p> : null}
      <Heading id={headingId}>{heading}</Heading>
      {children ? <div className="card-body">{children}</div> : null}
      {link ? (
        <ButtonLink
          active={link.active}
          href={link.href}
          label={link.label}
          variant="link"
        />
      ) : null}
    </article>
  );
}

export function CardGrid({ children, className }: CardGridProps) {
  return <div className={classNames("card-grid", className)}>{children}</div>;
}

export function ComparisonTable({
  caption,
  columns,
  rows,
  scrollLabel,
  rowHeaderColumn,
  className,
}: ComparisonTableProps) {
  const generatedId = useId();
  const scrollLabelId = `${generatedId}-scroll-label`;

  return (
    <>
      {scrollLabel ? (
        <p className="comparison-scroll-label" id={scrollLabelId}>
          {scrollLabel}
        </p>
      ) : null}
      <div
        aria-labelledby={scrollLabel ? scrollLabelId : undefined}
        className={classNames("comparison-wrap", className)}
        role={scrollLabel ? "region" : undefined}
        tabIndex={scrollLabel ? 0 : undefined}
      >
        <table className="comparison-table">
          <caption>{caption}</caption>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.id} scope="col">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={row.id ?? `row-${rowIndex}`}>
                {row.cells.map((cell, cellIndex) => {
                  const Cell = rowHeaderColumn === cellIndex ? "th" : "td";

                  return (
                    <Cell
                      key={`${columns[cellIndex]?.id ?? cellIndex}-${cellIndex}`}
                      scope={Cell === "th" ? "row" : undefined}
                    >
                      {cell}
                    </Cell>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function MethodSteps({
  steps,
  headingLevel = "h2",
  className,
}: MethodStepsProps) {
  const visibleSteps = steps.filter((step) => step.active !== false);
  const Heading = headingLevel;

  return (
    <ol className={classNames("method-steps", className)}>
      {visibleSteps.map((step, index) => (
        <li className="method-step" id={step.id} key={step.id ?? index}>
          <span aria-hidden="true" className="method-number">
            {step.number ?? String(index + 1).padStart(2, "0")}
          </span>
          <Heading>{step.heading}</Heading>
          <div className="method-description">{step.description}</div>
          {step.output ? (
            <div className="method-output">{step.output}</div>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export function Checklist({
  groups,
  headingLevel = "h2",
  className,
}: ChecklistProps) {
  const generatedId = useId();
  const visibleGroups = groups.filter((group) => group.active !== false);
  const Heading = headingLevel;

  return (
    <div className={classNames("checklist-grid", className)}>
      {visibleGroups.map((group, groupIndex) => {
        const headingId = `${generatedId}-group-${groupIndex}`;

        return (
          <section
            aria-labelledby={headingId}
            className="checklist-group"
            id={group.id}
            key={group.id ?? groupIndex}
          >
            <Heading id={headingId}>{group.heading}</Heading>
            <ul>
              {group.items.map((item, itemIndex) => (
                <li key={itemIndex}>{item}</li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
