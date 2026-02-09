import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { Profile, ProfileSchema } from './schema'
import { z } from 'zod'

const ProfileArraySchema = z.array(ProfileSchema)

export async function loadProfiles(userDataPath: string): Promise<Profile[]> {
  const profilesPath = join(userDataPath, 'profiles.json')
  try {
    const data = await readFile(profilesPath, 'utf-8')
    const parsed = JSON.parse(data)
    return ProfileArraySchema.parse(parsed)
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return []
    }
    throw new Error(`Failed to load profiles: ${error.message}`)
  }
}

export async function saveProfiles(userDataPath: string, profiles: Profile[]): Promise<void> {
  const profilesPath = join(userDataPath, 'profiles.json')
  try {
    await mkdir(userDataPath, { recursive: true })
    await writeFile(profilesPath, JSON.stringify(profiles, null, 2), 'utf-8')
  } catch (error: any) {
    throw new Error(`Failed to save profiles: ${error.message}`)
  }
}
