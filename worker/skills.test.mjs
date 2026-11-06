// The skills and languages of the CV page (src/data/skills.yml). Run: npm test
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { build } from "esbuild";

let skills;

before(async () => {
  const out = await build({ entryPoints: ["src/lib/skills.ts"], bundle: true, format: "esm", platform: "browser", write: false, logLevel: "silent" });
  skills = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString("base64")}`);
});

test("an empty or broken file gives no skills", () => {
  for (const text of ["", "null", "- a", "skills: 5\nlanguages: x\n"]) {
    assert.deepEqual(skills.parseSkills(text), { skills: [], languages: [] });
  }
});

test("the real skills.yml reads and writes back the same", () => {
  const text = fs.readFileSync("src/data/skills.yml", "utf8");
  const parsed = skills.parseSkills(text);
  assert.ok(parsed.skills.length > 0 && parsed.languages.length > 0);
  assert.deepEqual(skills.parseSkills(skills.stringifySkills(parsed)), parsed);
});

test("empty skills, groups and languages are not written", () => {
  const text = skills.stringifySkills({
    skills: [{ group: "CAD", items: ["Solid Edge", "  ", ""] }, { group: "", items: [] }],
    languages: [{ name: "English", level: "C1" }, { name: " ", level: "A1" }],
  });
  assert.deepEqual(skills.parseSkills(text), { skills: [{ group: "CAD", items: ["Solid Edge"] }], languages: [{ name: "English", level: "C1" }] });
});

test("a language shows its short code", () => {
  assert.equal(skills.langCode("Portuguese"), "PT");
  assert.equal(skills.langCode("Klingon"), "KL");
});
