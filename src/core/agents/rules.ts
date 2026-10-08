import { posix, win32 } from 'node:path'
import { shQuote } from '../gh/wrapper'

type Json = Record<string, any>
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)

/** The agent config has a shape we won't rewrite automatically. */
export class UnsupportedConfig extends Error {}

export const GUARD_BASENAME = 'gh-auth-switch-guard'
export const GUARD_MESSAGE =
  'gh auth switch is blocked by Git Profile Switcher: gh already uses the account linked to this folder. Do not change the global gh account.'

// Hook scripts get the agent's JSON payload on stdin (still JSON-escaped) and
// block *running* gh auth switch: gh at the start of a command — after a quote,
// ; & | ( ` $( or an escaped newline — optionally with a path or .exe. So
// `bash -c "gh auth switch"` is caught, but a commit message or a doc edit that
// merely mentions it is not. Copilot's preToolUse fires for every tool, so only
// its shell tools are checked. Exactly one JSON object (or nothing) on stdout.
// String.raw keeps the regex backslashes literal; BT stands in for a backtick.
const BT = '`'

export const GUARD_SH = String.raw`#!/bin/sh
# Managed by Git Profile Switcher. Usage: ${GUARD_BASENAME}.sh cursor|copilot
input=$(cat)
msg='${GUARD_MESSAGE}'
if [ "$1" = copilot ] && ! printf '%s' "$input" | grep -Eq '"toolName"[[:space:]]*:[[:space:]]*"(bash|powershell|shell)"'; then
  exit 0
fi
re='(^|[;&|(${BT}"'"'"']|[$][(]|\\n)[[:space:]]*([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]*[[:space:]]+)*((command|env|exec)[[:space:]]+)?([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]*[[:space:]]+)*([^[:space:]"]*[/\\])?gh(\.exe)?[[:space:]]+auth[[:space:]]+switch'
if printf '%s' "$input" | grep -Eq "$re"; then
  if [ "$1" = copilot ]; then
    printf '{"permissionDecision":"deny","permissionDecisionReason":"%s"}\n' "$msg"
  else
    printf '{"permission":"deny","user_message":"%s","agent_message":"%s"}\n' "$msg" "$msg"
  fi
  exit 0
fi
if [ "$1" = cursor ]; then printf '{"permission":"allow"}\n'; fi
exit 0
`

export const GUARD_PS1 = String.raw`# Managed by Git Profile Switcher. Usage: ${GUARD_BASENAME}.ps1 cursor|copilot
param([string]$Dialect)
$text = [Console]::In.ReadToEnd()
$msg = '${GUARD_MESSAGE}'
if ($Dialect -eq 'copilot' -and $text -notmatch '"toolName"\s*:\s*"(bash|powershell|shell)"') { exit 0 }
if ($text -match '(^|[;&|(${BT}"'']|\$\(|\\n)\s*([A-Za-z_]\w*=\S*\s+)*((command|env|exec)\s+)?([A-Za-z_]\w*=\S*\s+)*([^\s"]*[/\\])?gh(\.exe)?\s+auth\s+switch') {
  if ($Dialect -eq 'copilot') { [ordered]@{ permissionDecision = 'deny'; permissionDecisionReason = $msg } | ConvertTo-Json -Compress }
  else { [ordered]@{ permission = 'deny'; user_message = $msg; agent_message = $msg } | ConvertTo-Json -Compress }
  exit 0
}
if ($Dialect -eq 'cursor') { '{"permission":"allow"}' }
exit 0
`

export function guardCommand(hookDir: string, platform: NodeJS.Platform, dialect: 'cursor' | 'copilot'): string {
  return platform === 'win32'
    ? `powershell -NoProfile -ExecutionPolicy Bypass -File "${win32.join(hookDir, `${GUARD_BASENAME}.ps1`)}" ${dialect}`
    : `sh ${shQuote(posix.join(hookDir, `${GUARD_BASENAME}.sh`))} ${dialect}`
}

// ── Claude Code: ~/.claude/settings.json ──
export const CLAUDE_DENY = 'Bash(gh auth switch:*)'

export function hasClaudeRule(s: Json): boolean {
  return Array.isArray(s.permissions?.deny) && s.permissions.deny.includes(CLAUDE_DENY)
}

export function addClaudeRule(s: Json): Json {
  if (s.permissions !== undefined && !isObj(s.permissions)) throw new UnsupportedConfig('"permissions" is not an object')
  const deny = s.permissions?.deny ?? []
  if (!Array.isArray(deny)) throw new UnsupportedConfig('"permissions.deny" is not a list')
  if (deny.includes(CLAUDE_DENY)) return s
  return { ...s, permissions: { ...s.permissions, deny: [...deny, CLAUDE_DENY] } }
}

/** Drop `key` from `obj` when it ends up empty, so removal undoes what add created. */
function setOrDrop(obj: Json, key: string, value: unknown): Json {
  const out = { ...obj }
  const empty = Array.isArray(value) ? value.length === 0 : isObj(value) && Object.keys(value).length === 0
  if (empty) delete out[key]
  else out[key] = value
  return out
}

export function removeClaudeRule(s: Json): Json {
  if (!hasClaudeRule(s)) return s
  const deny = s.permissions.deny.filter((d: unknown) => d !== CLAUDE_DENY)
  return setOrDrop(s, 'permissions', setOrDrop(s.permissions, 'deny', deny))
}

// ── OpenCode: permission.bash, last matching rule wins ──
export const OPENCODE_KEY = 'gh auth switch*'

export function hasOpencodeRule(c: Json): boolean {
  return isObj(c.permission) && isObj(c.permission.bash) && c.permission.bash[OPENCODE_KEY] === 'deny'
}

export function addOpencodeRule(c: Json): Json {
  if (c.permission !== undefined && !isObj(c.permission)) throw new UnsupportedConfig('"permission" is a single action for every tool')
  const bash = c.permission?.bash
  let rules: Json
  if (bash === undefined) rules = {}
  else if (typeof bash === 'string') rules = { '*': bash } // keep the existing catch-all
  else if (isObj(bash)) rules = { ...bash }
  else throw new UnsupportedConfig('"permission.bash" has an unknown shape')
  delete rules[OPENCODE_KEY]
  rules[OPENCODE_KEY] = 'deny' // must stay last to win
  return { ...c, permission: { ...c.permission, bash: rules } }
}

export function removeOpencodeRule(c: Json): Json {
  if (!hasOpencodeRule(c)) return c
  const rest: Json = { ...c.permission.bash }
  delete rest[OPENCODE_KEY]
  const keys = Object.keys(rest)
  // Undo add's string → object conversion: a lone catch-all goes back to a string.
  const bash = keys.length === 1 && keys[0] === '*' ? rest['*'] : rest
  return setOrDrop(c, 'permission', setOrDrop(c.permission, 'bash', bash))
}

// ── Cursor: ~/.cursor/hooks.json ──
const isGuard = (h: unknown) => isObj(h) && typeof h.command === 'string' && h.command.includes(GUARD_BASENAME)

export function hasCursorHook(c: Json): boolean {
  return Array.isArray(c.hooks?.beforeShellExecution) && c.hooks.beforeShellExecution.some(isGuard)
}

// Cursor tests this against the full command before starting the hook, so the
// guard doesn't spawn (a cold PowerShell on Windows) for every other command.
const CURSOR_MATCHER = 'auth\\s+switch'

export function addCursorHook(c: Json, command: string): Json {
  if (c.hooks !== undefined && !isObj(c.hooks)) throw new UnsupportedConfig('"hooks" is not an object')
  const list = c.hooks?.beforeShellExecution ?? []
  if (!Array.isArray(list)) throw new UnsupportedConfig('"hooks.beforeShellExecution" is not a list')
  return { version: 1, ...c, hooks: { ...c.hooks, beforeShellExecution: [...list.filter(h => !isGuard(h)), { command, matcher: CURSOR_MATCHER }] } }
}

export function removeCursorHook(c: Json): Json {
  if (!hasCursorHook(c)) return c
  const list = c.hooks.beforeShellExecution.filter((h: unknown) => !isGuard(h))
  const out = setOrDrop(c, 'hooks', setOrDrop(c.hooks, 'beforeShellExecution', list))
  // A bare {version: 1} is only what addCursorHook put there.
  return Object.keys(out).length === 1 && out.version === 1 ? {} : out
}

// ── Own files ──
export function codexRules(): string {
  return `# Managed by Git Profile Switcher.
prefix_rule(
    pattern = ["gh", "auth", "switch"],
    decision = "forbidden",
    justification = "${GUARD_MESSAGE}",
)
`
}

export function geminiPolicy(): string {
  return `# Managed by Git Profile Switcher.
[[rule]]
toolName = "run_shell_command"
commandPrefix = "gh auth switch"
decision = "deny"
priority = 100
`
}

export function copilotHooks(command: string, platform: NodeJS.Platform): string {
  const entry = { type: 'command', [platform === 'win32' ? 'powershell' : 'bash']: command, timeoutSec: 10 }
  return JSON.stringify({ version: 1, hooks: { preToolUse: [entry] } }, null, 2) + '\n'
}
