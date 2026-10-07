import { describe, it, expect, afterEach } from 'vitest'
import { mkdtemp, mkdir, readFile, rm, writeFile, stat, lstat, chmod, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { agentStatuses, applyAgentRule, removeAgentRule, assertAgentId, AgentEnv } from './agents'
import { CLAUDE_DENY } from './rules'

let home: string
afterEach(async () => { if (home) await rm(home, { recursive: true, force: true }) })

async function setup(): Promise<AgentEnv> {
  home = await mkdtemp(join(tmpdir(), 'gps-agents-'))
  return { home, platform: 'linux', hookDir: join(home, 'Git Profile Switcher', 'agent-hooks') }
}

const exists = (p: string) => stat(p).then(() => true, () => false)

describe('agents', () => {
  it('detects agents by their config dir', async () => {
    const env = await setup()
    await mkdir(join(home, '.claude'))
    const s = await agentStatuses(env)
    expect(s.find(a => a.id === 'claude')!.detected).toBe(true)
    expect(s.find(a => a.id === 'codex')!.detected).toBe(false)
  })

  it('merges into Claude settings, idempotently, and removes cleanly', async () => {
    const env = await setup()
    const file = join(home, '.claude', 'settings.json')
    await mkdir(join(home, '.claude'))
    const original = { theme: 'dark', permissions: { deny: ['Bash(rm:*)'] } }
    await writeFile(file, JSON.stringify(original))

    await applyAgentRule('claude', env)
    await applyAgentRule('claude', env)
    const after = JSON.parse(await readFile(file, 'utf-8'))
    expect(after.permissions.deny).toEqual(['Bash(rm:*)', CLAUDE_DENY])
    expect(after.theme).toBe('dark')
    expect((await agentStatuses(env)).find(a => a.id === 'claude')!.blocked).toBe(true)

    await removeAgentRule('claude', env)
    expect(JSON.parse(await readFile(file, 'utf-8'))).toEqual(original)
  })

  it('never writes an OpenCode config with comments and offers a snippet', async () => {
    const env = await setup()
    const dir = join(home, '.config', 'opencode')
    await mkdir(dir, { recursive: true })
    const file = join(dir, 'opencode.jsonc')
    const text = '{\n  // mine\n  "model": "x"\n}\n'
    await writeFile(file, text)

    const status = (await agentStatuses(env)).find(a => a.id === 'opencode')!
    expect(status.file).toBe(file)
    expect(status.manualSnippet).toContain('gh auth switch*')
    await expect(applyAgentRule('opencode', env)).rejects.toThrow(/by hand/)
    expect(await readFile(file, 'utf-8')).toBe(text)
  })

  it('writes the Cursor hook and its guard script', async () => {
    const env = await setup()
    await mkdir(join(home, '.cursor'))
    await applyAgentRule('cursor', env)
    const hooks = JSON.parse(await readFile(join(home, '.cursor', 'hooks.json'), 'utf-8'))
    expect(hooks.version).toBe(1)
    // Exact quoting is pinned in rules.test.ts; here only that the hook points at our script.
    expect(hooks.hooks.beforeShellExecution[0].command).toContain('gh-auth-switch-guard.sh')
    expect(await exists(join(env.hookDir, 'gh-auth-switch-guard.sh'))).toBe(true)
  })

  it('creates and deletes own files for Codex, Gemini and Copilot', async () => {
    const env = await setup()
    for (const id of ['codex', 'gemini', 'copilot'] as const) {
      await applyAgentRule(id, env)
      const { file, blocked } = (await agentStatuses(env)).find(a => a.id === id)!
      expect(blocked).toBe(true)
      await removeAgentRule(id, env)
      expect(await exists(file)).toBe(false)
    }
  })

  it.skipIf(process.platform === 'win32')('edits a symlinked settings file in place and keeps its permissions', async () => {
    const env = await setup()
    const dotfiles = join(home, 'dotfiles')
    await mkdir(dotfiles)
    const real = join(dotfiles, 'claude-settings.json')
    await writeFile(real, JSON.stringify({ env: { SECRET: 'x' } }))
    await chmod(real, 0o600)
    await mkdir(join(home, '.claude'))
    const link = join(home, '.claude', 'settings.json')
    await symlink(real, link)

    await applyAgentRule('claude', env)

    expect((await lstat(link)).isSymbolicLink()).toBe(true)
    expect((await stat(real)).mode & 0o777).toBe(0o600)
    expect(JSON.parse(await readFile(real, 'utf-8')).permissions.deny).toContain(CLAUDE_DENY)
  })

  it('rejects unknown agent ids', () => {
    expect(() => assertAgentId('vim')).toThrow()
  })
})
