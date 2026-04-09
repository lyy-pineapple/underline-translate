# Inline Translate Extension Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a minimal Chrome MV3 extension (TypeScript) that lets users select text, click a floating button, and insert a translated paragraph below the source paragraph with cancel/loading and update-in-place behavior.

**Architecture:** Content script handles selection, floating UI, translation fetch, and DOM insertion. A minimal options page stores target language. No background/service worker; direct fetch from content script. CSS is injected by the content script for gray, small-font translations.

**Tech Stack:** Chrome Extension MV3, TypeScript, DOM APIs, fetch + AbortController.

---

### Task 1: Create base project structure

**Files:**
- Create: `manifest.json`
- Create: `src/content.ts`
- Create: `src/options.html`
- Create: `src/options.ts`
- Create: `src/styles.css`
- Create: `tsconfig.json`
- Create: `package.json`

**Step 1: Write `package.json`**

```json
{
  "name": "inline-translate",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "tsc -p tsconfig.json"
  },
  "devDependencies": {
    "typescript": "^5.6.0"
  }
}
```

**Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "lib": ["DOM", "ES2020"],
    "moduleResolution": "Bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "noImplicitAny": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  },
  "include": ["src"]
}
```

**Step 3: Write `manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "Inline Translate",
  "version": "0.1.0",
  "description": "Select text and show translation below the paragraph.",
  "permissions": ["activeTab", "scripting", "storage"],
  "host_permissions": ["https://translate.googleapis.com/*"],
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["dist/content.js"],
      "css": ["dist/styles.css"],
      "run_at": "document_idle"
    }
  ],
  "options_page": "dist/options.html"
}
```

**Step 4: Write `src/options.html`**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Inline Translate Options</title>
  </head>
  <body>
    <h1>Inline Translate Options</h1>
    <label>
      Target language (e.g. zh-CN):
      <input id="targetLang" type="text" />
    </label>
    <button id="saveBtn">Save</button>
    <p id="status"></p>
    <script src="options.js"></script>
  </body>
</html>
```

**Step 5: Write `src/options.ts`**

```ts
const input = document.getElementById("targetLang") as HTMLInputElement;
const status = document.getElementById("status") as HTMLParagraphElement;
const saveBtn = document.getElementById("saveBtn") as HTMLButtonElement;

// Load stored target language on page load.
chrome.storage.sync.get({ targetLang: "zh-CN" }, (items) => {
  input.value = items.targetLang;
});

// Save target language when user clicks save.
saveBtn.addEventListener("click", () => {
  const value = input.value.trim() || "zh-CN";
  chrome.storage.sync.set({ targetLang: value }, () => {
    status.textContent = "Saved";
    setTimeout(() => {
      status.textContent = "";
    }, 1500);
  });
});
```

**Step 6: Write `src/styles.css`**

```css
.inline-translate-result {
  color: #666;
  font-size: 0.9em;
  margin-top: 6px;
  margin-left: 12px;
  line-height: 1.4;
}

.inline-translate-loading {
  color: #999;
  font-style: italic;
}

.inline-translate-action {
  cursor: pointer;
  color: #4a6cf7;
  margin-left: 8px;
}

.inline-translate-fab {
  position: absolute;
  z-index: 2147483647;
  background: #4a6cf7;
  color: #fff;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
  user-select: none;
}
```

**Step 7: Create placeholder `src/content.ts`**

```ts
// Content script entry point.
console.log("Inline Translate content script loaded");
```

**Step 8: Build once to verify output**

Run: `npm install`

Run: `npm run build`

Expected: `dist/` contains compiled `content.js` and `options.js` plus copied `options.html` and `styles.css` (we will add a copy step in Task 2).

**Step 9: Commit**

```bash
git add manifest.json package.json tsconfig.json src/options.html src/options.ts src/styles.css src/content.ts
git commit -m "chore: initialize extension scaffold"
```

---

### Task 2: Add build copy step for static assets

**Files:**
- Modify: `package.json`

**Step 1: Update build script to copy HTML/CSS**

```json
"scripts": {
  "build": "tsc -p tsconfig.json && cp src/options.html dist/options.html && cp src/styles.css dist/styles.css"
}
```

**Step 2: Run build to confirm assets**

Run: `npm run build`

Expected: `dist/options.html` and `dist/styles.css` exist.

**Step 3: Commit**

```bash
git add package.json
git commit -m "build: copy static assets"
```

---

### Task 3: Implement selection tracking + floating button

**Files:**
- Modify: `src/content.ts`

**Step 1: Add selection listener and floating button**

```ts
// Track selection changes and show a floating action button.
let fab: HTMLDivElement | null = null;

function ensureFab() {
  if (!fab) {
    fab = document.createElement("div");
    fab.className = "inline-translate-fab";
    fab.textContent = "Translate";
    fab.style.display = "none";
    document.body.appendChild(fab);
  }
  return fab;
}

function hideFab() {
  if (fab) {
    fab.style.display = "none";
  }
}

function showFabAt(x: number, y: number) {
  const el = ensureFab();
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.display = "block";
}

function getSelectionText() {
  const selection = window.getSelection();
  if (!selection) return "";
  return selection.toString().trim();
}

function onSelectionChange() {
  const text = getSelectionText();
  if (!text) {
    hideFab();
    return;
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  // Position the floating button slightly above the selection.
  const x = window.scrollX + rect.right;
  const y = window.scrollY + rect.top - 30;
  showFabAt(x, y);
}

document.addEventListener("selectionchange", onSelectionChange);

document.addEventListener("scroll", () => {
  // Hide on scroll to avoid drifting.
  hideFab();
});

document.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  if (!fab || target !== fab) {
    // Click elsewhere closes the button.
    hideFab();
  }
});
```

**Step 2: Build and manually verify**

Run: `npm run build`

Load extension in Chrome → select text → a “Translate” button appears near selection and disappears when clicking elsewhere.

**Step 3: Commit**

```bash
git add src/content.ts
git commit -m "feat: show translate action on selection"
```

---

### Task 4: Insert loading block and cancel behavior

**Files:**
- Modify: `src/content.ts`

**Step 1: Add helpers to find paragraph and insert placeholder**

```ts
function findClosestBlock(element: Node | null): HTMLElement | null {
  let current = element as HTMLElement | null;
  while (current && current !== document.body) {
    const tag = current.tagName?.toLowerCase();
    if (tag === "p" || tag === "div" || tag === "article") {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

function createLoadingBlock() {
  const block = document.createElement("div");
  block.className = "inline-translate-result inline-translate-loading";
  block.textContent = "Translating…";

  const cancel = document.createElement("span");
  cancel.className = "inline-translate-action";
  cancel.textContent = "Cancel";
  block.appendChild(cancel);

  return { block, cancel };
}
```

**Step 2: Wire click handler to insert placeholder**

```ts
let activeAbort: AbortController | null = null;

async function onTranslateClick() {
  const text = getSelectionText();
  if (!text) return;

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);

  const container = findClosestBlock(range.commonAncestorContainer);
  if (!container || !container.parentElement) return;

  const { block, cancel } = createLoadingBlock();
  container.parentElement.insertBefore(block, container.nextSibling);

  const controller = new AbortController();
  activeAbort = controller;

  cancel.addEventListener("click", () => {
    controller.abort();
    block.remove();
  });

  // We will fill translation in Task 5.
}

ensureFab().addEventListener("click", onTranslateClick);
```

**Step 3: Build and verify**

Run: `npm run build`

Expected: Clicking Translate inserts a “Translating…” block with Cancel.

**Step 4: Commit**

```bash
git add src/content.ts
git commit -m "feat: insert loading block with cancel"
```

---

### Task 5: Implement translation fetch + update-in-place

**Files:**
- Modify: `src/content.ts`

**Step 1: Add hash helper**

```ts
function hashText(text: string) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return String(hash);
}
```

**Step 2: Add translation fetch**

```ts
async function translateText(text: string, targetLang: string, signal: AbortSignal) {
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", "auto");
  url.searchParams.set("tl", targetLang);
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", text);

  const response = await fetch(url.toString(), { signal });
  if (!response.ok) throw new Error("Translation failed");

  const data = (await response.json()) as any[];
  // data[0] is an array of [translated, original, ...]
  const translated = data[0].map((chunk: any[]) => chunk[0]).join("");
  return translated;
}
```

**Step 3: Replace placeholder with translation or error**

```ts
async function onTranslateClick() {
  const text = getSelectionText();
  if (!text) return;

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);

  const container = findClosestBlock(range.commonAncestorContainer);
  if (!container || !container.parentElement) return;

  const sourceHash = hashText(text);
  const existing = container.parentElement.querySelector(
    `.inline-translate-result[data-source-hash="${sourceHash}"]`
  ) as HTMLElement | null;

  const { block, cancel } = createLoadingBlock();
  block.dataset.sourceHash = sourceHash;

  if (existing) {
    existing.replaceWith(block);
  } else {
    container.parentElement.insertBefore(block, container.nextSibling);
  }

  const controller = new AbortController();
  activeAbort = controller;

  cancel.addEventListener("click", () => {
    controller.abort();
    block.remove();
  });

  try {
    const { targetLang } = await chrome.storage.sync.get({ targetLang: "zh-CN" });
    const translated = await translateText(text, targetLang, controller.signal);
    block.classList.remove("inline-translate-loading");
    block.textContent = translated;
  } catch (err) {
    if ((err as Error).name === "AbortError") return;
    block.classList.remove("inline-translate-loading");
    block.textContent = "Translation failed (click to retry)";
    block.addEventListener("click", () => onTranslateClick(), { once: true });
  }
}
```

**Step 4: Build and manual test**

Run: `npm run build`

Expected: Translation appears below paragraph; repeated translation replaces content.

**Step 5: Commit**

```bash
git add src/content.ts
git commit -m "feat: translate selection and update inline"
```

---

### Task 6: Add timeout + cleanup on selection change

**Files:**
- Modify: `src/content.ts`

**Step 1: Add timeout wrapper**

```ts
function withTimeout(signal: AbortSignal, ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);

  signal.addEventListener("abort", () => controller.abort());

  return { signal: controller.signal, cleanup: () => clearTimeout(timer) };
}
```

**Step 2: Use timeout in translation call**

```ts
const timeout = withTimeout(controller.signal, 5000);
const translated = await translateText(text, targetLang, timeout.signal);
timeout.cleanup();
```

**Step 3: Hide floating button when selection cleared**

(Already handled in Task 3, ensure no regression)

**Step 4: Build and test**

Run: `npm run build`

Expected: slow response aborts after ~5s and shows error.

**Step 5: Commit**

```bash
git add src/content.ts
git commit -m "feat: add timeout for translation"
```

---

## Execution Handoff

Plan complete and saved to `docs/plans/2026-04-09-inline-translate-extension-implementation-plan.md`. Two execution options:

1. **Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

2. **Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
