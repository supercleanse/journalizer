# Task ID: 20

**Title:** Set up GitHub Actions CI/CD pipeline for testing and deployment

**Status:** pending

**Dependencies:** 1

**Priority:** high

**Description:** Configure automated CI/CD pipeline using GitHub Actions for linting, type checking, testing, and deploying to Cloudflare Workers on push to main branch.

**Details:**

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloudflare

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
  
  deploy:
    needs: lint-and-test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

Add npm scripts to package.json:
- `lint`: ESLint on src/
- `typecheck`: tsc --noEmit
- `test`: Vitest unit tests
- `build`: Vite build + glass compile
- `deploy`: wrangler deploy

Set up Cloudflare API token as GitHub Secret. Configure D1 migrations to run in deployment.

Glass spec:
- `glass/ci/pipeline.glass` - Intent: automated testing and deployment; Contract: guarantees test execution before deploy, deployment atomicity, rollback capability, secret security

**Test Strategy:**

Push to main and verify workflow runs. Test that failing tests block deployment. Test that secrets are properly masked in logs. Verify deployment succeeds and worker is accessible. Test PR builds run tests but don't deploy.

## Subtasks

### 20.1. Create .github/workflows/deploy.yml with basic job structure

**Status:** pending  
**Dependencies:** None  

Set up the GitHub Actions workflow file with the overall structure including triggers (push to main, pull requests) and define the two main jobs: lint-and-test and deploy with proper dependencies.

**Details:**

Create `.github/workflows/deploy.yml` with workflow name 'Deploy to Cloudflare', configure triggers for push to main and pull_request events, define two jobs: 'lint-and-test' and 'deploy' where deploy needs lint-and-test and only runs on main branch (if: github.ref == 'refs/heads/main'). Use ubuntu-latest runners and Node.js 20.

### 20.2. Configure lint job with ESLint and add npm lint script

**Status:** pending  
**Dependencies:** 20.1  

Add ESLint configuration and create the npm run lint script in package.json, then add the lint step to the lint-and-test job in the GitHub Actions workflow.

**Details:**

Add 'lint' script to package.json that runs ESLint on src/ directory. Configure ESLint with TypeScript support if not already present. Add 'npm run lint' step to the lint-and-test job after npm ci. Ensure ESLint configuration catches common issues and enforces code style.

### 20.3. Add typecheck step using tsc --noEmit and npm script

**Status:** pending  
**Dependencies:** 20.1  

Create npm run typecheck script that runs TypeScript compiler in check-only mode, and add this step to the lint-and-test job to catch type errors before deployment.

**Details:**

Add 'typecheck' script to package.json running 'tsc --noEmit' to validate TypeScript without emitting files. Ensure tsconfig.json is properly configured for strict mode. Add 'npm run typecheck' step to lint-and-test job after the lint step.

### 20.4. Configure test job with Vitest and npm test script

**Status:** pending  
**Dependencies:** 20.1  

Set up Vitest testing framework, create npm run test script, and add the test execution step to the lint-and-test job in the workflow.

**Details:**

Install Vitest if not present. Add 'test' script to package.json running Vitest unit tests. Configure Vitest for the project structure. Add 'npm test' step to lint-and-test job after typecheck. Ensure tests run in CI mode without watch.

### 20.5. Add build and deploy npm scripts with Glass compilation

**Status:** pending  
**Dependencies:** None  

Create npm scripts for building the project (including Glass compilation) and deploying with Wrangler, preparing for the deployment job configuration.

**Details:**

Add 'build' script to package.json that runs Vite build followed by Glass compile command. Add 'deploy' script running 'wrangler deploy'. Ensure build output is properly configured for Cloudflare Workers. Verify Glass specs compile correctly as part of build process.

### 20.6. Configure deploy job with Cloudflare Wrangler action

**Status:** pending  
**Dependencies:** 20.5  

Set up the deploy job in the workflow with Cloudflare Wrangler GitHub Action, using secrets for authentication and including the build step before deployment.

**Details:**

In the deploy job, add checkout, setup-node, npm ci, and npm run build steps. Add cloudflare/wrangler-action@v3 step using apiToken and accountId from GitHub Secrets. Configure to use CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID secrets. Add D1 migration execution as part of deployment (wrangler d1 migrations apply).

### 20.7. Set up GitHub Secrets for Cloudflare API credentials

**Status:** pending  
**Dependencies:** None  

Create and configure CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID as GitHub repository secrets for secure authentication during deployment.

**Details:**

Generate Cloudflare API token with Workers deployment permissions from Cloudflare dashboard. Obtain Cloudflare Account ID from dashboard. Add both as GitHub Secrets in repository settings: CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID. Document the required permissions for the API token. Verify secrets are properly masked in workflow logs.
