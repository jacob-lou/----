import { TrendSource, TrendData } from './base'

interface TwitterTrend {
  name: string
  target?: { query: string }
  rank: number
  meta_description?: string
}

interface TwitterTrendsResponse {
  trends: TwitterTrend[]
  status: string
  msg?: string
}

interface TwitterTweet {
  id: string
  text: string
  url: string
  likeCount: number
  retweetCount: number
  replyCount: number
  viewCount: number
  author: {
    name: string
    username: string
  }
}

interface TwitterSearchResponse {
  tweets: TwitterTweet[]
  has_next_page: boolean
  next_cursor: string
}

export class TwitterSource implements TrendSource {
  name = 'twitter'
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async fetch(): Promise<TrendData[]> {
    const items: TrendData[] = []

    // 1. Fetch global trends (WOEID 1 = Worldwide)
    try {
      const trendsData = await this.fetchTrends()
      for (const trend of trendsData) {
        if (!trend.name) continue
        items.push({
          title: trend.name,
          source: this.name,
          score: trend.rank ? (100 - trend.rank) : 0,
          externalId: `tw-trend-${String(trend.name).toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          extra: JSON.stringify({
            rank: trend.rank,
            description: trend.meta_description,
            query: trend.target?.query,
          }),
        })
      }
    } catch (err) {
      console.error('[Twitter] Failed to fetch trends:', err)
    }

    // 2. Also search for top tweets on trending topics
    try {
      const topTweets = await this.searchTopTweets()
      for (const tweet of topTweets) {
        const engagement = (tweet.likeCount || 0) + (tweet.retweetCount || 0) * 2
        items.push({
          title: tweet.text.substring(0, 200),
          url: tweet.url,
          source: this.name,
          score: engagement,
          externalId: `tw-${tweet.id}`,
          extra: JSON.stringify({
            author: tweet.author?.username,
            likes: tweet.likeCount,
            retweets: tweet.retweetCount,
            replies: tweet.replyCount,
            views: tweet.viewCount,
          }),
        })
      }
    } catch (err) {
      console.error('[Twitter] Failed to search top tweets:', err)
    }

    return items
  }

  private async fetchTrends(): Promise<TwitterTrend[]> {
    const response = await fetch('https://api.twitterapi.io/twitter/trends?woeid=1&count=30', {
      headers: {
        'x-api-key': this.apiKey,
      },
    })

    if (!response.ok) {
      throw new Error(`Twitter trends API failed: ${response.status}`)
    }

    const data: TwitterTrendsResponse = await response.json()
    if (data.status !== 'success') {
      throw new Error(`Twitter trends error: ${data.msg}`)
    }

    return data.trends || []
  }

  private async searchTopTweets(): Promise<TwitterTweet[]> {
    const response = await fetch(
      'https://api.twitterapi.io/twitter/tweet/advanced_search?query=trending&queryType=Top&cursor=',
      {
        headers: {
          'x-api-key': this.apiKey,
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Twitter search API failed: ${response.status}`)
    }

    const data: TwitterSearchResponse = await response.json()
    return data.tweets || []
  }
}
