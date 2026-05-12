import { execa } from 'execa'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { writeFile, readFile, mkdir, access } from 'node:fs/promises'
import { constants } from 'node:fs'

export interface SSHKeyResult {
  privateKeyPath: string
  publicKeyPath: string
  publicKey: string
  host: string
}

function toKeyToken(value: string): string {
  return value.toLowerCase().replaceAll(/[^a-z0-9]/g, '_')
}

export async function generateSSHKey(
  email: string,
  accountName: string,
  passphrase = ''
): Promise<SSHKeyResult> {
  const home = homedir()
  const sshDir = join(home, '.ssh')
  const accountToken = toKeyToken(accountName)
  const keyName = `id_ed25519_${accountToken}`
  const privateKeyPath = join(sshDir, keyName)
  const publicKeyPath = `${privateKeyPath}.pub`

  // Ensure .ssh directory exists
  try {
    await access(sshDir, constants.F_OK)
  } catch {
    await mkdir(sshDir, { recursive: true, mode: 0o700 })
  }

  // Check if key already exists
  try {
    await access(privateKeyPath, constants.F_OK)
    throw new Error(`SSH key already exists at ${privateKeyPath}`)
  } catch (error: any) {
    if (error.message.includes('already exists')) {
      throw error
    }
    // Key doesn't exist, continue
  }

  // Generate SSH key using ssh-keygen.
  // ssh-keygen has no stdin/env channel for the passphrase, so it must be
  // passed via -N argv. execa stuffs the full argv into error.message and
  // error.stderr on failure, so any thrown error is redacted before it
  // leaves this function (and before it crosses the IPC bridge to the renderer).
  try {
    await execa('ssh-keygen', [
      '-t', 'ed25519',
      '-C', email,
      '-f', privateKeyPath,
      '-N', passphrase
    ])
  } catch (error: any) {
    let rawMessage = 'ssh-keygen failed'
    if (typeof error?.shortMessage === 'string') {
      rawMessage = error.shortMessage
    } else if (typeof error?.message === 'string') {
      rawMessage = error.message
    }
    const safeMessage = passphrase ? rawMessage.split(passphrase).join('***') : rawMessage
    throw new Error(`Failed to generate SSH key: ${safeMessage}`)
  }

  // Read the public key
  const publicKey = await readFile(publicKeyPath, 'utf-8')

  // Generate host alias
  const host = `github.com-${accountToken}`

  return {
    privateKeyPath,
    publicKeyPath,
    publicKey: publicKey.trim(),
    host
  }
}

export async function addToSSHConfig(
  host: string,
  privateKeyPath: string,
  comment: string
): Promise<void> {
  const home = homedir()
  const sshConfigPath = join(home, '.ssh', 'config')

  let existingConfig = ''
  try {
    existingConfig = await readFile(sshConfigPath, 'utf-8')
  } catch {
    // Config doesn't exist, will create
  }

  // Check if host already exists
  if (existingConfig.includes(`Host ${host}`)) {
    throw new Error(`Host ${host} already exists in SSH config`)
  }

  // Append new host configuration
  const newEntry = `
# ${comment}
Host ${host}
    HostName github.com
    User git
    IdentityFile ${privateKeyPath.replaceAll('\\', '/')}
    IdentitiesOnly yes

`

  await writeFile(sshConfigPath, existingConfig + newEntry, 'utf-8')
}

export async function testSSHConnection(host: string): Promise<{ success: boolean; message: string }> {
  try {
    const result = await execa('ssh', ['-T', '-o', 'BatchMode=yes', `git@${host}`], {
      timeout: 10000,
      reject: false
    })

    // SSH to GitHub returns exit code 1 on success with "Hi username!"
    if (result.stderr.includes('successfully authenticated')) {
      return { success: true, message: result.stderr }
    }

    return { success: false, message: result.stderr || result.stdout }
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}
