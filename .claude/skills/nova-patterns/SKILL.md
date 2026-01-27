---
name: nova-patterns
description: Nova plugin coding standards, compliance rules, and design patterns. Manually maintained reference for development.
---

# Nova Development Patterns

Nova is an AI writing plugin for Obsidian that enables direct, in-place editing. This skill documents its coding standards, compliance rules, and design patterns.

## Core Philosophy

- **Direct document manipulation**: Edits happen in documents, not external interfaces
- **Surgical precision**: AI edits exactly where users specify
- **Event-driven architecture**: Components communicate via StateManager events
- **Privacy-first**: Local AI emphasis, user controls their API keys
- **Streaming-first**: All AI operations support streaming for responsive UX

## File Header Standard

All TypeScript files MUST have a standardized header comment:

```typescript
/**
 * @file ModuleName - One-line description of purpose
 */
```

This enables automated codebase documentation. Run `/project:sync-codebase` after adding new files.

## State Management

Nova uses event-driven architecture via StateManager. Components NEVER call methods on each other directly.

```typescript
// CORRECT: Event-driven communication
this.stateManager.emit('conversation-updated', { conversationId, messages });
this.stateManager.on('conversation-updated', (data) => this.handleUpdate(data));

// WRONG: Direct coupling
this.sidebarView.refreshConversation(conversationId);
this.conversationManager.getConversation();
```

### Key Events
| Event | Payload | Description |
|-------|---------|-------------|
| `conversation-updated` | `{ conversationId, messages }` | Conversation state changed |
| `provider-changed` | `{ provider, model }` | AI provider switched |
| `context-updated` | `{ documents, tokens }` | Document context modified |
| `streaming-start` | `{ messageId }` | AI response streaming begins |
| `streaming-end` | `{ messageId, content }` | AI response complete |
| `streaming-error` | `{ messageId, error }` | Streaming failed |

## Obsidian Compliance (BLOCKING)

These patterns will **REJECT plugin store submission**:

| NEVER | ALWAYS |
|-------|--------|
| `addEventListener()` | `this.registerDomEvent()` |
| `setTimeout()` unregistered | `TimeoutManager.addTimeout()` |
| `setInterval()` unregistered | `this.registerInterval()` |
| `innerHTML`/`outerHTML` | DOM API (`createEl`, `setText`) |
| `fetch()` | `requestUrl()` |
| `vault.modify()` | Editor API (`editor.replaceRange()`) |
| `activeLeaf` | `getActiveViewOfType(MarkdownView)` |
| `console.log` in production | `Logger` utility |

## Component Patterns

### UI Components (`src/ui/`)

```typescript
export class MyComponent {
  private plugin: NovaPlugin;
  private stateManager: StateManager;
  private containerEl: HTMLElement;

  constructor(plugin: NovaPlugin, containerEl: HTMLElement) {
    this.plugin = plugin;
    this.containerEl = containerEl;
    // NO side effects in constructor - no DOM, no events, no API calls
  }

  async init(): Promise<void> {
    // All setup happens here
    this.buildUI();
    this.registerEvents();
    this.subscribeToState();
  }

  private buildUI(): void {
    // Use Obsidian's DOM helpers
    const header = this.containerEl.createEl('div', { cls: 'nova-header' });
    header.setText('Title');
  }

  private registerEvents(): void {
    // ALWAYS use plugin registration for automatic cleanup
    this.plugin.registerDomEvent(this.containerEl, 'click', (e) => {
      this.handleClick(e);
    });
  }

  private subscribeToState(): void {
    // Subscribe to StateManager events
    this.stateManager.on('conversation-updated', (data) => {
      this.refresh(data);
    });
  }

  destroy(): void {
    // Usually empty - registration handles cleanup
    // Only needed for non-registered resources
  }
}
```

### Core Services (`src/core/`)

Services handle business logic and expose functionality via events:

```typescript
export class MyService {
  private stateManager: StateManager;

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager;
  }

  async performAction(params: ActionParams): Promise<Result> {
    try {
      const result = await this.doWork(params);

      // Notify via events, don't return and expect caller to update UI
      this.stateManager.emit('action-completed', { result });

      return result;
    } catch (error) {
      Logger.error('Action failed', { error, params });
      this.stateManager.emit('action-failed', { error });
      throw error;
    }
  }
}
```

### AI Providers (`src/ai/providers/`)

All providers implement a common interface:

```typescript
interface AIProvider {
  name: string;

  generateResponse(
    messages: ConversationMessage[],
    options: GenerationOptions
  ): AsyncGenerator<StreamingResponse>;

  getModelInfo(): ModelInfo;
  validateApiKey(): Promise<boolean>;
  getContextLimit(): number;
}

// Usage in streaming
async *generateResponse(messages, options) {
  for await (const chunk of this.callAPI(messages)) {
    yield {
      type: 'content',
      content: chunk.text,
      finished: chunk.done
    };
  }
}
```

## Timer Management

Nova uses `TimeoutManager` for Obsidian-compliant timeout handling:

```typescript
import { TimeoutManager } from '../utils/timeout-manager';

// WRONG: Unregistered timeout
setTimeout(() => this.doSomething(), 1000);

// CORRECT: Registered timeout with cleanup
TimeoutManager.addTimeout(
  this.plugin,
  () => this.doSomething(),
  1000,
  'optional-id-for-cancellation'
);

// Cancel a specific timeout
TimeoutManager.clearTimeout('optional-id-for-cancellation');

// For intervals (recurring)
this.plugin.registerInterval(
  window.setInterval(() => this.poll(), 5000)
);
```

## Logging

Use the Logger utility, never `console.log`:

```typescript
import { Logger } from '../utils/logger';

// Levels: debug, info, warn, error
Logger.debug('Detailed info', { context });
Logger.info('Normal operation', { data });
Logger.warn('Potential issue', { warning });
Logger.error('Failed operation', { error, context });

// In production, debug is suppressed
// Console.log is NEVER acceptable
```

## Error Handling Pattern

```typescript
async performRiskyOperation(): Promise<void> {
  try {
    await this.riskyCall();
  } catch (error) {
    // 1. Log with context
    Logger.error('Operation failed', {
      error,
      operation: 'riskyCall',
      context: this.getContext()
    });

    // 2. User-friendly notification
    new Notice('Something went wrong. Please try again.');

    // 3. Emit error event for interested components
    this.stateManager.emit('operation-error', { error });

    // 4. Re-throw only if caller needs to handle
    throw error;
  }
}
```

## File Conventions

| Type | Convention | Example |
|------|------------|---------|
| Classes | PascalCase | `StreamingManager` |
| Interfaces | PascalCase, prefix I optional | `AIProvider` or `ISettings` |
| Functions/Methods | camelCase | `handleClick()` |
| Variables | camelCase | `currentMessage` |
| Constants | SCREAMING_SNAKE | `MAX_CONTEXT_TOKENS` |
| Files | kebab-case | `streaming-manager.ts` |
| CSS Classes | BEM-ish with nova prefix | `nova-sidebar__header` |

## Testing Patterns

Location: `test/`

```typescript
// File: component-name.test.ts
describe('ComponentName', () => {
  let component: ComponentName;
  let mockPlugin: jest.Mocked<NovaPlugin>;

  beforeEach(() => {
    mockPlugin = createMockPlugin();
    component = new ComponentName(mockPlugin);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // CORRECT: Behavior-focused test names
  it('should persist conversation state between sessions', async () => {
    // Arrange
    const conversation = createTestConversation();

    // Act
    await component.saveConversation(conversation);
    const loaded = await component.loadConversation(conversation.id);

    // Assert
    expect(loaded).toEqual(conversation);
  });

  // WRONG: Implementation-focused
  it('should call saveData method', () => { /* ... */ });
});
```

### Mock Patterns

See `test/__mocks__/` for consistent Obsidian API mocks:
- `obsidian.ts` - Core Obsidian mocks
- `workspace.ts` - Workspace and view mocks
- `vault.ts` - File system mocks

## Intent Detection

The `IntentDetector` classifies user input into categories:

```typescript
type Intent =
  | 'CONTENT'   // Add/edit document content at cursor
  | 'METADATA'  // Modify tags, frontmatter, properties
  | 'CHAT'      // Conversational response, no document edit
  | 'COMMAND';  // Explicit command execution

// Examples:
// "add a conclusion here" -> CONTENT
// "add tags: productivity" -> METADATA
// "what should I write about?" -> CHAT
// "/expand-outline" -> COMMAND
```

## Streaming Infrastructure

The `StreamingManager` handles real-time text generation:

```typescript
// Key features:
// - 60fps smooth updates
// - Automatic scroll following
// - Error recovery with partial content preservation
// - Cross-platform (desktop/mobile) optimization

await streamingManager.streamToEditor(
  aiStream,
  editor,
  {
    startPosition: cursor,
    enableAutoScroll: true,
    onError: (error) => this.handleStreamError(error)
  }
);
```

## Constants

All magic strings and selectors go in `src/constants.ts`:

```typescript
// CORRECT
import { CSS_CLASSES, EVENTS, TIMEOUTS } from '../constants';
element.addClass(CSS_CLASSES.SIDEBAR_HEADER);
this.stateManager.emit(EVENTS.CONVERSATION_UPDATED, data);

// WRONG
element.addClass('nova-sidebar-header');
this.stateManager.emit('conversation-updated', data);
```

## Quality Gates

All code must pass before merge:

```bash
npm run build          # 0 errors
npm test               # ALL tests pass (490+)
npx eslint src/        # 0 errors
```

---

*See also: `.claude/skills/nova-codebase/SKILL.md` for current file structure and exports.*
