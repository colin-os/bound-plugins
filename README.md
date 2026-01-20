# 🎮 Bound Plugins

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Made for Revenge/Vendetta](https://img.shields.io/badge/made%20for-Revenge%2FVendetta-5865f2.svg)](https://github.com/revenge-mod)

A collection of powerful Revenge/Vendetta Discord plugins designed to enhance your mobile Discord experience with features typically limited to desktop.

## ✨ Plugins

### 🔍 Show Hidden Channels
Reveal hidden Discord channels in servers, allowing you to see channels you don't have access to.

**Features:**
- Shows all hidden channels in server channel lists
- Identifies channels you lack permissions to view
- Toggle on/off via plugin settings
- Automatically refreshes channel list on enable/disable

**Use Cases:**
- See what channels exist in a server
- Understand server structure and organization
- Know what you're missing without having to ask

---

### 📱 Mobile Webhooks
Bring desktop webhook functionality to Discord mobile - create, manage, and delete webhooks right from your phone.

**Features:**
- Create webhooks with custom names
- View all webhooks in a channel
- Delete webhooks with a single tap
- Clean, intuitive mobile UI
- Full webhook management interface

**Use Cases:**
- Set up bot integrations on the go
- Manage server webhooks without desktop access
- Quick webhook creation for notifications
- Mobile-first server administration

## 📦 Installation

### Using Revenge/Vendetta

1. Open Revenge/Vendetta settings
2. Navigate to **Plugins**
3. Click **Install Plugin**
4. Enter one of the following URLs:

**Show Hidden Channels:**
```
https://colin-os.github.io/bound-plugins/show-hidden-channels
```

**Mobile Webhooks:**
```
https://colin-os.github.io/bound-plugins/mobile-webhooks
```

### Building from Source

```bash
# Clone the repository
git clone https://github.com/colin-os/bound-plugins.git
cd bound-plugins

# Install dependencies (requires pnpm)
pnpm install

# Build all plugins
pnpm build

# Built plugins will be in the dist/ directory
```

## 🛠️ Development

This repository uses a pnpm monorepo structure for managing multiple plugins.

### Project Structure
```
bound-plugins/
├── plugins/
│   ├── show-hidden-channels/
│   │   ├── index.js
│   │   └── manifest.json
│   └── mobile-webhooks/
│       ├── index.js
│       └── manifest.json
├── build.mjs
├── package.json
└── pnpm-workspace.yaml
```

### Adding a New Plugin

1. Create a new directory in `plugins/`
2. Add `manifest.json` with plugin metadata
3. Add `index.js` with plugin code
4. Run `pnpm build` to compile

### Plugin Template

**manifest.json:**
```json
{
  "name": "Plugin Name",
  "description": "Plugin description",
  "authors": [
    {
      "name": "Your Name",
      "id": "your-discord-id"
    }
  ],
  "main": "index.js",
  "vendetta": {
    "icon": "icon-name"
  }
}
```

**index.js:**
```javascript
export default {
    onLoad: () => {
        // Plugin initialization
    },
    onUnload: () => {
        // Cleanup
    }
};
```

## 🤝 Contributing

Contributions are welcome! Feel free to:

- Report bugs via [Issues](https://github.com/colin-os/bound-plugins/issues)
- Submit pull requests with improvements
- Suggest new plugin ideas
- Improve documentation

## ⚠️ Disclaimer

These plugins are designed for educational purposes and to enhance user experience. Use at your own risk. Modifying Discord clients may violate Discord's Terms of Service.

## 📄 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Revenge](https://github.com/revenge-mod) - The mod framework these plugins are built for
- [Vendetta](https://github.com/vendetta-mod) - Original inspiration and compatibility
- Template based on [Nrwh1/revenge-plugin](https://github.com/Nrwh1/revenge-plugin)

---

<p align="center">
  Made with ❤️ for the Discord modding community
</p>
