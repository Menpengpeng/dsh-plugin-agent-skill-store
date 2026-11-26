// 中文分类映射：把各来源 README 的原始英文分类，归一成「大类 / 子类」。
// 设计原则：
// 1. 大类只保留 12 个，用户点侧边栏才不至于扫很久；
// 2. 子类按「用途」收敛到几十个——来源厂商由 source 筛选负责，
//    分类里不该再出现一堆厂商名，否则侧边栏会长得没法看；
// 3. 没命中的走关键词兜底，最后落到「其他 / 未分类」，构建时会把落空条目打印出来人工核对。
//
// 这份文件同时被「构建数据集」和「每日同步」使用，保证两边分类口径一致。

/** 大类顺序即侧边栏顺序，靠前的更常用。 */
export const GROUPS = [
  '开发与代码',
  '设计与前端',
  '测试与质量',
  '文档与写作',
  '数据与分析',
  '营销与增长',
  '销售与客户',
  '财务与法务',
  '安全与合规',
  '云与运维',
  'MCP 与 Agent',
  '医疗生命科学',
  '其他',
];

// 精确映射：key 用小写原文片段匹配；顺序敏感，先专有后通用。
const EXACT = [
  // ================= VoltAgent: Community Skills =================
  ['development and testing', '开发与代码 / 通用开发'],
  ['productivity and collaboration', '文档与写作 / 效率与协作'],
  // 「Specialized Domains」是 VoltAgent 的杂物间（81 条，涵盖教育、法务、金融、视频等），
  // 故意不在这里精确映射，交给下面的关键词兜底按用途拆开。
  ['context engineering', 'MCP 与 Agent / 上下文工程'],
  ['n8n automation', 'MCP 与 Agent / 自动化编排'],
  ['vector databases', '数据与分析 / 数据库'],

  // ---- VoltAgent: 官方合集（按用途归并，不保留厂商名）----
  ['skills by testmu ai', '测试与质量 / E2E 与浏览器测试'],
  ['skills by sentry', '开发与代码 / 调试与可观测性'],
  ['security skills by trail of bits', '安全与合规 / 安全审计与渗透'],
  ['skills by openai', '开发与代码 / 大模型 API'],
  ['skills by venice.ai', '开发与代码 / 大模型 API'],
  ['skills by minimax', '开发与代码 / 大模型 API'],
  ['skills by google gemini', '开发与代码 / 大模型 API'],
  ['skills by hugging face', '数据与分析 / 模型训练与推理'],
  ['skills by nvidia', '数据与分析 / 模型训练与推理'],
  ['skills by replicate', '数据与分析 / 模型训练与推理'],
  ['skills by fal.ai', '设计与前端 / 图像与视频生成'],
  ['skills by remotion', '设计与前端 / 图像与视频生成'],
  ['skills by pawel huryn', '文档与写作 / 产品管理'],
  ['skills by dean peters', '文档与写作 / 产品管理'],
  ['skills by garry tan', '文档与写作 / 创业与增长'],
  ['skills by corey haines', '营销与增长 / 营销与 SEO'],
  ['advertising skills by kim barrett', '营销与增长 / 广告投放'],
  ['skills by typefully', '营销与增长 / 社媒与内容分发'],
  ['skills by google cloud', '云与运维 / 云平台部署'],
  ['skills by vercel', '云与运维 / 云平台部署'],
  ['skills by netlify', '云与运维 / 云平台部署'],
  ['skills by cloudflare', '云与运维 / 云平台部署'],
  ['skills by firebase', '云与运维 / 云平台部署'],
  ['skills by redhat', '云与运维 / 云平台部署'],
  ['skills by hashicorp', '云与运维 / 基础设施即代码'],
  ['skills by datadog', '云与运维 / 监控与日志'],
  ['official claude skills', '开发与代码 / Claude 生态'],
  ['skills by google workspace', '文档与写作 / 文档与知识库'],
  ['skills by notion', '文档与写作 / 文档与知识库'],
  ['skills by sanity', '文档与写作 / 文档与知识库'],
  ['skills by auth0', '安全与合规 / 身份认证'],
  ['skills by better auth', '安全与合规 / 身份认证'],
  ['skills by wordpress', '设计与前端 / 建站与 CMS'],
  ['skills by apollo graphql', '开发与代码 / API 与集成'],
  ['skills by composio', '开发与代码 / API 与集成'],
  ['skills by crawlbase', '数据与分析 / 网页抓取与搜索'],
  ['skills by brave', '数据与分析 / 网页抓取与搜索'],
  ['skills by firecrawl', '数据与分析 / 网页抓取与搜索'],
  ['skills by serpapi', '数据与分析 / 网页抓取与搜索'],
  ['skills by coinbase', '财务与法务 / 加密资产与支付'],
  ['skills by binance', '财务与法务 / 加密资产与支付'],
  ['skills by stripe', '财务与法务 / 加密资产与支付'],
  ['skills by gsap', '设计与前端 / UI/UX 设计'],
  ['skills by figma', '设计与前端 / UI/UX 设计'],
  ['skills by google labs', '设计与前端 / UI/UX 设计'],
  ['skills by - google chrome team', '设计与前端 / UI/UX 设计'],
  ['skills by modem dev', '设计与前端 / UI/UX 设计'],
  ['skills by expo', '设计与前端 / 移动端'],
  ['skills by callstack', '设计与前端 / 移动端'],
  ['skills by angular', '设计与前端 / 前端框架'],
  ['skills by mongodb', '数据与分析 / 数据库'],
  ['skills by clickhouse', '数据与分析 / 数据库'],
  ['skills by duckdb', '数据与分析 / 数据库'],
  ['skills by neon', '数据与分析 / 数据库'],
  ['skills by supabase', '数据与分析 / 数据库'],
  ['skills by redis', '数据与分析 / 数据库'],
  ['skills by tinybird', '数据与分析 / 数据管道'],
  ['skills by browserbase', 'MCP 与 Agent / 浏览器自动化'],
  ['skills by resend', '开发与代码 / 邮件与通知'],
  ['skills by courier', '开发与代码 / 邮件与通知'],
  ['skills by coderabbit', '开发与代码 / 代码审查与重构'],
  ['skills by cypress', '测试与质量 / 单元与集成测试'],
  ['skills by voltagent', 'MCP 与 Agent / Agent 工具链'],
  ['skills by zero', 'MCP 与 Agent / Agent 工具链'],

  // ---- VoltAgent: 按语言 ----
  ['python skills', '开发与代码 / Python'],
  ['typescript skills', '开发与代码 / TypeScript'],
  ['java skills', '开发与代码 / Java'],
  ['.net skills', '开发与代码 / .NET'],
  ['rust skills', '开发与代码 / Rust'],
  ['core skills', '开发与代码 / 通用核心'],

  // ================= seb1n =================
  ['agent engineering', 'MCP 与 Agent / Agent 工程'],
  ['agent security', '安全与合规 / Agent 安全'],
  ['ai/ml operations', 'MCP 与 Agent / AI 运维'],
  ['api & integration', '开发与代码 / API 与集成'],
  ['code & development', '开发与代码 / 编码开发'],
  ['communication', '文档与写作 / 沟通表达'],
  ['customer success', '销售与客户 / 客户成功'],
  ['data & analytics', '数据与分析 / 数据分析'],
  ['database', '数据与分析 / 数据库'],
  ['design & ui/ux', '设计与前端 / UI/UX 设计'],
  ['documents & files', '文档与写作 / 文档处理'],
  ['finance & accounting', '财务与法务 / 财务与会计'],
  ['devops & infrastructure', '云与运维 / DevOps 与基础设施'],
  ['legal & compliance', '财务与法务 / 法务与合规'],
  ['marketing & seo', '营销与增长 / 营销与 SEO'],
  ['productivity & workflow', '文档与写作 / 效率与流程'],
  ['research & knowledge', '文档与写作 / 研究与知识'],
  ['sales', '销售与客户 / 销售'],
  ['security', '安全与合规 / 安全'],
  ['writing & content', '文档与写作 / 写作与内容'],

  // ================= anthropics 官方合集 =================
  ['官方 / 文档类', '文档与写作 / 文档处理'],
  ['官方 / 示例 skill', '开发与代码 / 官方示例'],

  // ================= ashutoshsrivastava17 =================
  ['插件合集', 'MCP 与 Agent / 插件合集'],

  // ================= awslabs（医疗生命科学）=================
  ['healthcare operations', '医疗生命科学 / 医疗运营'],
  ['genomics', '医疗生命科学 / 基因组学'],
  ['single-cell analysis', '医疗生命科学 / 单细胞分析'],
  ['medical imaging', '医疗生命科学 / 医学影像'],
  ['protein structure', '医疗生命科学 / 蛋白结构'],
  ['proteomics', '医疗生命科学 / 蛋白质组学'],
  ['drug discovery', '医疗生命科学 / 药物发现'],
  ['clinical data review', '医疗生命科学 / 临床数据'],
  ['clinical data', '医疗生命科学 / 临床数据'],
  ['multi-omics integration', '医疗生命科学 / 多组学整合'],
  ['pharmacoepidemiology', '医疗生命科学 / 药物流行病学'],
  ['regulatory', '医疗生命科学 / 法规申报'],
  ['open data discovery', '医疗生命科学 / 开放数据发现'],
  ['cross-domain', '医疗生命科学 / 跨领域方法'],

  // ================= ind4x =================
  ['analysis-reverse-engineering', '开发与代码 / 知识图谱与逆向分析'],
  ['code-review-refactoring', '开发与代码 / 代码审查与重构'],
  ['design-ui', '设计与前端 / 设计与 UI 工程'],
  ['integrations-frameworks', '开发与代码 / 集成与框架'],
  ['mcp-plugin-development', 'MCP 与 Agent / MCP 与插件开发'],
  ['multi-agent-orchestration', 'MCP 与 Agent / 多 Agent 编排'],
  ['specialized-domains', '其他 / 区块链与硬件'],
  ['testing-qa', '测试与质量 / 测试与调试'],

  // ================= fabricioctelles =================
  ['data-fetching-and-analysis', '数据与分析 / 数据获取与分析'],
  ['code-quality-and-review', '开发与代码 / 代码审查与重构'],
  ['library-and-api-reference', '开发与代码 / 库与 API 参考'],
  ['code-scaffolding-and-templates', '开发与代码 / 脚手架与模板'],
  ['ci-cd-and-deployment', '云与运维 / CI/CD 与部署'],
  ['product-verification', '测试与质量 / 产品验证'],
  ['runbooks', '云与运维 / 运维手册'],
];

/** 关键词兜底：原文没命中精确映射时，按描述里的词再猜一次。 */
const KEYWORDS = [
  [/\b(test|spec|jest|vitest|playwright|cypress|e2e|qa)\b/i, '测试与质量 / 测试'],
  [/\b(design|figma|css|tailwind|ui|ux|layout|typography|animation|color|colour|palette|contrast|typograph)\b/i, '设计与前端 / UI/UX 设计'],
  [/\b(react|vue|angular|svelte|next\.?js|frontend)\b/i, '设计与前端 / 前端框架'],
  [/\b(video|audio|speech|dubbing|subtitle|music|voice|podcast|captions?|b-roll|editing)\b/i, '设计与前端 / 音视频处理'],
  [/\b(sql|database|postgres|mysql|sqlite|duckdb|clickhouse|query|etl|dataframe|pandas)\b/i, '数据与分析 / 数据与查询'],
  [/\b(marketing|seo|ads?|campaign|content|social|newsletter)\b/i, '营销与增长 / 营销'],
  [/\b(ecommerce|e-commerce|shopify|amazon|etsy|tiktok shop|retail)\b/i, '营销与增长 / 电商运营'],
  [/\b(sales|crm|lead|pipeline|deal)\b/i, '销售与客户 / 销售'],
  [/\b(finance|accounting|invoice|payment|billing|stripe|budget|tax|finops|small business|deadline|counterparty)\b/i, '财务与法务 / 财务'],
  [/\b(legal|contract|compliance|gdpr|lgpd|law|policy)\b/i, '财务与法务 / 法务与合规'],
  [/\b(security|vulnerab|threat|pentest|auth|oauth|encrypt|red.?team)\b/i, '安全与合规 / 安全'],
  [/\b(docker|kubernetes|k8s|terraform|deploy|ci\/cd|aws|gcp|azure|cloud|serverless)\b/i, '云与运维 / 云与部署'],
  [/\b(monitor|log|observab|metric|alert|incident|sre|network|unifi|vmware)\b/i, '云与运维 / 监控与运维'],
  [/\b(mcp|agent|llm|prompt|rag|tool.?call|orchestrat)\b/i, 'MCP 与 Agent / Agent 工程'],
  [/\b(docx?|pdf|pptx?|xlsx?|word|powerpoint|excel|spreadsheet|slides)\b/i, '文档与写作 / 文档处理'],
  [/\b(write|writing|copy|blog|document|readme|changelog|translat)\b/i, '文档与写作 / 写作'],
  [/\b(genomic|clinical|protein|medical|biolog|omics|drug|health)\b/i, '医疗生命科学 / 医疗数据'],
  [/\b(api|sdk|graphql|rest|webhook|integration)\b/i, '开发与代码 / API 与集成'],
  [/\b(refactor|review|lint|type|typescript|debug)\b/i, '开发与代码 / 代码审查与重构'],
  [/\b(reverse.?engineer|binary|disassembl|decompil)\b/i, '开发与代码 / 知识图谱与逆向分析'],
  [/\b(research|paper|literature|academic|scien|tutor|teach|learn|course|exam)\b/i, '文档与写作 / 研究与知识'],
  [/\b(competency|assessment|learning target|curricul|pedagog|hint|learner|agency)\b/i, '文档与写作 / 研究与知识'],
  [/\b(systems[- ]engineering|reference pack|knowledge pack)\b/i, '文档与写作 / 研究与知识'],
  [/\b(chart|visualiz|dashboard|plot)\b/i, '数据与分析 / 图表可视化'],
  [/\b(image|photo|illustrat|logo|icon|draw|paint|render|watermark|provenance|metadata)\b/i, '设计与前端 / 图像与视频生成'],
  [/\b(windows|macos|apple|home.?assistant|system management|device)\b/i, '其他 / 系统与设备自动化'],
  [/\b(bounty|escrow|crypto|wallet|blockchain|solana|evm)\b/i, '其他 / 区块链与硬件'],
  [/\b(scrap|crawler|spider|cdp)\b/i, '数据与分析 / 网页抓取与搜索'],
  [/\b(upload|media|asset|transform|collection)\b/i, '数据与分析 / 数据处理'],
];

/**
 * 把一条原始记录映射成「大类 / 子类」。
 * @param {{source?:string, top?:string, sub?:string, name?:string, desc?:string, kind?:string}} row
 * @returns {string} 形如「开发与代码 / Python」
 */
export function classify(row) {
  const haystack = `${row.top || ''} ${row.sub || ''}`.toLowerCase();

  // 1) 精确映射：按 EXACT 的先后顺序，取第一个命中的
  for (const [needle, target] of EXACT) {
    if (haystack.includes(needle)) return target;
  }

  // 2) 关键词兜底：先看原文标题，再看名称与描述
  const text = `${row.name || ''} ${row.desc || ''}`;
  for (const [re, target] of KEYWORDS) {
    if (re.test(haystack) || re.test(text)) return target;
  }

  return '其他 / 未分类';
}

/** 取分类里的大类部分，并按 GROUPS 校验，非法值归到「其他」。 */
export function groupOf(category) {
  const head = String(category || '').split(' / ')[0];
  return GROUPS.includes(head) ? head : '其他';
}
