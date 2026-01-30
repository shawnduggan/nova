---
name: nova-codebase
description: Auto-generated Nova codebase map. Regenerate with /project:sync-codebase
generated: 2026-01-30
---

# Nova Codebase Map

> This file is auto-generated. Do not edit manually.
> Regenerate with: `/project:sync-codebase`

## File Structure

### src/ai/

| File | Description | Key Exports |
|------|-------------|-------------|
| `context-limits.ts` | Token and context window limits per AI model | `ContextLimit`, `ProviderContextLimits`, `getContextLimit()`, `getProviderContextLimits()`, `getModelMaxOutputTokens()` |
| `models.ts` | Centralized model definitions for all AI providers | `ModelDefinition`, `ModelConfig`, `getProviderTypeForModel()`, `getAvailableModels()` |
| `provider-manager.ts` | Manages AI provider instances and model selection | `AIProviderManager` |
| `types.ts` | Type definitions for AI providers, messages, and streaming | `AIMessage`, `AIStreamResponse`, `AIProvider`, `AIGenerationOptions`, `ProviderConfig`, `ProviderType`, `PlatformSettings` |

### src/ai/providers/

| File | Description | Key Exports |
|------|-------------|-------------|
| `claude.ts` | Anthropic Claude API integration | `ClaudeProvider` |
| `google.ts` | Google Gemini API integration | `GoogleProvider` |
| `ollama.ts` | Local Ollama API integration | `OllamaProvider` |
| `openai.ts` | OpenAI GPT API integration | `OpenAIProvider` |

### src/core/

| File | Description | Key Exports |
|------|-------------|-------------|
| `ai-intent-classifier.ts` | AI-powered intent classification for ambiguous inputs | `UserIntent`, `AIIntentClassifier` |
| `command-parser.ts` | Parses user input into structured edit commands | `CommandParser` |
| `context-builder.ts` | Builds document context for AI prompts | `GeneratedPrompt`, `ContextBuilder` |
| `context-calculator.ts` | Calculates token usage and context limits | `ContextUsage`, `estimateTokens()`, `calculateContextUsage()`, `getContextWarningLevel()`, `formatContextUsage()`, `getContextTooltip()` |
| `conversation-manager.ts` | Manages file-scoped conversation storage | `DataStore`, `ConversationManager` |
| `crypto-service.ts` | Encrypts/decrypts sensitive data like API keys | `CryptoService` |
| `document-analysis.ts` | Analyzes document structure and metadata | `DocumentStructure`, `DocumentAnalyzer` |
| `document-engine.ts` | Central hub for all document manipulation | `DocumentEngine` |
| `intent-detector.ts` | Classifies user input as editing vs consultation | `IntentClassification`, `IntentDetector` |
| `prompt-builder.ts` | Builds system and user prompts for AI | `PromptBuilder` |
| `types.ts` | Type definitions for document editing and commands | `EditAction`, `EditCommand`, `DocumentContext`, `HeadingInfo`, `EditResult`, `ConversationMessage`, `ContextDocumentRef`, `ConversationData` |

### src/core/commands/

| File | Description | Key Exports |
|------|-------------|-------------|
| `add-command.ts` | Handles content insertion at cursor | `StreamingCallback`, `AddCommand` |
| `delete-command.ts` | Handles content removal | `DeleteCommand` |
| `edit-command.ts` | Handles in-place content modification | `EditCommand` |
| `grammar-command.ts` | Handles grammar and spelling corrections | `GrammarCommand` |
| `metadata-command.ts` | Handles frontmatter and tag modifications | `MetadataCommand` |
| `rewrite-command.ts` | Handles content rewriting with tone/style | `RewriteCommand` |
| `selection-edit-command.ts` | Handles editing selected text | `SelectionEditResult`, `SelectionEditCommand` |

### src/features/commands/

| File | Description | Key Exports |
|------|-------------|-------------|
| `constants.ts` | Constants for Nova Commands system | `INSIGHT_PANEL`, `MARGIN_INDICATORS`, `UI`, `COMMANDS`, `OPPORTUNITY_TITLES`, `CSS_CLASSES`, `CM_SELECTORS` |
| `types.ts` | Type definitions for the Nova Commands system | `MarkdownCommand`, `TemplateVariable`, `SmartContext`, `CommandExecutionContext`, `ExecutionOptions`, `CommandSuggestionsSettings`, `TimingDecision`, `TypingMetrics` |

### src/features/commands/core/

| File | Description | Key Exports |
|------|-------------|-------------|
| `CommandEngine.ts` | Core system for executing commands and the /fill command | `MarkerInsight`, `CommandEngine` |
| `SmartTimingEngine.ts` | Centralized timing service for command features | `TimingEvents`, `SmartTimingEngine` |
| `SmartVariableResolver.ts` | Intelligent resolution of template variables | `SmartVariableResolver` |

### src/features/commands/ui/

| File | Description | Key Exports |
|------|-------------|-------------|
| `InsightPanel.ts` | Full intelligence panel for command selection | `InsightPanel` |
| `MarginIndicators.ts` | Intelligent margin indicators for command suggestions | `MarginIndicators` |
| `codemirror-decorations.ts` | CodeMirror decorations for margin indicators | `addIndicatorEffect`, `removeIndicatorEffect`, `clearIndicatorsEffect` |

### src/licensing/

| File | Description | Key Exports |
|------|-------------|-------------|
| `feature-config.ts` | Time-gated feature configuration | `TimeGatedFeature`, `SUPERNOVA_FEATURES` |
| `feature-manager.ts` | Manages feature flags and Supernova access | `FeatureManager` |
| `license-validator.ts` | Validates Supernova license keys | `LicenseValidator` |
| `types.ts` | Type definitions for licensing system | `SupernovaLicense`, `SupernovaValidationResult`, `FeatureFlag`, `FeatureAccessResult`, `DebugSettings` |

### src/ui/

| File | Description | Key Exports |
|------|-------------|-------------|
| `chat-renderer.ts` | Renders conversation messages in sidebar | `ChatRenderer` |
| `command-system.ts` | Handles slash command detection and picker UI | `CommandSystem` |
| `context-manager.ts` | Manages multi-document context in sidebar | `DocumentReference`, `MultiDocContext`, `ContextManager` |
| `custom-command-modal.ts` | Modal for creating/editing custom commands | `CustomCommandModal` |
| `custom-instruction-modal.ts` | Modal for custom editing instructions | `CustomInstructionModal` |
| `input-handler.ts` | Handles text input and keyboard events | `InputHandler` |
| `provider-manager.ts` | UI components for provider/model selection | `ProviderManager` |
| `selection-context-menu.ts` | Context menu for text selection actions | `SelectionAction`, `SELECTION_ACTIONS`, `SelectionContextMenu` |
| `sidebar-view.ts` | Main sidebar view with chat interface | `VIEW_TYPE_NOVA_SIDEBAR`, `NovaSidebarView` |
| `streaming-manager.ts` | Manages AI response streaming to editor | `StreamingOptions`, `ActionType`, `StreamingManager` |
| `tone-selection-modal.ts` | Modal for selecting rewrite tone | `ToneOption`, `TONE_OPTIONS`, `ToneSelectionModal` |
| `wikilink-suggest.ts` | Autocomplete for [[wikilinks]] in input | `NovaWikilinkAutocomplete` |

### src/utils/

| File | Description | Key Exports |
|------|-------------|-------------|
| `logger.ts` | Centralized logging utility with levels | `Logger`, `ScopedLogger`, `LogLevel` |
| `timeout-manager.ts` | Obsidian-compliant timeout management | `TimeoutManager` |

### src/ (root)

| File | Description | Key Exports |
|------|-------------|-------------|
| `constants.ts` | Shared constants and magic strings | `NOVA_CONVERSATIONS_STORAGE_KEY`, `VIEW_TYPE_NOVA_SIDEBAR`, `NOVA_*`, `FEATURE_COMMANDS`, `PROVIDER_*` |
| `settings.ts` | Plugin settings UI and configuration | `CustomCommand`, `NovaSettings`, `DEFAULT_SETTINGS`, `NovaSettingTab` |

## Component Dependencies

### AI Layer (src/ai/)

**provider-manager.ts** imports from:
- `./types` - AIProvider, ProviderType, AIMessage, AIGenerationOptions, AIStreamResponse
- `./providers/claude`, `./providers/openai`, `./providers/google`, `./providers/ollama`
- `./models` - getProviderTypeForModel
- `./context-limits` - getModelMaxOutputTokens
- `../settings` - NovaSettings
- `../licensing/feature-manager` - FeatureManager
- `../utils/timeout-manager` - TimeoutManager

**providers/*.ts** import from:
- `../types` - AIProvider, AIMessage, AIStreamResponse, ProviderConfig
- `../../utils/logger` - Logger
- `../../utils/timeout-manager` - TimeoutManager
- `obsidian` - requestUrl

### Core Layer (src/core/)

**document-engine.ts** imports from:
- `./types` - DocumentContext, EditResult, EditCommand
- `./conversation-manager` - ConversationManager, DataStore
- `../utils/logger` - Logger
- `obsidian` - App, Editor, MarkdownView, TFile, EditorPosition

**prompt-builder.ts** imports from:
- `./context-builder` - ContextBuilder, GeneratedPrompt
- `./document-engine` - DocumentEngine
- `./conversation-manager` - ConversationManager
- `./command-parser` - CommandParser
- `./types` - EditCommand, DocumentContext, ConversationMessage

**commands/*.ts** import from:
- `../document-engine` - DocumentEngine
- `../context-builder` - ContextBuilder, GeneratedPrompt
- `../../ai/provider-manager` - AIProviderManager
- `../types` - EditCommand, EditResult, DocumentContext

### Features Layer (src/features/commands/)

**core/CommandEngine.ts** imports from:
- `../../../utils/logger` - Logger
- `../../../ui/streaming-manager` - StreamingManager
- `../../../ai/provider-manager` - AIProviderManager
- `../../../core/context-builder` - ContextBuilder
- `../../../core/document-engine` - DocumentEngine
- `../types` - MarkdownCommand, CommandExecutionContext, SmartContext

**ui/MarginIndicators.ts** imports from:
- `../core/SmartVariableResolver` - SmartVariableResolver
- `../core/CommandEngine` - CommandEngine, MarkerInsight
- `../core/SmartTimingEngine` - SmartTimingEngine
- `./InsightPanel` - InsightPanel
- `./codemirror-decorations` - CodeMirrorIndicatorManager

### UI Layer (src/ui/)

**sidebar-view.ts** imports from:
- `../core/document-analysis` - DocumentAnalyzer
- `../core/types` - EditCommand, EditResult
- `./context-manager` - ContextManager, MultiDocContext
- `../ai/models` - getAvailableModels, getProviderTypeForModel
- `../ai/types` - ProviderType
- `./input-handler`, `./command-system`, `./chat-renderer`, `./streaming-manager`
- `./selection-context-menu` - SelectionContextMenu, SELECTION_ACTIONS
- `../core/context-calculator` - formatContextUsage, getContextWarningLevel
- `../utils/logger`, `../utils/timeout-manager`

**command-system.ts** imports from:
- `../features/commands/core/CommandEngine` - CommandEngine
- `../features/commands/core/SmartVariableResolver` - SmartVariableResolver
- `../features/commands/types` - MarkdownCommand

**streaming-manager.ts** imports from:
- `../utils/logger` - Logger
- `../utils/timeout-manager` - TimeoutManager
- `obsidian` - Editor, Notice, EditorPosition

## Architectural Layers

```
┌─────────────────────────────────────────────────┐
│                    UI Layer                      │
│  sidebar-view, input-handler, streaming-manager  │
│  chat-renderer, context-manager, command-system  │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────┐
│                Features Layer                    │
│  commands/core/* (CommandEngine, SmartTiming)    │
│  commands/ui/* (MarginIndicators, InsightPanel)  │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────┐
│                   Core Layer                     │
│  document-engine, conversation-manager           │
│  prompt-builder, context-builder, intent-*       │
│  commands/* (add, edit, delete, grammar, etc)    │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────┐
│                    AI Layer                      │
│  provider-manager, models, context-limits        │
│  providers/* (claude, openai, google, ollama)    │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────┐
│                 Utils/Licensing                  │
│  logger, timeout-manager, feature-manager        │
│  license-validator, crypto-service               │
└─────────────────────────────────────────────────┘
```

## Recent Changes

| Commit | Summary |
|--------|---------|
| 1509417 | fix(compliance): remove console.log statements for plugin store readiness |
| dedc167 | feat(cancel): add cancellation support for all LLM operations |
| a6dc0e2 | fix(commands): improve Smart Fill UX with tooltips, sequential streaming, and error handling |
| d473eb5 | fix(commands): resolve "No placeholder found" error on fill icon click |
| cdfbd3b | fix(compliance): replace addEventListener with registerDomEvent in CodeMirror widgets |
| 4aaf608 | fix(commands): resolve notice disappearing during multi-fill + revert icon |
| 9b1b824 | refactor(settings): consolidate Smart Fill tab into General |
| 0d24637 | docs(readme): adopt professional tone matching website voice |
| 77335fe | refactor(commands): rebrand Commands to Smart Fill |
| 968339a | refactor(commands): simplify to marker-based /fill command |

---

*Generated by `/project:sync-codebase`. See `.claude/skills/nova-patterns/SKILL.md` for coding standards.*
