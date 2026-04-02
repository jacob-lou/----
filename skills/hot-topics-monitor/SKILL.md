---
name: hot-topics-monitor
description: "Real-time hot topics monitoring and trend tracking across 10 global sources (Google Trends, Reddit, HackerNews, GitHub Trending, HuggingFace, Twitter/X, DuckDuckGo, Bing News, V2EX, Bilibili). Use this skill whenever the user wants to: check trending topics or hot news, track a specific keyword or technology (e.g. 'GPT-5', 'DeepSeek'), monitor AI/tech industry developments, add or extend data sources in the trend tracking system, understand or modify the system architecture, build dashboards or automation around trending data. This skill provides executable scripts to fetch live data — YOU (the AI agent) are the analysis engine. Do NOT call external AI APIs for classification, translation, or analysis — do all of that yourself."
---

# Hot Topics Monitor

一个多源热点数据采集工具包。脚本负责从 10 个全球数据源抓取实时数据，**你（AI Agent）负责分析、分类、翻译和生成报告**。

## 核心理念：你就是 AI 引擎

```
用户提问 → 你读取本 Skill → 你执行脚本抓取原始数据 → 你自己分析 → 你输出报告
```

脚本**不调用任何外部 AI API**，只做纯 HTTP 数据抓取。所有智能工作由你完成：
- **内容分类**（AI vs 综合） — 使用下方的分类框架
- **翻译** — 你天然支持多语言
- **重要度评估** — 使用下方的评估公式
- **质量判断** — 识别标题党、广告、低质内容
- **趋势分析** — 生成结构化报告

好处：零 API Key 配置、零额外 AI 费用、分析质量取决于用户使用的模型。

---

## 工作流决策树

根据用户意图选择对应操作：

| 用户意图 | 你的操作 |
|---------|---------|
| "最近有什么热点"、"AI 有什么新动态" | 执行 `fetch-trends.ts` → 分析 → 输出报告 |
| "关注 XXX"、"搜一下 GPT-5 最新消息" | 执行 `search-keyword.ts "XXX"` → 分析 → 输出报告 |
| "帮我加一个 ProductHunt 数据源" | 读 `references/extending.md` → 引导开发 |
| "这个项目架构是什么"、"数据库有哪些表" | 读 `references/architecture.md` → 讲解 |
| "每个数据源具体怎么采集的" | 读 `references/data-sources.md` → 讲解 |

---

## 脚本使用

所有脚本在项目根目录下执行，输出 JSON 到 stdout。

### 1. 热点采集 — `fetch-trends.ts`

采集全球 10 个数据源的热点趋势。

```bash
# 采集所有源（Twitter 需要 TWITTER_API_KEY 环境变量，无则自动跳过）
npx tsx skills/hot-topics-monitor/scripts/fetch-trends.ts

# 指定数据源
npx tsx skills/hot-topics-monitor/scripts/fetch-trends.ts --sources google,reddit,hackernews

# 限制每个源的条目数
npx tsx skills/hot-topics-monitor/scripts/fetch-trends.ts --sources github,huggingface --limit 10
```

**可用数据源名称**：`google`, `reddit`, `hackernews`, `duckduckgo`, `github`, `huggingface`, `v2ex`, `bingnews`, `bilibili`, `twitter`

**输出格式**：
```json
{
  "fetchedAt": "2026-04-02T12:00:00.000Z",
  "sources": ["google", "reddit", ...],
  "totalItems": 150,
  "results": [
    {
      "source": "reddit",
      "items": [
        {
          "title": "Claude 4 just dropped and it's insane",
          "url": "https://reddit.com/r/LocalLLaMA/...",
          "source": "reddit",
          "score": 2500,
          "externalId": "reddit-abc123",
          "publishedAt": "2026-04-02T10:00:00.000Z",
          "extra": "{\"num_comments\":430,\"subreddit\":\"LocalLLaMA\"}"
        }
      ],
      "count": 40,
      "error": null
    }
  ]
}
```

### 2. 关键词搜索 — `search-keyword.ts`

跨 Reddit、HackerNews、DuckDuckGo、Twitter 搜索特定关键词。

```bash
# 搜索关键词
npx tsx skills/hot-topics-monitor/scripts/search-keyword.ts "GPT-5"

# 指定搜索源
npx tsx skills/hot-topics-monitor/scripts/search-keyword.ts "DeepSeek" --sources reddit,hackernews
```

**输出格式**：
```json
{
  "keyword": "GPT-5",
  "searchedAt": "2026-04-02T12:00:00.000Z",
  "totalResults": 25,
  "results": [
    {
      "title": "GPT-5 release date leaked",
      "url": "https://reddit.com/...",
      "source": "reddit",
      "score": 1200,
      "snippet": "According to sources close to OpenAI..."
    }
  ]
}
```

---

## 分析框架

拿到脚本输出的原始数据后，按以下框架进行分析。

### 1. 内容分类

将每条内容分为 **AI/科技** 或 **综合** 类别。

**规则 A — 关键词命中**（优先）：标题或描述中包含以下关键词则归类为 AI：

| 类别 | 关键词 |
|------|--------|
| 模型 | GPT, ChatGPT, Claude, Gemini, LLaMA, Mistral, Qwen, DeepSeek, DALL-E, Midjourney, Stable Diffusion, Sora, Copilot, Cursor |
| 核心概念 | LLM, Transformer, Diffusion Model, Embedding, Fine-tuning, RLHF, LoRA, RAG, Prompt Engineering, Neural Network, Deep Learning, Machine Learning, NLP, AGI, AI Agent |
| 框架/工具 | PyTorch, TensorFlow, HuggingFace, LangChain, vLLM, Ollama, CUDA, TensorRT |
| 公司 | OpenAI, Anthropic, Google AI, Meta AI, xAI, Stability AI, Perplexity |
| 中文 | 大模型, 人工智能, 机器学习, 深度学习, 智能体, 文心一言, 通义千问, Kimi, 月之暗面, 智谱, 豆包 |

**规则 B — 语义判断**（回退）：关键词未命中时，根据标题语义判断是否与 AI/ML/DL 相关。

### 2. 重要度评估

对每条内容按以下四因子评分（0-100）：

| 因子 | 权重 | 计算方式 |
|------|------|---------|
| 热度 | 35% | 同源内 score 相对排名（百分位） |
| 互动 | 25% | 评论数/回复数相对排名 |
| 跨源 | 25% | 多个数据源报道同一话题 → 每匹配 1 源 +25 分，上限 100 |
| 时效 | 15% | 24h 内 100 分，2-7d 60 分，7-30d 30 分，>30d 10 分 |

**跨源匹配方法**：提取标题中的关键 token（英文 ≥3 字母单词，中文按双字切分），在不同来源的标题间匹配。共享 3+ 个 token 且来源不同即视为同一话题。

**公式**：`score = 热度×0.35 + 互动×0.25 + 跨源×0.25 + 时效×0.15`

### 3. 质量判断

过滤以下低质内容（在报告中标注或排除）：

| 类型 | 识别特征 |
|------|---------|
| 标题党 | 全大写、过度感叹号、"你不会相信"、"震惊" 等 |
| 广告/推广 | 包含折扣码、affiliate 链接、"限时优惠" |
| 搬运/重复 | 多条内容标题高度相似（编辑距离 <30%） |
| 过时信息 | 发布时间 >30 天 |
| 低互动 | score=0 且无评论 |

### 4. 报告模板

分析完成后，按以下模板输出（可根据用户语言偏好调整中/英文）：

```markdown
## 🔥 热点速递 — [日期]

> 数据来源：[已采集的源列表] | 共 [N] 条 | 采集时间：[时间]

### ⭐ 高关注（跨 3+ 源报道）
1. **[标题]** — 来源: [sources] | 重要度: ★★★★★
   > [一句话摘要]

### 📈 值得关注
2. **[标题]** — 来源: [source] | 重要度: ★★★★☆
   > [一句话摘要]

### 🔬 领域动态

**AI/机器学习**
- [标题] ([source], [score])

**开源项目**
- [标题] ([source], [stars])

**产品发布**
- [标题] ([source])

### 📊 数据概览
| 来源 | 条目数 | 平均热度 | 最高热度 |
|------|--------|---------|---------|
| Reddit | 40 | 580 | 2500 |
| ... | ... | ... | ... |
```

---

## 环境要求

- **Node.js** ≥ 18（需要原生 fetch）
- **cheerio**：项目已安装（`npm install` 即可），用于 Google RSS / GitHub HTML / Bing RSS 解析
- **TWITTER_API_KEY**（可选）：设置后启用 Twitter 数据源，不设置则自动跳过

```bash
# 可选：设置 Twitter API Key
export TWITTER_API_KEY=your_key_here
```

---

## 参考文档

当用户需要了解或修改底层系统时，读取对应参考文档：

| 文档 | 何时读取 | 路径 |
|------|---------|------|
| 系统架构 | 用户问架构、数据库设计、API 端点 | `references/architecture.md` |
| 数据源详情 | 用户问某个源的采集逻辑、字段含义、过滤策略 | `references/data-sources.md` |
| 扩展指南 | 用户要新增数据源、添加监控功能、修改路由 | `references/extending.md` |
