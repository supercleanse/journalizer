# Glass Framework — Required Workflow

This project uses the **Glass Framework**. You MUST follow this workflow for ALL code changes.

## The Rule

**Write the `.glass` spec FIRST. Then write the implementation. Never the other way around.**

- Specs live in `glass/` — these are the source of truth
- Implementation lives in `src/` — this is generated from specs
- A `.glass` file defines the Intent (WHY) and Contract (WHAT)
- The paired `.ts` file contains the Implementation (HOW)

## Workflow

1. Create or update the `.glass` spec in `glass/`
2. Create or update the implementation in `src/`
3. Run `glass verify` to confirm contracts are satisfied
4. Run `glass compile` to emit verified code

Example: `glass/auth/login.glass` pairs with `src/auth/login.ts`

## Never

- Write implementation code without a paired `.glass` spec
- Skip writing the spec "to save time" — the spec IS the design
- Modify `.glass` files during compilation
- Skip verification (`glass verify`)

## .glass File Format

=== Glass Unit ===
id: module.unit_name
version: 0.1.0
language: typescript

=== Intent ===
purpose: Plain English description of why this exists
source:
  kind: prd
  reference: "where this requirement came from"
parent: null
stakeholder: user
subIntents: []
approvalStatus: approved

=== Contract ===
requires:
- "precondition that must be true before execution"
guarantees:
  on_success:
    - "postcondition guaranteed after successful execution"
  on_failure:
    - "postcondition guaranteed when execution fails"
invariants:
  - "property that must hold throughout execution"
fails:
  ErrorType: "handling strategy"

## Commands

```bash
glass verify    # Verify all contracts are satisfied
glass compile   # Full pipeline: verify + emit TypeScript code
glass status    # Show verification dashboard
```

See [GLASS.md](./GLASS.md) for the complete methodology, contract rules, and project conventions.

## IMPORTANT: Feature Development Process

Every new feature MUST follow this process:

1. **Create a feature branch** from master (e.g., `feat/feature-name`)
2. **Implement the feature** with tests
3. **Ensure CI passes** (`npm run typecheck && npm test`)
4. **Create a PR** to master
5. **Request reviews:**
   - Claude code review (run via background agent)
   - Gemini review (comment `@gemini-code-assist please review this PR` on the PR)
6. **Fix all review issues**, commit, and push
7. **Merge the PR** once CI passes and reviews are addressed
