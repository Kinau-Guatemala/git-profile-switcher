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

export async function getGhStatus(env: NodeJS.ProcessEnv): Promise<GhStatus> {
  let version: string
  try {
    version = parseGhVersion((await execa('gh', ['--version'], { env })).stdout)
  } catch {
    return { kind: 'missing' }
  }
  try {
    // `auth` is passed through untouched by our own wrapper, so this always
    // reports gh's real logins.
    const { stdout } = await execa('gh', ['auth', 'status', '--json', 'hosts'], { env })
    return { kind: 'ok', version, accounts: parseGhAccounts(stdout) }
  } catch {
    return { kind: 'unsupported', version }
  }
}
