// The CV page's cards (src/lib/cv.ts): reading and writing their files, adding, moving and removing. Run: npm test
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import YAML from "yaml";
import { build } from "esbuild";

let cv;

before(async () => {
  const out = await build({ entryPoints: ["src/lib/cv.ts"], bundle: true, format: "esm", platform: "browser", write: false, logLevel: "silent" });
  cv = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString("base64")}`);
});

const read = (section, name) => fs.readFileSync(`src/content/${section}/${name}`, "utf8");

test("every real card file survives a read and write unchanged in meaning", () => {
  for (const section of ["work", "education", "experiences", "certifications"]) {
    for (const name of fs.readdirSync(`src/content/${section}`).filter((n) => n.endsWith(".yml"))) {
      const text = read(section, name);
      const before = YAML.parse(text);
      const card = cv.cardFromText(section, text, name);
      const after = YAML.parse(cv.cardToText(section, card, before.order));
      // An empty list or text and a missing one mean the same, and so does a label left out.
      for (const x of [before, after]) {
        x.papers ??= [];
        if (x.details === "") delete x.details;
        for (const p of x.papers) p.kind ??= "Paper";
      }
      assert.deepEqual(after, before, `${section}/${name}`);
    }
  }
});

test("a work card and an education card use the same field names", () => {
  const w = cv.cardFromData("work", { title: "Engineer", company: "ACME", period: "2020", responsibilities: ["a", "b"] });
  assert.deepEqual([w.title, w.org, w.lines], ["Engineer", "ACME", ["a", "b"]]);
  const e = cv.cardFromData("education", { degree: "MSc", institution: "Uni", period: "2020", details: "Thesis" });
  assert.deepEqual([e.title, e.org, e.details], ["MSc", "Uni", "Thesis"]);
  assert.deepEqual(YAML.parse(cv.cardToText("education", e, 2)).degree, "MSc");
});

test("the label of a line defaults to Paper, can be changed, and can be empty", () => {
  const card = cv.cardFromData("work", { title: "T", company: "C", period: "P", papers: [{ title: "A" }, { kind: "Patent", title: "B" }, { kind: "", title: "C" }] });
  assert.deepEqual(card.papers.map((p) => p.kind), ["Paper", "Patent", ""]);
  const written = YAML.parse(cv.cardToText("work", card, 1));
  assert.equal("kind" in written.papers[0], false);
  assert.deepEqual([written.papers[1].kind, written.papers[2].kind], ["Patent", ""]);
});

test("fields the editor doesn't know are kept", () => {
  const card = cv.cardFromData("work", { title: "T", company: "C", period: "P", country: "PT", future: { a: 1 } });
  const written = YAML.parse(cv.cardToText("work", card, 3));
  assert.equal(written.country, "PT");
  assert.deepEqual(written.future, { a: 1 });
  assert.equal(written.order, 3);
});

test("a card can be added on top, between others and at the end, with names that never clash", () => {
  let cards = [cv.blankCard("work", []), cv.blankCard("work", [])];
  cards[1].file = "x.yml";
  const names = () => cards.map((c) => c.file);
  cards = cv.addCard("work", cards, 0);
  cards = cv.addCard("work", cards, 2);
  cards = cv.addCard("work", cards, 99);
  assert.equal(cards.length, 5);
  assert.equal(new Set(names()).size, 5);
  assert.equal(names().every((n) => /^[a-z0-9][a-z0-9-]*\.yml$/.test(n)), true);
});

test("cards move one place and stay inside the list", () => {
  const cards = ["a", "b", "c"].map((file) => ({ ...cv.blankCard("work", []), file: `${file}.yml` }));
  assert.deepEqual(cv.moveCard(cards, 0, 1).map((c) => c.file), ["b.yml", "a.yml", "c.yml"]);
  assert.equal(cv.moveCard(cards, 0, -1), cards);
  assert.equal(cv.moveCard(cards, 2, 1), cards);
  assert.deepEqual(cv.removeCard(cards, 1).map((c) => c.file), ["a.yml", "c.yml"]);
});

test("the files are numbered in page order", () => {
  const cards = ["a", "b"].map((file) => ({ ...cv.blankCard("education", []), file: `${file}.yml` }));
  assert.deepEqual(cv.cardFiles("education", cards).map((f) => YAML.parse(f.text).order), [1, 2]);
});

test("experiences and certifications use their own field names", () => {
  const x = cv.cardFromData("experiences", { type: "Volunteer", title: "Caretaker", organization: "Park", period: "2017", description: ["a"] });
  assert.deepEqual([x.kind, x.title, x.org, x.lines], ["Volunteer", "Caretaker", "Park", ["a"]]);
  const c = cv.cardFromData("certifications", { title: "CSWP", issuer: "Dassault", date: "May 2025", credentialId: "C-1", badge: "/b.png", pdf: "/a.pdf", verify: "https://x" });
  assert.deepEqual([c.title, c.org, c.period, c.id, c.logo, c.pdf, c.verify], ["CSWP", "Dassault", "May 2025", "C-1", "/b.png", "/a.pdf", "https://x"]);
  const written = YAML.parse(cv.cardToText("certifications", c, 2));
  assert.deepEqual([written.issuer, written.date, written.badge, written.credentialId], ["Dassault", "May 2025", "/b.png", "C-1"]);
});

test("an empty certification part is left out of the file", () => {
  const c = cv.cardFromData("certifications", { title: "T", issuer: "I", date: "D" });
  const written = YAML.parse(cv.cardToText("certifications", c, 1));
  for (const key of ["credentialId", "badge", "pdf", "verify", "location"]) assert.equal(key in written, false, key);
});

test("tools are added and taken out of a card", () => {
  const card = { tools: ["a"] };
  assert.deepEqual(cv.toggleTool(card, "b"), ["a", "b"]);
  assert.deepEqual(cv.toggleTool(card, "a"), []);
});

test("every section can add a blank card with its own labels", () => {
  for (const section of ["work", "education", "experiences", "certifications"]) {
    const card = cv.blankCard(section, []);
    assert.ok(card.title && card.org && card.period, section);
    assert.equal(YAML.parse(cv.cardToText(section, card, 1)).visible, true);
  }
});
