import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findClosestBlock } from "../dist/dom-helpers.js";

const { JSDOM } = await import("jsdom");

function createDom(html) {
  const dom = new JSDOM(html);
  global.window = dom.window;
  global.document = dom.window.document;
  return dom;
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
