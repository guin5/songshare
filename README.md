# Songboard

A responsive shared song collection for GitHub Pages. Visitors paste a Spotify or Apple Music song link, preview the match, and add it. No visitor account form. Includes manual entry when matching fails, artwork, search, duplicate prevention, and automatic refresh every 30 seconds.

## What you need to do

The code is ready; it is not connected to a live database yet. You need your own GitHub repository **and a Supabase project**. This package cannot create accounts or provision resources without access to them. Use a new Supabase project for this app.

### 1. Create the repository and upload the files

Create a public GitHub repository with default branch `main`. Extract this ZIP and upload **the contents of the songboard folder**, preserving the `.github` folder. `site`, `supabase`, `.github`, and `package.json` must be at the repository root.

GitHub's web uploader may omit hidden folders. The reliable method is GitHub Desktop: clone your new repository, copy all extracted files including `.github`, commit, and push. No npm install is needed.

### 2. Create the Supabase project

1. Go to https://supabase.com/dashboard and create a project. Save its database password.
2. In the project's API settings / Connect dialog, find the project URL and **publishable** key (the legacy **anon** key also works). Never use a secret or service-role key for the website.
3. Enable **anonymous sign-ins** under Authentication settings. Visitors can then submit without providing an email or password.
4. Create a Supabase personal access token at https://supabase.com/dashboard/account/tokens. This is used only by the deployment workflow.

### 3. Enter the GitHub settings

In the repository go to **Settings → Secrets and variables → Actions**.

Under **Variables**, create:

| Name | Value |
|---|---|
| `SUPABASE_URL` | Your project URL, such as `https://abcdefgh.supabase.co` (no trailing slash) |
| `SUPABASE_PUBLISHABLE_KEY` | Your publishable or legacy anon key |
| `SUPABASE_PROJECT_ID` | Your project reference, e.g. `abcdefgh` from the URL |
| `TURNSTILE_SITE_KEY` | Optional; see verification below |

Under **Secrets**, create:

| Name | Value |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Your personal access token |
| `SUPABASE_DB_PASSWORD` | The project's database password |

Do not paste these two secrets into website files or chat.

### 4. Run backend setup

In **Actions**, choose **Set up shared database → Run workflow**. It creates the tables, access rules, limits, and song-matching function. Wait for it to finish successfully.

### 5. Publish

In **Settings → Pages → Build and deployment**, set **Source** to **GitHub Actions**. In Actions, run **Publish website**. The workflow links to your live site, usually `https://YOURNAME.github.io/REPOSITORY/`.

Add a song from one browser and view the site in another. It should appear immediately after Refresh or within 30 seconds. Verify both service buttons open the intended recording.

## Verification for a public site

Anonymous sign-ins can be abused by creating new sessions. For a public site, enable Cloudflare Turnstile in Supabase's Auth bot-protection settings, create a Turnstile widget for your GitHub Pages hostname, put its secret key **in Supabase**, and put its public site key in the `TURNSTILE_SITE_KEY` GitHub variable. Run Publish website again. The frontend already includes the widget. For initial private testing, verification is optional.

## Admin removal

In Supabase's Table Editor, open `songs` and delete an unwanted row. Visitors cannot edit or delete songs. Display names are self-reported, not verified identities.

## Preview locally

Run `npm run preview`, then open http://localhost:8000. Without configuration, the page clearly says Preview mode and does not pretend that local submissions are shared. To test against your real project locally, fill in public settings in `site/config.js`. The workflow generates that file automatically for production.

## Implementation and limits

- Plain HTML/CSS/JavaScript; relative paths work with GitHub Pages project URLs. No frontend build or package install.
- Supabase REST/Auth APIs; sessions remain on the visitor's browser. Only public fields can be read; user identifiers and lookup events are private.
- The function authenticates each request through Supabase Auth. Gateway JWT verification is intentionally disabled because verification is done inside the handler.
- Songlink/Odesli matching uses its public v1-alpha.1 endpoint and US availability. This is an external dependency; matching may fail, miss a version, or change. Manual entry remains available. Not every song exists on both services. Spotify links must be full `open.spotify.com/track/...` links; shortened links, albums, and playlists are rejected. Apple album share links must include the song's `?i=` parameter.
- Database constraints and transactional limits prevent exact-link duplicates and limit each anonymous identity to 10 submissions per hour. Matching is limited to 20 requests per identity per 10 minutes and 8 globally per minute. These limits are not a complete defense against determined abuse; use verification for public sharing.
- Automatic refresh and search display up to the newest 1,000 songs. Artwork is loaded from the supplied HTTPS artwork host. Entries are text, never interpreted as HTML.
- Manual metadata is supplied by visitors and may be inaccurate. Automatic matches are shown for confirmation; no promise of exact recording/version matching.
- Deleting an anonymous auth user also deletes that user's songs. Do not automatically purge anonymous users if you want to preserve their submissions.
- Free-tier availability and quotas depend on provider terms. The package does not create subscriptions or charge anything itself.

## Validation

`npm test` checks song URL validation, canonicalization, supported-service matching, album rejection, and identical browser/server validation. Live database migrations and external matching need testing after your project is connected. Source documentation: https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages, https://supabase.com/docs/guides/auth/auth-anonymous, https://supabase.com/docs/guides/database/postgres/row-level-security, https://github.com/songlink/docs.

Browser visual QA could not be run in the build environment because Chromium was unavailable and its download was blocked. The source checks passed; review desktop/mobile appearance after publishing.
