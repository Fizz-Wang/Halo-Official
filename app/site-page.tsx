import { Fragment, type ReactNode } from "react";
import type {
  ActiveSitePage,
  ContentAction,
  ContentBlock,
  EvidenceRecord as EvidenceRecordData,
  ProseParagraph,
} from "../lib/site-content";
import {
  Breadcrumbs,
  AnchorFocus,
  CTAGroup,
  EvidenceRecord,
  ExperienceLayer,
  Footer,
  HaloDatabaseFlow,
  Header,
  HomeTechnologyStoryV2,
  LinkList,
  ScrollableRegion,
  SkipLink,
  type ButtonLinkVariant,
} from "./components";
import { footerGroups, headerItems } from "./shell-data";

function actionVariant(action: ContentAction): ButtonLinkVariant {
  if (action.kind === "primary") return "primary";
  if (action.kind === "text") return "link";
  return "secondary";
}

function actionsFor(actions: readonly ContentAction[]) {
  return actions.map((action, index) => ({
    id: `${index}-${action.href}`,
    href: action.href,
    label: renderApprovedText(action.label),
    variant: actionVariant(action),
  }));
}

function Paragraphs({ paragraphs }: { paragraphs: readonly string[] }) {
  return (
    <div className="prose-stack">
      {paragraphs.map((paragraph, index) => (
        <p key={index}>{renderApprovedText(paragraph)}</p>
      ))}
    </div>
  );
}

const TECHNICAL_TOKEN_PATTERN = /(Halo 1\.0\.16|PL\/SQL|SQL|MySQL|PostgreSQL|Oracle)/gi;
const TECHNICAL_TOKEN_EXACT = /^(?:Halo 1\.0\.16|PL\/SQL|SQL|MySQL|PostgreSQL|Oracle)$/i;

function renderApprovedText(text: string): ReactNode {
  return (
    <span className="approved-text">
      {text.split(TECHNICAL_TOKEN_PATTERN).map((part, index) =>
        TECHNICAL_TOKEN_EXACT.test(part) ? (
          <bdi className="technical-token" dir="ltr" key={`${part}-${index}`}>
            {part}
          </bdi>
        ) : (
          <Fragment key={`${part}-${index}`}>{part}</Fragment>
        ),
      )}
    </span>
  );
}

function ApprovedParagraph({ paragraph }: { paragraph: ProseParagraph }) {
  const lead = paragraph.emphasizeLeadIn;

  if (!lead || !paragraph.text.startsWith(lead)) {
    return <p>{renderApprovedText(paragraph.text)}</p>;
  }

  return (
    <p>
      <strong>{lead}</strong>
      {renderApprovedText(paragraph.text.slice(lead.length))}
    </p>
  );
}

function LocalNavigation({ page }: { page: ActiveSitePage }) {
  if (page.localNavigation.length === 0) return null;

  return (
    <nav aria-label="On this page" className="local-nav">
      <p className="local-nav-title">On this page</p>
      <ol>
        {page.localNavigation.map((item) => (
          <li key={item.anchor}>
            <a href={`#${item.anchor}`}>{renderApprovedText(item.label)}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function blockVariant(page: ActiveSitePage, block: ContentBlock, index: number) {
  void page;
  void block;
  void index;
  return undefined;
}

function followingLinks(page: ActiveSitePage, index: number) {
  const next = page.blocks[index + 1];
  return next?.type === "links" ? next : undefined;
}

function consumesFollowingLinks(page: ActiveSitePage, index: number) {
  void page;
  void index;
  return false;
}

function isConsumedLinksBlock(page: ActiveSitePage, index: number) {
  return index > 0 && consumesFollowingLinks(page, index - 1);
}

function renderEvidenceRecord(
  record: EvidenceRecordData,
  id: string | undefined,
  labels: {
    readonly statement: string;
    readonly source: string;
    readonly limit: string;
    readonly test: string;
  },
) {
  return (
    <EvidenceRecord
      heading={renderApprovedText(record.heading)}
      headingLevel="h3"
      id={id}
      key={id ?? record.heading}
      labels={labels}
      limit={renderApprovedText(record.limit)}
      source={<span className="source-token">{record.source}</span>}
      statement={renderApprovedText(record.statement)}
      test={renderApprovedText(record.test)}
    />
  );
}

function Block({
  block,
  page,
  index,
}: {
  block: ContentBlock;
  page: ActiveSitePage;
  index: number;
}) {
  const variant = blockVariant(page, block, index);
  const continuation = consumesFollowingLinks(page, index)
    ? followingLinks(page, index)
    : undefined;

  if (block.type === "cta") {
    return (
      <section
        aria-labelledby={block.heading ? `cta-${index}-heading` : undefined}
        className="final-cta"
        data-block-type={block.type}
        data-reveal="section"
        id={block.anchor}
      >
        <div className="final-cta-inner">
          {block.heading ? (
            <h2 id={`cta-${index}-heading`}>
              {renderApprovedText(block.heading)}
            </h2>
          ) : null}
          {block.body ? <Paragraphs paragraphs={block.body} /> : null}
          <CTAGroup actions={actionsFor(block.actions)} />
        </div>
      </section>
    );
  }

  if (block.type === "prose") {
    const content = (
      <>
        <h2 className="section-heading">{renderApprovedText(block.heading)}</h2>
        <div className="prose-stack">
          {block.paragraphs.map((paragraph, paragraphIndex) => (
            <ApprovedParagraph key={paragraphIndex} paragraph={paragraph} />
          ))}
        </div>
        {block.actions ? (
          <LinkList
            actions={actionsFor(block.actions)}
            className="section-actions"
          />
        ) : null}
      </>
    );

    return (
      <section
        className={`section prose-section${variant ? ` ${variant}` : ""}`}
        data-block-type={block.type}
        data-reveal="section"
        id={block.anchor}
      >
        <div className="section-inner">
          {variant === "local-evidence-note" ? (
            <aside className="local-evidence-note-inner">
              {content}
              {continuation ? (
                <LinkList
                  actions={actionsFor(continuation.actions)}
                  className="section-actions"
                />
              ) : null}
            </aside>
          ) : (
            content
          )}
        </div>
      </section>
    );
  }

  if (block.type === "cards") {
    const gridClass = `card-grid card-grid--${Math.min(
      block.items.length,
      6,
    )}${block.items.length === 2 ? " card-grid-2" : ""}${
      block.items.length >= 4 ? " card-grid-4" : ""
    }`;

    return (
      <section
        aria-labelledby={block.heading ? `cards-${index}-heading` : undefined}
        className={`section cards-section${variant ? ` ${variant}` : ""}`}
        data-block-type={block.type}
        data-reveal="section"
        id={block.anchor}
      >
        <div className="section-inner">
          {block.heading ? (
            <h2 className="section-heading" id={`cards-${index}-heading`}>
              {renderApprovedText(block.heading)}
            </h2>
          ) : null}
          {block.intro ? (
            <div className="section-intro">
              <Paragraphs paragraphs={block.intro} />
            </div>
          ) : null}
          <div className={gridClass}>
            {block.items.map((item, itemIndex) => {
              const CardHeading = block.heading ? "h3" : "h2";
              return (
                <article
                  className="card"
                  data-tilt="card"
                  key={`${item.heading}-${itemIndex}`}
                >
                  <div
                    aria-hidden="true"
                    className={`card-visual card-visual--${(itemIndex % 4) + 1}`}
                  >
                    <i />
                    <i />
                    <i />
                  </div>
                  {item.label ? (
                    <p className="card-eyebrow">{renderApprovedText(item.label)}</p>
                  ) : null}
                  <CardHeading>{renderApprovedText(item.heading)}</CardHeading>
                  {item.body.length > 0 ? (
                    <Paragraphs paragraphs={item.body} />
                  ) : null}
                  {item.actions ? (
                    <CTAGroup
                      actions={actionsFor(item.actions)}
                      className="card-action"
                    />
                  ) : null}
                </article>
              );
            })}
          </div>
          {continuation ? (
            <LinkList
              actions={actionsFor(continuation.actions)}
              className="section-actions"
            />
          ) : null}
        </div>
      </section>
    );
  }

  if (block.type === "evidence") {
    const localRecordAnchors = page.localNavigation
      .filter((item) => item.label.startsWith("Evidence record:"))
      .map((item) => item.anchor);

    return (
      <section
        className="section"
        data-block-type={block.type}
        data-reveal="section"
        id={block.anchor}
      >
        <div className="section-inner">
          <h2 className="section-heading">{renderApprovedText(block.heading)}</h2>
          {block.intro ? (
            <div className="section-intro">
              <Paragraphs paragraphs={block.intro} />
            </div>
          ) : null}
          {block.legend ? (
            <dl className="evidence-legend callout">
              {block.legend.map((item) => (
                <div key={item.label}>
                  <dt>{renderApprovedText(item.label)}</dt>
                  <dd>{renderApprovedText(item.description)}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          <div className="evidence-list">
            {block.records.map((record, recordIndex) =>
              renderEvidenceRecord(
                record,
                record.anchor ?? localRecordAnchors[recordIndex],
                block.fieldLabels,
              ),
            )}
          </div>
        </div>
      </section>
    );
  }

  if (block.type === "steps") {
    const headingId = block.anchor
      ? `${block.anchor}-heading`
      : `steps-${index}-heading`;
    return (
      <section
        aria-labelledby={block.heading ? headingId : undefined}
        className="section"
        data-block-type={block.type}
        data-reveal="section"
        id={block.anchor}
      >
        <div className="section-inner">
          {block.heading ? (
            <h2 className="section-heading" id={headingId}>
              {renderApprovedText(block.heading)}
            </h2>
          ) : null}
            <ol className={`method-steps method-steps--${block.items.length}`}>
            {block.items.map((item, stepIndex) => (
              <li
                className="method-step"
                id={item.anchor}
                key={`${item.heading}-${stepIndex}`}
              >
                <span aria-hidden="true" className="method-number">
                  {String(stepIndex + 1).padStart(2, "0")}
                </span>
                <h3 aria-label={item.heading}>
                  {renderApprovedText(item.heading.replace(/^\d+\.\s+/, ""))}
                </h3>
                {item.body ? <Paragraphs paragraphs={item.body} /> : null}
              </li>
            ))}
          </ol>
        </div>
      </section>
    );
  }

  if (block.type === "comparison") {
    const headingId = `comparison-${index}-heading`;
    return (
      <section
        aria-labelledby={headingId}
        className="section"
        data-block-type={block.type}
        data-reveal="section"
        id={block.anchor}
      >
        <div className="section-inner">
          <h2 className="section-heading" id={headingId}>
            {renderApprovedText(block.heading)}
          </h2>
          <ScrollableRegion
            className={`comparison-wrap comparison-wrap--${block.columns.length}`}
            labelledBy={headingId}
          >
            <table className="comparison-table">
              <caption className="sr-only">
                {renderApprovedText(block.heading)}
              </caption>
              <thead>
                <tr>
                  {block.columns.map((column) => (
                    <th key={column} scope="col">
                      {renderApprovedText(column)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td key={`${rowIndex}-${cellIndex}`}>
                        {renderApprovedText(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableRegion>
        </div>
      </section>
    );
  }

  if (block.type === "checklist") {
    const checklistHeading = page.id === "P11"
      ? block.heading.replace(/^\d+\.\s+/, "")
      : block.heading;

    return (
      <section
        className="section"
        data-block-type={block.type}
        data-reveal="section"
        id={block.anchor}
      >
        <div className="section-inner">
          <h2 className="section-heading">{renderApprovedText(checklistHeading)}</h2>
          {block.intro ? (
            <div className="section-intro">
              <Paragraphs paragraphs={block.intro} />
            </div>
          ) : null}
          {block.ordered ? (
            <ol className="checklist-list">
              {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>{renderApprovedText(item)}</li>
              ))}
            </ol>
          ) : (
            <ul className="checklist-list">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderApprovedText(item)}</li>
              ))}
            </ul>
          )}
          {block.outro ? <Paragraphs paragraphs={block.outro} /> : null}
          {block.actions ? (
            <CTAGroup
              actions={actionsFor(block.actions)}
              className="section-actions"
            />
          ) : null}
        </div>
      </section>
    );
  }

  if (block.type === "callout") {
    const labelId = block.anchor ? `${block.anchor}-heading` : undefined;
    return (
      <section
        aria-labelledby={labelId}
        className="section section-compact"
        data-block-type={block.type}
        data-reveal="section"
        id={block.anchor}
      >
        <div className="section-inner">
          <aside className="callout">
            {block.label ? (
              block.anchor ? (
                <h2 className="callout-label" id={labelId}>
                  {renderApprovedText(block.label)}
                </h2>
              ) : (
                <p className="callout-label">{renderApprovedText(block.label)}</p>
              )
            ) : null}
            {block.heading ? <h2>{renderApprovedText(block.heading)}</h2> : null}
            <Paragraphs paragraphs={block.body} />
          </aside>
        </div>
      </section>
    );
  }

  if (block.type === "links") {
    if (isConsumedLinksBlock(page, index)) return null;

    return (
      <section
        aria-labelledby={block.heading ? `links-${index}-heading` : undefined}
        className="section section-compact links-section"
        data-block-type={block.type}
        data-reveal="section"
        id={block.anchor}
      >
        <div className="section-inner">
          {block.heading ? (
            <h2 id={`links-${index}-heading`}>
              {renderApprovedText(block.heading)}
            </h2>
          ) : null}
          {block.body ? <Paragraphs paragraphs={block.body} /> : null}
          <LinkList actions={actionsFor(block.actions)} />
        </div>
      </section>
    );
  }

  if (block.type === "accordion") {
    const headingId = `accordion-${index}-heading`;
    return (
      <section
        aria-labelledby={headingId}
        className="section accordion-section"
        data-block-type={block.type}
        data-reveal="section"
        id={block.anchor}
      >
        <div className="section-inner">
          <h2 className="section-heading" id={headingId}>
            {renderApprovedText(block.heading)}
          </h2>
          {block.intro ? (
            <div className="section-intro"><Paragraphs paragraphs={block.intro} /></div>
          ) : null}
          <div className="accordion-list">
            {block.items.map((item, itemIndex) => (
              <details className="accordion-item" key={`${item.heading}-${itemIndex}`}>
                <summary>
                  <span>{renderApprovedText(item.heading)}</span>
                  {item.summary ? <small>{renderApprovedText(item.summary)}</small> : null}
                </summary>
                <div className="accordion-panel">
                  <Paragraphs paragraphs={item.details} />
                  {item.tags?.length ? (
                    <ul aria-label={`${item.heading} capabilities`} className="term-list">
                      {item.tags.map((tag) => <li key={tag}>{renderApprovedText(tag)}</li>)}
                    </ul>
                  ) : null}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (block.type === "diagram") {
    const headingId = `diagram-${index}-heading`;
    return (
      <section
        aria-labelledby={headingId}
        className="section diagram-section"
        data-block-type={block.type}
        data-reveal="section"
        id={block.anchor}
      >
        <div className="section-inner">
          {block.eyebrow ? <p className="eyebrow">{renderApprovedText(block.eyebrow)}</p> : null}
          <h2 className="section-heading" id={headingId}>{renderApprovedText(block.heading)}</h2>
          {block.intro ? (
            <div className="section-intro"><Paragraphs paragraphs={block.intro} /></div>
          ) : null}
          <figure className={`architecture-diagram architecture-diagram--${block.layout}`}>
            <div className="diagram-nodes">
              {block.nodes.map((node, nodeIndex) => (
                <div
                  className={`diagram-node diagram-node--${node.tone ?? "default"}`}
                  key={`${node.heading}-${nodeIndex}`}
                >
                  {node.label ? <span className="diagram-node-label">{renderApprovedText(node.label)}</span> : null}
                  <h3>{renderApprovedText(node.heading)}</h3>
                  {node.body ? <Paragraphs paragraphs={node.body} /> : null}
                </div>
              ))}
            </div>
            {block.caption ? (
              <figcaption><Paragraphs paragraphs={block.caption} /></figcaption>
            ) : null}
          </figure>
        </div>
      </section>
    );
  }

  if (block.type === "facts") {
    return (
      <section
        className="section facts-section"
        data-block-type={block.type}
        data-reveal="section"
        id={block.anchor}
      >
        <div className="section-inner">
          {block.heading ? <h2 className="section-heading">{renderApprovedText(block.heading)}</h2> : null}
          {block.intro ? (
            <div className="section-intro"><Paragraphs paragraphs={block.intro} /></div>
          ) : null}
          <dl className="facts-grid">
            {block.items.map((item) => (
              <div className="fact" key={`${item.value}-${item.label}`}>
                <dt><span>{renderApprovedText(item.value)}</span>{renderApprovedText(item.label)}</dt>
                {item.body ? <dd>{renderApprovedText(item.body)}</dd> : null}
              </div>
            ))}
          </dl>
        </div>
      </section>
    );
  }

  const exhaustive: never = block;
  return exhaustive as ReactNode;
}

function PageHero({ page }: { page: ActiveSitePage }) {
  const isExperienceHero = page.id === "P01";

  return (
    <section
      aria-labelledby="page-title"
      className={`page-hero page-hero--signal${
        isExperienceHero ? " page-hero--experience" : ""
      }`}
    >
      <div
        className={`page-hero-inner page-hero-inner--signal${
          isExperienceHero ? " page-hero-inner--experience" : ""
        }`}
      >
        <div className="page-hero-copy">
          {page.hero.eyebrow ? (
            <p className="eyebrow">{renderApprovedText(page.hero.eyebrow)}</p>
          ) : null}
          <h1 id="page-title">{renderApprovedText(page.hero.h1)}</h1>
          <p className="lead">{renderApprovedText(page.hero.lead)}</p>
          <CTAGroup actions={actionsFor(page.hero.actions)} />
        </div>
        <HaloDatabaseFlow variant={isExperienceHero ? "primary" : "ambient"} />
      </div>
    </section>
  );
}

export function SitePage({ page }: { page: ActiveSitePage }) {
  const hasLocalNavigation = page.localNavigation.length > 0;
  const indexedBlocks = page.blocks.map((block, index) => ({ block, index }));
  const finalCta = indexedBlocks.at(-1)?.block.type === "cta"
    ? indexedBlocks.at(-1)
    : undefined;
  const usesEvaluationBoard = page.id === "P11";
  const separatesFinalCta = Boolean(finalCta) && (
    hasLocalNavigation || usesEvaluationBoard
  );
  const contentBlocks = separatesFinalCta
    ? indexedBlocks.slice(0, -1)
    : indexedBlocks;
  const renderBlock = ({ block, index }: (typeof indexedBlocks)[number]) => (
    <Block block={block} index={index} key={`${block.type}-${index}`} page={page} />
  );

  return (
    <>
      <SkipLink targetId="main-content" />
      <Header
        brand={{ label: "Halo Database", href: "/" }}
        className={page.id === "P01" ? "site-header--experience" : undefined}
        currentPath={page.path}
        items={headerItems}
      />
      <Breadcrumbs items={page.breadcrumb} />
      <main className="site-main" data-page-id={page.id} id="main-content">
        <PageHero page={page} />
        {page.id === "P01" ? (
          <HomeTechnologyStoryV2 blocks={page.blocks} />
        ) : hasLocalNavigation ? (
          <div className="local-layout">
            <LocalNavigation page={page} />
            <div className="technical-column">{contentBlocks.map(renderBlock)}</div>
          </div>
        ) : usesEvaluationBoard ? (
          <div className="evaluation-board">{contentBlocks.map(renderBlock)}</div>
        ) : (
          contentBlocks.map(renderBlock)
        )}
        {separatesFinalCta && finalCta ? renderBlock(finalCta) : null}
      </main>
      <Footer
        brand={{ label: "Halo Database", href: "/" }}
        currentPath={page.path}
        groups={footerGroups}
      />
      <AnchorFocus />
      <ExperienceLayer />
    </>
  );
}
