# BOI DOCK

[中文](README.zh-CN.md)

BOI DOCK is a Chrome new tab extension for building a freeform shortcut workspace. It replaces the fixed shortcut grid with a quiet canvas where shortcuts can be placed anywhere.

![BOI DOCK home screen](docs/screenshots/boi-dock-home.png)

## Features

- Unlimited shortcuts.
- Freeform positioning with no grid, snapping, or fixed slots.
- Support for overlapping shortcuts.
- Search bar for Google search and direct URL navigation.
- Shortcut library for opening, filtering, editing, deleting, and copying links.
- Custom shortcut icons for sites without a reliable favicon.

![Adding a shortcut in BOI DOCK](docs/screenshots/boi-dock-add-shortcut.png)

## Installation

1. Clone or download this repository.
2. Open `chrome://extensions/` in Chrome.
3. Enable `Developer mode`.
4. Click `Load unpacked`.
5. Select the project directory.

BOI DOCK will replace Chrome's default new tab page after the extension is loaded.

## Development

```bash
npm install
npm test
```

The test suite launches Chromium with a temporary profile and loads the extension as an unpacked extension.

## Privacy

BOI DOCK has no account system, no backend service, and no analytics. Shortcuts, positions, and custom uploaded icons are stored locally with `chrome.storage.local`.

Permissions:

- `storage`: stores shortcuts and layout data.
- `clipboardWrite`: copies a shortcut URL when requested by the user.

Default favicons are loaded through Google's favicon service. Custom icon URLs are loaded only when explicitly configured by the user.

## License

MIT
