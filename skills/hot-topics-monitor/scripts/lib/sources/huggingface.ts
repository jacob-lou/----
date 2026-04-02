import type { TrendData } from '../types'
import { fetchWithTimeout } from '../utils'

export async function fetchHuggingFace(): Promise<TrendData[]> {
  const items: TrendData[] = []

  // 1. Trending models
  try {
    const res = await fetchWithTimeout('https://huggingface.co/api/models?sort=trendingScore&direction=-1&limit=20')
    if (res.ok) {
      const models = (await res.json()) as any[]
      for (const model of models) {
        if (!model.id) continue
        items.push({
          title: model.id,
          url: `https://huggingface.co/${model.id}`,
          source: 'huggingface',
          score: model.trendingScore || model.likes || 0,
          externalId: `hf-model-${model.id.toLowerCase().replace(/\//g, '-')}`,
          publishedAt: model.lastModified ? new Date(model.lastModified) : undefined,
          extra: JSON.stringify({
            type: 'model',
            likes: model.likes,
            trendingScore: model.trendingScore,
            author: model.author || model.id.split('/')[0],
            pipeline: model.pipeline_tag,
            tags: (model.tags || []).slice(0, 10),
          }),
        })
      }
    }
  } catch { /* skip */ }

  // 2. Daily papers (hot ones)
  try {
    const res = await fetchWithTimeout('https://huggingface.co/api/daily_papers')
    if (res.ok) {
      const papers = (await res.json()) as any[]
      const hotPapers = papers.filter((p: any) => (p.paper?.upvotes || 0) >= 3)
      for (const p of hotPapers.slice(0, 15)) {
        const title = p.title || p.paper?.title || ''
        if (!title) continue
        items.push({
          title,
          url: `https://huggingface.co/papers/${p.paper?.id || ''}`,
          source: 'huggingface',
          score: p.paper?.upvotes || 0,
          externalId: `hf-paper-${(p.paper?.id || title).toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 80)}`,
          publishedAt: p.publishedAt ? new Date(p.publishedAt) : (p.paper?.publishedAt ? new Date(p.paper.publishedAt) : undefined),
          extra: JSON.stringify({
            type: 'paper',
            upvotes: p.paper?.upvotes,
            summary: (p.paper?.summary || '').substring(0, 300),
          }),
        })
      }
    }
  } catch { /* skip */ }

  return items
}
