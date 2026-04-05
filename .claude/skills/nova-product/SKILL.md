---
name: nova-product
description: Nova product positioning, roadmap context, monetization guardrails, and shipped-vs-planned guidance. Read before roadmap/spec/product work.
---

# Nova Product Context

This skill captures durable product guidance from Nova's external product docs. Use it when evaluating roadmap ideas, reviewing specs, writing product-facing docs, or prioritizing feature work.

## Canonical External Docs

Read these docs outside the plugin repo when product context matters:

- `../07-Projects/Nova/Core Docs/Nova - Product Requirements Document.md`
- `../07-Projects/Nova/Core Docs/Nova - Business Strategy & Marketing Plan.md`
- `../07-Projects/Nova/Core Docs/Nova - User Guide.md`
- `../07-Projects/Nova/Core Docs/Nova - Technical Implementation Specification.md`
- `../07-Projects/Nova/Planning/Roadmap/Nova Roadmap - 2026.md`
- `../07-Projects/Nova/Planning/Specs/Current/`

Treat those docs as the source of product intent and planning context. Treat the codebase as the source of truth for what is already shipped.

## Positioning

- Nova is an editor, not a generator.
- The core promise is precise, in-place editing inside Obsidian.
- Privacy-first and local-first are central to the product, not side benefits.
- Deterministic local writing analysis strengthens the "help you write better" story because it works offline and does not require API calls.

## Strategic Priorities

The current product strategy is:

1. Drive adoption with free, local, shareable features.
2. Build stronger Supernova value with AI-powered premium features.
3. Focus on conversion only after both audience and feature value are stronger.

When brainstorming or evaluating features, prefer ideas that:

- reinforce editor-not-generator positioning
- feel native to Obsidian instead of bolted on
- preserve privacy and local-first trust
- create visible, screenshotable, or habit-forming value
- build reusable infrastructure for later premium features

## Shipped vs Planned Guardrails

- Never present roadmap/spec items as implemented without verifying the code.
- When discussing current behavior, verify commands, views, settings, and APIs in the repo first.
- When discussing future work, label it clearly as planned, proposed, or spec-only.
- If docs and code diverge, document the divergence explicitly instead of smoothing it over.

## Current Product Shape

The docs currently position Nova around:

- selection-based editing
- cursor-based chat with intention detection
- auto-context from wikilinks
- local writing analysis
- privacy-first multi-provider AI support

Roadmap items after v1.4 are planned work, not shipped functionality. In particular, the writing dashboard, prose linter, revision mode, and voice match should be discussed as future work unless verified in code.

## Product Heuristics For Future Features

- Favor extensions of existing strengths over unrelated surface area.
- A premium feature should feel materially more actionable, not just more diagnostic.
- Free features can be strategically valuable when they improve adoption, delight, and word-of-mouth without adding marginal API cost.
- Features that compound the writing-analysis system are especially attractive because they support Nova's differentiation and can feed later AI-assisted workflows.

## v1.5 Dashboard Notes

The active v1.5 spec frames the writing dashboard as:

- a free, local, vault-wide writing dashboard
- an adoption and retention feature
- a foundation for v1.6's more actionable prose linter

Questions worth pressure-testing during planning:

- Is the score fair across different note types such as essays, meeting notes, and ephemeral notes?
- Are template folders, journals, and archives easy to exclude?
- Is the score motivating, or will it feel judgmental or noisy?
- Does the scan/caching model stay responsive in larger vaults?
- Are command names and UI labels kept in sentence case even if draft specs use title case?
