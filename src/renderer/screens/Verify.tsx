import { useState, useEffect } from 'react'
import { VerifyResult } from '../../core/verify/types'
import OriginTable from '../components/OriginTable'

export default function Verify() {
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadVerify()
  }, [])

  const loadVerify = async () => {
    try {
      const data = await window.api.verify.global()
      setResult(data)
    } catch (error) {
      console.error('Failed to verify:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="loading-screen">LOADING...</div>

  return (
    <div>
      <h1 className="page-title">▸ VERIFY GIT CONFIG</h1>

      {result && (
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
        <button className="btn btn--primary" onClick={loadVerify}>
          ↻ Refresh
        </button>
      </div>
    </div>
  )
}
