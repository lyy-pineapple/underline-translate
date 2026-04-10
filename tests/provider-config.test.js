import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import vm from "node:vm";

const { JSDOM } = await import("jsdom");

function loadContentScript({ chrome } = {}) {
  const dom = new JSDOM("<body></body>", { url: "https://example.com" });
  const context = {
    window: dom.window,
    document: dom.window.document,
    console,
    chrome
  };

  vm.createContext(context);
  const source = fs.readFileSync(new URL("../dist/content.js", import.meta.url), "utf-8");
  vm.runInContext(source, context);
  return context;
}

describe("loadProviderConfig", () => {
  it("falls back to defaults when chrome storage is unavailable", async () => {
    const context = loadContentScript();
    const config = await context.loadProviderConfig();

    assert.equal(config.provider, "google");
    assert.equal(config.targetLang, "zh-CN");
    assert.deepEqual(JSON.parse(JSON.stringify(config.tencent)), { secretId: "", secretKey: "", region: "ap-guangzhou" });
    assert.deepEqual(JSON.parse(JSON.stringify(config.youdao)), { appKey: "", appSecret: "" });
    assert.deepEqual(JSON.parse(JSON.stringify(config.baidu)), { appId: "", appKey: "" });
  });
});
