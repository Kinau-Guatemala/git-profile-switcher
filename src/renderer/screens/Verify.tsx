import { useState, useEffect, useCallback } from 'react'
import { VerifyResult } from '../../core/verify/types'
import { Profile } from '../../core/profiles/schema'
import OriginTable from '../components/OriginTable'

const GLOBAL_OPTION = '__global__'

export default function Verify() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [selected, setSelected] = useState(GLOBAL_OPTION)
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [loading, setLoading] = useState(true)

  const loadVerify = useCallback(async (target: string) => {
    setLoading(true)
    try {
      const data = target === GLOBAL_OPTION
        ? await window.api.verify.global()
        : await window.api.verify.profile(target)
      setResult(data)
    } catch (error) {
      console.error('Failed to verify:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    window.api.profiles.list()
      .then(setProfiles)
      .catch(error => console.error('Failed to load profiles:', error))
    loadVerify(GLOBAL_OPTION)
  }, [loadVerify])

  const handleSelect = (value: string) => {
    setSelected(value)
    loadVerify(value)
  }

  return (
    <div>
      <h1 className="page-title">▸ VERIFY GIT CONFIG</h1>

      <div className="form-group">
        <label htmlFor="verify-target" className="form-label">Checking</label>
        <select
          id="verify-target"
          className="form-input"
          value={selected}
          onChange={e => handleSelect(e.target.value)}
        >
          <option value={GLOBAL_OPTION}>◆ Active / Global (what git actually uses now)</option>
          {profiles.map(profile => (
            <option key={profile.id} value={profile.id}>◇ {profile.label} (preview)</option>
          ))}
        </select>
        <p className="form-hint">
          "Active / Global" reads your real, currently effective git config. Any other profile is a
          preview of what applying it would write — it does not change your current setup.
        </p>
      </div>

      {loading ? (
        <div className="loading-screen">LOADING...</div>
      ) : result && (
        <>
          <div className="pixel-card pixel-card--highlight mb-md">
            <h2 className="section-title">◈ Effective Configuration</h2>
            <p className="pixel-card__info"><strong>Name:</strong> {result.effectiveName || 'Not set'}</p>
            <p className="pixel-card__info"><strong>Email:</strong> {result.effectiveEmail || 'Not set'}</p>
          </div>

          {result.warnings.length > 0 && (
            <div className="alert alert--warn">
              <h3 className="section-title">⚠ Warnings</h3>
              <ul>
                {result.warnings.map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          <OriginTable origins={result.origins} />
        </>
      )}

      <div className="mt-lg">
        <button className="btn btn--primary" onClick={() => loadVerify(selected)}>
          ↻ Refresh
        </button>
      </div>
    </div>
  )
}
