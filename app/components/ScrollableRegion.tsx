/* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex -- The labelled overflow region implements direct keyboard scrolling. */
"use client";

import type { KeyboardEvent, ReactNode } from "react";

export interface ScrollableRegionProps {
  labelledBy: string;
  className: string;
  children: ReactNode;
}

export function ScrollableRegion({
  labelledBy,
  className,
  children,
}: ScrollableRegionProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

    const direction = event.key === "ArrowRight" ? 1 : -1;
    const distance = Math.max(120, Math.round(event.currentTarget.clientWidth * 0.72));
    event.currentTarget.scrollLeft += direction * distance;
    event.preventDefault();
  }

  return (
    <div
      aria-labelledby={labelledBy}
      className={className}
      onKeyDown={handleKeyDown}
      role="region"
      tabIndex={0}
    >
      {children}
    </div>
  );
}
