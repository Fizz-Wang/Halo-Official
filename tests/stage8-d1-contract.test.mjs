import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { HmacAuthorizationIndexCodec } from "../lib/stage8/acquisition/authorization-index.ts";
import {
  canonicalAcquisitionRoute,
  D1AcquisitionRepository,
  validateAuthorizedLineageLifetime,
} from "../lib/stage8/acquisition/d1-repository.ts";

const migrationDirectory = new URL("../drizzle/", import.meta.url);
const testKey = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
const acquisitionTables = Object.freeze([
  "acquisition_lineages",
  "acquisition_logical_ids",
  "acquisition_nodes",
  "acquisition_capabilities",
  "acquisition_result_sets",
  "acquisition_result_handles",
  "acquisition_result_authorizations",
  "acquisition_dispatches",
  "acquisition_dispatch_operations",
  "acquisition_dispatch_observations",
]);

function acquisitionTableCounts(database) {
  return Object.fromEntries(
    acquisitionTables.map((table) => [
      table,
      database.prepare(`SELECT count(*) AS count FROM ${table}`).get().count,
    ]),
  );
}

class TestClock {
  constructor(value = 0, step = 0) {
    this.value = value;
    this.step = step;
  }

  now() {
    const sampled = this.value;
    this.value += this.step;
    return sampled;
  }
}

class SqlitePreparedStatement {
  constructor(database, query) {
    this.database = database;
    this.query = query;
    this.values = [];
  }

  bind(...values) {
    this.values = values;
    return this;
  }

  async first() {
    return this.database.raw.prepare(this.query).get(...this.values) ?? null;
  }

  async run() {
    const statement = this.database.raw.prepare(this.query);
    if (/^\s*(?:SELECT|PRAGMA)\b/iu.test(this.query)) {
      return {
        success: true,
        results: statement.all(...this.values),
        meta: { changes: 0 },
      };
    }
    const result = statement.run(...this.values);
    return {
      success: true,
      meta: { changes: Number(result.changes) },
    };
  }

  async all() {
    return {
      success: true,
      results: this.database.raw.prepare(this.query).all(...this.values),
      meta: { changes: 0 },
    };
  }
}

class SqliteD1 {
  constructor(raw) {
    this.raw = raw;
    this.queries = [];
    this.sessionModes = [];
  }

  withSession(mode) {
    this.sessionModes.push(mode);
    return this;
  }

  prepare(query) {
    this.queries.push(query);
    return new SqlitePreparedStatement(this, query);
  }

  async batch(statements) {
    this.raw.exec("BEGIN IMMEDIATE");
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.raw.exec("COMMIT");
      return results;
    } catch (error) {
      this.raw.exec("ROLLBACK");
      throw error;
    }
  }
}

class SqliteD1WithSkippedStatement extends SqliteD1 {
  constructor(raw, skippedQueryPattern) {
    super(raw);
    this.skippedQueryPattern = skippedQueryPattern;
  }

  async batch(statements) {
    this.raw.exec("BEGIN IMMEDIATE");
    try {
      const results = [];
      let skipped = false;
      for (const statement of statements) {
        if (!skipped && this.skippedQueryPattern.test(statement.query)) {
          skipped = true;
          results.push({ success: true, meta: { changes: 0 } });
        } else {
          results.push(await statement.run());
        }
      }
      assert.equal(skipped, true, "the requested fault injection SQL was absent");
      this.raw.exec("COMMIT");
      return results;
    } catch (error) {
      this.raw.exec("ROLLBACK");
      throw error;
    }
  }
}

async function migrationSources() {
  const names = (await readdir(migrationDirectory))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  return Promise.all(
    names.map((name) => readFile(new URL(name, migrationDirectory), "utf8")),
  );
}

function applyMigration(database, source) {
  for (const statement of source.split("--> statement-breakpoint")) {
    if (statement.trim().length > 0) database.exec(statement);
  }
}

async function createContext() {
  const raw = new DatabaseSync(":memory:");
  raw.exec("PRAGMA foreign_keys=ON");
  for (const source of await migrationSources()) applyMigration(raw, source);
  const database = new SqliteD1(raw);
  const authorizationIndex = new HmacAuthorizationIndexCodec(
    "stage8-test-key",
    new Map([["stage8-test-key", testKey]]),
  );
  const clock = new TestClock();
  return {
    raw,
    database,
    authorizationIndex,
    clock,
    repository: new D1AcquisitionRepository(database, authorizationIndex, clock),
  };
}

const rootRecord = Object.freeze({
  lineageKey: "lineage-root",
  nodeKey: "node-root",
  capabilityDigest: "capability-root",
  sessionDigest: "session-root",
  intent: "poc",
  canonicalRoute: "/request-poc/",
  postAction: "/request-poc/",
  logicalId: "logical-root",
  generation: 0,
  createdAt: 100,
  expiresAt: 200,
  cleanupAfter: 400,
  proofCleanupAfter: 300,
});

function parentSelection(overrides = {}) {
  return {
    selectionKey: "selection-parent",
    lineageKey: rootRecord.lineageKey,
    nodeKey: rootRecord.nodeKey,
    sessionDigest: rootRecord.sessionDigest,
    intent: rootRecord.intent,
    canonicalRoute: rootRecord.canonicalRoute,
    postAction: rootRecord.postAction,
    logicalId: rootRecord.logicalId,
    generation: 0,
    expectedRevision: 0,
    candidateFingerprint: "candidate-a",
    payloadSnapshotRef: "snapshot-a",
    selectionKind: "parent",
    child: null,
    updatedAt: 120,
    ...overrides,
  };
}

function validationFinalization() {
  const resultSetKey = "result-set-validation";
  return {
    finalizationKey: "finalization-validation",
    resultSetKey,
    completion: {
      lineageKey: rootRecord.lineageKey,
      nodeKey: rootRecord.nodeKey,
      sessionDigest: rootRecord.sessionDigest,
      intent: rootRecord.intent,
      canonicalRoute: rootRecord.canonicalRoute,
      postAction: rootRecord.postAction,
      sourceLogicalId: rootRecord.logicalId,
      sourceGeneration: 0,
      sourceKind: "initial",
      selectedLogicalId: rootRecord.logicalId,
      candidateFingerprint: "candidate-a",
      expectedRevision: 1,
      operation: "validation",
      operationKey: null,
      observationKey: null,
      outcome: "validation_failed",
      updatedAt: 150,
    },
    next: {
      lineageKey: rootRecord.lineageKey,
      nodeKey: "node-validation",
      parentNodeKey: rootRecord.nodeKey,
      sessionDigest: rootRecord.sessionDigest,
      intent: rootRecord.intent,
      canonicalRoute: rootRecord.canonicalRoute,
      postAction: rootRecord.postAction,
      logicalId: rootRecord.logicalId,
      generation: 1,
      sourceKind: "validation",
      boundPayloadFingerprint: null,
      capabilityDigest: "capability-validation",
      createdAt: 150,
      expiresAt: 250,
      cleanupAfter: 400,
      capabilityIssuedAt: 150,
      capabilityValidUntil: 300,
      capabilityProofCleanupAfter: 350,
    },
    resultHandles: [
      {
        handleDigest: "handle-validation",
        lineageKey: rootRecord.lineageKey,
        nodeKey: "node-validation",
        sessionDigest: rootRecord.sessionDigest,
        intent: rootRecord.intent,
        canonicalRoute: rootRecord.canonicalRoute,
        postAction: rootRecord.postAction,
        logicalId: rootRecord.logicalId,
        generation: 1,
        representation: "returned_form",
        publicState: "validation",
        returnHandleDigest: null,
        payloadFingerprint: "candidate-a",
        resultSetKey,
        operationKey: null,
        observationKey: null,
        issuedAt: 150,
        expiresAt: 250,
        cleanupAfter: 380,
      },
    ],
  };
}

function dispatchIdentity() {
  return {
    dispatchKey: "dispatch-root",
    lineageKey: rootRecord.lineageKey,
    originNodeKey: rootRecord.nodeKey,
    sessionDigest: rootRecord.sessionDigest,
    intent: rootRecord.intent,
    canonicalRoute: rootRecord.canonicalRoute,
    postAction: rootRecord.postAction,
    logicalId: rootRecord.logicalId,
    generation: 0,
    selectedLogicalId: rootRecord.logicalId,
    candidateFingerprint: "candidate-a",
    idempotencyKey: rootRecord.logicalId,
    destinationKey: "destination-approved",
    createdAt: 125,
    cleanupAfter: 400,
  };
}

function dispatchOperation(overrides = {}) {
  return {
    operationKey: "operation-dispatch-1",
    dispatchKey: "dispatch-root",
    lineageKey: rootRecord.lineageKey,
    sourceNodeKey: rootRecord.nodeKey,
    sessionDigest: rootRecord.sessionDigest,
    intent: rootRecord.intent,
    canonicalRoute: rootRecord.canonicalRoute,
    postAction: rootRecord.postAction,
    logicalId: rootRecord.logicalId,
    generation: 0,
    selectedLogicalId: rootRecord.logicalId,
    candidateFingerprint: "candidate-a",
    payloadSnapshotRef: "snapshot-a",
    authorizationObservationKey: null,
    operationKind: "dispatch",
    reservedAt: 130,
    cleanupAfter: 400,
    ...overrides,
  };
}

function dispatchObservation(overrides = {}) {
  return {
    observationKey: "observation-indeterminate-1",
    operationKey: "operation-dispatch-1",
    observationDigest: "observation-digest-1",
    outcome: "indeterminate",
    evidenceDigest: "destination-check-timeout",
    acknowledgedAt: null,
    observedAt: 140,
    cleanupAfter: 400,
    checkedAt: 140,
    ...overrides,
  };
}

function uncertaintyFinalization() {
  const resultSetKey = "result-set-unknown";
  return {
    finalizationKey: "finalization-unknown",
    resultSetKey,
    completion: {
      lineageKey: rootRecord.lineageKey,
      nodeKey: rootRecord.nodeKey,
      sessionDigest: rootRecord.sessionDigest,
      intent: rootRecord.intent,
      canonicalRoute: rootRecord.canonicalRoute,
      postAction: rootRecord.postAction,
      sourceLogicalId: rootRecord.logicalId,
      sourceGeneration: 0,
      sourceKind: "initial",
      selectedLogicalId: rootRecord.logicalId,
      candidateFingerprint: "candidate-a",
      expectedRevision: 1,
      operation: "dispatch",
      operationKey: "operation-dispatch-1",
      observationKey: "observation-indeterminate-1",
      outcome: "indeterminate",
      updatedAt: 150,
    },
    next: {
      lineageKey: rootRecord.lineageKey,
      nodeKey: "node-unknown",
      parentNodeKey: rootRecord.nodeKey,
      sessionDigest: rootRecord.sessionDigest,
      intent: rootRecord.intent,
      canonicalRoute: rootRecord.canonicalRoute,
      postAction: rootRecord.postAction,
      logicalId: rootRecord.logicalId,
      generation: 1,
      sourceKind: "unknown",
      boundPayloadFingerprint: "candidate-a",
      capabilityDigest: "capability-unknown",
      createdAt: 150,
      expiresAt: 250,
      cleanupAfter: 400,
      capabilityIssuedAt: 150,
      capabilityValidUntil: 300,
      capabilityProofCleanupAfter: 350,
    },
    // Deliberately reversed. The repository must store the FK target first.
    resultHandles: [
      {
        handleDigest: "handle-unknown",
        lineageKey: rootRecord.lineageKey,
        nodeKey: "node-unknown",
        sessionDigest: rootRecord.sessionDigest,
        intent: rootRecord.intent,
        canonicalRoute: rootRecord.canonicalRoute,
        postAction: rootRecord.postAction,
        logicalId: rootRecord.logicalId,
        generation: 1,
        representation: "reduced",
        publicState: "unknown",
        returnHandleDigest: "handle-return-form",
        payloadFingerprint: "candidate-a",
        resultSetKey,
        operationKey: "operation-dispatch-1",
        observationKey: "observation-indeterminate-1",
        issuedAt: 150,
        expiresAt: 230,
        cleanupAfter: 370,
      },
      {
        handleDigest: "handle-return-form",
        lineageKey: rootRecord.lineageKey,
        nodeKey: "node-unknown",
        sessionDigest: rootRecord.sessionDigest,
        intent: rootRecord.intent,
        canonicalRoute: rootRecord.canonicalRoute,
        postAction: rootRecord.postAction,
        logicalId: rootRecord.logicalId,
        generation: 1,
        representation: "returned_form",
        publicState: "return_form",
        returnHandleDigest: null,
        payloadFingerprint: "candidate-a",
        resultSetKey,
        operationKey: "operation-dispatch-1",
        observationKey: "observation-indeterminate-1",
        issuedAt: 150,
        expiresAt: 240,
        cleanupAfter: 380,
      },
    ],
  };
}

function backendFailureFinalization() {
  const resultSetKey = "result-set-backend-failure";
  return {
    finalizationKey: "finalization-backend-failure",
    resultSetKey,
    completion: {
      lineageKey: rootRecord.lineageKey,
      nodeKey: rootRecord.nodeKey,
      sessionDigest: rootRecord.sessionDigest,
      intent: rootRecord.intent,
      canonicalRoute: rootRecord.canonicalRoute,
      postAction: rootRecord.postAction,
      sourceLogicalId: rootRecord.logicalId,
      sourceGeneration: 0,
      sourceKind: "initial",
      selectedLogicalId: rootRecord.logicalId,
      candidateFingerprint: "candidate-a",
      expectedRevision: 1,
      operation: "dispatch",
      operationKey: "operation-dispatch-1",
      observationKey: "observation-not-recorded-root",
      outcome: "not_recorded",
      updatedAt: 150,
    },
    next: {
      lineageKey: rootRecord.lineageKey,
      nodeKey: "node-backend-failure",
      parentNodeKey: rootRecord.nodeKey,
      sessionDigest: rootRecord.sessionDigest,
      intent: rootRecord.intent,
      canonicalRoute: rootRecord.canonicalRoute,
      postAction: rootRecord.postAction,
      logicalId: rootRecord.logicalId,
      generation: 1,
      sourceKind: "backend_failure",
      boundPayloadFingerprint: "candidate-a",
      capabilityDigest: "capability-backend-failure",
      createdAt: 150,
      expiresAt: 250,
      cleanupAfter: 400,
      capabilityIssuedAt: 150,
      capabilityValidUntil: 300,
      capabilityProofCleanupAfter: 350,
    },
    resultHandles: [
      {
        handleDigest: "handle-backend-failure",
        lineageKey: rootRecord.lineageKey,
        nodeKey: "node-backend-failure",
        sessionDigest: rootRecord.sessionDigest,
        intent: rootRecord.intent,
        canonicalRoute: rootRecord.canonicalRoute,
        postAction: rootRecord.postAction,
        logicalId: rootRecord.logicalId,
        generation: 1,
        representation: "returned_form",
        publicState: "backend_failure",
        returnHandleDigest: null,
        payloadFingerprint: "candidate-a",
        resultSetKey,
        operationKey: "operation-dispatch-1",
        observationKey: "observation-not-recorded-root",
        issuedAt: 150,
        expiresAt: 250,
        cleanupAfter: 380,
      },
    ],
  };
}

function possibleDuplicateFinalization() {
  const resultSetKey = "result-set-possible-duplicate";
  return {
    finalizationKey: "finalization-possible-duplicate",
    resultSetKey,
    completion: {
      lineageKey: rootRecord.lineageKey,
      nodeKey: "node-unknown",
      sessionDigest: rootRecord.sessionDigest,
      intent: rootRecord.intent,
      canonicalRoute: rootRecord.canonicalRoute,
      postAction: rootRecord.postAction,
      sourceLogicalId: rootRecord.logicalId,
      sourceGeneration: 1,
      sourceKind: "unknown",
      selectedLogicalId: rootRecord.logicalId,
      candidateFingerprint: "candidate-a",
      expectedRevision: 1,
      operation: "reconcile",
      operationKey: "operation-reconcile-possible",
      observationKey: "observation-reconcile-indeterminate",
      outcome: "indeterminate",
      updatedAt: 200,
    },
    next: {
      lineageKey: rootRecord.lineageKey,
      nodeKey: "node-possible-duplicate",
      parentNodeKey: "node-unknown",
      sessionDigest: rootRecord.sessionDigest,
      intent: rootRecord.intent,
      canonicalRoute: rootRecord.canonicalRoute,
      postAction: rootRecord.postAction,
      logicalId: rootRecord.logicalId,
      generation: 2,
      sourceKind: "possible_duplicate",
      boundPayloadFingerprint: "candidate-a",
      capabilityDigest: "capability-possible-duplicate",
      createdAt: 200,
      expiresAt: 260,
      cleanupAfter: 400,
      capabilityIssuedAt: 200,
      capabilityValidUntil: 310,
      capabilityProofCleanupAfter: 350,
    },
    resultHandles: [
      {
        handleDigest: "handle-possible-duplicate",
        lineageKey: rootRecord.lineageKey,
        nodeKey: "node-possible-duplicate",
        sessionDigest: rootRecord.sessionDigest,
        intent: rootRecord.intent,
        canonicalRoute: rootRecord.canonicalRoute,
        postAction: rootRecord.postAction,
        logicalId: rootRecord.logicalId,
        generation: 2,
        representation: "reduced",
        publicState: "possible_duplicate",
        returnHandleDigest: "handle-reconcile-return-form",
        payloadFingerprint: "candidate-a",
        resultSetKey,
        operationKey: "operation-reconcile-possible",
        observationKey: "observation-reconcile-indeterminate",
        issuedAt: 200,
        expiresAt: 240,
        cleanupAfter: 370,
      },
      {
        handleDigest: "handle-reconcile-return-form",
        lineageKey: rootRecord.lineageKey,
        nodeKey: "node-possible-duplicate",
        sessionDigest: rootRecord.sessionDigest,
        intent: rootRecord.intent,
        canonicalRoute: rootRecord.canonicalRoute,
        postAction: rootRecord.postAction,
        logicalId: rootRecord.logicalId,
        generation: 2,
        representation: "returned_form",
        publicState: "return_form",
        returnHandleDigest: null,
        payloadFingerprint: "candidate-a",
        resultSetKey,
        operationKey: "operation-reconcile-possible",
        observationKey: "observation-reconcile-indeterminate",
        issuedAt: 200,
        expiresAt: 250,
        cleanupAfter: 380,
      },
    ],
  };
}

function receiptFinalization() {
  const resultSetKey = "result-set-receipt";
  return {
    finalizationKey: "finalization-receipt",
    resultSetKey,
    completion: {
      lineageKey: rootRecord.lineageKey,
      nodeKey: "node-unknown",
      sessionDigest: rootRecord.sessionDigest,
      intent: rootRecord.intent,
      canonicalRoute: rootRecord.canonicalRoute,
      postAction: rootRecord.postAction,
      sourceLogicalId: rootRecord.logicalId,
      sourceGeneration: 1,
      sourceKind: "unknown",
      selectedLogicalId: rootRecord.logicalId,
      candidateFingerprint: "candidate-a",
      expectedRevision: 1,
      operation: "dispatch",
      operationKey: "operation-dispatch-2",
      observationKey: "observation-recorded-2",
      outcome: "recorded",
      updatedAt: 210,
    },
    next: null,
    resultHandles: [
      {
        handleDigest: "handle-receipt",
        lineageKey: rootRecord.lineageKey,
        nodeKey: "node-unknown",
        sessionDigest: rootRecord.sessionDigest,
        intent: rootRecord.intent,
        canonicalRoute: rootRecord.canonicalRoute,
        postAction: rootRecord.postAction,
        logicalId: rootRecord.logicalId,
        generation: 1,
        representation: "reduced",
        publicState: "receipt",
        returnHandleDigest: null,
        payloadFingerprint: null,
        resultSetKey,
        operationKey: "operation-dispatch-2",
        observationKey: "observation-recorded-2",
        issuedAt: 210,
        expiresAt: 250,
        cleanupAfter: 350,
      },
    ],
  };
}

async function prepareDispatch(context, { outcome = "indeterminate" } = {}) {
  await context.repository.reserveOrLoadDispatchIdentityForCreation(
    dispatchIdentity(),
  );
  const operation = dispatchOperation();
  await context.repository.reserveOrLoadDispatchOperation(operation);
  const observation =
    outcome === "indeterminate"
      ? dispatchObservation()
      : dispatchObservation({
          observationKey: "observation-recorded-1",
          observationDigest: "observation-digest-recorded-1",
          outcome: "recorded",
          evidenceDigest: "destination-durable-record-1",
          acknowledgedAt: 135,
          observedAt: 140,
        });
  await context.repository.appendOrLoadDispatchObservation(observation);
  return { operation, observation };
}

function expiryDraft(overrides = {}) {
  return {
    handleDigest: "handle-expired-a",
    lineageKey: null,
    nodeKey: null,
    sessionDigest: rootRecord.sessionDigest,
    intent: rootRecord.intent,
    canonicalRoute: rootRecord.canonicalRoute,
    postAction: rootRecord.postAction,
    logicalId: rootRecord.logicalId,
    generation: 0,
    representation: "reduced",
    publicState: "expired",
    returnHandleDigest: null,
    payloadFingerprint: null,
    resultSetKey: "result-set-expired-a",
    operationKey: null,
    observationKey: null,
    expiresAt: rootRecord.proofCleanupAfter,
    cleanupAfter: rootRecord.cleanupAfter,
    ...overrides,
  };
}

test("defines only the four server-owned acquisition intent routes", () => {
  assert.deepEqual(canonicalAcquisitionRoute, {
    poc: "/request-poc/",
    sales: "/contact-sales/",
    demo: "/request-demo/",
    partner: "/partners/apply/",
  });
});

test("issues a signed root atomically and rejects a mutated authorization index row", async () => {
  const context = await createContext();
  try {
    await context.repository.issueRoot(rootRecord);

    assert.deepEqual(
      {
        ...context.raw
          .prepare(
            `SELECT
               (SELECT count(*) FROM acquisition_lineages) AS lineages,
               (SELECT count(*) FROM acquisition_logical_ids) AS logicalIds,
               (SELECT count(*) FROM acquisition_nodes) AS nodes,
               (SELECT count(*) FROM acquisition_capabilities) AS capabilities`,
          )
          .get(),
      },
      { lineages: 1, logicalIds: 1, nodes: 1, capabilities: 1 },
    );
    assert.deepEqual(context.database.sessionModes, ["first-primary"]);
    assert.deepEqual(context.raw.prepare("PRAGMA foreign_key_check").all(), []);

    const projection = await context.repository.readAuthorizationProjection(
      rootRecord.capabilityDigest,
      null,
    );
    assert.equal(projection?.capabilityDigest, rootRecord.capabilityDigest);
    assert.equal(projection?.sourceKind, "initial");
    assert.equal(projection?.logicalProjectionMatches, 1);
    assert.equal(projection?.nodeProjectionMatches, 1);
    assert.equal(projection?.handleProjectionMatches, 1);

    context.raw
      .prepare(
        `UPDATE acquisition_capabilities
         SET valid_until = valid_until + 1
         WHERE capability_digest = ?`,
      )
      .run(rootRecord.capabilityDigest);
    assert.equal(
      await context.repository.readAuthorizationProjection(
        rootRecord.capabilityDigest,
        null,
      ),
      null,
    );
  } finally {
    context.raw.close();
  }
});

test("rejects route rebinding before touching D1", async () => {
  const context = await createContext();
  try {
    context.database.queries.length = 0;
    await assert.rejects(
      context.repository.issueRoot({
        ...rootRecord,
        canonicalRoute: "/contact-sales/",
      }),
      /does not match/,
    );
    assert.deepEqual(context.database.queries, []);
  } finally {
    context.raw.close();
  }
});

test("pre-authorization reads touch only the immutable authorization index", async () => {
  const context = await createContext();
  try {
    await context.repository.issueRoot(rootRecord);
    context.database.queries.length = 0;

    await context.repository.readAuthorizationProjection(
      rootRecord.capabilityDigest,
      "absent-result-handle",
    );
    await context.repository.readResultHandleProjection("absent-result-handle");

    assert.equal(context.database.queries.length, 2);
    const sql = context.database.queries.join("\n").toLowerCase();
    assert.match(sql, /acquisition_capabilities/);
    assert.match(sql, /acquisition_result_authorizations/);
    for (const forbidden of [
      "acquisition_lineages",
      "acquisition_logical_ids",
      "acquisition_nodes",
      "acquisition_result_handles",
      "acquisition_dispatches",
      "acquisition_dispatch_operations",
      "acquisition_dispatch_observations",
    ]) {
      assert.doesNotMatch(sql, new RegExp(`\\b${forbidden}\\b`, "u"));
    }
  } finally {
    context.raw.close();
  }
});

test("parent selection is one durable CAS winner and response-loss replay is stable", async () => {
  const context = await createContext();
  try {
    await context.repository.issueRoot(rootRecord);
    const selection = parentSelection();

    const applied = await context.repository.reserveSelection(selection);
    assert.equal(applied.kind, "applied");
    assert.equal(applied.winner.outcome, "ready");
    assert.equal(applied.winner.selectedLogicalId, rootRecord.logicalId);
    assert.equal(applied.winner.selectedNodeKey, null);

    const replay = await context.repository.reserveSelection(selection);
    assert.equal(replay.kind, "replay");
    assert.deepEqual(replay.winner, applied.winner);

    const loser = await context.repository.reserveSelection(
      parentSelection({
        selectionKey: "selection-loser",
        candidateFingerprint: "candidate-b",
        payloadSnapshotRef: "snapshot-b",
      }),
    );
    assert.deepEqual(loser, { kind: "expired" });
    assert.equal(
      context.raw
        .prepare(
          "SELECT selected_candidate_fingerprint AS value FROM acquisition_nodes WHERE node_key = ?",
        )
        .get(rootRecord.nodeKey).value,
      "candidate-a",
    );
  } finally {
    context.raw.close();
  }
});

test("changed-payload retry reserves exactly one child logical ID", async () => {
  const context = await createContext();
  try {
    await context.repository.issueRoot(rootRecord);
    context.raw
      .prepare(
        `UPDATE acquisition_nodes
         SET source_kind = 'backend_failure', bound_payload_fingerprint = 'candidate-old'
         WHERE node_key = ?`,
      )
      .run(rootRecord.nodeKey);

    const selection = parentSelection({
      selectionKey: "selection-child",
      candidateFingerprint: "candidate-new",
      payloadSnapshotRef: "snapshot-new",
      selectionKind: "child",
      child: {
        logicalId: "logical-child",
        createdAt: 120,
        cleanupAfter: rootRecord.cleanupAfter,
      },
    });
    const applied = await context.repository.reserveSelection(selection);
    assert.equal(applied.kind, "applied");
    assert.equal(applied.winner.selectionKind, "child");
    assert.equal(applied.winner.selectedLogicalId, "logical-child");
    assert.deepEqual(
      {
        ...context.raw
          .prepare(
            `SELECT lineage_key AS lineageKey, parent_logical_id AS parentLogicalId,
                    created_at AS createdAt, cleanup_after AS cleanupAfter
             FROM acquisition_logical_ids WHERE logical_id = 'logical-child'`,
          )
          .get(),
      },
      {
        lineageKey: rootRecord.lineageKey,
        parentLogicalId: rootRecord.logicalId,
        createdAt: 120,
        cleanupAfter: rootRecord.cleanupAfter,
      },
    );
    assert.equal((await context.repository.reserveSelection(selection)).kind, "replay");
    assert.equal(
      context.raw
        .prepare("SELECT count(*) AS count FROM acquisition_logical_ids")
        .get().count,
      2,
    );
  } finally {
    context.raw.close();
  }
});

test("competing changed-payload child proposals leave only the durable winner child", async () => {
  const context = await createContext();
  try {
    await context.repository.issueRoot(rootRecord);
    context.raw
      .prepare(
        `UPDATE acquisition_nodes
         SET source_kind = 'backend_failure', bound_payload_fingerprint = 'candidate-old'
         WHERE node_key = ?`,
      )
      .run(rootRecord.nodeKey);

    const winnerProposal = parentSelection({
      selectionKey: "selection-child-winner",
      candidateFingerprint: "candidate-new",
      payloadSnapshotRef: "snapshot-new",
      selectionKind: "child",
      child: {
        logicalId: "logical-child-winner",
        createdAt: 120,
        cleanupAfter: rootRecord.cleanupAfter,
      },
    });
    const sameCandidateLoser = parentSelection({
      selectionKey: "selection-child-same-candidate-loser",
      candidateFingerprint: "candidate-new",
      payloadSnapshotRef: "snapshot-new",
      selectionKind: "child",
      child: {
        logicalId: "logical-child-same-candidate-loser",
        createdAt: 120,
        cleanupAfter: rootRecord.cleanupAfter,
      },
    });
    const differentCandidateLoser = parentSelection({
      selectionKey: "selection-child-different-candidate-loser",
      candidateFingerprint: "candidate-other",
      payloadSnapshotRef: "snapshot-other",
      selectionKind: "child",
      child: {
        logicalId: "logical-child-different-candidate-loser",
        createdAt: 120,
        cleanupAfter: rootRecord.cleanupAfter,
      },
    });

    const winner = await context.repository.reserveSelection(winnerProposal);
    const replay = await context.repository.reserveSelection(sameCandidateLoser);
    const expired = await context.repository.reserveSelection(
      differentCandidateLoser,
    );

    assert.equal(winner.kind, "applied");
    assert.equal(winner.winner.selectedLogicalId, "logical-child-winner");
    assert.equal(replay.kind, "replay");
    assert.equal(replay.winner.selectedLogicalId, "logical-child-winner");
    assert.deepEqual(expired, { kind: "expired" });
    assert.deepEqual(
      context.raw
        .prepare(
          `SELECT logical_id AS logicalId
           FROM acquisition_logical_ids
           ORDER BY logical_id`,
        )
        .all()
        .map((row) => row.logicalId),
      ["logical-child-winner", rootRecord.logicalId],
    );
    assert.equal(
      context.raw
        .prepare(
          `SELECT count(*) AS count
           FROM acquisition_logical_ids
           WHERE logical_id IN (?, ?)`,
        )
        .get(
          sameCandidateLoser.child.logicalId,
          differentCandidateLoser.child.logicalId,
        ).count,
      0,
    );
    assert.deepEqual(context.raw.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    context.raw.close();
  }
});

test("a missing child-registration write rolls back the whole selection batch", async () => {
  const context = await createContext();
  try {
    await context.repository.issueRoot(rootRecord);
    context.raw
      .prepare(
        `UPDATE acquisition_nodes
         SET source_kind = 'backend_failure', bound_payload_fingerprint = 'candidate-old'
         WHERE node_key = ?`,
      )
      .run(rootRecord.nodeKey);
    const faultyDatabase = new SqliteD1WithSkippedStatement(
      context.raw,
      /INSERT INTO acquisition_logical_ids/u,
    );
    const faultyRepository = new D1AcquisitionRepository(
      faultyDatabase,
      context.authorizationIndex,
      context.clock,
    );
    const proposal = parentSelection({
      selectionKey: "selection-child-fault",
      candidateFingerprint: "candidate-new",
      payloadSnapshotRef: "snapshot-new",
      selectionKind: "child",
      child: {
        logicalId: "logical-child-fault",
        createdAt: 120,
        cleanupAfter: rootRecord.cleanupAfter,
      },
    });

    await assert.rejects(
      faultyRepository.reserveSelection(proposal),
      /NOT NULL constraint failed|incomplete set/u,
    );
    assert.deepEqual(
      {
        ...context.raw
          .prepare(
            `SELECT outcome, revision, selection_key AS selectionKey,
                    selection_kind AS selectionKind,
                    selected_logical_id AS selectedLogicalId
             FROM acquisition_nodes WHERE node_key = ?`,
          )
          .get(rootRecord.nodeKey),
      },
      {
        outcome: "fresh",
        revision: 0,
        selectionKey: null,
        selectionKind: null,
        selectedLogicalId: null,
      },
    );
    assert.equal(
      context.raw
        .prepare(
          "SELECT count(*) AS count FROM acquisition_logical_ids WHERE logical_id = ?",
        )
        .get(proposal.child.logicalId).count,
      0,
    );
    assert.deepEqual(context.raw.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    context.raw.close();
  }
});

test("dispatch operations require an immutable causal observation chain", async () => {
  const context = await createContext();
  try {
    await context.repository.issueRoot(rootRecord);
    await context.repository.reserveSelection(parentSelection());

    const identityInput = dispatchIdentity();
    const identity = await context.repository.reserveOrLoadDispatchIdentityForCreation(
      identityInput,
    );
    assert.equal(identity.dispatchKey, identityInput.dispatchKey);
    assert.equal(identity.idempotencyKey, rootRecord.logicalId);
    assert.equal(
      (
        await context.repository.reserveOrLoadDispatchIdentityForCreation(
          identityInput,
        )
      ).dispatchKey,
      identity.dispatchKey,
    );

    const initialOperation = dispatchOperation();
    assert.equal(
      (
        await context.repository.reserveOrLoadDispatchOperation(initialOperation)
      ).kind,
      "applied",
    );
    assert.equal(
      (
        await context.repository.reserveOrLoadDispatchOperation(initialOperation)
      ).kind,
      "replay",
    );
    const indeterminate = dispatchObservation();
    assert.equal(
      (
        await context.repository.appendOrLoadDispatchObservation(indeterminate)
      ).kind,
      "applied",
    );
    assert.equal(
      (
        await context.repository.appendOrLoadDispatchObservation(indeterminate)
      ).kind,
      "replay",
    );
    assert.equal(
      (await context.repository.readDispatchOperationTruth(initialOperation.operationKey))
        .kind,
      "indeterminate",
    );

    context.raw.exec(`
      INSERT INTO acquisition_nodes
        (node_key, lineage_key, parent_node_key, logical_id, generation,
         source_kind, bound_payload_fingerprint, outcome, revision, created_at,
         updated_at, expires_at, cleanup_after)
      VALUES
        ('node-causal-retry', '${rootRecord.lineageKey}', '${rootRecord.nodeKey}',
         '${rootRecord.logicalId}', 1, 'unknown', 'candidate-a', 'fresh', 0,
         150, 150, 250, 400)
    `);
    await context.repository.reserveSelection(
      parentSelection({
        selectionKey: "selection-causal-retry",
        nodeKey: "node-causal-retry",
        generation: 1,
        expectedRevision: 0,
        updatedAt: 170,
      }),
    );
    assert.equal(
      (
        await context.repository.loadDispatchIdentityForReconciliation({
          lineageKey: rootRecord.lineageKey,
          intent: rootRecord.intent,
          logicalId: rootRecord.logicalId,
          destinationKey: identityInput.destinationKey,
          checkedAt: 170,
        })
      )?.dispatchKey,
      identity.dispatchKey,
    );

    const unauthorizedRedispatch = dispatchOperation({
      operationKey: "operation-unauthorized-redispatch",
      sourceNodeKey: "node-causal-retry",
      generation: 1,
      payloadSnapshotRef: "snapshot-a",
      authorizationObservationKey: indeterminate.observationKey,
      reservedAt: 175,
    });
    await assert.rejects(
      context.repository.reserveOrLoadDispatchOperation(unauthorizedRedispatch),
      /winner was rebound/,
    );

    const reconcile = dispatchOperation({
      operationKey: "operation-reconcile-1",
      sourceNodeKey: "node-causal-retry",
      generation: 1,
      payloadSnapshotRef: "snapshot-a",
      authorizationObservationKey: indeterminate.observationKey,
      operationKind: "reconcile",
      reservedAt: 180,
    });
    assert.equal(
      (await context.repository.reserveOrLoadDispatchOperation(reconcile)).kind,
      "applied",
    );
    assert.equal(
      (await context.repository.reserveOrLoadDispatchOperation(reconcile)).kind,
      "replay",
    );
    const notRecorded = dispatchObservation({
      observationKey: "observation-not-recorded-1",
      operationKey: reconcile.operationKey,
      observationDigest: "observation-digest-not-recorded-1",
      outcome: "not_recorded",
      evidenceDigest: "destination-negative-ack",
      acknowledgedAt: 185,
      observedAt: 190,
      checkedAt: 190,
    });
    await context.repository.appendOrLoadDispatchObservation(notRecorded);
    assert.equal(
      (await context.repository.readDispatchOperationTruth(reconcile.operationKey)).kind,
      "not_recorded",
    );

    const authorizedRedispatch = dispatchOperation({
      operationKey: "operation-dispatch-2",
      sourceNodeKey: "node-causal-retry",
      generation: 1,
      payloadSnapshotRef: "snapshot-a",
      authorizationObservationKey: notRecorded.observationKey,
      reservedAt: 195,
    });
    assert.equal(
      (
        await context.repository.reserveOrLoadDispatchOperation(
          authorizedRedispatch,
        )
      ).kind,
      "applied",
    );
    const recorded = dispatchObservation({
      observationKey: "observation-recorded-2",
      operationKey: authorizedRedispatch.operationKey,
      observationDigest: "observation-digest-recorded-2",
      outcome: "recorded",
      evidenceDigest: "destination-durable-record",
      acknowledgedAt: 200,
      observedAt: 205,
      checkedAt: 205,
    });
    await context.repository.appendOrLoadDispatchObservation(recorded);
    assert.equal(
      (
        await context.repository.readDispatchOperationTruth(
          authorizedRedispatch.operationKey,
        )
      ).kind,
      "recorded",
    );
    assert.deepEqual(context.raw.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    context.raw.close();
  }
});

test("validation failure finalizes atomically and recovers the exact result set", async () => {
  const context = await createContext();
  try {
    await context.repository.issueRoot(rootRecord);
    await context.repository.reserveSelection(parentSelection());
    const finalization = validationFinalization();

    assert.equal(await context.repository.finalizeTransition(finalization), "applied");
    assert.equal(await context.repository.finalizeTransition(finalization), "conflict");
    const source = context.raw
      .prepare(
        `SELECT outcome, revision, selected_node_key AS selectedNodeKey,
                result_set_key AS resultSetKey, finalization_key AS finalizationKey
         FROM acquisition_nodes WHERE node_key = ?`,
      )
      .get(rootRecord.nodeKey);
    assert.deepEqual(
      { ...source },
      {
        outcome: "validation_failed",
        revision: 2,
        selectedNodeKey: finalization.next.nodeKey,
        resultSetKey: finalization.resultSetKey,
        finalizationKey: null,
      },
    );
    assert.deepEqual(
      {
        ...context.raw
          .prepare(
            `SELECT source_kind AS sourceKind, outcome, generation
             FROM acquisition_nodes WHERE node_key = ?`,
          )
          .get(finalization.next.nodeKey),
      },
      { sourceKind: "validation", outcome: "fresh", generation: 1 },
    );

    const recovered = await context.repository.recoverAuthorizedSelectionResult(
      rootRecord.nodeKey,
      "candidate-a",
    );
    assert.equal(recovered?.resultSetKey, finalization.resultSetKey);
    assert.deepEqual(
      recovered?.handles.map(({ handleDigest, publicState }) => ({
        handleDigest,
        publicState,
      })),
      [{ handleDigest: "handle-validation", publicState: "validation" }],
    );
    assert.deepEqual(context.raw.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    context.raw.close();
  }
});

test("skipping a required finalization write rolls back marker and every sibling", async () => {
  const context = await createContext();
  try {
    await context.repository.issueRoot(rootRecord);
    await context.repository.reserveSelection(parentSelection());
    const faultyDatabase = new SqliteD1WithSkippedStatement(
      context.raw,
      /INSERT INTO acquisition_capabilities/u,
    );
    const faultyRepository = new D1AcquisitionRepository(
      faultyDatabase,
      context.authorizationIndex,
      context.clock,
    );

    await assert.rejects(
      faultyRepository.finalizeTransition(validationFinalization()),
      /NOT NULL constraint failed|incomplete set/u,
    );
    assert.deepEqual(
      {
        ...context.raw
          .prepare(
            `SELECT outcome, revision, result_set_key AS resultSetKey,
                    finalization_key AS finalizationKey
             FROM acquisition_nodes WHERE node_key = ?`,
          )
          .get(rootRecord.nodeKey),
      },
      {
        outcome: "ready",
        revision: 1,
        resultSetKey: null,
        finalizationKey: null,
      },
    );
    assert.equal(
      context.raw.prepare("SELECT count(*) AS count FROM acquisition_result_sets").get()
        .count,
      0,
    );
    assert.equal(
      context.raw.prepare("SELECT count(*) AS count FROM acquisition_result_handles").get()
        .count,
      0,
    );
  } finally {
    context.raw.close();
  }
});

test("indeterminate dispatch stores the linked two-handle set and rejects proof-field tampering", async () => {
  const context = await createContext();
  try {
    await context.repository.issueRoot(rootRecord);
    await context.repository.reserveSelection(parentSelection());
    await prepareDispatch(context);
    const finalization = uncertaintyFinalization();

    assert.equal(await context.repository.finalizeTransition(finalization), "applied");
    const recovered = await context.repository.recoverAuthorizedSelectionResult(
      rootRecord.nodeKey,
      "candidate-a",
    );
    assert.equal(recovered?.resultSetKey, finalization.resultSetKey);
    assert.deepEqual(
      recovered?.handles.map(({ publicState }) => publicState).sort(),
      ["return_form", "unknown"],
    );
    assert.equal(
      context.raw
        .prepare(
          `SELECT return_handle_digest AS returnHandleDigest
           FROM acquisition_result_handles WHERE handle_digest='handle-unknown'`,
        )
        .get().returnHandleDigest,
      "handle-return-form",
    );

    context.raw.exec(`
      INSERT INTO acquisition_dispatch_operations
        (operation_key, dispatch_key, lineage_key, logical_id, source_node_key,
         source_generation, candidate_fingerprint, payload_snapshot_ref,
         authorization_observation_key, operation_kind, reserved_at,
         cleanup_after)
      VALUES
        ('operation-tampered', 'dispatch-root', '${rootRecord.lineageKey}',
         '${rootRecord.logicalId}', '${rootRecord.nodeKey}', 0, 'candidate-a',
         'snapshot-a', NULL, 'reconcile', 141, 400);
      INSERT INTO acquisition_dispatch_observations
        (observation_key, operation_key, observation_digest, outcome,
         evidence_digest, acknowledged_at, observed_at, cleanup_after)
      VALUES
        ('observation-tampered', 'operation-tampered', 'tampered-digest',
         'indeterminate', 'tampered-evidence', NULL, 142, 400);
      UPDATE acquisition_result_authorizations
      SET operation_key='operation-tampered',
          observation_key='observation-tampered'
      WHERE handle_digest='handle-unknown';
    `);
    assert.equal(
      await context.repository.readResultHandleProjection("handle-unknown"),
      null,
    );
    assert.equal(
      await context.repository.readResultSetProjection(finalization.resultSetKey),
      null,
    );
  } finally {
    context.raw.close();
  }
});

test("definitive not-recorded dispatch returns one backend-failure continuation", async () => {
  const context = await createContext();
  try {
    await context.repository.issueRoot(rootRecord);
    await context.repository.reserveSelection(parentSelection());
    await context.repository.reserveOrLoadDispatchIdentityForCreation(
      dispatchIdentity(),
    );
    await context.repository.reserveOrLoadDispatchOperation(dispatchOperation());
    await context.repository.appendOrLoadDispatchObservation(
      dispatchObservation({
        observationKey: "observation-not-recorded-root",
        observationDigest: "observation-digest-not-recorded-root",
        outcome: "not_recorded",
        evidenceDigest: "destination-negative-ack-root",
        acknowledgedAt: 135,
      }),
    );
    const finalization = backendFailureFinalization();

    assert.equal(await context.repository.finalizeTransition(finalization), "applied");
    assert.deepEqual(
      {
        ...context.raw
          .prepare(
            `SELECT outcome, selected_node_key AS selectedNodeKey
             FROM acquisition_nodes WHERE node_key=?`,
          )
          .get(rootRecord.nodeKey),
      },
      { outcome: "not_recorded", selectedNodeKey: "node-backend-failure" },
    );
    assert.equal(
      (
        await context.repository.readResultSetProjection(finalization.resultSetKey)
      )?.handles[0]?.publicState,
      "backend_failure",
    );
  } finally {
    context.raw.close();
  }
});

test("indeterminate reconciliation advances Unknown to Possible duplicate", async () => {
  const context = await createContext();
  try {
    await context.repository.issueRoot(rootRecord);
    await context.repository.reserveSelection(parentSelection());
    const { observation } = await prepareDispatch(context);
    assert.equal(
      await context.repository.finalizeTransition(uncertaintyFinalization()),
      "applied",
    );

    await context.repository.reserveSelection(
      parentSelection({
        selectionKey: "selection-unknown-reconcile",
        nodeKey: "node-unknown",
        generation: 1,
        expectedRevision: 0,
        updatedAt: 170,
      }),
    );
    const reconcile = dispatchOperation({
      operationKey: "operation-reconcile-possible",
      sourceNodeKey: "node-unknown",
      generation: 1,
      authorizationObservationKey: observation.observationKey,
      operationKind: "reconcile",
      reservedAt: 180,
    });
    await context.repository.reserveOrLoadDispatchOperation(reconcile);
    await context.repository.appendOrLoadDispatchObservation(
      dispatchObservation({
        observationKey: "observation-reconcile-indeterminate",
        operationKey: reconcile.operationKey,
        observationDigest: "observation-digest-reconcile-indeterminate",
        observedAt: 190,
        checkedAt: 190,
      }),
    );
    const finalization = possibleDuplicateFinalization();

    assert.equal(await context.repository.finalizeTransition(finalization), "applied");
    assert.deepEqual(
      (
        await context.repository.readResultSetProjection(finalization.resultSetKey)
      )?.handles.map(({ publicState }) => publicState).sort(),
      ["possible_duplicate", "return_form"],
    );
    assert.deepEqual(
      {
        ...context.raw
          .prepare(
            `SELECT source_kind AS sourceKind, generation
             FROM acquisition_nodes WHERE node_key='node-possible-duplicate'`,
          )
          .get(),
      },
      { sourceKind: "possible_duplicate", generation: 2 },
    );
  } finally {
    context.raw.close();
  }
});

test("recorded dispatch finalizes a receipt without minting a continuation", async () => {
  const context = await createContext();
  try {
    await context.repository.issueRoot(rootRecord);
    await context.repository.reserveSelection(parentSelection());
    const { operation, observation } = await prepareDispatch(context, {
      outcome: "recorded",
    });
    const finalization = receiptFinalization();
    finalization.completion.nodeKey = rootRecord.nodeKey;
    finalization.completion.sourceGeneration = 0;
    finalization.completion.sourceKind = "initial";
    finalization.completion.operationKey = operation.operationKey;
    finalization.completion.observationKey = observation.observationKey;
    finalization.completion.updatedAt = 150;
    finalization.resultHandles[0].nodeKey = rootRecord.nodeKey;
    finalization.resultHandles[0].generation = 0;
    finalization.resultHandles[0].operationKey = operation.operationKey;
    finalization.resultHandles[0].observationKey = observation.observationKey;
    finalization.resultHandles[0].issuedAt = 150;

    assert.equal(await context.repository.finalizeTransition(finalization), "applied");
    assert.deepEqual(
      {
        ...context.raw
          .prepare(
            `SELECT outcome, selected_node_key AS selectedNodeKey,
                    result_set_key AS resultSetKey
             FROM acquisition_nodes WHERE node_key=?`,
          )
          .get(rootRecord.nodeKey),
      },
      {
        outcome: "recorded",
        selectedNodeKey: null,
        resultSetKey: finalization.resultSetKey,
      },
    );
    assert.equal(
      (
        await context.repository.readResultSetProjection(finalization.resultSetKey)
      )?.handles[0]?.publicState,
      "receipt",
    );
  } finally {
    context.raw.close();
  }
});

test("trusted-clock expiry races converge on one full-K winner", async () => {
  const context = await createContext();
  try {
    await context.repository.issueRoot(rootRecord);
    context.clock.value = 210;
    context.clock.step = 1;
    const first = await context.repository.createExpiryHandle(
      rootRecord.capabilityDigest,
      expiryDraft(),
    );
    assert.deepEqual(first, { kind: "applied", handleDigest: "handle-expired-a" });

    const second = await context.repository.createExpiryHandle(
      rootRecord.capabilityDigest,
      expiryDraft({
        handleDigest: "handle-expired-b",
        resultSetKey: "result-set-expired-b",
      }),
    );
    assert.deepEqual(second, { kind: "replay", handleDigest: "handle-expired-a" });
    assert.equal(
      context.raw.prepare("SELECT count(*) AS count FROM acquisition_result_sets").get()
        .count,
      1,
    );
    assert.equal(
      context.raw.prepare("SELECT count(*) AS count FROM acquisition_result_handles").get()
        .count,
      1,
    );
    const projection = await context.repository.readResultSetProjection(
      "result-set-expired-a",
    );
    assert.equal(projection?.handles[0]?.publicState, "expired");
    assert.equal(projection?.handles[0]?.issuedAt, 210);
  } finally {
    context.raw.close();
  }
});

test("a runtime issuedAt property cannot override the trusted expiry clock", async () => {
  const context = await createContext();
  try {
    await context.repository.issueRoot(rootRecord);
    const untypedAdapterDraft = {
      ...expiryDraft(),
      ...{ issuedAt: rootRecord.proofCleanupAfter + 99 },
    };
    const trustedIssuedAt = rootRecord.expiresAt + 10;
    context.clock.value = trustedIssuedAt;

    assert.deepEqual(
      await context.repository.createExpiryHandle(
        rootRecord.capabilityDigest,
        untypedAdapterDraft,
      ),
      { kind: "applied", handleDigest: "handle-expired-a" },
    );
    assert.deepEqual(
      {
        ...context.raw
          .prepare(
            `SELECT handle.issued_at AS handleIssuedAt,
                    authorization.issued_at AS authorizationIssuedAt,
                    owner.created_at AS ownerCreatedAt
             FROM acquisition_result_handles handle
             JOIN acquisition_result_authorizations authorization
               ON authorization.handle_digest = handle.handle_digest
             JOIN acquisition_result_sets owner
               ON owner.result_set_key = handle.result_set_key
             WHERE handle.handle_digest = ?`,
          )
          .get(untypedAdapterDraft.handleDigest),
      },
      {
        handleIssuedAt: trustedIssuedAt,
        authorizationIssuedAt: trustedIssuedAt,
        ownerCreatedAt: trustedIssuedAt,
      },
    );
    assert.notEqual(trustedIssuedAt, untypedAdapterDraft.issuedAt);
    assert.deepEqual(context.raw.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    context.raw.close();
  }
});

test("an unrelated result-set primary-key collision cannot mint expiry siblings", async () => {
  const context = await createContext();
  try {
    await context.repository.issueRoot(rootRecord);
    context.raw
      .prepare(
        `INSERT INTO acquisition_result_sets
          (result_set_key, session_digest, intent, canonical_route, post_action,
           logical_id, generation, outcome, created_at, cleanup_after)
         VALUES (?, 'session-unrelated', 'sales', '/contact-sales/',
                 '/contact-sales/', 'logical-unrelated', 7, 'validation', 90, 500)`,
      )
      .run(expiryDraft().resultSetKey);
    context.clock.value = rootRecord.expiresAt + 10;

    await assert.rejects(
      context.repository.createExpiryHandle(
        rootRecord.capabilityDigest,
        expiryDraft(),
      ),
      /UNIQUE constraint failed|not provable|incomplete authorization set/u,
    );
    assert.deepEqual(
      acquisitionTableCounts(context.raw),
      {
        acquisition_lineages: 1,
        acquisition_logical_ids: 1,
        acquisition_nodes: 1,
        acquisition_capabilities: 1,
        acquisition_result_sets: 1,
        acquisition_result_handles: 0,
        acquisition_result_authorizations: 0,
        acquisition_dispatches: 0,
        acquisition_dispatch_operations: 0,
        acquisition_dispatch_observations: 0,
      },
    );
    assert.deepEqual(
      {
        ...context.raw
          .prepare(
            `SELECT session_digest AS sessionDigest, logical_id AS logicalId,
                    outcome
             FROM acquisition_result_sets WHERE result_set_key = ?`,
          )
          .get(expiryDraft().resultSetKey),
      },
      {
        sessionDigest: "session-unrelated",
        logicalId: "logical-unrelated",
        outcome: "validation",
      },
    );
    assert.deepEqual(context.raw.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    context.raw.close();
  }
});

test("cross-K handle digest collision rolls back the expiry owner proposal", async () => {
  const context = await createContext();
  try {
    await context.repository.issueRoot(rootRecord);
    context.clock.value = 210;
    await context.repository.createExpiryHandle(
      rootRecord.capabilityDigest,
      expiryDraft(),
    );

    const secondRoot = {
      ...rootRecord,
      lineageKey: "lineage-second",
      nodeKey: "node-second",
      capabilityDigest: "capability-second",
      sessionDigest: "session-second",
      logicalId: "logical-second",
    };
    await context.repository.issueRoot(secondRoot);
    context.clock.value = 220;
    await assert.rejects(
      context.repository.createExpiryHandle(
        secondRoot.capabilityDigest,
        expiryDraft({
          handleDigest: "handle-expired-a",
          resultSetKey: "result-set-second-collision",
          sessionDigest: secondRoot.sessionDigest,
          logicalId: secondRoot.logicalId,
        }),
      ),
      /UNIQUE constraint failed/u,
    );
    assert.equal(
      context.raw
        .prepare(
          "SELECT count(*) AS count FROM acquisition_result_sets WHERE result_set_key='result-set-second-collision'",
        )
        .get().count,
      0,
    );
  } finally {
    context.raw.close();
  }
});

test("one cleanup call removes a complete expired causal ledger", async () => {
  const context = await createContext();
  try {
    await context.repository.issueRoot(rootRecord);
    await context.repository.reserveSelection(parentSelection());
    const { observation: dispatchObservationRecord } = await prepareDispatch(
      context,
    );
    assert.equal(
      await context.repository.finalizeTransition(uncertaintyFinalization()),
      "applied",
    );
    await context.repository.reserveSelection(
      parentSelection({
        selectionKey: "selection-cleanup-reconcile",
        nodeKey: "node-unknown",
        generation: 1,
        expectedRevision: 0,
        updatedAt: 170,
      }),
    );
    const reconcile = dispatchOperation({
      operationKey: "operation-cleanup-reconcile",
      sourceNodeKey: "node-unknown",
      generation: 1,
      authorizationObservationKey: dispatchObservationRecord.observationKey,
      operationKind: "reconcile",
      reservedAt: 180,
    });
    assert.equal(
      (await context.repository.reserveOrLoadDispatchOperation(reconcile)).kind,
      "applied",
    );
    await context.repository.appendOrLoadDispatchObservation(
      dispatchObservation({
        observationKey: "observation-cleanup-reconcile",
        operationKey: reconcile.operationKey,
        observationDigest: "observation-digest-cleanup-reconcile",
        observedAt: 190,
        checkedAt: 190,
      }),
    );

    assert.deepEqual(acquisitionTableCounts(context.raw), {
      acquisition_lineages: 1,
      acquisition_logical_ids: 1,
      acquisition_nodes: 2,
      acquisition_capabilities: 2,
      acquisition_result_sets: 1,
      acquisition_result_handles: 2,
      acquisition_result_authorizations: 2,
      acquisition_dispatches: 1,
      acquisition_dispatch_operations: 2,
      acquisition_dispatch_observations: 2,
    });
    assert.equal(
      context.raw
        .prepare(
          `SELECT count(*) AS count
           FROM acquisition_dispatch_operations later
           JOIN acquisition_dispatch_observations earlier
             ON earlier.observation_key = later.authorization_observation_key
           WHERE later.operation_key = ?`,
        )
        .get(reconcile.operationKey).count,
      1,
    );

    context.clock.value = 401;
    const report = await context.repository.cleanupExpiredState();
    assert.deepEqual(report, {
      resultAuthorizations: 2,
      uncertaintyHandles: 1,
      resultHandles: 1,
      capabilities: 2,
      observations: 2,
      operations: 2,
      dispatches: 1,
      lineages: 1,
      resultSets: 1,
    });
    const emptyTables = Object.fromEntries(
      acquisitionTables.map((table) => [table, 0]),
    );
    assert.deepEqual(acquisitionTableCounts(context.raw), emptyTables);
    assert.deepEqual(await context.repository.cleanupExpiredState(), {
      resultAuthorizations: 0,
      uncertaintyHandles: 0,
      resultHandles: 0,
      capabilities: 0,
      observations: 0,
      operations: 0,
      dispatches: 0,
      lineages: 0,
      resultSets: 0,
    });
    assert.deepEqual(acquisitionTableCounts(context.raw), emptyTables);
    assert.deepEqual(context.raw.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    context.raw.close();
  }
});

test("cleanup retains a due authorization proof for one later live operation", async () => {
  const context = await createContext();
  try {
    await context.repository.issueRoot({
      ...rootRecord,
      proofCleanupAfter: 220,
      cleanupAfter: 300,
    });
    await context.repository.reserveSelection(parentSelection());
    await context.repository.reserveOrLoadDispatchIdentityForCreation(
      { ...dispatchIdentity(), cleanupAfter: 300 },
    );

    const earlyOperation = dispatchOperation({ cleanupAfter: 240 });
    assert.equal(
      (
        await context.repository.reserveOrLoadDispatchOperation(earlyOperation)
      ).kind,
      "applied",
    );
    const earlyObservation = dispatchObservation({
      observationKey: "observation-not-recorded-root",
      observationDigest: "observation-digest-not-recorded-root",
      outcome: "not_recorded",
      evidenceDigest: "destination-negative-root",
      acknowledgedAt: 135,
      cleanupAfter: 240,
    });
    assert.equal(
      (
        await context.repository.appendOrLoadDispatchObservation(
          earlyObservation,
        )
      ).kind,
      "applied",
    );

    const backendFailure = backendFailureFinalization();
    backendFailure.next.expiresAt = 200;
    backendFailure.next.cleanupAfter = 300;
    backendFailure.next.capabilityValidUntil = 210;
    backendFailure.next.capabilityProofCleanupAfter = 220;
    backendFailure.resultHandles[0].expiresAt = 200;
    backendFailure.resultHandles[0].cleanupAfter = 240;
    assert.equal(
      await context.repository.finalizeTransition(backendFailure),
      "applied",
    );

    await context.repository.reserveSelection(
      parentSelection({
        selectionKey: "selection-retained-dependent",
        nodeKey: "node-backend-failure",
        generation: 1,
        expectedRevision: 0,
        updatedAt: 170,
      }),
    );
    const laterOperation = dispatchOperation({
      operationKey: "operation-retained-dependent",
      sourceNodeKey: "node-backend-failure",
      generation: 1,
      authorizationObservationKey: earlyObservation.observationKey,
      reservedAt: 180,
      cleanupAfter: 300,
    });
    assert.equal(
      (
        await context.repository.reserveOrLoadDispatchOperation(laterOperation)
      ).kind,
      "applied",
    );
    const laterObservation = dispatchObservation({
      observationKey: "observation-retained-dependent",
      operationKey: laterOperation.operationKey,
      observationDigest: "observation-digest-retained-dependent",
      observedAt: 190,
      cleanupAfter: 300,
      checkedAt: 190,
    });
    assert.equal(
      (
        await context.repository.appendOrLoadDispatchObservation(
          laterObservation,
        )
      ).kind,
      "applied",
    );

    context.clock.value = 250;
    assert.deepEqual(await context.repository.cleanupExpiredState(), {
      resultAuthorizations: 1,
      uncertaintyHandles: 0,
      resultHandles: 1,
      capabilities: 2,
      observations: 0,
      operations: 0,
      dispatches: 0,
      lineages: 0,
      resultSets: 0,
    });
    assert.deepEqual(acquisitionTableCounts(context.raw), {
      acquisition_lineages: 1,
      acquisition_logical_ids: 1,
      acquisition_nodes: 2,
      acquisition_capabilities: 0,
      acquisition_result_sets: 1,
      acquisition_result_handles: 0,
      acquisition_result_authorizations: 0,
      acquisition_dispatches: 1,
      acquisition_dispatch_operations: 2,
      acquisition_dispatch_observations: 2,
    });
    assert.deepEqual(
      context.raw
        .prepare(
          `SELECT operation.operation_key AS operationKey,
                  operation.authorization_observation_key AS authorizationObservationKey,
                  operation.cleanup_after AS operationCleanupAfter,
                  observation.cleanup_after AS observationCleanupAfter
           FROM acquisition_dispatch_operations operation
           LEFT JOIN acquisition_dispatch_observations observation
             ON observation.operation_key = operation.operation_key
           ORDER BY operation.reserved_at`,
        )
        .all()
        .map((row) => ({ ...row })),
      [
        {
          operationKey: earlyOperation.operationKey,
          authorizationObservationKey: null,
          operationCleanupAfter: 240,
          observationCleanupAfter: 240,
        },
        {
          operationKey: laterOperation.operationKey,
          authorizationObservationKey: earlyObservation.observationKey,
          operationCleanupAfter: 300,
          observationCleanupAfter: 300,
        },
      ],
    );
    assert.deepEqual(context.raw.prepare("PRAGMA foreign_key_check").all(), []);

    context.clock.value = 301;
    assert.deepEqual(await context.repository.cleanupExpiredState(), {
      resultAuthorizations: 0,
      uncertaintyHandles: 0,
      resultHandles: 0,
      capabilities: 0,
      observations: 2,
      operations: 2,
      dispatches: 1,
      lineages: 1,
      resultSets: 1,
    });
    assert.deepEqual(
      acquisitionTableCounts(context.raw),
      Object.fromEntries(acquisitionTables.map((table) => [table, 0])),
    );
    assert.deepEqual(context.raw.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    context.raw.close();
  }
});

test("cleanup transitively retains a three-operation authorization chain", async () => {
  const context = await createContext();
  try {
    await context.repository.issueRoot({
      ...rootRecord,
      proofCleanupAfter: 220,
      cleanupAfter: 300,
    });
    await context.repository.reserveSelection(parentSelection());
    await context.repository.reserveOrLoadDispatchIdentityForCreation(
      { ...dispatchIdentity(), cleanupAfter: 300 },
    );

    const firstOperation = dispatchOperation({ cleanupAfter: 240 });
    await context.repository.reserveOrLoadDispatchOperation(firstOperation);
    const firstObservation = dispatchObservation({ cleanupAfter: 240 });
    await context.repository.appendOrLoadDispatchObservation(firstObservation);

    const uncertainty = uncertaintyFinalization();
    uncertainty.next.expiresAt = 200;
    uncertainty.next.cleanupAfter = 300;
    uncertainty.next.capabilityValidUntil = 210;
    uncertainty.next.capabilityProofCleanupAfter = 220;
    for (const handle of uncertainty.resultHandles) {
      handle.expiresAt = handle.publicState === "unknown" ? 200 : 210;
      handle.cleanupAfter = 240;
    }
    assert.equal(
      await context.repository.finalizeTransition(uncertainty),
      "applied",
    );

    await context.repository.reserveSelection(
      parentSelection({
        selectionKey: "selection-transitive-retry",
        nodeKey: "node-unknown",
        generation: 1,
        expectedRevision: 0,
        updatedAt: 170,
      }),
    );
    const secondOperation = dispatchOperation({
      operationKey: "operation-transitive-reconcile",
      sourceNodeKey: "node-unknown",
      generation: 1,
      authorizationObservationKey: firstObservation.observationKey,
      operationKind: "reconcile",
      reservedAt: 180,
      cleanupAfter: 260,
    });
    await context.repository.reserveOrLoadDispatchOperation(secondOperation);
    const secondObservation = dispatchObservation({
      observationKey: "observation-transitive-not-recorded",
      operationKey: secondOperation.operationKey,
      observationDigest: "observation-digest-transitive-not-recorded",
      outcome: "not_recorded",
      evidenceDigest: "destination-negative-reconcile",
      acknowledgedAt: 185,
      observedAt: 190,
      cleanupAfter: 260,
      checkedAt: 190,
    });
    await context.repository.appendOrLoadDispatchObservation(secondObservation);

    const thirdOperation = dispatchOperation({
      operationKey: "operation-transitive-redispatch",
      sourceNodeKey: "node-unknown",
      generation: 1,
      authorizationObservationKey: secondObservation.observationKey,
      reservedAt: 195,
      cleanupAfter: 300,
    });
    await context.repository.reserveOrLoadDispatchOperation(thirdOperation);

    context.clock.value = 270;
    assert.deepEqual(await context.repository.cleanupExpiredState(), {
      resultAuthorizations: 2,
      uncertaintyHandles: 1,
      resultHandles: 1,
      capabilities: 2,
      observations: 0,
      operations: 0,
      dispatches: 0,
      lineages: 0,
      resultSets: 0,
    });
    assert.deepEqual(
      context.raw
        .prepare(
          `SELECT dependent.operation_key AS dependentOperationKey,
                  proof.operation_key AS authorizerOperationKey,
                  dependent.authorization_observation_key AS authorizationObservationKey
           FROM acquisition_dispatch_operations dependent
           JOIN acquisition_dispatch_observations proof
             ON proof.observation_key = dependent.authorization_observation_key
           ORDER BY dependent.reserved_at`,
        )
        .all()
        .map((row) => ({ ...row })),
      [
        {
          dependentOperationKey: secondOperation.operationKey,
          authorizerOperationKey: firstOperation.operationKey,
          authorizationObservationKey: firstObservation.observationKey,
        },
        {
          dependentOperationKey: thirdOperation.operationKey,
          authorizerOperationKey: secondOperation.operationKey,
          authorizationObservationKey: secondObservation.observationKey,
        },
      ],
    );
    assert.deepEqual(acquisitionTableCounts(context.raw), {
      acquisition_lineages: 1,
      acquisition_logical_ids: 1,
      acquisition_nodes: 2,
      acquisition_capabilities: 0,
      acquisition_result_sets: 1,
      acquisition_result_handles: 0,
      acquisition_result_authorizations: 0,
      acquisition_dispatches: 1,
      acquisition_dispatch_operations: 3,
      acquisition_dispatch_observations: 2,
    });
    assert.deepEqual(context.raw.prepare("PRAGMA foreign_key_check").all(), []);

    context.clock.value = 301;
    assert.deepEqual(await context.repository.cleanupExpiredState(), {
      resultAuthorizations: 0,
      uncertaintyHandles: 0,
      resultHandles: 0,
      capabilities: 0,
      observations: 2,
      operations: 3,
      dispatches: 1,
      lineages: 1,
      resultSets: 1,
    });
    assert.deepEqual(
      acquisitionTableCounts(context.raw),
      Object.fromEntries(acquisitionTables.map((table) => [table, 0])),
    );
    assert.deepEqual(context.raw.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    context.raw.close();
  }
});

test("rejects lifecycle windows that clean proof before replay promises", () => {
  const valid = {
    lineageExpiresAt: 200,
    lineageCleanupAfter: 400,
    nodeExpiresAt: 180,
    nodeCleanupAfter: 350,
    capabilityValidUntil: 200,
    capabilityProofCleanupAfter: 300,
    handleExpiresAt: 190,
    handleCleanupAfter: 350,
  };
  assert.doesNotThrow(() => validateAuthorizedLineageLifetime(valid));
  assert.throws(
    () =>
      validateAuthorizedLineageLifetime({
        ...valid,
        capabilityProofCleanupAfter: 360,
      }),
    /inconsistent/,
  );
});
