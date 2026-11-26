// 检索、概览与同步时间计算。
// 这里只放纯函数，不依赖 ctx 与任何外部包，方便直接跑测试。
import { SOURCES, sourceOf } from './catalog.js';

/**
 * 中文检索分词：中文按 2 字切片，英文/数字按词切。
 * 「帮我写单元测试」→ [帮我, 我写, 写单, 单元, 元测, 测试, 帮我写单元测试]，
 * 这样「测试」也能命中，不必要求用户输入分词良好的短语。
 */
export function tokenize(text) {
  const raw = String(text || '').toLowerCase().trim();
  if (!raw) return [];
  const tokens = new Set();
  for (const word of raw.split(/[\s,，。；;、/|+]+/)) {
    if (!word) continue;
    // 纯 ASCII 的词整体保留；含中文的词切成 2 字片段再补上原词
    if (/^[\x20-\x7e]+$/.test(word)) {
      tokens.add(word);
      continue;
    }
    for (let i = 0; i < word.length - 1; i += 1) tokens.add(word.slice(i, i + 2));
    tokens.add(word);
  }
  return [...tokens].filter(Boolean);
}

/**
 * 关键词检索：名称权重高于描述与分类，完全同名排最前。
 * @param {Array} skills 全量 skill
 * @param {{query?:string, source?:string, group?:string, tag?:string, ids?:string[]}} filter
 */
export function searchSkills(skills, { query = '', source = '', group = '', tag = '', ids = [] } = {}) {
  let list = skills;
  if (source) list = list.filter((s) => s.source === source);
  if (group) list = list.filter((s) => s.group === group);
  if (tag) list = list.filter((s) => (s.tags || []).includes(tag));
  if (ids && ids.length) {
    const set = new Set(ids);
    list = list.filter((s) => set.has(s.id));
  }

  const q = String(query || '').trim();
  if (!q) return list;

  const tokens = tokenize(q);
  if (!tokens.length) return list;

  const lower = q.toLowerCase();
  const scored = [];
  for (const skill of list) {
    const name = String(skill.name || '').toLowerCase();
    const desc = String(skill.desc || '').toLowerCase();
    const category = String(skill.category || '').toLowerCase();
    const srcLabel = String(sourceOf(skill.source).label || '').toLowerCase();

    let score = 0;
    let matched = 0;

    // 整串命中：完全同名最高优先
    if (name === lower) score += 1000;
    if (name.includes(lower)) score += 120;
    if (desc.includes(lower)) score += 40;
    if (category.includes(lower)) score += 20;
    if (srcLabel.includes(lower)) score += 10;

    for (const token of tokens) {
      let hit = false;
      if (name.includes(token)) { score += 30; hit = true; }
      if (desc.includes(token)) { score += 8; hit = true; }
      if (category.includes(token)) { score += 5; hit = true; }
      if (hit) matched += 1;
    }

    if (!score) continue;
    // 多词 AND：至少要命中一半的词，否则长句里的噪声词会拉进大量无关结果
    if (tokens.length > 1 && matched < Math.ceil(tokens.length / 2)) continue;
    scored.push({ skill, score });
  }

  scored.sort((a, b) => b.score - a.score || a.skill.name.localeCompare(b.skill.name));
  return scored.map((item) => item.skill);
}

/** 自然语言推荐：分出中英文实词，按逆文档频率加权，不要求口语填充词命中。 */
export function recallForRecommendation(skills, text) {
  const stop = new Set(['我','想','需要','帮','一下','这个','一个','有没有','怎么','使用','可以','项目','里面','用','写','把','给','的','我想','我要','帮我']);
  const words = [...new Intl.Segmenter('zh', { granularity: 'word' }).segment(String(text).toLowerCase())]
    .filter(x => x.isWordLike && x.segment.length > 1 && !stop.has(x.segment)).map(x => x.segment);
  const terms = [...new Set(words)];
  const scores = new Map();
  for (const term of terms) {
    const hits = [];
    for (const skill of skills) {
      const weight = skill.name.toLowerCase().includes(term) ? 4 : skill.desc.toLowerCase().includes(term) ? 2 : skill.category.toLowerCase().includes(term) ? 1 : 0;
      if (weight) hits.push([skill, weight]);
    }
    const idf = Math.log(1 + skills.length / (1 + hits.length));
    for (const [skill, weight] of hits) scores.set(skill, (scores.get(skill) || 0) + weight * idf);
  }
  return [...scores.keys()].sort((a,b) => scores.get(b) - scores.get(a)).slice(0, 70);
}

/** 概览统计：每个来源的数量与占比、前 10 个分类。 */
export function overview(skills) {
  const bySource = new Map();
  for (const skill of skills) bySource.set(skill.source, (bySource.get(skill.source) || 0) + 1);

  // 7 个来源全部列出（数量为 0 也保留），界面上图例才是完整的
  const sources = SOURCES.map((s) => {
    const count = bySource.get(s.key) || 0;
    return {
      key: s.key,
      label: s.label,
      color: s.color,
      repo: s.repo,
      count,
      share: skills.length ? count / skills.length : 0,
    };
  });

  const byCategory = new Map();
  for (const skill of skills) byCategory.set(skill.category, (byCategory.get(skill.category) || 0) + 1);
  const topCategories = [...byCategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([category, count]) => ({ category, count }));

  return { total: skills.length, sources, topCategories };
}

// 每日同步时间：北京时间 09:00（可通过插件 Config 覆盖）
export const SYNC_HOUR = 9;
export const SYNC_MINUTE = 0;
export const TIMEZONE_OFFSET_MINUTES = 8 * 60;

/**
 * 计算下一次同步时间距现在的毫秒数。
 * @param {Date} now 当前时间
 * @param {{hour?: number, minute?: number, offsetMinutes?: number}} options
 *        可选的计划时间与时区偏移，缺省用北京时间 09:00
 */
export function msUntilNextSync(now = new Date(), options = {}) {
  const hour = Number.isInteger(options.hour) ? options.hour : SYNC_HOUR;
  const minute = Number.isInteger(options.minute) ? options.minute : SYNC_MINUTE;
  const offset = Number.isInteger(options.offsetMinutes) ? options.offsetMinutes : TIMEZONE_OFFSET_MINUTES;
  // 换算成目标时区再算，避免依赖运行机器的本地时区
  const local = new Date(now.getTime() + offset * 60 * 1000);
  const target = new Date(local);
  target.setUTCHours(hour, minute, 0, 0);
  // 已过（或正好是）目标时刻就排到次日，避免同一天重复触发
  if (target.getTime() <= local.getTime()) {
    target.setUTCDate(target.getUTCDate() + 1);
  }
  return target.getTime() - local.getTime();
}
