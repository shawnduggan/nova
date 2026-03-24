Audit the Claude Code setup for redundancy, conflicts, and dead weight.

---

## Process

Read the entire setup before responding. Check CLAUDE.md, every skill in the skills folder, every agent, every command, memory files, and any other instruction files you can find.

Then go through every rule, instruction, and preference you found. For each one, evaluate:

1. **Default behavior?** — Is this something Claude already does by default without being told?
2. **Conflicts?** — Does this contradict or conflict with another rule somewhere else in the setup?
3. **Redundant?** — Does this repeat something that's already covered by a different rule or file?
4. **One-off fix?** — Does this read like it was added to fix one specific bad output rather than improve outputs overall?
5. **Vague?** — Is this so vague that it would be interpreted differently every time? (e.g., "be more natural" or "use a good tone")

## Output

Provide:

1. **Conflicts found** — List every case where two files disagree, with file paths and line numbers
2. **What to cut** — A table of everything to remove, with the rule, its location, and a one-line reason
3. **Default behavior rules** — Rules that Claude Code already follows without being told
4. **Vague rules** — Rules too ambiguous to be consistently applied
5. **One-off fixes** — Rules that look like they were added reactively for a single incident
6. **What's working well** — Rules that are high-value and should be kept

Do NOT make any changes — this is a read-only audit. Present findings and wait for instructions.

## Attribution

Based on Ole Lehmann's setup audit prompt (https://x.com/itsolelehmann/status/2036065138147471665).
