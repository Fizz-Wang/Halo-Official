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
const targetUrl = String(args.url || "http://localhost:3106/");
const outputRoot = path.resolve(String(args.output || "outputs/qa/scroll-dynamics"));
const requestedBrowsers = String(args.browsers || "chrome,edge").split(",").map((value) => value.trim());
const BOUNDARY_EVENT_TYPES = [
  "halo:story-boundary-start",
  "halo:story-boundary-snap",
  "halo:story-boundary-end",
];
const BOUNDARY_AUDIT_MODES = ["view-transition", "fallback"];

const FRAME_IDS = {
  compatibility: ["oracle", "mysql", "postgresql", "compatibility-result"],
  migration: ["inventory", "map", "test", "gaps", "rehearse", "decide", "migration-result"],
  availability: ["serving", "fault", "authority", "fence", "vip", "availability-result"],
  routing: ["read", "write", "classify", "redirect", "return", "context", "routing-result"],
  sharding: ["predicate", "map", "prune", "route", "sharding-result"],
};

const FINAL_TARGETS = {
  compatibility: '[data-motion~="kernel-pulse"]',
  migration: ".home-migration-decision",
  availability: ".home-availability-result",
  routing: ".home-routing-result",
  sharding: '[data-motion~="sharding-result"]',
};

const FRAME_SENTINELS = {
  migration: Object.fromEntries(FRAME_IDS.migration.slice(0, 6).map((frameId, index) => [frameId, [{
    selector: '[data-motion~="migration-evidence"]', index, opacityAtLeast: 0.98, translateXAtMost: 1,
  }]])),
  availability: {
    vip: [
      { selector: '[data-motion~="availability-vip"]', scaleX: 1, tolerance: 0.015 },
      { selector: '[data-motion~="availability-hold"]', opacityAtMost: 0.05 },
    ],
    "availability-result": [
      { selector: '[data-motion~="availability-hold"]', opacityAtMost: 0.05 },
    ],
  },
  routing: {
    read: [{ selector: '[data-motion~="routing-read-path"]', opacityAtLeast: 0.98, scaleX: 1, tolerance: 0.015 }],
    redirect: [{ selector: '[data-motion~="routing-write-path"]', opacityAtLeast: 0.98, scaleX: 1, tolerance: 0.015 }],
    return: [{ selector: '[data-motion~="routing-return-path"]', opacityAtLeast: 0.98, scaleX: 1, tolerance: 0.015 }],
  },
  sharding: {
    prune: [{ selector: '[data-motion~="sharding-pruned"]', scaleX: 0.94, tolerance: 0.015 }],
    route: [
      { selector: '[data-motion~="sharding-route"]', opacityAtLeast: 0.98, scaleX: 1, tolerance: 0.015 },
      { selector: '[data-motion~="sharding-target"]', scaleX: 1, tolerance: 0.015 },
    ],
  },
};

async function setScroll(page, y) {
  await page.evaluate((nextY) => {
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo(0, nextY);
  }, y);
  await page.waitForTimeout(100);
}

async function readStoryState(page, storyId) {
  return page.evaluate(({ id, finalSelector }) => {
    const story = document.querySelector(`[data-scroll-story="${id}"]`);
    const finalTarget = story?.querySelector(finalSelector);
    const finalStyle = finalTarget ? getComputedStyle(finalTarget) : null;
    const matrix = finalStyle?.transform && finalStyle.transform !== "none"
      ? new DOMMatrixReadOnly(finalStyle.transform)
      : null;
    const stopY = Number(story?.getAttribute("data-story-stop-y"));
    return {
      y: Number(window.scrollY.toFixed(2)),
      active: story?.getAttribute("data-active") ?? null,
      frameIndex: Number(story?.getAttribute("data-story-frame-index")),
      frameId: story?.getAttribute("data-story-frame-id") ?? null,
      frameProgress: Number(story?.getAttribute("data-story-frame-progress")),
      stopY,
      stopError: Number.isFinite(stopY) ? Number(Math.abs(window.scrollY - stopY).toFixed(2)) : null,
      transitioning: story?.getAttribute("data-story-transitioning") ?? null,
      lastChapterCurrent: Boolean(story?.querySelector(".home-story-progress li:last-child[data-current='true']")),
      finalOpacity: finalStyle ? Number(finalStyle.opacity) : null,
      finalScaleX: matrix ? Number(matrix.a.toFixed(4)) : 1,
    };
  }, { id: storyId, finalSelector: FINAL_TARGETS[storyId] });
}

async function waitForWheelTail(page, tailDurationMs = 0) {
  await page.waitForFunction(
    () => window.__haloWheelTailDone === true,
    undefined,
    { timeout: Math.max(1_500, tailDurationMs + 1_000) },
  );
}

async function sendWheelBurst(
  page,
  deltaY,
  { inertialTail = true, tailSchedule: customTailSchedule, waitForTail = true } = {},
) {
  const sign = Math.sign(deltaY) || 1;
  const magnitude = Math.abs(deltaY);
  await page.mouse.move(720, 450);
  if (!inertialTail) {
    await page.mouse.wheel(0, deltaY);
    return;
  }
  const tailSchedule = customTailSchedule ?? [48, 32, 22, 14, 8].map((value, index) => ({
    delay: (index + 1) * 20,
    deltaY: value * sign,
  }));
  const tailDurationMs = Math.max(0, ...tailSchedule.map(({ delay }) => delay));
  await page.evaluate((schedule) => {
    window.__haloWheelTailDone = false;
    window.addEventListener("wheel", () => {
      let completed = 0;
      for (const tail of schedule) {
        window.setTimeout(() => {
          window.dispatchEvent(new WheelEvent("wheel", {
            bubbles: false,
            cancelable: true,
            deltaMode: WheelEvent.DOM_DELTA_PIXEL,
            deltaY: tail.deltaY,
          }));
          completed += 1;
          if (completed === schedule.length) window.__haloWheelTailDone = true;
        }, tail.delay);
      }
    }, { capture: true, once: true });
  }, tailSchedule);
  await page.mouse.wheel(0, magnitude * sign);
  if (waitForTail) await waitForWheelTail(page, tailDurationMs);
}

async function sendTouchpadGesture(page, deltas, { intervalMs = 16 } = {}) {
  await page.evaluate(({ sequence, interval }) => new Promise((resolve) => {
    const target = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2) ?? window;
    sequence.forEach((deltaY, index) => {
      window.setTimeout(() => {
        target.dispatchEvent(new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          composed: true,
          deltaMode: WheelEvent.DOM_DELTA_PIXEL,
          deltaY,
        }));
        if (index === sequence.length - 1) resolve();
      }, index * interval);
    });
  }), { sequence: deltas, interval: intervalMs });
}

async function waitForFrame(page, storyId, frameIndex, timeout = 3_000) {
  await page.waitForFunction(({ id, index }) => {
    const story = document.querySelector(`[data-scroll-story="${id}"]`);
    const stopY = Number(story?.getAttribute("data-story-stop-y"));
    return story?.getAttribute("data-story-transitioning") === "false"
      && Number(story.getAttribute("data-story-frame-index")) === index
      && Number.isFinite(stopY)
      && Math.abs(window.scrollY - stopY) <= 2;
  }, { id: storyId, index: frameIndex }, { timeout });
  return readStoryState(page, storyId);
}

async function assertStableHold(page, storyId) {
  const samples = [await readStoryState(page, storyId)];
  await page.waitForTimeout(250);
  samples.push(await readStoryState(page, storyId));
  await page.waitForTimeout(250);
  samples.push(await readStoryState(page, storyId));
  const baseline = samples[0];
  const stable = samples.every((sample) => (
    Math.abs(sample.y - baseline.y) <= 2
    && sample.frameIndex === baseline.frameIndex
    && sample.frameId === baseline.frameId
    && sample.transitioning === "false"
  ));
  return { stable, samples };
}

async function beginBoundaryTrace(page) {
  await page.evaluate((eventTypes) => {
    window.__haloBoundaryAuditEvents = [];
    window.__haloBoundaryAuditSamples = [];
    window.__haloBoundaryAuditWheelEvents = [];
    window.__haloBoundaryAuditWheelCapture = null;
    window.__haloBoundaryAuditInjected = false;
    window.__haloBoundaryAuditInjectedAt = null;
    window.__haloBoundaryAuditInjectedDoneAt = null;
    window.__haloBoundaryAuditTraceToken = (window.__haloBoundaryAuditTraceToken ?? 0) + 1;
    const token = window.__haloBoundaryAuditTraceToken;
    const root = document.documentElement;
    const snapshot = () => {
      const storyStates = Object.fromEntries(Array.from(document.querySelectorAll("[data-scroll-story]")).map((story) => [
        story.getAttribute("data-scroll-story"),
        {
          active: story.getAttribute("data-active"),
          transitioning: story.getAttribute("data-story-transitioning"),
          frameIndex: Number(story.getAttribute("data-story-frame-index")),
          frameId: story.getAttribute("data-story-frame-id"),
        },
      ]));
      const centerStory = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2)
        ?.closest?.("[data-scroll-story]")?.getAttribute("data-scroll-story") ?? null;
      const curtain = document.querySelector(".home-story-boundary-curtain");
      const curtainStyle = curtain ? getComputedStyle(curtain) : null;
      const curtainRect = curtain?.getBoundingClientRect();
      return {
        at: Number(performance.now().toFixed(2)),
        y: Number(window.scrollY.toFixed(2)),
        boundaryTransition: root.dataset.storyBoundaryTransition ?? null,
        boundaryMode: root.dataset.storyBoundaryMode ?? null,
        boundaryDirection: root.dataset.storyBoundaryDirection ?? null,
        boundarySerial: root.dataset.storyBoundarySerial ?? null,
        curtainOpacity: curtainStyle ? Number(curtainStyle.opacity) : null,
        curtainRect: curtainRect ? {
          left: Number(curtainRect.left.toFixed(2)),
          top: Number(curtainRect.top.toFixed(2)),
          right: Number(curtainRect.right.toFixed(2)),
          bottom: Number(curtainRect.bottom.toFixed(2)),
        } : null,
        centerStory,
        storyStates,
      };
    };
    if (!window.__haloBoundaryAuditListenersInstalled) {
      for (const type of eventTypes) {
        window.addEventListener(type, (event) => {
          const current = snapshot();
          window.__haloBoundaryAuditEvents.push({
            type,
            ...current,
            detail: event.detail ? { ...event.detail } : null,
          });
        }, { capture: true });
      }
      window.addEventListener("wheel", (event) => {
        const capture = window.__haloBoundaryAuditWheelCapture;
        if (!capture?.active) return;
        const sample = {
          at: Number(performance.now().toFixed(2)),
          deltaY: event.deltaY,
          deltaMode: event.deltaMode,
          isTrusted: event.isTrusted,
          cancelable: event.cancelable,
          defaultPrevented: event.defaultPrevented,
        };
        window.__haloBoundaryAuditWheelEvents.push(sample);
        capture.seen += 1;
        if (capture.seen === 1) window.__haloBoundaryAuditInjectedAt = sample.at;
        if (capture.seen >= capture.expected) {
          capture.active = false;
          window.__haloBoundaryAuditInjected = true;
          window.__haloBoundaryAuditInjectedDoneAt = sample.at;
        }
      }, { capture: true });
      window.__haloBoundaryAuditListenersInstalled = true;
    }
    const sample = () => {
      if (window.__haloBoundaryAuditTraceToken !== token) return;
      window.__haloBoundaryAuditSamples.push(snapshot());
      window.requestAnimationFrame(sample);
    };
    sample();
  }, BOUNDARY_EVENT_TYPES);
}

async function sendBoundaryInterference(page, deltas) {
  await page.waitForFunction(() => (
    (window.__haloBoundaryAuditEvents ?? [])
      .some(({ type }) => type === "halo:story-boundary-start")
  ), undefined, { timeout: 2_000 });
  await page.waitForFunction((delayMs) => {
    const start = (window.__haloBoundaryAuditEvents ?? [])
      .find(({ type }) => type === "halo:story-boundary-start");
    return start && performance.now() >= start.at + delayMs;
  }, 240, { timeout: 2_000 });
  await page.evaluate((expectedDeltas) => {
    window.__haloBoundaryAuditWheelCapture = {
      active: true,
      expected: expectedDeltas.length,
      seen: 0,
    };
  }, deltas);
  for (let index = 0; index < deltas.length; index += 1) {
    await page.mouse.wheel(0, deltas[index]);
    if (index < deltas.length - 1) await page.waitForTimeout(16);
  }
  await page.waitForFunction(() => window.__haloBoundaryAuditInjected === true, undefined, { timeout: 1_000 });
}

async function endBoundaryTrace(page) {
  return page.evaluate(() => {
    window.__haloBoundaryAuditTraceToken = (window.__haloBoundaryAuditTraceToken ?? 0) + 1;
    const root = document.documentElement;
    return {
      events: window.__haloBoundaryAuditEvents ?? [],
      samples: window.__haloBoundaryAuditSamples ?? [],
      wheelEvents: window.__haloBoundaryAuditWheelEvents ?? [],
      injected: window.__haloBoundaryAuditInjected === true,
      injectedAt: window.__haloBoundaryAuditInjectedAt,
      injectedDoneAt: window.__haloBoundaryAuditInjectedDoneAt,
      root: {
        transition: root.dataset.storyBoundaryTransition ?? null,
        mode: root.dataset.storyBoundaryMode ?? null,
        direction: root.dataset.storyBoundaryDirection ?? null,
        serial: root.dataset.storyBoundarySerial ?? null,
      },
    };
  });
}

function appendAtomicBoundaryIssues(report, browserName, result) {
  const expectedFrameIndex = result.direction === "forward"
    ? 0
    : FRAME_IDS[result.to].length - 1;
  const expectedFrameId = FRAME_IDS[result.to][expectedFrameIndex];
  const expectedUnlockIndex = result.direction === "forward"
    ? 1
    : expectedFrameIndex - 1;
  const expectedUnlockFrameId = FRAME_IDS[result.to][expectedUnlockIndex];
  const events = result.trace.events;
  const starts = events.filter(({ type }) => type === "halo:story-boundary-start");
  const snaps = events.filter(({ type }) => type === "halo:story-boundary-snap");
  const ends = events.filter(({ type }) => type === "halo:story-boundary-end");
  const lifecycle = events.map(({ type }) => type);
  const serials = new Set(events.map(({ detail }) => String(detail?.serial ?? "")));
  const start = starts[0];
  const snap = snaps[0];
  const end = ends[0];
  const expectedEventDirection = result.direction === "forward" ? "forward" : "backward";
  const detailMatches = [start, snap, end].every((event) => (
    event?.detail?.from === result.from
    && event?.detail?.to === result.to
    && event?.detail?.direction === expectedEventDirection
    && event?.detail?.mode === result.mode
  ));
  const trueStartMatches = start
    && Number.isFinite(start.detail?.fromY)
    && Math.abs(start.detail.fromY - result.before.y) <= 2;
  const trueEndMatches = end
    && Number.isFinite(end.detail?.toY)
    && Math.abs(end.detail.toY - result.settled.y) <= 2;
  const snapCorrection = snap && end
    ? Math.max(Math.abs(snap.y - end.y), Math.abs(snap.y - result.settled.y))
    : Number.POSITIVE_INFINITY;
  const uncoveredMovement = result.trace.samples.slice(1).some((sample, index) => {
    const previous = result.trace.samples[index];
    if (Math.abs(sample.y - previous.y) <= 2) return false;
    return previous.boundaryTransition !== "active" && sample.boundaryTransition !== "active";
  });
  const centerSequence = result.trace.samples
    .map(({ centerStory }) => centerStory)
    .filter((storyId) => storyId === result.from || storyId === result.to)
    .filter((storyId, index, values) => index === 0 || storyId !== values[index - 1]);
  const centerReversed = centerSequence.some((storyId, index) => (
    index > 0 && storyId === result.from && centerSequence[index - 1] === result.to
  ));
  const durationMs = start && end ? Number((end.at - start.at).toFixed(2)) : null;
  const injectionOffsetMs = start && Number.isFinite(result.trace.injectedAt)
    ? Number((result.trace.injectedAt - start.at).toFixed(2))
    : null;
  const boundarySign = result.direction === "forward" ? 1 : -1;
  const interferenceSign = boundarySign * (result.interference === "same" ? 1 : -1);
  const expectedWheelDeltas = [12, 18, 24].map((delta) => delta * interferenceSign);
  const wheelEvents = result.trace.wheelEvents ?? [];
  const wheelGaps = wheelEvents.slice(1).map((event, index) => event.at - wheelEvents[index].at);
  const wheelInterferenceValid = wheelEvents.length === expectedWheelDeltas.length
    && wheelEvents.every((event, index) => (
      event.deltaY === expectedWheelDeltas[index]
      && event.deltaMode === 0
      && event.isTrusted === true
      && event.cancelable === true
      && event.defaultPrevented === true
    ))
    && wheelGaps.every((gap) => gap >= 10 && gap <= 80);
  const fallbackCurtainCoversViewport = result.mode !== "fallback" || (
    snap?.curtainRect?.left <= 0
    && snap?.curtainRect?.top <= 0
    && snap?.curtainRect?.right >= report.viewport.width
    && snap?.curtainRect?.bottom >= report.viewport.height
  );

  if (result.waitError || result.before.active !== "true"
    || result.fromAfter.active === "true"
    || result.settled.active !== "true" || result.settled.frameIndex !== expectedFrameIndex
    || result.settled.frameId !== expectedFrameId || result.settled.stopError > 2
    || !result.hold.stable) {
    report.issues.push(issue("atomic-boundary-target-failed", result.from, { browser: browserName, result }));
  }
  if (lifecycle.length !== 3
    || lifecycle.some((type, index) => type !== BOUNDARY_EVENT_TYPES[index])
    || starts.length !== 1 || snaps.length !== 1 || ends.length !== 1 || serials.size !== 1
    || !detailMatches || !trueStartMatches || !trueEndMatches
    || durationMs === null || durationMs < 400 || durationMs > 700
    || injectionOffsetMs === null || injectionOffsetMs < 220 || injectionOffsetMs > 300
    || result.trace.injectedDoneAt > end?.at) {
    report.issues.push(issue("atomic-boundary-lifecycle-invalid", result.from, { browser: browserName, result }));
  }
  if (!result.trace.injected || result.trace.root.transition !== "idle"
    || snap?.boundaryTransition !== "active" || snap?.boundaryMode !== result.mode
    || snap?.boundaryDirection !== expectedEventDirection
    || String(snap?.boundarySerial ?? "") !== String(snap?.detail?.serial ?? "")
    || (result.mode === "fallback" && (snap?.curtainOpacity ?? 0) < 0.98)
    || !fallbackCurtainCoversViewport) {
    report.issues.push(issue("atomic-boundary-snap-uncovered", result.from, { browser: browserName, result }));
  }
  if (!wheelInterferenceValid) {
    report.issues.push(issue("atomic-boundary-wheel-interference-invalid", result.from, {
      browser: browserName,
      expectedWheelDeltas,
      wheelGaps,
      result,
    }));
  }
  if (snapCorrection > 2 || uncoveredMovement || centerReversed) {
    report.issues.push(issue("atomic-boundary-visual-sequence-invalid", result.from, {
      browser: browserName,
      snapCorrection,
      uncoveredMovement,
      centerSequence,
      result,
    }));
  }
  if (result.unlockWaitError || result.unlock.frameIndex !== expectedUnlockIndex
    || result.unlock.frameId !== expectedUnlockFrameId || result.unlock.stopError > 2) {
    report.issues.push(issue("atomic-boundary-did-not-unlock", result.to, { browser: browserName, result }));
  }
}

async function runAtomicBoundaryScenario(
  page,
  geometry,
  { mode, direction, interference, from, to },
) {
  const fromGeometry = geometry.stories.find(({ id }) => id === from);
  if (!fromGeometry) {
    return {
      mode,
      direction,
      interference,
      from,
      to,
      waitError: `Missing source geometry for ${from}`,
      before: {},
      settled: {},
      hold: { stable: false, samples: [] },
      trace: { events: [], samples: [], wheelEvents: [], injected: false, root: {} },
      unlock: {},
      unlockWaitError: "Scenario was not run",
    };
  }
  const sourceFrameIndex = direction === "forward" ? FRAME_IDS[from].length - 1 : 0;
  const targetFrameIndex = direction === "forward" ? 0 : FRAME_IDS[to].length - 1;
  const unlockFrameIndex = direction === "forward" ? 1 : targetFrameIndex - 1;
  const wheelSign = direction === "forward" ? 1 : -1;
  await setScroll(page, fromGeometry.top + 1);
  await jumpToFrame(page, from, sourceFrameIndex);
  await page.waitForTimeout(250);
  const before = await readStoryState(page, from);
  const targetBefore = await readStoryState(page, to);
  await beginBoundaryTrace(page);
  await page.mouse.move(720, 450);
  await page.mouse.wheel(0, wheelSign * 72);
  const interferenceSign = wheelSign * (interference === "same" ? 1 : -1);
  await sendBoundaryInterference(page, [12, 18, 24].map((delta) => delta * interferenceSign));
  let waitError = null;
  let settled;
  try {
    await page.waitForFunction(() => (
      (window.__haloBoundaryAuditEvents ?? [])
        .filter(({ type }) => type === "halo:story-boundary-end").length >= 1
      && window.__haloBoundaryAuditInjected === true
    ), undefined, { timeout: 5_000 });
    settled = await waitForFrame(page, to, targetFrameIndex, 5_000);
  } catch (error) {
    waitError = String(error);
    settled = await readStoryState(page, to);
  }
  const hold = await assertStableHold(page, to);
  const fromAfter = await readStoryState(page, from);
  const trace = await endBoundaryTrace(page);
  await sendTouchpadGesture(page, [12 * wheelSign, 18 * wheelSign, 24 * wheelSign]);
  let unlockWaitError = null;
  let unlock;
  try {
    unlock = await waitForFrame(page, to, unlockFrameIndex, 4_000);
  } catch (error) {
    unlockWaitError = String(error);
    unlock = await readStoryState(page, to);
  }
  return {
    mode,
    direction,
    interference,
    from,
    to,
    before,
    targetBefore,
    settled,
    fromAfter,
    hold,
    trace,
    waitError,
    unlock,
    unlockWaitError,
  };
}

async function runAtomicBoundarySuite(browser, browserName, mode, report) {
  const context = await browser.newContext({ viewport: report.viewport });
  if (mode === "fallback") {
    await context.addInitScript(() => {
      Object.defineProperty(document, "startViewTransition", {
        configurable: true,
        value: undefined,
      });
    });
  }
  const page = await context.newPage();
  const results = [];
  try {
    await gotoHomepage(page, targetUrl);
    const geometry = await homepageGeometry(page);
    for (let index = 0; index < geometry.stories.length - 1; index += 1) {
      const previous = geometry.stories[index].id;
      const next = geometry.stories[index + 1].id;
      for (const direction of ["forward", "backward"]) {
        const from = direction === "forward" ? previous : next;
        const to = direction === "forward" ? next : previous;
        for (const interference of ["same", "reverse"]) {
          const result = await runAtomicBoundaryScenario(page, geometry, {
            mode,
            direction,
            interference,
            from,
            to,
          });
          results.push(result);
          appendAtomicBoundaryIssues(report, browserName, result);
        }
      }
    }
  } finally {
    await context.close();
  }
  return results;
}

async function auditFrameCompletion(page, storyId, frameId) {
  const sentinels = FRAME_SENTINELS[storyId]?.[frameId] ?? [];
  if (!sentinels.length) return { complete: true, values: [] };
  const values = await page.evaluate(({ id, specs }) => {
    const story = document.querySelector(`[data-scroll-story="${id}"]`);
    return specs.map((spec) => {
      const element = story?.querySelectorAll(spec.selector)[spec.index ?? 0];
      const style = element ? getComputedStyle(element) : null;
      const matrix = style?.transform && style.transform !== "none"
        ? new DOMMatrixReadOnly(style.transform)
        : null;
      return {
        found: Boolean(element),
        opacity: style ? Number(style.opacity) : null,
        scaleX: matrix ? Number(matrix.a.toFixed(4)) : 1,
        translateX: matrix ? Number(matrix.e.toFixed(2)) : 0,
      };
    });
  }, { id: storyId, specs: sentinels });
  const complete = values.every((value, index) => {
    const expected = sentinels[index];
    if (!value.found) return false;
    if (expected.opacityAtLeast !== undefined && value.opacity < expected.opacityAtLeast) return false;
    if (expected.opacityAtMost !== undefined && value.opacity > expected.opacityAtMost) return false;
    if (expected.translateXAtMost !== undefined && Math.abs(value.translateX) > expected.translateXAtMost) return false;
    if (expected.scaleX !== undefined
      && Math.abs(value.scaleX - expected.scaleX) > (expected.tolerance ?? 0.01)) return false;
    return true;
  });
  return { complete, values };
}

async function auditStepDetailLayout(page, storyId) {
  const baseAudit = await page.evaluate((id) => {
    const story = document.querySelector(`[data-scroll-story="${id}"]`);
    const list = story?.querySelector(
      ".home-migration-steps, .home-availability-steps, .home-routing-steps, .home-sharding-steps",
    );
    if (!story || !list) {
      return {
        ok: true,
        issues: [],
        counts: { hasStepList: false, details: 0, labels: 0, listItems: 0 },
      };
    }
    const effectiveOpacity = (element) => {
      let opacity = 1;
      for (let current = element; current && current !== story.parentElement; current = current.parentElement) {
        const currentStyle = getComputedStyle(current);
        if (currentStyle.display === "none" || currentStyle.visibility === "hidden") return 0;
        opacity *= Number(currentStyle.opacity || 1);
      }
      return opacity;
    };
    const rendered = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none"
        && style.visibility !== "hidden"
        && rect.width > 1
        && rect.height > 1;
    };
    const visible = (element) => rendered(element) && effectiveOpacity(element) >= 0.55;
    const compactRect = (element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: Number(rect.left.toFixed(2)),
        top: Number(rect.top.toFixed(2)),
        right: Number(rect.right.toFixed(2)),
        bottom: Number(rect.bottom.toFixed(2)),
      };
    };
    const currentItems = Array.from(list.querySelectorAll(":scope > li[data-current='true']"));
    const renderedDetails = [
      ...story.querySelectorAll(".home-story-step-detail > p[data-current='true']"),
      ...list.querySelectorAll(":scope > li[data-current='true'] > small"),
    ].filter(rendered);
    const details = renderedDetails.filter(visible);
    const labels = Array.from(list.querySelectorAll(":scope > li > span, :scope > li > strong")).filter(visible);
    const currentLabels = currentItems.flatMap((item) => [
      ...item.querySelectorAll(":scope > span"),
      ...item.querySelectorAll(":scope > strong"),
    ]);
    const issues = [];
    const counts = {
      hasStepList: true,
      details: details.length,
      labels: labels.length,
      listItems: list.querySelectorAll(":scope > li").length,
      currentItems: currentItems.length,
      currentLabels: currentLabels.length,
    };
    if (currentItems.length !== 1) {
      issues.push({ code: "step-current-item-count", expected: 1, actual: currentItems.length });
    }
    if (renderedDetails.length !== 1) {
      issues.push({ code: "step-detail-rendered-count", expected: 1, actual: renderedDetails.length });
    }
    if (details.length !== 1) {
      issues.push({ code: "step-detail-visible-count", expected: 1, actual: details.length });
    } else if (effectiveOpacity(details[0]) < 0.95) {
      issues.push({
        code: "step-detail-low-opacity",
        opacity: Number(effectiveOpacity(details[0]).toFixed(3)),
        detail: details[0].textContent?.trim().slice(0, 100),
      });
    }
    if (currentLabels.length !== 2) {
      issues.push({ code: "step-current-label-count", expected: 2, actual: currentLabels.length });
    }
    for (const label of currentLabels) {
      if (!rendered(label) || effectiveOpacity(label) < 0.95) {
        issues.push({
          code: "step-current-label-not-readable",
          text: label.textContent?.trim().slice(0, 60),
          opacity: Number(effectiveOpacity(label).toFixed(3)),
          rect: compactRect(label),
        });
      }
    }
    const figure = story.querySelector("figure");
    const auditElementBounds = (element, role) => {
      const rect = element.getBoundingClientRect();
      if (element.clientWidth > 0 && element.scrollWidth > element.clientWidth + 1) {
        issues.push({
          code: "step-text-horizontal-overflow",
          role,
          text: element.textContent?.trim().slice(0, 100),
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
          rect: compactRect(element),
        });
      }
      if (element.clientHeight > 0 && element.scrollHeight > element.clientHeight + 1) {
        issues.push({
          code: "step-text-vertical-overflow",
          role,
          text: element.textContent?.trim().slice(0, 100),
          scrollHeight: element.scrollHeight,
          clientHeight: element.clientHeight,
          rect: compactRect(element),
        });
      }
      const checked = new Set();
      for (let current = element.parentElement; current && current !== story.parentElement; current = current.parentElement) {
        const style = getComputedStyle(current);
        const forceFigureBounds = current === figure;
        const clipsX = forceFigureBounds || /(hidden|clip|auto|scroll)/.test(style.overflowX);
        const clipsY = forceFigureBounds || /(hidden|clip|auto|scroll)/.test(style.overflowY);
        if (!clipsX && !clipsY) continue;
        const clipRect = current.getBoundingClientRect();
        const outsideX = clipsX && (rect.left < clipRect.left - 2 || rect.right > clipRect.right + 2);
        const outsideY = clipsY && (rect.top < clipRect.top - 2 || rect.bottom > clipRect.bottom + 2);
        if ((outsideX || outsideY) && !checked.has(current)) {
          checked.add(current);
          issues.push({
            code: "step-text-clipped-by-ancestor",
            role,
            text: element.textContent?.trim().slice(0, 100),
            outsideX,
            outsideY,
            rect: compactRect(element),
            clipRect: compactRect(current),
            clipClass: current.className || current.tagName.toLowerCase(),
          });
        }
      }
    };
    details.forEach((detail) => auditElementBounds(detail, "detail"));
    labels.forEach((label) => auditElementBounds(label, "label"));
    for (const detail of details) {
      const detailRect = detail.getBoundingClientRect();
      const container = detail.closest(".home-story-step-detail") || list;
      const containerRect = container.getBoundingClientRect();
      for (const label of labels) {
        const labelRect = label.getBoundingClientRect();
        const width = Math.max(0, Math.min(detailRect.right, labelRect.right) - Math.max(detailRect.left, labelRect.left));
        const height = Math.max(0, Math.min(detailRect.bottom, labelRect.bottom) - Math.max(detailRect.top, labelRect.top));
        if (width > 1 && height > 1) {
          issues.push({
            code: "step-detail-label-overlap",
            detail: detail.textContent?.trim().slice(0, 100),
            label: label.textContent?.trim().slice(0, 60),
            intersection: { width: Number(width.toFixed(2)), height: Number(height.toFixed(2)) },
            detailRect: compactRect(detail),
            labelRect: compactRect(label),
          });
        }
      }
      if (labels.length) {
        const labelBottom = Math.max(...labels.map((label) => label.getBoundingClientRect().bottom));
        if (detailRect.top < labelBottom + 2) {
          issues.push({
            code: "step-detail-insufficient-separation",
            separation: Number((detailRect.top - labelBottom).toFixed(2)),
            detailRect: compactRect(detail),
          });
        }
      }
      if (detailRect.bottom > containerRect.bottom + 2) {
        issues.push({
          code: "step-detail-outside-reserved-region",
          overflow: Number((detailRect.bottom - containerRect.bottom).toFixed(2)),
          detailRect: compactRect(detail),
          containerRect: compactRect(container),
        });
      }
      const sequence = detail.closest(".home-story-step-sequence");
      if (sequence && sequence.clientHeight > 0 && sequence.scrollHeight > sequence.clientHeight + 1) {
        issues.push({
          code: "step-sequence-vertical-overflow",
          clientHeight: sequence.clientHeight,
          scrollHeight: sequence.scrollHeight,
          sequenceRect: compactRect(sequence),
        });
      }
      const note = figure?.querySelector(".home-story-note");
      if (note && visible(note)) {
        const noteRect = note.getBoundingClientRect();
        const width = Math.max(0, Math.min(detailRect.right, noteRect.right) - Math.max(detailRect.left, noteRect.left));
        const height = Math.max(0, Math.min(detailRect.bottom, noteRect.bottom) - Math.max(detailRect.top, noteRect.top));
        if (width > 1 && height > 1) {
          issues.push({
            code: "step-detail-note-overlap",
            intersection: { width: Number(width.toFixed(2)), height: Number(height.toFixed(2)) },
            detailRect: compactRect(detail),
            noteRect: compactRect(note),
          });
        }
      }
    }
    const note = figure?.querySelector(".home-story-note");
    if (note && visible(note)) {
      const noteRect = note.getBoundingClientRect();
      for (const label of labels) {
        const labelRect = label.getBoundingClientRect();
        const width = Math.max(0, Math.min(labelRect.right, noteRect.right) - Math.max(labelRect.left, noteRect.left));
        const height = Math.max(0, Math.min(labelRect.bottom, noteRect.bottom) - Math.max(labelRect.top, noteRect.top));
        if (width > 1 && height > 1) {
          issues.push({
            code: "step-label-note-overlap",
            label: label.textContent?.trim().slice(0, 60),
            intersection: { width: Number(width.toFixed(2)), height: Number(height.toFixed(2)) },
            labelRect: compactRect(label),
            noteRect: compactRect(note),
          });
        }
      }
      const content = [...details, ...labels];
      if (content.length) {
        const contentBottom = Math.max(...content.map((element) => element.getBoundingClientRect().bottom));
        if (noteRect.top < contentBottom + 2) {
          issues.push({
            code: "step-content-note-insufficient-separation",
            separation: Number((noteRect.top - contentBottom).toFixed(2)),
            noteRect: compactRect(note),
          });
        }
      }
    }
    const routingStageCards = Array.from(story.querySelectorAll(
      ".home-routing-connection, .home-routing-classifier, .home-routing-targets article",
    )).filter(visible);
    routingStageCards.forEach((card, index) => {
      const cardRect = card.getBoundingClientRect();
      for (const peer of routingStageCards.slice(index + 1)) {
        const peerRect = peer.getBoundingClientRect();
        const width = Math.max(0, Math.min(cardRect.right, peerRect.right) - Math.max(cardRect.left, peerRect.left));
        const height = Math.max(0, Math.min(cardRect.bottom, peerRect.bottom) - Math.max(cardRect.top, peerRect.top));
        if (width > 1 && height > 1) {
          issues.push({
            code: "routing-stage-card-overlap",
            card: card.textContent?.trim().slice(0, 80),
            peer: peer.textContent?.trim().slice(0, 80),
            intersection: { width: Number(width.toFixed(2)), height: Number(height.toFixed(2)) },
            cardRect: compactRect(card),
            peerRect: compactRect(peer),
          });
        }
      }
    });
    for (const card of routingStageCards) {
      const cardRect = card.getBoundingClientRect();
      for (const stepContent of [...labels, ...details]) {
        const stepRect = stepContent.getBoundingClientRect();
        const width = Math.max(0, Math.min(cardRect.right, stepRect.right) - Math.max(cardRect.left, stepRect.left));
        const height = Math.max(0, Math.min(cardRect.bottom, stepRect.bottom) - Math.max(cardRect.top, stepRect.top));
        if (width > 1 && height > 1) {
          issues.push({
            code: "routing-stage-step-content-overlap",
            card: card.textContent?.trim().slice(0, 80),
            stepContent: stepContent.textContent?.trim().slice(0, 80),
            intersection: { width: Number(width.toFixed(2)), height: Number(height.toFixed(2)) },
            cardRect: compactRect(card),
            stepRect: compactRect(stepContent),
          });
        }
      }
    }
    if (id === "sharding") {
      const stageCards = Array.from(story.querySelectorAll([
        ".home-sharding-query",
        ".home-sharding-logical",
        ".home-sharding-worker",
        ".home-sharding-nodes article",
      ].join(",")));
      for (const card of stageCards) {
        if (card.clientWidth > 0 && card.scrollWidth > card.clientWidth + 1) {
          issues.push({
            code: "sharding-card-horizontal-overflow",
            card: card.className || card.tagName.toLowerCase(),
            scrollWidth: card.scrollWidth,
            clientWidth: card.clientWidth,
            rect: compactRect(card),
          });
        }
        if (card.clientHeight > 0 && card.scrollHeight > card.clientHeight + 1) {
          issues.push({
            code: "sharding-card-vertical-overflow",
            card: card.className || card.tagName.toLowerCase(),
            scrollHeight: card.scrollHeight,
            clientHeight: card.clientHeight,
            rect: compactRect(card),
          });
        }
      }
      const queryLabel = story.querySelector(".home-sharding-query strong");
      const logicalLabel = story.querySelector(".home-sharding-logical small");
      if (queryLabel && logicalLabel && rendered(queryLabel) && rendered(logicalLabel)) {
        const queryRect = queryLabel.getBoundingClientRect();
        const logicalRect = logicalLabel.getBoundingClientRect();
        const width = Math.max(0, Math.min(queryRect.right, logicalRect.right) - Math.max(queryRect.left, logicalRect.left));
        const height = Math.max(0, Math.min(queryRect.bottom, logicalRect.bottom) - Math.max(queryRect.top, logicalRect.top));
        if (width > 1 && height > 1) {
          issues.push({
            code: "sharding-query-logical-label-overlap",
            intersection: { width: Number(width.toFixed(2)), height: Number(height.toFixed(2)) },
            queryRect: compactRect(queryLabel),
            logicalRect: compactRect(logicalLabel),
          });
        }
      }
    }
    return { ok: issues.length === 0, issues, counts };
  }, storyId);
  const semanticIssues = await page.evaluate(auditStoryOcclusions, storyId);
  const issues = [...baseAudit.issues, ...semanticIssues];
  return { ...baseAudit, ok: issues.length === 0, issues };
}

async function stepAndAudit(page, storyId, expectedIndex, deltaY, options = {}) {
  const before = await readStoryState(page, storyId);
  await page.evaluate(() => {
    window.__haloWheelAuditSamples = [];
    if (window.__haloWheelAuditInstalled) return;
    window.__haloWheelAuditInstalled = true;
    window.addEventListener("wheel", (event) => {
      window.__haloWheelAuditSamples.push({
        at: Number(performance.now().toFixed(2)),
        deltaY: event.deltaY,
      });
    }, { capture: true });
  });
  const firstDelta = options.highDelta ? Math.sign(deltaY) * 1200 : Math.sign(deltaY) * 72;
  await sendWheelBurst(page, firstDelta, { waitForTail: false });
  const during = await readStoryState(page, storyId);
  await waitForWheelTail(page);
  let settled;
  let waitError = null;
  try {
    settled = await waitForFrame(page, storyId, expectedIndex);
  } catch (error) {
    waitError = String(error);
    settled = await readStoryState(page, storyId);
  }
  const hold = await assertStableHold(page, storyId);
  const visual = await auditFrameCompletion(page, storyId, FRAME_IDS[storyId][expectedIndex]);
  const landedOnExpectedFrame = !waitError
    && settled.active === "true"
    && settled.frameIndex === expectedIndex
    && settled.stopError <= 2;
  const layout = landedOnExpectedFrame
    ? await auditStepDetailLayout(page, storyId)
    : { ok: false, notEvaluated: true, issues: [], counts: null };
  const gesture = await page.evaluate(() => {
    const samples = window.__haloWheelAuditSamples ?? [];
    const gaps = samples.slice(1).map((sample, index) => sample.at - samples[index].at);
    return {
      samples,
      maxGapMs: gaps.length ? Number(Math.max(...gaps).toFixed(2)) : 0,
    };
  });
  return { before, during, settled, hold, visual, layout, gesture, expectedIndex, waitError };
}

async function jumpToFrame(page, storyId, frameIndex) {
  const frameId = FRAME_IDS[storyId][frameIndex];
  const clicked = await page.evaluate(({ id, targetFrameId }) => {
    const story = document.querySelector(`[data-scroll-story="${id}"]`);
    const control = story?.querySelector(`[data-story-jump="${targetFrameId}"]`);
    if (!(control instanceof HTMLElement)) return false;
    control.click();
    return true;
  }, { id: storyId, targetFrameId: frameId });
  if (clicked) return waitForFrame(page, storyId, frameIndex, 4_000);
  let settled;
  for (let index = 0; index <= frameIndex; index += 1) {
    const frame = await stepAndAudit(page, storyId, index, 1);
    if (frame.waitError || frame.settled.active !== "true"
      || frame.settled.frameIndex !== index || frame.settled.stopError > 2) {
      throw new Error(`Failed to reach ${storyId}/${FRAME_IDS[storyId][index]}`);
    }
    settled = frame.settled;
  }
  return settled;
}

function issue(code, story, detail) {
  return { code, story, ...detail };
}

function appendStepLayoutIssues(report, browserName, storyId, frameResult) {
  if (frameResult.gesture?.maxGapMs >= 200) {
    report.issues.push(issue("synthetic-wheel-burst-too-slow", storyId, {
      browser: browserName,
      frameId: frameResult.settled?.frameId ?? null,
      gesture: frameResult.gesture,
    }));
  }
  for (const layoutIssue of frameResult.layout?.issues ?? []) {
    report.issues.push(issue(layoutIssue.code, storyId, {
      browser: browserName,
      frameId: frameResult.settled?.frameId ?? null,
      ...layoutIssue,
    }));
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  url: targetUrl,
  viewport: { width: 1440, height: 900 },
  browsers: [],
  issues: [],
};

await ensureDirectory(outputRoot);

for (const browserName of requestedBrowsers) {
  const browser = await launchBrowser({ browserName, headless: true });
  try {
    const context = await browser.newContext({ viewport: report.viewport });
    const page = await context.newPage();
    await gotoHomepage(page, targetUrl);
    const geometry = await homepageGeometry(page);
    const browserResult = {
      browser: browserName,
      storyScrollReady: geometry.storyScrollReady,
      stories: [],
      boundaries: [],
      atomicBoundaries: {},
      exceptions: {},
    };

    if (!geometry.storyScrollReady) {
      report.issues.push(issue("scroll-story-not-active", "all", { browser: browserName }));
    }

    const ctrlWheelPreserved = await page.evaluate(() => window.dispatchEvent(new WheelEvent("wheel", {
      deltaY: 120,
      ctrlKey: true,
      cancelable: true,
    })));
    const horizontalWheelPreserved = await page.evaluate(() => window.dispatchEvent(new WheelEvent("wheel", {
      deltaX: 160,
      deltaY: 20,
      cancelable: true,
    })));
    browserResult.exceptions = { ctrlWheelPreserved, horizontalWheelPreserved };
    if (!ctrlWheelPreserved) report.issues.push(issue("ctrl-wheel-blocked", "all", { browser: browserName }));
    if (!horizontalWheelPreserved) report.issues.push(issue("horizontal-wheel-blocked", "all", { browser: browserName }));

    const firstGeometry = geometry.stories[0];
    await setScroll(page, firstGeometry.top + 1);
    let enteredFromPreviousBoundary = false;

    for (let storyIndex = 0; storyIndex < geometry.stories.length; storyIndex += 1) {
      const story = geometry.stories[storyIndex];
      const frameIds = FRAME_IDS[story.id];
      const storyResult = {
        id: story.id,
        frames: [],
        reverse: null,
        reverseFrames: [],
        forwardReplayFrames: [],
        resultHold: null,
      };

      if (!enteredFromPreviousBoundary) {
        const entry = await stepAndAudit(page, story.id, 0, 1);
        storyResult.frames.push(entry);
        appendStepLayoutIssues(report, browserName, story.id, entry);
        if (entry.waitError || !entry.visual.complete || entry.settled.frameId !== frameIds[0] || entry.settled.stopError > 2) {
          report.issues.push(issue("first-frame-entry-failed", story.id, { browser: browserName, entry }));
        }
        if (entry.during.transitioning !== "true") {
          report.issues.push(issue("transition-did-not-start-with-input", story.id, { browser: browserName, entry }));
        }
        if (!entry.hold.stable) {
          report.issues.push(issue("first-frame-did-not-hold", story.id, { browser: browserName, entry }));
        }
      }

      if (frameIds.length > 1) {
        const forward = await stepAndAudit(page, story.id, 1, 1, { highDelta: true });
        storyResult.frames.push(forward);
        appendStepLayoutIssues(report, browserName, story.id, forward);
        if (forward.waitError || !forward.visual.complete || forward.settled.frameId !== frameIds[1] || forward.settled.stopError > 2) {
          report.issues.push(issue("high-delta-skipped-frame", story.id, { browser: browserName, forward }));
        }
        if (!forward.hold.stable) {
          report.issues.push(issue("frame-did-not-hold", story.id, { browser: browserName, forward }));
        }

        const reverse = await stepAndAudit(page, story.id, 0, -1);
        storyResult.reverse = reverse;
        appendStepLayoutIssues(report, browserName, story.id, reverse);
        if (reverse.waitError || !reverse.visual.complete || reverse.settled.frameId !== frameIds[0] || reverse.settled.stopError > 2) {
          report.issues.push(issue("reverse-did-not-step-one-frame", story.id, { browser: browserName, reverse }));
        }

        const returnForward = await stepAndAudit(page, story.id, 1, 1);
        storyResult.frames.push(returnForward);
        appendStepLayoutIssues(report, browserName, story.id, returnForward);
        if (returnForward.waitError || !returnForward.visual.complete
          || returnForward.settled.frameId !== frameIds[1] || returnForward.settled.stopError > 2) {
          report.issues.push(issue("second-independent-gesture-failed", story.id, { browser: browserName, returnForward }));
        }
        if (!returnForward.hold.stable) {
          report.issues.push(issue("second-independent-gesture-did-not-hold", story.id, {
            browser: browserName,
            returnForward,
          }));
        }
      }

      for (let frameIndex = 2; frameIndex < frameIds.length; frameIndex += 1) {
        const frame = await stepAndAudit(page, story.id, frameIndex, 1);
        storyResult.frames.push(frame);
        appendStepLayoutIssues(report, browserName, story.id, frame);
        if (frame.waitError || !frame.visual.complete
          || frame.settled.frameId !== frameIds[frameIndex] || frame.settled.stopError > 2) {
          report.issues.push(issue("frame-step-failed", story.id, {
            browser: browserName,
            expectedFrameId: frameIds[frameIndex],
            frame,
          }));
        }
        if (!frame.hold.stable) {
          report.issues.push(issue("frame-did-not-hold", story.id, { browser: browserName, frame }));
        }
      }

      for (let frameIndex = frameIds.length - 2; frameIndex >= 0; frameIndex -= 1) {
        const reverseFrame = await stepAndAudit(page, story.id, frameIndex, -1);
        storyResult.reverseFrames.push(reverseFrame);
        appendStepLayoutIssues(report, browserName, story.id, reverseFrame);
        if (reverseFrame.waitError || !reverseFrame.visual.complete
          || reverseFrame.settled.frameId !== frameIds[frameIndex] || reverseFrame.settled.stopError > 2) {
          report.issues.push(issue("reverse-frame-step-failed", story.id, {
            browser: browserName,
            expectedFrameId: frameIds[frameIndex],
            reverseFrame,
          }));
        }
        if (!reverseFrame.hold.stable) {
          report.issues.push(issue("reverse-frame-did-not-hold", story.id, { browser: browserName, reverseFrame }));
        }
      }

      for (let frameIndex = 1; frameIndex < frameIds.length; frameIndex += 1) {
        const replayFrame = await stepAndAudit(page, story.id, frameIndex, 1);
        storyResult.forwardReplayFrames.push(replayFrame);
        appendStepLayoutIssues(report, browserName, story.id, replayFrame);
        if (replayFrame.waitError || !replayFrame.visual.complete
          || replayFrame.settled.frameId !== frameIds[frameIndex] || replayFrame.settled.stopError > 2) {
          report.issues.push(issue("forward-replay-frame-step-failed", story.id, {
            browser: browserName,
            expectedFrameId: frameIds[frameIndex],
            replayFrame,
          }));
        }
        if (!replayFrame.hold.stable) {
          report.issues.push(issue("forward-replay-frame-did-not-hold", story.id, {
            browser: browserName,
            replayFrame,
          }));
        }
      }

      const resultHold = await assertStableHold(page, story.id);
      const finalState = resultHold.samples.at(-1);
      const finalVisualComplete = story.id === "compatibility"
        ? Math.abs(finalState.finalScaleX - 1) <= 0.02
        : (finalState.finalOpacity ?? 0) >= 0.98;
      storyResult.resultHold = resultHold;
      if (!resultHold.stable || finalState.active !== "true" || !finalState.lastChapterCurrent || !finalVisualComplete) {
        report.issues.push(issue("result-frame-not-held", story.id, { browser: browserName, resultHold }));
      }

      const nextStory = geometry.stories[storyIndex + 1];
      if (nextStory) {
        const oldState = await readStoryState(page, story.id);
        const nextStateBefore = await readStoryState(page, nextStory.id);
        await sendWheelBurst(page, 72);
        let nextState;
        let waitError = null;
        try {
          nextState = await waitForFrame(page, nextStory.id, 0);
        } catch (error) {
          waitError = String(error);
          nextState = await readStoryState(page, nextStory.id);
        }
        const nextVisual = await auditFrameCompletion(page, nextStory.id, FRAME_IDS[nextStory.id][0]);
        const nextLayout = await auditStepDetailLayout(page, nextStory.id);
        const oldStateAfter = await readStoryState(page, story.id);
        const boundary = {
          from: story.id,
          to: nextStory.id,
          oldState,
          oldStateAfter,
          nextStateBefore,
          nextState,
          nextVisual,
          nextLayout,
          waitError,
        };
        browserResult.boundaries.push(boundary);
        for (const layoutIssue of nextLayout.issues) {
          report.issues.push(issue(layoutIssue.code, nextStory.id, {
            browser: browserName,
            frameId: nextState.frameId,
            ...layoutIssue,
          }));
        }
        if (waitError || !nextVisual.complete || oldState.active !== "true"
          || oldState.frameId !== FRAME_IDS[story.id].at(-1) || oldState.stopError > 2
          || oldStateAfter.active === "true" || nextState.active !== "true"
          || nextState.frameId !== FRAME_IDS[nextStory.id][0] || nextState.stopError > 2) {
          report.issues.push(issue("next-story-first-frame-failed", story.id, { browser: browserName, boundary }));
        }
        const boundaryHold = await assertStableHold(page, nextStory.id);
        if (!boundaryHold.stable) {
          report.issues.push(issue("next-story-first-frame-did-not-hold", nextStory.id, {
            browser: browserName,
            boundaryHold,
          }));
        }
        enteredFromPreviousBoundary = true;
      } else {
        const beforeExit = await readStoryState(page, story.id);
        await sendWheelBurst(page, 72);
        await page.waitForTimeout(900);
        const afterExit = await readStoryState(page, story.id);
        const end = story.bottom - geometry.innerHeight;
        const exit = { beforeExit, afterExit, end };
        browserResult.boundaries.push({ from: story.id, to: "post-story", ...exit });
        if (afterExit.active === "true" || afterExit.y <= end + 2) {
          report.issues.push(issue("last-story-did-not-exit", story.id, { browser: browserName, exit }));
        }
      }

      browserResult.stories.push(storyResult);
    }

    report.browsers.push(browserResult);
    await context.close();

    for (const mode of BOUNDARY_AUDIT_MODES) {
      browserResult.atomicBoundaries[mode] = await runAtomicBoundarySuite(browser, browserName, mode, report);
    }

    const fallbackContext = await browser.newContext({ viewport: { width: 1440, height: 760 } });
    const fallbackPage = await fallbackContext.newPage();
    await gotoHomepage(fallbackPage, targetUrl);
    const fallbackGeometry = await homepageGeometry(fallbackPage);
    if (fallbackGeometry.storyScrollReady) {
      report.issues.push(issue("short-screen-stepper-should-fallback", "all", { browser: browserName }));
    }
    await fallbackContext.close();

    const zoomContext = await browser.newContext({
      viewport: { width: 1536, height: 864 },
      screen: { width: 1920, height: 1080 },
      deviceScaleFactor: 1.25,
      reducedMotion: "no-preference",
    });
    const zoomPage = await zoomContext.newPage();
    await gotoHomepage(zoomPage, targetUrl);
    const zoomGeometry = await homepageGeometry(zoomPage);
    const zoomResult = {
      profile: "zoom125-1536x864",
      storyScrollReady: zoomGeometry.storyScrollReady,
      stories: [],
    };
    browserResult.zoom125 = zoomResult;
    if (!zoomGeometry.storyScrollReady) {
      report.issues.push(issue("zoom125-stepper-not-active", "all", { browser: browserName }));
    }
    for (const story of zoomGeometry.stories) {
      const frameIds = FRAME_IDS[story.id];
      const storyFrames = [];
      await setScroll(zoomPage, story.top + 1);
      for (let frameIndex = 0; frameIndex < frameIds.length; frameIndex += 1) {
        const frame = await stepAndAudit(zoomPage, story.id, frameIndex, 1, { highDelta: frameIndex === 1 });
        storyFrames.push(frame);
        appendStepLayoutIssues(report, browserName, story.id, frame);
        if (frame.waitError || !frame.visual.complete
          || frame.settled.frameId !== frameIds[frameIndex] || frame.settled.stopError > 2) {
          report.issues.push(issue("zoom125-frame-step-failed", story.id, {
            browser: browserName,
            profile: zoomResult.profile,
            expectedFrameId: frameIds[frameIndex],
            frame,
          }));
        }
        if (!frame.hold.stable) {
          report.issues.push(issue("zoom125-frame-did-not-hold", story.id, {
            browser: browserName,
            profile: zoomResult.profile,
            frame,
          }));
        }
      }
      zoomResult.stories.push({ id: story.id, frames: storyFrames });
    }
    await zoomContext.close();

    const refreshContext = await browser.newContext({ viewport: report.viewport });
    const refreshPage = await refreshContext.newPage();
    await gotoHomepage(refreshPage, targetUrl);
    const refreshGeometry = await homepageGeometry(refreshPage);
    browserResult.refreshStates = [];
    for (const story of refreshGeometry.stories) {
      const frameIds = FRAME_IDS[story.id];
      const targetIndex = Math.floor((frameIds.length - 1) / 2);
      await setScroll(refreshPage, story.top + 1);
      await jumpToFrame(refreshPage, story.id, targetIndex);
      const beforeRefresh = await readStoryState(refreshPage, story.id);
      await refreshPage.reload({ waitUntil: "load" });
      let readyError = null;
      try {
        await refreshPage.waitForFunction(
          () => document.documentElement.classList.contains("story-scroll-ready"),
          undefined,
          { timeout: 5_000 },
        );
      } catch (error) {
        readyError = String(error);
      }
      let afterRefresh;
      let waitError = null;
      try {
        afterRefresh = await waitForFrame(refreshPage, story.id, targetIndex, 5_000);
      } catch (error) {
        waitError = String(error);
        afterRefresh = await readStoryState(refreshPage, story.id);
      }
      const refreshHold = await assertStableHold(refreshPage, story.id);
      const refreshVisual = await auditFrameCompletion(refreshPage, story.id, frameIds[targetIndex]);
      const refreshLayout = await auditStepDetailLayout(refreshPage, story.id);
      const refreshState = {
        story: story.id,
        targetIndex,
        beforeRefresh,
        afterRefresh,
        refreshHold,
        refreshVisual,
        refreshLayout,
        readyError,
        waitError,
      };
      browserResult.refreshStates.push(refreshState);
      for (const layoutIssue of refreshLayout.issues) {
        report.issues.push(issue(layoutIssue.code, story.id, {
          browser: browserName,
          state: "refresh",
          frameId: afterRefresh.frameId,
          ...layoutIssue,
        }));
      }
      if (readyError || waitError || beforeRefresh.frameId !== frameIds[targetIndex]
        || afterRefresh.frameId !== frameIds[targetIndex] || afterRefresh.stopError > 2
        || !refreshHold.stable || !refreshVisual.complete || !refreshLayout.ok) {
        report.issues.push(issue("refresh-did-not-restore-held-frame", story.id, {
          browser: browserName,
          refreshState,
        }));
      }
    }
    await refreshContext.close();

    const touchpadContext = await browser.newContext({ viewport: report.viewport });
    const touchpadPage = await touchpadContext.newPage();
    await gotoHomepage(touchpadPage, targetUrl);
    const touchpadGeometry = await homepageGeometry(touchpadPage);
    const touchpadStory = touchpadGeometry.stories[0];
    const touchpadSequence = [12, 18, 24, 18, 12, 8];
    await setScroll(touchpadPage, touchpadStory.top + 1);
    const touchpadSetup = await stepAndAudit(touchpadPage, touchpadStory.id, 0, 1);

    await touchpadPage.evaluate(() => { window.__haloWheelAuditSamples = []; });
    await sendTouchpadGesture(touchpadPage, touchpadSequence);
    await touchpadPage.waitForTimeout(250);
    const queuedForwardStart = await readStoryState(touchpadPage, touchpadStory.id);
    await sendTouchpadGesture(touchpadPage, touchpadSequence);
    let queuedForwardWaitError = null;
    try {
      await waitForFrame(touchpadPage, touchpadStory.id, 2, 5_000);
    } catch (error) {
      queuedForwardWaitError = String(error);
    }
    const queuedForwardHold = await assertStableHold(touchpadPage, touchpadStory.id);
    const queuedForwardSettled = await readStoryState(touchpadPage, touchpadStory.id);
    const queuedForwardGesture = await touchpadPage.evaluate(() => {
      const samples = window.__haloWheelAuditSamples ?? [];
      const gaps = samples.slice(1).map((sample, index) => sample.at - samples[index].at);
      return {
        samples,
        maxGapMs: gaps.length ? Number(Math.max(...gaps).toFixed(2)) : 0,
      };
    });
    browserResult.touchpadQueuedForward = {
      setup: touchpadSetup.settled,
      queuedAt: queuedForwardStart,
      settled: queuedForwardSettled,
      hold: queuedForwardHold,
      gesture: queuedForwardGesture,
      waitError: queuedForwardWaitError,
    };
    if (touchpadSetup.waitError || touchpadSetup.settled.frameIndex !== 0
      || queuedForwardStart.transitioning !== "true" || queuedForwardWaitError
      || queuedForwardSettled.frameIndex !== 2
      || queuedForwardSettled.frameId !== FRAME_IDS[touchpadStory.id][2]
      || queuedForwardSettled.stopError > 2 || !queuedForwardHold.stable
      || queuedForwardGesture.samples.length !== touchpadSequence.length * 2
      || queuedForwardGesture.maxGapMs < 200) {
      report.issues.push(issue("touchpad-second-gesture-not-queued-once", touchpadStory.id, {
        browser: browserName,
        touchpadQueuedForward: browserResult.touchpadQueuedForward,
      }));
    }

    await jumpToFrame(touchpadPage, touchpadStory.id, 0);
    await touchpadPage.evaluate(() => { window.__haloWheelAuditSamples = []; });
    await sendTouchpadGesture(touchpadPage, touchpadSequence);
    await touchpadPage.waitForTimeout(250);
    const queuedReverseStart = await readStoryState(touchpadPage, touchpadStory.id);
    await sendTouchpadGesture(touchpadPage, touchpadSequence.map((delta) => -delta));
    let queuedReverseWaitError = null;
    try {
      await waitForFrame(touchpadPage, touchpadStory.id, 0, 5_000);
    } catch (error) {
      queuedReverseWaitError = String(error);
    }
    const queuedReverseHold = await assertStableHold(touchpadPage, touchpadStory.id);
    const queuedReverseSettled = await readStoryState(touchpadPage, touchpadStory.id);
    browserResult.touchpadQueuedReverse = {
      queuedAt: queuedReverseStart,
      settled: queuedReverseSettled,
      hold: queuedReverseHold,
      waitError: queuedReverseWaitError,
    };
    if (queuedReverseStart.transitioning !== "true" || queuedReverseWaitError
      || queuedReverseSettled.frameIndex !== 0
      || queuedReverseSettled.frameId !== FRAME_IDS[touchpadStory.id][0]
      || queuedReverseSettled.stopError > 2 || !queuedReverseHold.stable) {
      report.issues.push(issue("touchpad-queued-reverse-did-not-step-back", touchpadStory.id, {
        browser: browserName,
        touchpadQueuedReverse: browserResult.touchpadQueuedReverse,
      }));
    }

    await jumpToFrame(touchpadPage, touchpadStory.id, 0);
    const belowThresholdJumpClicked = await touchpadPage.evaluate((storyId) => {
      const control = document.querySelector(
        `[data-scroll-story="${storyId}"] [data-story-jump="postgresql"]`,
      );
      if (!(control instanceof HTMLElement)) return false;
      control.click();
      return true;
    }, touchpadStory.id);
    await touchpadPage.waitForFunction((storyId) => (
      document.querySelector(`[data-scroll-story="${storyId}"]`)
        ?.getAttribute("data-story-transitioning") === "true"
    ), touchpadStory.id);
    await sendTouchpadGesture(touchpadPage, [17, 18]);
    await touchpadPage.waitForTimeout(250);
    const belowThreshold = await readStoryState(touchpadPage, touchpadStory.id);
    await sendTouchpadGesture(touchpadPage, [18]);
    let belowThresholdWaitError = null;
    try {
      await waitForFrame(touchpadPage, touchpadStory.id, 2, 4_000);
    } catch (error) {
      belowThresholdWaitError = String(error);
    }
    const belowThresholdHold = await assertStableHold(touchpadPage, touchpadStory.id);
    const belowThresholdSettled = await readStoryState(touchpadPage, touchpadStory.id);

    await jumpToFrame(touchpadPage, touchpadStory.id, 0);
    const atThresholdJumpClicked = await touchpadPage.evaluate((storyId) => {
      const control = document.querySelector(
        `[data-scroll-story="${storyId}"] [data-story-jump="postgresql"]`,
      );
      if (!(control instanceof HTMLElement)) return false;
      control.click();
      return true;
    }, touchpadStory.id);
    await touchpadPage.waitForFunction((storyId) => (
      document.querySelector(`[data-scroll-story="${storyId}"]`)
        ?.getAttribute("data-story-transitioning") === "true"
    ), touchpadStory.id);
    await sendTouchpadGesture(touchpadPage, [18, 18]);
    let atThresholdWaitError = null;
    try {
      await waitForFrame(touchpadPage, touchpadStory.id, 3, 5_000);
    } catch (error) {
      atThresholdWaitError = String(error);
    }
    const atThresholdHold = await assertStableHold(touchpadPage, touchpadStory.id);
    const atThresholdSettled = await readStoryState(touchpadPage, touchpadStory.id);
    browserResult.touchpadThreshold = {
      belowThresholdJumpClicked,
      belowThreshold,
      belowThresholdSettled,
      belowThresholdHold,
      belowThresholdWaitError,
      atThresholdJumpClicked,
      atThresholdSettled,
      atThresholdHold,
      atThresholdWaitError,
    };
    if (!belowThresholdJumpClicked || belowThreshold.transitioning !== "true"
      || belowThresholdWaitError || belowThresholdSettled.frameIndex !== 2
      || !belowThresholdHold.stable
      || !atThresholdJumpClicked || atThresholdWaitError
      || atThresholdSettled.frameIndex !== 3
      || atThresholdSettled.frameId !== FRAME_IDS[touchpadStory.id][3]
      || !atThresholdHold.stable) {
      report.issues.push(issue("touchpad-threshold-boundary-failed", touchpadStory.id, {
        browser: browserName,
        touchpadThreshold: browserResult.touchpadThreshold,
      }));
    }

    await jumpToFrame(touchpadPage, touchpadStory.id, 0);
    await touchpadPage.evaluate((storyId) => {
      window.__haloWheelAuditSamples = [];
      window.__haloImmediateTransitionSettledAt = null;
      window.__haloImmediateTransitionObserver?.disconnect();
      const story = document.querySelector(`[data-scroll-story="${storyId}"]`);
      let sawTransition = false;
      const observer = new MutationObserver(() => {
        if (story?.getAttribute("data-story-transitioning") === "true") {
          sawTransition = true;
          return;
        }
        if (sawTransition) {
          window.__haloImmediateTransitionSettledAt = Number(performance.now().toFixed(2));
          observer.disconnect();
        }
      });
      if (story) observer.observe(story, { attributes: true, attributeFilter: ["data-story-transitioning"] });
      window.__haloImmediateTransitionObserver = observer;
    }, touchpadStory.id);
    await sendTouchpadGesture(touchpadPage, touchpadSequence);
    await waitForFrame(touchpadPage, touchpadStory.id, 1, 4_000);
    await sendTouchpadGesture(touchpadPage, touchpadSequence);
    let immediateReleaseWaitError = null;
    try {
      await waitForFrame(touchpadPage, touchpadStory.id, 2, 4_000);
    } catch (error) {
      immediateReleaseWaitError = String(error);
    }
    const immediateReleaseHold = await assertStableHold(touchpadPage, touchpadStory.id);
    const immediateReleaseSettled = await readStoryState(touchpadPage, touchpadStory.id);
    const immediateReleaseTiming = await touchpadPage.evaluate((secondGestureSampleIndex) => {
      const samples = window.__haloWheelAuditSamples ?? [];
      const transitionSettledAt = window.__haloImmediateTransitionSettledAt;
      const secondGestureAt = samples[secondGestureSampleIndex]?.at ?? null;
      return {
        samples,
        transitionSettledAt,
        secondGestureAt,
        gapMs: Number.isFinite(transitionSettledAt) && Number.isFinite(secondGestureAt)
          ? Number((secondGestureAt - transitionSettledAt).toFixed(2))
          : null,
      };
    }, touchpadSequence.length);
    browserResult.touchpadImmediatePostTransition = {
      settled: immediateReleaseSettled,
      hold: immediateReleaseHold,
      timing: immediateReleaseTiming,
      waitError: immediateReleaseWaitError,
    };
    if (immediateReleaseWaitError || immediateReleaseSettled.frameIndex !== 2
      || immediateReleaseSettled.frameId !== FRAME_IDS[touchpadStory.id][2]
      || !immediateReleaseHold.stable || immediateReleaseTiming.gapMs === null
      || immediateReleaseTiming.gapMs < 0 || immediateReleaseTiming.gapMs >= 200) {
      report.issues.push(issue("post-transition-wheel-lock-was-rearmed", touchpadStory.id, {
        browser: browserName,
        touchpadImmediatePostTransition: browserResult.touchpadImmediatePostTransition,
      }));
    }

    const queueResetSequence = [12, 18, 24];
    const prepareQueuedStep = async () => {
      await sendTouchpadGesture(touchpadPage, queueResetSequence);
      await touchpadPage.waitForTimeout(250);
      const beforeQueue = await readStoryState(touchpadPage, touchpadStory.id);
      await sendTouchpadGesture(touchpadPage, queueResetSequence);
      const afterQueue = await readStoryState(touchpadPage, touchpadStory.id);
      return { beforeQueue, afterQueue };
    };

    await jumpToFrame(touchpadPage, touchpadStory.id, 0);
    const replayQueue = await prepareQueuedStep();
    await touchpadPage.evaluate((storyId) => {
      document.querySelector(`[data-scroll-story="${storyId}"] [data-story-replay]`)?.click();
    }, touchpadStory.id);
    let replayQueueWaitError = null;
    try {
      await waitForFrame(touchpadPage, touchpadStory.id, 0, 4_000);
    } catch (error) {
      replayQueueWaitError = String(error);
    }
    const replayQueueHold = await assertStableHold(touchpadPage, touchpadStory.id);
    const replayQueueSettled = await readStoryState(touchpadPage, touchpadStory.id);
    browserResult.replayClearsQueuedStep = {
      ...replayQueue,
      settled: replayQueueSettled,
      hold: replayQueueHold,
      waitError: replayQueueWaitError,
    };
    if (replayQueue.afterQueue.transitioning !== "true" || replayQueueWaitError
      || replayQueueSettled.frameIndex !== 0 || !replayQueueHold.stable) {
      report.issues.push(issue("replay-did-not-clear-queued-step", touchpadStory.id, {
        browser: browserName,
        replayClearsQueuedStep: browserResult.replayClearsQueuedStep,
      }));
    }

    await jumpToFrame(touchpadPage, touchpadStory.id, 0);
    const jumpQueue = await prepareQueuedStep();
    const jumpClicked = await touchpadPage.evaluate((storyId) => {
      const control = document.querySelector(
        `[data-scroll-story="${storyId}"] [data-story-jump="mysql"]`,
      );
      if (!(control instanceof HTMLElement)) return false;
      control.click();
      return true;
    }, touchpadStory.id);
    let jumpQueueWaitError = null;
    try {
      await waitForFrame(touchpadPage, touchpadStory.id, 1, 4_000);
    } catch (error) {
      jumpQueueWaitError = String(error);
    }
    const jumpQueueHold = await assertStableHold(touchpadPage, touchpadStory.id);
    const jumpQueueSettled = await readStoryState(touchpadPage, touchpadStory.id);
    browserResult.jumpClearsQueuedStep = {
      ...jumpQueue,
      clicked: jumpClicked,
      settled: jumpQueueSettled,
      hold: jumpQueueHold,
      waitError: jumpQueueWaitError,
    };
    if (jumpQueue.afterQueue.transitioning !== "true" || !jumpClicked || jumpQueueWaitError
      || jumpQueueSettled.frameIndex !== 1 || !jumpQueueHold.stable) {
      report.issues.push(issue("chapter-jump-did-not-clear-queued-step", touchpadStory.id, {
        browser: browserName,
        jumpClearsQueuedStep: browserResult.jumpClearsQueuedStep,
      }));
    }

    await jumpToFrame(touchpadPage, touchpadStory.id, 0);
    const resizeQueue = await prepareQueuedStep();
    await touchpadPage.evaluate((storyId) => {
      window.__haloQueuedResizeTriggered = false;
      window.__haloQueuedResizeObserver?.disconnect();
      const story = document.querySelector(`[data-scroll-story="${storyId}"]`);
      let sawTransition = story?.getAttribute("data-story-transitioning") === "true";
      const observer = new MutationObserver(() => {
        if (story?.getAttribute("data-story-transitioning") === "true") {
          sawTransition = true;
          return;
        }
        if (sawTransition) {
          window.__haloQueuedResizeTriggered = true;
          window.visualViewport?.dispatchEvent(new Event("resize"));
          observer.disconnect();
        }
      });
      if (story) observer.observe(story, { attributes: true, attributeFilter: ["data-story-transitioning"] });
      window.__haloQueuedResizeObserver = observer;
    }, touchpadStory.id);
    let resizeQueueWaitError = null;
    try {
      await waitForFrame(touchpadPage, touchpadStory.id, 1, 5_000);
    } catch (error) {
      resizeQueueWaitError = String(error);
    }
    const resizeQueueHold = await assertStableHold(touchpadPage, touchpadStory.id);
    const resizeQueueSettled = await readStoryState(touchpadPage, touchpadStory.id);
    const resizeTriggered = await touchpadPage.evaluate(() => window.__haloQueuedResizeTriggered === true);
    browserResult.resizeClearsQueuedStep = {
      ...resizeQueue,
      resizeTriggered,
      settled: resizeQueueSettled,
      hold: resizeQueueHold,
      waitError: resizeQueueWaitError,
    };
    if (resizeQueue.afterQueue.transitioning !== "true" || !resizeTriggered || resizeQueueWaitError
      || resizeQueueSettled.frameIndex !== 1 || !resizeQueueHold.stable) {
      report.issues.push(issue("resize-did-not-clear-queued-step", touchpadStory.id, {
        browser: browserName,
        resizeClearsQueuedStep: browserResult.resizeClearsQueuedStep,
      }));
    }

    await jumpToFrame(touchpadPage, touchpadStory.id, 0);
    const cleanupQueue = await prepareQueuedStep();
    await touchpadPage.setViewportSize({ width: 1000, height: 800 });
    await touchpadPage.waitForFunction(() => !document.documentElement.classList.contains("story-scroll-ready"));
    await touchpadPage.waitForTimeout(250);
    const cleanupFirstY = await touchpadPage.evaluate(() => window.scrollY);
    await touchpadPage.waitForTimeout(600);
    const cleanupFinal = await touchpadPage.evaluate(() => ({
      y: window.scrollY,
      storyScrollReady: document.documentElement.classList.contains("story-scroll-ready"),
      transitioning: document.querySelector('[data-scroll-story="compatibility"]')
        ?.getAttribute("data-story-transitioning") ?? null,
    }));
    browserResult.cleanupClearsQueuedStep = {
      ...cleanupQueue,
      firstY: cleanupFirstY,
      final: cleanupFinal,
    };
    if (cleanupQueue.afterQueue.transitioning !== "true" || cleanupFinal.storyScrollReady
      || cleanupFinal.transitioning === "true" || Math.abs(cleanupFinal.y - cleanupFirstY) > 2) {
      report.issues.push(issue("component-cleanup-did-not-cancel-queued-step", touchpadStory.id, {
        browser: browserName,
        cleanupClearsQueuedStep: browserResult.cleanupClearsQueuedStep,
      }));
    }
    await touchpadContext.close();

    const continuousTailContext = await browser.newContext({ viewport: report.viewport });
    const continuousTailPage = await continuousTailContext.newPage();
    await gotoHomepage(continuousTailPage, targetUrl);
    const continuousTailGeometry = await homepageGeometry(continuousTailPage);
    const continuousTailStory = continuousTailGeometry.stories[0];
    await setScroll(continuousTailPage, continuousTailStory.top + 1);
    const continuousTailSetup = await stepAndAudit(continuousTailPage, continuousTailStory.id, 0, 1);
    await continuousTailPage.evaluate((storyId) => {
      window.__haloWheelAuditSamples = [];
      window.__haloContinuousTailTransitionSettledAt = null;
      window.__haloContinuousTailObserver?.disconnect();
      const story = document.querySelector(`[data-scroll-story="${storyId}"]`);
      let sawTransition = false;
      const observer = new MutationObserver(() => {
        if (story?.getAttribute("data-story-transitioning") === "true") {
          sawTransition = true;
          return;
        }
        if (sawTransition) {
          window.__haloContinuousTailTransitionSettledAt = Number(performance.now().toFixed(2));
          observer.disconnect();
        }
      });
      if (story) observer.observe(story, { attributes: true, attributeFilter: ["data-story-transitioning"] });
      window.__haloContinuousTailObserver = observer;
    }, continuousTailStory.id);
    const continuousTailSchedule = [
      { delay: 20, deltaY: 48 },
      { delay: 60, deltaY: 36 },
      { delay: 120, deltaY: 28 },
      { delay: 200, deltaY: 21 },
      { delay: 300, deltaY: 16 },
      { delay: 420, deltaY: 12 },
      { delay: 540, deltaY: 8 },
      { delay: 660, deltaY: 4 },
    ];
    await sendWheelBurst(continuousTailPage, 72, { tailSchedule: continuousTailSchedule });
    let continuousTailWaitError = null;
    try {
      await waitForFrame(continuousTailPage, continuousTailStory.id, 1, 3_000);
    } catch (error) {
      continuousTailWaitError = String(error);
    }
    await continuousTailPage.waitForTimeout(300);
    const continuousTailSettled = await readStoryState(continuousTailPage, continuousTailStory.id);
    const continuousTailHold = await assertStableHold(continuousTailPage, continuousTailStory.id);
    const continuousTailGesture = await continuousTailPage.evaluate(() => {
      const samples = window.__haloWheelAuditSamples ?? [];
      const gaps = samples.slice(1).map((sample, index) => sample.at - samples[index].at);
      const magnitudes = samples.map((sample) => Math.abs(sample.deltaY));
      const transitionSettledAt = window.__haloContinuousTailTransitionSettledAt;
      return {
        samples,
        maxGapMs: gaps.length ? Number(Math.max(...gaps).toFixed(2)) : 0,
        decays: magnitudes.every((value, index) => index === 0 || value <= magnitudes[index - 1]),
        transitionSettledAt,
        tailAfterTransition: Number.isFinite(transitionSettledAt)
          && samples.some((sample) => sample.at > transitionSettledAt),
      };
    });
    browserResult.continuousTailProtection = {
      setup: continuousTailSetup.settled,
      settled: continuousTailSettled,
      hold: continuousTailHold,
      gesture: continuousTailGesture,
      waitError: continuousTailWaitError,
    };
    if (continuousTailSetup.waitError || continuousTailSetup.settled.frameIndex !== 0
      || continuousTailWaitError || continuousTailSettled.frameIndex !== 1
      || continuousTailSettled.frameId !== FRAME_IDS[continuousTailStory.id][1]
      || continuousTailSettled.stopError > 2 || !continuousTailHold.stable
      || continuousTailGesture.samples.length !== continuousTailSchedule.length + 1
      || continuousTailGesture.maxGapMs >= 200 || !continuousTailGesture.decays
      || !continuousTailGesture.tailAfterTransition) {
      report.issues.push(issue("continuous-inertial-tail-skipped-frame", continuousTailStory.id, {
        browser: browserName,
        continuousTailProtection: browserResult.continuousTailProtection,
      }));
    }
    await continuousTailContext.close();

    const resizeContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const resizePage = await resizeContext.newPage();
    await gotoHomepage(resizePage, targetUrl);
    const resizeGeometry = await homepageGeometry(resizePage);
    await setScroll(resizePage, resizeGeometry.stories[0].top + 1);
    await resizePage.mouse.move(720, 450);
    await resizePage.mouse.wheel(0, 72);
    await resizePage.waitForTimeout(80);
    const duringResize = await readStoryState(resizePage, "compatibility");
    await resizePage.setViewportSize({ width: 1360, height: 920 });
    let afterResize;
    let resizeWaitError = null;
    try {
      afterResize = await waitForFrame(resizePage, "compatibility", 0, 4_000);
    } catch (error) {
      resizeWaitError = String(error);
      afterResize = await readStoryState(resizePage, "compatibility");
    }
    const resizeHold = await assertStableHold(resizePage, "compatibility");
    browserResult.resizeTransition = { duringResize, afterResize, resizeHold, resizeWaitError };
    if (resizeWaitError || afterResize.frameId !== FRAME_IDS.compatibility[0]
      || afterResize.stopError > 2 || !resizeHold.stable) {
      report.issues.push(issue("resize-transition-missed-refreshed-stop", "compatibility", {
        browser: browserName,
        resizeTransition: browserResult.resizeTransition,
      }));
    }
    await resizeContext.close();

    const routingResizeContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const routingResizePage = await routingResizeContext.newPage();
    await gotoHomepage(routingResizePage, targetUrl);
    const routingResizeGeometry = await homepageGeometry(routingResizePage);
    const routingGeometry = routingResizeGeometry.stories.find((story) => story.id === "routing");
    if (routingGeometry) {
      await setScroll(routingResizePage, routingGeometry.top + 1);
      await jumpToFrame(routingResizePage, "routing", 1);
      await routingResizePage.mouse.move(720, 450);
      await routingResizePage.mouse.wheel(0, 72);
      await routingResizePage.waitForTimeout(80);
      const duringRoutingResize = await readStoryState(routingResizePage, "routing");
      await routingResizePage.setViewportSize({ width: 1360, height: 920 });
      let afterRoutingResize;
      let routingResizeWaitError = null;
      try {
        afterRoutingResize = await waitForFrame(routingResizePage, "routing", 2, 4_000);
      } catch (error) {
        routingResizeWaitError = String(error);
        afterRoutingResize = await readStoryState(routingResizePage, "routing");
      }
      const routingResizeHold = await assertStableHold(routingResizePage, "routing");
      const routingResizeLayout = await auditStepDetailLayout(routingResizePage, "routing");
      browserResult.routingResizeTransition = {
        duringRoutingResize,
        afterRoutingResize,
        routingResizeHold,
        routingResizeLayout,
        routingResizeWaitError,
      };
      for (const layoutIssue of routingResizeLayout.issues) {
        report.issues.push(issue(layoutIssue.code, "routing", {
          browser: browserName,
          state: "resize-transition",
          frameId: afterRoutingResize.frameId,
          ...layoutIssue,
        }));
      }
      if (duringRoutingResize.transitioning !== "true" || routingResizeWaitError
        || afterRoutingResize.frameId !== FRAME_IDS.routing[2] || afterRoutingResize.stopError > 2
        || !routingResizeHold.stable || !routingResizeLayout.ok) {
        report.issues.push(issue("routing-resize-transition-layout-failed", "routing", {
          browser: browserName,
          routingResizeTransition: browserResult.routingResizeTransition,
        }));
      }
    } else {
      report.issues.push(issue("routing-resize-story-missing", "routing", { browser: browserName }));
    }
    await routingResizeContext.close();

    const boundaryResizeContext = await browser.newContext({ viewport: { width: 1440, height: 864 } });
    const boundaryResizePage = await boundaryResizeContext.newPage();
    await gotoHomepage(boundaryResizePage, targetUrl);
    let boundaryGeometry = await homepageGeometry(boundaryResizePage);
    const firstBoundaryStory = boundaryGeometry.stories[0];
    await setScroll(boundaryResizePage, firstBoundaryStory.top + 1);
    await jumpToFrame(boundaryResizePage, firstBoundaryStory.id, 0);
    await boundaryResizePage.mouse.move(720, 420);
    await boundaryResizePage.mouse.wheel(0, -72);
    await boundaryResizePage.waitForTimeout(80);
    const duringBackwardBoundaryResize = await readStoryState(boundaryResizePage, firstBoundaryStory.id);
    await boundaryResizePage.setViewportSize({ width: 1440, height: 1200 });
    await boundaryResizePage.waitForFunction((id) => {
      const story = document.querySelector(`[data-scroll-story="${id}"]`);
      return story?.getAttribute("data-story-transitioning") === "false"
        && story.getAttribute("data-active") === "false";
    }, firstBoundaryStory.id, { timeout: 4_000 });
    const afterBackwardBoundaryResize = await readStoryState(boundaryResizePage, firstBoundaryStory.id);
    const backwardGeometry = await homepageGeometry(boundaryResizePage);
    const backwardStart = backwardGeometry.stories[0].top;

    await boundaryResizePage.setViewportSize({ width: 1440, height: 864 });
    await gotoHomepage(boundaryResizePage, targetUrl);
    boundaryGeometry = await homepageGeometry(boundaryResizePage);
    const lastBoundaryStory = boundaryGeometry.stories.at(-1);
    await setScroll(boundaryResizePage, lastBoundaryStory.top + 1);
    await jumpToFrame(boundaryResizePage, lastBoundaryStory.id, FRAME_IDS[lastBoundaryStory.id].length - 1);
    await boundaryResizePage.mouse.move(720, 420);
    await boundaryResizePage.mouse.wheel(0, 72);
    await boundaryResizePage.waitForTimeout(80);
    const duringForwardBoundaryResize = await readStoryState(boundaryResizePage, lastBoundaryStory.id);
    await boundaryResizePage.setViewportSize({ width: 1440, height: 1200 });
    await boundaryResizePage.waitForFunction((id) => {
      const story = document.querySelector(`[data-scroll-story="${id}"]`);
      return story?.getAttribute("data-story-transitioning") === "false"
        && story.getAttribute("data-active") === "false";
    }, lastBoundaryStory.id, { timeout: 4_000 });
    const afterForwardBoundaryResize = await readStoryState(boundaryResizePage, lastBoundaryStory.id);
    const forwardGeometry = await homepageGeometry(boundaryResizePage);
    const refreshedLastStory = forwardGeometry.stories.at(-1);
    const forwardEnd = refreshedLastStory.bottom - forwardGeometry.innerHeight;
    browserResult.boundaryResizeTransitions = {
      backward: {
        during: duringBackwardBoundaryResize,
        after: afterBackwardBoundaryResize,
        refreshedStart: backwardStart,
      },
      forward: {
        during: duringForwardBoundaryResize,
        after: afterForwardBoundaryResize,
        refreshedEnd: forwardEnd,
      },
    };
    if (duringBackwardBoundaryResize.transitioning !== "true"
      || afterBackwardBoundaryResize.active === "true" || afterBackwardBoundaryResize.y >= backwardStart - 2) {
      report.issues.push(issue("backward-boundary-resize-target-stale", firstBoundaryStory.id, {
        browser: browserName,
        boundaryResize: browserResult.boundaryResizeTransitions.backward,
      }));
    }
    if (duringForwardBoundaryResize.transitioning !== "true"
      || afterForwardBoundaryResize.active === "true" || afterForwardBoundaryResize.y <= forwardEnd + 2) {
      report.issues.push(issue("forward-boundary-resize-target-stale", lastBoundaryStory.id, {
        browser: browserName,
        boundaryResize: browserResult.boundaryResizeTransitions.forward,
      }));
    }
    await boundaryResizeContext.close();
  } finally {
    await browser.close();
  }
}

const reportPath = path.join(outputRoot, "scroll-dynamics.json");
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ reportPath, browsers: report.browsers.length, issues: report.issues.length }, null, 2));

if (report.issues.length) process.exitCode = 1;
