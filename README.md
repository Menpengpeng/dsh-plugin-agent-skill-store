# Agent Skill 商店

DSH 插件：把 7 个开源 Agent Skill 合集汇总成一个可检索的中文清单，带收藏、评分、笔记与每日增量同步。

**只给你自己用。** 没有账号、没有登录、没有任何上报；收藏/评分/笔记全部存在本机。也不会显示别人的收藏数或评论——这类数据根本不存在于插件里。

## 收录范围

数据随插件发布，共 **1602 个 skill**，来自 7 个开源合集：

| 来源 | 数量 | 说明 |
| --- | ---: | --- |
| [VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills) | 1275 | 社区大合集，覆盖最广 |
| [ind4x/ai-agent-skills](https://github.com/ind4x/ai-agent-skills) | 108 | 生产级 skill，按 8 个领域组织 |
| [seb1n/awesome-ai-agent-skills](https://github.com/seb1n/awesome-ai-agent-skills) | 103 | 精选合集 |
| [awslabs/hcls-agent-skills](https://github.com/awslabs/hcls-agent-skills) | 43 | 医疗生命科学方向 |
| [ashutoshsrivastava17/skill-library](https://github.com/ashutoshsrivastava17/skill-library) | 31 | 以插件为单位组织 |
| [fabricioctelles/skills](https://github.com/fabricioctelles/skills) | 23 | 社区维护 |
| [anthropics/skills](https://github.com/anthropics/skills) | 19 | Anthropic 官方 |

每条 skill 都带中文描述（保留产品名/框架名/命令的英文原文），并按用途分成 13 个大类、94 个子类。

## 功能

**检索**
- 关键词搜索：匹配名称、中文描述、分类与来源；多词按 AND 处理，名称权重更高，完全同名排最前
- 中文按 2 字切片，「单元测试」也能被「测试」命中
- 13 个用途标签：数据分析、写作与内容、代码审查、测试、前端设计、文档处理、营销与 SEO、销售、财务、安全、MCP 与 Agent、云与运维、医疗生命科学
- 来源与大类侧边筛选，带实时数量
- 每页 48 条，「加载更多」继续翻

**概览**
- 每个来源的数量、占比与彩色比例条，点一下即筛选
- 分类 Top 10 横向柱状图，同样可点击筛选

**发现**
- **AI 智能推荐**：一句话说你要做什么，先在本地做关键词召回取前 70 个候选，再让模型从中挑最多 6 个，每个给一句中文理由，最后附一条搭配建议。模型只能从候选里选，不能自己发挥。4 个示例一句话即点即用。
- **按角色推荐**：12 个角色（前端工程师、后端工程师、数据分析师等），按关键词命中强度排序，各出前 8 个。

**skill 卡片**
- 首字母图标，颜色按来源区分（7 种颜色）
- 名称、分类、中文描述、同色来源标签
- 已评分的显示「我的评分」
- 快捷操作：收藏（★）、复制链接、打开原始链接

**详情侧栏**（Esc 或点遮罩关闭）
- 完整描述、来源合集、原始链接
- 安装方式，一键复制：
  - Anthropic 官方 → `/plugin marketplace add anthropics/skills`
  - 其他 GitHub 仓库 → `npx skills add <owner>/<repo>`
  - 无法判定时提示看 README
  - 另附手动方式：把 skill 目录放到 agent 的 skills 目录（Claude Code 用 `.claude/skills/`，Cursor 用 `.cursor/skills/`）
- 我的评分（1–5 星）与笔记
- 同类 skill 6 个，可点击跳转

## 每日同步

每天北京时间 **09:00** 自动检查上游是否新增 skill。

规则是**只追加，永不修改、永不删除**：

1. 读取当前数据集的链接集合
2. 抓取 7 个来源的最新列表
3. 找出没见过的链接
4. 用所属合集的既有分类规则归类，新条目标记「待翻译」（同步只追加，不跑机器翻译）
5. 并入数据集，通知你新增数量、涉及来源与前 10 个名称

没有新增就只报「今日无新增」。任何一步失败都会如实告诉你失败原因——**全部来源都抓不到时报「同步失败」，不会伪装成「今日无新增」**，免得你以为上游真的没更新。

排除误报：仓库自身的 `.git` 克隆地址、标注 retired/moved 的条目不计入。

也可以在界面上点「检查更新」手动触发。

### 关于 id 稳定性

每个 skill 的 `id` 是 `sha1(来源|链接|名称)` 的前 12 位，一经生成永不改变。你的收藏、评分与笔记都挂在这个 id 上，所以同步追加新数据不会让你的个人数据错位。

### 抓取路径

raw.githubusercontent.com 在部分网络环境下会被 DNS 污染。抓取会按顺序尝试三条路径，任意一条通即可：

1. `raw.githubusercontent.com` 直连
2. `ghproxy.net` 镜像
3. GitHub Contents API（走 `api.github.com`，配额 60 次/小时，7 个请求够用）

## 安装

插件在本机以文件依赖方式挂到 DSH profile：

```bash
# 在 profile 目录（~/.dsh/profiles/desktop）执行
pnpm add file:<path-to>/agent-skill-store
```

然后在 profile 的 `package.json` 里把插件加入 `dsh.profile.bundles`，重启 DSH 即可。

插件同时注册了一个 agent 工具 `agent_skill_store`，可以直接在对话里让 agent 帮你找 skill：

```text
帮我找几个能做 PDF 处理的 skill
```

## 目录结构

```
agent-skill-store/
├── index.js              Host 端：存储、HTTP 路由、agent 工具、每日同步
├── client.js             客户端：侧边栏入口 + 主面板 UI
├── cordis.patch.yml      插件挂载声明
├── icon.svg              侧边栏图标
├── lib/
│   ├── catalog.js        来源、标签、角色、示例、安装命令、id 生成
│   ├── classify.js       分类规则（来源分类 → 关键词兜底）
│   ├── parse.js          7 个 README 的解析器（构建与同步共用）
│   ├── search.js         分词、检索、概览、同步时间计算
│   └── sync.js           只追加合并规则与同步状态判定
├── data/
│   ├── skills.json       发布数据集（1602 条）
│   └── zh-batches/       翻译批次原始文件
├── tools/
│   ├── extract.mjs       从 README 抽取原始条目
│   ├── make-batches.mjs  切分翻译批次
│   ├── build-dataset.mjs 合并翻译并生成 skills.json
│   └── translate-prompt.md 翻译规范
└── tests/                node --test 测试
```

## 重新构建数据

```bash
# 1. 把 7 个 README 放到 tmp/skillstore-raw/
node tools/extract.mjs           # → data/extracted.json
node tools/make-batches.mjs      # → data/zh-batches/in-01..09.json
# 2. 按 translate-prompt.md 翻译，产出 out-01..09.json
node tools/build-dataset.mjs     # → data/skills.json
```

## 测试

```bash
node --test tests/lib.test.mjs tests/host.test.mjs tests/sync.test.mjs
```

覆盖解析器、分类、id 生成、分词检索、概览统计、同步时间计算、「只追加」不变量与同步状态判定。

## 隐私

- 不联网上报任何数据
- 不做遥测
- 收藏、评分、笔记只写本机 storageDomain
- 唯一的网络请求是每日同步时抓取 7 个开源 README，以及你主动使用 AI 推荐时的模型调用

## 许可

MIT
