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

test("new tab override supports unlimited freeform shortcuts", async () => {
  test.setTimeout(60000);

  for (const size of iconSizes) {
    const stat = await fs.stat(path.join(extensionPath, "icons", `icon${size}.png`));
    expect(stat.size).toBeGreaterThan(100);
  }
  await expect(fs.stat(path.join(extensionPath, "icons", "source-icon.svg"))).rejects.toThrow();

  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), "hug-dock-profile-"));
  const screenshotDir = process.env.SCREENSHOT_DIR || path.join(os.tmpdir(), "hug-dock-screenshots");
  await fs.mkdir(screenshotDir, { recursive: true });

  const launchOptions = {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-features=Translate",
      "--window-size=1440,1000"
    ],
    viewport: { width: 1440, height: 1000 }
  };

  if (process.env.CHROME_PATH) {
    launchOptions.executablePath = process.env.CHROME_PATH;
  }

  const context = await chromium.launchPersistentContext(userDataDir, launchOptions);
  const page = context.pages()[0] || await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => {
    const text = message.text();
    const benignResource404 = text.includes("Failed to load resource") && text.includes("status of 404");
    if (message.type() === "error" && !benignResource404) consoleErrors.push(text);
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  try {
    await page.goto("chrome://newtab/");
    await page.waitForLoadState("domcontentloaded");

    await expect(page).toHaveTitle("BOI DOCK");
    await expect(page.getByTestId("workspace")).toBeVisible();
    await expect(page.getByTestId("search-input")).toBeVisible();
    await expect(page.getByTestId("library-toggle")).toBeVisible();
    await expect(page.getByTestId("arrange-shortcuts")).toHaveCount(0);
    await expect(page.locator("#floatingAdd")).toHaveCount(0);
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

    const startingCount = await page.locator(".shortcut-tile").count();
    expect(startingCount).toBe(0);
    await expect(page.locator(".empty-library")).toHaveText("没有匹配项");
    await expect(page.locator("#shortcutCount")).toHaveText("0 个捷径");
    await expect(page.locator("#libraryMeta")).toHaveText("0 个捷径");

    await page.getByTestId("add-shortcut").hover();
    await expect(page.getByTestId("add-shortcut")).toHaveCSS("background-color", "rgb(36, 41, 47)");
    await expect(page.getByTestId("add-shortcut")).toHaveCSS("color", "rgb(255, 255, 255)");
    await expect(page.getByTestId("add-shortcut")).toHaveCSS("box-shadow", "none");

    await page.getByTestId("add-shortcut").click();
    await expect(page.getByText("颜色")).toHaveCount(0);
    await expect(page.locator("#shortcutColor")).toHaveCount(0);
    await expect(page.locator("#colorPalette")).toHaveCount(0);
    await expect(page.locator("#shortcutUrl")).toHaveAttribute("placeholder", "输入网址或域名");
    await page.getByLabel("名称").fill("Codex Smoke");
    await expect(page.locator("#shortcutUrl")).toHaveAttribute("type", "text");
    await page.locator("#shortcutUrl").fill("aixiejuben.com");
    await page.getByRole("button", { name: "保存" }).click();

    const createdTile = page.locator('.shortcut-tile[data-title="Codex Smoke"]');
    await expect(createdTile).toBeVisible();
    await expect(page.locator(".shortcut-tile")).toHaveCount(1);
    await expect(page.locator("#shortcutCount")).toHaveText("1 个捷径");
    await expect(page.locator("#libraryMeta")).toHaveText("1 个捷径");

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
    await expect(page.getByRole("menuitem", { name: "置顶" })).toHaveCount(0);

    const beforeCopyCount = await page.locator(".shortcut-tile").count();
    await page.getByRole("menuitem", { name: "复制网址" }).click();
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

    await page.locator('.shortcut-tile[data-title="Codex Smoke"] [data-tile-menu]').click();
    await page.getByRole("menuitem", { name: "编辑" }).click();
    await expect(page.getByText("颜色")).toHaveCount(0);
    await expect(page.locator("#shortcutColor")).toHaveCount(0);
    await page.getByRole("button", { name: "保存" }).click();
    await expect(createdTile.locator(".shortcut-icon")).toHaveCSS("background-color", "rgb(255, 255, 255)");
    const createdId = await createdTile.getAttribute("data-id");
    await expect(page.locator(`.library-row[data-id="${createdId}"] .library-row-icon`)).toHaveCSS("background-color", "rgb(255, 255, 255)");

    const stored = await page.evaluate(() => new Promise((resolve) => {
      setTimeout(() => chrome.storage.local.get(["hug-dock-state-v1"], resolve), 50);
    }));
    expect("version" in stored["hug-dock-state-v1"]).toBe(false);
    expect(stored["hug-dock-state-v1"].shortcuts.length).toBe(1);
    expect(stored["hug-dock-state-v1"].shortcuts.some((item) => "color" in item || "colorActive" in item)).toBe(false);
    await page.waitForFunction(() => {
      const toast = document.querySelector("#toast");
      return toast && !toast.classList.contains("is-visible") && Number(getComputedStyle(toast).opacity) < 0.05;
    }, undefined, { timeout: 5000 });

    await page.screenshot({ path: path.join(screenshotDir, "desktop.png"), fullPage: false });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByTestId("workspace")).toBeVisible();
    await page.waitForFunction(() => {
      const tiles = [...document.querySelectorAll(".shortcut-tile")];
      return tiles.length === 1 && tiles.every((tile) => Number(getComputedStyle(tile).opacity) > 0.98);
    }, undefined, { timeout: 5000 });
    await page.screenshot({ path: path.join(screenshotDir, "mobile.png"), fullPage: false });

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
