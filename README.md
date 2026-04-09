# Underline Translate Chrome Extension

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
