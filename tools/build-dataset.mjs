// 构建随插件发布的 skills.json：抽取值（extracted.json）+ 中文翻译（zh-batches/out-*.json）+ 分类规则（lib/classify.js）
// → 打标签、生成稳定 id，输出一份可被插件直接读取的数据集。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { classify, groupOf, GROUPS } from '../lib/classify.js';
import { TAGS, SOURCES, skillId } from '../lib/catalog.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(here, '..', 'data');
const BATCH_DIR = path.join(DATA, 'zh-batches');

// ---------------------------------------------------------------- 读中文翻译
const zhMap = new Map();
const batchFiles = fs.existsSync(BATCH_DIR)
  ? fs.readdirSync(BATCH_DIR).filter((f) => /^out-\d+\.json$/.test(f)).sort()
  : [];
for (const file of batchFiles) {
  const text = fs.readFileSync(path.join(BATCH_DIR, file), 'utf8').replace(/^\uFEFF/, '');
  const items = JSON.parse(text);
  for (const item of items) zhMap.set(item.id, String(item.zh || '').trim());
}

// ---------------------------------------------------------------- 归一化原文
const raw = JSON.parse(fs.readFileSync(path.join(DATA, 'extracted.json'), 'utf8'));

/** 有些标题会带多余尾巴，统一清洗。 */
function cleanName(name) {
  return String(name || '')
    .replace(/\s+/g, ' ')
    .replace(/^[-–—\s]+|[-–—\s]+$/g, '')
    .trim();
}

/** 打标签：命中关键词即打上，最多 3 个，按 TAGS 顺序稳定。 */
function tagOf(skill) {
  const text = `${skill.name} ${skill.descRaw} ${skill.category}`.toLowerCase();
  const hits = [];
  for (const tag of TAGS) {
    if (tag.words.some((w) => text.includes(w.toLowerCase()))) hits.push(tag.key);
    if (hits.length >= 3) break;
  }
  return hits;
}

const rows = [];
for (const sourceRows of Object.values(raw.sources)) {
  for (const row of sourceRows) {
    const name = cleanName(row.name);
    if (!name) continue;
    rows.push({
      id: skillId(row.source, row.url, name),
      source: row.source,
      category: classify(row),
      name,
      descRaw: String(row.desc || ''),
      url: row.url,
    });
  }
}

// id 冲突检查：同一 id 只能对应一条（哈希碰撞或重复行都说明数据有问题）
const seen = new Set();
const unique = [];
for (const row of rows) {
  if (seen.has(row.id)) {
    console.warn('id 冲突，已跳过重复行:', row.id, row.source, row.name, row.url);
    continue;
  }
  seen.add(row.id);
  unique.push(row);
}

// ---------------------------------------------------------------- 组装输出
const missing = [];
const skills = unique.map((row) => {
  const zh = zhMap.get(row.id);
  if (!zh) missing.push({ id: row.id, name: row.name, source: row.source });
  const skill = {
    id: row.id,
    source: row.source,
    category: row.category,
    group: groupOf(row.category),
    name: row.name,
    desc: zh || row.descRaw || '',
    url: row.url,
  };
  skill.tags = tagOf(skill);
  return skill;
});

// 按「来源顺序 → 分类 → 名称」排序，让同一来源同一分类的 skill 挨在一起
const sourceOrder = new Map(SOURCES.map((s, i) => [s.key, i]));
skills.sort((a, b) => {
  const sa = sourceOrder.get(a.source) ?? 99;
  const sb = sourceOrder.get(b.source) ?? 99;
  if (sa !== sb) return sa - sb;
  if (a.category !== b.category) return a.category.localeCompare(b.category, 'zh');
  return a.name.localeCompare(b.name);
});

// ---------------------------------------------------------------- 统计与自检
const bySource = {};
for (const s of skills) bySource[s.source] = (bySource[s.source] || 0) + 1;

const byGroup = {};
for (const s of skills) byGroup[s.group] = (byGroup[s.group] || 0) + 1;

const noDesc = skills.filter((s) => !s.desc || s.desc.length < 4);
const noChinese = skills.filter((s) => s.desc && !/[\u4e00-\u9fa5]/.test(s.desc));

const output = {
  version: 1,
  generatedAt: new Date().toISOString(),
  total: skills.length,
  skills,
};

fs.writeFileSync(path.join(DATA, 'skills.json'), JSON.stringify(output), 'utf8');

console.log(JSON.stringify({
  total: skills.length,
  bySource,
  byGroup,
  zhTranslated: skills.length - missing.length,
  missingTranslation: missing.length,
  emptyDesc: noDesc.length,
  noChinese: noChinese.length,
  outputBytes: fs.statSync(path.join(DATA, 'skills.json')).size,
}, null, 2));

if (missing.length) {
console.log('\n缺少翻译的条目（前 15 条）:');
  for (const m of missing.slice(0, 15)) console.log('  -', m.source, '|', m.name, '|', m.id);
}
if (noChinese.length) {
console.log('\n无中文的描述（前 10 条）:');
  for (const s of noChinese.slice(0, 10)) console.log('  -', s.source, '|', s.name, '|', s.desc.slice(0, 60));
}
