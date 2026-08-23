import { useId, type ReactNode } from "react";

export interface EvidenceRecordLabels {
  statement: ReactNode;
  source: ReactNode;
  limit: ReactNode;
  test: ReactNode;
}

export interface EvidenceRecordProps {
  heading: ReactNode;
  statement: ReactNode;
  source: ReactNode;
  limit: ReactNode;
  test: ReactNode;
  labels?: Partial<EvidenceRecordLabels>;
  headingLevel?: "h2" | "h3";
  id?: string;
  className?: string;
}

const defaultLabels: EvidenceRecordLabels = {
  statement: "Statement",
  source: "Source",
  limit: "Limit",
  test: "Test",
};

function classNames(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function EvidenceRecord({
  heading,
  statement,
  source,
  limit,
  test,
  labels,
  headingLevel = "h2",
  id,
  className,
}: EvidenceRecordProps) {
  const generatedId = useId();
  const headingId = id ? `${id}-heading` : `${generatedId}-heading`;
  const Heading = headingLevel;
  const terms = { ...defaultLabels, ...labels };
  const rows = [
    [terms.statement, statement],
    [terms.source, source],
    [terms.limit, limit],
    [terms.test, test],
  ] as const;

  return (
    <article
      aria-labelledby={headingId}
      className={classNames("evidence-record", className)}
      id={id}
    >
      <Heading id={headingId}>{heading}</Heading>
      <dl className="evidence-grid">
        {rows.map(([term, value], index) => (
          <div className="evidence-row" key={index}>
            <dt>{term}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}
