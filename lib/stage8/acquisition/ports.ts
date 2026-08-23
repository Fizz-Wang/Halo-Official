import type {
  AcquisitionIntent,
  CanonicalFormRoute,
  ConsumedContinuationNode,
  ContinuationNode,
  DestinationAcknowledgement,
  GuardedAuthorizationEvidence,
  SourceAuthorizationKey,
  TransitionResult,
} from "./types";
import type { NextContinuationRegistration } from "./machine";

export interface BoundedPostControls {
  readonly sessionId: string;
  readonly canonicalRoute: CanonicalFormRoute;
  readonly action: CanonicalFormRoute;
  readonly logicalId: string;
  readonly generation: number;
  readonly csrfCapability: string;
  readonly presentationHandle: string | null;
}

/** Must inspect controls only; payload access is forbidden at this boundary. */
export interface CapabilityAuthorizationPort {
  verify(
    controls: BoundedPostControls,
  ): Promise<GuardedAuthorizationEvidence>;
}

/**
 * Supplies opaque non-encoding values. Production entropy, signing, storage,
 * TTLs, and cleanup are deliberately outside the pure core.
 */
export interface OpaqueValueIssuerPort {
  issue(
    purpose: "logical-id" | "csrf" | "result-handle",
  ): Promise<string>;
}

/** A fresh form reuses this already-established session and mints only a root. */
export interface EstablishedSessionPort {
  currentSessionId(): Promise<string>;
}

export interface PayloadFingerprinterPort<TPayload> {
  fingerprint(payload: TPayload): Promise<string>;
}

/**
 * Implementations must be strongly consistent. `load` is callable only after
 * the guarded pre-lineage decision is authorized.
 */
export interface ContinuationStorePort {
  load(key: SourceAuthorizationKey): Promise<ContinuationNode | null>;
  /**
   * One strongly-consistent commit must consume the source generation and
   * persist its normalized snapshot reference. A conflict must return the
   * winning node; it may not strand the caller on a locally proposed ID.
   */
  commitSelection(input: {
    readonly key: SourceAuthorizationKey;
    readonly expectedRevision: number;
    readonly nextNode: ConsumedContinuationNode;
  }): Promise<
    | { readonly kind: "applied" }
    | { readonly kind: "conflict"; readonly winningNode: ContinuationNode }
  >;

  /**
   * Atomically completes the source node, installs any next-generation open
   * node plus fresh CSRF authority, and stores every returned representation.
   * Partial success is forbidden.
   */
  finalizeTransition(input: {
    readonly expectedRevision: number;
    readonly completedNode: ConsumedContinuationNode;
    readonly next: NextContinuationRegistration | null;
    readonly representations: readonly RepresentationRecord[];
  }): Promise<"applied" | "conflict">;
}

export interface DestinationRecord<TPayload> {
  readonly intent: AcquisitionIntent;
  readonly logicalId: string;
  readonly payload: TPayload;
}

/** The destination must enforce logicalId uniqueness for the exact intent. */
export interface DurableDestinationPort<TPayload> {
  dispatch(record: DestinationRecord<TPayload>): Promise<DestinationAcknowledgement>;
  reconcile(input: {
    readonly intent: AcquisitionIntent;
    readonly logicalId: string;
  }): Promise<DestinationAcknowledgement>;
}

export interface RepresentationRecord {
  readonly handle: string;
  readonly sessionId: string;
  readonly intent: AcquisitionIntent;
  readonly canonicalRoute: CanonicalFormRoute;
  readonly action: CanonicalFormRoute;
  readonly logicalId: string;
  readonly generation: number;
  readonly class:
    | "form"
    | "continuation-form"
    | "uncertainty"
    | "receipt"
    | "expired";
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly sourceKey: SourceAuthorizationKey | null;
  readonly payloadSnapshotRef: string | null;
  /** Required only for Unknown/Possible duplicate Return-to-form GET. */
  readonly returnedFormHandle: string | null;
  readonly result: TransitionResult | null;
}

export interface HandleAuthorizationProjection {
  readonly sessionId: string;
  readonly intent: AcquisitionIntent;
  readonly canonicalRoute: CanonicalFormRoute;
  readonly action: CanonicalFormRoute;
  readonly logicalId: string;
  readonly generation: number;
  readonly class: RepresentationRecord["class"];
  readonly lifecycle: "current" | "known-expired";
}

export interface LifecyclePolicy {
  readonly sourceGenerationExpiresAt: number;
  readonly replayWindowEndsAt: number;
  readonly csrfProofExpiresAt: number;
  readonly csrfProofCleanupAt: number;
  readonly lineageCleanupAt: number;
}

/** Central lifecycle invariant required by the frozen replay contract. */
export function lifecyclePolicyIsClosed(policy: LifecyclePolicy): boolean {
  const values = Object.values(policy);
  return (
    values.every((value) => Number.isSafeInteger(value) && value > 0) &&
    policy.sourceGenerationExpiresAt >= policy.replayWindowEndsAt &&
    policy.csrfProofExpiresAt >= policy.replayWindowEndsAt &&
    policy.csrfProofCleanupAt >= policy.replayWindowEndsAt &&
    policy.lineageCleanupAt >= policy.replayWindowEndsAt
  );
}

export interface RepresentationStorePort {
  /** Constant-shape projection only; never loads draft, result, or payload. */
  projectForAuthorization(
    handle: string,
  ): Promise<HandleAuthorizationProjection | null>;
  /** Callable only after an exact guarded handle authorization succeeds. */
  loadAuthorized(handle: string): Promise<RepresentationRecord | null>;
}
