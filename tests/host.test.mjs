// Host 端纯函数验证：分词、检索排序、概览统计、同步时间计算。
// 这些函数在 lib/search.js 里，不依赖 ctx 与外部包，可以直接 import 后测试。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize, searchSkills, overview, msUntilNextSync } from '../lib/search.js';

const FIXTURE = [
  { id: 'sk_1', source: 'anthropics', category: '文档与写作 / 文档处理', group: '文档与写作', name: 'anthropics/xlsx', desc: '创建与编辑 Excel 电子表格', url: 'https://github.com/anthropics/skills/tree/main/skills/xlsx', tags: ['文档处理', '数据分析'] },
  { id: 'sk_2', source: 'VoltAgent', category: '测试与质量 / E2E 与浏览器测试', group: '测试与质量', name: 'playwright-testing', desc: '用 Playwright 写端到端测试', url: 'https://github.com/a/playwright', tags: ['测试'] },
  { id: 'sk_3', source: 'VoltAgent', category: '设计与前端 / UI/UX 设计', group: '设计与前端', name: 'figma-design', desc: '把 Figma 设计稿转成组件', url: 'https://github.com/a/figma', tags: ['前端设计'] },
  { id: 'sk_4', source: 'ind4x', category: '开发与代码 / API 与集成', group: '开发与代码', name: 'api-client', desc: '生成 API 客户端与类型定义', url: 'https://github.com/a/api', tags: [] },
];

// ------------------------------------------------------------------ tokenize
test('tokenize 中文切成 2 字片段，英文整词保留', () => {
  const tokens = tokenize('单元测试 Playwright');
  assert.ok(tokens.includes('测试'), '应包含「测试」');
  assert.ok(tokens.includes('单元'));
  assert.ok(tokens.includes('playwright'));
});

test('tokenize 空输入返回空数组', () => {
  assert.deepEqual(tokenize(''), []);
  assert.deepEqual(tokenize('   '), []);
});

// ---------------------------------------------------------------- searchSkills
test('完全同名的结果排第一', () => {
  const result = searchSkills(FIXTURE, { query: 'api-client' });
  assert.equal(result[0].id, 'sk_4');
});

test('中文关键词能命中中文描述', () => {
  const result = searchSkills(FIXTURE, { query: '测试' });
  assert.ok(result.some((s) => s.id === 'sk_2'));
});

test('按来源筛选', () => {
  const result = searchSkills(FIXTURE, { source: 'VoltAgent' });
  assert.equal(result.length, 2);
  assert.ok(result.every((s) => s.source === 'VoltAgent'));
});

test('按大类筛选', () => {
  const result = searchSkills(FIXTURE, { group: '设计与前端' });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'sk_3');
});

test('按用途标签筛选', () => {
  const result = searchSkills(FIXTURE, { tag: '文档处理' });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'sk_1');
});

test('按 id 列表筛选（用于「仅看收藏」）', () => {
  const result = searchSkills(FIXTURE, { ids: ['sk_1', 'sk_3'] });
  assert.equal(result.length, 2);
  assert.deepEqual(result.map((s) => s.id).sort(), ['sk_1', 'sk_3']);
});

test('多词 AND：命中太少词的结果被剔除', () => {
  // 「测试」只命中 sk_2；「完全不相关的内容」一个都不命中 → 不应返回结果
  const result = searchSkills(FIXTURE, { query: '测试 完全不相关的内容 zzz' });
  assert.equal(result.length, 0, '命中率过低时不应返回结果');
});

test('关键词与筛选条件可叠加', () => {
  const result = searchSkills(FIXTURE, { query: '测试', source: 'VoltAgent' });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'sk_2');
});

test('无匹配时返回空数组而不是报错', () => {
  assert.deepEqual(searchSkills(FIXTURE, { query: 'qqqqqqqq' }), []);
});

// ------------------------------------------------------------------ overview
test('overview 统计来源数量、占比与分类 Top10', () => {
  const ov = overview(FIXTURE);
  assert.equal(ov.total, 4);

  const volt = ov.sources.find((s) => s.key === 'VoltAgent');
  assert.equal(volt.count, 2);
  assert.ok(Math.abs(volt.share - 0.5) < 1e-9);

  // 7 个来源都要出现（数量为 0 的也在，界面才画得出完整图例）
  assert.equal(ov.sources.length, 7);

  assert.ok(ov.topCategories.length <= 10);
  assert.equal(ov.topCategories[0].count, 1);
});

test('overview 分类 Top10 按数量降序', () => {
  const many = Array.from({ length: 12 }, (_, i) => ({
    id: `sk_${i}`, source: 'VoltAgent', category: `开发与代码 / 子类${i}`, group: '开发与代码',
    name: `n${i}`, desc: 'd', url: `https://github.com/a/${i}`, tags: [],
  }));
  const ov = overview(many);
  assert.equal(ov.topCategories.length, 10);
  const counts = ov.topCategories.map((c) => c.count);
  assert.deepEqual(counts, [...counts].sort((a, b) => b - a));
});

// ------------------------------------------------------------ msUntilNextSync
test('msUntilNextSync 返回 0 到 24 小时之间', () => {
  const ms = msUntilNextSync(new Date('2026-11-26T00:00:00Z'));
  assert.ok(ms > 0);
  assert.ok(ms <= 24 * 60 * 60 * 1000);
});

test('msUntilNextSync 在 09:00 前后的取值符合预期', () => {
  // 北京时间 08:00（UTC 00:00）→ 距 09:00 还有 1 小时
  const beforeNine = msUntilNextSync(new Date('2026-11-26T00:00:00Z'));
  assert.equal(beforeNine, 60 * 60 * 1000);

  // 北京时间 10:00（UTC 02:00）→ 已过 09:00，应指向次日 09:00，即 23 小时
  const afterNine = msUntilNextSync(new Date('2026-11-26T02:00:00Z'));
  assert.equal(afterNine, 23 * 60 * 60 * 1000);
});

test('msUntilNextSync 恰好 09:00 时指向次日（避免同日重复触发）', () => {
  // 北京时间 09:00 = UTC 01:00
  const atNine = msUntilNextSync(new Date('2026-11-26T01:00:00Z'));
  assert.equal(atNine, 24 * 60 * 60 * 1000);
});

test('msUntilNextSync 支持自定义时刻与时区（Config 可覆盖）', () => {
  // 北京时间 08:00，配置成 06:30 → 已过，应指向次日 06:30，即 22.5 小时
  const ms = msUntilNextSync(new Date('2026-11-26T00:00:00Z'), { hour: 6, minute: 30 });
  assert.equal(ms, 22.5 * 60 * 60 * 1000);
});

test('msUntilNextSync 时区偏移生效：UTC 时区下 09:00 与默认不同', () => {
  // UTC 00:00，偏移 0 表示目标时区就是 UTC，距 09:00 还有 9 小时
  const utc = msUntilNextSync(new Date('2026-11-26T00:00:00Z'), { offsetMinutes: 0 });
  assert.equal(utc, 9 * 60 * 60 * 1000);
  // 同一时刻按北京时间算是 1 小时
  const beijing = msUntilNextSync(new Date('2026-11-26T00:00:00Z'));
  assert.equal(beijing, 60 * 60 * 1000);
});
