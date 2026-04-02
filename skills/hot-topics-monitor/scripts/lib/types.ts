export interface TrendData {
  title: string
  url?: string
  source: string
  score: number
  extra?: string        // JSON-serialized metadata
  externalId: string    // Unique per source
  publishedAt?: Date
}

export interface SourceResult {
  source: string
  items: TrendData[]
  count: number
  error: string | null
}

export interface FetchOutput {
  fetchedAt: string
  sources: string[]
  totalItems: number
  results: SourceResult[]
}

export interface KeywordSearchResult {
  title: string
  url?: string
  source: string
  score: number
  snippet?: string
  extra?: string
}

export interface SearchOutput {
  keyword: string
  searchedAt: string
  totalResults: number
  results: KeywordSearchResult[]
}
