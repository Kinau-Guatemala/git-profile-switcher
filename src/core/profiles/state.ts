import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'

export const AppStateSchema = z.object({
  activeProfileId: z.string().uuid().optional(),
  undoStack: z.array(z.object({
    profileId: z.string().uuid(),
    at: z.string().datetime()
  })).max(3)
})

export type AppState = z.infer<typeof AppStateSchema>

const defaultState: AppState = {
  activeProfileId: undefined,
  undoStack: []
}

export async function loadState(userDataPath: string): Promise<AppState> {
  const statePath = join(userDataPath, 'state.json')
  try {
    const data = await readFile(statePath, 'utf-8')
    const parsed = JSON.parse(data)
    return AppStateSchema.parse(parsed)
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return defaultState
    }
    throw new Error(`Failed to load state: ${error.message}`)
  }
}

export async function saveState(userDataPath: string, state: AppState): Promise<void> {
  const statePath = join(userDataPath, 'state.json')
  try {
    await mkdir(userDataPath, { recursive: true })
    await writeFile(statePath, JSON.stringify(state, null, 2), 'utf-8')
  } catch (error: any) {
    throw new Error(`Failed to save state: ${error.message}`)
  }
}
