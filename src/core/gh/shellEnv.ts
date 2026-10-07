import { execa } from 'execa'

const MARK = '__GPS_PATH__'

export function extractMarkedPath(stdout: string): string | null {
  const m = stdout.match(new RegExp(`${MARK}([\\s\\S]*?)${MARK}`))
  return m && m[1] ? m[1] : null
}

/**
 * Apps launched from the desktop (macOS launchd, some Linux sessions) don't get
 * the PATH the user's terminal has, so Homebrew's or ~/.local/bin's gh would be
 * invisible. Ask the user's login shell for its PATH. Not cached on purpose:
 * the tab re-checks after the user follows the PATH hint.
 */
export async function userShellEnv(): Promise<NodeJS.ProcessEnv> {
  if (process.platform === 'win32') return process.env
  const shell = process.env.SHELL || '/bin/sh'
  try {
    const { stdout } = await execa(shell, ['-ilc', `printf '${MARK}%s${MARK}' "$PATH"`], { timeout: 5000 })
    const path = extractMarkedPath(stdout)
    return path ? { ...process.env, PATH: path } : process.env
  } catch {
    return process.env
  }
}
