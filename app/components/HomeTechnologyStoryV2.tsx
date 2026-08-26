"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- Vinext's RSC prefetch currently errors for links inside this stateful stage; native same-origin anchors keep navigation progressive and reliable. */

import { useEffect, useRef, useState } from "react";
import type {
  ContentBlock,
  CtaBlock,
  DiagramBlock,
  FactsBlock,
} from "../../lib/site-content";

type ModeId = "oracle" | "mysql" | "postgresql";
type MigrationSurfaceId = "sql" | "logic" | "remote";
type RuntimePhaseId = "transaction" | "wal" | "checkpoint";
type RecoveryStateId = "running" | "fault" | "restore";
type ScalePatternId = "dlb" | "twr" | "hds";
type StorySceneId = "compatibility" | "migration" | "run" | "recover" | "scale";

const STORY_SCENE_BY_LABEL: Readonly<Record<string, StorySceneId>> = {
  COMPATIBILITY: "compatibility",
  MIGRATION: "migration",
  RUN: "run",
  RECOVER: "recover",
  SCALE: "scale",
};

const STORY_LINKS: Record<StorySceneId, { href: string; label: string }> = {
  compatibility: { href: "/product/compatibility/", label: "Explore E5 and operating modes" },
  migration: { href: "/oracle-migration-evaluation/", label: "Follow the Oracle migration path" },
  run: { href: "/product/architecture/#storage-durability", label: "Go inside the Halo kernel" },
  recover: { href: "/product/availability-recovery/", label: "Design continuity and recovery" },
  scale: { href: "/product/distributed/", label: "Compare distributed data paths" },
};

function sceneForLabel(label: string | undefined): StorySceneId {
  return STORY_SCENE_BY_LABEL[label?.trim().toUpperCase() ?? ""] ?? "compatibility";
}

function storyLink(sceneId: StorySceneId, activeMode: ModeId): { href: string; label: string } {
  if (sceneId === "migration" && activeMode !== "oracle") {
    return { href: "/evaluation/", label: "Use the workload PoC method" };
  }

  return STORY_LINKS[sceneId];
}

const MODE_SCENES: ReadonlyArray<{
  id: ModeId;
  label: string;
  endpoint: string;
  surface: string;
  layerDetails: readonly string[];
}> = [
  {
    id: "oracle",
    label: "Oracle",
    endpoint: "Oracle-oriented operating-mode path",
    surface: "Types · SQL behavior · PACKAGE · DBLINK",
    layerDetails: [
      "The documented Oracle-oriented operating-mode path receives the application request.",
      "Types, functions, SQL behavior, PL/oraSQL, packages, and metadata are interpreted here.",
      "A mode-aware optimization and planning layer receives behavior that the workload still needs to verify.",
      "The Halo kernel executes the selected behavior against shared database foundations.",
    ],
  },
  {
    id: "mysql",
    label: "MySQL",
    endpoint: "MySQL-compatible service path",
    surface: "Types · functions · operators · DML",
    layerDetails: [
      "The documented MySQL-compatible service path receives the application request.",
      "MySQL-oriented types, functions, operators, and application-visible behavior are interpreted here.",
      "A mode-aware optimization and planning layer receives behavior that the workload still needs to verify.",
      "The Halo kernel executes the request against shared transactional and storage foundations.",
    ],
  },
  {
    id: "postgresql",
    label: "PostgreSQL",
    endpoint: "Native PostgreSQL protocol path",
    surface: "Types · indexes · partitions · objects",
    layerDetails: [
      "PostgreSQL-oriented applications use the native protocol path.",
      "Native types, functions, objects, indexes, partitions, and SQL behavior remain available.",
      "The request enters Halo optimization and planning without an Oracle or MySQL compatibility extension.",
      "The same Halo kernel executes the request and manages its persistent state.",
    ],
  },
];

const COMPATIBILITY_LAYERS = [
  "Protocol",
  "Parsing & semantics",
  "Optimization",
  "Execution",
] as const;

const MIGRATION_SURFACES: ReadonlyArray<{
  id: MigrationSurfaceId;
  label: string;
  source: string;
  halo: string;
  detail: string;
}> = [
  {
    id: "sql",
    label: "SQL & objects",
    source: "Types · SQL semantics · views",
    halo: "Documented types · SQL behavior · dictionary views",
    detail: "Record what matches, what requires a representative test, and what must change before estimating cutover work.",
  },
  {
    id: "logic",
    label: "Procedural logic",
    source: "Routines · packages · session state",
    halo: "PL/oraSQL · PACKAGE · variables · exceptions",
    detail: "Keep procedural dependencies visible as workload decisions, not as an afterthought to moving tables.",
  },
  {
    id: "remote",
    label: "Remote access",
    source: "DBLINK · metadata · external systems",
    halo: "DBLINK · query mapping · foreign access",
    detail: "Carry remote data paths, metadata expectations, keys, and transaction boundaries into the migration inventory.",
  },
];

const RUNTIME_PHASES: ReadonlyArray<{
  id: RuntimePhaseId;
  label: string;
  heading: string;
  detail: string;
}> = [
  {
    id: "transaction",
    label: "01 Transaction",
    heading: "A transaction changes database state",
    detail: "MVCC, isolation, savepoints, commit, and rollback define what concurrent work can observe.",
  },
  {
    id: "wal",
    label: "02 WAL",
    heading: "Write-ahead logging records the change path",
    detail: "WAL connects commit durability with replication, archive, backup, and later recovery work.",
  },
  {
    id: "checkpoint",
    label: "03 Persist",
    heading: "Pages, checkpoints, and maintenance continue the lifecycle",
    detail: "Background writing, checkpoints, autovacuum, and statistics keep persistent state usable over time; WAL archiving follows its own path.",
  },
];

const RECOVERY_STATES: ReadonlyArray<{
  id: RecoveryStateId;
  label: string;
  heading: string;
  detail: string;
}> = [
  {
    id: "running",
    label: "Current role",
    heading: "Traffic reaches the current read/write role",
    detail: "WAL-based replication can keep readable standbys current while Shield observes role and health state.",
  },
  {
    id: "fault",
    label: "Role-change checks",
    heading: "Conditions are checked before traffic can move",
    detail: "The documented Shield path includes health conditions, etcd quorum and leader state, fencing, an eligible replica, role lifecycle, and VIP movement. Topology and policy govern the outcome.",
  },
  {
    id: "restore",
    label: "Restore path",
    heading: "Recovery follows an independent backup and WAL path",
    detail: "RMAN2 backup, validation, restore, and point-in-time targets answer a different failure question from keeping a replica current.",
  },
];

const SCALE_PATTERNS: ReadonlyArray<{
  id: ScalePatternId;
  label: string;
  heading: string;
  detail: string;
}> = [
  {
    id: "dlb",
    label: "DLB · reads",
    heading: "Distribute reads inside the database path",
    detail: "A read/write node accepts changes, streaming replication supplies read-only replicas, and the kernel-managed read pool distributes query work.",
  },
  {
    id: "twr",
    label: "TWR · writes",
    heading: "Keep reads local and forward detected writes",
    detail: "TWR uses statement semantics, transaction state, and object type to redirect write work from a read-only connection to the read/write node and return the result.",
  },
  {
    id: "hds",
    label: "HDS · data",
    heading: "Route partitioned data behind one logical database",
    detail: "A worker maps partition ranges through shard_fdw to Halo data nodes; predicate pushdown and pruning reduce irrelevant remote work.",
  },
];

const ACTION_NOTES: Record<string, string> = {
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

function SceneControls({
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
    <div aria-label={label} className="home-scene-controls" role="group">
      {items.map((item) => (
        <button aria-pressed={selected === item.id} key={item.id} onClick={() => onSelect(item.id)} type="button">
          {item.label}
        </button>
      ))}
    </div>
  );
}

type StoryInteractionState = {
  activeLayer: number;
  activeMode: ModeId;
  activePhase: RuntimePhaseId;
  activeSurface: MigrationSurfaceId;
  recoveryState: RecoveryStateId;
  scalePattern: ScalePatternId;
};

type StoryInteractionActions = {
  setActiveLayer: (index: number) => void;
  setActiveMode: (mode: ModeId) => void;
  setActivePhase: (phase: RuntimePhaseId) => void;
  setActiveSurface: (surface: MigrationSurfaceId) => void;
  setRecoveryState: (state: RecoveryStateId) => void;
  setScalePattern: (pattern: ScalePatternId) => void;
};

type SystemOutput = {
  label: string;
  title: string;
  detail: string;
  active: boolean;
  tone: "default" | "decision" | "warning";
};

type SystemSnapshot = {
  sourceLabel: string;
  sourceTitle: string;
  sourceDetail: string;
  coreStatus: string;
  input: string;
  response: string;
  outcome: string;
  outcomeLabel: string;
  readoutTitle: string;
  readoutDetail: string;
  outputs: readonly [SystemOutput, SystemOutput, SystemOutput];
};

function sceneSnapshot(sceneId: StorySceneId, state: StoryInteractionState): SystemSnapshot {
  const mode = MODE_SCENES.find((candidate) => candidate.id === state.activeMode) ?? MODE_SCENES[0];
  const layer = COMPATIBILITY_LAYERS[state.activeLayer] ?? COMPATIBILITY_LAYERS[0];
  const surface = MIGRATION_SURFACES.find((item) => item.id === state.activeSurface) ?? MIGRATION_SURFACES[0];
  const runtimeIndex = RUNTIME_PHASES.findIndex((phase) => phase.id === state.activePhase);
  const runtime = RUNTIME_PHASES[runtimeIndex] ?? RUNTIME_PHASES[0];
  const recovery = RECOVERY_STATES.find((item) => item.id === state.recoveryState) ?? RECOVERY_STATES[0];
  const scale = SCALE_PATTERNS.find((item) => item.id === state.scalePattern) ?? SCALE_PATTERNS[0];

  if (sceneId === "compatibility") {
    return {
      sourceLabel: "APPLICATION ENTRY",
      sourceTitle: mode.label,
      sourceDetail: mode.endpoint,
      coreStatus: `${layer} · ${mode.label} mode`,
      input: `${mode.label} application behavior`,
      response: `E5 · ${layer}`,
      outcome: "Mode-aware request enters the kernel",
      outcomeLabel: "NEXT STATE",
      readoutTitle: layer,
      readoutDetail: mode.layerDetails[state.activeLayer] ?? mode.layerDetails[0],
      outputs: [
        { label: "MODE SURFACE", title: mode.surface, detail: "documented behavior", active: true, tone: "default" },
        { label: "WORKLOAD BOUNDARY", title: "Verify required behavior", detail: "coverage is not equivalence", active: false, tone: "warning" },
        { label: "CONTINUES AS", title: "Migration inventory", detail: "same selected mode", active: true, tone: "decision" },
      ],
    };
  }

  if (sceneId === "migration") {
    return {
      sourceLabel: `${mode.label.toUpperCase()} DEPENDENCY`,
      sourceTitle: surface.label,
      sourceDetail: surface.source,
      coreStatus: `Fit / gap trace · ${surface.label}`,
      input: "Observed application dependency",
      response: "Assess → map → assign remediation",
      outcome: "Retain, remediate, or leave unresolved",
      outcomeLabel: "DECISION RECORD",
      readoutTitle: surface.label,
      readoutDetail: surface.detail,
      outputs: [
        { label: "DOCUMENTED MATCH", title: surface.halo, detail: "still verify in workload", active: true, tone: "default" },
        { label: "REMEDIATE", title: "Unmatched behavior", detail: "owner + representative test", active: true, tone: "warning" },
        { label: "UNRESOLVED", title: "Stop before cutover", detail: "do not hide the gap", active: true, tone: "decision" },
      ],
    };
  }

  if (sceneId === "run") {
    return {
      sourceLabel: `${mode.label.toUpperCase()} WORKLOAD`,
      sourceTitle: "Accepted request",
      sourceDetail: "the same mode-aware path",
      coreStatus: runtime.heading,
      input: "Application change enters a transaction",
      response: runtime.label.replace(/^\d+\s/, ""),
      outcome: runtimeIndex < 1 ? "Commit state is defined" : runtimeIndex < 2 ? "WAL-dependent paths become visible" : "Pages and maintenance continue the lifecycle",
      outcomeLabel: "DURABILITY STATE",
      readoutTitle: runtime.heading,
      readoutDetail: runtime.detail,
      outputs: [
        { label: "REPLICATION", title: "Replica stream", detail: "physical / logical paths", active: runtimeIndex >= 1, tone: "default" },
        { label: "ARCHIVE", title: "WAL archive", detail: "separate configuration path", active: runtimeIndex >= 1, tone: "default" },
        { label: "RECOVERY INPUT", title: "Base backup + WAL", detail: "backup / PITR workflow", active: runtimeIndex >= 2, tone: "decision" },
      ],
    };
  }

  if (sceneId === "recover" && state.recoveryState === "fault") {
    return {
      sourceLabel: "HEALTH CONDITION",
      sourceTitle: "Role change is conditional",
      sourceDetail: "topology and policy govern the outcome",
      coreStatus: "Shield checks before role change",
      input: "A node or service condition is detected",
      response: "Quorum / leader state → fencing → eligible replica",
      outcome: "Role and VIP may move only after conditions pass",
      outcomeLabel: "CONDITIONAL PATH",
      readoutTitle: recovery.heading,
      readoutDetail: recovery.detail,
      outputs: [
        { label: "01 CONTROL STATE", title: "etcd quorum + leader lock", detail: "establish decision authority", active: true, tone: "default" },
        { label: "02 PROTECT", title: "Fence the former primary", detail: "before serving a new role", active: true, tone: "warning" },
        { label: "03 IF ELIGIBLE", title: "Role lifecycle + VIP movement", detail: "not an unconditional outcome", active: true, tone: "decision" },
      ],
    };
  }

  if (sceneId === "recover" && state.recoveryState === "restore") {
    return {
      sourceLabel: "RESTORE INPUT",
      sourceTitle: "Backup + archived WAL",
      sourceDetail: "separate from keeping a replica current",
      coreStatus: "Independent recovery path",
      input: "A restore point is selected",
      response: "RMAN2 validation → restore → WAL target",
      outcome: "Restored target is returned for verification",
      outcomeLabel: "RECOVERY RESULT",
      readoutTitle: recovery.heading,
      readoutDetail: recovery.detail,
      outputs: [
        { label: "BACKUP", title: "Physical backup set", detail: "full / incremental workflow", active: true, tone: "default" },
        { label: "VALIDATE", title: "Backup validation", detail: "before relying on restore", active: true, tone: "warning" },
        { label: "RESTORE TARGET", title: "Base backup + archived WAL", detail: "point-in-time choice", active: true, tone: "decision" },
      ],
    };
  }

  if (sceneId === "recover") {
    return {
      sourceLabel: "SERVICE ADDRESS",
      sourceTitle: "Current read/write role",
      sourceDetail: `${mode.label} workload remains in view`,
      coreStatus: "Primary role · WAL sender",
      input: "Normal application traffic",
      response: "WAL replication + role and health observation",
      outcome: "Current role and recovery plane remain explicit",
      outcomeLabel: "OPERATING STATE",
      readoutTitle: recovery.heading,
      readoutDetail: recovery.detail,
      outputs: [
        { label: "STANDBY", title: "Readable replica", detail: "WAL replay", active: true, tone: "default" },
        { label: "SHIELD", title: "Role + health state", detail: "control plane observation", active: true, tone: "warning" },
        { label: "RECOVERY PLANE", title: "RMAN2 + archived WAL", detail: "independent path", active: false, tone: "decision" },
      ],
    };
  }

  const scaleOutputs: Record<ScalePatternId, readonly [SystemOutput, SystemOutput, SystemOutput]> = {
    dlb: [
      { label: "WRITE PATH", title: "Read/write node", detail: "changes stay on RW", active: true, tone: "warning" },
      { label: "READ PATH", title: "Kernel-managed RO pool", detail: "distribute query work", active: true, tone: "default" },
      { label: "DATA MOTION", title: "Streaming replication", detail: "supplies readable replicas", active: true, tone: "decision" },
    ],
    twr: [
      { label: "LOCAL PATH", title: "Read on this RO", detail: "keep read work local", active: true, tone: "default" },
      { label: "DETECTION", title: "Statement · transaction · object type", detail: "classify write work", active: true, tone: "warning" },
      { label: "WRITE PATH", title: "Forward to RW · return via RO", detail: "one application connection", active: true, tone: "decision" },
    ],
    hds: [
      { label: "WORKER", title: "Partition routing", detail: "one logical database", active: true, tone: "default" },
      { label: "QUERY PATH", title: "Pushdown + pruning", detail: "reduce irrelevant remote work", active: true, tone: "warning" },
      { label: "DATA NODES", title: "shard_fdw routes ranges", detail: "selected partitions only", active: true, tone: "decision" },
    ],
  };

  return {
    sourceLabel: "OBSERVED PRESSURE",
    sourceTitle: scale.label,
    sourceDetail: `${mode.label} workload remains in view`,
    coreStatus: scale.heading,
    input: state.scalePattern === "dlb" ? "Read demand" : state.scalePattern === "twr" ? "Write on an RO connection" : "Partitioned data access",
    response: state.scalePattern === "dlb" ? "DLB route decision" : state.scalePattern === "twr" ? "TWR write detection" : "HDS partition routing",
    outcome: state.scalePattern === "dlb" ? "Read and write paths branch" : state.scalePattern === "twr" ? "Write reaches RW and returns through RO" : "Relevant data nodes receive the request",
    outcomeLabel: "SELECTED SCALE PATH",
    readoutTitle: scale.heading,
    readoutDetail: scale.detail,
    outputs: scaleOutputs[state.scalePattern],
  };
}

function StageControls({ actions, sceneId, state }: { actions: StoryInteractionActions; sceneId: StorySceneId; state: StoryInteractionState }) {
  if (sceneId === "compatibility") {
    return (
      <div className="home-system-toolbar" data-groups="two">
        <div>
          <span>CHANGE ENTRY</span>
          <SceneControls items={MODE_SCENES} label="Choose a Halo operating mode" onSelect={(id) => actions.setActiveMode(id as ModeId)} selected={state.activeMode} />
        </div>
        <div>
          <span>TRACE E5</span>
          <SceneControls items={COMPATIBILITY_LAYERS.map((label, index) => ({ id: String(index), label }))} label="Inspect an E5 layer" onSelect={(id) => actions.setActiveLayer(Number(id))} selected={String(state.activeLayer)} />
        </div>
      </div>
    );
  }

  const control = sceneId === "migration"
    ? { label: "CHANGE DEPENDENCY", items: MIGRATION_SURFACES, selected: state.activeSurface, onSelect: (id: string) => actions.setActiveSurface(id as MigrationSurfaceId) }
    : sceneId === "run"
      ? { label: "ADVANCE COMMIT", items: RUNTIME_PHASES, selected: state.activePhase, onSelect: (id: string) => actions.setActivePhase(id as RuntimePhaseId) }
      : sceneId === "recover"
        ? { label: "CHANGE FAILURE QUESTION", items: RECOVERY_STATES, selected: state.recoveryState, onSelect: (id: string) => actions.setRecoveryState(id as RecoveryStateId) }
        : { label: "CHANGE PRESSURE", items: SCALE_PATTERNS, selected: state.scalePattern, onSelect: (id: string) => actions.setScalePattern(id as ScalePatternId) };

  return (
    <div className="home-system-toolbar">
      <div>
        <span>{control.label}</span>
        <SceneControls items={control.items} label={control.label} onSelect={control.onSelect} selected={control.selected} />
      </div>
    </div>
  );
}

function HaloSystemCanvas({ sceneId, state }: { sceneId: StorySceneId; state: StoryInteractionState }) {
  const snapshot = sceneSnapshot(sceneId, state);
  const runtimeIndex = RUNTIME_PHASES.findIndex((phase) => phase.id === state.activePhase);
  const signalKey = [sceneId, state.activeMode, state.activeLayer, state.activeSurface, state.activePhase, state.recoveryState, state.scalePattern].join("-");
  const e5Active = sceneId === "compatibility" || sceneId === "migration";
  const transactionActive = sceneId === "run" || sceneId === "recover" || sceneId === "scale";
  const walActive = (sceneId === "run" && runtimeIndex >= 1) || sceneId === "recover";
  const storageActive = (sceneId === "run" && runtimeIndex >= 2) || (sceneId === "recover" && state.recoveryState === "restore") || (sceneId === "scale" && state.scalePattern === "hds");

  return (
    <figure className="home-system-canvas" data-scene={sceneId} data-substate={signalKey}>
      <div className="home-system-source" data-active="true">
        <small>{snapshot.sourceLabel}</small>
        <strong>{snapshot.sourceTitle}</strong>
        <span>{snapshot.sourceDetail}</span>
      </div>
      <span aria-hidden="true" className="home-system-route home-system-route--input"><i key={`input-${signalKey}`} /></span>
      <div className="home-system-core">
        <header>
          <span>HALO DATABASE</span>
          <small>SAME SYSTEM · 1.0.16 DOCUMENTATION BASELINE</small>
          <strong>{snapshot.coreStatus}</strong>
        </header>
        <div className="home-system-core-grid">
          <div className="home-system-module home-system-module--e5" data-active={e5Active ? "true" : "false"}>
            <small>E5</small><strong>Mode-aware behavior</strong><span>Protocol · semantics · optimize · execute</span>
          </div>
          <div className="home-system-module home-system-module--transaction" data-active={transactionActive ? "true" : "false"}>
            <small>TX</small><strong>Transaction</strong><span>MVCC · isolation · commit</span>
          </div>
          <div className="home-system-module home-system-module--wal" data-active={walActive ? "true" : "false"}>
            <small>WAL</small><strong>Change record</strong><span>durability · replication · archive</span>
          </div>
          <div className="home-system-module home-system-module--storage" data-active={storageActive ? "true" : "false"}>
            <small>DATA</small><strong>Persistent state</strong><span>pages · checkpoint · maintenance</span>
          </div>
        </div>
      </div>
      <div className="home-system-outputs">
        {snapshot.outputs.map((output, index) => (
          <div className="home-system-output" data-active={output.active ? "true" : "false"} data-tone={output.tone} key={index}>
            <i aria-hidden="true" key={`output-${index}-${signalKey}`} />
            <small>{output.label}</small><strong>{output.title}</strong><span>{output.detail}</span>
          </div>
        ))}
      </div>
      <figcaption className="home-system-causality">
        <div><small>INPUT</small><strong>{snapshot.input}</strong></div><span aria-hidden="true">→</span>
        <div><small>HALO RESPONSE</small><strong>{snapshot.response}</strong></div><span aria-hidden="true">→</span>
        <div><small>{snapshot.outcomeLabel}</small><strong>{snapshot.outcome}</strong></div>
      </figcaption>
      <p aria-live="polite" className="home-system-readout"><strong>{snapshot.readoutTitle}</strong><span>{snapshot.readoutDetail}</span></p>
    </figure>
  );
}

function TechnologyStage({
  actions,
  activeScene,
  block,
  onSelectScene,
  state,
}: {
  actions: StoryInteractionActions;
  activeScene: number;
  block: DiagramBlock;
  onSelectScene: (index: number) => void;
  state: StoryInteractionState;
}) {
  const node = block.nodes[activeScene] ?? block.nodes[0];
  const sceneId = sceneForLabel(node.label);
  const link = storyLink(sceneId, state.activeMode);

  return (
    <div className="home-technology-stage" data-scene={sceneId}>
      <div className="home-technology-stage-head">
        <div><span>HALO SYSTEM IN MOTION</span><strong>{node.label}</strong></div>
        <span>{String(activeScene + 1).padStart(2, "0")} / {String(block.nodes.length).padStart(2, "0")}</span>
        <nav aria-label="Technology story scenes" className="home-system-progress">
          {block.nodes.map((sceneNode, index) => (
            <button aria-label={`Show ${sceneNode.label} technology stage`} aria-pressed={activeScene === index} key={sceneNode.label} onClick={() => onSelectScene(index)} type="button">
              <b>{String(index + 1).padStart(2, "0")}</b><span>{sceneNode.label}</span>
            </button>
          ))}
        </nav>
        <a className="home-technology-mobile-link" href={link.href}>Explore<span aria-hidden="true">↗</span></a>
      </div>
      <StageControls actions={actions} sceneId={sceneId} state={state} />
      <HaloSystemCanvas sceneId={sceneId} state={state} />
    </div>
  );
}

function TechnologyStory({ block }: { block: DiagramBlock }) {
  const [activeScene, setActiveScene] = useState(0);
  const [activeMode, setActiveMode] = useState<ModeId>("oracle");
  const [activeLayer, setActiveLayer] = useState(1);
  const [activeSurface, setActiveSurface] = useState<MigrationSurfaceId>("sql");
  const [activePhase, setActivePhase] = useState<RuntimePhaseId>("transaction");
  const [recoveryState, setRecoveryState] = useState<RecoveryStateId>("running");
  const [scalePattern, setScalePattern] = useState<ScalePatternId>("dlb");
  const chapterRefs = useRef<Array<HTMLElement | null>>([]);
  const manualSceneRef = useRef<number | null>(null);
  const manualSelectionLockedRef = useRef(false);

  function selectScene(index: number) {
    manualSceneRef.current = index;
    manualSelectionLockedRef.current = true;
    setActiveScene(index);

    if (window.matchMedia("(min-width: 881px)").matches) {
      window.setTimeout(() => {
        chapterRefs.current[index]?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
          block: "center",
        });
      }, 0);
    }
  }

  useEffect(() => {
    const releaseManualSelection = () => {
      manualSelectionLockedRef.current = false;
      manualSceneRef.current = null;
    };
    const releaseManualSelectionFromKey = (event: KeyboardEvent) => {
      if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "].includes(event.key)) {
        releaseManualSelection();
      }
    };
    window.addEventListener("wheel", releaseManualSelection, { passive: true });
    window.addEventListener("touchmove", releaseManualSelection, { passive: true });
    window.addEventListener("keydown", releaseManualSelectionFromKey);

    return () => {
      window.removeEventListener("wheel", releaseManualSelection);
      window.removeEventListener("touchmove", releaseManualSelection);
      window.removeEventListener("keydown", releaseManualSelectionFromKey);
    };
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (manualSelectionLockedRef.current) return;
        manualSceneRef.current = null;
        const current = entries.filter((entry) => entry.isIntersecting).sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
        if (!current) return;
        const index = Number((current.target as HTMLElement).dataset.storyScene);
        if (Number.isInteger(index)) setActiveScene(index);
      },
      { rootMargin: "-24% 0px -54%", threshold: [0.08, 0.24, 0.5] },
    );
    chapterRefs.current.forEach((chapter) => { if (chapter) observer.observe(chapter); });
    return () => observer.disconnect();
  }, []);

  const state: StoryInteractionState = { activeLayer, activeMode, activePhase, activeSurface, recoveryState, scalePattern };
  const actions: StoryInteractionActions = { setActiveLayer, setActiveMode, setActivePhase, setActiveSurface, setRecoveryState, setScalePattern };

  return (
    <section aria-labelledby="technology-story-heading" className="home-technology-story home-technology-story--continuous" id={block.anchor}>
      <div className="home-narrative-shell">
        <header className="home-narrative-intro">
          {block.eyebrow ? <p>{block.eyebrow}</p> : null}
          <h2 id="technology-story-heading">{block.heading}</h2>
          {block.intro?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </header>
        <div className="home-technology-layout">
          <div aria-label="Interactive Halo system view" className="home-technology-stage-wrap" role="group">
            <TechnologyStage actions={actions} activeScene={activeScene} block={block} onSelectScene={selectScene} state={state} />
          </div>
          <ol className="home-technology-chapters">
            {block.nodes.map((node, index) => {
              const sceneId = sceneForLabel(node.label);
              const link = storyLink(sceneId, state.activeMode);
              return (
                <li data-active={activeScene === index ? "true" : "false"} data-story-scene={index} key={node.heading} ref={(element) => { chapterRefs.current[index] = element; }}>
                  <div className="home-technology-static-heading"><span>{String(index + 1).padStart(2, "0")}</span><small>{node.label}</small><strong>{node.heading}</strong></div>
                  <button aria-label={`Show ${node.label}: ${node.heading}`} aria-pressed={activeScene === index} onClick={() => selectScene(index)} onFocus={() => selectScene(index)} type="button">
                    <span>{String(index + 1).padStart(2, "0")}</span><small>{node.label}</small><strong>{node.heading}</strong>
                  </button>
                  {node.body?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                  <a href={link.href}>{link.label}<span aria-hidden="true">↗</span></a>
                </li>
              );
            })}
          </ol>
        </div>
        {block.caption ? <p className="home-technology-boundary">{block.caption[0]}</p> : null}
      </div>
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
            <div key={`${item.value}-${item.label}`}><dt><strong>{item.value}</strong><span>{item.label}</span></dt>{item.body ? <dd>{item.body}</dd> : null}</div>
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
        <header><p>YOUR NEXT MOVE</p><h2 id="home-commercial-heading">{block.heading}</h2>{block.body?.map((paragraph) => <span key={paragraph}>{paragraph}</span>)}</header>
        <nav aria-label="Choose a Halo next step">
          {block.actions.map((action, index) => (
            <a data-kind={action.kind} href={action.href} key={`${action.href}-${action.label}`}>
              <span>{String(index + 1).padStart(2, "0")}</span><strong>{action.label}</strong><small>{ACTION_NOTES[action.href]}</small><b aria-hidden="true">↗</b>
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
  return <><TechnologyStory block={story} /><ProductProof block={proof} /><CommercialPath block={cta} /></>;
}
