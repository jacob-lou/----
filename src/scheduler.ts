import { CronJob } from 'cron'
import { CollectorService } from './services/collector'
import { AnalysisService } from './services/analysis'
import { getIO } from './socket'

let job: CronJob | null = null

export function startScheduler() {
  const collector = new CollectorService()
  const analysis = new AnalysisService()

  // Run every 30 minutes: at minute 0 and 30 of every hour
  job = CronJob.from({
    cronTime: '0 */30 * * * *',
    onTick: async () => {
      console.log(`[Scheduler] Starting collection at ${new Date().toISOString()}`)
      try {
        const results = await collector.collectAll()
        const io = getIO()

        const totalItems = results.reduce((sum, r) => sum + r.items.length, 0)
        console.log(`[Scheduler] Collection complete: ${totalItems} items from ${results.length} sources`)

        if (io) {
          const allItems = results.flatMap((r) => r.items)
          if (allItems.length > 0) {
            io.emit('new-trends', {
              items: allItems,
              timestamp: new Date().toISOString(),
            })
          }
          io.emit('fetch-status', {
            results: results.map((r) => ({
              source: r.source,
              count: r.items.length,
              error: r.error,
            })),
            timestamp: new Date().toISOString(),
          })
        }
      } catch (err) {
        console.error('[Scheduler] Collection failed:', err)
      }

      // Run AI analysis after collection
      if (analysis.isConfigured) {
        try {
          console.log('[Scheduler] Running AI analysis...')
          const result = await analysis.analyzeTrends()
          const aio = getIO()
          if (result && aio) {
            aio.emit('analysis-update', { analysis: result, timestamp: new Date().toISOString() })
          }
        } catch (err) {
          console.error('[Scheduler] AI analysis failed:', err)
        }
      }
    },
    start: true,
    runOnInit: true, // Run immediately on startup
  })

  console.log('[Scheduler] Started - collecting every 30 minutes')
}

export function stopScheduler() {
  if (job) {
    job.stop()
    job = null
    console.log('[Scheduler] Stopped')
  }
}
