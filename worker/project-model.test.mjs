// The project editor rewrites a project file whenever you save. These tests make sure that opening and saving never loses
// anything from the real project files, that old files (a flat list of blocks, or a grid of cells) are converted into
// boxes without losing anything, that the helpers that split, delete and swap boxes behave, and that the page is drawn
// from the boxes. Run: npm test
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import YAML from "yaml";
import { build } from "esbuild";

let model;
let renderer;
let boxes;

before(async () => {
  const load = async (entry) => {
    const out = await build({
      entryPoints: [entry], bundle: true, format: "esm", platform: "browser", write: false, logLevel: "silent",
      // The icons come from Vite's import.meta.glob, which plain Node lacks: draw empty icons in these tests.
      plugins: [{
        name: "no-icons",
        setup(b) {
          b.onResolve({ filter: /\/icons$/ }, () => ({ path: "icons", namespace: "stub" }));
          b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: "export const iconSvg = () => '';", loader: "js" }));
        },
      }],
    });
    return import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString("base64")}`);
  };
  model = await load("src/lib/project-model.ts");
  renderer = await load("src/lib/render-project.ts");
  boxes = await load("src/lib/boxes.ts");
});

const E = { type: "empty" };
const text = (t) => ({ type: "text", text: t });

/** Every text, picture and other content of a project in reading order, so two versions can be compared. */
function contentOf(p) {
  const out = [];
  for (const root of [p.main, ...p.sections]) {
    for (const { leaf } of boxes.leaves(root)) {
      if (leaf.type === "text" || leaf.type === "heading") out.push(leaf.text);
      else if (leaf.type === "image") out.push(`${leaf.src}|${leaf.spacing.join(",")}`);
      else if (leaf.type !== "empty") out.push(JSON.stringify(leaf));
    }
  }
  return out;
}

const dir = "src/content/projects";
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".yml"));

for (const file of files) {
  test(`open and save keeps everything in ${file}`, () => {
    const raw = fs.readFileSync(`${dir}/${file}`, "utf8");
    const again = model.stringifyProject(model.parseProject(raw));
    assert.deepEqual(YAML.parse(again), YAML.parse(raw));
    assert.ok(!/^(blocks|intro):/m.test(raw), "project files use boxes, not the old formats");
    assert.ok(/^main:\s*\r?\n\s+(split|type):/m.test(raw));
  });
}

test("a grid project (columns x rows with cells) is converted into boxes without losing anything", () => {
  const grid = YAML.stringify({
    title: "Grid", topic: "T", cover: "/c.png", model: "/m.glb", tools: ["a"], skills: ["s"],
    intro: "intro text",
    main: { columns: 2, rows: 1, widths: "wide-left", cells: [{ items: ["text", "facts"] }, { items: ["media"] }] },
    sections: [
      { columns: 1, rows: 1, widths: "even", cells: [{ items: [text("alone")] }] },
      {
        columns: 2, rows: 1, widths: "wide-left",
        cells: [
          { items: [text("frame"), { type: "heading", text: "H" }] },
          { items: [{ type: "image", src: "/a.png", alt: "", caption: "", spacing: ["top"] }] },
        ],
      },
      { columns: 1, rows: 2, widths: "even", cells: [{ items: [text("upper")] }, { items: [] }] },
    ],
  });
  const p = model.parseProject(grid);
  // the main section is the default layout
  assert.equal(p.main.split, "columns");
  assert.deepEqual(p.main.sizes, [65, 35]);
  assert.equal(p.main.children[0].split, "rows");
  assert.deepEqual(p.main.children[0].children.map((c) => c.type), ["text", "facts"]);
  assert.equal(p.main.children[0].children[0].text, "intro text");
  assert.equal(p.main.children[1].type, "media");
  // sections
  assert.equal(p.sections.length, 3);
  assert.equal(p.sections[0].type, "text");
  assert.equal(p.sections[1].split, "columns");
  assert.deepEqual(p.sections[1].sizes, [65, 35]);
  assert.equal(p.sections[1].children[0].split, "rows"); // two blocks in one cell become two boxes in rows
  assert.deepEqual(p.sections[1].children[0].children.map((c) => c.type), ["text", "heading"]);
  assert.equal(p.sections[1].children[1].src, "/a.png");
  assert.deepEqual(p.sections[2].children.map((c) => c.type), ["text", "empty"]);
  assert.deepEqual(contentOf(p).sort(), ["alone", "frame", "H", "intro text", "upper", "/a.png|top", '{"type":"facts"}', '{"type":"media"}'].sort());
  // and it reads back identically after saving in the new format
  assert.deepEqual(model.parseProject(model.stringifyProject(p)), p);
});

test("old files with a flat list of blocks are converted into boxes without losing anything", () => {
  const legacy = YAML.stringify({
    title: "Old", topic: "T", cover: "/c.png", model: "/m.glb", youtube: "", tools: [], skills: [],
    blocks: [
      text("intro text"),
      text("challenges"),
      { type: "divider", note: "" },
      { type: "image", src: "/a.png", alt: "", caption: "", position: "right", spacing: ["top", "bottom"] },
      text("frame"),
      { type: "divider" },
      { type: "image", src: "/b.png", alt: "", caption: "", position: "left", spacing: [] },
      text("kinematics"),
    ],
  });
  const p = model.parseProject(legacy);
  assert.equal(p.main.children[0].children[0].text, "intro text");
  assert.equal(p.sections.length, 3);
  assert.equal(p.sections[0].text, "challenges");
  // image on the right: text first, narrow second column
  assert.equal(p.sections[1].split, "columns");
  assert.deepEqual(p.sections[1].sizes, [65, 35]);
  assert.equal(p.sections[1].children[0].text, "frame");
  assert.equal(p.sections[1].children[1].src, "/a.png");
  assert.deepEqual(p.sections[1].children[1].spacing, ["top", "bottom"]);
  // image on the left: the picture is first and narrow
  assert.deepEqual(p.sections[2].sizes, [35, 65]);
  assert.equal(p.sections[2].children[0].src, "/b.png");
  assert.equal(p.sections[2].children[1].text, "kinematics");
});

test("an old file without a model or cover keeps all its text", () => {
  const p = model.parseProject(YAML.stringify({ title: "x", topic: "t", blocks: [text("first"), text("second")] }));
  // the main section keeps its (empty) text and its tools box; the two paragraphs are sections
  assert.deepEqual(contentOf(p).filter((c) => c && !c.startsWith("{")).sort(), ["first", "second"]);
});

test("a saved project is read back unchanged, with every kind of box", () => {
  const p = model.newProject();
  p.title = "Ünïcode: “quotes” & more";
  p.sections = [
    {
      split: "columns", sizes: [30, 70],
      children: [
        { split: "rows", sizes: [50, 50], children: [{ type: "image", src: "/images/a.png", alt: "", caption: "A: b", spacing: ["top", "left"] }, { type: "gallery", images: [{ src: "/images/b.png", caption: "" }] }] },
        { split: "rows", sizes: [50, 50], children: [{ type: "model", src: "/data/models/m.glb", caption: "" }, { type: "youtube", url: "https://youtu.be/abcdefghijk" }] },
      ],
    },
    { type: "table", header: true, rows: [["a", "b"], ["c", "d"]] },
    { type: "button", label: "Go", url: "https://example.com" },
    { type: "facts" },
    { type: "media" },
    E,
  ];
  assert.deepEqual(model.parseProject(model.stringifyProject(p)), p);
});

test("unknown boxes become empty, a split with one box is that box, sizes are cleaned up", () => {
  const p = model.parseProject(
    YAML.stringify({
      title: "x",
      main: { split: "columns", sizes: [1, -2, "x"], children: [text("a"), { type: "bogus" }, { split: "rows", children: [text("only")] }] },
      sections: [{ split: "columns", children: [] }],
    }),
  );
  assert.equal(p.main.split, "columns");
  assert.equal(p.main.children[1].type, "empty");
  assert.equal(p.main.children[2].text, "only", "a split with one box collapses");
  assert.equal(p.main.sizes.length, 3);
  assert.ok(p.main.sizes.every((n) => n > 0));
  assert.equal(p.sections[0].type, "empty", "a split without boxes is an empty box");
});

test("file names for new projects", () => {
  assert.equal(model.slugify("My Cool Machine!"), "my-cool-machine");
  assert.equal(model.slugify("  Café  3D "), "cafe-3d");
  assert.equal(model.slugify("???"), "");
});

// ---- the helpers that divide, delete and swap boxes ----

test("dividing a box: a new split, or a new neighbour when the split already goes that way", () => {
  const one = boxes.splitBox(text("a"), [], "columns", E);
  assert.equal(one.split, "columns");
  assert.deepEqual(one.children, [text("a"), E]);
  assert.deepEqual(one.sizes, [50, 50]);

  // dividing the first box into columns again adds a neighbour and shares its width
  const three = boxes.splitBox(one, [0], "columns", E);
  assert.equal(three.children.length, 3);
  assert.deepEqual(three.sizes, [25, 25, 50]);

  // dividing it the other way nests a split of rows
  const nested = boxes.splitBox(one, [1], "rows", E);
  assert.equal(nested.children[1].split, "rows");
  assert.deepEqual(nested.children[1].children, [E, E]);

  // nothing was changed in what we passed in
  assert.equal(one.children.length, 2);
});

test("deleting a box: the others take its place, a split with one box collapses, the last box becomes empty", () => {
  const tree = { split: "columns", sizes: [25, 25, 50], children: [text("a"), text("b"), text("c")] };
  const two = boxes.deleteBox(tree, [1], E);
  assert.deepEqual(two.children, [text("a"), text("c")]);
  assert.deepEqual(two.sizes, [33.33, 66.67]);
  const one = boxes.deleteBox(two, [0], E);
  assert.deepEqual(one, text("c"));
  assert.deepEqual(boxes.deleteBox(one, [], E), E);
  // deleting a box that is not there changes nothing
  assert.deepEqual(boxes.deleteBox(tree, [7], E), tree);
});

test("swapping two boxes, and putting something in a box", () => {
  const tree = { split: "columns", sizes: [50, 50], children: [text("a"), { split: "rows", sizes: [50, 50], children: [text("b"), E] }] };
  const swapped = boxes.swapBoxes(tree, [0], [1, 1]);
  assert.deepEqual(swapped.children[0], E);
  assert.deepEqual(swapped.children[1].children[1], text("a"));
  assert.deepEqual(boxes.swapBoxes(tree, [0], [0]), tree);
  assert.deepEqual(boxes.swapBoxes(tree, [0], [1]), tree, "a split is not a box: nothing to swap");
  assert.deepEqual(boxes.setContent(tree, [1, 1], text("z")).children[1].children[1], text("z"));
  assert.deepEqual(boxes.leaves(tree).map((l) => boxes.pathKey(l.path)), ["0", "1.0", "1.1"]);
});

test("resizing columns", () => {
  const tree = { split: "columns", sizes: [50, 50], children: [text("a"), text("b")] };
  assert.deepEqual(boxes.setSizes(tree, [], [30, 70]).sizes, [30, 70]);
  assert.deepEqual(boxes.setSizes(tree, [], [30, 70, 5]).sizes, [50, 50], "wrong number of sizes: ignored");
  assert.equal(boxes.columnsStyle([65, 35]), "grid-template-columns: minmax(0, 65fr) minmax(0, 35fr)");
});

// ---- the page ----

function sample() {
  const p = model.newProject();
  p.title = "<script>x</script>";
  p.cover = "/images/c.png";
  p.youtube = "https://youtu.be/abcdefghijk";
  p.tools = ["a"];
  p.sections = [
    {
      split: "columns", sizes: [65, 35],
      children: [
        text("left text"),
        { split: "rows", sizes: [50, 50], children: [{ type: "image", src: "/i.png", alt: "", caption: "cap", spacing: ["top"] }, E] },
      ],
    },
    E,
  ];
  return p;
}

test("the editor's preview draws every box with its address and handles, and escapes text", () => {
  const html = renderer.renderProject(sample(), [{ id: "a", name: "A", icon: "" }]);
  assert.ok(!html.includes("<script>"), "title must be escaped");
  assert.ok(html.includes("&lt;script&gt;"));
  for (const part of ["split--columns", "grid-template-columns: minmax(0, 65fr) minmax(0, 35fr)", "split--rows", "main-section", "left text", "padding-top: 5%"]) {
    assert.ok(html.includes(part), `missing ${part}`);
  }
  assert.ok(html.includes('data-box="m:0.0"') && html.includes('data-box="m:0.1"') && html.includes('data-box="m:1"'), "the main section's boxes");
  assert.ok(html.includes('data-box="0:0"') && html.includes('data-box="0:1.0"') && html.includes('data-box="0:1.1"') && html.includes('data-box="1:"'), "the sections' boxes");
  assert.ok(html.includes('data-split="0:"') && html.includes('data-split="m:"'));
  assert.ok(!html.includes("box-bar") && !html.includes('data-act="split-columns"'), "nothing is drawn inside a box except its content, so its size is its real size");
  assert.equal((html.match(/data-act="choose"/g) ?? []).length, 2, "one for each empty box");
  assert.ok(html.includes('data-act="add-section"') && html.includes('data-act="default-main"') && html.includes('data-act="section-delete"'));
});

test("the public page draws no editor parts, no empty boxes, and a video button instead of a video section", () => {
  const html = renderer.renderProjectBody(sample(), [], false);
  assert.ok(!/data-act|data-box|data-split|data-block|section-bar|box-bar|cell-choose|empty-block/.test(html), "no editor markup on the real page");
  assert.ok(html.includes('data-video="abcdefghijk"') && html.includes("Watch the video"));
  assert.ok(!html.includes('id="video"'), "no video section at the bottom");
  assert.equal((html.match(/class="psection"/g) ?? []).length, 1, "the section with only an empty box is not drawn");
  assert.ok(html.includes('<a class="back" href="/projects">'));
  const quiet = sample();
  quiet.youtube = "";
  assert.ok(!renderer.renderProjectBody(quiet, [], false).includes("Watch the video"));
});

test("heading, table and button boxes are drawn safely", () => {
  const p = model.newProject();
  p.sections = [
    {
      split: "rows", sizes: [34, 33, 33],
      children: [
        { type: "heading", text: "A <b>title</b>" },
        { type: "table", header: true, rows: [["Part", "Cost"], ["Motor <x>", "12"], ["Frame", "30"]] },
        { type: "button", label: "Open on GitHub", url: "https://github.com/x/y" },
      ],
    },
  ];
  const html = renderer.renderProjectBody(p, [], false);
  assert.ok(html.includes('<h2 class="block block-heading"'), "heading");
  assert.ok(html.includes("A &lt;b&gt;title&lt;/b&gt;") && !html.includes("<b>title</b>"), "heading is escaped");
  assert.ok(html.includes("<thead><tr><th>Part</th><th>Cost</th></tr></thead>"), "header row");
  assert.ok(html.includes("<td>Motor &lt;x&gt;</td>") && !html.includes("<x>"), "table cells are escaped");
  assert.ok(html.includes('href="https://github.com/x/y"') && html.includes('rel="noopener"'), "button link");
  p.sections[0].children[1].header = false;
  assert.ok(!renderer.renderProjectBody(p, [], false).includes("<thead>"));
  const uneven = model.parseProject(["title: x", "sections:", "  - type: table", "    rows: [[a, b, c], [d]]", ""].join("\n"));
  assert.deepEqual(uneven.sections[0].rows, [["a", "b", "c"], ["d", "", ""]]);
});

test("the default main section: text and tools on the left, the cover or model on the right", () => {
  const p = model.newProject();
  p.cover = "/images/c.png";
  p.tools = ["a"];
  const html = renderer.renderProjectBody(p, [{ id: "a", name: "A", icon: "" }], false);
  assert.ok(html.includes("grid-template-columns: minmax(0, 65fr) minmax(0, 35fr)"));
  assert.ok(html.indexOf("Write something here.") < html.indexOf("card facts") && html.indexOf("card facts") < html.indexOf("card media"));
});
