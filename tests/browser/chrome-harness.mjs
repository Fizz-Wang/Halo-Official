import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const WINDOWS_CHROME_PATHS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];

const WINDOWS_EDGE_PATHS = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];

export function parseArgs(argv = process.argv.slice(2)) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const [rawKey, inlineValue] = token.slice(2).split("=", 2);
    const next = argv[index + 1];
    if (inlineValue !== undefined) {
      args[rawKey] = inlineValue;
    } else if (next && !next.startsWith("--")) {
      args[rawKey] = next;
      index += 1;
    } else {
      args[rawKey] = true;
    }
  }
  return args;
}

export async function loadPlaywright() {
  const moduleSpecifier = process.env.HALO_PLAYWRIGHT_MODULE || "playwright";
  try {
    return await import(moduleSpecifier);
  } catch (error) {
    throw new Error(
      `Unable to load Playwright from ${moduleSpecifier}. Install playwright or set HALO_PLAYWRIGHT_MODULE to its index.mjs file.`,
      { cause: error },
    );
  }
}

function executableCandidates(browserName) {
  if (process.platform === "win32") {
    return browserName === "edge" ? WINDOWS_EDGE_PATHS : WINDOWS_CHROME_PATHS;
  }
  if (process.platform === "darwin") {
    return browserName === "edge"
      ? ["/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"]
      : ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"];
  }
  return browserName === "edge"
    ? ["/usr/bin/microsoft-edge", "/usr/bin/microsoft-edge-stable"]
    : ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium"];
}

export function resolveBrowserExecutable(browserName = "chrome") {
  const explicit = browserName === "edge"
    ? process.env.HALO_EDGE_PATH
    : process.env.HALO_CHROME_PATH;
  if (explicit && existsSync(explicit)) return explicit;
  const resolved = executableCandidates(browserName).find((candidate) => existsSync(candidate));
  if (!resolved) {
    throw new Error(`Could not find a local ${browserName} executable. Set HALO_${browserName.toUpperCase()}_PATH.`);
  }
  return resolved;
}

export async function ensureDirectory(directory) {
  await mkdir(directory, { recursive: true });
  return directory;
}

export function asFileUrl(filePath) {
  return pathToFileURL(path.resolve(filePath)).href;
}

export async function waitForHomepageReady(page, { timeout = 30_000 } = {}) {
  await page.waitForLoadState("load", { timeout });
  await page.waitForFunction(async () => {
    await document.fonts.ready;
    const images = Array.from(document.images);
    await Promise.all(images.map(async (image) => {
      if (!image.complete) {
        await new Promise((resolve) => {
          image.addEventListener("load", resolve, { once: true });
          image.addEventListener("error", resolve, { once: true });
        });
      }
      if (typeof image.decode === "function") {
        try { await image.decode(); } catch { /* a broken optional image is surfaced by layout audit */ }
      }
    }));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return document.querySelectorAll("[data-scroll-story]").length === 5;
  }, undefined, { timeout });
  await page.waitForFunction(() => {
    const desktop = window.matchMedia("(min-width: 1180px) and (min-height: 864px) and (pointer: fine)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const slowUpdate = window.matchMedia("(update: slow)");
    const connection = navigator.connection;
    const constrainedDevice = (
      (navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 2)
      || (navigator.deviceMemory !== undefined && navigator.deviceMemory <= 2)
    );
    const shouldMountSteppedMotion = (
      desktop.matches
      && !reduced.matches
      && !slowUpdate.matches
      && !constrainedDevice
      && connection?.saveData !== true
    );
    return !shouldMountSteppedMotion || document.documentElement.classList.contains("story-scroll-ready");
  }, undefined, { timeout });
  await page.waitForTimeout(350);
}

export async function gotoHomepage(page, url, options = {}) {
  await page.goto(url, { waitUntil: "load", timeout: options.timeout ?? 30_000 });
  await waitForHomepageReady(page, options);
}

export async function homepageGeometry(page) {
  return page.evaluate(() => {
    const stories = Array.from(document.querySelectorAll("[data-scroll-story]"));
    const values = stories.map((story) => {
      const rect = story.getBoundingClientRect();
      return {
        id: story.getAttribute("data-scroll-story"),
        top: rect.top + window.scrollY,
        height: rect.height,
        bottom: rect.bottom + window.scrollY,
      };
    });
    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
      scrollHeight: document.documentElement.scrollHeight,
      stories: values,
      range: {
        start: Math.max(0, (values[0]?.top ?? 0) + 1),
        end: Math.min(
          document.documentElement.scrollHeight - window.innerHeight,
          Math.max(0, (values.at(-1)?.bottom ?? document.documentElement.scrollHeight) - window.innerHeight - 1),
        ),
      },
      storyScrollReady: document.documentElement.classList.contains("story-scroll-ready"),
      fonts: document.fonts.status,
    };
  });
}

export async function launchBrowser({ browserName = "chrome", headless = true } = {}) {
  const { chromium } = await loadPlaywright();
  return chromium.launch({
    executablePath: resolveBrowserExecutable(browserName),
    headless,
    args: [
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--disable-features=CalculateNativeWinOcclusion",
      "--enable-precise-memory-info",
    ],
  });
}
