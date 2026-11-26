// 每日同步的行为验证：只追加、不删除、不修改；失败要如实回报。
// 直接测 lib/sync.js 的真实函数（index.js 用的就是它们），不做逻辑复刻。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeNewSkills, syncStatus } from '../lib/sync.js';

// ------------------------------------------------------- 只追加不修改
test('mergeNewSkills 只追加新链接，已有条目一个字段都不动', () => {
  const existing = [
    { id: 'sk_aaaaaaaaaaaa', source: 'VoltAgent', url: 'https://github.com/a/existing', name: 'existing-skill', desc: '旧描述' },
  ];
  const incoming = [
    // 同一条链接：README 里的描述变了，但绝不能覆盖已有记录
    { id: 'sk_aaaaaaaaaaaa', source: 'VoltAgent', url: 'https://github.com/a/existing', name: 'existing-skill', desc: '新描述' },
    { id: 'sk_bbbbbbbbbbbb', source: 'VoltAgent', url: 'https://github.com/a/brand-new', name: 'brand-new-skill', desc: '新条目' },
  ];

  const { added, merged } = mergeNewSkills(existing, incoming);

  assert.equal(added.length, 1, '只应追加 1 条新记录');
  assert.equal(added[0].name, 'brand-new-skill');
  assert.equal(merged[0].desc, '旧描述', '已有条目的描述不能被同步覆盖');
  assert.equal(merged[0].id, 'sk_aaaaaaaaaaaa', '已有条目的 id 必须保持稳定');
  assert.equal(merged.length, 2);
});

test('mergeNewSkills 不删除任何已有条目', () => {
  const existing = [
    { source: 'a', url: 'https://x/1', name: 'one' },
    { source: 'a', url: 'https://x/2', name: 'two' },
  ];
  // 本次解析结果里只出现了 one，two 从 README 里消失了
  const { merged } = mergeNewSkills(existing, [{ source: 'a', url: 'https://x/1', name: 'one' }]);
  assert.equal(merged.length, 2, 'README 里消失的条目不能被删除');
  assert.ok(merged.some((s) => s.name === 'two'));
});

test('mergeNewSkills 对完全相同的输入不产生新增', () => {
  const existing = [{ source: 'VoltAgent', url: 'https://github.com/a/x', name: 'x' }];
  const { added } = mergeNewSkills(existing, [{ source: 'VoltAgent', url: 'https://github.com/a/x', name: 'x' }]);
  assert.equal(added.length, 0);
});

test('mergeNewSkills 把不同来源的同 URL 视为不同条目', () => {
  const existing = [{ source: 'VoltAgent', url: 'https://github.com/a/x', name: 'x' }];
  const { added } = mergeNewSkills(existing, [{ source: 'seb1n', url: 'https://github.com/a/x', name: 'x' }]);
  assert.equal(added.length, 1, '不同来源应各自保留');
});

test('mergeNewSkills 对同 URL 的不同名字不重复添加（按链接判重）', () => {
  const existing = [{ source: 's', url: 'https://github.com/x/y', name: 'angular-developer' }];
  // 同一仓库下第二个 skill，URL 相同但名字不同
  const { added } = mergeNewSkills(existing, [{ source: 's', url: 'https://github.com/x/y', name: 'angular-new-app' }]);
  assert.equal(added.length, 0, '同一链接视为已存在，避免每次同步都重复追加');
});

test('mergeNewSkills 传入空数组不报错', () => {
  const { added, merged } = mergeNewSkills([], []);
  assert.deepEqual(added, []);
  assert.deepEqual(merged, []);
});

// ---------------------------------------------------------- 状态判定
test('syncStatus：有新增报 ok', () => {
  const r = syncStatus({ added: 3, failures: [], totalSources: 6 });
  assert.equal(r.status, 'ok');
  assert.equal(r.message, '');
});

test('syncStatus：抓取正常但无新增报 empty（今日无新增）', () => {
  const r = syncStatus({ added: 0, failures: [], totalSources: 6 });
  assert.equal(r.status, 'empty');
  assert.equal(r.message, '');
});

test('syncStatus：全部来源失败必须报 error，不能报「今日无新增」', () => {
  const failures = ['A：fetch failed', 'B：fetch failed', 'C：fetch failed'];
  const r = syncStatus({ added: 0, failures, totalSources: 3 });
  assert.equal(r.status, 'error', '全部失败时误报 empty 会让用户以为真的没有更新');
  assert.match(r.message, /同步失败/);
  assert.match(r.message, /fetch failed/);
});

test('syncStatus：部分来源失败但有新增，仍报 ok 并说明缺失来源', () => {
  const r = syncStatus({ added: 2, failures: ['A：fetch failed'], totalSources: 6 });
  assert.equal(r.status, 'ok');
  assert.match(r.message, /部分来源未取到/);
});

test('syncStatus：部分来源失败且无新增，报 empty 并说明缺失来源', () => {
  const r = syncStatus({ added: 0, failures: ['A：fetch failed'], totalSources: 6 });
  assert.equal(r.status, 'empty');
  assert.match(r.message, /部分来源未取到/);
});

test('syncStatus：totalSources 为 0 时不误判为全部失败', () => {
  const r = syncStatus({ added: 0, failures: [], totalSources: 0 });
  assert.equal(r.status, 'empty');
});
