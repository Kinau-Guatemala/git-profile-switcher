import { runGit } from '../git/gitRunner'
import { parseShowOrigin } from './originParser'
import { VerifyResult } from './types'

export async function verifyGlobal(): Promise<VerifyResult> {
  let effectiveName: string | null = null
  let effectiveEmail: string | null = null
  const warnings: string[] = []

  try {
    const nameResult = await runGit(['config', '--global', '--get', 'user.name'])
    effectiveName = nameResult.stdout.trim()
  } catch {
    warnings.push('No global user.name configured')
  }

  try {
    const emailResult = await runGit(['config', '--global', '--get', 'user.email'])
    effectiveEmail = emailResult.stdout.trim()
  } catch {
    warnings.push('No global user.email configured')
  }

  let origins = []
  try {
    const originsResult = await runGit(['config', '--global', '--list', '--show-origin'])
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
