import { execSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { defineCommand } from "citty";

/**
 * Screenshot a local HTML file or a URL to a PNG, for PR evidence images.
 *
 * This exists because the obvious routes all fail on a normal machine:
 * playwright-cli refuses file: URLs and screenshots about:blank while exiting 0,
 * npx playwright cannot resolve a bun-installed or globally installed
 * playwright, playwright/index.js is CommonJS so a named ESM import throws, and
 * the installed browser build often does not match the package's pinned build.
 * So find the package, find a browser, and render at 2x.
 */

function npmGlobalRoot(): string | null {
  try {
    return execSync("npm root -g", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function findPackage(): string | null {
  const globalRoot = npmGlobalRoot();
  const candidates = [
    join(process.cwd(), "node_modules/playwright"),
    join(homedir(), ".bun/install/global/node_modules/playwright"),
    globalRoot ? join(globalRoot, "playwright") : null,
    join(homedir(), ".bun/install/global/node_modules/playwright-core"),
  ].filter((p): p is string => p !== null);

  return candidates.find((p) => existsSync(join(p, "index.js"))) ?? null;
}

/** Highest-numbered installed chromium build, headless shell preferred. */
function findBrowser(): string | null {
  const cache =
    process.env.PLAYWRIGHT_BROWSERS_PATH ||
    (process.platform === "darwin"
      ? join(homedir(), "Library/Caches/ms-playwright")
      : process.platform === "win32"
        ? join(process.env.LOCALAPPDATA ?? homedir(), "ms-playwright")
        : join(homedir(), ".cache/ms-playwright"));
  if (!existsSync(cache)) return null;

  const buildNumber = (dir: string) => Number(dir.match(/-(\d+)$/)?.[1] ?? 0);
  const dirs = readdirSync(cache)
    .filter((d) => /^chromium(_headless_shell)?-\d+$/.test(d))
    .sort(
      (a, b) =>
        buildNumber(b) - buildNumber(a) ||
        (a.includes("headless_shell") ? -1 : 1),
    );

  const relative = [
    "chrome-headless-shell-mac-arm64/chrome-headless-shell",
    "chrome-headless-shell-mac-x64/chrome-headless-shell",
    "chrome-headless-shell-linux/chrome-headless-shell",
    "chrome-headless-shell-win64/chrome-headless-shell.exe",
    "chrome-mac/Chromium.app/Contents/MacOS/Chromium",
    "chrome-linux/chrome",
    "chrome-win/chrome.exe",
  ];

  for (const dir of dirs) {
    for (const rel of relative) {
      const candidate = join(cache, dir, rel);
      if (existsSync(candidate) && statSync(candidate).isFile())
        return candidate;
    }
  }
  return null;
}

// biome-ignore lint/suspicious/noExplicitAny: playwright is an optional peer, so it has no types here.
type Chromium = any;

async function launch(chromium: Chromium) {
  try {
    return await chromium.launch();
  } catch (error) {
    const message = String((error as Error).message);
    if (!/Executable doesn't exist|Failed to launch/i.test(message))
      throw error;

    const executablePath = findBrowser();
    if (!executablePath) {
      console.error(message.split("\n")[0]);
      console.error(
        "No installed chromium found either. Run: playwright-cli install-browser chromium",
      );
      process.exit(1);
    }
    console.error(
      `note: the package's browser is missing, using ${executablePath}`,
    );
    return await chromium.launch({ executablePath });
  }
}

export default defineCommand({
  meta: {
    name: "shot",
    description:
      "Screenshot an HTML file or URL to a PNG, sized to its content",
  },
  args: {
    input: {
      type: "positional",
      required: true,
      description: "HTML file path or URL",
    },
    out: { type: "positional", required: true, description: "Output PNG path" },
    width: { type: "string", description: "CSS width in pixels (default 948)" },
  },
  async run({ args }) {
    const input = String(args.input);
    const out = String(args.out);
    const width = Number(args.width) || 948;

    const pkgDir = findPackage();
    if (!pkgDir) {
      console.error(
        "playwright not found. Install it: bun add -g @playwright/cli",
      );
      process.exit(1);
    }

    const imported = await import(pathToFileURL(join(pkgDir, "index.js")).href);
    const { chromium } = (imported.default ?? imported) as {
      chromium: Chromium;
    };

    const url = /^[a-z]+:\/\//i.test(input)
      ? input
      : pathToFileURL(isAbsolute(input) ? input : resolve(input)).href;

    const browser = await launch(chromium);
    const page = await browser.newPage({
      viewport: { width, height: 600 },
      deviceScaleFactor: 2,
    });

    const pageErrors: string[] = [];
    page.on("pageerror", (e: unknown) => pageErrors.push(String(e)));

    const response = await page.goto(url, { waitUntil: "load" });
    if (response && !response.ok() && !url.startsWith("file://")) {
      console.error(`warning: HTTP ${response.status()} for ${url}`);
    }
    if (page.url() === "about:blank") {
      console.error(
        `failed: navigation to ${url} did not land, still about:blank`,
      );
      await browser.close();
      process.exit(1);
    }

    // Evaluated as source text, not a closure: these run in the browser, and
    // typing them here would mean pulling DOM libs into a CLI package.
    await page.evaluate("document.fonts && document.fonts.ready");
    await page.waitForTimeout(250);

    // fullPage never shrinks below the viewport, so a short page gets padded with
    // blank space. Match the viewport to the content first.
    //
    // Measuring the body is what looks obvious and does not work: body is the
    // scrolling element, so its own box, its scrollHeight, and documentElement's
    // are all stretched to the viewport. On a 600px viewport a 110px page still
    // measures 600. The children's boxes are the only thing that tracks content,
    // and adding scrollY puts them in document coordinates so tall pages measure
    // past the fold correctly. Two passes settle any reflow the resize causes.
    const measure = (): Promise<number> =>
      page.evaluate(`(() => {
        const kids = [...document.body.children];
        const bottom = kids.length
          ? Math.max(...kids.map((el) => el.getBoundingClientRect().bottom + window.scrollY))
          : document.body.scrollHeight;
        const margin = parseFloat(getComputedStyle(document.body).marginBottom) || 0;
        return Math.ceil(Math.max(bottom + margin, 1));
      })()`);
    for (let i = 0; i < 2; i++) {
      await page.setViewportSize({ width, height: await measure() });
      await page.waitForTimeout(120);
    }

    const outPath = isAbsolute(out) ? out : resolve(out);
    await page.screenshot({ path: outPath, fullPage: true });
    await browser.close();

    if (pageErrors.length) {
      console.error(
        `note: ${pageErrors.length} page error(s): ${pageErrors[0]}`,
      );
    }

    let dimensions = "";
    try {
      dimensions = execSync(
        `magick identify -format '%wx%h' ${JSON.stringify(outPath)}`,
        {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        },
      );
    } catch {
      dimensions = "";
    }
    console.log(
      `wrote ${out}${dimensions ? ` (${dimensions} px, 2x of ${width}css)` : ""}`,
    );
  },
});
