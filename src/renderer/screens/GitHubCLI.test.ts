import { describe, it, expect } from 'vitest'
import { linkChoices } from './GitHubCLI'

describe('linkChoices', () => {
  it('lets you unlink even when gh is missing or has a single account', () => {
    expect(linkChoices(false, 'work')).toEqual({ selectDisabled: false, accountsDisabled: true })
  })

  it('keeps an unlinked profile read-only until two accounts exist', () => {
    expect(linkChoices(false, null)).toEqual({ selectDisabled: true, accountsDisabled: true })
  })

  it('allows linking with two or more accounts', () => {
    expect(linkChoices(true, null)).toEqual({ selectDisabled: false, accountsDisabled: false })
  })
})
