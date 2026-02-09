# SSH Multi-Account Setup Guide

## What's New

The app now **automatically detects and manages** your multiple GitHub accounts with different SSH keys!

## Your Detected Accounts

Based on your `~/.ssh/config`, you have:
1. **Personal** - `github.com-personal` (id_ed25519_personal)
2. **Pixel** - `github.com-pixel` (id_ed25519_pixel)
3. **Novopayment** - `github.com-novopayment` (id_ed25519_novopayment)
4. **Cognits** - `github.com-cognits` (id_ed25519_cognits)

## How to Import Your Accounts

1. **Click "Import from Git Config"** in the app
2. You'll see all 4 GitHub accounts detected
3. Click **"Import This Profile"** for each account
4. Enter your Git username and email for each account when prompted
5. Done! All accounts are now centralized

## How Switching Works

When you switch profiles, the app automatically configures:
- ✅ `user.name` - Your Git username
- ✅ `user.email` - Your Git email
- ✅ `core.sshCommand` - Points to your SSH config
- ✅ `github.sshHost` - Stores which SSH host to use

## Important: Repository Remote URLs

For the SSH switching to work, your repository remotes need to use the SSH host aliases:

### ❌ Old way (won't work with multiple accounts):
```bash
git remote add origin git@github.com:username/repo.git
```

### ✅ New way (works with profiles):
```bash
# For personal account
git remote add origin git@github.com-personal:auyjos/repo.git

# For pixel account
git remote add origin git@github.com-pixel:auyos-pixel/repo.git

# For novopayment account
git remote add origin git@github.com-novopayment:novopayment/repo.git

# For cognits account
git remote add origin git@github.com-cognits:auyjos-cognits/repo.git
```

## Converting Existing Repositories

If you have existing repos, update their remotes:

```bash
# Check current remote
git remote -v

# Update to use SSH host alias
git remote set-url origin git@github.com-personal:auyjos/your-repo.git
```

## Testing

After switching profiles, verify it's working:

```bash
# Test SSH connection
ssh -T git@github.com-personal
# Should say: Hi auyjos! You've successfully authenticated...

ssh -T git@github.com-pixel
# Should say: Hi auyos-pixel! You've successfully authenticated...

# Verify Git config
git config user.name
git config user.email
git config github.sshHost
```

## Workflow Example

1. **Switch to Personal profile** (via tray menu)
2. Work on personal projects with remotes like `git@github.com-personal:auyjos/project.git`
3. **Switch to Pixel profile** (via tray menu)
4. Work on pixel projects with remotes like `git@github.com-pixel:auyos-pixel/project.git`
5. Git commits automatically use the correct name, email, and SSH key!

## Benefits

- ✅ No more wrong account commits
- ✅ No more permission errors
- ✅ One-click account switching
- ✅ SSH keys automatically used correctly
- ✅ All accounts centrally managed

## Troubleshooting

**Permission denied?**
- Make sure your remote URL uses the SSH host alias (e.g., `github.com-personal`)
- Check: `git remote -v`

**Wrong account pushing?**
- Switch profiles in the tray menu
- Verify: `git config user.email`

**SSH key not working?**
- Test: `ssh -T git@github.com-personal`
- Check your `~/.ssh/config` file has the correct IdentityFile path
