import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const logic = await readFile(new URL("../src/logic.js", import.meta.url), "utf8");
const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
const packageFile = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

test("static site policy blocks plugins, external content, inline scripts, and remote form targets", () => {
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /script-src 'self'/);
  assert.match(html, /object-src 'none'/);
  assert.match(html, /base-uri 'none'/);
  assert.match(html, /form-action 'self'/);
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)/i);
  assert.doesNotMatch(html, /https?:\/\//i);
});

test("rendering uses text nodes, with no executable string construction or remote request", () => {
  assert.doesNotMatch(app, /\.innerHTML|insertAdjacentHTML|outerHTML/);
  assert.doesNotMatch(app, /\beval\s*\(|new\s+Function\s*\(|\bfetch\s*\(/);
  assert.match(app, /createTextNode/);
  assert.match(app, /textContent/);
  assert.doesNotMatch(app, /sk-[A-Za-z0-9_-]{16,}/);
});

test("progress restoration constrains the data to known lessons and the release adds no packages", () => {
  assert.match(logic, /getLesson\(/);
  assert.match(logic, /cleanProgress/);
  assert.match(logic, /recovery/);
  assert.deepEqual(packageFile.dependencies ?? {}, {});
  assert.deepEqual(packageFile.devDependencies ?? {}, {});
});

test("responsive styles honor mobile safe areas, keyboard focus, and reduced motion", () => {
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /resize:\s*none/);
});
