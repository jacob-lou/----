import { TrendSource, TrendData } from './base'

interface TwitterTrend {
  name: string
  query?: string
  target?: { query: string }
  rank?: number
  description?: string
  meta_description?: string
}

interface TwitterTrendsResponse {
  trends: TwitterTrend[]
  status?: string
  msg?: string
}

interface TwitterTweet {
  id: string
  text: string
  url: string
  createdAt?: string
  likeCount: number
  retweetCount: number
  replyCount: number
  viewCount: number
  isReply?: boolean
  isQuote?: boolean
  author?: {
    name: string
    userName: string
    isVerified?: boolean
    followers?: number
  }
}

interface TwitterSearchResponse {
  tweets: TwitterTweet[]
  has_next_page: boolean
  next_cursor: string
}

type TwitterProvider = 'twitterapi.io' | 'xquik'

interface TwitterSourceOptions {
  provider?: TwitterProvider
  xquikBaseUrl?: string
}

// 推文质量过滤阈值
const MIN_LIKES = 100
const MIN_RETWEETS = 50
const MIN_VIEWS = 2000
const MIN_FOLLOWERS = 800

// AI/科技方向的搜索查询
const AI_TECH_QUERIES = [
  'AI OR "artificial intelligence" OR LLM OR GPT -is:reply -is:quote',
  '"machine learning" OR "deep learning" OR "neural network" -is:reply -is:quote',
  'OpenAI OR Anthropic OR "Google AI" OR "Meta AI" -is:reply -is:quote',
]

export class TwitterSource implements TrendSource {
  name = 'twitter'
  private apiKey: string
  private provider: TwitterProvider
  private xquikBaseUrl: string

  constructor(apiKey: string, options: TwitterSourceOptions = {}) {
    this.apiKey = apiKey
    this.provider = options.provider || 'twitterapi.io'
    this.xquikBaseUrl = (options.xquikBaseUrl || 'https://xquik.com/api/v1').replace(/\/$/, '')
  }

  async fetch(): Promise<TrendData[]> {
    const items: TrendData[] = []

    // 1. 获取全球趋势（WOEID 1 = 全球）
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
            type: 'trend',
            rank: trend.rank,
            description: trend.description || trend.meta_description,
            query: trend.query || trend.target?.query,
          }),
        })
      }
    } catch (err) {
      console.error('[Twitter] Failed to fetch trends:', err)
    }

    // 2. 搜索 AI/科技方向的热门推文，每次随机选1个query避免429
    const query = AI_TECH_QUERIES[Math.floor(Math.random() * AI_TECH_QUERIES.length)]
    try {
      const tweets = await this.searchTweets(query)
      const filtered = this.filterTweets(tweets)

      for (const tweet of filtered) {
        const engagement = (tweet.likeCount || 0) + (tweet.retweetCount || 0) * 2
        const isVerified = tweet.author?.isVerified || false

        items.push({
          title: tweet.text.substring(0, 200),
          url: tweet.url,
          source: this.name,
            score: isVerified ? Math.round(engagement * 1.2) : engagement, // 认证账号加权20%
            externalId: `tw-${tweet.id}`,
            publishedAt: tweet.createdAt ? new Date(tweet.createdAt) : undefined,
            extra: JSON.stringify({
              type: 'tweet',
              author: tweet.author?.userName,
              authorName: tweet.author?.name,
              isVerified,
              followers: tweet.author?.followers,
              likes: tweet.likeCount,
              retweets: tweet.retweetCount,
              replies: tweet.replyCount,
              views: tweet.viewCount,
            }),
          })
        }
      } catch (err) {
        console.error(`[Twitter] Failed to search tweets for query:`, err)
      }

    return items
  }

  /** 过滤推文：点赞、转发、浏览量、粉丝数、排除回复/引用 */
  private filterTweets(tweets: TwitterTweet[]): TwitterTweet[] {
    return tweets.filter((tweet) => {
      // 排除回复和引用推文
      if (tweet.isReply || tweet.isQuote) return false

      // 最低点赞数
      if ((tweet.likeCount || 0) < MIN_LIKES) return false

      // 最低转发数
      if ((tweet.retweetCount || 0) < MIN_RETWEETS) return false

      // 最低浏览量
      if ((tweet.viewCount || 0) < MIN_VIEWS) return false

      // 作者粉丝数
      if ((tweet.author?.followers || 0) < MIN_FOLLOWERS) return false

      return true
    })
  }

  private async fetchTrends(): Promise<TwitterTrend[]> {
    if (this.provider === 'xquik') {
      return this.fetchXquikTrends()
    }

    const response = await fetch('https://api.twitterapi.io/twitter/trends?woeid=1&count=30', {
      headers: {
        'x-api-key': this.apiKey,
      },
    })

    if (!response.ok) {
      throw new Error(`Twitter trends API failed: ${response.status}`)
    }

    const data = await response.json() as TwitterTrendsResponse
    if (data.status !== 'success') {
      throw new Error(`Twitter trends error: ${data.msg}`)
    }

    return data.trends || []
  }

  private async searchTweets(query: string): Promise<TwitterTweet[]> {
    if (this.provider === 'xquik') {
      return this.searchXquikTweets(query)
    }

    const response = await fetch(
      `https://api.twitterapi.io/twitter/tweet/advanced_search?query=${encodeURIComponent(query)}&queryType=Top&count=20`,
      {
        headers: {
          'x-api-key': this.apiKey,
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Twitter search API failed: ${response.status}`)
    }

    const data = await response.json() as TwitterSearchResponse
    return data.tweets || []
  }

  private async fetchXquikTrends(): Promise<TwitterTrend[]> {
    const response = await fetch(`${this.xquikBaseUrl}/trends?woeid=1&count=30`, {
      headers: {
        'X-API-Key': this.apiKey,
      },
    })

    if (!response.ok) {
      throw new Error(`Xquik trends API failed: ${response.status}`)
    }

    const data = await response.json() as TwitterTrendsResponse
    return data.trends || []
  }

  private async searchXquikTweets(query: string): Promise<TwitterTweet[]> {
    const searchParams = new URLSearchParams({
      q: query,
      queryType: 'Top',
      limit: '20',
    })
    const response = await fetch(`${this.xquikBaseUrl}/x/tweets/search?${searchParams.toString()}`, {
      headers: {
        'X-API-Key': this.apiKey,
      },
    })

    if (!response.ok) {
      throw new Error(`Xquik search API failed: ${response.status}`)
    }

    const data = await response.json() as TwitterSearchResponse
    return (data.tweets || []).map((tweet) => ({
      ...tweet,
      isQuote: tweet.isQuote || Boolean((tweet as { isQuoteStatus?: boolean }).isQuoteStatus),
      author: tweet.author ? {
        name: tweet.author.name,
        userName: tweet.author.userName || (tweet.author as { username?: string }).username || '',
        isVerified: tweet.author.isVerified || (tweet.author as { verified?: boolean }).verified,
        followers: tweet.author.followers,
      } : undefined,
    }))
  }
}
