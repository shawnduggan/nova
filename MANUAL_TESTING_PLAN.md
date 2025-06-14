# Nova Plugin - Manual Testing Plan

## Overview

This manual testing plan covers comprehensive testing of Nova's **cursor-only editing system** across different platforms and scenarios to ensure ship-ready quality.

**IMPORTANT**: Nova has completed its transformation to a cursor-only architecture. All section targeting and location-based UI has been removed. Edit operations now work exclusively at cursor position, with selection, or on entire documents.

## Test Environment Setup

### Required Test Environments
- [ ] **Desktop**: macOS/Windows/Linux with Obsidian latest version
- [ ] **Mobile**: iOS and Android with Obsidian mobile app
- [ ] **Tablet**: iPad and Android tablet

### Test Vault Setup
- [ ] Create fresh test vault with sample documents
- [ ] Include documents with various content types:
  - [ ] Plain markdown files
  - [ ] Files with frontmatter properties
  - [ ] Files with wikilinks and references
  - [ ] Large documents (>1000 lines)
  - [ ] Documents in nested folders

## Core Functionality Testing

### 1. Plugin Installation & Activation
- [ ] Fresh install from plugin directory
- [ ] Plugin activates without errors
- [ ] Nova icon appears in ribbon
- [ ] Settings tab accessible
- [ ] No console errors during load

### 2. AI Provider Configuration
#### Claude Provider
- [ ] Configure Claude API key
- [ ] Test connection with valid key
- [ ] Handle invalid/expired key gracefully
- [ ] Model selection works correctly

#### OpenAI Provider  
- [ ] Configure OpenAI API key
- [ ] Test connection with valid key
- [ ] Handle rate limits gracefully
- [ ] Model selection (GPT-4, GPT-3.5) works

#### Google Gemini Provider
- [ ] Configure Gemini API key
- [ ] Test connection and responses
- [ ] Handle API errors properly

#### Ollama Provider (Desktop Only)
- [ ] Configure local Ollama URL
- [ ] Test with running Ollama instance
- [ ] Handle offline/unreachable gracefully

### 3. Cursor-Only Editing System

#### Cursor-Only Architecture Validation
- [ ] All edit operations happen at cursor position only
- [ ] No section targeting or location-based UI remains
- [ ] Edit commands work with four targets: cursor, selection, document, end
- [ ] Context-only mode works when adding documents without text
- [ ] Cursor position preserved when switching between document and chat
- [ ] Clean, simplified architecture with no dead code

### 4. Core Document Editing Commands (Cursor-Only System)

#### Add Command
- [ ] Add content at cursor position in empty document
- [ ] Add content at cursor position in document with existing content  
- [ ] Add content at end of document
- [ ] Add content to entire document scope
- [ ] Add content with complex instructions
- [ ] Handle long generation times
- [ ] Cancel operation works correctly

#### Edit Command
- [ ] Edit selected text with simple instruction
- [ ] Edit selected text with complex instruction
- [ ] Edit at cursor position when no selection
- [ ] Edit entire document scope
- [ ] Preserve document formatting
- [ ] Handle undo/redo correctly

#### Delete Command
- [ ] Delete selected text
- [ ] Delete content at cursor position
- [ ] Delete entire document content
- [ ] Handle when content not found
- [ ] Preserve surrounding context

#### Grammar Command
- [ ] Fix grammar in selected text
- [ ] Fix grammar in entire document
- [ ] Reject cursor-only targeting (requires selection or document)
- [ ] Handle text without errors gracefully
- [ ] Preserve original meaning

#### Rewrite Command
- [ ] Rewrite selected text with style instruction
- [ ] Rewrite at cursor position
- [ ] Rewrite entire document
- [ ] Handle complex rewrite requests
- [ ] Maintain document structure

#### Metadata Command
- [ ] Update frontmatter properties with AI assistance
- [ ] Add new properties to documents without frontmatter
- [ ] Modify existing properties with natural language
- [ ] Handle complex property operations (arrays, objects)
- [ ] Remove properties by setting to null
- [ ] Preserve existing properties while updating others

### 5. Sidebar Chat Interface

#### Basic Chat Functionality
- [ ] Open sidebar via ribbon icon
- [ ] Open sidebar via command palette
- [ ] Chat interface loads correctly
- [ ] Send basic messages and receive responses
- [ ] Message history persists across sessions

#### Provider Switching
- [ ] Switch providers via dropdown (Desktop)
- [ ] Provider switching reflects in responses
- [ ] Settings persist across provider changes
- [ ] Mobile provider restrictions work correctly

#### File Context
- [ ] Chat loads correct conversation for active file
- [ ] Context switches when changing active file
- [ ] Multiple files maintain separate conversations
- [ ] Context tracking works with split panes

### 6. Command System (Supernova Early Access)

#### Colon Trigger System
- [ ] `:claude` switches to Claude
- [ ] `:chatgpt` switches to OpenAI
- [ ] `:gemini` switches to Google
- [ ] `:ollama` switches to Ollama (desktop)
- [ ] Invalid commands show appropriate feedback

#### Command Picker
- [ ] Trigger command picker with `:` 
- [ ] Fuzzy search filters commands correctly
- [ ] Keyboard navigation (up/down arrows)
- [ ] Mouse selection works
- [ ] Escape key closes picker
- [ ] Enter key executes selected command

#### Command Button (⚡)
- [ ] Command button appears on mobile
- [ ] Command button click opens menu
- [ ] Menu shows all available commands
- [ ] Commands execute correctly from menu
- [ ] Menu closes after selection

#### Custom Commands
- [ ] Access custom command settings
- [ ] Create new custom command
- [ ] Edit existing custom command
- [ ] Delete custom command
- [ ] Custom commands appear in picker/menu
- [ ] Custom command templates work correctly

### 7. Multi-Document Context

#### Document Reference Parsing
- [ ] `[[document]]` syntax parses correctly
- [ ] References to existing files work
- [ ] References to non-existent files handled gracefully
- [ ] Property references `[[doc#property]]` work
- [ ] Multiple references in one message work

#### Context Management
- [ ] Documents add to persistent context
- [ ] Context persists across chat sessions
- [ ] Context indicators show document count
- [ ] Token counting displays correctly
- [ ] Context panel shows document list

#### Wikilink Autocomplete
- [ ] Typing `[[` triggers autocomplete
- [ ] Fuzzy search finds relevant documents
- [ ] Autocomplete shows document paths
- [ ] Selection inserts correct wikilink
- [ ] Autocomplete integrates with context system

#### Context Panel UX
- [ ] Expandable thin line appears when context exists
- [ ] Click/tap expands management overlay upward
- [ ] Individual document remove buttons work (× symbol)
- [ ] Clear all button works (trash icon)
- [ ] Both buttons have proper red hover states
- [ ] Mobile touch targets are adequate (44px+)
- [ ] Outside click collapses overlay
- [ ] "Read-only" badges appear on context documents
- [ ] Tooltips indicate read-only status for editing
- [ ] Context confirmation messages explain read-only status

#### Read-Only Context Document Security
- [ ] **CRITICAL**: Edit commands only modify the active conversation file
- [ ] Context documents cannot be accidentally edited
- [ ] Clear error messages when attempting to edit context documents
- [ ] All edit commands protected: add, edit, delete, grammar, rewrite, metadata
- [ ] File validation works with multiple files open
- [ ] Workspace automatically activates conversation file when needed
- [ ] Security validation works across all platforms (desktop/mobile)

### 8. Auto-Growing Input (Supernova Early Access)
- [ ] Input starts with appropriate default height
- [ ] Input grows smoothly as content increases
- [ ] Maximum height constraint works (6-8 lines)
- [ ] Mobile vs desktop sizing differs appropriately
- [ ] Integration with command button works

### 9. Visual Design & User Experience

#### Native Icon System
- [ ] All UI elements use clean SVG icons (no emojis)
- [ ] Icons match Obsidian's design language
- [ ] Icons scale properly across different screen sizes
- [ ] Icons support theme compatibility (currentColor)
- [ ] Clear button uses native eraser icon
- [ ] Command button uses lightning (zap) icon
- [ ] System messages use appropriate context icons

#### Professional UI Polish
- [ ] Consistent spacing and typography throughout
- [ ] Professional appearance matches Obsidian standards
- [ ] Loading states use clean animated icons
- [ ] Error/success states have appropriate visual feedback
- [ ] Mobile UI elements sized appropriately for touch
- [ ] Context panel styling professional and clean

#### Welcome Message
- [ ] Welcome message appears on first sidebar open
- [ ] Message content clear and helpful for new users
- [ ] Dismissal works correctly and persists
- [ ] Welcome message doesn't reappear after dismissal
- [ ] Message doesn't interfere with normal chat usage
- [ ] Appropriate styling matches plugin design

### 10. Thinking Content Filter

#### AI Response Filtering
- [ ] Responses with `<thinking>` tags have thinking content removed
- [ ] Multiple thinking tag formats filtered correctly:
  - [ ] `<thinking>...</thinking>`
  - [ ] `<thinking>...<thinking/>`
  - [ ] `<thinking>...<thinking>`
  - [ ] Nested thinking tags
- [ ] Original response structure preserved after filtering
- [ ] Performance not impacted by filtering logic
- [ ] Edge cases handled (malformed tags, partial tags)
- [ ] Filtering works across all AI providers

### 11. Licensing & Feature Management

#### Supernova License Validation
- [ ] Valid Supernova license enables early access features
- [ ] Invalid/expired license shows appropriate restrictions
- [ ] License status displays correctly in settings
- [ ] Feature access updates when license changes

#### Feature Time Gates
- [ ] Early access features work for Supernova users
- [ ] Features are properly gated for non-Supernova users
- [ ] "Coming Soon" messaging appropriate
- [ ] Debug mode allows feature date overrides (dev only)

## Platform-Specific Testing

### Desktop Testing
- [ ] All providers work correctly
- [ ] Keyboard shortcuts function properly
- [ ] Window resizing doesn't break UI
- [ ] Multiple vault support works
- [ ] File system integration works

### Mobile Testing
- [ ] Touch interface responsive and accessible
- [ ] Command button (⚡) discovery works
- [ ] Provider restrictions appropriate for mobile
- [ ] Soft keyboard interaction smooth
- [ ] Context panel mobile experience good
- [ ] Performance acceptable on older devices

### Tablet Testing
- [ ] Responsive design adapts appropriately
- [ ] Touch targets adequate size
- [ ] Landscape/portrait orientation switching
- [ ] Performance remains smooth

## Error Handling & Edge Cases

### Network Issues
- [ ] Handle network timeouts gracefully
- [ ] Show appropriate error messages for API failures
- [ ] Retry mechanisms work where appropriate
- [ ] Offline mode degrades gracefully

### Large Content
- [ ] Handle large documents without performance issues
- [ ] Token limits respected and communicated
- [ ] Large responses process correctly
- [ ] Memory usage remains reasonable

### Concurrent Operations
- [ ] Multiple simultaneous AI requests handled properly
- [ ] File switching during processing works correctly
- [ ] Context management with rapid file changes

### Data Persistence
- [ ] Conversation history persists across restarts
- [ ] Settings persist correctly
- [ ] Context data doesn't corrupt
- [ ] Plugin uninstall/reinstall preserves appropriate data

## Performance Testing

### Response Times
- [ ] AI responses feel snappy for normal requests
- [ ] Long operations show appropriate loading indicators
- [ ] UI remains responsive during processing

### Memory Usage
- [ ] Plugin doesn't leak memory over time
- [ ] Large conversation histories don't slow down interface
- [ ] Multiple file contexts don't consume excessive memory
- [ ] Event listeners properly cleaned up when components removed
- [ ] Timeout/interval cleanup working correctly
- [ ] Automatic conversation cleanup (7-day retention) functioning
- [ ] Plugin unload/reload doesn't leave memory leaks

### Conversation Cleanup System
- [ ] Conversations older than 7 days automatically removed
- [ ] Cleanup runs on plugin load/startup
- [ ] Active/recent conversations preserved correctly
- [ ] Cleanup doesn't interfere with active usage
- [ ] Storage space properly reclaimed after cleanup
- [ ] No errors thrown during cleanup process
- [ ] Manual cleanup option works in settings

### Bundle Size
- [ ] Plugin loads quickly on slower connections
- [ ] Bundle size appropriate for feature set

## Accessibility Testing

### Keyboard Navigation
- [ ] All features accessible via keyboard
- [ ] Tab order logical and complete
- [ ] Escape key behaviors consistent

### Screen Reader Support
- [ ] Important elements have appropriate labels
- [ ] Dynamic content changes announced
- [ ] Error messages accessible

### Visual Accessibility
- [ ] Sufficient color contrast in all themes
- [ ] UI scales appropriately with system font settings
- [ ] Important information not conveyed by color alone

## Integration Testing

### Obsidian Integration
- [ ] Works correctly with community themes
- [ ] Compatible with other popular plugins
- [ ] Doesn't interfere with core Obsidian functionality
- [ ] File modification tracking works correctly

### Multi-Vault Testing
- [ ] Settings isolated per vault appropriately
- [ ] Context doesn't leak between vaults
- [ ] Performance good with multiple vaults

## Security Testing

### API Key Handling
- [ ] API keys stored securely
- [ ] Keys not logged or exposed in errors
- [ ] Settings export doesn't include sensitive data

### Content Privacy
- [ ] Document content only sent to specified providers
- [ ] No unexpected data transmission
- [ ] Local processing respects privacy settings

### Read-Only Context Document Enforcement
- [ ] **CRITICAL SECURITY**: Context documents are truly read-only for edit operations
- [ ] File validation prevents editing wrong documents
- [ ] Security validation comprehensive across all command types
- [ ] Error messages clear and informative for security blocks
- [ ] No data integrity issues with multiple file contexts

### Comprehensive Security Test Suite
- [ ] All 9 metadata security tests pass:
  - [ ] Metadata commands only modify active file
  - [ ] Context files protected from metadata changes
  - [ ] Property validation works correctly
  - [ ] Array/object property handling secure
  - [ ] Null property handling secure
  - [ ] Cross-file metadata isolation
  - [ ] Concurrent metadata operations safe
  - [ ] Error handling doesn't expose internals
  - [ ] Permission validation comprehensive
- [ ] All 5 additional security tests pass:
  - [ ] Edit command file validation
  - [ ] Add command file validation  
  - [ ] Delete command file validation
  - [ ] Grammar command file validation
  - [ ] Rewrite command file validation

## Final Ship Readiness Checklist

### Code Quality
- [ ] All tests passing (502+ tests including 9 metadata + 5 security tests)
- [ ] No TypeScript errors or warnings
- [ ] No console errors in normal operation
- [ ] Code coverage adequate for critical paths
- [ ] Security test suite validates read-only enforcement
- [ ] Thinking content filter tests passing
- [ ] Welcome message functionality tested

### Documentation
- [ ] README.md up to date with current features
- [ ] CHANGELOG.md includes all recent changes
- [ ] Settings UI provides clear guidance
- [ ] Error messages helpful and actionable

### Polish
- [ ] UI consistent across all features
- [ ] Loading states appropriate and helpful
- [ ] Success/error feedback clear
- [ ] Performance smooth on target devices

### Compatibility
- [ ] Minimum Obsidian version specified and tested
- [ ] Cross-platform compatibility verified
- [ ] Mobile app compatibility confirmed

## Sign-off

### Testing Team Sign-off
- [ ] **Desktop Lead**: _________________ Date: _______
- [ ] **Mobile Lead**: _________________ Date: _______  
- [ ] **QA Lead**: _________________ Date: _______

### Final Approval
- [ ] **Technical Lead**: _________________ Date: _______
- [ ] **Product Lead**: _________________ Date: _______

---

## Notes Section

Use this space to document any issues found during testing, workarounds implemented, or areas requiring additional attention before ship.

### Issues Found
- Issue 1: [Description and resolution]
- Issue 2: [Description and resolution]

### Performance Notes
- [Any performance concerns or optimizations needed]

### Compatibility Notes  
- [Any compatibility issues or limitations discovered]