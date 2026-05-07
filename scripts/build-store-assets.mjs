import { chromium } from "playwright";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await fs.readFile(path.join(root, "manifest.json"), "utf8"));
const distDir = path.join(root, "dist");
const storeDir = path.join(root, "store-assets");
const promoDir = path.join(storeDir, "promos");
const screenshotDir = path.join(storeDir, "screenshots");
const listingDir = path.join(storeDir, "listing");
const catPng = await fs.readFile(path.join(root, "icons", "boi-cat-face.png"));
const catData = `data:image/png;base64,${catPng.toString("base64")}`;
const uploadZip = path.join(distDir, `boi-dock-${manifest.version}-chrome-web-store.zip`);
const extensionFiles = [
  "manifest.json",
  "newtab.html",
  "app.js",
  "styles.css",
  "_locales/en/messages.json",
  "_locales/zh_CN/messages.json",
  "icons/icon16.png",
  "icons/icon32.png",
  "icons/icon48.png",
  "icons/icon128.png",
  "icons/boi-cat-face-256.png"
];

await fs.mkdir(distDir, { recursive: true });
await fs.mkdir(promoDir, { recursive: true });
await fs.mkdir(screenshotDir, { recursive: true });
await fs.mkdir(listingDir, { recursive: true });

const browser = await chromium.launch();
try {
  await createExtensionIcons(browser);
  await createPromo(browser, 440, 280, path.join(promoDir, "small-promo-440x280.png"));
  await createPromo(browser, 1400, 560, path.join(promoDir, "marquee-promo-1400x560.png"));
  await createScreenshots(browser);
} finally {
  await browser.close();
}

await createListingCopy();
await buildZip();

console.log(`Created ${path.relative(root, uploadZip)}`);
console.log(`Created ${path.relative(root, promoDir)}`);
console.log(`Created ${path.relative(root, screenshotDir)}`);
console.log(`Created ${path.relative(root, listingDir)}`);

async function createExtensionIcons(browser) {
  const sizes = [16, 32, 48, 128];
  for (const size of sizes) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    const visualSize = Math.round(size * .875);
    const inset = Math.round((size - visualSize) / 2);
    await page.setContent(`<!doctype html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            html, body {
              width: ${size}px;
              height: ${size}px;
              margin: 0;
              overflow: hidden;
              background: transparent;
            }
            img {
              position: absolute;
              left: ${inset}px;
              top: ${inset}px;
              width: ${visualSize}px;
              height: ${visualSize}px;
              object-fit: contain;
            }
          </style>
        </head>
        <body><img src="${catData}" alt=""></body>
      </html>`, { waitUntil: "load" });
    await page.screenshot({
      path: path.join(root, "icons", `icon${size}.png`),
      clip: { x: 0, y: 0, width: size, height: size },
      omitBackground: true
    });
    await page.close();
  }
}

async function createPromo(browser, width, height, output) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const unit = Math.min(width / 440, height / 280);
  const catSize = Math.round(height * (width > 600 ? .96 : .82));
  const tile = Math.round(52 * unit);
  const dots = [
    [42, 42, 0, "#fff"], [120, 74, -8, "#fefefe"], [208, 46, 5, "#fff"],
    [74, 164, 8, "#fff"], [170, 176, -4, "#fff"], [268, 142, 7, "#fff"]
  ];
  const scaledDots = dots.map(([x, y, rotate, color], index) => {
    const left = Math.round(x * unit);
    const top = Math.round(y * unit);
    const size = tile + (index % 2) * Math.round(10 * unit);
    return `<span class="shortcut" style="left:${left}px;top:${top}px;width:${size}px;height:${size}px;--r:${rotate}deg;background:${color}"><i></i></span>`;
  }).join("");
  const catRight = width > 600 ? Math.round(62 * unit) : Math.round(14 * unit);
  const catTop = Math.round((height - catSize) / 2 + (width > 600 ? 10 * unit : 22 * unit));
  const searchWidth = Math.round(width * (width > 600 ? .48 : .54));
  const searchLeft = Math.round(width * .08);
  const searchTop = Math.round(height * (width > 600 ? .68 : .72));

  await page.setContent(`<!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          * { box-sizing: border-box; }
          html, body { width: ${width}px; height: ${height}px; margin: 0; overflow: hidden; }
          body {
            position: relative;
            background:
              radial-gradient(circle at 74% 32%, rgba(255,255,255,.95) 0 16%, transparent 17%),
              radial-gradient(circle at 20% 18%, rgba(255,255,255,.58) 0 12%, transparent 13%),
              linear-gradient(135deg, #ffd84d 0%, #fff4be 56%, #ffffff 100%);
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          }
          body::before {
            content: "";
            position: absolute;
            inset: ${Math.round(18 * unit)}px;
            border: ${Math.max(2, Math.round(3 * unit))}px solid #24292f;
            border-radius: ${Math.round(28 * unit)}px;
            opacity: .96;
          }
          body::after {
            content: "";
            position: absolute;
            left: ${searchLeft}px;
            top: ${searchTop}px;
            width: ${searchWidth}px;
            height: ${Math.round(34 * unit)}px;
            border-radius: ${Math.round(18 * unit)}px;
            background: #fff;
            border: ${Math.max(2, Math.round(2 * unit))}px solid #24292f;
            box-shadow: ${Math.round(7 * unit)}px ${Math.round(7 * unit)}px 0 rgba(36,41,47,.16);
          }
          .cat {
            position: absolute;
            right: ${catRight}px;
            top: ${catTop}px;
            width: ${catSize}px;
            height: ${catSize}px;
            object-fit: contain;
            filter: drop-shadow(${Math.round(10 * unit)}px ${Math.round(15 * unit)}px 0 rgba(36,41,47,.14));
          }
          .shortcut {
            position: absolute;
            display: grid;
            place-items: center;
            border: ${Math.max(2, Math.round(2 * unit))}px solid #24292f;
            border-radius: ${Math.round(18 * unit)}px;
            transform: rotate(var(--r));
            box-shadow: ${Math.round(8 * unit)}px ${Math.round(8 * unit)}px 0 rgba(36,41,47,.13);
          }
          .shortcut i {
            width: 42%;
            height: 42%;
            border-radius: 50%;
            background: #ffd84d;
            border: ${Math.max(2, Math.round(2 * unit))}px solid #24292f;
          }
          .shortcut:nth-child(2n) i { border-radius: ${Math.round(9 * unit)}px; background: #24292f; }
          .shortcuts { position:absolute; inset:0; }
        </style>
      </head>
      <body>
        <div class="shortcuts">${scaledDots}</div>
        <img class="cat" src="${catData}" alt="">
      </body>
    </html>`, { waitUntil: "load" });
  await page.screenshot({ path: output, clip: { x: 0, y: 0, width, height } });
  await page.close();
}

async function createScreenshots(browser) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    locale: "en-US"
  });
  const page = await context.newPage();
  const newtabUrl = `file://${path.join(root, "newtab.html")}`;
  await page.addInitScript((items) => {
    localStorage.setItem("hug-dock-state-v1", JSON.stringify({
      shortcuts: items,
      libraryOpen: true,
      zCounter: 80
    }));
  }, sampleShortcuts());
  await page.goto(newtabUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".shortcut-tile");
  await page.waitForTimeout(700);
  await page.screenshot({
    path: path.join(screenshotDir, "01-freeform-shortcuts-1280x800.png"),
    clip: { x: 0, y: 0, width: 1280, height: 800 }
  });

  await page.getByTestId("add-shortcut").click();
  await page.waitForSelector("#shortcutDialog[open]");
  await page.screenshot({
    path: path.join(screenshotDir, "02-add-shortcut-1280x800.png"),
    clip: { x: 0, y: 0, width: 1280, height: 800 }
  });
  await context.close();
}

function sampleShortcuts() {
  return [
    item("Chrome Web Store", "https://chromewebstore.google.com/", 165, 165, 12),
    item("OpenAI", "https://openai.com/", 330, 225, 22),
    item("Figma", "https://figma.com/", 540, 170, 18),
    item("Notion", "https://notion.so/", 250, 390, 34),
    item("GitHub", "https://github.com/", 450, 405, 30),
    item("Docs", "https://developer.chrome.com/docs/", 650, 330, 26),
    item("Calendar", "https://calendar.google.com/", 760, 210, 24),
    item("Hugging Face", "https://huggingface.co/", 595, 525, 36)
  ];
}

function item(title, url, x, y, z) {
  return {
    id: title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    title,
    url,
    x,
    y,
    z
  };
}

async function createListingCopy() {
  const english = `# BOI DOCK Chrome Web Store Listing

## Store name

BOI DOCK

## Short description

A freeform Chrome new-tab dock with unlimited draggable shortcuts.

## Detailed description

BOI DOCK turns Chrome's new tab page into a clean shortcut canvas.

- Add as many shortcuts as you want.
- Drag every shortcut anywhere on the canvas, including overlapping positions.
- Search, open, edit, delete, and copy URLs from the library.
- Use the top bar for Google search or direct URL navigation.
- Start from an empty page, with no bundled default shortcuts.

## Single purpose

BOI DOCK replaces the Chrome new tab page with a freeform shortcut and search workspace.

## Permission use

- storage: saves shortcuts, positions, and library state locally.
- clipboardWrite: copies a shortcut URL when the user clicks Copy URL.

## Data and privacy

BOI DOCK does not require an account, does not use a developer server, and does not collect personal data. Shortcuts are stored locally in chrome.storage.local. Shortcut favicons are loaded by domain through Google's favicon service.
`;

  const chinese = `# BOI DOCK Chrome Web Store Listing

## 商店名称

BOI DOCK

## 简短说明

自由摆放、数量不限的 Chrome 新标签页快捷 Dock。

## 详细说明

BOI DOCK 把 Chrome 新标签页变成一个轻量、干净、可以自由摆放的快捷访问工作台。

- 快捷方式数量不设应用层上限。
- 每个图标都可以拖到任意位置，也可以重叠摆放。
- 快捷库支持筛选、打开、编辑、删除和复制网址。
- 支持 Google 搜索，也支持直接输入网址跳转。
- 新安装默认没有任何快捷方式，用户自己决定放什么。

## 单一用途说明

替换 Chrome 新标签页，为用户提供可自由摆放的快捷网址入口和搜索入口。

## 权限用途

- storage：保存用户添加的快捷方式、位置和快捷库开关状态。
- clipboardWrite：用户点击“复制网址”时，把对应快捷方式的网址写入剪贴板。

## 数据与隐私

扩展不要求登录，不向开发者服务器发送数据，也不收集个人身份信息。快捷方式数据保存在用户本机的 chrome.storage.local。快捷图标使用 Google favicon 服务按域名加载站点图标。

## 素材清单

- 上传包：dist/boi-dock-${manifest.version}-chrome-web-store.zip
- 小宣传图：store-assets/promos/small-promo-440x280.png
- 滚动宣传图：store-assets/promos/marquee-promo-1400x560.png
- 截图：store-assets/screenshots/01-freeform-shortcuts-1280x800.png
- 截图：store-assets/screenshots/02-add-shortcut-1280x800.png
`;
  await fs.writeFile(path.join(listingDir, "store-listing-en.md"), english);
  await fs.writeFile(path.join(listingDir, "store-listing-zh.md"), chinese);
}

async function buildZip() {
  await fs.rm(uploadZip, { force: true });
  await execFileAsync("zip", ["-r", uploadZip, ...extensionFiles], { cwd: root });
  await execFileAsync("unzip", ["-t", uploadZip], { cwd: root });
}
