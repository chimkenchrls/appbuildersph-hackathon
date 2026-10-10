# Web deployment

OwlSet's web landing page is published to Vercel by GitHub Actions, and only for a commit
that CI has just verified on `main`. This document covers the one-time setup, how a
deployment runs, what to do when one fails, and how to roll back.

It concerns the web landing page only. Android APK builds are separate (see the README).

## How it works

```text
push to main ──▶ CI (lint, types, tests, Expo check, web export)
                   │ success
                   ▼
                 CD ──▶ build the same commit ──▶ publish to Vercel ──▶ smoke-check the live site
```

- `.github/workflows/ci.yml` verifies every push and pull request targeting `main`. It never deploys.
- `.github/workflows/cd.yml` starts when a CI run finishes. It deploys only if **all** of these hold:
  CI succeeded, CI was started by a push, the push was to `main`, and the commit is in this
  repository. Pull requests, forks, manual CI runs, and failed, cancelled or skipped runs are
  skipped before the job starts, so they never receive the production secrets.
- CD checks out the exact commit CI tested (`workflow_run.head_sha`), not the tip of the default branch.
- CI uploads no build, so CD rebuilds that commit with `vercel build --prod`. This runs the
  commands in `vercel.json` (`npm ci`, then `npm run build:web`) and packages the result as
  `.vercel/output`, which `vercel deploy --prebuilt --prod` uploads. Vercel does not build anything itself.
- The Vercel token is given only to the `vercel pull` and `vercel deploy` steps. The build
  step, which runs project code and dependencies, has no credentials.
- Deployments run one at a time and a running one is never cancelled.
- Before building, and again just before publishing, CD compares its commit with the current
  head of `main` and skips if `main` has moved on.
- After publishing, `scripts/smoke-web.mjs` checks the production site. If a check fails the
  job fails. It does not redeploy or roll back by itself.

Automatic Vercel deployments from Git are switched off in `vercel.json`
(`"git": { "deploymentEnabled": false }`), so nothing reaches production without passing CI
and nothing is deployed twice. This also stops Vercel's preview deployments for branches whose
`vercel.json` contains the setting. To keep previews, replace `false` with `{ "main": false }`.

### Versions

| Tool | Version | Where it is set |
| --- | --- | --- |
| Node.js | 22 | `ci.yml` and `cd.yml` (`node-version: 22`) |
| Vercel CLI | 63.1.0 | `VERCEL_CLI_VERSION` in `cd.yml` |
| Playwright (smoke checks only) | 1.64.0 | `PLAYWRIGHT_VERSION` in `cd.yml` |

Vercel offers Node 24.x (its default), 22.x and 20.x, and reads `engines.node` from
`package.json`. The earlier range `>=22.13.0` resolves to 24.x on Vercel, which is not what CI
tests. The range is now `>=22.13.0 <23`, so any build Vercel runs itself also uses 22.x.
The CLI and Playwright are installed into the runner's temporary directory; they are not
project dependencies.

## Current state of the Vercel project

Observed from outside on 10 October 2026 (Asia/Manila), without access to the Vercel account:

- GitHub shows Vercel deployments for this repository under the team `ck21-0485`, project `owlset`.
- `https://owlsetph.vercel.app/` serves the landing page built from `main` at `87f5048`.
  All smoke checks in this document passed against it.
- `https://owlset-silk.vercel.app/` now redirects (HTTP 307) to `https://owlsetph.vercel.app/`.
  It no longer serves the development FastAPI backend.
- The first production deployment of `87f5048` failed and a later one succeeded, so the
  project's settings were corrected in between. Which setting was wrong was not observed.
- Deployment URLs such as `https://owlset-<id>-ck21-0485.vercel.app` redirect to a Vercel login,
  so the smoke checks target the production domain.

Read from the Vercel API on the same day, after the project was linked:

- Root Directory is the repository root, the framework preset is Other, the production branch is
  `main`, and the project has no environment variables.
- The project stores a build command (`npm run build:web`) and output directory (`dist`) that
  match `vercel.json`. The install command comes from `vercel.json`.
- Both domains belong to this project. `owlset-silk.vercel.app` is configured to redirect to
  `owlsetph.vercel.app`.
- The project's Node.js Version is 24.x. Builds run by Actions use Node 22, and `engines.node`
  overrides the setting for any build Vercel runs itself, so this does not affect deployments.
  Setting it to 22.x in step 1 keeps the dashboard consistent.
- The team's other project is unrelated and holds no OwlSet domain.

## One-time setup

Do these in order. Steps 1 to 4 must be finished **before** the workflow reaches `main`,
because merging also switches off Vercel's own deployments.

### 1. Check the Vercel project settings

In the Vercel dashboard, open the project that owns the production domain, then **Settings**.

| Setting | Required value |
| --- | --- |
| Build and Deployment → Root Directory | empty (the repository root, not `local-ai/backend`) |
| Build and Deployment → Framework Preset | Other |
| Build, Output and Install Command overrides | off, so `vercel.json` supplies `npm run build:web`, `dist` and `npm ci` |
| Build and Deployment → Node.js Version | 22.x |
| Environments → Production → Branch Tracking | `main` |
| Environment Variables | none. Do not add Gemini, LM Studio, `EXPO_PUBLIC_*` or fixture variables |
| Domains | the production domain is assigned to this project, not to a backend project |

CD refuses to build if the project defines `EXPO_PUBLIC_*`, `GEMINI*`, `GOOGLE_API*` or
`LM_STUDIO*` variables, because the web build would embed them in a public bundle.

If a separate Vercel project still deploys `local-ai/backend`, it is a development backend and
should not hold a public OwlSet domain. Do not add a `/` route to it to hide a wrong assignment.

### 2. Get the project identifiers

On your own machine, in the repository root:

```sh
npx vercel@63.1.0 link        # logs in if needed; choose the team and the existing project from step 1
cat .vercel/repo.json         # or .vercel/project.json, depending on how the CLI linked
```

When the CLI links through the Git remote it writes `.vercel/repo.json`: the project's `id`
(`prj_...`) is the value for `VERCEL_PROJECT_ID` and its `orgId` (`team_...`) is the value for
`VERCEL_ORG_ID`. An older-style link writes `.vercel/project.json` with `projectId` and `orgId`.

`.vercel/` is ignored by Git. Never commit it. The CLI also creates `.env.local` holding a
short-lived token, and appends `.vercel` and `.env*` to `.gitignore`. Both files were already
ignored, and `.env*` would also ignore `.env.example`, so discard that edit:
`git checkout -- .gitignore`.

### 3. Create a Vercel token

In Vercel, open **Account Settings → Tokens** and create a token. Scope it to the team that
owns the project and give it an expiry date. Copy it once; it is not shown again. Note the
expiry somewhere the team will see it, because deployments fail when it lapses.

### 4. Configure the GitHub environment

The repository already has an environment named **Production**, created by Vercel's GitHub
integration. Environment names are not case sensitive, so the workflow's `production` uses it.
In GitHub, open **Settings → Environments → Production** and add:

| Kind | Name | Value |
| --- | --- | --- |
| Secret | `VERCEL_TOKEN` | the token from step 3 |
| Secret | `VERCEL_ORG_ID` | the `team_...` value from step 2 |
| Secret | `VERCEL_PROJECT_ID` | the `prj_...` value from step 2 |
| Variable | `PRODUCTION_URL` | the site's origin with no trailing path, for example `https://owlsetph.vercel.app` |

Or with the GitHub CLI (each `secret set` prompts for the value, so it stays out of shell history):

```sh
gh secret set VERCEL_TOKEN --env production
gh secret set VERCEL_ORG_ID --env production
gh secret set VERCEL_PROJECT_ID --env production
gh variable set PRODUCTION_URL --env production --body "https://owlsetph.vercel.app"
```

Recommended, in the same environment: under **Deployment branches and tags**, allow only `main`.

Keep these as environment secrets, not repository secrets. Environment secrets are released
only to a job that names the environment, and the deploy job is skipped before that point for
anything other than a verified push to `main`.

### 5. Merge to `main`

`workflow_run` only triggers a workflow whose file is on the default branch. Until `cd.yml` is
on `main`, nothing deploys from Actions. Merging does three things at once:

1. `cd.yml` reaches `main`, so the CI run for that merge triggers the first CD run.
2. `vercel.json` on `main` switches off Vercel's Git deployments.
3. The production site is from then on published only by CD.

If steps 1 to 4 were skipped, the first CD run fails at its first step with a message naming
what is missing, and production simply stays on its last deployment. Add the missing values
and re-run the job.

### 6. Confirm the first deployment

Open **Actions → CD** and the run for the merge commit. Its summary lists the tested commit,
the CI run, the deployment URL and each smoke check. In Vercel, the new production deployment
should show the CLI as its source, and no second deployment should appear for the same commit.

## Running the smoke checks by hand

```sh
npm install --prefix /tmp/smoke playwright@1.64.0
npx --prefix /tmp/smoke playwright install chromium
SMOKE_MODULES=/tmp/smoke node scripts/smoke-web.mjs --url https://owlsetph.vercel.app
```

The checks are:

- `/` returns HTTP 200 and HTML with the OwlSet document title. A JSON 404 fails. In CD the page
  must also be byte-identical to the `index.html` just built, which proves the domain serves this
  build; this first check is retried up to 12 times, 5 seconds apart.
- Both Kwagi sprite sheets, both fonts and the favicon return the right content type and the
  right file signature. The routing fallback serves HTML for unknown paths, so HTML never counts as an asset.
- In a real browser, after JavaScript loads: the landing page renders; the demo options change
  the result and the cited clauses; the hero Kwagi shows a reaction when clicked; the closing
  Kwagi opens his speech bubble; no script errors occur.
- A direct visit to `/project/demo-website` returns HTTP 200 and redirects to the landing page.
- At 360 pixels wide: the menu opens, lists the sections and closes; nothing scrolls sideways.

## When a deployment fails

The CD summary says which of three things happened.

| Summary result | State of production | What to do |
| --- | --- | --- |
| Skipped | unchanged | Nothing. A newer commit is on `main` and its own CI run deploys it. |
| Failed before publishing | unchanged | Read the failing step. Fix configuration and re-run the job, or fix the code with a new commit. |
| Published, but verification failed | the new deployment is live | Decide quickly: roll back (below) if the site is broken, then fix forward with a new commit. |

Re-running a failed CD run repeats it for the same commit, and it deploys only if that commit
is still the head of `main`. To deploy the current head again without a new commit, re-run its
CI run. CD never redeploys by itself and never rewrites Git history; neither should you.
Revert with a new commit (`git revert`), not a force-push.

## Rolling back

Rollback is manual and happens in Vercel. It does not need a build.

1. In Vercel, open the project's **Deployments** and find the last deployment that was good.
   The CD summary of an earlier successful run gives its URL.
2. Open its menu (⋮) and choose **Instant Rollback**, then confirm. The same button is on the
   project overview's production deployment tile. From a terminal linked to the project:
   `npx vercel@63.1.0 rollback <deployment-url>`.
3. Check the site: `SMOKE_MODULES=/tmp/smoke node scripts/smoke-web.mjs --url <production-url>`.
4. Fix the problem on `main` with a new commit or a revert commit.

After a rollback Vercel stops assigning the production domain to new production deployments
until one is promoted. The next CD run will therefore publish but fail its first smoke check,
because the domain still serves the rolled-back build. When the fix is ready, promote that
deployment in Vercel (**Undo Rollback** on the production deployment tile, or
`npx vercel@63.1.0 promote <deployment-url>`), which also turns automatic assignment back on.
On the Hobby plan only the immediately previous production deployment can be restored; Pro and
Enterprise can restore any deployment that was previously live on the production domain.

## Known limits

- **A short race remains.** The second freshness check and the upload are separate steps. A push
  to `main` in the seconds between them lets an older commit publish first; the newer commit's
  own run then replaces it. Serialising deployments limits this to one run at a time.
- **Waiting runs can be dropped.** If several deployments queue up, GitHub keeps the newest and
  cancels the others. Those were stale anyway.
- **The build is repeated.** CD rebuilds the commit CI built. The lockfile and Node major are the
  same, but the two builds are separate runs.
- **Verification follows publication.** A deployment that fails its smoke checks is already live
  until someone rolls it back.
- **A manual CI run does not deploy.** Only push-triggered runs do.

## Maintenance

- To change the Vercel CLI or Playwright version, edit the two values at the top of `cd.yml`,
  run `vercel build --prod` locally to confirm `.vercel/output/static` still contains the Expo
  export, and run the smoke checks.
- Actions are pinned by commit SHA. Update the SHA and the version comment together.
- Rotate `VERCEL_TOKEN` before it expires: create a new token, update the secret, revoke the old one.

## Landing-page app screens

The phone screens on the landing page are images in `public/app/`, rendered from the app's own
screens with labelled demo data (react-native-web renders, not device captures). Regenerate them
after a screen's layout or copy changes, and commit the result:

```sh
npm install --prefix /tmp/smoke playwright@1.64.0 && npx --prefix /tmp/smoke playwright install chromium
SMOKE_MODULES=/tmp/smoke node scripts/capture-app-screens.mjs
```

The script exports a separate web build with `EXPO_PUBLIC_APP_SCREENSHOTS=1`, which enables the
`/capture` route (`src/app/capture.tsx`) and keeps the mobile light palette on web. That build
uses its own Metro cache, so it cannot affect a normal build. Converting to WebP needs
`python3` with Pillow. The fixture data is in `src/screens/CaptureScreen.tsx`.
