# Task Completion Guidelines for Nova

## Required Steps After Code Changes

### 1. Type Checking
Always run TypeScript compilation check:
```bash
npm run build
```
This runs `tsc -noEmit -skipLibCheck` to catch type errors without generating output.

### 2. Testing
Run the test suite to ensure no regressions:
```bash
npm test
```

### 3. Manual Testing
- Load the plugin in Obsidian development environment
- Test the specific functionality that was changed
- Verify both desktop and mobile compatibility if relevant

## No Linting/Formatting
- The project does not appear to have ESLint or Prettier configured
- Follow the existing code style conventions instead
- TypeScript strict mode catches most code quality issues

## Production Build
For final releases:
```bash
npm run build:prod
```

## Version Bumping
When releasing:
```bash
npm run version
```
This updates manifest.json and versions.json files automatically.

## File Validation
- Ensure all new files follow the established naming conventions
- Place files in appropriate directories (`src/core/`, `src/ui/`, etc.)
- Add appropriate TypeScript types and interfaces