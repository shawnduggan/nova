# Nova – AI Writing for Obsidian

AI editor for Obsidian that sharpens your writing in place. Select text, refine it, challenge your own thinking — without leaving your document. Not a generator. An editor.

Use local AI (Ollama, LM Studio) or your own API keys (Claude, OpenAI, Gemini). Nova never sees your content, never stores your conversations, and collects zero telemetry.

---

## How It Works

### Writing Dashboard

Vault-wide writing quality scores with a composite score across four pillars — clarity, conciseness, variety, and discipline. Per-document breakdown, sortable table, and historical trend sparklines that track your improvement over time. Command palette → "Open writing dashboard."

All local, zero AI costs, free for all users.

### Writing Analysis

Readability score, sentence length highlighting, passive voice detection, adverb density, and weak intensifier detection — running locally with zero AI costs. Like having ProWritingAid built into Obsidian, alongside Nova's AI editing tools.

**Note:** Writing analysis is English-only. Non-English documents won't get useful results from these features. AI editing works in any language your model supports.

### Selection-Based Editing

Select text → Right-click → Choose transformation → Watch it change in place. The AI edits exactly what you selected, nothing else.

### Challenge Your Thinking

Select any argument or claim → Right-click → "Challenge This." Nova identifies logical gaps, unsupported claims, and counter-arguments. It doesn't rewrite — it asks the hard questions so you can write better.

### Chat with Cursor Awareness

Ask for content at your cursor position. "Add a methodology section here" writes exactly where your cursor is, not in a separate chat window.

### Smart Fill — AI Placeholders for Structured Documents

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
   - Click margin indicators to fill individual placeholders
3. Nova streams content that matches your document's context and style

Smart fill pairs naturally with the Templater plugin. Use Templater for dynamic values (dates, file names, metadata) and Nova placeholders for AI-generated content. Insert a template, then generate all sections with `/fill` or command palette.

### Auto-Context: Your Knowledge Graph, Built In

Nova automatically resolves your note's **outgoing wikilinks** and optionally its **backlinks**, pulling linked notes into the AI's context window — no manual references in chat required.

- **Section links** like `[[Note#Heading]]` include only that section, keeping token usage tight.
- **Large documents** are intelligently truncated to their most relevant sections.
- **Backlinks** can be enabled for bidirectional awareness.
- The **Context Quick Panel** at the top of the sidebar shows everything: document list, token counts, budget bar, and toggle controls.

### What Nova Doesn't Do

Nova isn't a grammar checker. It won't flag comma splices or subject-verb disagreement — use LanguageTool or Grammarly for that.

Nova doesn't index your vault. It works with the document you have open plus any notes you explicitly link. It won't search across hundreds of files to find relevant context.

---

## Get Started

1. Obsidian → Community Plugins → Search "Nova" → Install
2. Add your API key (or set up local AI)
3. Select any text → Right-click → Try it

Need help? [Read the full Nova User Guide](https://novawriter.ai/guide)

---

## Pricing

Nova is free and open source (AGPL-3.0). All core features work with your own API keys forever.

**Supernova** ($29/year) gives supporters early access to new features before they become free. Every feature graduates to the free tier. Current and upcoming Supernova features are listed in the roadmap below.

The plugin includes a "Supernova" tab in settings with information about supporter benefits. No nag screens in the editor.

---

## Roadmap

**Recently shipped:**
- Writing Dashboard (v1.5) — Vault-wide writing quality scores, per-document breakdown, and historical trend tracking. Entirely local, free for all users.
- Writing Analysis (v1.4) — Readability scoring, passive voice detection, sentence length highlighting, adverb density, and weak intensifier flagging. All local, zero API costs.
- Auto-Context (v1.3) — Wikilink resolution, backlinks, and the Context Quick Panel.
- Smart Fill (v1.2) — AI placeholders for structured documents. Now free for all users.

**Coming next:**
- Prose Linter (v1.6) — Actionable issue list with AI-powered fix suggestions. Detection free; AI fixes Supernova early access.
- Revision Mode (v1.7) — AI-proposed edits shown as inline tracked changes. Accept or reject each change individually. Supernova early access.
- Voice Match (v1.8) — Nova learns your writing style and matches it on every transformation. Supernova early access.

**Multi-language support:** German writing analysis is in progress with a community contributor. Other languages to follow.

---

© 2026 Shawn Duggan • Built with pride in Halifax, NS
