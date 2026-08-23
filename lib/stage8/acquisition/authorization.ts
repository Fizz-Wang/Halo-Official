import type {
  AcquisitionIntent,
  CanonicalFormRoute,
  GuardedAuthorizationEvidence,
  SourceAuthorizationKey,
} from "./types";

const authorizedDecisionBrand = Symbol("stage8-acquisition-authorized");
const issuedAuthorizedDecisions = new WeakSet<object>();

export interface AuthorizedDecision {
  readonly kind: "authorized";
  readonly key: SourceAuthorizationKey;
  readonly replay: boolean;
  readonly [authorizedDecisionBrand]: true;
}

export type PreLineageDecision =
  | { readonly kind: "not-found" }
  | { readonly kind: "expired"; readonly key: SourceAuthorizationKey }
  | AuthorizedDecision;

export function isAuthorizedDecision(value: unknown): value is AuthorizedDecision {
  return (
    typeof value === "object" &&
    value !== null &&
    issuedAuthorizedDecisions.has(value) &&
    Object.prototype.hasOwnProperty.call(value, authorizedDecisionBrand) &&
    (value as Partial<AuthorizedDecision>)[authorizedDecisionBrand] === true &&
    (value as Partial<AuthorizedDecision>).kind === "authorized" &&
    typeof (value as Partial<AuthorizedDecision>).replay === "boolean" &&
    isValidSourceKey((value as Partial<AuthorizedDecision>).key as SourceAuthorizationKey)
  );
}

export const ACQUISITION_CANONICAL_ROUTES = Object.freeze({
  poc: "/request-poc/",
  sales: "/contact-sales/",
  demo: "/request-demo/",
  partner: "/partners/apply/",
} as const satisfies Readonly<Record<AcquisitionIntent, CanonicalFormRoute>>);

const routeEntries = Object.entries(ACQUISITION_CANONICAL_ROUTES) as ReadonlyArray<
  readonly [AcquisitionIntent, CanonicalFormRoute]
>;

export function intentForCanonicalRoute(
  route: string,
): AcquisitionIntent | null {
  for (const [intent, canonicalRoute] of routeEntries) {
    if (route === canonicalRoute) {
      return intent;
    }
  }

  return null;
}

export function createRoutedSourceKey(input: {
  readonly sessionId: string;
  readonly canonicalRoute: string;
  readonly logicalId: string;
  readonly generation: number;
}): SourceAuthorizationKey | null {
  if (typeof input !== "object" || input === null) {
    return null;
  }

  const intent = intentForCanonicalRoute(input.canonicalRoute);

  if (
    intent === null ||
    typeof input.sessionId !== "string" ||
    input.sessionId.length === 0 ||
    typeof input.logicalId !== "string" ||
    input.logicalId.length === 0 ||
    !Number.isSafeInteger(input.generation) ||
    input.generation < 0
  ) {
    return null;
  }

  return Object.freeze({
    sessionId: input.sessionId,
    intent,
    canonicalRoute: ACQUISITION_CANONICAL_ROUTES[intent],
    action: ACQUISITION_CANONICAL_ROUTES[intent],
    logicalId: input.logicalId,
    generation: input.generation,
  });
}

export function isValidSourceKey(key: SourceAuthorizationKey): boolean {
  if (typeof key !== "object" || key === null) {
    return false;
  }

  const expectedRoute = ACQUISITION_CANONICAL_ROUTES[key.intent];
  return (
    typeof expectedRoute === "string" &&
    typeof key.sessionId === "string" &&
    key.sessionId.length > 0 &&
    key.canonicalRoute === expectedRoute &&
    key.action === expectedRoute &&
    typeof key.logicalId === "string" &&
    key.logicalId.length > 0 &&
    Number.isSafeInteger(key.generation) &&
    key.generation >= 0
  );
}

export function sourceKeysEqual(
  left: SourceAuthorizationKey,
  right: SourceAuthorizationKey,
): boolean {
  return (
    typeof left === "object" &&
    left !== null &&
    typeof right === "object" &&
    right !== null &&
    left.sessionId === right.sessionId &&
    left.intent === right.intent &&
    left.canonicalRoute === right.canonicalRoute &&
    left.action === right.action &&
    left.logicalId === right.logicalId &&
    left.generation === right.generation
  );
}

function guardedEvidenceIsWellFormed(
  evidence: GuardedAuthorizationEvidence,
): boolean {
  if (typeof evidence !== "object" || evidence === null) {
    return false;
  }

  const closedCapabilityState =
    evidence.capabilityState === "invalid" ||
    evidence.capabilityState === "current" ||
    evidence.capabilityState === "replay-valid" ||
    evidence.capabilityState === "known-expired";

  return (
    closedCapabilityState &&
    typeof evidence.logicalProjectionMatches === "boolean" &&
    typeof evidence.handleProjectionMatches === "boolean" &&
    (evidence.authenticatedKey === null ||
      isValidSourceKey(evidence.authenticatedKey))
  );
}

/**
 * Applies the frozen F09/F14/F16 precedence before any lineage or payload
 * access. A mismatch always collapses to the same non-oracular result, even
 * when another component appears expired.
 */
export function authorizeBeforeLineage(
  requestedKey: SourceAuthorizationKey,
  evidence: GuardedAuthorizationEvidence,
): PreLineageDecision {
  if (!isValidSourceKey(requestedKey) || !guardedEvidenceIsWellFormed(evidence)) {
    return Object.freeze({ kind: "not-found" });
  }

  const exactBinding =
    evidence.authenticatedKey !== null &&
    evidence.logicalProjectionMatches === true &&
    evidence.handleProjectionMatches === true &&
    sourceKeysEqual(requestedKey, evidence.authenticatedKey);

  if (evidence.capabilityState === "invalid" || !exactBinding) {
    return Object.freeze({ kind: "not-found" });
  }

  if (evidence.capabilityState === "known-expired") {
    return Object.freeze({
      kind: "expired",
      key: Object.freeze({ ...requestedKey }),
    });
  }

  const authorizedKey = Object.freeze({ ...requestedKey });
  const decision = {
    kind: "authorized",
    key: authorizedKey,
    replay: evidence.capabilityState === "replay-valid",
  } as Omit<AuthorizedDecision, typeof authorizedDecisionBrand> &
    Partial<AuthorizedDecision>;
  Object.defineProperty(decision, authorizedDecisionBrand, {
    value: true,
    enumerable: false,
  });
  issuedAuthorizedDecisions.add(decision);
  return Object.freeze(decision) as AuthorizedDecision;
}
