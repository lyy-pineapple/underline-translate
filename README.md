<div align="center">

**[中文](#中文) | [English](#english)**

</div>

# <a name="中文"></a>下划线翻译 Chrome 扩展

下划线翻译是一个极简的 Chrome 扩展，让您在任何网页上选择文本，并将翻译结果直接插入到源段落下方。它支持多种翻译提供商，可配置 API 密钥。

## 功能

- 选择文本并点击浮动的 **翻译** 按钮
- 将翻译插入到原文段落下方
- 取消或重试翻译
- 提供商选择：**Google (免费)** / **腾讯** / **有道** / **百度**
- 提供商密钥存储在 `chrome.storage.local`

## 项目结构

```
.
├── manifest.json
├── src/
│   ├── content.ts        # 内容脚本
│   ├── options.html      # 选项界面
│   ├── options.ts        # 选项逻辑
│   └── styles.css        # 注入样式
├── plans/                # 设计和实现文档
└── dist/                 # 构建输出（生成）
```

## 要求

- Node.js 18+ 推荐
- Chrome 或基于 Chromium 的浏览器

## 安装依赖

```bash
npm install
```

## 构建

```bash
npm run build
```

这将在 `dist/` 中生成编译后的文件。

## 在 Chrome 中加载扩展

1. 打开 `chrome://extensions/`
2. 启用 **开发者模式**
3. 点击 **加载已解压的扩展程序**
4. 选择此项目文件夹

## 使用方法

1. 在网页上高亮任何文本
2. 点击浮动的 **翻译** 按钮
3. 翻译将出现在原文段落下方

如果您选择多行，扩展会使用选择的快照，因此在鼠标松开后翻译仍然有效。

## 提供商设置

转到 **扩展选项** 并选择提供商：

### Google (免费)
- 默认提供商
- 无需 API 密钥

### 有道
- 需要 **AppKey** 和 **AppSecret**
- 签名类型：`v3` (SHA-256)

### 百度
- 需要 **AppId** 和 **AppKey**
- 签名：`MD5(appid + q + salt + key)`

### 腾讯
- 需要 **SecretId**、**SecretKey** 和 **Region**（默认：`ap-guangzhou`）
- 使用 TC3-HMAC-SHA256 签名

> 注意：所有密钥都存储在您的浏览器本地 (`chrome.storage.local`)。

## 故障排除

- **没有翻译按钮**：确保您已选择文本。按钮会出现在选择附近。
- **翻译失败**：检查提供商密钥或网络访问。点击结果块重试。
- **提供商密钥缺失**：扩展将显示描述性错误消息。

## 安全通知

此扩展直接从浏览器发送请求。API 密钥存储在本地并对用户可见。对于生产使用，请考虑使用后端代理。

## 许可证

MIT

---

# <a name="english"></a>Underline Translate Chrome Extension

Underline Translate is a minimal Chrome Extension that lets you select text on any webpage and insert the translated result directly below the source paragraph. It supports multiple translation providers with configurable API keys.

## Features

- Select text and click a floating **Translate** button
- Insert translation below the original paragraph
- Cancel or retry translations
- Provider selection: **Google (Free)** / **Tencent** / **Youdao** / **Baidu**
- Provider keys stored in `chrome.storage.local`

## Project Structure

```
.
├── manifest.json
├── src/
│   ├── content.ts        # content script
│   ├── options.html      # options UI
│   ├── options.ts        # options logic
│   └── styles.css        # injected styles
├── plans/                # design and implementation docs
└── dist/                 # build output (generated)
```

## Requirements

- Node.js 18+ recommended
- Chrome or Chromium-based browser

## Install Dependencies

```bash
npm install
```

## Build

```bash
npm run build
```

This will generate the compiled files in `dist/`.

## Load Extension in Chrome

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this project folder

## Usage

1. Highlight any text on a webpage
2. Click the floating **Translate** button
3. The translation will appear below the original paragraph

If you select multiple lines, the extension uses a snapshot of the selection so the translation still works after mouseup.

## Provider Settings

Go to **Extension Options** and choose a provider:

### Google (Free)
- Default provider
- No API key required

### Youdao
- Requires **AppKey** and **AppSecret**
- Sign type: `v3` (SHA-256)

### Baidu
- Requires **AppId** and **AppKey**
- Sign: `MD5(appid + q + salt + key)`

### Tencent
- Requires **SecretId**, **SecretKey**, and **Region** (default: `ap-guangzhou`)
- Uses TC3-HMAC-SHA256 signature

> Note: All keys are stored locally in your browser (`chrome.storage.local`).

## Troubleshooting

- **No translate button**: Make sure you have selected text. The button appears near the selection.
- **Translation failed**: Check provider keys or network access. Click the result block to retry.
- **Provider keys missing**: The extension will show a descriptive error message.

## Security Notice

This extension sends requests directly from the browser. API keys are stored locally and visible to the user. For production use, consider a backend proxy.

## License

MIT
