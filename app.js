(() => {
  const STORAGE_KEY = "hug-dock-state-v1";
  const state = {
    shortcuts: [],
    libraryOpen: true,
    zCounter: 40,
    filter: ""
  };

  const els = {
    workspace: document.getElementById("workspace"),
    layer: document.getElementById("shortcutLayer"),
    searchForm: document.getElementById("searchForm"),
    searchInput: document.getElementById("searchInput"),
    addButton: document.getElementById("addButton"),
    libraryToggle: document.getElementById("libraryToggle"),
    libraryPanel: document.getElementById("libraryPanel"),
    closeLibrary: document.getElementById("closeLibrary"),
    libraryFilter: document.getElementById("libraryFilter"),
    libraryList: document.getElementById("libraryList"),
    libraryMeta: document.getElementById("libraryMeta"),
    shortcutCount: document.getElementById("shortcutCount"),
    clockText: document.getElementById("clockText"),
    dialog: document.getElementById("shortcutDialog"),
    form: document.getElementById("shortcutForm"),
    dialogTitle: document.getElementById("dialogTitle"),
    titleInput: document.getElementById("shortcutTitle"),
    urlInput: document.getElementById("shortcutUrl"),
    formError: document.getElementById("formError"),
    tileMenu: document.getElementById("tileMenu"),
    toast: document.getElementById("toast")
  };

  const translations = {
    en: {
      htmlLang: "en",
      searchPlaceholder: "Search Google or enter a URL",
      searchAction: "Search",
      quickActions: "Quick actions",
      library: "Library",
      add: "Add",
      shortcutCanvas: "Shortcut canvas",
      closeLibrary: "Close library",
      filterPlaceholder: "Filter shortcuts",
      copyUrl: "Copy URL",
      edit: "Edit",
      delete: "Delete",
      close: "Close",
      addShortcut: "Add shortcut",
      editShortcut: "Edit shortcut",
      titleLabel: "Title",
      urlLabel: "URL",
      urlPlaceholder: "Enter URL or domain",
      cancel: "Cancel",
      save: "Save",
      emptyLibrary: "No matching shortcuts",
      openShortcut: "Open {title}",
      shortcutMenu: "{title} menu",
      editShortcutLabel: "Edit {title}",
      deleteShortcutLabel: "Delete {title}",
      invalidUrl: "Invalid URL",
      newShortcut: "New Shortcut",
      updated: "Updated",
      added: "Added",
      copiedUrl: "URL copied",
      copyFailed: "Copy failed",
      deletedShortcut: "Deleted {title}",
      clockLocale: "en-US"
    },
    zh: {
      htmlLang: "zh-CN",
      searchPlaceholder: "搜索 Google 或输入网址",
      searchAction: "搜索",
      quickActions: "快捷操作",
      library: "快捷库",
      add: "添加",
      shortcutCanvas: "快捷访问画布",
      closeLibrary: "关闭快捷库",
      filterPlaceholder: "筛选快捷方式",
      copyUrl: "复制网址",
      edit: "编辑",
      delete: "删除",
      close: "关闭",
      addShortcut: "添加快捷方式",
      editShortcut: "编辑快捷方式",
      titleLabel: "名称",
      urlLabel: "网址",
      urlPlaceholder: "输入网址或域名",
      cancel: "取消",
      save: "保存",
      emptyLibrary: "没有匹配项",
      openShortcut: "打开 {title}",
      shortcutMenu: "{title} 菜单",
      editShortcutLabel: "编辑 {title}",
      deleteShortcutLabel: "删除 {title}",
      invalidUrl: "网址格式不正确",
      newShortcut: "新快捷方式",
      updated: "已更新",
      added: "已添加",
      copiedUrl: "已复制网址",
      copyFailed: "复制失败",
      deletedShortcut: "已删除 {title}",
      clockLocale: "zh-CN"
    }
  };

  const locale = detectLocale();

  let drag = null;
  let menuTargetId = null;
  let suppressedClick = { id: "", until: 0 };
  let saveTimer = 0;
  let toastTimer = 0;

  function shortcut(title, url, x, y) {
    return {
      id: crypto.randomUUID(),
      title,
      url,
      x,
      y,
      z: 1
    };
  }

  function hasChromeStorage() {
    return Boolean(globalThis.chrome && chrome.storage && chrome.storage.local);
  }

  function getStoredState() {
    if (hasChromeStorage()) {
      return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEY], (value) => resolve(value[STORAGE_KEY]));
      });
    }

    try {
      return Promise.resolve(JSON.parse(localStorage.getItem(STORAGE_KEY)));
    } catch {
      return Promise.resolve(null);
    }
  }

  function setStoredState(value) {
    if (hasChromeStorage()) {
      return new Promise((resolve) => chrome.storage.local.set({ [STORAGE_KEY]: value }, resolve));
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    return Promise.resolve();
  }

  async function load() {
    applyTranslations();
    const stored = await getStoredState();
    let needsSave = false;
    if (stored && Array.isArray(stored.shortcuts)) {
      state.shortcuts = stored.shortcuts.map(normalizeShortcut).filter(Boolean);
      state.libraryOpen = stored.libraryOpen !== false;
      state.zCounter = Number.isFinite(stored.zCounter) ? stored.zCounter : maxZ(state.shortcuts) + 1;
      needsSave = Boolean(stored.version) || stored.shortcuts.some((item) => "color" in item || "colorActive" in item);
    } else {
      state.shortcuts = [];
      state.zCounter = 0;
      needsSave = true;
    }

    render();
    bindEvents();
    updateClock();
    setInterval(updateClock, 10000);
    if (needsSave) queueSave(10);
  }

  function normalizeShortcut(item) {
    const url = normalizeUrl(item.url);
    if (!url) return null;

    return {
      id: item.id || crypto.randomUUID(),
      title: String(item.title || domainName(url) || t("newShortcut")).slice(0, 48),
      url,
      x: numberOr(item.x, 180),
      y: numberOr(item.y, 180),
      z: numberOr(item.z, 1)
    };
  }

  function numberOr(value, fallback) {
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
  }

  function maxZ(shortcuts) {
    return shortcuts.reduce((max, item) => Math.max(max, Number(item.z) || 0), 0);
  }

  function queueSave(delay = 120) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      setStoredState({
        shortcuts: state.shortcuts,
        libraryOpen: state.libraryOpen,
        zCounter: state.zCounter
      });
    }, delay);
  }

  function render() {
    renderShortcuts();
    renderLibrary();
    els.shortcutCount.textContent = countLabel(state.shortcuts.length);
    els.libraryMeta.textContent = countLabel(state.shortcuts.length);
    els.libraryPanel.classList.toggle("is-hidden", !state.libraryOpen);
    els.libraryToggle.classList.toggle("is-active", state.libraryOpen);
  }

  function renderShortcuts() {
    els.layer.innerHTML = state.shortcuts.map((item) => `
      <div
        class="shortcut-tile"
        role="link"
        tabindex="0"
        data-id="${escapeAttr(item.id)}"
        data-title="${escapeAttr(item.title)}"
        aria-label="${escapeAttr(t("openShortcut", { title: item.title }))}"
        style="--x:${item.x}px; --y:${item.y}px; z-index:${item.z};"
      >
        <div class="shortcut-card">
          <span class="shortcut-icon">
            <img src="${faviconUrl(item.url)}" alt="" draggable="false">
            <span class="shortcut-initial" aria-hidden="true">${escapeHtml(initialFor(item.title))}</span>
          </span>
          <button class="tile-more" type="button" data-tile-menu aria-label="${escapeAttr(t("shortcutMenu", { title: item.title }))}">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6.5 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm7.5 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm7.5 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" fill="currentColor"/>
            </svg>
          </button>
        </div>
        <div class="shortcut-label" title="${escapeAttr(item.title)}">${escapeHtml(item.title)}</div>
      </div>
    `).join("");

    els.layer.querySelectorAll(".shortcut-icon img").forEach((img) => {
      img.addEventListener("load", () => img.nextElementSibling?.remove());
      img.addEventListener("error", () => img.remove());
    });
  }

  function renderLibrary() {
    const filter = state.filter.trim().toLowerCase();
    const shortcuts = state.shortcuts.filter((item) => {
      if (!filter) return true;
      return `${item.title} ${domainName(item.url)}`.toLowerCase().includes(filter);
    });

    if (!shortcuts.length) {
      els.libraryList.innerHTML = `<div class="empty-library">${escapeHtml(t("emptyLibrary"))}</div>`;
      return;
    }

    els.libraryList.innerHTML = shortcuts.map((item) => `
      <article class="library-row" data-id="${escapeAttr(item.id)}">
        <button class="library-row-main" type="button" data-library-action="open" aria-label="${escapeAttr(t("openShortcut", { title: item.title }))}">
          <span class="library-row-icon" aria-hidden="true">
            <img src="${faviconUrl(item.url)}" alt="" draggable="false">
            <span class="library-row-initial">${escapeHtml(initialFor(item.title))}</span>
          </span>
          <span class="library-row-text">
            <span class="library-row-title">${escapeHtml(item.title)}</span>
            <span class="library-row-domain">${escapeHtml(domainName(item.url))}</span>
          </span>
        </button>
        <div class="library-actions">
          <button type="button" data-library-action="edit" aria-label="${escapeAttr(t("editShortcutLabel", { title: item.title }))}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m16.9 4.2 2.9 2.9-9.8 9.8-3.5.7.7-3.5 9.7-9.9Zm-1.4 3.4-6.4 6.5-.2 1 1-.2 6.5-6.4-.9-.9Z" fill="currentColor"/></svg>
          </button>
          <button type="button" data-library-action="delete" aria-label="${escapeAttr(t("deleteShortcutLabel", { title: item.title }))}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5h8l.8 2H21v2H3V7h4.2L8 5Zm1 6h2v7H9v-7Zm4 0h2v7h-2v-7ZM6 10h12l-.8 10H6.8L6 10Z" fill="currentColor"/></svg>
          </button>
        </div>
      </article>
    `).join("");

    els.libraryList.querySelectorAll(".library-row-icon img").forEach((img) => {
      img.addEventListener("load", () => img.nextElementSibling?.remove());
      img.addEventListener("error", () => img.remove());
    });
  }

  function bindEvents() {
    els.searchForm.addEventListener("submit", handleSearch);
    els.addButton.addEventListener("click", () => openDialog());
    els.libraryToggle.addEventListener("click", toggleLibrary);
    els.closeLibrary.addEventListener("click", toggleLibrary);
    els.libraryFilter.addEventListener("input", () => {
      state.filter = els.libraryFilter.value;
      renderLibrary();
    });

    els.layer.addEventListener("pointerdown", startDrag);
    els.layer.addEventListener("click", handleLayerClick);
    els.layer.addEventListener("contextmenu", openContextMenu);
    els.layer.addEventListener("keydown", handleTileKeys);
    els.libraryList.addEventListener("click", handleLibraryAction);
    els.tileMenu.addEventListener("click", handleMenuAction);
    els.form.addEventListener("submit", saveFromDialog);
    els.dialog.addEventListener("click", (event) => {
      if (event.target === els.dialog || event.target.closest("[data-dialog-close]")) {
        closeDialog();
      }
    });

    document.addEventListener("pointermove", moveDrag);
    document.addEventListener("pointerup", endDrag);
    document.addEventListener("pointercancel", endDrag);
    document.addEventListener("click", (event) => {
      if (!event.target.closest(".tile-menu") && !event.target.closest("[data-tile-menu]")) {
        closeTileMenu();
      }
    });
    window.addEventListener("resize", () => closeTileMenu());
  }

  function handleSearch(event) {
    event.preventDefault();
    const query = els.searchInput.value.trim();
    if (!query) return;

    const destination = looksLikeUrl(query)
      ? normalizeUrl(query)
      : `https://www.google.com/search?q=${encodeURIComponent(query)}`;

    if (destination) {
      location.assign(destination);
    }
  }

  function startDrag(event) {
    if (event.button !== 0) return;
    if (event.target.closest("button")) return;

    const tile = event.target.closest(".shortcut-tile");
    if (!tile) return;

    const item = findShortcut(tile.dataset.id);
    if (!item) return;

    closeTileMenu();
    event.preventDefault();
    tile.setPointerCapture(event.pointerId);

    item.z = ++state.zCounter;
    tile.style.zIndex = item.z;
    tile.classList.add("is-dragging");

    drag = {
      id: item.id,
      pointerId: event.pointerId,
      tile,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: item.x,
      startY: item.y,
      lastClientX: event.clientX,
      lastClientY: event.clientY,
      moved: false
    };
  }

  function moveDrag(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const item = findShortcut(drag.id);
    if (!item) return;

    const dx = event.clientX - drag.startClientX;
    const dy = event.clientY - drag.startClientY;
    if (Math.hypot(dx, dy) > 4) {
      drag.moved = true;
    }

    const velocityX = event.clientX - drag.lastClientX;
    item.x = Math.round(drag.startX + dx);
    item.y = Math.round(drag.startY + dy);
    drag.tile.style.setProperty("--x", `${item.x}px`);
    drag.tile.style.setProperty("--y", `${item.y}px`);
    drag.tile.style.setProperty("--tilt", `${clamp(velocityX * .35, -7, 7)}deg`);
    drag.lastClientX = event.clientX;
    drag.lastClientY = event.clientY;
  }

  function endDrag(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const { tile, moved } = drag;
    tile.releasePointerCapture(event.pointerId);
    tile.classList.remove("is-dragging");
    drag = null;

    if (moved) {
      suppressedClick = { id: tile.dataset.id, until: performance.now() + 420 };
      queueSave();
      renderLibrary();
    }
  }

  function handleLayerClick(event) {
    const menuButton = event.target.closest("[data-tile-menu]");
    if (menuButton) {
      event.preventDefault();
      const tile = menuButton.closest(".shortcut-tile");
      const rect = menuButton.getBoundingClientRect();
      openTileMenu(tile.dataset.id, rect.left, rect.bottom + 8);
      return;
    }

    openShortcutFromClick(event);
  }

  function openShortcutFromClick(event) {
    if (event.target.closest("button") || drag) return;
    const tile = event.target.closest(".shortcut-tile");
    if (!tile) return;
    if (suppressedClick.id === tile.dataset.id && performance.now() < suppressedClick.until) {
      event.preventDefault();
      return;
    }
    const item = findShortcut(tile.dataset.id);
    if (!item) return;

    location.assign(item.url);
  }

  function handleTileKeys(event) {
    const tile = event.target.closest(".shortcut-tile");
    if (!tile) return;
    const item = findShortcut(tile.dataset.id);
    if (!item) return;

    if (event.key === "Enter") {
      location.assign(item.url);
      return;
    }

    const step = event.shiftKey ? 32 : 8;
    const directions = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step]
    };
    const delta = directions[event.key];
    if (!delta) return;

    event.preventDefault();
    item.x += delta[0];
    item.y += delta[1];
    tile.style.setProperty("--x", `${item.x}px`);
    tile.style.setProperty("--y", `${item.y}px`);
    queueSave();
  }

  function openContextMenu(event) {
    const tile = event.target.closest(".shortcut-tile");
    if (!tile) return;
    event.preventDefault();
    openTileMenu(tile.dataset.id, event.clientX, event.clientY);
  }

  function openTileMenu(id, x, y) {
    menuTargetId = id;
    const menuWidth = 158;
    const menuHeight = 160;
    const left = Math.min(x, window.innerWidth - menuWidth - 12);
    const top = Math.min(y, window.innerHeight - menuHeight - 12);
    els.tileMenu.hidden = false;
    els.tileMenu.style.left = `${Math.max(12, left)}px`;
    els.tileMenu.style.top = `${Math.max(12, top)}px`;
  }

  function closeTileMenu() {
    menuTargetId = null;
    els.tileMenu.hidden = true;
  }

  async function handleMenuAction(event) {
    const action = event.target.closest("[data-menu-action]")?.dataset.menuAction;
    const item = findShortcut(menuTargetId);
    if (!action || !item) return;

    closeTileMenu();
    if (action === "copy-url") await copyShortcutUrl(item);
    if (action === "edit") openDialog(item);
    if (action === "delete") deleteShortcut(item.id);
  }

  function handleLibraryAction(event) {
    const row = event.target.closest(".library-row");
    const action = event.target.closest("[data-library-action]")?.dataset.libraryAction;
    if (!row || !action) return;
    const item = findShortcut(row.dataset.id);
    if (!item) return;

    if (action === "open") location.assign(item.url);
    if (action === "edit") openDialog(item);
    if (action === "delete") deleteShortcut(item.id);
  }

  function openDialog(item = null) {
    closeTileMenu();
    els.form.dataset.mode = item ? "edit" : "add";
    els.form.dataset.id = item?.id || "";
    els.dialogTitle.textContent = item ? t("editShortcut") : t("addShortcut");
    els.titleInput.value = item?.title || "";
    els.urlInput.value = item?.url || "";
    els.formError.textContent = "";
    els.dialog.showModal();
    requestAnimationFrame(() => (item ? els.titleInput : els.urlInput).focus());
  }

  function closeDialog() {
    els.dialog.close();
    els.form.reset();
    els.formError.textContent = "";
  }

  function saveFromDialog(event) {
    event.preventDefault();
    const title = els.titleInput.value.trim();
    const url = normalizeUrl(els.urlInput.value);

    if (!url) {
      els.formError.textContent = t("invalidUrl");
      return;
    }

    if (els.form.dataset.mode === "edit") {
      const item = findShortcut(els.form.dataset.id);
      if (item) {
        item.title = title || domainName(url) || t("newShortcut");
        item.url = url;
        item.z = ++state.zCounter;
      }
      showToast(t("updated"));
    } else {
      const item = shortcut(title || domainName(url) || t("newShortcut"), url, 0, 0);
      const offset = state.shortcuts.length % 6;
      item.x = Math.round(window.innerWidth / 2 - 54 + offset * 18);
      item.y = Math.round(Math.min(window.innerHeight - 160, 175 + offset * 22));
      item.z = ++state.zCounter;
      state.shortcuts.push(item);
      showToast(t("added"));
    }

    closeDialog();
    render();
    queueSave(10);
  }

  async function copyShortcutUrl(item) {
    const copied = await writeClipboardText(item.url);
    showToast(copied ? t("copiedUrl") : t("copyFailed"));
  }

  async function writeClipboardText(text) {
    if (navigator.clipboard?.writeText) {
      try {
        await Promise.race([
          navigator.clipboard.writeText(text),
          timeout(800)
        ]);
        return true;
      } catch {
        // Fall through to the legacy path below.
      }
    }

    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.setAttribute("readonly", "");
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "0";
    document.body.append(textArea);
    textArea.select();

    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      textArea.remove();
    }
  }

  function timeout(ms) {
    return new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));
  }

  function deleteShortcut(id) {
    const item = findShortcut(id);
    state.shortcuts = state.shortcuts.filter((shortcutItem) => shortcutItem.id !== id);
    render();
    queueSave();
    if (item) showToast(t("deletedShortcut", { title: item.title }));
  }

  function toggleLibrary() {
    state.libraryOpen = !state.libraryOpen;
    render();
    queueSave();
  }

  function updateClock() {
    const now = new Date();
    els.clockText.textContent = now.toLocaleTimeString(t("clockLocale"), {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.classList.add("is-visible");
    toastTimer = setTimeout(() => els.toast.classList.remove("is-visible"), 1700);
  }

  function detectLocale() {
    let language = "";
    try {
      language = globalThis.chrome?.i18n?.getUILanguage?.() || "";
    } catch {
      language = "";
    }
    language ||= navigator.language || "";
    return language.toLowerCase().startsWith("zh") ? "zh" : "en";
  }

  function t(key, values = {}) {
    const value = translations[locale]?.[key] ?? translations.en[key] ?? key;
    return String(value).replace(/\{(\w+)\}/g, (_, name) => values[name] ?? "");
  }

  function countLabel(count) {
    if (locale === "zh") return `${count} 个捷径`;
    return `${count} shortcut${count === 1 ? "" : "s"}`;
  }

  function applyTranslations() {
    document.documentElement.lang = t("htmlLang");
    document.querySelectorAll("[data-i18n]").forEach((node) => {
      node.textContent = t(node.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
      node.setAttribute("placeholder", t(node.dataset.i18nPlaceholder));
    });
    document.querySelectorAll("[data-i18n-aria]").forEach((node) => {
      node.setAttribute("aria-label", t(node.dataset.i18nAria));
    });
    document.querySelectorAll("[data-i18n-title]").forEach((node) => {
      node.setAttribute("title", t(node.dataset.i18nTitle));
    });
    els.dialogTitle.textContent = t("addShortcut");
  }

  function findShortcut(id) {
    return state.shortcuts.find((item) => item.id === id);
  }

  function normalizeUrl(rawValue) {
    const raw = String(rawValue || "").trim();
    if (!raw) return "";
    const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
      const url = new URL(withProtocol);
      if (!["http:", "https:"].includes(url.protocol)) return "";
      return url.href;
    } catch {
      return "";
    }
  }

  function looksLikeUrl(value) {
    const query = value.trim();
    return /^[a-z][a-z0-9+.-]*:\/\//i.test(query) || query.includes(".") || query.startsWith("localhost");
  }

  function faviconUrl(url) {
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domainName(url))}&sz=64`;
  }

  function domainName(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  }

  function initialFor(title) {
    return String(title || "?").trim().slice(0, 1).toUpperCase();
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  load();
})();
