# BOI DOCK

[English](README.md)

BOI DOCK 是一个 Chrome 新标签页扩展，用于构建自由摆放的快捷访问工作区。它用一块安静的画布替代固定宫格，让快捷方式按照用户自己的布局摆放。

![BOI DOCK 主界面](docs/screenshots/boi-dock-home.png)

## 功能

- 快捷方式数量不限。
- 自由定位，不使用宫格、吸附或固定槽位。
- 支持快捷方式重叠摆放。
- 顶部搜索栏支持 Google 搜索和网址直达。
- 快捷库支持打开、筛选、编辑、删除和复制链接。
- 支持自定义快捷方式图标，用于处理 favicon 缺失或不准确的网站。

![在 BOI DOCK 里添加快捷方式](docs/screenshots/boi-dock-add-shortcut.png)

## 安装

1. 克隆或下载本仓库。
2. 在 Chrome 中打开 `chrome://extensions/`。
3. 开启 `Developer mode`。
4. 点击 `Load unpacked`。
5. 选择项目目录。

扩展加载后，BOI DOCK 会替换 Chrome 默认的新标签页。

## 开发

```bash
npm install
npm test
```

测试会使用临时 Chromium 配置加载未打包扩展，不会影响日常浏览器数据。

## 隐私

BOI DOCK 不提供账号系统，不依赖后端服务，也不包含分析统计。快捷方式、位置和上传的自定义图标存储在本机 `chrome.storage.local` 中。

权限说明：

- `storage`：保存快捷方式和布局数据。
- `clipboardWrite`：在用户主动复制快捷方式网址时写入剪贴板。

默认 favicon 通过 Google favicon 服务加载。自定义图标网址只会在用户明确配置后加载。

## License

MIT
