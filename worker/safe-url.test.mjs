// Links written in the editors must not be able to run script on the public site. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

let safeUrl, markdown;
test("load", async () => {
  const out = await build({
    stdin: { contents: `export { safeUrl } from "./src/lib/safe-url"; export { markdown } from "./src/lib/markdown";`, resolveDir: process.cwd(), loader: "ts" },
    bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent",
  });
  ({ safeUrl, markdown } = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString("base64")}`));
});

test("web, mail, phone and relative addresses are kept; scripts are not", () => {
  for (const ok of ["https://a.com/x", "http://a.com", "mailto:a@b.c", "tel:+351", "/projects", "#top", "./a", "a/b?c=d"]) assert.equal(safeUrl(ok), ok);
  for (const bad of ["javascript:alert(1)", " JavaScript:alert(1)", "java\nscript:alert(1)", "data:text/html,x", "vbscript:x"]) assert.equal(safeUrl(bad), "#", bad);
});

test("markdown shows raw HTML as text and cleans link addresses", () => {
  const html = markdown.parse("hi <script>alert(1)</script> [x](javascript:alert(1)) [y](https://a.com)", { async: false });
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("javascript:"));
  assert.ok(html.includes('href="https://a.com"'));
});
