Review the current branch changes before creating a PR.

## Process

1. **Check current state**
   ```bash
   git status
   git diff main --stat
   ```

2. **Review changed files**
   For each changed file, use the code-reviewer agent to analyze.

3. **Hygiene checks**
   - Flag files that look unrelated to the PR's purpose (e.g., `package-lock.json` changes from npm version differences)
   - Check for indentation inconsistency within changed files (mixed spaces/tabs)

4. **Run compliance audit**
   Invoke the compliance-checker agent for full Obsidian compliance verification.

5. **Run quality gates**
   ```bash
   npm run build
   npm test
   npm run lint
   ```

6. **Generate summary**

## Output Format

```markdown
## PR Review Summary
Date: [current date]
Branch: [branch name]

### Changed Files
| File | Changes | Status |
|------|---------|--------|
| path/file.ts | [brief description] | ✅/⚠️/❌ |

### Code Review Findings
[Summary from code-reviewer agent]

#### Blocking Issues
[List any blocking issues]

#### Warnings
[List any warnings]

### Compliance Status
[Summary from compliance-checker agent]

### Quality Gates
| Check | Status | Details |
|-------|--------|---------|
| Build | ✅/❌ | [error count if failed] |
| Tests | ✅/❌ | [X/Y passing] |
| Lint | ✅/❌ | [error count if failed] |

### Verdict
✅ **Ready for PR** - All checks pass

OR

❌ **Blockers found** - Must fix before PR:
1. [blocker 1]
2. [blocker 2]
```

## Important
- Be thorough - this is the last check before PR
- Flag any compliance issues prominently
- Ensure all tests pass
- Check for console.log statements
