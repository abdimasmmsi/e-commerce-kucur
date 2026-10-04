import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const targets = [join(root, "src"), join(root, "index.html")];
const extensions = new Set([".css", ".html", ".js", ".jsx", ".json"]);
const suspicious = [
  ["unexpected U+FFFD replacement character", /\uFFFD/u],
  ["possible UTF-8 mojibake starting with Â", /\u00C2/u],
  ["possible UTF-8 mojibake starting with Ã", /\u00C3/u],
  ["possible UTF-8 mojibake starting with â€", /\u00E2\u20AC/u],
];

async function filesAt(path) {
  const entries = await readdir(path, { withFileTypes: true }).catch(() => null);
  if (!entries) return [path];
  const files = await Promise.all(entries.map((entry) => filesAt(join(path, entry.name))));
  return files.flat();
}

const files = (await Promise.all(targets.map(filesAt))).flat().filter((file) => extensions.has(extname(file)));
const failures = [];
for (const file of files) {
  const source = await readFile(file, "utf8");
  for (const [description, pattern] of suspicious) {
    const match = pattern.exec(source);
    if (!match) continue;
    const line = source.slice(0, match.index).split(/\r?\n/u).length;
    failures.push(`${relative(root, file)}:${line} ${description}`);
  }
}

if (failures.length) {
  console.error(`Encoding check failed:\n${failures.join("\n")}`);
  process.exitCode = 1;
} else {
  console.log(`Encoding check passed (${files.length} files).`);
}
