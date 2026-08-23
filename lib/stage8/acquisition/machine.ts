// @ts-expect-error -- Native Node strip-types requires an explicit TS extension.
import { isAuthorizedDecision, isValidSourceKey, sourceKeysEqual } from "./authorization.ts";
import type { AuthorizedDecision } from "./authorization";
import type {
  ClientDispatchDecision,
  ClientDispatchObservation,
  ConsumedContinuationNode,
  ContinuationSourceKind,
  ContinuationNode,
  ContinuationPlan,
  DestinationAcknowledgement,
  DestinationOperation,
  RepresentationSurface,
  SelectionContext,
  SourceAuthorizationKey,
  TransitionResult,
} from "./types";

const childEligibleSources = new Set([
  "backend-failure",
  "unknown",
  "possible-duplicate",
]);

const completionEvidence = Symbol("stage8-acquisition-completion");
const issuedCompletions = new WeakSet<object>();

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function resultKindIsClosed(
  kind: unknown,
): kind is TransitionResult["kind"] {
  return (
    kind === "field-validation" ||
    kind === "backend-recording-failure" ||
    kind === "submission-status-unknown" ||
    kind === "possible-duplicate" ||
    kind === "recorded"
  );
}

function resultMatchesNode(
  result: unknown,
  node: ConsumedContinuationNode,
): result is TransitionResult {
  if (typeof result !== "object" || result === null) {
    return false;
  }

  const candidate = result as Partial<TransitionResult>;
  return (
    resultKindIsClosed(candidate.kind) &&
    candidate.intent === node.key.intent &&
    candidate.logicalId === node.selectedLogicalId
  );
}

function resultMatchesOperation(
  result: TransitionResult,
  operation: DestinationOperation,
): boolean {
  if (result.kind === "possible-duplicate") {
    return operation === "reconcile";
  }

  if (
    result.kind === "submission-status-unknown" ||
    result.kind === "backend-recording-failure"
  ) {
    return operation === "dispatch";
  }

  return true;
}

function evidenceMatchesResult(
  result: TransitionResult,
  evidenceRef: unknown,
): boolean {
  if (result.kind === "field-validation") {
    return evidenceRef === null;
  }

  if (
    result.kind === "recorded" ||
    result.kind === "backend-recording-failure"
  ) {
    return isNonEmptyString(evidenceRef);
  }

  return evidenceRef === null || isNonEmptyString(evidenceRef);
}

function consumedNodeIsWellFormed(
  node: unknown,
): node is ConsumedContinuationNode {
  if (typeof node !== "object" || node === null) {
    return false;
  }

  const candidate = node as Partial<ConsumedContinuationNode>;
  if (
    candidate.status !== "consumed" ||
    !isValidSourceKey(candidate.key as SourceAuthorizationKey) ||
    !Number.isSafeInteger(candidate.revision) ||
    (candidate.revision as number) <= 0 ||
    !isNonEmptyString(candidate.fingerprint) ||
    !isNonEmptyString(candidate.selectedLogicalId) ||
    (candidate.selection !== "parent" && candidate.selection !== "child") ||
    (candidate.operation !== "dispatch" &&
      candidate.operation !== "reconcile") ||
    (candidate.progress !== "selected" &&
      candidate.progress !== "in-flight" &&
      candidate.progress !== "complete") ||
    !isNonEmptyString(candidate.payloadSnapshotRef)
  ) {
    return false;
  }

  if (
    (candidate.selection === "parent" &&
      candidate.selectedLogicalId !== candidate.key?.logicalId) ||
    (candidate.selection === "child" &&
      candidate.selectedLogicalId === candidate.key?.logicalId) ||
    (candidate.operation === "reconcile" && candidate.selection !== "parent")
  ) {
    return false;
  }

  if (candidate.progress !== "complete") {
    return candidate.result === null && candidate.destinationEvidenceRef === null;
  }

  return (
    resultMatchesNode(candidate.result, candidate as ConsumedContinuationNode) &&
    resultMatchesOperation(
      candidate.result as TransitionResult,
      candidate.operation,
    ) &&
    evidenceMatchesResult(
      candidate.result as TransitionResult,
      candidate.destinationEvidenceRef,
    )
  );
}

function openSourceIsWellFormed(node: ContinuationNode): boolean {
  if (node.status !== "open" || typeof node.source !== "object" || node.source === null) {
    return false;
  }

  if (node.source.kind === "initial" || node.source.kind === "validation") {
    return node.source.boundFingerprint === null;
  }

  return (
    childEligibleSources.has(node.source.kind) &&
    isNonEmptyString(node.source.boundFingerprint)
  );
}

function revisionCanAdvance(revision: number): boolean {
  return Number.isSafeInteger(revision + 1);
}

function requireWellFormedConsumedNode(
  node: ConsumedContinuationNode,
): void {
  if (!consumedNodeIsWellFormed(node)) {
    throw new TypeError("The continuation node is structurally invalid.");
  }
}

function acknowledgementIsWellFormed(
  acknowledgement: unknown,
): acknowledgement is DestinationAcknowledgement {
  if (typeof acknowledgement !== "object" || acknowledgement === null) {
    return false;
  }

  const candidate = acknowledgement as Partial<DestinationAcknowledgement>;
  if (candidate.kind === "recorded") {
    return isNonEmptyString(candidate.durableRecordRef);
  }
  if (candidate.kind === "not-recorded") {
    return isNonEmptyString(candidate.proofRef);
  }
  if (candidate.kind === "indeterminate") {
    return (
      candidate.dispatchRef === null || isNonEmptyString(candidate.dispatchRef)
    );
  }

  return false;
}

interface CompletionNodeBinding {
  readonly key: SourceAuthorizationKey;
  readonly revision: number;
  readonly selectedLogicalId: string;
}

export interface TrustedCompletion {
  readonly [completionEvidence]: "validation" | "destination";
  readonly result: TransitionResult;
  readonly destinationEvidenceRef: string | null;
  readonly nodeBinding: CompletionNodeBinding;
}

export type DestinationDecision =
  | { readonly kind: "complete"; readonly completion: TrustedCompletion }
  | { readonly kind: "dispatch-required" };

function nextSourceKey(
  key: SourceAuthorizationKey,
  logicalId: string,
): SourceAuthorizationKey | null {
  if (key.generation >= Number.MAX_SAFE_INTEGER) {
    return null;
  }

  return Object.freeze({
    ...key,
    logicalId,
    generation: key.generation + 1,
  });
}

function operationForSource(
  sourceKind: ContinuationSourceKind,
  selection: "parent" | "child",
): DestinationOperation {
  if (
    selection === "parent" &&
    (sourceKind === "unknown" || sourceKind === "possible-duplicate")
  ) {
    return "reconcile";
  }

  return "dispatch";
}

function nodeBinding(node: ConsumedContinuationNode): CompletionNodeBinding {
  return Object.freeze({
    key: Object.freeze({ ...node.key }),
    revision: node.revision,
    selectedLogicalId: node.selectedLogicalId,
  });
}

function createTrustedCompletion(
  evidenceKind: "validation" | "destination",
  result: TransitionResult,
  destinationEvidenceRef: string | null,
  node: ConsumedContinuationNode,
): TrustedCompletion {
  const completion = Object.freeze({
    [completionEvidence]: evidenceKind,
    result,
    destinationEvidenceRef,
    nodeBinding: nodeBinding(node),
  });
  issuedCompletions.add(completion);
  return completion;
}

/**
 * Plans exactly one lineage-generation CAS after guarded authorization and
 * fingerprinting. It performs no persistence, randomness, or destination I/O.
 */
export function planAuthorizedContinuation(
  authorization: AuthorizedDecision,
  node: ContinuationNode,
  context: SelectionContext,
): ContinuationPlan {
  if (
    !isAuthorizedDecision(authorization) ||
    typeof node !== "object" ||
    node === null ||
    !isValidSourceKey(node.key) ||
    !sourceKeysEqual(authorization.key, node.key)
  ) {
    return { kind: "integrity-error", code: "source-key-mismatch" };
  }

  if (
    !Number.isSafeInteger(node.revision) ||
    node.revision < 0 ||
    !revisionCanAdvance(node.revision)
  ) {
    return { kind: "integrity-error", code: "invalid-revision" };
  }

  if (
    typeof context !== "object" ||
    context === null ||
    typeof context.fingerprint !== "string" ||
    context.fingerprint.length === 0 ||
    typeof context.payloadSnapshotRef !== "string" ||
    context.payloadSnapshotRef.length === 0
  ) {
    return { kind: "integrity-error", code: "invalid-source" };
  }

  if (node.status === "consumed") {
    if (!consumedNodeIsWellFormed(node)) {
      return { kind: "integrity-error", code: "invalid-node" };
    }

    if (node.fingerprint !== context.fingerprint) {
      return { kind: "expired" };
    }

    if (node.progress === "selected") {
      return { kind: "resume-processing", node };
    }

    if (node.progress === "in-flight") {
      return { kind: "reconcile-required", node };
    }

    if (node.progress === "complete" && node.result !== null) {
      return { kind: "replay", result: node.result };
    }

    return { kind: "integrity-error", code: "invalid-node" };
  }

  if (!openSourceIsWellFormed(node)) {
    return { kind: "integrity-error", code: "invalid-source" };
  }

  const sourceRequiresSnapshot = childEligibleSources.has(node.source.kind);
  const changed =
    sourceRequiresSnapshot &&
    context.fingerprint !== node.source.boundFingerprint;
  const selection = changed ? "child" : "parent";
  let selectedLogicalId = authorization.key.logicalId;

  if (selection === "child") {
    if (context.proposedChildLogicalId === undefined) {
      return { kind: "integrity-error", code: "missing-child-id" };
    }

    if (
      typeof context.proposedChildLogicalId !== "string" ||
      context.proposedChildLogicalId.length === 0 ||
      context.proposedChildLogicalId === authorization.key.logicalId
    ) {
      return { kind: "integrity-error", code: "invalid-child-id" };
    }

    selectedLogicalId = context.proposedChildLogicalId;
  }

  const nextKey = nextSourceKey(authorization.key, selectedLogicalId);
  if (nextKey === null) {
    return { kind: "integrity-error", code: "generation-overflow" };
  }

  const nextNode: ConsumedContinuationNode = Object.freeze({
    status: "consumed",
    key: authorization.key,
    revision: node.revision + 1,
    fingerprint: context.fingerprint,
    selectedLogicalId,
    selection,
    operation: operationForSource(node.source.kind, selection),
    progress: "selected",
    result: null,
    payloadSnapshotRef: context.payloadSnapshotRef,
    destinationEvidenceRef: null,
  });

  return Object.freeze({
    kind: "selection-commit",
    expectedRevision: node.revision,
    nextNode,
    nextKey,
  });
}

export type ValidationTransition =
  | {
      readonly kind: "complete";
      readonly completion: TrustedCompletion;
    }
  | {
      readonly kind: "start-operation";
      readonly operation: DestinationOperation;
    };

export function transitionAfterValidation(
  node: ConsumedContinuationNode,
  valid: boolean,
): ValidationTransition {
  requireWellFormedConsumedNode(node);
  if (node.progress !== "selected" || node.result !== null) {
    throw new TypeError("The continuation node is not awaiting validation.");
  }
  if (typeof valid !== "boolean") {
    throw new TypeError("Validation outcome must be boolean.");
  }

  if (!valid) {
    const result = Object.freeze({
      kind: "field-validation",
      intent: node.key.intent,
      logicalId: node.selectedLogicalId,
    } as const);
    return Object.freeze({
      kind: "complete",
      completion: createTrustedCompletion("validation", result, null, node),
    });
  }

  return Object.freeze({
    kind: "start-operation",
    operation: node.operation,
  });
}

export function markOperationInFlight(
  node: ConsumedContinuationNode,
): ConsumedContinuationNode {
  requireWellFormedConsumedNode(node);
  if (node.progress !== "selected" || node.result !== null) {
    throw new TypeError("The continuation node cannot begin an operation.");
  }
  if (!revisionCanAdvance(node.revision)) {
    throw new TypeError("The continuation revision cannot advance.");
  }

  return Object.freeze({
    ...node,
    revision: node.revision + 1,
    progress: "in-flight",
  });
}

export function decideDestinationAcknowledgement(
  node: ConsumedContinuationNode,
  acknowledgement: DestinationAcknowledgement,
): DestinationDecision {
  requireWellFormedConsumedNode(node);
  if (node.progress !== "in-flight" || node.result !== null) {
    throw new TypeError("Destination acknowledgement requires an in-flight node.");
  }
  if (!acknowledgementIsWellFormed(acknowledgement)) {
    throw new TypeError("Destination acknowledgement is structurally invalid.");
  }
  const operation = node.operation;

  if (operation === "reconcile" && acknowledgement.kind === "not-recorded") {
    return Object.freeze({ kind: "dispatch-required" });
  }

  let resultKind: TransitionResult["kind"];

  if (acknowledgement.kind === "recorded") {
    resultKind = "recorded";
  } else if (operation === "reconcile") {
    resultKind = "possible-duplicate";
  } else if (acknowledgement.kind === "not-recorded") {
    resultKind = "backend-recording-failure";
  } else {
    resultKind = "submission-status-unknown";
  }

  return Object.freeze({
    kind: "complete",
    completion: createTrustedCompletion(
      "destination",
      Object.freeze({
        kind: resultKind,
        intent: node.key.intent,
        logicalId: node.selectedLogicalId,
      }) as TransitionResult,
      acknowledgement.kind === "recorded"
        ? acknowledgement.durableRecordRef
        : acknowledgement.kind === "not-recorded"
          ? acknowledgement.proofRef
          : acknowledgement.dispatchRef,
      node,
    ),
  });
}

export function completeNode(
  node: ConsumedContinuationNode,
  completion: TrustedCompletion,
): ConsumedContinuationNode {
  requireWellFormedConsumedNode(node);
  if (node.progress === "complete" || node.result !== null) {
    throw new TypeError("The continuation node is already complete.");
  }

  if (
    completion === null ||
    typeof completion !== "object" ||
    !issuedCompletions.has(completion) ||
    !Object.prototype.hasOwnProperty.call(completion, completionEvidence) ||
    (completion[completionEvidence] !== "validation" &&
      completion[completionEvidence] !== "destination")
  ) {
    throw new TypeError("Completion evidence was not issued by the state core.");
  }

  if (
    typeof completion.nodeBinding !== "object" ||
    completion.nodeBinding === null ||
    !isValidSourceKey(completion.nodeBinding.key) ||
    !Number.isSafeInteger(completion.nodeBinding.revision) ||
    !isNonEmptyString(completion.nodeBinding.selectedLogicalId)
  ) {
    throw new TypeError("Completion evidence has an invalid node binding.");
  }

  const result = completion.result;
  if (
    !sourceKeysEqual(node.key, completion.nodeBinding.key) ||
    node.revision !== completion.nodeBinding.revision ||
    node.selectedLogicalId !== completion.nodeBinding.selectedLogicalId
  ) {
    throw new TypeError("Completion evidence belongs to a different node.");
  }
  const validationCompletion = completion[completionEvidence] === "validation";
  if (
    !resultMatchesNode(result, node) ||
    !resultMatchesOperation(result, node.operation) ||
    !evidenceMatchesResult(result, completion.destinationEvidenceRef) ||
    (validationCompletion &&
      (node.progress !== "selected" || result.kind !== "field-validation")) ||
    (!validationCompletion &&
      (node.progress !== "in-flight" || result.kind === "field-validation"))
  ) {
    throw new TypeError("Completion evidence is invalid for the node phase.");
  }

  if (
    result.intent !== node.key.intent ||
    result.logicalId !== node.selectedLogicalId
  ) {
    throw new TypeError("The result does not match the selected intent and ID.");
  }

  if (!revisionCanAdvance(node.revision)) {
    throw new TypeError("The continuation revision cannot advance.");
  }

  return Object.freeze({
    ...node,
    revision: node.revision + 1,
    progress: "complete",
    result,
    destinationEvidenceRef: completion.destinationEvidenceRef,
  });
}

export interface NextContinuationRegistration {
  readonly node: import("./types").OpenContinuationNode;
  readonly csrfCapability: string;
}

/**
 * Builds the next form authority that a repository must insert atomically with
 * completing the source transition. Receipts intentionally create no next
 * continuation.
 */
export function planNextContinuationRegistration(
  node: ConsumedContinuationNode,
  csrfCapability: string | null,
): NextContinuationRegistration | null {
  requireWellFormedConsumedNode(node);
  if (node.progress !== "complete" || node.result === null) {
    throw new TypeError("Only a complete transition can create continuation state.");
  }

  if (node.result.kind === "recorded") {
    if (csrfCapability !== null) {
      throw new TypeError("A receipt cannot create another form capability.");
    }
    return null;
  }

  if (!isNonEmptyString(csrfCapability)) {
    throw new TypeError("A returned form requires fresh CSRF authority.");
  }

  const key = nextSourceKey(node.key, node.selectedLogicalId);
  if (key === null) {
    throw new TypeError("The continuation generation cannot advance.");
  }

  const kind =
    node.result.kind === "field-validation"
      ? "validation"
      : node.result.kind === "backend-recording-failure"
        ? "backend-failure"
        : node.result.kind === "submission-status-unknown"
          ? "unknown"
          : "possible-duplicate";
  const boundFingerprint = kind === "validation" ? null : node.fingerprint;

  return Object.freeze({
    node: Object.freeze({
      status: "open",
      key,
      revision: 0,
      source: Object.freeze({ kind, boundFingerprint }),
    }),
    csrfCapability,
  });
}

export function switchReconciliationToDispatch(
  node: ConsumedContinuationNode,
): ConsumedContinuationNode {
  requireWellFormedConsumedNode(node);
  if (node.progress !== "in-flight" || node.operation !== "reconcile") {
    throw new TypeError("Only an active reconciliation can switch to dispatch.");
  }
  if (!revisionCanAdvance(node.revision)) {
    throw new TypeError("The continuation revision cannot advance.");
  }

  return Object.freeze({
    ...node,
    revision: node.revision + 1,
    operation: "dispatch",
    progress: "selected",
  });
}

export function decideClientDispatch(
  observation: ClientDispatchObservation,
): ClientDispatchDecision {
  if (observation === "positively-not-started") {
    return Object.freeze({ kind: "definite-pre-transmission-failure" });
  }

  if (observation === "may-have-started") {
    return Object.freeze({ kind: "submission-status-unknown" });
  }

  if (observation === "server-response-pending") {
    return Object.freeze({ kind: "await-server" });
  }

  throw new TypeError("Client dispatch observation is structurally invalid.");
}

export function representationSurface(
  result: TransitionResult,
): RepresentationSurface {
  if (
    typeof result !== "object" ||
    result === null ||
    !resultKindIsClosed(result.kind)
  ) {
    throw new TypeError("Transition result is structurally invalid.");
  }

  if (
    result.kind === "field-validation" ||
    result.kind === "backend-recording-failure"
  ) {
    return "inline-form";
  }

  return "reduced-state";
}
