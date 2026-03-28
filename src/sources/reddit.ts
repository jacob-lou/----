import { TrendSource, TrendData } from './base'

interface RedditPost {
  data: {
    id: string
    title: string
    score: number
    num_comments: number
    permalink: string
    subreddit: string
    url: string
  }
}

interface RedditResponse {
  data: {
    children: RedditPost[]
  }
}

export class RedditSource implements TrendSource {
  name = 'reddit'

  async fetch(): Promise<TrendData[]> {
    const response = await fetch('https://www.reddit.com/r/popular/hot.json?limit=25', {
      headers: {
        'User-Agent': 'TrendTracker/1.0',
      },
    })

    if (!response.ok) {
      throw new Error(`Reddit API failed: ${response.status}`)
    }

    const data: RedditResponse = await response.json()
    const items: TrendData[] = []

    for (const post of data.data.children) {
      const { id, title, score, num_comments, permalink, subreddit } = post.data
      items.push({
        title,
        url: `https://www.reddit.com${permalink}`,
        source: this.name,
        score,
        externalId: `reddit-${id}`,
        extra: JSON.stringify({ num_comments, subreddit }),
      })
    }

    return items
  }
}
