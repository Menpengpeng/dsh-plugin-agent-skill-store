import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { installSkill } from '../lib/install.js';

const repo = 'https://github.com/ind4x/ai-agent-skills';
const base = 'testing-qa/guard';
const card = { name: 'guard', url: `${repo}/blob/main/${base}/SKILL.md` };
async function fixture(t) {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'install-test-'));
  const saved = process.env.DSH_HOME;
  process.env.DSH_HOME = home;
  t.after(async () => { if (saved === undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME = saved; await fs.rm(home, { recursive: true, force: true }); });
  const routes = new Map();
  t.mock.method(globalThis, 'fetch', async (url, opts) => {
    const prefix = 'https://api.github.com/repos/ind4x/ai-agent-skills/';
    assert.ok(url.startsWith(prefix)); assert.equal(opts.redirect, 'error');
    const key = url.slice(prefix.length);
    return routes.has(key) ? Response.json(routes.get(key)) : new Response(null, { status: 404 });
  });
  function file(p, text) {
    const b = Buffer.from(text); const sha = createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex');
    routes.set(`git/blobs/${sha}`, { encoding: 'base64', content: b.toString('base64') });
    return { name: p.split('/').at(-1), path: p, type: 'file', size: b.length, sha };
  }
  const key = `contents/${base}?ref=main`;
  const entries = [file(`${base}/SKILL.md`, '# guard'), { name: 'scripts', path: `${base}/scripts`, type: 'dir' }];
  routes.set(key, entries);
  routes.set(`contents/${base}/scripts?ref=main`, [file(`${base}/scripts/run.js`, 'throw Error("never execute")')]);
  return { root: path.join(home, 'skills'), file, routes, entries, key };
}

test('精确解析 ind4x 清单，保存资源但不执行，不覆盖既有安装', async t => {
  const { root } = await fixture(t);
  assert.deepEqual(await installSkill(card), { name: 'guard', files: 2 });
  assert.equal(await fs.readFile(path.join(root, 'guard/scripts/run.js'), 'utf8'), 'throw Error("never execute")');
  await assert.rejects(installSkill(card), /已存在/);
  assert.deepEqual(await fs.readdir(root), ['guard']);
});
for (const nested of [true, false]) test(`仓库链接解析：${nested ? '精确子目录' : '根清单'}`, async t => {
  const { routes, file } = await fixture(t);
  const name = nested ? 'guard' : 'ai-agent-skills';
  routes.set('contents', nested ? [] : [file('SKILL.md', '# root')]);
  if (nested) routes.set('contents/skills/guard', [file('skills/guard/SKILL.md', '# guard')]);
  assert.deepEqual(await installSkill({ name: `ind4x/${name}`, url: repo }), { name, files: 1 });
});
test('拒绝不明确仓库与非受信链接', async t => {
  const { routes, file } = await fixture(t);
  routes.set('contents', [file('SKILL.md', '# root')]);
  routes.set('contents/skills/guard', [file('skills/guard/SKILL.md', '# guard')]);
  await assert.rejects(installSkill({ ...card, url: repo }), /多个/);
  for (const url of [repo.replace('github.com', 'github.com.example'), `${repo}/tree/main/../guard`, `${repo}/blob/main/${base}/script.js`, `${repo}/tree/main/%2e%2e/guard`]) await assert.rejects(installSkill({ ...card, url }));
});
test('异常目录项、符号链接和超限均清理暂存', async t => {
  const { root, entries, routes, key } = await fixture(t);
  for (const bad of [{ name: '../else' }, { name: 'CON.txt' }, { name: 'a:b' }, { name: 'a.' }, { name: 'a~1' }, { name: 'SKILL.MD' }, { type: 'symlink' }, { size: 2 ** 21 }, { path: 'elsewhere' }, { sha: '0'.repeat(40) }]) {
    const x = { ...entries[0], name: 'extra', ...bad }; x.path = bad.path ?? `${base}/${x.name}`;
    routes.set(key, [...entries, x]); await assert.rejects(installSkill(card));
    assert.deepEqual(await fs.readdir(root), []);
  }
});
