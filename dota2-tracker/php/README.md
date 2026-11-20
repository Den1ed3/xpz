# XPZ Dota 2 Tracker on PHP

Use this version for a portfolio deployment on a PHP or cPanel host. It serves the tournament dashboard and keeps everyone’s imported matches in a shared SQLite database. PHP 8.0 or later requires cURL, PDO and PDO_SQLite. Use a 64-bit PHP installation for current Dota match IDs.

## Start locally

From the project root, run the following commands:

```sh
php php/prepare.php
read -rs -p 'Organizer password: ' LEDGER_ADMIN_TOKEN
echo
export LEDGER_ADMIN_TOKEN
php -d post_max_size=520M -S 127.0.0.1:8080 -t php/public php/router.php
```

Open http://127.0.0.1:8080/ for the dashboard. To import, open http://127.0.0.1:8080/admin and enter the username `organizer` and your chosen password. After sign-in the browser returns to the dashboard, where **Import match** accepts a match ID, a completed .dem replay or supported parsed JSON. The PHP development server is intended for local use.

## Deploy to Apache or cPanel

1. Place the project outside the web root and run `php php/prepare.php`. Set the subdomain's document root to the project's `php/public` directory. It includes the dashboard assets and a small front controller. Set up the site at the domain root.
2. Enable HTTPS, Apache mod_rewrite, and .htaccess overrides. Configure `LEDGER_ADMIN_TOKEN` as a long unique secret in the host's PHP environment. Allow access to the Authorization header in PHP-FPM or enable Apache `CGIPassAuth On`. On Nginx, route the exact paths `/api/matches`, `/api/replays` and `/admin` to the front controller.
3. Create `php/var` outside the document root with write access for PHP. You can specify another private writable file path with `LEDGER_DB`. Back up the SQLite file between tournaments. Imports are idempotent by match ID. Reimporting a parsed match can fill in detail that the initial lookup lacked.
4. Visit `/admin` to sign in, then import the first game. Viewers can load the dashboard without the organizer password. For a Discord-only audience, configure your host's access controls before sharing.

Organizer scripts can POST JSON to `/api/matches` with an `X-Ledger-Token` header. For a public match, send `{"id":"<match-id>"}`. For a manual import, send `{"match":{...}}` containing a completed 5v5 OpenDota-shaped scoreboard. The dashboard's upload control also adapts supported replay-parser output to this shape.

When a visitor opens the dashboard, the server refreshes one due Steam account's display name through OpenDota. Publicly available names are cached for a day and used throughout the tournament. Anonymous slots remain separate. Match lookup runs without a paid key. For higher quotas, set the optional `OPENDOTA_API_KEY` on the server. Direct access to a private lobby depends on OpenDota having the match. Keep a replay for practice games.

After UI changes, rerun `php php/prepare.php`. Deploy updated source and static files while preserving the database.

### Native replay uploads

On a Linux host with PHP proc_open and /usr/bin/prlimit available, install the compatible Linux binary from https://github.com/Resolut1onEDL/dota-replay-parser/releases and set LEDGER_REPLAY_PARSER to its absolute executable path outside the web root. The organizer can select a completed, uncompressed .dem directly. Temporary replay files are removed after conversion. The default size limit is 512 MiB. Configure PHP post_max_size above the chosen LEDGER_REPLAY_MAX_MIB limit, and allow the corresponding upload size and processing time in your reverse proxy. With native parsing disabled the dashboard uses its bundled browser replay reader.
