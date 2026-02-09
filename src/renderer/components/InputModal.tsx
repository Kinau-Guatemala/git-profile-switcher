import { useState } from 'react'

interface Props {
  title: string
  onSubmit: (userName: string, userEmail: string) => void
  onCancel: () => void
}

export default function InputModal({ title, onSubmit, onCancel }: Props) {
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (userName && userEmail) {
      onSubmit(userName, userEmail)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <h2 className="modal-box__title">{title}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Git Username *</label>
            <input
              type="text"
              value={userName}
              onChange={e => setUserName(e.target.value)}
              required
              autoFocus
              placeholder="e.g., auyjos"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Git Email *</label>
            <input
              type="email"
              value={userEmail}
              onChange={e => setUserEmail(e.target.value)}
              required
              placeholder="e.g., your@email.com"
              className="form-input"
            />
          </div>

          <div className="btn-row justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="btn btn--ghost"
            >
              ✕ Cancel
            </button>
            <button
              type="submit"
              className="btn btn--success"
            >
              ★ Import
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
