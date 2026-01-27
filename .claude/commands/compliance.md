Run a full Obsidian Plugin compliance audit.

This command checks Nova against all Obsidian Community Plugin store requirements.

## Process

1. **Invoke the compliance-checker agent**
   Run comprehensive compliance audit across all categories.

2. **If violations found**
   List specific fixes needed with file paths and line numbers.

3. **Provide fix guidance**
   For each violation, show the correct pattern to use.

4. **After fixes are made**
   Re-run audit to verify all issues resolved.

5. **Final status**
   Confirm ready for plugin store submission or list remaining blockers.

## Compliance Categories

| Category | Blocking? | Description |
|----------|-----------|-------------|
| Event Listeners | YES | Must use `registerDomEvent()` |
| Timers | YES | Must use `TimeoutManager` / `registerInterval()` |
| DOM Security | YES | No `innerHTML`/`outerHTML` |
| Deprecated APIs | YES | No `activeLeaf`, `vault.modify()` |
| Network | YES | Must use `requestUrl()` |
| Console | YES | Must use `Logger`, no `console.log` |
| iOS Compat | YES | No regex lookbehind |
| Manifest | YES | Valid naming, description |

## Output

Full compliance report with:
- Overall status (READY / BLOCKING)
- Per-category results
- Specific violations with locations
- Recommended fixes
- Re-audit results if fixes were applied

## When to Use

- Before submitting to plugin store
- After major changes
- When compliance is uncertain
- As part of PR review workflow
