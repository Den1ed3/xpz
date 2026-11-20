# XPZ Dota 2 Tracker

Track Dota 2 in-house matches by match ID, replay file or parsed match JSON. The dashboard includes player and hero rankings, animated hero showcases, match reports, build timelines and tactical replay playback.

## PHP hosting

See [PHP setup and organizer access](php/README.md) for the SQLite-backed deployment and optional native replay parser. The browser replay reader can also import a completed `.dem` file directly.

## Developer preview

From this directory, with Node.js 22.13 or later, run `npm run build` followed by `npm run dev -- --port 5173`. Open `http://localhost:5173`. The development server uses an in-memory database. Use the PHP deployment for persistent storage, or configure a compatible Worker host with a `DB` binding and the migrations in `drizzle/`.

## Assets

See [asset credits](ui/assets/CREDITS.txt) and the bundled dependency licenses.
