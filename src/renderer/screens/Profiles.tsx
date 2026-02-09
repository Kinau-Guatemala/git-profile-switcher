import { useState, useEffect } from 'react'
import { Profile, ProfileInput } from '../../core/profiles/schema'
import { DetectedProfile } from '../../preload/index'
import ProfileForm from '../components/ProfileForm'
import InputModal from '../components/InputModal'

export default function Profiles() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showImport, setShowImport] = useState(false)
  const [detectedProfiles, setDetectedProfiles] = useState<DetectedProfile[]>([])
  const [showInputModal, setShowInputModal] = useState(false)
  const [selectedProfile, setSelectedProfile] = useState<{ detected: DetectedProfile; index: number } | null>(null)

  useEffect(() => {
    loadProfiles()
  }, [])

  const loadProfiles = async () => {
    try {
      const data = await window.api.profiles.list()
      setProfiles(data)
    } catch (error) {
      console.error('Failed to load profiles:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (input: ProfileInput) => {
    try {
      await window.api.profiles.save(input)
      await loadProfiles()
      setShowForm(false)
    } catch (error) {
      console.error('Failed to save profile:', error)
      alert('Failed to save profile')
    }
  }

  const handleDelete = async (profileId: string) => {
    if (!confirm('Are you sure you want to delete this profile?')) return

    try {
      await window.api.profiles.delete(profileId)
      await loadProfiles()
    } catch (error) {
      console.error('Failed to delete profile:', error)
      alert('Failed to delete profile')
    }
  }

  const handleApply = async (profileId: string) => {
    try {
      await window.api.profiles.apply(profileId)
      alert('Profile applied successfully!')
    } catch (error) {
      console.error('Failed to apply profile:', error)
      alert('Failed to apply profile')
    }
  }

  const handleDetectProfiles = async () => {
    try {
      const detected = await window.api.profiles.detect()
      setDetectedProfiles(detected)
      setShowImport(true)
    } catch (error) {
      console.error('Failed to detect profiles:', error)
      alert('Failed to detect existing profiles')
    }
  }

  const handleImportSSHConfig = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '*'

    input.onchange = async (e: any) => {
      const file = e.target?.files?.[0]
      if (!file) return

      try {
        const text = await file.text()
        const blob = new Blob([text], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)

        // For Electron, we need to read the actual file path
        // For now, parse the content directly
        const detected = await parseSSHConfigContent(text)
        setDetectedProfiles(detected)
        setShowImport(true)
      } catch (error) {
        console.error('Failed to import SSH config:', error)
        alert('Failed to import SSH config file')
      }
    }

    input.click()
  }

  const parseSSHConfigContent = (content: string): DetectedProfile[] => {
    const profiles: DetectedProfile[] = []
    const lines = content.split('\n')

    let currentComment: string | null = null
    let currentHost: string | null = null
    let identityFile: string | null = null

    for (const line of lines) {
      const trimmed = line.trim()

      if (trimmed.startsWith('#')) {
        currentComment = trimmed.substring(1).trim()
        continue
      }

      const hostMatch = trimmed.match(/^Host\s+github\.com-(\w+)$/i)
      if (hostMatch) {
        if (currentHost && identityFile) {
          profiles.push({
            sshHost: currentHost,
            comment: currentComment || `GitHub account (${currentHost})`,
            sshCommand: `ssh -F ~/.ssh/config`
          })
        }

        currentHost = `github.com-${hostMatch[1]}`
        identityFile = null
        continue
      }

      const identityMatch = trimmed.match(/^IdentityFile\s+(.+)$/i)
      if (identityMatch && currentHost) {
        identityFile = identityMatch[1].trim()
        continue
      }
    }

    if (currentHost && identityFile) {
      profiles.push({
        sshHost: currentHost,
        comment: currentComment || `GitHub account (${currentHost})`,
        sshCommand: `ssh -F ~/.ssh/config`
      })
    }

    return profiles
  }

  const handleImportProfile = (detected: DetectedProfile, index: number) => {
    // For SSH-only profiles (from SSH config), show modal for name and email
    if (detected.sshHost && (!detected.userName || !detected.userEmail)) {
      setSelectedProfile({ detected, index })
      setShowInputModal(true)
      return
    }

    // If we have username and email, import directly
    if (detected.userName && detected.userEmail) {
      importProfile(detected, index)
    }
  }

  const handleModalSubmit = (userName: string, userEmail: string) => {
    if (!selectedProfile) return

    const detected = { ...selectedProfile.detected, userName, userEmail }
    importProfile(detected, selectedProfile.index)
    setShowInputModal(false)
    setSelectedProfile(null)
  }

  const importProfile = async (detected: DetectedProfile, index: number) => {
    if (!detected.userName || !detected.userEmail) {
      alert('Profile must have both name and email')
      return
    }

    const input: ProfileInput = {
      label: detected.comment || `Imported Profile ${index + 1}`,
      userName: detected.userName,
      userEmail: detected.userEmail,
      advanced: (detected.signingKey || detected.sshHost) ? {
        signingKey: detected.signingKey,
        sshHost: detected.sshHost
      } : undefined
    }

    try {
      await window.api.profiles.save(input)
      await loadProfiles()
      alert('Profile imported successfully!')
    } catch (error) {
      console.error('Failed to import profile:', error)
      alert('Failed to import profile')
    }
  }

  if (loading) return <div style={{ padding: '20px' }}>Loading...</div>

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Git Config Profiles</h1>

      {showInputModal && selectedProfile && (
        <InputModal
          title={`Enter Git credentials for ${selectedProfile.detected.comment || selectedProfile.detected.sshHost}`}
          onSubmit={handleModalSubmit}
          onCancel={() => {
            setShowInputModal(false)
            setSelectedProfile(null)
          }}
        />
      )}

      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{ marginRight: '10px', padding: '8px 16px', cursor: 'pointer' }}
        >
          {showForm ? 'Cancel' : 'Add Profile'}
        </button>
        <button
          onClick={handleImportSSHConfig}
          style={{
            padding: '8px 16px',
            background: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginRight: '10px'
          }}
        >
          Import SSH Config
        </button>
        <button
          onClick={handleDetectProfiles}
          style={{
            padding: '8px 16px',
            background: '#17a2b8',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Auto-Detect Git Config
        </button>
      </div>

      {showForm && (
        <ProfileForm
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
        />
      )}

      {showImport && (
        <div style={{
          border: '2px solid #28a745',
          borderRadius: '4px',
          padding: '16px',
          marginBottom: '20px',
          background: '#f0fff4'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ margin: 0 }}>Detected Git Configurations</h3>
            <button onClick={() => setShowImport(false)} style={{ padding: '4px 12px' }}>Close</button>
          </div>

          {detectedProfiles.length === 0 ? (
            <p>No configurations detected in your .gitconfig file.</p>
          ) : (
            detectedProfiles.map((detected, index) => (
              <div
                key={index}
                style={{
                  border: '1px solid #28a745',
                  borderRadius: '4px',
                  padding: '12px',
                  marginBottom: '8px',
                  background: 'white'
                }}
              >
                {detected.comment && (
                  <p style={{ fontWeight: 'bold', color: '#28a745', marginBottom: '8px' }}>
                    {detected.comment}
                  </p>
                )}
                <p><strong>Name:</strong> {detected.userName || 'Not set (will prompt)'}</p>
                <p><strong>Email:</strong> {detected.userEmail || 'Not set (will prompt)'}</p>
                {detected.sshHost && <p><strong>SSH Host:</strong> {detected.sshHost}</p>}
                {detected.signingKey && <p><strong>Signing Key:</strong> {detected.signingKey}</p>}
                {detected.sshCommand && <p><strong>SSH Command:</strong> {detected.sshCommand}</p>}
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleImportProfile(detected, index)
                  }}
                  style={{
                    padding: '6px 16px',
                    background: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Import This Profile
                </button>
              </div>
            ))
          )}
        </div>
      )}

      <div>
        {profiles.length === 0 ? (
          <p>No profiles yet. Create one to get started!</p>
        ) : (
          profiles.map(profile => (
            <div
              key={profile.id}
              style={{
                border: '1px solid #ccc',
                borderRadius: '4px',
                padding: '12px',
                marginBottom: '12px'
              }}
            >
              <h3>{profile.label}</h3>
              <p><strong>Name:</strong> {profile.userName}</p>
              <p><strong>Email:</strong> {profile.userEmail}</p>
              {profile.advanced?.sshHost && (
                <p><strong>SSH Host:</strong> {profile.advanced.sshHost}</p>
              )}
              {profile.advanced?.gpgSign && (
                <p><strong>GPG Sign:</strong> Yes</p>
              )}
              <div style={{ marginTop: '8px' }}>
                <button
                  onClick={() => handleApply(profile.id)}
                  style={{ marginRight: '8px', padding: '4px 12px' }}
                >
                  Apply
                </button>
                <button
                  onClick={() => handleDelete(profile.id)}
                  style={{ padding: '4px 12px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px' }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
