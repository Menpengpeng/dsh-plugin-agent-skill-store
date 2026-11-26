// Agent Skill 商店 Host 端：数据集加载、个人数据（收藏/评分/笔记）存储、
// HTTP 路由、AI 推荐（LLM 调用）与每日 09:00 增量同步。
//
// 设计原则：
// 1. 「只给安装插件的用户自己使用」——没有账号、没有登录、没有任何上报，
//    收藏/评分/笔记全部落在本机 storageDomain 里；
// 2. 数据集随插件发布（data/skills.json），每日同步只做「追加」，
//    已有条目永不修改、永不删除，id 稳定保证收藏与笔记不会失效；
// 3. 任何一步同步失败都要如实告诉用户失败原因，不静默吞掉。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { parseAll, DOC_FILES } from './lib/parse.js';
import { classify, groupOf, GROUPS } from './lib/classify.js';
import { SOURCES, TAGS, ROLES, EXAMPLE_PROMPTS, skillId, sourceOf, installCommand } from './lib/catalog.js';
import { searchSkills, recallForRecommendation, overview, msUntilNextSync } from './lib/search.js';
import { mergeNewSkills, syncStatus } from './lib/sync.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const DATASET = path.join(here, 'data', 'skills.json');

const DOMAIN_NAME = 'agent_skill_store';
const ROUTE = '/api/agent-skill-store';

const GITHUB_RAW = 'https://raw.githubusercontent.com';

/** 7 个来源的 README 抓取地址。用 raw 域名，不走 API，避免 60 次/小时的配额限制。 */
const README_SOURCES = [
  { source: 'VoltAgent', file: DOC_FILES.VoltAgent, repo: 'VoltAgent/awesome-agent-skills', path: 'main/README.md' },
  { source: 'anthropics', file: DOC_FILES.anthropics, repo: 'anthropics/skills', path: 'main/README.md' },
  { source: 'seb1n', file: DOC_FILES.seb1n, repo: 'seb1n/awesome-ai-agent-skills', path: 'main/README.md' },
  { source: 'ashutoshsrivastava17', file: DOC_FILES.ashutoshsrivastava17, repo: 'ashutoshsrivastava17/skill-library', path: 'main/README.md' },
  { source: 'awslabs', file: DOC_FILES.awslabs, repo: 'awslabs/hcls-agent-skills', path: 'main/README.md' },
  { source: 'ind4x', file: DOC_FILES.ind4x, repo: 'ind4x/ai-agent-skills', path: 'main/README.md' },
  { source: 'fabricioctelles', file: DOC_FILES.fabricioctelles, repo: 'fabricioctelles/skills', path: 'main/README.md' },
];

// ---------------------------------------------------------------- 存储 schema
const favoriteSchema = z.object({
  skillId: z.string(),
  at: z.string(),
});

const noteSchema = z.object({
  skillId: z.string(),
  rating: z.number().min(1).max(5),
  note: z.string(),
  updatedAt: z.string(),
});

const syncLogSchema = z.object({
  id: z.string(),
  at: z.string(),
  status: z.enum(['ok', 'empty', 'error']),
  added: z.number(),
  sources: z.array(z.string()),
  names: z.array(z.string()),
  message: z.string().optional(),
});

function json(res, status, value) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(value));
}

async function requestBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 262144) throw new Error('请求内容超过 256 KiB');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

// ---------------------------------------------------------------- 数据集
function loadDataset() {
  const text = fs.readFileSync(DATASET, 'utf8').replace(/^\uFEFF/, '');
  const data = JSON.parse(text);
  return {
    version: data.version || 1,
    generatedAt: data.generatedAt || null,
    total: data.total || (data.skills || []).length,
    skills: data.skills || [],
  };
}

// ---------------------------------------------------------------- 每日同步

/**
 * 一个 README 的多条抓取路径，按顺序尝试，前一个失败就换下一个。
 *
 * 为什么需要多条：raw.githubusercontent.com 在部分网络环境下会被解析到
 * 0.0.0.0（DNS 污染）而直接失败，国内网络尤其常见。三条路径的失败原因
 * 各不相同（DNS、代理、配额），任意一条通就能同步，全不通才报错。
 */
function readmeUrls(entry) {
  return [
    // 1. 直连 raw（最标准，海外网络首选）
    `${GITHUB_RAW}/${entry.repo}/${entry.path}`,
    // 2. ghproxy 镜像（国内常用，raw 被污染时仍可用）
    `https://ghproxy.net/${GITHUB_RAW}/${entry.repo}/${entry.path}`,
    // 3. GitHub Contents API（走 api.github.com，配额 60 次/小时，7 个来源够用）
    `https://api.github.com/repos/${entry.repo}/contents/${entry.path.replace(/^[^/]+\//, '')}`,
  ];
}

/**
 * 抓一个 README：依次尝试多条路径，全部失败时抛出带各路径失败原因的错误。
 * @param {object} entry README_SOURCES 里的一项
 * @param {Function} fetchImpl 可注入的 fetch，便于测试
 */
async function fetchReadme(entry, fetchImpl) {
  const reasons = [];
  for (const url of readmeUrls(entry)) {
    try {
      const res = await fetchImpl(url, {
        headers: {
          // GitHub 要求带 UA，否则可能被拒
          'user-agent': 'dsh-agent-skill-store/0.1',
          // Contents API 需要 raw 媒体类型才直接返回文件正文
          accept: url.includes('/contents/') ? 'application/vnd.github.raw' : 'text/plain',
        },
      });
      if (!res.ok) {
        reasons.push(`HTTP ${res.status}`);
        continue;
      }
      const text = await res.text();
      // 内容太短基本可以断定不是 README（比如返回了错误页 JSON）
      if (!text || text.length < 200) {
        reasons.push('返回内容过短');
        continue;
      }
      return text;
    } catch (error) {
      reasons.push(error.message);
    }
  }
  throw new Error(`${entry.repo} 取不到 README（${reasons.join(' / ')}）`);
}

export const inject = ['timer', 'tools', 'storageDomain', 'webServer', 'connection', 'llm', 'agentDefaultModel'];

/**
 * 插件可调项。用户可在自己的 cordis.patch.yml 里覆盖，升级后依然保留。
 * 全部给了默认值，因此已有安装不配置也能照常工作。
 */
export const Config = z.object({
  /** 每日自动同步的小时（目标时区，0–23） */
  syncHour: z.number().int().min(0).max(23).default(9),
  /** 每日自动同步的分钟（0–59） */
  syncMinute: z.number().int().min(0).max(59).default(0),
  /** 目标时区相对 UTC 的分钟偏移，默认 +480 即北京时间 */
  timezoneOffsetMinutes: z.number().int().min(-720).max(840).default(480),
  /** 是否启用每日自动同步；关掉后仍可手动点「检查更新」 */
  autoSync: z.boolean().default(true),
  /** 列表每页条数 */
  pageSize: z.number().int().min(12).max(200).default(48),
}).prefault({});

export async function apply(ctx, input) {
  const config = Config.parse(input);
  const storage = ctx.get('storageDomain');
  const web = ctx.get('webServer');
  const connection = ctx.get('connection');
  const tools = ctx.get('tools');
  const llm = ctx.get('llm');
  const agentDefaultModel = ctx.get('agentDefaultModel');

  let dataset = loadDataset();

  // 存储：收藏、评分笔记、同步日志，三张表按记录存放
  const domain = await storage.open({
    name: DOMAIN_NAME,
    version: 1,
    layout: 'per-record',
    invalidRecords: 'backup-and-skip',
    tables: {
      favorites: { valueSchema: favoriteSchema },
      notes: { valueSchema: noteSchema },
      synclog: { valueSchema: syncLogSchema },
    },
  });
  const favorites = domain.table('favorites');
  const notes = domain.table('notes');
  const syncLog = domain.table('synclog');
  ctx.effect(() => () => domain.close(), 'agent-skill-store storage');

  // 个人数据缓存：读多写少，放内存避免每次请求都扫表
  let personal = { favorites: [], notes: {} };
  let personalAt = 0;
  const PERSONAL_TTL = 2000;

  function readPersonal(force = false) {
    if (!force && Date.now() - personalAt < PERSONAL_TTL) return personal;
    const favs = [...favorites.entries()].map(([, v]) => v);
    const noteMap = {};
    for (const [, v] of notes.entries()) noteMap[v.skillId] = v;
    personal = {
      favorites: favs.sort((a, b) => String(b.at).localeCompare(String(a.at))),
      notes: noteMap,
    };
    personalAt = Date.now();
    return personal;
  }

  function readSyncLog() {
    return [...syncLog.entries()]
      .map(([, v]) => v)
      .sort((a, b) => String(b.at).localeCompare(String(a.at)))
      .slice(0, 30);
  }

  // ------------------------------------------------------------ 每日同步
  let syncing = null;

  /**
   * 增量同步：只追加新出现的 url，已有条目一律不动。
   * @returns {Promise<{status:string, added:number, sources:string[], names:string[], message?:string}>}
   */
  async function runSync({ fetchImpl = globalThis.fetch, dryRun = false } = {}) {
    if (syncing) return syncing;
    syncing = (async () => {
      const docs = {};
      const failures = [];

      for (const entry of README_SOURCES) {
        // anthropics 的条目来自内置清单（19 个官方目录），不需要也没法从 README 抓
        if (entry.source === 'anthropics') continue;
        try {
          docs[entry.source] = await fetchReadme(entry, fetchImpl);
        } catch (error) {
          // 单个来源失败不整体失败，但记下原因，最后如实回报
          failures.push(`${sourceOf(entry.source).label}：${error.message}`);
        }
      }

      const keyed = {
        VoltAgent: docs.VoltAgent || '',
        anthropics: '',
        seb1n: docs.seb1n || '',
        ashutoshsrivastava17: docs.ashutoshsrivastava17 || '',
        awslabs: docs.awslabs || '',
        ind4x: docs.ind4x || '',
        fabricioctelles: docs.fabricioctelles || '',
      };

      const parsed = parseAll(keyed);

      // 先把本次解析出的条目整理成完整字段，再交给 mergeNewSkills 做「只追加」
      const candidates = [];
      for (const [sourceKey, rows] of Object.entries(parsed)) {
        // 抓取失败的来源整体跳过，否则会把它当成「所有条目都消失了」
        if (docs[sourceKey] === undefined && sourceKey !== 'anthropics') continue;
        for (const row of rows) {
          const name = String(row.name || '').trim();
          if (!name) continue;
          const category = classify(row);
          candidates.push({
            id: skillId(row.source, row.url, name),
            source: row.source,
            category,
            group: groupOf(category),
            name,
            // 新条目暂时没有中文翻译，先用原文，界面会显示「待翻译」标记
            desc: String(row.desc || ''),
            url: row.url,
            tags: [],
            untranslated: true,
          });
        }
      }

      // 已有条目一个字段都不动，只追加没见过的新链接
      const { added } = mergeNewSkills(dataset.skills, candidates);

      const sourceLabels = [...new Set(added.map((a) => a.source))].map((k) => sourceOf(k).label);
      const { status, message } = syncStatus({
        added: added.length,
        failures,
        totalSources: README_SOURCES.filter((e) => e.source !== 'anthropics').length,
      });

      if (dryRun) {
        return { status, added: added.length, sources: sourceLabels, names: added.slice(0, 10).map((a) => a.name), message: message || undefined };
      }

      if (added.length) {
        dataset = {
          ...dataset,
          total: dataset.skills.length + added.length,
          generatedAt: new Date().toISOString(),
          skills: [...dataset.skills, ...added],
        };
        fs.writeFileSync(DATASET, JSON.stringify(dataset), 'utf8');
      }

      const entry = {
        id: `sync_${Date.now()}`,
        at: new Date().toISOString(),
        status,
        added: added.length,
        sources: sourceLabels,
        names: added.slice(0, 10).map((a) => a.name),
        message: message || undefined,
      };
      await syncLog.put(entry.id, entry);

      return {
        status: entry.status,
        added: entry.added,
        sources: entry.sources,
        names: entry.names,
        message: entry.message,
      };
    })();

    try {
      return await syncing;
    } finally {
      syncing = null;
    }
  }

  // 到配置的时刻触发；跑完再排下一天。用 ctx.timeout 以便插件卸载时自动清理。
  let timer = null;
  function scheduleNextSync() {
    if (!config.autoSync) return;
    const delay = msUntilNextSync(new Date(), {
      hour: config.syncHour,
      minute: config.syncMinute,
      offsetMinutes: config.timezoneOffsetMinutes,
    });
    timer = ctx.timeout(() => {
      void (async () => {
        try {
          const result = await runSync();
          // 结果写进日志表，界面读取后展示；用户没开界面也不会丢
          ctx.logger?.info?.(`[Agent Skill 商店] 每日同步：${result.status} 新增 ${result.added}`);
        } catch (error) {
          ctx.logger?.warn?.(`[Agent Skill 商店] 每日同步失败：${error.message}`);
        } finally {
          scheduleNextSync();
        }
      })();
    }, delay);
  }
  scheduleNextSync();
  ctx.effect(() => () => {
    if (timer && typeof timer.dispose === 'function') timer.dispose();
    else if (timer) clearTimeout(timer);
  }, 'agent-skill-store sync timer');

  // ------------------------------------------------------------ AI 推荐
  /** 从候选里让模型挑最多 6 个，并给一句中文理由 + 一条搭配建议。 */
  async function recommend(need) {
    const text = String(need || '').trim();
    if (!text) throw new Error('请先描述你需要什么样的 skill');

    const candidates = recallForRecommendation(dataset.skills, text);
    if (!candidates.length) {
      return { picks: [], pairing: '', reason: '没有检索到相关 skill，换个说法试试。' };
    }

    if (!llm || !agentDefaultModel) {
      // 没有 LLM 能力时降级为纯关键词排序，界面依旧能用
      return {
        picks: candidates.slice(0, 6).map((s) => ({
          id: s.id, name: s.name, category: s.category, source: s.source,
          desc: s.desc, url: s.url, reason: '按关键词相关度排序',
        })),
        pairing: '',
        reason: '当前会话未提供模型能力，已按关键词相关度返回。',
        degraded: true,
      };
    }

    const list = candidates.map((s, i) => `${i + 1}. [${s.id}] ${s.name}｜${s.category}｜${String(s.desc).slice(0, 120)}`).join('\n');
    const prompt = [
      '你是 Agent Skill 选型助手。下面是候选 skill 列表（带 id）。',
      `用户需求：${text}`,
      '',
      '候选：',
      list,
      '',
      '请从候选中挑最多 6 个最贴合的，只能挑列表里出现过的 id，不要编造。',
      '严格输出 JSON，不要加代码块标记，格式：',
      '{"picks":[{"id":"候选里的 id","reason":"一句中文说明为什么适合"}],"pairing":"一句中文的搭配使用建议，说明这几个怎么组合"}',
      '若确实没有合适的，picks 返回空数组并在 pairing 里说明原因。',
    ].join('\n');

    const selection = agentDefaultModel.currentSelection();
    const provider = selection.provider;
    const model = selection.model;

    const messages = [
      { role: 'user', content: [{ type: 'text', text: prompt }] },
    ];

    let text_out = '';
    const stream = llm.stream({ provider, model, messages });
    for await (const chunk of stream) {
      if (chunk.type === 'text-delta') text_out += chunk.text || '';
      else if (chunk.type === 'finish') {
        const kind = chunk.reason?.kind;
        if (kind === 'error') throw new Error(chunk.reason.message || '模型调用失败');
        if (kind === 'aborted') throw new Error('模型调用被中断');
      }
    }

    // 模型可能裹了代码块，剥掉再解析
    const cleaned = text_out.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // 解析失败时退回关键词结果，保证界面不空白
      return {
        picks: candidates.slice(0, 6).map((s) => ({
          id: s.id, name: s.name, category: s.category, source: s.source,
          desc: s.desc, url: s.url, reason: '按关键词相关度排序',
        })),
        pairing: '',
        reason: '模型返回内容无法解析，已按关键词相关度返回。',
        degraded: true,
      };
    }

    const byId = new Map(candidates.map((s) => [s.id, s]));
    const picks = [];
    for (const item of Array.isArray(parsed.picks) ? parsed.picks : []) {
      const skill = byId.get(String(item?.id || ''));
      // 只接受候选列表里的 id——模型不许自己发挥
      if (!skill) continue;
      if (picks.some((p) => p.id === skill.id)) continue;
      picks.push({
        id: skill.id,
        name: skill.name,
        category: skill.category,
        source: skill.source,
        desc: skill.desc,
        url: skill.url,
        reason: String(item?.reason || '').slice(0, 120),
      });
      if (picks.length >= 6) break;
    }

    return { picks, pairing: String(parsed.pairing || '').slice(0, 300), reason: '' };
  }

  // ------------------------------------------------------------ HTTP 路由
  if (web) {
    const dispose = web.register({
      kind: 'exact',
      path: ROUTE,
      async handler(req, res) {
        const rejection = connection?.requestRejection?.(req);
        if (rejection) return json(res, rejection, { error: '请求未通过 Harness 认证' });
        try {
          if (req.method === 'GET') {
            const url = new URL(req.url || '/', 'http://localhost');
            const action = url.searchParams.get('action') || 'bootstrap';
            if (action === 'bootstrap') {
              const favs = readPersonal(true);
              // 每个大类在全库有多少个，供侧边栏显示（不能用当前页结果推算）
              const groupCounts = {};
              for (const skill of dataset.skills) {
                groupCounts[skill.group] = (groupCounts[skill.group] || 0) + 1;
              }
              return json(res, 200, {
                meta: {
                  total: dataset.total,
                  generatedAt: dataset.generatedAt,
                  version: dataset.version,
                  pageSize: config.pageSize,
                  syncHour: config.syncHour,
                  syncMinute: config.syncMinute,
                  timezoneOffsetMinutes: config.timezoneOffsetMinutes,
                  autoSync: config.autoSync,
                },
                overview: overview(dataset.skills),
                sources: SOURCES,
                tags: TAGS.map((t) => t.key),
                roles: ROLES,
                examples: EXAMPLE_PROMPTS,
                groupOrder: GROUPS,
                groupCounts,
                favorites: favs.favorites,
                notes: favs.notes,
                syncLog: readSyncLog(),
              });
            }
            if (action === 'skills') {
              return json(res, 200, { skills: dataset.skills });
            }
            if (action === 'sync-log') {
              return json(res, 200, { log: readSyncLog() });
            }
            return json(res, 400, { error: `未知操作 ${action}` });
          }

          if (req.method === 'POST') {
            const body = await requestBody(req);

            if (body.type === 'install-skill') {
              // 安装目标只取自本机目录，不接受客户端提供的 URL 或文件路径。
              if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) return json(res, 415, { error: '需要 JSON 请求' });
              const skill = dataset.skills.find(s => s.id === body.skillId);
              if (!skill) return json(res, 404, { error: '未找到指定技能' });
              const { installSkill } = await import('./lib/install.js');
              return json(res, 200, await installSkill(skill));
            }

            if (body.type === 'search') {
              const result = searchSkills(dataset.skills, body);
              const page = Math.max(1, Number(body.page) || 1);
              const size = Math.min(200, Math.max(1, Number(body.pageSize) || config.pageSize));
              return json(res, 200, {
                total: result.length,
                page,
                pageSize: size,
                skills: result.slice((page - 1) * size, page * size),
              });
            }

            // 详情面板需要：安装命令（按来源规则推导）+ 同类 skill（全库范围内）
            if (body.type === 'detail') {
              const id = String(body.skillId || '');
              const skill = dataset.skills.find((s) => s.id === id);
              if (!skill) return json(res, 404, { error: '找不到该 skill' });
              const similar = dataset.skills
                .filter((s) => s.category === skill.category && s.id !== skill.id)
                .sort((a, b) => {
                  // 同来源的排在前面，用户更容易顺着一路看下去
                  const sa = a.source === skill.source ? 0 : 1;
                  const sb = b.source === skill.source ? 0 : 1;
                  return sa - sb || a.name.localeCompare(b.name);
                })
                .slice(0, 6)
                .map((s) => ({ id: s.id, name: s.name, category: s.category, source: s.source, desc: s.desc, url: s.url }));
              return json(res, 200, {
                skill: { ...skill, install: installCommand(skill) },
                similar,
              });
            }

            if (body.type === 'toggle-favorite') {
              const id = String(body.skillId || '');
              if (!id) return json(res, 400, { error: '缺少 skillId' });
              if (favorites.has(id)) {
                await favorites.delete(id);
                readPersonal(true);
                return json(res, 200, { favorited: false });
              }
              await favorites.put(id, { skillId: id, at: new Date().toISOString() });
              readPersonal(true);
              return json(res, 200, { favorited: true });
            }

            if (body.type === 'save-note') {
              const id = String(body.skillId || '');
              if (!id) return json(res, 400, { error: '缺少 skillId' });
              const rating = Math.round(Number(body.rating) || 0);
              const note = String(body.note || '').slice(0, 4000);
              if (rating < 1 || rating > 5) return json(res, 400, { error: '评分需为 1–5' });
              await notes.put(id, { skillId: id, rating, note, updatedAt: new Date().toISOString() });
              readPersonal(true);
              return json(res, 200, { saved: true });
            }

            if (body.type === 'delete-note') {
              const id = String(body.skillId || '');
              if (id && notes.has(id)) await notes.delete(id);
              readPersonal(true);
              return json(res, 200, { deleted: true });
            }

            if (body.type === 'recommend') {
              return json(res, 200, await recommend(body.need));
            }

            if (body.type === 'role-recommend') {
              const roleKey = String(body.role || '');
              const role = ROLES.find((r) => r.key === roleKey);
              if (!role) return json(res, 400, { error: '未知角色' });
              // 按命中关键词个数打分，取前 8
              const scored = [];
              for (const skill of dataset.skills) {
                const text = `${skill.name} ${skill.desc} ${skill.category} ${(skill.tags || []).join(' ')}`.toLowerCase();
                let hits = 0;
                for (const word of role.words) if (text.includes(word.toLowerCase())) hits += 1;
                if (hits) scored.push({ skill, hits });
              }
              scored.sort((a, b) => b.hits - a.hits || a.skill.name.localeCompare(b.skill.name));
              return json(res, 200, { role: role.key, skills: scored.slice(0, 8).map((x) => x.skill) });
            }

            if (body.type === 'sync') {
              return json(res, 200, await runSync({ dryRun: Boolean(body.dryRun) }));
            }

            return json(res, 400, { error: 'invalid request' });
          }

          return json(res, 405, { error: 'method not allowed' });
        } catch (error) {
          return json(res, 500, { error: String(error?.message || error) });
        }
      },
    });
    ctx.effect(() => dispose, 'agent-skill-store route');
  }

  // ------------------------------------------------------------ Agent 工具
  if (tools) {
    const dispose = tools.register({
      name: 'agent_skill_store',
      description: '检索本机 Agent Skill 商店里的 skill（7 个开源合集，中文描述），可按关键词、来源、分类与用途标签筛选；也可查看收藏、查询同步日志。只读本机数据，不联网。',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['search', 'detail', 'favorites', 'overview', 'sync-log', 'sync'],
            description: 'search=关键词检索；detail=按 id 取详情；favorites=我的收藏；overview=概览统计；sync-log=同步日志；sync=立即执行一次增量同步',
          },
          query: { type: 'string', description: '关键词，中英文均可' },
          source: { type: 'string', description: '来源 key，例如 VoltAgent / anthropics / seb1n' },
          group: { type: 'string', description: '大类，例如 开发与代码 / 设计与前端' },
          tag: { type: 'string', description: '用途标签，例如 数据分析 / 测试 / 安全' },
          id: { type: 'string', description: 'detail 动作需要的 skill id' },
          limit: { type: 'number', description: '返回条数，默认 20，最大 100' },
        },
        required: ['action'],
        additionalProperties: false,
      },
      output: {
        schema: { type: 'object', additionalProperties: true },
        render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
      },
      async execute(input) {
        if (input.action === 'search') {
          const limit = Math.min(100, Math.max(1, Number(input.limit) || 20));
          const result = searchSkills(dataset.skills, input);
          return {
            total: result.length,
            skills: result.slice(0, limit).map((s) => ({
              id: s.id, name: s.name, category: s.category, source: s.source, desc: s.desc, url: s.url,
            })),
          };
        }
        if (input.action === 'detail') {
          const skill = dataset.skills.find((s) => s.id === String(input.id || ''));
          if (!skill) throw new Error(`找不到 id 为 ${input.id} 的 skill`);
          const favs = readPersonal(true);
          return {
            skill,
            favorited: favs.favorites.some((f) => f.skillId === skill.id),
            myNote: favs.notes[skill.id] || null,
          };
        }
        if (input.action === 'favorites') {
          const favs = readPersonal(true);
          const byId = new Map(dataset.skills.map((s) => [s.id, s]));
          return {
            total: favs.favorites.length,
            skills: favs.favorites
              .map((f) => ({ ...byId.get(f.skillId), favoritedAt: f.at, rating: favs.notes[f.skillId]?.rating }))
              .filter((s) => s.id),
          };
        }
        if (input.action === 'overview') return overview(dataset.skills);
        if (input.action === 'sync-log') return { log: readSyncLog() };
        if (input.action === 'sync') return await runSync();
        throw new Error(`未知操作 ${input.action}`);
      },
    });
    ctx.effect(() => dispose, 'agent-skill-store tool');
  }
}
