export interface HaloDatabaseFlowProps {
  variant?: "primary" | "ambient" | "reduced";
}

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
