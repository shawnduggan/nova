# Nova – AI Writing Editor for Obsidian

AI writing editor, native to Obsidian. Sharpen your prose, refine selected text, write at the cursor, and review local clarity checks. Not a generator. An editor.

Use the local Ollama API, OpenAI-compatible endpoints like LM Studio, or your own API keys for Claude, OpenAI, and Gemini. Nova never sees your content, never stores your conversations, and collects zero telemetry.

---

## How It Works

### Writing Dashboard

Vault-wide writing quality scores with a composite score across four pillars — clarity, conciseness, variety, and discipline. Per-document breakdown, sortable table, and historical trend sparklines that track your improvement over time. Command palette → "Open writing dashboard."

All local, zero AI costs, free for all users.

### Prose Linter

Sharper prose, native to Obsidian. Open Prose Linter from the command palette and it appears in its own right-side review pane, styled like Nova's sidebar. Nova adds filled, category-colored highlights while the pane is active and flags long and very long sentences, passive voice, adverbs, weak intensifiers, qualifiers, complex words, repeated words, and repeated phrases. Rows jump to the exact issue; safe local replacements appear only when Nova can verify the current text still matches.

Prose Linter is free, local, Markdown-aware, and does not require an account, API key, or Supernova license. It is not a grammar checker.

### Writing Analysis

Readability score, word and sentence counts, reading time, passive voice percentage, adverb density, and weak intensifier detection — running locally with zero AI costs. Writing Analysis is the metrics engine; Prose Linter is the visual review pane for highlights and issue-by-issue editing. To keep editing responsive, Nova analyzes the current note as a snapshot, marks results stale after edits, and refreshes when you click Analyze.

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
2. Configure a provider: cloud, local, or OpenAI-compatible
3. Select any text → Right-click → Try it

Need help? [Read the full Nova User Guide](https://novawriter.ai/guide)

---

## AI Providers

Nova supports Claude, OpenAI, Gemini, Ollama's local API, and OpenAI-compatible Chat Completions endpoints such as LM Studio, LocalAI, LiteLLM, OpenRouter, and other custom gateways.

For OpenAI-compatible endpoints, enter the API root exactly as the provider expects, such as `http://localhost:1234/v1` or `https://example.com/api/v1`. Nova appends `/models` and `/chat/completions`; it does not guess or add `/v1` for you. API keys are optional for endpoints that do not require authentication.

If `/models` is unavailable, enter the model name manually and test the connection. Nova will validate the saved model with a tiny chat completion. Cloud-compatible endpoints can be used on mobile when mobile support is enabled; local, private network, `.local`, and single-hostname URLs are desktop-only.

---

## Pricing

Nova is free and open source (AGPL-3.0). All core features work with your own API keys forever.

**Free core** includes selection editing, cursor chat, auto-context, Smart Fill, Writing Analysis, Writing Dashboard, Prose Linter, and all supported providers.

**Supernova** ($79 lifetime or $29/year) unlocks premium features. Current and upcoming Supernova features are listed in the roadmap below.

Supernova does not include hosted AI credits. Nova remains user-provider-first: you use your own API keys or local models.

The plugin includes a "Supernova" tab in settings with information about supporter benefits.

---

## Roadmap

**Recently shipped:**
- OpenAI-Compatible Endpoints (v1.7) — Connect Nova to OpenAI-compatible Chat Completions gateways: LM Studio, LocalAI, LiteLLM, and OpenRouter. Easier model setup and clearer mobile handling.
- Prose Linter (v1.6) — Free local clarity workbench for sharper prose, native to Obsidian: filled highlights, category filters, Markdown-aware analysis, safe local Apply actions, and jump-to-issue editing. No AI key or Supernova license required.
- Writing Dashboard (v1.5) — Vault-wide writing quality scores, per-document breakdown, and historical trend tracking. Entirely local, free for all users.
- Writing Analysis (v1.4) — Readability scoring, passive voice metrics, sentence-length analysis, adverb density, weak intensifier flagging, and sidebar stats. All local, zero API costs.
- Auto-Context (v1.3) — Wikilink resolution, backlinks, and the Context Quick Panel.
- Smart Fill (v1.2) — AI placeholders for structured documents. Now free for all users.

**Coming next:**
- Smart Revision (v1.8) — A controlled revision pass: Nova diagnoses a passage, proposes grouped editorial changes with meaning-risk and before/after clarity impact, and lets you accept only what improves the draft. Supernova.
- Voice Match (v1.9) — Nova learns your writing style and matches it on every transformation. Supernova.

---

© 2026 Shawn Duggan • Built with pride in Halifax, NS
