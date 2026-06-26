import { homedir } from 'node:os'
import { join } from 'node:path'
import { readFile, writeFile, access } from 'node:fs/promises'
import { constants } from 'node:fs'

export interface ManagedIncludeResult {
  managedPath: string
  gitconfigPath: string
}

export type IncludePosition = 'start' | 'end'

/**
 * Remove any `[include]` block that we own (i.e. one whose `path =` lines all
 * resolve to the managed switcher file). Blocks that mix the managed path with
 * other, user-defined paths are left untouched.
 */
function stripManagedInclude(content: string, absolutePath: string): string {
  const managedTargets = new Set([
    absolutePath,
    '~/.gitconfig-switcher',
    '.gitconfig-switcher'
  ])

  const lines = content.split('\n')
  const result: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (/^\s*\[include\]\s*$/.test(line)) {
      // Collect the consecutive `path = ...` lines that follow the header.
      const pathLines: string[] = []
      let j = i + 1
      while (j < lines.length && /^\s*path\s*=/.test(lines[j])) {
        pathLines.push(lines[j])
        j++
      }

      const allManaged = pathLines.length > 0 && pathLines.every(pl => {
        const match = pl.match(/path\s*=\s*(.+?)\s*$/)
        return match ? managedTargets.has(match[1].trim()) : false
      })

      if (allManaged) {
        // Skip the header and its managed path lines.
        i = j - 1
        continue
      }
    }

    result.push(line)
  }

  return result.join('\n')
}

export async function ensureManagedIncludeInstalled(
  position: IncludePosition = 'end'
): Promise<ManagedIncludeResult> {
  const home = homedir()
  const managedPath = join(home, '.gitconfig-switcher')
  const gitconfigPath = join(home, '.gitconfig')

  // Ensure managed file exists
  try {
    await access(managedPath, constants.F_OK)
  } catch {
    await writeFile(managedPath, '', 'utf-8')
  }

  let gitconfigContent = ''
  try {
    gitconfigContent = await readFile(gitconfigPath, 'utf-8')
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      gitconfigContent = ''
    } else {
      throw error
    }
  }

  // Use absolute path with forward slashes for Windows compatibility
  const absolutePath = managedPath.replaceAll('\\', '/')
  const includeBlock = `[include]\n\tpath = ${absolutePath}\n`

  // Remove any existing managed include block so we can reposition it.
  const body = stripManagedInclude(gitconfigContent, absolutePath)
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  let newContent: string
  if (position === 'start') {
    newContent = body ? `${includeBlock}\n${body}\n` : includeBlock
  } else {
    newContent = body ? `${body}\n\n${includeBlock}` : includeBlock
  }

  if (newContent !== gitconfigContent) {
    await writeFile(gitconfigPath, newContent, 'utf-8')
  }

  return { managedPath, gitconfigPath }
}
