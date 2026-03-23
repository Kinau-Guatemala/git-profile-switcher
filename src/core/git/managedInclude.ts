import { homedir } from 'node:os'
import { join } from 'node:path'
import { readFile, writeFile, access } from 'node:fs/promises'
import { constants } from 'node:fs'

export interface ManagedIncludeResult {
  managedPath: string
  gitconfigPath: string
}

export async function ensureManagedIncludeInstalled(): Promise<ManagedIncludeResult> {
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
  const includeLine = `path = ${absolutePath}`
  const includeLineTilde = 'path = ~/.gitconfig-switcher'
  const includeLineRelative = 'path = .gitconfig-switcher'

  const hasInclude = gitconfigContent.includes(includeLine) ||
    gitconfigContent.includes(includeLineTilde) ||
    gitconfigContent.includes(includeLineRelative)

  if (!hasInclude) {
    // Use absolute path for Windows compatibility
    const includeBlock = `\n[include]\n\tpath = ${absolutePath}\n`
    const newContent = gitconfigContent + includeBlock
    await writeFile(gitconfigPath, newContent, 'utf-8')
  }

  return { managedPath, gitconfigPath }
}
