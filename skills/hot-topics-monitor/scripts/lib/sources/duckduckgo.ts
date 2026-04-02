import type { TrendData } from '../types'
import { UA_BROWSER, UA_BOT, fetchWithTimeout, sleep } from '../utils'

const AI_TECH_KEYWORDS = [
  'AI news today', 'AI breakthrough 2026', 'LLM latest',
  'GPT new release', 'AI startup funding', 'generative AI update',
  'AI agent framework', 'open source AI model', 'DeepSeek latest',
  'Qwen model update', 'Claude AI update', 'AI coding assistant',
]

const BLOCKED_DOMAINS = ['wikipedia.org', 'wiktionary.org', 'britannica.com', 'dictionary.com']

function isBlockedUrl(url: string): boolean {
  return BLOCKED_DOMAINS.some(domain => url.includes(domain))
}

export async function fetchDuckDuckGo(): Promise<TrendData[]> {
  const items: TrendData[] = []
  const seen = new Set<string>()

  // Random 6 keywords per run
  const shuffled = [...AI_TECH_KEYWORDS].sort(() => Math.random() - 0.5)
  const selected = shuffled.slice(0, 6)

  for (const keyword of selected) {
    try {
      const url = `https://duckduckgo.com/ac/?q=${encodeURIComponent(keyword)}&type=list`
      const response = await fetchWithTimeout(url, {
        headers: { 'User-Agent': UA_BROWSER },
      })
      if (!response.ok) continue

      const data = (await response.json()) as any
      const suggestions: string[] = Array.isArray(data) && data.length > 1 ? data[1] : []

      for (const suggestion of suggestions) {
        const normalized = suggestion.toLowerCase().trim()
        if (seen.has(normalized) || !normalized) continue
        if (normalized === keyword.toLowerCase()) continue
        seen.add(normalized)

        items.push({
          title: suggestion,
          source: 'duckduckgo',
          score: 0,
          externalId: `ddg-${normalized.replace(/\s+/g, '-').substring(0, 80)}`,
          extra: JSON.stringify({ keyword }),
        })
      }
      await sleep(300)
    } catch { /* skip */ }
  }

  // Instant answers API
  const topicQueries = ['AI latest news', 'large language model', 'DeepSeek AI']
  for (const query of topicQueries) {
    try {
      const response = await fetchWithTimeout(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`,
        { headers: { 'User-Agent': UA_BOT } },
      )
      if (!response.ok) continue
      const data = (await response.json()) as any

      if (data.Abstract && data.AbstractURL && !isBlockedUrl(data.AbstractURL)) {
        const title = data.Heading || query
        const normalized = title.toLowerCase().trim()
        if (!seen.has(normalized)) {
          seen.add(normalized)
          items.push({
            title,
            url: data.AbstractURL,
            source: 'duckduckgo',
            score: 10,
            externalId: `ddg-abs-${normalized.replace(/\s+/g, '-').substring(0, 50)}`,
            extra: JSON.stringify({ type: 'abstract', snippet: (data.Abstract || '').substring(0, 200) }),
          })
        }
      }

      const topics = data.RelatedTopics || []
      for (const topic of topics.slice(0, 5)) {
        if (!topic.Text || !topic.FirstURL) continue
        if (isBlockedUrl(topic.FirstURL)) continue

        const title = topic.Text.substring(0, 100)
        const normalized = title.toLowerCase().trim()
        if (seen.has(normalized)) continue
        seen.add(normalized)

        items.push({
          title,
          url: topic.FirstURL,
          source: 'duckduckgo',
          score: 5,
          externalId: `ddg-topic-${normalized.replace(/\s+/g, '-').substring(0, 50)}`,
          extra: JSON.stringify({ type: 'related_topic' }),
        })
      }
    } catch { /* skip */ }
  }

  return items
}
