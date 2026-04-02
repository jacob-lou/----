import type { TrendData } from '../types'
import { UA_BOT, fetchWithTimeout, sleep } from '../utils'

const TECH_SUBREDDITS = [
  'artificial', 'MachineLearning', 'LocalLLaMA', 'ChatGPT', 'OpenAI',
  'ClaudeAI', 'singularity', 'StableDiffusion', 'deeplearning',
  'LangChain', 'Futurology',
]

const MIN_SCORE = 50
const MIN_COMMENTS = 5
const MAX_AGE_DAYS = 30

export async function fetchReddit(): Promise<TrendData[]> {
  const items: TrendData[] = []
  const cutoff = Date.now() / 1000 - MAX_AGE_DAYS * 86400

  for (const sub of TECH_SUBREDDITS) {
    try {
      const response = await fetchWithTimeout(
        `https://www.reddit.com/r/${sub}/hot.json?limit=25&t=week`,
        { headers: { 'User-Agent': UA_BOT } },
      )
      if (!response.ok) continue

      const data = (await response.json()) as any

      for (const post of data.data.children) {
        const { id, title, score, num_comments, permalink, subreddit, created_utc } = post.data
        if (score < MIN_SCORE || num_comments < MIN_COMMENTS) continue
        if (created_utc < cutoff) continue

        items.push({
          title,
          url: `https://www.reddit.com${permalink}`,
          source: 'reddit',
          score,
          externalId: `reddit-${id}`,
          publishedAt: new Date(created_utc * 1000),
          extra: JSON.stringify({ num_comments, subreddit }),
        })
      }

      await sleep(500)
    } catch {
      // single subreddit failure doesn't affect others
    }
  }

  items.sort((a, b) => b.score - a.score)
  return items.slice(0, 40)
}
