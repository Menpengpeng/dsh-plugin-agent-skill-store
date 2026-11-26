// 安装只接受由调用方按 id 查出的 catalog 记录，不采用 API 返回的下载地址。
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';

const MiB = 1024 * 1024;
function check(ok, message) { if (!ok) throw new Error(message); }
function segment(s) {
  check(typeof s === 'string' && /^\.?[A-Za-z0-9_-][A-Za-z0-9._ -]{0,119}$/.test(s) && s.toLowerCase() !== '.git' && !/[. ]$/.test(s) && !/^(con|prn|aux|nul|com[0-9]|lpt[0-9]) *(\.|$)/i.test(s), '不安全或不支持的路径名称');
  return s;
}
function source(skill) {
  const m = /^https:\/\/github\.com\/([^/?#]+)\/([^/?#]+)((?:\/[^?#]*)?)$/.exec(skill.url);
  check(m && m[0] === skill.url, '仅支持明确的 github.com HTTPS 链接');
  const repo = [segment(m[1]), segment(m[2])].join('/');
  const parts = m[3].replace(/\/$/, '').split('/').slice(1).map(segment);
  const labels = skill.name.split('/').map(segment);
  check(labels.length <= 2, '无法确定技能名称');
  const [kind, ref, ...dir] = parts;
  if (kind) {
    check(ref && (kind === 'tree' || (kind === 'blob' && dir.pop() === 'SKILL.md')), '链接未指向技能目录或 SKILL.md');
    if (dir.length) check(dir.at(-1) === labels.at(-1), '目录与技能名称不一致');
  }
  return { repo, ref, dir, name: labels.at(-1), explicit: !!kind };
}

export async function installSkill(skill) {
  const { repo, ref, dir, name, explicit } = source(skill);
  const signal = AbortSignal.timeout(90000);
  let wire = 0;
  async function json(endpoint, limit, optional = false) {
    const url = `https://api.github.com/repos/${repo}/${endpoint}`;
    let r;
    try { r = await fetch(url, { redirect: 'error', signal, headers: { Accept: 'application/vnd.github+json' } }); }
    catch (error) {
      if (process.platform !== 'win32' || signal.aborted) throw error;
      // Windows 系统网络可达但 Node 直连超时时，使用系统 curl；不读取配置、不跟随跳转、不经过 shell。
      const { execFile } = await import('node:child_process');
      const { promisify } = await import('node:util');
      const { stdout } = await promisify(execFile)(path.join(process.env.SystemRoot, 'System32', 'curl.exe'), ['-q','-sS','--proto','=https','--max-time','12','--max-filesize',String(limit),'-w','\n%{http_code}',url], { signal, maxBuffer: limit + 16, windowsHide: true });
      const cut = stdout.lastIndexOf('\n');
      r = new Response(stdout.slice(0, cut), { status: Number(stdout.slice(cut + 1)) });
    }
    if (!r.ok) { await r.body?.cancel(); if (optional && r.status === 404) return null; throw new Error(`GitHub API: HTTP ${r.status}`); }
    const chunks = []; let size = 0;
    for await (const c of r.body) {
      size += c.length; wire += c.length;
      check(size <= limit && wire <= 24 * MiB, 'GitHub 响应过大'); chunks.push(c);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }
  const list = (p, optional) => json(`contents${p.length ? '/' + p.map(encodeURIComponent).join('/') : ''}${ref ? '?ref=' + encodeURIComponent(ref) : ''}`, MiB, optional);
  const manifest = a => Array.isArray(a) && a.some(x => x.name === 'SKILL.md' && x.type === 'file');
  let base = dir, entries = await list(base);
  if (!explicit) {
    const candidate = ['skills', name];
    const nested = await list(candidate, true);
    check(!(manifest(entries) && manifest(nested)), '存在多个可能的技能目录');
    if (manifest(nested)) { base = candidate; entries = nested; }
    else check(name === repo.split('/')[1], '仓库根目录与技能名称不一致');
  }
  check(manifest(entries), '未找到单技能目录的 SKILL.md');
  const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
  check(path.isAbsolute(home), 'DSH_HOME 必须是绝对路径');
  const root = path.join(home, 'skills');
  await fs.mkdir(home, { recursive: true });
  check((await fs.lstat(home)).isDirectory(), 'DSH_HOME 不能是符号链接');
  try { await fs.mkdir(root); } catch (e) { if (e.code !== 'EEXIST') throw e; }
  check((await fs.lstat(root)).isDirectory(), 'skills 不能是符号链接');
  const dest = path.join(root, name);
  if (await fs.lstat(dest).catch(e => { if (e.code !== 'ENOENT') throw e; })) throw new Error('技能已存在');
  const stage = await fs.mkdtemp(path.join(root, '.install-'));
  let files = 0, total = 0, count = 0, reserved = false;
  async function copy(rows, remote, local, depth) {
    check(Array.isArray(rows) && depth <= 8 && (count += rows.length) <= 192, '技能目录过大或类型不符');
    const seen = new Set();
    for (const x of rows) {
      const n = segment(x.name), key = n.toLowerCase(), next = [...remote, n];
      check(!seen.has(key) && x.path === next.join('/') && !x.submodule_git_url && !x.target, '目录路径冲突或不安全'); seen.add(key);
      check(depth === 0 || key !== 'skill.md', '包含多个技能');
      const file = path.join(local, n);
      if (x.type === 'dir') { await fs.mkdir(file); await copy(await list(next), next, file, depth + 1); continue; }
      check(x.type === 'file' && /^[0-9a-f]{40}$/.test(x.sha), '不支持符号链接或特殊文件');
      check(Number.isSafeInteger(x.size) && x.size >= 0 && x.size <= MiB && (total += x.size) <= 8 * MiB && ++files <= 128, '技能文件过大或过多');
      const blob = await json(`git/blobs/${x.sha}`, 2 * MiB);
      check(blob.encoding === 'base64' && typeof blob.content === 'string', '文件编码不受支持');
      const data = Buffer.from(blob.content, 'base64');
      check(data.length === x.size && createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex') === x.sha, '文件内容校验失败');
      await fs.writeFile(file, data, { flag: 'wx', mode: 0o600 });
    }
  }
  try {
    await copy(entries, base, stage, 0);
    // 独占创建，避免并发 rename 在 POSIX 上替换已有空目录；清单最后发布。
    await fs.mkdir(dest); reserved = true;
    const names = await fs.readdir(stage);
    for (const n of [...names.filter(n => n !== 'SKILL.md'), 'SKILL.md']) await fs.rename(path.join(stage, n), path.join(dest, n));
    return { name, files };
  } catch (e) { if (reserved) await fs.rm(dest, { recursive: true, force: true }); throw e; }
  finally { await fs.rm(stage, { recursive: true, force: true }); }
}
