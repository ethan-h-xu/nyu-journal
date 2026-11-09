# nyu-journal

An interactive NYU campus map built with React and TypeScript, using the vector
shapes from `nyu-downloadable-campus-map.pdf`.

```sh
npm install
npm run dev
```

Drag to pan, and scroll, pinch, or double-click to zoom. Arrow keys and `+`/`-`
also work, and `0` returns to Washington Square Park.

Hover over an NYU building to see its name. Buildings start greyed out; click
one to add a journal entry (required date, floor, half-step 💩 rating, notes), which turns
it purple. Clicking a logged building opens its log of past entries, where you
can add, edit, or delete entries.

**Diary** in the nav bar lists every entry across all buildings, newest first.
Click one to fly the map to its building and open that building's log.

**Feed** lists your friends' entries, most recently written first. Click one to
open it and fly the map to its building, or click a username to open that
friend's profile.

Sign in with Google to keep a diary; entries are stored in Supabase. Each user
picks a username, can find others by username from **My profile**, and can send
friend requests. Friends can see each other's entries, entry counts and friend
lists; nobody else can. The map only ever shows your own entries. Signed out,
you can still browse the map.

Setup: [docs/supabase-setup.md](docs/supabase-setup.md) (database and Google
sign-in), then [docs/deploy.md](docs/deploy.md) (Vercel and backups). For local
development, copy `.env.example` to `.env.local` and fill it in.

`src/data/campusMap.ts` is generated from the PDF by
`scripts/extract_campus_map.py` (requires `pip install pymupdf`).
