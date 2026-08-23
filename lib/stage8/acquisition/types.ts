export type AcquisitionIntent = "poc" | "sales" | "demo" | "partner";
export type CanonicalFormRoute =
  | "/request-poc/"
  | "/contact-sales/"
  | "/request-demo/"
  | "/partners/apply/";

export interface SourceAuthorizationKey {
  readonly sessionId: string;
  readonly intent: AcquisitionIntent;
  readonly canonicalRoute: CanonicalFormRoute;
  readonly action: CanonicalFormRoute;
  readonly logicalId: string;
  readonly generation: number;
}

export type GuardedCapabilityState =
  | "invalid"
  | "current"
  | "replay-valid"
  | "known-expired";

/**
 * Evidence returned by a cryptographic or server-side authorization adapter.
 * The core never implements or assumes a token format.
 */
export interface GuardedAuthorizationEvidence {
  readonly capabilityState: GuardedCapabilityState;
  readonly authenticatedKey: SourceAuthorizationKey | null;
  readonly logicalProjectionMatches: boolean;
  readonly handleProjectionMatches: boolean;
}

export type ContinuationSourceKind =
  | "initial"
  | "validation"
  | "backend-failure"
  | "unknown"
  | "possible-duplicate";

export interface ContinuationSource {
  readonly kind: ContinuationSourceKind;
  /**
   * Present only for retry/uncertainty sources whose unchanged candidate keeps
   * the parent and whose changed candidate is eligible for one child.
   */
  readonly boundFingerprint: string | null;
}

export type DestinationOperation = "dispatch" | "reconcile";
export type NodeProgress = "selected" | "in-flight" | "complete";

export type TransitionResult =
  | {
      readonly kind: "field-validation";
      readonly intent: AcquisitionIntent;
      readonly logicalId: string;
    }
  | {
      readonly kind: "backend-recording-failure";
      readonly intent: AcquisitionIntent;
      readonly logicalId: string;
    }
  | {
      readonly kind: "submission-status-unknown";
      readonly intent: AcquisitionIntent;
      readonly logicalId: string;
    }
  | {
      readonly kind: "possible-duplicate";
      readonly intent: AcquisitionIntent;
      readonly logicalId: string;
    }
  | {
      readonly kind: "recorded";
      readonly intent: AcquisitionIntent;
      readonly logicalId: string;
    };

export interface OpenContinuationNode {
  readonly status: "open";
  readonly key: SourceAuthorizationKey;
  readonly revision: number;
  /** Server-held authority for retry/edit semantics; never caller supplied. */
  readonly source: ContinuationSource;
}

export interface ConsumedContinuationNode {
  readonly status: "consumed";
  readonly key: SourceAuthorizationKey;
  readonly revision: number;
  readonly fingerprint: string;
  readonly selectedLogicalId: string;
  readonly selection: "parent" | "child";
  readonly operation: DestinationOperation;
  readonly progress: NodeProgress;
  readonly result: TransitionResult | null;
  /** Opaque internal reference to the normalized server-held snapshot. */
  readonly payloadSnapshotRef: string;
  /** Opaque durable destination proof/dispatch reference, never public. */
  readonly destinationEvidenceRef: string | null;
}

export type ContinuationNode =
  | OpenContinuationNode
  | ConsumedContinuationNode;

export interface SelectionContext {
  readonly fingerprint: string;
  readonly payloadSnapshotRef: string;
  /** Supplied by an opaque-ID issuer only when a changed child may be needed. */
  readonly proposedChildLogicalId?: string;
}

export type ContinuationPlan =
  | {
      readonly kind: "selection-commit";
      readonly expectedRevision: number;
      readonly nextNode: ConsumedContinuationNode;
      readonly nextKey: SourceAuthorizationKey;
    }
  | {
      readonly kind: "resume-processing";
      readonly node: ConsumedContinuationNode;
    }
  | {
      readonly kind: "reconcile-required";
      readonly node: ConsumedContinuationNode;
    }
  | {
      readonly kind: "replay";
      readonly result: TransitionResult;
    }
  | { readonly kind: "expired" }
  | {
      readonly kind: "integrity-error";
      readonly code:
        | "source-key-mismatch"
        | "invalid-revision"
        | "invalid-source"
        | "missing-child-id"
        | "invalid-child-id"
        | "generation-overflow"
        | "invalid-node";
    };

export type DestinationAcknowledgement =
  | {
      readonly kind: "recorded";
      readonly durableRecordRef: string;
    }
  | {
      readonly kind: "not-recorded";
      readonly proofRef: string;
    }
  | {
      readonly kind: "indeterminate";
      readonly dispatchRef: string | null;
    };

export type ClientDispatchObservation =
  | "positively-not-started"
  | "may-have-started"
  | "server-response-pending";

export type ClientDispatchDecision =
  | { readonly kind: "definite-pre-transmission-failure" }
  | { readonly kind: "submission-status-unknown" }
  | { readonly kind: "await-server" };

export type RepresentationSurface = "inline-form" | "reduced-state";
