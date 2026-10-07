import { execa } from 'execa'

export type PathScope = 'User' | 'Machine'

export function expandWinEnv(s: string, env: NodeJS.ProcessEnv = process.env): string {
  return s.replace(/%([^%]+)%/g, (whole, name: string) => {
    const key = Object.keys(env).find(k => k.toLowerCase() === name.toLowerCase())
    return key ? env[key] ?? whole : whole
  })
}

const norm = (p: string, env?: NodeJS.ProcessEnv) =>
  expandWinEnv(p.trim(), env).replace(/[\\/]+$/, '').toLowerCase()

const entries = (raw: string) => raw.split(';').filter(e => e.trim() !== '')

export function hasPathEntry(raw: string, dir: string, env?: NodeJS.ProcessEnv): boolean {
  return entries(raw).some(e => norm(e, env) === norm(dir, env))
}

export function prependPathEntry(raw: string, dir: string): string {
  return [dir, ...entries(raw).filter(e => norm(e) !== norm(dir))].join(';')
}

export function removePathEntry(raw: string, dir: string): string {
  return entries(raw).filter(e => norm(e) !== norm(dir)).join(';')
}

const KEY: Record<PathScope, string> = {
  User: "[Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Environment', WRITABLE)",
  Machine: "[Microsoft.Win32.Registry]::LocalMachine.OpenSubKey('SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment', WRITABLE)"
}

// Windows PowerShell writes redirected stdout in the OEM code page; execa
// decodes UTF-8, so C:\Users\José would come back mangled and be written back.
const UTF8_OUTPUT = '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; '

export function readPathScript(scope: PathScope): string {
  return `${UTF8_OUTPUT}${KEY[scope].replace('WRITABLE', '$false')}.GetValue('Path', '', 'DoNotExpandEnvironmentNames')`
}

export function writePathScript(scope: PathScope, value: string): string {
  return [
    `$k = ${KEY[scope].replace('WRITABLE', '$true')}`,
    `$k.SetValue('Path', '${value.replace(/'/g, "''")}', 'ExpandString')`,
    // Setting and clearing a dummy variable broadcasts WM_SETTINGCHANGE, so
    // terminals opened afterwards see the new PATH.
    `[Environment]::SetEnvironmentVariable('GPS_PATH_REFRESH', '1', '${scope}')`,
    `[Environment]::SetEnvironmentVariable('GPS_PATH_REFRESH', $null, '${scope}')`
  ].join('; ')
}

export function encodePs(script: string): string {
  return Buffer.from(script, 'utf16le').toString('base64')
}

const PS = ['-NoProfile', '-NonInteractive']

/** Runs a script whose output must survive as UTF-8 (prefixed like the PATH read). */
export async function runPsForOutput(script: string): Promise<string> {
  const body = script.startsWith(UTF8_OUTPUT) ? script : UTF8_OUTPUT + script
  const { stdout } = await execa('powershell', [...PS, '-EncodedCommand', encodePs(body)])
  return stdout.trim()
}

export async function readRegistryPath(scope: PathScope): Promise<string> {
  return runPsForOutput(readPathScript(scope))
}

export async function writeRegistryPath(scope: PathScope, value: string): Promise<void> {
  const encoded = encodePs(writePathScript(scope, value))
  if (scope === 'User') {
    await execa('powershell', [...PS, '-EncodedCommand', encoded])
    return
  }
  // The system PATH needs admin: one UAC prompt; the elevated child does the write.
  // Declining the prompt makes Start-Process fail, which rejects here.
  await execa('powershell', [...PS, '-Command',
    `Start-Process powershell -Verb RunAs -Wait -ArgumentList '-NoProfile','-NonInteractive','-EncodedCommand','${encoded}'`])
}
