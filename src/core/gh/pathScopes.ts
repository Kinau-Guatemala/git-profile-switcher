import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

/** Which Windows PATH scopes the app itself added the wrapper dir to, so removal undoes only those. */
export interface PathScopes { User: boolean; Machine: boolean }

const file = (userDataPath: string) => join(userDataPath, 'gh-path-scopes.json')

export async function loadPathScopes(userDataPath: string): Promise<PathScopes> {
  try {
    const data = JSON.parse(await readFile(file(userDataPath), 'utf-8'))
    return { User: data?.User === true, Machine: data?.Machine === true }
  } catch {
    return { User: false, Machine: false }
  }
}

export async function savePathScopes(userDataPath: string, scopes: PathScopes): Promise<void> {
  await mkdir(userDataPath, { recursive: true })
  await writeFile(file(userDataPath), JSON.stringify(scopes), 'utf-8')
}
