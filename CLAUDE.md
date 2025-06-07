# Claude Instructions for Nova Plugin

## Commit Message Guidelines
- Do NOT include "Generated with Claude Code" or Co-Authored-By Claude in commit messages
- Keep commit messages clean and focused on the actual changes
- Follow conventional commit style when appropriate

## Project Context
This is the Nova Obsidian plugin - an AI writing partner that directly edits documents.

## Development Notes
- TypeScript throughout
- Multi-provider AI architecture (Claude, OpenAI, Google, Ollama)
- Platform-aware (desktop vs mobile)
- Sidebar chat interface

---

## Core Development Principles

### 1. **ONLY DO WHAT IS EXPLICITLY REQUESTED**
- Don't add features not specifically asked for
- Don't refactor existing working code unless asked
- Don't optimize or improve code that works
- Stop when the requested task is complete

### 2. **ASK BEFORE MAJOR CHANGES**
- If you think something needs restructuring, ask first
- If you discover issues with existing code, point them out but don't fix unless asked
- If multiple approaches exist, present options instead of picking one

### 3. **AVOID REFACTORING LOOPS**
- Don't continuously improve or reorganize code
- Don't change working implementations without clear reason
- Don't rewrite code just to make it "better"
- Focus on making it work, not making it perfect

### 4. **PREFER SIMPLE SOLUTIONS**
- Use straightforward implementations over clever ones
- Don't add abstractions until absolutely needed
- Keep code readable and debuggable
- MVP means minimum viable, not maximum features

## Current Status
- Basic plugin structure complete with TypeScript
- Multi-provider AI architecture implemented
- Settings UI and provider selection working
- Document editing engine needs implementation
- MVP scope: 5 core commands (add, edit, delete, grammar, rewrite)

## What's In Scope (MVP)
- Core document editing commands
- Multi-provider AI support (Ollama, Claude, Google, OpenAI)
- File-scoped conversation storage
- Basic sidebar chat interface
- Settings management
- Platform-aware provider switching

## What's Out of Scope (Don't Build)
- Streaming responses
- Advanced analytics
- Multi-file operations
- Custom undo/redo systems
- Complex UI animations
- Performance optimizations beyond basics

## File Structure (Don't Reorganize)
```
src/
├── main.ts                 # Plugin entry point
├── providers/              # AI provider implementations
├── core/                   # Document editing logic
├── ui/                     # User interface components
└── utils/                  # Helper functions
```

## Development Guidelines

### When Asked to Fix Bugs:
1. Identify the specific issue
2. Make minimal changes to fix it
3. Test the fix works
4. Stop there - don't improve surrounding code

### When Asked to Add Features:
1. Implement exactly what's requested
2. Use existing patterns and structures
3. Don't refactor existing code to accommodate new features
4. Keep changes isolated and minimal

### When Asked to Debug:
1. Add console.log statements to understand the issue
2. Fix the root cause with minimal changes
3. Remove debug logging when done
4. Don't optimize or restructure while debugging

### Code Style:
- Use existing naming conventions
- Match indentation and formatting of existing code
- Don't change style of working code
- Keep functions small and focused

## Testing Approach
- Test in development Obsidian vault
- Use console.log for debugging
- Verify plugin loads without errors
- Test core functionality manually
- Don't build automated tests unless specifically requested

## Error Handling
- Add basic try/catch blocks around risky operations
- Show user-friendly error messages
- Log detailed errors to console for debugging
- Don't build complex error recovery systems

## Communication Style
- Report what you did clearly
- Mention any issues you encountered
- Ask questions when requirements are unclear
- Don't suggest improvements unless asked

## Red Flags (Stop and Ask)
- "I think we should refactor..."
- "This would be better if..."
- "Let me also improve..."
- "While I'm here, I'll fix..."

## Success Criteria
Plugin loads → Settings work → Can send commands → Documents get edited

**Remember: Working is better than perfect. Ship the MVP first.**