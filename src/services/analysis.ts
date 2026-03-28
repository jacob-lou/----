import prisma from '../db'

export class AnalysisService {
  private apiKey: string | null = null
  private model: string

  constructor() {
    const key = process.env.OPENROUTER_API_KEY
    this.model = process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001'

    if (key && key !== 'your_openrouter_api_key_here') {
      this.apiKey = key
    }
  }

  get isConfigured(): boolean {
    return this.apiKey !== null
  }

  async analyzeTrends(): Promise<{ summary: string; topics: any[] } | null> {
    if (!this.apiKey) {
      console.warn('[Analysis] OpenRouter API key not configured')
      return null
    }

    // Get recent trends from the last collection
    const recentTrends = await prisma.trendItem.findMany({
      orderBy: { fetchedAt: 'desc' },
      take: 60,
      select: { title: true, source: true, score: true },
    })

    if (recentTrends.length === 0) return null

    const trendsList = recentTrends
      .map((t) => `[${t.source}] ${t.title} (score: ${t.score})`)
      .join('\n')

    const prompt = `你是一个热点分析专家。以下是从多个平台（Google、Reddit、HackerNews、DuckDuckGo、Twitter）采集到的最新热点数据。

请分析这些热点，返回以下 JSON 格式：
{
  "summary": "用中文写一段 2-3 句话的整体趋势概述",
  "topics": [
    {
      "name": "话题名称",
      "heat": "high/medium/low",
      "description": "一句话描述",
      "sources": ["来源1", "来源2"]
    }
  ]
}

要求：
1. 提取 5-8 个最核心的热门话题
2. 合并不同来源中重复或相关的话题
3. 按热度从高到低排列
4. 只返回 JSON，不要其他内容

热点数据：
${trendsList}`

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'X-OpenRouter-Title': 'TrendTracker',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(`OpenRouter API error ${response.status}: ${errText}`)
      }

      const completion = await response.json()
      const content = completion.choices?.[0]?.message?.content
      if (!content) return null

      // Parse the JSON response (strip markdown code fences if present)
      const jsonStr = content.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim()
      const result = JSON.parse(jsonStr)

      // Save to database
      await prisma.trendAnalysis.create({
        data: {
          summary: result.summary || '',
          topics: JSON.stringify(result.topics || []),
          model: this.model,
        },
      })

      console.log(`[Analysis] Generated analysis with ${result.topics?.length || 0} topics`)
      return result
    } catch (err: any) {
      console.error('[Analysis] Failed:', err?.message || err)
      return null
    }
  }

  async getLatestAnalysis() {
    const analysis = await prisma.trendAnalysis.findFirst({
      orderBy: { createdAt: 'desc' },
    })

    if (!analysis) return null

    return {
      id: analysis.id,
      summary: analysis.summary,
      topics: JSON.parse(analysis.topics),
      model: analysis.model,
      createdAt: analysis.createdAt,
    }
  }
}
