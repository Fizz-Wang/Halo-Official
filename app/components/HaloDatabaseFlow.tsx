"use client";

import { useState } from "react";

export interface HaloDatabaseFlowProps {
  variant?: "primary" | "ambient" | "reduced";
}

const HOME_MODES = [
  {
    id: "oracle",
    label: "Oracle",
    description: "Test documented Oracle-oriented behavior against the application you actually run.",
  },
  {
    id: "mysql",
    label: "MySQL",
    description: "Test the documented MySQL operating-mode behavior required by the workload and tools.",
  },
  {
    id: "postgresql",
    label: "PostgreSQL",
    description: "Test PostgreSQL operating-mode behavior in the same versioned Halo target.",
  },
] as const;

function DataStack({ standby = false }: { standby?: boolean }) {
  return (
    <span
      className={`data-stack${standby ? " data-stack--standby" : ""}`}
    >
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

export function HaloDatabaseFlow({
  variant = "primary",
}: HaloDatabaseFlowProps) {
  const [activeMode, setActiveMode] = useState<(typeof HOME_MODES)[number]["id"]>("oracle");
  const selectedMode = HOME_MODES.find((mode) => mode.id === activeMode) ?? HOME_MODES[0];

  if (variant === "primary") {
    return (
      <figure
        aria-labelledby="hero-mode-flow-heading"
        className="halo-database-flow halo-database-flow--primary halo-mode-flow"
      >
        <div className="halo-mode-flow-head">
          <div>
            <span>WORKLOAD LENS</span>
            <strong id="hero-mode-flow-heading">3 operating modes. One Halo cluster.</strong>
          </div>
          <span>HALO 1.0.16</span>
        </div>

        <div aria-label="Choose an operating mode" className="halo-mode-switch" role="group">
          {HOME_MODES.map((mode) => (
            <button
              aria-pressed={activeMode === mode.id}
              key={mode.id}
              onClick={() => setActiveMode(mode.id)}
              onFocus={() => setActiveMode(mode.id)}
              onPointerEnter={() => setActiveMode(mode.id)}
              type="button"
            >
              {mode.label}
            </button>
          ))}
        </div>

        <div aria-hidden="true" className="halo-mode-visual" data-mode={activeMode} key={activeMode}>
          <div className="halo-mode-sources">
            <span>Application</span>
            <i />
            <i />
            <i />
          </div>
          <span className="halo-mode-route"><i /></span>
          <div className="halo-mode-cluster">
            <small>ONE CLUSTER</small>
            <div className="halo-mode-rings"><i /><i /><i /></div>
            <strong>Halo Database</strong>
            <span>{selectedMode.label} mode</span>
          </div>
          <span className="halo-mode-route halo-mode-route--out"><i /></span>
          <div className="halo-mode-evidence">
            <small>WORKLOAD EVIDENCE</small>
            <span>Behavior</span>
            <span>Operations</span>
            <span>Decision</span>
          </div>
        </div>

        <figcaption>
          <strong>{selectedMode.label} workload view</strong>
          <span>{selectedMode.description}</span>
          <small>Mode support is a versioned test surface—not a promise that every application moves unchanged.</small>
        </figcaption>
      </figure>
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`halo-database-flow halo-database-flow--${variant}`}
    >
      <div className="data-flow-endpoints">
        <span className="data-flow-label">Query endpoints</span>
        <span className="data-flow-mode">Oracle</span>
        <span className="data-flow-mode">MySQL</span>
        <span className="data-flow-mode">PostgreSQL</span>
      </div>

      <div className="data-flow-lane data-flow-lane--query">
        <span className="data-flow-lane-label">Request</span>
        <i className="data-flow-packet" />
      </div>

      <div className="data-flow-database data-flow-database--primary">
        <span className="data-flow-label">Primary</span>
        <DataStack />
        <strong>Halo database</strong>
        <span className="data-flow-meta">Transaction · WAL · data pages</span>
      </div>

      <div className="data-flow-lane data-flow-lane--replication">
        <span className="data-flow-lane-label">WAL</span>
        <i className="data-flow-packet" />
      </div>

      <div className="data-flow-database data-flow-database--standby">
        <span className="data-flow-label">Readable standby</span>
        <DataStack standby />
        <strong>Replay</strong>
      </div>

      <div className="data-flow-ledger">
        <span><i />Request</span>
        <span><i />Commit path</span>
        <span><i />Replica replay</span>
      </div>
    </div>
  );
}
