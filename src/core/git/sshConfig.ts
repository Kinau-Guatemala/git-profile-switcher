import { homedir } from 'node:os'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { GIT_HOSTING_DOMAINS } from '../constants'

export interface SSHHost {
  host: string
  hostName: string
  identityFile?: string
  comment?: string
}

export async function parseSSHConfig(): Promise<SSHHost[]> {
  const home = homedir()
  const sshConfigPath = join(home, '.ssh', 'config')

  try {
    const content = await readFile(sshConfigPath, 'utf-8')
    return parseSSHConfigContent(content)
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return []
    }
    throw new Error(`Failed to read SSH config: ${error.message}`)
  }
}

function parseSSHConfigContent(content: string): SSHHost[] {
  const hosts: SSHHost[] = []
  const lines = content.split('\n')

  let currentHost: SSHHost | null = null
  let currentComment: string | null = null

  for (const line of lines) {
    const trimmed = line.trim()

    // Capture comments
    if (trimmed.startsWith('#')) {
      currentComment = trimmed.substring(1).trim()
      continue
    }

    // Match Host directive
    const hostMatch = trimmed.match(/^Host\s+(.+)$/i)
    if (hostMatch) {
      if (currentHost) {
        hosts.push(currentHost)
      }
      currentHost = {
        host: hostMatch[1].trim(),
        hostName: '',
        comment: currentComment || undefined
      }
      currentComment = null
      continue
    }

    if (!currentHost) continue

    // Match HostName
    const hostNameMatch = trimmed.match(/^HostName\s+(.+)$/i)
    if (hostNameMatch) {
      currentHost.hostName = hostNameMatch[1].trim()
      continue
    }

    // Match IdentityFile
    const identityMatch = trimmed.match(/^IdentityFile\s+(.+)$/i)
    if (identityMatch) {
      currentHost.identityFile = identityMatch[1].trim()
      continue
    }
  }

  if (currentHost) {
    hosts.push(currentHost)
  }

  // Filter to known git hosting platforms
  return hosts.filter(h =>
    GIT_HOSTING_DOMAINS.has(h.hostName.toLowerCase())
  )
}

export function getSSHCommandForHost(_host: string): string {
  return `ssh -F ~/.ssh/config`
}
