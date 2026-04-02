import type { TrendData } from '../types'
import { fetchWithTimeout } from '../utils'

const MIN_SCORE = 20
const MIN_COMMENTS = 3
const MAX_AGE_DAYS = 30

export async function fetchHackerNews(): Promise<TrendData[]> {
  const cutoff = Math.floor(Date.now() / 1000) - MAX_AGE_DAYS * 86400

  const response = await fetchWithTimeout(
    `https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=40&numericFilters=created_at_i>${cutoff},points>=${MIN_SCORE},num_comments>=${MIN_COMMENTS}`,
  )

  if (!response.ok) {
    throw new Error(`HackerNews Algolia API failed: ${response.status}`)
  }

  const data = (await response.json()) as any
  const items: TrendData[] = []

  for (const hit of data.hits) {
    if (!hit.title) continue
    items.push({
      title: hit.title,
      url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
      source: 'hackernews',
      score: hit.points || 0,
      externalId: `hn-${hit.objectID}`,
      publishedAt: new Date(hit.created_at_i * 1000),
      extra: JSON.stringify({
        comments: hit.num_comments || 0,
        author: hit.author,
      }),
    })
  }

  return items
}
