# Deploying to Vercel

The site is a static Vite build; Vercel builds and hosts it, and Supabase holds
the data. Do [supabase-setup.md](supabase-setup.md) first, so the project,
schema and Google sign-in exist.

## 1. Import the repo into Vercel

1. At [vercel.com/new](https://vercel.com/new), import the `nyu-journal` GitHub
   repo. Vercel detects Vite; keep the defaults (build `npm run build`, output
   `dist`).
2. Before the first deploy, open **Environment Variables** and add, for all
   environments (Production, Preview, Development):

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | the publishable key from Supabase **Project Settings → API Keys** |

   These are baked in at build time. If you add or change them later, redeploy.
   A build without them shows a "Missing configuration" page.
3. Deploy. Note the production URL, e.g. `https://nyu-journal.vercel.app`.

Every push to `main` now redeploys production, and other branches get preview
URLs. The build runs the TypeScript check, so a type error fails the deploy
and the previous version stays live.

## 2. Allow the Vercel URL to sign in

Google sends users back to Supabase, and Supabase then sends them back to the
app, but only to URLs it allows.

**Supabase → Authentication → URL Configuration**
- *Site URL*: the production URL, e.g. `https://nyu-journal.vercel.app`
- *Redirect URLs*, keep `http://localhost:5173/**` and add:
  - `https://nyu-journal.vercel.app/**`
  - `https://nyu-journal-*-<your-vercel-team>.vercel.app/**` for preview deploys
    (copy the pattern from a preview URL; optional)

**Google Cloud → Google Auth Platform → Clients → your client**
- *Authorized JavaScript origins*: add the production URL (no trailing slash).
- *Authorized redirect URIs*: unchanged; it stays the Supabase callback.

Google can take a few minutes to apply changes.

## 3. Let people sign in

While the Google app's audience is in **Testing**, only listed test users can
sign in: add Google accounts under **Google Auth Platform → Audience → Test
users**.

To open it to everyone, publish the app. Google first needs these under
**Branding**:
- *App name* and *User support email*
- *Application home page*: the production URL, e.g. `https://nyu-journal.vercel.app`
- *Application privacy policy link*: `https://nyu-journal.vercel.app/privacy`
  (served from `public/privacy.html`)
- *Authorized domains*: the production domain, e.g. `nyu-journal.vercel.app`

Then **Audience → Publish app**. With only the basic name/email/picture scopes
there's no Google review and no user cap. Skip the logo unless you plan to
verify a domain you own, since a logo triggers brand verification.

## 4. Turn on weekly backups (recommended)

The free Supabase plan has no backups you can download, so
`.github/workflows/backup.yml` dumps the database every Monday and keeps it as
an encrypted workflow artifact for 90 days. The repo is public, so it's
encrypted; anyone can download the artifact, but not read it.

1. In Supabase, click **Connect** and copy the **Session pooler** connection
   string (GitHub's runners can't reach the direct IPv6 connection). Put your
   database password in it.
2. In GitHub, **Settings → Secrets and variables → Actions**:
   - Secret `SUPABASE_DB_URL`: that connection string.
   - Secret `BACKUP_PASSPHRASE`: a long random passphrase. Keep a copy in a
     password manager; without it the backups are useless.
   - Variable (Variables tab) `BACKUPS_ENABLED`: `true`.
3. **Actions → Backup database → Run workflow** to check that it works.

To restore, download the artifact, then:

```sh
gpg --decrypt backup.tar.gz.gpg | tar xz        # asks for the passphrase
psql "$DB_URL" -f roles.sql -f schema.sql -c 'SET session_replication_role = replica' -f data.sql
```

## Free-tier notes

- **Pausing**: Supabase pauses a free project after about a week without
  activity. The app then can't load diaries until you press **Restore** in the
  Supabase dashboard. No data is lost.
- **Vercel Hobby** is for non-commercial use, which this is.
- Limits (500 MB database, 50,000 monthly users, 100 GB bandwidth) are far
  above what a few friends will use.
