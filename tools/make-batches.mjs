// 把抽取结果切成翻译批次：每批一个 JSON，交给翻译流程产出中文描述。
// 说明：id 在这里一次性定下来（源 + URL + 名称的哈希），同步与构建都据此对齐，
// 因此 id 一旦发布就不会再变，收藏与笔记不会失效。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { skillId } from '../lib/catalog.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(here, '..', 'data');
const OUT = path.join(DATA, 'zh-batches');

const raw = JSON.parse(fs.readFileSync(path.join(DATA, 'extracted.json'), 'utf8'));
const all = [];
for (const rows of Object.values(raw.sources)) {
  for (const row of rows) {
    // 必须与 build-dataset.mjs 用同一个 id 公式（三参数），否则批次与数据集对不上
    all.push({ id: skillId(row.source, row.url, row.name), name: row.name, desc: row.desc });
  }
}

const BATCH = Number(process.env.BATCH_SIZE || 200);
const batches = [];
for (let i = 0; i < all.length; i += BATCH) batches.push(all.slice(i, i + BATCH));

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
batches.forEach((items, index) => {
  const n = String(index + 1).padStart(2, '0');
  const payload = items.map((it) => ({
    id: it.id,
    // 翻译输入截断到 600 字符：过长的描述后段多是用法细节，不影响主句含义
    name: it.name,
    desc: String(it.desc || '').slice(0, 600),
  }));
  fs.writeFileSync(path.join(OUT, `in-${n}.json`), JSON.stringify(payload, null, 1), 'utf8');
});
console.log(JSON.stringify({ total: all.length, batches: batches.length, batchSize: BATCH, dir: OUT }, null, 2));
