import assert from "node:assert/strict";
import { describe, it } from "node:test";

const { JSDOM } = await import("jsdom");

function createDom(html) {
  const dom = new JSDOM(html);
  global.window = dom.window;
  global.document = dom.window.document;
  global.Node = dom.window.Node;
  global.HTMLElement = dom.window.HTMLElement;
  return dom;
}

function findClosestBlock(element) {
  let current = element;
  while (current && current !== document.body) {
    if (current.nodeType === Node.ELEMENT_NODE) {
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
    }
    current = current.parentElement;
  }
  return null;
}

function collectSelectedBlocks(range) {
  const startBlock = findClosestBlock(range.startContainer);
  const endBlock = findClosestBlock(range.endContainer);

  if (startBlock && endBlock && startBlock.parentElement === endBlock.parentElement && startBlock !== endBlock) {
    const blocks = [];
    let current = startBlock;
    while (current) {
      if (current instanceof HTMLElement) {
        blocks.push(current);
      }
      if (current === endBlock) break;
      current = current.nextElementSibling;
    }
    const mergedText = blocks.map((block) => (block.textContent || "").trim()).join("\n\n");
    return { blocks, mergedText, anchor: endBlock };
  }

  let anchor = endBlock || findClosestBlock(range.endContainer);
  if (!anchor) {
    const container = range.endContainer;
    anchor = container.nodeType === Node.ELEMENT_NODE ? container : container.parentElement;
  }
  return {
    blocks: anchor ? [anchor] : [],
    mergedText: range.toString().trim(),
    anchor
  };
}

function normalizeWhitespace(text) {
  return text.replace(/\s+/g, " ").trim();
}

describe("findClosestBlock", () => {
  it("returns li for list item selection", () => {
    createDom('<ul><li><a href="#x">Spark properties</a> text</li></ul>');
    const anchor = document.querySelector("a");
    const result = findClosestBlock(anchor);
    assert.equal(result.tagName.toLowerCase(), "li");
  });

  it("returns h1 for heading selection", () => {
    createDom('<h1 id="spark-properties">Spark Properties</h1>');
    const h1 = document.querySelector("h1");
    const result = findClosestBlock(h1);
    assert.equal(result.tagName.toLowerCase(), "h1");
  });

  it("returns ul when selection is within list items with line breaks", () => {
    createDom(`
      <ul>
        <li><a href="#a">A</a> text</li>
        <li><a href="#b">B</a> text</li>
      </ul>
    `);
    const ul = document.querySelector("ul");
    const result = findClosestBlock(ul);
    assert.equal(result.tagName.toLowerCase(), "ul");
  });
});

describe("collectSelectedBlocks", () => {
  it("merges multiline selection with \\n\\n separator", () => {
    createDom(`
      <div id="content">
        <p id="p1">First paragraph</p>
        <p id="p2">Second paragraph</p>
      </div>
    `);

    const p1 = document.getElementById("p1");
    const p2 = document.getElementById("p2");
    const range = document.createRange();
    range.setStart(p1.firstChild, 0);
    range.setEnd(p2.firstChild, p2.firstChild.length);

    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    const result = collectSelectedBlocks(range);

    assert.equal(result.blocks.length, 2);
    assert.equal(result.mergedText, "First paragraph\n\nSecond paragraph");
    assert.strictEqual(result.anchor, p2);
  });

  it("falls back to range text when blocks are not siblings", () => {
    createDom(`
      <div>
        <section><p id="p1">Alpha</p></section>
        <aside><p id="p2">Beta</p></aside>
      </div>
    `);

    const p1 = document.getElementById("p1");
    const p2 = document.getElementById("p2");
    const range = document.createRange();
    range.setStart(p1.firstChild, 0);
    range.setEnd(p2.firstChild, p2.firstChild.length);

    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    const result = collectSelectedBlocks(range);

    assert.equal(normalizeWhitespace(result.mergedText), "Alpha Beta");
    assert.strictEqual(result.anchor, p2);
  });
});
