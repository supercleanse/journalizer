Read [GLASS.md](./GLASS.md) for the Glass Framework methodology, file format, and conventions used in this project.

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
