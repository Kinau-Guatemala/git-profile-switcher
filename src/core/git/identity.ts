import { writeFile } from 'node:fs/promises'
import { Profile } from '../profiles/schema'
import { runGit } from './gitRunner'

/**
 * Derive the real hostname behind an SSH host alias.
 *
 * The multi-account convention is "<hostname>-<label>" (e.g.
 * "github.com-work"). Git hosting domains (github.com, gitlab.com,
 * bitbucket.org, ...) contain no dashes, so the bare host is the segment
 * before the first dash. An alias with no dash is already a bare host.
 */
export function bareHostFromAlias(alias: string): string {
  const dash = alias.indexOf('-')
  return dash === -1 ? alias : alias.slice(0, dash)
}

/**
 * Build the set of `git@<host>:` URL prefixes that should be rewritten to the
 * active profile's alias so that *all* GitHub SSH traffic authenticates with the
 * active profile's key, regardless of what a repo's stored remote URL says.
 *
 * Sources are: the bare host behind the active alias (covers plain
 * `git@github.com:` remotes) plus every other profile's alias and bare host
 * (covers repos hardcoded to a sibling profile's alias). The active alias itself
 * is never rewritten onto itself.
 */
export function insteadOfSources(sshHost: string, allProfiles: Profile[]): string[] {
  const target = `git@${sshHost}:`
  const sources = new Set<string>()

  sources.add(`git@${bareHostFromAlias(sshHost)}:`)

  for (const other of allProfiles) {
    const otherHost = other.advanced?.sshHost
    if (!otherHost || otherHost === sshHost) continue
    sources.add(`git@${otherHost}:`)
    sources.add(`git@${bareHostFromAlias(otherHost)}:`)
  }

  sources.delete(target)
  return [...sources].sort()
}

export async function applyProfile(
  profile: Profile,
  managedPath: string,
  allProfiles: Profile[] = []
): Promise<void> {
  // Rewrite the managed file from scratch on every switch so stale keys or URL
  // rewrites left by a previously-active profile never linger.
  await writeFile(managedPath, '', 'utf-8')

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
      const sshHost = profile.advanced.sshHost

      await runGit(['config', '--file', managedPath, 'core.sshCommand', 'ssh -F ~/.ssh/config'])
      await runGit(['config', '--file', managedPath, 'github.sshHost', sshHost])

      // Force every GitHub SSH URL through this profile's host alias so the
      // matching key (from ~/.ssh/config) authenticates. Because the managed
      // include is loaded last, these rewrites win over any other config.
      const target = `url.git@${sshHost}:.insteadOf`
      for (const src of insteadOfSources(sshHost, allProfiles)) {
        await runGit(['config', '--file', managedPath, '--add', target, src])
      }
    }
  }
}
