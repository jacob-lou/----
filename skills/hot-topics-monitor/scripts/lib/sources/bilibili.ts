import type { TrendData } from '../types'
import { UA_BROWSER, fetchWithTimeout } from '../utils'

export async function fetchBilibili(): Promise<TrendData[]> {
  const items: TrendData[] = []
  await fetchHotSearch(items)
  await fetchTechRanking(items)
  return items
}

async function fetchHotSearch(items: TrendData[]): Promise<void> {
  try {
    const resp = await fetchWithTimeout(
      'https://app.bilibili.com/x/v2/search/trending/ranking',
      { headers: { 'User-Agent': UA_BROWSER } },
    )
    if (!resp.ok) return
    const json = (await resp.json()) as any
    const list = json?.data?.list
    if (!Array.isArray(list)) return

    for (const item of list) {
      const keyword = item.keyword || item.show_name
      if (!keyword) continue
      items.push({
        title: item.show_name || keyword,
        url: `https://search.bilibili.com/all?keyword=${encodeURIComponent(keyword)}`,
        source: 'bilibili',
        score: item.position ? (100 - item.position) * 100 : 0,
        externalId: `bili-hot-${keyword}`,
        extra: JSON.stringify({
          type: 'hot_search',
          position: item.position,
          icon: item.icon,
        }),
      })
    }
  } catch { /* skip */ }
}

async function fetchTechRanking(items: TrendData[]): Promise<void> {
  try {
    const resp = await fetchWithTimeout(
      'https://api.bilibili.com/x/web-interface/ranking/v2?rid=188&type=all',
      { headers: { 'User-Agent': UA_BROWSER } },
    )
    if (!resp.ok) return
    const json = (await resp.json()) as any
    const list = json?.data?.list
    if (!Array.isArray(list)) return

    for (const item of list.slice(0, 30)) {
      const title = item.title
      if (!title) continue
      const stat = item.stat || {}
      const bvid = item.bvid || ''

      items.push({
        title,
        url: bvid ? `https://www.bilibili.com/video/${bvid}` : undefined,
        source: 'bilibili',
        score: stat.view || 0,
        externalId: `bili-tech-${bvid || title}`,
        publishedAt: item.pubdate ? new Date(item.pubdate * 1000) : undefined,
        extra: JSON.stringify({
          type: 'tech_video',
          views: stat.view,
          likes: stat.like,
          coins: stat.coin,
          danmaku: stat.danmaku,
          author: item.owner?.name,
          duration: item.duration,
        }),
      })
    }
  } catch { /* skip */ }
}
