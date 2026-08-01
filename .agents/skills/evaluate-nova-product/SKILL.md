---
name: evaluate-nova-product
description: Ground Nova roadmap, PRD, pricing, positioning, UX, and feature-priority decisions in canonical product documents and verified shipped behavior. Use for product analysis, planning, specs, prioritization, and product-document updates.
---

# Evaluate Nova Product

Use the Basecamp vault for product intent and the repository for shipped
behavior. Keep those two forms of evidence separate.

## Gather Canonical Context

Read only the documents relevant to the question from:

- /Users/shawn/Obsidian/Basecamp/07-Projects/Nova/Core Docs/
- /Users/shawn/Obsidian/Basecamp/07-Projects/Nova/Planning/

Use rg to locate the current PRD, roadmap, positioning, pricing, or decision
record. Check document dates and status markers. Then inspect the live
implementation when the proposal depends on what Nova already does.

Apply this evidence hierarchy:

1. Existing canonical vault document for product intent
2. More recent explicit product decision
3. Live code and tests for shipped behavior
4. Issue or request context for the current task
5. Clearly labeled inference

Do not treat roadmap text as implementation evidence.

## Evaluate the Proposal

Assess whether it reinforces Nova as writing intelligence inside the editor
rather than a disconnected text generator. Prefer proposals that:

- preserve the user's voice and agency;
- deliver precise, in-place editing or deterministic local analysis;
- are non-destructive and easy to undo;
- keep context gathering explicit and privacy-conscious;
- work locally or offline when AI is not necessary;
- fit naturally into an editing workflow;
- keep adjacent Nova panes and controls visually coherent;
- reveal complexity progressively;
- create visible, habit-forming value without avoidable API cost;
- make premium value materially more actionable rather than merely diagnostic;
- build reusable infrastructure for later writing workflows;
- improve trust, clarity, and control;
- have a credible path through the current architecture.

State conflicts with existing product commitments directly. Distinguish
between a product decision, an engineering constraint, and an unverified
assumption.

## Output

Return:

1. Decision or recommendation
2. Evidence from canonical documents
3. Verified shipped behavior
4. User value and product fit
5. Tradeoffs and risks
6. Proposed scope and non-goals
7. Open questions

When asked to update product documentation, modify the existing document in
Nova's vault structure. Do not create generated PRDs, roadmaps, specs, or
planning scratchpads inside the plugin repository.
