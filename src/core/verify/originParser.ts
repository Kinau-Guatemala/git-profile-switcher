import { OriginEntry } from './types'

export function parseShowOrigin(output: string): OriginEntry[] {
  const lines = output.split('\n').filter(line => line.trim())
  const entries: OriginEntry[] = []

  for (const line of lines) {
    const match = line.match(/^file:(.+?)\s+(.+?)=(.*)$/)
    if (match) {
      const [, originFile, key, value] = match
      entries.push({
        originFile: originFile.trim(),
        key: key.trim(),
        value: value.trim()
      })
    }
  }

  return entries
}
