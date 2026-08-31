export function auditStoryOcclusions(storySelectorOrId = null) {
  const byId = storySelectorOrId
    ? document.querySelector(`[data-scroll-story="${CSS.escape(storySelectorOrId)}"]`)
    : null;
  const story = byId
    || (storySelectorOrId ? document.querySelector(storySelectorOrId) : null)
    || document.querySelector('[data-scroll-story][data-active="true"]')
    || document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2)?.closest("[data-scroll-story]");
  if (!story) return [];

  const storyId = story.getAttribute("data-scroll-story") || "unknown";
  if (!new Set(["availability", "routing", "sharding"]).has(storyId)) return [];

  const frameId = story.getAttribute("data-story-frame-id");
  const issues = [];
  const effectiveOpacity = (element) => {
    let opacity = 1;
    for (let current = element; current && current !== story.parentElement; current = current.parentElement) {
      const style = getComputedStyle(current);
      if (style.display === "none" || style.visibility === "hidden") return 0;
      opacity *= Number(style.opacity || 1);
      if (opacity < 0.001) return opacity;
    }
    return opacity;
  };
  const visible = (element, threshold = 0.05) => {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 1 && rect.height > 1 && effectiveOpacity(element) >= threshold;
  };
  const compactRect = (element) => {
    const rect = element.getBoundingClientRect();
    return {
      left: Number(rect.left.toFixed(2)),
      top: Number(rect.top.toFixed(2)),
      right: Number(rect.right.toFixed(2)),
      bottom: Number(rect.bottom.toFixed(2)),
    };
  };
  const intersection = (left, right, inset = 0) => {
    const a = left.getBoundingClientRect();
    const b = right.getBoundingClientRect();
    const width = Math.max(0, Math.min(a.right, b.right - inset) - Math.max(a.left, b.left + inset));
    const height = Math.max(0, Math.min(a.bottom, b.bottom - inset) - Math.max(a.top, b.top + inset));
    return { width, height };
  };
  const recordOverlap = (code, left, right, { inset = 0, minimum = 1 } = {}) => {
    if (!visible(left) || !visible(right)) return;
    const overlap = intersection(left, right, inset);
    if (overlap.width <= minimum || overlap.height <= minimum) return;
    issues.push({
      code,
      story: storyId,
      frame: frameId,
      intersection: {
        width: Number(overlap.width.toFixed(2)),
        height: Number(overlap.height.toFixed(2)),
      },
      leftRect: compactRect(left),
      rightRect: compactRect(right),
    });
  };

  if (storyId === "availability") {
    const hold = story.querySelector(".home-availability-hold");
    const steps = story.querySelector(".home-availability-steps");
    if (hold && steps && visible(hold)) {
      recordOverlap("availability-hold-step-overlap", hold, steps);
      for (const content of steps.querySelectorAll(":scope > li > span, :scope > li > strong, :scope > li > small")) {
        recordOverlap("availability-hold-step-content-overlap", hold, content);
      }
      const separation = steps.getBoundingClientRect().top - hold.getBoundingClientRect().bottom;
      if (separation < 8) {
        issues.push({
          code: "availability-hold-step-insufficient-separation",
          story: storyId,
          frame: frameId,
          separation: Number(separation.toFixed(2)),
        });
      }
    }
    if (
      hold
      && document.documentElement.classList.contains("story-scroll-ready")
      && new Set(["vip", "availability-result"]).has(frameId)
      && effectiveOpacity(hold) >= 0.05
    ) {
      issues.push({
        code: "availability-stale-hold-on-move",
        story: storyId,
        frame: frameId,
        opacity: Number(effectiveOpacity(hold).toFixed(3)),
      });
    }
  }

  if (storyId === "routing") {
    const token = story.querySelector(".home-routing-token");
    const cards = Array.from(story.querySelectorAll(
      ".home-routing-connection, .home-routing-classifier, .home-routing-targets article",
    )).filter((card) => visible(card));
    if (token && visible(token)) {
      for (const card of cards) {
        recordOverlap("routing-token-card-interior", token, card, { inset: 1 });
        for (const text of card.querySelectorAll("small, strong, span")) {
          recordOverlap("routing-token-text-overlap", token, text);
        }
      }
    }
    for (const segment of story.querySelectorAll(".home-routing-line [data-connector-segment]")) {
      if (!visible(segment)) continue;
      for (const card of cards) {
        recordOverlap("routing-connector-card-interior", segment, card, { inset: 4, minimum: 0.5 });
      }
    }
  }

  if (storyId === "sharding") {
    const cards = [
      story.querySelector(".home-sharding-worker"),
      ...story.querySelectorAll(".home-sharding-nodes article"),
    ].filter(Boolean);
    for (const segment of story.querySelectorAll(".home-sharding-route [data-connector-segment]")) {
      if (!visible(segment)) continue;
      for (const card of cards) {
        recordOverlap("sharding-route-card-interior", segment, card, { inset: 4, minimum: 0.5 });
      }
    }
  }

  const semanticText = Array.from(story.querySelectorAll(
    "h4, p, dd, dt, button, a, summary, small, strong, figcaption, li > span",
  )).filter((element) => (
    !element.closest('[aria-hidden="true"]')
    && !element.closest(".sr-only")
    && visible(element, 0.55)
  ));
  for (const element of semanticText) {
    const rect = element.getBoundingClientRect();
    const samples = [
      [0.5, 0.5],
      [0.25, 0.25],
      [0.75, 0.25],
      [0.25, 0.75],
      [0.75, 0.75],
    ];
    for (const [xRatio, yRatio] of samples) {
      const x = rect.left + (rect.width * xRatio);
      const y = rect.top + (rect.height * yRatio);
      if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) continue;
      const topElement = document.elementFromPoint(x, y);
      if (
        !topElement
        || topElement.closest(".site-header")
        || element.contains(topElement)
        || topElement.contains(element)
        || effectiveOpacity(topElement) < 0.05
      ) continue;
      issues.push({
        code: "semantic-text-occluded",
        story: storyId,
        frame: frameId,
        text: element.textContent?.trim().replace(/\s+/g, " ").slice(0, 100),
        occluder: topElement.className || topElement.tagName.toLowerCase(),
        sample: { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) },
        textRect: compactRect(element),
      });
      break;
    }
  }

  return issues;
}
