import type { TrendData } from '../types'
import { UA_BOT, fetchWithTimeout } from '../utils'

export async function fetchV2EX(): Promise<TrendData[]> {
  const response = await fetchWithTimeout('https://www.v2ex.com/api/topics/hot.json', {
    headers: { 'User-Agent': UA_BOT },
  })

  if (!response.ok) {
    throw new Error(`V2EX API failed: ${response.status}`)
  }

  const topics = (await response.json()) as any[]
  const items: TrendData[] = []

  for (const topic of topics) {
    if (!topic.title) continue
    items.push({
      title: topic.title,
      url: `https://www.v2ex.com/t/${topic.id}`,
      source: 'v2ex',
      score: topic.replies || 0,
      externalId: `v2ex-${topic.id}`,
      publishedAt: topic.created ? new Date(topic.created * 1000) : undefined,
      extra: JSON.stringify({
        replies: topic.replies,
        node: topic.node?.title || topic.node?.name,
        author: topic.member?.username,
      }),
    })
  }

  return items
}
