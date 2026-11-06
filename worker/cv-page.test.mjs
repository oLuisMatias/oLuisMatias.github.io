// The CV page layout (src/data/cv-page.yml). Run: npm test
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { build } from "esbuild";

let page;

before(async () => {
  const out = await build({ entryPoints: ["src/lib/cv-page.ts"], bundle: true, format: "esm", platform: "browser", write: false, logLevel: "silent" });
  page = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString("base64")}`);
});

test("an empty or broken file gives two columns", () => {
  for (const text of ["", "null", "- a", "certColumns: 9\n", "certColumns: x\n"]) assert.equal(page.parseCvPage(text).certColumns, 2);
});

test("1 to 3 columns are kept and written back", () => {
  for (const n of [1, 2, 3]) assert.equal(page.parseCvPage(page.stringifyCvPage({ certColumns: n })).certColumns, n);
});

test("the real cv-page.yml reads", () => {
  assert.ok([1, 2, 3].includes(page.parseCvPage(fs.readFileSync("src/data/cv-page.yml", "utf8")).certColumns));
});
