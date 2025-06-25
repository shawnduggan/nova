# Nova Plugin Project Overview

## Purpose
Nova is an AI writing partner plugin for Obsidian that enables direct, in-place editing of documents. Key features:
- Selection-based editing with right-click context menus
- Cursor-based chat editing where AI writes exactly at cursor position
- Multi-provider AI support (Claude, OpenAI, Google, Ollama)
- Local and cloud AI options
- Mobile and desktop support
- Zero copy-paste workflow with streaming edits

## Tech Stack
- **Language**: TypeScript 4.7.4
- **Platform**: Obsidian Plugin (uses Obsidian API)
- **Build System**: esbuild + TypeScript
- **Testing**: Jest with jsdom environment
- **Module System**: ESNext with ES6 target
- **License**: AGPL-3.0

## Architecture
- Main plugin class: `NovaPlugin` in `main.ts`
- Core systems: Document engine, conversation manager, AI provider manager
- UI components: Sidebar view, context menus, modals
- Command handlers: Add, edit, delete, grammar, rewrite, metadata
- AI providers: Claude, OpenAI, Google, Ollama with pluggable architecture
- Feature management and licensing system