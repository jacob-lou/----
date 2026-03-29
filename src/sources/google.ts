import * as cheerio from 'cheerio'
import { TrendSource, TrendData } from './base'

export class GoogleTrendsSource implements TrendSource {
  name = 'google'

  async fetch(): Promise<TrendData[]> {
    const url = 'https://trends.google.com/trending/rss?geo=US'
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
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

      // 提取第一条新闻链接作为 URL，回退为 Google 搜索链接
      const firstNewsUrl = $(el).find('ht\\:news_item_url, news_item_url').first().text().trim()
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(title)}`
      const url = firstNewsUrl || searchUrl

      // 提取新闻来源
      const newsSource = $(el).find('ht\\:news_item_source, news_item_source').first().text().trim()
      const newsTitle = $(el).find('ht\\:news_item_title, news_item_title').first().text().trim()

      if (title) {
        items.push({
          title,
          url,
          source: this.name,
          score,
          externalId: `google-${title.toLowerCase().replace(/\s+/g, '-')}`,
          publishedAt: pubDate ? new Date(pubDate) : undefined,
          extra: JSON.stringify({ traffic, newsSource, newsTitle, searchUrl }),
        })
      }
    })

    return items
  }
}
