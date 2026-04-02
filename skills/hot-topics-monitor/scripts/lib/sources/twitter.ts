import type { TrendData } from '../types'
import { fetchWithTimeout } from '../utils'

const MIN_LIKES = 100
const MIN_RETWEETS = 50
const MIN_VIEWS = 2000
const MIN_FOLLOWERS = 800

const AI_TECH_QUERIES = [
  'AI OR "artificial intelligence" OR LLM OR GPT -is:reply -is:quote',
  '"machine learning" OR "deep learning" OR "neural network" -is:reply -is:quote',
  'OpenAI OR Anthropic OR "Google AI" OR "Meta AI" -is:reply -is:quote',
]

export async function fetchTwitter(apiKey: string): Promise<TrendData[]> {
  const items: TrendData[] = []

  // 1. Global trends
  try {
    const response = await fetchWithTimeout(
      'https://api.twitterapi.io/twitter/trends?woeid=1&count=30',
      { headers: { 'x-api-key': apiKey } },
    )

    if (response.ok) {
      const data = (await response.json()) as any
      if (data.status === 'success') {
        for (const trend of data.trends || []) {
          if (!trend.name) continue
          items.push({
            title: trend.name,
            source: 'twitter',
            score: trend.rank ? (100 - trend.rank) : 0,
            externalId: `tw-trend-${String(trend.name).toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
            extra: JSON.stringify({
              type: 'trend',
              rank: trend.rank,
              description: trend.meta_description,
            }),
          })
        }
      }
    }
  } catch { /* skip */ }

  // 2. AI/tech tweet search (random 1 query)
  const query = AI_TECH_QUERIES[Math.floor(Math.random() * AI_TECH_QUERIES.length)]
  try {
    const response = await fetchWithTimeout(
      `https://api.twitterapi.io/twitter/tweet/advanced_search?query=${encodeURIComponent(query)}&queryType=Top&count=20`,
      { headers: { 'x-api-key': apiKey } },
    )

    if (response.ok) {
      const data = (await response.json()) as any
      const tweets = data.tweets || []

      for (const tweet of tweets) {
        if (tweet.isReply || tweet.isQuote) continue
        if ((tweet.likeCount || 0) < MIN_LIKES) continue
        if ((tweet.retweetCount || 0) < MIN_RETWEETS) continue
        if ((tweet.viewCount || 0) < MIN_VIEWS) continue
        if ((tweet.author?.followers || 0) < MIN_FOLLOWERS) continue

        const engagement = (tweet.likeCount || 0) + (tweet.retweetCount || 0) * 2
        const isVerified = tweet.author?.isVerified || false

        items.push({
          title: (tweet.text || '').substring(0, 200),
          url: tweet.url,
          source: 'twitter',
          score: isVerified ? Math.round(engagement * 1.2) : engagement,
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
    }
  } catch { /* skip */ }

  return items
}
