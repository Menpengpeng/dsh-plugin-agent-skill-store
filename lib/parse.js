// 7 个开源合集的 README 解析器。
// 输入是 README 的纯文本，输出统一的 skill 行：
//   { source, top, sub, name, desc, url, kind? }
//
// 这份文件被两处共用：
//   1) tools/extract.mjs —— 首次构建数据集；
//   2) index.js 每日同步 —— 重新抓 README 后找出「新出现的 url」。
// 两边必须走同一套解析，否则同步会误判新增/丢失，id 也就不稳定了。

/** 清理 markdown 行内噪声：徽章、粗体、多余空白。 */
export function clean(text) {
  return String(text || '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 把 GitHub 相对链接还原成绝对 URL。 */
export function absolute(href, repo) {
  const raw = String(href || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('#')) return '';
  const cleaned = raw.replace(/^\.\//, '').replace(/^\/+/, '');
  return `https://github.com/${repo}/blob/main/${cleaned}`;
}

/**
 * 过滤误报。只排除两类真噪声：
 * - 仓库自身的 .git 克隆地址；
 * - 条目明确标注 retired / moved 的已下线项。
 * 「deprecated」不算噪声——用户可能仍愿意参考，历史上就因为把 deprecated 当噪声
 * 误删过 testmu-ai/protractor-skill。
 */
export function isNoise(name, href) {
  const link = String(href || '').trim();
  const label = String(name || '');
  if (/\.git$/.test(link)) return true;
  if (/\.git\b/.test(label)) return true;
  if (/\b(retired|moved)\b/i.test(label)) return true;
  return false;
}

// ---------------------------------------------------------------- VoltAgent
// 结构：<summary><h3>分组名</h3></summary> 切「子类」，### 标题切「大类」；
// 每条为 `- **[名称](链接)** - 说明`。
export function parseVoltAgent(text, repo = 'VoltAgent/awesome-agent-skills') {
  const lines = String(text).replace(/\r\n/g, '\n').split('\n');
  const rows = [];
  let top = 'Community Skills';
  let sub = '';
  for (const line of lines) {
    const h3 = line.match(/^###\s+(.+?)\s*$/);
    if (h3) { top = h3[1].trim(); sub = ''; continue; }
    const summary = line.match(/<summary><h[34][^>]*>(.*?)<\/h[34]><\/summary>/);
    if (summary) { sub = clean(summary[1]); continue; }
    const m = line.match(/^-\s+\*\*\[([^\]]+)\]\(([^)]+)\)\*\*\s*[-–—]\s*(.+?)\s*$/);
    if (!m) continue;
    const [, name, href, desc] = m;
    if (isNoise(name, href)) continue;
    if (href.startsWith('#')) continue;
    rows.push({
      source: 'VoltAgent',
      top,
      sub,
      name: clean(name),
      desc: clean(desc),
      url: href.startsWith('http') ? href : absolute(href, repo),
    });
  }
  return rows;
}

// ------------------------------------------------------------------- 表格源
// seb1n / awslabs 都是「### 分类 + | Skill | Description |」表格。
export function parseTableSource(text, repo, sourceKey, opts = {}) {
  const lines = String(text).replace(/\r\n/g, '\n').split('\n');
  const rows = [];
  let section = '';
  const startAt = opts.startMarker ? lines.findIndex((l) => opts.startMarker.test(l)) : 0;
  for (let i = Math.max(0, startAt); i < lines.length; i += 1) {
    const line = lines[i];
    const heading = line.match(/^###\s+(.+?)\s*$/);
    if (heading) { section = clean(heading[1]); continue; }
    if (opts.stopMarker && opts.stopMarker.test(line)) break;
    if (!/^\|/.test(line)) continue;
    if (/^\|\s*:?-{2,}/.test(line)) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 2) continue;
    // 只认「| Skill | Description |」两列行；三列的分类导航矩阵（seb1n 顶部）不算 skill。
    if (opts.twoColumnsOnly && cells.length !== 2) continue;
    if (/^(name|skill|plugin)$/i.test(clean(cells[0]))) continue;
    const linkMatch = cells[0].match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (!linkMatch) continue;
    const name = clean(linkMatch[1]);
    const url = absolute(linkMatch[2], repo);
    if (!url || isNoise(name, linkMatch[2])) continue;
    // awslabs 的表格是 Name | Category | Description，第二列是 reasoning/pipeline
    let category = section;
    let desc = clean(cells[1]);
    if (opts.secondColumnIsType && /^(reasoning|pipeline)$/i.test(clean(cells[1]))) {
      category = `${section} / ${clean(cells[1]) === 'reasoning' ? '推理型' : '流程型'}`;
      desc = clean(cells[2] || '');
    }
    rows.push({ source: sourceKey, top: opts.top || section, sub: category, name, desc, url });
  }
  return rows;
}

// ------------------------------------------------------------------ anthropics
// 官方合集：目录清单固定，README 里没有每条的表格式简介，故用内置中文描述。
// 目录名来自 GitHub contents/skills 的实际列表（19 个）。
const ANTHROPIC_NAMES = [
  'academy-guide', 'algorithmic-art', 'brand-guidelines', 'canvas-design', 'claude-api',
  'discernment-nudge', 'doc-coauthoring', 'docx', 'frontend-design', 'internal-comms',
  'mcp-builder', 'pdf', 'pptx', 'skill-creator', 'slack-gif-creator', 'theme-factory',
  'web-artifacts-builder', 'webapp-testing', 'xlsx',
];

const ANTHROPIC_DESCS = {
  'academy-guide': '当用户询问如何使用 Claude 时，推荐相关的 Claude Academy 课程、教程与使用场景',
  'algorithmic-art': '使用 p5.js 与带种子的随机性创作生成式艺术',
  'brand-guidelines': '把 Anthropic 的品牌规范应用到文档与演示等交付物上',
  'canvas-design': '以 PNG 与 PDF 格式设计视觉作品',
  'claude-api': 'Claude API 与 SDK 文档技能，用于构建 LLM 驱动的应用',
  'discernment-nudge': '在关键判断点上提醒用户保持审慎，避免盲从模型输出',
  'doc-coauthoring': '协作文档编辑与共同撰写',
  'docx': '创建、编辑与分析 Word 文档',
  'frontend-design': '前端设计与 UI/UX 开发工具',
  'internal-comms': '撰写企业内部沟通材料，如公告、简报与致辞',
  'mcp-builder': '构建 MCP 服务器，把外部能力接给 agent',
  'pdf': '提取文本、创建 PDF，并处理 PDF 表单',
  'pptx': '创建、编辑与分析 PowerPoint 演示文稿',
  'skill-creator': '按规范创建新的 Agent Skill，包括目录结构与 SKILL.md 元数据',
  'slack-gif-creator': '生成符合 Slack 尺寸限制的动图 GIF',
  'theme-factory': '生成并应用一致的视觉主题样式',
  'web-artifacts-builder': '构建可分发的 Web Artifact，例如单页应用与交互页面',
  'webapp-testing': '测试 Web 应用，覆盖交互流程与回归检查',
  'xlsx': '创建、编辑与分析 Excel 电子表格',
};

const ANTHROPIC_DOCUMENT = new Set(['docx', 'pdf', 'pptx', 'xlsx']);

export function parseAnthropic() {
  return ANTHROPIC_NAMES.map((name) => ({
    source: 'anthropics',
    top: '官方',
    sub: ANTHROPIC_DOCUMENT.has(name) ? '官方 / 文档类' : '官方 / 示例 skill',
    name: `anthropics/${name}`,
    desc: ANTHROPIC_DESCS[name],
    url: `https://github.com/anthropics/skills/tree/main/skills/${name}`,
  }));
}

// ------------------------------------------------------- ashutoshsrivastava17
// 该合集是「插件」组织的：31 个 plugin，每个 plugin 内含多个 /skill。
// 这里按 plugin 粒度收录（plugin 自带的描述完整可读），skill 数量写进描述里。
export function parseAshutosh(text, repo = 'ashutoshsrivastava17/skill-library') {
  const lines = String(text).replace(/\r\n/g, '\n').split('\n');
  const rows = [];
  let mode = '';
  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+?)\s*$/);
    if (h2) { mode = clean(h2[1]); continue; }
    if (mode !== 'Plugins') continue;
    if (!/^\|/.test(line) || /^\|\s*:?-{2,}/.test(line)) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 3) continue;
    const m = cells[0].match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (!m) continue;
    const count = Number(clean(cells[1]));
    rows.push({
      source: 'ashutoshsrivastava17',
      top: '插件',
      sub: '社区 / 插件合集',
      name: clean(m[1]),
      desc: `${clean(cells[2])}。插件内含 ${Number.isFinite(count) ? count : '多'} 个 skill。`,
      url: absolute(m[2], repo),
      kind: 'plugin',
    });
  }
  return rows;
}

// --------------------------------------------------------------- ind4x
// 三列表格：| [文件夹](链接) | **名称** | 用途 |
export function parseInd4x(text, repo = 'ind4x/ai-agent-skills') {
  const lines = String(text).replace(/\r\n/g, '\n').split('\n');
  const rows = [];
  let section = '';
  for (const line of lines) {
    const h3 = line.match(/^###\s+(.+?)\s*$/);
    if (h3) { section = clean(h3[1]).replace(/\s*\(`[^`]*`\)\s*$/, ''); continue; }
    if (!/^\|/.test(line) || /^\|\s*:?-{2,}/.test(line)) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 3) continue;
    const m = cells[0].match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (!m) continue;
    const name = clean(cells[1] || m[1]);
    if (isNoise(name, m[2])) continue;
    rows.push({
      source: 'ind4x',
      top: '社区',
      sub: `社区 / ${section}`,
      name,
      desc: clean(cells[2]),
      url: absolute(m[2], repo),
    });
  }
  return rows;
}

// ------------------------------------------------------- fabricioctelles
// 每条是 `### 标题 [徽章](详情链接) · \`分类\`` 标题 + 随后的段落描述；
// 标注 _(moved)_ 的条目不收录。
export function parseFabricio(text, repo = 'fabricioctelles/skills') {
  const lines = String(text).replace(/\r\n/g, '\n').split('\n');
  const rows = [];
  let current = null;
  let inAvailable = false;

  const flush = () => {
    if (!current) return;
    if (!current.moved && current.name) {
      rows.push({
        source: 'fabricioctelles',
        top: '社区',
        sub: `社区 / ${current.category || '通用'}`,
        name: current.name,
        desc: current.desc || current.name,
        url: current.url || `https://github.com/${repo}`,
      });
    }
    current = null;
  };

  for (const line of lines) {
    if (/^##\s+Available Skills/.test(line)) { inAvailable = true; continue; }
    if (/^##\s+/.test(line)) { flush(); inAvailable = false; continue; }
    if (!inAvailable) continue;

    const h3 = line.match(/^###\s+(.+?)\s*$/);
    if (h3) {
      flush();
      const raw = h3[1];
      // 详情链接：徽章外层链接，或正文里的 skills/<slug>/SKILL.md
      const outer = raw.match(/\]\((https?:\/\/[^)]+)\)\s*·/);
      const cat = raw.match(/·\s*`([^`]+)`/);
      const link = raw.match(/\[View full documentation\]\((?:\.\/)?([^)]+)\)/);
      let slug = '';
      const detail = raw.match(/skillsdirectory\.com\/skills\/[a-z0-9-]+-([a-z0-9-]+)$/);
      if (detail) slug = detail[1];
      const name = clean(
        raw
          .replace(/!\[[^\]]*\]\([^)]*\)/g, '')     // 徽章图片
          .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')  // 普通链接
          .replace(/·.*$/, '')                      // 分类尾巴
          .replace(/\[\^[^\]]+\]/g, '')             // 脚注引用
          .replace(/[_*`]/g, '')
          .replace(/\s+/g, ' '),
      )
        .replace(/^[\p{Extended_Pictographic}\uFE0F\s]+/u, '') // 去掉前面的 emoji
        .replace(/\s*\((moved|retired)\)\s*$/i, '')
        .trim();
      current = {
        name,
        category: cat ? cat[1] : '',
        moved: /\((moved|retired)\)/i.test(raw),
        url: outer
          ? outer[1]
          : (link
            ? absolute(link[1], repo)
            : (slug ? `https://github.com/${repo}/tree/main/skills/${slug}` : `https://github.com/${repo}`)),
        desc: '',
        slug,
      };
      continue;
    }

    if (!current) continue;
    // 描述取标题后的第一段正文（跳过空行与列表/分隔线）
    const textLine = clean(line);
    // 「> **Migrated** → ... moved to ...」这类条目标记为下线，不收录
    if (/Migrated|moved to/i.test(line) && /^>/.test(line.trim())) { current.moved = true; continue; }
    // 没有徽章链接的条目，用正文里的「View full documentation」补 URL
    const doc = line.match(/\[View full documentation\]\((?:\.\/)?(skills\/[^)]+)\)/);
    if (doc) { current.url = absolute(doc[1], repo); continue; }
    if (!textLine || /^[-|>]/.test(textLine) || /^\[View full documentation\]/.test(line)) continue;
    if (!current.desc) { current.desc = textLine; continue; }
    // 追加「When to use」一句，帮助检索
    const when = textLine.match(/^When to use[:：]\s*(.+)$/i);
    if (when && current.desc.length < 360) current.desc = `${current.desc} 适用场景：${when[1]}`;
  }
  flush();
  return rows;
}

// ------------------------------------------------------------------- 去重
// 去重口径：同源 + 同名 + 同 URL 才算重复（Notion 那 4 行是原文重复）。
// 只按 URL 去重会吃掉 angular/skills 下的两个不同 skill，故不采用。
export function dedupe(rows) {
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const key = `${row.source}::${row.name}::${row.url}`;
    if (!row.url || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

/**
 * 解析全部 7 个来源。
 * @param {Record<string,string>} docs 文件名（见 DOC_FILES）→ README 文本
 */
export const DOC_FILES = {
  VoltAgent: 'VoltAgent__awesome-agent-skills.md',
  anthropics: 'anthropics__skills.md',
  seb1n: 'seb1n__awesome-ai-agent-skills.md',
  ashutoshsrivastava17: 'ashutoshsrivastava17__skill-library.md',
  awslabs: 'awslabs__hcls-agent-skills.md',
  ind4x: 'ind4x__ai-agent-skills.md',
  fabricioctelles: 'fabricioctelles__skills.md',
};

export function parseAll(docs) {
  return {
    VoltAgent: dedupe(parseVoltAgent(docs.VoltAgent || '')),
    anthropics: parseAnthropic(),
    seb1n: dedupe(parseTableSource(
      docs.seb1n || '',
      'seb1n/awesome-ai-agent-skills',
      'seb1n',
      { startMarker: /^##\s+Skills Index/, stopMarker: /^##\s+Skill Format/, twoColumnsOnly: true },
    )),
    ashutoshsrivastava17: dedupe(parseAshutosh(docs.ashutoshsrivastava17 || '')),
    awslabs: dedupe(parseTableSource(
      docs.awslabs || '',
      'awslabs/hcls-agent-skills',
      'awslabs',
      { secondColumnIsType: true, top: '医疗生命科学' },
    )),
    ind4x: dedupe(parseInd4x(docs.ind4x || '')),
    fabricioctelles: dedupe(parseFabricio(docs.fabricioctelles || '')),
  };
}
