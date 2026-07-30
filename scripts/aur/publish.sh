#!/usr/bin/env bash
#
# Publish the git-profile-switcher AUR packages.
#
# Handles both the first-time import and subsequent updates: it clones each AUR
# repo fresh, copies in the local PKGBUILD + .SRCINFO, and pushes only if they
# changed. Safe to re-run — unchanged packages are skipped.
#
# Prerequisites:
#   - An AUR account with your SSH public key registered
#     (My Account -> SSH Public Key at https://aur.archlinux.org).
#   - ~/.ssh/config pointing aur.archlinux.org at that key, e.g.:
#         Host aur.archlinux.org
#             User aur
#             IdentityFile ~/.ssh/personal_key
#             IdentitiesOnly yes
#
# Updating a package (do this BEFORE running the script):
#   1. Bump pkgver / pkgrel in scripts/aur/<pkg>/PKGBUILD.
#   2. For git-profile-switcher-bin ONLY: the AppImage/LICENSE are pinned by
#      sha256sums, so refresh them after changing pkgver:
#         cd scripts/aur/git-profile-switcher-bin && updpkgsums
#      (git-profile-switcher-git uses sha256sums=('SKIP') — nothing to refresh.)
#   3. Regenerate the checked-in metadata:
#         makepkg --printsrcinfo > .SRCINFO
#   4. Run this script.
#
# The commit author identifies the uploader on the AUR; adjust below if needed.
set -euo pipefail

AUTHOR_NAME="Diego Auyon"
AUTHOR_EMAIL="diego.auyon@kinau.com.gt"
PACKAGES=(git-profile-switcher-bin git-profile-switcher-git)

AUR_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/aur-publish.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

# Fail early with a clear message if AUR SSH auth isn't set up.
if ! ssh -o BatchMode=yes -o ConnectTimeout=10 aur@aur.archlinux.org help >/dev/null 2>&1; then
  echo "ERROR: AUR SSH auth failed. Register your SSH public key at" >&2
  echo "       https://aur.archlinux.org (My Account -> SSH Public Key) first." >&2
  exit 1
fi

for pkg in "${PACKAGES[@]}"; do
  src="$AUR_DIR/$pkg"
  ver="$(grep -m1 '^pkgver=' "$src/PKGBUILD" | cut -d= -f2)"
  rel="$(grep -m1 '^pkgrel=' "$src/PKGBUILD" | cut -d= -f2)"
  echo "==> Publishing $pkg ${ver}-${rel}"

  git clone "ssh://aur@aur.archlinux.org/${pkg}.git" "$WORK/$pkg"
  cp "$src/PKGBUILD" "$src/.SRCINFO" "$WORK/$pkg/"

  git -C "$WORK/$pkg" add PKGBUILD .SRCINFO
  if git -C "$WORK/$pkg" diff --cached --quiet; then
    echo "    no changes vs AUR — skipping"
    continue
  fi

  # New (empty) repos have no commits yet -> this is the initial import.
  if git -C "$WORK/$pkg" rev-parse HEAD >/dev/null 2>&1; then
    msg="Update to ${ver}-${rel}"
  else
    msg="Initial import: ${pkg} ${ver}-${rel}"
  fi

  git -C "$WORK/$pkg" \
    -c user.name="$AUTHOR_NAME" -c user.email="$AUTHOR_EMAIL" \
    commit -m "$msg"
  # AUR's default branch is master; push HEAD there regardless of local branch name.
  git -C "$WORK/$pkg" push origin HEAD:master
  echo "    pushed -> https://aur.archlinux.org/packages/$pkg"
done

echo "Done."
