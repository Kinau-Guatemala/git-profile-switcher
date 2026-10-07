import { useEffect, useState } from 'react'
import type { GhTabStatus } from '../../main/ghIpc'
import type { AgentStatus } from '../../core/agents/agents'

/** Unlinking ("none") always works; linking an account needs two or more of them. */
export function linkChoices(ready: boolean, ghUser: string | null) {
  return { selectDisabled: !ready && ghUser === null, accountsDisabled: !ready }
}

// Electron prefixes rejected invokes with "Error invoking remote method '…': Error: ".
const cleanError = (e: any) => String(e?.message ?? e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

export default function GitHubCLI() {
  const [status, setStatus] = useState<GhTabStatus | null>(null)
  const [agents, setAgents] = useState<AgentStatus[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoLinked, setAutoLinked] = useState<GhTabStatus['autoLinked']>([])

  const refresh = async () => {
    const [s, a] = await Promise.all([window.api.gh.status(), window.api.agents.status()])
    setStatus(s)
    setAgents(a)
    // Keep the notice up after later refreshes, which link nothing new.
    if (s.autoLinked.length) setAutoLinked(s.autoLinked)
  }

  useEffect(() => {
    refresh().catch(e => setError(cleanError(e)))
  }, [])

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(cleanError(e))
    } finally {
      await refresh().catch(() => {})
      setBusy(false)
    }
  }

  if (!status) {
    return (
      <div>
        <h1 className="page-title">▸ GITHUB CLI</h1>
        <p className="settings-hint">{error ?? 'Checking gh…'}</p>
      </div>
    )
  }

  const { gh, wrapper, windows } = status
  const accounts = gh.kind === 'ok' ? gh.accounts : []
  const ready = gh.kind === 'ok' && accounts.length >= 2

  return (
    <div>
      <h1 className="page-title">▸ GITHUB CLI</h1>

      {error && (
        <div className="pixel-card mb-md">
          <pre className="settings-hint" style={{ whiteSpace: 'pre-wrap' }}>✕ {error}</pre>
        </div>
      )}

      <div className="pixel-card pixel-card--highlight mb-md">
        <h2 className="section-title">◈ gh Accounts</h2>
        {gh.kind === 'missing' && (
          <p className="settings-hint">gh is not installed or not on your PATH. Install it from cli.github.com to use this tab.</p>
        )}
        {gh.kind === 'unsupported' && (
          <p className="settings-hint">gh {gh.version} is too old (no <code>gh auth status --json</code>). Upgrade gh to use this tab.</p>
        )}
        {gh.kind === 'ok' && (
          <>
            <p className="pixel-card__info">
              <strong>gh {gh.version}</strong> · {accounts.length} account{accounts.length === 1 ? '' : 's'} on github.com
            </p>
            {!ready && (
              <p className="settings-hint">
                Per-folder gh accounts need two or more logged-in accounts. Add one with <code>gh auth login</code>.
              </p>
            )}
          </>
        )}
      </div>

      <div className="pixel-card mb-md">
        <h2 className="section-title">◈ gh Wrapper</h2>
        <p className="settings-hint">
          A small <code>gh</code> placed ahead of the real one on your PATH. It runs gh as the account linked to the
          profile for the current folder, so parallel terminals and agents never fight over <code>gh auth switch</code>.
        </p>

        {wrapper.foreignFile && (
          <p className="pixel-card__info">✕ <code>{wrapper.foreignFile}</code> already exists and isn't ours. Move it to install the wrapper.</p>
        )}
        {wrapper.installed && !wrapper.realGhExists && (
          <p className="pixel-card__info">✕ The wrapper points to <code>{wrapper.realGh}</code>, which no longer exists. Reinstall it.</p>
        )}
        {wrapper.installed && wrapper.realGhExists && (
          <p className="pixel-card__info">
            {status.resolvesToWrapper ? '●' : '✕'} Installed in <code>{wrapper.dir}</code> → <code>{wrapper.realGh}</code>
            {status.resolvesToWrapper ? '' : ' — but `gh` still resolves to the real binary.'}
          </p>
        )}
        {!wrapper.installed && !wrapper.foreignFile && <p className="pixel-card__info">○ Not installed.</p>}

        {wrapper.installed && !status.resolvesToWrapper && status.pathHint && (
          <p className="settings-hint">Put <code>{wrapper.dir}</code> first on your PATH, then open a new terminal: <code>{status.pathHint}</code></p>
        )}
        {wrapper.installed && windows && windows.realGhOnMachinePath && !windows.machinePathHasDir && (
          <p className="settings-hint">
            gh is on the system PATH, which Windows searches before your user PATH. Putting the wrapper first there needs administrator rights.
          </p>
        )}

        <div className="btn-row mt-md mb-0">
          <button className="btn btn--primary btn--sm" disabled={!ready || busy || !!wrapper.foreignFile}
            onClick={() => run(() => window.api.gh.installWrapper())}>
            {wrapper.installed ? '↻ Reinstall' : '➕ Install'}
          </button>
          {windows && wrapper.installed && windows.realGhOnMachinePath && !windows.machinePathHasDir && (
            <button className="btn btn--ghost btn--sm" disabled={busy}
              onClick={() => run(() => window.api.gh.elevateSystemPath())}>
              🛡 Put first in system PATH (admin)
            </button>
          )}
          {wrapper.installed && (
            <button className="btn btn--danger btn--sm" disabled={busy}
              onClick={() => run(() => window.api.gh.removeWrapper())}>
              ✕ Remove
            </button>
          )}
        </div>
      </div>

      <div className="pixel-card mb-md">
        <h2 className="section-title">◈ Profile → gh Account</h2>
        <p className="settings-hint">
          Profiles whose label, user name or SSH alias (<code>github.com-&lt;account&gt;</code>) matches a gh account
          are linked automatically. Pick the rest by hand.
        </p>
        {autoLinked.length > 0 && (
          <p className="pixel-card__info">
            ● Linked automatically by name: {autoLinked.map(l => `${l.label} → ${l.login}`).join(', ')}
          </p>
        )}
        {status.profiles.length === 0 && <p className="settings-hint">Create a profile first.</p>}
        {status.profiles.map(p => {
          const choices = linkChoices(ready, p.ghUser)
          return (
            <div className="form-group" key={p.id}>
              <label className="form-label">{p.label}</label>
              <select className="form-input" value={p.ghUser ?? ''} disabled={choices.selectDisabled || busy}
                onChange={e => run(() => window.api.gh.setProfileAccount(p.id, e.target.value || null))}>
                <option value="">— none —</option>
                {accounts.map(a => (
                  <option key={a.login} value={a.login} disabled={choices.accountsDisabled && a.login !== p.ghUser}>{a.login}</option>
                ))}
                {p.ghUser && !accounts.some(a => a.login === p.ghUser) && (
                  <option value={p.ghUser}>{p.ghUser} (not logged in)</option>
                )}
              </select>
              {p.suggested && (
                <div className="btn-row mt-md mb-0">
                  <span className="settings-hint">Its name matches <code>{p.suggested}</code>.</span>
                  <button className="btn btn--ghost btn--sm" disabled={!ready || busy}
                    onClick={() => run(() => window.api.gh.setProfileAccount(p.id, p.suggested))}>
                    Use {p.suggested}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="pixel-card mb-md">
        <h2 className="section-title">◈ Coding Agents</h2>
        <p className="settings-hint">
          Block <code>gh auth switch</code> in each agent's global settings so an agent can't flip the account
          another session is using. A guardrail, not a security boundary.
        </p>
        {agents.map(a => (
          <div className="detected-box mt-md" key={a.id}>
            <p className="pixel-card__info">
              <strong>{a.name}</strong> · {a.detected ? 'detected' : 'not detected'}
              {a.detected && (a.blocked ? ' · ● blocked' : ' · ○ not blocked')}
            </p>
            {a.manualSnippet && (
              <>
                <p className="settings-hint"><code>{a.file}</code> isn't plain JSON, so it won't be edited. Add this by hand:</p>
                <pre className="settings-hint">{a.manualSnippet}</pre>
              </>
            )}
            {a.detected && !a.manualSnippet && (
              <div className="btn-row mb-0">
                {a.blocked
                  ? <button className="btn btn--danger btn--sm" disabled={busy} onClick={() => run(() => window.api.agents.remove(a.id))}>✕ Remove</button>
                  : <button className="btn btn--primary btn--sm" disabled={!ready || busy} onClick={() => run(() => window.api.agents.apply(a.id))}>➕ Apply</button>}
              </div>
            )}
          </div>
        ))}
        <div className="btn-row mt-md mb-0">
          <button className="btn btn--primary btn--sm" disabled={!ready || busy || !agents.some(a => a.detected && !a.blocked)}
            onClick={() => run(() => window.api.agents.apply('all'))}>
            ➕ Apply to all detected
          </button>
        </div>
      </div>
    </div>
  )
}
