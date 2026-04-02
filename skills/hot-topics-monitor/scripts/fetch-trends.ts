import type { TrendData, SourceResult, FetchOutput } from './lib/types'
import { parseArgs } from './lib/utils'

import { fetchGoogleTrends } from './lib/sources/google'
import { fetchReddit } from './lib/sources/reddit'
import { fetchHackerNews } from './lib/sources/hackernews'
import { fetchDuckDuckGo } from './lib/sources/duckduckgo'
import { fetchGitHub } from './lib/sources/github'
import { fetchHuggingFace } from './lib/sources/huggingface'
import { fetchV2EX } from './lib/sources/v2ex'
import { fetchBingNews } from './lib/sources/bingnews'
import { fetchBilibili } from './lib/sources/bilibili'
import { fetchTwitter } from './lib/sources/twitter'

// Source registry: name → fetch function (or factory for key-dependent sources)
const SOURCE_REGISTRY: Record<string, () => Promise<TrendData[]>> = {
  google: fetchGoogleTrends,
  reddit: fetchReddit,
  hackernews: fetchHackerNews,
  duckduckgo: fetchDuckDuckGo,
  github: fetchGitHub,
  huggingface: fetchHuggingFace,
  v2ex: fetchV2EX,
  bingnews: fetchBingNews,
  bilibili: fetchBilibili,
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const limit = parseInt(args['limit'] || '0') || 0

  // Determine which sources to fetch
  let sourceNames: string[]
  if (args['sources']) {
    sourceNames = args['sources'].split(',').map(s => s.trim().toLowerCase())
  } else {
    sourceNames = Object.keys(SOURCE_REGISTRY)
    // Add twitter if API key is available
    sourceNames.push('twitter')
  }

  // Register twitter dynamically if requested and key exists
  const twitterKey = process.env.TWITTER_API_KEY
  if (sourceNames.includes('twitter')) {
    if (twitterKey && twitterKey !== 'your_twitter_api_key_here') {
      SOURCE_REGISTRY['twitter'] = () => fetchTwitter(twitterKey)
    } else {
      process.stderr.write('[twitter] Skipped: TWITTER_API_KEY not set\n')
      sourceNames = sourceNames.filter(s => s !== 'twitter')
    }
  }

  // Validate source names
  const validSources = sourceNames.filter(s => {
    if (SOURCE_REGISTRY[s]) return true
    process.stderr.write(`[warning] Unknown source: ${s}\n`)
    return false
  })

  // Fetch all sources in parallel
  const results: SourceResult[] = await Promise.all(
    validSources.map(async (name) => {
      try {
        let items = await SOURCE_REGISTRY[name]()
        if (limit > 0) items = items.slice(0, limit)
        return { source: name, items, count: items.length, error: null }
      } catch (err: any) {
        process.stderr.write(`[${name}] Error: ${err?.message || err}\n`)
        return { source: name, items: [], count: 0, error: err?.message || String(err) }
      }
    }),
  )

  const totalItems = results.reduce((sum, r) => sum + r.count, 0)

  const output: FetchOutput = {
    fetchedAt: new Date().toISOString(),
    sources: validSources,
    totalItems,
    results,
  }

  process.stdout.write(JSON.stringify(output, null, 2) + '\n')
}

main().catch(err => {
  process.stderr.write(`Fatal error: ${err?.message || err}\n`)
  process.exit(1)
})
