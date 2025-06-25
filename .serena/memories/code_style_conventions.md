# Nova Code Style and Conventions

## TypeScript Configuration
- Strict mode enabled with `noImplicitAny: true`
- ES6 target with ESNext modules
- Path aliases: `@/*` maps to `src/*`
- Inline source maps for debugging

## Naming Conventions
- **Classes**: PascalCase (e.g., `NovaPlugin`, `ConversationManager`)
- **Interfaces**: PascalCase (e.g., `AIProvider`, `NovaSettings`)
- **Methods**: camelCase (e.g., `loadSettings`, `activateView`)
- **Properties**: camelCase (e.g., `aiProviderManager`, `conversationManager`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `VIEW_TYPE_NOVA_SIDEBAR`, `NOVA_ICON_SVG`)
- **Files**: kebab-case (e.g., `conversation-manager.ts`, `provider-manager.ts`)

## Code Organization
- **Main entry**: `main.ts` with `NovaPlugin` class
- **Core logic**: `src/core/` directory
- **UI components**: `src/ui/` directory  
- **AI providers**: `src/ai/providers/` directory
- **Tests**: `test/` directory with same structure as `src/`
- **Types**: Separate `types.ts` files in each module

## Import Style
- Use destructured imports from Obsidian API
- Import custom modules with relative paths
- Group imports: Obsidian API first, then custom modules

## Class Structure
- Properties declared first (typed with `!` assertion for initialization in onload)
- Methods follow properties
- Private methods use `private` modifier and camelCase