const UA_BROWSER = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const UA_BOT = 'TrendTracker/1.0'

export { UA_BROWSER, UA_BOT }

/** Sleep for ms milliseconds */
export function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

/** Fetch with timeout (default 15s) */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 15000,
): Promise<Response> {
  return fetch(url, {
    ...options,
    signal: AbortSignal.timeout(timeoutMs),
  })
}

/** Parse CLI args: --key value or --flag */
export function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2)
      const next = argv[i + 1]
      if (next && !next.startsWith('--')) {
        args[key] = next
        i++
      } else {
        args[key] = 'true'
      }
    } else if (!argv[i].startsWith('-')) {
      // positional arg
      args['_positional'] = argv[i]
    }
  }
  return args
}
