import * as cheerio from 'cheerio'
import { TrendSource, TrendData } from './base'

export class DuckDuckGoSource implements TrendSource {
  name = 'duckduckgo'

  async fetch(): Promise<TrendData[]> {
    // DuckDuckGo doesn't have a trending API, but we can use their
    // autocomplete suggestions for popular topic keywords
    const keywords = ['trending', 'breaking news', 'popular today', 'viral']
    const items: TrendData[] = []
    const seen = new Set<string>()

    for (const keyword of keywords) {
      try {
        const url = `https://duckduckgo.com/ac/?q=${encodeURIComponent(keyword)}&type=list`
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        })

        if (!response.ok) continue

        const data = await response.json()
        // DuckDuckGo ac returns [query, [suggestions...]]
        const suggestions: string[] = Array.isArray(data) && data.length > 1 ? data[1] : []

        for (const suggestion of suggestions) {
          const normalized = suggestion.toLowerCase().trim()
          if (seen.has(normalized) || !normalized) continue
          seen.add(normalized)

          items.push({
            title: suggestion,
            source: this.name,
            score: 0,
            externalId: `ddg-${normalized.replace(/\s+/g, '-')}`,
            extra: JSON.stringify({ keyword }),
          })
        }

        // Small delay between requests
        await new Promise((r) => setTimeout(r, 300))
      } catch {
        // Skip failed keyword, continue with others
      }
    }

    // Also try the DuckDuckGo instant answer API for broader topics
    try {
      const response = await fetch('https://api.duckduckgo.com/?q=trending+topics&format=json&no_html=1', {
        headers: {
          'User-Agent': 'TrendTracker/1.0',
        },
      })
      if (response.ok) {
        const data = await response.json()
        if (data.RelatedTopics) {
          for (const topic of data.RelatedTopics) {
            if (topic.Text && topic.FirstURL) {
              const title = topic.Text.substring(0, 100)
              const normalized = title.toLowerCase().trim()
              if (seen.has(normalized)) continue
              seen.add(normalized)

              items.push({
                title,
                url: topic.FirstURL,
                source: this.name,
                score: 0,
                externalId: `ddg-topic-${normalized.replace(/\s+/g, '-').substring(0, 50)}`,
                extra: JSON.stringify({ type: 'related_topic' }),
              })
            }
          }
        }
      }
    } catch {
      // Skip instant answer errors
    }

    return items
  }
}
