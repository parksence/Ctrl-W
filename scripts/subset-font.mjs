// 제목용 글꼴(Black Han Sans)에서 실제로 화면에 쓰는 글자만 골라 작은 woff2로 만듭니다.
// src/ 안의 문구를 바꾸면 dev/build 직전에 자동으로 다시 만들어집니다.
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import subsetFont from "subset-font";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(root, "fonts-src/BlackHanSans-Regular.ttf");
const TARGET = path.join(root, "src/fonts/display.woff2");

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (/\.(tsx?|css)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const chars = new Set();
for (let code = 0x20; code <= 0x7e; code++) chars.add(String.fromCharCode(code));
for (const ch of "·…—‘’“”×") chars.add(ch);
// 이 글꼴을 쓰지 않는 파일과 주석은 건너뜁니다.
const SKIP = /(Disguise\.tsx|hot\.ts)$/;
for (const file of await walk(path.join(root, "src"))) {
  if (SKIP.test(file)) continue;
  const code = (await readFile(file, "utf8"))
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\s\/\/ .*$/gm, "");
  for (const ch of code) {
    if (ch.codePointAt(0) > 0x7f) chars.add(ch);
  }
}

const text = [...chars].sort().join("");
const subset = await subsetFont(await readFile(SOURCE), text, { targetFormat: "woff2" });

let previous = null;
try {
  previous = await readFile(TARGET);
} catch {}
if (!previous || !previous.equals(subset)) {
  await mkdir(path.dirname(TARGET), { recursive: true });
  await writeFile(TARGET, subset);
}
console.log(`display.woff2: ${chars.size}자, ${(subset.length / 1024).toFixed(1)}KB`);
