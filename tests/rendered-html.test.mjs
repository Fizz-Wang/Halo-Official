import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

const publicOutput = new URL("../dist/client/", import.meta.url);
const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("acceptance", `${process.pid}-${Date.now()}`);
const { default: worker } = await import(workerUrl.href);

const env = {
  ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  IMAGES: { input: () => { throw new Error("Image service is not used."); } },
};
const context = { waitUntil() {}, passThroughOnException() {} };

const activeRoutes = [
  ["/", "Halo Database | One Database, Three Operating Modes", "One database. Three ways in.", "index, follow", "Explore how Halo 1.0.16 handles compatibility, migration decisions, conditional role changes, database-aware routing, and partitioned data placement."],
  ["/product/", "Halo Database Platform Overview", "A unified database platform for compatibility-led modernization.", "index, follow", "Explore Halo compatibility modes, database architecture, availability, distributed data, recovery, and operational capabilities."],
  ["/product/architecture/", "Architecture & Core Technology | Halo Database", "Understand the database beneath the compatibility layer.", "index, follow", "Understand Halo instances, clusters, transactions, isolation, indexing, partitioning, storage, and database objects."],
  ["/oracle-migration-evaluation/", "Oracle Migration Evaluation | Halo Database", "Evaluate compatibility before you estimate the rewrite.", "index, follow", "Evaluate Oracle protocol, schema, SQL, PL/SQL, Package, metadata, DBLINK, recovery, and operating dependencies on Halo."],
  ["/product/compatibility/", "Oracle, MySQL & PostgreSQL Compatibility | Halo Database", "Compatibility across protocol, language, and execution behavior.", "index, follow", "Review Halo compatibility across protocols, data types, SQL behavior, procedural logic, metadata, and explicit workload boundaries."],
  ["/product/availability-recovery/", "Availability & Recovery | Halo Database", "Keep services recoverable. Make the trade-offs visible.", "index, follow", "Explore Halo replication, grouped durability, Halo Shield orchestration, RMAN2 backup, validation, and point-in-time recovery."],
  ["/product/distributed/", "Distributed Data | Halo Database", "Distribute reads, writes, and data with explicit architecture choices.", "index, follow", "Understand Halo DLB read scaling, TWR write forwarding, HSM shared storage, and HDS data sharding with explicit boundaries."],
  ["/product/operations/", "Operations & Observability | Halo Database", "Operate Halo with familiar controls and visible evidence.", "index, follow", "Explore Halo platform coverage, tuning surfaces, resource controls, HWR diagnostics, system visibility, and DBA tooling."],
  ["/product/data-platform/", "Data Platform & Extensions | Halo Database", "Extend the database where the documented capability fits.", "index, follow", "Explore Halo extensions, data types, search, federation, security, events, diagnostics, and the documented MRT registry boundary."],
  ["/evaluation/", "Halo Database Proof-of-Concept Method", "Turn product capability into a workload decision.", "index, follow", "Define the workload, test Halo against agreed criteria, and leave with a proceed, remediate, or stop decision."],
  ["/resources/", "Halo Database Resources", "Find the product answer by question—not by manual chapter.", "index, follow", "Find Halo product, migration, architecture, recovery, distributed-data, operations, evidence, and evaluation resources by question."],
  ["/resources/documentation/", "Halo 1.0.16 Product Documentation Basis", "Product knowledge, reorganized for enterprise evaluation.", "index, follow", "See how the Halo 1.0.16 manual is reorganized into enterprise product, migration, architecture, and operations content."],
  ["/resources/evidence/", "Evidence & Validation | Halo Database", "See what each Halo claim establishes—and what it does not.", "index, follow", "See what material Halo statements establish, their manual source, their limits, and what a workload evaluation must validate."],
  ["/resources/evaluation-checklist/", "Halo Database Evaluation Checklist", "Bring the application, architecture, and decision criteria.", "index, follow", "Prepare the application, compatibility surface, data, workload, target architecture, operations, and acceptance record for a Halo PoC."],
  ["/company/", "About Halo Database", "Built from a migration problem. Evolved into a unified database.", "index, follow", "Learn how an Oracle migration problem led to Halo’s multimode, openHalo-based database platform."],
  ["/request-poc/", "Prepare a Halo Database PoC", "Define what Halo needs to prove.", "noindex, follow", "Prepare a workload-specific Halo proof-of-concept plan."],
  ["/contact-sales/", "Halo Database Commercial Planning", "Prepare commercial, procurement, and regional-fit questions.", "noindex, follow", "Prepare commercial, procurement, deployment-scope, or regional-fit questions for Halo Database."],
  ["/request-demo/", "Prepare a Halo Database Demo Brief", "Choose the Halo capabilities you want to explore.", "noindex, follow", "Choose the Halo capabilities to organize for a future product introduction."],
];

async function render(path) {
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    env,
    context,
  );
}

function tagText(html, tag) {
  const value = html.match(new RegExp(`<${tag}[^>]*>(.*?)<\\/${tag}>`, "is"))?.[1] ?? "";
  return value.replace(/<[^>]+>/g, "").replaceAll("&amp;", "&").trim();
}

function count(html, pattern) {
  return html.match(pattern)?.length ?? 0;
}

function metaContents(html, name) {
  return [...html.matchAll(/<meta\b[^>]*>/gi)]
    .filter((match) => new RegExp(`\\bname=["']${name}["']`, "i").test(match[0]))
    .map((match) => (match[0].match(/\bcontent=["']([^"']*)["']/i)?.[1] ?? "").replaceAll("&amp;", "&"));
}

function propertyContents(html, property) {
  return [...html.matchAll(/<meta\b[^>]*>/gi)]
    .filter((match) => new RegExp(`\\bproperty=["']${property}["']`, "i").test(match[0]))
    .map((match) => (match[0].match(/\bcontent=["']([^"']*)["']/i)?.[1] ?? "").replaceAll("&amp;", "&"));
}

function canonicalHref(html) {
  const tags = [...html.matchAll(/<link\b[^>]*>/gi)].map((match) => match[0]);
  const tag = tags.find((value) => /\brel=["']canonical["']/i.test(value));
  return tag?.match(/\bhref=["']([^"']*)["']/i)?.[1] ?? null;
}

function scriptNonce(tag) {
  return tag.match(/\bnonce=["']([^"']+)["']/i)?.[1] ?? null;
}

test("renders every active Stage 7 route with exact SEO and one semantic shell", async () => {
  for (const [path, title, h1, , description] of activeRoutes) {
    const response = await render(path);
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i, path);
    const html = await response.text();

    assert.equal(tagText(html, "title"), title, `${path} title`);
    assert.equal(tagText(html, "h1"), h1, `${path} H1`);
    assert.equal(canonicalHref(html), path, `${path} canonical`);
    assert.ok(metaContents(html, "robots").includes("noindex, follow"), `${path} preview robots`);
    const descriptions = metaContents(html, "description");
    assert.equal(descriptions.length, 1, `${path} description count`);
    assert.equal(descriptions[0], description, `${path} description value`);
    assert.deepEqual(propertyContents(html, "og:title"), [title], `${path} OG title`);
    assert.deepEqual(propertyContents(html, "og:description"), descriptions, `${path} OG description`);
    assert.deepEqual(metaContents(html, "twitter:card"), ["summary_large_image"], `${path} Twitter card`);
    assert.deepEqual(metaContents(html, "twitter:title"), [title], `${path} Twitter title`);
    assert.deepEqual(metaContents(html, "twitter:description"), descriptions, `${path} Twitter description`);
    assert.equal(count(html, /<nav\b[^>]*aria-label=["']Primary["']/gi), 1, `${path} Primary navigation`);
    assert.equal(count(html, /<main\b/gi), 1, `${path} main`);
    assert.equal(count(html, /<h1\b/gi), 1, `${path} H1 count`);
    assert.equal(count(html, /<form\b/gi), 0, `${path} form remains Stage 8-gated`);
    assert.doesNotMatch(html, /Next steps|Related actions/);
  }
});

test("normalizes every non-root canonical route to its approved trailing slash", async () => {
  for (const [path] of activeRoutes.filter(([path]) => path !== "/")) {
    const slashless = path.slice(0, -1);
    const response = await render(slashless);
    assert.equal(response.status, 308, slashless);
    assert.equal(response.headers.get("location"), path, slashless);
  }
});

test("does not redirect unmatched or gated slashless URLs before the exact 404", async () => {
  for (const path of ["/privacy", "/partners", "/case-studies/example", "/does-not-exist"]) {
    const response = await render(path);
    assert.equal(response.status, 404, path);
    assert.equal(response.headers.get("location"), null, path);
    const html = await response.text();
    assert.equal(tagText(html, "title"), "Page not found | Halo Database", path);
    assert.equal(tagText(html, "h1"), "Page not found.", path);
  }
});

test("keeps unmatched and gated routes at a direct 404 for GET/HEAD content negotiation", async () => {
  for (const path of ["/privacy", "/partners", "/does-not-exist"]) {
    for (const accept of ["text/html", "*/*", "application/json", ""]) {
      for (const method of ["GET", "HEAD"]) {
        const headers = accept ? { accept } : {};
        const response = await worker.fetch(
          new Request(`http://localhost${path}`, { method, headers }),
          env,
          context,
        );
        assert.equal(response.status, 404, `${method} ${accept || "no Accept"} ${path}`);
        assert.equal(response.headers.get("location"), null, path);
        if (method === "HEAD") assert.equal(await response.text(), "", path);
      }
    }
  }

  for (const path of ["/_next/missing.js", "/_vinext/missing.css", "/missing.svg"]) {
    const response = await render(path);
    assert.equal(response.status, 404, path);
    assert.equal(response.headers.get("location"), null, path);
  }
});

test("returns no response body for HEAD across pages, redirects, and asset paths", async () => {
  for (const [path, expectedStatus, expectedLocation] of [
    ["/", 200, null],
    ["/product/", 200, null],
    ["/request-poc/", 200, null],
    ["/product", 308, "/product/"],
    ["/_next/missing.js", 404, null],
    ["/missing.svg", 404, null],
  ]) {
    const response = await worker.fetch(
      new Request(`http://localhost${path}`, { method: "HEAD" }),
      env,
      context,
    );
    assert.equal(response.status, expectedStatus, path);
    assert.equal(response.headers.get("location"), expectedLocation, path);
    assert.equal(await response.text(), "", path);
  }
});

test("keeps every dormant acquisition write surface unavailable", async () => {
  for (const path of [
    "/request-poc/",
    "/request-poc",
    "/contact-sales/",
    "/contact-sales",
    "/request-demo/",
    "/request-demo",
    "/partners/apply/",
    "/partners/apply",
  ]) {
    for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
      const response = await worker.fetch(
        new Request(`http://localhost${path}`, { method }),
        env,
        context,
      );
      const expectedStatus = path.startsWith("/partners/apply") ? 404 : 405;
      assert.equal(response.status, expectedStatus, `${method} ${path}`);
      assert.equal(response.headers.get("set-cookie"), null, `${method} ${path}`);
      assert.equal(await response.text(), "", `${method} ${path}`);
    }
  }

  for (const path of [
    "/api/acquisition",
    "/api/acquisition/",
    "/api/acquisition/random",
    "/api/forms",
    "/api/forms/",
    "/api/forms/poc",
    "/forms/state",
    "/forms/state/",
    "/forms/state/random",
  ]) {
    for (const method of ["GET", "HEAD", "POST", "OPTIONS"]) {
      for (const accept of ["*/*", "text/html", "application/json"]) {
        const response = await worker.fetch(
          new Request(`http://localhost${path}`, {
            method,
            headers: { Accept: accept },
          }),
          env,
          context,
        );
        const label = `${method} ${path} (${accept})`;
        assert.equal(response.status, 404, label);
        assert.equal(response.headers.get("allow"), null, label);
        assert.equal(response.headers.get("set-cookie"), null, label);
        assert.equal(response.headers.get("cache-control"), "private, no-store", label);
        assert.equal(response.headers.get("referrer-policy"), "no-referrer", label);
        assert.equal(await response.text(), "", label);
      }
    }
  }
});

test("applies the fail-closed Stage 8 document security and cache policy", async () => {
  const publicPage = await render("/product/");
  assert.equal(publicPage.headers.get("cache-control"), "private, no-store");
  assert.equal(publicPage.headers.get("referrer-policy"), "strict-origin-when-cross-origin");

  for (const path of ["/request-poc/", "/contact-sales/", "/request-demo/"]) {
    const response = await render(path);
    assert.equal(response.headers.get("cache-control"), "private, no-store", path);
    assert.equal(response.headers.get("referrer-policy"), "no-referrer", path);
  }

  const notFoundResponse = await render("/does-not-exist");
  assert.equal(notFoundResponse.headers.get("cache-control"), "private, no-store");

  for (const response of [publicPage, notFoundResponse]) {
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("x-frame-options"), "DENY");
    assert.equal(
      response.headers.get("permissions-policy"),
      "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
    );
    const csp = response.headers.get("content-security-policy") ?? "";
    assert.match(csp, /^default-src 'self'; /);
    assert.match(csp, /base-uri 'none'/);
    assert.match(csp, /object-src 'none'/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(csp, /form-action 'self'/);
    assert.match(csp, /script-src 'self' 'nonce-[A-Za-z0-9+/=]+'/);
    assert.match(csp, /script-src-attr 'none'/);
    assert.match(csp, /style-src 'self' 'unsafe-inline'/);
    assert.match(csp, /img-src 'self' data:/);
    assert.match(csp, /connect-src 'self'/);
  }

  const publicCsp = publicPage.headers.get("content-security-policy") ?? "";
  const nonce = publicCsp.match(/'nonce-([^']+)'/)?.[1];
  assert.ok(nonce);
  const publicHtml = await publicPage.text();
  const scriptTags = [...publicHtml.matchAll(/<script\b[^>]*>/gi)].map((match) => match[0]);
  assert.ok(scriptTags.length > 0);
  assert.ok(scriptTags.every((tag) => scriptNonce(tag) === nonce));
  assert.equal(scriptNonce('<script nonce="abc+def/ghi=">'), "abc+def/ghi=");
});

test("keeps preview discovery closed without a production origin", async () => {
  const robots = await render("/robots.txt");
  assert.equal(robots.status, 200);
  assert.equal(robots.headers.get("content-type"), "text/plain");
  assert.equal(robots.headers.get("cache-control"), "private, no-store");
  assert.equal(robots.headers.get("x-robots-tag"), "noindex, follow");
  assert.equal(await robots.text(), "User-Agent: *\nDisallow: /\n");

  const sitemap = await render("/sitemap.xml");
  assert.equal(sitemap.status, 200);
  assert.match(sitemap.headers.get("content-type") ?? "", /^application\/xml\b/i);
  assert.equal(sitemap.headers.get("cache-control"), "private, no-store");
  assert.equal(sitemap.headers.get("x-robots-tag"), "noindex, follow");
  const xml = await sitemap.text();
  assert.match(xml, /<urlset\b/);
  assert.doesNotMatch(xml, /<loc>|localhost|workers\.dev|pages\.dev/i);

  const home = await render("/");
  const html = await home.text();
  assert.equal(home.headers.get("x-robots-tag"), "noindex, follow");
  assert.ok(metaContents(html, "robots").includes("noindex, follow"));
  assert.equal(canonicalHref(html), "/");
  assert.deepEqual(propertyContents(html, "og:url"), []);
  assert.doesNotMatch(html, /application\/ld\+json|localhost|workers\.dev|pages\.dev/i);
});

test("activates production discovery only for the exact approved request origin", async () => {
  const releaseEnv = {
    ...env,
    SITE_RELEASE_MODE: "production",
    SITE_RELEASE_APPROVED: "true",
    SITE_CANONICAL_ORIGIN: "https://halo.example.com",
  };
  const releaseFetch = (path, init = {}) => worker.fetch(
    new Request(`https://halo.example.com${path}`, {
      headers: { accept: "text/html", ...init.headers },
      ...init,
    }),
    releaseEnv,
    context,
  );

  const home = await releaseFetch("/");
  const homeHtml = await home.text();
  assert.equal(home.headers.get("x-robots-tag"), null);
  assert.ok(metaContents(homeHtml, "robots").includes("index, follow"));
  assert.equal(canonicalHref(homeHtml), "https://halo.example.com/");
  assert.deepEqual(propertyContents(homeHtml, "og:url"), ["https://halo.example.com/"]);
  const schema = homeHtml.match(/<script\b[^>]*type="application\/ld\+json"[^>]*>([^<]+)<\/script>/)?.[1];
  assert.deepEqual(JSON.parse(schema ?? "null"), {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Halo Database",
    url: "https://halo.example.com",
  });

  const conversion = await releaseFetch("/request-poc/");
  const conversionHtml = await conversion.text();
  assert.equal(conversion.headers.get("x-robots-tag"), "noindex, follow");
  assert.ok(metaContents(conversionHtml, "robots").includes("noindex, follow"));

  const robots = await releaseFetch("/robots.txt");
  assert.equal(robots.headers.get("x-robots-tag"), null);
  assert.equal(robots.headers.get("cache-control"), "public, max-age=0, must-revalidate");
  assert.equal(
    await robots.text(),
    "User-Agent: *\nAllow: /\n\nSitemap: https://halo.example.com/sitemap.xml\n",
  );

  const sitemap = await releaseFetch("/sitemap.xml");
  const sitemapXml = await sitemap.text();
  const locations = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.equal(locations.length, 15);
  assert.equal(new Set(locations).size, 15);
  assert.ok(locations.every((url) => url.startsWith("https://halo.example.com/")));
  assert.ok(locations.every((url) => url.endsWith("/")));
  for (const forbidden of [
    "/request-poc/",
    "/contact-sales/",
    "/request-demo/",
    "/404/",
    "/case-studies/",
    "/partners/",
    "/privacy/",
    "/accessibility/",
  ]) {
    assert.ok(locations.every((url) => new URL(url).pathname !== forbidden), forbidden);
  }

  const poisoned = await worker.fetch(
    new Request("https://evil.example.net/", {
      headers: {
        accept: "text/html",
        "x-forwarded-host": "halo.example.com",
        "x-halo-release-active": "1",
        "x-halo-release-origin": "https://halo.example.com",
      },
    }),
    releaseEnv,
    context,
  );
  const poisonedHtml = await poisoned.text();
  assert.equal(poisoned.headers.get("x-robots-tag"), "noindex, follow");
  assert.ok(metaContents(poisonedHtml, "robots").includes("noindex, follow"));
  assert.equal(canonicalHref(poisonedHtml), "/");
  assert.deepEqual(propertyContents(poisonedHtml, "og:url"), []);
  assert.doesNotMatch(poisonedHtml, /application\/ld\+json|halo\.example\.com|evil\.example\.net/i);
});

test("renders P07 as a five-step decision method with one comparison", async () => {
  const response = await render("/evaluation/");
  const html = await response.text();
  assert.equal(count(html, /class=["']method-number["']/g), 5);
  assert.equal(count(html, /<table\b[^>]*class=["']comparison-table["']/g), 1);
  assert.match(html, /<h2[^>]*id=["']comparison-[^"']+-heading["'][^>]*>\s*<span[^>]*>A demo and a PoC answer different questions<\/span>\s*<\/h2>/i);
  assert.match(html, /class=["'][^"']*comparison-wrap[^"']*["'][^>]*role=["']region["'][^>]*tabindex=["']0["']/i);
  assert.match(html, /<caption[^>]*class=["']sr-only["'][^>]*>/i);
  assert.match(html, /<h3[^>]*aria-label=["']1\. Frame the decision["'][^>]*>\s*<span[^>]*>Frame the decision<\/span>\s*<\/h3>/i);
});

test("keeps the P05 recovery scenario record ordered", async () => {
  const html = await (await render("/product/availability-recovery/")).text();
  assert.match(
    html,
    /<h2[^>]*>\s*<span[^>]*>Validate the failure modes that matter<\/span>\s*<\/h2>[\s\S]*?<ul[^>]*class=["']checklist-list["']/i,
  );
});

test("connects every rendered local-navigation link to a unique page target", async () => {
  for (const [path] of activeRoutes) {
    const html = await (await render(path)).text();
    const nav = html.match(/<nav\b[^>]*aria-label=["']On this page["'][^>]*>(.*?)<\/nav>/is)?.[1];
    if (!nav) continue;
    const targets = [...nav.matchAll(/\bhref=["']#([^"']+)["']/gi)].map((match) => match[1]);
    assert.ok(targets.length > 0, path);
    assert.equal(new Set(targets).size, targets.length, `${path} local target uniqueness`);
    for (const target of targets) {
      assert.equal(count(html, new RegExp(`\\bid=["']${target}["']`, "g")), 1, `${path} #${target}`);
    }
  }
});

test("renders the P08 question-led resource paths without an empty group heading", async () => {
  const response = await render("/resources/");
  const html = await response.text();
  for (const label of [
    "Understand the platform",
    "Plan compatibility and migration",
    "Design continuity and distributed data",
    "Operate and extend",
    "Trace claims",
    "Prepare an evaluation",
  ]) {
    assert.match(html, new RegExp(`<h3[^>]*>\\s*<span[^>]*>${label}(?:<!-- -->)?<\\/span>\\s*<\\/h3>`, "i"));
  }
  assert.doesNotMatch(html, /<h2[^>]*>\s*<\/h2>/i);
  assert.equal(count(html, /<article\b[^>]*class=["']card["']/gi), 6);
});

test("keeps inactive routes on the exact public 404 shell", async () => {
  for (const path of [
    "/404/",
    "/case-studies/",
    "/partners/",
    "/partners/apply/",
    "/privacy/",
    "/accessibility/",
    "/does-not-exist/",
  ]) {
    const response = await render(path);
    assert.equal(response.status, 404, path);
    const html = await response.text();
    assert.equal(tagText(html, "title"), "Page not found | Halo Database", path);
    assert.equal(tagText(html, "h1"), "Page not found.", path);
    assert.ok(metaContents(html, "robots").includes("noindex, follow"), path);
    assert.equal(canonicalHref(html), null, path);
    assert.deepEqual(metaContents(html, "description"), [], path);
    assert.deepEqual(propertyContents(html, "og:title"), [], path);
    assert.equal(count(html, /<nav\b[^>]*aria-label=["']Primary["']/gi), 1, path);
    assert.equal(count(html, /<form\b/gi), 0, path);

    const main = html.match(/<main\b[^>]*>(.*?)<\/main>/is)?.[1] ?? "";
    const actions = [...main.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gis)]
      .map((match) => [match[1].replaceAll("&amp;", "&"), tagText(`<span>${match[2]}</span>`, "span")]);
    assert.deepEqual(actions, [
      ["/", "Go to Home"],
      ["/product/", "Explore the platform"],
      ["/resources/documentation/", "Review documentation"],
    ], path);
  }
});

test("keeps the controlled primary shell order and one native no-JavaScript tree", async () => {
  const html = await (await render("/")).text();
  const primary = html.match(/<nav\b[^>]*aria-label=["']Primary["'][^>]*>(.*?)<\/nav>/is)?.[1] ?? "";
  const controlledOrder = [
    "Platform",
    "Platform links",
    "Overview",
    "Architecture &amp; Core",
    "Compatibility",
    "Availability &amp; Recovery",
    "Operations &amp; Observability",
    "Data &amp; Extensions",
    "Migration",
    "Evaluate",
    "Resources",
    "Resources links",
    "Documentation",
    "Evidence &amp; Validation",
    "Evaluation Checklist",
    "Company",
    "Commercial Planning",
    "Prepare a PoC",
  ];
  let cursor = -1;
  for (const label of controlledOrder) {
    const next = primary.indexOf(label, cursor + 1);
    assert.ok(next > cursor, label);
    cursor = next;
  }
  assert.equal(count(primary, /<details\b/gi), 2);
  assert.equal(count(html, /<details\b[^>]*class=["']primary-menu["']/gi), 1);
  assert.doesNotMatch(primary, /Case Studies|Partners|Privacy|Accessibility/);
});

test("keeps every rendered internal destination live and canonically slashed", async () => {
  const hrefs = new Set();
  for (const [path] of activeRoutes) {
    const html = await (await render(path)).text();
    for (const match of html.matchAll(/\bhref=["']([^"']+)["']/gi)) {
      const href = match[1].replaceAll("&amp;", "&");
      if (!href.startsWith("/") || href.startsWith("//")) continue;
      const url = new URL(href, "http://localhost");
      if (url.pathname.startsWith("/_next/")) continue;
      assert.ok(url.pathname === "/" || url.pathname.endsWith("/"), href);
      hrefs.add(`${url.pathname}${url.search}`);
    }
  }

  for (const href of hrefs) {
    const response = await render(href);
    assert.notEqual(response.status, 404, href);
  }
});

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const url = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directory);
    if (entry.isDirectory()) files.push(...await filesBelow(url));
    else files.push(url);
  }
  return files;
}

test("ships no gated copy or disposable starter implementation to public assets", async () => {
  const files = await filesBelow(publicOutput);
  const searchable = files.filter((url) => /\.(?:js|css|html|json)$/i.test(url.pathname));
  const text = (await Promise.all(searchable.map((url) => readFile(url, "utf8")))).join("\n");

  for (const forbidden of [
    "Case Studies",
    "Partner Application",
    "Privacy Notice",
    "Accessibility Statement",
    "Submission status unknown",
    "Possible duplicate",
    "acquisition_lineages",
    "acquisition_capabilities",
    "csrfCapability",
    "/api/acquisition",
    "return_form",
    "request_limited",
    "react-loading-skeleton",
    "SkeletonPreview",
    "codex-preview",
    "/case-studies/",
    "/partners/",
    "/partners/apply/",
    "/privacy/",
    "/accessibility/",
  ]) {
    assert.doesNotMatch(text, new RegExp(forbidden, "i"), forbidden);
  }

  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)));
  const packageJson = await readFile(new URL("../package.json", import.meta.url), "utf8");
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.match(packageJson, /"drizzle-orm": "0\.45\.2"/);
  assert.match(packageJson, /"drizzle-kit": "0\.31\.10"/);
});

test("packages only the dormant D1 binding and non-personal acquisition migrations", async () => {
  const hosting = JSON.parse(
    await readFile(new URL("../dist/.openai/hosting.json", import.meta.url), "utf8"),
  );
  assert.deepEqual(Object.keys(hosting).sort(), ["d1", "project_id", "r2"]);
  assert.match(hosting.project_id, /^appgprj_[a-z0-9]+$/);
  assert.equal(hosting.d1, "DB");
  assert.equal(hosting.r2, null);

  const migrationDirectory = new URL("../dist/.openai/drizzle/", import.meta.url);
  const migrationNames = (await readdir(migrationDirectory))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  assert.deepEqual(migrationNames, ["0000_acquisition_state_v2.sql"]);
  const migration = await readFile(
    new URL(migrationNames[0], migrationDirectory),
    "utf8",
  );
  assert.match(migration, /CREATE TABLE `acquisition_lineages`/);
  assert.match(migration, /CREATE TABLE `acquisition_result_sets`/);
  assert.match(migration, /CREATE TABLE `acquisition_result_authorizations`/);
  assert.match(migration, /ck_acquisition_nodes_source_binding/);
  assert.match(migration, /ck_acquisition_dispatch_observations_evidence/);
  assert.doesNotMatch(
    migration,
    /\b(name|email|organization|country|message|free_text)\b/i,
  );
});

test("keeps the frozen Stage 6 visual and keyboard contracts in source", async () => {
  const [css, header, anchorFocus] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/components/Header.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/AnchorFocus.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(css, /--font-sans:\s*ui-sans-serif,\s*system-ui/);
  assert.doesNotMatch(css, /@font-face|\bGeist\b/);
  assert.match(css, /\.brand-link\s*\{[^}]*font-size:\s*20px;[^}]*font-weight:\s*600;[^}]*line-height:\s*24px;/s);
  const skip = css.match(/\.skip-link\s*\{(.*?)\}/s)?.[1] ?? "";
  assert.match(skip, /padding:\s*12px 16px;/);
  assert.doesNotMatch(skip, /transition|animation/);
  assert.match(css, /--color-gridOnLight:\s*#10182809;/);
  assert.match(css, /--grid-on-light:\s*var\(--color-gridOnLight\);/);
  assert.match(css, /--color-overlay:\s*#0b1220cc;/i);
  assert.match(css, /--overlay:\s*var\(--color-overlay\);/);
  assert.match(css, /inline-size:\s*min\(420px, 100%\);/);
  assert.match(css, /\.primary-menu\.is-enhanced \.nav-disclosure > \.nav-toggle\s*\{[^}]*border:\s*1px solid var\(--border-strong\);/s);
  assert.match(css, /\.comparison-table th,\s*\.comparison-table td\s*\{[^}]*padding:\s*16px;/s);
  assert.match(css, /@media \(max-width: 719px\)[\s\S]*?\.comparison-table th,[\s\S]*?padding:\s*12px;/);
  assert.match(css, /\.site-footer\s*\{[^}]*padding-block:\s*80px;/s);
  assert.match(css, /\.site-footer::before\s*\{[^}]*inline-size:\s*80px;[^}]*background:\s*var\(--accent-decorative\);/s);
  assert.match(css, /\.card-grid--5\s*\{[^}]*repeat\(6, minmax\(0, 1fr\)\);/s);
  assert.match(css, /\.card-grid--6\s*\{[^}]*repeat\(3, minmax\(0, 1fr\)\);/s);
  assert.match(css, /\.evidence-list\s*\{[^}]*gap:\s*24px;/s);
  assert.match(css, /\.evidence-record\s*\{[^}]*border-block-start:\s*3px solid var\(--accent-decorative\);[^}]*box-shadow:\s*none;/s);
  assert.match(css, /grid-template-columns:\s*112px minmax\(0, 1fr\);/);
  assert.match(css, /\.source-token\s*\{[^}]*direction:\s*ltr;[^}]*unicode-bidi:\s*isolate;/s);

  assert.match(header, /\.inert\s*=\s*true/);
  assert.match(header, /document\.body\.style\.overflow\s*=\s*"hidden"/);
  assert.match(header, /role=\{enhanced && compact && menuOpen \? "dialog" : undefined\}/);
  assert.match(anchorFocus, /window\.addEventListener\("hashchange"/);
  assert.match(anchorFocus, /a\[href\^="#"\]/);
  assert.match(anchorFocus, /target\.focus\(\{ preventScroll: true \}\)/);
  assert.match(css, /\[data-anchor-focus="true"\]\s*\{[^}]*outline:/s);
});

test("ships five independent mechanism explainers as accessible progressive enhancement", async () => {
  const [homeResponse, productResponse, notFoundResponse] = await Promise.all([
    render("/"),
    render("/product/"),
    render("/missing-experience-audit/"),
  ]);
  const [home, product, notFound, css, databaseFlow, homeStory, experienceLayer, packageJson] =
    await Promise.all([
      homeResponse.text(),
      productResponse.text(),
      notFoundResponse.text(),
      readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
      readFile(
        new URL("../app/components/HaloDatabaseFlow.tsx", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../app/components/HomeTechnologyStoryV2.tsx", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../app/components/ExperienceLayer.tsx", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../package.json", import.meta.url), "utf8"),
    ]);

  assert.equal(count(home, /<h1\b/gi), 1);
  assert.equal(count(home, /<form\b/gi), 0);
  assert.equal(count(home, /class=["'][^"']*halo-database-flow/gi), 1);
  assert.equal(count(home, /<canvas\b/gi), 0);
  assert.equal(count(home, /<section[^>]*class=["'][^"']*home-mechanism-section\b/gi), 5);
  assert.equal(count(home, /<dt>Customer problem<\/dt>/gi), 5);
  assert.equal(count(home, /<dt>Halo mechanism<\/dt>/gi), 5);
  assert.equal(count(home, /<dt>What changes<\/dt>/gi), 5);

  assert.match(home, /<figure[^>]*aria-labelledby=["']hero-engine-heading["'][^>]*class=["'][^"']*halo-database-flow/i);
  assert.match(home, /Three operating modes\. One Halo foundation\./i);
  assert.match(home, /Halo 1\.0\.16[\s\S]*?supports[\s\S]*?Oracle[\s\S]*?MySQL[\s\S]*?PostgreSQL[\s\S]*?operating modes within one cluster/i);
  assert.doesNotMatch(home, /Halo platform signals|home-hero-facts/i);
  assert.match(home, /See what changes inside Halo\./i);
  assert.match(home, /COMPATIBILITY[\s\S]*?MIGRATION[\s\S]*?HIGH AVAILABILITY[\s\S]*?READ \/ WRITE ROUTING[\s\S]*?SHARDING/i);
  assert.match(home, /Keep expected application behavior in view\.[\s\S]*?Turn hidden dependencies into decisions\.[\s\S]*?Move a role only after the control path agrees\.[\s\S]*?Let database semantics choose the path\.[\s\S]*?Route a partition to the data that owns its range\./i);
  assert.match(home, /protocol, parsing and semantics, optimization, and execution/i);
  assert.match(home, /Retain for workload verification[\s\S]*?Verify the behavior that matters[\s\S]*?Remediate or leave unresolved/i);
  assert.match(home, /Quorum \+ leader state[\s\S]*?Fencing[\s\S]*?Eligible replica/i);
  assert.match(home, /Statement semantics[\s\S]*?Transaction state[\s\S]*?Object type/i);
  assert.match(home, /Partition map[\s\S]*?match predicate[\s\S]*?prune unrelated partitions[\s\S]*?route mapped partition[\s\S]*?push down relevant work/i);
  assert.match(home, /manual-reported Oracle-related application code-change reduction/);
  assert.match(home, /Explore E5 and operating modes[\s\S]*?Follow the Oracle migration path[\s\S]*?Review continuity and Shield[\s\S]*?Inspect TWR boundaries[\s\S]*?Explore HDS placement/i);
  assert.doesNotMatch(home, /Follow one workload through Halo|HALO SYSTEM IN MOTION|Let one commit expose the durability chain/i);

  assert.match(home, /2012[\s\S]*?≥95%[\s\S]*?45/i);
  assert.doesNotMatch(home, /second LTS/i);
  assert.match(home, /Reported from Oracle migration practice; workload-specific, not universal and not a forecast\./i);
  assert.match(home, /Start with the proof you need\.[\s\S]*?Build your PoC scope[\s\S]*?Evaluate an Oracle workload[\s\S]*?Prepare a demo brief[\s\S]*?Review commercial planning/i);
  assert.doesNotMatch(home, /Technology explorer|Set the workload boundary|Record fit and decide|SQL firewall/i);
  assert.equal(count(home, /class=["']experience-progress["']/gi), 1);
  assert.equal(count(home, /class=["']experience-cursor["']/gi), 1);

  assert.equal(count(product, /class=["'][^"']*halo-database-flow/gi), 1);
  assert.match(product, /halo-database-flow--ambient/);
  assert.match(product, /Oracle[\s\S]*?MySQL[\s\S]*?PostgreSQL[\s\S]*?operating modes are documented within one cluster/i);
  assert.doesNotMatch(product, /operating modes[^.]*one instance/i);
  assert.equal(count(notFound, /class=["'][^"']*halo-database-flow/gi), 1);
  assert.match(notFound, /halo-database-flow--reduced/);
  assert.equal(count(notFound, /class=["']experience-progress["']/gi), 1);
  assert.equal(count(notFound, /class=["']experience-cursor["']/gi), 1);

  assert.match(css, /Homepage separated mechanism narratives — five problems, five visual grammars/);
  assert.doesNotMatch(css, /Homepage continuous system narrative|home-technology-story--continuous|home-system-canvas|home-runtime-map/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.home-migration-sorter i,[\s\S]*?animation:\s*none;/);
  assert.match(css, /@media \(forced-colors: active\)[\s\S]*?\.home-mechanism-controls button\[aria-pressed="true"\],[\s\S]*?background:\s*Highlight;/);
  assert.match(css, /@media \(scripting: none\)[\s\S]*?\.home-mechanism-controls\s*\{[^}]*display:\s*none;/);
  assert.match(css, /@media print[\s\S]*?\.home-mechanism-section\s*\{[^}]*overflow:\s*visible;/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.home-compatibility-pipeline\s*\{[^}]*grid-template-columns:\s*1fr;/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.home-migration-board\s*\{[^}]*grid-template-columns:\s*1fr;/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.home-availability-topology\s*\{[^}]*grid-template-columns:\s*1fr;/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.home-routing-stage\s*\{[^}]*grid-template-columns:\s*1fr;/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.home-sharding-explainer\s*\{[^}]*grid-template-columns:\s*1fr;/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.data-flow-packet,[\s\S]*?animation:\s*none;/);
  assert.match(css, /@media \(forced-colors: active\)[\s\S]*?\.halo-database-flow,[\s\S]*?display:\s*none;/);
  assert.match(css, /@media print[\s\S]*?\.halo-database-flow,[\s\S]*?display:\s*none !important;/);
  assert.match(css, /@media \(max-width: 1199px\)[\s\S]*?\.site-header\s*\{[^}]*backdrop-filter:\s*none;/);
  assert.match(css, /@media \(scripting: enabled\) and \(max-width: 1199px\)[\s\S]*?\.primary-menu:not\(\.is-enhanced\) > \.menu-panel\s*\{[^}]*display:\s*none;/);
  assert.match(css, /@media \(hover: none\), \(pointer: coarse\)[\s\S]*?\.experience-cursor\s*\{[^}]*display:\s*none;/);
  assert.match(css, /@media \(forced-colors: active\)[\s\S]*?\.page-hero h1,[\s\S]*?\.final-cta h2\s*\{[^}]*color:\s*CanvasText;/);
  assert.match(css, /\.comparison-table\s*\{[^}]*background:\s*#07101d;/);
  assert.match(css, /\.reduced-state\s*\{[^}]*var\(--experience-canvas\);/s);
  assert.doesNotMatch(css, /var\(--content-wide\)/);
  assert.doesNotMatch(css, /\binfinite\b/);

  assert.match(databaseFlow, /Query endpoints/);
  assert.match(databaseFlow, /Halo database/);
  assert.match(databaseFlow, /Readable standby/);
  assert.match(databaseFlow, /OPERATING-MODE ENTRY/);
  assert.match(databaseFlow, /HALO 1\.0\.16/);
  assert.match(databaseFlow, /ONE PLATFORM/);
  assert.match(databaseFlow, /EXECUTION[\s\S]*?Result[\s\S]*?plan · commit · persist/);
  assert.doesNotMatch(databaseFlow, /useState|onClick|aria-pressed/);
  assert.match(databaseFlow, /aria-hidden="true"/);
  assert.doesNotMatch(databaseFlow, /canvas|useEffect|requestAnimationFrame/);

  assert.match(homeStory, /function CompatibilitySection/);
  assert.match(homeStory, /function MigrationSection/);
  assert.match(homeStory, /function AvailabilitySection/);
  assert.match(homeStory, /function RoutingSection/);
  assert.match(homeStory, /function ShardingSection/);
  assert.match(homeStory, /function requireNode/);
  assert.match(homeStory, /needs problem, mechanism, and result copy/);
  assert.match(homeStory, /label="Choose a Halo operating mode"/);
  assert.match(homeStory, /label="Choose a Shield role-change stage"/);
  assert.match(homeStory, /label="Choose a TWR routing example"/);
  assert.match(homeStory, /aria-label="Choose a partition range"/);
  assert.match(homeStory, /onPointerEnter/);
  assert.doesNotMatch(homeStory, /onFocus|IntersectionObserver|addEventListener|scrollIntoView|requestAnimationFrame|<canvas/);
  assert.doesNotMatch(homeStory, /HaloSystemCanvas|sceneSnapshot|sceneForLabel|manualSceneRef|manualSelectionLockedRef/);

  assert.match(experienceLayer, /IntersectionObserver/);
  assert.match(experienceLayer, /revealObserver\.disconnect\(\)/);
  assert.match(experienceLayer, /connection\?\.saveData/);
  assert.match(experienceLayer, /let staticExperience = reducedMotion\.matches \|\| saveData/);
  assert.match(experienceLayer, /staticExperience \|\| coarsePointer\.matches/);
  assert.match(experienceLayer, /addEventListener\("change", applyExperienceMode\)/);
  assert.match(experienceLayer, /removeEventListener\("pointermove"/);
  assert.match(experienceLayer, /aria-hidden="true"/);
  assert.doesNotMatch(packageJson, /framer-motion|\bmotion\b|gsap|three|spline/i);
});
