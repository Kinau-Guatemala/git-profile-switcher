import { execa } from 'execa'

export interface GhAccount {
  login: string
  active: boolean
}

export type GhStatus =
  | { kind: 'missing' }
  | { kind: 'unsupported'; version: string }
  | { kind: 'ok'; version: string; accounts: GhAccount[] }

export function parseGhVersion(stdout: string): string {
  return stdout.match(/gh version (\S+)/)?.[1] ?? 'unknown'
}

export function parseGhAccounts(json: string): GhAccount[] {
  const entries: unknown = JSON.parse(json)?.hosts?.['github.com']
  if (!Array.isArray(entries)) return []
  return entries
    .filter((e): e is { login: string; active?: boolean } => typeof e?.login === 'string')
    .map(e => ({ login: e.login, active: e.active === true }))
}

/**
 * `realGh` is the real binary (see findRealGh), never our wrapper: a wrapper
 * whose target vanished would otherwise report gh as missing, and in a linked
 * folder it would answer `auth status` as a single account.
 */
export async function getGhStatus(env: NodeJS.ProcessEnv, realGh: string | null): Promise<GhStatus> {
  if (!realGh) return { kind: 'missing' }
  let version: string
  try {
    version = parseGhVersion((await execa(realGh, ['--version'], { env })).stdout)
  } catch {
    return { kind: 'missing' }
  }
  try {
    const { stdout } = await execa(realGh, ['auth', 'status', '--json', 'hosts'], { env })
    return { kind: 'ok', version, accounts: parseGhAccounts(stdout) }
  } catch {
    return { kind: 'unsupported', version }
  }
}
