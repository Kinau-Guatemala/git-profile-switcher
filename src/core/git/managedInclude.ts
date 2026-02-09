import { homedir } from 'os'
import { join } from 'path'
import { readFile, writeFile, access } from 'fs/promises'
import { constants } from 'fs'

export interface ManagedIncludeResult {
  managedPath: string
  gitconfigPath: string
}

export async function ensureManagedIncludeInstalled(): Promise<ManagedIncludeResult> {
  const home = homedir()
  const managedPath = join(home, '.gitconfig-switcher')
  const gitconfigPath = join(home, '.gitconfig')

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

  const includeLine = 'path = ~/.gitconfig-switcher'
  const includeLineAlt = 'path = .gitconfig-switcher'
  const includeLineWin = `path = ${managedPath.replace(/\\/g, '/')}`

  const hasInclude = gitconfigContent.includes(includeLine) ||
    gitconfigContent.includes(includeLineAlt) ||
    gitconfigContent.includes(includeLineWin)

  if (!hasInclude) {
    const includeBlock = `\n[include]\n  path = ~/.gitconfig-switcher\n`
    const newContent = gitconfigContent + includeBlock
    await writeFile(gitconfigPath, newContent, 'utf-8')
  }

  return { managedPath, gitconfigPath }
}
