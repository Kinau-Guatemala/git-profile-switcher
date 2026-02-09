# Git Config Switcher

A cross-platform desktop tray application for managing multiple Git identities safely and easily.

## Features

- 🔄 Switch between multiple Git profiles from the system tray
- 🛡️ Safe, non-destructive configuration management
- ↩️ Undo last switch functionality
- ✅ Verify current Git configuration with origin tracking
- 🔐 Support for GPG signing configuration
- 🌍 Global configuration by default

## Installation

1. Install dependencies:
```bash
npm install
```

2. Make sure Git is installed and available in your PATH

## Development

Run in development mode:
```bash
npm run dev
```

## Building

Build the application:
```bash
npm run build
```

## How It Works

The application uses a **managed include file** strategy to safely switch Git configurations:

1. Creates a managed config file: `~/.gitconfig-switcher`
2. Adds an include directive to your `~/.gitconfig` (if not already present)
3. All profile switches only write to the managed file
4. Your original `.gitconfig` remains untouched

This ensures:
- No data loss
- Compatibility with existing setups
- Easy rollback (just remove the include line)

## Usage

### Creating Profiles

1. Click the tray icon
2. Select "Manage Profiles..."
3. Click "Add Profile"
4. Fill in your Git identity details
5. Optionally configure advanced options (GPG signing, etc.)

### Switching Profiles

From the tray menu:
- Select "Switch Profile" → Choose your profile
- The switch is immediate and global

### Verifying Configuration

- Click "Verify..." from the tray menu
- View effective configuration and origins
- See which files are providing which values

### Undo

- Click "Undo Last Switch" from the tray menu
- Restores the previous profile (up to 3 levels)

## Project Structure

```
src/
  core/              # Business logic (profiles, git, verify)
  main/              # Electron main process
  preload/           # IPC bridge (secure)
  renderer/          # React UI
```

## Security

- Context isolation enabled
- Node integration disabled
- All file system operations in main process
- Strict IPC API surface

## License

MIT
