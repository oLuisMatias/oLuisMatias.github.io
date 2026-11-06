// The Projects page settings (src/data/projects-page.yml) and the date order of the projects. Run: npm test
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import YAML from "yaml";
import { build } from "esbuild";

let page;

before(async () => {
  const out = await build({ entryPoints: ["src/lib/projects-page.ts"], bundle: true, format: "esm", platform: "browser", write: false, logLevel: "silent" });
  page = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString("base64")}`);
});

test("an empty or broken file gives the defaults", () => {
  for (const text of ["", "null", "- a", "columns: 9\nsort: sideways\n"]) {
    const p = page.parseProjectsPage(text);
    assert.equal(p.columns, 3);
    assert.equal(p.sort, "newest");
    assert.equal(p.title, "Projects");
  }
});

test("columns are 1 to 4 and the date order is kept", () => {
  for (const n of [1, 2, 3, 4]) assert.equal(page.parseProjectsPage(YAML.stringify({ columns: n })).columns, n);
  assert.equal(page.parseProjectsPage("columns: 0").columns, 3);
  assert.equal(page.parseProjectsPage("columns: 5").columns, 3);
  assert.equal(page.parseProjectsPage("sort: oldest").sort, "oldest");
  const p = page.parseProjectsPage(YAML.stringify({ title: "My work", columns: 2, sort: "oldest" }));
  assert.deepEqual(page.parseProjectsPage(page.stringifyProjectsPage(p)), p);
});

test("the real projects-page.yml reads back unchanged", () => {
  const p = page.parseProjectsPage(fs.readFileSync("src/data/projects-page.yml", "utf8"));
  assert.deepEqual(page.parseProjectsPage(page.stringifyProjectsPage(p)), p);
  assert.ok(p.title && p.intro);
});

test("dates are read from the text written on a project", () => {
  assert.ok(page.dateKey("March 2025") > page.dateKey("January 2025"));
  assert.ok(page.dateKey("2025") < page.dateKey("February 2025"));
  assert.ok(page.dateKey("Dec 2024") < page.dateKey("2025"));
  assert.ok(page.dateKey("2025 May") > page.dateKey("2025 April"));
  assert.equal(page.dateKey(""), null);
  assert.equal(page.dateKey("sometime"), null);
});

test("projects are ordered by date, undated ones last, equal dates keep their order", () => {
  const list = [
    { id: "a", date: "March 2025" },
    { id: "b", date: "" },
    { id: "c", date: "June 2024" },
    { id: "d", date: "March 2025" },
    { id: "e", date: "2026" },
  ];
  const ids = (sort) => page.sortProjects(list, sort, (p) => p.date).map((p) => p.id).join("");
  assert.equal(ids("newest"), "eadcb");
  assert.equal(ids("oldest"), "cadeb");
  assert.deepEqual(list.map((p) => p.id), ["a", "b", "c", "d", "e"], "the list given is not changed");
});
