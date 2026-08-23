import type {
  D1DatabaseLike,
  D1PreparedStatementLike,
  D1ResultLike,
  D1SessionLike,
} from "./d1-types";
import type {
  AuthorizationAttestation,
  AuthorizationIndexCodec,
  CapabilityAuthorizationFacts,
  ResultAuthorizationFacts,
  ResultAuthorizationProofClass,
} from "./authorization-index";

export type AcquisitionIntent = "poc" | "sales" | "demo" | "partner";

export const canonicalAcquisitionRoute = {
  poc: "/request-poc/",
  sales: "/contact-sales/",
  demo: "/request-demo/",
  partner: "/partners/apply/",
} as const satisfies Record<AcquisitionIntent, string>;

export interface SourceBinding {
  sessionDigest: string;
  intent: AcquisitionIntent;
  canonicalRoute: string;
  postAction: string;
  logicalId: string;
  generation: number;
}

export interface RootIssueRecord extends SourceBinding {
  lineageKey: string;
  nodeKey: string;
  capabilityDigest: string;
  createdAt: number;
  expiresAt: number;
  cleanupAfter: number;
  proofCleanupAfter: number;
}

interface StoredAttestationFields {
  attestationVersion: number;
  attestationKeyId: string;
  authorizationAttestation: string;
}

export interface AuthorizationProjection extends SourceBinding {
  capabilityDigest: string;
  validUntil: number;
  proofCleanupAfter: number;
  revokedAt: number | null;
  nodeExpiresAt: number;
  nodeCleanupAfter: number;
  sourceKind: StoredContinuationSourceKind;
  projectedHandleDigest: string | null;
  projectedHandleSessionDigest: string | null;
  projectedHandleIntent: AcquisitionIntent | null;
  projectedHandleCanonicalRoute: string | null;
  projectedHandlePostAction: string | null;
  projectedHandleLogicalId: string | null;
  projectedHandleGeneration: number | null;
  projectedHandleIssuedAt: number | null;
  projectedHandleExpiresAt: number | null;
  projectedHandleCleanupAfter: number | null;
  logicalProjectionMatches: number;
  nodeProjectionMatches: number;
  handleProjectionMatches: number;
}

export interface SelectionChildRegistration {
  logicalId: string;
  createdAt: number;
  cleanupAfter: number;
}

export interface AtomicSelectionCommit extends SourceBinding {
  selectionKey: string;
  lineageKey: string;
  nodeKey: string;
  expectedRevision: number;
  candidateFingerprint: string;
  payloadSnapshotRef: string;
  selectionKind: "parent" | "child";
  child: SelectionChildRegistration | null;
  updatedAt: number;
}

export interface SelectionWinnerRecord extends SourceBinding {
  lineageKey: string;
  nodeKey: string;
  sourceKind: StoredContinuationSourceKind;
  boundPayloadFingerprint: string | null;
  outcome: "ready" | AtomicCompletionOutcome;
  revision: number;
  selectedCandidateFingerprint: string;
  selectedPayloadSnapshotRef: string;
  selectedLogicalId: string;
  selectedNodeKey: string | null;
  resultSetKey: string | null;
  selectionKind: "parent" | "child";
  updatedAt: number;
}

export type SelectionResolution =
  | { kind: "applied" | "replay"; winner: SelectionWinnerRecord }
  | { kind: "expired" }
  | { kind: "conflict" };

export interface DispatchIdentityCreation extends SourceBinding {
  dispatchKey: string;
  lineageKey: string;
  originNodeKey: string;
  selectedLogicalId: string;
  candidateFingerprint: string;
  idempotencyKey: string;
  destinationKey: string;
  createdAt: number;
  cleanupAfter: number;
}

export interface DispatchIdentityRecord {
  dispatchKey: string;
  lineageKey: string;
  originNodeKey: string;
  intent: AcquisitionIntent;
  logicalId: string;
  originGeneration: number;
  idempotencyKey: string;
  destinationKey: string;
  createdAt: number;
  cleanupAfter: number;
}

export interface DispatchOperationReservation extends SourceBinding {
  operationKey: string;
  dispatchKey: string;
  lineageKey: string;
  sourceNodeKey: string;
  selectedLogicalId: string;
  candidateFingerprint: string;
  payloadSnapshotRef: string;
  authorizationObservationKey: string | null;
  operationKind: "dispatch" | "reconcile";
  reservedAt: number;
  cleanupAfter: number;
}

export interface DispatchOperationRecord {
  operationKey: string;
  dispatchKey: string;
  lineageKey: string;
  logicalId: string;
  sourceNodeKey: string;
  sourceGeneration: number;
  candidateFingerprint: string;
  payloadSnapshotRef: string;
  authorizationObservationKey: string | null;
  operationKind: "dispatch" | "reconcile";
  reservedAt: number;
  cleanupAfter: number;
}

export type DispatchOperationResolution = {
  kind: "applied" | "replay";
  winner: DispatchOperationRecord;
};

export type DispatchObservationOutcome =
  | "recorded"
  | "not_recorded"
  | "indeterminate";

export interface DispatchObservationAppend {
  observationKey: string;
  operationKey: string;
  observationDigest: string;
  outcome: DispatchObservationOutcome;
  evidenceDigest: string | null;
  acknowledgedAt: number | null;
  observedAt: number;
  cleanupAfter: number;
  checkedAt: number;
}

export type DispatchObservationRecord = Omit<DispatchObservationAppend, "checkedAt">;

export type DispatchObservationResolution = {
  kind: "applied" | "replay";
  winner: DispatchObservationRecord;
};

export type DispatchTruth =
  | { kind: "missing" }
  | { kind: "unobserved" }
  | { kind: "indeterminate"; observation: DispatchObservationRecord }
  | {
      kind: "recorded" | "not_recorded";
      observation: DispatchObservationRecord;
    }
  | { kind: "recorded-elsewhere"; observation: DispatchObservationRecord }
  | { kind: "contradiction" };

export interface ResultHandleRecord extends SourceBinding {
  handleDigest: string;
  lineageKey: string | null;
  nodeKey: string | null;
  representation: "returned_form" | "reduced";
  publicState:
    | "validation"
    | "backend_failure"
    | "return_form"
    | "unknown"
    | "possible_duplicate"
    | "expired"
    | "receipt";
  returnHandleDigest: string | null;
  payloadFingerprint: string | null;
  resultSetKey: string;
  operationKey: string | null;
  observationKey: string | null;
  issuedAt: number;
  expiresAt: number;
  cleanupAfter: number;
}

/**
 * Server-created Expired handles never accept an issue time from an adapter.
 * The repository samples its trusted clock and materializes that field itself.
 */
export type ExpiryHandleDraft = Omit<ResultHandleRecord, "issuedAt"> & {
  issuedAt?: never;
};

/** Constant-shape authorization data; intentionally excludes payload linkage. */
export interface ResultHandleProjection extends SourceBinding {
  handleDigest: string;
  lineageKey: string | null;
  nodeKey: string | null;
  representation: ResultHandleRecord["representation"];
  publicState: ResultHandleRecord["publicState"];
  issuedAt: number;
  expiresAt: number;
  cleanupAfter: number;
}

export interface ResultSetProjection {
  resultSetKey: string;
  handles: readonly ResultHandleProjection[];
}

type ResultSetOutcome =
  | "validation"
  | "backend_failure"
  | "unknown"
  | "possible_duplicate"
  | "receipt"
  | "expired";

interface ResultSetOwnerRow extends SourceBinding {
  resultSetKey: string;
  outcome: ResultSetOutcome;
  createdAt: number;
  cleanupAfter: number;
}

interface CapabilityAuthorizationRow extends CapabilityAuthorizationFacts {
  validUntil: number;
  proofCleanupAfter: number;
  revokedAt: number | null;
  projectedHandleDigest: string | null;
  projectedHandleSessionDigest: string | null;
  projectedHandleIntent: AcquisitionIntent | null;
  projectedHandleCanonicalRoute: string | null;
  projectedHandlePostAction: string | null;
  projectedHandleLogicalId: string | null;
  projectedHandleGeneration: number | null;
  projectedHandleIssuedAt: number | null;
  projectedHandleExpiresAt: number | null;
  projectedHandleCleanupAfter: number | null;
  projectedHandleSourceKind: StoredContinuationSourceKind | null;
  projectedHandleRepresentation: ResultHandleRecord["representation"] | null;
  projectedHandlePublicState: ResultHandleRecord["publicState"] | null;
  projectedHandleProofClass: ResultAuthorizationProofClass | null;
  projectedHandleResultSetKey: string | null;
  projectedHandleReturnHandleDigest: string | null;
  projectedHandleDeliveryProofDigest: string | null;
  projectedHandleOperationKey: string | null;
  projectedHandleObservationKey: string | null;
  projectedHandleAttestationVersion: number | null;
  projectedHandleAttestationKeyId: string | null;
  projectedHandleAuthorizationAttestation: string | null;
  attestationVersion: number;
  attestationKeyId: string;
  authorizationAttestation: string;
}

interface ResultAuthorizationRow extends ResultAuthorizationFacts {
  attestationVersion: number;
  attestationKeyId: string;
  authorizationAttestation: string;
  returnedSessionDigest: string | null;
  returnedIntent: AcquisitionIntent | null;
  returnedCanonicalRoute: string | null;
  returnedPostAction: string | null;
  returnedLogicalId: string | null;
  returnedGeneration: number | null;
  returnedRepresentation: ResultHandleRecord["representation"] | null;
  returnedPublicState: ResultHandleRecord["publicState"] | null;
  returnedSourceKind: StoredContinuationSourceKind | null;
  returnedProofClass: ResultAuthorizationProofClass | null;
  returnedResultSetKey: string | null;
  returnedReturnHandleDigest: string | null;
  returnedDeliveryProofDigest: string | null;
  returnedOperationKey: string | null;
  returnedObservationKey: string | null;
  returnedIssuedAt: number | null;
  returnedExpiresAt: number | null;
  returnedCleanupAfter: number | null;
  returnedAttestationVersion: number | null;
  returnedAttestationKeyId: string | null;
  returnedAuthorizationAttestation: string | null;
}

export type StoredContinuationSourceKind =
  | "initial"
  | "validation"
  | "backend_failure"
  | "unknown"
  | "possible_duplicate";

export type AtomicCompletionOutcome =
  | "validation_failed"
  | "recorded"
  | "not_recorded"
  | "indeterminate";

export interface AtomicNodeCompletion {
  lineageKey: string;
  nodeKey: string;
  sessionDigest: string;
  intent: AcquisitionIntent;
  canonicalRoute: string;
  postAction: string;
  sourceLogicalId: string;
  sourceGeneration: number;
  sourceKind: StoredContinuationSourceKind;
  selectedLogicalId: string;
  candidateFingerprint: string;
  expectedRevision: number;
  operation: "validation" | "dispatch" | "reconcile";
  operationKey: string | null;
  observationKey: string | null;
  outcome: AtomicCompletionOutcome;
  updatedAt: number;
}

export interface AtomicNextContinuation extends SourceBinding {
  lineageKey: string;
  nodeKey: string;
  parentNodeKey: string;
  sourceKind: StoredContinuationSourceKind;
  boundPayloadFingerprint: string | null;
  capabilityDigest: string;
  createdAt: number;
  expiresAt: number;
  cleanupAfter: number;
  capabilityIssuedAt: number;
  capabilityValidUntil: number;
  capabilityProofCleanupAfter: number;
}

export interface AtomicTransitionFinalization {
  finalizationKey: string;
  resultSetKey: string;
  completion: AtomicNodeCompletion;
  next: AtomicNextContinuation | null;
  resultHandles: readonly ResultHandleRecord[];
}

export interface AuthorizedLineageLifetime {
  lineageExpiresAt: number;
  lineageCleanupAfter: number;
  nodeExpiresAt: number;
  nodeCleanupAfter: number;
  capabilityValidUntil: number;
  capabilityProofCleanupAfter: number;
  handleExpiresAt: number;
  handleCleanupAfter: number;
}

export interface AcquisitionCleanupReport {
  resultAuthorizations: number;
  uncertaintyHandles: number;
  resultHandles: number;
  resultSets: number;
  capabilities: number;
  observations: number;
  operations: number;
  dispatches: number;
  lineages: number;
}

export interface TrustedClock {
  now(): number;
}

export function validateAuthorizedLineageLifetime(
  lifetime: AuthorizedLineageLifetime,
): void {
  const nonNegative = Object.values(lifetime).every(
    (value) => Number.isSafeInteger(value) && value >= 0,
  );
  if (!nonNegative) {
    throw new Error("Acquisition lifetimes must be non-negative safe integers.");
  }
  if (
    lifetime.nodeExpiresAt > lifetime.capabilityValidUntil ||
    lifetime.handleExpiresAt > lifetime.capabilityValidUntil ||
    lifetime.capabilityValidUntil > lifetime.capabilityProofCleanupAfter ||
    lifetime.nodeCleanupAfter < lifetime.capabilityProofCleanupAfter ||
    lifetime.lineageCleanupAfter < lifetime.capabilityProofCleanupAfter ||
    lifetime.handleCleanupAfter > lifetime.lineageCleanupAfter ||
    lifetime.nodeCleanupAfter > lifetime.lineageCleanupAfter ||
    lifetime.lineageExpiresAt > lifetime.lineageCleanupAfter
  ) {
    throw new Error("Acquisition lifecycle windows are inconsistent.");
  }
}

function requireSingleChange(
  operation: string,
  result: D1ResultLike,
): void {
  if (!result.success || result.meta?.changes !== 1) {
    throw new Error(`${operation} did not make exactly one durable change.`);
  }
}

function primarySession(database: D1DatabaseLike): D1SessionLike {
  return database.withSession?.("first-primary") ?? database;
}

function requireNonEmpty(label: string, value: string): void {
  if (value.length === 0) {
    throw new Error(`${label} must be a non-empty opaque value.`);
  }
}

function requireSafeTime(label: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer.`);
  }
}

function validateSourceRoute(binding: SourceBinding): void {
  if (binding.canonicalRoute !== canonicalAcquisitionRoute[binding.intent]) {
    throw new Error("The acquisition route does not match its server intent.");
  }
  if (binding.postAction !== binding.canonicalRoute) {
    throw new Error("The POST action must be the exact canonical form route.");
  }
  if (!Number.isSafeInteger(binding.generation) || binding.generation < 0) {
    throw new Error("The acquisition generation is invalid.");
  }
  requireNonEmpty("Session digest", binding.sessionDigest);
  requireNonEmpty("Logical ID", binding.logicalId);
}

function validateStoredSource(
  kind: StoredContinuationSourceKind,
  boundPayloadFingerprint: string | null,
): void {
  const requiresFingerprint =
    kind === "backend_failure" ||
    kind === "unknown" ||
    kind === "possible_duplicate";
  if (
    requiresFingerprint !==
    (boundPayloadFingerprint !== null && boundPayloadFingerprint.length > 0)
  ) {
    throw new Error(
      "The stored continuation source has an invalid fingerprint binding.",
    );
  }
}

function validateResultHandle(record: ResultHandleRecord): void {
  validateSourceRoute(record);
  requireNonEmpty("Result handle digest", record.handleDigest);
  requireNonEmpty("Result-set key", record.resultSetKey);
  requireSafeTime("Result handle issue time", record.issuedAt);
  requireSafeTime("Result handle expiry time", record.expiresAt);
  requireSafeTime("Result handle cleanup time", record.cleanupAfter);
  if (
    record.issuedAt > record.expiresAt ||
    record.expiresAt > record.cleanupAfter
  ) {
    throw new Error("The result handle lifecycle is inconsistent.");
  }

  const isExpiryOnly = record.publicState === "expired";
  if (
    isExpiryOnly &&
    (record.lineageKey !== null ||
      record.nodeKey !== null ||
      record.payloadFingerprint !== null)
  ) {
    throw new Error("An expiry-only handle cannot bind lineage or payload state.");
  }
  const needsReturnedForm =
    record.publicState === "unknown" ||
    record.publicState === "possible_duplicate";
  if (needsReturnedForm !== (record.returnHandleDigest !== null)) {
    throw new Error(
      "Only uncertainty states require one bound returned-form handle.",
    );
  }
  const returnedFormState =
    record.publicState === "validation" ||
    record.publicState === "backend_failure" ||
    record.publicState === "return_form";
  if (returnedFormState !== (record.representation === "returned_form")) {
    throw new Error("The result state is on the wrong representation surface.");
  }
  const requiresPayloadFingerprint =
    record.publicState === "validation" ||
    record.publicState === "backend_failure" ||
    record.publicState === "return_form" ||
    record.publicState === "unknown" ||
    record.publicState === "possible_duplicate";
  if (
    requiresPayloadFingerprint !==
    (record.payloadFingerprint !== null &&
      record.payloadFingerprint.length > 0)
  ) {
    throw new Error("The result state has an invalid payload binding.");
  }
  const requiresDeliveryProof =
    record.publicState === "backend_failure" ||
    record.publicState === "return_form" ||
    record.publicState === "unknown" ||
    record.publicState === "possible_duplicate" ||
    record.publicState === "receipt";
  if (
    requiresDeliveryProof !==
    (record.operationKey !== null &&
      record.operationKey.length > 0 &&
      record.observationKey !== null &&
      record.observationKey.length > 0)
  ) {
    throw new Error("The result state has an invalid delivery-proof binding.");
  }
}

function storedAttestation(
  attestation: AuthorizationAttestation,
): StoredAttestationFields {
  return {
    attestationVersion: attestation.version,
    attestationKeyId: attestation.keyId,
    authorizationAttestation: attestation.value,
  };
}

function attestationFromRow(row: StoredAttestationFields): AuthorizationAttestation {
  return {
    version: row.attestationVersion as AuthorizationAttestation["version"],
    keyId: row.attestationKeyId,
    value: row.authorizationAttestation,
  };
}

function capabilityFactsFromRow(
  row: CapabilityAuthorizationRow,
): CapabilityAuthorizationFacts {
  return {
    capabilityDigest: row.capabilityDigest,
    sessionDigest: row.sessionDigest,
    intent: row.intent,
    canonicalRoute: row.canonicalRoute,
    postAction: row.postAction,
    logicalId: row.logicalId,
    generation: row.generation,
    sourceKind: row.sourceKind,
    issuedAt: row.issuedAt,
    sourceExpiresAt: row.sourceExpiresAt,
    validUntil: row.validUntil,
    proofCleanupAfter: row.proofCleanupAfter,
    sourceCleanupAfter: row.sourceCleanupAfter,
  };
}

function resultFactsFromRow(row: ResultAuthorizationRow): ResultAuthorizationFacts {
  return {
    handleDigest: row.handleDigest,
    sessionDigest: row.sessionDigest,
    intent: row.intent,
    canonicalRoute: row.canonicalRoute,
    postAction: row.postAction,
    logicalId: row.logicalId,
    generation: row.generation,
    representation: row.representation,
    publicState: row.publicState,
    sourceKind: row.sourceKind,
    proofClass: row.proofClass,
    resultSetKey: row.resultSetKey,
    returnHandleDigest: row.returnHandleDigest,
    deliveryProofDigest: row.deliveryProofDigest,
    operationKey: row.operationKey,
    observationKey: row.observationKey,
    issuedAt: row.issuedAt,
    expiresAt: row.expiresAt,
    cleanupAfter: row.cleanupAfter,
  };
}

function expectedAuthorizationShape(input: {
  completion: AtomicNodeCompletion;
  next: AtomicNextContinuation | null;
  record: ResultHandleRecord;
}): {
  sourceKind: StoredContinuationSourceKind;
  proofClass: ResultAuthorizationProofClass;
} {
  const { completion, next, record } = input;
  if (record.publicState === "validation") {
    return { sourceKind: "validation", proofClass: "validation" };
  }
  if (record.publicState === "backend_failure") {
    return { sourceKind: "backend_failure", proofClass: "not_recorded" };
  }
  if (record.publicState === "receipt") {
    return { sourceKind: completion.sourceKind, proofClass: "recorded" };
  }
  if (
    record.publicState === "unknown" ||
    (record.publicState === "return_form" && next?.sourceKind === "unknown")
  ) {
    if (next?.sourceKind !== "unknown") {
      throw new Error("A dispatch-uncertainty authorization lacks its Unknown source.");
    }
    return { sourceKind: "unknown", proofClass: "indeterminate_dispatch" };
  }
  if (
    record.publicState === "possible_duplicate" ||
    (record.publicState === "return_form" &&
      next?.sourceKind === "possible_duplicate")
  ) {
    if (next?.sourceKind !== "possible_duplicate") {
      throw new Error(
        "A reconciliation-uncertainty authorization lacks its Possible-duplicate source.",
      );
    }
    return {
      sourceKind: "possible_duplicate",
      proofClass: "indeterminate_reconcile",
    };
  }
  throw new Error("An expiry authorization is not a transition result.");
}

function transitionResultSetOutcome(
  completion: AtomicNodeCompletion,
  next: AtomicNextContinuation | null,
): Exclude<ResultSetOutcome, "expired"> {
  if (completion.outcome === "validation_failed") return "validation";
  if (completion.outcome === "not_recorded") return "backend_failure";
  if (completion.outcome === "recorded") return "receipt";
  return next?.sourceKind === "unknown" ? "unknown" : "possible_duplicate";
}

function atomicCompletionBindings(
  completion: AtomicNodeCompletion,
): readonly unknown[] {
  const selectionKind =
    completion.selectedLogicalId === completion.sourceLogicalId
      ? "parent"
      : "child";
  return [
    completion.nodeKey,
    completion.lineageKey,
    completion.sourceLogicalId,
    completion.sourceGeneration,
    completion.expectedRevision,
    completion.sessionDigest,
    completion.intent,
    completion.canonicalRoute,
    completion.postAction,
    completion.candidateFingerprint,
    completion.selectedLogicalId,
    selectionKind,
    completion.outcome,
    completion.updatedAt,
    completion.operation,
    completion.operationKey,
    completion.observationKey,
    completion.sourceKind,
  ];
}

const atomicCompletionPredicate = `source.node_key = ?1
  AND source.lineage_key = ?2
  AND source.logical_id = ?3
  AND source.generation = ?4
  AND source.revision = ?5
  AND source.source_kind = ?18
  AND source.updated_at <= ?14
  AND source.selected_candidate_fingerprint = ?10
  AND source.selected_logical_id = ?11
  AND source.selection_kind = ?12
  AND source.selected_payload_snapshot_ref IS NOT NULL
  AND length(source.selected_payload_snapshot_ref) > 0
  AND source.selected_node_key IS NULL
  AND source.selection_key IS NULL
  AND EXISTS (
    SELECT 1
    FROM acquisition_lineages lineage
    WHERE lineage.lineage_key = source.lineage_key
      AND lineage.session_digest = ?6
      AND lineage.intent = ?7
      AND lineage.canonical_route = ?8
      AND lineage.post_action = ?9
  )
  AND EXISTS (
    SELECT 1
    FROM acquisition_logical_ids selected_logical
    WHERE selected_logical.logical_id = source.selected_logical_id
      AND selected_logical.lineage_key = source.lineage_key
      AND selected_logical.cleanup_after >= ?14
  )
  AND (
    (?12 = 'parent' AND ?11 = ?3)
    OR (
      ?12 = 'child'
      AND ?11 <> ?3
      AND EXISTS (
        SELECT 1
        FROM acquisition_logical_ids child
        WHERE child.logical_id = ?11
          AND child.lineage_key = source.lineage_key
          AND child.parent_logical_id = source.logical_id
      )
    )
  )
  AND source.outcome = 'ready'
  AND (
    (?15 = 'validation' AND ?13 = 'validation_failed'
      AND ?16 IS NULL AND ?17 IS NULL)
    OR (
      ?15 IN ('dispatch', 'reconcile')
      AND ?13 IN ('recorded', 'not_recorded', 'indeterminate')
      AND ?16 IS NOT NULL AND ?17 IS NOT NULL
      AND NOT (?15 = 'reconcile' AND ?13 = 'not_recorded')
      AND EXISTS (
        SELECT 1
        FROM acquisition_dispatch_operations operation
        JOIN acquisition_dispatches dispatch
          ON dispatch.dispatch_key = operation.dispatch_key
         AND dispatch.lineage_key = operation.lineage_key
         AND dispatch.logical_id = operation.logical_id
        JOIN acquisition_dispatch_observations observation
          ON observation.operation_key = operation.operation_key
        WHERE operation.operation_key = ?16
          AND observation.observation_key = ?17
          AND operation.source_node_key = source.node_key
          AND operation.source_generation = source.generation
          AND operation.lineage_key = source.lineage_key
          AND operation.logical_id = source.selected_logical_id
          AND operation.operation_kind = ?15
          AND operation.candidate_fingerprint = source.selected_candidate_fingerprint
          AND operation.payload_snapshot_ref = source.selected_payload_snapshot_ref
          AND dispatch.intent = ?7
          AND observation.observed_at <= ?14
          AND observation.cleanup_after >= ?14
          AND (
            (?13 = 'recorded' AND observation.outcome = 'recorded'
              AND observation.evidence_digest IS NOT NULL
              AND observation.acknowledged_at IS NOT NULL)
            OR (?13 = 'not_recorded' AND ?15 = 'dispatch'
              AND observation.outcome = 'not_recorded'
              AND observation.evidence_digest IS NOT NULL
              AND observation.acknowledged_at IS NOT NULL)
            OR (?13 = 'indeterminate'
              AND observation.outcome = 'indeterminate')
          )
          AND NOT EXISTS (
            SELECT 1
            FROM acquisition_dispatch_observations contradiction
            WHERE contradiction.operation_key = operation.operation_key
              AND (
                (observation.outcome = 'indeterminate'
                  AND contradiction.outcome IN ('recorded', 'not_recorded'))
                OR (observation.outcome IN ('recorded', 'not_recorded')
                  AND contradiction.outcome IN ('recorded', 'not_recorded')
                  AND contradiction.outcome <> observation.outcome)
              )
          )
          AND (
            ?13 = 'recorded'
            OR NOT EXISTS (
              SELECT 1
              FROM acquisition_dispatch_operations prior_operation
              JOIN acquisition_dispatch_observations prior_recorded
                ON prior_recorded.operation_key = prior_operation.operation_key
               AND prior_recorded.outcome = 'recorded'
              WHERE prior_operation.dispatch_key = operation.dispatch_key
                AND prior_operation.operation_key <> operation.operation_key
                AND prior_operation.reserved_at <= operation.reserved_at
            )
          )
      )
    )
  )`;

function validateAtomicFinalization(
  input: AtomicTransitionFinalization,
): ResultHandleRecord[] {
  const { completion, next } = input;
  requireNonEmpty("Result-set key", input.resultSetKey);
  if (
    !new Set<StoredContinuationSourceKind>([
      "initial",
      "validation",
      "backend_failure",
      "unknown",
      "possible_duplicate",
    ]).has(completion.sourceKind)
  ) {
    throw new Error("The completion source kind is invalid.");
  }
  validateSourceRoute({
    sessionDigest: completion.sessionDigest,
    intent: completion.intent,
    canonicalRoute: completion.canonicalRoute,
    postAction: completion.postAction,
    logicalId: completion.sourceLogicalId,
    generation: completion.sourceGeneration,
  });
  const completionOpaqueValues: ReadonlyArray<readonly [string, string]> = [
    ["Lineage key", completion.lineageKey],
    ["Source node key", completion.nodeKey],
    ["Selected logical ID", completion.selectedLogicalId],
    ["Candidate fingerprint", completion.candidateFingerprint],
  ];
  completionOpaqueValues.forEach(([label, value]) =>
    requireNonEmpty(label, value),
  );
  requireSafeTime("Expected revision", completion.expectedRevision);
  requireSafeTime("Completion time", completion.updatedAt);
  const validationPhase = completion.operation === "validation";
  if (validationPhase !== (completion.outcome === "validation_failed")) {
    throw new Error("The completion operation does not match validation state.");
  }
  if (
    completion.outcome === "not_recorded" &&
    completion.operation !== "dispatch"
  ) {
    throw new Error(
      "A reconciliation that proves no record must return to dispatch first.",
    );
  }
  if (
    validationPhase !==
    (completion.operationKey === null && completion.observationKey === null)
  ) {
    throw new Error("The completion lacks an exact immutable operation proof.");
  }
  if (!validationPhase) {
    requireNonEmpty("Operation key", completion.operationKey!);
    requireNonEmpty("Observation key", completion.observationKey!);
  }

  if ((completion.outcome === "recorded") !== (next === null)) {
    throw new Error(
      "Only a durably recorded completion may omit the next form authority.",
    );
  }

  if (next !== null) {
    validateSourceRoute(next);
    validateStoredSource(next.sourceKind, next.boundPayloadFingerprint);
    const nextOpaqueValues: ReadonlyArray<readonly [string, string]> = [
      ["Next node key", next.nodeKey],
      ["Next parent node key", next.parentNodeKey],
      ["Next capability digest", next.capabilityDigest],
    ];
    nextOpaqueValues.forEach(([label, value]) => requireNonEmpty(label, value));
    if (
      next.lineageKey !== completion.lineageKey ||
      next.parentNodeKey !== completion.nodeKey ||
      next.sessionDigest !== completion.sessionDigest ||
      next.intent !== completion.intent ||
      next.canonicalRoute !== completion.canonicalRoute ||
      next.postAction !== completion.postAction ||
      next.logicalId !== completion.selectedLogicalId ||
      next.generation !== completion.sourceGeneration + 1
    ) {
      throw new Error("The next continuation is not bound to the completed node.");
    }

    const expectedSourceKind =
      completion.outcome === "validation_failed"
        ? "validation"
        : completion.outcome === "not_recorded"
          ? "backend_failure"
          : null;
    if (
      (expectedSourceKind !== null && next.sourceKind !== expectedSourceKind) ||
      (completion.outcome === "indeterminate" &&
        ((completion.operation === "dispatch" && next.sourceKind !== "unknown") ||
          (completion.operation === "reconcile" &&
            next.sourceKind !== "possible_duplicate"))) ||
      next.sourceKind === "initial"
    ) {
      throw new Error("The next source kind does not match the completion.");
    }
    if (
      next.boundPayloadFingerprint !== null &&
      next.boundPayloadFingerprint !== completion.candidateFingerprint
    ) {
      throw new Error("The next source fingerprint was rebound.");
    }

    const lifecycleTimes: ReadonlyArray<readonly [string, number]> = [
      ["Next creation time", next.createdAt],
      ["Next expiry time", next.expiresAt],
      ["Next cleanup time", next.cleanupAfter],
      ["Capability issue time", next.capabilityIssuedAt],
      ["Capability validity time", next.capabilityValidUntil],
      ["Capability cleanup time", next.capabilityProofCleanupAfter],
    ];
    lifecycleTimes.forEach(([label, value]) => requireSafeTime(label, value));
    if (
      next.createdAt < completion.updatedAt ||
      next.capabilityIssuedAt < completion.updatedAt ||
      next.capabilityIssuedAt < next.createdAt ||
      next.capabilityIssuedAt > next.expiresAt ||
      next.createdAt > next.expiresAt ||
      next.expiresAt > next.capabilityValidUntil ||
      next.capabilityIssuedAt > next.capabilityValidUntil ||
      next.capabilityValidUntil > next.capabilityProofCleanupAfter ||
      next.capabilityProofCleanupAfter > next.cleanupAfter
    ) {
      throw new Error("The next continuation lifecycle is inconsistent.");
    }
  }

  if (input.resultHandles.length === 0) {
    throw new Error("Atomic finalization requires a returned representation.");
  }
  const expectedNodeKey = next?.nodeKey ?? completion.nodeKey;
  const expectedGeneration = next?.generation ?? completion.sourceGeneration;
  const handlesByDigest = new Map<string, ResultHandleRecord>();
  input.resultHandles.forEach((record) => {
    validateResultHandle(record);
    if (record.publicState === "expired") {
      throw new Error("Expiry-only state is not a transition finalization.");
    }
    if (handlesByDigest.has(record.handleDigest)) {
      throw new Error("A result handle digest was repeated.");
    }
    if (
      record.issuedAt < completion.updatedAt ||
      (next !== null && record.issuedAt < next.createdAt) ||
      record.resultSetKey !== input.resultSetKey ||
      record.lineageKey !== completion.lineageKey ||
      record.nodeKey !== expectedNodeKey ||
      record.sessionDigest !== completion.sessionDigest ||
      record.intent !== completion.intent ||
      record.canonicalRoute !== completion.canonicalRoute ||
      record.postAction !== completion.postAction ||
      record.logicalId !== completion.selectedLogicalId ||
      record.generation !== expectedGeneration
    ) {
      throw new Error("A result handle is not bound to the finalized lineage.");
    }
    if (
      record.publicState !== "receipt" &&
      record.payloadFingerprint !== completion.candidateFingerprint
    ) {
      throw new Error("A result handle fingerprint was rebound.");
    }
    if (
      record.operationKey !== completion.operationKey ||
      record.observationKey !== completion.observationKey
    ) {
      throw new Error("A result handle delivery proof was rebound.");
    }
    if (
      next !== null &&
      (record.expiresAt > next.capabilityValidUntil ||
        record.cleanupAfter < next.capabilityProofCleanupAfter ||
        record.cleanupAfter > next.cleanupAfter)
    ) {
      throw new Error("A result handle outlives its continuation authority.");
    }
    handlesByDigest.set(record.handleDigest, record);
  });

  if (
    (completion.outcome === "validation_failed" &&
      (input.resultHandles.length !== 1 ||
        input.resultHandles[0]?.publicState !== "validation")) ||
    (completion.outcome === "not_recorded" &&
      (input.resultHandles.length !== 1 ||
        input.resultHandles[0]?.publicState !== "backend_failure")) ||
    (completion.outcome === "recorded" &&
      (input.resultHandles.length !== 1 ||
        input.resultHandles[0]?.publicState !== "receipt"))
  ) {
    throw new Error("The returned representation does not match the completion.");
  }

  if (completion.outcome === "indeterminate") {
    const uncertaintyState =
      next?.sourceKind === "unknown" ? "unknown" : "possible_duplicate";
    const returnedForms = input.resultHandles.filter(
      (record) =>
        record.representation === "returned_form" &&
        record.publicState === "return_form",
    );
    const uncertainty = input.resultHandles.filter(
      (record) =>
        record.representation === "reduced" &&
        record.publicState === uncertaintyState,
    );
    if (
      input.resultHandles.length !== 2 ||
      returnedForms.length !== 1 ||
      uncertainty.length !== 1 ||
      uncertainty[0]?.returnHandleDigest !== returnedForms[0]?.handleDigest
    ) {
      throw new Error(
        "An indeterminate completion requires one neutral returned form and one linked uncertainty state.",
      );
    }
  }

  input.resultHandles.forEach((record) => {
    if (record.returnHandleDigest === null) return;
    const returnedForm = handlesByDigest.get(record.returnHandleDigest);
    if (
      returnedForm?.representation !== "returned_form" ||
      returnedForm.publicState !== "return_form" ||
      returnedForm.issuedAt > record.issuedAt ||
      returnedForm.expiresAt < record.expiresAt ||
      returnedForm.cleanupAfter < record.cleanupAfter
    ) {
      throw new Error(
        "An uncertainty handle must reference an atomically stored neutral returned form.",
      );
    }
  });

  return [...input.resultHandles].sort((left, right) => {
    const leftIsTarget = [...handlesByDigest.values()].some(
      (record) => record.returnHandleDigest === left.handleDigest,
    );
    const rightIsTarget = [...handlesByDigest.values()].some(
      (record) => record.returnHandleDigest === right.handleDigest,
    );
    return Number(rightIsTarget) - Number(leftIsTarget);
  });
}

export class D1AcquisitionRepository {
  private readonly database: D1DatabaseLike;
  private readonly authorizationIndex: AuthorizationIndexCodec;
  private readonly clock: TrustedClock;

  constructor(
    database: D1DatabaseLike,
    authorizationIndex: AuthorizationIndexCodec,
    clock: TrustedClock,
  ) {
    this.database = database;
    this.authorizationIndex = authorizationIndex;
    this.clock = clock;
  }

  async issueRoot(record: RootIssueRecord): Promise<void> {
    validateSourceRoute(record);
    if (record.generation !== 0) {
      throw new Error("A fresh root must begin at generation zero.");
    }
    const opaqueValues: ReadonlyArray<readonly [string, string]> = [
      ["Lineage key", record.lineageKey],
      ["Node key", record.nodeKey],
      ["Capability digest", record.capabilityDigest],
    ];
    opaqueValues.forEach(([label, value]) => requireNonEmpty(label, value));
    [
      ["Root creation time", record.createdAt],
      ["Root expiry time", record.expiresAt],
      ["Root cleanup time", record.cleanupAfter],
      ["Capability proof cleanup time", record.proofCleanupAfter],
    ].forEach(([label, value]) => requireSafeTime(label as string, value as number));
    if (
      record.createdAt > record.expiresAt ||
      record.expiresAt > record.proofCleanupAfter ||
      record.proofCleanupAfter > record.cleanupAfter
    ) {
      throw new Error("The root authorization lifecycle is inconsistent.");
    }

    const capabilityFacts: CapabilityAuthorizationFacts = {
      capabilityDigest: record.capabilityDigest,
      sessionDigest: record.sessionDigest,
      intent: record.intent,
      canonicalRoute: record.canonicalRoute,
      postAction: record.postAction,
      logicalId: record.logicalId,
      generation: record.generation,
      sourceKind: "initial",
      issuedAt: record.createdAt,
      sourceExpiresAt: record.expiresAt,
      validUntil: record.expiresAt,
      proofCleanupAfter: record.proofCleanupAfter,
      sourceCleanupAfter: record.cleanupAfter,
    };
    const capabilityAttestation = storedAttestation(
      await this.authorizationIndex.attestCapability(capabilityFacts),
    );

    const db = primarySession(this.database);
    const results = await db.batch([
      db
        .prepare(
          `INSERT INTO acquisition_lineages
            (lineage_key, session_digest, intent, canonical_route, post_action,
             root_logical_id, revision, created_at, expires_at, cleanup_after)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, ?7, ?8, ?9)`,
        )
        .bind(
          record.lineageKey,
          record.sessionDigest,
          record.intent,
          record.canonicalRoute,
          record.postAction,
          record.logicalId,
          record.createdAt,
          record.expiresAt,
          record.cleanupAfter,
        ),
      db
        .prepare(
          `INSERT INTO acquisition_logical_ids
            (logical_id, lineage_key, parent_logical_id, created_at, cleanup_after)
           VALUES (?1, ?2, NULL, ?3, ?4)`,
        )
        .bind(
          record.logicalId,
          record.lineageKey,
          record.createdAt,
          record.cleanupAfter,
        ),
      db
        .prepare(
          `INSERT INTO acquisition_nodes
            (node_key, lineage_key, parent_node_key, logical_id, generation,
             source_kind, bound_payload_fingerprint, outcome, revision,
             created_at, updated_at, expires_at, cleanup_after)
           VALUES (?1, ?2, NULL, ?3, 0, 'initial', NULL, 'fresh', 0,
                   ?4, ?4, ?5, ?6)`,
        )
        .bind(
          record.nodeKey,
          record.lineageKey,
          record.logicalId,
          record.createdAt,
          record.expiresAt,
          record.cleanupAfter,
        ),
      db
        .prepare(
           `INSERT INTO acquisition_capabilities
             (capability_digest, lineage_key, node_key, session_digest, intent,
              canonical_route, post_action, logical_id, generation, issued_at,
              source_kind, source_expires_at, valid_until, proof_cleanup_after,
              source_cleanup_after, revoked_at, attestation_version,
              attestation_key_id, authorization_attestation)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 0, ?9, 'initial', ?10,
                    ?10, ?11, ?12, NULL, ?13, ?14, ?15)`,
        )
        .bind(
          record.capabilityDigest,
          record.lineageKey,
          record.nodeKey,
          record.sessionDigest,
          record.intent,
          record.canonicalRoute,
          record.postAction,
          record.logicalId,
           record.createdAt,
           record.expiresAt,
           record.proofCleanupAfter,
           record.cleanupAfter,
           capabilityAttestation.attestationVersion,
           capabilityAttestation.attestationKeyId,
           capabilityAttestation.authorizationAttestation,
         ),
    ]);

    results.forEach((result, index) =>
      requireSingleChange(`root issue statement ${index + 1}`, result),
    );
  }

  async readAuthorizationProjection(
    capabilityDigest: string,
    projectedHandleDigest: string | null,
  ): Promise<AuthorizationProjection | null> {
    requireNonEmpty("Capability digest", capabilityDigest);
    if (projectedHandleDigest !== null) {
      requireNonEmpty("Projected handle digest", projectedHandleDigest);
    }
    const db = primarySession(this.database);
    const row = await db
      .prepare(
        `SELECT
           c.capability_digest AS capabilityDigest,
           c.session_digest AS sessionDigest,
           c.intent AS intent,
           c.canonical_route AS canonicalRoute,
           c.post_action AS postAction,
           c.logical_id AS logicalId,
           c.generation AS generation,
           c.source_kind AS sourceKind,
           c.issued_at AS issuedAt,
           c.source_expires_at AS sourceExpiresAt,
           c.valid_until AS validUntil,
           c.proof_cleanup_after AS proofCleanupAfter,
           c.source_cleanup_after AS sourceCleanupAfter,
           c.revoked_at AS revokedAt,
           c.attestation_version AS attestationVersion,
           c.attestation_key_id AS attestationKeyId,
           c.authorization_attestation AS authorizationAttestation,
           h.handle_digest AS projectedHandleDigest,
           h.session_digest AS projectedHandleSessionDigest,
           h.intent AS projectedHandleIntent,
           h.canonical_route AS projectedHandleCanonicalRoute,
           h.post_action AS projectedHandlePostAction,
           h.logical_id AS projectedHandleLogicalId,
           h.generation AS projectedHandleGeneration,
           h.issued_at AS projectedHandleIssuedAt,
           h.expires_at AS projectedHandleExpiresAt,
           h.cleanup_after AS projectedHandleCleanupAfter,
           h.source_kind AS projectedHandleSourceKind,
           h.representation AS projectedHandleRepresentation,
           h.public_state AS projectedHandlePublicState,
           h.proof_class AS projectedHandleProofClass,
           h.result_set_key AS projectedHandleResultSetKey,
           h.return_handle_digest AS projectedHandleReturnHandleDigest,
           h.delivery_proof_digest AS projectedHandleDeliveryProofDigest,
           h.operation_key AS projectedHandleOperationKey,
           h.observation_key AS projectedHandleObservationKey,
           h.attestation_version AS projectedHandleAttestationVersion,
           h.attestation_key_id AS projectedHandleAttestationKeyId,
           h.authorization_attestation AS projectedHandleAuthorizationAttestation
         FROM acquisition_capabilities c
         LEFT JOIN acquisition_result_authorizations h
           ON h.handle_digest = ?2
          AND h.session_digest = c.session_digest
          AND h.intent = c.intent
          AND h.canonical_route = c.canonical_route
          AND h.post_action = c.post_action
          AND h.logical_id = c.logical_id
          AND h.generation = c.generation
          AND h.representation = 'returned_form'
          AND h.public_state IN ('validation', 'backend_failure', 'return_form')
         WHERE c.capability_digest = ?1
         LIMIT 1`,
      )
      .bind(capabilityDigest, projectedHandleDigest)
      .first<CapabilityAuthorizationRow>();
    if (row === null) return null;
    if (
      !(await this.authorizationIndex.verifyCapability(
        capabilityFactsFromRow(row),
        attestationFromRow(row),
      ))
    ) {
      return null;
    }

    let handleMatches = projectedHandleDigest === null;
    if (projectedHandleDigest !== null && row.projectedHandleDigest !== null) {
      const handleFacts: ResultAuthorizationFacts = {
        handleDigest: row.projectedHandleDigest,
        sessionDigest: row.projectedHandleSessionDigest!,
        intent: row.projectedHandleIntent!,
        canonicalRoute: row.projectedHandleCanonicalRoute!,
        postAction: row.projectedHandlePostAction!,
        logicalId: row.projectedHandleLogicalId!,
        generation: row.projectedHandleGeneration!,
        representation: row.projectedHandleRepresentation!,
        publicState: row.projectedHandlePublicState!,
        sourceKind: row.projectedHandleSourceKind,
        proofClass: row.projectedHandleProofClass!,
        resultSetKey: row.projectedHandleResultSetKey!,
        returnHandleDigest: row.projectedHandleReturnHandleDigest,
        deliveryProofDigest: row.projectedHandleDeliveryProofDigest,
        operationKey: row.projectedHandleOperationKey,
        observationKey: row.projectedHandleObservationKey,
        issuedAt: row.projectedHandleIssuedAt!,
        expiresAt: row.projectedHandleExpiresAt!,
        cleanupAfter: row.projectedHandleCleanupAfter!,
      };
      handleMatches = await this.authorizationIndex.verifyResult(handleFacts, {
        version:
          row.projectedHandleAttestationVersion as AuthorizationAttestation["version"],
        keyId: row.projectedHandleAttestationKeyId!,
        value: row.projectedHandleAuthorizationAttestation!,
      });
    }

    return {
      capabilityDigest: row.capabilityDigest,
      sessionDigest: row.sessionDigest,
      intent: row.intent,
      canonicalRoute: row.canonicalRoute,
      postAction: row.postAction,
      logicalId: row.logicalId,
      generation: row.generation,
      validUntil: row.validUntil,
      proofCleanupAfter: row.proofCleanupAfter,
      revokedAt: row.revokedAt,
      nodeExpiresAt: row.sourceExpiresAt,
      nodeCleanupAfter: row.sourceCleanupAfter,
      sourceKind: row.sourceKind,
      projectedHandleDigest: handleMatches ? row.projectedHandleDigest : null,
      projectedHandleSessionDigest: handleMatches
        ? row.projectedHandleSessionDigest
        : null,
      projectedHandleIntent: handleMatches ? row.projectedHandleIntent : null,
      projectedHandleCanonicalRoute: handleMatches
        ? row.projectedHandleCanonicalRoute
        : null,
      projectedHandlePostAction: handleMatches
        ? row.projectedHandlePostAction
        : null,
      projectedHandleLogicalId: handleMatches
        ? row.projectedHandleLogicalId
        : null,
      projectedHandleGeneration: handleMatches
        ? row.projectedHandleGeneration
        : null,
      projectedHandleIssuedAt: handleMatches
        ? row.projectedHandleIssuedAt
        : null,
      projectedHandleExpiresAt: handleMatches
        ? row.projectedHandleExpiresAt
        : null,
      projectedHandleCleanupAfter: handleMatches
        ? row.projectedHandleCleanupAfter
        : null,
      logicalProjectionMatches: 1,
      nodeProjectionMatches: 1,
      handleProjectionMatches: handleMatches ? 1 : 0,
    };
  }

  async readResultHandleProjection(
    handleDigest: string,
  ): Promise<ResultHandleProjection | null> {
    requireNonEmpty("Result handle digest", handleDigest);
    const row = await primarySession(this.database)
      .prepare(
        `SELECT
           authorization.handle_digest AS handleDigest,
           authorization.session_digest AS sessionDigest,
           authorization.intent AS intent,
           authorization.canonical_route AS canonicalRoute,
           authorization.post_action AS postAction,
           authorization.logical_id AS logicalId,
           authorization.generation AS generation,
           authorization.representation AS representation,
           authorization.public_state AS publicState,
           authorization.source_kind AS sourceKind,
           authorization.proof_class AS proofClass,
           authorization.result_set_key AS resultSetKey,
           authorization.return_handle_digest AS returnHandleDigest,
           authorization.delivery_proof_digest AS deliveryProofDigest,
           authorization.operation_key AS operationKey,
           authorization.observation_key AS observationKey,
           authorization.issued_at AS issuedAt,
           authorization.expires_at AS expiresAt,
           authorization.cleanup_after AS cleanupAfter,
           authorization.attestation_version AS attestationVersion,
           authorization.attestation_key_id AS attestationKeyId,
           authorization.authorization_attestation AS authorizationAttestation,
           returned.session_digest AS returnedSessionDigest,
           returned.intent AS returnedIntent,
           returned.canonical_route AS returnedCanonicalRoute,
           returned.post_action AS returnedPostAction,
           returned.logical_id AS returnedLogicalId,
           returned.generation AS returnedGeneration,
           returned.representation AS returnedRepresentation,
           returned.public_state AS returnedPublicState,
           returned.source_kind AS returnedSourceKind,
           returned.proof_class AS returnedProofClass,
           returned.result_set_key AS returnedResultSetKey,
           returned.return_handle_digest AS returnedReturnHandleDigest,
           returned.delivery_proof_digest AS returnedDeliveryProofDigest,
           returned.operation_key AS returnedOperationKey,
           returned.observation_key AS returnedObservationKey,
           returned.issued_at AS returnedIssuedAt,
           returned.expires_at AS returnedExpiresAt,
           returned.cleanup_after AS returnedCleanupAfter,
           returned.attestation_version AS returnedAttestationVersion,
           returned.attestation_key_id AS returnedAttestationKeyId,
           returned.authorization_attestation AS returnedAuthorizationAttestation
         FROM acquisition_result_authorizations authorization
         LEFT JOIN acquisition_result_authorizations returned
           ON returned.handle_digest = authorization.return_handle_digest
          AND returned.session_digest = authorization.session_digest
          AND returned.intent = authorization.intent
          AND returned.canonical_route = authorization.canonical_route
          AND returned.post_action = authorization.post_action
          AND returned.logical_id = authorization.logical_id
          AND returned.generation = authorization.generation
          AND returned.source_kind = authorization.source_kind
          AND returned.proof_class = authorization.proof_class
          AND returned.result_set_key = authorization.result_set_key
          AND returned.delivery_proof_digest = authorization.delivery_proof_digest
          AND returned.representation = 'returned_form'
          AND returned.public_state = 'return_form'
         WHERE authorization.handle_digest = ?1
         LIMIT 1`,
      )
      .bind(handleDigest)
      .first<ResultAuthorizationRow>();
    if (row === null) return null;
    if (
      !(await this.authorizationIndex.verifyResult(
        resultFactsFromRow(row),
        attestationFromRow(row),
      ))
    ) {
      return null;
    }
    if (row.publicState === "unknown" || row.publicState === "possible_duplicate") {
      if (
        row.returnedSessionDigest === null ||
        row.returnedExpiresAt === null ||
        row.returnedCleanupAfter === null ||
        row.returnedExpiresAt < row.expiresAt ||
        row.returnedCleanupAfter < row.cleanupAfter
      ) {
        return null;
      }
      const returnedFacts: ResultAuthorizationFacts = {
        handleDigest: row.returnHandleDigest!,
        sessionDigest: row.returnedSessionDigest,
        intent: row.returnedIntent!,
        canonicalRoute: row.returnedCanonicalRoute!,
        postAction: row.returnedPostAction!,
        logicalId: row.returnedLogicalId!,
        generation: row.returnedGeneration!,
        representation: row.returnedRepresentation!,
        publicState: row.returnedPublicState!,
        sourceKind: row.returnedSourceKind,
        proofClass: row.returnedProofClass!,
        resultSetKey: row.returnedResultSetKey!,
        returnHandleDigest: row.returnedReturnHandleDigest,
        deliveryProofDigest: row.returnedDeliveryProofDigest,
        operationKey: row.returnedOperationKey,
        observationKey: row.returnedObservationKey,
        issuedAt: row.returnedIssuedAt!,
        expiresAt: row.returnedExpiresAt,
        cleanupAfter: row.returnedCleanupAfter,
      };
      if (
        !(await this.authorizationIndex.verifyResult(returnedFacts, {
          version:
            row.returnedAttestationVersion as AuthorizationAttestation["version"],
          keyId: row.returnedAttestationKeyId!,
          value: row.returnedAuthorizationAttestation!,
        }))
      ) {
        return null;
      }
    }
    return {
      handleDigest: row.handleDigest,
      lineageKey: null,
      nodeKey: null,
      sessionDigest: row.sessionDigest,
      intent: row.intent,
      canonicalRoute: row.canonicalRoute,
      postAction: row.postAction,
      logicalId: row.logicalId,
      generation: row.generation,
      representation: row.representation,
      publicState: row.publicState,
      issuedAt: row.issuedAt,
      expiresAt: row.expiresAt,
      cleanupAfter: row.cleanupAfter,
    };
  }

  /**
   * Recovers an already-authorized result set after response loss without
   * touching payload, lineage, node, or destination tables.
   */
  async readResultSetProjection(
    resultSetKey: string,
  ): Promise<ResultSetProjection | null> {
    requireNonEmpty("Result-set key", resultSetKey);
    const statement = primarySession(this.database)
      .prepare(
        `SELECT owner.result_set_key AS resultSetKey,
                owner.session_digest AS sessionDigest,
                owner.intent AS intent,
                owner.canonical_route AS canonicalRoute,
                owner.post_action AS postAction,
                owner.logical_id AS logicalId,
                owner.generation AS generation,
                owner.outcome AS outcome,
                owner.created_at AS createdAt,
                owner.cleanup_after AS cleanupAfter,
                authorization.handle_digest AS handleDigest
         FROM acquisition_result_sets owner
         JOIN acquisition_result_authorizations authorization
           ON authorization.result_set_key = owner.result_set_key
          AND authorization.session_digest = owner.session_digest
          AND authorization.intent = owner.intent
          AND authorization.canonical_route = owner.canonical_route
          AND authorization.post_action = owner.post_action
          AND authorization.logical_id = owner.logical_id
          AND authorization.generation = owner.generation
          AND authorization.issued_at >= owner.created_at
          AND authorization.cleanup_after <= owner.cleanup_after
         WHERE owner.result_set_key = ?1
         ORDER BY authorization.issued_at, authorization.handle_digest`,
      )
      .bind(resultSetKey);
    if (statement.all === undefined) {
      throw new Error("The D1 adapter does not support result-set recovery.");
    }
    const rows = await statement.all<ResultSetOwnerRow & { handleDigest: string }>();
    if (!rows.success || rows.results === undefined || rows.results.length === 0) {
      return null;
    }
    const owner = rows.results[0]!;
    if (
      rows.results.some(
        (row) =>
          row.sessionDigest !== owner.sessionDigest ||
          row.intent !== owner.intent ||
          row.canonicalRoute !== owner.canonicalRoute ||
          row.postAction !== owner.postAction ||
          row.logicalId !== owner.logicalId ||
          row.generation !== owner.generation ||
          row.outcome !== owner.outcome ||
          row.createdAt !== owner.createdAt ||
          row.cleanupAfter !== owner.cleanupAfter,
      )
    ) {
      return null;
    }
    const handles = await Promise.all(
      rows.results.map(({ handleDigest }) =>
        this.readResultHandleProjection(handleDigest),
      ),
    );
    if (handles.some((handle) => handle === null)) return null;
    const verified = handles as ResultHandleProjection[];
    const [first] = verified;
    if (
      first === undefined ||
      verified.some(
        (handle) =>
          handle.sessionDigest !== first.sessionDigest ||
          handle.intent !== first.intent ||
          handle.canonicalRoute !== first.canonicalRoute ||
          handle.postAction !== first.postAction ||
          handle.logicalId !== first.logicalId ||
          handle.generation !== first.generation,
      ) ||
      (verified.every((handle) => handle.publicState === "return_form"))
    ) {
      return null;
    }
    const publicStates = verified.map((handle) => handle.publicState).sort();
    const expectedStates: Record<ResultSetOutcome, string[]> = {
      validation: ["validation"],
      backend_failure: ["backend_failure"],
      unknown: ["return_form", "unknown"],
      possible_duplicate: ["possible_duplicate", "return_form"],
      receipt: ["receipt"],
      expired: ["expired"],
    };
    if (
      JSON.stringify(publicStates) !==
      JSON.stringify([...expectedStates[owner.outcome]].sort())
    ) {
      return null;
    }
    return { resultSetKey, handles: verified };
  }

  /** Called only after the exact source K has passed authorization. */
  async recoverAuthorizedSelectionResult(
    nodeKey: string,
    candidateFingerprint: string,
  ): Promise<ResultSetProjection | null> {
    requireNonEmpty("Selection node", nodeKey);
    requireNonEmpty("Candidate fingerprint", candidateFingerprint);
    const winner = await this.readSelectionWinner(nodeKey);
    if (
      winner === null ||
      winner.selectedCandidateFingerprint !== candidateFingerprint ||
      winner.resultSetKey === null
    ) {
      return null;
    }
    return this.readResultSetProjection(winner.resultSetKey);
  }

  async reserveSelection(
    selection: AtomicSelectionCommit,
  ): Promise<SelectionResolution> {
    validateSourceRoute(selection);
    const opaqueValues: ReadonlyArray<readonly [string, string]> = [
      ["Selection marker", selection.selectionKey],
      ["Selection lineage", selection.lineageKey],
      ["Selection node", selection.nodeKey],
      ["Candidate fingerprint", selection.candidateFingerprint],
      ["Payload snapshot reference", selection.payloadSnapshotRef],
    ];
    opaqueValues.forEach(([label, value]) => requireNonEmpty(label, value));
    requireSafeTime("Selection revision", selection.expectedRevision);
    requireSafeTime("Selection time", selection.updatedAt);

    const child = selection.child;
    if ((selection.selectionKind === "child") !== (child !== null)) {
      throw new Error("A child selection requires exactly one child registration.");
    }
    if (selection.selectionKind === "parent" && selection.logicalId.length === 0) {
      throw new Error("A parent selection requires its source logical ID.");
    }
    if (child !== null) {
      requireNonEmpty("Child logical ID", child.logicalId);
      if (child.logicalId === selection.logicalId) {
        throw new Error("A child logical ID must differ from its parent.");
      }
      requireSafeTime("Child creation time", child.createdAt);
      requireSafeTime("Child cleanup time", child.cleanupAfter);
      if (
        child.createdAt !== selection.updatedAt ||
        child.createdAt > child.cleanupAfter
      ) {
        throw new Error("The child logical-ID lifecycle is inconsistent.");
      }
    }

    const selectedLogicalId = child?.logicalId ?? selection.logicalId;
    const childEligible = selection.selectionKind === "child";
    const parentSourcePredicate = childEligible
      ? `source.source_kind IN ('backend_failure', 'unknown', 'possible_duplicate')
           AND source.bound_payload_fingerprint IS NOT NULL
           AND source.bound_payload_fingerprint <> ?10`
      : `(
           source.source_kind IN ('initial', 'validation')
           OR source.bound_payload_fingerprint = ?10
         )`;
    const db = primarySession(this.database);
    const statements: D1PreparedStatementLike[] = [
      db
        .prepare(
          `UPDATE acquisition_nodes AS source
           SET selection_key = ?11
           WHERE source.node_key = ?1
             AND source.lineage_key = ?2
             AND source.logical_id = ?3
             AND source.generation = ?4
             AND source.revision = ?5
             AND source.outcome = 'fresh'
             AND source.selection_kind IS NULL
             AND source.selection_key IS NULL
             AND source.finalization_key IS NULL
             AND source.updated_at <= ?12
             AND ${parentSourcePredicate}
             AND EXISTS (
               SELECT 1 FROM acquisition_lineages lineage
               WHERE lineage.lineage_key = source.lineage_key
                 AND lineage.session_digest = ?6
                 AND lineage.intent = ?7
                 AND lineage.canonical_route = ?8
                 AND lineage.post_action = ?9
             )`,
        )
        .bind(
          selection.nodeKey,
          selection.lineageKey,
          selection.logicalId,
          selection.generation,
          selection.expectedRevision,
          selection.sessionDigest,
          selection.intent,
          selection.canonicalRoute,
          selection.postAction,
          selection.candidateFingerprint,
          selection.selectionKey,
          selection.updatedAt,
        ),
    ];

    if (child !== null) {
      statements.push(
        db
          .prepare(
            `INSERT INTO acquisition_logical_ids
              (logical_id, lineage_key, parent_logical_id, created_at, cleanup_after)
             SELECT ?1, source.lineage_key, source.logical_id, ?2, ?3
             FROM acquisition_nodes source
             WHERE source.node_key = ?4
               AND source.lineage_key = ?5
                AND source.selection_key = ?6
                AND source.updated_at <= ?2
                AND ?3 = source.cleanup_after
               AND ?3 <= (
                 SELECT lineage.cleanup_after
                 FROM acquisition_lineages lineage
                 WHERE lineage.lineage_key = source.lineage_key
               )`,
          )
          .bind(
            child.logicalId,
            child.createdAt,
            child.cleanupAfter,
            selection.nodeKey,
            selection.lineageKey,
            selection.selectionKey,
          ),
      );
    }

    const childCompleteness =
      child === null
        ? "?5 = source.logical_id"
        : `EXISTS (
             SELECT 1 FROM acquisition_logical_ids child
             WHERE child.logical_id = ?5
               AND child.lineage_key = source.lineage_key
               AND child.parent_logical_id = source.logical_id
           )`;
    statements.push(
      db
        .prepare(
          `UPDATE acquisition_nodes AS source
           SET selected_candidate_fingerprint = ?1,
               selected_payload_snapshot_ref = ?2,
               selected_logical_id = ?3,
               selection_kind = ?4,
               outcome = CASE WHEN (${childCompleteness}) THEN 'ready' ELSE NULL END,
               revision = revision + 1,
               updated_at = ?6,
               selection_key = NULL
           WHERE source.node_key = ?7
             AND source.lineage_key = ?8
             AND source.selection_key = ?9`,
        )
        .bind(
          selection.candidateFingerprint,
          selection.payloadSnapshotRef,
          selectedLogicalId,
          selection.selectionKind,
          selectedLogicalId,
          selection.updatedAt,
          selection.nodeKey,
          selection.lineageKey,
          selection.selectionKey,
        ),
    );

    const results = await db.batch(statements);
    if (results.length !== statements.length || results.some((result) => !result.success)) {
      throw new Error("Atomic continuation selection was rolled back.");
    }
    const changes = results.map((result) => result.meta?.changes);
    if (changes.some((count) => count === undefined)) {
      throw new Error("Atomic continuation selection returned no change proof.");
    }
    if (!changes.every((count) => count === 1) && !changes.every((count) => count === 0)) {
      throw new Error("Atomic continuation selection changed an incomplete set.");
    }

    const winner = await this.readSelectionWinner(selection.nodeKey);
    if (winner === null) {
      return changes.every((count) => count === 0)
        ? { kind: "conflict" }
        : (() => {
            throw new Error("Applied selection produced no durable winner.");
          })();
    }
    if (
      winner.lineageKey !== selection.lineageKey ||
      winner.sessionDigest !== selection.sessionDigest ||
      winner.intent !== selection.intent ||
      winner.canonicalRoute !== selection.canonicalRoute ||
      winner.postAction !== selection.postAction ||
      winner.logicalId !== selection.logicalId ||
      winner.generation !== selection.generation
    ) {
      throw new Error("The durable selection winner was rebound.");
    }
    if (winner.selectedCandidateFingerprint !== selection.candidateFingerprint) {
      return { kind: "expired" };
    }
    return {
      kind: changes.every((count) => count === 1) ? "applied" : "replay",
      winner,
    };
  }

  async readSelectionWinner(
    nodeKey: string,
  ): Promise<SelectionWinnerRecord | null> {
    requireNonEmpty("Selection node", nodeKey);
    return primarySession(this.database)
      .prepare(
        `SELECT
           source.lineage_key AS lineageKey,
           source.node_key AS nodeKey,
           lineage.session_digest AS sessionDigest,
           lineage.intent AS intent,
           lineage.canonical_route AS canonicalRoute,
           lineage.post_action AS postAction,
           source.logical_id AS logicalId,
           source.generation AS generation,
           source.source_kind AS sourceKind,
           source.bound_payload_fingerprint AS boundPayloadFingerprint,
           source.outcome AS outcome,
           source.revision AS revision,
           source.selected_candidate_fingerprint AS selectedCandidateFingerprint,
           source.selected_payload_snapshot_ref AS selectedPayloadSnapshotRef,
           source.selected_logical_id AS selectedLogicalId,
           source.selected_node_key AS selectedNodeKey,
           source.result_set_key AS resultSetKey,
           source.selection_kind AS selectionKind,
           source.updated_at AS updatedAt
         FROM acquisition_nodes source
         JOIN acquisition_lineages lineage
           ON lineage.lineage_key = source.lineage_key
         LEFT JOIN acquisition_nodes successor
           ON successor.node_key = source.selected_node_key
          AND successor.lineage_key = source.lineage_key
          AND successor.parent_node_key = source.node_key
          AND successor.logical_id = source.selected_logical_id
          AND successor.generation = source.generation + 1
         WHERE source.node_key = ?1
           AND source.selection_kind IS NOT NULL
           AND source.selection_key IS NULL
           AND (
             (source.outcome = 'ready' AND source.result_set_key IS NULL)
             OR (source.outcome IN ('recorded', 'validation_failed', 'not_recorded', 'indeterminate')
               AND source.result_set_key IS NOT NULL
               AND length(source.result_set_key) > 0)
           )
           AND (
             (source.outcome IN ('ready', 'recorded')
               AND source.selected_node_key IS NULL)
             OR (source.outcome IN ('validation_failed', 'not_recorded', 'indeterminate')
               AND successor.node_key IS NOT NULL)
           )
         LIMIT 1`,
      )
      .bind(nodeKey)
      .first<SelectionWinnerRecord>();
  }

  async reserveOrLoadDispatchIdentityForCreation(
    input: DispatchIdentityCreation,
  ): Promise<DispatchIdentityRecord> {
    validateSourceRoute(input);
    const opaqueValues: ReadonlyArray<readonly [string, string]> = [
      ["Dispatch key", input.dispatchKey],
      ["Dispatch lineage", input.lineageKey],
      ["Dispatch origin node", input.originNodeKey],
      ["Dispatch selected logical ID", input.selectedLogicalId],
      ["Dispatch candidate fingerprint", input.candidateFingerprint],
      ["Dispatch idempotency key", input.idempotencyKey],
      ["Dispatch destination key", input.destinationKey],
    ];
    opaqueValues.forEach(([label, value]) => requireNonEmpty(label, value));
    requireSafeTime("Dispatch creation time", input.createdAt);
    requireSafeTime("Dispatch cleanup time", input.cleanupAfter);
    if (
      input.createdAt > input.cleanupAfter ||
      input.idempotencyKey !== input.selectedLogicalId
    ) {
      throw new Error("The dispatch identity or lifecycle is invalid.");
    }

    const db = primarySession(this.database);
    const [insert, selected] = await db.batch<DispatchIdentityRecord>([
      db
        .prepare(
          `INSERT INTO acquisition_dispatches
            (dispatch_key, lineage_key, origin_node_key, intent, logical_id,
             origin_generation, idempotency_key, destination_key, created_at,
             cleanup_after)
           SELECT ?1, source.lineage_key, source.node_key, lineage.intent,
                  source.selected_logical_id, source.generation, ?2, ?3, ?4, ?5
           FROM acquisition_nodes source
           JOIN acquisition_lineages lineage
             ON lineage.lineage_key = source.lineage_key
            AND lineage.session_digest = ?6
            AND lineage.intent = ?7
            AND lineage.canonical_route = ?8
            AND lineage.post_action = ?9
           JOIN acquisition_logical_ids logical
             ON logical.logical_id = source.selected_logical_id
            AND logical.lineage_key = source.lineage_key
           WHERE source.node_key = ?10
             AND source.lineage_key = ?11
             AND source.logical_id = ?12
             AND source.generation = ?13
             AND source.selected_logical_id = ?14
             AND source.selected_candidate_fingerprint = ?15
              AND source.selection_kind IN ('parent', 'child')
              AND source.selection_key IS NULL
              AND source.outcome = 'ready'
              AND source.updated_at <= ?4
              AND ?5 <= source.cleanup_after
              AND ?5 <= logical.cleanup_after
              AND ?5 <= lineage.cleanup_after
           ON CONFLICT(intent, logical_id) DO NOTHING`,
        )
        .bind(
          input.dispatchKey,
          input.idempotencyKey,
          input.destinationKey,
          input.createdAt,
          input.cleanupAfter,
          input.sessionDigest,
          input.intent,
          input.canonicalRoute,
          input.postAction,
          input.originNodeKey,
          input.lineageKey,
          input.logicalId,
          input.generation,
          input.selectedLogicalId,
          input.candidateFingerprint,
        ),
      db
        .prepare(
          `SELECT identity.dispatch_key AS dispatchKey,
                  identity.lineage_key AS lineageKey,
                  identity.origin_node_key AS originNodeKey,
                  identity.intent AS intent,
                  identity.logical_id AS logicalId,
                  identity.origin_generation AS originGeneration,
                  identity.idempotency_key AS idempotencyKey,
                  identity.destination_key AS destinationKey,
                  identity.created_at AS createdAt,
                  identity.cleanup_after AS cleanupAfter
           FROM acquisition_nodes source
           JOIN acquisition_lineages lineage
             ON lineage.lineage_key = source.lineage_key
            AND lineage.session_digest = ?1
            AND lineage.intent = ?2
            AND lineage.canonical_route = ?3
            AND lineage.post_action = ?4
           JOIN acquisition_logical_ids logical
             ON logical.logical_id = source.selected_logical_id
            AND logical.lineage_key = source.lineage_key
           JOIN acquisition_dispatches identity
             ON identity.intent = lineage.intent
            AND identity.logical_id = source.selected_logical_id
            AND identity.lineage_key = source.lineage_key
            AND identity.idempotency_key = source.selected_logical_id
            AND identity.destination_key = ?5
           WHERE source.node_key = ?6
             AND source.lineage_key = ?7
             AND source.logical_id = ?8
             AND source.generation = ?9
             AND source.selected_logical_id = ?10
             AND source.selected_candidate_fingerprint = ?11
             AND source.selection_kind IN ('parent', 'child')
             AND source.selection_key IS NULL
             AND ?12 <= identity.cleanup_after
             AND ?12 <= source.cleanup_after
             AND ?12 <= logical.cleanup_after
             AND ?12 <= lineage.cleanup_after
           LIMIT 1`,
        )
        .bind(
          input.sessionDigest,
          input.intent,
          input.canonicalRoute,
          input.postAction,
          input.destinationKey,
          input.originNodeKey,
          input.lineageKey,
          input.logicalId,
          input.generation,
          input.selectedLogicalId,
          input.candidateFingerprint,
          input.createdAt,
        ),
    ]);
    if (!insert?.success || !selected?.success) {
      throw new Error("Dispatch identity reservation failed.");
    }
    const winner = selected.results?.[0];
    if (
      winner === undefined ||
      winner.lineageKey !== input.lineageKey ||
      winner.intent !== input.intent ||
      winner.logicalId !== input.selectedLogicalId ||
      winner.idempotencyKey !== input.idempotencyKey ||
      winner.destinationKey !== input.destinationKey
    ) {
      throw new Error("The durable dispatch identity winner was rebound.");
    }
    return winner;
  }

  async loadDispatchIdentityForReconciliation(input: {
    lineageKey: string;
    intent: AcquisitionIntent;
    logicalId: string;
    destinationKey: string;
    checkedAt: number;
  }): Promise<DispatchIdentityRecord | null> {
    requireNonEmpty("Dispatch lineage", input.lineageKey);
    requireNonEmpty("Dispatch logical ID", input.logicalId);
    requireNonEmpty("Dispatch destination", input.destinationKey);
    requireSafeTime("Dispatch identity read time", input.checkedAt);
    const identity = await primarySession(this.database)
      .prepare(
        `SELECT dispatch_key AS dispatchKey, lineage_key AS lineageKey,
                origin_node_key AS originNodeKey, intent AS intent,
                logical_id AS logicalId, origin_generation AS originGeneration,
                idempotency_key AS idempotencyKey,
                destination_key AS destinationKey, created_at AS createdAt,
                cleanup_after AS cleanupAfter
         FROM acquisition_dispatches
         WHERE intent = ?1 AND logical_id = ?2 AND cleanup_after >= ?3
         LIMIT 1`,
      )
      .bind(input.intent, input.logicalId, input.checkedAt)
      .first<DispatchIdentityRecord>();
    if (identity === null) return null;
    if (
      identity.lineageKey !== input.lineageKey ||
      identity.idempotencyKey !== input.logicalId ||
      identity.destinationKey !== input.destinationKey
    ) {
      throw new Error("The reconciliation identity was rebound.");
    }
    return identity;
  }

  async reserveOrLoadDispatchOperation(
    input: DispatchOperationReservation,
  ): Promise<DispatchOperationResolution> {
    validateSourceRoute(input);
    const opaqueValues: ReadonlyArray<readonly [string, string]> = [
      ["Operation key", input.operationKey],
      ["Dispatch key", input.dispatchKey],
      ["Operation lineage", input.lineageKey],
      ["Operation source node", input.sourceNodeKey],
      ["Operation selected logical ID", input.selectedLogicalId],
      ["Operation candidate fingerprint", input.candidateFingerprint],
    ];
    opaqueValues.forEach(([label, value]) => requireNonEmpty(label, value));
    requireSafeTime("Operation reservation time", input.reservedAt);
    requireSafeTime("Operation cleanup time", input.cleanupAfter);
    if (input.reservedAt > input.cleanupAfter) {
      throw new Error("The dispatch-operation lifecycle is invalid.");
    }

    requireNonEmpty("Operation payload snapshot", input.payloadSnapshotRef);
    if (input.authorizationObservationKey === "") {
      throw new Error("An operation authorization observation cannot be empty.");
    }
    const db = primarySession(this.database);
    const [insert, selected] = await db.batch<DispatchOperationRecord>([
      db
        .prepare(
           `INSERT INTO acquisition_dispatch_operations
             (operation_key, dispatch_key, lineage_key, logical_id,
              source_node_key, source_generation, candidate_fingerprint,
              payload_snapshot_ref, authorization_observation_key,
              operation_kind, reserved_at, cleanup_after)
            SELECT ?1, identity.dispatch_key, source.lineage_key,
                   source.selected_logical_id, source.node_key, source.generation,
                   ?5, ?6, ?7, ?2, ?3, ?4
            FROM acquisition_nodes source
            JOIN acquisition_lineages lineage
              ON lineage.lineage_key = source.lineage_key
             AND lineage.session_digest = ?8
             AND lineage.intent = ?9
             AND lineage.canonical_route = ?10
             AND lineage.post_action = ?11
            JOIN acquisition_logical_ids logical
              ON logical.logical_id = source.selected_logical_id
             AND logical.lineage_key = source.lineage_key
            JOIN acquisition_dispatches identity
              ON identity.dispatch_key = ?12
             AND identity.lineage_key = source.lineage_key
             AND identity.intent = lineage.intent
             AND identity.logical_id = source.selected_logical_id
             AND identity.idempotency_key = source.selected_logical_id
            LEFT JOIN acquisition_dispatch_observations authorization_observation
              ON authorization_observation.observation_key = ?7
            LEFT JOIN acquisition_dispatch_operations authorization_operation
              ON authorization_operation.operation_key = authorization_observation.operation_key
             AND authorization_operation.dispatch_key = identity.dispatch_key
             AND authorization_operation.lineage_key = source.lineage_key
             AND authorization_operation.logical_id = source.selected_logical_id
            WHERE source.node_key = ?13
              AND source.lineage_key = ?14
              AND source.logical_id = ?15
              AND source.generation = ?16
              AND source.selected_logical_id = ?17
              AND source.selected_candidate_fingerprint = ?5
              AND source.selected_payload_snapshot_ref = ?6
              AND source.outcome = 'ready'
              AND source.selection_key IS NULL
              AND source.updated_at <= ?3
              AND (
                (?2 = 'dispatch' AND source.selection_kind = 'child'
                  AND ?7 IS NULL)
                OR (?2 = 'dispatch'
                  AND source.selection_kind = 'parent'
                  AND source.source_kind IN ('initial', 'validation')
                  AND ?7 IS NULL)
                OR (?2 = 'dispatch'
                  AND source.selection_kind = 'parent'
                  AND source.source_kind = 'backend_failure'
                  AND authorization_observation.outcome = 'not_recorded'
                  AND authorization_observation.observed_at <= ?3)
                OR (?2 = 'reconcile'
                  AND source.selection_kind = 'parent'
                  AND source.selected_logical_id = source.logical_id
                  AND source.source_kind IN ('unknown', 'possible_duplicate')
                  AND source.bound_payload_fingerprint = source.selected_candidate_fingerprint
                  AND authorization_observation.outcome = 'indeterminate'
                  AND authorization_observation.observed_at <= ?3)
                OR (?2 = 'dispatch'
                  AND source.selection_kind = 'parent'
                  AND source.source_kind IN ('unknown', 'possible_duplicate')
                  AND authorization_operation.operation_kind = 'reconcile'
                  AND authorization_operation.source_node_key = source.node_key
                  AND authorization_observation.outcome = 'not_recorded'
                  AND authorization_observation.observed_at <= ?3)
              )
              AND (
                ?7 IS NULL
                OR (
                  authorization_operation.reserved_at <= authorization_observation.observed_at
                  AND NOT EXISTS (
                    SELECT 1
                    FROM acquisition_dispatch_observations contradiction
                    WHERE contradiction.operation_key = authorization_operation.operation_key
                      AND (
                        (authorization_observation.outcome = 'indeterminate'
                          AND contradiction.outcome IN ('recorded', 'not_recorded'))
                        OR (authorization_observation.outcome = 'not_recorded'
                          AND contradiction.outcome = 'recorded')
                      )
                  )
                )
              )
              AND ?4 <= identity.cleanup_after
              AND ?4 <= lineage.cleanup_after
              AND ?4 <= source.cleanup_after
              AND ?4 <= logical.cleanup_after
            ON CONFLICT(source_node_key, operation_kind) DO NOTHING`,
        )
        .bind(
          input.operationKey,
          input.operationKind,
          input.reservedAt,
          input.cleanupAfter,
          input.candidateFingerprint,
          input.payloadSnapshotRef,
          input.authorizationObservationKey,
          input.sessionDigest,
          input.intent,
          input.canonicalRoute,
          input.postAction,
          input.dispatchKey,
          input.sourceNodeKey,
          input.lineageKey,
          input.logicalId,
          input.generation,
          input.selectedLogicalId,
        ),
      db
        .prepare(
          `SELECT operation.operation_key AS operationKey,
                  operation.dispatch_key AS dispatchKey,
                  operation.lineage_key AS lineageKey,
                  operation.logical_id AS logicalId,
                  operation.source_node_key AS sourceNodeKey,
                  operation.source_generation AS sourceGeneration,
                  operation.candidate_fingerprint AS candidateFingerprint,
                  operation.payload_snapshot_ref AS payloadSnapshotRef,
                  operation.authorization_observation_key AS authorizationObservationKey,
                  operation.operation_kind AS operationKind,
                  operation.reserved_at AS reservedAt,
                  operation.cleanup_after AS cleanupAfter
           FROM acquisition_dispatch_operations operation
           JOIN acquisition_nodes source
             ON source.node_key = operation.source_node_key
            AND source.lineage_key = operation.lineage_key
            AND source.generation = operation.source_generation
            AND source.selected_logical_id = operation.logical_id
           JOIN acquisition_logical_ids logical
             ON logical.logical_id = operation.logical_id
            AND logical.lineage_key = operation.lineage_key
           JOIN acquisition_dispatches identity
             ON identity.dispatch_key = operation.dispatch_key
            AND identity.lineage_key = operation.lineage_key
            AND identity.logical_id = operation.logical_id
           WHERE operation.source_node_key = ?1
             AND operation.operation_kind = ?2
             AND operation.dispatch_key = ?3
             AND operation.candidate_fingerprint = ?4
             AND operation.payload_snapshot_ref = ?5
             AND operation.authorization_observation_key IS ?6
             AND ?7 <= operation.cleanup_after
             AND ?7 <= source.cleanup_after
             AND ?7 <= logical.cleanup_after
             AND ?7 <= identity.cleanup_after
           LIMIT 1`,
        )
        .bind(
          input.sourceNodeKey,
          input.operationKind,
          input.dispatchKey,
          input.candidateFingerprint,
          input.payloadSnapshotRef,
          input.authorizationObservationKey,
          input.reservedAt,
        ),
    ]);
    if (!insert?.success || !selected?.success) {
      throw new Error("Dispatch-operation reservation failed.");
    }
    const winner = selected.results?.[0];
    if (
      winner === undefined ||
      winner.dispatchKey !== input.dispatchKey ||
      winner.lineageKey !== input.lineageKey ||
      winner.logicalId !== input.selectedLogicalId ||
      winner.sourceNodeKey !== input.sourceNodeKey ||
      winner.sourceGeneration !== input.generation ||
      winner.operationKind !== input.operationKind ||
      winner.candidateFingerprint !== input.candidateFingerprint ||
      winner.payloadSnapshotRef !== input.payloadSnapshotRef ||
      winner.authorizationObservationKey !== input.authorizationObservationKey
    ) {
      throw new Error("The durable dispatch-operation winner was rebound.");
    }
    return {
      kind: insert.meta?.changes === 1 ? "applied" : "replay",
      winner,
    };
  }

  async appendOrLoadDispatchObservation(
    input: DispatchObservationAppend,
  ): Promise<DispatchObservationResolution> {
    const opaqueValues: ReadonlyArray<readonly [string, string]> = [
      ["Observation key", input.observationKey],
      ["Operation key", input.operationKey],
      ["Observation digest", input.observationDigest],
    ];
    opaqueValues.forEach(([label, value]) => requireNonEmpty(label, value));
    requireSafeTime("Observation time", input.observedAt);
    requireSafeTime("Observation cleanup time", input.cleanupAfter);
    requireSafeTime("Observation authorization time", input.checkedAt);
    const definitive =
      input.outcome === "recorded" || input.outcome === "not_recorded";
    if (
      input.observedAt > input.checkedAt ||
      input.checkedAt > input.cleanupAfter ||
      (input.acknowledgedAt !== null &&
        input.acknowledgedAt > input.observedAt) ||
      definitive !== (input.acknowledgedAt !== null) ||
      (definitive &&
        (input.evidenceDigest === null || input.evidenceDigest.length === 0)) ||
      (!definitive && input.evidenceDigest === "")
    ) {
      throw new Error("The dispatch observation or lifecycle is invalid.");
    }
    if (input.acknowledgedAt !== null) {
      requireSafeTime("Observation acknowledgement time", input.acknowledgedAt);
    }

    const db = primarySession(this.database);
    const [insert, selected] = await db.batch<DispatchObservationRecord>([
      db
        .prepare(
          `INSERT INTO acquisition_dispatch_observations
            (observation_key, operation_key, observation_digest, outcome,
             evidence_digest, acknowledged_at, observed_at, cleanup_after)
           SELECT ?1, operation.operation_key, ?2, ?3, ?4, ?5, ?6, ?7
           FROM acquisition_dispatch_operations operation
           WHERE operation.operation_key = ?8
              AND operation.reserved_at <= ?6
              AND (?5 IS NULL OR operation.reserved_at <= ?5)
              AND ?6 <= ?9
              AND ?7 <= operation.cleanup_after
           ON CONFLICT(operation_key, observation_digest) DO NOTHING`,
        )
        .bind(
          input.observationKey,
          input.observationDigest,
          input.outcome,
          input.evidenceDigest,
          input.acknowledgedAt,
          input.observedAt,
          input.cleanupAfter,
          input.operationKey,
          input.checkedAt,
        ),
      db
        .prepare(
          `SELECT observation.observation_key AS observationKey,
                  observation.operation_key AS operationKey,
                  observation.observation_digest AS observationDigest,
                  observation.outcome AS outcome,
                  observation.evidence_digest AS evidenceDigest,
                  observation.acknowledged_at AS acknowledgedAt,
                  observation.observed_at AS observedAt,
                  observation.cleanup_after AS cleanupAfter,
                  ?3 AS checkedAt
           FROM acquisition_dispatch_observations observation
           JOIN acquisition_dispatch_operations operation
             ON operation.operation_key = observation.operation_key
           WHERE observation.operation_key = ?1
             AND observation.observation_digest = ?2
             AND ?3 <= observation.cleanup_after
             AND ?3 <= operation.cleanup_after
           LIMIT 1`,
        )
        .bind(input.operationKey, input.observationDigest, input.checkedAt),
    ]);
    if (!insert?.success || !selected?.success) {
      throw new Error("Dispatch observation append failed.");
    }
    const winner = selected.results?.[0];
    if (
      winner === undefined ||
      winner.operationKey !== input.operationKey ||
      winner.observationDigest !== input.observationDigest ||
      winner.outcome !== input.outcome ||
      winner.evidenceDigest !== input.evidenceDigest ||
      winner.acknowledgedAt !== input.acknowledgedAt ||
      winner.observedAt !== input.observedAt ||
      winner.cleanupAfter !== input.cleanupAfter
    ) {
      throw new Error("The durable dispatch observation winner was rebound.");
    }
    return {
      kind: insert.meta?.changes === 1 ? "applied" : "replay",
      winner,
    };
  }

  async readDispatchOperationTruth(operationKey: string): Promise<DispatchTruth> {
    requireNonEmpty("Operation key", operationKey);
    const db = primarySession(this.database);
    const operation = await db
      .prepare(
        `SELECT operation_key AS operationKey, dispatch_key AS dispatchKey,
                reserved_at AS reservedAt
         FROM acquisition_dispatch_operations
         WHERE operation_key = ?1 LIMIT 1`,
      )
      .bind(operationKey)
      .first<{ operationKey: string; dispatchKey: string; reservedAt: number }>();
    if (operation === null) return { kind: "missing" };
    const result = await db
      .prepare(
        `SELECT observation.observation_key AS observationKey,
                observation.operation_key AS operationKey,
                observation.observation_digest AS observationDigest,
                observation.outcome AS outcome,
                observation.evidence_digest AS evidenceDigest,
                observation.acknowledged_at AS acknowledgedAt,
                observation.observed_at AS observedAt,
                observation.cleanup_after AS cleanupAfter
         FROM acquisition_dispatch_operations operation
         JOIN acquisition_dispatch_observations observation
           ON observation.operation_key = operation.operation_key
         WHERE operation.operation_key = ?1
         ORDER BY observation.observed_at ASC, observation.observation_key ASC`,
      )
      .bind(operation.operationKey)
      .run<DispatchObservationRecord>();
    if (!result.success) throw new Error("Dispatch truth read failed.");
    const observations = result.results ?? [];
    const earlierRecorded = await db
      .prepare(
        `SELECT observation.observation_key AS observationKey,
                observation.operation_key AS operationKey,
                observation.observation_digest AS observationDigest,
                observation.outcome AS outcome,
                observation.evidence_digest AS evidenceDigest,
                observation.acknowledged_at AS acknowledgedAt,
                observation.observed_at AS observedAt,
                observation.cleanup_after AS cleanupAfter,
                observation.observed_at AS checkedAt
         FROM acquisition_dispatch_operations prior_operation
         JOIN acquisition_dispatch_observations observation
           ON observation.operation_key = prior_operation.operation_key
          AND observation.outcome = 'recorded'
         WHERE prior_operation.dispatch_key = ?1
           AND prior_operation.operation_key <> ?2
           AND prior_operation.reserved_at <= ?3
         ORDER BY observation.observed_at DESC, observation.observation_key DESC
         LIMIT 1`,
      )
      .bind(operation.dispatchKey, operation.operationKey, operation.reservedAt)
      .first<DispatchObservationRecord>();
    if (observations.length === 0) {
      return earlierRecorded === null
        ? { kind: "unobserved" }
        : { kind: "recorded-elsewhere", observation: earlierRecorded };
    }
    const recorded = observations.find((item) => item.outcome === "recorded");
    const notRecorded = observations.find(
      (item) => item.outcome === "not_recorded",
    );
    if (recorded !== undefined && notRecorded !== undefined) {
      return { kind: "contradiction" };
    }
    if (recorded !== undefined) return { kind: "recorded", observation: recorded };
    if (notRecorded !== undefined) {
      return earlierRecorded === null
        ? { kind: "not_recorded", observation: notRecorded }
        : { kind: "contradiction" };
    }
    return earlierRecorded === null
      ? { kind: "indeterminate", observation: observations.at(-1)! }
      : { kind: "recorded-elsewhere", observation: earlierRecorded };
  }

  /** Creates only a no-data Expired view from an exact, still-provable K. */
  async createExpiryHandle(
    capabilityDigest: string,
    draft: ExpiryHandleDraft,
  ): Promise<{ kind: "applied" | "replay"; handleDigest: string }> {
    requireNonEmpty("Capability digest", capabilityDigest);
    const checkedAt = this.clock.now();
    requireSafeTime("Expiry authorization check time", checkedAt);
    const record: ResultHandleRecord = { ...draft, issuedAt: checkedAt };
    if (record.publicState !== "expired") {
      throw new Error(
        "Transition result handles must be created by atomic finalization.",
      );
    }
    validateResultHandle(record);
    const capability = await this.readAuthorizationProjection(
      capabilityDigest,
      null,
    );
    if (
      capability === null ||
      capability.revokedAt !== null ||
      capability.sessionDigest !== record.sessionDigest ||
      capability.intent !== record.intent ||
      capability.canonicalRoute !== record.canonicalRoute ||
      capability.postAction !== record.postAction ||
      capability.logicalId !== record.logicalId ||
      capability.generation !== record.generation ||
      capability.nodeExpiresAt > checkedAt ||
      capability.proofCleanupAfter <= checkedAt ||
      record.expiresAt !== capability.proofCleanupAfter ||
      record.cleanupAfter !== capability.nodeCleanupAfter
    ) {
      throw new Error("The exact expiry authorization was not provable.");
    }
    const facts: ResultAuthorizationFacts = {
      handleDigest: record.handleDigest,
      sessionDigest: record.sessionDigest,
      intent: record.intent,
      canonicalRoute: record.canonicalRoute,
      postAction: record.postAction,
      logicalId: record.logicalId,
      generation: record.generation,
      representation: "reduced",
      publicState: "expired",
      sourceKind: null,
      proofClass: "exact_expiry",
      resultSetKey: record.resultSetKey,
      returnHandleDigest: null,
      deliveryProofDigest: null,
      operationKey: null,
      observationKey: null,
      issuedAt: record.issuedAt,
      expiresAt: record.expiresAt,
      cleanupAfter: record.cleanupAfter,
    };
    const attestation = storedAttestation(
      await this.authorizationIndex.attestResult(facts),
    );
    const db = primarySession(this.database);
    const [ownerInsert, handleInsert, authorizationInsert, selected] =
      await db.batch<ResultAuthorizationRow>([
      db
        .prepare(
          `INSERT INTO acquisition_result_sets
            (result_set_key, session_digest, intent, canonical_route, post_action,
             logical_id, generation, outcome, created_at, cleanup_after)
           SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, 'expired', ?8, ?9
           FROM acquisition_capabilities capability
           WHERE capability.capability_digest = ?10
             AND capability.session_digest = ?2
             AND capability.intent = ?3
             AND capability.canonical_route = ?4
             AND capability.post_action = ?5
             AND capability.logical_id = ?6
             AND capability.generation = ?7
             AND capability.revoked_at IS NULL
             AND capability.source_expires_at <= ?8
             AND capability.proof_cleanup_after > ?8
             AND capability.source_cleanup_after = ?9
           ON CONFLICT
             (session_digest, intent, canonical_route, post_action, logical_id,
              generation, outcome)
             WHERE outcome = 'expired'
           DO NOTHING`,
        )
        .bind(
          record.resultSetKey,
          record.sessionDigest,
          record.intent,
          record.canonicalRoute,
          record.postAction,
          record.logicalId,
          record.generation,
          record.issuedAt,
          record.cleanupAfter,
          capabilityDigest,
        ),
      db
        .prepare(
          `INSERT INTO acquisition_result_handles
            (handle_digest, lineage_key, node_key, session_digest, intent,
             canonical_route, post_action, logical_id, generation,
             representation, public_state, return_handle_digest,
             payload_fingerprint, result_set_key, issued_at, expires_at,
             cleanup_after)
           SELECT ?1, NULL, NULL, ?2, ?3, ?4, ?5, ?6, ?7, 'reduced',
                  'expired', NULL, NULL, ?8, ?9, ?10, ?11
           FROM acquisition_capabilities capability
           JOIN acquisition_result_sets owner
             ON owner.result_set_key = ?8
            AND owner.session_digest = ?2
            AND owner.intent = ?3
            AND owner.canonical_route = ?4
            AND owner.post_action = ?5
            AND owner.logical_id = ?6
            AND owner.generation = ?7
            AND owner.outcome = 'expired'
            AND owner.created_at = ?9
            AND owner.cleanup_after = ?11
           WHERE capability.capability_digest = ?12
             AND capability.session_digest = ?2
             AND capability.intent = ?3
             AND capability.canonical_route = ?4
             AND capability.post_action = ?5
             AND capability.logical_id = ?6
             AND capability.generation = ?7
             AND capability.revoked_at IS NULL
             AND capability.source_expires_at <= ?9
             AND capability.proof_cleanup_after > ?9
             AND capability.proof_cleanup_after = ?10
             AND capability.source_cleanup_after = ?11
           ON CONFLICT
             (session_digest, intent, canonical_route, post_action, logical_id,
              generation, public_state)
             WHERE public_state = 'expired'
           DO NOTHING`,
        )
        .bind(
          record.handleDigest,
          record.sessionDigest,
          record.intent,
          record.canonicalRoute,
          record.postAction,
          record.logicalId,
          record.generation,
          record.resultSetKey,
          record.issuedAt,
          record.expiresAt,
          record.cleanupAfter,
          capabilityDigest,
        ),
      db
        .prepare(
          `INSERT INTO acquisition_result_authorizations
            (handle_digest, session_digest, intent, canonical_route, post_action,
             logical_id, generation, representation, public_state, source_kind,
             proof_class, result_set_key, return_handle_digest,
             delivery_proof_digest, operation_key, observation_key, issued_at,
             expires_at, cleanup_after, attestation_version,
             attestation_key_id, authorization_attestation)
           SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, 'reduced', 'expired', NULL,
                  'exact_expiry', ?8, NULL, NULL, NULL, NULL, ?9, ?10, ?11,
                  ?12, ?13, ?14
           FROM acquisition_capabilities capability
           JOIN acquisition_result_sets owner
             ON owner.result_set_key = ?8
            AND owner.session_digest = ?2
            AND owner.intent = ?3
            AND owner.canonical_route = ?4
            AND owner.post_action = ?5
            AND owner.logical_id = ?6
            AND owner.generation = ?7
            AND owner.outcome = 'expired'
            AND owner.created_at = ?9
            AND owner.cleanup_after = ?11
           JOIN acquisition_result_handles handle
             ON handle.handle_digest = ?1
            AND handle.lineage_key IS NULL
            AND handle.node_key IS NULL
            AND handle.session_digest = ?2
            AND handle.intent = ?3
            AND handle.canonical_route = ?4
            AND handle.post_action = ?5
            AND handle.logical_id = ?6
            AND handle.generation = ?7
            AND handle.representation = 'reduced'
            AND handle.public_state = 'expired'
            AND handle.return_handle_digest IS NULL
            AND handle.payload_fingerprint IS NULL
            AND handle.result_set_key = ?8
            AND handle.issued_at = ?9
            AND handle.expires_at = ?10
            AND handle.cleanup_after = ?11
           WHERE capability.capability_digest = ?15
             AND capability.session_digest = ?2
             AND capability.intent = ?3
             AND capability.canonical_route = ?4
             AND capability.post_action = ?5
             AND capability.logical_id = ?6
             AND capability.generation = ?7
             AND capability.revoked_at IS NULL
             AND capability.source_expires_at <= ?9
             AND capability.proof_cleanup_after > ?9
             AND capability.proof_cleanup_after = ?10
             AND capability.source_cleanup_after = ?11
           ON CONFLICT
             (session_digest, intent, canonical_route, post_action, logical_id,
              generation, public_state)
             WHERE public_state = 'expired'
           DO NOTHING`,
        )
        .bind(
          record.handleDigest,
          record.sessionDigest,
          record.intent,
          record.canonicalRoute,
          record.postAction,
          record.logicalId,
          record.generation,
          record.resultSetKey,
          record.issuedAt,
          record.expiresAt,
          record.cleanupAfter,
          attestation.attestationVersion,
          attestation.attestationKeyId,
          attestation.authorizationAttestation,
          capabilityDigest,
        ),
      db
        .prepare(
          `SELECT authorization.handle_digest AS handleDigest,
                  authorization.session_digest AS sessionDigest,
                  authorization.intent AS intent,
                  authorization.canonical_route AS canonicalRoute,
                  authorization.post_action AS postAction,
                  authorization.logical_id AS logicalId,
                  authorization.generation AS generation,
                  authorization.representation AS representation,
                  authorization.public_state AS publicState,
                  authorization.source_kind AS sourceKind,
                  authorization.proof_class AS proofClass,
                  authorization.result_set_key AS resultSetKey,
                  authorization.return_handle_digest AS returnHandleDigest,
                  authorization.delivery_proof_digest AS deliveryProofDigest,
                  authorization.operation_key AS operationKey,
                  authorization.observation_key AS observationKey,
                  authorization.issued_at AS issuedAt,
                  authorization.expires_at AS expiresAt,
                  authorization.cleanup_after AS cleanupAfter,
                  authorization.attestation_version AS attestationVersion,
                  authorization.attestation_key_id AS attestationKeyId,
                  authorization.authorization_attestation AS authorizationAttestation,
                  NULL AS returnedSessionDigest, NULL AS returnedIntent,
                  NULL AS returnedCanonicalRoute, NULL AS returnedPostAction,
                  NULL AS returnedLogicalId, NULL AS returnedGeneration,
                  NULL AS returnedRepresentation, NULL AS returnedPublicState,
                  NULL AS returnedSourceKind, NULL AS returnedProofClass,
                   NULL AS returnedResultSetKey, NULL AS returnedReturnHandleDigest,
                   NULL AS returnedDeliveryProofDigest, NULL AS returnedOperationKey,
                   NULL AS returnedObservationKey, NULL AS returnedIssuedAt,
                  NULL AS returnedExpiresAt, NULL AS returnedCleanupAfter,
                  NULL AS returnedAttestationVersion,
                  NULL AS returnedAttestationKeyId,
                  NULL AS returnedAuthorizationAttestation
           FROM acquisition_result_authorizations authorization
           JOIN acquisition_result_sets owner
             ON owner.result_set_key = authorization.result_set_key
            AND owner.session_digest = authorization.session_digest
            AND owner.intent = authorization.intent
            AND owner.canonical_route = authorization.canonical_route
            AND owner.post_action = authorization.post_action
            AND owner.logical_id = authorization.logical_id
            AND owner.generation = authorization.generation
            AND owner.outcome = 'expired'
            AND owner.created_at = authorization.issued_at
            AND owner.cleanup_after = authorization.cleanup_after
           JOIN acquisition_result_handles handle
             ON handle.handle_digest = authorization.handle_digest
            AND handle.lineage_key IS NULL
            AND handle.node_key IS NULL
            AND handle.session_digest = authorization.session_digest
            AND handle.intent = authorization.intent
            AND handle.canonical_route = authorization.canonical_route
            AND handle.post_action = authorization.post_action
            AND handle.logical_id = authorization.logical_id
            AND handle.generation = authorization.generation
            AND handle.representation = 'reduced'
            AND handle.public_state = 'expired'
            AND handle.return_handle_digest IS NULL
            AND handle.payload_fingerprint IS NULL
            AND handle.result_set_key = authorization.result_set_key
            AND handle.issued_at = authorization.issued_at
            AND handle.expires_at = authorization.expires_at
            AND handle.cleanup_after = authorization.cleanup_after
           JOIN acquisition_capabilities capability
             ON capability.capability_digest = ?1
            AND capability.session_digest = ?2
            AND capability.intent = ?3
            AND capability.canonical_route = ?4
            AND capability.post_action = ?5
            AND capability.logical_id = ?6
            AND capability.generation = ?7
            AND capability.revoked_at IS NULL
            AND capability.source_expires_at <= ?8
            AND capability.proof_cleanup_after > ?8
            AND authorization.expires_at = capability.proof_cleanup_after
            AND authorization.cleanup_after = capability.source_cleanup_after
           WHERE authorization.session_digest = ?2
             AND authorization.intent = ?3
             AND authorization.canonical_route = ?4
             AND authorization.post_action = ?5
             AND authorization.logical_id = ?6
             AND authorization.generation = ?7
             AND authorization.public_state = 'expired'
             AND authorization.representation = 'reduced'
             AND authorization.source_kind IS NULL
             AND authorization.proof_class = 'exact_expiry'
             AND authorization.return_handle_digest IS NULL
             AND authorization.delivery_proof_digest IS NULL
             AND authorization.operation_key IS NULL
             AND authorization.observation_key IS NULL
             AND authorization.issued_at <= ?8
             AND authorization.expires_at > ?8
             AND authorization.cleanup_after > ?8
           LIMIT 1`,
        )
        .bind(
          capabilityDigest,
          record.sessionDigest,
          record.intent,
          record.canonicalRoute,
          record.postAction,
          record.logicalId,
          record.generation,
          checkedAt,
        ),
    ]);
    const winner = selected?.results?.[0];
    if (
      !ownerInsert?.success ||
      !handleInsert?.success ||
      !authorizationInsert?.success ||
      !selected?.success ||
      winner === undefined ||
      !(await this.authorizationIndex.verifyResult(
        resultFactsFromRow(winner),
        attestationFromRow(winner),
      ))
    ) {
      throw new Error("The exact expiry authorization was not provable.");
    }
    if (
      winner.sessionDigest !== record.sessionDigest ||
      winner.intent !== record.intent ||
      winner.canonicalRoute !== record.canonicalRoute ||
      winner.postAction !== record.postAction ||
      winner.logicalId !== record.logicalId ||
      winner.generation !== record.generation ||
      winner.representation !== "reduced" ||
      winner.publicState !== "expired" ||
      winner.sourceKind !== null ||
      winner.proofClass !== "exact_expiry" ||
      winner.returnHandleDigest !== null ||
      winner.deliveryProofDigest !== null ||
      winner.issuedAt > checkedAt ||
      winner.expiresAt <= checkedAt ||
      winner.cleanupAfter <= checkedAt
    ) {
      throw new Error("The expiry-handle winner was rebound.");
    }
    const handleChanges = handleInsert.meta?.changes;
    const authorizationChanges = authorizationInsert.meta?.changes;
    const ownerChanges = ownerInsert.meta?.changes;
    if (authorizationChanges === 1 && handleChanges === 1 && ownerChanges === 1) {
      return { kind: "applied", handleDigest: winner.handleDigest };
    }
    if (ownerChanges === 0 && handleChanges === 0 && authorizationChanges === 0) {
      return { kind: "replay", handleDigest: winner.handleDigest };
    }
    throw new Error("Expiry-handle creation changed an incomplete authorization set.");
  }

  /**
   * Commits the completed source, optional next authority, and every returned
   * representation in one D1 batch. A persisted finalization marker gates
   * every dependent statement; the final NOT NULL guard forces transaction
   * rollback if any expected row is absent. A losing revision writes nothing.
   */
  async finalizeTransition(
    input: AtomicTransitionFinalization,
  ): Promise<"applied" | "conflict"> {
    requireNonEmpty("Finalization key", input.finalizationKey);
    const orderedHandles = validateAtomicFinalization(input);
    const { completion, next } = input;
    const deliveryProofDigest =
      completion.operationKey === null || completion.observationKey === null
        ? null
        : await this.authorizationIndex.digestDeliveryProof(
            completion.operationKey,
            completion.observationKey,
          );
    const nextCapability =
      next === null
        ? null
        : {
            facts: {
              capabilityDigest: next.capabilityDigest,
              sessionDigest: next.sessionDigest,
              intent: next.intent,
              canonicalRoute: next.canonicalRoute,
              postAction: next.postAction,
              logicalId: next.logicalId,
              generation: next.generation,
              sourceKind: next.sourceKind,
              issuedAt: next.capabilityIssuedAt,
              sourceExpiresAt: next.expiresAt,
              validUntil: next.capabilityValidUntil,
              proofCleanupAfter: next.capabilityProofCleanupAfter,
              sourceCleanupAfter: next.cleanupAfter,
            } satisfies CapabilityAuthorizationFacts,
            attestation: storedAttestation(
              await this.authorizationIndex.attestCapability({
                capabilityDigest: next.capabilityDigest,
                sessionDigest: next.sessionDigest,
                intent: next.intent,
                canonicalRoute: next.canonicalRoute,
                postAction: next.postAction,
                logicalId: next.logicalId,
                generation: next.generation,
                sourceKind: next.sourceKind,
                issuedAt: next.capabilityIssuedAt,
                sourceExpiresAt: next.expiresAt,
                validUntil: next.capabilityValidUntil,
                proofCleanupAfter: next.capabilityProofCleanupAfter,
                sourceCleanupAfter: next.cleanupAfter,
              }),
            ),
          };
    const resultAuthorizations = await Promise.all(
      orderedHandles.map(async (record) => {
        const shape = expectedAuthorizationShape({ completion, next, record });
        const facts: ResultAuthorizationFacts = {
          handleDigest: record.handleDigest,
          sessionDigest: record.sessionDigest,
          intent: record.intent,
          canonicalRoute: record.canonicalRoute,
          postAction: record.postAction,
          logicalId: record.logicalId,
          generation: record.generation,
          representation: record.representation,
          publicState: record.publicState,
          sourceKind: shape.sourceKind,
          proofClass: shape.proofClass,
          resultSetKey: input.resultSetKey,
          returnHandleDigest: record.returnHandleDigest,
          deliveryProofDigest,
          operationKey: record.operationKey,
          observationKey: record.observationKey,
          issuedAt: record.issuedAt,
          expiresAt: record.expiresAt,
          cleanupAfter: record.cleanupAfter,
        };
        return {
          record,
          facts,
          attestation: storedAttestation(
            await this.authorizationIndex.attestResult(facts),
          ),
        };
      }),
    );
    const selectedNodeKey = next?.nodeKey ?? null;
    const resultSetOutcome = transitionResultSetOutcome(completion, next);
    const resultSetCreatedAt = Math.min(
      ...orderedHandles.map((record) => record.issuedAt),
    );
    const resultSetHandleCleanupAfter = Math.max(
      ...orderedHandles.map((record) => record.cleanupAfter),
    );
    const completionBindings = atomicCompletionBindings(completion);
    const db = primarySession(this.database);
    const statements: D1PreparedStatementLike[] = [];

    statements.push(
      db
        .prepare(
           `UPDATE acquisition_nodes AS source
           SET finalization_key = ?19
           WHERE ${atomicCompletionPredicate}
             AND source.finalization_key IS NULL`,
        )
        .bind(...completionBindings, input.finalizationKey),
    );

    statements.push(
      db
        .prepare(
          `INSERT INTO acquisition_result_sets
            (result_set_key, session_digest, intent, canonical_route, post_action,
             logical_id, generation, outcome, created_at, cleanup_after)
           SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, source.cleanup_after
           FROM acquisition_nodes source
           WHERE source.node_key = ?11
             AND source.lineage_key = ?12
             AND source.finalization_key = ?13
             AND ?9 >= source.updated_at
             AND ?10 <= source.cleanup_after
             AND ?10 <= (
               SELECT lineage.cleanup_after
               FROM acquisition_lineages lineage
               WHERE lineage.lineage_key = source.lineage_key
             )
             AND ?10 <= (
               SELECT logical.cleanup_after
               FROM acquisition_logical_ids logical
               WHERE logical.logical_id = ?6
                 AND logical.lineage_key = source.lineage_key
             )`,
        )
        .bind(
          input.resultSetKey,
          completion.sessionDigest,
          completion.intent,
          completion.canonicalRoute,
          completion.postAction,
          completion.selectedLogicalId,
          next?.generation ?? completion.sourceGeneration,
          resultSetOutcome,
          resultSetCreatedAt,
          resultSetHandleCleanupAfter,
          completion.nodeKey,
          completion.lineageKey,
          input.finalizationKey,
        ),
    );

    if (next !== null) {
      statements.push(
        db
          .prepare(
            `INSERT INTO acquisition_nodes
              (node_key, lineage_key, parent_node_key, logical_id, generation,
               source_kind, bound_payload_fingerprint, outcome, revision,
               created_at, updated_at, expires_at, cleanup_after)
             SELECT ?1, source.lineage_key, ?2, ?3, ?4, ?5, ?6, 'fresh', 0,
                    ?7, ?7, ?8, ?9
             FROM acquisition_nodes source
             WHERE source.node_key = ?10
               AND source.lineage_key = ?11
               AND source.finalization_key = ?12
               AND ?7 >= source.updated_at
               AND ?9 = source.cleanup_after
               AND ?9 <= (
                 SELECT lineage.cleanup_after
                 FROM acquisition_lineages lineage
                 WHERE lineage.lineage_key = source.lineage_key
               )
               AND ?9 <= (
                 SELECT logical.cleanup_after
                 FROM acquisition_logical_ids logical
                 WHERE logical.logical_id = ?3
                   AND logical.lineage_key = source.lineage_key
               )`,
          )
          .bind(
            next.nodeKey,
            next.parentNodeKey,
            next.logicalId,
            next.generation,
            next.sourceKind,
            next.boundPayloadFingerprint,
            next.createdAt,
            next.expiresAt,
            next.cleanupAfter,
            completion.nodeKey,
            completion.lineageKey,
            input.finalizationKey,
          ),
      );

      statements.push(
        db
          .prepare(
             `INSERT INTO acquisition_capabilities
               (capability_digest, lineage_key, node_key, session_digest, intent,
                canonical_route, post_action, logical_id, generation, issued_at,
                source_kind, source_expires_at, valid_until, proof_cleanup_after,
                source_cleanup_after, revoked_at, attestation_version,
                attestation_key_id, authorization_attestation)
              SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12,
                     ?13, ?14, ?15, NULL, ?16, ?17, ?18
              FROM acquisition_nodes source
              WHERE source.node_key = ?19
                AND source.lineage_key = ?20
                AND source.finalization_key = ?21
                AND ?10 >= source.updated_at
                AND ?15 <= source.cleanup_after
                AND ?15 <= (
                  SELECT lineage.cleanup_after
                  FROM acquisition_lineages lineage
                  WHERE lineage.lineage_key = source.lineage_key
                )
                AND ?15 <= (
                  SELECT logical.cleanup_after
                  FROM acquisition_logical_ids logical
                  WHERE logical.logical_id = ?8
                    AND logical.lineage_key = source.lineage_key
                )`,
          )
          .bind(
            next.capabilityDigest,
            next.lineageKey,
            next.nodeKey,
            next.sessionDigest,
            next.intent,
            next.canonicalRoute,
            next.postAction,
            next.logicalId,
            next.generation,
            next.capabilityIssuedAt,
            next.sourceKind,
            next.expiresAt,
            next.capabilityValidUntil,
            next.capabilityProofCleanupAfter,
            next.cleanupAfter,
            nextCapability!.attestation.attestationVersion,
            nextCapability!.attestation.attestationKeyId,
            nextCapability!.attestation.authorizationAttestation,
            completion.nodeKey,
            completion.lineageKey,
            input.finalizationKey,
          ),
      );
    }

    resultAuthorizations.forEach(({ record, facts, attestation }) => {
      statements.push(
        db
          .prepare(
            `INSERT INTO acquisition_result_handles
              (handle_digest, lineage_key, node_key, session_digest, intent,
               canonical_route, post_action, logical_id, generation,
               representation, public_state, return_handle_digest,
               payload_fingerprint, result_set_key, issued_at, expires_at,
               cleanup_after)
             SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12,
                      ?13, ?14, ?15, ?16, ?17
             FROM acquisition_nodes source
             WHERE source.node_key = ?18
               AND source.lineage_key = ?19
               AND source.finalization_key = ?20
               AND ?15 >= source.updated_at
               AND ?17 <= source.cleanup_after
               AND ?17 <= (
                 SELECT lineage.cleanup_after
                 FROM acquisition_lineages lineage
                 WHERE lineage.lineage_key = source.lineage_key
               )
               AND ?17 <= (
                 SELECT logical.cleanup_after
                 FROM acquisition_logical_ids logical
                 WHERE logical.logical_id = ?8
                   AND logical.lineage_key = source.lineage_key
               )
               AND NOT EXISTS (
                 SELECT 1 FROM acquisition_capabilities replay_proof
                 WHERE replay_proof.node_key = source.node_key
                   AND replay_proof.lineage_key = source.lineage_key
                   AND replay_proof.revoked_at IS NULL
                   AND replay_proof.proof_cleanup_after > ?17
               )`,
          )
          .bind(
            record.handleDigest,
            record.lineageKey,
            record.nodeKey,
            record.sessionDigest,
            record.intent,
            record.canonicalRoute,
            record.postAction,
            record.logicalId,
            record.generation,
            record.representation,
            record.publicState,
            record.returnHandleDigest,
            record.payloadFingerprint,
            record.resultSetKey,
            record.issuedAt,
            record.expiresAt,
            record.cleanupAfter,
            completion.nodeKey,
            completion.lineageKey,
            input.finalizationKey,
          ),
      );

      const authorizationInsert =
        record.operationKey === null
          ? `INSERT INTO acquisition_result_authorizations
              (handle_digest, session_digest, intent, canonical_route, post_action,
               logical_id, generation, representation, public_state, source_kind,
               proof_class, result_set_key, return_handle_digest,
               delivery_proof_digest, operation_key, observation_key, issued_at,
               expires_at, cleanup_after, attestation_version,
               attestation_key_id, authorization_attestation)
             SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12,
                    ?13, ?14, NULL, NULL, ?15, ?16, ?17, ?18, ?19, ?20
             FROM acquisition_nodes source
             WHERE source.node_key = ?21
               AND source.lineage_key = ?22
               AND source.finalization_key = ?23
               AND ?15 >= source.updated_at
               AND ?17 <= source.cleanup_after
               AND ?17 <= (
                 SELECT lineage.cleanup_after
                 FROM acquisition_lineages lineage
                 WHERE lineage.lineage_key = source.lineage_key
               )
               AND ?17 <= (
                 SELECT logical.cleanup_after
                 FROM acquisition_logical_ids logical
                 WHERE logical.logical_id = ?6
                   AND logical.lineage_key = source.lineage_key
               )`
          : `INSERT INTO acquisition_result_authorizations
              (handle_digest, session_digest, intent, canonical_route, post_action,
               logical_id, generation, representation, public_state, source_kind,
               proof_class, result_set_key, return_handle_digest,
               delivery_proof_digest, operation_key, observation_key, issued_at,
               expires_at, cleanup_after, attestation_version,
               attestation_key_id, authorization_attestation)
             SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12,
                    ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22
             FROM acquisition_nodes source
             JOIN acquisition_dispatch_operations operation
               ON operation.operation_key = ?15
              AND operation.source_node_key = source.node_key
              AND operation.source_generation = source.generation
              AND operation.lineage_key = source.lineage_key
              AND operation.logical_id = source.selected_logical_id
              AND operation.candidate_fingerprint = source.selected_candidate_fingerprint
              AND operation.payload_snapshot_ref = source.selected_payload_snapshot_ref
             JOIN acquisition_dispatch_observations observation
               ON observation.observation_key = ?16
              AND observation.operation_key = operation.operation_key
             JOIN acquisition_dispatches dispatch
               ON dispatch.dispatch_key = operation.dispatch_key
              AND dispatch.lineage_key = operation.lineage_key
              AND dispatch.logical_id = operation.logical_id
             WHERE source.node_key = ?23
               AND source.lineage_key = ?24
               AND source.finalization_key = ?25
               AND ?17 >= source.updated_at
               AND observation.observed_at <= ?17
               AND operation.cleanup_after >= ?19
               AND observation.cleanup_after >= ?19
               AND dispatch.cleanup_after >= ?19
               AND ?19 <= source.cleanup_after
               AND ?19 <= (
                 SELECT lineage.cleanup_after
                 FROM acquisition_lineages lineage
                 WHERE lineage.lineage_key = source.lineage_key
               )
               AND ?19 <= (
                 SELECT logical.cleanup_after
                 FROM acquisition_logical_ids logical
                 WHERE logical.logical_id = ?6
                   AND logical.lineage_key = source.lineage_key
               )`;

      const authorizationValues: unknown[] = [
        record.handleDigest,
        record.sessionDigest,
        record.intent,
        record.canonicalRoute,
        record.postAction,
        record.logicalId,
        record.generation,
        record.representation,
        record.publicState,
        facts.sourceKind,
        facts.proofClass,
        facts.resultSetKey,
        record.returnHandleDigest,
        facts.deliveryProofDigest,
      ];
      if (record.operationKey !== null) {
        authorizationValues.push(record.operationKey, record.observationKey);
      }
      authorizationValues.push(
        record.issuedAt,
        record.expiresAt,
        record.cleanupAfter,
        attestation.attestationVersion,
        attestation.attestationKeyId,
        attestation.authorizationAttestation,
        completion.nodeKey,
        completion.lineageKey,
        input.finalizationKey,
      );
      statements.push(
        db.prepare(authorizationInsert).bind(...authorizationValues),
      );
    });

    const completenessPredicates: string[] = [];
    const completenessValues: unknown[] = [];
    completenessPredicates.push(
      `EXISTS (
        SELECT 1 FROM acquisition_result_sets result_set
        WHERE result_set.result_set_key = ?
          AND result_set.session_digest = ?
          AND result_set.intent = ?
          AND result_set.canonical_route = ?
          AND result_set.post_action = ?
          AND result_set.logical_id = ?
          AND result_set.generation = ?
          AND result_set.outcome = ?
          AND result_set.created_at = ?
          AND result_set.cleanup_after = source.cleanup_after
      )`,
    );
    completenessValues.push(
      input.resultSetKey,
      completion.sessionDigest,
      completion.intent,
      completion.canonicalRoute,
      completion.postAction,
      completion.selectedLogicalId,
      next?.generation ?? completion.sourceGeneration,
      resultSetOutcome,
      resultSetCreatedAt,
    );
    if (next !== null) {
      completenessPredicates.push(
        `EXISTS (
          SELECT 1 FROM acquisition_nodes child
          WHERE child.node_key = ?
            AND child.lineage_key = source.lineage_key
            AND child.parent_node_key = source.node_key
            AND child.logical_id = ?
            AND child.generation = ?
            AND child.source_kind = ?
            AND child.bound_payload_fingerprint IS ?
            AND child.outcome = 'fresh'
            AND child.revision = 0
            AND child.result_set_key IS NULL
            AND child.selection_kind IS NULL
            AND child.selected_node_key IS NULL
            AND child.created_at = ?
            AND child.updated_at = ?
            AND child.expires_at = ?
            AND child.cleanup_after = ?
        )`,
        `EXISTS (
          SELECT 1 FROM acquisition_capabilities capability
          WHERE capability.capability_digest = ?
            AND capability.lineage_key = source.lineage_key
            AND capability.node_key = ?
            AND capability.session_digest = ?
            AND capability.intent = ?
            AND capability.canonical_route = ?
            AND capability.post_action = ?
            AND capability.logical_id = ?
            AND capability.generation = ?
            AND capability.source_kind = ?
            AND capability.issued_at = ?
            AND capability.source_expires_at = ?
            AND capability.valid_until = ?
            AND capability.proof_cleanup_after = ?
            AND capability.source_cleanup_after = ?
            AND capability.revoked_at IS NULL
            AND capability.attestation_version = ?
            AND capability.attestation_key_id = ?
            AND capability.authorization_attestation = ?
        )`,
      );
      completenessValues.push(
        next.nodeKey,
        next.logicalId,
        next.generation,
        next.sourceKind,
        next.boundPayloadFingerprint,
        next.createdAt,
        next.createdAt,
        next.expiresAt,
        next.cleanupAfter,
        next.capabilityDigest,
        next.nodeKey,
        next.sessionDigest,
        next.intent,
        next.canonicalRoute,
        next.postAction,
        next.logicalId,
        next.generation,
        next.sourceKind,
        next.capabilityIssuedAt,
        next.expiresAt,
        next.capabilityValidUntil,
        next.capabilityProofCleanupAfter,
        next.cleanupAfter,
        nextCapability!.attestation.attestationVersion,
        nextCapability!.attestation.attestationKeyId,
        nextCapability!.attestation.authorizationAttestation,
      );
    }
    resultAuthorizations.forEach(({ record, facts, attestation }) => {
      completenessPredicates.push(
        `EXISTS (
          SELECT 1 FROM acquisition_result_handles handle
          WHERE handle.handle_digest = ?
            AND handle.lineage_key = source.lineage_key
            AND handle.node_key = ?
            AND handle.session_digest = ?
            AND handle.intent = ?
            AND handle.canonical_route = ?
            AND handle.post_action = ?
            AND handle.logical_id = ?
            AND handle.generation = ?
            AND handle.representation = ?
             AND handle.public_state = ?
             AND handle.return_handle_digest IS ?
             AND handle.payload_fingerprint IS ?
             AND handle.result_set_key = ?
             AND handle.issued_at = ?
             AND handle.expires_at = ?
             AND handle.cleanup_after = ?
        )`,
        `EXISTS (
          SELECT 1 FROM acquisition_result_authorizations authorization
          WHERE authorization.handle_digest = ?
            AND authorization.session_digest = ?
            AND authorization.intent = ?
            AND authorization.canonical_route = ?
            AND authorization.post_action = ?
            AND authorization.logical_id = ?
            AND authorization.generation = ?
            AND authorization.representation = ?
            AND authorization.public_state = ?
            AND authorization.source_kind IS ?
            AND authorization.proof_class = ?
            AND authorization.result_set_key = ?
            AND authorization.return_handle_digest IS ?
            AND authorization.delivery_proof_digest IS ?
            AND authorization.operation_key IS ?
            AND authorization.observation_key IS ?
            AND authorization.issued_at = ?
            AND authorization.expires_at = ?
            AND authorization.cleanup_after = ?
            AND authorization.attestation_version = ?
            AND authorization.attestation_key_id = ?
            AND authorization.authorization_attestation = ?
        )`,
      );
      completenessValues.push(
        record.handleDigest,
        record.nodeKey,
        record.sessionDigest,
        record.intent,
        record.canonicalRoute,
        record.postAction,
        record.logicalId,
        record.generation,
        record.representation,
        record.publicState,
        record.returnHandleDigest,
        record.payloadFingerprint,
        record.resultSetKey,
        record.issuedAt,
        record.expiresAt,
        record.cleanupAfter,
        record.handleDigest,
        record.sessionDigest,
        record.intent,
        record.canonicalRoute,
        record.postAction,
        record.logicalId,
        record.generation,
        record.representation,
        record.publicState,
        facts.sourceKind,
        facts.proofClass,
        facts.resultSetKey,
        record.returnHandleDigest,
        facts.deliveryProofDigest,
        record.operationKey,
        record.observationKey,
        record.issuedAt,
        record.expiresAt,
        record.cleanupAfter,
        attestation.attestationVersion,
        attestation.attestationKeyId,
        attestation.authorizationAttestation,
      );
    });

    statements.push(
      db
        .prepare(
          `UPDATE acquisition_nodes AS source
           SET selected_node_key = ?,
               result_set_key = ?,
               outcome = CASE
                 WHEN (${completenessPredicates.join(" AND ")}) THEN ?
                 ELSE NULL
               END,
               revision = revision + 1,
               updated_at = ?,
               finalization_key = NULL
           WHERE source.node_key = ?
             AND source.lineage_key = ?
             AND source.finalization_key = ?`,
        )
        .bind(
          selectedNodeKey,
          input.resultSetKey,
          ...completenessValues,
          completion.outcome,
          completion.updatedAt,
          completion.nodeKey,
          completion.lineageKey,
          input.finalizationKey,
        ),
    );

    const results = await db.batch(statements);
    if (results.length !== statements.length || results.some((result) => !result.success)) {
      throw new Error("Atomic acquisition finalization was rolled back.");
    }
    const changes = results.map((result) => result.meta?.changes);
    if (changes.some((count) => count === undefined)) {
      throw new Error("Atomic acquisition finalization returned no change proof.");
    }
    if (changes.every((count) => count === 0)) {
      return "conflict";
    }
    if (!changes.every((count) => count === 1)) {
      throw new Error("Atomic acquisition finalization changed an incomplete set.");
    }
    return "applied";
  }

  async cleanupAuthorizationProofs(): Promise<number> {
    const now = this.clock.now();
    requireSafeTime("Authorization cleanup time", now);
    const result = await primarySession(this.database)
      .prepare(
        `DELETE FROM acquisition_capabilities
         WHERE proof_cleanup_after <= ?1`,
      )
      .bind(now)
      .run();
    if (!result.success) throw new Error("Authorization cleanup failed.");
    return result.meta?.changes ?? 0;
  }

  /**
   * Performs a dependency-ordered dormant-state sweep. Retention horizons are
   * caller-owned policy inputs stored on each row; this method invents none.
   */
  async cleanupExpiredState(): Promise<AcquisitionCleanupReport> {
    const now = this.clock.now();
    requireSafeTime("Acquisition cleanup time", now);
    const db = primarySession(this.database);
    const results = await db.batch([
      db
        .prepare(
          `DELETE FROM acquisition_result_authorizations AS authorization
           WHERE authorization.cleanup_after <= ?1
             AND EXISTS (
               SELECT 1 FROM acquisition_result_handles handle
               WHERE handle.handle_digest = authorization.handle_digest
                 AND handle.cleanup_after <= ?1
             )`,
        )
        .bind(now),
      db
        .prepare(
          `DELETE FROM acquisition_result_handles AS handle
           WHERE handle.cleanup_after <= ?1
             AND handle.return_handle_digest IS NOT NULL
             AND NOT EXISTS (
               SELECT 1 FROM acquisition_result_authorizations authorization
               WHERE authorization.handle_digest = handle.handle_digest
             )`,
        )
        .bind(now),
      db
        .prepare(
          `DELETE FROM acquisition_result_handles AS handle
           WHERE handle.cleanup_after <= ?1
             AND NOT EXISTS (
               SELECT 1 FROM acquisition_result_authorizations authorization
               WHERE authorization.handle_digest = handle.handle_digest
             )
             AND NOT EXISTS (
               SELECT 1 FROM acquisition_result_handles inbound
               WHERE inbound.return_handle_digest = handle.handle_digest
             )`,
        )
        .bind(now),
      db
        .prepare(
          `DELETE FROM acquisition_capabilities
           WHERE proof_cleanup_after <= ?1`,
        )
        .bind(now),
      db
        .prepare(
          `WITH RECURSIVE protected_operation(operation_key) AS (
             SELECT operation.operation_key
             FROM acquisition_dispatch_operations operation
             WHERE operation.cleanup_after > ?1
                OR EXISTS (
                  SELECT 1 FROM acquisition_dispatch_observations future_observation
                  WHERE future_observation.operation_key = operation.operation_key
                    AND future_observation.cleanup_after > ?1
                )
                OR EXISTS (
                  SELECT 1 FROM acquisition_result_authorizations authorization
                  WHERE authorization.operation_key = operation.operation_key
                     OR EXISTS (
                       SELECT 1 FROM acquisition_dispatch_observations proof
                       WHERE proof.operation_key = operation.operation_key
                         AND proof.observation_key = authorization.observation_key
                     )
                )
             UNION
             SELECT authorizer.operation_key
             FROM protected_operation protected
             JOIN acquisition_dispatch_operations dependent
               ON dependent.operation_key = protected.operation_key
             JOIN acquisition_dispatch_observations proof
               ON proof.observation_key = dependent.authorization_observation_key
             JOIN acquisition_dispatch_operations authorizer
               ON authorizer.operation_key = proof.operation_key
           )
           DELETE FROM acquisition_dispatch_observations AS observation
           WHERE observation.cleanup_after <= ?1
             AND EXISTS (
               SELECT 1 FROM acquisition_dispatch_operations operation
               WHERE operation.operation_key = observation.operation_key
                 AND operation.cleanup_after <= ?1
                 AND NOT EXISTS (
                   SELECT 1 FROM protected_operation protected
                   WHERE protected.operation_key = operation.operation_key
                 )
             )`,
        )
        .bind(now),
      db
        .prepare(
          `DELETE FROM acquisition_dispatch_operations AS operation
           WHERE operation.cleanup_after <= ?1
             AND NOT EXISTS (
               SELECT 1 FROM acquisition_dispatch_observations observation
               WHERE observation.operation_key = operation.operation_key
             )
             AND NOT EXISTS (
               SELECT 1 FROM acquisition_result_authorizations authorization
               WHERE authorization.operation_key = operation.operation_key
             )`,
        )
        .bind(now),
      db
        .prepare(
          `DELETE FROM acquisition_dispatches AS dispatch
           WHERE dispatch.cleanup_after <= ?1
             AND NOT EXISTS (
               SELECT 1 FROM acquisition_dispatch_operations operation
               WHERE operation.dispatch_key = dispatch.dispatch_key
             )`,
        )
        .bind(now),
      db
        .prepare(
          `DELETE FROM acquisition_lineages AS lineage
           WHERE lineage.cleanup_after <= ?1
             AND NOT EXISTS (
               SELECT 1 FROM acquisition_capabilities capability
               WHERE capability.lineage_key = lineage.lineage_key
             )
             AND NOT EXISTS (
               SELECT 1 FROM acquisition_result_handles handle
               WHERE handle.lineage_key = lineage.lineage_key
             )
             AND NOT EXISTS (
               SELECT 1 FROM acquisition_dispatches dispatch
               WHERE dispatch.lineage_key = lineage.lineage_key
             )`,
        )
        .bind(now),
      db
        .prepare(
          `DELETE FROM acquisition_result_sets AS result_set
           WHERE result_set.cleanup_after <= ?1
             AND NOT EXISTS (
               SELECT 1 FROM acquisition_result_authorizations authorization
               WHERE authorization.result_set_key = result_set.result_set_key
             )
             AND NOT EXISTS (
               SELECT 1 FROM acquisition_result_handles handle
               WHERE handle.result_set_key = result_set.result_set_key
             )
             AND NOT EXISTS (
               SELECT 1 FROM acquisition_nodes node
               WHERE node.result_set_key = result_set.result_set_key
             )`,
        )
        .bind(now),
    ]);
    if (results.length !== 9 || results.some((result) => !result.success)) {
      throw new Error("The acquisition cleanup batch was rolled back.");
    }
    const changes = results.map((result) => result.meta?.changes);
    if (changes.some((value) => value === undefined)) {
      throw new Error("The acquisition cleanup batch returned no change proof.");
    }
    const counts = changes as number[];
    return {
      resultAuthorizations: counts[0]!,
      uncertaintyHandles: counts[1]!,
      resultHandles: counts[2]!,
      capabilities: counts[3]!,
      observations: counts[4]!,
      operations: counts[5]!,
      dispatches: counts[6]!,
      lineages: counts[7]!,
      resultSets: counts[8]!,
    };
  }
}
