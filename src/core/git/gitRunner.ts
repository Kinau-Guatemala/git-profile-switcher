import { execa } from 'execa'

export interface GitError {
  message: string
  stderr: string
  exitCode: number | null
}

export async function checkGitInstalled(): Promise<void> {
  try {
    await execa('git', ['--version'])
  } catch (error: any) {
    throw new Error('Git is not installed or not in PATH. Please install Git and try again.')
  }
}

export async function runGit(
  args: string[],
  opts?: { cwd?: string }
): Promise<{ stdout: string }> {
  try {
    const result = await execa('git', args, {
      cwd: opts?.cwd,
      env: process.env
    })
    return { stdout: result.stdout }
  } catch (error: any) {
    const gitError: GitError = {
      message: error.message || 'Git command failed',
      stderr: error.stderr || '',
      exitCode: error.exitCode || null
    }
    throw gitError
  }
}
