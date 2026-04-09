const input = document.getElementById("targetLang") as HTMLInputElement;
const statusEl = document.getElementById("status") as HTMLParagraphElement;
const saveBtn = document.getElementById("saveBtn") as HTMLButtonElement;
const providerSelect = document.getElementById("provider") as HTMLSelectElement;
const fields = document.getElementById("providerFields") as HTMLDivElement;

// Tencent Cloud inputs
const tencentSecretId = document.getElementById("tencentSecretId") as HTMLInputElement;
const tencentSecretKey = document.getElementById("tencentSecretKey") as HTMLInputElement;
const tencentRegion = document.getElementById("tencentRegion") as HTMLInputElement;

// Youdao inputs
const youdaoAppKey = document.getElementById("youdaoAppKey") as HTMLInputElement;
const youdaoAppSecret = document.getElementById("youdaoAppSecret") as HTMLInputElement;

// Baidu inputs
const baiduAppId = document.getElementById("baiduAppId") as HTMLInputElement;
const baiduAppKey = document.getElementById("baiduAppKey") as HTMLInputElement;

/**
 * Show or hide provider-specific input fields based on the selected provider.
 * @param provider The value of the selected provider.
 */
function showProviderFields(provider: string) {
  fields.querySelectorAll("[data-provider]").forEach((el) => {
    (el as HTMLElement).style.display = el.getAttribute("data-provider") === provider ? "block" : "none";
  });
}

// Load stored settings on page load from chrome.storage.local.
chrome.storage.local.get({
  provider: "google",
  targetLang: "zh-CN",
  tencent: { secretId: "", secretKey: "", region: "ap-guangzhou" },
  youdao: { appKey: "", appSecret: "" },
  baidu: { appId: "", appKey: "" }
}, (items) => {
  if (input) input.value = items.targetLang;
  if (providerSelect) {
    providerSelect.value = items.provider;
    showProviderFields(items.provider);
  }

  // Assign values into inputs for provider-specific fields
  if (tencentSecretId) tencentSecretId.value = items.tencent.secretId;
  if (tencentSecretKey) tencentSecretKey.value = items.tencent.secretKey;
  if (tencentRegion) tencentRegion.value = items.tencent.region;

  if (youdaoAppKey) youdaoAppKey.value = items.youdao.appKey;
  if (youdaoAppSecret) youdaoAppSecret.value = items.youdao.appSecret;

  if (baiduAppId) baiduAppId.value = items.baidu.appId;
  if (baiduAppKey) baiduAppKey.value = items.baidu.appKey;
});

// Update visibility when provider changes.
if (providerSelect) {
  providerSelect.addEventListener("change", () => {
    showProviderFields(providerSelect.value);
  });
}

// Save all provider settings when user clicks save.
if (saveBtn) {
  saveBtn.addEventListener("click", () => {
    const targetLangValue = input ? input.value.trim() : "zh-CN";
    chrome.storage.local.set({
      provider: providerSelect.value,
      targetLang: targetLangValue || "zh-CN",
      tencent: { 
        secretId: tencentSecretId.value, 
        secretKey: tencentSecretKey.value, 
        region: tencentRegion.value || "ap-guangzhou" 
      },
      youdao: { appKey: youdaoAppKey.value, appSecret: youdaoAppSecret.value },
      baidu: { appId: baiduAppId.value, appKey: baiduAppKey.value }
    }, () => {
      if (statusEl) {
        statusEl.textContent = "Saved";
        setTimeout(() => {
          statusEl.textContent = "";
        }, 1500);
      }
    });
  });
}
