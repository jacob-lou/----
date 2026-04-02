# 数据源详细文档

> 10 个数据源的采集方式、API 详情、字段含义、过滤策略。

---

## 1. Google Trends

| 属性 | 值 |
|------|---|
| 源名称 | `google` |
| 采集方式 | RSS Feed (cheerio XML 解析) |
| URL | `https://trends.google.com/trending/rss?geo=US` |
| 认证 | 无 |
| 频率限制 | 宽松，30 分钟一次足够 |

**score 含义**：搜索流量（approx_traffic），如 "200,000+"  
**extra 字段**：`{ traffic, newsSource, newsTitle, searchUrl }`  
**特殊处理**：提取 `<ht:news_item_url>` 作为链接，回退为 Google 搜索链接

---

## 2. Reddit

| 属性 | 值 |
|------|---|
| 源名称 | `reddit` |
| 采集方式 | Reddit JSON API |
| URL | `https://www.reddit.com/r/{sub}/hot.json?limit=25&t=week` |
| 认证 | 无（需 User-Agent） |
| 频率限制 | 需 500ms 间隔，避免 429 |

**订阅列表**（11 个 AI/科技 subreddit）：  
`artificial`, `MachineLearning`, `LocalLLaMA`, `ChatGPT`, `OpenAI`, `ClaudeAI`, `singularity`, `StableDiffusion`, `deeplearning`, `LangChain`, `Futurology`

**质量过滤**：score ≥ 50, comments ≥ 5, 发布 ≤ 30 天  
**score 含义**：Reddit upvotes  
**extra 字段**：`{ num_comments, subreddit }`  
**结果上限**：按 score 降序取前 40 条

---

## 3. HackerNews

| 属性 | 值 |
|------|---|
| 源名称 | `hackernews` |
| 采集方式 | Algolia Search API |
| URL | `https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=40&numericFilters=...` |
| 认证 | 无 |
| 频率限制 | 宽松 |

**质量过滤**：points ≥ 20, comments ≥ 3, 发布 ≤ 30 天  
**score 含义**：HN points  
**extra 字段**：`{ comments, author }`

---

## 4. DuckDuckGo

| 属性 | 值 |
|------|---|
| 源名称 | `duckduckgo` |
| 采集方式 | 自动补全 API + 即时答案 API |
| URL (补全) | `https://duckduckgo.com/ac/?q={keyword}&type=list` |
| URL (答案) | `https://api.duckduckgo.com/?q={query}&format=json&no_html=1` |
| 认证 | 无 |

**关键词池**（每次随机 6 个）：AI news today, AI breakthrough 2026, LLM latest, GPT new release, AI startup funding, generative AI update, AI agent framework, open source AI model, DeepSeek latest, Qwen model update, Claude AI update, AI coding assistant

**域名屏蔽**：wikipedia.org, wiktionary.org, britannica.com, dictionary.com  
**score 含义**：固定值（补全=0, 摘要=10, 话题=5）  
**extra 字段**：`{ keyword }` 或 `{ type: 'abstract'|'related_topic', snippet }`

---

## 5. GitHub Trending

| 属性 | 值 |
|------|---|
| 源名称 | `github` |
| 采集方式 | HTML 爬取 (cheerio) |
| URL | `https://github.com/trending?since=daily` |
| 认证 | 无 |

**score 含义**：今日新增 stars（todayStars），回退为总 stars  
**extra 字段**：`{ repo, description, language, stars, todayStars }`  
**title 格式**：`owner/repo — description`

---

## 6. HuggingFace

| 属性 | 值 |
|------|---|
| 源名称 | `huggingface` |
| 采集方式 | REST API |
| URL (模型) | `https://huggingface.co/api/models?sort=trendingScore&direction=-1&limit=20` |
| URL (论文) | `https://huggingface.co/api/daily_papers` |
| 认证 | 无 |

**两类内容**：  
1. **热门模型** — score = trendingScore || likes  
2. **每日论文** — score = upvotes, 过滤 upvotes ≥ 3, 取前 15 篇

**extra 字段 (模型)**：`{ type: 'model', likes, trendingScore, author, pipeline, tags }`  
**extra 字段 (论文)**：`{ type: 'paper', upvotes, summary }`

---

## 7. V2EX

| 属性 | 值 |
|------|---|
| 源名称 | `v2ex` |
| 采集方式 | JSON API |
| URL | `https://www.v2ex.com/api/topics/hot.json` |
| 认证 | 无 |

**score 含义**：回复数 (replies)  
**extra 字段**：`{ replies, node, author }`

---

## 8. Bing News

| 属性 | 值 |
|------|---|
| 源名称 | `bingnews` |
| 采集方式 | RSS Feed (cheerio XML 解析) |
| URL | `https://www.bing.com/news/search?q={query}&format=RSS` |
| 认证 | 无 |
| 频率限制 | 需 500ms 间隔 |

**搜索词**（每次随机 3 个）：AI artificial intelligence LLM, OpenAI GPT Anthropic Claude, DeepSeek AI, Qwen Alibaba AI, AI startup funding, machine learning breakthrough

**score 含义**：固定 0（Bing News 不公开热度分数）  
**extra 字段**：`{ query, newsSource, description }`  
**去重**：基于标题归一化（去除非字母数字/CJK 字符后比较）

---

## 9. Bilibili

| 属性 | 值 |
|------|---|
| 源名称 | `bilibili` |
| 采集方式 | JSON API |
| URL (热搜) | `https://app.bilibili.com/x/v2/search/trending/ranking` |
| URL (科技区) | `https://api.bilibili.com/x/web-interface/ranking/v2?rid=188&type=all` |
| 认证 | 无 |

**两类内容**：  
1. **热搜榜** — score = (100 - position) × 100  
2. **科技区排行** — score = 播放量 (stat.view), 取前 30

**extra 字段 (热搜)**：`{ type: 'hot_search', position, icon }`  
**extra 字段 (科技)**：`{ type: 'tech_video', views, likes, coins, danmaku, author, duration }`

---

## 10. Twitter/X

| 属性 | 值 |
|------|---|
| 源名称 | `twitter` |
| 采集方式 | twitterapi.io REST API |
| URL (趋势) | `https://api.twitterapi.io/twitter/trends?woeid=1&count=30` |
| URL (搜索) | `https://api.twitterapi.io/twitter/tweet/advanced_search?query={q}&queryType=Top&count=20` |
| 认证 | `x-api-key` Header (环境变量 `TWITTER_API_KEY`) |
| 频率限制 | 宽松 (1000+ req/sec) |

**⚠️ 需要 API Key**：无 Key 时自动跳过

**两类内容**：
1. **全球趋势** — score = 100 - rank
2. **AI/科技推文** — score = likes + retweets×2（认证账号 ×1.2）

**搜索查询**（每次随机 1 个）：  
- `AI OR "artificial intelligence" OR LLM OR GPT -is:reply -is:quote`  
- `"machine learning" OR "deep learning" OR "neural network" -is:reply -is:quote`
- `OpenAI OR Anthropic OR "Google AI" OR "Meta AI" -is:reply -is:quote`

**质量过滤**：likes ≥ 100, retweets ≥ 50, views ≥ 2000, followers ≥ 800, 排除回复/引用  
**extra 字段 (趋势)**：`{ type: 'trend', rank, description }`  
**extra 字段 (推文)**：`{ type: 'tweet', author, authorName, isVerified, followers, likes, retweets, replies, views }`

---

## 关键词搜索源

`search-keyword.ts` 使用不同的 API 端点进行关键词搜索：

| 源 | 搜索 API | 特点 |
|---|---------|------|
| Reddit | `reddit.com/search.json?q={kw}&sort=new&t=day&limit=15` | 最近24h，按新排序 |
| HackerNews | `hn.algolia.com/api/v1/search?query={kw}&tags=story&hitsPerPage=15` | Algolia 全文搜索 |
| DuckDuckGo | `api.duckduckgo.com/?q={kw}&format=json` | 即时答案 + 相关话题 |
| Twitter | `api.twitterapi.io/twitter/tweet/advanced_search?query={kw}&queryType=Top&count=15` | 需要 API Key |

所有搜索均有 10 秒超时。
