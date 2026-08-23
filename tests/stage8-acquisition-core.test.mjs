import assert from "node:assert/strict";
import test from "node:test";

import {
  ACQUISITION_CANONICAL_ROUTES,
  authorizeBeforeLineage,
  completeNode,
  containsUnsupportedControl,
  createRoutedSourceKey,
  decideClientDispatch,
  decideDestinationAcknowledgement,
  hasInvalidUnicodeScalarSequence,
  handleProjectionMatchesSourceKey,
  intentForCanonicalRoute,
  isValidRepresentationRecord,
  isValidRepresentationBatch,
  lifecyclePolicyIsClosed,
  markOperationInFlight,
  normalizeEmailComparison,
  normalizeTextValue,
  planNextContinuationRegistration,
  planAuthorizedContinuation,
  representationSurface,
  sourceKeysEqual,
  switchReconciliationToDispatch,
  transitionAfterValidation,
  unicodeScalarLength,
  validateKnownPayload,
  authorizeRepresentationHandle,
} from "../lib/stage8/acquisition/index.ts";

const key = Object.freeze({
  sessionId: "session-a",
  intent: "poc",
  canonicalRoute: "/request-poc/",
  action: "/request-poc/",
  logicalId: "root-a",
  generation: 0,
});

const authorized = authorizeBeforeLineage(key, exactEvidence("current"));

function openNode(overrides = {}) {
  return Object.freeze({
    status: "open",
    key,
    revision: 0,
    source: { kind: "initial", boundFingerprint: null },
    ...overrides,
  });
}

function exactEvidence(capabilityState = "current", overrides = {}) {
  return Object.freeze({
    capabilityState,
    authenticatedKey: key,
    logicalProjectionMatches: true,
    handleProjectionMatches: true,
    ...overrides,
  });
}

function select(source, fingerprint = "fp-a", child) {
  return planAuthorizedContinuation(authorized, openNode({ source }), {
    fingerprint,
    payloadSnapshotRef: `snapshot-${fingerprint}`,
    proposedChildLogicalId: child,
  });
}

test("keeps the four fixed intents bound to their canonical server routes", () => {
  assert.deepEqual(ACQUISITION_CANONICAL_ROUTES, {
    poc: "/request-poc/",
    sales: "/contact-sales/",
    demo: "/request-demo/",
    partner: "/partners/apply/",
  });
  assert.equal(intentForCanonicalRoute("/request-demo/"), "demo");
  assert.equal(intentForCanonicalRoute("/request-demo/?intent=sales"), null);
  assert.equal(intentForCanonicalRoute("/unknown/"), null);

  const routed = createRoutedSourceKey({
    sessionId: "s",
    canonicalRoute: "/contact-sales/",
    logicalId: "l",
    generation: 4,
  });
  assert.equal(routed?.intent, "sales");
  assert.equal(createRoutedSourceKey({
    sessionId: "s",
    canonicalRoute: "/contact-sales/",
    logicalId: "l",
    generation: -1,
  }), null);
});

test("collapses every pre-lineage authenticity or binding mismatch before expiry", () => {
  const mismatches = [
    { authenticatedKey: null },
    { logicalProjectionMatches: false },
    { handleProjectionMatches: false },
    { authenticatedKey: { ...key, sessionId: "session-b" } },
    { authenticatedKey: { ...key, intent: "sales" } },
    { authenticatedKey: { ...key, canonicalRoute: "/request-demo/" } },
    { authenticatedKey: { ...key, action: "/contact-sales/" } },
    { authenticatedKey: { ...key, logicalId: "other" } },
    { authenticatedKey: { ...key, generation: 1 } },
  ];

  for (const mismatch of mismatches) {
    assert.deepEqual(
      authorizeBeforeLineage(key, exactEvidence("known-expired", mismatch)),
      { kind: "not-found" },
    );
  }

  assert.deepEqual(authorizeBeforeLineage(key, exactEvidence("invalid")), {
    kind: "not-found",
  });
});

test("permits only exact current/replay tuples and maps exact known expiry without lineage", () => {
  assert.deepEqual(authorizeBeforeLineage(key, exactEvidence("known-expired")), {
    kind: "expired",
    key,
  });
  assert.deepEqual(authorizeBeforeLineage(key, exactEvidence("current")), {
    kind: "authorized",
    key,
    replay: false,
  });
  assert.deepEqual(authorizeBeforeLineage(key, exactEvidence("replay-valid")), {
    kind: "authorized",
    key,
    replay: true,
  });
  assert.equal(sourceKeysEqual(key, { ...key }), true);
});

test("fails closed on runtime-forged capability states and match flags", () => {
  const forgedEvidence = [
    null,
    exactEvidence("future-valid"),
    exactEvidence(1),
    exactEvidence("current", { logicalProjectionMatches: 1 }),
    exactEvidence("current", { logicalProjectionMatches: "true" }),
    exactEvidence("current", { handleProjectionMatches: 1 }),
    exactEvidence("current", { handleProjectionMatches: "true" }),
    exactEvidence("current", {
      authenticatedKey: { ...key, sessionId: 42 },
    }),
  ];

  for (const evidence of forgedEvidence) {
    assert.deepEqual(authorizeBeforeLineage(key, evidence), {
      kind: "not-found",
    });
  }

  assert.deepEqual(
    authorizeBeforeLineage({ ...key, logicalId: null }, exactEvidence("current")),
    { kind: "not-found" },
  );
});

test("rejects a structurally forged authorized decision", () => {
  assert.deepEqual(
    planAuthorizedContinuation(
      { kind: "authorized", key, replay: false },
      openNode(),
      { fingerprint: "fp-a", payloadSnapshotRef: "snapshot-a" },
    ),
    { kind: "integrity-error", code: "source-key-mismatch" },
  );

  assert.deepEqual(
    planAuthorizedContinuation(
      Object.create(authorized),
      openNode(),
      { fingerprint: "fp-a", payloadSnapshotRef: "snapshot-a" },
    ),
    { kind: "integrity-error", code: "source-key-mismatch" },
  );
  const descriptorClone = Object.create(
    Object.getPrototypeOf(authorized),
    Object.getOwnPropertyDescriptors(authorized),
  );
  assert.deepEqual(
    planAuthorizedContinuation(
      descriptorClone,
      openNode(),
      { fingerprint: "fp-a", payloadSnapshotRef: "snapshot-a" },
    ),
    { kind: "integrity-error", code: "source-key-mismatch" },
  );
});

test("selects the current ID for initial and validation submissions", () => {
  for (const kind of ["initial", "validation"]) {
    const plan = select({ kind, boundFingerprint: null });
    assert.equal(plan.kind, "selection-commit");
    assert.equal(plan.nextNode.selection, "parent");
    assert.equal(plan.nextNode.selectedLogicalId, "root-a");
    assert.equal(plan.nextNode.operation, "dispatch");
    assert.equal(plan.nextNode.progress, "selected");
    assert.equal(plan.nextKey.logicalId, "root-a");
    assert.equal(plan.nextKey.generation, 1);
  }
});

test("reserves one inherited child before validation only for an eligible edit", () => {
  const changed = select(
    { kind: "backend-failure", boundFingerprint: "fp-old" },
    "fp-new",
    "child-a",
  );
  assert.equal(changed.kind, "selection-commit");
  assert.equal(changed.nextNode.selection, "child");
  assert.equal(changed.nextNode.selectedLogicalId, "child-a");
  assert.equal(changed.nextKey.logicalId, "child-a");
  assert.equal(changed.nextKey.generation, 1);
  assert.equal(changed.nextKey.sessionId, key.sessionId);
  assert.equal(changed.nextKey.intent, key.intent);
  assert.equal(changed.nextKey.canonicalRoute, key.canonicalRoute);
  assert.equal(changed.nextKey.action, key.action);

  assert.deepEqual(
    select(
      { kind: "backend-failure", boundFingerprint: "fp-old" },
      "fp-new",
    ),
    { kind: "integrity-error", code: "missing-child-id" },
  );
  assert.deepEqual(
    select(
      { kind: "backend-failure", boundFingerprint: "fp-old" },
      "fp-new",
      "root-a",
    ),
    { kind: "integrity-error", code: "invalid-child-id" },
  );
});

test("reconciles an unchanged uncertainty but dispatches a changed child", () => {
  for (const kind of ["unknown", "possible-duplicate"]) {
    const unchanged = select({ kind, boundFingerprint: "fp-a" });
    assert.equal(unchanged.kind, "selection-commit");
    assert.equal(unchanged.nextNode.selection, "parent");
    assert.equal(unchanged.nextNode.operation, "reconcile");

    const changed = select(
      { kind, boundFingerprint: "fp-old" },
      "fp-new",
      `child-${kind}`,
    );
    assert.equal(changed.kind, "selection-commit");
    assert.equal(changed.nextNode.selection, "child");
    assert.equal(changed.nextNode.operation, "dispatch");
  }
});

test("makes one consumed generation deterministic across aliases and replays", () => {
  const selected = select({ kind: "initial", boundFingerprint: null });
  assert.equal(selected.kind, "selection-commit");

  assert.equal(
    planAuthorizedContinuation(authorized, selected.nextNode, {
      fingerprint: "fp-a",
      payloadSnapshotRef: "snapshot-a",
    }).kind,
    "resume-processing",
  );
  assert.deepEqual(
    planAuthorizedContinuation(authorized, selected.nextNode, {
      fingerprint: "fp-conflict",
      payloadSnapshotRef: "snapshot-conflict",
      proposedChildLogicalId: "child-never",
    }),
    { kind: "expired" },
  );

  const inFlight = markOperationInFlight(selected.nextNode);
  assert.equal(
    planAuthorizedContinuation(authorized, inFlight, {
      fingerprint: "fp-a",
      payloadSnapshotRef: "snapshot-a",
    }).kind,
    "reconcile-required",
  );

  const receiptDecision = decideDestinationAcknowledgement(
    inFlight,
    { kind: "recorded", durableRecordRef: "record-poc-a" },
  );
  assert.equal(receiptDecision.kind, "complete");
  const receipt = receiptDecision.completion.result;
  const complete = completeNode(inFlight, receiptDecision.completion);
  assert.deepEqual(
    planAuthorizedContinuation(authorized, complete, {
      fingerprint: "fp-a",
      payloadSnapshotRef: "snapshot-a",
    }),
    { kind: "replay", result: receipt },
  );
});

test("rejects forged consumed-node structure before resume, reconciliation, or replay", () => {
  const selected = select({ kind: "initial", boundFingerprint: null });
  assert.equal(selected.kind, "selection-commit");
  const inFlight = markOperationInFlight(selected.nextNode);
  const receiptDecision = decideDestinationAcknowledgement(inFlight, {
    kind: "recorded",
    durableRecordRef: "record-a",
  });
  assert.equal(receiptDecision.kind, "complete");
  const completeReceipt = completeNode(inFlight, receiptDecision.completion);
  const invalidDecision = transitionAfterValidation(selected.nextNode, false);
  assert.equal(invalidDecision.kind, "complete");
  const completeValidation = completeNode(
    selected.nextNode,
    invalidDecision.completion,
  );
  const context = {
    fingerprint: "fp-a",
    payloadSnapshotRef: "snapshot-a",
  };

  const forgedNodes = [
    { ...selected.nextNode, revision: 0 },
    { ...selected.nextNode, fingerprint: "" },
    { ...selected.nextNode, payloadSnapshotRef: "" },
    { ...selected.nextNode, selection: "parent", selectedLogicalId: "child-a" },
    { ...selected.nextNode, selection: "child", selectedLogicalId: "root-a" },
    {
      ...selected.nextNode,
      selection: "child",
      selectedLogicalId: "child-a",
      operation: "reconcile",
    },
    { ...selected.nextNode, operation: "invented-operation" },
    { ...selected.nextNode, progress: "invented-progress" },
    { ...selected.nextNode, result: receiptDecision.completion.result },
    { ...selected.nextNode, destinationEvidenceRef: "premature-proof" },
    { ...inFlight, destinationEvidenceRef: "premature-proof" },
    { ...completeReceipt, destinationEvidenceRef: null },
    {
      ...completeReceipt,
      result: { ...completeReceipt.result, kind: "possible-duplicate" },
    },
    {
      ...completeReceipt,
      result: { ...completeReceipt.result, kind: "invented-result" },
    },
    {
      ...completeReceipt,
      result: { ...completeReceipt.result, logicalId: "other-logical" },
    },
    { ...completeValidation, destinationEvidenceRef: "forged-proof" },
  ];

  for (const forgedNode of forgedNodes) {
    assert.deepEqual(
      planAuthorizedContinuation(authorized, forgedNode, context),
      { kind: "integrity-error", code: "invalid-node" },
    );
  }

  assert.deepEqual(
    planAuthorizedContinuation(
      authorized,
      { ...selected.nextNode, operation: "invented-operation" },
      { ...context, fingerprint: "different-fingerprint" },
    ),
    { kind: "integrity-error", code: "invalid-node" },
  );
});

test("rejects forged phase inputs before operation or evidence transitions", () => {
  const selected = select({ kind: "initial", boundFingerprint: null });
  assert.equal(selected.kind, "selection-commit");
  const malformedSelected = {
    ...selected.nextNode,
    selection: "child",
    selectedLogicalId: "root-a",
  };
  assert.throws(() => transitionAfterValidation(malformedSelected, true));
  assert.throws(() => markOperationInFlight(malformedSelected));
  assert.throws(() => transitionAfterValidation(selected.nextNode, "true"));

  const inFlight = markOperationInFlight(selected.nextNode);
  for (const forgedAcknowledgement of [
    null,
    { kind: "invented", dispatchRef: "proof" },
    { kind: "recorded", durableRecordRef: "" },
    { kind: "not-recorded", proofRef: "" },
    { kind: "indeterminate", dispatchRef: "" },
    { kind: "indeterminate" },
  ]) {
    assert.throws(() =>
      decideDestinationAcknowledgement(inFlight, forgedAcknowledgement),
    );
  }
});

test("rejects internal source-key drift instead of reading a different lineage", () => {
  const wrongNode = openNode({ key: { ...key, sessionId: "session-b" } });
  assert.deepEqual(
    planAuthorizedContinuation(authorized, wrongNode, {
      fingerprint: "fp-a",
      payloadSnapshotRef: "snapshot-a",
    }),
    { kind: "integrity-error", code: "source-key-mismatch" },
  );
});

test("validates before dispatch and preserves the selected child on failure", () => {
  const selected = select(
    { kind: "backend-failure", boundFingerprint: "fp-old" },
    "fp-new",
    "child-a",
  );
  assert.equal(selected.kind, "selection-commit");

  const invalid = transitionAfterValidation(selected.nextNode, false);
  assert.equal(invalid.kind, "complete");
  assert.deepEqual(invalid.completion.result, {
    kind: "field-validation",
    intent: "poc",
    logicalId: "child-a",
  });
  const completedInvalid = completeNode(selected.nextNode, invalid.completion);
  assert.equal(completedInvalid.progress, "complete");
  assert.deepEqual(transitionAfterValidation(selected.nextNode, true), {
    kind: "start-operation",
    operation: "dispatch",
  });
});

test("maps only durable acknowledgement to the intent-matched recorded result", () => {
  const demoKey = {
    ...key,
    intent: "demo",
    canonicalRoute: "/request-demo/",
    action: "/request-demo/",
    logicalId: "demo-a",
  };
  const demoAuthorized = authorizeBeforeLineage(
    demoKey,
    exactEvidence("current", { authenticatedKey: demoKey }),
  );
  const demoSelected = planAuthorizedContinuation(
    demoAuthorized,
    openNode({ key: demoKey }),
    { fingerprint: "fp-demo", payloadSnapshotRef: "snapshot-demo" },
  );
  assert.equal(demoSelected.kind, "selection-commit");
  const demoInFlight = markOperationInFlight(demoSelected.nextNode);
  const recorded = decideDestinationAcknowledgement(
    demoInFlight,
    { kind: "recorded", durableRecordRef: "record-demo-a" },
  );
  const failed = decideDestinationAcknowledgement(
    demoInFlight,
    { kind: "not-recorded", proofRef: "proof-demo-a" },
  );
  const unknown = decideDestinationAcknowledgement(
    demoInFlight,
    { kind: "indeterminate", dispatchRef: "dispatch-demo-a" },
  );
  assert.equal(recorded.kind, "complete");
  assert.equal(failed.kind, "complete");
  assert.equal(unknown.kind, "complete");
  assert.deepEqual(recorded.completion.result, {
    kind: "recorded",
    intent: "demo",
    logicalId: "demo-a",
  });
  assert.deepEqual(failed.completion.result, {
    kind: "backend-recording-failure",
    intent: "demo",
    logicalId: "demo-a",
  });
  assert.deepEqual(unknown.completion.result, {
    kind: "submission-status-unknown",
    intent: "demo",
    logicalId: "demo-a",
  });
});

test("keeps reconciliation separate from retry dispatch", () => {
  const salesKey = {
    ...key,
    intent: "sales",
    canonicalRoute: "/contact-sales/",
    action: "/contact-sales/",
    logicalId: "sales-a",
  };
  const salesAuthorized = authorizeBeforeLineage(
    salesKey,
    exactEvidence("current", { authenticatedKey: salesKey }),
  );
  const salesSelected = planAuthorizedContinuation(
    salesAuthorized,
    openNode({
      key: salesKey,
      source: { kind: "unknown", boundFingerprint: "fp-sales" },
    }),
    { fingerprint: "fp-sales", payloadSnapshotRef: "snapshot-sales" },
  );
  assert.equal(salesSelected.kind, "selection-commit");
  const salesInFlight = markOperationInFlight(salesSelected.nextNode);
  const recorded = decideDestinationAcknowledgement(
    salesInFlight,
    { kind: "recorded", durableRecordRef: "record-sales-a" },
  );
  const duplicate = decideDestinationAcknowledgement(
    salesInFlight,
    { kind: "indeterminate", dispatchRef: "dispatch-sales-a" },
  );
  assert.equal(recorded.kind, "complete");
  assert.equal(duplicate.kind, "complete");
  assert.deepEqual(recorded.completion.result, {
    kind: "recorded",
    intent: "sales",
    logicalId: "sales-a",
  });
  assert.deepEqual(duplicate.completion.result, {
    kind: "possible-duplicate",
    intent: "sales",
    logicalId: "sales-a",
  });
  assert.deepEqual(
    decideDestinationAcknowledgement(
      salesInFlight,
      { kind: "not-recorded", proofRef: "proof-sales-a" },
    ),
    { kind: "dispatch-required" },
  );

  const selected = select({ kind: "unknown", boundFingerprint: "fp-a" });
  assert.equal(selected.kind, "selection-commit");
  const reconciling = markOperationInFlight(selected.nextNode);
  const dispatching = switchReconciliationToDispatch(reconciling);
  assert.equal(dispatching.operation, "dispatch");
  assert.equal(dispatching.progress, "selected");
});

test("does not make a fabricated or premature recorded receipt API-legal", () => {
  const selected = select({ kind: "initial", boundFingerprint: null });
  assert.equal(selected.kind, "selection-commit");
  const durable = decideDestinationAcknowledgement(
    markOperationInFlight(selected.nextNode),
    { kind: "recorded", durableRecordRef: "record-poc-a" },
  );
  assert.equal(durable.kind, "complete");
  assert.throws(() => completeNode(selected.nextNode, durable.completion));
  const originalInFlight = markOperationInFlight(selected.nextNode);
  const otherSelection = select({ kind: "initial", boundFingerprint: null });
  assert.equal(otherSelection.kind, "selection-commit");
  const otherInFlight = markOperationInFlight({
    ...otherSelection.nextNode,
    key: { ...otherSelection.nextNode.key, sessionId: "session-b" },
  });
  assert.throws(() => completeNode(otherInFlight, durable.completion));
  assert.throws(() =>
    completeNode(originalInFlight, {
      result: durable.completion.result,
    }),
  );
  const reflectedCompletion = Object.create(
    Object.getPrototypeOf(durable.completion),
    Object.getOwnPropertyDescriptors(durable.completion),
  );
  assert.throws(() => completeNode(originalInFlight, reflectedCompletion));
});

test("derives fresh next-generation form authority only from a completed state", () => {
  const selected = select({ kind: "initial", boundFingerprint: null });
  assert.equal(selected.kind, "selection-commit");
  const invalid = transitionAfterValidation(selected.nextNode, false);
  assert.equal(invalid.kind, "complete");
  const completedInvalid = completeNode(selected.nextNode, invalid.completion);
  const validationNext = planNextContinuationRegistration(
    completedInvalid,
    "csrf-next-validation",
  );
  assert.equal(validationNext.node.key.generation, 1);
  assert.equal(validationNext.node.key.logicalId, "root-a");
  assert.deepEqual(validationNext.node.source, {
    kind: "validation",
    boundFingerprint: null,
  });

  const dispatchSelected = select({ kind: "initial", boundFingerprint: null });
  assert.equal(dispatchSelected.kind, "selection-commit");
  const inFlight = markOperationInFlight(dispatchSelected.nextNode);
  const failed = decideDestinationAcknowledgement(
    inFlight,
    { kind: "not-recorded", proofRef: "no-record-proof" },
  );
  assert.equal(failed.kind, "complete");
  const completedFailure = completeNode(inFlight, failed.completion);
  const failureNext = planNextContinuationRegistration(
    completedFailure,
    "csrf-next-failure",
  );
  assert.deepEqual(failureNext.node.source, {
    kind: "backend-failure",
    boundFingerprint: "fp-a",
  });

  const recorded = decideDestinationAcknowledgement(
    inFlight,
    { kind: "recorded", durableRecordRef: "durable-record" },
  );
  assert.equal(recorded.kind, "complete");
  const completedReceipt = completeNode(inFlight, recorded.completion);
  assert.equal(planNextContinuationRegistration(completedReceipt, null), null);
  assert.throws(() =>
    planNextContinuationRegistration(completedReceipt, "csrf-forbidden"),
  );
});

test("keeps replay, proof, and lineage lifecycles aligned", () => {
  assert.equal(
    lifecyclePolicyIsClosed({
      sourceGenerationExpiresAt: 200,
      replayWindowEndsAt: 100,
      csrfProofExpiresAt: 200,
      csrfProofCleanupAt: 300,
      lineageCleanupAt: 300,
    }),
    true,
  );
  for (const patch of [
    { sourceGenerationExpiresAt: 99 },
    { csrfProofExpiresAt: 99 },
    { csrfProofCleanupAt: 99 },
    { lineageCleanupAt: 99 },
  ]) {
    assert.equal(
      lifecyclePolicyIsClosed({
        sourceGenerationExpiresAt: 200,
        replayWindowEndsAt: 100,
        csrfProofExpiresAt: 200,
        csrfProofCleanupAt: 300,
        lineageCleanupAt: 300,
        ...patch,
      }),
      false,
    );
  }
});

test("authorizes handle projections before loading and expires no receipt surface", () => {
  const request = {
    sessionId: "session-a",
    intent: "poc",
    canonicalRoute: "/request-poc/",
  };
  const projection = {
    ...request,
    action: "/request-poc/",
    logicalId: "root-a",
    generation: 0,
    class: "form",
    lifecycle: "current",
  };
  assert.deepEqual(authorizeRepresentationHandle(request, projection), {
    kind: "authorized-to-load",
  });
  assert.deepEqual(
    authorizeRepresentationHandle(request, {
      ...projection,
      lifecycle: "known-expired",
    }),
    { kind: "expired-form" },
  );
  assert.deepEqual(
    authorizeRepresentationHandle(request, {
      ...projection,
      class: "receipt",
      lifecycle: "known-expired",
    }),
    { kind: "not-found" },
  );

  for (const mismatch of [
    null,
    { ...projection, sessionId: "session-b" },
    { ...projection, intent: "sales" },
    { ...projection, canonicalRoute: "/request-demo/" },
    { ...projection, action: "/contact-sales/" },
    { ...projection, logicalId: "" },
    { ...projection, generation: -1 },
    { ...projection, generation: 0.5 },
    { ...projection, generation: Number.MAX_SAFE_INTEGER + 1 },
  ]) {
    assert.deepEqual(authorizeRepresentationHandle(request, mismatch), {
      kind: "not-found",
    });
  }
});

test("matches a POST handle projection against the complete source K", () => {
  const projection = {
    sessionId: "session-a",
    intent: "poc",
    canonicalRoute: "/request-poc/",
    action: "/request-poc/",
    logicalId: "root-a",
    generation: 0,
    class: "form",
    lifecycle: "current",
  };
  assert.equal(handleProjectionMatchesSourceKey(projection, key), true);

  for (const mismatch of [
    null,
    { ...projection, sessionId: "session-b" },
    { ...projection, intent: "sales", canonicalRoute: "/contact-sales/", action: "/contact-sales/" },
    { ...projection, canonicalRoute: "/request-demo/" },
    { ...projection, action: "/contact-sales/" },
    { ...projection, logicalId: "root-b" },
    { ...projection, generation: 1 },
    { ...projection, generation: -1 },
  ]) {
    assert.equal(handleProjectionMatchesSourceKey(mismatch, key), false);
  }

  assert.equal(
    handleProjectionMatchesSourceKey(projection, {
      ...key,
      action: "/contact-sales/",
    }),
    false,
  );
});

test("validates form, uncertainty, receipt, and exact-expiry representation records", () => {
  const base = {
    handle: "state-a",
    sessionId: "session-a",
    intent: "poc",
    canonicalRoute: "/request-poc/",
    action: "/request-poc/",
    logicalId: "root-a",
    generation: 0,
    issuedAt: 10,
    expiresAt: 20,
  };
  const form = {
    ...base,
    class: "form",
    sourceKey: key,
    payloadSnapshotRef: "snapshot-a",
    returnedFormHandle: null,
    result: {
      kind: "field-validation",
      intent: "poc",
      logicalId: "root-a",
    },
  };
  assert.equal(isValidRepresentationRecord(form), true);
  assert.equal(
    isValidRepresentationRecord({
      ...form,
      class: "uncertainty",
      returnedFormHandle: "returned-form-a",
      result: {
        kind: "submission-status-unknown",
        intent: "poc",
        logicalId: "root-a",
      },
    }),
    true,
  );
  assert.equal(
    isValidRepresentationRecord({
      ...form,
      class: "receipt",
      payloadSnapshotRef: null,
      returnedFormHandle: null,
      result: { kind: "recorded", intent: "poc", logicalId: "root-a" },
    }),
    true,
  );
  assert.equal(
    isValidRepresentationRecord({
      ...base,
      class: "expired",
      sourceKey: null,
      payloadSnapshotRef: null,
      returnedFormHandle: null,
      result: null,
    }),
    true,
  );
  assert.equal(
    isValidRepresentationRecord({
      ...form,
      class: "receipt",
      payloadSnapshotRef: null,
    }),
    false,
  );
  assert.equal(
    isValidRepresentationRecord({
      ...form,
      class: "uncertainty",
      returnedFormHandle: null,
      result: {
        kind: "possible-duplicate",
        intent: "poc",
        logicalId: "root-a",
      },
    }),
    false,
  );
  assert.equal(
    isValidRepresentationRecord({ ...form, returnedFormHandle: "forbidden" }),
    false,
  );
  assert.equal(
    isValidRepresentationRecord({
      ...form,
      sourceKey: { ...key, logicalId: "cross-logical" },
    }),
    false,
  );
  assert.equal(
    isValidRepresentationRecord({
      ...form,
      sourceKey: { ...key, generation: 1 },
    }),
    false,
  );
  assert.equal(
    isValidRepresentationRecord({ ...form, issuedAt: 0, expiresAt: 1 }),
    true,
  );
  for (const forged of [
    {
      ...form,
      class: "invented-class",
      returnedFormHandle: "returned-a",
      result: {
        kind: "submission-status-unknown",
        intent: "poc",
        logicalId: "root-a",
      },
    },
    { ...form, issuedAt: -10, expiresAt: -1 },
    { ...form, payloadSnapshotRef: 42 },
    {
      ...form,
      result: { kind: "invented-result", intent: "poc", logicalId: "root-a" },
    },
    { ...form, handle: 42 },
    null,
  ]) {
    assert.equal(isValidRepresentationRecord(forged), false);
  }
});

test("atomically binds each uncertainty state to its returned form", () => {
  const returnedForm = {
    handle: "returned-a",
    sessionId: "session-a",
    intent: "poc",
    canonicalRoute: "/request-poc/",
    action: "/request-poc/",
    logicalId: "root-a",
    generation: 0,
    class: "continuation-form",
    issuedAt: 10,
    expiresAt: 20,
    sourceKey: key,
    payloadSnapshotRef: "snapshot-a",
    returnedFormHandle: null,
    result: {
      kind: "submission-status-unknown",
      intent: "poc",
      logicalId: "root-a",
    },
  };
  const unknown = {
    ...returnedForm,
    handle: "unknown-a",
    class: "uncertainty",
    returnedFormHandle: "returned-a",
    result: {
      kind: "submission-status-unknown",
      intent: "poc",
      logicalId: "root-a",
    },
  };
  assert.equal(isValidRepresentationRecord(returnedForm), true);
  assert.equal(isValidRepresentationBatch([unknown, returnedForm]), true);
  assert.equal(
    isValidRepresentationBatch([
      {
        ...unknown,
        result: {
          kind: "possible-duplicate",
          intent: "poc",
          logicalId: "root-a",
        },
      },
      {
        ...returnedForm,
        result: {
          kind: "possible-duplicate",
          intent: "poc",
          logicalId: "root-a",
        },
      },
    ]),
    true,
  );
  assert.equal(isValidRepresentationBatch([unknown]), false);
  assert.equal(
    isValidRepresentationBatch([
      unknown,
      { ...returnedForm, sessionId: "session-b" },
    ]),
    false,
  );
  assert.equal(
    isValidRepresentationBatch([
      unknown,
      {
        ...returnedForm,
        generation: 1,
        sourceKey: { ...key, generation: 1 },
      },
    ]),
    false,
  );
  assert.equal(
    isValidRepresentationBatch([
      unknown,
      { ...returnedForm, payloadSnapshotRef: "snapshot-b" },
    ]),
    false,
  );
  assert.equal(
    isValidRepresentationBatch([
      unknown,
      {
        ...returnedForm,
        result: {
          kind: "possible-duplicate",
          intent: "poc",
          logicalId: "root-a",
        },
      },
    ]),
    false,
  );
  assert.equal(isValidRepresentationBatch([returnedForm, returnedForm]), false);
  assert.equal(isValidRepresentationBatch(null), false);
});

test("uses Not sent only for positive proof that dispatch did not begin", () => {
  assert.deepEqual(decideClientDispatch("positively-not-started"), {
    kind: "definite-pre-transmission-failure",
  });
  assert.deepEqual(decideClientDispatch("may-have-started"), {
    kind: "submission-status-unknown",
  });
  assert.deepEqual(decideClientDispatch("server-response-pending"), {
    kind: "await-server",
  });
  assert.throws(() => decideClientDispatch("invented-observation"));
});

test("keeps Not sent client-local and out of persisted continuation sources", () => {
  assert.equal(
    /not-sent/.test(
      JSON.stringify({
        initial: select({ kind: "initial", boundFingerprint: null }).nextNode,
        backend: select({
          kind: "backend-failure",
          boundFingerprint: "fp-a",
        }).nextNode,
        unknown: select({ kind: "unknown", boundFingerprint: "fp-a" }).nextNode,
      }),
    ),
    false,
  );
});

test("allocates inline and reduced surfaces without duplicating a state", () => {
  assert.equal(
    representationSurface({
      kind: "field-validation",
      intent: "partner",
      logicalId: "p",
    }),
    "inline-form",
  );
  assert.equal(
    representationSurface({
      kind: "backend-recording-failure",
      intent: "partner",
      logicalId: "p",
    }),
    "inline-form",
  );
  for (const kind of [
    "submission-status-unknown",
    "possible-duplicate",
    "recorded",
  ]) {
    assert.equal(
      representationSurface({ kind, intent: "partner", logicalId: "p" }),
      "reduced-state",
    );
  }
  assert.throws(() =>
    representationSurface({
      kind: "invented-result",
      intent: "partner",
      logicalId: "p",
    }),
  );
});

test("normalizes only approved schema keys and preserves display case", () => {
  const schema = {
    name: { kind: "text", required: true, maximumScalars: 10 },
    context: {
      kind: "text",
      required: true,
      maximumScalars: 30,
      multiline: true,
    },
    email: { kind: "email", required: true, maximumScalars: 254 },
    website: { kind: "url", required: false, maximumScalars: 2048 },
    topic: {
      kind: "enum",
      required: true,
      values: new Set(["one", "two"]),
    },
    authority: { kind: "boolean", requiredTrue: true },
  };
  const result = validateKnownPayload(
    {
      name: "  Ada Lovelace  ",
      context: " Line 1\r\nLine 2 ",
      email: " Ada@Example.COM ",
      website: "https://example.com/path?q=kept",
      topic: "two",
      authority: true,
      injected_intent: "sales",
    },
    schema,
  );

  assert.deepEqual(result.issues, [{ field: "name", code: "too-long" }]);
  assert.equal(result.values.context, "Line 1\nLine 2");
  assert.equal(result.values.email, "Ada@Example.COM");
  assert.equal(result.values.website, "https://example.com/path?q=kept");
  assert.equal(result.comparisonValues.email, "Ada@example.com");
  assert.equal(result.ignoredKeyCount, 1);
  assert.equal("injected_intent" in result.values, false);
});

test("applies required, maximum, control, then format precedence", () => {
  const schema = {
    email: { kind: "email", required: true, maximumScalars: 3 },
  };

  assert.deepEqual(validateKnownPayload({ email: "   " }, schema).issues, [
    { field: "email", code: "missing" },
  ]);
  assert.deepEqual(validateKnownPayload({ email: "abcd\u0000" }, schema).issues, [
    { field: "email", code: "too-long" },
  ]);
  assert.deepEqual(validateKnownPayload({ email: "a\u0000" }, schema).issues, [
    { field: "email", code: "unsupported-control" },
  ]);
  assert.deepEqual(validateKnownPayload({ email: "not-email" }, {
    email: { kind: "email", required: true, maximumScalars: 20 },
  }).issues, [{ field: "email", code: "invalid-format" }]);
});

test("counts Unicode scalar positions and permits only textarea tab/newline controls", () => {
  assert.equal(unicodeScalarLength("A😀B"), 3);
  assert.equal(hasInvalidUnicodeScalarSequence("A\ud800B"), true);
  assert.throws(() => unicodeScalarLength("A\ud800B"));
  assert.equal(normalizeTextValue("  a\r\nb  "), "a\nb");
  assert.equal(containsUnsupportedControl("a\tb\nc", true), false);
  assert.equal(containsUnsupportedControl("a\tb", false), true);
  assert.equal(containsUnsupportedControl("a\u0000b", true), true);
  assert.equal(normalizeEmailComparison("Local@EXAMPLE.COM"), "Local@example.com");
});

test("keeps additional email policy injectable without hard-coded domain rules", () => {
  const schema = {
    email: { kind: "email", required: true, maximumScalars: 254 },
  };
  assert.deepEqual(validateKnownPayload({ email: "person@intranet" }, schema).issues, []);
  assert.deepEqual(
    validateKnownPayload({ email: "person@intranet" }, schema, {
      email: (value) => value.endsWith(".example"),
    }).issues,
    [{ field: "email", code: "invalid-format" }],
  );
  assert.deepEqual(validateKnownPayload({ email: "a\ud800@b" }, schema).issues, [
    { field: "email", code: "unsupported-control" },
  ]);
});

test("rejects repeated or wrong-typed known controls without copying their values", () => {
  const schema = {
    topic: { kind: "enum", required: true, values: new Set(["one"]) },
    authority: { kind: "boolean", requiredTrue: true },
  };
  const result = validateKnownPayload(
    { topic: ["one", "one"], authority: "true" },
    schema,
  );
  assert.deepEqual(result.issues, [
    { field: "topic", code: "invalid-cardinality" },
    { field: "authority", code: "invalid-type" },
  ]);
  assert.deepEqual(result.values, {});
});
