# Release Process Design

## Overview

Git Config Switcher ships four platform artifacts: Windows portable `.exe`, Linux `.AppImage`, Linux `.pacman`, and macOS `.dmg`. CI/CD already exists (`ci.yml` validates every push/PR to `main`; `release.yml` builds and publishes on tag push), but the process around it — versioning, what gets built, and how Arch Linux is distributed — was never written down, and one gap exists between what's documented and what CI actually does.

This document defines that process and the concrete changes needed to close the gap.

## Current State (as found)

- `package.json` version (`1.0.0`) is the only version source. Tag `v1.0.0` already exists, pointing at commit `162edab`.
- `release.yml` triggers on `v*` tag push, builds a 3-way matrix (Windows portable exe, Linux AppImage, macOS dmg), uploads artifacts, then publishes a GitHub Release via `softprops/action-gh-release` with `generate_release_notes: true`.
- `package.json` has a `build:arch` script (`electron-builder --linux pacman`) that **no CI job calls**. It's dead from CI's perspective.
- `scripts/aur/PKGBUILD` + `.SRCINFO` + `.desktop` already exist: a `-git` (VCS) AUR package that wraps the AppImage. Its `pkgver()` is computed dynamically via `git describe --long --tags --always` at build time, so it does not need a version bump per release. It is not wired into any workflow — it's a manual, local-only packaging script today.
- `PKGBUILD`'s `url` and `source` fields point to `https://github.com/auyjos/GithubProfileSwitcher` — a stale URL from before the repo moved. The canonical remote (`git remote -v`) is `https://github.com/Kinau-Guatemala/git-profile-switcher.git`, which matches `package.json`'s `repository` field.
- `CONTRIBUTING.md` already has a "Release Process" section documenting the tag → CI → GitHub Release flow, but only lists 3 platforms and predates this design.
- Windows and macOS builds are unsigned (`CSC_IDENTITY_AUTO_DISCOVERY: false`); SmartScreen/Gatekeeper will warn users on install.

## Goals

1. Formalize the versioning/tagging convention that's already informally in use.
2. Add the missing Linux `.pacman` build to `release.yml` so all four platform artifacts ship together on every tag.
3. Define how the AUR package is maintained going forward, and fix its stale URLs.
4. Update `CONTRIBUTING.md` to reflect the real, complete process.

## Non-Goals

Explicitly out of scope for this design (confirmed with maintainer):

- Code signing / notarization for Windows or macOS. Builds stay unsigned; this is a known limitation, not a defect to fix here.
- Automated version bumping or changelog generation from commit history (e.g. changesets, release-please, semantic-release). Version bumps stay manual; GitHub's auto-generated release notes stay as the changelog.
- CI-automated AUR publishing (see "AUR Maintenance" below for why).

## Versioning & Tagging

- **Source of truth**: `version` field in `package.json`. Follows semver (`MAJOR.MINOR.PATCH`).
- **Tag format**: `vX.Y.Z`, annotated, matching the `package.json` version exactly.
- **Branch discipline**: tags are only ever cut from `main`, only after the corresponding commit is green on CI (`ci.yml`: typecheck, tests, build all pass). No tagging from feature branches.
- **Release flow**:
  1. Bump `version` in `package.json` on `main` (its own commit or part of the last merged PR).
  2. `git tag -a vX.Y.Z -m "vX.Y.Z"`
  3. `git push origin vX.Y.Z`
  4. `release.yml` picks up the tag push and does the rest.
- **Hotfixes**: same flow, patch version bump, tagged directly from `main` once the fix lands. No separate release-branch strategy — project is small enough that this would be pure overhead.

## CI Release Matrix Change

Add a fourth entry to the existing `build` job matrix in `.github/workflows/release.yml`, following the exact shape of the other three:

```yaml
- os: ubuntu-latest
  artifact-name: linux-pacman
  build-command: npm run build:arch
  artifact-path: dist/*.pacman
```

This runs on the same `ubuntu-latest` runner already used for the AppImage build (electron-builder bundles what it needs to produce a `.pacman`; no extra system packages expected). The `publish` job needs no changes — it already globs all downloaded artifacts (`release-assets/*`) and attaches everything to the release.

Result: every tag push now produces and publishes 4 artifacts instead of 3.

## AUR Maintenance

`scripts/aur/PKGBUILD` is a `-git` rolling package — `pkgver()` derives the version from `git describe` at build time on the user's machine, so **it does not need updating per release**. The only times it needs maintainer action are:

- **Fixing the stale URLs now**: `url` and the `source` git URL in `PKGBUILD`, plus matching fields in `.SRCINFO`, must point to `https://github.com/Kinau-Guatemala/git-profile-switcher` (and the `.git` clone target / desktop entry naming should follow if the package is ever renamed).
- **One-time AUR submission**: this package has never been pushed to AUR. Submitting requires an AUR account and a registered SSH key tied to that account — a manual, interactive, one-time setup that can't be bootstrapped blind from CI. After fixing the URLs, the maintainer submits it once via `git push` to `ssh://aur@aur.archlinux.org/git-profile-switcher-git.git`.
- **Future PKGBUILD edits**: whenever `PKGBUILD` itself changes (new dependency, packaging fix, rename) — regenerate `.SRCINFO` (`makepkg --printsrcinfo > .SRCINFO`) and push to the AUR repo by hand.

**Why manual instead of CI-automated**: automating the AUR push means storing the maintainer's AUR SSH private key as a GitHub Actions secret. A leak of that secret lets an attacker push arbitrary `PKGBUILD` changes to AUR under the maintainer's identity — a supply-chain risk with a blast radius well beyond this repo. Given the PKGBUILD changes rarely (the version itself is dynamic), the manual cost is low and infrequent. This was confirmed as the preferred trade-off over CI automation.

## Documentation Update

Rewrite the "Release Process" section of `CONTRIBUTING.md` to:

- List all 4 platform artifacts (exe, AppImage, pacman, dmg) instead of 3.
- Document the version-bump-then-tag sequence explicitly (currently only shows the tag command).
- Add an "Arch Linux / AUR" subsection explaining the AUR package exists, is self-updating, and what triggers a manual PKGBUILD update.
- Note unsigned Windows/macOS builds as a known limitation (so users aren't surprised by OS warnings, and so it's not silently rediscovered later).

## Validation Plan

- `release.yml` change is YAML — validate by running `npm run build:arch` locally (or in a throwaway CI run via `workflow_dispatch`) to confirm a `.pacman` file lands in `dist/`.
- No automated test covers GitHub Actions YAML directly; correctness is verified by the actual matrix run on the next real tag push (or a manual `workflow_dispatch` trigger, which `release.yml` already supports without needing a tag).
- AUR URL fixes are validated by `makepkg --printsrcinfo` succeeding locally and diffing against the committed `.SRCINFO`.

## Rollout

No flag, no gradual rollout — this is process + CI config. Changes land in a normal PR to `main`, validated by the existing `ci.yml`, and take effect on the next version tag.
