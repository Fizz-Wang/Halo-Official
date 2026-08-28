import { writeFile } from "node:fs/promises";
import path from "node:path";
import {
  ensureDirectory,
  gotoHomepage,
  homepageGeometry,
  launchBrowser,
  parseArgs,
} from "../browser/chrome-harness.mjs";

const args = parseArgs();
const targetUrl = String(args.url || "https://halo-demo.qichenggroup.top/");
const label = String(args.label || "capture");
const runCount = Math.max(1, Number(args.runs || 3));
const outputRoot = path.resolve(String(args.output || `outputs/perf/${label}`));
const browserName = String(args.browser || "chrome");

const metricNames = [
  "TaskDuration",
  "ScriptDuration",
  "LayoutDuration",
  "RecalcStyleDuration",
  "LayoutCount",
  "RecalcStyleCount",
  "JSHeapUsedSize",
  "Nodes",
  "Documents",
  "Frames",
];

function percentile(values, fraction) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
}

function summarizeFrames(samples) {
  const intervals = samples.slice(1).flatMap((sample, index) => (
    sample.phase === samples[index].phase
      ? [sample.timestamp - samples[index].timestamp]
      : []
  ));
  const duration = intervals.reduce((sum, interval) => sum + interval, 0);
  return {
    frames: intervals.length,
    phaseBoundaryGapsExcluded: Math.max(0, samples.length - 1 - intervals.length),
    durationMs: Number(duration.toFixed(2)),
    averageFps: duration > 0 ? Number(((intervals.length * 1000) / duration).toFixed(2)) : 0,
    medianFrameMs: Number(percentile(intervals, 0.5).toFixed(2)),
    p95FrameMs: Number(percentile(intervals, 0.95).toFixed(2)),
    maxFrameMs: Number(Math.max(0, ...intervals).toFixed(2)),
    slowFrames20ms: intervals.filter((interval) => interval > 20).length,
    slowFrames33ms: intervals.filter((interval) => interval > 33.3).length,
    slowFrames50ms: intervals.filter((interval) => interval > 50).length,
  };
}

function metricsToObject(result) {
  return Object.fromEntries(result.metrics.map((metric) => [metric.name, metric.value]));
}

function metricDelta(before, after) {
  return Object.fromEntries(metricNames.map((name) => [
    name,
    Number(((after[name] ?? 0) - (before[name] ?? 0)).toFixed(6)),
  ]));
}

async function installObservers(page) {
  await page.evaluate(() => {
    const store = {
      frames: [],
      longTasks: [],
      longAnimationFrames: [],
      layoutShifts: [],
      observers: [],
    };
    window.__haloScrollPerf = store;
    for (const type of ["longtask", "long-animation-frame", "layout-shift"]) {
      if (!PerformanceObserver.supportedEntryTypes.includes(type)) continue;
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (type === "longtask") {
            store.longTasks.push({ startTime: entry.startTime, duration: entry.duration });
          } else if (type === "long-animation-frame") {
            store.longAnimationFrames.push({
              startTime: entry.startTime,
              duration: entry.duration,
              blockingDuration: entry.blockingDuration || 0,
            });
          } else if (!entry.hadRecentInput) {
            store.layoutShifts.push({ startTime: entry.startTime, value: entry.value });
          }
        }
      });
      observer.observe({ type, buffered: false });
      store.observers.push(observer);
    }
  });
}

async function driveScroll(page, range) {
  return page.evaluate(async ({ start, end }) => {
    const store = window.__haloScrollPerf;
    const phases = [
      { name: "normal-forward", from: start, to: end, duration: 6_500 },
      { name: "fast-reverse", from: end, to: start, duration: 1_400 },
      { name: "fast-forward", from: start, to: end, duration: 1_400 },
      { name: "normal-reverse", from: end, to: start, duration: 4_200 },
    ];
    const sleep = (duration) => new Promise((resolve) => setTimeout(resolve, duration));
    window.scrollTo(0, start);
    await sleep(350);
    for (const phase of phases) {
      await new Promise((resolve) => {
        const phaseStart = performance.now();
        const step = (timestamp) => {
          const progress = Math.min(1, (timestamp - phaseStart) / phase.duration);
          const position = phase.from + ((phase.to - phase.from) * progress);
          window.scrollTo(0, position);
          store.frames.push({ timestamp, phase: phase.name, progress, scrollY: window.scrollY });
          if (progress < 1) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      });
      await sleep(180);
    }
    await sleep(450);
    store.observers.forEach((observer) => observer.disconnect());
    return {
      frames: store.frames,
      longTasks: store.longTasks,
      longAnimationFrames: store.longAnimationFrames,
      layoutShifts: store.layoutShifts,
      finalScrollY: window.scrollY,
    };
  }, range);
}

async function stopTrace(client, tracePath) {
  const complete = new Promise((resolve) => client.once("Tracing.tracingComplete", resolve));
  await client.send("Tracing.end");
  const { stream } = await complete;
  const chunks = [];
  while (true) {
    const response = await client.send("IO.read", { handle: stream, size: 1_048_576 });
    chunks.push(Buffer.from(response.data, response.base64Encoded ? "base64" : "utf8"));
    if (response.eof) break;
  }
  await client.send("IO.close", { handle: stream });
  await writeFile(tracePath, Buffer.concat(chunks));
}

function summarizeEntries(entries) {
  const durations = entries.map((entry) => entry.duration);
  return {
    count: entries.length,
    totalDurationMs: Number(durations.reduce((sum, duration) => sum + duration, 0).toFixed(2)),
    p95DurationMs: Number(percentile(durations, 0.95).toFixed(2)),
    maxDurationMs: Number(Math.max(0, ...durations).toFixed(2)),
  };
}

await ensureDirectory(outputRoot);
const browser = await launchBrowser({ browserName });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  reducedMotion: "no-preference",
});
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => consoleErrors.push(error.message));

await gotoHomepage(page, targetUrl);
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(500);
const geometry = await homepageGeometry(page);
const client = await context.newCDPSession(page);
await client.send("Performance.enable");
const runs = [];

for (let index = 0; index < runCount; index += 1) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  await installObservers(page);
  const shouldTrace = index === 0;
  const tracePath = path.join(outputRoot, `${label}-trace.json`);
  if (shouldTrace) {
    await client.send("Tracing.start", {
      categories: [
        "devtools.timeline",
        "disabled-by-default-devtools.timeline",
        "disabled-by-default-devtools.timeline.frame",
        "blink.user_timing",
        "loading",
        "latencyInfo",
      ].join(","),
      options: "sampling-frequency=10000",
      transferMode: "ReturnAsStream",
    });
  }
  const before = metricsToObject(await client.send("Performance.getMetrics"));
  const observed = await driveScroll(page, geometry.range);
  const after = metricsToObject(await client.send("Performance.getMetrics"));
  if (shouldTrace) await stopTrace(client, tracePath);
  runs.push({
    run: index + 1,
    frame: summarizeFrames(observed.frames),
    longTasks: summarizeEntries(observed.longTasks),
    longAnimationFrames: summarizeEntries(observed.longAnimationFrames),
    layoutShift: Number(observed.layoutShifts.reduce((sum, entry) => sum + entry.value, 0).toFixed(5)),
    metrics: metricDelta(before, after),
    finalScrollY: observed.finalScrollY,
  });
}

const result = {
  label,
  url: targetUrl,
  browserName,
  capturedAt: new Date().toISOString(),
  geometry,
  consoleErrors,
  runs,
};
await writeFile(path.join(outputRoot, `${label}-metrics.json`), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
await browser.close();
