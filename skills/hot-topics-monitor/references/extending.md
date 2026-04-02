# 扩展指南

> 如何在热点追踪系统中新增数据源、扩展监控功能、添加 API 路由。

---

## 一、新增数据源

### Step 1: 创建 Source 文件

在 `src/sources/` 下新建文件，实现 `TrendSource` 接口：

```typescript
// src/sources/producthunt.ts
import { TrendSource, TrendData } from './base'

export class ProductHuntSource implements TrendSource {
  name = 'producthunt'  // 唯一标识，用于 DB 存储和前端筛选

  async fetch(): Promise<TrendData[]> {
    const items: TrendData[] = []
    
    // 1. 调用 API 或爬取页面
    const response = await fetch('https://api.producthunt.com/v2/...', {
      headers: { 'Authorization': `Bearer ${process.env.PH_TOKEN}` }
    })
    
    // 2. 解析数据
    const data = await response.json()
    
    // 3. 转换为 TrendData 格式
    for (const post of data.posts) {
      items.push({
        title: post.name + ' — ' + post.tagline,
        url: post.url,
        source: this.name,
        score: post.votesCount,
        externalId: `ph-${post.id}`,  // 必须：唯一标识，用于去重
        publishedAt: new Date(post.createdAt),
        extra: JSON.stringify({
          // 可选：源特有的额外数据
          tagline: post.tagline,
          topics: post.topics,
          maker: post.maker?.name,
          commentsCount: post.commentsCount,
        }),
      })
    }
    
    return items
  }
}
```

**关键要求**：
- `source` 必须是唯一的字符串标识
- `externalId` 必须唯一，格式建议 `{source}-{id}`，用于 `@@unique([source, externalId])` 去重
- `extra` 字段存储 JSON，前端会解析展示
- 错误处理：单个请求失败用 try/catch，不影响整体

### Step 2: 注册到 Collector

在 `src/services/collector.ts` 的 `collectAll()` 方法中注册：

```typescript
// 在文件顶部 import
import { ProductHuntSource } from '../sources/producthunt'

// 在 collectAll() 的 sources 数组中添加
const sources: TrendSource[] = [
  new GoogleTrendsSource(),
  new RedditSource(),
  // ... 已有源
  new ProductHuntSource(),  // ← 新增
]
```

### Step 3: 前端显示 (可选)

如果源有特殊的 extra 字段需要展示：

1. 在 `public/app.js` 的 `renderTrendMeta()` 函数中添加源特有渲染逻辑
2. 在 `public/style.css` 中添加源标签颜色：

```css
.source-tag.producthunt { background: #da552f15; color: #da552f; }
```

### Step 4: 同步到 Skill 脚本 (可选)

在 `skills/hot-topics-monitor/scripts/lib/sources/` 下创建对应的纯函数版本，并在 `fetch-trends.ts` 的 `SOURCE_REGISTRY` 中注册。

---

## 二、扩展监控功能

### 添加新的搜索源

在 `src/services/keyword-search.ts` 中添加搜索方法：

```typescript
private async searchProductHunt(keyword: string): Promise<KeywordSearchResult[]> {
  // 实现搜索逻辑
  // 返回 KeywordSearchResult[] 格式
}
```

然后在 `searchAll()` 的 Promise.allSettled 数组中添加。

### 添加新的告警渠道

在 `src/services/monitor.ts` 的 `checkKeyword()` 方法中，告警保存后添加推送逻辑：

```typescript
// 保存告警到 DB 后
const savedAlerts = await prisma.keywordAlert.createMany(...)

// 推送到其他渠道（如飞书、Slack、邮件）
await this.sendToFeishu(keyword, savedAlerts)
await this.sendToSlack(keyword, savedAlerts)
```

### 自定义监控规则

`MonitorKeyword.scope` 字段支持自定义范围标签。可以基于 scope 实现不同的监控策略：

```typescript
// 根据 scope 选择不同的搜索源或过滤规则
if (keyword.scope === 'crypto') {
  // 搜索加密货币特定源
} else if (keyword.scope === 'AI编程') {
  // 搜索 AI 编程特定 subreddits
}
```

---

## 三、添加 API 路由

### Express 5 路由模式

```typescript
// src/routes/my-feature.ts
import { Router } from 'express'
import prisma from '../db'

const router = Router()

router.get('/my-endpoint', async (req, res) => {
  const data = await prisma.trendItem.findMany({ ... })
  res.json(data)
})

export default router
```

在 `src/app.ts` 中注册：

```typescript
import myFeatureRouter from './routes/my-feature'
app.use('/api/my-feature', myFeatureRouter)
```

---

## 四、示例：添加 ProductHunt 数据源

完整流程示例：

1. **创建** `src/sources/producthunt.ts`（见 Step 1）
2. **注册** 到 `src/services/collector.ts`（见 Step 2）
3. **迁移** — Prisma 无需迁移（TrendItem 是通用模型，source 字段自动区分）
4. **测试** — 重启服务，在前端 source filter 中应能看到 `producthunt`
5. **Skill 同步** — 在 `skills/.../lib/sources/producthunt.ts` 创建纯函数版本

---

## 五、示例：自定义监控告警（飞书通知）

```typescript
// src/services/monitor.ts 中新增方法

private async sendToFeishu(keyword: string, alerts: any[]): Promise<void> {
  const webhookUrl = process.env.FEISHU_WEBHOOK_URL
  if (!webhookUrl) return

  const text = alerts.map(a => `• ${a.title} (${a.source})`).join('\n')
  
  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      msg_type: 'text',
      content: { text: `🔔 关键词「${keyword}」发现 ${alerts.length} 条新动态：\n${text}` },
    }),
  })
}
```

然后在 `checkKeyword()` 保存告警后调用 `this.sendToFeishu(keyword, savedAlerts)`。

---

## 六、开发环境

```bash
# 安装依赖
npm install

# 开发模式（热重载）
npx tsx watch src/index.ts

# 数据库迁移（修改 schema.prisma 后）
npx prisma db push

# 运行测试
npx vitest run

# 仅运行 Skill 脚本（不需要启动服务）
npx tsx skills/hot-topics-monitor/scripts/fetch-trends.ts
```
