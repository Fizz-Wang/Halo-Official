"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- Vinext's RSC prefetch currently errors for links inside these stateful explainers; native same-origin anchors keep navigation progressive and reliable. */

import { useState } from "react";
import type {
  ContentBlock,
  CtaBlock,
  DiagramBlock,
  DiagramNode,
  FactsBlock,
} from "../../lib/site-content";

type ModeId = "oracle" | "mysql" | "postgresql";
type MigrationSurfaceId = "objects" | "logic" | "access";
type RoutingCaseId = "read" | "write" | "transaction";
type PartitionId = "range-a" | "range-b" | "range-c";

const MODE_DETAILS: ReadonlyArray<{
  id: ModeId;
  label: string;
  entry: string;
  surface: string;
}> = [
  {
    id: "oracle",
    label: "Oracle",
    entry: "Oracle-oriented operating-mode path",
    surface: "Types · SQL behavior · PL/oraSQL · PACKAGE",
  },
  {
    id: "mysql",
    label: "MySQL",
    entry: "MySQL-compatible service path",
    surface: "Types · functions · operators · DML",
  },
  {
    id: "postgresql",
    label: "PostgreSQL",
    entry: "Native PostgreSQL protocol path",
    surface: "Native types · indexes · partitions · objects",
  },
];

const E5_LAYERS = [
  {
    label: "Protocol",
    detail: "The selected operating-mode entry receives the application request.",
  },
  {
    label: "Parsing & semantics",
    detail: "Mode-oriented syntax and application-visible behavior are interpreted.",
  },
  {
    label: "Optimization",
    detail: "A mode-aware planning layer receives the interpreted request.",
  },
  {
    label: "Execution",
    detail: "The Halo kernel executes the planned work against shared database foundations.",
  },
] as const;

const MIGRATION_SURFACES: ReadonlyArray<{
  id: MigrationSurfaceId;
  label: string;
  intake: readonly string[];
  focus: string;
}> = [
  {
    id: "objects",
    label: "SQL & objects",
    intake: ["Types and SQL behavior", "Views and object metadata", "Loaded values and dates"],
    focus: "Keep source behavior, selected Halo mode, and representative data attached to the decision.",
  },
  {
    id: "logic",
    label: "Procedural logic",
    intake: ["Routines and packages", "Session and transaction state", "Exceptions and side effects"],
    focus: "Treat procedural behavior as a testable dependency, not as an afterthought to moving tables.",
  },
  {
    id: "access",
    label: "Remote access",
    intake: ["DBLINK and query mapping", "Drivers and tools", "External transaction boundaries"],
    focus: "Leave integrations and unresolved remote paths visible before a cutover decision.",
  },
];

const SHIELD_STEPS = [
  {
    label: "Observe",
    title: "Current role and health state",
    detail: "Traffic still reaches the current read/write role while Shield observes the topology.",
  },
  {
    label: "Authority",
    title: "Health, quorum, and leader state",
    detail: "The control plane must establish decision authority before a role change can continue.",
  },
  {
    label: "Protect",
    title: "Fence and check eligibility",
    detail: "The former primary is fenced and a replica must be eligible before the serving role changes.",
  },
  {
    label: "Move",
    title: "Role and service address may move",
    detail: "When the documented conditions pass, role lifecycle and VIP movement can complete the path.",
  },
] as const;

const ROUTING_CASES: ReadonlyArray<{
  id: RoutingCaseId;
  label: string;
  request: string;
  classification: string;
  outcome: string;
}> = [
  {
    id: "read",
    label: "Read",
    request: "Read-only statement",
    classification: "Statement semantics indicate local read work",
    outcome: "Execute on the read-only node",
  },
  {
    id: "write",
    label: "Write",
    request: "Write statement",
    classification: "Database semantics indicate write work",
    outcome: "Forward to read/write; return through the original connection",
  },
  {
    id: "transaction",
    label: "Transaction write",
    request: "Write detected inside a transaction block",
    classification: "Transaction state participates after write work is detected",
    outcome: "Keep detected write work on the read/write path for that transaction context",
  },
];

const PARTITIONS: ReadonlyArray<{
  id: PartitionId;
  label: string;
  range: string;
  node: string;
}> = [
  { id: "range-a", label: "Range A", range: "Earlier key range", node: "Data node A" },
  { id: "range-b", label: "Range B", range: "Middle key range", node: "Data node B" },
  { id: "range-c", label: "Range C", range: "Later key range", node: "Data node C" },
];

const SECTION_LINKS: Readonly<Record<string, { href: string; label: string }>> = {
  COMPATIBILITY: {
    href: "/product/compatibility/",
    label: "Explore E5 and operating modes",
  },
  MIGRATION: {
    href: "/oracle-migration-evaluation/",
    label: "Follow the Oracle migration path",
  },
  "HIGH AVAILABILITY": {
    href: "/product/availability-recovery/#shield",
    label: "Review continuity and Shield",
  },
  "READ / WRITE ROUTING": {
    href: "/product/distributed/#twr",
    label: "Inspect TWR boundaries",
  },
  SHARDING: {
    href: "/product/distributed/#hds",
    label: "Explore HDS placement",
  },
};

const ACTION_NOTES: Readonly<Record<string, string>> = {
  "/resources/evaluation-checklist/": "Capture the workload, target topology, tests, owners, and decision criteria.",
  "/oracle-migration-evaluation/": "Turn Oracle dependencies into a versioned fit-and-gap investigation.",
  "/request-demo/?source=home-final": "Prepare the topics and stakeholder context for a product introduction.",
  "/contact-sales/?source=home-final": "Organize licensing, procurement, deployment-scope, or regional-fit questions.",
};

function requireBlock<T extends ContentBlock["type"]>(
  blocks: readonly ContentBlock[],
  type: T,
  anchor?: string,
): Extract<ContentBlock, { type: T }> {
  const block = blocks.find(
    (candidate) => candidate.type === type && (!anchor || candidate.anchor === anchor),
  );

  if (!block) throw new Error(`Home block ${anchor ?? type} (${type}) is missing.`);
  return block as Extract<ContentBlock, { type: T }>;
}

function requireNode(block: DiagramBlock, label: string): DiagramNode {
  const node = block.nodes.find(
    (candidate) => candidate.label?.trim().toUpperCase() === label,
  );

  if (!node) throw new Error(`Home technology node ${label} is missing.`);
  if (!node.body || node.body.length < 3) {
    throw new Error(`Home technology node ${label} needs problem, mechanism, and result copy.`);
  }
  return node;
}

function MechanismHeading({ index, node }: { index: number; node: DiagramNode }) {
  return (
    <header className="home-mechanism-heading">
      <p><span>{String(index).padStart(2, "0")}</span>{node.label}</p>
      <h3 id={`home-mechanism-${index}-heading`}>{node.heading}</h3>
    </header>
  );
}

function MechanismCausality({ node }: { node: DiagramNode }) {
  const body = node.body ?? [];
  return (
    <dl className="home-mechanism-causality">
      <div data-part="problem">
        <dt>Customer problem</dt>
        <dd>{body[0]}</dd>
      </div>
      <div data-part="mechanism">
        <dt>Halo mechanism</dt>
        <dd>{body[1]}</dd>
      </div>
      <div data-part="result">
        <dt>What changes</dt>
        <dd>{body[2]}</dd>
      </div>
    </dl>
  );
}

function FigureNote({ children }: { children: string }) {
  return (
    <figcaption className="home-figure-note">
      <details>
        <summary>How to read this <span aria-hidden="true">+</span></summary>
        <p>{children}</p>
      </details>
    </figcaption>
  );
}

function MechanismLink({ node }: { node: DiagramNode }) {
  const label = node.label?.trim().toUpperCase() ?? "";
  const link = SECTION_LINKS[label];
  if (!link) return null;
  return <a className="home-mechanism-link" href={link.href}>{link.label}<span aria-hidden="true">↗</span></a>;
}

function ChoiceButtons({
  label,
  items,
  selected,
  onSelect,
}: {
  label: string;
  items: readonly { id: string; label: string }[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div aria-label={label} className="home-mechanism-controls" role="group">
      {items.map((item) => (
        <button
          aria-pressed={selected === item.id}
          key={item.id}
          onClick={() => onSelect(item.id)}
          type="button"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function CompatibilitySection({ node }: { node: DiagramNode }) {
  const [activeMode, setActiveMode] = useState<ModeId>("oracle");
  const [activeLayer, setActiveLayer] = useState(0);
  const mode = MODE_DETAILS.find((candidate) => candidate.id === activeMode) ?? MODE_DETAILS[0];
  const layer = E5_LAYERS[activeLayer] ?? E5_LAYERS[0];

  return (
    <section
      aria-labelledby="home-mechanism-1-heading"
      className="home-mechanism-section home-mechanism-section--compatibility"
      data-reveal="section"
      id="compatibility-mechanism"
    >
      <div className="home-mechanism-shell">
        <MechanismHeading index={1} node={node} />
        <MechanismCausality node={node} />
        <figure
          aria-labelledby="compatibility-figure-heading"
          className="home-compatibility-explainer"
          data-layer={activeLayer}
          data-mode={activeMode}
        >
          <div className="home-compatibility-toolbar">
            <div>
              <span>SELECT ENTRY</span>
              <ChoiceButtons
                items={MODE_DETAILS}
                label="Choose a Halo operating mode"
                onSelect={(id) => setActiveMode(id as ModeId)}
                selected={activeMode}
              />
            </div>
            <p aria-live="polite">
              <small>{mode.entry}</small>
              <strong>{mode.surface}</strong>
            </p>
          </div>
          <div className="home-compatibility-request">
            <span>APPLICATION EXPECTATION</span>
            <strong>{mode.label} behavior</strong>
          </div>
          <div className="home-compatibility-pipeline">
            <span aria-hidden="true" className="home-compatibility-rail" />
            <i aria-hidden="true" className="home-compatibility-token" />
            {E5_LAYERS.map((item, index) => (
              <button
                aria-pressed={activeLayer === index}
                key={item.label}
                onClick={() => setActiveLayer(index)}
                type="button"
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{item.label}</strong>
              </button>
            ))}
          </div>
          <div className="home-compatibility-readout">
            <span>E5 LAYER IN FOCUS</span>
            <strong id="compatibility-figure-heading">{layer.label}</strong>
            <p aria-live="polite">{layer.detail}</p>
          </div>
          <FigureNote>Choose a mode, then inspect where its request is received, interpreted, planned, and executed.</FigureNote>
        </figure>
        <MechanismLink node={node} />
      </div>
    </section>
  );
}

function MigrationSection({ node }: { node: DiagramNode }) {
  const [activeSurface, setActiveSurface] = useState<MigrationSurfaceId>("objects");
  const surface = MIGRATION_SURFACES.find((candidate) => candidate.id === activeSurface) ?? MIGRATION_SURFACES[0];

  return (
    <section
      aria-labelledby="home-mechanism-2-heading"
      className="home-mechanism-section home-mechanism-section--migration"
      data-reveal="section"
      id="migration-mechanism"
    >
      <div className="home-mechanism-shell">
        <MechanismHeading index={2} node={node} />
        <MechanismCausality node={node} />
        <figure aria-labelledby="migration-figure-heading" className="home-migration-explainer">
          <div className="home-migration-toolbar">
            <span>CHOOSE A DEPENDENCY SURFACE</span>
            <ChoiceButtons
              items={MIGRATION_SURFACES}
              label="Choose a migration dependency surface"
              onSelect={(id) => setActiveSurface(id as MigrationSurfaceId)}
              selected={activeSurface}
            />
          </div>
          <div className="home-migration-board" key={activeSurface}>
            <section className="home-migration-intake">
              <small>INVENTORY</small>
              <h3 id="migration-figure-heading">{surface.label}</h3>
              <ul>
                {surface.intake.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </section>
            <span aria-hidden="true" className="home-migration-sorter"><i /><i /><i /></span>
            <div className="home-migration-decisions" role="list">
              <section data-decision="retain" role="listitem">
                <small>DOCUMENTED CANDIDATE</small>
                <strong>Retain for workload verification</strong>
                <span>Preserve the source and applicable Halo mode.</span>
              </section>
              <section data-decision="verify" role="listitem">
                <small>REPRESENTATIVE TEST</small>
                <strong>Verify the behavior that matters</strong>
                <span>Attach inputs, conditions, evidence, and an owner.</span>
              </section>
              <section data-decision="remediate" role="listitem">
                <small>GAP RECORD</small>
                <strong>Remediate or leave unresolved</strong>
                <span>Stop the gap from disappearing into cutover.</span>
              </section>
            </div>
          </div>
          <p aria-live="polite" className="home-migration-focus"><strong>Decision rule</strong>{surface.focus}</p>
          <FigureNote>Dependencies are sorted into evidence-backed decisions; the animation does not imply an automated migration tool.</FigureNote>
        </figure>
        <MechanismLink node={node} />
      </div>
    </section>
  );
}

function AvailabilitySection({ node }: { node: DiagramNode }) {
  const [activeStep, setActiveStep] = useState(0);
  const step = SHIELD_STEPS[activeStep] ?? SHIELD_STEPS[0];

  return (
    <section
      aria-labelledby="home-mechanism-3-heading"
      className="home-mechanism-section home-mechanism-section--availability"
      data-reveal="section"
      id="availability-mechanism"
    >
      <div className="home-mechanism-shell">
        <MechanismHeading index={3} node={node} />
        <MechanismCausality node={node} />
        <figure
          aria-labelledby="availability-figure-heading"
          className="home-availability-explainer"
          data-step={activeStep}
        >
          <div className="home-availability-toolbar">
            <span>INSPECT THE CONDITIONAL ROLE-CHANGE PATH</span>
            <ChoiceButtons
              items={SHIELD_STEPS.map((item, index) => ({ id: String(index), label: item.label }))}
              label="Choose a Shield role-change stage"
              onSelect={(id) => setActiveStep(Number(id))}
              selected={String(activeStep)}
            />
          </div>
          <div className="home-availability-topology">
            <div className="home-availability-service">
              <small>SERVICE ADDRESS / VIP</small>
              <span aria-hidden="true"><i /></span>
            </div>
            <div className="home-availability-node home-availability-node--primary">
              <small>{activeStep >= 2 ? "PROTECTED" : "CURRENT ROLE"}</small>
              <strong>{activeStep >= 2 ? "Former primary · fenced" : "Read/write primary"}</strong>
            </div>
            <div className="home-availability-guards">
              <span data-ready={activeStep >= 1}><i />Quorum + leader state</span>
              <span data-ready={activeStep >= 2}><i />Fencing</span>
              <span data-ready={activeStep >= 2}><i />Eligible replica</span>
            </div>
            <div className="home-availability-node home-availability-node--replica">
              <small>{activeStep >= 3 ? "NEW ROLE" : "REPLICA"}</small>
              <strong>{activeStep >= 3 ? "Read/write role" : "Eligibility checked before promotion"}</strong>
            </div>
          </div>
          <p aria-live="polite" className="home-availability-readout">
            <span>{String(activeStep + 1).padStart(2, "0")}</span>
            <strong id="availability-figure-heading">{step.title}</strong>
            <small>{step.detail}</small>
          </p>
          <FigureNote>Role and VIP movement are shown only after the documented control conditions; topology and policy still govern the outcome.</FigureNote>
        </figure>
        <MechanismLink node={node} />
      </div>
    </section>
  );
}

function RoutingSection({ node }: { node: DiagramNode }) {
  const [activeCase, setActiveCase] = useState<RoutingCaseId>("read");
  const route = ROUTING_CASES.find((candidate) => candidate.id === activeCase) ?? ROUTING_CASES[0];
  const routesToReadWrite = activeCase !== "read";

  return (
    <section
      aria-labelledby="home-mechanism-4-heading"
      className="home-mechanism-section home-mechanism-section--routing"
      data-reveal="section"
      id="routing-mechanism"
    >
      <div className="home-mechanism-shell">
        <MechanismHeading index={4} node={node} />
        <MechanismCausality node={node} />
        <figure
          aria-labelledby="routing-figure-heading"
          className="home-routing-explainer"
          data-route={routesToReadWrite ? "read-write" : "local"}
        >
          <div className="home-routing-toolbar">
            <span>CHANGE THE WORK</span>
            <ChoiceButtons
              items={ROUTING_CASES}
              label="Choose a TWR routing example"
              onSelect={(id) => setActiveCase(id as RoutingCaseId)}
              selected={activeCase}
            />
          </div>
          <div className="home-routing-stage" key={activeCase}>
            <div className="home-routing-request">
              <small>ORIGINAL RO CONNECTION</small>
              <strong>{route.request}</strong>
            </div>
            <div className="home-routing-classifier">
              <small>TWR · INSIDE HALO</small>
              <strong id="routing-figure-heading">Classify before routing</strong>
              <ul aria-label="Signals TWR can use">
                <li>Statement semantics</li>
                <li>Transaction state</li>
                <li>Object type</li>
              </ul>
            </div>
            <div className="home-routing-destinations">
              <section data-active={!routesToReadWrite}>
                <small>LOCAL PATH</small>
                <strong>Read-only node</strong>
                <span>Read work stays local.</span>
              </section>
              <section data-active={routesToReadWrite}>
                <small>FORWARDED PATH</small>
                <strong>Read/write node</strong>
                <span>Detected write work executes here.</span>
              </section>
            </div>
            <span aria-hidden="true" className="home-routing-path home-routing-path--in"><i /></span>
            <span aria-hidden="true" className="home-routing-path home-routing-path--local"><i /></span>
            <span aria-hidden="true" className="home-routing-path home-routing-path--rw"><i /></span>
          </div>
          <p aria-live="polite" className="home-routing-readout">
            <span>{route.classification}</span>
            <strong>{route.outcome}</strong>
          </p>
          <FigureNote>TWR is represented as database-aware classification, not as an external proxy or a performance guarantee.</FigureNote>
        </figure>
        <MechanismLink node={node} />
      </div>
    </section>
  );
}

function ShardingSection({ node }: { node: DiagramNode }) {
  const [activePartition, setActivePartition] = useState<PartitionId>("range-b");
  const partition = PARTITIONS.find((candidate) => candidate.id === activePartition) ?? PARTITIONS[1];

  return (
    <section
      aria-labelledby="home-mechanism-5-heading"
      className="home-mechanism-section home-mechanism-section--sharding"
      data-reveal="section"
      id="sharding-mechanism"
    >
      <div className="home-mechanism-shell">
        <MechanismHeading index={5} node={node} />
        <MechanismCausality node={node} />
        <figure aria-labelledby="sharding-figure-heading" className="home-sharding-explainer" data-partition={activePartition}>
          <div className="home-sharding-logical">
            <small>ONE LOGICAL DATABASE · PARTITIONED PARENT</small>
            <h3 id="sharding-figure-heading">Choose a row range</h3>
            <div aria-label="Choose a partition range" className="home-sharding-table" role="group">
              {PARTITIONS.map((item) => (
                <button
                  aria-pressed={activePartition === item.id}
                  key={item.id}
                  onClick={() => setActivePartition(item.id)}
                  onPointerEnter={() => setActivePartition(item.id)}
                  type="button"
                >
                  <span>{item.label}</span>
                  <strong>{item.range}</strong>
                  <i aria-hidden="true"><b /><b /><b /></i>
                </button>
              ))}
            </div>
          </div>
          <div className="home-sharding-router">
            <span>WORKER</span>
            <strong>Partition map</strong>
            <small>
              <span>match predicate</span>
              <span>→ prune unrelated partitions</span>
              <span>→ route mapped partition</span>
              <span>→ push down relevant work</span>
            </small>
          </div>
          <svg aria-hidden="true" className="home-sharding-paths" preserveAspectRatio="none" viewBox="0 0 1000 320">
            <path className={activePartition === "range-a" ? "is-active" : ""} d="M250,76 C460,76 520,62 750,62" />
            <path className={activePartition === "range-b" ? "is-active" : ""} d="M250,160 C470,160 530,160 750,160" />
            <path className={activePartition === "range-c" ? "is-active" : ""} d="M250,244 C460,244 520,258 750,258" />
          </svg>
          <div className="home-sharding-nodes" role="list">
            {PARTITIONS.map((item) => (
              <section data-active={activePartition === item.id} key={item.id} role="listitem">
                <small>{item.node}</small>
                <strong>{item.label} base table</strong>
                <span>{activePartition === item.id ? "Selected range receives the request" : "Pruned for this predicate"}</span>
              </section>
            ))}
          </div>
          <p aria-live="polite" className="home-sharding-readout">
            <strong>{partition.label} → {partition.node}</strong>
            <span>shard_fdw routes the selected partition while pruning reduces irrelevant remote work.</span>
          </p>
          <FigureNote>The range map is illustrative. Production evaluation must still cover worker availability, resharding, and cross-shard transaction requirements.</FigureNote>
        </figure>
        <MechanismLink node={node} />
      </div>
    </section>
  );
}

function TechnologySections({ block }: { block: DiagramBlock }) {
  const compatibility = requireNode(block, "COMPATIBILITY");
  const migration = requireNode(block, "MIGRATION");
  const availability = requireNode(block, "HIGH AVAILABILITY");
  const routing = requireNode(block, "READ / WRITE ROUTING");
  const sharding = requireNode(block, "SHARDING");

  return (
    <section aria-labelledby="technology-story-heading" className="home-technology-journeys" id={block.anchor}>
      <header className="home-technology-journeys-intro">
        {block.eyebrow ? <p>{block.eyebrow}</p> : null}
        <h2 id="technology-story-heading">{block.heading}</h2>
        {block.intro?.map((paragraph) => <span key={paragraph}>{paragraph}</span>)}
      </header>
      <CompatibilitySection node={compatibility} />
      <MigrationSection node={migration} />
      <AvailabilitySection node={availability} />
      <RoutingSection node={routing} />
      <ShardingSection node={sharding} />
      {block.caption ? <p className="home-technology-boundary">{block.caption[0]}</p> : null}
    </section>
  );
}

function ProductProof({ block }: { block: FactsBlock }) {
  return (
    <section aria-labelledby="product-proof-heading" className="home-product-proof" id={block.anchor}>
      <div className="home-proof-shell">
        <header>
          <p>PRODUCT PROVENANCE · EVIDENCE BOUNDARY</p>
          <h2 id="product-proof-heading">{block.heading}</h2>
          {block.intro?.map((paragraph) => <span key={paragraph}>{paragraph}</span>)}
          <nav aria-label="Product provenance links">
            <a href="/company/">See how Halo evolved<span aria-hidden="true">↗</span></a>
            <a href="/resources/documentation/">Review the documentation basis<span aria-hidden="true">↗</span></a>
          </nav>
        </header>
        <dl>
          {block.items.map((item) => (
            <div key={`${item.value}-${item.label}`}>
              <dt><strong>{item.value}</strong><span>{item.label}</span></dt>
              {item.body ? <dd>{item.body}</dd> : null}
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function CommercialPath({ block }: { block: CtaBlock }) {
  return (
    <section aria-labelledby="home-commercial-heading" className="home-commercial-path">
      <div className="home-commercial-shell">
        <header>
          <p>YOUR NEXT MOVE</p>
          <h2 id="home-commercial-heading">{block.heading}</h2>
          {block.body?.map((paragraph) => <span key={paragraph}>{paragraph}</span>)}
        </header>
        <nav aria-label="Choose a Halo next step">
          {block.actions.map((action, index) => (
            <a data-kind={action.kind} href={action.href} key={`${action.href}-${action.label}`}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{action.label}</strong>
              <small>{ACTION_NOTES[action.href]}</small>
              <b aria-hidden="true">↗</b>
            </a>
          ))}
        </nav>
      </div>
    </section>
  );
}

export function HomeTechnologyStoryV2({ blocks }: { blocks: readonly ContentBlock[] }) {
  const story = requireBlock(blocks, "diagram", "technology-story");
  const proof = requireBlock(blocks, "facts", "product-proof");
  const cta = requireBlock(blocks, "cta");

  return (
    <>
      <TechnologySections block={story} />
      <ProductProof block={proof} />
      <CommercialPath block={cta} />
    </>
  );
}
