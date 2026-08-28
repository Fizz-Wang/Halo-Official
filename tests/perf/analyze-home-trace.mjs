import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "../browser/chrome-harness.mjs";

const args = parseArgs();
if (!args.trace) throw new Error("Pass --trace with a Chrome DevTools trace JSON file.");
const tracePath = path.resolve(String(args.trace));
const outputPath = path.resolve(String(args.output || tracePath.replace(/\.json$/i, "-analysis.json")));
const trace = JSON.parse(await readFile(tracePath, "utf8"));
const events = Array.isArray(trace.traceEvents) ? trace.traceEvents : [];

const threadNames = new Map();
for (const event of events) {
  if (event.ph !== "M" || event.name !== "thread_name") continue;
  threadNames.set(`${event.pid}:${event.tid}`, event.args?.name || "unknown");
}

const rendererThreads = [...threadNames.entries()]
  .filter(([, name]) => /CrRendererMain|RendererMain/i.test(name))
  .map(([key]) => key);
const rendererThread = rendererThreads[0];
if (!rendererThread) throw new Error("Chrome trace does not contain a renderer main thread.");

const complete = events.filter((event) => (
  event.ph === "X"
  && typeof event.dur === "number"
  && `${event.pid}:${event.tid}` === rendererThread
));

const byName = new Map();
for (const event of complete) {
  const current = byName.get(event.name) || { name: event.name, count: 0, totalUs: 0, maxUs: 0 };
  current.count += 1;
  current.totalUs += event.dur;
  current.maxUs = Math.max(current.maxUs, event.dur);
  byName.set(event.name, current);
}

const normalized = [...byName.values()].map((entry) => ({
  name: entry.name,
  count: entry.count,
  totalDurationMs: Number((entry.totalUs / 1000).toFixed(2)),
  maxDurationMs: Number((entry.maxUs / 1000).toFixed(2)),
}));
const topByTotalDuration = [...normalized]
  .sort((left, right) => right.totalDurationMs - left.totalDurationMs)
  .slice(0, 30);

function sumMatching(pattern) {
  const matches = normalized.filter((entry) => pattern.test(entry.name));
  return {
    count: matches.reduce((sum, entry) => sum + entry.count, 0),
    totalDurationMs: Number(matches.reduce((sum, entry) => sum + entry.totalDurationMs, 0).toFixed(2)),
    maxDurationMs: Number(Math.max(0, ...matches.map((entry) => entry.maxDurationMs)).toFixed(2)),
    events: matches.sort((left, right) => right.totalDurationMs - left.totalDurationMs).slice(0, 12),
  };
}

const taskEvents = complete.filter((event) => /RunTask|ProcessTaskFromWorkQueue/.test(event.name));
const longTasks = taskEvents.filter((event) => event.dur > 50_000);
const timestamps = complete.map((event) => event.ts);
const ends = complete.map((event) => event.ts + event.dur);
const traceDurationMs = timestamps.length
  ? (Math.max(...ends) - Math.min(...timestamps)) / 1000
  : 0;

const result = {
  trace: tracePath,
  rendererThread,
  rendererThreadName: threadNames.get(rendererThread),
  traceDurationMs: Number(traceDurationMs.toFixed(2)),
  taskSummary: {
    count: taskEvents.length,
    totalDurationMs: Number((taskEvents.reduce((sum, event) => sum + event.dur, 0) / 1000).toFixed(2)),
    longTaskCount: longTasks.length,
    longTaskTotalDurationMs: Number((longTasks.reduce((sum, event) => sum + event.dur, 0) / 1000).toFixed(2)),
    maxTaskDurationMs: Number((Math.max(0, ...taskEvents.map((event) => event.dur)) / 1000).toFixed(2)),
  },
  styleAndLayout: sumMatching(/UpdateLayoutTree|RecalculateStyles|Layout$|StyleAndLayout/),
  paintAndComposite: sumMatching(/Paint|PrePaint|Composite|Raster/),
  animationAndScroll: sumMatching(/AnimationFrame|Scroll|RequestAnimationFrame|FireAnimationFrame/),
  topByTotalDuration,
};

await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
