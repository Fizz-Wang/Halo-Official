export interface HaloDatabaseFlowProps {
  variant?: "primary" | "ambient" | "reduced";
}

const HOME_MODES = ["Oracle", "MySQL", "PostgreSQL"] as const;

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
  if (variant === "primary") {
    return (
      <figure
        aria-labelledby="hero-engine-heading"
        className="halo-database-flow halo-database-flow--primary halo-engine-flow"
      >
        <div className="halo-engine-head">
          <div>
            <span>OPERATING-MODE ENTRY</span>
            <strong id="hero-engine-heading">Three operating modes. One Halo foundation.</strong>
          </div>
          <span>HALO 1.0.16</span>
        </div>

        <div aria-label="Application-facing operating modes" className="halo-engine-switch" role="list">
          {HOME_MODES.map((mode) => (
            <span key={mode} role="listitem">{mode}</span>
          ))}
        </div>

        <div aria-hidden="true" className="halo-engine-path">
          <div className="halo-engine-source">
            <small>INPUT</small>
            <strong>App input</strong>
            <span>Mode entry</span>
          </div>
          <span className="halo-engine-route"><i /></span>
          <div className="halo-engine-layers">
            <small>ONE PLATFORM</small>
            <span><b>01</b>E5 compatibility</span>
            <span><b>02</b>Transactions + WAL</span>
            <span><b>03</b>Storage + recovery</span>
          </div>
          <span className="halo-engine-route halo-engine-route--out"><i /></span>
          <div className="halo-engine-kernel">
            <small>EXECUTION</small>
            <strong>Result</strong>
            <span>plan · commit · persist</span>
          </div>
        </div>

        <figcaption>
          <strong>Start with expected application behavior.</strong>
          <span>Then inspect each mechanism on its own terms.</span>
          <small>Halo 1.0.16 documents Oracle, MySQL, and PostgreSQL operating modes within one cluster; exact coverage remains workload-specific.</small>
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
