import type {
  HandleAuthorizationProjection,
  RepresentationRecord,
} from "./ports";
import type {
  AcquisitionIntent,
  CanonicalFormRoute,
  SourceAuthorizationKey,
} from "./types";

export interface RepresentationAccessRequest {
  readonly sessionId: string;
  readonly intent: AcquisitionIntent;
  readonly canonicalRoute: CanonicalFormRoute;
}

export type RepresentationAccessDecision =
  | { readonly kind: "not-found" }
  | { readonly kind: "authorized-to-load" }
  | { readonly kind: "expired-form" };

function routeMatchesIntent(
  intent: AcquisitionIntent,
  route: CanonicalFormRoute,
): boolean {
  return (
    (intent === "poc" && route === "/request-poc/") ||
    (intent === "sales" && route === "/contact-sales/") ||
    (intent === "demo" && route === "/request-demo/") ||
    (intent === "partner" && route === "/partners/apply/")
  );
}

const representationClasses = new Set([
  "form",
  "continuation-form",
  "uncertainty",
  "receipt",
  "expired",
]);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function resultKindIsClosed(value: unknown): boolean {
  return (
    value === "field-validation" ||
    value === "backend-recording-failure" ||
    value === "submission-status-unknown" ||
    value === "possible-duplicate" ||
    value === "recorded"
  );
}

function resultIsWellFormed(value: unknown): boolean {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const result = value as {
    readonly kind?: unknown;
    readonly intent?: unknown;
    readonly logicalId?: unknown;
  };
  return (
    resultKindIsClosed(result.kind) &&
    (result.intent === "poc" ||
      result.intent === "sales" ||
      result.intent === "demo" ||
      result.intent === "partner") &&
    isNonEmptyString(result.logicalId)
  );
}

function projectionIsWellFormed(
  projection: HandleAuthorizationProjection,
): boolean {
  if (typeof projection !== "object" || projection === null) {
    return false;
  }

  return (
    isNonEmptyString(projection.sessionId) &&
    routeMatchesIntent(projection.intent, projection.canonicalRoute) &&
    projection.action === projection.canonicalRoute &&
    isNonEmptyString(projection.logicalId) &&
    Number.isSafeInteger(projection.generation) &&
    projection.generation >= 0 &&
    representationClasses.has(projection.class) &&
    (projection.lifecycle === "current" ||
      projection.lifecycle === "known-expired")
  );
}

function sourceKeyIsWellFormed(key: SourceAuthorizationKey): boolean {
  if (typeof key !== "object" || key === null) {
    return false;
  }

  return (
    isNonEmptyString(key.sessionId) &&
    routeMatchesIntent(key.intent, key.canonicalRoute) &&
    key.action === key.canonicalRoute &&
    isNonEmptyString(key.logicalId) &&
    Number.isSafeInteger(key.generation) &&
    key.generation >= 0
  );
}

function recordMatchesSourceKey(
  record: RepresentationRecord,
  key: SourceAuthorizationKey,
): boolean {
  return (
    sourceKeyIsWellFormed(key) &&
    key.sessionId === record.sessionId &&
    key.intent === record.intent &&
    key.canonicalRoute === record.canonicalRoute &&
    key.action === record.action &&
    key.logicalId === record.logicalId &&
    key.generation === record.generation
  );
}

/** Exact guarded POST handle projection comparison against the full source K. */
export function handleProjectionMatchesSourceKey(
  projection: HandleAuthorizationProjection | null,
  key: SourceAuthorizationKey,
): boolean {
  return (
    projection !== null &&
    projectionIsWellFormed(projection) &&
    sourceKeyIsWellFormed(key) &&
    projection.sessionId === key.sessionId &&
    projection.intent === key.intent &&
    projection.canonicalRoute === key.canonicalRoute &&
    projection.action === key.action &&
    projection.logicalId === key.logicalId &&
    projection.generation === key.generation
  );
}

/**
 * Authorizes a constant-shape handle projection before representation data is
 * loaded. Unknown/mismatched and expired receipts collapse to the same P20
 * decision; only an exact known form/uncertainty binding can become Expired.
 */
export function authorizeRepresentationHandle(
  request: RepresentationAccessRequest,
  projection: HandleAuthorizationProjection | null,
): RepresentationAccessDecision {
  if (
    typeof request !== "object" ||
    request === null ||
    !isNonEmptyString(request.sessionId) ||
    projection === null ||
    !routeMatchesIntent(request.intent, request.canonicalRoute) ||
    !projectionIsWellFormed(projection) ||
    projection.sessionId !== request.sessionId ||
    projection.intent !== request.intent ||
    projection.canonicalRoute !== request.canonicalRoute
  ) {
    return Object.freeze({ kind: "not-found" });
  }

  if (projection.lifecycle === "current") {
    return Object.freeze({ kind: "authorized-to-load" });
  }

  if (
    projection.class === "form" ||
    projection.class === "continuation-form" ||
    projection.class === "uncertainty"
  ) {
    return Object.freeze({ kind: "expired-form" });
  }

  return Object.freeze({ kind: "not-found" });
}

export function isValidRepresentationRecord(
  record: RepresentationRecord,
): boolean {
  if (
    typeof record !== "object" ||
    record === null ||
    !representationClasses.has(record.class) ||
    !routeMatchesIntent(record.intent, record.canonicalRoute) ||
    record.action !== record.canonicalRoute ||
    !isNonEmptyString(record.handle) ||
    !isNonEmptyString(record.sessionId) ||
    !isNonEmptyString(record.logicalId) ||
    !Number.isSafeInteger(record.generation) ||
    record.generation < 0 ||
    !Number.isSafeInteger(record.issuedAt) ||
    record.issuedAt < 0 ||
    !Number.isSafeInteger(record.expiresAt) ||
    record.expiresAt < 0 ||
    record.expiresAt <= record.issuedAt
  ) {
    return false;
  }

  if (record.class === "expired") {
    return (
      record.result === null &&
      record.sourceKey === null &&
      record.payloadSnapshotRef === null &&
      record.returnedFormHandle === null
    );
  }

  if (record.class === "continuation-form") {
    return (
      resultIsWellFormed(record.result) &&
      record.result !== null &&
      (record.result.kind === "submission-status-unknown" ||
        record.result.kind === "possible-duplicate") &&
      record.result.intent === record.intent &&
      record.result.logicalId === record.logicalId &&
      record.returnedFormHandle === null &&
      isNonEmptyString(record.payloadSnapshotRef) &&
      record.sourceKey !== null &&
      recordMatchesSourceKey(record, record.sourceKey)
    );
  }

  if (
    !resultIsWellFormed(record.result) ||
    record.result === null ||
    record.result.intent !== record.intent
  ) {
    return false;
  }

  if (
    record.result.logicalId !== record.logicalId ||
    record.sourceKey === null ||
    !recordMatchesSourceKey(record, record.sourceKey)
  ) {
    return false;
  }

  if (record.class === "receipt") {
    return (
      record.result.kind === "recorded" &&
      record.payloadSnapshotRef === null &&
      record.returnedFormHandle === null
    );
  }

  if (
    record.result === null ||
    !isNonEmptyString(record.payloadSnapshotRef)
  ) {
    return false;
  }

  if (record.class === "form") {
    return (
      record.returnedFormHandle === null &&
      (record.result.kind === "field-validation" ||
        record.result.kind === "backend-recording-failure")
    );
  }

  return (
    isNonEmptyString(record.returnedFormHandle) &&
    (record.result.kind === "submission-status-unknown" ||
      record.result.kind === "possible-duplicate")
  );
}

/**
 * Validates the atomic representation set so uncertainty states cannot point
 * to an absent, cross-session, or wrong-intent returned form.
 */
export function isValidRepresentationBatch(
  records: readonly RepresentationRecord[],
): boolean {
  if (!Array.isArray(records)) {
    return false;
  }

  const byHandle = new Map<string, RepresentationRecord>();

  for (const record of records) {
    if (!isValidRepresentationRecord(record) || byHandle.has(record.handle)) {
      return false;
    }
    byHandle.set(record.handle, record);
  }

  for (const record of records) {
    if (record.class !== "uncertainty") {
      continue;
    }

    const returned =
      record.returnedFormHandle === null
        ? undefined
        : byHandle.get(record.returnedFormHandle);
    if (
      returned === undefined ||
      returned.class !== "continuation-form" ||
      returned.sessionId !== record.sessionId ||
      returned.intent !== record.intent ||
      returned.canonicalRoute !== record.canonicalRoute ||
      returned.action !== record.action ||
      returned.logicalId !== record.logicalId ||
      returned.generation !== record.generation ||
      returned.sourceKey === null ||
      record.sourceKey === null ||
      !recordMatchesSourceKey(returned, record.sourceKey) ||
      returned.payloadSnapshotRef !== record.payloadSnapshotRef ||
      returned.result === null ||
      record.result === null ||
      returned.result.kind !== record.result.kind
    ) {
      return false;
    }
  }

  return true;
}
