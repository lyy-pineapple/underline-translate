# Inline Translate Provider Settings Design

**Date:** 2026-04-09

## Goals
- Allow users to select translation provider (Google/Tencent/Youdao/Baidu) in the options page.
- Allow users to enter provider-specific API credentials in the options page.
- Default provider remains Google (free endpoint), no keys required.
- Store settings locally via `chrome.storage.local` (no sync).

## Non-Goals
- No backend proxy.
- No auto-failover across providers.
- No enterprise security guarantees (keys are client-side).

## Architecture
- **Options Page**: provider dropdown + dynamic key fields.
- **Storage**: `chrome.storage.local` for all provider settings.
- **Content Script**: reads provider + keys and routes translation accordingly.

## Data Model (local storage)
```ts
{
  provider: "google" | "tencent" | "youdao" | "baidu",
  targetLang: "zh-CN",
  tencent: { secretId: string, secretKey: string, region: string },
  youdao: { appKey: string, appSecret: string },
  baidu: { appId: string, appKey: string }
}
```

## UI / UX
- Provider dropdown (default: Google).
- Provider-specific key inputs shown when provider selected:
  - Tencent: SecretId, SecretKey, Region (default ap-guangzhou)
  - Youdao: AppKey, AppSecret
  - Baidu: AppId, AppKey
- Save button persists to local storage.
- Status text confirms save.

## Translation Routing
- Google: existing `translate.googleapis.com` flow.
- Youdao: POST `https://openapi.youdao.com/api` with v3 SHA-256 signature.
- Baidu: GET/POST `https://api.fanyi.baidu.com/api/trans/vip/translate` with MD5 signature.
- Tencent: POST `https://tmt.intl.tencentcloudapi.com` with TC3-HMAC-SHA256 signature.

## Error Handling
- Missing credentials for selected provider → show “Please configure API keys”.
- Request failure → show “Translation failed (click to retry)”.

## Security Notes
- Client-side keys are visible to the user; acceptable for personal use only.
- Recommend backend proxy for production use.

## Testing
- Manual: switch provider, save, reload, verify settings persisted.
- Manual: missing key error path.
- Manual: successful Google translation remains default.
