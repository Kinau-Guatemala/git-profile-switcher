import { runGit } from '../git/gitRunner'
import { parseShowOrigin } from './originParser'
import { VerifyResult } from './types'

export async function verifyInRepo(repoPath: string): Promise<VerifyResult> {
  let effectiveName: string | null = null
  let effectiveEmail: string | null = null
  const warnings: string[] = []

  try {
    const nameResult = await runGit(['config', '--get', 'user.name'], { cwd: repoPath })
    effectiveName = nameResult.stdout.trim()
  } catch {
    warnings.push('No user.name configured in this repo')
  }

  try {
    const emailResult = await runGit(['config', '--get', 'user.email'], { cwd: repoPath })
    effectiveEmail = emailResult.stdout.trim()
  } catch {
    warnings.push('No user.email configured in this repo')
  }

  let origins = []
  try {
    const originsResult = await runGit(['config', '--list', '--show-origin'], { cwd: repoPath })
    origins = parseShowOrigin(originsResult.stdout).filter(
      entry => entry.key.startsWith('user.') || entry.key.startsWith('commit.gpgsign')
    )
  } catch (error) {
    warnings.push('Could not read config origins')
  }

  return {
    effectiveName,
    effectiveEmail,
    origins,
    warnings
  }
}
