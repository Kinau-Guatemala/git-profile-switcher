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
  const [sshPassphrase, setSSHPassphrase] = useState('')
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
      const result = await window.api.ssh.generate(userEmail, label, sshPassphrase)

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
    <form onSubmit={handleSubmit} className="pixel-card pixel-card--highlight mb-md">
      <div className="form-group">
        <label htmlFor="profile-label" className="form-label">Profile Label *</label>
        <input
          id="profile-label"
          type="text"
          value={label}
          onChange={e => setLabel(e.target.value)}
          required
          className="form-input"
        />
      </div>

      <div className="form-group">
        <label htmlFor="profile-user-name" className="form-label">User Name *</label>
        <input
          id="profile-user-name"
          type="text"
          value={userName}
          onChange={e => setUserName(e.target.value)}
          required
          className="form-input"
        />
      </div>

      <div className="form-group">
        <label htmlFor="profile-user-email" className="form-label">User Email *</label>
        <input
          id="profile-user-email"
          type="email"
          value={userEmail}
          onChange={e => setUserEmail(e.target.value)}
          required
          className="form-input"
        />
      </div>

      <div className="form-group">
        <button
          type="button"
          className="advanced-toggle"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          {showAdvanced ? '▼' : '▶'} ADVANCED OPTIONS
        </button>
      </div>

      {showAdvanced && (
        <div className="advanced-panel">
          <div className="form-group">
            <label htmlFor="profile-ssh-passphrase" className="form-label">SSH Key Passphrase (optional)</label>
            <input
              id="profile-ssh-passphrase"
              type="password"
              value={sshPassphrase}
              onChange={e => setSSHPassphrase(e.target.value)}
              placeholder="Leave blank for no passphrase"
              autoComplete="new-password"
              className="form-input"
            />
            <p className="form-hint">
              Recommended if you want the generated private key encrypted.
            </p>
          </div>

          <div className="form-group">
            <div className="ssh-host-row">
              <label htmlFor="profile-ssh-host" className="form-label m-0">SSH Host</label>
              <button
                type="button"
                onClick={handleGenerateSSHKey}
                disabled={generating}
                className="btn btn--info btn--sm"
              >
                {generating ? 'Generating...' : '🔑 Gen SSH Key'}
              </button>
            </div>
            <input
              id="profile-ssh-host"
              type="text"
              value={sshHost}
              onChange={e => setSSHHost(e.target.value)}
              placeholder="e.g., github.com-personal"
              className="form-input"
            />
            <p className="form-hint">Use SSH host alias from ~/.ssh/config or generate above</p>
          </div>

          {generatedKey && (
            <div className="pubkey-box">
              <label htmlFor="profile-generated-pubkey" className="form-label">📋 Public Key (Add to GitHub)</label>
              <textarea
                id="profile-generated-pubkey"
                value={generatedKey}
                readOnly
                onClick={(e) => e.currentTarget.select()}
                className="form-textarea"
              />
              <a
                href="https://github.com/settings/ssh/new"
                target="_blank"
                rel="noopener noreferrer"
              >
                → Open GitHub SSH Settings
              </a>
            </div>
          )}

          <div className="form-group">
            <label className="form-checkbox">
              <input
                type="checkbox"
                checked={gpgSign}
                onChange={e => setGpgSign(e.target.checked)}
              />
              Enable GPG Signing
            </label>
          </div>

          <div className="form-group">
            <label htmlFor="profile-signing-key" className="form-label">Signing Key (optional)</label>
            <input
              id="profile-signing-key"
              type="text"
              value={signingKey}
              onChange={e => setSigningKey(e.target.value)}
              placeholder="Leave empty if you don't use GPG"
              className="form-input"
            />
            <p className="form-hint">Only needed if you sign commits with GPG.</p>
          </div>
        </div>
      )}

      <div className="btn-row">
        <button type="submit" className="btn btn--primary">
          ✓ Save
        </button>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          ✕ Cancel
        </button>
      </div>
    </form>
  )
}
