// 来源、用途标签、角色推荐的定义。
// 这些是「数据之外」的固定知识：改这里不会动到 skills.json，同步也不会覆盖。
import crypto from 'node:crypto';

/**
 * 稳定 id。一旦发布就不再改变——收藏、评分、笔记都挂在这个 id 上。
 *
 * 为什么要把 name 也算进哈希：不同 skill 可能指向同一个 URL。
 * 例如 angular/skills 仓库下 `angular/angular-developer` 与
 * `angular/angular-new-app` 都是 https://github.com/angular/skills，
 * 只用 source+url 会让两条记录撞成同一个 id，其中一条被当重复丢掉。
 *
 * @param {string} source 来源 key
 * @param {string} url    原始链接
 * @param {string} name   skill 名称
 */
export function skillId(source, url, name) {
  const seed = `${source}|${url}|${name}`;
  return `sk_${crypto.createHash('sha1').update(seed).digest('hex').slice(0, 12)}`;
}

/**
 * 7 个开源合集。color 用于卡片图标与来源标签，
 * 取值都压得较深，保证白色文字对比度 ≥ 4.5:1。
 */
export const SOURCES = [
  {
    key: 'VoltAgent',
    label: 'VoltAgent',
    repo: 'VoltAgent/awesome-agent-skills',
    color: '#2f5fd0',
    note: '社区最大合集，By language 与 Community 分区',
  },
  {
    key: 'anthropics',
    label: 'Anthropic 官方',
    repo: 'anthropics/skills',
    color: '#9a3412',
    note: 'Anthropic 官方维护的 skill 与示例',
  },
  {
    key: 'seb1n',
    label: 'seb1n',
    repo: 'seb1n/awesome-ai-agent-skills',
    color: '#166534',
    note: '按职能分类的 skill 索引',
  },
  {
    key: 'ashutoshsrivastava17',
    label: 'skill-library',
    repo: 'ashutoshsrivastava17/skill-library',
    color: '#6b21a8',
    note: '以插件为单位组织的 skill 库',
  },
  {
    key: 'awslabs',
    label: 'AWS Labs HCLS',
    repo: 'awslabs/hcls-agent-skills',
    color: '#0e7490',
    note: '医疗与生命科学专用 skill',
  },
  {
    key: 'ind4x',
    label: 'ind4x',
    repo: 'ind4x/ai-agent-skills',
    color: '#b91c1c',
    note: '按工程阶段分类的生产级 skill',
  },
  {
    key: 'fabricioctelles',
    label: 'fabricioctelles',
    repo: 'fabricioctelles/skills',
    color: '#4d3585',
    note: '偏工程流程与代码质量的 skill',
  },
];

/** 来源 key → 定义，找不到时退回一个中性色。 */
export function sourceOf(key) {
  return SOURCES.find((s) => s.key === key) || {
    key,
    label: key,
    repo: key,
    color: '#475569',
    note: '',
  };
}

/**
 * 13 个用途标签。命中规则写成关键词数组，构建数据集时逐条打标。
 * 一个 skill 可以命中多个标签，但为了「按标签筛选」不至于结果太杂，
 * 每条最多保留 3 个标签。
 */
export const TAGS = [
  { key: '数据分析', words: ['data', 'analytics', 'sql', 'pandas', 'dataframe', 'chart', 'visualiz', 'etl', 'spreadsheet', 'csv', '统计', '数据分析'] },
  { key: '写作与内容', words: ['write', 'writing', 'copy', 'blog', 'content', 'editor', 'style', 'grammar', 'translate', '写作', '内容', '文案'] },
  { key: '代码审查', words: ['code review', 'review', 'lint', 'refactor', 'static analysis', 'pull request', '审查', '重构'] },
  { key: '测试', words: ['test', 'playwright', 'cypress', 'jest', 'vitest', 'e2e', 'qa', 'coverage', '测试'] },
  { key: '前端设计', words: ['react', 'vue', 'angular', 'css', 'tailwind', 'figma', 'design', 'ui', 'ux', 'frontend', 'component', '设计', '前端'] },
  { key: '文档处理', words: ['docx', 'pdf', 'pptx', 'xlsx', 'word', 'excel', 'powerpoint', 'document', 'slides', '文档'] },
  { key: '营销与 SEO', words: ['marketing', 'seo', 'ads', 'campaign', 'social', 'newsletter', 'growth', '营销', '增长'] },
  { key: '销售', words: ['sales', 'crm', 'lead', 'pipeline', 'deal', 'outreach', '销售', '客户'] },
  { key: '财务', words: ['finance', 'accounting', 'invoice', 'payment', 'billing', 'stripe', 'budget', 'tax', '财务', '支付'] },
  { key: '安全', words: ['security', 'vulnerab', 'threat', 'pentest', 'auth', 'oauth', 'encrypt', 'compliance', 'gdpr', '安全'] },
  { key: 'MCP 与 Agent', words: ['mcp', 'agent', 'llm', 'prompt', 'rag', 'tool call', 'orchestrat', 'subagent', '智能体'] },
  { key: '云与运维', words: ['docker', 'kubernetes', 'k8s', 'terraform', 'deploy', 'ci/cd', 'aws', 'gcp', 'azure', 'cloud', 'serverless', 'monitor', '运维'] },
  { key: '医疗生命科学', words: ['genomic', 'clinical', 'protein', 'medical', 'biolog', 'omics', 'drug', 'health', '医疗', '临床'] },
];

/**
 * 12 个角色。每角色给一组关键词，命中越多分越高，
 * 按得分排序取前 8 展示。
 */
export const ROLES = [
  {
    key: '前端工程师',
    summary: 'React / Vue / CSS 与设计稿还原',
    words: ['react', 'vue', 'angular', 'frontend', 'css', 'tailwind', 'component', 'figma', 'ui', 'next.js'],
  },
  {
    key: '后端工程师',
    summary: 'API、数据库与服务端逻辑',
    words: ['api', 'backend', 'rest', 'graphql', 'server', 'postgres', 'mysql', 'redis', 'database', 'fastapi', 'express'],
  },
  {
    key: '测试工程师',
    summary: '自动化测试与质量保障',
    words: ['test', 'playwright', 'cypress', 'jest', 'vitest', 'e2e', 'qa', 'coverage', 'testing'],
  },
  {
    key: '产品经理',
    summary: '需求梳理、PRD 与竞品分析',
    words: ['product', 'prd', 'requirement', 'roadmap', 'user story', 'jtbd', 'interview', 'spec', 'product manager'],
  },
  {
    key: '数据分析师',
    summary: 'SQL、指标与可视化',
    words: ['data', 'analytics', 'sql', 'pandas', 'dataframe', 'chart', 'dashboard', 'etl', 'duckdb', 'clickhouse'],
  },
  {
    key: '运维 / SRE',
    summary: '部署、监控与故障处理',
    words: ['devops', 'kubernetes', 'k8s', 'docker', 'terraform', 'deploy', 'monitor', 'sre', 'incident', 'observability'],
  },
  {
    key: '安全工程师',
    summary: '漏洞排查与安全审计',
    words: ['security', 'vulnerab', 'pentest', 'threat', 'audit', 'auth', 'oauth', 'encrypt', 'red team', 'appsec'],
  },
  {
    key: '内容与运营',
    summary: '写作、社媒与增长',
    words: ['content', 'write', 'writing', 'blog', 'copy', 'social', 'newsletter', 'marketing', 'seo', 'growth'],
  },
  {
    key: '销售与客户成功',
    summary: '客户跟进与成交',
    words: ['sales', 'crm', 'lead', 'pipeline', 'deal', 'customer', 'success', 'outreach', 'onboarding'],
  },
  {
    key: '财务与法务',
    summary: '账务、发票与合同合规',
    words: ['finance', 'accounting', 'invoice', 'billing', 'tax', 'legal', 'contract', 'compliance', 'gdpr', 'budget'],
  },
  {
    key: 'Agent 开发者',
    summary: 'MCP、工具调用与多 Agent 编排',
    words: ['mcp', 'agent', 'llm', 'prompt', 'rag', 'tool', 'orchestration', 'subagent', 'memory', 'context'],
  },
  {
    key: '医疗科研',
    summary: '临床、基因组与药物发现',
    words: ['clinical', 'genomic', 'protein', 'medical', 'omics', 'drug', 'biolog', 'health', 'patient', 'imaging'],
  },
];

/** AI 推荐的示例提问，界面上做成可一键填入的按钮。 */
export const EXAMPLE_PROMPTS = [
  '我需要在 React 项目里写单元测试',
  '帮我审一下这段 SQL 有没有性能问题',
  '我要给产品写一份竞品分析报告',
  '我想用 MCP 把内部系统接给 agent',
];

/**
 * 安装命令：不同来源的安装方式不同。
 * @param {{source:string, url:string}} skill
 */
export function installCommand(skill) {
  if (skill.source === 'anthropics') {
    return {
      command: '/plugin marketplace add anthropics/skills',
      hint: '在 Claude Code 里执行，随后用 /plugin install 选择具体 skill。',
    };
  }
  const repo = repoOf(skill.url) || sourceOf(skill.source).repo;
  if (repo) {
    return {
      command: `npx skills add ${repo}`,
      hint: '用 skills CLI 安装；也可以手动把目录复制到 agent 的 skills 目录。',
    };
  }
  return {
    command: '',
    hint: '该来源没有统一安装命令，请打开原始链接按 README 的说明操作。',
  };
}

/** 从 GitHub URL 里取出 owner/repo。 */
export function repoOf(url) {
  const m = String(url || '').match(/^https?:\/\/github\.com\/([^/]+)\/([^/#?]+)/i);
  return m ? `${m[1]}/${m[2].replace(/\.git$/i, '')}` : null;
}
