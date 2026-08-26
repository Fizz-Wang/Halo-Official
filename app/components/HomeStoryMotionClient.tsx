"use client";

import { useEffect } from "react";

type GsapApi = typeof import("gsap")["gsap"];
type ScrollTriggerApi = typeof import("gsap/ScrollTrigger")["ScrollTrigger"];
type StoryId = "compatibility" | "migration" | "availability" | "routing" | "sharding";

interface ConnectionNavigator extends Navigator {
  connection?: EventTarget & { saveData?: boolean };
  deviceMemory?: number;
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

const PROGRESS_LABELS: Readonly<Record<StoryId, readonly string[]>> = {
  compatibility: ["oracle", "mysql", "postgresql"],
  migration: ["inventory", "map", "test", "gaps", "rehearse", "decide"],
  availability: ["serving", "fault", "authority", "fence", "vip"],
  routing: ["read", "write", "classify", "redirect", "return", "context"],
  sharding: ["predicate", "map", "prune", "route", "sharding-result"],
};

const SNAP_REVEAL_LEAD: Readonly<Record<StoryId, number>> = {
  compatibility: 1.18,
  migration: 0.5,
  availability: 0.5,
  routing: 0.62,
  sharding: 0.5,
};

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
  timeline.to(oracle, { autoAlpha: 0, xPercent: -5, duration: 0.25 }, "mysql");
  reveal(timeline, mysql, { xPercent: 9 }, "mysql+=0.08", 0.28);
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
  timeline.to(mysql, { autoAlpha: 0, yPercent: -5, duration: 0.25 }, "postgresql");
  reveal(timeline, postgres, { yPercent: 8 }, "postgresql+=0.08", 0.3);
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
    reveal(timeline, steps[index] ? [steps[index]] : [], { yPercent: 14 }, at, 0.42);
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
  reveal(timeline, steps[0] ? [steps[0]] : [], { yPercent: 12 }, "serving+=0.12", 0.34);
  timeline.addLabel("fault", 0.9);
  reveal(timeline, motion(story, "availability-signal"), { scale: 0.7 }, "fault", 0.24);
  reveal(timeline, steps[1] ? [steps[1]] : [], { yPercent: 12 }, "fault+=0.12", 0.34);
  timeline.to(primary, { autoAlpha: 0.35, duration: 0.34 }, "fault");
  timeline.addLabel("authority", 1.65);
  reveal(timeline, motion(story, "availability-gate"), { yPercent: 16, scale: 0.94 }, "authority", 0.45);
  reveal(timeline, steps[2] ? [steps[2]] : [], { yPercent: 12 }, "authority+=0.12", 0.34);
  timeline.addLabel("hold", 2.35);
  reveal(timeline, hold, { yPercent: 16, scale: 0.94 }, "hold", 0.45);
  timeline.addLabel("fence", 3.05);
  reveal(timeline, motion(story, "availability-fence"), { xPercent: -10 }, "fence", 0.4);
  reveal(timeline, steps[3] ? [steps[3]] : [], { yPercent: 12 }, "fence+=0.12", 0.34);
  timeline.addLabel("promote", 3.8);
  reveal(timeline, motion(story, "availability-replica"), { yPercent: 16, scale: 0.94 }, "promote", 0.45);
  timeline.to(hold, { autoAlpha: 0.26, yPercent: -8, duration: 0.35, ease: "none" }, "promote");
  timeline.addLabel("vip", 4.45);
  timeline.to(vip, { scaleX: 1, duration: 0.55, ease: "none" }, "vip");
  reveal(timeline, steps[4] ? [steps[4]] : [], { yPercent: 12 }, "vip+=0.08", 0.34);
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
    reveal(timeline, steps[index] ? [steps[index]] : [], { yPercent: 12 }, at, 0.34);
  });
  reveal(timeline, Array.from(story.querySelectorAll<HTMLElement>(".home-routing-connection")), { xPercent: -10 }, "read", 0.42);
  reveal(timeline, motion(story, "routing-token"), { scale: 0.78 }, "write", 0.32);
  reveal(timeline, Array.from(story.querySelectorAll<HTMLElement>(".home-routing-classifier")), { yPercent: 12 }, "classify", 0.42);
  reveal(timeline, targetCards[0] ? [targetCards[0]] : [], { xPercent: 10 }, "read+=0.28", 0.42);
  reveal(timeline, motion(story, "routing-read-path"), { scaleX: 0, transformOrigin: "left" }, "read+=0.35", 0.62);
  reveal(timeline, targetCards[1] ? [targetCards[1]] : [], { xPercent: 10 }, "redirect", 0.42);
  reveal(timeline, motion(story, "routing-write-path"), { scaleX: 0, transformOrigin: "left" }, "redirect+=0.12", 0.62);
  reveal(timeline, motion(story, "routing-return-path"), { scaleX: 0, transformOrigin: "right" }, "return", 0.62);
  timeline.addLabel("routing-result", 4.92);
  reveal(timeline, Array.from(story.querySelectorAll<HTMLElement>(".home-routing-result")), { yPercent: 12 }, "routing-result", 0.48);
}

function buildSharding(timeline: GSAPTimeline, story: HTMLElement) {
  timeline.addLabel("predicate", 0);
  reveal(timeline, motion(story, "sharding-query"), { yPercent: -12 }, "predicate", 0.42);
  const steps = motion(story, "sharding-step");
  reveal(timeline, steps[0] ? [steps[0]] : [], { yPercent: 12 }, "predicate+=0.08", 0.34);
  timeline.addLabel("map", 0.9);
  reveal(timeline, motion(story, "sharding-worker"), { scale: 0.9 }, "map", 0.5);
  reveal(timeline, steps[1] ? [steps[1]] : [], { yPercent: 12 }, "map+=0.08", 0.34);
  timeline.addLabel("prune", 1.8);
  const pruned = motion(story, "sharding-pruned");
  if (pruned.length) timeline.to(pruned, { autoAlpha: 0.18, scale: 0.92, duration: 0.6, ease: "none" }, "prune");
  reveal(timeline, steps[2] ? [steps[2]] : [], { yPercent: 12 }, "prune+=0.08", 0.34);
  timeline.addLabel("route", 2.75);
  reveal(timeline, motion(story, "sharding-route"), { scaleX: 0, transformOrigin: "left" }, "route", 0.62);
  reveal(timeline, steps[3] ? [steps[3]] : [], { yPercent: 12 }, "route+=0.08", 0.34);
  const target = motion(story, "sharding-target");
  if (target.length) timeline.to(target, { scale: 1.06, duration: 0.3, yoyo: true, repeat: 1, ease: "none" }, "route+=0.34");
  timeline.addLabel("sharding-result", 3.75);
  reveal(timeline, motion(story, "sharding-result"), { yPercent: 12 }, "sharding-result", 0.5);
  reveal(timeline, steps[4] ? [steps[4]] : [], { yPercent: 12 }, "sharding-result+=0.08", 0.34);
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
  const snapPoints = Object.values(timeline.labels).map((time) => (
    Math.min(1, (time + SNAP_REVEAL_LEAD[id]) / timeline.duration())
  ));
  const progressItems = Array.from(story.querySelectorAll<HTMLElement>(".home-story-progress li"));
  const chapterControls = Array.from(story.querySelectorAll<HTMLButtonElement>("[data-story-jump]"));
  const updateChapterState = (progress = 0) => {
    const labels = PROGRESS_LABELS[id];
    const time = progress * timeline.duration();
    let activeIndex = 0;
    labels.forEach((label, index) => {
      if ((timeline.labels[label] ?? Number.POSITIVE_INFINITY) <= time + 0.02) activeIndex = index;
    });
    progressItems.forEach((item, index) => {
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
    scrub: 0.55,
    anticipatePin: 1,
    invalidateOnRefresh: true,
    snap: { snapTo: snapPoints, inertia: false, delay: 0.16, duration: { min: 0.12, max: 0.34 }, ease: "power1.inOut" },
    onToggle: (self) => { story.dataset.active = self.isActive ? "true" : "false"; },
    onUpdate: (self) => {
      story.style.setProperty("--story-progress", self.progress.toFixed(4));
      updateChapterState(self.progress);
    },
  });
  updateChapterState(0);
  return { timeline, trigger };
}

export function HomeStoryMotionClient() {
  useEffect(() => {
    const root = document.documentElement;
    const desktop = window.matchMedia("(min-width: 900px) and (pointer: fine)");
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
        const [{ gsap }, { ScrollTrigger }] = await Promise.all([import("gsap"), import("gsap/ScrollTrigger")]);
        if (disposed || run !== generation || !eligible()) return;
        gsap.registerPlugin(ScrollTrigger);
        const actionCleanups: Array<() => void> = [];
        root.classList.add("story-scroll-ready");
        const context = gsap.context(() => {
          STORY_IDS.forEach((id, index) => {
            const story = stories[index];
            if (!story) return;
            const motionStory = buildStory(gsap, ScrollTrigger, id, story);
            if (!motionStory) return;
            const { timeline, trigger } = motionStory;
            story.querySelectorAll<HTMLElement>("[data-story-jump]").forEach((control) => {
              const click = () => {
                const label = control.dataset.storyJump;
                if (label && timeline.labels[label] !== undefined) {
                  const progress = Math.min(1, (
                    timeline.labels[label] + SNAP_REVEAL_LEAD[id]
                  ) / timeline.duration());
                  window.scrollTo({ top: trigger.start + ((trigger.end - trigger.start) * progress), behavior: "smooth" });
                }
              };
              control.addEventListener("click", click);
              actionCleanups.push(() => control.removeEventListener("click", click));
            });
            story.querySelectorAll<HTMLElement>("[data-story-replay]").forEach((control) => {
              const click = () => window.scrollTo({ top: trigger.start + 1, behavior: "smooth" });
              control.addEventListener("click", click);
              actionCleanups.push(() => control.removeEventListener("click", click));
            });
          });
        }, root);
        stop = () => {
          actionCleanups.forEach((cleanup) => cleanup());
          context.revert();
          stories.forEach((story) => {
            story?.removeAttribute("data-active");
            story?.style.removeProperty("--story-progress");
          });
          root.classList.remove("story-scroll-ready");
        };
        ScrollTrigger.refresh();
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
