import { describe, it, expect } from 'vitest'
import { ghLinkLabel } from './Profiles'

describe('ghLinkLabel', () => {
  it('names the linked gh account', () => {
    expect(ghLinkLabel('diegoauyon')).toBe('gh: diegoauyon')
  })

  it('says when no gh account is mapped, chosen or not', () => {
    expect(ghLinkLabel(undefined)).toBe('gh: not mapped')
    expect(ghLinkLabel('')).toBe('gh: not mapped')
  })
})
