// The content of a CV (src/lib/cv-document.ts) and the CV template that turns it into the PDF (src/lib/pdf-cv-document.ts). Run: npm test
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { build } from "esbuild";

let d, r;

before(async () => {
  const out = await build({
    stdin: {
      contents: `export * from "./src/lib/cv-document"; export { cvDefinition, runs } from "./src/lib/pdf-cv-document";`,
      resolveDir: process.cwd(), loader: "ts",
    },
    bundle: true, format: "esm", platform: "browser", write: false, logLevel: "silent",
    external: ["pdfmake/*"], // only loaded when a file is really made, in the browser
    // the real icon helper reads files through Vite's import.meta.glob, and fonts are Vite "?url" imports: stand-ins here
    plugins: [{
      name: "stubs",
      setup(b) {
        b.onResolve({ filter: /\/icons$/ }, () => ({ path: "icons", namespace: "stub" }));
        b.onResolve({ filter: /\.ttf\?url$/ }, () => ({ path: "font", namespace: "stub" }));
        b.onLoad({ filter: /^icons$/, namespace: "stub" }, () => ({ contents: 'export const iconSvg = (n) => `<svg data-icon="${n}"></svg>`; export const cvIconSvg = iconSvg;', loader: "js" }));
        b.onLoad({ filter: /^font$/, namespace: "stub" }, () => ({ contents: 'export default "font.ttf";', loader: "js" }));
      },
    }],
  });
  d = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString("base64")}`);
});

const seed = () => d.parseDoc(fs.readFileSync("src/data/cv-document.yml", "utf8"));

test("an empty or broken file gives a document with every section, hidden and empty, and a default look for each of the three layouts", () => {
  for (const text of ["", "null", "- a", "sections: 3"]) {
    const doc = d.parseDoc(text);
    assert.deepEqual(doc.sections.map((s) => s.key), [...d.SECTION_KEYS]);
    assert.ok(doc.sections.every((s) => !s.show && s.entries.length === 0));
    assert.deepEqual(Object.keys(doc.variants), [...d.LOOK_KEYS]);
    for (const k of d.LOOK_KEYS) assert.deepEqual(doc.variants[k], d.defaultLook());
  }
});

test("the real starting document reads, and written back and read again it is the same", () => {
  const doc = seed();
  assert.equal(doc.header.name, "Luis Matias");
  assert.deepEqual(doc.sections.map((s) => s.key), ["work", "studies", "projects", "experiences", "certifications"]);
  assert.ok(doc.sections.every((s) => s.show && s.entries.length > 0));
  assert.deepEqual(d.parseDoc(d.stringifyDoc(doc)), doc);
});

test("the order of the sections in the file is kept, and unknown sections are ignored", () => {
  const doc = d.parseDoc("sections:\n  - { key: studies, show: true }\n  - { key: nonsense }\n  - { key: work, show: true }\n");
  assert.deepEqual(doc.sections.map((s) => s.key).slice(0, 2), ["studies", "work"]);
  assert.equal(doc.sections.length, 5);
});

test("moving an item, and what is shown", () => {
  assert.deepEqual(d.moveItem([1, 2, 3], 0, 1), [2, 1, 3]);
  assert.deepEqual(d.moveItem([1, 2, 3], 0, -1), [1, 2, 3], "the first cannot go up");
  const doc = seed();
  doc.sections[0].entries[0].show = false;
  doc.sections[1].show = false;
  const shown = d.shownSections(doc);
  assert.equal(shown.find((s) => s.key === "work").entries.length, doc.sections[0].entries.length - 1);
  assert.ok(!shown.some((s) => s.key === "studies"));
});

// A template of a CV as the page builder sees it (the pictures are stand-ins).
const pageOf = (cv, variant = "normal", options) => d.cvDefinition(d.forVariant(cv, variant), { photo: "data:image/png;base64,x", badges: {} }, options);
const page = (cv, variant, options) => JSON.stringify(pageOf(cv, variant, options));

test("the page: every shown section has its title, and a title travels with its first entry", () => {
  const doc = seed();
  const def = pageOf(doc);
  const json = JSON.stringify(def);
  for (const t of ["WORK", "STUDIES", "MY PROJECTS", "EXPERIENCES", "CERTIFICATIONS"]) assert.ok(json.includes(`"text":"${t}"`), t);
  const work = def.content.find((n) => JSON.stringify(n).includes('"text":"WORK"'));
  assert.ok(JSON.stringify(work).includes("SKARTEK") && work.unbreakable, "WORK and its first job are one block that is never split");
  doc.sections[1].show = false;
  assert.ok(!page(doc).includes('"text":"STUDIES"'), "a hidden section is not on the page");
});

test("six templates, one content: photo and phone follow the template; the three layouts have their own look, a phone-hidden one shares it", () => {
  const doc = seed();
  doc.header.phone = "+351 900 000 000";
  const has = (variant, what) => page(doc, variant).includes(what);
  // phone: shown in the three with the number; the three "hidden" ones never have it, only the note
  for (const k of ["normal", "side", "nophoto"]) assert.ok(has(k, "+351 900 000 000") && !has(k, "Hidden in web version"), k);
  for (const k of ["hidden", "sideHidden", "nophotoHidden"]) assert.ok(!has(k, "+351 900 000 000") && has(k, "Hidden in web version"), k);
  // photo: in every template but the two "no photo" ones; beside the name only in the two "side" ones
  for (const k of ["normal", "hidden", "side", "sideHidden"]) assert.ok("photo" in pageOf(doc, k).images, `${k} has the photo`);
  for (const k of ["nophoto", "nophotoHidden"]) assert.ok(!("photo" in pageOf(doc, k).images), `${k} has no photo`);
  const photoWidth = (k) => JSON.stringify(pageOf(doc, k).content).match(/"image":"photo","width":([\d.]+)/)?.[1];
  assert.equal(photoWidth("normal"), "88");
  // beside the name the photo is as tall as the block next to it, so its size follows the look and is the same in both "side" templates
  assert.equal(photoWidth("side"), photoWidth("sideHidden"));
  assert.ok(photoWidth("side") >= 60 && photoWidth("side") <= 130);
  const tall = seed();
  tall.variants.side.lineSpacing = 1.8;
  assert.ok(Number(JSON.stringify(pageOf(tall, "side").content).match(/"image":"photo","width":([\d.]+)/)[1]) > Number(photoWidth("side")), "taller lines: a taller block, a bigger photo");
  // the same text everywhere
  for (const k of d.VARIANT_KEYS) assert.ok(has(k, "SKARTEK") && has(k, "Mechanical Design Engineer"), k);
  // each layout's own look; the phone-hidden template of a layout has the same one
  doc.variants.side.lineSpacing = 1.5;
  doc.variants.side.entryGap.work = 9;
  const line = (k) => pageOf(doc, k).defaultStyle.lineHeight;
  assert.ok(line("side") > line("normal") && line("normal") === line("hidden") && line("normal") === line("nophoto") && line("nophoto") === line("nophotoHidden"));
  assert.equal(line("side"), line("sideHidden"), "the phone-hidden one shares its layout's look");
  const nine = `"h":${9 * (72 / 25.4)}`;
  assert.ok(page(doc, "side").includes(nine) && page(doc, "sideHidden").includes(nine) && !page(doc, "normal").includes(nine) && !page(doc, "nophotoHidden").includes(nine));
  assert.deepEqual(d.NO_PHONE_KEYS, ["hidden", "sideHidden", "nophotoHidden"]);
});

test("links can't run script, and empty bullet lines are dropped", () => {
  const doc = seed();
  doc.sections[0].entries[0].lines = ["one", "", "  ", "[x](javascript:alert(1))"];
  const json = page(doc);
  assert.ok(!json.includes("javascript:"));
  assert.ok(!json.includes('{"text":[{"text":""}]}'));
});

test("a project with a link gets a QR code; an unsafe link gets none", () => {
  const doc = seed();
  assert.ok(page(doc).includes('"qr":"https://lmatias.com/projects/laser-engraver"'));
  doc.sections.find((s) => s.key === "projects").entries.forEach((e) => (e.moreUrl = "javascript:alert(1)"));
  assert.ok(!page(doc).includes('"qr"'));
});

test("the phone's place and icon stay when the number is hidden, with a small note", () => {
  const doc = seed();
  doc.header.phone = "+351 900 000 000";
  assert.equal(d.lookKeyOf("nophotoHidden"), "nophoto");
  const row1 = (c) => c.filter((x) => x.row === 1 && x.col <= 4);
  let cells = d.contactCells(d.forVariant(doc, "hidden"));
  assert.deepEqual(row1(cells).map((x) => x.col), [1, 2, 3, 4]);
  const hidden = cells.find((x) => x.icon === "phone");
  assert.deepEqual([hidden.col, hidden.kind, hidden.text], [2, "hidden", "Hidden in web version"]);
  assert.ok(!JSON.stringify(cells).includes("+351"), "the number itself is never there");
  cells = d.contactCells(d.forVariant(doc, "normal"));
  const shown = cells.find((x) => x.icon === "phone");
  assert.deepEqual([shown.col, shown.text, shown.kind], [2, "+351 900 000 000", undefined]);
  doc.header.phone = "";
  assert.equal(d.contactCells(d.forVariant(doc, "normal")).find((x) => x.icon === "phone").kind, "hidden", "no number: same as hidden");
});

test("spacing: wrong values get the default; each template, section and entry list has its own; old files carry over; marking is pink", () => {
  const nl = String.fromCharCode(10);
  const doc = d.parseDoc([
    "variants:",
    "  side:",
    "    spacing: { afterName: 6.25, afterContact: -1, skillsTop: 99, skillsBottom: x }",
    "    sectionGap: { work: 2, studies: '7.5' }",
    "    entryGap: { projects: 0 }",
    "    lineSpacing: 1.4",
  ].join(nl));
  const side = doc.variants.side;
  assert.deepEqual(side.spacing, { ...d.DEFAULT_SPACING, afterName: 6.3 });
  assert.deepEqual([side.sectionGap.work, side.sectionGap.studies, side.sectionGap.projects], [2, 7.5, d.DEFAULT_SECTION_GAP]);
  assert.deepEqual([side.entryGap.projects, side.entryGap.work, side.lineSpacing], [0, d.DEFAULT_ENTRY_GAP, 1.4]);
  assert.deepEqual(doc.variants.normal, d.defaultLook(), "the other layouts keep the default");
  assert.ok(!("hidden" in doc.variants), "a phone-hidden template has no look of its own");
  // a file saved before there were four templates: its one look becomes all four
  const old = d.parseDoc(["options:", "  photo: true", "  phone: true", "  lineSpacing: 1.1", "  spacing: { betweenEntries: 6 }"].join(nl));
  for (const k of d.LOOK_KEYS) {
    assert.equal(old.variants[k].lineSpacing, 1.1);
    assert.equal(old.variants[k].sectionGap.experiences, 6);
    assert.equal(old.variants[k].entryGap.work, 6);
  }

  const real = seed();
  real.variants.normal.entryGap.work = 7;
  const json = page(real);
  assert.ok(json.includes(`"h":${7 * (72 / 25.4)}`), "a 7 mm gap is 7 mm tall");
  assert.ok(!json.includes("#ffc2d4"), "nothing is marked in the real file");
  for (const id of ["afterName", "afterContact", "skillsTop", "skillsBottom", "section:work", "entry:work", "section:certifications", "entry:projects"]) {
    assert.equal((page(real, "normal", { markGaps: id }).match(/#ffc2d4/g) ?? []).length > 0, true, `${id} can be marked`);
  }
  assert.equal((page(real, "normal", { markGaps: "entry:work" }).match(/#ffc2d4/g) ?? []).length, real.sections[0].entries.length - 1, "one mark between each pair of jobs");
  assert.deepEqual(d.parseDoc(d.stringifyDoc(real)).variants, real.variants, "the looks survive saving");
});

test("photo on the left: the contact block is 4 columns by 3 rows, the last column only for the location, with the age worked out", () => {
  const doc = seed();
  doc.header.phone = "+351 900 000 000";
  const at = (cells, c, r) => cells.find((x) => x.col === c && x.row === r);
  const day = new Date(2026, 10, 7); // 7 Nov 2026
  for (const variant of ["side", "sideHidden"]) {
    const cells = d.contactCells(d.forVariant(doc, variant), day);
    assert.ok(cells.every((x) => x.col <= 4 && x.row <= 3), `${variant}: nothing outside 4 columns and 3 rows`);
    assert.deepEqual(cells.filter((x) => x.col === 4).map((x) => x.kind).sort(), ["origin", "place"], "column 4 holds only the location");
    assert.deepEqual([1, 2, 3].map((r) => at(cells, 1, r).icon), ["mail", "phone", "cake"], "column 1: email, phone, birth date");
    assert.deepEqual([1, 2, 3].map((r) => at(cells, 2, r).icon), ["car", "world", "brand-linkedin"], "column 2: licence, website, LinkedIn");
    assert.deepEqual([1, 2].map((r) => at(cells, 3, r).text), ["Portuguese (Native)", "English (C1)"], "column 3: the languages, one per row");
    assert.equal(at(cells, 3, 3), undefined);
    assert.equal(at(cells, 1, 3).text, "20/06/1994 (32)");
    assert.equal(at(cells, 2, 1).text, "Category B");
    assert.equal(at(cells, 4, 1).text, "Slovakia");
  }
  assert.equal(at(d.contactCells(d.forVariant(doc, "side"), day), 1, 2).text, "+351 900 000 000");
  assert.equal(at(d.contactCells(d.forVariant(doc, "sideHidden"), day), 1, 2).text, "Hidden in web version");
  // the other layouts keep their 5 columns, and show the age too
  for (const variant of ["normal", "hidden", "nophoto", "nophotoHidden"]) {
    const cells = d.contactCells(d.forVariant(doc, variant), day);
    assert.ok(cells.some((x) => x.col === 5 && x.kind === "place"), `${variant}: 5 columns`);
    assert.equal(cells.find((x) => x.icon === "cake").text, "20/06/1994 (32)", `${variant}: the age`);
  }
});

test("the age: counted from the birth date, before and after the birthday; a date it can't read stays as written", () => {
  const age = (birth, y, m, d2) => d.ageOn(birth, new Date(y, m - 1, d2));
  assert.equal(age("20/06/1994", 2026, 6, 19), 31, "the day before the birthday");
  assert.equal(age("20/06/1994", 2026, 6, 20), 32, "on the birthday");
  assert.equal(age("20/06/1994", 2026, 11, 7), 32);
  assert.equal(age("1994-06-20", 2026, 11, 7), 32, "a date written the other way round");
  assert.equal(age("20.6.1994", 2026, 11, 7), 32);
  for (const bad of ["", "June 1994", "31/02/abcd", "40/13/1994", "20/06/2999"]) assert.equal(age(bad, 2026, 11, 7), null, bad);
  const doc = seed();
  doc.header.birth = "sometime in 1994";
  assert.equal(d.contactCells(d.forVariant(doc, "side"), new Date(2026, 10, 7)).find((x) => x.icon === "cake").text, "sometime in 1994");
});

test("text size: each layout has its own, an old 'smaller text' switch becomes 10 pt, and everything on the page scales with it", () => {
  const nl = String.fromCharCode(10);
  const doc = d.parseDoc(["variants:", "  side: { fontSize: 12.34 }", "  nophoto: { fontSize: 99 }"].join(nl));
  assert.equal(doc.variants.side.fontSize, 12.3, "kept, to one decimal");
  assert.equal(doc.variants.nophoto.fontSize, d.DEFAULT_FONT_SIZE, "out of range: the default");
  assert.equal(d.parseDoc(["options:", "  compact: true"].join(nl)).variants.side.fontSize, 10, "a file with the old 'smaller text' switch: 10 pt");
  assert.equal(d.parseDoc("").variants.normal.fontSize, d.DEFAULT_FONT_SIZE);
  assert.equal(d.parseDoc(["variants:", "  normal: { fontSize: 11 }"].join(nl)).variants.side.fontSize, d.DEFAULT_FONT_SIZE, "the other layouts are untouched");

  const real = seed();
  const sizes = (variant) => [...new Set([...page(real, variant).matchAll(/"fontSize":([\d.]+)/g)].map((m) => Number(m[1])))].sort((a, b) => a - b);
  const base = sizes("normal");
  const sideBefore = sizes("side");
  real.variants.normal.fontSize = 12.6; // 1.2 times the default 10.5
  const big = sizes("normal");
  assert.equal(pageOf(real, "normal").defaultStyle.fontSize, 12.6);
  assert.equal(big.length, base.length);
  base.forEach((n, i) => assert.ok(Math.abs(big[i] - n * 1.2) < 0.01, `${n} -> ${big[i]}`));
  assert.deepEqual(sizes("side"), sideBefore, "another layout keeps its size");
  assert.equal(pageOf(real, "hidden").defaultStyle.fontSize, 12.6, "the phone-hidden template shares its layout's size");
});
