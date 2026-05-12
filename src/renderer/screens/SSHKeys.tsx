import { useState, useEffect, useCallback, type FormEvent } from 'react'

type TestStatus = 'idle' | 'testing' | 'ok' | 'fail'

interface SSHHost {
    host: string
    hostName: string
    identityFile?: string
    comment?: string
}

interface TestResult {
    success: boolean
    message: string
}

interface GeneratedKey {
    host: string
    privateKeyPath: string
    publicKeyPath: string
    publicKey: string
}

interface HostRowProps {
    readonly host: SSHHost
    readonly onTest: (h: string) => Promise<TestResult>
}

/* ── Existing host row ─────────────────────────────────────── */
function HostRow({ host, onTest }: HostRowProps) {
    const [status, setStatus] = useState<TestStatus>('idle')
    const [message, setMessage] = useState('')

    const test = async () => {
        setStatus('testing')
        setMessage('')
        const result = await onTest(host.host)
        setStatus(result.success ? 'ok' : 'fail')
        setMessage(result.message)
    }

    return (
        <div className="ssh-host-card">
            <div className="ssh-host-card__info">
                <span className="ssh-host-card__name">{host.host}</span>
                {host.comment && <span className="ssh-host-card__comment">{host.comment}</span>}
                {host.identityFile && (
                    <span className="ssh-host-card__path">{host.identityFile}</span>
                )}
            </div>
            <div className="ssh-host-card__actions">
                <button
                    className="btn btn--ghost btn--sm"
                    onClick={test}
                    disabled={status === 'testing'}
                >
                    {status === 'testing' ? '...' : '▶ Test'}
                </button>
                {status !== 'idle' && status !== 'testing' && (
                    <span className={`ssh-test-badge ssh-test-badge--${status}`}>
                        {status === 'ok' ? '✓ OK' : '✕ FAIL'}
                    </span>
                )}
            </div>
            {message && status !== 'idle' && (
                <p className={`ssh-test-msg ssh-test-msg--${status}`}>{message}</p>
            )}
        </div>
    )
}

/* ── Main screen ─────────────────────────────────────────────── */
export default function SSHKeys() {
    const [email, setEmail] = useState('')
    const [accountName, setAccountName] = useState('')
    const [passphrase, setPassphrase] = useState('')
    const [generating, setGenerating] = useState(false)
    const [generated, setGenerated] = useState<GeneratedKey | null>(null)
    const [copied, setCopied] = useState(false)
    const [newKeyTest, setNewKeyTest] = useState<{ status: TestStatus; message: string }>({
        status: 'idle',
        message: '',
    })
    const [hosts, setHosts] = useState<SSHHost[]>([])
    const [loadingHosts, setLoadingHosts] = useState(true)

    const loadHosts = useCallback(async () => {
        setLoadingHosts(true)
        try {
            const list = await globalThis.api.ssh.listHosts()
            setHosts(list)
        } catch {
            setHosts([])
        } finally {
            setLoadingHosts(false)
        }
    }, [])

    useEffect(() => { loadHosts() }, [loadHosts])

    /* ── Generate ──────────────────────────────────────────────── */
    const handleGenerate = async (e: FormEvent) => {
        e.preventDefault()
        if (!email || !accountName) return
        setGenerating(true)
        setGenerated(null)
        setNewKeyTest({ status: 'idle', message: '' })
        try {
            const result = await globalThis.api.ssh.generate(email, accountName, passphrase)
            await globalThis.api.ssh.addToConfig(
                result.host,
                result.privateKeyPath,
                `${accountName} GitHub account`
            )
            setGenerated(result)
            await loadHosts()
        } catch (error: any) {
            alert(`Failed to generate SSH key:\n${error.message}`)
        } finally {
            setGenerating(false)
        }
    }

    /* ── Copy public key ───────────────────────────────────────── */
    const handleCopy = async () => {
        if (!generated) return
        try {
            await navigator.clipboard.writeText(generated.publicKey)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch {
            alert('Failed to copy public key to clipboard.')
        }
    }

    /* ── Test new key ──────────────────────────────────────────── */
    const handleTestNew = async () => {
        if (!generated) return
        setNewKeyTest({ status: 'testing', message: '' })
        const result = await globalThis.api.ssh.test(generated.host)
        setNewKeyTest({ status: result.success ? 'ok' : 'fail', message: result.message })
    }

    /* ── Test any host ─────────────────────────────────────────── */
    const handleTestHost = async (h: string): Promise<TestResult> => {
        return globalThis.api.ssh.test(h)
    }

    /* ── Hosts list ────────────────────────────────────────────── */
    const renderHostsList = () => {
        if (loadingHosts) {
            return <p className="ssh-loading">Loading...</p>
        }
        if (hosts.length === 0) {
            return (
                <div className="empty-state">
                    <span className="empty-state__icon" aria-hidden="true">🔑</span>
                    {' '}No GitHub SSH hosts found in ~/.ssh/config
                </div>
            )
        }
        return (
            <div className="ssh-host-list">
                {hosts.map(h => (
                    <HostRow key={h.host} host={h} onTest={handleTestHost} />
                ))}
            </div>
        )
    }

    return (
        <div>
            <h1 className="page-title">▸ SSH KEYS</h1>

            {/* ── Generate new key ─────────────────────────────────── */}
            <div className="pixel-card pixel-card--highlight mb-md">
                <h2 className="section-title">◈ Generate New SSH Key</h2>
                <form onSubmit={handleGenerate}>
                    <div className="form-group">
                        <label htmlFor="ssh-account-name" className="form-label">Account Name *</label>
                        <input
                            id="ssh-account-name"
                            type="text"
                            value={accountName}
                            onChange={e => setAccountName(e.target.value)}
                            placeholder="e.g., personal or work"
                            required
                            className="form-input"
                        />
                        <p className="form-hint">
                            Used for the key filename and SSH host alias (github.com-&lt;name&gt;)
                        </p>
                    </div>

                    <div className="form-group">
                        <label htmlFor="ssh-email" className="form-label">GitHub Email *</label>
                        <input
                            id="ssh-email"
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            required
                            className="form-input"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="ssh-passphrase" className="form-label">Passphrase (optional)</label>
                        <input
                            id="ssh-passphrase"
                            type="password"
                            value={passphrase}
                            onChange={e => setPassphrase(e.target.value)}
                            placeholder="Leave blank for no passphrase"
                            autoComplete="new-password"
                            className="form-input"
                        />
                        <p className="form-hint">
                            Recommended if you want the private key encrypted. Leave it blank only if you accept an unprotected key on disk.
                        </p>
                    </div>

                    <div className="btn-row">
                        <button type="submit" disabled={generating} className="btn btn--primary">
                            {generating ? 'Generating...' : '🔑 Generate Key'}
                        </button>
                    </div>
                </form>

                {generated && (
                    <div className="ssh-generated-box">
                        <div className="pixel-divider" />
                        <div className="ssh-generated-meta">
                            <p className="pixel-card__info"><strong>Host alias:</strong> {generated.host}</p>
                            <p className="pixel-card__info"><strong>Private key:</strong> {generated.privateKeyPath}</p>
                            <p className="pixel-card__info"><strong>Public key:</strong> {generated.publicKeyPath}</p>
                        </div>

                        <label htmlFor="ssh-pubkey" className="form-label mt-md">
                            Public Key — Add this to GitHub
                        </label>
                        <div className="pubkey-box">
                            <textarea
                                id="ssh-pubkey"
                                title="Generated SSH public key"
                                value={generated.publicKey}
                                readOnly
                                onClick={e => e.currentTarget.select()}
                                className="form-textarea"
                            />
                            <div className="btn-row mt-md">
                                <button className="btn btn--info btn--sm" onClick={handleCopy}>
                                    {copied ? '✓ Copied!' : '📋 Copy Key'}
                                </button>
                                <button
                                    type="button"
                                    className="btn btn--ghost btn--sm"
                                    onClick={() => globalThis.api.shell.openExternal('https://github.com/settings/ssh/new')}
                                >
                                    → Open GitHub SSH Settings
                                </button>
                            </div>
                        </div>

                        <div className="ssh-verify-row">
                            <button
                                className="btn btn--success btn--sm"
                                onClick={handleTestNew}
                                disabled={newKeyTest.status === 'testing'}
                            >
                                {newKeyTest.status === 'testing' ? 'Testing...' : '▶ Verify Connection'}
                            </button>
                            {newKeyTest.status !== 'idle' && newKeyTest.status !== 'testing' && (
                                <span className={`ssh-test-badge ssh-test-badge--${newKeyTest.status}`}>
                                    {newKeyTest.status === 'ok' ? '✓ Authenticated' : '✕ Failed'}
                                </span>
                            )}
                        </div>
                        {newKeyTest.message && newKeyTest.status !== 'idle' && (
                            <p className={`ssh-test-msg ssh-test-msg--${newKeyTest.status}`}>
                                {newKeyTest.message}
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* ── Existing SSH hosts ───────────────────────────────── */}
            <div className="pixel-card mb-md">
                <div className="detected-box__header">
                    <h2 className="section-title">◈ Existing GitHub SSH Hosts</h2>
                    <button className="btn btn--ghost btn--sm" onClick={loadHosts}>↺ Refresh</button>
                </div>
                {renderHostsList()}
            </div>
        </div>
    )
}

