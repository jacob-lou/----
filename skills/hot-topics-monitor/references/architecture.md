# 系统架构参考

> 本文档覆盖热点追踪系统的完整架构，供理解或修改系统时参考。

## 目录

1. [系统架构图](#系统架构图)
2. [目录结构](#目录结构)
3. [数据模型 (Prisma Schema)](#数据模型)
4. [REST API 文档](#rest-api)
5. [WebSocket 事件](#websocket-事件)
6. [定时任务](#定时任务)
7. [前端概览](#前端概览)

---

## 系统架构图

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (SPA)                       │
│  HTML/CSS/JS + Socket.IO Client                         │
│  ┌─────────┐  ┌──────────┐  ┌───────────┐              │
│  │ AI 热点  │  │ 综合热点  │  │ 热点监控   │              │
│  └─────────┘  └──────────┘  └───────────┘              │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP REST + WebSocket
┌──────────────────────┴──────────────────────────────────┐
│                  Express 5 Server                        │
│                                                          │
│  Routes:                                                 │
│    /api/trends   → 热点列表/分析/刷新/摘要/回填           │
│    /api/keywords → 关键词 CRUD/告警/趋势/检查/采集        │
│                                                          │
│  Services:                                               │
│    collector.ts    → 10源并行采集 + 分类 + 翻译           │
│    classifier.ts   → 关键词规则 + AI 分类                 │
│    translator.ts   → 语言检测 + 批量翻译                  │
│    importance.ts   → 三因子重要度评分                     │
│    analysis.ts     → AI 趋势分析 (OpenRouter)            │
│    monitor.ts      → 关键词监控 + AI 验证                 │
│    keyword-search.ts → 跨源关键词搜索                    │
│                                                          │
│  Sources (10):                                           │
│    Google, Reddit, HackerNews, DuckDuckGo, Twitter       │
│    GitHub, HuggingFace, V2EX, BingNews, Bilibili         │
│                                                          │
│  Infrastructure:                                         │
│    Socket.IO 4.x   → 实时推送                            │
│    node-cron        → 定时采集/监控                       │
│    Prisma ORM       → SQLite                             │
└──────────────────────────────────────────────────────────┘
```

## 数据流

```
定时采集 (每30分钟)
  ├── 10 个数据源并行 fetch
  ├── ClassifierService.classify() → 分类 (ai/general)
  ├── TranslatorService.detectAndTranslate() → 语言检测 + 翻译
  ├── collector.saveItems() → upsert 到 TrendItem
  ├── ImportanceService.computeScores() → 重新计算重要度
  └── AnalysisService.analyzeTrends() → AI 分析 (ai + general)
        └── Socket.IO emit 'analysis-update'

关键词监控 (每10分钟)
  ├── MonitorService.checkAllKeywords()
  │   ├── KeywordSearchService.searchAll(keyword)
  │   ├── 去重（24h 内已有告警）
  │   ├── MonitorService.verifyWithAI() → AI 验证
  │   ├── 存入 KeywordAlert
  │   └── Socket.IO emit 'keyword-alert'
  └── MonitorService.collectKeywordTrends() (每30分钟偏移)
      ├── KeywordSearchService.searchAll(keyword)
      ├── 去重存入 KeywordTrend
      └── Socket.IO emit 'keyword-trends-update'
```

---

## 目录结构

```
热点追踪/
├── prisma/schema.prisma       # 数据库模型
├── src/
│   ├── index.ts               # 入口：创建 HTTP server + Socket.IO
│   ├── app.ts                 # Express 应用 + 路由注册
│   ├── db.ts                  # Prisma Client 实例
│   ├── socket.ts              # Socket.IO 初始化
│   ├── scheduler.ts           # 定时任务 (3 个 CronJob)
│   ├── routes/
│   │   ├── trends.ts          # /api/trends 路由
│   │   └── keywords.ts        # /api/keywords 路由
│   ├── services/
│   │   ├── collector.ts       # 采集调度
│   │   ├── classifier.ts      # 内容分类
│   │   ├── translator.ts      # 翻译服务
│   │   ├── importance.ts      # 重要度评分
│   │   ├── analysis.ts        # AI 分析
│   │   ├── monitor.ts         # 关键词监控
│   │   └── keyword-search.ts  # 关键词搜索
│   └── sources/               # 10 个数据源
│       ├── base.ts            # 接口定义
│       ├── google.ts ~ bilibili.ts
├── public/                    # 前端静态文件
│   ├── index.html             # 三 Tab SPA
│   ├── app.js                 # 完整前端逻辑 (i18n, 状态管理)
│   └── style.css              # 样式
└── skills/                    # Agent Skills (本目录)
```

---

## 数据模型

### TrendItem — 热点条目

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Int (PK) | 自增主键 |
| title | String | 热点标题 |
| url | String? | 原始链接 |
| source | String | 来源: google/reddit/hackernews/duckduckgo/twitter/github/huggingface/v2ex/bingnews/bilibili |
| score | Int | 热度分数（各源量纲不同） |
| commentsCount | Int | 评论/回复数 |
| category | String | 内容分类: 'ai' / 'general' |
| importanceScore | Float | 预计算重要度 0-100 |
| language | String? | 检测到的源语言: zh/en/ja/ko |
| titleZh | String? | 中文翻译标题 |
| titleEn | String? | 英文翻译标题 |
| summary | String? | AI 生成摘要 (≤30字) |
| crossSourceCount | Int | 跨源出现次数 |
| extra | String? | JSON 额外数据（各源不同，见 data-sources.md） |
| externalId | String? | 外部唯一标识 |
| publishedAt | DateTime? | 原始发布时间 |
| fetchedAt | DateTime | 采集时间 |
| createdAt | DateTime | 创建时间 |

**去重**: `@@unique([source, externalId])`

### MonitorKeyword — 监控关键词

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Int (PK) | 自增主键 |
| keyword | String (unique) | 监控关键词 |
| scope | String | 范围标签: general, AI编程, crypto 等 |
| active | Boolean | 是否启用 |
| interval | Int | 检查间隔（分钟） |

### KeywordAlert — 关键词告警

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Int (PK) | 自增主键 |
| keywordId | Int (FK) | 关联 MonitorKeyword |
| title | String | 告警标题 |
| url | String? | 原始链接 |
| source | String | 来源 |
| snippet | String? | 内容摘要 |
| verified | Boolean | AI 验证是否相关 |
| aiReason | String? | AI 验证理由 |
| notified | Boolean | 是否已推送 |

### KeywordTrend — 关键词趋势

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Int (PK) | 自增主键 |
| keywordId | Int (FK) | 关联 MonitorKeyword |
| title | String | 标题 |
| url, source, score, extra | 同 TrendItem | |

### 其他模型

- **CategoryRule** — 分类规则表（keyword, category, isRegex, weight, active）
- **FetchLog** — 采集日志（source, status, message, count, duration）
- **TrendAnalysis** — AI 分析缓存（category, filterHash, summary, topics, model）

---

## REST API

### /api/trends

| 方法 | 路径 | 参数 | 说明 |
|------|------|------|------|
| GET | /api/trends | page, limit(max100), category(ai/general), source(逗号分隔), sort(score/newest/comments/fetchedAt/importance), search, minScore, hasUrl, days(max90) | 获取热点列表 |
| GET | /api/trends/sources | category? | 获取可用数据源列表 |
| GET | /api/trends/stats | — | 采集统计 + 总条目数 |
| GET | /api/trends/analysis | category, source, search, days, minScore | 获取缓存分析 |
| POST | /api/trends/analyze | body: { category, source, search, days, minScore } | 手动触发 AI 分析 |
| POST | /api/trends/refresh | — | 手动触发采集 + 重要度计算 |
| POST | /api/trends/summary | body: { ids: number[] } (max 50) | 为指定条目生成摘要 |
| POST | /api/trends/backfill-categories | — | 重新分类所有条目 |
| POST | /api/trends/backfill-translations | — | 回填语言/翻译数据 |

### /api/keywords

| 方法 | 路径 | 参数 | 说明 |
|------|------|------|------|
| GET | /api/keywords | — | 获取所有关键词（含 alert/trend 计数） |
| POST | /api/keywords | body: { keyword, scope? } | 添加关键词（max 100 字符） |
| DELETE | /api/keywords/:id | — | 删除关键词（级联删除告警/趋势） |
| PATCH | /api/keywords/:id | body: { active?, scope? } | 更新关键词 |
| GET | /api/keywords/:id/alerts | page, limit(max100), verified? | 获取关键词告警 |
| GET | /api/keywords/:id/trends | page, limit(max100), source(逗号分隔), search, days(max90), sort(fetchedAt/score) | 获取关键词趋势 |
| GET | /api/keywords/alerts/recent | — | 获取最近 50 条已验证告警 |
| POST | /api/keywords/check | — | 手动触发关键词检查 |
| POST | /api/keywords/collect | — | 手动触发关键词趋势采集 |

---

## WebSocket 事件

| 事件名 | 方向 | 数据 | 说明 |
|--------|------|------|------|
| new-trends | Server→Client | SourceResult[] | 新热点采集完成 |
| fetch-status | Server→Client | { results: [{source, count, error}] } | 采集状态汇总 |
| analysis-update | Server→Client | { category, summary, topics } | AI 分析完成 |
| keyword-alert | Server→Client | { keyword, keywordId, alerts[] } | 新关键词告警 |
| keyword-trends-update | Server→Client | — | 关键词趋势更新 |

---

## 定时任务

| 任务 | Cron 表达式 | 频率 | 执行内容 |
|------|------------|------|---------|
| 主采集 | `0 */30 * * * *` | 每30分钟 | collectAll → computeScores → analyzeTrends(ai) → analyzeTrends(general) |
| 关键词检查 | `0 */10 * * * *` | 每10分钟 | checkAllKeywords() |
| 关键词趋势 | `0 15,45 * * * *` | 每30分钟(偏移) | collectKeywordTrends() |

---

## 前端概览

### 三 Tab 结构
1. **AI 热点** — category='ai' 的热点列表 + AI 分析面板
2. **综合热点** — category='general' 的热点列表 + AI 分析面板  
3. **热点监控** — 关键词管理 + 告警 + 趋势

### 状态管理
- 三套独立筛选状态：`aiState`, `generalState`, `kwState`
- 每套包含：page, pageSize, sort, sources, search, days, minScore, hasUrl

### i18n 系统
- 中/英两语言，80+ 翻译 key
- `applyUILanguage()` 切换时遍历所有 DOM
- `getDisplayTitle(item)` 按当前语言选择 title/titleZh/titleEn

### Socket.IO 客户端
- 连接到服务端 Socket.IO
- 监听：new-trends, fetch-status, analysis-update, keyword-alert, keyword-trends-update
- keyword-alert 弹出 banner 告警

### 技术栈
- Express 5.x + TypeScript
- Prisma ORM + SQLite
- Socket.IO 4.x
- node-cron
- cheerio (HTML/XML 解析)
- OpenRouter API (AI 分析/分类/翻译)
- tsx watch (开发热重载)
