"use client";

import { useEffect } from "react";

interface ConnectionNavigator extends Navigator {
  connection?: {
    saveData?: boolean;
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function ExperienceLayer() {
  useEffect(() => {
    const root = document.documentElement;
    const progressTarget = document.querySelector<HTMLElement>(".experience-progress");
    const cursorTarget = document.querySelector<HTMLElement>(".experience-cursor");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarsePointer = window.matchMedia("(pointer: coarse)");
    const saveData = (navigator as ConnectionNavigator).connection?.saveData === true;
    const nativeScrollTimeline = CSS.supports("animation-timeline: scroll()");
    let staticExperience = reducedMotion.matches || saveData;
    const revealTargets = Array.from(
      document.querySelectorAll<HTMLElement>("[data-reveal]"),
    );
    const tiltTargets = Array.from(
      document.querySelectorAll<HTMLElement>("[data-tilt]"),
    );
    let scrollFrame = 0;
    let pointerFrame = 0;
    let pointerX = window.innerWidth / 2;
    let pointerY = window.innerHeight / 2;
    let scrollable = 1;
    let scrollListening = false;
    const entryAnimations = new Set<Animation>();

    root.classList.add("experience-enhanced");
    root.classList.toggle("experience-native-scroll", nativeScrollTimeline);

    function updateScrollProgress() {
      scrollFrame = 0;
      const progress = clamp(window.scrollY / scrollable, 0, 1);
      if (progressTarget) progressTarget.style.transform = `scaleX(${progress.toFixed(4)})`;
    }

    function updateScrollMetrics() {
      scrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      updateScrollProgress();
    }

    function requestScrollProgress() {
      if (scrollFrame) return;
      scrollFrame = window.requestAnimationFrame(updateScrollProgress);
    }

    function requestScrollMetrics() {
      if (scrollFrame) return;
      scrollFrame = window.requestAnimationFrame(updateScrollMetrics);
    }

    function setScrollListening(active: boolean) {
      if (active === scrollListening) return;
      scrollListening = active;
      if (active) window.addEventListener("scroll", requestScrollProgress, { passive: true });
      else window.removeEventListener("scroll", requestScrollProgress);
    }

    function updatePointer() {
      pointerFrame = 0;
      cursorTarget?.style.setProperty("--experience-pointer-x", `${pointerX}px`);
      cursorTarget?.style.setProperty("--experience-pointer-y", `${pointerY}px`);
    }

    function handlePointer(event: PointerEvent) {
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (!pointerFrame) pointerFrame = window.requestAnimationFrame(updatePointer);
    }

    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting || staticExperience) return;
          const target = entry.target as HTMLElement;
          target.dataset.revealed = "true";
          const animation = target.animate(
            [
              { opacity: 0.58, transform: "translateY(22px) scale(0.992)" },
              { opacity: 1, transform: "translateY(0) scale(1)" },
            ],
            {
              duration: 620,
              easing: "cubic-bezier(0.2, 0.72, 0.2, 1)",
            },
          );
          entryAnimations.add(animation);
          animation.addEventListener(
            "finish",
            () => entryAnimations.delete(animation),
            { once: true },
          );
          revealObserver.unobserve(target);
        });
      },
      { rootMargin: "0px 0px -10%", threshold: 0.08 },
    );

    const tiltCleanups = tiltTargets.map((target) => {
      function handleTilt(event: PointerEvent) {
        if (staticExperience || coarsePointer.matches) return;
        const bounds = target.getBoundingClientRect();
        const x = clamp((event.clientX - bounds.left) / bounds.width, 0, 1);
        const y = clamp((event.clientY - bounds.top) / bounds.height, 0, 1);
        target.style.setProperty("--card-light-x", `${x * 100}%`);
        target.style.setProperty("--card-light-y", `${y * 100}%`);
        target.style.setProperty("--card-tilt-x", `${(0.5 - y) * 4.2}deg`);
        target.style.setProperty("--card-tilt-y", `${(x - 0.5) * 4.2}deg`);
      }

      function resetTilt() {
        target.style.setProperty("--card-light-x", "50%");
        target.style.setProperty("--card-light-y", "50%");
        target.style.setProperty("--card-tilt-x", "0deg");
        target.style.setProperty("--card-tilt-y", "0deg");
      }

      target.addEventListener("pointermove", handleTilt, { passive: true });
      target.addEventListener("pointerleave", resetTilt);
      target.addEventListener("focusout", resetTilt);

      return () => {
        target.removeEventListener("pointermove", handleTilt);
        target.removeEventListener("pointerleave", resetTilt);
        target.removeEventListener("focusout", resetTilt);
      };
    });

    function applyExperienceMode() {
      staticExperience = reducedMotion.matches || saveData;
      root.classList.toggle("experience-static", staticExperience);
      root.classList.toggle("experience-coarse", coarsePointer.matches);

      if (staticExperience) {
        revealObserver.disconnect();
        entryAnimations.forEach((animation) => animation.cancel());
        entryAnimations.clear();
        setScrollListening(false);
        window.removeEventListener("pointermove", handlePointer);
        return;
      }

      revealTargets
        .filter((target) => target.dataset.revealed !== "true")
        .forEach((target) => revealObserver.observe(target));
      if (coarsePointer.matches) {
        window.removeEventListener("pointermove", handlePointer);
      } else {
        window.addEventListener("pointermove", handlePointer, { passive: true });
      }
      setScrollListening(!nativeScrollTimeline);
    }

    window.addEventListener("resize", requestScrollMetrics, { passive: true });
    window.addEventListener("halo:scroll-layout", requestScrollMetrics);
    reducedMotion.addEventListener("change", applyExperienceMode);
    coarsePointer.addEventListener("change", applyExperienceMode);
    applyExperienceMode();
    updateScrollMetrics();
    updatePointer();

    return () => {
      root.classList.remove("experience-enhanced");
      root.classList.remove("experience-static");
      root.classList.remove("experience-coarse");
      root.classList.remove("experience-native-scroll");
      progressTarget?.style.removeProperty("transform");
      cursorTarget?.style.removeProperty("--experience-pointer-x");
      cursorTarget?.style.removeProperty("--experience-pointer-y");
      window.cancelAnimationFrame(scrollFrame);
      window.cancelAnimationFrame(pointerFrame);
      revealObserver.disconnect();
      entryAnimations.forEach((animation) => animation.cancel());
      entryAnimations.clear();
      tiltCleanups.forEach((cleanup) => cleanup());
      setScrollListening(false);
      window.removeEventListener("resize", requestScrollMetrics);
      window.removeEventListener("halo:scroll-layout", requestScrollMetrics);
      window.removeEventListener("pointermove", handlePointer);
      reducedMotion.removeEventListener("change", applyExperienceMode);
      coarsePointer.removeEventListener("change", applyExperienceMode);
    };
  }, []);

  return (
    <>
      <div aria-hidden="true" className="experience-progress" />
      <div aria-hidden="true" className="experience-cursor" />
    </>
  );
}
