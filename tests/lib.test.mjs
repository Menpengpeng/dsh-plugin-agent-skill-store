// 最小验证：解析、分类、检索、概览、同步调度。
// 运行：node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseVoltAgent, parseTableSource, parseFabricio, parseAnthropic, dedupe, isNoise } from '../lib/parse.js';
import { classify, groupOf, GROUPS } from '../lib/classify.js';
import { skillId, installCommand, repoOf, SOURCES, TAGS, ROLES, EXAMPLE_PROMPTS } from '../lib/catalog.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(here, '..', 'data');

// ------------------------------------------------------------------ parse
test('isNoise 只排除 .git 与 retired/moved', () => {
  assert.equal(isNoise('x', 'https://github.com/a/b.git'), true);
  assert.equal(isNoise('retired skill', 'https://github.com/a/b'), true);
  assert.equal(isNoise('moved away', 'https://github.com/a/b'), true);
  // deprecated 不算噪声：用户可能仍愿意参考
  assert.equal(isNoise('deprecated thing', 'https://github.com/a/b'), false);
  assert.equal(isNoise('normal', 'https://github.com/a/b'), false);
});

test('parseVoltAgent 能解析标题、分组与条目', () => {
  const md = [
    '### Core Skills',
    '<summary><h3 style="display:inline">Basics</h3></summary>',
    '- **[alpha](https://github.com/a/alpha)** - does alpha',
    '- **[beta](https://github.com/a/beta)** - does beta',
  ].join('\n');
  const rows = parseVoltAgent(md);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].top, 'Core Skills');
  assert.equal(rows[0].sub, 'Basics');
  assert.equal(rows[0].name, 'alpha');
  assert.equal(rows[0].desc, 'does alpha');
});

test('parseTableSource 的 twoColumnsOnly 跳过三列导航矩阵', () => {
  const md = [
    '## Skills Index',
    '### Section A',
    '| Skill | Description |',
    '| --- | --- |',
    '| [one](https://github.com/a/one) | first |',
    '| [two](https://github.com/a/two) | [link](x) | [nav](y) |',
    '## Skill Format',
    '| [after](https://github.com/a/after) | should not appear |',
  ].join('\n');
  const rows = parseTableSource(md, 'a/b', 'seb1n', {
    startMarker: /^##\s+Skills Index/,
    stopMarker: /^##\s+Skill Format/,
    twoColumnsOnly: true,
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, 'one');
});

test('parseFabricio 跳过 Migrated 条目并取到详情链接', () => {
  const md = [
    '## Available Skills',
    '### 🎨 Color Expert [![x](badge)](https://skillsdirectory.com/skills/foo-color-expert) · `code-quality`',
    'Analyzes colors deeply.',
    '### Gone Skill _(moved)_',
    '> **Migrated** → moved to other repo',
    '## Next Section',
  ].join('\n');
  const rows = parseFabricio(md);
  assert.equal(rows.length, 1);
  assert.match(rows[0].name, /Color Expert/);
  assert.equal(rows[0].sub, '社区 / code-quality');
  assert.equal(rows[0].desc, 'Analyzes colors deeply.');
});

test('parseAnthropic 返回 19 条且都是官方来源', () => {
  const rows = parseAnthropic();
  assert.equal(rows.length, 19);
  assert.ok(rows.every((r) => r.source === 'anthropics'));
  assert.ok(rows.some((r) => r.name === 'anthropics/xlsx'));
});

test('dedupe 用 source+name+url 去重，保留同 URL 的不同 skill', () => {
  const rows = [
    { source: 's', name: 'a', url: 'https://github.com/x/y' },
    { source: 's', name: 'a', url: 'https://github.com/x/y' }, // 完全重复 → 去掉
    { source: 's', name: 'b', url: 'https://github.com/x/y' }, // 同 URL 不同名 → 保留
  ];
  assert.equal(dedupe(rows).length, 2);
});

// ---------------------------------------------------------------- classify
test('classify 命中已知来源分类', () => {
  assert.equal(classify({ top: 'Python Skills', sub: '' }), '开发与代码 / Python');
  assert.equal(classify({ top: '插件', sub: '社区 / 插件合集' }), 'MCP 与 Agent / 插件合集');
  assert.equal(classify({ top: '医疗生命科学', sub: 'Genomics / 推理型' }), '医疗生命科学 / 基因组学');
});

test('classify 对大厂合集按用途归一，不保留厂商名', () => {
  assert.equal(classify({ top: 'Official Skills by', sub: 'Skills by Figma' }), '设计与前端 / UI/UX 设计');
  assert.equal(classify({ top: 'Official Skills by', sub: 'Skills by Vercel' }), '云与运维 / 云平台部署');
});

test('classify 兜底不返回空，groupOf 永远落在大类表内', () => {
  for (const row of [{ top: '', sub: '', name: '', desc: '' }, { top: '???', sub: '???', name: 'zzz', desc: 'qqq' }]) {
    const cat = classify(row);
    assert.ok(cat.includes(' / '), `分类格式应为「大类 / 子类」，实际 ${cat}`);
    assert.ok(GROUPS.includes(groupOf(cat)), `大类应在白名单内，实际 ${groupOf(cat)}`);
  }
});

// ------------------------------------------------------------------ catalog
test('skillId 稳定，且同 URL 不同名不撞', () => {
  const a = skillId('s', 'https://github.com/x/y', 'alpha');
  const b = skillId('s', 'https://github.com/x/y', 'beta');
  assert.notEqual(a, b);
  assert.equal(a, skillId('s', 'https://github.com/x/y', 'alpha'));
  assert.match(a, /^sk_[0-9a-f]{12}$/);
});

test('repoOf 解析 GitHub 链接', () => {
  assert.equal(repoOf('https://github.com/anthropics/skills/tree/main/skills/pdf'), 'anthropics/skills');
  assert.equal(repoOf('https://github.com/a/b.git'), 'a/b');
  assert.equal(repoOf('https://example.com/x'), null);
});

test('installCommand 按来源给出不同命令', () => {
  const official = installCommand({ source: 'anthropics', url: 'https://github.com/anthropics/skills/tree/main/skills/pdf' });
  assert.match(official.command, /plugin marketplace add anthropics\/skills/);

  const other = installCommand({ source: 'VoltAgent', url: 'https://github.com/anthropics/skills' });
  assert.match(other.command, /^npx skills add anthropics\/skills$/);

  const unknown = installCommand({ source: 'seb1n', url: 'https://example.com/x' });
  // 没有 GitHub 链接时退回该来源的仓库
  assert.match(unknown.command, /npx skills add seb1n\/awesome-ai-agent-skills/);
});

test('catalog 常量完整', () => {
  assert.equal(SOURCES.length, 7);
  assert.equal(TAGS.length, 13);
  assert.equal(ROLES.length, 12);
  assert.equal(EXAMPLE_PROMPTS.length, 4);
  assert.ok(SOURCES.every((s) => /^#[0-9a-f]{6}$/i.test(s.color)));
});

// ------------------------------------------------------------------- 数据集
const datasetPath = path.join(DATA, 'skills.json');
test('发布数据集结构正确', { skip: !fs.existsSync(datasetPath) && '尚未构建 skills.json' }, () => {
  const data = JSON.parse(fs.readFileSync(datasetPath, 'utf8').replace(/^\uFEFF/, ''));
  assert.ok(data.total > 1500, `总数应大于 1500，实际 ${data.total}`);
  assert.equal(data.total, data.skills.length);

  const ids = new Set();
  for (const skill of data.skills) {
    assert.match(skill.id, /^sk_[0-9a-f]{12}$/);
    assert.ok(!ids.has(skill.id), `id 重复：${skill.id}`);
    ids.add(skill.id);

    assert.ok(skill.name && skill.name.length, '名称不能为空');
    assert.ok(skill.url && /^https?:\/\//.test(skill.url), `URL 非法：${skill.url}`);
    assert.ok(skill.category.includes(' / '), `分类格式错误：${skill.category}`);
    assert.ok(GROUPS.includes(skill.group), `大类非法：${skill.group}`);
    assert.equal(skill.category.split(' / ')[0], skill.group, `group 应与分类首段一致：${skill.id}`);
    assert.ok(Array.isArray(skill.tags) && skill.tags.length <= 3, `标签数量应为 0–3：${skill.id}`);
    assert.ok(SOURCES.some((s) => s.key === skill.source), `未知来源：${skill.source}`);
  }

  // 来源数量应与抽取结果一致
  const counts = {};
  for (const s of data.skills) counts[s.source] = (counts[s.source] || 0) + 1;
  assert.equal(counts.anthropics, 19);
  assert.equal(counts.awslabs, 43);
  assert.equal(counts.fabricioctelles, 23);
});
