export type OriginEntry = {
  originFile: string
  key: string
  value: string
}

export type VerifyResult = {
  effectiveName: string | null
  effectiveEmail: string | null
  origins: OriginEntry[]
  warnings: string[]
}
