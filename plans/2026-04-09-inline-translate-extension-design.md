# Inline Translate Extension Design

**Date:** 2026-04-09

## Goals
- Provide a minimal Chrome extension that translates selected plain text on webpages.
- Insert the translation as a new paragraph directly below the source paragraph.
- Keep the UI simple: a floating action button on text selection, gray small-font translation, and update-in-place when retranslated.

## Non-Goals
- No PDF/iframe/video subtitle support.
- No rich-text or code block translation.
- No backend service or user accounts.

## Assumptions
- Target pages are standard articles with paragraph-level text nodes.
- Translation uses a free public API endpoint directly from the content script.

## Architecture
- **Manifest V3** extension.
- **Content Script** handles:
  - selection detection
  - floating action button
  - translation request
  - DOM insertion/update
- **Options Page (optional)** for target language and API endpoint overrides.
- **CSS injection** for translation styling.

## Interaction Flow
1. User selects text on a webpage.
2. Content script shows a floating button near the selection.
3. User clicks the button to translate.
4. A placeholder "Translating…" paragraph appears below the source paragraph.
5. On success, placeholder becomes the translated text.
6. If the same text is translated again, the existing translation paragraph updates.
7. User can cancel while translating (removes placeholder and aborts the request).

## DOM Insertion Strategy
- Use `window.getSelection()` and `Range` to locate the selection.
- Find the closest block-level ancestor (`p`, `div`, etc.) for insertion.
- Insert a sibling block element after the source block.
- Translation node structure:
  ```html
  <div class="inline-translate-result" data-source-hash="...">
    译文：...
  </div>
  ```
- Update logic:
  - Compute `hash(originalText)`.
  - If a sibling with the same `data-source-hash` exists, replace content.
  - Otherwise insert a new translation node.

## Translation API
- Call a free public translation API endpoint directly from the content script.
- Default parameters: `sl=auto`, `tl=zh-CN`.
- Use `AbortController` for cancellation and a 5s timeout.

## Loading + Cancel UI
- Insert a temporary translation block with "Translating…" and a "Cancel" action.
- Cancel removes the block and aborts the fetch.

## Error Handling
- API failure: replace placeholder with "Translation failed (click to retry)".
- DOM failure: show "Unable to locate paragraph" toast/inline note.
- Sanitize output: insert as text, not HTML, to avoid XSS.

## Permissions (MV3)
- `activeTab`, `scripting`, `storage`.
- `host_permissions` for the translation API domain.

## Styling
- Gray, small font, with left indentation aligned to source block.
- Minimal visual intrusion, no layout shift beyond the inserted block.

## Testing Plan
- Manual testing on:
  - Static article pages
  - Dynamic content pages (basic)
- Verify:
  - button appears on selection
  - translation inserts below correct paragraph
  - update-in-place behavior
  - cancel works
  - errors show correctly
