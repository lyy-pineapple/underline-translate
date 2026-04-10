import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";

function findModuleSyntax(source) {
  const regex = /^\s*(import|export)\s/m;
  const match = regex.exec(source);
  if (!match) return null;
  const index = match.index;
  const line = source.slice(0, index).split("\n").length;
  return { keyword: match[1], line };
}

describe("dist bundle format", () => {
  it("does not emit ES module syntax in dist/*.js", () => {
    const distDir = path.resolve(process.cwd(), "dist");
    assert.ok(fs.existsSync(distDir), "dist directory does not exist; run build first");

    const jsFiles = fs.readdirSync(distDir).filter((file) => file.endsWith(".js"));
    assert.ok(jsFiles.length > 0, "dist directory contains no js files to validate");

    const offenders = [];
    for (const file of jsFiles) {
      const filePath = path.join(distDir, file);
      const source = fs.readFileSync(filePath, "utf-8");
      const match = findModuleSyntax(source);
      if (match) {
        offenders.push(`${file}:${match.line} (${match.keyword})`);
      }
    }

    assert.deepEqual(offenders, [], `ES module syntax found in dist JS: ${offenders.join(", ")}`);
  });
});
