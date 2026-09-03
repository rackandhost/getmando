<p align="center">
  <img alt="getMando" width="160" src="public/img/mando.png" />
  <br>
  <em>Mando</em>
  <br>
  <em>A simply and beautiful dashboard</em>
</p>

![Version](https://badgen.net/github/release/rackandhost/getmando/stable)
![Angular](https://img.shields.io/badge/Angular-21.1.0-red)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)
![Github stars](https://badgen.net/github/stars/rackandhost/getmando?icon=github&label=stars)
![Github last-commit](https://img.shields.io/github/last-commit/rackandhost/getmando)
![Github last-commit](https://badgen.net/github/license/rackandhost/getmando)

---

<img alt="Dashboard" width="1024" src="screenshots/dashboard.png" />

<img alt="Dashboard Light" width="1024" src="screenshots/dashboard_light.png" />

## 📖 Overview

**Mando** is a beautiful and simply dashboard (not pretend to add too many features such a widgets, weather, etc...) for your self-hosted applications. Built with modern web technologies, it provides an elegant glassmorphism UI to organize and access all your homelab services from a single place. 

### ✨ Key Features

- **🎨 Inspiring Design** - Minimalist interface with glassmorphism effects
- **⚡ Fast & Lightweight** - Built with Angular 21 and TailwindCSS 4 for optimal performance
- **🔍 Real-time Search** - Instant search through your applications
- **🏷️ Categories** - Organize your apps into customizable categories
- **🔗 Web Search Integration** - Built-in support for Google, DuckDuckGo, Startpage, and YouTube
- **📱 Fully Responsive** - Optimized for mobile, tablet, and desktop
- **♿ Accessible** - WCAG AA compliant with keyboard navigation
- **🐳 Docker Ready** - Easy deployment with pre-built containers
- **⚙️ YAML Configuration** - Simple, declarative configuration file
- **🛠️ Visual Configurator** - Build and edit `dashboard.yaml` through accessible forms at `/configure`, no hand-editing required

---

## 🚀 Quick Start (Docker)

### Using Docker Compose (Recommended)

1. **Create and customize the `dashboard.yaml`** file with all your data and settings.
```yaml
metadata:
  title: 'My dashboard'
  description: 'Simply and lovelly'

categories:
  - id: 'media'
    name: 'Media'

  - id: 'productivity'
    name: 'Productivity'

  - id: 'home-automation'
    name: 'Home Automation'

  - id: 'networking'
    name: 'Networking'

applications:
  - id: 'plex'
    name: 'Plex'
    description: 'Media server for movies, TV shows, and music'
    url: 'https://plex.example.com'
    icon:
      type: 'name'
      value: 'plex'
    category: 'media'
    openNewTab: true
    favorite: true
    tags:
      - media
      - streaming

  - id: 'jellyfin'
    name: 'Jellyfin'
    description: 'Free software media system'
    url: 'https://jellyfin.example.com'
    icon:
      type: 'name'
      value: 'jellyfin'
    category: 'media'
    openNewTab: true
    tags:
      - media
      - open-source

  - id: 'ombi'
    name: 'Ombi'
    description: 'Request media for your Plex/Jellyfin server'
    url: 'https://ombi.example.com'
    icon:
      type: 'name'
      value: 'ombi'
    category: 'media'
    openNewTab: true
    tags:
      - requests
      - media

  - id: 'nextcloud'
    name: 'Nextcloud'
    description: 'Productivity platform for file storage and collaboration'
    url: 'https://nextcloud.example.com'
    icon:
      type: 'name'
      value: 'nextcloud'
    category: 'productivity'
    openNewTab: true
    tags:
      - cloud
      - files

  - id: 'paperless-ngx'
    name: 'Paperless-ngx'
    description: 'Document management system'
    url: 'https://paperless.example.com'
    icon:
      type: 'name'
      value: 'paperless-ngx'
    category: 'productivity'
    openNewTab: true
    tags:
      - documents
      - scanning

  - id: 'home-assistant'
    name: 'Home Assistant'
    description: 'Open source home automation platform'
    url: 'https://homeassistant.example.com'
    icon:
      type: 'name'
      value: 'home-assistant'
    category: 'home-automation'
    openNewTab: true
    tags:
      - smart-home
      - automation

  - id: 'mosquitto'
    name: 'Mosquitto'
    description: 'MQTT message broker'
    url: 'https://mosquitto.example.com'
    icon:
      type: 'name'
      value: 'mosquitto'
    category: 'home-automation'
    openNewTab: true
    tags:
      - iot
      - mqtt

  - id: 'portainer'
    name: 'Portainer'
    description: 'Docker management UI'
    url: 'https://portainer.example.com'
    icon:
      type: 'name'
      value: 'portainer'
    category: 'networking'
    openNewTab: true
    tags:
      - docker
      - containers

  - id: 'pihole'
    name: 'Pi-hole'
    description: 'Network-wide ad blocking'
    url: 'https://pihole.example.com'
    icon:
      type: 'name'
      value: 'pi-hole'
    category: 'networking'
    openNewTab: true
    tags:
      - dns
      - adblock

  - id: 'uptime-kuma'
    name: 'Uptime Kuma'
    description: 'Self-hosted monitoring tool'
    url: 'https://uptime.example.com'
    icon:
      type: 'name'
      value: 'uptime-kuma'
    category: 'networking'
    openNewTab: true
    tags:
      - monitoring
      - uptime

bookmarks:
  - id: 'google'
    name: 'Google'
    description: 'The google web'
    url: 'https://google.com'
    openNewTab: true
    icon:
      type: 'name'
      value: 'google'
    tags:
      - web

settings:
  theme: 'auto'
  dateFormat: 'd MMMM yyyy'
  datePosition: 'bottom'
  showSeconds: false
  showDate: true
  itemsPerRow: 5
  allowBookmarks: true
  showAllCategory: true
  showDescriptions: true
  showLabels: true
  searchEngines:
    - 'google'
    - 'duckduckgo'
    - 'startpage'
    - 'youtube'

```

2. **Create the `docker-compose.yaml` file:**
 ```yaml
services:
  dashboard:
    image: ghcr.io/rackandhost/getmando:latest
    container_name: getmando-dashboard
    ports:
      - '8080:80'
    volumes:
      # Mount your local dashboard.yaml config
      - ./config/dashboard.yaml:/app/config/dashboard.yaml:ro
      - ./my-custom-image.jpg:/app/img/my-custom-image.jpg:ro # Use this if you want to set a custom background
    restart: unless-stopped
    environment:
      - NODE_ENV=production
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 5s
    networks:
      - dashboard-network

networks:
  dashboard-network:
    driver: bridge

 ```
3. **Run `docker compose up -d`**

4. **Access your dashboard:**
   Open your browser and navigate to `http://localhost:8080`

### Using Docker CLI

```bash
docker run -d \
  --name getmando-dashboard \
  -p 8080:80 \
  -v $(pwd)/config/dashboard.yaml:/app/config/dashboard.yaml:ro \
  --restart unless-stopped \
  ghcr.io/rackandhost/getmando:latest
```

---

## ⚙️ Configuration

The dashboard is configured via a single `dashboard.yaml` file. This file is automatically loaded when the application starts.

### Configurator export

The `/configure` editor validates a draft before copying it to the clipboard or downloading it as
`dashboard.yaml`. Export happens entirely in the browser; it never writes the mounted configuration
or sends generated YAML to a server.

Valid configurations must use IDs that are unique across categories, applications, and bookmarks.
Application `category` values must refer to an existing category ID, and category IDs must not be
`apps`, `bookmarks`, or `favorites` because those are reserved virtual categories. Exported YAML is
normalized to the supported schema and field order. Comments, original formatting, and unknown keys
are not preserved, and schema defaults can be written explicitly in the output.

### YAML Structure Overview

```yaml
metadata:           # Dashboard metadata
categories:         # Your app categories
applications:       # Your self-hosted applications
bookmarks:          # Quick-access bookmarks
settings:           # Dashboard settings
```

---

### 📋 Configuration Reference

#### `metadata` - Dashboard Information

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `title` | `string` | ✅ Yes | - | Dashboard title displayed in header |
| `description` | `string` | ✅ Yes | - | Short description or tagline |

**Example:**
```yaml
metadata:
  title: 'My Homelab'
  description: 'All my self-hosted services'
```

---

#### `categories` - App Categories

Each category needs:
| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | `string` | ✅ Yes | - | Unique identifier (used by apps) |
| `name` | `string` | ✅ Yes | - | Display name |

Category IDs must be unique across the whole configuration. Do not use `apps`, `bookmarks`, or
`favorites`; the dashboard reserves those IDs for virtual categories.

**Example:**
```yaml
categories:
  - id: 'media'
    name: 'Media'
  - id: 'productivity'
    name: 'Productivity'
  - id: 'home-automation'
    name: 'Home Automation'
  - id: 'networking'
    name: 'Networking'
```

---

#### `applications` - Your Self-Hosted Apps

Each application supports:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | `string` | ✅ Yes | - | Unique identifier |
| `name` | `string` | ✅ Yes | - | App display name (max 100 chars) |
| `description` | `string` | ✅ Yes | - | Short description (max 255 chars) |
| `url` | `string` (URL) | ✅ Yes | - | Full URL to the application |
| `icon` | `object` | ✅ Yes | - | Icon configuration (see below) |
| `category` | `string` | ✅ Yes | - | Category ID to belong to |
| `openNewTab` | `boolean` | No | `true` | Open in new tab or same window |
| `tags` | `array[string]` | No | `[]` | Searchable tags |
| `favorite` | `boolean` | No | `false` | Mark as favorite and show in Favorites category |

Application IDs must be unique across the whole configuration, and every `category` value must
match a declared category ID.

**Icon Configuration:**

The `icon` object supports three types:

| Type | Value | Description |
|------|-------|-------------|
| `name` | `{ type: 'name', value: 'plex' }` | Use icon by name (see [haroeris01/walkxcode-dashboard-icons](https://github.com/haroeris01/walkxcode-dashboard-icons/blob/main/ICONS.md)) |
| `url` | `{ type: 'url', value: 'https://...' }` | Use custom URL for icon |
| `initials` | `{ type: 'initials', value: 'AB' }` | Generate icon from initials |

**Example:**
```yaml
applications:
  - id: 'plex'
    name: 'Plex'
    description: 'Media server for movies, TV shows, and music'
    url: 'https://plex.example.com'
    icon:
      type: 'name'
      value: 'plex'
    category: 'media'
    openNewTab: true
    favorite: true
    tags:
      - media
      - streaming

  - id: 'nextcloud'
    name: 'Nextcloud'
    description: 'Productivity platform for file storage and collaboration'
    url: 'https://nextcloud.example.com'
    icon:
      type: 'name'
      value: 'nextcloud'
    category: 'productivity'
    openNewTab: true
    tags:
      - cloud
      - files

  - id: 'custom-app'
    name: 'Custom App'
    description: 'App with custom icon'
    url: 'https://custom.example.com'
    icon:
      type: 'url'
      value: 'https://example.com/icon.png'
    category: 'networking'
    openNewTab: true
    tags:
      - custom
```

---

#### `bookmarks` - Quick Access Bookmarks

Bookmarks work exactly like applications but don't require a category.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | `string` | ✅ Yes | - | Unique identifier |
| `name` | `string` | ✅ Yes | - | Bookmark name (max 100 chars) |
| `description` | `string` | ✅ Yes | - | Short description (max 255 chars) |
| `url` | `string` (URL) | ✅ Yes | - | Full URL |
| `icon` | `object` | ✅ Yes | - | Icon configuration (same as apps) |
| `openNewTab` | `boolean` | No | `true` | Open in new tab |
| `tags` | `array[string]` | No | `[]` | Searchable tags |

Bookmark IDs must also be unique across categories, applications, and bookmarks.

**Example:**
```yaml
bookmarks:
  - id: 'google'
    name: 'Google'
    description: 'The search engine'
    url: 'https://google.com'
    openNewTab: true
    icon:
      type: 'name'
      value: 'google'
    tags:
      - web
```

---

#### `settings` - Dashboard Settings

| Field                  | Type            | Default          | Options                 | Description                                   |
|------------------------|-----------------|------------------|-------------------------|-----------------------------------------------|
| `theme`                | `string`        | `auto`           | `auto`, `light`, `dark` | Set dark and light mode                       |
| `dateFormat`           | `string`        | `dd-MM-yyyy`     | Any format              | Date format for clock display                 |
| `datePosition`         | `string`        | `top`            | `top`, `bottom`         | Clock date position                           |
| `showSeconds`          | `boolean`       | `false`          | -                       | Show seconds in clock                         |
| `showDate`             | `boolean`       | `false`          | -                       | Show date in clock                            |
| `itemsPerRow`          | `number`        | `4`              | `1-12`                  | Number of apps per row on desktop             |
| `allowBookmarks`       | `boolean`       | `false`          | -                       | Enable bookmarks section                      |
| `showAllCategory`      | `boolean`       | `true`           | -                       | Show "All" category filter                    |
| `showDescriptions`     | `boolean`       | `true`           | -                       | Show app descriptions in cards                |
| `showLabels`           | `boolean`       | `true`           | -                       | Show app tags as labels                       |
| `searchEngines`        | `array[string]` | `[]`             | See below               | Available search engines                      |
| `lightBackgroundImage` | `string`        | `background.jpg` | -                       | Custom image or url as light theme background |
| `darkBackgroundImage`  | `string`        | `background.jpg` | -                       | Custom image or url as dark theme background  |

**Search Engine Options:**
- `google` - Google Search
- `duckduckgo` - DuckDuckGo
- `startpage` - Startpage
- `youtube` - YouTube

**Example:**
```yaml
settings:
  theme: 'auto'
  dateFormat: 'd MMMM yyyy'
  datePosition: 'bottom'
  showSeconds: false
  showDate: true
  itemsPerRow: 5
  allowBookmarks: true
  showAllCategory: true
  showDescriptions: true
  showLabels: true
  lightBackgroundImage: 'my-custom-background.jpg' # Or 'https://domain.tld/my-custom-image.jpg'
  darkBackgroundImage: 'my-custom-background.jpg' # Or 'https://domain.tld/my-custom-image.jpg'
  searchEngines:
    - 'google'
    - 'duckduckgo'
    - 'youtube'
```

---

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `production` | Environment mode |

---

## 🔧 Development

### Prerequisites

- Node.js 22 LTS (recommended; matches the version used in CI)
- npm 11+

GitHub Actions CI runs on Node.js 22 LTS, and using the same version locally is recommended.

### Setup

```bash
# Clone the repository
git clone https://github.com/rackandhost/getmando.git
cd getmando

# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build

# Run lint checks
npm run lint

# Check source formatting
npm run format:check

# Run tests
npm test
```

`npm test` includes axe-core accessibility assertions for the rendered `app-finder`, `app-card`, `app-categories`, and `dashboard` states covered by the component specs, so the existing CI test job fails on violations found in those checks. The shared jsdom helper currently disables axe's `color-contrast` rule because that rule needs browser APIs that are not reliably available in this test environment.

`npm install` runs the Husky `prepare` script automatically. The pre-commit hook uses `lint-staged` to lint staged TypeScript and format staged TypeScript, HTML, and SCSS files under `src/`. The formatting scripts and CI check use that same source-only scope.

### Development Server

The dev server runs on `http://localhost:4200` with hot-reload enabled.

### Building for Production

```bash
npm run build
```

Build artifacts are created in the `dist/` directory.

---

## 🐳 Docker Image Details

### Container Features

- ✅ Optimized image size
- ✅ Security headers enabled
- ✅ Gzip compression
- ✅ Long-term caching for static assets
- ✅ Mountable config volume
- ✅ Health checks

---

## 📊 Performance

| Metric | Value |
|--------|-------|
| Initial Load | <2s |
| Search Latency | <50ms |
| Bundle Size (gzipped) | <500KB |
| Lighthouse Score | >85 |
| WCAG Compliance | AA |

---

## 🗺️ Roadmap

### Current Release (v1.1.0)
- ✅ Core dashboard functionality
- ✅ YAML configuration
- ✅ Search and filtering
- ✅ Search engines
- ✅ Docker deployment
- ✅ Custom background image
- ✅ Dark/light mode
- ✅ Different images for Dark/light mode
- ✅ Favorites support
- ✅ Comprehensive test suite

### Planned Features
- [ ] Add DB feature to allow user be able to choose between .yaml configuration or DB
- [ ] Statistics/analytics when DB feature are available
- [ ] Backup/restore configurations
- [ ] Wiki

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

### Development Guidelines

- Read [ARCHITECTURE.md](ARCHITECTURE.md) for the current system flows, ownership boundaries, and
  change map.
- Follow Angular best practices
- Use TypeScript strict mode
- Write tests for new features
- Do not commit focused tests such as `.only`, `fit`, or `fdescribe`; CI fails fast on them
- Run `npm run lint` before opening a pull request
- Run `npm run format:check` to verify source formatting before opening a pull request
- Ensure accessibility (WCAG AA)
- Keep axe-core component accessibility checks passing; they run as part of `npm test` for the covered component states, with `color-contrast` excluded in jsdom
- Keep components small and focused

---

## 📝 License

This project is licensed under the GNU General Public License v3.0 - see the LICENSE file for details.

---

## 🙏 Acknowledgments

- Built with [Angular](https://angular.dev/)
- Styled with [TailwindCSS](https://tailwindcss.com/)
- Icons from [ng-icons](https://ng-icons.github.io/ng-icons/)
- App Icons from [haroeris01/walkxcode-dashboard-icons](https://github.com/haroeris01/walkxcode-dashboard-icons)

---

## 📮 Support

- 🐛 **Bug Reports:** [GitHub Issues](https://github.com/rackandhost/getmando/issues)
- 💡 **Feature Requests:** [GitHub Discussions](https://github.com/rackandhost/getmando/discussions)

<div align="center">
  Built with ❤️ for the homelab community
</div>
