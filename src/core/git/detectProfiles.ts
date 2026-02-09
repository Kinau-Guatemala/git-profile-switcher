import { runGit } from './gitRunner'
import { homedir } from 'os'
import { readFile } from 'fs/promises'
import { join } from 'path'

export interface DetectedProfile {
  userName?: string
  userEmail?: string
  signingKey?: string
  sshCommand?: string
  sshHost?: string
  comment?: string
}

export async function detectExistingProfiles(): Promise<DetectedProfile[]> {
  const profiles: DetectedProfile[] = []

  // Get global config
  try {
    const globalProfile = await getGlobalProfile()
    if (globalProfile.userName || globalProfile.userEmail) {
      profiles.push(globalProfile)
    }
  } catch (error) {
    console.error('Failed to read global config:', error)
  }

  // Try to parse conditional includes from .gitconfig
  try {
    const conditionalProfiles = await parseConditionalIncludes()
    profiles.push(...conditionalProfiles)
  } catch (error) {
    console.error('Failed to parse conditional includes:', error)
  }

  // Parse SSH config for GitHub accounts
  try {
    const sshProfiles = await parseSSHConfigForGitHub()
    profiles.push(...sshProfiles)
  } catch (error) {
    console.error('Failed to parse SSH config:', error)
  }

  return profiles
}

async function getGlobalProfile(): Promise<DetectedProfile> {
  const profile: DetectedProfile = {}

  try {
    const nameResult = await runGit(['config', '--global', '--get', 'user.name'])
    profile.userName = nameResult.stdout.trim()
  } catch { }

  try {
    const emailResult = await runGit(['config', '--global', '--get', 'user.email'])
    profile.userEmail = emailResult.stdout.trim()
  } catch { }

  try {
    const keyResult = await runGit(['config', '--global', '--get', 'user.signingkey'])
    profile.signingKey = keyResult.stdout.trim()
  } catch { }

  try {
    const sshResult = await runGit(['config', '--global', '--get', 'core.sshCommand'])
    profile.sshCommand = sshResult.stdout.trim()
  } catch { }

  return profile
}

async function parseConditionalIncludes(): Promise<DetectedProfile[]> {
  const profiles: DetectedProfile[] = []
  const home = homedir()
  const gitconfigPath = join(home, '.gitconfig')

  try {
    const content = await readFile(gitconfigPath, 'utf-8')
    const lines = content.split('\n')

    let inIncludeIf = false
    let inInclude = false

    for (const line of lines) {
      const sectionMatch = line.match(/^\s*\[([^\]]+)\]\s*$/)
      if (sectionMatch) {
        const section = sectionMatch[1].trim()
        inIncludeIf = section.startsWith('includeIf ')
        inInclude = section === 'include'
        continue
      }

      const pathMatch = line.match(/^\s*path\s*=\s*(.+)$/)
      if (pathMatch && (inIncludeIf || inInclude)) {
        const includePath = pathMatch[1].trim().replace(/^~/, home)
        try {
          const includeContent = await readFile(includePath, 'utf-8')
          const profile = parseConfigContent(includeContent)
          if (profile.userName || profile.userEmail) {
            profiles.push(profile)
          }
        } catch { }
      }
    }
  } catch (error) {
    // .gitconfig might not exist
  }

  return profiles
}

function parseConfigContent(content: string): DetectedProfile {
  const profile: DetectedProfile = {}
  const lines = content.split('\n')

  for (const line of lines) {
    const nameMatch = line.match(/^\s*name\s*=\s*(.+)$/)
    if (nameMatch) {
      profile.userName = nameMatch[1].trim()
    }

    const emailMatch = line.match(/^\s*email\s*=\s*(.+)$/)
    if (emailMatch) {
      profile.userEmail = emailMatch[1].trim()
    }

    const keyMatch = line.match(/^\s*signingkey\s*=\s*(.+)$/)
    if (keyMatch) {
      profile.signingKey = keyMatch[1].trim()
    }

    const sshMatch = line.match(/^\s*sshCommand\s*=\s*(.+)$/)
    if (sshMatch) {
      profile.sshCommand = sshMatch[1].trim()
    }
  }

  return profile
}

async function parseSSHConfigForGitHub(): Promise<DetectedProfile[]> {
  const profiles: DetectedProfile[] = []
  const home = homedir()
  const sshConfigPath = join(home, '.ssh', 'config')

  try {
    const content = await readFile(sshConfigPath, 'utf-8')
    const lines = content.split('\n')

    let currentComment: string | null = null
    let currentHost: string | null = null
    let identityFile: string | null = null

    for (const line of lines) {
      const trimmed = line.trim()

      // Capture comments
      if (trimmed.startsWith('#')) {
        currentComment = trimmed.substring(1).trim()
        continue
      }

      // Match Host directive for GitHub
      const hostMatch = trimmed.match(/^Host\s+github\.com-(\w+)$/i)
      if (hostMatch) {
        // Save previous host if exists
        if (currentHost && identityFile) {
          profiles.push({
            sshHost: currentHost,
            comment: currentComment || `GitHub account (${currentHost})`,
            sshCommand: `ssh -F ~/.ssh/config`
          })
        }

        currentHost = `github.com-${hostMatch[1]}`
        identityFile = null
        continue
      }

      // Match IdentityFile
      const identityMatch = trimmed.match(/^IdentityFile\s+(.+)$/i)
      if (identityMatch && currentHost) {
        identityFile = identityMatch[1].trim()
        continue
      }
    }

    // Save last host
    if (currentHost && identityFile) {
      profiles.push({
        sshHost: currentHost,
        comment: currentComment || `GitHub account (${currentHost})`,
        sshCommand: `ssh -F ~/.ssh/config`
      })
    }
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      throw error
    }
  }

  return profiles
}
