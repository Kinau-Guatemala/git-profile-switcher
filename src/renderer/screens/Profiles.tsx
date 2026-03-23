import { useState, useEffect } from 'react'
import { Profile, ProfileInput } from '../../core/profiles/schema'
import { DetectedProfile } from '../../preload/index'
import ProfileForm from '../components/ProfileForm'
import InputModal from '../components/InputModal'
import { GIT_HOSTING_DOMAINS } from '../../core/constants'

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

        // Parse the content directly
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
    let hostComment: string | null = null
    let identityFile: string | null = null
    let hostName: string | null = null

    const saveCurrentHost = () => {
      if (currentHost && identityFile && hostName && GIT_HOSTING_DOMAINS.has(hostName.toLowerCase())) {
        profiles.push({
          sshHost: currentHost,
          comment: hostComment || `Git account (${currentHost})`,
          sshCommand: `ssh -F ~/.ssh/config`
        })
      }
    }

    for (const line of lines) {
      const trimmed = line.trim()

      if (trimmed === '' || trimmed.startsWith('#')) {
        if (trimmed.startsWith('#')) {
          currentComment = trimmed.substring(1).trim()
        }
        continue
      }

      const hostMatch = /^Host\s+(\S+)$/i.exec(trimmed)
      if (hostMatch && hostMatch[1] !== '*') {
        saveCurrentHost()
        currentHost = hostMatch[1]
        hostComment = currentComment
        identityFile = null
        hostName = null
        currentComment = null
        continue
      }

      const hostNameMatch = /^HostName\s+(.+)$/i.exec(trimmed)
      if (hostNameMatch && currentHost) {
        hostName = hostNameMatch[1].trim()
        continue
      }

      const identityMatch = /^IdentityFile\s+(.+)$/i.exec(trimmed)
      if (identityMatch && currentHost) {
        identityFile = identityMatch[1].trim()
        continue
      }

      currentComment = null
    }

    saveCurrentHost()
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

  if (loading) return <div className="loading-screen">LOADING...</div>

  return (
    <div>
      <h1 className="page-title">▸ GIT CONFIG PROFILES</h1>

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

      <div className="btn-row">
        <button
          className={`btn ${showForm ? 'btn--ghost' : 'btn--primary'}`}
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? '✕ Cancel' : '+ Add Profile'}
        </button>
        <button
          className="btn btn--success"
          onClick={handleImportSSHConfig}
        >
          ↑ Import SSH
        </button>
        <button
          className="btn btn--info"
          onClick={handleDetectProfiles}
        >
          ◎ Auto-Detect
        </button>
      </div>

      {showForm && (
        <ProfileForm
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
        />
      )}

      {showImport && (
        <div className="detected-box">
          <div className="detected-box__header">
            <h3 className="section-title m-0">◈ Detected Configs</h3>
            <button className="btn btn--ghost btn--sm" onClick={() => setShowImport(false)}>Close</button>
          </div>

          {detectedProfiles.length === 0 ? (
            <p>No configurations detected in your .gitconfig file.</p>
          ) : (
            detectedProfiles.map((detected, index) => (
              <div key={index} className="pixel-card pixel-card--detected">
                {detected.comment && (
                  <p className="pixel-card__label">{detected.comment}</p>
                )}
                <p className="pixel-card__info"><strong>Name:</strong> {detected.userName || 'Not set (will prompt)'}</p>
                <p className="pixel-card__info"><strong>Email:</strong> {detected.userEmail || 'Not set (will prompt)'}</p>
                {detected.sshHost && <p className="pixel-card__info"><strong>SSH Host:</strong> {detected.sshHost}</p>}
                {detected.signingKey && <p className="pixel-card__info"><strong>Signing Key:</strong> {detected.signingKey}</p>}
                {detected.sshCommand && <p className="pixel-card__info"><strong>SSH Cmd:</strong> {detected.sshCommand}</p>}
                <div className="mt-md">
                  <button
                    className="btn btn--success btn--sm"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleImportProfile(detected, index)
                    }}
                  >
                    ★ Import
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <div className="pixel-divider" />

      <div>
        {profiles.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state__icon">👾</span>
            No profiles yet. Create one to get started!
          </div>
        ) : (
          profiles.map(profile => (
            <div key={profile.id} className="pixel-card">
              <h3 className="pixel-card__label">{profile.label}</h3>
              <p className="pixel-card__info"><strong>Name:</strong> {profile.userName}</p>
              <p className="pixel-card__info"><strong>Email:</strong> {profile.userEmail}</p>
              {profile.advanced?.sshHost && (
                <p className="pixel-card__info"><strong>SSH Host:</strong> {profile.advanced.sshHost}</p>
              )}
              {profile.advanced?.gpgSign && (
                <p className="pixel-card__info"><strong>GPG Sign:</strong> Yes</p>
              )}
              <div className="btn-row mt-md mb-0">
                <button
                  className="btn btn--primary btn--sm"
                  onClick={() => handleApply(profile.id)}
                >
                  ▶ Apply
                </button>
                <button
                  className="btn btn--danger btn--sm"
                  onClick={() => handleDelete(profile.id)}
                >
                  ✕ Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
