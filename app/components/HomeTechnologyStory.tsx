"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CardsBlock,
  ContentBlock,
  DiagramBlock,
} from "../../lib/site-content";

type ModeId = "oracle" | "mysql" | "postgresql";

interface ConnectionNavigator extends Navigator {
  connection?: {
    saveData?: boolean;
  };
}

const MODES: ReadonlyArray<{
  id: ModeId;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    id: "oracle",
    label: "Oracle operating mode",
    shortLabel: "Oracle",
    description:
      "Test the documented Oracle-oriented syntax, functions, packages, views, and semantic controls the application actually uses.",
  },
  {
    id: "mysql",
    label: "MySQL operating mode",
    shortLabel: "MySQL",
    description:
      "Test the documented MySQL-mode behavior required by the application, tools, and integrations against the intended Halo release.",
  },
  {
    id: "postgresql",
    label: "PostgreSQL operating mode",
    shortLabel: "PostgreSQL",
    description:
      "Test PostgreSQL operating-mode behavior and the existing application dependencies in the same versioned target.",
  },
];

interface CapabilityStory {
  readonly key: string;
  readonly problem: string;
  readonly mechanism: string;
  readonly value: string;
  readonly boundary: string;
  readonly nodes: readonly string[];
  readonly layout: "linear" | "branch";
}

const CAPABILITY_STORIES: Record<string, CapabilityStory> = {
  RECOVER: {
    key: "recover",
    problem:
      "A replica and a verified recovery point solve different failure questions.",
    mechanism:
      "Physical or logical replication carries changes along another data path. Synchronous or asynchronous behavior and lag must be validated for the proposed configuration. Backup, validation, restore, and point-in-time recovery provide an independent recovery workflow.",
    value:
      "Test continuity and recovery separately against the deployment’s own objectives.",
    boundary:
      "No automatic-failover topology, RPO, RTO, zero-loss result, or availability level is implied.",
    nodes: ["Commit or change", "Replication path", "Backup + WAL", "Validate / restore"],
    layout: "branch",
  },
  OBSERVE: {
    key: "observe",
    problem:
      "A live symptom can arrive after the workload conditions that created it have changed.",
    mechanism:
      "HWR captures scheduled database-statistics snapshots, retains samples, selects an interval, and produces an HTML report.",
    value:
      "Give evaluators historical workload and performance evidence to inspect across a representative run.",
    boundary:
      "HWR does not imply automated remediation, real-time alerting, a guaranteed diagnosis, or performance superiority.",
    nodes: ["Workload", "Snapshots", "Selected interval", "HTML report"],
    layout: "linear",
  },
  CONTROL: {
    key: "control",
    problem:
      "A database security rule needs a controlled test path before it becomes an enforcement decision.",
    mechanism:
      "The Halo 1.0.16 manual documents an SQL firewall mechanism with learning and enforcing-mode test flows.",
    value:
      "Inspect the policy, expected statements, exceptions, and operational fit during evaluation.",
    boundary:
      "A documented control is not a certification, compliance claim, or guarantee that every harmful query is blocked.",
    nodes: ["Observed SQL", "Learning-mode policy", "Enforcing-mode test", "Review exceptions"],
    layout: "linear",
  },
};

function requireBlock<T extends ContentBlock["type"]>(
  blocks: readonly ContentBlock[],
  type: T,
  anchor: string,
): Extract<ContentBlock, { type: T }> {
  const block = blocks.find(
    (candidate) => candidate.type === type && candidate.anchor === anchor,
  );

  if (!block) {
    throw new Error(`Home block ${anchor} (${type}) is missing.`);
  }

  return block as Extract<ContentBlock, { type: T }>;
}

function firstAction(item: CardsBlock["items"][number]) {
  return item.actions?.[0];
}

function ProblemSection({ block }: { block: CardsBlock }) {
  return (
    <section
      aria-labelledby="home-problem-heading"
      className="home-problem-section"
      data-reveal="section"
      id={block.anchor}
    >
      <div className="home-story-shell">
        <div className="home-section-heading home-section-heading--dark">
          <p className="home-kicker">THE DECISION SURFACE</p>
          <h2 id="home-problem-heading">{block.heading}</h2>
          {block.intro?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </div>
        <div className="home-problem-grid">
          {block.items.map((item, index) => {
            const action = firstAction(item);
            return (
              <article key={item.heading}>
                <span className="home-problem-number" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {item.label ? <p className="home-item-label">{item.label}</p> : null}
                <h3>{item.heading}</h3>
                {item.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                {action ? <a className="home-text-link" href={action.href}>{action.label}</a> : null}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ModeStoryStage({
  block,
  activeMode,
  activeChapter,
  onModeChange,
}: {
  block: DiagramBlock;
  activeMode: ModeId;
  activeChapter: number;
  onModeChange: (mode: ModeId) => void;
}) {
  const selectedMode = MODES.find((mode) => mode.id === activeMode) ?? MODES[0];

  return (
    <div
      className="home-mode-stage"
      data-mode={activeMode}
      data-stage={activeChapter}
    >
      <div className="home-mode-stage-head">
        <div>
          <span>WORKLOAD VIEW</span>
          <strong>{selectedMode.shortLabel}</strong>
        </div>
        <span>STEP {activeChapter + 1} / {block.nodes.length}</span>
      </div>

      <div aria-label="Choose an operating-mode workload lens" className="home-mode-buttons" role="group">
        {MODES.map((mode) => (
          <button
            aria-pressed={activeMode === mode.id}
            key={mode.id}
            onClick={() => onModeChange(mode.id)}
            onFocus={() => onModeChange(mode.id)}
            onPointerEnter={() => onModeChange(mode.id)}
            type="button"
          >
            {mode.shortLabel}
          </button>
        ))}
      </div>

      <div className="home-mode-summary">
        <p>{selectedMode.description}</p>
      </div>

      <div aria-hidden="true" className="home-mode-machine" key={`${activeMode}-${activeChapter}`}>
        <div className="home-source-lanes">
          {MODES.map((mode) => (
            <span data-active={activeMode === mode.id ? "true" : "false"} key={mode.id}>
              {mode.shortLabel}
            </span>
          ))}
        </div>
        <span className="home-machine-link home-machine-link--one"><i /></span>
        <div className="home-cluster-node">
          <small>ONE CLUSTER</small>
          <strong>Halo 1.0.16</strong>
          <span>{selectedMode.shortLabel} mode</span>
        </div>
        <span className="home-machine-link home-machine-link--two"><i /></span>
        <div className="home-test-node">
          <small>BEHAVIOR TESTS</small>
          <span>Protocol</span>
          <span>SQL &amp; objects</span>
          <span>Operations</span>
        </div>
        <span className="home-machine-link home-machine-link--three"><i /></span>
        <div className="home-record-node">
          <small>DECISION RECORD</small>
          <span>Works as tested</span>
          <span>Remediation</span>
          <span>Unresolved</span>
        </div>
      </div>

      <p className="home-stage-boundary">{block.caption?.[0]}</p>
    </div>
  );
}

function MultimodeStory({ block }: { block: DiagramBlock }) {
  const [activeMode, setActiveMode] = useState<ModeId>("oracle");
  const [activeChapter, setActiveChapter] = useState(0);
  const chapterRefs = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = (navigator as ConnectionNavigator).connection?.saveData === true;
    if (reducedMotion || saveData || window.innerWidth < 900) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
        if (!visible) return;
        const index = Number((visible.target as HTMLElement).dataset.storyChapter);
        if (Number.isInteger(index)) setActiveChapter(index);
      },
      {
        rootMargin: "-26% 0px -48%",
        threshold: [0.18, 0.42, 0.68],
      },
    );

    chapterRefs.current.forEach((chapter) => {
      if (chapter) observer.observe(chapter);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <section
      aria-labelledby="home-multimode-heading"
      className="home-multimode-section"
      id={block.anchor}
    >
      <div className="home-story-shell">
        <div className="home-section-heading home-section-heading--light">
          {block.eyebrow ? <p className="home-kicker">{block.eyebrow}</p> : null}
          <h2 id="home-multimode-heading">{block.heading}</h2>
          {block.intro?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </div>

        <div className="home-multimode-layout">
          <div className="home-mode-stage-wrap">
            <ModeStoryStage
              activeChapter={activeChapter}
              activeMode={activeMode}
              block={block}
              onModeChange={setActiveMode}
            />
          </div>

          <ol className="home-story-chapters">
            {block.nodes.map((node, index) => (
              <li
                data-active={activeChapter === index ? "true" : "false"}
                data-story-chapter={index}
                key={node.heading}
                ref={(element) => { chapterRefs.current[index] = element; }}
              >
                <button
                  aria-label={`Show step ${index + 1}: ${node.heading}`}
                  aria-pressed={activeChapter === index}
                  onClick={() => setActiveChapter(index)}
                  onFocus={() => setActiveChapter(index)}
                  type="button"
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <small>{node.label}</small>
                  <strong>{node.heading}</strong>
                </button>
                {node.body?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </li>
            ))}
          </ol>
        </div>

      </div>
    </section>
  );
}

function CapabilityDiagram({ story }: { story: CapabilityStory }) {
  return (
    <div
      aria-hidden="true"
      className="home-capability-diagram"
      data-layout={story.layout}
      key={story.key}
    >
      {story.nodes.map((node, index) => (
        <div className="home-capability-node" key={node}>
          <span>{String(index + 1).padStart(2, "0")}</span>
          <strong>{node}</strong>
        </div>
      ))}
      <i className="home-capability-pulse" />
    </div>
  );
}

function TechnologyExplorer({ block }: { block: CardsBlock }) {
  const items = useMemo(
    () => block.items.filter((item) => item.label && CAPABILITY_STORIES[item.label]),
    [block.items],
  );
  const firstKey = items[0]?.label ?? "RECOVER";
  const [activeKey, setActiveKey] = useState(firstKey);

  return (
    <section
      aria-labelledby="home-explorer-heading"
      className="home-explorer-section"
      data-reveal="section"
      id={block.anchor}
    >
      <div className="home-story-shell">
        <div className="home-section-heading home-section-heading--dark">
          <p className="home-kicker">TECHNOLOGY EXPLORER</p>
          <h2 id="home-explorer-heading">{block.heading}</h2>
          {block.intro?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </div>

        <div className="home-explorer-controls" aria-label="Choose a Halo technology topic" role="group">
          {items.map((item) => (
            <button
              aria-controls={`home-capability-${item.label?.toLowerCase()}`}
              aria-pressed={activeKey === item.label}
              key={item.label}
              onClick={() => setActiveKey(item.label ?? firstKey)}
              type="button"
            >
              <small>{item.label}</small>
              <span>{item.heading}</span>
            </button>
          ))}
        </div>

        <div className="home-capability-panels">
          {items.map((item) => {
            const label = item.label ?? firstKey;
            const story = CAPABILITY_STORIES[label];
            const action = firstAction(item);
            const active = activeKey === label;
            return (
              <article
                aria-labelledby={`home-capability-${label.toLowerCase()}-heading`}
                className="home-capability-panel"
                data-active={active ? "true" : "false"}
                id={`home-capability-${label.toLowerCase()}`}
                key={label}
              >
                <div className="home-capability-copy">
                  <p className="home-item-label">{label}</p>
                  <h3 id={`home-capability-${label.toLowerCase()}-heading`}>{item.heading}</h3>
                  {item.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                  {action ? <a className="home-text-link" href={action.href}>{action.label}</a> : null}
                </div>

                <div className="home-capability-visual">
                  <CapabilityDiagram story={story} />
                  <dl className="home-capability-story">
                    <div><dt>Problem</dt><dd>{story.problem}</dd></div>
                    <div><dt>Halo mechanism</dt><dd>{story.mechanism}</dd></div>
                    <div><dt>Evaluation value</dt><dd>{story.value}</dd></div>
                  </dl>
                  <p className="home-capability-boundary"><strong>Boundary</strong>{story.boundary}</p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function HomeTechnologyStory({ blocks }: { blocks: readonly ContentBlock[] }) {
  const problems = requireBlock(blocks, "cards", "migration-pressure");
  const multimode = requireBlock(blocks, "diagram", "compatibility-engine");
  const capabilities = requireBlock(blocks, "cards", "platform-capabilities");

  return (
    <>
      <ProblemSection block={problems} />
      <MultimodeStory block={multimode} />
      <TechnologyExplorer block={capabilities} />
    </>
  );
}
