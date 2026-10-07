import { chmod, lstat, mkdir, readFile, realpath, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import * as r from './rules'

export type AgentId = 'claude' | 'codex' | 'cursor' | 'copilot' | 'gemini' | 'opencode'
export const AGENT_IDS: AgentId[] = ['claude', 'codex', 'cursor', 'copilot', 'gemini', 'opencode']

export interface AgentEnv { home: string; platform: NodeJS.Platform; hookDir: string }

export interface AgentStatus {
  id: AgentId
  name: string
  detected: boolean
  blocked: boolean
  file: string
  /** Set when the config can't be edited automatically: what to paste by hand. */
  manualSnippet: string | null
}

type Json = Record<string, any>
type JsonAgent = { kind: 'json'; name: string; dir: string; file: string; has(c: Json): boolean; add(c: Json): Json; remove(c: Json): Json }
type OwnFileAgent = { kind: 'own'; name: string; dir: string; file: string; content(): string }
type Agent = JsonAgent | OwnFileAgent

export function assertAgentId(id: string): AgentId {
  if (!AGENT_IDS.includes(id as AgentId)) throw new Error(`Unknown agent: ${id}`)
  return id as AgentId
}

const exists = (p: string) => stat(p).then(() => true, () => false)

async function resolveAgent(id: AgentId, env: AgentEnv): Promise<Agent> {
  const h = env.home
  switch (id) {
    case 'claude':
      return { kind: 'json', name: 'Claude Code', dir: join(h, '.claude'), file: join(h, '.claude', 'settings.json'),
        has: r.hasClaudeRule, add: r.addClaudeRule, remove: r.removeClaudeRule }
    case 'codex':
      return { kind: 'own', name: 'Codex', dir: join(h, '.codex'), file: join(h, '.codex', 'rules', 'git-profile-switcher.rules'),
        content: r.codexRules }
    case 'cursor': {
      const command = r.guardCommand(env.hookDir, env.platform, 'cursor')
      return { kind: 'json', name: 'Cursor', dir: join(h, '.cursor'), file: join(h, '.cursor', 'hooks.json'),
        has: r.hasCursorHook, add: c => r.addCursorHook(c, command), remove: r.removeCursorHook }
    }
    case 'copilot': {
      const command = r.guardCommand(env.hookDir, env.platform, 'copilot')
      return { kind: 'own', name: 'GitHub Copilot CLI', dir: join(h, '.copilot'), file: join(h, '.copilot', 'hooks', 'git-profile-switcher.json'),
        content: () => r.copilotHooks(command, env.platform) }
    }
    case 'gemini':
      return { kind: 'own', name: 'Gemini CLI', dir: join(h, '.gemini'), file: join(h, '.gemini', 'policies', 'git-profile-switcher.toml'),
        content: r.geminiPolicy }
    case 'opencode': {
      const dir = join(h, '.config', 'opencode')
      const json = join(dir, 'opencode.json')
      const jsonc = join(dir, 'opencode.jsonc')
      const file = !(await exists(json)) && (await exists(jsonc)) ? jsonc : json
      return { kind: 'json', name: 'OpenCode', dir, file,
        has: r.hasOpencodeRule, add: r.addOpencodeRule, remove: r.removeOpencodeRule }
    }
  }
}

type ReadResult = { kind: 'missing' } | { kind: 'ok'; value: Json; text: string } | { kind: 'invalid' }

async function readJson(file: string): Promise<ReadResult> {
  let text: string
  try {
    text = await readFile(file, 'utf-8')
  } catch (e: any) {
    if (e.code === 'ENOENT') return { kind: 'missing' }
    throw e
  }
  try {
    const value = JSON.parse(text)
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? { kind: 'ok', value, text } : { kind: 'invalid' }
  } catch {
    return { kind: 'invalid' }
  }
}

async function writeAtomic(file: string, text: string): Promise<void> {
  // Write through symlinks (dotfile managers link these configs) and keep the
  // original mode (Claude settings can hold secrets and be 0600).
  const target = await realpath(file).catch(() => file)
  await mkdir(dirname(target), { recursive: true })
  const mode = await stat(target).then(s => s.mode & 0o777, () => undefined)
  const tmp = `${target}.gps-tmp`
  await writeFile(tmp, text, 'utf-8')
  if (mode !== undefined) await chmod(tmp, mode)
  await rename(tmp, target)
}

const snippet = (a: JsonAgent) => JSON.stringify(a.add({}), null, 2)

function byHand(a: JsonAgent, why: string): Error {
  return new Error(`${a.name}: ${a.file} can't be edited automatically (${why}). Add this by hand:\n${snippet(a)}`)
}

async function writeGuardScripts(hookDir: string): Promise<void> {
  await mkdir(hookDir, { recursive: true })
  const sh = join(hookDir, `${r.GUARD_BASENAME}.sh`)
  await writeFile(sh, r.GUARD_SH, 'utf-8')
  await chmod(sh, 0o755)
  await writeFile(join(hookDir, `${r.GUARD_BASENAME}.ps1`), r.GUARD_PS1, 'utf-8')
}

export async function agentStatuses(env: AgentEnv): Promise<AgentStatus[]> {
  return Promise.all(AGENT_IDS.map(async id => {
    const a = await resolveAgent(id, env)
    const detected = await exists(a.dir)
    if (a.kind === 'own') {
      return { id, name: a.name, detected, blocked: await exists(a.file), file: a.file, manualSnippet: null }
    }
    const j = await readJson(a.file)
    return {
      id, name: a.name, detected, file: a.file,
      blocked: j.kind === 'ok' && a.has(j.value),
      manualSnippet: j.kind === 'invalid' ? snippet(a) : null
    }
  }))
}

export async function applyAgentRule(id: AgentId, env: AgentEnv): Promise<void> {
  const a = await resolveAgent(id, env)
  if (id === 'cursor' || id === 'copilot') await writeGuardScripts(env.hookDir)
  if (a.kind === 'own') return writeAtomic(a.file, a.content())

  const j = await readJson(a.file)
  if (j.kind === 'invalid') throw byHand(a, 'it is not plain JSON')
  let next: Json
  try {
    next = a.add(j.kind === 'ok' ? j.value : {})
  } catch (e) {
    if (e instanceof r.UnsupportedConfig) throw byHand(a, e.message)
    throw e
  }
  await writeAtomic(a.file, serialize(next, j.kind === 'ok' ? j.text : null))
}

export async function removeAgentRule(id: AgentId, env: AgentEnv): Promise<void> {
  const a = await resolveAgent(id, env)
  if (a.kind === 'own') return rm(a.file, { force: true })
  const j = await readJson(a.file)
  if (j.kind !== 'ok' || !a.has(j.value)) return
  const next = a.remove(j.value)
  // Nothing left but what we added: the file was ours. A symlink (dotfiles)
  // stays and gets `{}` instead, so the user's link isn't broken.
  const isLink = await lstat(a.file).then(s => s.isSymbolicLink(), () => false)
  if (Object.keys(next).length === 0 && !isLink) return rm(a.file, { force: true })
  await writeAtomic(a.file, serialize(next, j.text))
}

/** JSON in the file's own indentation and trailing newline (2 spaces + newline for new files). */
function serialize(value: Json, original: string | null): string {
  const indent = original?.match(/^([ \t]+)"/m)?.[1] ?? 2
  const newline = original === null || original.endsWith('\n') ? '\n' : ''
  return JSON.stringify(value, null, indent) + newline
}
