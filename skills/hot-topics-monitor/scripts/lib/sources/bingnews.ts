import * as cheerio from 'cheerio'
import type { TrendData } from '../types'
import { UA_BROWSER, fetchWithTimeout, sleep } from '../utils'

const NEWS_QUERIES = [
  'AI artificial intelligence LLM',
  'OpenAI GPT Anthropic Claude',
  'DeepSeek AI',
  'Qwen Alibaba AI',
  'AI startup funding',
  'machine learning breakthrough',
]

export async function fetchBingNews(): Promise<TrendData[]> {
  const items: TrendData[] = []
  const seen = new Set<string>()

  // Random 3 queries per run
  const shuffled = NEWS_QUERIES.sort(() => Math.random() - 0.5)
  const selectedQueries = shuffled.slice(0, 3)

  for (const query of selectedQueries) {
    try {
      const url = `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=RSS`
      const response = await fetchWithTimeout(url, {
        headers: { 'User-Agent': UA_BROWSER },
      })
      if (!response.ok) continue

      const xml = await response.text()
      const $ = cheerio.load(xml, { xml: true })

      $('item').each((_, el) => {
        const title = $(el).find('title').text().trim()
        if (!title) return

        const link = $(el).find('link').text().trim()
        const pubDate = $(el).find('pubDate').text().trim()
        const description = $(el).find('description').text().trim()
        const source = $(el).find('News\\:Source, source').text().trim()

        const normalizedTitle = title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '')
        if (seen.has(normalizedTitle)) return
        seen.add(normalizedTitle)

        items.push({
          title,
          url: link || undefined,
          source: 'bingnews',
          score: 0,
          externalId: `bing-${normalizedTitle.substring(0, 80)}`,
          publishedAt: pubDate ? new Date(pubDate) : undefined,
          extra: JSON.stringify({
            query,
            newsSource: source,
            description: description.substring(0, 300),
          }),
        })
      })

      await sleep(500)
    } catch { /* skip */ }
  }

  return items
}
