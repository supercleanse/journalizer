# Task ID: 23

**Title:** Initialize GitHub repository and configure version control

**Status:** pending

**Dependencies:** None

**Priority:** high

**Description:** Create the GitHub repository 'supercleanse/journalizer', initialize local git repository, configure remote origin, commit all existing project files (CLAUDE.md, GLASS.md, manifest.glass, glass.config.json, .gitignore, docs/PRD.md, .taskmaster config), and push to remote.

**Details:**

**CRITICAL: This is the very first task in the entire project.** This foundational task establishes version control and the remote repository infrastructure that all subsequent development depends on. No other development work can begin until this task is completed.

**Current project state:**
- Project directory exists at `/Users/supercleanse/Development/journalizer`
- Git repository has NOT been initialized yet (no .git directory)
- Project files exist locally: CLAUDE.md, GLASS.md, manifest.glass, glass.config.json, .gitignore, .mcp.json, docs/PRD.md, .taskmaster/config.json, and directory structures (annotations/, glass/, glass-views/, src/, tests/, dist/)
- No remote repository exists yet

**Prerequisites:**
- GitHub account 'supercleanse' must exist
- GitHub CLI (`gh`) or GitHub API access credentials available
- Git installed locally

**Step-by-step implementation:**

1. **Create GitHub repository:**
   ```bash
   gh repo create supercleanse/journalizer --public --description "AI-powered personal journal with SMS/web entry, voice transcription, and smart reminders" --source=. --remote=origin
   ```
   Alternative using GitHub API if `gh` is not available:
   ```bash
   curl -X POST https://api.github.com/user/repos \
     -H "Authorization: token $GITHUB_TOKEN" \
     -d '{"name":"journalizer","description":"AI-powered personal journal","private":false}'
   ```

2. **Initialize local git repository:**
   ```bash
   cd /Users/supercleanse/Development/journalizer
   git init
   ```

3. **Update .gitignore with project-specific entries:**
   The existing .gitignore currently contains only:
   ```
   node_modules/
   dist/
   *.log
   .DS_Store
   ```
   
   Must add additional entries for this project:
   ```
   .env
   .env.local
   .wrangler/
   .claude/settings.local.json
   .taskmaster/state.json
   ```
   
   These additions prevent sensitive and local-specific files from being committed.

4. **Stage all project files:**
   ```bash
   git add .gitignore
   git add CLAUDE.md GLASS.md manifest.glass glass.config.json
   git add docs/PRD.md
   git add .taskmaster/config.json
   git add .mcp.json
   git add annotations/ glass/ glass-views/ src/ tests/ dist/
   ```

5. **Create initial commit:**
   ```bash
   git commit -m "Initial commit: Project setup with Glass Framework

- Add Glass Framework documentation (GLASS.md, CLAUDE.md)
- Add project manifest and configuration (manifest.glass, glass.config.json)
- Add PRD documentation (docs/PRD.md)
- Add TaskMaster AI configuration (.taskmaster/config.json)
- Add MCP server configuration (.mcp.json)
- Configure gitignore for Node.js and Glass projects
- Initialize project structure (glass/, src/, tests/, annotations/, glass-views/)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
   ```

6. **Configure remote origin:**
   If not already configured by `gh repo create`:
   ```bash
   git remote add origin https://github.com/supercleanse/journalizer.git
   ```

7. **Verify remote configuration:**
   ```bash
   git remote -v
   ```

8. **Push to remote repository:**
   ```bash
   git branch -M main
   git push -u origin main
   ```

9. **Configure branch protection rules (recommended):**
   ```bash
   gh repo edit supercleanse/journalizer --enable-auto-merge --delete-branch-on-merge
   ```

**Important considerations:**
- According to CLAUDE.md, this project follows a feature branch workflow with PR-based development
- Main branch should be protected to enforce the PR workflow
- All future development (starting with Task 1) must follow: feature branch → PR → reviews → merge
- The .taskmaster/state.json file contains transient state and should be added to .gitignore
- The .claude/settings.local.json is user-specific and should remain in .gitignore

**Files to commit (verified to exist):**
- CLAUDE.md (669 bytes) - Feature development process documentation
- GLASS.md (4420 bytes) - Glass Framework methodology
- manifest.glass (307 bytes) - Living requirements document
- glass.config.json (221 bytes) - Project configuration
- .gitignore (36 bytes) - Git exclusion rules (will be updated)
- docs/PRD.md - Product requirements document
- .taskmaster/config.json - TaskMaster configuration
- .mcp.json (187 bytes) - MCP server configuration
- Directory structures: annotations/, glass/, glass-views/, src/, tests/, dist/

**Blocking relationship:**
This task blocks Task 1 (Initialize Cloudflare Workers project) and ALL other tasks because:
- Version control must be established before any code is written
- Task 1's Cloudflare Workers initialization will generate files (package.json, wrangler.toml, etc.) that need to be tracked in git
- The feature branch workflow required by CLAUDE.md needs a main branch to exist
- CI/CD pipelines (required by Task 1+) integrate with the GitHub repository
- **This is explicitly the first task that must be completed before any development begins**

**Test Strategy:**

**Verification steps:**

1. **Verify GitHub repository exists:**
   ```bash
   gh repo view supercleanse/journalizer
   ```
   Should display repository details including description and URL.

2. **Verify local git initialization:**
   ```bash
   git status
   ```
   Should show "On branch main" and no errors.

3. **Verify remote configuration:**
   ```bash
   git remote get-url origin
   ```
   Should output: `https://github.com/supercleanse/journalizer.git`

4. **Verify all files are committed:**
   ```bash
   git log --oneline
   git ls-tree -r main --name-only
   ```
   Should show initial commit and list all committed files including:
   - CLAUDE.md
   - GLASS.md
   - manifest.glass
   - glass.config.json
   - .gitignore
   - docs/PRD.md
   - .taskmaster/config.json
   - .mcp.json

5. **Verify push to remote:**
   ```bash
   git log origin/main
   ```
   Should show the same commit as local main branch.
   
   Visit https://github.com/supercleanse/journalizer in browser and verify:
   - Repository is visible
   - Initial commit appears in commit history
   - All files are visible in the repository
   - Project description is displayed

6. **Verify .gitignore is working:**
   ```bash
   git status --ignored
   ```
   Should show .taskmaster/state.json, .claude/settings.local.json in ignored files section.

7. **Verify branch setup:**
   ```bash
   git branch -vv
   ```
   Should show main branch tracking origin/main with [origin/main] indicator.

8. **Test feature branch workflow (required for subsequent tasks):**
   ```bash
   git checkout -b test/verify-git-setup
   echo "# Journalizer" > README.md
   git add README.md
   git commit -m "test: verify git workflow"
   git push -u origin test/verify-git-setup
   ```
   Should successfully push feature branch. Then verify branch appears on GitHub and delete:
   ```bash
   git checkout main
   git branch -D test/verify-git-setup
   git push origin --delete test/verify-git-setup
   ```

9. **Verify no sensitive files committed:**
   ```bash
   git log --all --full-history -- ".env*" "*.key" "*.pem" ".taskmaster/state.json" ".claude/settings.local.json"
   ```
   Should return empty (no matches).

10. **Verify repository is ready for Task 1:**
   ```bash
   git status
   ```
   Should show clean working tree on main branch, ready for feature branch creation.

**Success criteria:**
- ✅ GitHub repository supercleanse/journalizer exists and is accessible
- ✅ Local repository initialized with main branch
- ✅ Remote origin points to github.com/supercleanse/journalizer
- ✅ Initial commit contains all documented files
- ✅ Commit is pushed and visible on GitHub
- ✅ .gitignore properly excludes generated, local, and sensitive files
- ✅ Feature branch workflow is functional (tested)
- ✅ Repository is ready for Task 1 to begin
