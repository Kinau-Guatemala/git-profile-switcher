# Contributing

Thanks for contributing to Git Profile Switcher.

## Local Setup

1. Fork the repository and clone your fork.
2. Install dependencies with `npm ci`.
3. Start the app with `npm run dev`.

## Before Opening a Pull Request

Run the same checks as CI:

```bash
npm run typecheck
npm run test:run
npm run build:ci
```

If you changed packaging or release behavior, validate the platform-specific script you touched as well.

## Project Safety Rules

- Do not rewrite the user's full `~/.gitconfig`; the app may only install a single managed include.
- Profile switching must write only to `~/.git-profile-switcher`.
- SSH config changes must remain opt-in and append-only for the selected host alias.
- Renderer code must stay isolated from Node.js APIs. Filesystem and shell access belong in the main process behind the preload bridge.
- Keep include installation idempotent and preserve the undo flow.

## Change Scope

- Prefer focused changes over broad refactors.
- Add or update tests when you change pure logic in `src/core`.
- Document user-facing behavior changes in `README.md`.
- Do not commit generated release artifacts from `dist/`.

## Release Process

Tagged releases are automated.

```bash
git tag v1.0.0
git push origin v1.0.0
```

Pushing a `v*` tag triggers `.github/workflows/release.yml`, which builds:

- Windows portable `.exe`
- Linux `.AppImage`
- macOS `.dmg`

The workflow then attaches those artifacts to a GitHub Release with generated notes.

## Reporting Issues

- Use the bug report template for regressions, packaging issues, and config edge cases.
- Use the feature request template for UX improvements, platform support, or workflow ideas.
- For sensitive issues, read `SECURITY.md` before posting publicly.