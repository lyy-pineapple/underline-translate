export function findClosestBlock(element: Node | null): HTMLElement | null {
  let current = element as HTMLElement | null;
  while (current && current !== document.body) {
    const tag = current.tagName?.toLowerCase();
    if (
      tag === "p" ||
      tag === "div" ||
      tag === "article" ||
      tag === "section" ||
      tag === "main" ||
      tag === "blockquote" ||
      tag === "pre" ||
      tag === "code" ||
      tag === "td" ||
      tag === "th" ||
      tag === "li" ||
      tag === "ul" ||
      tag === "ol" ||
      tag === "h1" ||
      tag === "h2" ||
      tag === "h3" ||
      tag === "h4" ||
      tag === "h5" ||
      tag === "h6"
    ) {
      return current;
    }
    const display = window.getComputedStyle(current).display;
    if (display && display !== "inline" && display !== "inline-block" && display !== "contents") {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

export function ensureContainerId(container: HTMLElement): string {
  const existing = container.getAttribute("data-inline-translate-id");
  if (existing) return existing;
  const newId = `inline-${crypto.randomUUID()}`;
  container.setAttribute("data-inline-translate-id", newId);
  return newId;
}
