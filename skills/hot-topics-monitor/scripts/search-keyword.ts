import type { KeywordSearchResult, SearchOutput } from './lib/types'
import { UA_BOT, fetchWithTimeout, parseArgs } from './lib/utils'

// ── Search functions per source ────────────────────────────────────

async function searchReddit(keyword: string): Promise<KeywordSearchResult[]> {
  const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(keyword)}&sort=new&limit=15&t=day`
  const res = await fetchWithTimeout(url, { headers: { 'User-Agent': UA_BOT } })
  if (!res.ok) return []
  const data = (await res.json()) as any
  const posts = data?.data?.children || []
  return posts.map((p: any) => ({
    title: p.data.title,
    url: `https://reddit.com${p.data.permalink}`,
    source: 'reddit',
    score: p.data.score || 0,
    snippet: (p.data.selftext || '').slice(0, 200),
    extra: JSON.stringify({ subreddit: p.data.subreddit, num_comments: p.data.num_comments }),
  }))
}

async function searchHackerNews(keyword: string): Promise<KeywordSearchResult[]> {
  const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(keyword)}&tags=story&hitsPerPage=15`
  const res = await fetchWithTimeout(url)
  if (!res.ok) return []
  const data = (await res.json()) as any
  const hits = data?.hits || []
  return hits.map((h: any) => ({
    title: h.title || '',
    url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
    source: 'hackernews',
    score: h.points || 0,
    snippet: (h.story_text || '').slice(0, 200),
    extra: JSON.stringify({ comments: h.num_comments, author: h.author }),
  }))
}

async function searchTwitter(keyword: string, apiKey: string): Promise<KeywordSearchResult[]> {
  const url = `https://api.twitterapi.io/twitter/tweet/advanced_search?query=${encodeURIComponent(keyword)}&queryType=Top&count=15`
  const res = await fetchWithTimeout(url, { headers: { 'x-api-key': apiKey } })
  if (!res.ok) return []
  const data = (await res.json()) as any
  const tweets = data?.tweets || []
  return tweets.map((t: any) => ({
    title: (t.text || '').slice(0, 150),
    url: t.url || undefined,
    source: 'twitter',
    score: (t.likeCount || 0) + (t.retweetCount || 0),
    snippet: (t.text || '').slice(0, 200),
    extra: JSON.stringify({ likes: t.likeCount, retweets: t.retweetCount, author: t.author?.userName }),
  }))
}

async function searchDuckDuckGo(keyword: string): Promise<KeywordSearchResult[]> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(keyword)}&format=json&no_html=1`
  const res = await fetchWithTimeout(url)
  if (!res.ok) return []
  const data = (await res.json()) as any
  const results: KeywordSearchResult[] = []

  if (data.Abstract) {
    results.push({
      title: data.Heading || keyword,
      url: data.AbstractURL || undefined,
      source: 'duckduckgo',
      score: 50,
      snippet: data.Abstract.slice(0, 200),
    })
  }
  const topics = data.RelatedTopics || []
  for (const t of topics.slice(0, 5)) {
    if (t.Text) {
      results.push({
        title: t.Text.slice(0, 120),
        url: t.FirstURL || undefined,
        source: 'duckduckgo',
        score: 10,
        snippet: t.Text.slice(0, 200),
      })
    }
  }
  return results
}

// ── Main ───────────────────────────────────────────────────────────

const SEARCH_SOURCES: Record<string, (kw: string) => Promise<KeywordSearchResult[]>> = {
  reddit: searchReddit,
  hackernews: searchHackerNews,
  duckduckgo: searchDuckDuckGo,
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const keyword = args['_positional']

  if (!keyword) {
    process.stderr.write('Usage: npx tsx search-keyword.ts "keyword" [--sources reddit,hackernews]\n')
    process.exit(1)
  }

  // Register twitter if key exists
  const twitterKey = process.env.TWITTER_API_KEY
  if (twitterKey && twitterKey !== 'your_twitter_api_key_here') {
    SEARCH_SOURCES['twitter'] = (kw: string) => searchTwitter(kw, twitterKey)
  }

  // Determine sources
  let sourceNames: string[]
  if (args['sources']) {
    sourceNames = args['sources'].split(',').map(s => s.trim().toLowerCase())
  } else {
    sourceNames = Object.keys(SEARCH_SOURCES)
  }

  const validSources = sourceNames.filter(s => {
    if (SEARCH_SOURCES[s]) return true
    process.stderr.write(`[warning] Unknown search source: ${s} (available: ${Object.keys(SEARCH_SOURCES).join(', ')})\n`)
    return false
  })

  // Search all sources in parallel
  const allResults = await Promise.allSettled(
    validSources.map(name => SEARCH_SOURCES[name](keyword)),
  )

  const results: KeywordSearchResult[] = []
  for (let i = 0; i < allResults.length; i++) {
    const r = allResults[i]
    if (r.status === 'fulfilled') {
      results.push(...r.value)
    } else {
      process.stderr.write(`[${validSources[i]}] Search error: ${r.reason}\n`)
    }
  }

  const output: SearchOutput = {
    keyword,
    searchedAt: new Date().toISOString(),
    totalResults: results.length,
    results,
  }

  process.stdout.write(JSON.stringify(output, null, 2) + '\n')
}

main().catch(err => {
  process.stderr.write(`Fatal error: ${err?.message || err}\n`)
  process.exit(1)
})
