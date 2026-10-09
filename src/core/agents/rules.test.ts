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

  it('removes what it created, leaving no empty containers', () => {
    expect(removeClaudeRule(addClaudeRule({ model: 'opus' }))).toEqual({ model: 'opus' })
    expect(removeClaudeRule(addClaudeRule({ permissions: { allow: ['Bash(ls)'] } }))).toEqual({ permissions: { allow: ['Bash(ls)'] } })
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

  it('restores the original shape on removal', () => {
    expect(removeOpencodeRule(addOpencodeRule({ model: 'x' }))).toEqual({ model: 'x' })
    expect(removeOpencodeRule(addOpencodeRule({ permission: { bash: 'ask' } }))).toEqual({ permission: { bash: 'ask' } })
    expect(removeOpencodeRule(addOpencodeRule({ permission: { edit: 'allow' } }))).toEqual({ permission: { edit: 'allow' } })
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
    // The matcher keeps Cursor from starting the guard for every other command.
    expect(once.hooks.beforeShellExecution).toEqual([{ command: './audit.sh' }, { command: cmd, matcher: 'auth\\s+switch' }])
    expect(hasCursorHook(once)).toBe(true)
    expect(removeCursorHook(once)).toEqual(cfg)
  })

  it('removes what it created, leaving no empty containers', () => {
    const cmd = guardCommand('/h', 'linux', 'cursor')
    expect(removeCursorHook(addCursorHook({}, cmd))).toEqual({})
    const user = { version: 1, hooks: { afterFileEdit: [{ command: 'x' }] } }
    expect(removeCursorHook(addCursorHook(user, cmd))).toEqual(user)
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

// [dialect, hook payload, expected]. Shared by the sh and PowerShell scripts.
type Outcome = 'deny' | 'allow' | 'silent'
const GUARD_CASES: ['cursor' | 'copilot', object, Outcome][] = [
  ['cursor', { command: 'gh auth switch --user x' }, 'deny'],
  ['cursor', { command: 'bash -c "gh  auth switch --user x"' }, 'deny'],
  ['cursor', { command: 'ls && gh auth switch' }, 'deny'],
  ['cursor', { command: '/usr/bin/gh auth switch' }, 'deny'],
  ['cursor', { command: 'gh.exe auth switch' }, 'deny'],
  ['cursor', { command: 'GH_HOST=github.com gh auth switch' }, 'deny'],
  ['cursor', { command: 'command gh auth switch' }, 'deny'],
  ['cursor', { command: 'env GH_HOST=github.com gh auth switch --user x' }, 'deny'],
  ['cursor', { command: 'gh pr list' }, 'allow'],
  // Mentioning the command is not running it.
  ['cursor', { command: 'git commit -m "block gh auth switch in agents"' }, 'allow'],
  ['copilot', { toolName: 'bash', toolArgs: { command: 'gh auth switch' } }, 'deny'],
  ['copilot', { toolName: 'bash', toolArgs: '{"command":"echo hi; gh auth switch"}' }, 'deny'],
  ['copilot', { toolName: 'powershell', toolArgs: { command: 'gh auth switch' } }, 'deny'],
  ['copilot', { toolName: 'bash', toolArgs: { command: 'gh pr list' } }, 'silent'],
  // preToolUse fires for every tool: editing docs about the command is fine.
  ['copilot', { toolName: 'edit', toolArgs: { path: 'README.md', new_str: 'gh auth switch changes it for all' } }, 'silent'],
  ['copilot', { toolName: 'create', toolArgs: { file_text: '"gh auth switch"' } }, 'silent']
]

function expectOutcome(dialect: string, stdout: string, expected: Outcome, label: string) {
  if (expected === 'silent') return expect(stdout, label).toBe('')
  const out = JSON.parse(stdout)
  if (dialect === 'copilot') {
    expect(out.permissionDecision, label).toBe('deny')
    expect(out.permissionDecisionReason, label).toMatch(/blocked/)
  } else {
    // Exactly Cursor's documented fields: an off-schema response blocks the command.
    expect(Object.keys(out).sort(), label).toEqual(
      expected === 'deny' ? ['agent_message', 'permission', 'user_message'] : ['permission']
    )
    expect(out.permission, label).toBe(expected)
  }
}

async function runGuard(script: string, content: string, cmd: (path: string, dialect: string) => [string, string[]]) {
  const dir = await mkdtemp(join(tmpdir(), 'gps-guard-'))
  try {
    const path = join(dir, script)
    await writeFile(path, content)
    for (const [dialect, payload, expected] of GUARD_CASES) {
      const [bin, args] = cmd(path, dialect)
      const { stdout } = await execa(bin, args, { input: JSON.stringify(payload) })
      expectOutcome(dialect, stdout.trim(), expected, `${dialect} ${JSON.stringify(payload)}`)
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

describe.skipIf(process.platform === 'win32')('guard script (sh)', () => {
  it('blocks running gh auth switch and nothing else', async () => {
    await runGuard('guard.sh', GUARD_SH, (p, d) => ['sh', [p, d]])
  })
})

const hasPwsh = await execa('pwsh', ['-v']).then(() => true, () => false)

describe.skipIf(!hasPwsh)('guard script (PowerShell)', () => {
  // pwsh takes a second or more to start on Linux runners; one start per case.
  it('blocks running gh auth switch and nothing else', async () => {
    await runGuard('guard.ps1', GUARD_PS1, (p, d) => ['pwsh', ['-NoProfile', '-File', p, d]])
  }, 120_000)
})
