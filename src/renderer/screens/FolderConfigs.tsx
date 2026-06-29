import { useEffect, useState } from 'react'
import type { Profile } from '../../core/profiles/schema'
import type { FolderMapping } from '../../core/profiles/state'

interface Suggestion {
  path: string
  suggestedProfileId?: string
}

export default function FolderConfigs() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [mappings, setMappings] = useState<FolderMapping[]>([])
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])

  // "Add folder" flow: a picked path awaiting a profile choice.
  const [pendingPath, setPendingPath] = useState<string | null>(null)
  const [pendingProfileId, setPendingProfileId] = useState('')

  const profileLabel = (id: string) =>
    profiles.find(p => p.id === id)?.label ?? '(deleted profile)'

  const reload = async () => {
    const [p, m, s] = await Promise.all([
      window.api.profiles.list(),
      window.api.folders.list(),
      window.api.folders.detectExisting()
    ])
    setProfiles(p)
    setMappings(m)
    setSuggestions(s)
  }

  useEffect(() => {
    reload().catch(err => console.error('Failed to load folder configs:', err))
  }, [])

  const handlePick = async () => {
    const path = await window.api.folders.pick()
    if (!path) return
    setPendingPath(path)
    setPendingProfileId(profiles[0]?.id ?? '')
  }

  const handleAssign = async () => {
    if (!pendingPath || !pendingProfileId) return
    try {
      await window.api.folders.add(pendingPath, pendingProfileId)
      setPendingPath(null)
      setPendingProfileId('')
      await reload()
    } catch (error: any) {
      alert(`Failed to assign folder: ${error.message}`)
    }
  }

  const handleRemove = async (path: string) => {
    try {
      await window.api.folders.remove(path)
      await reload()
    } catch (error: any) {
      alert(`Failed to remove folder: ${error.message}`)
    }
  }

  const handleImport = async (path: string, profileId: string) => {
    if (!profileId) {
      alert('Pick a profile to import this folder as.')
      return
    }
    try {
      await window.api.folders.add(path, profileId)
      await reload()
    } catch (error: any) {
      alert(`Failed to import folder: ${error.message}`)
    }
  }

  return (
    <div>
      <h1 className="page-title">▸ FOLDERS</h1>

      <div className="pixel-card pixel-card--highlight mb-md">
        <h2 className="section-title">◈ Per-Folder Profiles</h2>
        <p className="settings-hint">
          Assign a profile to a folder. Any git repo inside it uses that profile automatically,
          overriding the global default — like a local asdf version.
        </p>

        {pendingPath ? (
          <div className="detected-box mt-md">
            <p className="pixel-card__info"><strong>Folder:</strong> {pendingPath}</p>
            <div className="form-group">
              <label className="form-label">Assign profile</label>
              <select
                className="form-input"
                value={pendingProfileId}
                onChange={e => setPendingProfileId(e.target.value)}
              >
                {profiles.length === 0 && <option value="">No profiles available</option>}
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>{p.label} ({p.userEmail})</option>
                ))}
              </select>
            </div>
            <div className="btn-row mb-0">
              <button className="btn btn--primary btn--sm" onClick={handleAssign} disabled={!pendingProfileId}>
                ✓ Assign
              </button>
              <button className="btn btn--ghost btn--sm" onClick={() => setPendingPath(null)}>
                ✕ Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="btn-row mt-md mb-0">
            <button className="btn btn--primary btn--sm" onClick={handlePick}>➕ Add Folder</button>
          </div>
        )}
      </div>

      {mappings.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">📁</div>
          <p>No folder assignments yet.</p>
        </div>
      ) : (
        mappings.map(m => (
          <div className="pixel-card" key={m.path}>
            <h3 className="pixel-card__label">{m.path}</h3>
            <p className="pixel-card__info"><strong>Profile:</strong> {profileLabel(m.profileId)}</p>
            <div className="btn-row mt-md mb-0">
              <button className="btn btn--danger btn--sm" onClick={() => handleRemove(m.path)}>
                ✕ Remove
              </button>
            </div>
          </div>
        ))
      )}

      {suggestions.length > 0 && (
        <div className="pixel-card mb-md mt-lg">
          <h2 className="section-title">◈ Detected In ~/.gitconfig</h2>
          <p className="settings-hint">
            Existing <code>includeIf gitdir</code> folders the app can take over. Pick a profile and import.
          </p>
          {suggestions.map(s => (
            <ImportRow
              key={s.path}
              suggestion={s}
              profiles={profiles}
              onImport={handleImport}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ImportRow({
  suggestion,
  profiles,
  onImport
}: {
  suggestion: Suggestion
  profiles: Profile[]
  onImport: (path: string, profileId: string) => void
}) {
  const [profileId, setProfileId] = useState(suggestion.suggestedProfileId ?? '')

  return (
    <div className="detected-box mt-md">
      <p className="pixel-card__info"><strong>Folder:</strong> {suggestion.path}</p>
      <div className="form-group">
        <label className="form-label">Import as</label>
        <select className="form-input" value={profileId} onChange={e => setProfileId(e.target.value)}>
          <option value="">— choose a profile —</option>
          {profiles.map(p => (
            <option key={p.id} value={p.id}>{p.label} ({p.userEmail})</option>
          ))}
        </select>
      </div>
      <div className="btn-row mb-0">
        <button
          className="btn btn--success btn--sm"
          onClick={() => onImport(suggestion.path, profileId)}
          disabled={!profileId}
        >
          ⬇ Import
        </button>
      </div>
    </div>
  )
}
