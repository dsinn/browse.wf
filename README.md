# browse.wf

A search engine for Warframe game data, allowing users to browse and search through space ninja information.

This is a fork of Sainan-senpai's [calamity-inc/browse.wf](https://github.com/calamity-inc/browse.wf).

## Fork features and changes

### For Warframe players

- **Cloud sync**: Discord authentication with a database backend for backing up preferences and syncing across devices
- **Custom Arby's timers**: Set custom countdown timers on the arbitration schedule page
- **Navbar customization**: Optional setting to unfix the navbar

#### Live page

- **Widget filters**: Configurable filter panels to selectively display content; for example:
  - News: Filters for red text, community events, and regular events
  - Bounties: Filter by tier for each syndicate
  - Steel Path incursions: Filter by mission type
- **Improved void fissures UI**: Enhanced layout, sorted by expiry for each relic tier/era
- **Enhanced invasion info**: Populated with and sorted by progress data
- **Notification icons**: Bells now use a colour/fill pattern (coloured when enabled, grayscale when disabled) instead of bell/bell-slash icons, matching more modern UX patterns.
- **Cross-platform UI**: System-independent checkbox styling

### For developers

- **GitHub Pages deployment**: Automated workflow for deploying static builds to GitHub Pages
- **Automated testing**: Vitest and Playwright test infrastructure (mainly for the `/live` page so far)

## Tech Stack

- **Backend**: PHP
- **Frontend**: TypeScript, Bootstrap
- **Build Tool**: php-ts-dev (combines PHP development server with TypeScript watch mode)
- **Testing**: Vitest + jsdom (unit), Playwright (E2E)
- **Dependencies**:
  - Bootstrap (CSS framework)
  - Showdown (Markdown parser)
  - warframe-public-export-plus (Warframe game data)

## Prerequisites

Before running this application locally, ensure you have the following installed:

- [PHP](https://www.php.net/downloads)
- [Node.js](https://nodejs.org/) (includes npm)

## Installation

1. Clone the fork:
   ```bash
   git clone https://github.com/dsinn/browse.wf.git
   cd browse.wf
   ```

2. Install npm dependencies:
   ```bash
   npm install
   ```

## Running the Application

1. Start the development server:
   ```bash
   npm run dev
   ```

   Or with a custom port:
   ```bash
   PORT=8080 npm run dev
   ```

   This command will:
   - Start a PHP development server (default port: 60969)
   - Watch TypeScript files and automatically compile them to JavaScript
   - Output compiled files to the `typestripped/` directory
   - Automatically reload the browser when files change

2. Open your browser and navigate to http://127.0.0.1:60969 (or your custom port)

3. The application should display with the message: "It's like a search engine, but for space ninjas."

## Development

- TypeScript source files (`.ts`) are compiled to JavaScript in the `typestripped/` directory
- The development server watches for changes and automatically recompiles TypeScript files
- PHP files are served directly by the PHP development server
- The app uses Bootstrap's dark theme by default
- The server runs on a fixed port (60969) to preserve localStorage data across restarts
- localStorage is used to store user inventory, notification preferences, and language settings

### Testing

The project uses two types of automated tests:

```bash
npm test              # Run unit tests (Vitest)
npm run test:e2e      # Run E2E tests (Playwright)
```

For more commands, debugging options, and testing strategies, see [test/README.md](test/README.md).

### Cloud Sync (Optional)

This app stores all preferences locally in your browser by default. Cloud sync uses Discord for authentication, and the instructions below are tailored for Supabase as the storage backend.

If you want to enable cloud sync to backup preferences and sync across devices:

1. **Create a database project** at https://supabase.com
   - Get your Project URL and anon key from Project Settings → API
   - Expose the "public" schema in Settings → API → "Extra exposed schemas" (add `public` to the list)
   - Run `cloud-sync-schema.sql` in the SQL Editor to create the database schema
   - Enable Realtime for the `user_data` table in Database → Replication (for instant cross-device sync)
   - Configure redirect URLs in Authentication → URL Configuration:
     - Set **Site URL** to your production URL (e.g., `https://dsinn.github.io`)
     - Add **Redirect URLs**: `https://dsinn.github.io/browse.wf/**` for production, `http://127.0.0.1:60969/**` for local dev
   - Optional: Disable the email provider in Authentication → Providers (security best practice since we only use Discord)
   - Optional: Lower JWT expiry in Authentication → Settings to reduce the risk window during OAuth sign-in (tokens briefly appear in the browser's URL bar before automatic cleanup; shorter expiry limits how long captured tokens remain valid without affecting session length)

2. **Set up Discord OAuth** at https://discord.com/developers/applications
   - Create a new application
   - Add your Supabase callback URL to OAuth2 redirects
   - Connect Discord to Supabase in Authentication → Providers

3. **Configure environment variables**:
   - Copy `.env.example` to `.env`
   - Add your Supabase credentials
   - For deployment, add them to GitHub Secrets

For detailed setup instructions, see:
- [Supabase Auth with Discord](https://supabase.com/docs/guides/auth/social-login/auth-discord)
- [Discord OAuth2 Documentation](https://discord.com/developers/docs/topics/oauth2)

**Privacy:** Only your app preferences are stored. No email addresses, names, or personal information.

## Project Structure

- `*.php` - PHP page templates
- `*.ts` - TypeScript source files
- `typestripped/` - Compiled JavaScript output (generated, do not edit)
- `components/` - Reusable PHP components (navbar, common JS includes)
- `supplemental-data/` - Additional game data and utilities

## Available Scripts

- `npm run dev` - Start development server with TypeScript watch mode
- `npm run lint` - Run ESLint on TypeScript files
- `npm test` - Run unit tests (Vitest)
- `npm run test:e2e` - Run E2E tests (Playwright)
- `npm run build` - Build static site for GitHub Pages deployment

See [test/README.md](test/README.md) for additional test commands.

## Deployment

This fork can be deployed to GitHub Pages using the included workflow.

### Manual Deployment

1. Build the static site locally:
   ```bash
   npm run build
   ```
   This compiles TypeScript, renders all PHP files to HTML, and prepares assets in the `dist/` directory.

2. The build script automatically:
   - Compiles TypeScript to JavaScript (`typestripped/`)
   - Renders all PHP files to static HTML
   - Rewrites paths for the `/browse.wf/` base path
   - Copies all necessary assets (JS, data files, etc.)

### GitHub Actions Deployment

Deploy to GitHub Pages via GitHub Actions:

1. Go to your repository's **Actions** tab
2. Select **Deploy to GitHub Pages** workflow
3. Click **Run workflow**
4. Site will be available at: `https://<username>.github.io/browse.wf/`

The workflow is manually triggered only. It builds the site and pushes to the `gh-pages` branch.

## Notes

- The development server runs on port 60969 by default (configurable via `PORT` environment variable)
- TypeScript compilation happens automatically in watch mode
- Source maps are generated for easier debugging
- Using a fixed port ensures localStorage data (inventory, preferences) persists across server restarts

## Example Git Hooks

These mirror the checks that run in CI.

### `.git/hooks/pre-commit`

```shell
#!/bin/bash
set -e

echo "Running pre-commit checks..."

echo "→ Linting TypeScript files..."
npm run lint

echo "→ Type checking..."
npm exec tsc

echo "✓ Pre-commit checks passed"
```

### `.git/hooks/pre-push`

```shell
#!/bin/bash
set -e

echo "Running pre-push checks..."

echo "→ Running tests..."
npm test -- --run --reporter=dot --silent

echo "→ Testing build..."
npm run build

echo "✓ Pre-push checks passed"
```
