// The public CV page shows the CV in use: its content as the cards the page draws (src/lib/cv-live.ts). Run: npm test
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import YAML from "yaml";
import { build } from "esbuild";

let L, D, C;

before(async () => {
  const out = await build({
    stdin: { contents: `export * from "./src/lib/cv-live"; export * as doc from "./src/lib/cv-document"; export { cardFromData } from "./src/lib/cv";`, resolveDir: process.cwd(), loader: "ts" },
    bundle: true, format: "esm", platform: "browser", write: false, logLevel: "silent",
  });
  const mod = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString("base64")}`);
  L = mod; D = mod.doc; C = mod.cardFromData;
});

const read = (dir) => fs.readdirSync(`src/content/${dir}`).filter((f) => f.endsWith(".yml")).sort().map((f) => YAML.parse(fs.readFileSync(`src/content/${dir}/${f}`, "utf8")));
const ownCards = () => ({
  work: read("work").map((d) => C("work", d)),
  education: read("education").map((d) => C("education", d)),
  experiences: read("experiences").map((d) => C("experiences", d)),
  certifications: read("certifications").map((d) => C("certifications", d)),
});
const seed = () => D.parseDoc(fs.readFileSync("src/data/cv-document.yml", "utf8"));

test("work: the CV's own text and order, with the logo, link and tools of the matching card", () => {
  const live = L.cardsFromDoc(seed(), ownCards());
  assert.deepEqual(live.work.map((c) => c.org), ["SKARTEK", "Forvia", "Forvia", "INEGI"]);
  const [skartek, dev, program, inegi] = live.work;
  assert.equal(skartek.title, "Mechanical Design Engineer");
  assert.equal(skartek.period, "Aug 2025 – Present", "the period is the CV's, not the card's");
  assert.ok(skartek.logo.includes("skartek") && skartek.link.includes("skartek"));
  assert.ok(skartek.tools.length > 0, "tools from the matching card");
  // "Forvia" in the CV is "Faurecia" on the cards: the two roles still find their own cards (logo and different tools)
  assert.ok(dev.logo.includes("faurecia") && program.logo.includes("faurecia"));
  assert.notDeepEqual(dev.tools, program.tools);
  assert.ok(inegi.logo.includes("inegi"));
  assert.ok(inegi.lines.length === 2 && inegi.details.startsWith("Project:"));
});

test("studies, experiences and certifications are matched too, and the CV's wording is kept", () => {
  const live = L.cardsFromDoc(seed(), ownCards());
  const [msc] = live.education;
  assert.equal(msc.org, "University of Porto");
  assert.ok(msc.logo.includes("FEUP"), "University of Porto finds the FEUP card");
  assert.ok(msc.details.startsWith("Thesis:") && msc.lines.length === 2);
  assert.ok(msc.papers[0].url.startsWith("https://link.springer.com"), "the paper's link comes from the card");
  const [elephant] = live.experiences;
  assert.deepEqual([elephant.kind, elephant.title, elephant.org], ["Volunteering", "Elephant Caretaker", "Elephant Nature Park"]);
  assert.ok(elephant.logo.includes("enp"));
  const solidEdge = live.certifications.find((c) => c.title.startsWith("Solid Edge"));
  assert.ok(solidEdge.logo.includes("Solid_Edge") && solidEdge.id && solidEdge.pdf && solidEdge.verify, "badge, credential id and links from its card");
  assert.equal(live.certifications.length, 2);
});

test("publications are the papers of jobs and studies", () => {
  const live = L.cardsFromDoc(seed(), ownCards());
  assert.equal(live.publications.length, 2);
  assert.deepEqual(live.publications.map((p) => p.where), ["INEGI · Dec 2021 – July 2022", "University of Porto · July 2022"]);
});

test("what the CV hides or leaves out is not on the page; an entry without a matching card still shows", () => {
  const doc = seed();
  doc.sections[0].entries[1].show = false; // a job
  doc.sections.find((s) => s.key === "experiences").show = false;
  doc.sections.find((s) => s.key === "projects").entries[0].title = "Not on the CV page"; // "My projects" has its own pages
  doc.sections[0].entries.push({ ...D.blankEntry(), title: "Brand new role", org: "Unknown Ltd", period: "2027", lines: ["Did things."] });
  const live = L.cardsFromDoc(doc, ownCards());
  assert.deepEqual(live.work.map((c) => c.org), ["SKARTEK", "Forvia", "INEGI", "Unknown Ltd"]);
  assert.equal(live.experiences.length, 0);
  const fresh = live.work.at(-1);
  assert.deepEqual([fresh.logo, fresh.link, fresh.tools], ["", "", []], "no card, no logo or link");
  // and with no cards at all it still works
  const bare = L.cardsFromDoc(seed(), { work: [], education: [], experiences: [], certifications: [] });
  assert.equal(bare.work.length, 4);
  assert.ok(bare.work.every((c) => c.logo === "" || c.logo === undefined));
});
