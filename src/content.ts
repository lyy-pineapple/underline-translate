/**
  * Underline Translate Content Script
 * 
 * This script is responsible for:
 * 1. Monitoring user text selections on the web page.
 * 2. Displaying a floating "Translate" button near the selected text.
 * 3. Fetching translations from the Google Translate API when requested.
 * 4. Inserting the translated text directly into the page's DOM, 
 *    positioned appropriately below the relevant paragraph.
 * 
 * Future tasks will implement the core logic for selection tracking,
 * UI management, and API integration.
 */

// Initial entry point for the content script.
// This log confirms the script has been successfully injected into the page.
console.log("Underline Translate content script initialized and loaded.");

type Provider = "google" | "tencent" | "youdao" | "baidu";

type ProviderConfig = {
  provider: Provider;
  targetLang: string;
  tencent: { secretId: string; secretKey: string; region: string };
  youdao: { appKey: string; appSecret: string };
  baidu: { appId: string; appKey: string };
};

/**
 * Loads the translation provider configuration from local storage.
 */
async function loadProviderConfig(): Promise<ProviderConfig> {
  const items = await chrome.storage.local.get({
    provider: "google",
    targetLang: "zh-CN",
    tencent: { secretId: "", secretKey: "", region: "ap-guangzhou" },
    youdao: { appKey: "", appSecret: "" },
    baidu: { appId: "", appKey: "" }
  });
  return items as ProviderConfig;
}

// Track the floating action button (FAB) element.
// Using a module-level variable to keep a single instance of the button.
let fab: HTMLDivElement | null = null;

// Keep the most recent selection so the user can click the FAB without
// losing the selection text (mouseup/click can clear multi-line selections).
let lastSelectionText = "";
let lastSelectionRange: Range | null = null;

/**
 * Ensures that the floating action button exists in the DOM.
 * If it doesn't exist, it creates it with the necessary class and text.
 * @returns The floating action button element.
 */
function ensureFab(): HTMLDivElement {
  if (!fab) {
    // Create the button element.
    fab = document.createElement("div");
    // Set the CSS class defined in styles.css for consistent UI.
    fab.className = "inline-translate-fab";
    // The text label for the button.
    fab.textContent = "Translate";
    // Initially hidden until text is selected.
    fab.style.display = "none";
    // Append to document.body so it can be positioned anywhere.
    document.body.appendChild(fab);
  }
  return fab;
}

/**
 * Hides the floating action button from view.
 */
function hideFab() {
  if (fab) {
    fab.style.display = "none";
  }
}

/**
 * Positions and shows the floating action button at the specified coordinates.
 * @param x The horizontal coordinate (pixels).
 * @param y The vertical coordinate (pixels).
 */
function showFabAt(x: number, y: number) {
  const el = ensureFab();
  // Set absolute position based on scroll-aware coordinates.
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  // Make the button visible.
  el.style.display = "block";
}

/**
 * Retrieves the currently selected text string, trimmed of whitespace.
 * @returns The selected text or an empty string if nothing is selected.
 */
function getSelectionText(): string {
  const selection = window.getSelection();
  if (!selection) return "";
  return selection.toString().trim();
}

/**
 * Stores the latest selection text and range so we can use them after
 * the user clicks the floating button (the browser may clear selection).
 */
function captureSelectionSnapshot() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    lastSelectionText = "";
    lastSelectionRange = null;
    return;
  }

  const text = selection.toString().trim();
  if (!text) {
    lastSelectionText = "";
    lastSelectionRange = null;
    return;
  }

  // Clone the range to avoid mutation when the live selection changes.
  lastSelectionText = text;
  lastSelectionRange = selection.getRangeAt(0).cloneRange();
}

/**
 * Event handler triggered whenever the user's text selection changes.
 * It calculates the position for the FAB and shows it near the selection.
 */
function onSelectionChange() {
  const text = getSelectionText();

  // If no text is selected, hide the FAB and clear snapshots.
  if (!text) {
    lastSelectionText = "";
    lastSelectionRange = null;
    hideFab();
    return;
  }

  const selection = window.getSelection();
  // Ensure we have a valid selection and at least one range.
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  // Capture a stable snapshot for later use (multi-line selections often clear on click).
  captureSelectionSnapshot();

  // Get the bounding box of the selected text range.
  const rect = range.getBoundingClientRect();

  /**
   * Position the floating button near the selection.
   * rect.right: right edge of selection
   * rect.top: top edge of selection
   * window.scrollX/scrollY: adjust for page scrolling
   * -30: offset upward to avoid overlapping the text
   */
  const x = window.scrollX + rect.right;
  const y = window.scrollY + rect.top - 30;

  showFabAt(x, y);
}

// Register listeners for selection changes and other UI interactions.

// Listen for selection changes to show/hide the FAB.
document.addEventListener("selectionchange", onSelectionChange);

// Hide the FAB when the user scrolls to prevent it from drifting away from the selection.
document.addEventListener("scroll", () => {
  hideFab();
});

// Hide the FAB if the user clicks anywhere else on the page.
// NOTE: A mouseup after selection can trigger a click event on the page.
// We only hide the FAB when there is no active selection to avoid hiding
// it immediately after a user finishes selecting text.
document.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  if (!fab || target !== fab) {
    // If there is still selected text, keep the FAB visible so the user can click it.
    // Also check the last snapshot to cover multi-line selections that are cleared.
    const stillSelected = getSelectionText() || lastSelectionText;
    if (!stillSelected) {
      hideFab();
    }
  }
});

/**
 * Finds the closest parent block-level element (paragraph, div, article) 
 * for a given DOM node.
 * This is used to determine where to insert the translated content.
 * @param element The DOM node to start searching from.
 * @returns The parent element if found, otherwise null.
 */
function findClosestBlock(element: Node | null): HTMLElement | null {
  let current = element as HTMLElement | null;
  while (current && current !== document.body) {
    const tag = current.tagName?.toLowerCase();
    // Common block-level tags where translation can be inserted.
    if (tag === "p" || tag === "div" || tag === "article") {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

/**
 * Creates a loading indicator block with a cancel action.
 * This block is inserted while waiting for the translation to complete.
 * @returns An object containing the block element and the cancel span.
 */
function createLoadingBlock() {
  const block = document.createElement("div");
  // Classes from styles.css for consistent appearance.
  block.className = "inline-translate-result inline-translate-loading";
  block.textContent = "Translating…";

  // Create a clickable span to allow the user to cancel the operation.
  const cancel = document.createElement("span");
  cancel.className = "inline-translate-action";
  cancel.textContent = "Cancel";
  block.appendChild(cancel);

  return { block, cancel };
}

/**
 * Generates a simple hash for a given text string.
 * This is used to uniquely identify source paragraphs and manage 
 * update-in-place behavior for translations.
 * @param text The source text to hash.
 * @returns A string representation of the 32-bit hash.
 */
function hashText(text: string): string {
  let hash = 0;
  // Simple polynomial hash function (similar to Java's String.hashCode).
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    // Force the hash to be a 32-bit signed integer.
    hash |= 0;
  }
  return String(hash);
}

/**
 * Ensures that a container element has a unique ID for tracking translations.
 * If no ID exists, a new one is generated and stored in a data attribute.
 * @param container The element to identify.
 * @returns The unique container ID.
 */
function ensureContainerId(container: HTMLElement): string {
  const existing = container.getAttribute("data-inline-translate-id");
  if (existing) return existing;
  const newId = `inline-${crypto.randomUUID()}`;
  container.setAttribute("data-inline-translate-id", newId);
  return newId;
}

/**
 * Minimal MD5 implementation for Baidu API signature.
 * IMPORTANT: Hash input must be UTF-8 bytes (not UTF-16 code units).
 */
function md5(input: string): string {
  const bytes = new TextEncoder().encode(input);

  function md5_Cycle(x: number[], k: number[]) {
    let a = x[0], b = x[1], c = x[2], d = x[3];

    a = ff(a, b, c, d, k[0], 7, -680876936);
    d = ff(d, a, b, c, k[1], 12, -389564586);
    c = ff(c, d, a, b, k[2], 17, 606105819);
    b = ff(b, c, d, a, k[3], 22, -1044525330);
    a = ff(a, b, c, d, k[4], 7, -176418897);
    d = ff(d, a, b, c, k[5], 12, 1200080426);
    c = ff(c, d, a, b, k[6], 17, -1473231341);
    b = ff(b, c, d, a, k[7], 22, -45705983);
    a = ff(a, b, c, d, k[8], 7, 1770035416);
    d = ff(d, a, b, c, k[9], 12, -1958414417);
    c = ff(c, d, a, b, k[10], 17, -42063);
    b = ff(b, c, d, a, k[11], 22, -1990404162);
    a = ff(a, b, c, d, k[12], 7, 1804603682);
    d = ff(d, a, b, c, k[13], 12, -40341101);
    c = ff(c, d, a, b, k[14], 17, -1502002290);
    b = ff(b, c, d, a, k[15], 22, 1236535329);

    a = gg(a, b, c, d, k[1], 5, -165796510);
    d = gg(d, a, b, c, k[6], 9, -1069501632);
    c = gg(c, d, a, b, k[11], 14, 643717713);
    b = gg(b, c, d, a, k[0], 20, -373897302);
    a = gg(a, b, c, d, k[5], 5, -701558691);
    d = gg(d, a, b, c, k[10], 9, 38016083);
    c = gg(c, d, a, b, k[15], 14, -660478335);
    b = gg(b, c, d, a, k[4], 20, -405537848);
    a = gg(a, b, c, d, k[9], 5, 568446438);
    d = gg(d, a, b, c, k[14], 9, -1019803690);
    c = gg(c, d, a, b, k[3], 14, -187363961);
    b = gg(b, c, d, a, k[8], 20, 1163531501);
    a = gg(a, b, c, d, k[13], 5, -1444681467);
    d = gg(d, a, b, c, k[2], 9, -51403784);
    c = gg(c, d, a, b, k[7], 14, 1735328473);
    b = gg(b, c, d, a, k[12], 20, -1926607734);

    a = hh(a, b, c, d, k[5], 4, -378558);
    d = hh(d, a, b, c, k[8], 11, -2022574463);
    c = hh(c, d, a, b, k[11], 16, 1839030562);
    b = hh(b, c, d, a, k[14], 23, -35309556);
    a = hh(a, b, c, d, k[1], 4, -1530992060);
    d = hh(d, a, b, c, k[4], 11, 1272893353);
    c = hh(c, d, a, b, k[7], 16, -155497632);
    b = hh(b, c, d, a, k[10], 23, -1094730640);
    a = hh(a, b, c, d, k[13], 4, 681279174);
    d = hh(d, a, b, c, k[0], 11, -358537222);
    c = hh(c, d, a, b, k[3], 16, -722521979);
    b = hh(b, c, d, a, k[6], 23, 76029189);
    a = hh(a, b, c, d, k[9], 4, -640364487);
    d = hh(d, a, b, c, k[12], 11, -421815835);
    c = hh(c, d, a, b, k[15], 16, 530742520);
    b = hh(b, c, d, a, k[2], 23, -995338651);

    a = ii(a, b, c, d, k[0], 6, -198630844);
    d = ii(d, a, b, c, k[7], 10, 1126891415);
    c = ii(c, d, a, b, k[14], 15, -1416354905);
    b = ii(b, c, d, a, k[5], 21, -57434055);
    a = ii(a, b, c, d, k[12], 6, 1700485571);
    d = ii(d, a, b, c, k[3], 10, -1894986606);
    c = ii(c, d, a, b, k[10], 15, -1051523);
    b = ii(b, c, d, a, k[1], 21, -2054922799);
    a = ii(a, b, c, d, k[8], 6, 1873313359);
    d = ii(d, a, b, c, k[15], 10, -30611744);
    c = ii(c, d, a, b, k[6], 15, -1560198380);
    b = ii(b, c, d, a, k[13], 21, 1309151649);
    a = ii(a, b, c, d, k[4], 6, -145523070);
    d = ii(d, a, b, c, k[11], 10, -112021037);
    c = ii(c, d, a, b, k[2], 15, 718787259);
    b = ii(b, c, d, a, k[9], 21, -343485551);

    x[0] = add32(a, x[0]);
    x[1] = add32(b, x[1]);
    x[2] = add32(c, x[2]);
    x[3] = add32(d, x[3]);
  }

  function cmn(q: number, a: number, b: number, x: number, s: number, t: number) {
    a = add32(add32(a, q), add32(x, t));
    return add32((a << s) | (a >>> (32 - s)), b);
  }

  function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn((b & c) | ((~b) & d), a, b, x, s, t);
  }

  function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn((b & d) | (c & (~d)), a, b, x, s, t);
  }

  function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn(b ^ c ^ d, a, b, x, s, t);
  }

  function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn(c ^ (b | (~d)), a, b, x, s, t);
  }

  function add32(a: number, b: number) {
    return (a + b) & 0xFFFFFFFF;
  }

  function md5_blk(chunk: Uint8Array) {
    const md5_blks = new Array<number>(16);
    for (let i = 0; i < 64; i += 4) {
      md5_blks[i >> 2] =
        (chunk[i] ?? 0) |
        ((chunk[i + 1] ?? 0) << 8) |
        ((chunk[i + 2] ?? 0) << 16) |
        ((chunk[i + 3] ?? 0) << 24);
    }
    return md5_blks;
  }

  function md5_1(data: Uint8Array) {
    const n = data.length;
    const state = [1732584193, -271733879, -1732584194, 271733878];
    let i = 64;

    for (; i <= n; i += 64) {
      md5_Cycle(state, md5_blk(data.subarray(i - 64, i)));
    }

    const remaining = data.subarray(i - 64);
    const tail = new Uint8Array(64);
    tail.set(remaining, 0);
    tail[remaining.length] = 0x80;

    if (remaining.length > 55) {
      md5_Cycle(state, md5_blk(tail));
      tail.fill(0);
    }

    const bitLen = n * 8;
    const bitLenLow = bitLen >>> 0;
    const bitLenHigh = Math.floor(bitLen / 0x100000000);

    tail[56] = bitLenLow & 0xFF;
    tail[57] = (bitLenLow >>> 8) & 0xFF;
    tail[58] = (bitLenLow >>> 16) & 0xFF;
    tail[59] = (bitLenLow >>> 24) & 0xFF;
    tail[60] = bitLenHigh & 0xFF;
    tail[61] = (bitLenHigh >>> 8) & 0xFF;
    tail[62] = (bitLenHigh >>> 16) & 0xFF;
    tail[63] = (bitLenHigh >>> 24) & 0xFF;

    md5_Cycle(state, md5_blk(tail));
    return state;
  }

  const hex_chr = "0123456789abcdef";
  function rhex(n: number) {
    let s = "";
    for (let j = 0; j <= 3; j += 1) {
      s += hex_chr.charAt((n >> (j * 8 + 4)) & 0x0F) + hex_chr.charAt((n >> (j * 8)) & 0x0F);
    }
    return s;
  }

  const a = md5_1(bytes);
  return rhex(a[0]) + rhex(a[1]) + rhex(a[2]) + rhex(a[3]);
}

/**
 * Computes the SHA-256 hash of a string and returns it as a hex string.
 */
function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(view.byteLength);
  new Uint8Array(buffer).set(view);
  return buffer;
}

async function sha256Hex(input: string | Uint8Array): Promise<string> {
  const dataView = typeof input === "string" ? new TextEncoder().encode(input) : input;
  const hash = await crypto.subtle.digest("SHA-256", toArrayBuffer(dataView));
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Computes the HMAC-SHA256 signature.
 */
async function hmacSha256(key: CryptoKey | Uint8Array, message: Uint8Array | string): Promise<Uint8Array> {
  let cryptoKey: CryptoKey;
  if (key instanceof Uint8Array) {
    cryptoKey = await crypto.subtle.importKey("raw", toArrayBuffer(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  } else {
    cryptoKey = key;
  }
  const dataView = typeof message === "string" ? new TextEncoder().encode(message) : message;
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, toArrayBuffer(dataView));
  return new Uint8Array(signature);
}

/**
 * Fetches the translation for a given text from the Google Translate API.
 * This uses the 'single' endpoint which is reliable for simple extensions.
 * @param text The source text to translate.
 * @param targetLang The destination language code (e.g., 'zh-CN', 'en').
 * @param signal An AbortSignal to allow cancelling the fetch operation.
 * @returns A promise that resolves with the translated string.
 */
async function translateText(text: string, targetLang: string, signal: AbortSignal): Promise<string> {
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  // Set parameters for the free gtx client.
  url.searchParams.set("client", "gtx");
  // Auto-detect the source language.
  url.searchParams.set("sl", "auto");
  // Set the target language from user options.
  url.searchParams.set("tl", targetLang);
  // 'dt=t' specifies that we want the text translation in the response.
  url.searchParams.set("dt", "t");
  // The query text to be translated.
  url.searchParams.set("q", text);

  // Perform the fetch request with the provided abort signal.
  const response = await fetch(url.toString(), { signal });
  if (!response.ok) {
    throw new Error(`Translation request failed with status: ${response.status}`);
  }

  // The API returns a nested array where the first element contains translation chunks.
  const data = (await response.json()) as any[];
  // Reconstruct the full translated string by joining individual chunks.
  // Each chunk is an array where the first item is the translated text.
  const translated = data[0].map((chunk: any[]) => chunk[0]).join("");
  return translated;
}

/**
 * Fetches the translation for a given text from the Baidu Translate API.
 * @param text The source text to translate.
 * @param targetLang The destination language code.
 * @param keys The Baidu AppId and AppKey.
 * @param signal An AbortSignal to allow cancelling the fetch operation.
 * @returns A promise that resolves with the translated string.
 */
async function translateWithBaidu(text: string, targetLang: string, keys: { appId: string; appKey: string }, signal: AbortSignal): Promise<string> {
  const salt = Date.now().toString();
  // Baidu uses 'zh' for simplified Chinese.
  const baiduTarget = targetLang === "zh-CN" ? "zh" : targetLang;
  const sign = md5(keys.appId + text + salt + keys.appKey);
  
  const url = new URL("https://api.fanyi.baidu.com/api/trans/vip/translate");
  url.searchParams.set("q", text);
  url.searchParams.set("from", "auto");
  url.searchParams.set("to", baiduTarget);
  url.searchParams.set("appid", keys.appId);
  url.searchParams.set("salt", salt);
  url.searchParams.set("sign", sign);

  const response = await fetch(url.toString(), { signal });
  const data = await response.json();
  if (data.error_code) {
    throw new Error(`Baidu API error: ${data.error_msg}`);
  }
  return data.trans_result.map((r: any) => r.dst).join("\n");
}

/**
 * Fetches the translation for a given text from the Youdao Translate API.
 * @param text The source text to translate.
 * @param targetLang The destination language code.
 * @param keys The Youdao AppKey and AppSecret.
 * @param signal An AbortSignal to allow cancelling the fetch operation.
 * @returns A promise that resolves with the translated string.
 */
async function translateWithYoudao(text: string, targetLang: string, keys: { appKey: string; appSecret: string }, signal: AbortSignal): Promise<string> {
  const salt = crypto.randomUUID();
  const curtime = Math.round(Date.now() / 1000).toString();
  // Youdao uses 'zh-CHS' for simplified Chinese.
  const youdaoTarget = targetLang === "zh-CN" ? "zh-CHS" : targetLang;
  
  const truncate = (q: string) => {
    const len = q.length;
    if (len <= 20) return q;
    return q.substring(0, 10) + len + q.substring(len - 10, len);
  };
  
  const input = keys.appKey + truncate(text) + salt + curtime + keys.appSecret;
  const sign = await sha256Hex(input);
  
  const body = new URLSearchParams();
  body.set("q", text);
  body.set("from", "auto");
  body.set("to", youdaoTarget);
  body.set("appKey", keys.appKey);
  body.set("salt", salt);
  body.set("sign", sign);
  body.set("signType", "v3");
  body.set("curtime", curtime);

  const response = await fetch("https://openapi.youdao.com/api", {
    method: "POST",
    body,
    signal
  });
  const data = await response.json();
  if (data.errorCode !== "0") {
    throw new Error(`Youdao API error: ${data.errorCode}`);
  }
  return data.translation.join("\n");
}

/**
 * Fetches the translation for a given text from the Tencent TMT API (V3 Signature).
 * @param text The source text to translate.
 * @param targetLang The destination language code.
 * @param keys The Tencent SecretId, SecretKey and Region.
 * @param signal An AbortSignal to allow cancelling the fetch operation.
 * @returns A promise that resolves with the translated string.
 */
async function translateWithTencent(text: string, targetLang: string, keys: { secretId: string; secretKey: string; region: string }, signal: AbortSignal): Promise<string> {
  const host = "tmt.intl.tencentcloudapi.com";
  const service = "tmt";
  const region = keys.region || "ap-guangzhou";
  const action = "TextTranslate";
  const version = "2018-03-21";
  const timestamp = Math.round(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  
  // Tencent uses 'zh' for simplified Chinese.
  const tencentTarget = targetLang === "zh-CN" ? "zh" : targetLang;

  const payload = JSON.stringify({
    SourceText: text,
    Source: "auto",
    Target: tencentTarget,
    ProjectId: 0
  });

  const canonicalRequest = 
    "POST\n" +
    "/\n" +
    "\n" +
    "content-type:application/json; charset=utf-8\n" +
    "host:" + host + "\n" +
    "x-tc-action:" + action + "\n" +
    "\n" +
    "content-type;host;x-tc-action\n" +
    await sha256Hex(payload);

  const credentialScope = date + "/" + service + "/tc3_request";
  const stringToSign = 
    "TC3-HMAC-SHA256\n" +
    timestamp + "\n" +
    credentialScope + "\n" +
    await sha256Hex(canonicalRequest);

  const kDate = await hmacSha256(new TextEncoder().encode("TC3" + keys.secretKey), date);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, "tc3_request");
  const signature = Array.from(await hmacSha256(kSigning, stringToSign)).map(b => b.toString(16).padStart(2, "0")).join("");

  const authorization = 
    "TC3-HMAC-SHA256 " +
    "Credential=" + keys.secretId + "/" + credentialScope + ", " +
    "SignedHeaders=content-type;host;x-tc-action, " +
    "Signature=" + signature;

  const response = await fetch("https://" + host, {
    method: "POST",
    headers: {
      "Authorization": authorization,
      "Content-Type": "application/json; charset=utf-8",
      "Host": host,
      "X-TC-Action": action,
      "X-TC-Timestamp": timestamp.toString(),
      "X-TC-Version": version,
      "X-TC-Region": region
    },
    body: payload,
    signal
  });
  
  const data = await response.json();
  if (data.Response.Error) {
    throw new Error(`Tencent API error: ${data.Response.Error.Message}`);
  }
  return data.Response.TargetText;
}

/**
 * Global variable to hold the current translation's AbortController.
 * This allows the user to cancel a pending translation request.
 */
let activeAbort: AbortController | null = null;

/**
 * Wraps an AbortSignal with a timeout. 
 * If the timer fires before the original signal aborts, it aborts the new signal.
 * This is used to ensure translation requests don't hang indefinitely.
 * @param signal The original AbortSignal to follow.
 * @param ms The timeout duration in milliseconds.
 * @returns An object containing the new signal and a cleanup function to clear the timer.
 */
function withTimeout(signal: AbortSignal, ms: number) {
  // Create a new controller for the timeout behavior.
  const controller = new AbortController();
  // Set the timer to abort the new controller after 'ms' milliseconds.
  const timer = setTimeout(() => controller.abort(), ms);

  // If the original signal is aborted, ensure the new controller is also aborted.
  signal.addEventListener("abort", () => controller.abort());

  return { 
    signal: controller.signal, 
    // Return a cleanup function to clear the timer if the request finishes early.
    cleanup: () => clearTimeout(timer) 
  };
}

/**
 * Handles clicks on the floating "Translate" button.
 * It identifies the selection, finds the target block, fetches the translation,
 * and updates the DOM in-place.
 */
async function onTranslateClick() {
  // Prefer the live selection, but fall back to the last snapshot to
  // handle cases where the selection is cleared on mouseup (multi-line).
  const text = getSelectionText() || lastSelectionText;
  if (!text) return;

  const selection = window.getSelection();
  let range: Range | null = null;

  if (selection && selection.rangeCount > 0) {
    range = selection.getRangeAt(0);
  } else if (lastSelectionRange) {
    range = lastSelectionRange;
  }

  if (!range) return;

  // Locate the paragraph or container for the selected text.
  // The translation will be inserted right after this element.
  const container = findClosestBlock(range.commonAncestorContainer);
  if (!container || !container.parentElement) return;

  // Ensure the container has a stable ID for deduplication.
  const containerId = ensureContainerId(container);

  // Generate a unique hash for the selected text.
  // This allows us to find and replace existing translations for the same text.
  const sourceHash = hashText(text);

  /**
   * Search for an existing translation block with the same hash and container ID.
   * If found, we'll replace it (update-in-place).
   */
  const existing = container.parentElement.querySelector(
    `.inline-translate-result[data-source-hash="${sourceHash}"][data-source-container-id="${containerId}"]`
  ) as HTMLElement | null;

  // Create the loading indicator block.
  const { block, cancel } = createLoadingBlock();
  // Assign the hash and container ID to the block's data attributes for future identification.
  block.dataset.sourceHash = sourceHash;
  block.dataset.sourceContainerId = containerId;

  // Perform the update-in-place or insertion.
  if (existing) {
    // If a translation for this text already exists, replace it with the loading block.
    existing.replaceWith(block);
  } else {
    // Otherwise, insert the loading block immediately after the source block.
    container.parentElement.insertBefore(block, container.nextSibling);
  }

  // Initialize an AbortController for potential cancellation of the fetch.
  const controller = new AbortController();
  activeAbort = controller;

  // Wire up the cancel button to abort the request and remove the UI.
  cancel.addEventListener("click", () => {
    controller.abort();
    block.remove();
    // Reset the active abort if it's the one we just cancelled.
    if (activeAbort === controller) {
      activeAbort = null;
    }
  });

  try {
    // Retrieve the provider configuration from chrome.storage.local.
    const config = await loadProviderConfig();
    const targetLang = config.targetLang;

    // Create a 10-second timeout wrapper around the active signal.
    const timeout = withTimeout(controller.signal, 10000);

    try {
      let translated = "";
      
      // Route the translation request based on the selected provider.
      if (config.provider === "google") {
        translated = await translateText(text, targetLang, timeout.signal);
      } else if (config.provider === "baidu") {
        if (!config.baidu.appId || !config.baidu.appKey) {
          throw new Error("Baidu AppId or AppKey is missing. Please check options.");
        }
        translated = await translateWithBaidu(text, targetLang, config.baidu, timeout.signal);
      } else if (config.provider === "youdao") {
        if (!config.youdao.appKey || !config.youdao.appSecret) {
          throw new Error("Youdao AppKey or AppSecret is missing. Please check options.");
        }
        translated = await translateWithYoudao(text, targetLang, config.youdao, timeout.signal);
      } else if (config.provider === "tencent") {
        if (!config.tencent.secretId || !config.tencent.secretKey) {
          throw new Error("Tencent SecretId or SecretKey is missing. Please check options.");
        }
        translated = await translateWithTencent(text, targetLang, config.tencent, timeout.signal);
      } else {
        throw new Error(`Unsupported translation provider: ${config.provider}`);
      }

      // Update the block with the translated text and remove the loading style.
      block.classList.remove("inline-translate-loading");
      block.textContent = translated;

      // Add a "Remove" action to allow users to dismiss the translation block.
      const remove = document.createElement("span");
      remove.className = "inline-translate-remove";
      remove.textContent = "Remove";
      remove.addEventListener("click", () => block.remove());
      block.appendChild(remove);
    } finally {
      // Always cleanup the timeout timer.
      timeout.cleanup();
    }
  } catch (err) {
    // If the request was aborted by the user, we don't need to show an error.
    if ((err as Error).name === "AbortError") return;

    console.error("Translation error:", err);

    // Display a helpful error message and provide a way to retry by clicking the block.
    block.classList.remove("inline-translate-loading");

    const message = err instanceof Error && err.message
      ? err.message
      : "Translation failed (click to retry)";

    block.textContent = message;

    // Add a one-time click listener to retry the translation.
    block.addEventListener("click", () => {
      onTranslateClick();
    }, { once: true });
  } finally {
    // Clear the active abort controller when the process finishes or fails.
    if (activeAbort === controller) {
      activeAbort = null;
    }
  }
}

// Wire the floating button click to the translation handler.
ensureFab().addEventListener("click", onTranslateClick);
