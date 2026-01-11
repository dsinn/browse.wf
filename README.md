# browse.wf

A search engine for Warframe game data, allowing users to browse and search through space ninja information.

**Note:** This is a fork of [calamity-inc/browse.wf](https://github.com/calamity-inc/browse.wf).

## Tech Stack

- **Backend**: PHP
- **Frontend**: TypeScript, Bootstrap
- **Build Tool**: php-ts-dev (combines PHP development server with TypeScript watch mode)
- **Testing**: Vitest, @testing-library/dom, jsdom
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

Automated tests for the `/live` page use **Vitest** with jsdom for DOM testing.

```bash
npm test          # Run once
npm run test:ui   # Visual interface
```

See [test/README.md](test/README.md) for detailed testing documentation.

## Project Structure

- `*.php` - PHP page templates
- `*.ts` - TypeScript source files
- `typestripped/` - Compiled JavaScript output (generated, do not edit)
- `components/` - Reusable PHP components (navbar, common JS includes)
- `supplemental-data/` - Additional game data and utilities

## Available Scripts

- `npm run dev` - Start development server with TypeScript watch mode
- `npm run lint` - Run ESLint on TypeScript files
- `npm test` - Run automated tests
- `npm run test:ui` - Run tests with visual interface
- `npm run test:coverage` - Run tests with coverage report

## Notes

- The development server runs on port 60969 by default (configurable via `PORT` environment variable)
- TypeScript compilation happens automatically in watch mode
- Source maps are generated for easier debugging
- Using a fixed port ensures localStorage data (inventory, preferences) persists across server restarts
