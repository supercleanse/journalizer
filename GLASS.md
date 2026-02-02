# Glass Framework — journalizer

This project uses the **Glass Framework**. Glass is a higher-level language that sits above TypeScript. You write specs in `.glass` files, and the compiler verifies that the TypeScript implementation satisfies the spec.

**Humans read `.glass` files. They should never need to read `.ts` files directly.**

## How Glass Works

Glass has three layers for every unit of functionality:

1. **Intent** — WHY does this code exist? (plain English, traced to a source)
2. **Contract** — WHAT does this code guarantee? (preconditions, postconditions, invariants, failure modes)
3. **Implementation** — HOW does it work? (TypeScript code in a paired `.ts` file)

The `.glass` spec file contains Intent + Contract. The implementation lives in a separate `.ts` file. The Glass compiler verifies the implementation satisfies the contract.

## Project Structure

```
journalizer/
  glass/              # .glass spec files (intent + contract) — EDIT THESE
  src/                # TypeScript implementation files — AI generates these
  dist/               # Compiled output
  glass-views/        # Auto-generated human-readable views
  annotations/        # Human annotations on outlines
  tests/              # Test suite
  manifest.glass      # Living requirements document
  glass.config.json   # Project configuration
```

## .glass File Format

Every `.glass` file in `glass/` is a spec with two sections:

```
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
advisories:
  - "decision flagged for human review"
```

The paired implementation file lives at the same relative path in `src/`:
- `glass/auth/login.glass` pairs with `src/auth/login.ts`

## Creating a New Unit

1. Create the spec: `glass/module/name.glass`
2. Create the implementation: `src/module/name.ts`
3. Verify: `glass verify`
4. Compile: `glass compile`

## Contract Rules

Every contract must have:
- **requires** — preconditions (refuse to run if not met)
- **guarantees** — postconditions split into on_success and on_failure
- **invariants** — properties that hold throughout execution
- **fails** — every failure mode with explicit handling
- **advisories** — (optional) decisions flagged for human review

## Intent Rules

Every intent must have:
- **purpose** — plain English statement of what and why
- **source** — where this requirement came from (`prd`, `conversation`, or `ai-generated`)
- **parent** — parent intent ID (or `null` for top-level)
- **stakeholder** — who cares (`user`, `product`, `engineering`, `security`)

## CLI Commands

```bash
glass verify              # Verify all contracts are satisfied
glass compile             # Full pipeline: parse, link, verify, emit
glass status              # Show verification dashboard
glass tree                # Display intent hierarchy
glass trace <unit-id>     # Show provenance chain for a unit
glass views               # Generate human-readable outlines
```

## Rules for AI Assistants

### Always
- Create a `.glass` spec file before writing implementation code
- Every unit needs both an Intent (why) and Contract (what it guarantees)
- Handle every failure mode explicitly in the contract
- Use `Result<T, E>` pattern for error handling (no thrown exceptions in library code)
- Run `glass verify` after making changes to confirm contracts are satisfied

### Never
- Create implementation without a paired `.glass` spec
- Leave failure modes unhandled in the contract
- Modify `.glass` files during compilation
- Expose sensitive data in outputs or logs
- Skip the verification step

## Coding Standards

- Strict mode always enabled
- Use descriptive names, no abbreviations
- Keep functions focused on a single responsibility
- Glass unit IDs use dotted notation: `module.unit_name`
- File names use kebab-case: `my-module.glass` / `my-module.ts`
