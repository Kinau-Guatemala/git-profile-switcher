# GitHub CLI account per profile — design

Status: approved design, pending implementation plan
Date: 2026-10-07

## Problem

`gh` keeps one active account per host in `~/.config/gh/hosts.yml`, shared by every
process. Developers with a work and a personal GitHub account who run two coding
agents in parallel (one per account) trip over each other: one agent runs
`gh auth switch` and the other silently starts acting as the wrong account.

Git Profile Switcher already scopes identity, SSH key and signing per folder via
`includeIf gitdir`. This feature extends the same scoping to `gh`, and keeps agents
from flipping the global account.

## Goals

- Each profile can be linked to a `gh` account (github.com login).
- `gh` uses the linked account of the profile that applies to the current directory
  — per folder mapping, falling back to the global profile — with no global state
  change, so parallel sessions on different accounts never interfere.
- A new **GitHub CLI** tab manages all of this.
- Optionally block `gh auth switch` in the global settings of six coding agents:
  Claude Code, Codex, Cursor, GitHub Copilot CLI, Gemini CLI, OpenCode.
- Linux, macOS and Windows.

## Non-goals

- GitHub Enterprise hosts (github.com only).
- Git over HTTPS via `gh auth git-credential`: git invokes gh by absolute path, so
  the wrapper is bypassed. SSH, which the app already manages, is unaffected.
- Showing the gh account in the Verify tab.
- Blocking `gh auth login` / `gh auth logout`.
- Copilot inside VS Code (its hook support was not verified).

## Findings that shaped the design

- `gh` has no per-directory account setting. Per-process selection is only possible
  through `GH_TOKEN`, which takes precedence over the active account.
- `gh auth token --user <login>` returns any logged-in account's token without
  switching (verified on gh 2.102.0).
- `gh auth git-credential get` only serves the active account; for another
  `username` it returns nothing (verified), so it cannot drive per-folder auth.
- The app already writes one gitconfig per profile and wires it in with
  `includeIf gitdir` (`src/core/git/folderConfigs.ts`), plus the global
  `~/.git-profile-switcher`. Any key written there resolves per directory through
  plain `git config --get`.

## 1. Data

- `ProfileAdvancedSchema` gains `ghUser?: string` (a github.com login).
- `applyProfile` (`src/core/git/identity.ts`) writes `profileswitcher.ghUser = <login>`
  when set. Because `syncManagedGitconfig` calls `applyProfile` for both the global
  managed file and every per-folder file, `git config --get profileswitcher.ghUser`
  yields the right login for any directory with no further wiring.
- Changing a link is a normal profile update followed by `syncManagedGitconfig`.

## 2. Wrapper

A `gh` shim placed ahead of the real binary on `PATH`. Behaviour (POSIX version):

```sh
#!/bin/sh
# Managed by Git Profile Switcher — do not edit.
REAL_GH='<absolute path of the real gh, baked at install>'
if [ -z "$GH_TOKEN$GITHUB_TOKEN" ] && [ "$1" != auth ]; then
  u=$(git config --get profileswitcher.ghUser 2>/dev/null)
  [ -n "$u" ] && GH_TOKEN=$("$REAL_GH" auth token --user "$u" 2>/dev/null) && export GH_TOKEN
fi
exec "$REAL_GH" "$@"
```

Rules:

- A token already present in the environment always wins.
- `gh auth …` passes through untouched: with `GH_TOKEN` set, `auth switch`/`login`
  refuse to run.
- No linked account, or token lookup fails → plain passthrough (today's behaviour).
- The real gh path is baked at install. On startup the app checks it still exists;
  if not, the tab shows the wrapper as broken with a reinstall action.
- Install refuses to bake a path that is itself the wrapper.

## 3. Install locations and PATH

| OS | Files | PATH handling |
|---|---|---|
| Linux | `~/.local/bin/gh` | Usually already ahead of `/usr/bin`. Not modified. |
| macOS | `~/.local/bin/gh` | Not on PATH by default. The app shows the exact line to add for the user's shell. Not modified automatically. |
| Windows | `%LOCALAPPDATA%\git-profile-switcher\bin\gh.cmd` (cmd/PowerShell) and `…\bin\gh` (sh, for Git Bash, which agents use) | The app prepends the dir to the **user** PATH (`HKCU\Environment`). If the real gh lives on the **system** PATH (winget/MSI default), the user PATH loses; the tab then offers a button that prepends the dir to the system PATH through a UAC-elevated PowerShell. |

After install the app resolves `gh` (`which` / `where`) and reports whether it hits
the wrapper. A mismatch is shown in red with the fix.

Uninstall removes the wrapper files and the PATH entries the app added (user PATH;
system PATH again via UAC if the app added it there).

## 4. GitHub CLI tab

New route `/gh` with nav link `♦ GitHub CLI`, always visible.

```text
♦ GitHub CLI

gh 2.102.0 · 2 accounts on github.com
Wrapper: ● installed at ~/.local/bin/gh   [Remove]

PROFILE       GH ACCOUNT
Personal      [diegoauyon            ▾]
Work          [diegoauyon-styleseat  ▾]
OSS           [— none —              ▾]

AGENTS                          [Apply to all detected]
Claude Code   detected · blocked      [Remove]
Codex         detected · not blocked  [Apply]
Cursor        not detected
...
```

- gh missing → explains that gh is not installed; everything else disabled.
- Only one account → explains the feature needs two or more; wrapper install and
  agent rules disabled, mapping table read-only.
- Accounts come from `gh auth status --json hosts` (github.com entries).
- The minimum gh version that supports both `gh auth status --json` and
  `gh auth token --user` is to be confirmed in the plan; older gh shows an upgrade
  notice.

New IPC (main → core): `gh:status`, `gh:setProfileAccount`, `gh:installWrapper`,
`gh:removeWrapper`, `gh:elevateSystemPath` (Windows only), `agents:status`,
`agents:apply`, `agents:remove`.

## 5. Agent rules — block `gh auth switch`

Applied to each agent's **global** config. "Detected" = its config dir exists.

| Agent | File | Rule |
|---|---|---|
| Claude Code | `~/.claude/settings.json` | add `"Bash(gh auth switch:*)"` to `permissions.deny` |
| Codex | `~/.codex/rules/git-profile-switcher.rules` (own file) | `prefix_rule(pattern=["gh","auth","switch"], decision="forbidden", justification="…")` |
| Gemini CLI | `~/.gemini/policies/git-profile-switcher.toml` (own file) | `[[rule]] toolName="run_shell_command" commandPrefix="gh auth switch" decision="deny" priority=100` |
| OpenCode | `~/.config/opencode/opencode.json` | `permission.bash["gh auth switch*"] = "deny"`, inserted last (last match wins) |
| Cursor (IDE + CLI) | `~/.cursor/hooks.json` + hook script | `beforeShellExecution` hook → `{"permission":"deny","agentMessage":"…"}` |
| Copilot CLI | `~/.copilot/hooks/git-profile-switcher.json` (own file) + hook script | `preToolUse` hook → `{"permissionDecision":"deny","permissionDecisionReason":"…"}` |

Why hooks for Cursor and Copilot: Cursor's `cli-config.json` matches only the first
token (`Shell(gh)` would block all of gh), and Copilot CLI does not persist deny
rules (`--deny-tool` is per session).

Hook scripts live in the app's userData dir: `sh` on Linux/macOS, PowerShell on
Windows. They read stdin, search the whole command for
`gh\s+auth\s+switch`, and print the deny JSON; anything else gets allow/no output.

File-safety rules:

- Own files (Codex, Gemini, Copilot): created and deleted whole.
- Shared JSON (Claude, OpenCode, Cursor `hooks.json`): parse, add/remove only our
  entry, write back preserving every other key. Removal deletes only our entry.
- Unparseable JSON (e.g. `opencode.jsonc` with comments) → never written; the tab
  shows the snippet to paste manually.
- Write atomically (temp file + rename).

Known limit: this is a guardrail against accidental switches, not a security
boundary. Prefix-based rules (Claude, Codex, Gemini, OpenCode) are bypassed by
`bash -c "gh auth switch"` or an absolute gh path; the hook-based ones are not.

## 6. Testing

- Vitest:
  - `applyProfile` writes/omits `profileswitcher.ghUser`.
  - Wrapper text generation per OS, including path quoting.
  - gh status parsing with mocked `gh auth status --json` output.
  - Merge/unmerge for every agent format over a temp home dir: idempotent apply,
    clean removal, untouched foreign keys, refusal on unparseable JSON.
  - Hook scripts with sample stdin payloads (deny for `gh auth switch`, also inside
    `bash -c`; allow otherwise).
- Integration (Linux): run the sh wrapper against a fake `gh` that echoes its env,
  inside a temp repo with and without the key.
- `codex execpolicy check` against the generated rule when `codex` is available.
- CI currently tests only on `ubuntu-latest`; add `windows-latest` and `macos-latest`
  to the test job so the `.cmd` wrapper, PowerShell hook and PATH logic are
  exercised.
- Manual: Windows system-PATH elevation flow and macOS PATH notice.

## References

- Codex rules: https://developers.openai.com/codex/rules
- Gemini CLI policy engine: https://geminicli.com/docs/reference/policy-engine/
- OpenCode permissions: https://opencode.ai/docs/permissions/
- Cursor CLI permissions: https://cursor.com/docs/cli/reference/permissions
- Cursor hooks: https://blog.gitbutler.com/cursor-hooks-deep-dive
- Copilot CLI tools: https://docs.github.com/en/copilot/how-tos/copilot-cli/use-copilot-cli/allowing-tools
- Copilot hooks: https://docs.github.com/en/copilot/reference/hooks-reference
