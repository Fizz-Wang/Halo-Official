"use client";

import { useEffect, useRef } from "react";

interface ConnectionNavigator extends Navigator {
  connection?: {
    saveData?: boolean;
  };
}

const BOOT_DURATION_MS = 4600;
const POINTER_RESPONSE_MS = 850;

export interface HaloSignalFieldProps {
  variant?: "primary" | "ambient" | "reduced";
}

export function HaloSignalField({
  variant = "primary",
}: HaloSignalFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const field = fieldRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !field || !context) return;
    const canvasElement: HTMLCanvasElement = canvas;
    const fieldElement: HTMLDivElement = field;
    const drawingContext: CanvasRenderingContext2D = context;

    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarsePointer = window.matchMedia("(pointer: coarse)");
    const saveData = (navigator as ConnectionNavigator).connection?.saveData === true;
    let motionAllowed = !motionPreference.matches && !saveData;
    let pointerAllowed = !coarsePointer.matches;
    let inViewport = true;
    let pageVisible = document.visibilityState === "visible";
    let width = 0;
    let height = 0;
    let dpr = 1;
    let frame = 0;
    let startTime = performance.now();
    let lastPointerTime = -Infinity;
    let pointerX = 0.5;
    let pointerY = 0.5;

    const particleCount = coarsePointer.matches ? 28 : 68;
    const particles = Array.from({ length: particleCount }, (_, index) => ({
      ring: index % 4,
      phase: (index / particleCount) * Math.PI * 2,
      speed: 0.00012 + (index % 7) * 0.000012,
      size: 0.75 + (index % 5) * 0.22,
    }));

    function resize() {
      const bounds = fieldElement.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      dpr = Math.min(window.devicePixelRatio || 1, coarsePointer.matches ? 1 : 1.5);
      canvasElement.width = Math.round(width * dpr);
      canvasElement.height = Math.round(height * dpr);
      canvasElement.style.width = `${width}px`;
      canvasElement.style.height = `${height}px`;
      drawingContext.setTransform(dpr, 0, 0, dpr, 0, 0);
      requestFrame();
    }

    function draw(now: number) {
      frame = 0;
      drawingContext.clearRect(0, 0, width, height);
      if (!motionAllowed) return;

      const pointerActive = now - lastPointerTime < POINTER_RESPONSE_MS;
      const booting = now - startTime < BOOT_DURATION_MS;
      const time = booting || pointerActive ? now : startTime + BOOT_DURATION_MS;
      const centerX = width * (0.5 + (pointerX - 0.5) * 0.045);
      const centerY = height * (0.5 + (pointerY - 0.5) * 0.045);
      const minSide = Math.min(width, height);
      const radii = [0.19, 0.28, 0.37, 0.46].map((value) => minSide * value);

      drawingContext.save();
      drawingContext.globalCompositeOperation = "lighter";

      const glow = drawingContext.createRadialGradient(
        centerX,
        centerY,
        minSide * 0.02,
        centerX,
        centerY,
        minSide * 0.43,
      );
      glow.addColorStop(0, "rgba(89, 241, 255, 0.18)");
      glow.addColorStop(0.38, "rgba(61, 112, 255, 0.08)");
      glow.addColorStop(1, "rgba(92, 54, 255, 0)");
      drawingContext.fillStyle = glow;
      drawingContext.fillRect(0, 0, width, height);

      radii.forEach((radius, index) => {
        drawingContext.beginPath();
        drawingContext.arc(centerX, centerY, radius, 0, Math.PI * 2);
        drawingContext.strokeStyle = index % 2
          ? "rgba(111, 83, 255, 0.16)"
          : "rgba(91, 226, 255, 0.17)";
        drawingContext.lineWidth = 0.8;
        drawingContext.stroke();
      });

      particles.forEach((particle, index) => {
        const radius = radii[particle.ring];
        const angle = particle.phase + time * particle.speed * (particle.ring % 2 ? -1 : 1);
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius * 0.7;
        const pulse = 0.55 + Math.sin(time * 0.002 + index) * 0.35;

        drawingContext.beginPath();
        drawingContext.arc(x, y, particle.size + pulse * 0.65, 0, Math.PI * 2);
        drawingContext.fillStyle = particle.ring % 2
          ? `rgba(154, 119, 255, ${0.24 + pulse * 0.32})`
          : `rgba(102, 238, 255, ${0.28 + pulse * 0.36})`;
        drawingContext.fill();

        if (index % 9 === 0) {
          drawingContext.beginPath();
          drawingContext.moveTo(centerX, centerY);
          drawingContext.lineTo(x, y);
          drawingContext.strokeStyle = `rgba(90, 206, 255, ${0.025 + pulse * 0.035})`;
          drawingContext.lineWidth = 0.55;
          drawingContext.stroke();
        }
      });

      drawingContext.restore();

      if (inViewport && pageVisible && (booting || pointerActive)) {
        frame = window.requestAnimationFrame(draw);
      }
    }

    function requestFrame() {
      if (!inViewport || !pageVisible || !motionAllowed || frame) return;
      frame = window.requestAnimationFrame(draw);
    }

    function handlePointerMove(event: PointerEvent) {
      if (!motionAllowed || !pointerAllowed) return;
      const bounds = fieldElement.getBoundingClientRect();
      pointerX = (event.clientX - bounds.left) / bounds.width;
      pointerY = (event.clientY - bounds.top) / bounds.height;
      lastPointerTime = performance.now();
      fieldElement.style.setProperty("--signal-x", `${pointerX * 100}%`);
      fieldElement.style.setProperty("--signal-y", `${pointerY * 100}%`);
      requestFrame();
    }

    function handleExperiencePreference() {
      motionAllowed = !motionPreference.matches && !saveData;
      pointerAllowed = !coarsePointer.matches;
      if (!motionAllowed) {
        window.cancelAnimationFrame(frame);
        frame = 0;
        drawingContext.clearRect(0, 0, width, height);
        return;
      }
      startTime = performance.now();
      requestFrame();
    }

    function handleVisibility() {
      pageVisible = document.visibilityState === "visible";
      if (!pageVisible) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      } else {
        requestFrame();
      }
    }

    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        inViewport = entry?.isIntersecting ?? false;
        if (!inViewport) {
          window.cancelAnimationFrame(frame);
          frame = 0;
        } else {
          requestFrame();
        }
      },
      { rootMargin: "120px" },
    );
    const resizeObserver = new ResizeObserver(resize);

    resizeObserver.observe(fieldElement);
    visibilityObserver.observe(fieldElement);
    fieldElement.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.addEventListener("visibilitychange", handleVisibility);
    motionPreference.addEventListener("change", handleExperiencePreference);
    coarsePointer.addEventListener("change", handleExperiencePreference);
    resize();

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      fieldElement.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("visibilitychange", handleVisibility);
      motionPreference.removeEventListener("change", handleExperiencePreference);
      coarsePointer.removeEventListener("change", handleExperiencePreference);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className={`halo-signal-field halo-signal-field--${variant}`}
      ref={fieldRef}
    >
      <canvas className="halo-signal-canvas" ref={canvasRef} />
      <div className="halo-static-orbit halo-static-orbit-a" />
      <div className="halo-static-orbit halo-static-orbit-b" />
      <div className="halo-static-orbit halo-static-orbit-c" />
      <div className="halo-core">
        <span className="halo-core-ring" />
        <span className="halo-core-spark" />
      </div>
      <div className="halo-signal-node halo-signal-node-a" />
      <div className="halo-signal-node halo-signal-node-b" />
      <div className="halo-signal-node halo-signal-node-c" />
      <div className="halo-signal-node halo-signal-node-d" />
    </div>
  );
}
