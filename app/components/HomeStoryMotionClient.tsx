"use client";

import { useEffect } from "react";

type GsapApi = typeof import("gsap")["gsap"];
type ScrollTriggerApi = typeof import("gsap/ScrollTrigger")["ScrollTrigger"];
type ScrollTriggerInstance = ReturnType<ScrollTriggerApi["create"]>;
type StoryId = "compatibility" | "migration" | "availability" | "routing" | "sharding";

interface StoryFrame {
  id: string;
  progress: number;
}

interface StoryMotion {
  id: StoryId;
  story: HTMLElement;
  timeline: GSAPTimeline;
  trigger: ScrollTriggerInstance;
  frames: readonly StoryFrame[];
}

interface ConnectionNavigator extends Navigator {
  connection?: EventTarget & { saveData?: boolean };
  deviceMemory?: number;
}

interface StoredStoryFrame {
  path: string;
  storyId: StoryId;
  frameIndex: number;
}

type StoryBoundaryDirection = "forward" | "backward";
type StoryBoundaryMode = "view-transition" | "fallback";

interface StoryBoundaryDetail {
  serial: number;
  from: StoryId;
  to: StoryId;
  direction: StoryBoundaryDirection;
  mode: StoryBoundaryMode;
  fromY: number;
  toY: number;
}

const STORY_IDS: readonly StoryId[] = [
  "compatibility",
  "migration",
  "availability",
  "routing",
  "sharding",
];

const SCROLL_LENGTH: Readonly<Record<StoryId, number>> = {
  compatibility: 2.8,
  migration: 2.3,
  availability: 2.5,
  routing: 2.3,
  sharding: 2.4,
};

const FINAL_STATE_HOLD = 0.5;

const PROGRESS_LABELS: Readonly<Record<StoryId, readonly string[]>> = {
  compatibility: ["oracle", "mysql", "postgresql"],
  migration: ["inventory", "map", "test", "gaps", "rehearse", "decide"],
  availability: ["serving", "fault", "authority", "fence", "vip"],
  routing: ["read", "write", "classify", "redirect", "return", "context"],
  sharding: ["predicate", "map", "prune", "route", "sharding-result"],
};

const FRAME_REVEAL_END: Readonly<Record<StoryId, Readonly<Record<string, number>>>> = {
  compatibility: { oracle: 1.18, mysql: 1.18, postgresql: 1.18 },
  migration: { inventory: 0.62, map: 0.62, test: 0.62, gaps: 0.62, rehearse: 0.62, decide: 0.62 },
  availability: { serving: 0.5, fault: 0.5, authority: 0.5, fence: 0.5, vip: 0.57 },
  routing: { read: 0.72, write: 0.36, classify: 0.44, redirect: 0.76, return: 0.64, context: 0.36 },
  sharding: { predicate: 0.5, map: 0.52, prune: 0.62, route: 0.96, "sharding-result": 0.5 },
};

const RESULT_LABELS: Readonly<Record<StoryId, string>> = {
  compatibility: "compatibility-result",
  migration: "migration-result",
  availability: "availability-result",
  routing: "routing-result",
  sharding: "sharding-result",
};

const WHEEL_STEP_THRESHOLD = 36;
const WHEEL_GESTURE_QUIET_MS = 200;
const STORY_BOUNDARY_SETTLE_MS = 120;
const STORY_BOUNDARY_FALLBACK_COVER_MS = 180;
const STORY_BOUNDARY_FALLBACK_REVEAL_MS = 260;
const FRAME_PROGRESS_EPSILON = 0.002;
const STORY_FRAME_RESTORE_KEY = "halo:home-story-frame";

function storyFrames(id: StoryId, timeline: GSAPTimeline): readonly StoryFrame[] {
  const duration = timeline.duration();
  const contentEnd = Math.max(0, duration - FINAL_STATE_HOLD);
  const resultId = RESULT_LABELS[id];
  const frames = PROGRESS_LABELS[id].map((label) => ({
    id: label,
    progress: Math.min(contentEnd, (timeline.labels[label] ?? 0) + (FRAME_REVEAL_END[id][label] ?? 0)) / duration,
  }));
  if (frames.at(-1)?.id === resultId) {
    frames[frames.length - 1] = { id: resultId, progress: contentEnd / duration };
  } else {
    frames.push({ id: resultId, progress: contentEnd / duration });
  }
  return frames;
}

function normalizedWheelDelta(event: WheelEvent) {
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
  return { x: event.deltaX * unit, y: event.deltaY * unit };
}

function scrollableIntent(event: WheelEvent, story: HTMLElement, deltaY: number) {
  for (const target of event.composedPath()) {
    if (!(target instanceof HTMLElement)) continue;
    if (target === story) break;
    if (!story.contains(target)) continue;
    const overflowY = window.getComputedStyle(target).overflowY;
    if (!/(auto|scroll|overlay)/.test(overflowY) || target.scrollHeight <= target.clientHeight + 1) continue;
    const canScroll = deltaY > 0
      ? target.scrollTop + target.clientHeight < target.scrollHeight - 1
      : target.scrollTop > 1;
    return { element: target, canScroll };
  }
  return null;
}

function motion(scope: Element, token: string) {
  return Array.from(scope.querySelectorAll<HTMLElement | SVGElement>(`[data-motion~="${token}"]`));
}

function reveal(
  timeline: GSAPTimeline,
  targets: Element[],
  from: GSAPTweenVars,
  at: string | number,
  duration = 0.55,
) {
  if (targets.length) {
    const to: GSAPTweenVars = { autoAlpha: 1, duration, ease: "none" };
    if (from.x !== undefined) to.x = 0;
    if (from.y !== undefined) to.y = 0;
    if (from.xPercent !== undefined) to.xPercent = 0;
    if (from.yPercent !== undefined) to.yPercent = 0;
    if (from.scale !== undefined) to.scale = 1;
    if (from.scaleX !== undefined) to.scaleX = 1;
    if (from.scaleY !== undefined) to.scaleY = 1;
    timeline.fromTo(targets, { autoAlpha: 0, ...from }, to, at);
  }
}

function buildCompatibility(gsap: GsapApi, timeline: GSAPTimeline, story: HTMLElement) {
  const oracle = Array.from(story.querySelectorAll<HTMLElement>('[data-scene="oracle"]'));
  const mysql = Array.from(story.querySelectorAll<HTMLElement>('[data-scene="mysql"]'));
  const postgres = Array.from(story.querySelectorAll<HTMLElement>('[data-scene="postgresql"]'));
  const kernel = motion(story, "compat-kernel");
  gsap.set([...mysql, ...postgres], { autoAlpha: 0 });

  timeline.addLabel("oracle", 0);
  reveal(timeline, oracle, { yPercent: 7 }, "oracle", 0.28);
  reveal(timeline, kernel, { scale: 0.94 }, "oracle+=0.06", 0.38);
  reveal(timeline, motion(story, "compat-oracle-entry"), { xPercent: -12 }, "oracle+=0.12", 0.38);
  timeline.fromTo(
    motion(story, "compat-oracle-token"),
    { autoAlpha: 0, yPercent: 18 },
    { autoAlpha: 1, yPercent: 0, duration: 0.32, stagger: 0.06, ease: "none" },
    "oracle+=0.35",
  );
  reveal(timeline, Array.from(story.querySelectorAll<HTMLElement>(".home-oracle-controls")), { yPercent: 14 }, "oracle+=0.78", 0.32);

  timeline.addLabel("mysql", 1.7);
  timeline.to(oracle, { autoAlpha: 0, xPercent: -5, duration: 0.2 }, "mysql");
  reveal(timeline, mysql, { xPercent: 9 }, "mysql+=0.22", 0.28);
  reveal(timeline, Array.from(story.querySelectorAll<HTMLElement>(".home-mysql-clients")), { xPercent: -15 }, "mysql+=0.25", 0.3);
  timeline.fromTo(
    motion(story, "compat-mysql-packet"),
    { autoAlpha: 0, xPercent: -140 },
    { autoAlpha: 1, xPercent: 0, duration: 0.3, stagger: 0.06, ease: "none" },
    "mysql+=0.35",
  );
  reveal(timeline, motion(story, "compat-mysql-entry"), { scaleX: 0.82, transformOrigin: "left" }, "mysql+=0.58", 0.3);
  timeline.fromTo(
    motion(story, "compat-mysql-frame"),
    { autoAlpha: 0, yPercent: 16 },
    { autoAlpha: 1, yPercent: 0, duration: 0.28, stagger: 0.07, ease: "none" },
    "mysql+=0.75",
  );

  timeline.addLabel("postgresql", 3.05);
  timeline.to(mysql, { autoAlpha: 0, yPercent: -5, duration: 0.2 }, "postgresql");
  reveal(timeline, postgres, { yPercent: 8 }, "postgresql+=0.22", 0.3);
  reveal(timeline, Array.from(story.querySelectorAll<HTMLElement>(".home-postgres-clients")), { yPercent: 18 }, "postgresql+=0.2", 0.3);
  reveal(timeline, motion(story, "compat-postgres-path"), { scaleY: 0.82, transformOrigin: "top" }, "postgresql+=0.44", 0.4);
  timeline.fromTo(
    motion(story, "compat-postgres-node"),
    { autoAlpha: 0, xPercent: 10 },
    { autoAlpha: 1, xPercent: 0, duration: 0.3, stagger: 0.06, ease: "none" },
    "postgresql+=0.72",
  );
  timeline.addLabel("compatibility-result", 4.5);
  timeline.to(motion(story, "kernel-pulse"), { scale: 1.16, duration: 0.34, yoyo: true, repeat: 1, ease: "none" }, "compatibility-result");
}

function buildMigration(timeline: GSAPTimeline, story: HTMLElement) {
  const labels = ["inventory", "map", "test", "gaps", "rehearse", "decide"] as const;
  const steps = motion(story, "migration-step");
  const receipts = motion(story, "migration-evidence");
  const bundle = motion(story, "migration-bundle");
  timeline.fromTo(motion(story, "migration-track"), { scaleX: 0 }, { scaleX: 1, transformOrigin: "left", duration: 4.8, ease: "none" }, 0);
  labels.forEach((label, index) => {
    const at = index * 0.86;
    timeline.addLabel(label, at);
    reveal(timeline, steps[index] ? [steps[index]] : [], {}, at, 0.42);
    reveal(timeline, receipts[index] ? [receipts[index]] : [], { xPercent: -8 }, at + 0.3, 0.3);
    if (bundle.length && index > 0) {
      timeline.to(bundle, {
        x: () => {
          const figureWidth = story.querySelector<HTMLElement>(".home-migration-timeline")?.clientWidth ?? 700;
          const bundleWidth = bundle[0] instanceof HTMLElement ? bundle[0].offsetWidth : 180;
          return Math.max(0, figureWidth - bundleWidth - 64) * (index / (labels.length - 1));
        },
        duration: 0.48,
        ease: "none",
      }, at);
    }
  });
  timeline.addLabel("migration-result", 5.2);
  reveal(timeline, motion(story, "migration-decision"), { yPercent: 14 }, "migration-result", 0.5);
}

function buildAvailability(gsap: GsapApi, timeline: GSAPTimeline, story: HTMLElement) {
  const primary = Array.from(story.querySelectorAll<HTMLElement>(".home-availability-primary"));
  const steps = motion(story, "availability-step");
  const vip = motion(story, "availability-vip");
  const hold = motion(story, "availability-hold");
  gsap.set(vip, { scaleX: 0.32, transformOrigin: "left" });
  timeline.addLabel("serving", 0);
  reveal(timeline, primary, { scale: 0.94 }, "serving", 0.4);
  reveal(timeline, steps[0] ? [steps[0]] : [], {}, "serving+=0.12", 0.34);
  timeline.addLabel("fault", 0.9);
  reveal(timeline, motion(story, "availability-signal"), { scale: 0.7 }, "fault", 0.24);
  reveal(timeline, steps[1] ? [steps[1]] : [], {}, "fault+=0.12", 0.34);
  timeline.to(primary, { scale: 0.985, duration: 0.34 }, "fault");
  timeline.addLabel("authority", 1.65);
  reveal(timeline, motion(story, "availability-gate"), { yPercent: 16, scale: 0.94 }, "authority", 0.45);
  reveal(timeline, steps[2] ? [steps[2]] : [], {}, "authority+=0.12", 0.34);
  timeline.addLabel("hold", 2.35);
  reveal(timeline, hold, { yPercent: 16, scale: 0.94 }, "hold", 0.45);
  timeline.addLabel("fence", 3.05);
  reveal(timeline, motion(story, "availability-fence"), { xPercent: -10 }, "fence", 0.4);
  reveal(timeline, steps[3] ? [steps[3]] : [], {}, "fence+=0.12", 0.34);
  timeline.addLabel("promote", 3.8);
  reveal(timeline, motion(story, "availability-replica"), { yPercent: 16, scale: 0.94 }, "promote", 0.45);
  timeline.to(hold, { autoAlpha: 0, yPercent: -8, scale: 0.985, duration: 0.35, ease: "none" }, "promote");
  timeline.addLabel("vip", 4.45);
  timeline.to(vip, { scaleX: 1, duration: 0.55, ease: "none" }, "vip");
  reveal(timeline, steps[4] ? [steps[4]] : [], {}, "vip+=0.08", 0.34);
  timeline.addLabel("availability-result", 5.1);
  reveal(timeline, Array.from(story.querySelectorAll<HTMLElement>(".home-availability-result")), { xPercent: 8 }, "availability-result", 0.5);
}

function buildRouting(timeline: GSAPTimeline, story: HTMLElement) {
  const labels = ["read", "write", "classify", "redirect", "return", "context"] as const;
  const steps = motion(story, "routing-step");
  const targetCards = Array.from(story.querySelectorAll<HTMLElement>(".home-routing-targets article"));
  labels.forEach((label, index) => {
    const at = index * 0.82;
    timeline.addLabel(label, at);
    reveal(timeline, steps[index] ? [steps[index]] : [], {}, at, 0.34);
  });
  reveal(timeline, Array.from(story.querySelectorAll<HTMLElement>(".home-routing-connection")), { xPercent: -10 }, "read", 0.42);
  reveal(timeline, motion(story, "routing-token"), { scale: 0.78 }, "write", 0.32);
  reveal(timeline, Array.from(story.querySelectorAll<HTMLElement>(".home-routing-classifier")), { yPercent: 12 }, "classify", 0.42);
  reveal(timeline, targetCards[0] ? [targetCards[0]] : [], { xPercent: 10 }, "read+=0.28", 0.42);
  const revealConnector = (token: string, at: string, transformOrigin: "left" | "right") => {
    const paths = motion(story, token);
    const segments = paths.flatMap((path) => Array.from(path.querySelectorAll<HTMLElement>("[data-connector-segment]")));
    reveal(timeline, paths, {}, at, 0.12);
    reveal(timeline, segments, { scaleX: 0, transformOrigin }, at, 0.62);
  };
  revealConnector("routing-read-path", "read+=0.08", "left");
  if (targetCards[0]) {
    timeline.to(targetCards[0], { autoAlpha: 0, xPercent: 4, duration: 0.24 }, "redirect");
  }
  reveal(timeline, targetCards[1] ? [targetCards[1]] : [], { xPercent: 10 }, "redirect", 0.42);
  revealConnector("routing-write-path", "redirect+=0.12", "left");
  revealConnector("routing-return-path", "return", "right");
  timeline.addLabel("routing-result", 4.92);
  reveal(timeline, Array.from(story.querySelectorAll<HTMLElement>(".home-routing-result")), { yPercent: 12 }, "routing-result", 0.48);
}

function buildSharding(timeline: GSAPTimeline, story: HTMLElement) {
  timeline.addLabel("predicate", 0);
  reveal(timeline, motion(story, "sharding-query"), { yPercent: -12 }, "predicate", 0.42);
  const steps = motion(story, "sharding-step");
  reveal(timeline, steps[0] ? [steps[0]] : [], {}, "predicate+=0.08", 0.34);
  timeline.addLabel("map", 0.9);
  reveal(timeline, motion(story, "sharding-worker"), { scale: 0.9 }, "map", 0.5);
  reveal(timeline, steps[1] ? [steps[1]] : [], {}, "map+=0.08", 0.34);
  timeline.addLabel("prune", 1.8);
  const pruned = motion(story, "sharding-pruned");
  if (pruned.length) timeline.to(pruned, { scale: 0.94, duration: 0.6, ease: "none" }, "prune");
  reveal(timeline, steps[2] ? [steps[2]] : [], {}, "prune+=0.08", 0.34);
  timeline.addLabel("route", 2.75);
  const route = motion(story, "sharding-route");
  const routeTrunk = Array.from(story.querySelectorAll<HTMLElement>(".home-sharding-route__trunk"));
  const routeDrop = Array.from(story.querySelectorAll<HTMLElement>(".home-sharding-route__drop"));
  reveal(timeline, route, {}, "route", 0.12);
  reveal(timeline, routeTrunk, { scaleX: 0, transformOrigin: "left" }, "route", 0.62);
  reveal(timeline, routeDrop, { scaleY: 0, transformOrigin: "top" }, "route+=0.48", 0.34);
  reveal(timeline, steps[3] ? [steps[3]] : [], {}, "route+=0.08", 0.34);
  const target = motion(story, "sharding-target");
  if (target.length) timeline.to(target, { scale: 1.06, duration: 0.3, yoyo: true, repeat: 1, ease: "none" }, "route+=0.34");
  timeline.addLabel("sharding-result", 3.75);
  reveal(timeline, motion(story, "sharding-result"), { yPercent: 12 }, "sharding-result", 0.5);
  reveal(timeline, steps[4] ? [steps[4]] : [], {}, "sharding-result+=0.08", 0.34);
}

function buildStory(gsap: GsapApi, ScrollTrigger: ScrollTriggerApi, id: StoryId, story: HTMLElement) {
  const stage = story.querySelector<HTMLElement>("[data-story-stage]");
  if (!stage) return null;
  story.dataset.active = "false";
  const timeline = gsap.timeline({ defaults: { ease: "none" } });
  if (id === "compatibility") buildCompatibility(gsap, timeline, story);
  if (id === "migration") buildMigration(timeline, story);
  if (id === "availability") buildAvailability(gsap, timeline, story);
  if (id === "routing") buildRouting(timeline, story);
  if (id === "sharding") buildSharding(timeline, story);
  timeline.to({}, { duration: FINAL_STATE_HOLD, ease: "none" });
  const frames = storyFrames(id, timeline);
  const syncNearestFrameMetadata = (progress: number, start: number, end: number) => {
    if (story.dataset.storyTransitioning === "true") return;
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    frames.forEach((frame, index) => {
      const distance = Math.abs(frame.progress - progress);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });
    const frame = frames[nearestIndex];
    if (!frame) return;
    const maximumScrollY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const stopY = start + ((end - start) * frame.progress);
    story.dataset.storyFrameIndex = String(nearestIndex);
    story.dataset.storyFrameId = frame.id;
    story.dataset.storyFrameProgress = frame.progress.toFixed(6);
    story.dataset.storyStopY = String(Math.round(Math.max(0, Math.min(maximumScrollY, stopY))));
  };
  const progressItems = Array.from(story.querySelectorAll<HTMLElement>(".home-story-progress li"));
  const chapterControls = Array.from(story.querySelectorAll<HTMLButtonElement>("[data-story-jump]"));
  const stepItems = Array.from(story.querySelectorAll<HTMLElement>(
    ".home-migration-steps li, .home-availability-steps li, .home-routing-steps li, .home-sharding-steps li",
  ));
  const stepDetails = Array.from(story.querySelectorAll<HTMLElement>("[data-story-step-detail]"));
  const progressTrack = story.querySelector<HTMLElement>('[data-motion~="progress"]');
  const setProgress = progressTrack ? gsap.quickSetter(progressTrack, "scaleX") : undefined;
  let currentChapter = -1;
  const updateChapterState = (progress = 0) => {
    const labels = PROGRESS_LABELS[id];
    const time = progress * timeline.duration();
    let activeIndex = 0;
    labels.forEach((label, index) => {
      if ((timeline.labels[label] ?? Number.POSITIVE_INFINITY) <= time + 0.02) activeIndex = index;
    });
    if (activeIndex === currentChapter) return;
    currentChapter = activeIndex;
    progressItems.forEach((item, index) => {
      if (index === activeIndex) item.setAttribute("data-current", "true");
      else item.removeAttribute("data-current");
    });
    stepItems.forEach((item, index) => {
      if (index === activeIndex) item.setAttribute("data-current", "true");
      else item.removeAttribute("data-current");
    });
    stepDetails.forEach((item, index) => {
      if (index === activeIndex) item.setAttribute("data-current", "true");
      else item.removeAttribute("data-current");
    });
    chapterControls.forEach((control) => {
      control.setAttribute("aria-pressed", String(control.dataset.storyJump === labels[activeIndex]));
    });
  };
  const trigger = ScrollTrigger.create({
    animation: timeline,
    trigger: story,
    pin: stage,
    start: "top top",
    end: () => `+=${Math.round(window.innerHeight * SCROLL_LENGTH[id])}`,
    scrub: true,
    anticipatePin: 1,
    invalidateOnRefresh: true,
    onToggle: (self) => { story.dataset.active = self.isActive ? "true" : "false"; },
    onUpdate: (self) => {
      setProgress?.(self.progress);
      updateChapterState(self.progress);
      syncNearestFrameMetadata(self.progress, self.start, self.end);
    },
  });
  updateChapterState(0);
  story.dataset.storyFrameIndex = "0";
  story.dataset.storyFrameId = frames[0]?.id ?? "";
  story.dataset.storyFrameProgress = String(frames[0]?.progress ?? 0);
  story.dataset.storyTransitioning = "false";
  return { id, story, timeline, trigger, frames } satisfies StoryMotion;
}

export function HomeStoryMotionClient() {
  useEffect(() => {
    const root = document.documentElement;
    const desktop = window.matchMedia("(min-width: 1180px) and (min-height: 864px) and (pointer: fine)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const slowUpdate = window.matchMedia("(update: slow)");
    const clientNavigator = navigator as ConnectionNavigator;
    const connection = clientNavigator.connection;
    let disposed = false;
    let generation = 0;
    let stop: (() => void) | undefined;

    const constrainedDevice = (
      (clientNavigator.hardwareConcurrency > 0 && clientNavigator.hardwareConcurrency <= 2)
      || (clientNavigator.deviceMemory !== undefined && clientNavigator.deviceMemory <= 2)
    );
    const eligible = () => (
      desktop.matches
      && !reduced.matches
      && !slowUpdate.matches
      && !constrainedDevice
      && connection?.saveData !== true
    );
    const configure = async () => {
      const run = ++generation;
      stop?.();
      stop = undefined;
      root.classList.remove("story-scroll-ready");
      if (!eligible()) return;
      const stories = STORY_IDS.map((id) => root.querySelector<HTMLElement>(`[data-scroll-story="${id}"]`));
      if (stories.some((story) => !story?.querySelector("[data-story-stage]"))) return;
      try {
        await document.fonts.ready;
        await Promise.all(Array.from(document.images).map(async (image) => {
          if (typeof image.decode !== "function") return;
          try { await image.decode(); } catch { /* optional images must not block the readable fallback */ }
        }));
        const [{ gsap }, { ScrollTrigger }] = await Promise.all([import("gsap"), import("gsap/ScrollTrigger")]);
        if (disposed || run !== generation || !eligible()) return;
        gsap.registerPlugin(ScrollTrigger);
        const actionCleanups: Array<() => void> = [];
        const motionStories: StoryMotion[] = [];
        const triggerBaseline = new Set(ScrollTrigger.getAll());
        const contextRef: { current?: ReturnType<typeof gsap.context> } = {};
        const clearStoryRuntimeState = () => {
          stories.forEach((story) => {
            story?.removeAttribute("data-active");
            story?.removeAttribute("data-story-frame-index");
            story?.removeAttribute("data-story-frame-id");
            story?.removeAttribute("data-story-frame-progress");
            story?.removeAttribute("data-story-stop-y");
            story?.removeAttribute("data-story-transitioning");
          });
          delete root.dataset.storyBoundaryTransition;
          delete root.dataset.storyBoundaryMode;
          delete root.dataset.storyBoundaryDirection;
          delete root.dataset.storyBoundarySerial;
          root.classList.remove("story-scroll-ready");
        };
        const emergencyCleanup = () => {
          actionCleanups.splice(0).reverse().forEach((cleanup) => cleanup());
          contextRef.current?.revert();
          ScrollTrigger.getAll().forEach((trigger) => {
            if (!triggerBaseline.has(trigger)) trigger.kill();
          });
          clearStoryRuntimeState();
          window.dispatchEvent(new Event("halo:scroll-layout"));
        };
        stop = emergencyCleanup;
        root.classList.add("story-scroll-ready");
        root.dataset.storyBoundaryTransition = "idle";
        const boundaryCurtain = document.createElement("div");
        boundaryCurtain.className = "home-story-boundary-curtain";
        boundaryCurtain.setAttribute("aria-hidden", "true");
        document.body.append(boundaryCurtain);
        actionCleanups.push(() => boundaryCurtain.remove());
        contextRef.current = gsap.context(() => {
          STORY_IDS.forEach((id, index) => {
            const story = stories[index];
            if (!story) return;
            const motionStory = buildStory(gsap, ScrollTrigger, id, story);
            if (!motionStory) return;
            motionStories.push(motionStory);
          });
        }, root);
        ScrollTrigger.refresh();

        const maximumScrollY = () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        const frameY = (motionStory: StoryMotion, frameIndex: number) => {
          const frame = motionStory.frames[frameIndex];
          if (!frame) return Math.round(window.scrollY);
          const y = motionStory.trigger.start
            + ((motionStory.trigger.end - motionStory.trigger.start) * frame.progress);
          return Math.round(Math.max(0, Math.min(maximumScrollY(), y)));
        };
        const setFrameMetadata = (motionStory: StoryMotion, frameIndex: number) => {
          const safeIndex = Math.max(0, Math.min(motionStory.frames.length - 1, frameIndex));
          const frame = motionStory.frames[safeIndex];
          if (!frame) return;
          motionStory.story.dataset.storyFrameIndex = String(safeIndex);
          motionStory.story.dataset.storyFrameId = frame.id;
          motionStory.story.dataset.storyFrameProgress = frame.progress.toFixed(6);
          motionStory.story.dataset.storyStopY = String(frameY(motionStory, safeIndex));
        };
        const nearestFrameIndex = (motionStory: StoryMotion) => {
          let nearestIndex = 0;
          let nearestDistance = Number.POSITIVE_INFINITY;
          motionStory.frames.forEach((frame, index) => {
            const distance = Math.abs(frame.progress - motionStory.trigger.progress);
            if (distance < nearestDistance) {
              nearestDistance = distance;
              nearestIndex = index;
            }
          });
          return nearestIndex;
        };
        motionStories.forEach((motionStory) => setFrameMetadata(motionStory, nearestFrameIndex(motionStory)));
        const consumeReloadFrame = (): StoredStoryFrame | undefined => {
          try {
            const raw = window.sessionStorage.getItem(STORY_FRAME_RESTORE_KEY);
            window.sessionStorage.removeItem(STORY_FRAME_RESTORE_KEY);
            const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
            if (!raw || navigation?.type !== "reload") return undefined;
            const parsed = JSON.parse(raw) as Partial<StoredStoryFrame>;
            if (parsed.path !== `${window.location.pathname}${window.location.search}`
              || !STORY_IDS.includes(parsed.storyId as StoryId)
              || !Number.isInteger(parsed.frameIndex)) return undefined;
            return parsed as StoredStoryFrame;
          } catch {
            return undefined;
          }
        };
        const reloadFrame = consumeReloadFrame();
        let reloadRestoreFrame = 0;
        if (reloadFrame) {
          const restoredStory = motionStories.find(({ id }) => id === reloadFrame.storyId);
          if (restoredStory?.frames[reloadFrame.frameIndex]) {
            const restoreReloadFrame = () => {
              if (disposed || run !== generation) return;
              ScrollTrigger.refresh();
              setFrameMetadata(restoredStory, reloadFrame.frameIndex);
              window.scrollTo(0, frameY(restoredStory, reloadFrame.frameIndex));
              ScrollTrigger.update();
              setFrameMetadata(restoredStory, reloadFrame.frameIndex);
            };
            restoreReloadFrame();
            reloadRestoreFrame = window.requestAnimationFrame(() => {
              reloadRestoreFrame = window.requestAnimationFrame(() => {
                reloadRestoreFrame = 0;
                restoreReloadFrame();
              });
            });
            actionCleanups.push(() => window.cancelAnimationFrame(reloadRestoreFrame));
          }
        }

        let scrollTween: GSAPTween | undefined;
        let transitionSerial = 0;
        let transitionActive = false;
        let transitionKind: "frame" | "boundary" | undefined;
        let activeDestination: { motionStory: StoryMotion; frameIndex: number } | undefined;
        let activeBoundaryTarget: (() => number) | undefined;
        let activeTransitionStories: readonly StoryMotion[] = [];
        let activeViewTransition: ViewTransition | undefined;
        let boundaryInputLocked = false;
        let boundaryLastWheelAt = 0;
        let boundaryFinishedAt = 0;
        let boundaryReleaseTimer = 0;
        let activeBoundaryState: {
          serial: number;
          from: { motionStory: StoryMotion; frameIndex: number };
          destination: { motionStory: StoryMotion; frameIndex: number };
          detail: StoryBoundaryDetail;
          snapped: boolean;
          animations: Animation[];
        } | undefined;
        let gestureCommitted = false;
        let gestureQuiet = true;
        let gestureQuietTimer = 0;
        let wheelAccumulator = 0;
        let wheelDirection = 0;
        let queuedGestureActive = false;
        let queuedWheelAccumulator = 0;
        let queuedWheelDirection = 0;
        let queuedStepDirection = 0;
        let queuedStepFrame = 0;
        let internalScrollElement: HTMLElement | null = null;
        let internalScrollTimer = 0;

        const markBoundaryIdle = () => {
          root.dataset.storyBoundaryTransition = "idle";
          delete root.dataset.storyBoundaryMode;
          delete root.dataset.storyBoundaryDirection;
          delete root.dataset.storyBoundarySerial;
        };
        const clearTransitionMarkers = () => {
          motionStories.forEach(({ story }) => { story.dataset.storyTransitioning = "false"; });
        };
        const resetQueuedGesture = () => {
          window.cancelAnimationFrame(queuedStepFrame);
          queuedStepFrame = 0;
          queuedGestureActive = false;
          queuedWheelAccumulator = 0;
          queuedWheelDirection = 0;
          queuedStepDirection = 0;
        };
        const resetQueuedAccumulator = () => {
          queuedGestureActive = false;
          queuedWheelAccumulator = 0;
          queuedWheelDirection = 0;
        };
        const maybeReleaseGesture = () => {
          if (!gestureQuiet || transitionActive || boundaryInputLocked || queuedStepDirection || queuedStepFrame) return;
          gestureCommitted = false;
          wheelAccumulator = 0;
          wheelDirection = 0;
        };
        const scheduleBoundaryRelease = () => {
          window.clearTimeout(boundaryReleaseTimer);
          boundaryReleaseTimer = 0;
          if (!boundaryInputLocked || !boundaryFinishedAt) return;
          const now = performance.now();
          const quietRemaining = Math.max(0, (boundaryLastWheelAt + WHEEL_GESTURE_QUIET_MS) - now);
          const settleRemaining = Math.max(0, (boundaryFinishedAt + STORY_BOUNDARY_SETTLE_MS) - now);
          const remaining = Math.ceil(Math.max(quietRemaining, settleRemaining));
          if (remaining > 0) {
            boundaryReleaseTimer = window.setTimeout(scheduleBoundaryRelease, remaining);
            return;
          }
          boundaryInputLocked = false;
          boundaryLastWheelAt = 0;
          boundaryFinishedAt = 0;
          window.clearTimeout(gestureQuietTimer);
          gestureQuietTimer = 0;
          gestureQuiet = true;
          maybeReleaseGesture();
        };
        const noteBoundaryWheel = () => {
          boundaryLastWheelAt = performance.now();
          if (boundaryFinishedAt) scheduleBoundaryRelease();
        };
        const scheduleGestureQuiet = () => {
          gestureQuiet = false;
          window.clearTimeout(gestureQuietTimer);
          gestureQuietTimer = window.setTimeout(() => {
            gestureQuietTimer = 0;
            gestureQuiet = true;
            if (queuedGestureActive && !queuedStepDirection) resetQueuedAccumulator();
            maybeReleaseGesture();
          }, WHEEL_GESTURE_QUIET_MS);
        };
        const resetGesture = () => {
          window.clearTimeout(gestureQuietTimer);
          gestureQuietTimer = 0;
          window.clearTimeout(boundaryReleaseTimer);
          boundaryReleaseTimer = 0;
          gestureQuiet = true;
          gestureCommitted = false;
          boundaryInputLocked = false;
          boundaryLastWheelAt = 0;
          boundaryFinishedAt = 0;
          wheelAccumulator = 0;
          wheelDirection = 0;
          resetQueuedGesture();
        };
        const clearInternalScrollGesture = () => {
          window.clearTimeout(internalScrollTimer);
          internalScrollTimer = 0;
          internalScrollElement = null;
        };
        const holdInternalScrollGesture = (element: HTMLElement) => {
          internalScrollElement = element;
          window.clearTimeout(internalScrollTimer);
          internalScrollTimer = window.setTimeout(() => {
            internalScrollTimer = 0;
            internalScrollElement = null;
          }, WHEEL_GESTURE_QUIET_MS);
        };
        const animateScrollTo = (
          targetY: number,
          destination?: { motionStory: StoryMotion; frameIndex: number },
          transitionStories: readonly StoryMotion[] = destination ? [destination.motionStory] : [],
          boundaryTarget?: () => number,
        ) => {
          const serial = ++transitionSerial;
          scrollTween?.kill();
          const clampedTarget = Math.round(Math.max(0, Math.min(maximumScrollY(), targetY)));
          const scrollState = { y: window.scrollY };
          const distance = Math.abs(clampedTarget - scrollState.y);
          transitionActive = true;
          transitionKind = "frame";
          activeDestination = destination;
          activeBoundaryTarget = destination ? undefined : boundaryTarget;
          activeTransitionStories = transitionStories;
          clearTransitionMarkers();
          transitionStories.forEach(({ story }) => { story.dataset.storyTransitioning = "true"; });
          const finish = () => {
            if (serial !== transitionSerial) return;
            const finalTarget = destination
              ? frameY(destination.motionStory, destination.frameIndex)
              : Math.round(Math.max(0, Math.min(maximumScrollY(), boundaryTarget?.() ?? targetY)));
            window.scrollTo(0, finalTarget);
            ScrollTrigger.update();
            if (destination) setFrameMetadata(destination.motionStory, destination.frameIndex);
            scrollTween = undefined;
            transitionActive = false;
            transitionKind = undefined;
            activeDestination = undefined;
            activeBoundaryTarget = undefined;
            activeTransitionStories = [];
            clearTransitionMarkers();
            if (queuedStepDirection) scheduleQueuedStep(queuedStepDirection);
            else maybeReleaseGesture();
          };
          if (distance <= 1) {
            finish();
            return;
          }
          scrollTween = gsap.to(scrollState, {
            y: clampedTarget,
            duration: Math.min(0.76, Math.max(0.44, distance / 1800)),
            ease: "power2.inOut",
            overwrite: true,
            onUpdate: () => window.scrollTo(0, scrollState.y),
            onComplete: finish,
          });
        };
        const goToFrame = (
          motionIndex: number,
          frameIndex: number,
          transitionStories: readonly StoryMotion[] = [motionStories[motionIndex]],
        ) => {
          const motionStory = motionStories[motionIndex];
          if (!motionStory || !motionStory.frames[frameIndex]) return;
          animateScrollTo(
            frameY(motionStory, frameIndex),
            { motionStory, frameIndex },
            transitionStories.filter(Boolean),
          );
        };
        const dispatchBoundaryEvent = (
          type: "halo:story-boundary-start" | "halo:story-boundary-snap" | "halo:story-boundary-end",
          detail: StoryBoundaryDetail,
        ) => {
          window.dispatchEvent(new CustomEvent(type, { detail: { ...detail } }));
        };
        const snapStoryBoundary = (state: NonNullable<typeof activeBoundaryState>) => {
          if (state.serial !== transitionSerial || state.snapped) return;
          const targetY = frameY(state.destination.motionStory, state.destination.frameIndex);
          state.detail.toY = targetY;
          window.scrollTo(0, targetY);
          ScrollTrigger.update();
          setFrameMetadata(state.destination.motionStory, state.destination.frameIndex);
          state.snapped = true;
          dispatchBoundaryEvent("halo:story-boundary-snap", state.detail);
        };
        const resetBoundaryVisuals = (state?: NonNullable<typeof activeBoundaryState>) => {
          state?.animations.forEach((animation) => animation.cancel());
          if (state) state.animations = [];
          boundaryCurtain.getAnimations().forEach((animation) => animation.cancel());
          boundaryCurtain.style.removeProperty("background-color");
          boundaryCurtain.style.removeProperty("visibility");
          boundaryCurtain.style.removeProperty("opacity");
        };
        const completeStoryBoundary = (state: NonNullable<typeof activeBoundaryState>) => {
          if (state.serial !== transitionSerial) return;
          if (!state.snapped) snapStoryBoundary(state);
          resetBoundaryVisuals(state);
          activeViewTransition = undefined;
          activeBoundaryState = undefined;
          transitionActive = false;
          transitionKind = undefined;
          activeDestination = undefined;
          activeBoundaryTarget = undefined;
          activeTransitionStories = [];
          clearTransitionMarkers();
          markBoundaryIdle();
          dispatchBoundaryEvent("halo:story-boundary-end", state.detail);
          boundaryFinishedAt = performance.now();
          scheduleBoundaryRelease();
        };
        const cancelStoryBoundary = (settle = true) => {
          const state = activeBoundaryState;
          if (!state) return;
          activeViewTransition?.skipTransition();
          if (settle && !state.snapped) snapStoryBoundary(state);
          resetBoundaryVisuals(state);
          transitionSerial += 1;
          activeViewTransition = undefined;
          activeBoundaryState = undefined;
          transitionActive = false;
          transitionKind = undefined;
          activeDestination = undefined;
          activeBoundaryTarget = undefined;
          activeTransitionStories = [];
          clearTransitionMarkers();
          markBoundaryIdle();
          dispatchBoundaryEvent("halo:story-boundary-end", state.detail);
          resetGesture();
        };
        const runFallbackBoundary = async (state: NonNullable<typeof activeBoundaryState>) => {
          const direction = state.detail.direction === "forward" ? 1 : -1;
          const outgoing = state.from.motionStory.story.querySelector<HTMLElement>(".home-story-stage__inner");
          const incoming = state.destination.motionStory.story.querySelector<HTMLElement>(".home-story-stage__inner");
          const destinationColor = getComputedStyle(state.destination.motionStory.story).backgroundColor;
          boundaryCurtain.style.backgroundColor = destinationColor;
          boundaryCurtain.style.visibility = "visible";
          const outgoingAnimation = outgoing?.animate([
            { opacity: 1, transform: "translateY(0)" },
            { opacity: 0.82, transform: `translateY(${-24 * direction}px)` },
          ], {
            duration: STORY_BOUNDARY_FALLBACK_COVER_MS,
            easing: "cubic-bezier(0.4, 0, 1, 1)",
            fill: "forwards",
          });
          const coverAnimation = boundaryCurtain.animate([
            { opacity: 0 },
            { opacity: 1 },
          ], {
            duration: STORY_BOUNDARY_FALLBACK_COVER_MS,
            easing: "cubic-bezier(0.4, 0, 1, 1)",
            fill: "forwards",
          });
          if (outgoingAnimation) state.animations.push(outgoingAnimation);
          state.animations.push(coverAnimation);
          try {
            await coverAnimation.finished;
          } catch {
            return;
          }
          if (state.serial !== transitionSerial) return;
          snapStoryBoundary(state);
          outgoingAnimation?.cancel();
          const incomingAnimation = incoming?.animate([
            { opacity: 0.78, transform: `translateY(${24 * direction}px)` },
            { opacity: 1, transform: "translateY(0)" },
          ], {
            duration: STORY_BOUNDARY_FALLBACK_REVEAL_MS,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
            fill: "forwards",
          });
          const revealAnimation = boundaryCurtain.animate([
            { opacity: 1 },
            { opacity: 0 },
          ], {
            duration: STORY_BOUNDARY_FALLBACK_REVEAL_MS,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
            fill: "forwards",
          });
          if (incomingAnimation) state.animations.push(incomingAnimation);
          state.animations.push(revealAnimation);
          try {
            await Promise.all([revealAnimation.finished, incomingAnimation?.finished]);
          } catch {
            return;
          }
          completeStoryBoundary(state);
        };
        const transitionStoryBoundary = (
          fromIndex: number,
          destinationIndex: number,
          destinationFrameIndex: number,
          direction: StoryBoundaryDirection,
        ) => {
          const fromStory = motionStories[fromIndex];
          const destinationStory = motionStories[destinationIndex];
          if (!fromStory || !destinationStory || !destinationStory.frames[destinationFrameIndex]) return;
          scrollTween?.kill();
          scrollTween = undefined;
          resetQueuedGesture();
          const serial = ++transitionSerial;
          const mode: StoryBoundaryMode = typeof document.startViewTransition === "function"
            ? "view-transition"
            : "fallback";
          const fromFrameIndex = direction === "forward" ? fromStory.frames.length - 1 : 0;
          const detail: StoryBoundaryDetail = {
            serial,
            from: fromStory.id,
            to: destinationStory.id,
            direction,
            mode,
            fromY: Number(window.scrollY.toFixed(2)),
            toY: frameY(destinationStory, destinationFrameIndex),
          };
          const state: NonNullable<typeof activeBoundaryState> = {
            serial,
            from: { motionStory: fromStory, frameIndex: fromFrameIndex },
            destination: { motionStory: destinationStory, frameIndex: destinationFrameIndex },
            detail,
            snapped: false,
            animations: [],
          };
          activeBoundaryState = state;
          transitionActive = true;
          transitionKind = "boundary";
          activeDestination = state.destination;
          activeBoundaryTarget = undefined;
          activeTransitionStories = [fromStory, destinationStory];
          clearTransitionMarkers();
          activeTransitionStories.forEach(({ story }) => { story.dataset.storyTransitioning = "true"; });
          gestureCommitted = true;
          boundaryInputLocked = true;
          boundaryLastWheelAt = performance.now();
          boundaryFinishedAt = 0;
          window.clearTimeout(boundaryReleaseTimer);
          boundaryReleaseTimer = 0;
          root.dataset.storyBoundaryTransition = "active";
          root.dataset.storyBoundaryMode = mode;
          root.dataset.storyBoundaryDirection = direction;
          root.dataset.storyBoundarySerial = String(serial);
          dispatchBoundaryEvent("halo:story-boundary-start", detail);

          if (mode === "view-transition") {
            try {
              activeViewTransition = document.startViewTransition(() => {
                if (state.serial !== transitionSerial) return;
                snapStoryBoundary(state);
              });
              void activeViewTransition.finished
                .then(() => completeStoryBoundary(state))
                .catch(() => {
                  if (state.serial !== transitionSerial) return;
                  if (!state.snapped) {
                    state.detail.mode = "fallback";
                    root.dataset.storyBoundaryMode = "fallback";
                    void runFallbackBoundary(state);
                  } else {
                    completeStoryBoundary(state);
                  }
                });
              return;
            } catch {
              state.detail.mode = "fallback";
              root.dataset.storyBoundaryMode = "fallback";
            }
          }
          void runFallbackBoundary(state);
        };
        const commitStep = (motionIndex: number, direction: number, entering = false) => {
          const motionStory = motionStories[motionIndex];
          if (!motionStory) return;
          if (entering) {
            goToFrame(motionIndex, direction > 0 ? 0 : motionStory.frames.length - 1);
            return;
          }
          const range = Math.max(1, motionStory.trigger.end - motionStory.trigger.start);
          const progress = Math.max(0, Math.min(1, (window.scrollY - motionStory.trigger.start) / range));
          if (direction > 0) {
            const nextFrameIndex = motionStory.frames.findIndex(
              (frame) => frame.progress > progress + FRAME_PROGRESS_EPSILON,
            );
            if (nextFrameIndex >= 0) {
              goToFrame(motionIndex, nextFrameIndex);
              return;
            }
            const nextStory = motionStories[motionIndex + 1];
            if (nextStory) {
              transitionStoryBoundary(motionIndex, motionIndex + 1, 0, "forward");
              return;
            }
            const boundaryTarget = () => (
              motionStory.trigger.end + Math.min(window.innerHeight * 0.66, 560)
            );
            animateScrollTo(
              boundaryTarget(),
              undefined,
              [motionStory],
              boundaryTarget,
            );
            return;
          }
          let previousFrameIndex = -1;
          motionStory.frames.forEach((frame, index) => {
            if (frame.progress < progress - FRAME_PROGRESS_EPSILON) previousFrameIndex = index;
          });
          if (previousFrameIndex >= 0) {
            goToFrame(motionIndex, previousFrameIndex);
            return;
          }
          const previousStory = motionStories[motionIndex - 1];
          if (previousStory) {
            transitionStoryBoundary(
              motionIndex,
              motionIndex - 1,
              previousStory.frames.length - 1,
              "backward",
            );
            return;
          }
          const boundaryTarget = () => (
            motionStory.trigger.start - Math.min(window.innerHeight * 0.66, 560)
          );
          animateScrollTo(
            boundaryTarget(),
            undefined,
            [motionStory],
            boundaryTarget,
          );
        };
        const wheelContext = (deltaY: number) => {
          const y = window.scrollY;
          const activeIndex = motionStories.findIndex(({ trigger }) => (
            trigger.isActive || (y >= trigger.start - 1 && y <= trigger.end + 1)
          ));
          if (activeIndex >= 0) return { motionIndex: activeIndex, entering: false };
          if (deltaY > 0) {
            const motionIndex = motionStories.findIndex(({ trigger }) => (
              y < trigger.start && y + deltaY >= trigger.start - 1
            ));
            return motionIndex >= 0 ? { motionIndex, entering: true } : null;
          }
          for (let motionIndex = motionStories.length - 1; motionIndex >= 0; motionIndex -= 1) {
            const { trigger } = motionStories[motionIndex];
            if (y > trigger.end && y + deltaY <= trigger.end + 1) return { motionIndex, entering: true };
          }
          return null;
        };
        function scheduleQueuedStep(direction: number) {
          window.cancelAnimationFrame(queuedStepFrame);
          queuedStepDirection = 0;
          resetQueuedAccumulator();
          gestureCommitted = true;
          queuedStepFrame = window.requestAnimationFrame(() => {
            queuedStepFrame = 0;
            if (disposed || run !== generation || transitionActive) return;
            const contextForWheel = wheelContext(direction);
            if (!contextForWheel) {
              maybeReleaseGesture();
              return;
            }
            commitStep(contextForWheel.motionIndex, direction, contextForWheel.entering);
          });
        }
        const accumulateQueuedWheel = (deltaY: number) => {
          if (queuedStepDirection || queuedStepFrame) return;
          const direction = Math.sign(deltaY);
          queuedGestureActive = true;
          if (direction !== queuedWheelDirection) {
            queuedWheelAccumulator = 0;
            queuedWheelDirection = direction;
          }
          queuedWheelAccumulator += deltaY;
          if (Math.abs(queuedWheelAccumulator) < WHEEL_STEP_THRESHOLD) return;
          queuedStepDirection = direction;
          queuedWheelAccumulator = 0;
          queuedWheelDirection = 0;
          if (!transitionActive) scheduleQueuedStep?.(queuedStepDirection);
        };
        const onWheel = (event: WheelEvent) => {
          if (event.ctrlKey || event.metaKey) return;
          const delta = normalizedWheelDelta(event);
          if (Math.abs(delta.x) > Math.abs(delta.y) || Math.abs(delta.y) < 0.5) return;
          const consume = () => { if (event.cancelable) event.preventDefault(); };
          if (boundaryInputLocked || transitionKind === "boundary") {
            consume();
            noteBoundaryWheel();
            return;
          }
          if (gestureCommitted || transitionActive) {
            consume();
            const beginsQueuedGesture = (
              transitionActive
              && gestureQuiet
              && !queuedGestureActive
              && !queuedStepDirection
              && !queuedStepFrame
            );
            if (beginsQueuedGesture) queuedGestureActive = true;
            gestureCommitted = true;
            scheduleGestureQuiet();
            if (queuedGestureActive) accumulateQueuedWheel(delta.y);
            return;
          }
          const contextForWheel = wheelContext(delta.y);
          if (!contextForWheel) return;
          const motionStory = motionStories[contextForWheel.motionIndex];
          const path = event.composedPath();
          if (internalScrollElement && path.includes(internalScrollElement)) {
            const canScroll = delta.y > 0
              ? internalScrollElement.scrollTop + internalScrollElement.clientHeight < internalScrollElement.scrollHeight - 1
              : internalScrollElement.scrollTop > 1;
            holdInternalScrollGesture(internalScrollElement);
            if (!canScroll) consume();
            return;
          }
          if (internalScrollElement) clearInternalScrollGesture();
          const nestedScroll = scrollableIntent(event, motionStory.story, delta.y);
          if (nestedScroll?.canScroll) {
            holdInternalScrollGesture(nestedScroll.element);
            return;
          }
          consume();
          scheduleGestureQuiet();
          const direction = Math.sign(delta.y);
          if (direction !== wheelDirection) {
            wheelAccumulator = 0;
            wheelDirection = direction;
          }
          wheelAccumulator += delta.y;
          if (Math.abs(wheelAccumulator) < WHEEL_STEP_THRESHOLD) return;
          gestureCommitted = true;
          wheelAccumulator = 0;
          commitStep(contextForWheel.motionIndex, direction, contextForWheel.entering);
        };
        window.addEventListener("wheel", onWheel, { passive: false, capture: true });
        actionCleanups.push(() => window.removeEventListener("wheel", onWheel, true));
        const persistReloadFrame = () => {
          try {
            const activeStory = motionStories.find(({ story }) => (
              story.dataset.active === "true" && story.dataset.storyTransitioning !== "true"
            ));
            const frameIndex = Number(activeStory?.story.dataset.storyFrameIndex);
            if (!activeStory || !Number.isInteger(frameIndex) || !activeStory.frames[frameIndex]) {
              window.sessionStorage.removeItem(STORY_FRAME_RESTORE_KEY);
              return;
            }
            const storedFrame: StoredStoryFrame = {
              path: `${window.location.pathname}${window.location.search}`,
              storyId: activeStory.id,
              frameIndex,
            };
            window.sessionStorage.setItem(STORY_FRAME_RESTORE_KEY, JSON.stringify(storedFrame));
          } catch {
            // Storage can be unavailable in locked-down browsing modes; native fallback remains readable.
          }
        };
        window.addEventListener("pagehide", persistReloadFrame, { capture: true });
        actionCleanups.push(() => window.removeEventListener("pagehide", persistReloadFrame, true));

        motionStories.forEach((motionStory, motionIndex) => {
          motionStory.story.querySelectorAll<HTMLElement>("[data-story-jump]").forEach((control) => {
            const click = () => {
              const label = control.dataset.storyJump;
              const frameIndex = motionStory.frames.findIndex((frame) => frame.id === label);
              if (frameIndex < 0) return;
              cancelStoryBoundary();
              resetGesture();
              clearInternalScrollGesture();
              goToFrame(motionIndex, frameIndex);
            };
            control.addEventListener("click", click);
            actionCleanups.push(() => control.removeEventListener("click", click));
          });
          motionStory.story.querySelectorAll<HTMLElement>("[data-story-replay]").forEach((control) => {
            const click = () => {
              cancelStoryBoundary();
              resetGesture();
              clearInternalScrollGesture();
              goToFrame(motionIndex, 0);
            };
            control.addEventListener("click", click);
            actionCleanups.push(() => control.removeEventListener("click", click));
          });
        });

        let refreshFrame = 0;
        actionCleanups.push(() => window.cancelAnimationFrame(refreshFrame));
        const requestRefresh = () => {
          if (disposed || run !== generation) return;
          if (transitionKind === "boundary") cancelStoryBoundary();
          resetQueuedGesture();
          maybeReleaseGesture();
          if (refreshFrame) return;
          refreshFrame = window.requestAnimationFrame(() => {
            refreshFrame = 0;
            if (disposed || run !== generation) return;
            const settledStory = motionStories.find(({ trigger, story }) => (
              trigger.isActive && story.dataset.storyTransitioning !== "true"
            ));
            const settledIndex = settledStory
              ? Number(settledStory.story.dataset.storyFrameIndex)
              : Number.NaN;
            const transitionDestination = transitionActive ? activeDestination : undefined;
            const transitionBoundaryTarget = transitionActive ? activeBoundaryTarget : undefined;
            const transitionStories = activeTransitionStories;
            ScrollTrigger.refresh();
            if (settledStory && Number.isInteger(settledIndex) && settledStory.frames[settledIndex]) {
              window.scrollTo(0, frameY(settledStory, settledIndex));
              ScrollTrigger.update();
            }
            motionStories.forEach((motionStory) => {
              const frameIndex = Number(motionStory.story.dataset.storyFrameIndex);
              setFrameMetadata(motionStory, Number.isInteger(frameIndex) ? frameIndex : 0);
            });
            if (transitionDestination) {
              animateScrollTo(
                frameY(transitionDestination.motionStory, transitionDestination.frameIndex),
                transitionDestination,
                transitionStories,
              );
            } else if (transitionBoundaryTarget) {
              animateScrollTo(
                transitionBoundaryTarget(),
                undefined,
                transitionStories,
                transitionBoundaryTarget,
              );
            }
            window.dispatchEvent(new Event("halo:scroll-layout"));
          });
        };
        const resizeObserver = new ResizeObserver(requestRefresh);
        stories.forEach((story) => {
          const inner = story?.querySelector<HTMLElement>(".home-story-stage__inner");
          if (inner) resizeObserver.observe(inner);
        });
        actionCleanups.push(() => resizeObserver.disconnect());
        const visualViewport = window.visualViewport;
        visualViewport?.addEventListener("resize", requestRefresh, { passive: true });
        actionCleanups.push(() => visualViewport?.removeEventListener("resize", requestRefresh));
        window.addEventListener("load", requestRefresh, { passive: true });
        actionCleanups.push(() => window.removeEventListener("load", requestRefresh));
        stop = () => {
          if (transitionKind === "boundary") cancelStoryBoundary();
          transitionSerial += 1;
          scrollTween?.kill();
          scrollTween = undefined;
          activeViewTransition?.skipTransition();
          activeViewTransition = undefined;
          transitionActive = false;
          transitionKind = undefined;
          activeDestination = undefined;
          activeBoundaryTarget = undefined;
          activeTransitionStories = [];
          resetGesture();
          clearInternalScrollGesture();
          actionCleanups.splice(0).reverse().forEach((cleanup) => cleanup());
          contextRef.current?.revert();
          clearStoryRuntimeState();
          window.dispatchEvent(new Event("halo:scroll-layout"));
        };
        window.dispatchEvent(new Event("halo:scroll-layout"));
      } catch {
        stop?.();
        stop = undefined;
        root.classList.remove("story-scroll-ready");
      }
    };

    const reconfigure = () => { void configure(); };
    desktop.addEventListener("change", reconfigure);
    reduced.addEventListener("change", reconfigure);
    slowUpdate.addEventListener("change", reconfigure);
    connection?.addEventListener("change", reconfigure);
    void configure();
    return () => {
      disposed = true;
      generation += 1;
      stop?.();
      root.classList.remove("story-scroll-ready");
      desktop.removeEventListener("change", reconfigure);
      reduced.removeEventListener("change", reconfigure);
      slowUpdate.removeEventListener("change", reconfigure);
      connection?.removeEventListener("change", reconfigure);
    };
  }, []);

  return null;
}
