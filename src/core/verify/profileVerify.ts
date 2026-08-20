import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { rm } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { runGit } from '../git/gitRunner'
import { parseShowOrigin } from './originParser'
import { VerifyResult } from './types'
import { Profile } from '../profiles/schema'
import { applyProfile } from '../git/identity'

/**
 * Preview what `applyProfile` would write for a profile, without touching any
 * real git config. Renders into a throwaway file so the SSH-key resolution and
 * insteadOf rewrites in identity.ts run for real, then reads it back the same
 * way `--show-origin` reports actual config.
 */
export async function verifyProfile(profile: Profile, allProfiles: Profile[]): Promise<VerifyResult> {
  const previewPath = join(tmpdir(), `git-profile-switcher-preview-${randomUUID()}.gitconfig`)
  const warnings: string[] = [
    `Preview only: this is what "${profile.label}" would write if applied, not necessarily your current effective config.`
  ]

  try {
    await applyProfile(profile, previewPath, allProfiles)

    // applyProfile always writes at least user.name/user.email, so this file
    // is never actually empty — let failures surface instead of masking them.
    const originsResult = await runGit(['config', '--file', previewPath, '--list', '--show-origin'])
    const origins = parseShowOrigin(originsResult.stdout)

    return {
      effectiveName: profile.userName || null,
      effectiveEmail: profile.userEmail || null,
      origins,
      warnings
    }
  } finally {
    await rm(previewPath, { force: true })
  }
}
