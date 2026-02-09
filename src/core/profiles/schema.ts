import { z } from 'zod'

export const ProfileAdvancedSchema = z.object({
  gpgSign: z.boolean().optional(),
  signingKey: z.string().optional(),
  sshKeyPath: z.string().optional(),
  sshHost: z.string().optional(),
  hosts: z.array(z.string()).optional()
})

export const ProfileSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1),
  userName: z.string().min(1),
  userEmail: z.string().email(),
  advanced: ProfileAdvancedSchema.optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
})

export const ProfileInputSchema = ProfileSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true
})

export type ProfileAdvanced = z.infer<typeof ProfileAdvancedSchema>
export type Profile = z.infer<typeof ProfileSchema>
export type ProfileInput = z.infer<typeof ProfileInputSchema>
