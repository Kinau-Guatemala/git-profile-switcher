import { runGit } from '../git/gitRunner'
import { parseShowOrigin } from './originParser'
import { VerifyResult, OriginEntry } from './types'

export async function verifyGlobal(): Promise<VerifyResult> {
  let effectiveName: string | null = null
  let effectiveEmail: string | null = null
  const warnings: string[] = []

  // Get EFFECTIVE config (not just global, but what Git actually uses)
  try {
    const nameResult = await runGit(['config', '--get', 'user.name'])
    effectiveName = nameResult.stdout.trim()
  } catch {
    warnings.push('No user.name configured')
  }

  try {
    const emailResult = await runGit(['config', '--get', 'user.email'])
    effectiveEmail = emailResult.stdout.trim()
  } catch {
    warnings.push('No user.email configured')
  }

  let origins: OriginEntry[] = []
  try {
    // Use --list without --global to get ALL config sources
    const originsResult = await runGit(['config', '--list', '--show-origin'])
    const allOrigins = parseShowOrigin(originsResult.stdout)
    
    // Filter to relevant keys
    origins = allOrigins.filter(
      entry => entry.key.startsWith('user.') || 
               entry.key.startsWith('commit.gpgsign') ||
               entry.key.startsWith('github.') ||
               entry.key.startsWith('core.sshCommand')
    )
    
    // If managed file exists, highlight it
    // '.gitconfig-switcher' is the pre-1.1.0 name: a config upgraded from 1.0.0
    // still points there until the next profile switch rewrites the include.
    const managedFileEntries = origins.filter(
      o => o.originFile.includes('.git-profile-switcher') ||
           o.originFile.includes('.gitconfig-switcher')
    )
    if (managedFileEntries.length === 0) {
      warnings.push('Managed config file not being used - include may not be set up correctly')
    }
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
