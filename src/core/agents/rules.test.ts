import { describe, it, expect } from 'vitest'
import { execa } from 'execa'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  CLAUDE_DENY, addClaudeRule, removeClaudeRule, hasClaudeRule,
  OPENCODE_KEY, addOpencodeRule, removeOpencodeRule, UnsupportedConfig,
  addCursorHook, removeCursorHook, hasCursorHook, guardCommand,
  codexRules, geminiPolicy, copilotHooks, GUARD_SH, GUARD_PS1
} from './rules'

describe('Claude Code', () => {
  it('adds the deny once and keeps the user rules', () => {
    const user = { model: 'opus', permissions: { allow: ['Bash(ls)'], deny: ['Bash(rm:*)'] } }
    const once = addClaudeRule(user)
    expect(addClaudeRule(once)).toEqual(once)
    expect(once.permissions.deny).toEqual(['Bash(rm:*)', CLAUDE_DENY])
    expect(removeClaudeRule(once)).toEqual(user)
    expect(hasClaudeRule(once)).toBe(true)
  })

  it('refuses a deny that is not a list', () => {
    expect(() => addClaudeRule({ permissions: { deny: 'x' } })).toThrow(UnsupportedConfig)
  })
})

describe('OpenCode', () => {
  it('keeps a string catch-all and puts our rule last', () => {
    const out = addOpencodeRule({ permission: { bash: 'ask', edit: 'allow' } })
    expect(out.permission.bash).toEqual({ '*': 'ask', [OPENCODE_KEY]: 'deny' })
    expect(Object.keys(out.permission.bash)).toEqual(['*', OPENCODE_KEY])
    expect(out.permission.edit).toBe('allow')
  })

  it('moves our rule to the end when re-applied after user rules', () => {
    const out = addOpencodeRule({ permission: { bash: { [OPENCODE_KEY]: 'deny', '*': 'ask' } } })
    expect(Object.keys(out.permission.bash)).toEqual(['*', OPENCODE_KEY])
  })

  it('removes only our rule', () => {
    expect(removeOpencodeRule(addOpencodeRule({ permission: { bash: { 'git *': 'allow' } } })).permission.bash).toEqual({ 'git *': 'allow' })
  })

  it('refuses a single global permission action', () => {
    expect(() => addOpencodeRule({ permission: 'ask' })).toThrow(UnsupportedConfig)
  })
})

describe('Cursor', () => {
  it('appends the guard hook next to foreign hooks, once', () => {
    const cfg = { version: 1, hooks: { beforeShellExecution: [{ command: './audit.sh' }], afterFileEdit: [{ command: 'x' }] } }
    const cmd = guardCommand('/home/u/.config/Git Profile Switcher/agent-hooks', 'linux', 'cursor')
    const once = addCursorHook(cfg, cmd)
    expect(addCursorHook(once, cmd)).toEqual(once)
    expect(once.hooks.beforeShellExecution).toEqual([{ command: './audit.sh' }, { command: cmd }])
    expect(hasCursorHook(once)).toBe(true)
    expect(removeCursorHook(once)).toEqual(cfg)
  })

  it('quotes hook paths with spaces', () => {
    expect(guardCommand('/a b/hooks', 'linux', 'cursor')).toBe("sh '/a b/hooks/gh-auth-switch-guard.sh' cursor")
    expect(guardCommand('C:\\a b\\hooks', 'win32', 'copilot'))
      .toBe('powershell -NoProfile -ExecutionPolicy Bypass -File "C:\\a b\\hooks\\gh-auth-switch-guard.ps1" copilot')
  })
})

describe('own files', () => {
  it('generates the Codex, Gemini and Copilot contents', () => {
    expect(codexRules()).toContain('pattern = ["gh", "auth", "switch"]')
    expect(codexRules()).toContain('decision = "forbidden"')
    expect(geminiPolicy()).toContain('commandPrefix = "gh auth switch"')
    expect(geminiPolicy()).toContain('decision = "deny"')
    const copilot = JSON.parse(copilotHooks('sh x copilot', 'linux'))
    expect(copilot).toEqual({ version: 1, hooks: { preToolUse: [{ type: 'command', bash: 'sh x copilot', timeoutSec: 10 }] } })
    expect(JSON.parse(copilotHooks('ps x', 'win32')).hooks.preToolUse[0].powershell).toBe('ps x')
  })
})

describe.skipIf(process.platform === 'win32')('guard script (sh)', () => {
  async function run(dialect: string, stdin: string) {
    const dir = await mkdtemp(join(tmpdir(), 'gps-guard-'))
    try {
      const script = join(dir, 'guard.sh')
      await writeFile(script, GUARD_SH)
      return (await execa('sh', [script, dialect], { input: stdin })).stdout
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  }

  it('denies gh auth switch anywhere in the command, for Cursor', async () => {
    const out = JSON.parse(await run('cursor', JSON.stringify({ command: 'bash -c "gh  auth switch --user x"' })))
    expect(out.permission).toBe('deny')
  })

  it('allows other commands for Cursor and stays silent for Copilot', async () => {
    expect(JSON.parse(await run('cursor', JSON.stringify({ command: 'gh pr list' })))).toEqual({ continue: true, permission: 'allow' })
    expect(await run('copilot', JSON.stringify({ toolName: 'bash', toolArgs: { command: 'gh pr list' } }))).toBe('')
  })

  it('uses the Copilot deny shape', async () => {
    const out = JSON.parse(await run('copilot', JSON.stringify({ toolName: 'bash', toolArgs: '{"command":"gh auth switch"}' })))
    expect(out.permissionDecision).toBe('deny')
    expect(out.permissionDecisionReason).toMatch(/blocked/)
  })
})

const hasPwsh = await execa('pwsh', ['-v']).then(() => true, () => false)

describe.skipIf(!hasPwsh)('guard script (PowerShell)', () => {
  it('denies for Copilot and allows for Cursor', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'gps-guard-'))
    try {
      const script = join(dir, 'guard.ps1')
      await writeFile(script, GUARD_PS1)
      const deny = await execa('pwsh', ['-NoProfile', '-File', script, 'copilot'], { input: '{"toolArgs":{"command":"gh auth switch"}}' })
      expect(JSON.parse(deny.stdout).permissionDecision).toBe('deny')
      const allow = await execa('pwsh', ['-NoProfile', '-File', script, 'cursor'], { input: '{"command":"gh pr list"}' })
      expect(JSON.parse(allow.stdout).permission).toBe('allow')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
