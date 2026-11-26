// 从 7 个开源合集的 README 原文里抽取 skill 条目（英文原始描述），产出中间 JSON。
// 解析逻辑放在 lib/parse.js，与插件每日同步共用同一套实现，避免两边口径漂移。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAll, DOC_FILES, dedupe, parseVoltAgent, parseTableSource, parseAnthropic, parseAshutosh, parseInd4x, parseFabricio, isNoise } from '../lib/parse.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const RAW = process.env.SKILLSTORE_RAW || path.join(here, '..', '..', 'tmp', 'skillstore-raw');
const OUT = path.join(here, '..', 'data', 'extracted.json');

const read = (name) => fs.readFileSync(path.join(RAW, name), 'utf8').replace(/\r\n/g, '\n');

const docs = {};
for (const file of Object.values(DOC_FILES)) docs[file] = read(file);

// parseAll 的入参是「来源 key → 文本」，这里做一次文件名到 key 的映射
const keyed = {
  VoltAgent: docs[DOC_FILES.VoltAgent],
  anthropics: docs[DOC_FILES.anthropics],
  seb1n: docs[DOC_FILES.seb1n],
  ashutoshsrivastava17: docs[DOC_FILES.ashutoshsrivastava17],
  awslabs: docs[DOC_FILES.awslabs],
  ind4x: docs[DOC_FILES.ind4x],
  fabricioctelles: docs[DOC_FILES.fabricioctelles],
};

const sources = parseAll(keyed);

const summary = {};
for (const [key, rows] of Object.entries(sources)) summary[key] = rows.length;
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ summary, sources }), 'utf8');
console.log(JSON.stringify(summary, null, 2));
console.log('total', Object.values(summary).reduce((a, b) => a + b, 0));
