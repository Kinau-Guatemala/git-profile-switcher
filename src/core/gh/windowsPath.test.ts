import { describe, it, expect } from 'vitest'
import { hasPathEntry, prependPathEntry, removePathEntry, expandWinEnv, writePathScript, readPathScript, encodePs, runPsForOutput } from './windowsPath'

const DIR = 'C:\\Users\\u\\AppData\\Local\\git-profile-switcher\\bin'

describe('PATH entries', () => {
  it('prepends once, case- and trailing-slash-insensitively', () => {
    const raw = `C:\\Windows;c:\\users\\u\\appdata\\local\\git-profile-switcher\\bin\\;%USERPROFILE%\\bin`
    expect(prependPathEntry(raw, DIR)).toBe(`${DIR};C:\\Windows;%USERPROFILE%\\bin`)
  })

  it('removes only our entry and keeps unexpanded variables', () => {
    expect(removePathEntry(`${DIR};%USERPROFILE%\\bin;;`, DIR)).toBe('%USERPROFILE%\\bin')
  })

  it('matches entries written with variables', () => {
    const env = { ProgramFiles: 'C:\\Program Files' }
    expect(expandWinEnv('%PROGRAMFILES%\\GitHub CLI', env)).toBe('C:\\Program Files\\GitHub CLI')
    expect(hasPathEntry('%ProgramFiles%\\GitHub CLI\\', 'C:\\Program Files\\GitHub CLI', env)).toBe(true)
  })
})

describe('PowerShell scripts', () => {
  it('reads the raw value without expanding variables', () => {
    expect(readPathScript('User')).toContain("DoNotExpandEnvironmentNames")
    expect(readPathScript('Machine')).toContain('Session Manager\\Environment')
  })

  it('reads as UTF-8 so entries like C:\\Users\\José survive the round trip', () => {
    // Windows PowerShell writes redirected stdout in the OEM code page otherwise.
    expect(readPathScript('User')).toMatch(/^\[Console\]::OutputEncoding = \[System\.Text\.Encoding\]::UTF8; /)
  })

  it('writes ExpandString and escapes single quotes', () => {
    const s = writePathScript('User', "C:\\it's;D:\\x")
    expect(s).toContain("'C:\\it''s;D:\\x'")
    expect(s).toContain("'ExpandString'")
  })

  it('encodes as UTF-16LE base64 for -EncodedCommand', () => {
    expect(Buffer.from(encodePs('echo hi'), 'base64').toString('utf16le')).toBe('echo hi')
  })
})

describe.skipIf(process.platform !== 'win32')('PowerShell output encoding (Windows)', () => {
  it('returns non-ASCII text intact through the same prefix the PATH read uses', async () => {
    expect(await runPsForOutput("'C:\\Users\\José\\bin'")).toBe('C:\\Users\\José\\bin')
  })
})
