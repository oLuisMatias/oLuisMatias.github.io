// The home page texts and the featured projects (src/data/home.yml): defaults, templates and the real file. Run: npm test
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import YAML from "yaml";
import { build } from "esbuild";

let home;
let highlights;

before(async () => {
  const out = await build({ entryPoints: ["src/lib/home.ts"], bundle: true, format: "esm", platform: "browser", write: false, logLevel: "silent" });
  home = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString("base64")}`);
  const second = await build({ entryPoints: ["src/lib/highlights.ts"], bundle: true, format: "esm", platform: "browser", write: false, logLevel: "silent" });
  highlights = await import(`data:text/javascript;base64,${Buffer.from(second.outputFiles[0].text).toString("base64")}`);
});

test("the templates are rows x columns", () => {
  assert.deepEqual(home.TEMPLATES["1x2"], { rows: 1, columns: 2 });
  assert.deepEqual(home.TEMPLATES["1x3"], { rows: 1, columns: 3 });
  assert.deepEqual(home.TEMPLATES["2x2"], { rows: 2, columns: 2 });
  assert.deepEqual(home.TEMPLATES["2x3"], { rows: 2, columns: 3 });
  assert.deepEqual(home.TEMPLATE_NAMES.map(home.slotCount), [2, 3, 4, 6]);
});

test("an empty or broken file gives the whole page with defaults", () => {
  for (const text of ["", "null", "- a\n- b", "status: 5\nhighlights: nope\nfeatured: 3\n"]) {
    const h = home.parseHome(text);
    assert.equal(typeof h.status, "string");
    assert.equal(h.featured.template, "1x3");
    assert.equal(h.featured.slots.length, 3);
    assert.ok(h.cta.title.length > 0);
  }
});

test("a partly written file keeps what it has and fills the rest", () => {
  const h = home.parseHome(
    YAML.stringify({ headline: "My headline", featured: { template: "2x2", slots: ["a", "b"] }, about: { text: "About me" } }),
  );
  assert.equal(h.headline, "My headline");
  assert.equal(h.featured.template, "2x2");
  assert.deepEqual(h.featured.slots, ["a", "b", "", ""], "the boxes are padded to the template");
  assert.equal(h.about.text, "About me");
  assert.equal(h.about.title, "Why I build things");
});

test("an unknown template falls back to 1x3, and odd slot values become empty boxes", () => {
  const h = home.parseHome(YAML.stringify({ featured: { template: "5x5", slots: [1, null, "x", "y", "z"] } }));
  assert.equal(h.featured.template, "1x3");
  assert.deepEqual(h.featured.slots, ["", "", "x"]);
});

test("changing the template keeps the chosen projects in order", () => {
  let h = home.parseHome(YAML.stringify({ featured: { template: "2x3", slots: ["a", "", "c", "d", "e", "f"] } }));
  h = home.withTemplate(h, "1x3");
  assert.deepEqual(h.featured.slots, ["a", "", "c"]);
  h = home.withTemplate(h, "1x2");
  assert.deepEqual(h.featured.slots, ["a", ""]);
  h = home.withTemplate(h, "1x3");
  assert.deepEqual(h.featured.slots, ["a", "", ""], "boxes that were cut come back empty");
  h = home.withTemplate(h, "2x2");
  assert.deepEqual(h.featured.slots, ["a", "", "", ""], "what was cut is gone, new boxes are empty");
  h = home.withTemplate(h, "2x3");
  assert.equal(h.featured.slots.length, 6);
  assert.equal(h.featured.template, "2x3");
});

test("the real home.yml is complete, reads back unchanged, and only names projects that exist", () => {
  const text = fs.readFileSync("src/data/home.yml", "utf8");
  const h = home.parseHome(text);
  assert.deepEqual(home.parseHome(home.stringifyHome(h)), h);
  assert.ok(h.headline && h.intro && h.about.text && h.cta.title);
  assert.ok(!("highlights" in h), "the four boxes come from the CV page, not from this file");
  const projects = new Set(fs.readdirSync("src/content/projects").filter((f) => f.endsWith(".yml")).map((f) => f.replace(/\.yml$/, "")));
  for (const slot of h.featured.slots) assert.ok(slot === "" || projects.has(slot), `unknown project ${slot}`);
});

test("the four boxes come from the CV page", () => {
  const boxes = highlights.highlightsFrom({
    work: [{ company: "Skartek", period: "2025 - Present" }, { company: "Faurecia", period: "2023 May - 2024 Dec" }],
    certifications: [{ title: "Solid Edge Professional Level" }, { title: "SolidWorks CSWP" }, { title: "A third one" }],
    education: [{ degree: "MSc in Mechanical Engineering" }, { degree: "BSc in Mechanical Engineering" }],
  });
  assert.deepEqual(boxes, [
    { label: "Now", value: "Skartek · 2025" },
    { label: "Certified", value: "Solid Edge Professional Level" },
    { label: "Certified", value: "SolidWorks CSWP" },
    { label: "Education", value: "MSc Mech. Eng" },
  ]);
  // no current job: it says so instead of "Now"; nothing to show: no box
  assert.deepEqual(highlights.highlightsFrom({ work: [{ company: "Faurecia", period: "2022 - 2024" }], certifications: [], education: [] }), [{ label: "Latest job", value: "Faurecia" }]);
  assert.deepEqual(highlights.highlightsFrom({ work: [], certifications: [], education: [] }), []);
  assert.equal(highlights.shortDegree("PhD in Physics"), "PhD Physics");
  assert.equal(highlights.shortDegree("MSc in Mechanical Engineering"), "MSc Mech. Eng");
});
