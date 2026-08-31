/* eslint-disable @next/next/no-html-link-for-pages -- Vinext's RSC prefetch currently errors for links inside these explainers; native same-origin anchors keep navigation progressive and reliable. */

import type {
  ContentBlock,
  CtaBlock,
  DiagramBlock,
  DiagramNode,
  FactsBlock,
} from "../../lib/site-content";
import { HomeStoryMotionClient } from "./HomeStoryMotionClient";

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

const STORY_DISPLAY_LABELS: Readonly<Record<string, string>> = {
  COMPATIBILITY: "Compatibility",
  MIGRATION: "Migration",
  "HIGH AVAILABILITY": "High availability",
  "READ / WRITE ROUTING": "Read / write routing",
  SHARDING: "Sharding",
};

const ACTION_NOTES: Readonly<Record<string, string>> = {
  "/resources/evaluation-checklist/": "Capture the workload, target topology, tests, owners, and decision criteria.",
  "/oracle-migration-evaluation/": "Turn Oracle dependencies into a versioned fit-and-gap investigation.",
  "/request-demo/?source=home-final": "Prepare the topics and stakeholder context for a product introduction.",
  "/contact-sales/?source=home-final": "Organize licensing, procurement, deployment-scope, or regional-fit questions.",
};

const MIGRATION_STEPS = [
  ["01", "Inventory", "Capture SQL, objects, procedural logic, drivers, tools, and remote dependencies."],
  ["02", "Map", "Match each dependency to a documented candidate without assuming equivalence."],
  ["03", "Test", "Run representative behavior with named inputs, conditions, evidence, and an owner."],
  ["04", "Record gaps", "Keep remediation and unresolved behavior visible instead of hiding it in cutover."],
  ["05", "Rehearse", "Exercise data movement, operating work, cutover, rollback, and recovery assumptions."],
  ["06", "Decide", "Proceed, remediate, or stop from the evidence record—not a generic percentage."],
] as const;

const SHIELD_STEPS = [
  ["01", "Healthy role", "Traffic reaches the current read/write primary while health is observed."],
  ["02", "Health loss", "A fault signal starts evaluation; it does not authorize movement by itself."],
  ["03", "Authority", "etcd quorum and leader state must establish control-plane authority."],
  ["04", "Protect", "The former primary is fenced and the replica is checked for eligibility."],
  ["05", "Move", "Only when the documented conditions pass may role and service address move."],
] as const;

const ROUTING_STEPS = [
  ["01", "Local read", "A read-only statement received on the RO connection stays on the local path."],
  ["02", "Write arrives", "A write statement reaches the same database-aware classification point."],
  ["03", "Classify", "Statement semantics, transaction state, and object type inform the route."],
  ["04", "Redirect", "Detected write work moves through Halo's internal path to the read/write node."],
  ["05", "Return", "The result returns through the original connection; TWR is not an external proxy."],
  ["06", "Transaction context", "After a write is detected, that transaction context remains on the RW path."],
] as const;

const HDS_STEPS = [
  ["01", "Predicate", "A query reaches one logical database with a partition-key predicate."],
  ["02", "Match", "The worker compares the predicate with the partition map."],
  ["03", "Prune", "Unrelated ranges are removed before remote work is sent."],
  ["04", "Push down", "shard_fdw sends the relevant work to the mapped data node."],
  ["05", "Return", "Only the selected range contributes to this illustrated result."],
] as const;

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

function StoryHeading({ index, node }: { index: number; node: DiagramNode }) {
  const label = node.label?.trim() ?? "";
  return (
    <header className="home-story-heading">
      <p><span>{String(index).padStart(2, "0")}</span>{STORY_DISPLAY_LABELS[label.toUpperCase()] ?? label}</p>
      <h3 id={`home-mechanism-${index}-heading`}>{node.heading}</h3>
    </header>
  );
}

function StoryCausality({ node }: { node: DiagramNode }) {
  const body = node.body ?? [];
  return (
    <dl className="home-story-causality">
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
    <figcaption className="home-story-note">
      <details>
        <summary>Technical boundary <span aria-hidden="true">+</span></summary>
        <p>{children}</p>
      </details>
    </figcaption>
  );
}

function MechanismLink({ node }: { node: DiagramNode }) {
  const label = node.label?.trim().toUpperCase() ?? "";
  const link = SECTION_LINKS[label];
  if (!link) return null;
  return <a className="home-story-link" href={link.href}>{link.label}<span aria-hidden="true">↗</span></a>;
}

function ReplayControl({ label }: { label: string }) {
  return (
    <button className="home-story-replay" data-story-replay type="button">
      <span aria-hidden="true">↺</span> Restart {label}
    </button>
  );
}

function MobileSwipeCue() {
  return <p aria-hidden="true" className="home-mobile-swipe-cue">Swipe the steps <span>→</span></p>;
}

type StoryStep = readonly [index: string, label: string, detail: string];

function StoryStepSequence({
  className,
  motionToken,
  steps,
}: {
  className: string;
  motionToken: string;
  steps: readonly StoryStep[];
}) {
  return (
    <div className={`home-story-step-sequence home-story-step-sequence--${motionToken}`}>
      <MobileSwipeCue />
      <ol className={className}>
        {steps.map(([index, label, detail]) => (
          <li data-motion={`${motionToken}-step`} key={index}>
            <span>{index}</span><strong>{label}</strong><small>{detail}</small>
          </li>
        ))}
      </ol>
      <div aria-label="Current step explanation" className="home-story-step-detail">
        {steps.map(([index, label, detail]) => (
          <p aria-label={`${label}: ${detail}`} data-story-step-detail key={index}>{detail}</p>
        ))}
      </div>
    </div>
  );
}

function StoryProgress({ labels }: { labels: readonly string[] }) {
  return (
    <aside aria-hidden="true" className="home-story-progress">
      <span className="home-story-progress__track"><i data-motion="progress" /></span>
      <ol>
        {labels.map((label, index) => <li key={label}><span>{String(index + 1).padStart(2, "0")}</span>{label}</li>)}
      </ol>
    </aside>
  );
}

function SharedKernel() {
  return (
    <div className="home-compat-kernel" data-motion="compat-kernel">
      <small>One Halo kernel</small>
      <strong>Halo database foundation</strong>
      <ol aria-label="Shared E5 execution foundation">
        <li>Protocol</li>
        <li>Semantics</li>
        <li>Plan</li>
        <li>Execute</li>
      </ol>
      <span aria-hidden="true" className="home-compat-kernel__pulse" data-motion="kernel-pulse" />
    </div>
  );
}

function CompatibilitySection({ node }: { node: DiagramNode }) {
  return (
    <section
      aria-labelledby="home-mechanism-1-heading"
      className="home-mechanism-section home-mechanism-section--compatibility home-scroll-story"
      data-scroll-story="compatibility"
      id="compatibility-mechanism"
    >
      <div className="home-story-stage home-story-stage--compatibility" data-story-stage>
        <div className="home-story-stage__inner">
          <div className="home-story-copy home-story-copy--compatibility">
            <StoryHeading index={1} node={node} />
            <StoryCausality node={node} />
            <nav aria-label="Jump to a compatibility chapter" className="home-compat-mode-jump">
              <button aria-pressed="true" data-story-jump="oracle" type="button"><span>01</span>Oracle</button>
              <button aria-pressed="false" data-story-jump="mysql" type="button"><span>02</span>MySQL</button>
              <button aria-pressed="false" data-story-jump="postgresql" type="button"><span>03</span>PostgreSQL</button>
            </nav>
            <div className="home-story-actions">
              <ReplayControl label="from Oracle" />
              <MechanismLink node={node} />
            </div>
          </div>

          <figure aria-labelledby="compatibility-figure-heading" className="home-compatibility-cinema">
            <header className="home-cinema-heading">
              <span>Scroll-driven compatibility paths</span>
              <h4 id="compatibility-figure-heading">Three application ecosystems. One Halo kernel.</h4>
            </header>
            <SharedKernel />

            <div aria-label="Compatibility mode scenes" className="home-compat-scenes" role="region">
            <article className="home-compat-scene home-compat-scene--oracle is-initial" data-motion="compat-scene" data-scene="oracle">
              <header>
                <small>Oracle-oriented behavior</small>
                <strong>Expose semantic dependencies before migration.</strong>
              </header>
              <div className="home-oracle-stack" aria-label="Documented Oracle-oriented behavior surface">
                {[
                  ["PACKAGE", "Procedural interface"],
                  ["VARCHAR2 · NUMBER", "Type behavior"],
                  ["USER_* · DUAL", "Dictionary & objects"],
                  ["CONNECT BY · DBLINK", "Characteristic SQL"],
                ].map(([term, description]) => (
                  <span data-motion="compat-oracle-token" key={term}><strong>{term}</strong><small>{description}</small></span>
                ))}
              </div>
              <div className="home-oracle-entry" data-motion="compat-oracle-entry">
                <small>Oracle mode entry</small>
                <strong>Mode extension required</strong>
                <span>Workload entry remains driver- and build-specific.</span>
              </div>
              <div className="home-oracle-controls" aria-label="Configurable Oracle-oriented semantics">
                <small>Configurable semantics</small>
                <span>NULL comparison</span><span>DATE behavior</span><span>Empty string</span><span>Parser fallback</span>
              </div>
              <p className="home-compat-conclusion">Make the Oracle behavior surface visible for workload-level validation.</p>
            </article>

            <article className="home-compat-scene home-compat-scene--mysql" data-motion="compat-scene" data-scene="mysql">
              <header>
                <small>MySQL protocol path</small>
                <strong>A client handshake becomes a familiar packet stream.</strong>
              </header>
              <div className="home-mysql-clients" aria-label="Documented MySQL client families">
                <span>mysql CLI</span><span>Connector/J</span><span>ODBC</span>
              </div>
              <div className="home-mysql-wire" aria-hidden="true"><i data-motion="compat-mysql-packet" /><i data-motion="compat-mysql-packet" /><i data-motion="compat-mysql-packet" /></div>
              <div className="home-mysql-protocol" data-motion="compat-mysql-entry">
                <small>Standard MySQL protocol</small>
                <strong>MySQL mode entry</strong>
                <span>Mode extension + compatible authentication</span>
              </div>
              <div className="home-mysql-frames" aria-label="Documented MySQL compatibility surfaces">
                <span data-motion="compat-mysql-frame"><small>Type frame</small>UNSIGNED · ENUM · SET</span>
                <span data-motion="compat-mysql-frame"><small>DML frame</small>INSERT IGNORE · ON DUPLICATE KEY</span>
                <span data-motion="compat-mysql-frame"><small>Error frame</small>MySQL numeric error + SQLSTATE</span>
              </div>
              <p className="home-compat-conclusion">A documented MySQL client path reaches familiar types, statements, and protocol semantics.</p>
            </article>

            <article className="home-compat-scene home-compat-scene--postgresql" data-motion="compat-scene" data-scene="postgresql">
              <header>
                <small>Native PostgreSQL path</small>
                <strong>No compatibility-extension gate in the path.</strong>
              </header>
              <div className="home-postgres-clients"><span>psql</span><span>JDBC</span></div>
              <div className="home-postgres-native" data-motion="compat-postgres-path">
                <span>Standard PostgreSQL protocol</span>
                <i aria-hidden="true" />
                <strong>Native mode · no added compatibility extension</strong>
              </div>
              <div className="home-postgres-plan" aria-label="Documented native PostgreSQL capability families">
                <span data-motion="compat-postgres-node"><small>Document</small>JSONB + GIN</span>
                <span data-motion="compat-postgres-node"><small>Partition</small>RANGE · LIST · HASH</span>
                <span data-motion="compat-postgres-node"><small>Procedural</small>PL/pgSQL trigger</span>
              </div>
              <p className="home-compat-conclusion">The native PostgreSQL path needs no added compatibility extension.</p>
            </article>
            </div>

            <FigureNote>Oracle is a documented behavior surface rather than a blanket equivalence claim; MySQL coverage is bounded to documented common features and client prerequisites; native PostgreSQL does not imply all-version equivalence. Exact workload, build, driver, tool, and extension behavior still requires validation.</FigureNote>
          </figure>
        </div>
        <StoryProgress labels={["Oracle semantics", "MySQL packets", "Native PostgreSQL"]} />
      </div>
    </section>
  );
}

function MigrationSection({ node }: { node: DiagramNode }) {
  return (
    <section
      aria-labelledby="home-mechanism-2-heading"
      className="home-mechanism-section home-mechanism-section--migration home-scroll-story"
      data-scroll-story="migration"
      id="migration-mechanism"
    >
      <div className="home-story-stage home-story-stage--migration" data-story-stage>
        <div className="home-story-stage__inner">
          <div className="home-story-copy home-story-copy--migration">
            <StoryHeading index={2} node={node} />
            <StoryCausality node={node} />
            <div className="home-story-actions"><ReplayControl label="decision path" /><MechanismLink node={node} /></div>
          </div>
          <figure aria-labelledby="migration-figure-heading" className="home-migration-timeline">
            <header>
              <span>Dependency-to-decision timeline</span>
              <h4 id="migration-figure-heading">Move one dependency bundle. Leave evidence at every gate.</h4>
            </header>
            <div className="home-migration-track" aria-hidden="true"><i data-motion="migration-track" /></div>
            <div className="home-migration-bundle" data-motion="migration-bundle">
              <small>Workload dependency</small>
              <strong>SQL · objects · logic · access</strong>
            </div>
            <MobileSwipeCue />
            <ol className="home-migration-steps">
              {MIGRATION_STEPS.map(([index, label, detail]) => (
                <li data-motion="migration-step" key={index}>
                  <span>{index}</span><strong>{label}</strong><small>{detail}</small>
                  <i data-motion="migration-evidence">evidence · owner · exception</i>
                </li>
              ))}
            </ol>
            <div className="home-migration-decision" data-motion="migration-decision">
              <small>Evidence-based outcome</small>
              <span data-outcome="proceed">Proceed</span>
              <span data-outcome="remediate">Remediate</span>
              <span data-outcome="stop">Stop</span>
            </div>
            <FigureNote>This is an evaluation and planning path, not a claim that Halo provides an automated migration tool. Data movement, remediation, rehearsal, cutover, rollback, and final workload fit remain scoped work.</FigureNote>
          </figure>
        </div>
        <StoryProgress labels={["Inventory", "Map", "Test", "Gaps", "Rehearse", "Decide"]} />
      </div>
    </section>
  );
}

function AvailabilitySection({ node }: { node: DiagramNode }) {
  return (
    <section
      aria-labelledby="home-mechanism-3-heading"
      className="home-mechanism-section home-mechanism-section--availability home-scroll-story"
      data-scroll-story="availability"
      id="availability-mechanism"
    >
      <div className="home-story-stage home-story-stage--availability" data-story-stage>
        <div className="home-story-stage__inner">
          <div className="home-story-copy home-story-copy--availability">
            <StoryHeading index={3} node={node} />
            <StoryCausality node={node} />
            <div className="home-story-actions"><ReplayControl label="guarded transition" /><MechanismLink node={node} /></div>
          </div>
          <figure aria-labelledby="availability-figure-heading" className="home-availability-state-machine">
            <header>
              <span>Conditional role-change state machine</span>
              <h4 id="availability-figure-heading">A fault signal is not permission to move.</h4>
            </header>
            <div className="home-availability-signal" data-motion="availability-signal"><i /><span>Health signal</span></div>
            <div className="home-availability-service-rail">
              <small>Service address / VIP</small><i data-motion="availability-vip" />
            </div>
            <div className="home-availability-machine">
              <article className="home-availability-primary">
                <small>Current role</small><strong>Read/write primary</strong><span data-motion="availability-fence">Fenced before move</span>
              </article>
              <div className="home-availability-gate" data-motion="availability-gate">
                <small>Control authority</small><strong>etcd quorum + leader state</strong>
                <span>health</span><span>leader lock</span><span>policy</span>
              </div>
              <article className="home-availability-replica" data-motion="availability-replica">
                <small>Replica</small><strong>Eligibility checked</strong><span>Role changes only after the gates pass</span>
              </article>
            </div>
            <div className="home-availability-status-slot">
              <aside className="home-availability-hold" data-motion="availability-hold">
                <small>No authority or no eligible replica</small><strong>Hold · do not move</strong>
              </aside>
            </div>
            <MobileSwipeCue />
            <ol className="home-availability-steps">
              {SHIELD_STEPS.map(([index, label, detail]) => <li data-motion="availability-step" key={index}><span>{index}</span><strong>{label}</strong><small>{detail}</small></li>)}
            </ol>
            <p className="home-availability-result"><strong>Result</strong>Role and service address movement becomes an explicit conditional sequence.</p>
            <FigureNote>The diagram shows the documented Shield control path at mechanism level. Topology, policy, quorum, replica state, and workload conditions still govern the outcome; no RPO, RTO, zero-loss, zero-downtime, or SLA result is implied.</FigureNote>
          </figure>
        </div>
        <StoryProgress labels={["Healthy", "Fault", "Authority", "Fence", "Move"]} />
      </div>
    </section>
  );
}

function RoutingSection({ node }: { node: DiagramNode }) {
  return (
    <section
      aria-labelledby="home-mechanism-4-heading"
      className="home-mechanism-section home-mechanism-section--routing home-scroll-story"
      data-scroll-story="routing"
      id="routing-mechanism"
    >
      <div className="home-story-stage home-story-stage--routing" data-story-stage>
        <div className="home-story-stage__inner">
          <div className="home-story-copy home-story-copy--routing">
            <StoryHeading index={4} node={node} />
            <StoryCausality node={node} />
            <div className="home-story-actions"><ReplayControl label="routing path" /><MechanismLink node={node} /></div>
          </div>
          <figure aria-labelledby="routing-figure-heading" className="home-routing-switchboard">
            <header>
              <span>Database-aware redirection</span>
              <h4 id="routing-figure-heading">One connection. Two semantic paths.</h4>
            </header>
            <div className="home-routing-canvas">
              <div className="home-routing-connection"><small>Original RO connection</small><strong>Application session</strong></div>
              <div className="home-routing-classifier">
                <small>TWR · inside Halo</small><strong>Classify before routing</strong>
                <span>statement semantics</span><span>transaction state</span><span>object type</span>
              </div>
              <div className="home-routing-targets">
                <article><small>Local path</small><strong>Read-only node</strong><span>Read work stays local.</span></article>
                <article><small>Forwarded path</small><strong>Read/write node</strong><span>Detected write work executes here.</span></article>
              </div>
              <i aria-hidden="true" className="home-routing-line home-routing-line--read" data-motion="routing-read-path">
                <span className="home-routing-line__segment home-routing-line__segment--source" data-connector-segment />
                <span className="home-routing-line__segment home-routing-line__segment--target" data-connector-segment />
              </i>
              <i aria-hidden="true" className="home-routing-line home-routing-line--write" data-motion="routing-write-path">
                <span className="home-routing-line__segment home-routing-line__segment--source" data-connector-segment />
                <span className="home-routing-line__segment home-routing-line__segment--target" data-connector-segment />
              </i>
              <i aria-hidden="true" className="home-routing-line home-routing-line--return" data-motion="routing-return-path">
                <span className="home-routing-line__segment home-routing-line__segment--source" data-connector-segment />
                <span className="home-routing-line__segment home-routing-line__segment--target" data-connector-segment />
              </i>
              <span aria-hidden="true" className="home-routing-token-slot">
                <span className="home-routing-token" data-motion="routing-token"><b>SQL</b></span>
              </span>
            </div>
            <StoryStepSequence className="home-routing-steps" motionToken="routing" steps={ROUTING_STEPS} />
            <p className="home-routing-result"><strong>Detected write inside a transaction</strong><span>Keep that work on the read/write path for the relevant transaction context.</span></p>
            <FigureNote>TWR is represented as database-aware classification inside Halo, not as an external proxy or a performance guarantee. A transaction is not routed merely because it begins; the illustrated RW path follows detected write work.</FigureNote>
          </figure>
        </div>
        <StoryProgress labels={["Read", "Write", "Classify", "Redirect", "Return", "Context"]} />
      </div>
    </section>
  );
}

function ShardingSection({ node }: { node: DiagramNode }) {
  return (
    <section
      aria-labelledby="home-mechanism-5-heading"
      className="home-mechanism-section home-mechanism-section--sharding home-scroll-story"
      data-scroll-story="sharding"
      id="sharding-mechanism"
    >
      <div className="home-story-stage home-story-stage--sharding" data-story-stage>
        <div className="home-story-stage__inner">
          <div className="home-story-copy home-story-copy--sharding">
            <StoryHeading index={5} node={node} />
            <StoryCausality node={node} />
            <div className="home-story-actions"><ReplayControl label="partition route" /><MechanismLink node={node} /></div>
          </div>
          <figure aria-labelledby="sharding-figure-heading" className="home-sharding-space">
            <header>
              <span>Predicate-to-placement map</span>
              <h4 id="sharding-figure-heading">Prune the space before remote work moves.</h4>
            </header>
            <div className="home-sharding-query" data-motion="sharding-query"><small>Query predicate</small><strong>customer_id = 42</strong></div>
            <div className="home-sharding-logical">
              <small>One logical database</small>
              <strong>Partitioned parent</strong>
              <span><b className="sr-only">Range </b><i aria-hidden="true">Range </i>A</span>
              <span data-selected><b className="sr-only">Range </b><i aria-hidden="true">Range </i>B</span>
              <span><b className="sr-only">Range </b><i aria-hidden="true">Range </i>C</span>
            </div>
            <div className="home-sharding-worker" data-motion="sharding-worker">
              <small>Worker</small><strong>Partition map</strong>
              <ol><li>match bound</li><li>prune unrelated</li><li>route mapped partition</li><li>push down work</li></ol>
            </div>
            <div className="home-sharding-node-stage">
              <div aria-hidden="true" className="home-sharding-route" data-motion="sharding-route">
                <i className="home-sharding-route__trunk" data-connector-segment />
                <i className="home-sharding-route__drop" data-connector-segment />
              </div>
              <div className="home-sharding-nodes" role="list">
                <article data-motion="sharding-pruned" role="listitem"><small>Data node A</small><strong>Earlier range</strong><span>Pruned</span></article>
                <article data-motion="sharding-target" role="listitem"><small>Data node B</small><strong>Middle range</strong><span>Selected</span></article>
                <article data-motion="sharding-pruned" role="listitem"><small>Data node C</small><strong>Later range</strong><span>Pruned</span></article>
              </div>
            </div>
            <div className="home-sharding-result" data-motion="sharding-result"><small>Relevant result</small><strong>Range B → Data node B</strong></div>
            <StoryStepSequence className="home-sharding-steps" motionToken="sharding" steps={HDS_STEPS} />
            <FigureNote>The range map is illustrative. Pruning depends on predicates and partition mapping. Production evaluation must still cover worker availability, redistribution, resharding, and cross-shard transaction requirements; none is implied here.</FigureNote>
          </figure>
        </div>
        <StoryProgress labels={["Predicate", "Match", "Prune", "Push down", "Return"]} />
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
      <HomeStoryMotionClient />
      <header className="home-technology-journeys-intro">
        {block.eyebrow ? <p>{block.eyebrow}</p> : null}
        <h2 id="technology-story-heading">Scroll through the decisions inside Halo.</h2>
        <span>Five customer problems become five distinct technical processes. On desktop, scroll drives each demonstration; on mobile, swipe concise step tracks. Controls only restart or jump to a chapter.</span>
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
          <p>Product provenance · Evidence boundary</p>
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
          <p>Your next move</p>
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
