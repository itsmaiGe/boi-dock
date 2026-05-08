import { test, expect, chromium } from "@playwright/test";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname, "..");
const iconSizes = [16, 32, 48, 128];
const execFileAsync = promisify(execFile);

test("new tab override supports English freeform shortcuts", async () => {
  test.setTimeout(70000);

  for (const size of iconSizes) {
    const stat = await fs.stat(path.join(extensionPath, "icons", `icon${size}.png`));
    expect(stat.size).toBeGreaterThan(100);
  }
  await expect(fs.stat(path.join(extensionPath, "icons", "source-icon.svg"))).rejects.toThrow();

  const screenshotDir = process.env.SCREENSHOT_DIR || path.join(os.tmpdir(), "boi-dock-screenshots");
  await fs.mkdir(screenshotDir, { recursive: true });

  const session = await launchExtension({ language: "en-US", viewport: { width: 1440, height: 1000 } });
  const { context, page, userDataDir, consoleErrors } = session;

  try {
    await gotoNewTab(page);

    await expect(page).toHaveTitle("BOI DOCK");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByTestId("workspace")).toBeVisible();
    await expect(page.getByTestId("search-input")).toHaveAttribute("placeholder", "Search Google or enter a URL");
    await expect(page.getByTestId("library-toggle")).toBeVisible();
    await expect(page.getByTestId("library-toggle")).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByTestId("library-toggle")).not.toHaveClass(/is-active/);
    await expect(page.getByTestId("add-shortcut")).toContainText("Add");
    await expect(page.locator(".library-header h2")).toHaveText("Library");
    await expect(page.locator("#libraryPanel")).toHaveClass(/is-hidden/);
    await expect(page.getByTestId("arrange-shortcuts")).toHaveCount(0);
    await expect(page.locator("#floatingAdd")).toHaveCount(0);
    await expect(page.getByText("快捷库")).toHaveCount(0);
    await expect(page.getByText("BOI DOCK")).toBeVisible();
    await expect(page.locator(".brand-mark img")).toBeVisible();
    await expect(page.locator(".brand-mark svg")).toHaveCount(0);

    const brandStyle = await page.locator(".brand-mark").evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        background: style.backgroundColor,
        borderWidth: style.borderWidth,
        boxShadow: style.boxShadow
      };
    });
    expect(brandStyle.background).toBe("rgba(0, 0, 0, 0)");
    expect(brandStyle.borderWidth).toBe("0px");
    expect(brandStyle.boxShadow).toBe("none");

    const searchCenterOffset = await page.locator("#searchForm").evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return Math.abs(rect.left + rect.width / 2 - window.innerWidth / 2);
    });
    expect(searchCenterOffset).toBeLessThan(4);

    expect(await page.locator(".shortcut-tile").count()).toBe(0);
    await expect(page.locator(".empty-library")).toHaveText("No matching shortcuts");
    await expect(page.locator("#shortcutCount")).toHaveText("0 shortcuts");
    await expect(page.locator("#libraryMeta")).toHaveText("0 shortcuts");

    const addBox = await page.getByTestId("add-shortcut").boundingBox();
    expect(addBox).not.toBeNull();
    await page.mouse.move(addBox.x + addBox.width / 2, addBox.y + addBox.height / 2);
    await page.waitForTimeout(220);
    const addHoverStyle = await page.getByTestId("add-shortcut").evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        background: style.backgroundColor,
        color: style.color,
        boxShadow: style.boxShadow
      };
    });
    expect(addHoverStyle.background).toBe("rgb(36, 41, 47)");
    expect(addHoverStyle.color).toBe("rgb(255, 255, 255)");
    expect(addHoverStyle.boxShadow).toBe("none");

    await page.getByTestId("add-shortcut").click();
    await expect(page.getByText("Color")).toHaveCount(0);
    await expect(page.getByText("颜色")).toHaveCount(0);
    await expect(page.locator("#shortcutColor")).toHaveCount(0);
    await expect(page.locator("#colorPalette")).toHaveCount(0);
    await expect(page.locator("#shortcutUrl")).toHaveAttribute("placeholder", "Enter URL or domain");
    await page.getByLabel("Title").fill("Codex Smoke");
    await expect(page.locator("#shortcutUrl")).toHaveAttribute("type", "text");
    await page.locator("#shortcutUrl").fill("aixiejuben.com");
    await page.getByRole("button", { name: "Save" }).click();

    const createdTile = page.locator('.shortcut-tile[data-title="Codex Smoke"]');
    await expect(createdTile).toBeVisible();
    await expect(page.locator(".shortcut-tile")).toHaveCount(1);
    await expect(page.locator("#shortcutCount")).toHaveText("1 shortcut");
    await expect(page.locator("#libraryMeta")).toHaveText("1 shortcut");
    await expect(page.locator("#libraryPanel")).toHaveClass(/is-hidden/);
    await page.getByTestId("library-toggle").click();
    await expect(page.locator("#libraryPanel")).not.toHaveClass(/is-hidden/);
    await expect(page.getByTestId("library-toggle")).toHaveAttribute("aria-expanded", "true");

    const firstLibraryRow = page.locator(".library-row").first();
    await firstLibraryRow.hover();
    await expect(firstLibraryRow).toHaveCSS("transform", "none");
    const libraryHover = await firstLibraryRow.evaluate((node) => {
      const rowRect = node.getBoundingClientRect();
      const listRect = node.closest(".library-list").getBoundingClientRect();
      return {
        boxShadow: getComputedStyle(node).boxShadow,
        leftInset: rowRect.left - listRect.left
      };
    });
    expect(libraryHover.boxShadow).not.toBe("none");
    expect(libraryHover.leftInset).toBeGreaterThanOrEqual(1);

    const before = await createdTile.boundingBox();
    expect(before).not.toBeNull();

    await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
    await page.mouse.down();
    await page.mouse.move(320, 430, { steps: 14 });
    await page.mouse.up();

    const after = await createdTile.boundingBox();
    expect(after).not.toBeNull();
    expect(Math.abs(after.x - before.x) + Math.abs(after.y - before.y)).toBeGreaterThan(60);
    await expect(page.locator('.shortcut-tile[data-title="Codex Smoke"]')).toBeVisible();
    await page.waitForFunction(() => {
      const tile = document.querySelector('.shortcut-tile[data-title="Codex Smoke"]');
      return tile && Number(getComputedStyle(tile).opacity) > 0.98;
    }, undefined, { timeout: 5000 });
    const postDragStyle = await page.locator('.shortcut-tile[data-title="Codex Smoke"]').evaluate((node) => {
      const tileStyle = getComputedStyle(node);
      const cardStyle = getComputedStyle(node.querySelector(".shortcut-card"));
      const iconStyle = getComputedStyle(node.querySelector(".shortcut-icon"));
      return {
        animationName: tileStyle.animationName,
        outlineWidth: tileStyle.outlineWidth,
        cardBackground: cardStyle.backgroundColor,
        cardBoxShadow: cardStyle.boxShadow,
        iconBackground: iconStyle.backgroundColor
      };
    });
    expect(postDragStyle.animationName).toBe("none");
    expect(postDragStyle.outlineWidth).toBe("0px");
    expect(postDragStyle.cardBackground).toBe("rgba(0, 0, 0, 0)");
    expect(postDragStyle.cardBoxShadow).toBe("none");
    expect(postDragStyle.iconBackground).toBe("rgb(255, 255, 255)");
    await expect(page).toHaveTitle("BOI DOCK");

    await page.locator('.shortcut-tile[data-title="Codex Smoke"] [data-tile-menu]').click();
    await expect(page.getByRole("menuitem", { name: "Pin" })).toHaveCount(0);

    const beforeCopyCount = await page.locator(".shortcut-tile").count();
    await page.getByRole("menuitem", { name: "Copy URL" }).click();
    await expect(page.locator(".shortcut-tile")).toHaveCount(beforeCopyCount);
    await expect(page.locator('.shortcut-tile[data-title="Codex Smoke Copy"]')).toHaveCount(0);
    await expect.poll(async () => (await execFileAsync("pbpaste")).stdout, { timeout: 5000 }).toBe("https://aixiejuben.com/");
    await page.waitForFunction(() => {
      const tiles = [...document.querySelectorAll(".shortcut-tile")];
      return tiles.length === 1 && tiles.every((tile) => Number(getComputedStyle(tile).opacity) > 0.98);
    }, undefined, { timeout: 5000 });
    await page.waitForFunction(() => {
      const toast = document.querySelector("#toast");
      return toast && !toast.classList.contains("is-visible") && Number(getComputedStyle(toast).opacity) < 0.05;
    }, undefined, { timeout: 5000 });

    await page.locator('.shortcut-tile[data-title="Codex Smoke"]').click({ button: "right" });
    await page.getByRole("menuitem", { name: "Edit" }).click();
    await expect(page.getByText("Color")).toHaveCount(0);
    await expect(page.locator("#shortcutColor")).toHaveCount(0);
    await expect(page.getByLabel("Icon")).toHaveAttribute("placeholder", "Optional icon URL");
    await expect(page.getByRole("button", { name: "Upload" })).toBeVisible();
    const customIconFile = path.join(userDataDir, "custom-icon.svg");
    await fs.writeFile(customIconFile, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#ffd43b"/><circle cx="32" cy="32" r="15" fill="#24292f"/></svg>');
    await page.locator("#shortcutIconFile").setInputFiles(customIconFile);
    await expect.poll(async () => page.locator("#shortcutIcon").inputValue(), { timeout: 5000 }).toMatch(/^data:image\/(png|svg\+xml)/);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(createdTile.locator(".shortcut-icon")).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(createdTile.locator(".shortcut-icon img")).toHaveAttribute("src", /^data:image\/(png|svg\+xml)/);
    const createdId = await createdTile.getAttribute("data-id");
    await expect(page.locator(`.library-row[data-id="${createdId}"] .library-row-icon`)).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(page.locator(`.library-row[data-id="${createdId}"] .library-row-icon img`)).toHaveAttribute("src", /^data:image\/(png|svg\+xml)/);

    const stored = await page.evaluate(() => new Promise((resolve) => {
      setTimeout(() => chrome.storage.local.get(["hug-dock-state-v1"], resolve), 50);
    }));
    expect("version" in stored["hug-dock-state-v1"]).toBe(false);
    expect("libraryOpen" in stored["hug-dock-state-v1"]).toBe(false);
    expect(stored["hug-dock-state-v1"].shortcuts.length).toBe(1);
    expect(stored["hug-dock-state-v1"].shortcuts.some((item) => "color" in item || "colorActive" in item)).toBe(false);
    expect(stored["hug-dock-state-v1"].shortcuts[0].icon).toMatch(/^data:image\/(png|svg\+xml)/);
    await page.waitForFunction(() => {
      const toast = document.querySelector("#toast");
      return toast && !toast.classList.contains("is-visible") && Number(getComputedStyle(toast).opacity) < 0.05;
    }, undefined, { timeout: 5000 });

    await page.evaluate(() => new Promise((resolve) => {
      chrome.storage.local.get(["hug-dock-state-v1"], (storedState) => {
        const nextState = storedState["hug-dock-state-v1"];
        nextState.libraryOpen = true;
        chrome.storage.local.set({ "hug-dock-state-v1": nextState }, resolve);
      });
    }));
    await page.reload();
    await expect(page.locator("#libraryPanel")).toHaveClass(/is-hidden/);
    await expect(page.getByTestId("library-toggle")).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator('.shortcut-tile[data-title="Codex Smoke"]')).toBeVisible();
    await page.getByTestId("library-toggle").click();
    await expect(page.locator("#libraryPanel")).not.toHaveClass(/is-hidden/);

    await page.screenshot({ path: path.join(screenshotDir, "desktop.png"), fullPage: false });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByTestId("workspace")).toBeVisible();
    await expect(page.locator("#libraryPanel")).toHaveClass(/is-hidden/);
    await page.waitForFunction(() => {
      const tiles = [...document.querySelectorAll(".shortcut-tile")];
      return tiles.length === 1 && tiles.every((tile) => Number(getComputedStyle(tile).opacity) > 0.98);
    }, undefined, { timeout: 5000 });
    await page.screenshot({ path: path.join(screenshotDir, "mobile.png"), fullPage: false });
    await page.getByTestId("library-toggle").click();
    await expect(page.locator("#libraryPanel")).not.toHaveClass(/is-hidden/);

    await page.route(/^https:\/\/aixiejuben\.com\/?$/, (route) => route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><title>Library Opened</title><h1>Library Opened</h1>"
    }));
    await Promise.all([
      page.waitForURL(/^https:\/\/aixiejuben\.com\/?$/, { timeout: 5000 }),
      page.locator(`.library-row[data-id="${createdId}"] .library-row-main`).click()
    ]);
    await expect(page).toHaveTitle("Library Opened");

    expect(consoleErrors).toEqual([]);
  } finally {
    await context.close();
    await fs.rm(userDataDir, { recursive: true, force: true });
  }
});

test("new tab override follows Chinese Chrome UI language", async () => {
  test.setTimeout(45000);

  const session = await launchExtension({ language: "zh-CN", viewport: { width: 1280, height: 860 } });
  const { context, page, userDataDir, consoleErrors } = session;

  try {
    await gotoNewTab(page);

    await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
    await expect(page.getByTestId("search-input")).toHaveAttribute("placeholder", "搜索 Google 或输入网址");
    await expect(page.getByTestId("add-shortcut")).toContainText("添加");
    await expect(page.locator("#libraryPanel")).toHaveClass(/is-hidden/);
    await expect(page.getByTestId("library-toggle")).toHaveAttribute("aria-expanded", "false");
    await page.getByTestId("library-toggle").click();
    await expect(page.locator("#libraryPanel")).not.toHaveClass(/is-hidden/);
    await expect(page.locator(".library-header h2")).toHaveText("快捷库");
    await expect(page.locator(".empty-library")).toHaveText("没有匹配项");
    await expect(page.locator("#shortcutCount")).toHaveText("0 个捷径");
    await expect(page.locator("#libraryMeta")).toHaveText("0 个捷径");

    await page.getByTestId("add-shortcut").click();
    await expect(page.locator("#dialogTitle")).toHaveText("添加快捷方式");
    await expect(page.getByLabel("名称")).toBeVisible();
    await expect(page.locator("#shortcutUrl")).toHaveAttribute("placeholder", "输入网址或域名");
    await expect(page.getByLabel("图标")).toHaveAttribute("placeholder", "可选图标网址");
    await expect(page.getByRole("button", { name: "上传" })).toBeVisible();
    await expect(page.getByRole("button", { name: "保存" })).toBeVisible();
    await page.getByRole("button", { name: "取消" }).click();

    expect(consoleErrors).toEqual([]);
  } finally {
    await context.close();
    await fs.rm(userDataDir, { recursive: true, force: true });
  }
});

async function launchExtension({ language, viewport }) {
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), "boi-dock-profile-"));
  const launchOptions = {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      `--lang=${language}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-features=Translate",
      `--window-size=${viewport.width},${viewport.height}`
    ],
    locale: language,
    viewport
  };

  if (process.env.CHROME_PATH) {
    launchOptions.executablePath = process.env.CHROME_PATH;
  }

  const context = await chromium.launchPersistentContext(userDataDir, launchOptions);
  const page = context.pages()[0] || await context.newPage();
  const consoleErrors = [];
  const trackPage = (targetPage) => {
    targetPage.on("console", (message) => {
      const text = message.text();
      const benignResource404 = text.includes("Failed to load resource") && text.includes("status of 404");
      if (message.type() === "error" && !benignResource404) consoleErrors.push(text);
    });
    targetPage.on("pageerror", (error) => consoleErrors.push(error.message));
  };

  trackPage(page);
  context.on("page", trackPage);
  return { context, page, userDataDir, consoleErrors };
}

async function gotoNewTab(page) {
  await page.goto("chrome://newtab/");
  await page.waitForLoadState("domcontentloaded");
}
