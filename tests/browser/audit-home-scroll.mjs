import { writeFile } from "node:fs/promises";
import path from "node:path";
import {
  ensureDirectory,
  gotoHomepage,
  homepageGeometry,
  launchBrowser,
  parseArgs,
} from "./chrome-harness.mjs";
import { auditStoryOcclusions } from "./story-layout-assertions.mjs";

const args = parseArgs();
const targetUrl = String(args.url || "http://localhost:3105/");
const label = String(args.label || "after");
const outputRoot = path.resolve(String(args.output || `outputs/qa/${label}`));
const requestedProfiles = String(args.profiles || "all").split(",").map((value) => value.trim());
const requestedBrowsers = String(args.browsers || "chrome").split(",").map((value) => value.trim());
const captureScreenshots = String(args.screenshots ?? "true") !== "false";
const failOnIssues = String(args["fail-on-issues"] ?? "false") === "true";

const PROFILES = [
  { id: "desktop-1440x900", width: 1440, height: 900, scale: 1 },
  { id: "desktop-1366x768", width: 1366, height: 768, scale: 1 },
  { id: "desktop-1180x900", width: 1180, height: 900, scale: 1 },
  { id: "fallback-1180x840", width: 1180, height: 840, scale: 1, expectedStoryScrollReady: false },
  { id: "fallback-1280x840", width: 1280, height: 840, scale: 1, expectedStoryScrollReady: false },
  { id: "fallback-1399x840", width: 1399, height: 840, scale: 1, expectedStoryScrollReady: false },
  { id: "fallback-1400x840", width: 1400, height: 840, scale: 1, expectedStoryScrollReady: false },
  { id: "pinned-short-1180x864", width: 1180, height: 864, scale: 1, expectedStoryScrollReady: true },
  { id: "narrow-1100x900", width: 1100, height: 900, scale: 1 },
  { id: "compact-1024x768", width: 1024, height: 768, scale: 1 },
  { id: "short-1440x720", width: 1440, height: 720, scale: 1 },
  { id: "zoom125-1536x864", width: 1536, height: 864, scale: 1.25, expectedStoryScrollReady: true },
  { id: "hidpi-1756x963", width: 1756, height: 963, scale: 1.75, expectedStoryScrollReady: true },
  { id: "reduced-1440x900", width: 1440, height: 900, scale: 1, reducedMotion: "reduce", expectedStoryScrollReady: false },
  { id: "zoom150-1280x720", width: 1280, height: 720, scale: 1.5 },
  { id: "zoom175-1097x617", width: 1097, height: 617, scale: 1.75 },
  { id: "zoom200-960x540", width: 960, height: 540, scale: 2 },
  { id: "tablet-820x1180", width: 820, height: 1180, scale: 1, hasTouch: true },
  { id: "phone-390x844", width: 390, height: 844, scale: 1, hasTouch: true, isMobile: true },
  { id: "phone-320x568", width: 320, height: 568, scale: 1, hasTouch: true, isMobile: true },
];

const profiles = requestedProfiles.includes("all")
  ? PROFILES
  : PROFILES.filter((profile) => requestedProfiles.includes(profile.id));
if (!profiles.length) throw new Error(`No matching profiles: ${requestedProfiles.join(", ")}`);

const STORY_STATES = ["start", "middle", "end", "reverse-middle"];

function screenshotName({ story, state, profile, browserName }) {
  return `home--${story}--${state}--${profile.id}--${browserName}.png`;
}

async function auditVisibleLayout(page, rootSelector = null) {
  const baseAudit = await page.evaluate(({ explicitRootSelector }) => {
    const issues = [];
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const root = document.documentElement;
    const activeStory = document.querySelector('[data-scroll-story][data-active="true"]');
    const explicitRoot = explicitRootSelector ? document.querySelector(explicitRootSelector) : null;
    const auditRoot = explicitRoot
      || activeStory
      || document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2)?.closest("[data-scroll-story]");
    const header = document.querySelector(".site-header");
    const selectorFor = (element) => {
      if (element.id) return `#${CSS.escape(element.id)}`;
      const classes = Array.from(element.classList).slice(0, 2).map((name) => `.${CSS.escape(name)}`).join("");
      return `${element.tagName.toLowerCase()}${classes}`;
    };
    const intersectsViewport = (rect) => (
      rect.bottom > 0 && rect.right > 0 && rect.top < viewport.height && rect.left < viewport.width
    );
    const effectiveOpacity = (element) => {
      let opacity = 1;
      for (let current = element; current && current !== auditRoot?.parentElement; current = current.parentElement) {
        const style = getComputedStyle(current);
        if (style.display === "none" || style.visibility === "hidden") return 0;
        opacity *= Number(style.opacity || 1);
        if (opacity < 0.01) return opacity;
      }
      return opacity;
    };
    const isScrollableAncestor = (element) => {
      for (let current = element.parentElement; current; current = current.parentElement) {
        const style = getComputedStyle(current);
        if (
          (/(auto|scroll)/.test(style.overflowX) && current.scrollWidth > current.clientWidth + 2)
          || (/(auto|scroll)/.test(style.overflowY) && current.scrollHeight > current.clientHeight + 2)
        ) return true;
      }
      return false;
    };
    const overlap = (left, right) => {
      if (!left || !right) return 0;
      const a = left.getBoundingClientRect();
      const b = right.getBoundingClientRect();
      return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
        * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    };
    const semanticTextElements = auditRoot
      ? Array.from(auditRoot.querySelectorAll("h1,h2,h3,h4,h5,h6,p,dd,dt,button,a,summary,small,strong,figcaption,li"))
      : [];
    const leafTextElements = auditRoot
      ? Array.from(auditRoot.querySelectorAll("*")).filter((element) => (
        element.children.length === 0 && Boolean(element.textContent?.trim())
      ))
      : [];
    const visibleTextElements = [...new Set([...semanticTextElements, ...leafTextElements])];

    if ((activeStory && auditRoot === activeStory) || explicitRoot) {
      const expectedVisibleElements = activeStory && auditRoot === activeStory
        ? Array.from(activeStory.querySelectorAll([
          ".home-story-heading > p",
          ".home-story-heading > h3",
          "figure > header",
          ".home-story-progress__track",
          '.home-story-progress li[data-current="true"]',
        ].join(",")))
        : [
          explicitRoot.querySelector("h1,h2"),
          explicitRoot.querySelector([
            ".eyebrow",
            ".home-technology-journeys-intro > p",
            ".home-proof-shell > header > p",
            ".home-commercial-shell > header > p",
          ].join(",")),
        ].filter(Boolean);
      for (const element of expectedVisibleElements) {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        const selector = selectorFor(element);
        const hidden = style.display === "none" || style.visibility === "hidden" || Number(style.opacity || 1) < 0.55;
        if (hidden) {
          issues.push({ code: "expected-element-hidden", selector });
          continue;
        }
        if (activeStory && auditRoot === activeStory && (
          rect.left < -2 || rect.right > viewport.width + 2 || rect.top < -2 || rect.bottom > viewport.height + 2
        )) {
          issues.push({ code: "expected-element-outside-viewport", selector, rect: {
            left: Math.round(rect.left), top: Math.round(rect.top), right: Math.round(rect.right), bottom: Math.round(rect.bottom),
          } });
        }
        if (header) {
          const headerRect = header.getBoundingClientRect();
          const obscuredHeight = Math.max(0, Math.min(rect.bottom, headerRect.bottom) - Math.max(rect.top, headerRect.top));
          if (obscuredHeight > 2) {
            issues.push({ code: "expected-element-obscured-by-header", selector, obscuredHeight: Number(obscuredHeight.toFixed(2)) });
          }
        }
        const sampleX = Math.min(viewport.width - 1, Math.max(0, (rect.left + rect.right) / 2));
        const sampleY = Math.min(viewport.height - 1, Math.max(0, (rect.top + rect.bottom) / 2));
        const topElement = document.elementFromPoint(sampleX, sampleY);
        if (topElement && !element.contains(topElement) && !topElement.contains(element)) {
          issues.push({ code: "expected-element-occluded", selector, occluder: selectorFor(topElement) });
        }
      }
    }

    for (const element of visibleTextElements) {
      const text = element.textContent?.trim();
      const closedDetails = element.closest("details:not([open])");
      if (
        !text
        || element.closest('[aria-hidden="true"]')
        || element.closest(".sr-only")
        || (closedDetails && !element.matches("summary") && !element.closest("summary"))
      ) continue;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const opacity = effectiveOpacity(element);
      if (style.display === "none" || style.visibility === "hidden" || opacity < 0.55 || !intersectsViewport(rect)) continue;
      const selector = selectorFor(element);
      const fontSize = Number.parseFloat(style.fontSize);
      let minimumFontSize = 0;
      if (element.matches(".home-story-causality dd, .home-story-actions button, .home-story-actions a")) minimumFontSize = 16;
      else if (element.matches(".home-migration-steps strong, .home-availability-steps strong, .home-routing-steps strong, .home-sharding-steps strong")) minimumFontSize = 15;
      else if (element.matches(".home-migration-steps small, .home-availability-steps small, .home-routing-steps small, .home-sharding-steps small")) minimumFontSize = 13;
      else if (element.matches("small, dt, li > i, span, li")) minimumFontSize = 12;
      else if (element.matches("p, dd, button, a")) minimumFontSize = 15;
      if (minimumFontSize && fontSize + 0.05 < minimumFontSize) {
        issues.push({ code: "font-too-small", selector, text: text.slice(0, 90), fontSize, minimumFontSize });
      }

      const isBox = !["inline", "contents"].includes(style.display);
      if (isBox && element.clientWidth > 0 && element.scrollWidth > element.clientWidth + 2 && !isScrollableAncestor(element)) {
        issues.push({ code: "text-overflow-x", selector, text: text.slice(0, 90), clientWidth: element.clientWidth, scrollWidth: element.scrollWidth });
      }
      if (
        isBox
        && /(hidden|clip)/.test(style.overflowY)
        && element.clientHeight > 0
        && element.scrollHeight > element.clientHeight + 2
        && !isScrollableAncestor(element)
      ) {
        issues.push({ code: "text-overflow-y", selector, text: text.slice(0, 90), clientHeight: element.clientHeight, scrollHeight: element.scrollHeight });
      }

      if (!isScrollableAncestor(element)) {
        const centerInsideViewport = (
          ((rect.left + rect.right) / 2) >= 0
          && ((rect.left + rect.right) / 2) <= viewport.width
          && ((rect.top + rect.bottom) / 2) >= 0
          && ((rect.top + rect.bottom) / 2) <= viewport.height
        );
        if (centerInsideViewport) {
          for (let ancestor = element.parentElement; ancestor && ancestor !== auditRoot.parentElement; ancestor = ancestor.parentElement) {
            const ancestorStyle = getComputedStyle(ancestor);
            if (!/(hidden|clip)/.test(`${ancestorStyle.overflowX} ${ancestorStyle.overflowY}`)) continue;
            const ancestorRect = ancestor.getBoundingClientRect();
            if (
              rect.left < ancestorRect.left - 2
              || rect.right > ancestorRect.right + 2
              || rect.top < ancestorRect.top - 2
              || rect.bottom > ancestorRect.bottom + 2
            ) {
              issues.push({ code: "text-clipped-by-ancestor", selector, ancestor: selectorFor(ancestor), text: text.slice(0, 90) });
              break;
            }
          }
        }
      }

      if (activeStory && !isScrollableAncestor(element) && (
        rect.left < -2 || rect.right > viewport.width + 2 || rect.top < -2 || rect.bottom > viewport.height + 2
      )) {
        issues.push({ code: "pinned-text-outside-viewport", selector, text: text.slice(0, 90), rect: {
          left: Math.round(rect.left), top: Math.round(rect.top), right: Math.round(rect.right), bottom: Math.round(rect.bottom),
        } });
      }

    }

    if (root.scrollWidth > root.clientWidth + 2) {
      issues.push({ code: "page-horizontal-overflow", clientWidth: root.clientWidth, scrollWidth: root.scrollWidth });
    }

    if (auditRoot) {
      const copy = auditRoot.querySelector(".home-story-copy");
      const figure = auditRoot.querySelector("figure");
      const progress = auditRoot.querySelector(".home-story-progress");
      if (overlap(copy, figure) > 16) issues.push({ code: "copy-figure-overlap" });
      if (progress && getComputedStyle(progress).display !== "none") {
        if (overlap(progress, copy) > 16 || overlap(progress, figure) > 16) issues.push({ code: "progress-content-overlap" });
        const header = document.querySelector(".site-header");
        if (header && overlap(progress, header) > 16) issues.push({ code: "progress-header-overlap" });
      }
      if (root.classList.contains("story-scroll-ready")) {
        const visibleScenes = Array.from(auditRoot.querySelectorAll(".home-compat-scene")).filter((scene) => {
          const style = getComputedStyle(scene);
          return style.visibility !== "hidden" && Number(style.opacity) >= 0.55;
        });
        const scenesOverlap = visibleScenes.some((scene, index) => (
          visibleScenes.slice(index + 1).some((candidate) => overlap(scene, candidate) > 16)
        ));
        if (scenesOverlap) issues.push({ code: "compatibility-scenes-overlap", visibleScenes: visibleScenes.length });
      }

      const visibleForCollision = (element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none"
          && style.visibility !== "hidden"
          && effectiveOpacity(element) >= 0.55
          && rect.width > 1
          && rect.height > 1;
      };
      for (const list of auditRoot.querySelectorAll(
        ".home-migration-steps, .home-availability-steps, .home-routing-steps, .home-sharding-steps",
      )) {
        const details = [
          ...auditRoot.querySelectorAll(".home-story-step-detail > p[data-current='true']"),
          ...list.querySelectorAll(":scope > li[data-current='true'] > small"),
        ].filter(visibleForCollision);
        const labels = Array.from(
          list.querySelectorAll(":scope > li > span, :scope > li > strong"),
        ).filter(visibleForCollision);
        for (const detail of details) {
          const detailRect = detail.getBoundingClientRect();
          for (const label of labels) {
            const labelRect = label.getBoundingClientRect();
            const intersectionWidth = Math.max(
              0,
              Math.min(detailRect.right, labelRect.right) - Math.max(detailRect.left, labelRect.left),
            );
            const intersectionHeight = Math.max(
              0,
              Math.min(detailRect.bottom, labelRect.bottom) - Math.max(detailRect.top, labelRect.top),
            );
            if (intersectionWidth > 1 && intersectionHeight > 1) {
              issues.push({
                code: "step-detail-label-overlap",
                story: auditRoot.getAttribute("data-scroll-story"),
                detail: detail.textContent?.trim().slice(0, 100),
                label: label.textContent?.trim().slice(0, 60),
                intersectionWidth: Number(intersectionWidth.toFixed(2)),
                intersectionHeight: Number(intersectionHeight.toFixed(2)),
              });
            }
          }
          if (labels.length) {
            const labelBottom = Math.max(...labels.map((label) => label.getBoundingClientRect().bottom));
            if (detailRect.top < labelBottom + 2) {
              issues.push({
                code: "step-detail-insufficient-separation",
                story: auditRoot.getAttribute("data-scroll-story"),
                separation: Number((detailRect.top - labelBottom).toFixed(2)),
              });
            }
          }
          const reservedRegion = detail.closest(".home-story-step-detail") || list;
          const reservedRect = reservedRegion.getBoundingClientRect();
          if (detailRect.bottom > reservedRect.bottom + 2) {
            issues.push({
              code: "step-detail-outside-reserved-region",
              story: auditRoot.getAttribute("data-scroll-story"),
              overflow: Number((detailRect.bottom - reservedRect.bottom).toFixed(2)),
            });
          }
          const sequence = detail.closest(".home-story-step-sequence");
          if (sequence && sequence.clientHeight > 0 && sequence.scrollHeight > sequence.clientHeight + 1) {
            issues.push({
              code: "step-sequence-vertical-overflow",
              story: auditRoot.getAttribute("data-scroll-story"),
              clientHeight: sequence.clientHeight,
              scrollHeight: sequence.scrollHeight,
            });
          }
          const note = figure?.querySelector(".home-story-note");
          if (note && visibleForCollision(note)) {
            const noteRect = note.getBoundingClientRect();
            const intersectionWidth = Math.max(
              0,
              Math.min(detailRect.right, noteRect.right) - Math.max(detailRect.left, noteRect.left),
            );
            const intersectionHeight = Math.max(
              0,
              Math.min(detailRect.bottom, noteRect.bottom) - Math.max(detailRect.top, noteRect.top),
            );
            if (intersectionWidth > 1 && intersectionHeight > 1) {
              issues.push({
                code: "step-detail-note-overlap",
                story: auditRoot.getAttribute("data-scroll-story"),
                intersectionWidth: Number(intersectionWidth.toFixed(2)),
                intersectionHeight: Number(intersectionHeight.toFixed(2)),
              });
            }
          }
        }
        const note = figure?.querySelector(".home-story-note");
        if (note && visibleForCollision(note)) {
          const noteRect = note.getBoundingClientRect();
          for (const label of labels) {
            const labelRect = label.getBoundingClientRect();
            const intersectionWidth = Math.max(
              0,
              Math.min(labelRect.right, noteRect.right) - Math.max(labelRect.left, noteRect.left),
            );
            const intersectionHeight = Math.max(
              0,
              Math.min(labelRect.bottom, noteRect.bottom) - Math.max(labelRect.top, noteRect.top),
            );
            if (intersectionWidth > 1 && intersectionHeight > 1) {
              issues.push({
                code: "step-label-note-overlap",
                story: auditRoot.getAttribute("data-scroll-story"),
                label: label.textContent?.trim().slice(0, 60),
                intersectionWidth: Number(intersectionWidth.toFixed(2)),
                intersectionHeight: Number(intersectionHeight.toFixed(2)),
              });
            }
          }
          const content = [...details, ...labels];
          if (content.length) {
            const contentBottom = Math.max(...content.map((element) => element.getBoundingClientRect().bottom));
            if (noteRect.top < contentBottom + 2) {
              issues.push({
                code: "step-content-note-insufficient-separation",
                story: auditRoot.getAttribute("data-scroll-story"),
                separation: Number((noteRect.top - contentBottom).toFixed(2)),
              });
            }
          }
        }
        const routingStageCards = Array.from(auditRoot.querySelectorAll(
          ".home-routing-connection, .home-routing-classifier, .home-routing-targets article",
        )).filter(visibleForCollision);
        routingStageCards.forEach((card, index) => {
          const cardRect = card.getBoundingClientRect();
          for (const peer of routingStageCards.slice(index + 1)) {
            const peerRect = peer.getBoundingClientRect();
            const intersectionWidth = Math.max(
              0,
              Math.min(cardRect.right, peerRect.right) - Math.max(cardRect.left, peerRect.left),
            );
            const intersectionHeight = Math.max(
              0,
              Math.min(cardRect.bottom, peerRect.bottom) - Math.max(cardRect.top, peerRect.top),
            );
            if (intersectionWidth > 1 && intersectionHeight > 1) {
              issues.push({
                code: "routing-stage-card-overlap",
                story: auditRoot.getAttribute("data-scroll-story"),
                card: card.textContent?.trim().slice(0, 80),
                peer: peer.textContent?.trim().slice(0, 80),
                intersectionWidth: Number(intersectionWidth.toFixed(2)),
                intersectionHeight: Number(intersectionHeight.toFixed(2)),
              });
            }
          }
        });
        for (const card of routingStageCards) {
          const cardRect = card.getBoundingClientRect();
          for (const stepContent of [...labels, ...details]) {
            const stepRect = stepContent.getBoundingClientRect();
            const intersectionWidth = Math.max(
              0,
              Math.min(cardRect.right, stepRect.right) - Math.max(cardRect.left, stepRect.left),
            );
            const intersectionHeight = Math.max(
              0,
              Math.min(cardRect.bottom, stepRect.bottom) - Math.max(cardRect.top, stepRect.top),
            );
            if (intersectionWidth > 1 && intersectionHeight > 1) {
              issues.push({
                code: "routing-stage-step-content-overlap",
                story: auditRoot.getAttribute("data-scroll-story"),
                card: card.textContent?.trim().slice(0, 80),
                stepContent: stepContent.textContent?.trim().slice(0, 80),
                intersectionWidth: Number(intersectionWidth.toFixed(2)),
                intersectionHeight: Number(intersectionHeight.toFixed(2)),
              });
            }
          }
        }
      }
      if (auditRoot.matches('[data-scroll-story="sharding"]')) {
        for (const card of auditRoot.querySelectorAll([
          ".home-sharding-query",
          ".home-sharding-logical",
          ".home-sharding-worker",
          ".home-sharding-nodes article",
        ].join(","))) {
          if (card.clientWidth > 0 && card.scrollWidth > card.clientWidth + 1) {
            issues.push({
              code: "sharding-card-horizontal-overflow",
              card: selectorFor(card),
              clientWidth: card.clientWidth,
              scrollWidth: card.scrollWidth,
            });
          }
          if (card.clientHeight > 0 && card.scrollHeight > card.clientHeight + 1) {
            issues.push({
              code: "sharding-card-vertical-overflow",
              card: selectorFor(card),
              clientHeight: card.clientHeight,
              scrollHeight: card.scrollHeight,
            });
          }
        }
        const queryLabel = auditRoot.querySelector(".home-sharding-query strong");
        const logicalLabel = auditRoot.querySelector(".home-sharding-logical small");
        if (queryLabel && logicalLabel && visibleForCollision(queryLabel) && visibleForCollision(logicalLabel)) {
          const queryRect = queryLabel.getBoundingClientRect();
          const logicalRect = logicalLabel.getBoundingClientRect();
          const intersectionWidth = Math.max(
            0,
            Math.min(queryRect.right, logicalRect.right) - Math.max(queryRect.left, logicalRect.left),
          );
          const intersectionHeight = Math.max(
            0,
            Math.min(queryRect.bottom, logicalRect.bottom) - Math.max(queryRect.top, logicalRect.top),
          );
          if (intersectionWidth > 1 && intersectionHeight > 1) {
            issues.push({
              code: "sharding-query-logical-label-overlap",
              intersectionWidth: Number(intersectionWidth.toFixed(2)),
              intersectionHeight: Number(intersectionHeight.toFixed(2)),
            });
          }
        }
      }
    }

    return {
      scrollY: window.scrollY,
      activeStory: activeStory?.getAttribute("data-scroll-story") || null,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
      issues,
    };
  }, { explicitRootSelector: rootSelector });
  const semanticIssues = await page.evaluate(auditStoryOcclusions, rootSelector);
  return { ...baseAudit, issues: [...baseAudit.issues, ...semanticIssues] };
}

async function settleAt(page, position, animated) {
  await page.evaluate((next) => window.scrollTo(0, next), position);
  await page.waitForTimeout(animated ? 760 : 280);
}

const report = {
  label,
  url: targetUrl,
  capturedAt: new Date().toISOString(),
  profiles: [],
  screenshots: [],
  issues: [],
  consoleErrors: [],
};

for (const browserName of requestedBrowsers) {
  const browser = await launchBrowser({ browserName });
  for (const profile of profiles) {
    const context = await browser.newContext({
      viewport: { width: profile.width, height: profile.height },
      screen: { width: Math.round(profile.width * profile.scale), height: Math.round(profile.height * profile.scale) },
      deviceScaleFactor: profile.scale,
      hasTouch: Boolean(profile.hasTouch),
      isMobile: Boolean(profile.isMobile),
      reducedMotion: profile.reducedMotion ?? "no-preference",
    });
    const page = await context.newPage();
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      if (/^Failed to load resource:/i.test(message.text())) return;
      report.consoleErrors.push({ browserName, profile: profile.id, source: "console", message: message.text() });
    });
    page.on("pageerror", (error) => report.consoleErrors.push({ browserName, profile: profile.id, source: "pageerror", message: error.message }));
    page.on("requestfailed", (request) => report.consoleErrors.push({
      browserName,
      profile: profile.id,
      source: "requestfailed",
      url: request.url(),
      message: request.failure()?.errorText || "Request failed without an HTTP response",
    }));
    page.on("response", (response) => {
      if (response.status() < 400) return;
      const entry = { browserName, profile: profile.id, source: "http", status: response.status(), url: response.url() };
      report.consoleErrors.push(entry);
    });
    await gotoHomepage(page, targetUrl);
    const geometry = await homepageGeometry(page);
    if (
      profile.expectedStoryScrollReady !== undefined
      && geometry.storyScrollReady !== profile.expectedStoryScrollReady
    ) {
      report.issues.push({
        code: "unexpected-story-scroll-mode",
        browserName,
        profile: profile.id,
        expected: profile.expectedStoryScrollReady,
        actual: geometry.storyScrollReady,
      });
    }
    const headerHeight = await page.locator(".site-header").evaluate((element) => element.getBoundingClientRect().height);
    geometry.headerHeight = headerHeight;
    const profileRecord = { browserName, profile, geometry, states: [] };
    report.profiles.push(profileRecord);
    const screenshotDirectory = await ensureDirectory(path.join(outputRoot, browserName, profile.id));

    for (const story of geometry.stories) {
      const span = Math.max(1, story.height - geometry.innerHeight);
      const startOffset = geometry.storyScrollReady ? 2 : -headerHeight - 2;
      const positions = {
        start: Math.max(0, story.top + startOffset),
        middle: story.top + (span * 0.5),
        end: story.top + span - 2,
        "reverse-middle": story.top + (span * 0.5),
      };
      for (const state of STORY_STATES) {
        await settleAt(page, positions[state], geometry.storyScrollReady);
        const audit = await auditVisibleLayout(page);
        const stateRecord = { story: story.id, state, requestedScrollY: positions[state], audit };
        profileRecord.states.push(stateRecord);
        report.issues.push(...audit.issues.map((issue) => ({ browserName, profile: profile.id, story: story.id, state, ...issue })));
        if (captureScreenshots) {
          const fileName = screenshotName({ story: story.id, state, profile, browserName });
          const screenshotPath = path.join(screenshotDirectory, fileName);
          await page.screenshot({ path: screenshotPath, fullPage: false, animations: "disabled" });
          report.screenshots.push(screenshotPath);
        }
      }
    }

    for (const [section, selector] of [
      ["hero", ".page-hero"],
      ["technology-intro", ".home-technology-journeys-intro"],
      ["product-proof", ".home-product-proof"],
      ["commercial-path", ".home-commercial-path"],
    ]) {
      const position = await page.locator(selector).evaluate(
        (element, stickyHeaderHeight) => Math.max(0, element.getBoundingClientRect().top + window.scrollY - stickyHeaderHeight - 2),
        headerHeight,
      );
      await settleAt(page, position, false);
      const audit = await auditVisibleLayout(page, selector);
      profileRecord.states.push({ story: section, state: "static", requestedScrollY: position, audit });
      report.issues.push(...audit.issues.map((issue) => ({ browserName, profile: profile.id, story: section, state: "static", ...issue })));
      if (captureScreenshots) {
        const screenshotPath = path.join(screenshotDirectory, screenshotName({ story: section, state: "static", profile, browserName }));
        await page.screenshot({ path: screenshotPath, fullPage: false, animations: "disabled" });
        report.screenshots.push(screenshotPath);
      }
    }

    await context.close();
  }
  await browser.close();
}

report.issueSummary = Object.entries(report.issues.reduce((summary, issue) => {
  summary[issue.code] = (summary[issue.code] || 0) + 1;
  return summary;
}, {})).sort((left, right) => right[1] - left[1]);

await ensureDirectory(outputRoot);
await writeFile(path.join(outputRoot, `${label}-layout-audit.json`), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
  label,
  url: targetUrl,
  profiles: report.profiles.length,
  screenshots: report.screenshots.length,
  issues: report.issues.length,
  issueSummary: report.issueSummary,
  consoleErrors: report.consoleErrors.length,
}, null, 2));

if (failOnIssues && (report.issues.length || report.consoleErrors.length)) process.exitCode = 1;
