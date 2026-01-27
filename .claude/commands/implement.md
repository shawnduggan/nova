Implement a feature, fix, or GitHub issue using the plan-first workflow.

**Task**: $ARGUMENTS

---

## Phase 0: Understand the Request

If a GitHub issue URL or number is provided:
1. **Fetch the issue** using `gh issue view` or WebFetch
2. **Parse the issue** - What exactly is being requested?
3. **Identify scope** - What components are likely involved?

For all requests:
- Use **Grep** and **Read** tools to research relevant code
- Understand existing patterns before proposing changes

---

## Phase 1: Planning (NO CODE CHANGES)

1. **Invoke the architect agent** to analyze and create a plan
2. **Write plan** to SCRATCHPAD.md with full details
3. **STOP** and present the plan for review

⚠️ **WAIT FOR EXPLICIT APPROVAL BEFORE PHASE 2**

Do not proceed until you receive approval like:
- "approved"
- "looks good, proceed"
- "go ahead"

---

## Phase 2: Implementation (ONLY AFTER APPROVAL)

1. **Follow the approved plan** step by step
2. **After each file modification**, run:
   ```bash
   npm run build
   ```
3. **Write/update tests** for new functionality
4. **Run full test suite**:
   ```bash
   npm test
   ```
5. **Fix any lint issues**:
   ```bash
   npm run lint:fix
   ```

---

## Phase 3: Verification

1. **Run compliance-checker agent** to verify Obsidian compliance
2. **Show changes**:
   ```bash
   git status
   git diff
   ```
3. **Propose commit message** following format:
   ```
   type(scope): description

   - Detail 1
   - Detail 2
   ```
4. **WAIT for approval** before committing

---

## Commit Types
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code restructuring
- `test`: Adding/updating tests
- `docs`: Documentation only
- `chore`: Maintenance tasks

## CRITICAL RULES
- ❌ NEVER proceed past Phase 1 without explicit approval
- ❌ NEVER auto-commit - always wait for approval
- ❌ NEVER skip quality gates
- ✅ Update SCRATCHPAD.md with progress
- ✅ Run build after each file change
