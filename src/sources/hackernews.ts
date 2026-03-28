import { TrendSource, TrendData } from './base'

interface HNItem {
  id: number
  title: string
  url?: string
  score: number
  descendants: number
  by: string
}

export class HackerNewsSource implements TrendSource {
  name = 'hackernews'

  async fetch(): Promise<TrendData[]> {
    const response = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json')
    if (!response.ok) {
      throw new Error(`HackerNews API failed: ${response.status}`)
    }

    const storyIds: number[] = await response.json()
    const top30 = storyIds.slice(0, 30)

    const items: TrendData[] = []
    const batchSize = 10

    for (let i = 0; i < top30.length; i += batchSize) {
      const batch = top30.slice(i, i + batchSize)
      const stories = await Promise.all(
        batch.map(async (id) => {
          const res = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
          if (!res.ok) return null
          return res.json() as Promise<HNItem>
        })
      )

      for (const story of stories) {
        if (!story || !story.title) continue
        items.push({
          title: story.title,
          url: story.url || `https://news.ycombinator.com/item?id=${story.id}`,
          source: this.name,
          score: story.score || 0,
          externalId: `hn-${story.id}`,
          extra: JSON.stringify({
            comments: story.descendants || 0,
            author: story.by,
          }),
        })
      }
    }

    return items
  }
}
