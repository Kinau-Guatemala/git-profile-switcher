import { writeFile } from 'node:fs/promises'
import { execa } from 'execa'
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
 * `git@<alias>:` URL prefixes (across all known profiles, including this one)
 * that should be normalized back to the bare host. Rewriting every alias to the
 * same plain host means the *forced key* (core.sshCommand) decides auth, and —
 * crucially — every managed file rewrites to the **same** target, so the global
 * and per-folder configs never produce conflicting `insteadOf` entries.
 */
export function aliasRewriteSources(bareHost: string, profiles: Profile[]): string[] {
  const sources = new Set<string>()
  for (const p of profiles) {
    const host = p.advanced?.sshHost
    if (host && host !== bareHost) sources.add(`git@${host}:`)
  }
  return [...sources].sort()
}

/** Resolve the private key path behind an SSH host alias via `ssh -G`. */
async function resolveIdentityFile(alias: string): Promise<string | null> {
  try {
    const { stdout } = await execa('ssh', ['-G', alias])
    const line = stdout.split('\n').find(l => /^identityfile /i.test(l))
    if (line) return line.replace(/^identityfile /i, '').trim()
  } catch {
    // ssh unavailable or alias unknown — fall back to no enforcement.
  }
  return null
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

    const sshHost = profile.advanced.sshHost
    if (sshHost) {
      await runGit(['config', '--file', managedPath, 'github.sshHost', sshHost])
    }

    // Pick the key for this profile (explicit override, else resolved from the alias).
    const keyPath = profile.advanced.sshKeyPath
      ?? (sshHost ? await resolveIdentityFile(sshHost) : null)

    if (keyPath) {
      // Force this profile's key. core.sshCommand is single-valued, so a later
      // (per-folder) include deterministically overrides the global one — unlike
      // url.insteadOf, whose ties are broken by first-seen, not include order.
      await runGit([
        'config', '--file', managedPath, 'core.sshCommand',
        `ssh -i ${keyPath} -o IdentitiesOnly=yes`
      ])

      // Normalize any GitHub host alias back to the plain host so the forced key
      // (not the alias's own IdentityFile) decides auth. Same target in every
      // managed file ⇒ no insteadOf conflict between global and folder configs.
      if (sshHost) {
        const bareHost = bareHostFromAlias(sshHost)
        const target = `url.git@${bareHost}:.insteadOf`
        for (const src of aliasRewriteSources(bareHost, [profile, ...allProfiles])) {
          await runGit(['config', '--file', managedPath, '--add', target, src])
        }
      }
    }
  }
}
