<div align="center">

# Git Profile Switcher

**Manage multiple Git identities from your system tray.**

Switch between Git profiles — name, email, SSH keys, GPG signing — without ever touching `~/.gitconfig` directly. Works with GitHub, GitLab, Bitbucket, and any Git hosting platform.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)](#installation)
[![Built with Electron](https://img.shields.io/badge/Built%20with-Electron%20%2B%20React-47848F.svg)](#tech-stack)

</div>

---

## The Problem

Developers who work across personal projects, open-source contributions, and employer repositories on the same machine constantly fight with Git identity:

- Commits land under the wrong name or email
- SSH permission errors when pushing to the wrong account
- Manually running `git config --global user.name "..."` every time you switch context
- Maintaining a messy `~/.ssh/config` by hand

**Git Profile Switcher** eliminates all of that with a single click from your system tray.

---

## Features

| Feature | Description |
|---------|-------------|
| **Tray-first switching** | Switch profiles from the system tray — no window required |
| **SSH key management** | Generate ed25519 key pairs, test connections, manage `~/.ssh/config` |
| **Platform-agnostic detection** | Auto-detect SSH profiles for GitHub, GitLab, Bitbucket, Codeberg, and any host |
| **Auto-import** | Import existing profiles from your SSH config or global Git config |
| **Config verification** | See exactly which file sets each Git config value |
| **Undo support** | Revert to a previous profile (up to 3 levels deep) |
| **Non-destructive** | Uses a managed include file — your `.gitconfig` is never overwritten |
| **GPG signing** | Per-profile GPG key and commit signing configuration |
| **5 retro themes** | Lava, Matrix, Synthwave, Glacier, and Amber color palettes |
| **Cross-platform** | Windows, macOS, and Linux (AppImage + Arch Linux) |

---

## How It Works

Git Profile Switcher uses a **managed include strategy** that is safe and non-destructive:

```
~/.gitconfig                          ~/.gitconfig-switcher
┌──────────────────────────────┐      ┌───────────────────────────────┐
│ [user]                       │      │ [user]                        │
│     name = Old Name          │      │     name = Active Profile     │
│     email = old@email.com    │      │     email = active@email.com  │
│                              │      │                               │
│ [include]                    │─────>│ [core]                        │
│     path = ~/.gitconfig-     │      │     sshCommand = ssh -F ...   │
│            switcher          │      │                               │
│                              │      │ [commit]                      │
│ # Your other config stays    │      │     gpgsign = true            │
│ # completely untouched       │      └───────────────────────────────┘
└──────────────────────────────┘        ▲ Only this file changes
                                          on profile switch
```

**What this means:**

- The app adds **one include line** to your `~/.gitconfig` (idempotent — it won't duplicate)
- Every profile switch writes **only** to `~/.gitconfig-switcher`
- Your original `.gitconfig` is never overwritten or deeply parsed
- Git's include mechanism means the managed file's values take precedence
- To disable: just remove the include line. Everything reverts instantly.

---

## Installation

### Prerequisites

- [Git](https://git-scm.com/) installed and in PATH
- [Node.js](https://nodejs.org/) 18+

### From Source (Development)

```bash
git clone https://github.com/auyjos/GithubProfileSwitcher.git
cd GithubProfileSwitcher

npm install
npm run dev
```

### Build Executable

```bash
# Windows (portable .exe)
npm run build

# Linux (AppImage)
npm run build:appimage

# Arch Linux (pacman)
npm run build:arch
```

The packaged app will be in the `dist/` directory.

---

## Quick Start

### 1. Launch the App

On first launch, the app will:
- Verify Git is installed
- Create `~/.gitconfig-switcher` (the managed file)
- Add the include directive to `~/.gitconfig` (once, safely)
- Open the Profiles window

### 2. Add a Profile

You have three options:

<table>
<tr>
<td width="33%">

**Manual Entry**

Click **"Add Profile"** and fill in:
- Profile label (e.g. "Work")
- Git user name
- Git email

</td>
<td width="33%">

**Import from SSH Config**

Click **"Import SSH Config"** and browse to `~/.ssh/config`. The app detects all host aliases that point to git platforms and lets you import them.

</td>
<td width="33%">

**Auto-Detect**

Click **"Auto-Detect"** to scan your existing Git configuration, conditional includes, and SSH config for profiles.

</td>
</tr>
</table>

### 3. Switch from the Tray

Click the tray icon and select a profile. Done.

```
┌─────────────────────────────────┐
│  Active: Jane Doe <jane@work>   │
│─────────────────────────────────│
│  Switch Profile                 │
│    ○ Personal (jane@home.com)   │
│    ● Work     (jane@work.com)   │
│    ○ OSS      (jane@oss.dev)    │
│─────────────────────────────────│
│  Verify...                      │
│  Manage Profiles...             │
│  Undo Last Switch               │
│─────────────────────────────────│
│  Quit                           │
└─────────────────────────────────┘
```

---

## Usage Guide

### Creating Profiles

Every profile has a **label**, **user name**, and **email**. Optionally expand **Advanced Options** to configure:

| Field | Purpose |
|-------|---------|
| **SSH Host** | The SSH host alias for this identity (e.g. `github.com-work`, `gitlab-personal`) |
| **GPG Signing** | Enable `commit.gpgsign = true` for this profile |
| **Signing Key** | Your GPG key ID for signed commits |

### SSH Key Generation

From the **SSH Keys** tab:

1. Enter an **account name** (used as the key filename and host alias)
2. Enter your **email address**
3. Click **Generate** — creates an ed25519 key pair at `~/.ssh/id_ed25519_<account>`
4. The public key is displayed — copy it to your hosting platform:
   - GitHub: [github.com/settings/ssh/new](https://github.com/settings/ssh/new)
   - GitLab: Settings > SSH Keys
   - Bitbucket: Personal Settings > SSH Keys
5. Click **Test** to verify the connection

The app automatically adds the host block to `~/.ssh/config`:

```
# <account-name>
Host github.com-<account-name>
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_<account-name>
    IdentitiesOnly yes
```

### SSH Configuration for Multiple Accounts

To use multiple accounts on the same platform, your repository remotes need to use **SSH host aliases** instead of the default hostname:

```bash
# Default (only works for one account):
git@github.com:user/repo.git

# With host alias (works for multiple accounts):
git@github.com-personal:user/repo.git
git@github.com-work:company/repo.git
```

**Convert an existing repo:**

```bash
git remote set-url origin git@github.com-personal:user/repo.git
```

**This works the same way for any platform:**

```bash
# GitLab
git remote set-url origin git@gitlab-work:company/repo.git

# Bitbucket
git remote set-url origin git@bitbucket-client:client/repo.git
```

### Platform-Agnostic Profile Detection

The app detects SSH profiles by reading `~/.ssh/config` and looking for any `Host` entry that has a `HostName` pointing to a known git platform:

| Platform | Detected HostName |
|----------|-------------------|
| GitHub | `github.com` |
| GitLab | `gitlab.com` |
| Bitbucket | `bitbucket.org` |
| Codeberg | `codeberg.org` |
| Any self-hosted | Any host with an `IdentityFile` configured |

This means **any naming convention** works:

```bash
# All of these are detected:
Host gh-personal          # any alias
Host work-gitlab          # any alias
Host my-bitbucket         # any alias
    HostName github.com   # ← this is what matters
    IdentityFile ~/.ssh/id_ed25519_personal
```

### Verifying Configuration

The **Verify** tab shows:

- **Effective identity** — the name and email Git will actually use
- **Origin table** — which config file sets each value (from `git config --show-origin`)
- **Warnings** — if the managed file isn't being used or values are overridden

This is invaluable for debugging why a commit used the wrong identity.

### Undo

Made a mistake? The tray menu includes **"Undo Last Switch"** which reverts to the previous profile. The undo stack holds up to 3 entries and persists across app restarts.

---

## Themes

Five retro pixel-art color palettes, switchable from the **Settings** tab:

<table>
<tr>
<td align="center"><strong>LAVA</strong><br/><sub>Red / Orange / Gold on dark navy</sub><br/><img src="https://via.placeholder.com/80x20/FF6500/FF6500" alt="Lava accent" /></td>
<td align="center"><strong>MATRIX</strong><br/><sub>Bright green on deep black</sub><br/><img src="https://via.placeholder.com/80x20/00FF41/00FF41" alt="Matrix accent" /></td>
<td align="center"><strong>SYNTHWAVE</strong><br/><sub>Hot pink / purple on indigo</sub><br/><img src="https://via.placeholder.com/80x20/FF2D87/FF2D87" alt="Synthwave accent" /></td>
<td align="center"><strong>GLACIER</strong><br/><sub>Cyan / steel blue on midnight</sub><br/><img src="https://via.placeholder.com/80x20/00BFFF/00BFFF" alt="Glacier accent" /></td>
<td align="center"><strong>AMBER</strong><br/><sub>Phosphor monitor warmth</sub><br/><img src="https://via.placeholder.com/80x20/FFB000/FFB000" alt="Amber accent" /></td>
</tr>
</table>

Themes are persisted to localStorage and apply instantly.

---

## Troubleshooting

### "Permission denied" when pushing

Your remote URL isn't using the SSH host alias.

```bash
# Check current remote
git remote -v

# Fix it
git remote set-url origin git@github.com-personal:user/repo.git
```

### Commits showing the wrong identity

The profile wasn't switched before committing.

```bash
# Verify current identity
git config user.name
git config user.email

# Fix the last commit
git commit --amend --reset-author
```

### SSH key not authenticating

```bash
# Test the connection
ssh -T git@github.com-personal

# Check the key exists
ls ~/.ssh/id_ed25519_personal

# Verify ~/.ssh/config has the right IdentityFile path
cat ~/.ssh/config
```

### App not starting

```bash
# Check prerequisites
git --version    # Must be installed
node --version   # Must be 18+

# Reinstall dependencies
npm install
```

---

## Architecture

```
src/
├── core/                  # Pure TypeScript — no Electron imports
│   ├── profiles/          # Zod schemas, JSON storage, undo stack
│   ├── git/               # Git CLI wrapper, managed include, SSH operations
│   └── verify/            # Config origin parsing and verification
│
├── main/                  # Electron main process
│   ├── index.ts           # App lifecycle and startup
│   ├── ipc.ts             # IPC handlers (all Node/filesystem access)
│   ├── tray.ts            # System tray menu and profile switching
│   └── windows.ts         # BrowserWindow creation
│
├── preload/               # Secure IPC bridge
│   └── index.ts           # contextBridge.exposeInMainWorld (window.api)
│
└── renderer/              # React SPA (HashRouter)
    ├── screens/           # Profiles, Verify, SSHKeys, Settings
    ├── components/        # ProfileForm, OriginTable, InputModal
    └── themes.ts          # 5 color palettes with CSS custom properties
```

**Security model:** `contextIsolation: true`, `nodeIntegration: false`. The renderer never touches the filesystem directly — everything goes through the typed IPC bridge in `window.api`.

### Tech Stack

| Technology | Role |
|-----------|------|
| **Electron** | Desktop framework |
| **React** | UI components |
| **TypeScript** | Type safety across all layers |
| **Vite** | Build tool with hot reload |
| **Zod** | Runtime schema validation for profiles |
| **Execa** | Safe Git CLI execution |
| **Zustand** | Lightweight state management |

---

## Development

```bash
# Development with hot reload
npm run dev

# Type-check
npx tsc --noEmit

# Run tests
npm test              # Watch mode
npx vitest run        # Single run

# Build
npm run build         # Windows portable
npm run build:appimage  # Linux AppImage
npm run build:arch      # Arch Linux pacman
```

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

---

## License

MIT &copy; 2024 [Jose Andres Auyon](https://github.com/auyjos)

---

<div align="center">

**Built for developers juggling multiple Git identities.**

[Report a Bug](https://github.com/auyjos/GithubProfileSwitcher/issues) &middot; [Request a Feature](https://github.com/auyjos/GithubProfileSwitcher/issues)

</div>
