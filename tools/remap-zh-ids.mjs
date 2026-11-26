// 把翻译批次文件里的旧 id（只哈希 source+url）改写成新 id（source+url+name）。
//
// 背景：新 id 公式是为了解决「两个不同 skill 共用一个 GitHub 链接」导致的 id 冲突
// （angular/angular-developer 与 angular/angular-new-app 都指向
// https://github.com/angular/skills）。批次是按旧 id 产出的，这里一次性对齐，
// 之后 build-dataset.mjs 就不再需要 legacyId 这层兼容桥。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(here, '..', 'data');
const BATCH_DIR = path.join(DATA, 'zh-batches');

const oldId = (source, url) => `sk_${crypto.createHash('sha1').update(`${source}|${url}`).digest('hex').slice(0, 12)}`;
const newId = (source, url, name) => `sk_${crypto.createHash('sha1').update(`${source}|${url}|${name}`).digest('hex').slice(0, 12)}`;

/** 标题清洗必须与 build-dataset.mjs 完全一致，否则算出来的 id 对不上。 */
function cleanName(name) {
  return String(name || '').replace(/\s+/g, ' ').replace(/^[-–—\s]+|[-–—\s]+$/g, '').trim();
}

const raw = JSON.parse(fs.readFileSync(path.join(DATA, 'extracted.json'), 'utf8').replace(/^\uFEFF/, ''));

// 旧 id → 新 id 列表。同一个旧 id 可能对应多条（共用链接的不同 skill），
// 这时它们本来就共享同一段译文，拆开后各拿一份。
const map = new Map();
for (const rows of Object.values(raw.sources)) {
  for (const row of rows) {
    const name = cleanName(row.name);
    if (!name) continue;
    const from = oldId(row.source, row.url);
    const to = newId(row.source, row.url, name);
    if (!map.has(from)) map.set(from, new Set());
    map.get(from).add(to);
  }
}

let rewritten = 0;
let unmapped = 0;
const files = fs.readdirSync(BATCH_DIR).filter((f) => /^out-\d+\.json$/.test(f)).sort();

for (const file of files) {
  const full = path.join(BATCH_DIR, file);
  const text = fs.readFileSync(full, 'utf8').replace(/^\uFEFF/, '');
  const items = JSON.parse(text);
  const out = [];
  for (const item of items) {
    const targets = map.get(item.id);
    if (!targets) {
      unmapped += 1;
      continue;
    }
    for (const to of targets) out.push({ id: to, zh: item.zh });
    if (targets.size > 1) rewritten += 1;
  }
  fs.writeFileSync(full, `\uFEFF${JSON.stringify(out, null, 1)}`, 'utf8');
  console.log(`${file}: ${items.length} → ${out.length}`);
}

console.log(JSON.stringify({ rewritten, unmapped, files: files.length }, null, 2));
