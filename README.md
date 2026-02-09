# Git Config Switcher

> 🔄 Effortlessly manage multiple Git identities and SSH keys from your system tray

A cross-platform desktop application that makes it easy to switch between different Git configurations (user name, email, SSH keys) for multiple GitHub accounts on the same machine.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

---

## 📑 Table of Contents

- [Features](#-features)
- [Why Use This?](#-why-use-this)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [Usage Guide](#-usage-guide)
  - [Creating Profiles](#1-creating-profiles)
  - [Importing SSH Config](#2-importing-existing-ssh-config)
  - [Generating SSH Keys](#3-generating-new-ssh-keys)
  - [Switching Profiles](#4-switching-profiles)
  - [Verifying Configuration](#5-verifying-configuration)
- [How It Works](#-how-it-works)
- [SSH Configuration for Multiple Accounts](#-ssh-configuration-for-multiple-accounts)
- [Troubleshooting](#-troubleshooting)
- [Development](#-development)
- [License](#-license)

---

## ✨ Features

- 🎯 **Quick Profile Switching** - Switch Git identities from the system tray menu
- 🔐 **SSH Key Management** - Generate and manage SSH keys for each account
- 📥 **Auto-Import** - Automatically detect existing Git configs and SSH setups
- ↩️ **Undo Support** - Revert to previous profile (up to 3 levels)
- ✅ **Configuration Verification** - See which config file is setting each value
- 🛡️ **Safe & Non-Destructive** - Uses managed include file, never overwrites your `.gitconfig`
- 🌍 **Global by Default** - Changes apply system-wide
- 🔑 **GPG Signing Support** - Configure GPG signing per profile (optional)

---

## 🤔 Why Use This?

**Common Problems This Solves:**

- ✅ Pushing to the wrong GitHub account
- ✅ Permission errors when using multiple accounts
- ✅ Forgetting to switch `user.name` and `user.email`
- ✅ Managing multiple SSH keys for different accounts
- ✅ Complicated SSH config file maintenance

**Before:**
```bash
# Manually switching every time
git config --global user.name "Personal Name"
git config --global user.email "personal@email.com"
# And remembering to use the right SSH host...
```

**After:**
- Click tray icon → Select profile → Done! ✨

---

## 📋 Prerequisites

- **Node.js** 18+ and npm
- **Git** installed and in PATH
- **Windows** 10/11, **macOS** 10.12+, or **Linux**
- **(Optional)** PowerShell 7+ for running npm scripts on Windows

---

## 🚀 Installation

### Option 1: Development Mode (Recommended)

```bash
# Clone the repository
git clone https://github.com/auyjos/GithubProfileSwitcher.git
cd GithubProfileSwitcher

# Install dependencies
npm install

# Run the app
npm run dev
```

### Option 2: Build Executable

```bash
npm run build
```

The portable executable will be in `dist/win-unpacked/` (Windows) or equivalent for your OS.

---

## 🎬 Quick Start

### 1. First Launch

The app will:
- Open the Profiles window automatically
- Check if Git is installed
- Create a managed config file at `~/.gitconfig-switcher`
- Add an include directive to your `~/.gitconfig` (safely)

### 2. Create Your First Profile

**Method A: Manual Entry**
1. Click **"Add Profile"**
2. Enter:
   - **Profile Label**: e.g., "Work", "Personal", "Client"
   - **User Name**: Your Git display name
   - **User Email**: Your Git commit email

**Method B: Import from SSH Config**
1. Click **"Import SSH Config"**
2. Browse to `C:\Users\[YourName]\.ssh\config` (Windows) or `~/.ssh/config` (Mac/Linux)
3. Select detected accounts
4. Enter username and email for each

### 3. Switch Profiles

- Click the system tray icon
- Select **"Switch Profile"** → Choose your profile
- Done! All Git operations now use this identity

---

## 📖 Usage Guide

### 1. Creating Profiles

#### Basic Profile
```
Profile Label: Personal GitHub
User Name: John Doe
User Email: john@personal.com
```

#### Advanced Options
- **SSH Host**: For multiple GitHub accounts (e.g., `github.com-personal`)
- **GPG Signing**: Enable if you sign commits (most users don't need this)
- **Signing Key**: Your GPG key ID (leave empty if not using GPG)

### 2. Importing Existing SSH Config

If you already have an SSH config like this:

```bash
# Personal GitHub account
Host github.com-personal
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_personal
    IdentitiesOnly yes

# Work GitHub account  
Host github.com-work
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_work
    IdentitiesOnly yes
```

**Steps:**
1. Click **"Import SSH Config"**
2. Select your `~/.ssh/config` file
3. The app will detect all GitHub accounts
4. Click **"Import This Profile"** for each account
5. Enter the Git username and email when prompted

### 3. Generating New SSH Keys

**To create a new account with fresh SSH keys:**

1. Click **"Add Profile"**
2. Enter Profile Label and Email
3. Expand **"Advanced Options"**
4. Click **"🔑 Generate New SSH Key"**
5. The app will:
   - Create a new SSH key pair (ed25519)
   - Add it to your `~/.ssh/config`
   - Display the public key
6. **Copy the public key** and add it to GitHub:
   - Go to: https://github.com/settings/ssh/new
   - Paste the key and save
7. Click **"Save"** to create the profile

### 4. Switching Profiles

**From Tray Menu:**
1. Click the tray icon (Git Config Switcher)
2. Select **"Switch Profile"** → Choose profile
3. The active profile is shown at the top

**From Profiles Window:**
1. Click **"Manage Profiles..."** in tray
2. Click **"Apply"** on any profile

**Undo:**
- Click **"Undo Last Switch"** in tray menu
- Restores the previous profile (up to 3 levels)

### 5. Verifying Configuration

**Check what's currently active:**
1. Click **"Verify..."** in tray menu
2. See:
   - Effective name and email
   - Which config file set each value
   - Warnings if something is misconfigured

**Command line verification:**
```bash
git config user.name
git config user.email
git config github.sshHost
```

---

## 🔧 How It Works

### Managed Include Strategy

The app uses a **safe, non-destructive** approach:

1. **Creates a managed file**: `~/.gitconfig-switcher`
2. **Adds ONE line to your `.gitconfig`**:
   ```ini
   [include]
       path = ~/.gitconfig-switcher
   ```
3. **All profile switches only write to the managed file**
4. **Your original `.gitconfig` stays untouched**

This means:
- ✅ No data loss
- ✅ Compatible with complex setups (conditional includes, corporate configs)
- ✅ Easy to disable (just remove the include line)

### What Gets Configured

When you switch profiles, the app sets:
```bash
[user]
    name = Your Name
    email = your@email.com

[github]
    sshHost = github.com-yourprofile  # For reference

[core]
    sshCommand = ssh -F ~/.ssh/config  # Uses your SSH config
```

---

## 🔐 SSH Configuration for Multiple Accounts

### Understanding SSH Hosts

To use multiple GitHub accounts, your repository remotes must use SSH host aliases:

#### ❌ Standard (won't work with multiple accounts):
```bash
git@github.com:username/repo.git
```

#### ✅ With SSH Host Alias:
```bash
git@github.com-personal:username/repo.git
git@github.com-work:company/repo.git
```

### Setting Up Your SSH Config

**Location:** `~/.ssh/config` (Windows: `C:\Users\[You]\.ssh\config`)

**Example:**
```bash
# Personal Account
Host github.com-personal
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_personal
    IdentitiesOnly yes

# Work Account
Host github.com-work
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_work
    IdentitiesOnly yes
```

### Converting Existing Repositories

```bash
# Check current remote
git remote -v

# Update to use SSH host alias
git remote set-url origin git@github.com-personal:username/repo.git
```

### Testing SSH Connection

```bash
# Test each account
ssh -T git@github.com-personal
# Should say: Hi [username]! You've successfully authenticated...

ssh -T git@github.com-work
# Should say: Hi [workname]! You've successfully authenticated...
```

---

## 🐛 Troubleshooting

### "Permission denied" when pushing

**Cause:** Remote URL doesn't use SSH host alias

**Fix:**
```bash
git remote -v  # Check current URL
git remote set-url origin git@github.com-personal:username/repo.git
```

### "Wrong account" in GitHub commits

**Cause:** Profile not switched before committing

**Fix:**
1. Switch profile in tray menu
2. Verify: `git config user.email`
3. If already committed: Amend the commit
   ```bash
   git commit --amend --reset-author
   ```

### SSH key not working

**Cause:** SSH config or key file path incorrect

**Fix:**
1. Test: `ssh -T git@github.com-personal`
2. Check `~/.ssh/config` has correct `IdentityFile` path
3. Ensure key file exists: `ls ~/.ssh/id_ed25519_personal`

### Build errors on Windows

**Cause:** Missing PowerShell 7+ or admin privileges for symbolic links

**Solutions:**
- **Run in dev mode**: `npm run dev` (no build needed!)
- **Install PowerShell 7**: https://aka.ms/powershell
- **Or run as admin** to create symbolic links

### App not starting

**Check:**
1. Git is installed: `git --version`
2. Node.js is installed: `node --version`
3. Dependencies installed: `npm install`

---

## 👨‍💻 Development

### Project Structure

```
src/
├── core/              # Business logic
│   ├── profiles/      # Profile CRUD & storage
│   ├── git/           # Git operations & SSH
│   └── verify/        # Configuration verification
├── main/              # Electron main process
├── preload/           # IPC bridge (secure)
└── renderer/          # React UI
```

### Running Development Server

```bash
npm run dev
```

### Building for Production

```bash
npm run build
```

### Running Tests

```bash
npm test
```

### Tech Stack

- **Electron** - Desktop framework
- **React** - UI
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Zod** - Schema validation
- **Execa** - Git command execution

---

## 📄 License

MIT © 2024

---

## 🙏 Acknowledgments

Built to solve the real-world problem of managing multiple GitHub accounts. If you find this useful, ⭐ star the repo!

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/auyjos/GithubProfileSwitcher/issues)
- **Discussions**: [GitHub Discussions](https://github.com/auyjos/GithubProfileSwitcher/discussions)

---

**Made with ❤️ for developers juggling multiple Git identities**
