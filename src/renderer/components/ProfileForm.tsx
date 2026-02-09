import { useState } from 'react'
import { ProfileInput } from '../../core/profiles/schema'

interface Props {
  onSave: (profile: ProfileInput) => void
  onCancel: () => void
}

export default function ProfileForm({ onSave, onCancel }: Props) {
  const [label, setLabel] = useState('')
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [gpgSign, setGpgSign] = useState(false)
  const [signingKey, setSigningKey] = useState('')
  const [sshHost, setSSHHost] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generatedKey, setGeneratedKey] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const profile: ProfileInput = {
      label,
      userName,
      userEmail,
      advanced: showAdvanced ? {
        gpgSign,
        signingKey: signingKey || undefined,
        sshHost: sshHost || undefined
      } : undefined
    }

    onSave(profile)
  }

  const handleGenerateSSHKey = async () => {
    if (!userEmail || !label) {
      alert('Please enter Profile Label and User Email first')
      return
    }

    setGenerating(true)
    try {
      const result = await window.api.ssh.generate(userEmail, label)

      // Update SSH host field
      setSSHHost(result.host)
      setGeneratedKey(result.publicKey)

      // Add to SSH config
      await window.api.ssh.addToConfig(result.host, result.privateKeyPath, `${label} GitHub account`)

      alert(
        `SSH key generated successfully!\n\n` +
        `Host: ${result.host}\n` +
        `Private Key: ${result.privateKeyPath}\n` +
        `Public Key: ${result.publicKeyPath}\n\n` +
        `The public key has been copied below. Add it to GitHub:\n` +
        `https://github.com/settings/ssh/new`
      )
    } catch (error: any) {
      alert(`Failed to generate SSH key: ${error.message}`)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        border: '1px solid #ccc',
        borderRadius: '4px',
        padding: '16px',
        marginBottom: '20px',
        background: '#f9f9f9'
      }}
    >
      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', marginBottom: '4px' }}>
          Profile Label *
        </label>
        <input
          type="text"
          value={label}
          onChange={e => setLabel(e.target.value)}
          required
          style={{ width: '100%', padding: '6px' }}
        />
      </div>

      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', marginBottom: '4px' }}>
          User Name *
        </label>
        <input
          type="text"
          value={userName}
          onChange={e => setUserName(e.target.value)}
          required
          style={{ width: '100%', padding: '6px' }}
        />
      </div>

      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', marginBottom: '4px' }}>
          User Email *
        </label>
        <input
          type="email"
          value={userEmail}
          onChange={e => setUserEmail(e.target.value)}
          required
          style={{ width: '100%', padding: '6px' }}
        />
      </div>

      <div style={{ marginBottom: '12px' }}>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          style={{ padding: '4px 8px', fontSize: '14px' }}
        >
          {showAdvanced ? '▼' : '▶'} Advanced Options
        </button>
      </div>

      {showAdvanced && (
        <div style={{ marginLeft: '20px', marginBottom: '12px' }}>
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <label style={{ fontWeight: 'bold' }}>
                SSH Host (for multiple GitHub accounts)
              </label>
              <button
                type="button"
                onClick={handleGenerateSSHKey}
                disabled={generating}
                style={{
                  padding: '4px 12px',
                  background: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: generating ? 'not-allowed' : 'pointer',
                  fontSize: '12px'
                }}
              >
                {generating ? 'Generating...' : '🔑 Generate New SSH Key'}
              </button>
            </div>
            <input
              type="text"
              value={sshHost}
              onChange={e => setSSHHost(e.target.value)}
              placeholder="e.g., github.com-personal"
              style={{ width: '100%', padding: '6px', marginBottom: '4px' }}
            />
            <small style={{ color: '#666' }}>
              Use SSH host alias from your ~/.ssh/config or generate a new SSH key above
            </small>
          </div>

          {generatedKey && (
            <div style={{
              marginBottom: '12px',
              padding: '12px',
              background: '#e7f3ff',
              borderRadius: '4px',
              border: '1px solid #007bff'
            }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
                📋 Public Key (Add this to GitHub)
              </label>
              <textarea
                value={generatedKey}
                readOnly
                onClick={(e) => e.currentTarget.select()}
                style={{
                  width: '100%',
                  padding: '8px',
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  minHeight: '80px',
                  resize: 'vertical'
                }}
              />
              <a
                href="https://github.com/settings/ssh/new"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#007bff', fontSize: '12px' }}
              >
                → Open GitHub SSH Settings
              </a>
            </div>
          )}

          <div style={{ marginBottom: '8px' }}>
            <label>
              <input
                type="checkbox"
                checked={gpgSign}
                onChange={e => setGpgSign(e.target.checked)}
              />
              {' '}Enable GPG Signing
            </label>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px' }}>
              Signing Key (optional)
            </label>
            <input
              type="text"
              value={signingKey}
              onChange={e => setSigningKey(e.target.value)}
              placeholder="Leave empty if you don't use GPG"
              style={{ width: '100%', padding: '6px', marginBottom: '4px' }}
            />
            <small style={{ color: '#666' }}>
              Only needed if you sign commits with GPG. Most users can leave this empty.
            </small>
          </div>
        </div>
      )}

      <div>
        <button
          type="submit"
          style={{ marginRight: '8px', padding: '8px 16px' }}
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{ padding: '8px 16px' }}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
