import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = path.resolve(projectRoot, process.argv[2] ?? "dist");
if (!root.startsWith(`${projectRoot}${path.sep}`) && root !== projectRoot) throw new Error("Serve root must stay inside the project.");
const port = Number(process.argv[3] ?? 4173);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Choose a valid local port between 1024 and 65535.");
const contentTypes = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml" };

createServer(async (request, response) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname); }
  catch { response.writeHead(400).end("Bad request"); return; }
  if (pathname.includes("\\") || pathname.split("/").includes("..")) { response.writeHead(400).end("Bad request"); return; }
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const file = path.resolve(root, relative);
  if (!file.startsWith(`${root}${path.sep}`) && file !== root) { response.writeHead(404).end("Not found"); return; }
  try {
    const info = await stat(file);
    if (!info.isFile()) throw new Error("not a file");
    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(file)] ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Permissions-Policy": "camera=(), geolocation=(), microphone=(self)",
    });
    createReadStream(file).pipe(response);
  } catch { response.writeHead(404).end("Not found"); }
}).listen(port, "127.0.0.1", () => console.log(`Serving ${root} at http://127.0.0.1:${port}/`));
