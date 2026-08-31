import assert from "node:assert/strict";
import test from "node:test";

import {
  isClosedAnalyticsEvent,
  noOpAnalyticsSink,
} from "../lib/stage8/analytics.ts";
import {
  buildRobotsPolicy,
  buildSitemapUrls,
} from "../lib/stage8/discovery.ts";
import {
  closedGateState,
  defectGraphActive,
  documentGraphActive,
  enterpriseFormGraphActive,
  partnerGraphActive,
  privacyGraphActive,
} from "../lib/stage8/gates.ts";
import {
  parseApprovedOrigin,
  resolveReleaseContext,
} from "../lib/stage8/runtime-config.ts";

test("keeps every Stage 8 gate closed by default and activates only complete graphs", () => {
  assert.equal(Object.values(closedGateState).length, 14);
  assert.ok(Object.values(closedGateState).every((value) => value === false));
  assert.equal(enterpriseFormGraphActive(closedGateState), false);
  assert.equal(privacyGraphActive(closedGateState), false);
  assert.equal(partnerGraphActive(closedGateState), false);
  assert.equal(documentGraphActive(closedGateState), false);
  assert.equal(defectGraphActive(closedGateState), false);

  const enterprise = { ...closedGateState, A06: true, A12: true };
  assert.equal(enterpriseFormGraphActive(enterprise), true);
  assert.equal(privacyGraphActive(enterprise), true);
  assert.equal(partnerGraphActive(enterprise), false);
  assert.equal(partnerGraphActive({ ...enterprise, A08: true }), true);
});

test("accepts only an approved pure HTTPS production origin", () => {
  assert.equal(parseApprovedOrigin("https://halo.example.com"), "https://halo.example.com");

  for (const value of [
    undefined,
    "",
    " https://halo.example.com",
    "https://halo.example.com ",
    "http://halo.example.com",
    "https://user@halo.example.com",
    "https://halo.example.com:8443",
    "https://halo.example.com/path",
    "https://halo.example.com/?query=1",
    "https://halo.example.com/#fragment",
    "https://localhost",
    "https://127.0.0.1",
    "https://[::1]",
    "https://preview.workers.dev",
    "https://preview.pages.dev",
    "https://halo.local",
    "https://halo.internal",
    "https://halo.invalid",
    "not a URL",
  ]) {
    assert.equal(parseApprovedOrigin(value), null, String(value));
  }
});

test("requires the release key, approved origin, and exact request origin", () => {
  assert.deepEqual(resolveReleaseContext({}), {
    active: false,
    origin: null,
    reason: "release-mode-disabled",
  });
  assert.equal(
    resolveReleaseContext({ releaseMode: "production" }).reason,
    "release-approval-missing",
  );
  assert.equal(
    resolveReleaseContext({ releaseMode: "production", releaseApproved: "true" }).reason,
    "missing-origin",
  );
  assert.equal(
    resolveReleaseContext({
      releaseMode: "production",
      releaseApproved: "true",
      canonicalOrigin: "http://halo.example.com",
    }).reason,
    "invalid-origin",
  );
  assert.equal(
    resolveReleaseContext({
      releaseMode: "production",
      releaseApproved: "true",
      canonicalOrigin: "https://halo.example.com",
      requestUrl: "https://preview.example.net/",
    }).reason,
    "request-origin-mismatch",
  );
  assert.deepEqual(
    resolveReleaseContext({
      releaseMode: "production",
      releaseApproved: "true",
      canonicalOrigin: "https://halo.example.com",
      requestUrl: "https://halo.example.com/product/?ignored=1",
    }),
    { active: true, origin: "https://halo.example.com", reason: "active" },
  );
});

test("fails robots and sitemap closed until the release context is active", () => {
  const inactive = resolveReleaseContext({});
  assert.deepEqual(buildRobotsPolicy(inactive), {
    allow: [],
    disallow: ["/"],
    sitemap: null,
  });
  assert.deepEqual(buildSitemapUrls(inactive, []), []);

  const active = resolveReleaseContext({
    releaseMode: "production",
    releaseApproved: "true",
    canonicalOrigin: "https://halo.example.com",
  });
  assert.deepEqual(buildRobotsPolicy(active), {
    allow: ["/"],
    disallow: [],
    sitemap: "https://halo.example.com/sitemap.xml",
  });

  const page = (id, path, robots, canonicalPath) => ({
    id,
    path,
    status: "active",
    seo: { robots, canonicalPath },
  });
  const urls = buildSitemapUrls(active, [
    page("P01", "/", "index, follow", "/"),
    page("P02", "/product/", "index, follow", "/product/"),
    page("P26", "/open-halo/", "index, follow", "/open-halo/"),
    page("P15", "/request-poc/", "noindex, follow", "/request-poc/"),
    page("P20", "/404/", "noindex, follow", null),
    page("P02", "/product/", "index, follow", "/product/"),
  ]);
  assert.deepEqual(urls, [
    "https://halo.example.com/",
    "https://halo.example.com/open-halo/",
    "https://halo.example.com/product/",
  ]);
});

test("accepts only the closed non-personal analytics vocabulary and records nothing", () => {
  const event = {
    name: "cta_select",
    dimensions: {
      page_group: "home",
      conversion_intent: "poc",
      cta_source: "home-final",
      source_workload: "oracle",
    },
  };
  assert.equal(isClosedAnalyticsEvent(event), true);
  assert.equal(noOpAnalyticsSink(event), false);
  assert.equal(isClosedAnalyticsEvent({
    name: "page_view",
    dimensions: { page_group: "company", canonical_path: "/open-halo/" },
  }), true);
  assert.equal(isClosedAnalyticsEvent({
    name: "cta_select",
    dimensions: { page_group: "company", conversion_intent: "sales", cta_source: "open-halo" },
  }), true);

  for (const value of [
    { name: "form_recorded", dimensions: { conversion_intent: "poc" }, extra: true },
    { name: "form_recorded", dimensions: {} },
    { name: "form_recorded", dimensions: { conversion_intent: "poc", canonical_path: "/" } },
    { name: "form_recorded", dimensions: { email: "person@example.com" } },
    { name: "form_recorded", dimensions: { canonical_path: "person@example.com" } },
    { name: "form_recorded", dimensions: { canonical_path: "/product/?email=x" } },
    { name: "form_recorded", dimensions: { conversion_intent: "defect" } },
    { name: "form_recorded", dimensions: { cta_source: "arbitrary-user-input" } },
    { name: "provider_success", dimensions: { conversion_intent: "poc" } },
  ]) {
    assert.equal(isClosedAnalyticsEvent(value), false, JSON.stringify(value));
  }
});
