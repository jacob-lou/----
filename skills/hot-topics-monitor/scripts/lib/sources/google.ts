import * as cheerio from 'cheerio'
import type { TrendData } from '../types'
import { UA_BROWSER, fetchWithTimeout } from '../utils'

export async function fetchGoogleTrends(): Promise<TrendData[]> {
  const url = 'https://trends.google.com/trending/rss?geo=US'
  const response = await fetchWithTimeout(url, {
    headers: { 'User-Agent': UA_BROWSER },
  })

  if (!response.ok) {
    throw new Error(`Google Trends RSS failed: ${response.status}`)
  }

  const xml = await response.text()
  const $ = cheerio.load(xml, { xml: true })
  const items: TrendData[] = []

  $('item').each((_, el) => {
    const title = $(el).find('title').text().trim()
    const traffic = $(el).find('ht\\:approx_traffic, approx_traffic').text().trim()
    const pubDate = $(el).find('pubDate').text().trim()
    const score = parseInt(traffic.replace(/[^0-9]/g, '')) || 0

    const firstNewsUrl = $(el).find('ht\\:news_item_url, news_item_url').first().text().trim()
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(title)}`
    const itemUrl = firstNewsUrl || searchUrl

    const newsSource = $(el).find('ht\\:news_item_source, news_item_source').first().text().trim()
    const newsTitle = $(el).find('ht\\:news_item_title, news_item_title').first().text().trim()

    if (title) {
      items.push({
        title,
        url: itemUrl,
        source: 'google',
        score,
        externalId: `google-${title.toLowerCase().replace(/\s+/g, '-')}`,
        publishedAt: pubDate ? new Date(pubDate) : undefined,
        extra: JSON.stringify({ traffic, newsSource, newsTitle, searchUrl }),
      })
    }
  })

  return items
}
