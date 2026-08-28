import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "../browser/chrome-harness.mjs";

const args = parseArgs();
if (!args.before || !args.after) {
  throw new Error("Pass --before and --after metrics JSON paths.");
}

const before = JSON.parse(await readFile(path.resolve(String(args.before)), "utf8"));
const after = JSON.parse(await readFile(path.resolve(String(args.after)), "utf8"));

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[midpoint] : (sorted[midpoint - 1] + sorted[midpoint]) / 2;
}

function aggregate(capture) {
  const metric = (name) => median(capture.runs.map((run) => run.metrics[name] ?? 0));
  const frame = (name) => median(capture.runs.map((run) => run.frame[name] ?? 0));
  const observer = (group, name) => median(capture.runs.map((run) => run[group][name] ?? 0));
  return {
    averageFps: frame("averageFps"),
    p95FrameMs: frame("p95FrameMs"),
    slowFrames20ms: frame("slowFrames20ms"),
    slowFrames33ms: frame("slowFrames33ms"),
    slowFrames50ms: frame("slowFrames50ms"),
    longTasks: observer("longTasks", "count"),
    longTaskTotalMs: observer("longTasks", "totalDurationMs"),
    longAnimationFrames: observer("longAnimationFrames", "count"),
    longAnimationFrameTotalMs: observer("longAnimationFrames", "totalDurationMs"),
    taskDurationMs: metric("TaskDuration") * 1000,
    scriptDurationMs: metric("ScriptDuration") * 1000,
    layoutDurationMs: metric("LayoutDuration") * 1000,
    recalcStyleDurationMs: metric("RecalcStyleDuration") * 1000,
    layoutCount: metric("LayoutCount"),
    recalcStyleCount: metric("RecalcStyleCount"),
  };
}

function delta(beforeValue, afterValue) {
  if (!beforeValue) return null;
  return ((afterValue - beforeValue) / beforeValue) * 100;
}

const beforeAggregate = aggregate(before);
const afterAggregate = aggregate(after);
const comparison = Object.fromEntries(Object.keys(beforeAggregate).map((key) => [key, {
  before: Number(beforeAggregate[key].toFixed(2)),
  after: Number(afterAggregate[key].toFixed(2)),
  changePercent: delta(beforeAggregate[key], afterAggregate[key]) === null
    ? null
    : Number(delta(beforeAggregate[key], afterAggregate[key]).toFixed(2)),
}]));

const result = {
  before: { label: before.label, url: before.url, capturedAt: before.capturedAt },
  after: { label: after.label, url: after.url, capturedAt: after.capturedAt },
  comparison,
};

const markdownRows = Object.entries(comparison).map(([metric, values]) => (
  `| ${metric} | ${values.before} | ${values.after} | ${values.changePercent ?? "n/a"}% |`
));
const markdown = [
  `# Homepage scroll performance: ${before.label} → ${after.label}`,
  "",
  `- Before: ${before.url}`,
  `- After: ${after.url}`,
  "",
  "| Metric | Before median | After median | Change |",
  "| --- | ---: | ---: | ---: |",
  ...markdownRows,
  "",
].join("\n");

const output = path.resolve(String(args.output || "outputs/perf/comparison.json"));
await writeFile(output, `${JSON.stringify(result, null, 2)}\n`);
await writeFile(output.replace(/\.json$/i, ".md"), markdown);
console.log(markdown);
