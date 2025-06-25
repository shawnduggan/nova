# Nova Development Commands

## Build Commands
- `npm run dev` - Start development build with watch mode
- `npm run build` - Build for development (includes TypeScript check)
- `npm run build:prod` - Build for production

## Testing Commands
- `npm test` - Run all tests
- `npm run test:watch` - Run tests in watch mode

## Version Management
- `npm run version` - Bump version and update manifest.json/versions.json

## System Commands (macOS)
- `ls` - List directory contents
- `cd` - Change directory
- `grep` - Search text patterns
- `find` - Find files
- `git` - Git version control

## TypeScript Commands
- `tsc -noEmit -skipLibCheck` - Type check without output (used in build)

## Development Workflow
1. Make changes to TypeScript files in `src/`
2. Run `npm run build` to compile and check types
3. Run `npm test` to ensure tests pass
4. Test manually in Obsidian development environment

## File Structure
- Source files in `src/` directory
- Tests in `test/` directory
- Build output to `main.js`
- Entry point: `main.ts`