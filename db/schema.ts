import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const acquisitionIntents = ["poc", "sales", "demo", "partner"] as const;

export const acquisitionResultSets = sqliteTable(
  "acquisition_result_sets",
  {
    resultSetKey: text("result_set_key").primaryKey(),
    sessionDigest: text("session_digest").notNull(),
    intent: text("intent", { enum: acquisitionIntents }).notNull(),
    canonicalRoute: text("canonical_route").notNull(),
    postAction: text("post_action").notNull(),
    logicalId: text("logical_id").notNull(),
    generation: integer("generation").notNull(),
    outcome: text("outcome", {
      enum: [
        "validation",
        "backend_failure",
        "unknown",
        "possible_duplicate",
        "receipt",
        "expired",
      ],
    }).notNull(),
    createdAt: integer("created_at").notNull(),
    cleanupAfter: integer("cleanup_after").notNull(),
  },
  (table) => [
    uniqueIndex("uq_acquisition_result_sets_full_binding").on(
      table.resultSetKey,
      table.sessionDigest,
      table.intent,
      table.canonicalRoute,
      table.postAction,
      table.logicalId,
      table.generation,
    ),
    uniqueIndex("uq_acquisition_result_sets_expired_binding")
      .on(
        table.sessionDigest,
        table.intent,
        table.canonicalRoute,
        table.postAction,
        table.logicalId,
        table.generation,
        table.outcome,
      )
      .where(sql`${table.outcome} = 'expired'`),
    index("idx_acquisition_result_sets_cleanup_after").on(table.cleanupAfter),
    check(
      "ck_acquisition_result_sets_route_action",
      sql`(${table.intent} = 'poc' AND ${table.canonicalRoute} = '/request-poc/' AND ${table.postAction} = '/request-poc/') OR (${table.intent} = 'sales' AND ${table.canonicalRoute} = '/contact-sales/' AND ${table.postAction} = '/contact-sales/') OR (${table.intent} = 'demo' AND ${table.canonicalRoute} = '/request-demo/' AND ${table.postAction} = '/request-demo/') OR (${table.intent} = 'partner' AND ${table.canonicalRoute} = '/partners/apply/' AND ${table.postAction} = '/partners/apply/')`,
    ),
    check(
      "ck_acquisition_result_sets_shape",
      sql`length(${table.resultSetKey}) > 0 AND ${table.generation} >= 0 AND ${table.outcome} IN ('validation', 'backend_failure', 'unknown', 'possible_duplicate', 'receipt', 'expired')`,
    ),
    check(
      "ck_acquisition_result_sets_lifecycle",
      sql`${table.createdAt} <= ${table.cleanupAfter}`,
    ),
  ],
);

export const acquisitionLineages = sqliteTable(
  "acquisition_lineages",
  {
    lineageKey: text("lineage_key").primaryKey(),
    sessionDigest: text("session_digest").notNull(),
    intent: text("intent", { enum: acquisitionIntents }).notNull(),
    canonicalRoute: text("canonical_route").notNull(),
    postAction: text("post_action").notNull(),
    rootLogicalId: text("root_logical_id").notNull(),
    revision: integer("revision").notNull().default(0),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
    cleanupAfter: integer("cleanup_after").notNull(),
  },
  (table) => [
    uniqueIndex("uq_acquisition_lineages_root_logical_id").on(
      table.rootLogicalId,
    ),
    uniqueIndex("uq_acquisition_lineages_binding").on(
      table.lineageKey,
      table.sessionDigest,
      table.intent,
      table.canonicalRoute,
      table.postAction,
    ),
    uniqueIndex("uq_acquisition_lineages_intent_binding").on(
      table.lineageKey,
      table.intent,
    ),
    index("idx_acquisition_lineages_cleanup_after").on(table.cleanupAfter),
    check("ck_acquisition_lineages_revision", sql`${table.revision} >= 0`),
    check(
      "ck_acquisition_lineages_intent",
      sql`${table.intent} IN ('poc', 'sales', 'demo', 'partner')`,
    ),
    check(
      "ck_acquisition_lineages_route_action",
      sql`(${table.intent} = 'poc' AND ${table.canonicalRoute} = '/request-poc/' AND ${table.postAction} = '/request-poc/') OR (${table.intent} = 'sales' AND ${table.canonicalRoute} = '/contact-sales/' AND ${table.postAction} = '/contact-sales/') OR (${table.intent} = 'demo' AND ${table.canonicalRoute} = '/request-demo/' AND ${table.postAction} = '/request-demo/') OR (${table.intent} = 'partner' AND ${table.canonicalRoute} = '/partners/apply/' AND ${table.postAction} = '/partners/apply/')`,
    ),
    check(
      "ck_acquisition_lineages_lifecycle",
      sql`${table.createdAt} <= ${table.expiresAt} AND ${table.expiresAt} <= ${table.cleanupAfter}`,
    ),
  ],
);

export const acquisitionLogicalIds = sqliteTable(
  "acquisition_logical_ids",
  {
    logicalId: text("logical_id").primaryKey(),
    lineageKey: text("lineage_key")
      .notNull()
      .references(() => acquisitionLineages.lineageKey, { onDelete: "cascade" }),
    parentLogicalId: text("parent_logical_id"),
    createdAt: integer("created_at").notNull(),
    cleanupAfter: integer("cleanup_after").notNull(),
  },
  (table) => [
    index("idx_acquisition_logical_ids_lineage").on(table.lineageKey),
    uniqueIndex("uq_acquisition_logical_ids_lineage_binding").on(
      table.logicalId,
      table.lineageKey,
    ),
    index("idx_acquisition_logical_ids_cleanup_after").on(table.cleanupAfter),
    foreignKey({
      columns: [table.parentLogicalId, table.lineageKey],
      foreignColumns: [table.logicalId, table.lineageKey],
      name: "fk_acquisition_logical_ids_parent",
    }),
    check(
      "ck_acquisition_logical_ids_lifecycle",
      sql`${table.createdAt} <= ${table.cleanupAfter}`,
    ),
  ],
);

export const acquisitionNodes = sqliteTable(
  "acquisition_nodes",
  {
    nodeKey: text("node_key").primaryKey(),
    lineageKey: text("lineage_key")
      .notNull()
      .references(() => acquisitionLineages.lineageKey, { onDelete: "cascade" }),
    parentNodeKey: text("parent_node_key"),
    logicalId: text("logical_id")
      .notNull()
      .references(() => acquisitionLogicalIds.logicalId, { onDelete: "cascade" }),
    generation: integer("generation").notNull(),
    sourceKind: text("source_kind", {
      enum: [
        "initial",
        "validation",
        "backend_failure",
        "unknown",
        "possible_duplicate",
      ],
    })
      .notNull()
      .default("initial"),
    outcome: text("outcome", {
      enum: [
        "fresh",
        "validation_failed",
        "ready",
        "recorded",
        "not_recorded",
        "indeterminate",
      ],
    })
      .notNull()
      .default("fresh"),
    boundPayloadFingerprint: text("bound_payload_fingerprint"),
    selectedCandidateFingerprint: text("selected_candidate_fingerprint"),
    selectedPayloadSnapshotRef: text("selected_payload_snapshot_ref"),
    selectedLogicalId: text("selected_logical_id"),
    selectedNodeKey: text("selected_node_key"),
    resultSetKey: text("result_set_key").references(
      () => acquisitionResultSets.resultSetKey,
    ),
    selectionKey: text("selection_key"),
    finalizationKey: text("finalization_key"),
    selectionKind: text("selection_kind", {
      enum: ["parent", "child"],
    }),
    revision: integer("revision").notNull().default(0),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
    cleanupAfter: integer("cleanup_after").notNull(),
  },
  (table) => [
    uniqueIndex("uq_acquisition_nodes_lineage_generation").on(
      table.lineageKey,
      table.generation,
    ),
    uniqueIndex("uq_acquisition_nodes_full_binding").on(
      table.nodeKey,
      table.lineageKey,
      table.logicalId,
      table.generation,
    ),
    uniqueIndex("uq_acquisition_nodes_lineage_binding").on(
      table.nodeKey,
      table.lineageKey,
      table.generation,
    ),
    uniqueIndex("uq_acquisition_nodes_parent_binding").on(
      table.nodeKey,
      table.lineageKey,
    ),
    uniqueIndex("uq_acquisition_nodes_finalization_key").on(
      table.finalizationKey,
    ),
    uniqueIndex("uq_acquisition_nodes_selection_key").on(table.selectionKey),
    uniqueIndex("uq_acquisition_nodes_result_set_key").on(table.resultSetKey),
    index("idx_acquisition_nodes_lineage_parent").on(
      table.lineageKey,
      table.parentNodeKey,
    ),
    index("idx_acquisition_nodes_outcome_updated").on(
      table.outcome,
      table.updatedAt,
    ),
    index("idx_acquisition_nodes_cleanup_after").on(table.cleanupAfter),
    foreignKey({
      columns: [table.parentNodeKey, table.lineageKey],
      foreignColumns: [table.nodeKey, table.lineageKey],
      name: "fk_acquisition_nodes_parent",
    }),
    foreignKey({
      columns: [table.logicalId, table.lineageKey],
      foreignColumns: [acquisitionLogicalIds.logicalId, acquisitionLogicalIds.lineageKey],
      name: "fk_acquisition_nodes_logical_binding",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.selectedLogicalId, table.lineageKey],
      foreignColumns: [acquisitionLogicalIds.logicalId, acquisitionLogicalIds.lineageKey],
      name: "fk_acquisition_nodes_selected_logical_id",
    }),
    foreignKey({
      columns: [table.selectedNodeKey, table.lineageKey],
      foreignColumns: [table.nodeKey, table.lineageKey],
      name: "fk_acquisition_nodes_selected_node",
    }),
    check("ck_acquisition_nodes_generation", sql`${table.generation} >= 0`),
    check("ck_acquisition_nodes_revision", sql`${table.revision} >= 0`),
    check(
      "ck_acquisition_nodes_selection_key",
      sql`${table.selectionKey} IS NULL OR length(${table.selectionKey}) > 0`,
    ),
    check(
      "ck_acquisition_nodes_finalization_key",
      sql`${table.finalizationKey} IS NULL OR length(${table.finalizationKey}) > 0`,
    ),
    check(
      "ck_acquisition_nodes_source_kind",
      sql`${table.sourceKind} IN ('initial', 'validation', 'backend_failure', 'unknown', 'possible_duplicate')`,
    ),
    check(
      "ck_acquisition_nodes_source_binding",
      sql`((${table.sourceKind} IN ('initial', 'validation')) AND ${table.boundPayloadFingerprint} IS NULL) OR ((${table.sourceKind} IN ('backend_failure', 'unknown', 'possible_duplicate')) AND ${table.boundPayloadFingerprint} IS NOT NULL AND length(${table.boundPayloadFingerprint}) > 0)`,
    ),
    check(
      "ck_acquisition_nodes_outcome",
      sql`${table.outcome} IN ('fresh', 'validation_failed', 'ready', 'recorded', 'not_recorded', 'indeterminate')`,
    ),
    check(
      "ck_acquisition_nodes_selection_kind",
      sql`${table.selectionKind} IS NULL OR ${table.selectionKind} IN ('parent', 'child')`,
    ),
    check(
      "ck_acquisition_nodes_selection_shape",
      sql`(${table.selectionKind} IS NULL AND ${table.selectedCandidateFingerprint} IS NULL AND ${table.selectedPayloadSnapshotRef} IS NULL AND ${table.selectedLogicalId} IS NULL) OR (${table.selectionKind} IS NOT NULL AND ${table.selectedCandidateFingerprint} IS NOT NULL AND length(${table.selectedCandidateFingerprint}) > 0 AND ${table.selectedPayloadSnapshotRef} IS NOT NULL AND length(${table.selectedPayloadSnapshotRef}) > 0 AND ${table.selectedLogicalId} IS NOT NULL AND ((${table.selectionKind} = 'parent' AND ${table.selectedLogicalId} = ${table.logicalId}) OR (${table.selectionKind} = 'child' AND ${table.selectedLogicalId} <> ${table.logicalId})))`,
    ),
    check(
      "ck_acquisition_nodes_selection_phase",
      sql`(${table.outcome} = 'fresh' AND ${table.selectionKind} IS NULL) OR (${table.outcome} <> 'fresh' AND ${table.selectionKind} IS NOT NULL)`,
    ),
    check(
      "ck_acquisition_nodes_result_set",
      sql`(${table.outcome} IN ('fresh', 'ready') AND ${table.resultSetKey} IS NULL) OR (${table.outcome} IN ('validation_failed', 'recorded', 'not_recorded', 'indeterminate') AND ${table.resultSetKey} IS NOT NULL AND length(${table.resultSetKey}) > 0)`,
    ),
    check(
      "ck_acquisition_nodes_lifecycle",
      sql`${table.createdAt} <= ${table.updatedAt} AND ${table.updatedAt} <= ${table.cleanupAfter} AND ${table.expiresAt} <= ${table.cleanupAfter}`,
    ),
  ],
);

export const acquisitionCapabilities = sqliteTable(
  "acquisition_capabilities",
  {
    capabilityDigest: text("capability_digest").primaryKey(),
    lineageKey: text("lineage_key")
      .notNull()
      .references(() => acquisitionLineages.lineageKey, { onDelete: "cascade" }),
    nodeKey: text("node_key")
      .notNull()
      .references(() => acquisitionNodes.nodeKey, { onDelete: "cascade" }),
    sessionDigest: text("session_digest").notNull(),
    intent: text("intent", { enum: acquisitionIntents }).notNull(),
    canonicalRoute: text("canonical_route").notNull(),
    postAction: text("post_action").notNull(),
    logicalId: text("logical_id").notNull(),
    generation: integer("generation").notNull(),
    sourceKind: text("source_kind", {
      enum: [
        "initial",
        "validation",
        "backend_failure",
        "unknown",
        "possible_duplicate",
      ],
    }).notNull(),
    issuedAt: integer("issued_at").notNull(),
    sourceExpiresAt: integer("source_expires_at").notNull(),
    validUntil: integer("valid_until").notNull(),
    proofCleanupAfter: integer("proof_cleanup_after").notNull(),
    sourceCleanupAfter: integer("source_cleanup_after").notNull(),
    revokedAt: integer("revoked_at"),
    attestationVersion: integer("attestation_version").notNull(),
    attestationKeyId: text("attestation_key_id").notNull(),
    authorizationAttestation: text("authorization_attestation").notNull(),
  },
  (table) => [
    index("idx_acquisition_capabilities_binding").on(
      table.sessionDigest,
      table.intent,
      table.canonicalRoute,
      table.postAction,
      table.logicalId,
      table.generation,
    ),
    index("idx_acquisition_capabilities_cleanup_after").on(
      table.proofCleanupAfter,
    ),
    foreignKey({
      columns: [
        table.nodeKey,
        table.lineageKey,
        table.logicalId,
        table.generation,
      ],
      foreignColumns: [
        acquisitionNodes.nodeKey,
        acquisitionNodes.lineageKey,
        acquisitionNodes.logicalId,
        acquisitionNodes.generation,
      ],
      name: "fk_acquisition_capabilities_node_binding",
    }).onDelete("cascade"),
    foreignKey({
      columns: [
        table.lineageKey,
        table.sessionDigest,
        table.intent,
        table.canonicalRoute,
        table.postAction,
      ],
      foreignColumns: [
        acquisitionLineages.lineageKey,
        acquisitionLineages.sessionDigest,
        acquisitionLineages.intent,
        acquisitionLineages.canonicalRoute,
        acquisitionLineages.postAction,
      ],
      name: "fk_acquisition_capabilities_lineage_binding",
    }).onDelete("cascade"),
    check(
      "ck_acquisition_capabilities_generation",
      sql`${table.generation} >= 0`,
    ),
    check(
      "ck_acquisition_capabilities_intent",
      sql`${table.intent} IN ('poc', 'sales', 'demo', 'partner')`,
    ),
    check(
      "ck_acquisition_capabilities_route_action",
      sql`(${table.intent} = 'poc' AND ${table.canonicalRoute} = '/request-poc/' AND ${table.postAction} = '/request-poc/') OR (${table.intent} = 'sales' AND ${table.canonicalRoute} = '/contact-sales/' AND ${table.postAction} = '/contact-sales/') OR (${table.intent} = 'demo' AND ${table.canonicalRoute} = '/request-demo/' AND ${table.postAction} = '/request-demo/') OR (${table.intent} = 'partner' AND ${table.canonicalRoute} = '/partners/apply/' AND ${table.postAction} = '/partners/apply/')`,
    ),
    check(
      "ck_acquisition_capabilities_lifecycle",
      sql`${table.issuedAt} <= ${table.sourceExpiresAt} AND ${table.sourceExpiresAt} <= ${table.validUntil} AND ${table.validUntil} <= ${table.proofCleanupAfter} AND ${table.proofCleanupAfter} <= ${table.sourceCleanupAfter}`,
    ),
    check(
      "ck_acquisition_capabilities_source_kind",
      sql`${table.sourceKind} IN ('initial', 'validation', 'backend_failure', 'unknown', 'possible_duplicate')`,
    ),
    check(
      "ck_acquisition_capabilities_attestation",
      sql`${table.attestationVersion} = 1 AND length(${table.attestationKeyId}) > 0 AND length(${table.authorizationAttestation}) > 0`,
    ),
  ],
);

export const acquisitionResultHandles = sqliteTable(
  "acquisition_result_handles",
  {
    handleDigest: text("handle_digest").primaryKey(),
    lineageKey: text("lineage_key").references(
      () => acquisitionLineages.lineageKey,
      { onDelete: "cascade" },
    ),
    nodeKey: text("node_key").references(() => acquisitionNodes.nodeKey, {
      onDelete: "cascade",
    }),
    sessionDigest: text("session_digest").notNull(),
    intent: text("intent", { enum: acquisitionIntents }).notNull(),
    canonicalRoute: text("canonical_route").notNull(),
    postAction: text("post_action").notNull(),
    logicalId: text("logical_id").notNull(),
    generation: integer("generation").notNull(),
    representation: text("representation", {
      enum: ["returned_form", "reduced"],
    }).notNull(),
    publicState: text("public_state", {
      enum: [
        "validation",
        "backend_failure",
        "return_form",
        "unknown",
        "possible_duplicate",
        "expired",
        "receipt",
      ],
    }).notNull(),
    returnHandleDigest: text("return_handle_digest"),
    payloadFingerprint: text("payload_fingerprint"),
    resultSetKey: text("result_set_key").notNull(),
    issuedAt: integer("issued_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
    cleanupAfter: integer("cleanup_after").notNull(),
  },
  (table) => [
    index("idx_acquisition_handles_node").on(table.nodeKey),
    index("idx_acquisition_handles_cleanup_after").on(table.cleanupAfter),
    uniqueIndex("uq_acquisition_handles_full_binding").on(
      table.handleDigest,
      table.lineageKey,
      table.nodeKey,
      table.logicalId,
      table.generation,
    ),
    uniqueIndex("uq_acquisition_handles_expired_binding")
      .on(
        table.sessionDigest,
        table.intent,
        table.canonicalRoute,
        table.postAction,
        table.logicalId,
        table.generation,
        table.publicState,
      )
      .where(sql`${table.publicState} = 'expired'`),
    foreignKey({
      columns: [
        table.nodeKey,
        table.lineageKey,
        table.logicalId,
        table.generation,
      ],
      foreignColumns: [
        acquisitionNodes.nodeKey,
        acquisitionNodes.lineageKey,
        acquisitionNodes.logicalId,
        acquisitionNodes.generation,
      ],
      name: "fk_acquisition_handles_node_binding",
    }).onDelete("cascade"),
    foreignKey({
      columns: [
        table.lineageKey,
        table.sessionDigest,
        table.intent,
        table.canonicalRoute,
        table.postAction,
      ],
      foreignColumns: [
        acquisitionLineages.lineageKey,
        acquisitionLineages.sessionDigest,
        acquisitionLineages.intent,
        acquisitionLineages.canonicalRoute,
        acquisitionLineages.postAction,
      ],
      name: "fk_acquisition_handles_lineage_binding",
    }).onDelete("cascade"),
    foreignKey({
      columns: [
        table.resultSetKey,
        table.sessionDigest,
        table.intent,
        table.canonicalRoute,
        table.postAction,
        table.logicalId,
        table.generation,
      ],
      foreignColumns: [
        acquisitionResultSets.resultSetKey,
        acquisitionResultSets.sessionDigest,
        acquisitionResultSets.intent,
        acquisitionResultSets.canonicalRoute,
        acquisitionResultSets.postAction,
        acquisitionResultSets.logicalId,
        acquisitionResultSets.generation,
      ],
      name: "fk_acquisition_handles_result_set_binding",
    }),
    check("ck_acquisition_handles_generation", sql`${table.generation} >= 0`),
    check(
      "ck_acquisition_handles_intent",
      sql`${table.intent} IN ('poc', 'sales', 'demo', 'partner')`,
    ),
    check(
      "ck_acquisition_handles_route_action",
      sql`(${table.intent} = 'poc' AND ${table.canonicalRoute} = '/request-poc/' AND ${table.postAction} = '/request-poc/') OR (${table.intent} = 'sales' AND ${table.canonicalRoute} = '/contact-sales/' AND ${table.postAction} = '/contact-sales/') OR (${table.intent} = 'demo' AND ${table.canonicalRoute} = '/request-demo/' AND ${table.postAction} = '/request-demo/') OR (${table.intent} = 'partner' AND ${table.canonicalRoute} = '/partners/apply/' AND ${table.postAction} = '/partners/apply/')`,
    ),
    check(
      "ck_acquisition_handles_representation",
      sql`${table.representation} IN ('returned_form', 'reduced')`,
    ),
    check(
      "ck_acquisition_handles_representation_state",
      sql`(${table.representation} = 'returned_form' AND ${table.publicState} IN ('validation', 'backend_failure', 'return_form')) OR (${table.representation} = 'reduced' AND ${table.publicState} IN ('unknown', 'possible_duplicate', 'expired', 'receipt'))`,
    ),
    check(
      "ck_acquisition_handles_public_state",
      sql`${table.publicState} IN ('validation', 'backend_failure', 'return_form', 'unknown', 'possible_duplicate', 'expired', 'receipt')`,
    ),
    foreignKey({
      columns: [
        table.returnHandleDigest,
        table.lineageKey,
        table.nodeKey,
        table.logicalId,
        table.generation,
      ],
      foreignColumns: [
        table.handleDigest,
        table.lineageKey,
        table.nodeKey,
        table.logicalId,
        table.generation,
      ],
      name: "fk_acquisition_handles_return_handle",
    }),
    check(
      "ck_acquisition_handles_uncertainty_return",
      sql`(${table.publicState} IN ('unknown', 'possible_duplicate') AND ${table.returnHandleDigest} IS NOT NULL) OR (${table.publicState} NOT IN ('unknown', 'possible_duplicate') AND ${table.returnHandleDigest} IS NULL)`,
    ),
    check(
      "ck_acquisition_handles_lifecycle",
      sql`${table.issuedAt} <= ${table.expiresAt} AND ${table.expiresAt} <= ${table.cleanupAfter}`,
    ),
    check(
      "ck_acquisition_handles_expiry_only",
      sql`${table.publicState} <> 'expired' OR (${table.lineageKey} IS NULL AND ${table.nodeKey} IS NULL AND ${table.payloadFingerprint} IS NULL)`,
    ),
    check(
      "ck_acquisition_handles_state_binding",
      sql`(${table.publicState} IN ('validation', 'backend_failure', 'return_form', 'unknown', 'possible_duplicate') AND ${table.lineageKey} IS NOT NULL AND ${table.nodeKey} IS NOT NULL AND ${table.payloadFingerprint} IS NOT NULL AND length(${table.payloadFingerprint}) > 0) OR (${table.publicState} = 'receipt' AND ${table.lineageKey} IS NOT NULL AND ${table.nodeKey} IS NOT NULL AND ${table.payloadFingerprint} IS NULL) OR (${table.publicState} = 'expired' AND ${table.lineageKey} IS NULL AND ${table.nodeKey} IS NULL AND ${table.payloadFingerprint} IS NULL)`,
    ),
    check("ck_acquisition_handles_result_set", sql`length(${table.resultSetKey}) > 0`),
  ],
);

export const acquisitionDispatches = sqliteTable(
  "acquisition_dispatches",
  {
    dispatchKey: text("dispatch_key").primaryKey(),
    lineageKey: text("lineage_key")
      .notNull()
      .references(() => acquisitionLineages.lineageKey, { onDelete: "cascade" }),
    originNodeKey: text("origin_node_key")
      .notNull()
      .references(() => acquisitionNodes.nodeKey),
    intent: text("intent", { enum: acquisitionIntents }).notNull(),
    logicalId: text("logical_id").notNull(),
    originGeneration: integer("origin_generation").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    destinationKey: text("destination_key").notNull(),
    createdAt: integer("created_at").notNull(),
    cleanupAfter: integer("cleanup_after").notNull(),
  },
  (table) => [
    uniqueIndex("uq_acquisition_dispatches_intent_logical_id").on(
      table.intent,
      table.logicalId,
    ),
    uniqueIndex("uq_acquisition_dispatches_idempotency_key").on(
      table.idempotencyKey,
    ),
    uniqueIndex("uq_acquisition_dispatches_identity_binding").on(
      table.dispatchKey,
      table.lineageKey,
      table.logicalId,
    ),
    foreignKey({
      columns: [table.logicalId, table.lineageKey],
      foreignColumns: [acquisitionLogicalIds.logicalId, acquisitionLogicalIds.lineageKey],
      name: "fk_acquisition_dispatches_logical_binding",
    }),
    foreignKey({
      columns: [table.originNodeKey, table.lineageKey, table.originGeneration],
      foreignColumns: [
        acquisitionNodes.nodeKey,
        acquisitionNodes.lineageKey,
        acquisitionNodes.generation,
      ],
      name: "fk_acquisition_dispatches_origin_binding",
    }),
    foreignKey({
      columns: [table.lineageKey, table.intent],
      foreignColumns: [acquisitionLineages.lineageKey, acquisitionLineages.intent],
      name: "fk_acquisition_dispatches_intent_binding",
    }),
    index("idx_acquisition_dispatches_cleanup_after").on(table.cleanupAfter),
    check("ck_acquisition_dispatches_generation", sql`${table.originGeneration} >= 0`),
    check(
      "ck_acquisition_dispatches_intent",
      sql`${table.intent} IN ('poc', 'sales', 'demo', 'partner')`,
    ),
    check(
      "ck_acquisition_dispatches_lifecycle",
      sql`${table.createdAt} <= ${table.cleanupAfter}`,
    ),
    check(
      "ck_acquisition_dispatches_idempotency",
      sql`${table.idempotencyKey} = ${table.logicalId}`,
    ),
  ],
);

export const acquisitionDispatchOperations = sqliteTable(
  "acquisition_dispatch_operations",
  {
    operationKey: text("operation_key").primaryKey(),
    dispatchKey: text("dispatch_key").notNull(),
    lineageKey: text("lineage_key").notNull(),
    logicalId: text("logical_id").notNull(),
    sourceNodeKey: text("source_node_key")
      .notNull()
      .references(() => acquisitionNodes.nodeKey),
    sourceGeneration: integer("source_generation").notNull(),
    candidateFingerprint: text("candidate_fingerprint").notNull(),
    payloadSnapshotRef: text("payload_snapshot_ref").notNull(),
    authorizationObservationKey: text("authorization_observation_key"),
    operationKind: text("operation_kind", {
      enum: ["dispatch", "reconcile"],
    }).notNull(),
    reservedAt: integer("reserved_at").notNull(),
    cleanupAfter: integer("cleanup_after").notNull(),
  },
  (table) => [
    uniqueIndex("uq_acquisition_dispatch_operations_source_kind").on(
      table.sourceNodeKey,
      table.operationKind,
    ),
    index("idx_acquisition_dispatch_operations_dispatch").on(
      table.dispatchKey,
      table.reservedAt,
    ),
    foreignKey({
      columns: [table.dispatchKey, table.lineageKey, table.logicalId],
      foreignColumns: [
        acquisitionDispatches.dispatchKey,
        acquisitionDispatches.lineageKey,
        acquisitionDispatches.logicalId,
      ],
      name: "fk_acquisition_dispatch_operations_identity",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.sourceNodeKey, table.lineageKey, table.sourceGeneration],
      foreignColumns: [
        acquisitionNodes.nodeKey,
        acquisitionNodes.lineageKey,
        acquisitionNodes.generation,
      ],
      name: "fk_acquisition_dispatch_operations_source_binding",
    }),
    foreignKey({
      columns: [table.logicalId, table.lineageKey],
      foreignColumns: [acquisitionLogicalIds.logicalId, acquisitionLogicalIds.lineageKey],
      name: "fk_acquisition_dispatch_operations_logical_binding",
    }),
    check(
      "ck_acquisition_dispatch_operations_kind",
      sql`${table.operationKind} IN ('dispatch', 'reconcile')`,
    ),
    check(
      "ck_acquisition_dispatch_operations_generation",
      sql`${table.sourceGeneration} >= 0`,
    ),
    check(
      "ck_acquisition_dispatch_operations_lifecycle",
      sql`${table.reservedAt} <= ${table.cleanupAfter}`,
    ),
    check(
      "ck_acquisition_dispatch_operations_binding",
      sql`length(${table.candidateFingerprint}) > 0 AND length(${table.payloadSnapshotRef}) > 0 AND (${table.authorizationObservationKey} IS NULL OR length(${table.authorizationObservationKey}) > 0)`,
    ),
  ],
);

export const acquisitionDispatchObservations = sqliteTable(
  "acquisition_dispatch_observations",
  {
    observationKey: text("observation_key").primaryKey(),
    operationKey: text("operation_key")
      .notNull()
      .references(() => acquisitionDispatchOperations.operationKey, {
        onDelete: "cascade",
      }),
    observationDigest: text("observation_digest").notNull(),
    outcome: text("outcome", {
      enum: ["recorded", "not_recorded", "indeterminate"],
    }).notNull(),
    evidenceDigest: text("evidence_digest"),
    acknowledgedAt: integer("acknowledged_at"),
    observedAt: integer("observed_at").notNull(),
    cleanupAfter: integer("cleanup_after").notNull(),
  },
  (table) => [
    uniqueIndex("uq_acquisition_dispatch_observations_operation_digest").on(
      table.operationKey,
      table.observationDigest,
    ),
    uniqueIndex("uq_acquisition_dispatch_observations_binding").on(
      table.observationKey,
      table.operationKey,
    ),
    index("idx_acquisition_dispatch_observations_truth").on(
      table.operationKey,
      table.outcome,
      table.observedAt,
    ),
    check(
      "ck_acquisition_dispatch_observations_outcome",
      sql`${table.outcome} IN ('recorded', 'not_recorded', 'indeterminate')`,
    ),
    check(
      "ck_acquisition_dispatch_observations_evidence",
      sql`(${table.outcome} IN ('recorded', 'not_recorded') AND ${table.evidenceDigest} IS NOT NULL AND length(${table.evidenceDigest}) > 0 AND ${table.acknowledgedAt} IS NOT NULL AND ${table.acknowledgedAt} <= ${table.observedAt}) OR (${table.outcome} = 'indeterminate' AND ${table.acknowledgedAt} IS NULL AND (${table.evidenceDigest} IS NULL OR length(${table.evidenceDigest}) > 0))`,
    ),
    check(
      "ck_acquisition_dispatch_observations_lifecycle",
      sql`${table.observedAt} <= ${table.cleanupAfter}`,
    ),
  ],
);

export const acquisitionResultAuthorizations = sqliteTable(
  "acquisition_result_authorizations",
  {
    handleDigest: text("handle_digest")
      .primaryKey()
      .references(() => acquisitionResultHandles.handleDigest, {
        onDelete: "cascade",
      }),
    sessionDigest: text("session_digest").notNull(),
    intent: text("intent", { enum: acquisitionIntents }).notNull(),
    canonicalRoute: text("canonical_route").notNull(),
    postAction: text("post_action").notNull(),
    logicalId: text("logical_id").notNull(),
    generation: integer("generation").notNull(),
    representation: text("representation", {
      enum: ["returned_form", "reduced"],
    }).notNull(),
    publicState: text("public_state", {
      enum: [
        "validation",
        "backend_failure",
        "return_form",
        "unknown",
        "possible_duplicate",
        "expired",
        "receipt",
      ],
    }).notNull(),
    sourceKind: text("source_kind", {
      enum: [
        "initial",
        "validation",
        "backend_failure",
        "unknown",
        "possible_duplicate",
      ],
    }),
    proofClass: text("proof_class", {
      enum: [
        "validation",
        "not_recorded",
        "indeterminate_dispatch",
        "indeterminate_reconcile",
        "recorded",
        "exact_expiry",
      ],
    }).notNull(),
    resultSetKey: text("result_set_key").notNull(),
    returnHandleDigest: text("return_handle_digest"),
    deliveryProofDigest: text("delivery_proof_digest"),
    operationKey: text("operation_key"),
    observationKey: text("observation_key"),
    issuedAt: integer("issued_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
    cleanupAfter: integer("cleanup_after").notNull(),
    attestationVersion: integer("attestation_version").notNull(),
    attestationKeyId: text("attestation_key_id").notNull(),
    authorizationAttestation: text("authorization_attestation").notNull(),
  },
  (table) => [
    index("idx_acquisition_result_authorizations_binding").on(
      table.sessionDigest,
      table.intent,
      table.canonicalRoute,
      table.postAction,
      table.logicalId,
      table.generation,
    ),
    index("idx_acquisition_result_authorizations_cleanup_after").on(
      table.cleanupAfter,
    ),
    foreignKey({
      columns: [
        table.resultSetKey,
        table.sessionDigest,
        table.intent,
        table.canonicalRoute,
        table.postAction,
        table.logicalId,
        table.generation,
      ],
      foreignColumns: [
        acquisitionResultSets.resultSetKey,
        acquisitionResultSets.sessionDigest,
        acquisitionResultSets.intent,
        acquisitionResultSets.canonicalRoute,
        acquisitionResultSets.postAction,
        acquisitionResultSets.logicalId,
        acquisitionResultSets.generation,
      ],
      name: "fk_acquisition_result_authorizations_result_set_binding",
    }).onDelete("cascade"),
    uniqueIndex("uq_acquisition_result_authorizations_state_binding").on(
      table.sessionDigest,
      table.intent,
      table.canonicalRoute,
      table.postAction,
      table.logicalId,
      table.generation,
      table.publicState,
    ).where(sql`${table.publicState} = 'expired'`),
    foreignKey({
      columns: [table.observationKey, table.operationKey],
      foreignColumns: [
        acquisitionDispatchObservations.observationKey,
        acquisitionDispatchObservations.operationKey,
      ],
      name: "fk_acquisition_result_authorizations_delivery_proof",
    }),
    check(
      "ck_acquisition_result_authorizations_generation",
      sql`${table.generation} >= 0`,
    ),
    check(
      "ck_acquisition_result_authorizations_route_action",
      sql`(${table.intent} = 'poc' AND ${table.canonicalRoute} = '/request-poc/' AND ${table.postAction} = '/request-poc/') OR (${table.intent} = 'sales' AND ${table.canonicalRoute} = '/contact-sales/' AND ${table.postAction} = '/contact-sales/') OR (${table.intent} = 'demo' AND ${table.canonicalRoute} = '/request-demo/' AND ${table.postAction} = '/request-demo/') OR (${table.intent} = 'partner' AND ${table.canonicalRoute} = '/partners/apply/' AND ${table.postAction} = '/partners/apply/')`,
    ),
    check(
      "ck_acquisition_result_authorizations_shape",
      sql`(${table.publicState} = 'validation' AND ${table.proofClass} = 'validation' AND ${table.sourceKind} = 'validation' AND ${table.operationKey} IS NULL AND ${table.observationKey} IS NULL AND ${table.deliveryProofDigest} IS NULL) OR (${table.publicState} = 'backend_failure' AND ${table.proofClass} = 'not_recorded' AND ${table.sourceKind} = 'backend_failure' AND ${table.operationKey} IS NOT NULL AND ${table.observationKey} IS NOT NULL AND ${table.deliveryProofDigest} IS NOT NULL) OR (${table.publicState} IN ('return_form', 'unknown') AND ${table.proofClass} = 'indeterminate_dispatch' AND ${table.sourceKind} = 'unknown' AND ${table.operationKey} IS NOT NULL AND ${table.observationKey} IS NOT NULL AND ${table.deliveryProofDigest} IS NOT NULL) OR (${table.publicState} IN ('return_form', 'possible_duplicate') AND ${table.proofClass} = 'indeterminate_reconcile' AND ${table.sourceKind} = 'possible_duplicate' AND ${table.operationKey} IS NOT NULL AND ${table.observationKey} IS NOT NULL AND ${table.deliveryProofDigest} IS NOT NULL) OR (${table.publicState} = 'receipt' AND ${table.proofClass} = 'recorded' AND ${table.sourceKind} IS NOT NULL AND ${table.operationKey} IS NOT NULL AND ${table.observationKey} IS NOT NULL AND ${table.deliveryProofDigest} IS NOT NULL) OR (${table.publicState} = 'expired' AND ${table.proofClass} = 'exact_expiry' AND ${table.sourceKind} IS NULL AND ${table.operationKey} IS NULL AND ${table.observationKey} IS NULL AND ${table.deliveryProofDigest} IS NULL)`,
    ),
    check(
      "ck_acquisition_result_authorizations_representation_state",
      sql`(${table.representation} = 'returned_form' AND ${table.publicState} IN ('validation', 'backend_failure', 'return_form')) OR (${table.representation} = 'reduced' AND ${table.publicState} IN ('unknown', 'possible_duplicate', 'expired', 'receipt'))`,
    ),
    check(
      "ck_acquisition_result_authorizations_return_target",
      sql`(${table.publicState} IN ('unknown', 'possible_duplicate') AND ${table.returnHandleDigest} IS NOT NULL) OR (${table.publicState} NOT IN ('unknown', 'possible_duplicate') AND ${table.returnHandleDigest} IS NULL)`,
    ),
    check(
      "ck_acquisition_result_authorizations_lifecycle",
      sql`${table.issuedAt} <= ${table.expiresAt} AND ${table.expiresAt} <= ${table.cleanupAfter}`,
    ),
    check(
      "ck_acquisition_result_authorizations_attestation",
      sql`${table.attestationVersion} = 1 AND length(${table.attestationKeyId}) > 0 AND length(${table.authorizationAttestation}) > 0 AND length(${table.resultSetKey}) > 0`,
    ),
  ],
);
