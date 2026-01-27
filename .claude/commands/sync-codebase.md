Regenerate the nova-codebase skill with current file structure, exports, and dependencies.

---

## When to Run

- After adding new TypeScript files to `src/`
- After major refactoring that changes module structure
- After significant features that add new exports or dependencies
- When the codebase skill feels outdated

---

## Process

### Step 1: Verify File Headers

First, check that all `src/**/*.ts` files have proper `@file` headers:

```bash
# Find files missing @file headers
grep -rL "@file" src/ --include="*.ts"
```

If any files are missing headers, add them using the format:
```typescript
/**
 * @file ModuleName - One-line description of purpose
 */
```

### Step 2: Scan Source Files

Walk `src/` recursively and for each `.ts` file extract:
1. The `@file` description from the header comment
2. Exported classes, interfaces, functions, and types
3. Import statements for dependency mapping

Use these tools:
- `Glob` with pattern `src/**/*.ts` to list all files
- `Read` to examine file contents
- `Grep` to find exports: `export (class|interface|function|type|const)`

### Step 3: Build Dependency Map

For each module, identify:
- What it imports from other local modules (`./` or `../`)
- What it imports from Obsidian
- What it imports from external packages

Organize by architectural layer:
1. **AI Layer** (`src/ai/`)
2. **Core Layer** (`src/core/`)
3. **UI Layer** (`src/ui/`)
4. **Utils/Licensing** (`src/utils/`, `src/licensing/`)

### Step 4: Get Recent Changes

```bash
git log --oneline -10 --no-merges
```

### Step 5: Generate SKILL.md

Write to `.claude/skills/nova-codebase/SKILL.md` with this structure:

```markdown
---
name: nova-codebase
description: Auto-generated Nova codebase map. Regenerate with /project:sync-codebase
generated: YYYY-MM-DD
---

# Nova Codebase Map

> This file is auto-generated. Do not edit manually.
> Regenerate with: `/project:sync-codebase`

## File Structure

### src/ai/
| File | Description | Key Exports |
|------|-------------|-------------|
| file.ts | @file description | Export1, Export2 |
...

## Component Dependencies

### AI Layer (src/ai/)
**provider-manager.ts** imports from:
- ./types - list of imports
...

## Recent Changes
| Commit | Summary |
|--------|---------|
| hash | message |
...
```

### Step 6: Report Missing Headers

List any files that don't have proper `@file` descriptions:

```
Files missing @file descriptions:
- src/path/to/file.ts
```

---

## Output Format

After running, report:
- Files scanned: X
- Files with descriptions: Y
- Files missing descriptions: Z (list them)
- Dependencies mapped: N
- SKILL.md regenerated successfully

Then **wait for user approval** before committing.

---

## Important Notes

- Do NOT edit `nova-patterns` skill - that's manually maintained
- The generated skill should be concise but complete
- Focus on public exports, not internal implementation details
- Preserve the architectural layer diagram
- Update the `generated` date in frontmatter
