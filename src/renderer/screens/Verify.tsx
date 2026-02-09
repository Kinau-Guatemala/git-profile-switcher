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

  if (loading) return <div style={{ padding: '20px' }}>Loading...</div>

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Verify Git Configuration</h1>

      {result && (
        <>
          <div style={{ marginBottom: '20px' }}>
            <h2>Effective Configuration</h2>
            <p><strong>Name:</strong> {result.effectiveName || 'Not set'}</p>
            <p><strong>Email:</strong> {result.effectiveEmail || 'Not set'}</p>
          </div>

          {result.warnings.length > 0 && (
            <div style={{ marginBottom: '20px', padding: '12px', background: '#fff3cd', borderRadius: '4px' }}>
              <h3>Warnings</h3>
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

      <button
        onClick={loadVerify}
        style={{ marginTop: '20px', padding: '8px 16px' }}
      >
        Refresh
      </button>
    </div>
  )
}
