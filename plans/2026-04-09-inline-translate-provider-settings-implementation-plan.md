# Inline Translate Provider Settings Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add provider selection (Google/Tencent/Youdao/Baidu) and provider-specific API key inputs stored in chrome.storage.local, with translation routing based on provider.

**Architecture:** Options page saves provider + credentials to chrome.storage.local. Content script reads provider/keys and routes translation using provider-specific signing. Google remains default.

**Tech Stack:** Chrome Extension MV3, TypeScript, DOM APIs, Web Crypto (SHA-256), MD5 helper (lightweight).

---

### Task 1: Extend options UI for provider + keys

**Files:**
- Modify: `src/options.html`
- Modify: `src/options.ts`

**Step 1: Update `src/options.html` with provider select and key fields**

```html
<label>
  Provider:
  <select id="provider">
    <option value="google">Google (Free)</option>
    <option value="tencent">Tencent</option>
    <option value="youdao">Youdao</option>
    <option value="baidu">Baidu</option>
  </select>
</label>

<div id="providerFields">
  <div data-provider="tencent">
    <label>SecretId: <input id="tencentSecretId" type="text" /></label>
    <label>SecretKey: <input id="tencentSecretKey" type="password" /></label>
    <label>Region: <input id="tencentRegion" type="text" value="ap-guangzhou" /></label>
  </div>

  <div data-provider="youdao">
    <label>AppKey: <input id="youdaoAppKey" type="text" /></label>
    <label>AppSecret: <input id="youdaoAppSecret" type="password" /></label>
  </div>

  <div data-provider="baidu">
    <label>AppId: <input id="baiduAppId" type="text" /></label>
    <label>AppKey: <input id="baiduAppKey" type="password" /></label>
  </div>
</div>
```

**Step 2: Update `src/options.ts` to load/save local settings**

```ts
const providerSelect = document.getElementById("provider") as HTMLSelectElement;
const fields = document.getElementById("providerFields") as HTMLDivElement;

function showProviderFields(provider: string) {
  fields.querySelectorAll("[data-provider]").forEach((el) => {
    (el as HTMLElement).style.display = el.getAttribute("data-provider") === provider ? "block" : "none";
  });
}

chrome.storage.local.get({
  provider: "google",
  targetLang: "zh-CN",
  tencent: { secretId: "", secretKey: "", region: "ap-guangzhou" },
  youdao: { appKey: "", appSecret: "" },
  baidu: { appId: "", appKey: "" }
}, (items) => {
  providerSelect.value = items.provider;
  showProviderFields(items.provider);
  // assign values into inputs...
});

saveBtn.addEventListener("click", () => {
  chrome.storage.local.set({
    provider: providerSelect.value,
    targetLang: input.value.trim() || "zh-CN",
    tencent: { secretId: tencentSecretId.value, secretKey: tencentSecretKey.value, region: tencentRegion.value || "ap-guangzhou" },
    youdao: { appKey: youdaoAppKey.value, appSecret: youdaoAppSecret.value },
    baidu: { appId: baiduAppId.value, appKey: baiduAppKey.value }
  }, () => {
    statusEl.textContent = "Saved";
    setTimeout(() => statusEl.textContent = "", 1500);
  });
});
```

**Step 3: Run build**

Run: `npm run build`

Expected: build succeeds and dist/options.html updated.

**Step 4: Commit**

```bash
git add src/options.html src/options.ts
git commit -m "feat: add provider settings UI"
```

---

### Task 2: Add provider routing + signatures in content script

**Files:**
- Modify: `src/content.ts`

**Step 1: Add provider config types and local storage load**

```ts
type Provider = "google" | "tencent" | "youdao" | "baidu";

type ProviderConfig = {
  provider: Provider;
  targetLang: string;
  tencent: { secretId: string; secretKey: string; region: string };
  youdao: { appKey: string; appSecret: string };
  baidu: { appId: string; appKey: string };
};

async function loadProviderConfig(): Promise<ProviderConfig> {
  return await chrome.storage.local.get({
    provider: "google",
    targetLang: "zh-CN",
    tencent: { secretId: "", secretKey: "", region: "ap-guangzhou" },
    youdao: { appKey: "", appSecret: "" },
    baidu: { appId: "", appKey: "" }
  });
}
```

**Step 2: Add MD5 helper (Baidu)**

```ts
function md5(input: string): string {
  // Minimal JS MD5 implementation (single-file, no deps)
}
```

**Step 3: Add SHA-256 helper (Youdao)**

```ts
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}
```

**Step 4: Implement provider-specific translate functions**

```ts
async function translateWithYoudao(text: string, targetLang: string, keys: { appKey: string; appSecret: string }, signal: AbortSignal) { /* ... */ }
async function translateWithBaidu(text: string, targetLang: string, keys: { appId: string; appKey: string }, signal: AbortSignal) { /* ... */ }
async function translateWithTencent(text: string, targetLang: string, keys: { secretId: string; secretKey: string; region: string }, signal: AbortSignal) { /* ... */ }
```

**Step 5: Route by provider in `onTranslateClick`**

```ts
const config = await loadProviderConfig();
let translated = "";
if (config.provider === "google") {
  translated = await translateText(text, config.targetLang, timeout.signal);
} else if (config.provider === "youdao") {
  // validate keys then call translateWithYoudao
}
// ...
```

**Step 6: Run build**

Run: `npm run build`

Expected: build succeeds.

**Step 7: Commit**

```bash
git add src/content.ts
git commit -m "feat: add provider-based translation"
```

---

### Task 3: Verify settings + translation flow manually

**Files:**
- None (manual test)

**Step 1: Build and load extension**

Run: `npm run build`

Load unpacked extension from worktree.

**Step 2: Verify options storage**
- Set provider to Google → Save → reload options, values persist.
- Switch to Youdao → enter keys → Save → reload, values persist.

**Step 3: Verify translation route**
- Google: should translate without keys.
- Youdao/Baidu/Tencent: if keys missing, show error.

---

## Execution Handoff

Plan complete and saved to `docs/plans/2026-04-09-inline-translate-provider-settings-implementation-plan.md`. Two execution options:

1. **Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

2. **Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
