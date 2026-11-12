import { cp, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lessons, tracks } from "../src/data.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "dist");
const expectedFiles = ["index.html", "styles.css", "src/app.js", "src/data.js", "src/logic.js", "public/favicon.svg", ".nojekyll"];

if (tracks.length !== 6 || lessons.length !== 18) throw new Error("Build stopped: expected six paths and eighteen lessons.");
for (const relative of expectedFiles) await readFile(path.join(root, relative));
if (!path.resolve(output).startsWith(`${root}${path.sep}`)) throw new Error("Refusing to build outside the project directory.");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const relative of expectedFiles) {
  const source = path.join(root, relative);
  const destination = path.join(output, relative);
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination);
}
console.log(`Built a static Pages site with ${tracks.length} paths and ${lessons.length} lessons in dist/.`);
