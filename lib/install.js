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
  let singleFile = '';
  if (kind) {
    // blob 三种可能：指向目录（GitHub 常见误用）、指向 SKILL.md、指向单个技能文件
    check(kind === 'tree' || kind === 'blob', '仅支持 github.com 的 tree 或 blob 链接');
    if (kind === 'tree') check(ref && dir.length, '链接未指向具体目录');
    if (kind === 'blob' && /^skill\.md$/i.test(dir.at(-1) || '')) dir.pop();
    else if (kind === 'blob' && /\.(md|markdown)$/i.test(dir.at(-1) || '')) singleFile = dir.pop();
  }
  // 末尾斜杠表示合集目录而不是单个技能；此时名称不是技能名，交给后续校验拒绝
  const name = labels.at(-1).replace(/\.(md|markdown)$/i, '');
  return { repo, ref, dir, name, kind, singleFile };
}

export async function installSkill(skill) {
  const { repo, ref, dir, name, kind, singleFile } = source(skill);
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
    if (!r.ok) {
      await r.body?.cancel();
      // 未认证的 GitHub API 每小时只有 60 次，限流必须和「找不到」区分开，否则会误导用户以为链接坏了
      if (r.status === 403 || r.status === 429 || r.headers.get('x-ratelimit-remaining') === '0') {
        throw new Error('GitHub API 访问次数已用完（未登录每小时 60 次），请稍后再试');
      }
      if (optional && r.status === 404) return null;
      throw new Error(`GitHub API: HTTP ${r.status}`);
    }
    const chunks = []; let size = 0;
    for await (const c of r.body) {
      size += c.length; wire += c.length;
      check(size <= limit && wire <= 24 * MiB, 'GitHub 响应过大'); chunks.push(c);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }
  const list = (p, optional) => json(`contents${p.length ? '/' + p.map(encodeURIComponent).join('/') : ''}${ref ? '?ref=' + encodeURIComponent(ref) : ''}`, MiB, optional);
  const manifest = a => Array.isArray(a) && a.some(x => x.name === 'SKILL.md' && x.type === 'file');
  // 探测目录：content 接口返回数组才说明这是目录，单文件返回对象
  const probe = async (p) => { const r = await list(p, true); return Array.isArray(r) ? r : null; };
  let base = dir, entries = null;
  // 单文件技能优先：链接指向某个 .md 时，父目录里的同名文件才是这个技能本身
  if (singleFile) {
    const rows = await probe(dir);
    const hit = rows?.find(x => x.name === singleFile && x.type === 'file');
    if (hit) { entries = [{ ...hit, name: 'SKILL.md', path: [...dir, 'SKILL.md'].join('/') }]; base = dir; }
  }
  // 目录优先：链接是 blob 时 GitHub 会自动跳转到目录，所以再按目录探测
  if (!entries) for (const p of [dir, [...dir, name]]) {
    if (!p.length || (base !== dir && p.join('/') === dir.join('/'))) continue;
    const found = await probe(p);
    if (found) {
      // 目录里没有 SKILL.md 但有 skills/ 子目录时，这是合集而不是单个技能
      if (!manifest(found) && Array.isArray(await probe([...p, 'skills']))) throw new Error('该链接指向技能合集，请打开原始链接选择具体技能');
      base = p; entries = found; break;
    }
  }
  if (!entries) {
    // 兜底：仓库根 → skills/<名称>，命中多个或都不是就明确拒绝，绝不退而安装整个合集
    const tries = [[], ['skills', name]];
    const hits = [];
    for (const p of tries) { const rows = await probe(p); if (manifest(rows)) hits.push([p, rows]); }
    check(hits.length <= 1, '存在多个可能的技能目录');
    if (hits.length) { [base, entries] = hits[0]; }
    else check(name === repo.split('/')[1] || dir.length, '仓库根目录与技能名称不一致');
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
