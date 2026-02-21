# Nova – AI Writing for Obsidian

AI editor for Obsidian that sharpens your writing in place. Select text, refine it, challenge your own thinking — without leaving your document. Not a generator. An editor.

**Privacy-first**: Use local AI (Ollama, LM Studio) or your own API keys (Claude, OpenAI, Gemini). Nova never sees your content.

**Free core features**: All writing functionality works with your own keys. Paid supporters get early access to experimental features (1-2 months) before they become free.

---

## How It Works

### Selection-Based Editing

Select text → Right-click → Choose transformation → Watch it change in place. The AI edits exactly what you selected, nothing else.

### Challenge Your Thinking

Select any argument or claim → Right-click → "Challenge This." Nova identifies logical gaps, unsupported claims, and counter-arguments. It doesn't rewrite — it asks the hard questions so you can write better.

### Smart fill — AI placeholders for structured documents

Use `<!-- nova: instruction -->` comments as AI placeholders. Place them throughout your document, then generate all sections at once.

**Example:**
```markdown
## Executive Summary
<!-- nova: Write compelling 2-sentence summary -->

## Problem Statement
<!-- nova: Describe the problem in 150 words -->
```

**How it works:**
1. Place `<!-- nova: instruction -->` placeholders in your document
2. Generate content using any method:
   - Type `/fill` in your document (generates all placeholders)
   - Open command palette (Cmd/Ctrl+P) → "Smart fill" (generates all)
   - Right-click in editor → "Nova: Smart fill" (generates all)
   - Click margin indicators (📝) to fill individual placeholders
3. Nova streams content that matches your document's context and style

**Features:**
- Processes placeholders sequentially (top to bottom) with real-time streaming
- Uses full document context for coherent content
- Margin indicators (📝) show placeholder locations and enable click-to-fill
- Writing insights detect passive voice and weak words

**Works with Templater**

Smart fill pairs naturally with the Templater plugin. Use Templater for dynamic values (dates, file names, metadata) and Nova placeholders for AI-generated content. Insert a template, then generate all sections with `/fill` or command palette.

### Chat with Cursor Awareness

Ask for content at your cursor position. "Add a methodology section here" writes exactly where your cursor is, not in a separate chat window.

### Auto-Context: Your Knowledge Graph, Built In

Nova automatically understands your knowledge graph. When you open a note, Nova resolves its **outgoing wikilinks** and optionally its **backlinks**, pulling linked notes into the AI's context window — no manual references in chat required.

- **Section links** like `[[Note#Heading]]` include only that section, keeping token usage tight.
- **Large documents** are intelligently truncated to their most relevant sections.
- **Backlinks** can be enabled for bidirectional awareness.
- The **Context Quick Panel** at the top of the sidebar shows everything: document list, token counts, budget bar, and toggle controls.

---

## Privacy That Matches Your Principles

**Local AI First**: Use Ollama or LM Studio – your documents never leave your computer. Perfect for sensitive research, confidential writing, or simply preferring complete privacy.

**Your Keys, Your Control**: Cloud AI uses YOUR keys – Claude, OpenAI, Gemini. Nova never sees your content, never stores your conversations.

**Zero Analytics**: No tracking, no usage analytics, no "telemetry." What you write stays between you and your chosen AI provider.

*Privacy-first writing for people who chose Obsidian for the same reason.*

---

## Core Features Free Forever. No Tracking. No Catch.

Everything works with your own keys — Nova doesn't hold your writing hostage.

Every core writing feature works with your own API keys:

- Selection-based transformations with real-time streaming
- Chat commands with cursor targeting
- Multi-document context and references
- All AI providers (local and cloud)
- Cross-platform writing (desktop and mobile)
- Complete privacy control

Support development if Nova improves your writing:

- Early access to new features (1-2 months before general release)
- Priority support and feature requests
- Community of serious writers
- Sustainable development

*Philosophy: Thoughtful tools for the modern writer. All features graduate to free tier after Supernova early access period. Support only if it changes how you write.*

### Payment & Early Access

**Nova is free to use** with all core features included. **Some advanced features require payment for early access** during the Supernova supporter period (1-2 months) before graduating to the free tier.

**Plugin includes promotional messages** for Supernova support within the settings interface, clearly separated in a dedicated "Supernova" tab.

---

## Get Started

Install Nova in 2 minutes:

1. Obsidian → Community Plugins → Search "Nova" → Install
2. Add your API key (or setup local AI)
3. Select any text → Right-click → Try it

Want to see it in action?
Search "Nova" in Community Plugins and try "Improve Writing" on any note.

Need help? [Read the full Nova User Guide](https://novawriter.ai/guide)

---

## Roadmap

**Coming Soon** (Early Access → Free Tier):
- **Writing Modes** – Context-aware tone shifting (blog → academic)
- **Style Mirroring** – AI that matches your writing voice

Supernova supporters get 1-2 months early access before features become free.

---

© 2026 Shawn Duggan • Built with pride in Halifax, NS 🇨🇦
