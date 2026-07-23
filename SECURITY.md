# Security Notes

Git Profile Switcher is intentionally conservative about what it changes on disk.

## Files The App Touches

- `~/.gitconfig`: only to install a single idempotent `[include] path = ~/.git-profile-switcher` entry if it is missing.
- `~/.git-profile-switcher`: the managed file the app owns and rewrites when you apply or undo a profile switch.
- `~/.ssh/config`: only when you explicitly add or generate an SSH host alias through the app.
- `~/.ssh/id_ed25519_<account>` and `.pub`: only when you explicitly generate a new SSH key.
- Electron user data (`profiles.json`, `state.json`): stores profiles and undo state.

## Files The App Does Not Manage

- It does not deeply parse or rewrite your full `~/.gitconfig`.
- It does not automatically rewrite repository remotes or repo-local `.git/config` files.
- It does not upload your SSH keys, passphrases, or Git identities to any remote service.

## Operational Notes

- SSH key passphrases are optional, but using one is recommended when you want the private key encrypted at rest.
- The renderer runs with `contextIsolation: true` and `nodeIntegration: false`.
- Filesystem and process access are restricted to the Electron main process and exposed through a typed preload bridge.

## Reporting A Vulnerability

Do not post secrets, private keys, or exploit details in a public issue.

If GitHub Security Advisories are enabled for the repository, use that channel. Otherwise, contact the maintainer privately before opening a public issue.