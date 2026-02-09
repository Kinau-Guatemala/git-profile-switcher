import { Profile } from '../profiles/schema'
import { runGit } from './gitRunner'

export async function applyProfile(profile: Profile, managedPath: string): Promise<void> {
  await runGit(['config', '--file', managedPath, 'user.name', profile.userName])
  await runGit(['config', '--file', managedPath, 'user.email', profile.userEmail])

  if (profile.advanced) {
    if (profile.advanced.gpgSign !== undefined) {
      await runGit(['config', '--file', managedPath, 'commit.gpgsign', String(profile.advanced.gpgSign)])
    }

    if (profile.advanced.signingKey) {
      await runGit(['config', '--file', managedPath, 'user.signingkey', profile.advanced.signingKey])
    }

    // Configure SSH host if specified (for multiple GitHub accounts)
    if (profile.advanced.sshHost) {
      const sshCommand = `ssh -F ~/.ssh/config`
      await runGit(['config', '--file', managedPath, 'core.sshCommand', sshCommand])

      // Also set the default SSH host alias
      // This is informational - users need to use the SSH host in their remote URLs
      await runGit(['config', '--file', managedPath, 'github.sshHost', profile.advanced.sshHost])
    }
  }
}
