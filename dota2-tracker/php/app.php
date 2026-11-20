<?php
declare(strict_types=1);

require_once __DIR__ . '/src/replay.php';
require_once __DIR__ . '/src/native.php';

final class ApiError extends RuntimeException {}
function reject(int $status, string $message): void { throw new ApiError($message, $status); }
function jsonReply(array $data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_INVALID_UTF8_SUBSTITUTE | JSON_THROW_ON_ERROR);
}
function requireOrganizer(): void {
    $secret = getenv('LEDGER_ADMIN_TOKEN') ?: '';
    if ($secret === '') { reject(503, 'The host must configure LEDGER_ADMIN_TOKEN before importing matches.'); }
    $provided = $_SERVER['HTTP_X_LEDGER_TOKEN'] ?? '';
    if ($provided === '' && ($_SERVER['PHP_AUTH_USER'] ?? '') === 'organizer') {
        $provided = $_SERVER['PHP_AUTH_PW'] ?? '';
    }
    if (!hash_equals($secret, $provided)) {
        header('WWW-Authenticate: Basic realm="XPZ Dota 2 Tracker organizer", charset="UTF-8"');
        reject(401, 'Sign in as organizer at /admin before importing.');
    }
}
function db(): PDO {
    $file = getenv('LEDGER_DB') ?: __DIR__ . '/var/lobby.sqlite';
    if (!is_dir(dirname($file)) && !mkdir(dirname($file), 0700, true) && !is_dir(dirname($file))) { throw new RuntimeException('Database directory unavailable'); }
    $db = new PDO('sqlite:' . $file, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $db->exec('PRAGMA busy_timeout=5000');
    $db->exec('CREATE TABLE IF NOT EXISTS matches(id TEXT PRIMARY KEY, started INTEGER NOT NULL, payload TEXT NOT NULL)');
    $db->exec('CREATE TABLE IF NOT EXISTS profiles(id TEXT PRIMARY KEY, name TEXT, checked INTEGER NOT NULL DEFAULT 0)');
    return $db;
}
// Endpoint paths are assembled exclusively from validated numeric identifiers.
function openDota(string $path): array {
    $url = 'https://api.opendota.com/api/' . $path;
    if ($key = getenv('OPENDOTA_API_KEY')) { $url .= '?api_key=' . rawurlencode($key); }
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT => 8, CURLOPT_TIMEOUT => 18, CURLOPT_USERAGENT => 'AncientLedger/1.0', CURLOPT_HTTPHEADER => ['Accept: application/json']]);
    $response = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    if ($response === false) { reject(502, 'OpenDota could not be reached. Try again later.'); }
    if ($status === 404) { reject(404, 'OpenDota has no data for this ID. Try importing the parsed replay JSON.'); }
    if ($status === 429) { reject(429, 'OpenDota is rate-limiting requests. Try again later.'); }
    $data = json_decode($response, true);
    if ($status !== 200 || !is_array($data)) { reject(502, 'OpenDota could not provide this record.'); }
    return $data;
}
function integerValue($value, int $min = 0, int $max = PHP_INT_MAX): bool {
    return is_int($value) && $value >= $min && $value <= $max;
}
function matchId($value): string {
    if (!(is_int($value) || is_string($value)) || !preg_match('/^[1-9][0-9]{0,15}$/D', (string)$value) || (strlen((string)$value) === 16 && strcmp((string)$value, '9007199254740991') > 0)) {
        reject(422, 'Enter a positive numeric Dota match ID.');
    }
    return (string)$value;
}
function metricList(array $raw, string $field, int $minimum = 0): array {
    $value = $raw[$field] ?? null;
    if (!is_array($value) || count($value) > 1200 || array_keys($value) !== array_keys(array_values($value))) { return []; }
    foreach ($value as $n) { if (!integerValue($n, $minimum, 100000000)) { return []; } }
    return $value;
}
function cleanName($input): ?string {
    if (!is_string($input)) { return null; }
    $name = trim(preg_replace('/[[:cntrl:]]/u', '', $input) ?? '');
    return $name !== '' && strlen($name) <= 256 ? $name : null;
}
function cleanMatch(array $raw): array {
    $id = matchId($raw['match_id'] ?? null);
    if (!is_bool($raw['radiant_win'] ?? null) || !integerValue($raw['duration'] ?? null, 1, 86400) || !integerValue($raw['start_time'] ?? null, 1)) {
        reject(422, 'The match needs a start time, completed result and duration in seconds.');
    }
    if (!is_array($raw['players'] ?? null) || count($raw['players']) !== 10) {
        reject(422, 'A completed 5v5 scoreboard with ten players is required.');
    }
    $match = ['match_id' => (int)$id, 'radiant_win' => $raw['radiant_win'], 'duration' => $raw['duration'], 'start_time' => $raw['start_time']];
    foreach (['radiant_score', 'dire_score', 'game_mode', 'lobby_type', 'leagueid', 'version', 'patch'] as $key) {
        if (integerValue($raw[$key] ?? null)) { $match[$key] = $raw[$key]; }
    }
    foreach (['radiant_gold_adv', 'radiant_xp_adv'] as $key) {
        if ($values = metricList($raw, $key, -100000000)) { $match[$key] = $values; }
    }
    if (is_array($raw['position_track'] ?? null)) {
        foreach (array_slice($raw['position_track'],0,18000) as $row) {
            if (integerValue($row['t'] ?? null,0,604800) && is_array($row['p'] ?? null) && count($row['p'])===20 &&
                count(array_filter($row['p'],static fn($v)=>integerValue($v,-1,512)))===20) {
                $match['position_track'][]=['t'=>$row['t'],'p'=>array_values($row['p'])];
            }
        }
    }
    $slots = []; $accounts = [];
    foreach ($raw['players'] as $p) {
        if (!is_array($p)) { reject(422, 'Invalid player scoreboard.'); }
        $slot = $p['player_slot'] ?? null;
        if (!in_array($slot, [0,1,2,3,4,128,129,130,131,132], true) || isset($slots[$slot]) || !integerValue($p['hero_id'] ?? null, 1, 10000)) {
            reject(422, 'Each player needs a distinct team slot and valid hero ID.');
        }
        $slots[$slot] = true;
        $player = ['player_slot' => $slot, 'hero_id' => $p['hero_id']];
        foreach (['kills','deaths','assists'] as $key) {
            if (!integerValue($p[$key] ?? null)) { reject(422, 'A player is missing a valid kill, death or assist count.'); }
            $player[$key] = $p[$key];
        }
        $account = $p['account_id'] ?? null;
        if (is_string($account) && preg_match('/^[0-9]{1,10}$/D', $account)) { $account = (int)$account; }
        $player['account_id'] = integerValue($account, 1, 4294967294) ? $account : null;
        if ($player['account_id'] !== null) {
            if (isset($accounts[$account])) { reject(422, 'Duplicate Steam account in the match.'); }
            $accounts[$account] = true;
        }
        foreach (['personaname','name'] as $key) { if ($name = cleanName($p[$key] ?? null)) { $player[$key] = $name; } }
        foreach (['last_hits','denies','level','gold_per_min','xp_per_min','net_worth','total_gold','total_xp','hero_damage','tower_damage','hero_healing','obs_placed','sen_placed','support_gold','item_neutral','backpack_0','backpack_1','backpack_2','item_0','item_1','item_2','item_3','item_4','item_5'] as $key) {
            if (integerValue($p[$key] ?? null)) { $player[$key] = $p[$key]; }
        }
        foreach (['ability_upgrades_arr','gold_t','xp_t','times'] as $key) {
            if ($values = metricList($p, $key, $key === 'times' ? -900 : 0)) { $player[$key] = $values; }
        }
        if (is_array($p['skill_build'] ?? null)) {
            $build = [];
            foreach (array_slice($p['skill_build'], 0, 120) as $skill) {
                if (!is_array($skill) || !is_string($skill['key'] ?? null) || !preg_match('/^[a-zA-Z0-9_]{1,128}$/D', $skill['key'])) { continue; }
                $step = ['key' => $skill['key']];
                foreach (['time', 'hero_level'] as $key) {
                    if (integerValue($skill[$key] ?? null, $key === 'time' ? -1000 : 0, 86400)) { $step[$key] = $skill[$key]; }
                }
                $build[] = $step;
            }
            $player['skill_build'] = $build;
        }
        if (is_array($p['purchase_log'] ?? null)) {
            $purchases = [];
            foreach (array_slice($p['purchase_log'], 0, 3000) as $buy) {
                if (is_array($buy) && integerValue($buy['time'] ?? null, -1000, 86400) && is_string($buy['key'] ?? null) && preg_match('/^[a-zA-Z0-9_]{1,96}$/D', $buy['key'])) {
                    $purchases[] = ['time'=>$buy['time'], 'key'=>$buy['key']];
                }
            }
            $player['purchase_log'] = $purchases;
        }
        foreach (array_slice($p['inventory_snapshots'] ?? [],0,12000) as $row) {
            if (!integerValue($row['time'] ?? null,-3600,604800) || count($row['items'] ?? [])!==6) {continue;}
            $items=$row['items'];
            if(count(array_filter($items,static fn($v)=>$v===null||integerValue($v,0,100000)||(is_string($v)&&preg_match('/^[a-zA-Z0-9_]{1,120}$/D',$v))))===6){
                $player['inventory_snapshots'][]=['time'=>$row['time'],'items'=>array_values($items)];
            }
        }
        foreach (array_slice($p['skill_snapshots'] ?? [],0,4000) as $row) {
            if (!integerValue($row['time'] ?? null,-3600,604800) || !is_array($row['skills'] ?? null)) {continue;}
            $skills=[];
            foreach(array_slice($row['skills'],0,32) as $sk){
                if(is_string($sk['key'] ?? null)&&preg_match('/^[a-zA-Z0-9_]{1,120}$/D',$sk['key'])&&integerValue($sk['level'] ?? null,1,100))$skills[]=['key'=>$sk['key'],'level'=>$sk['level']];
            }
            $player['skill_snapshots'][]=['time'=>$row['time'],'skills'=>$skills];
        }
        $match['players'][] = $player;
    }
    foreach (['radiant_score' => true, 'dire_score' => false] as $key => $radiant) {
        if (!isset($match[$key])) {
            $team = array_filter($match['players'], static fn($p) => ($p['player_slot'] < 128) === $radiant);
            $match[$key] = array_sum(array_column($team, 'kills'));
        }
    }
    return $match;
}
function storeMatch(PDO $db, array $match): array {
    $db->exec('BEGIN IMMEDIATE');
    try {
        $stmt = $db->prepare('SELECT payload FROM matches WHERE id=?');
        $stmt->execute([$match['match_id']]);
        if ($encoded = $stmt->fetchColumn()) {
            $prior = json_decode($encoded, true, 64, JSON_THROW_ON_ERROR);
            $oldPlayers = array_column($prior['players'], null, 'player_slot');
            foreach ($match['players'] as &$p) {
                $old = $oldPlayers[$p['player_slot']] ?? [];
                if (($old['hero_id'] ?? null) !== $p['hero_id'] || ($old['account_id'] && $p['account_id'] && $old['account_id'] !== $p['account_id'])) {
                    reject(409, 'This match ID already has a different scoreboard.');
                }
                if ($p['account_id'] === null) { $p['account_id'] = $old['account_id'] ?? null; }
                $p = array_replace($old, $p);
            }
            unset($p);
            $match = array_replace($prior, $match);
        }
        $write = $db->prepare('INSERT INTO matches(id,started,payload) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET started=excluded.started,payload=excluded.payload');
        $write->execute([$match['match_id'], $match['start_time'], json_encode($match, JSON_THROW_ON_ERROR)]);
        $addProfile = $db->prepare('INSERT OR IGNORE INTO profiles(id) VALUES(?)');
        foreach ($match['players'] as $p) { if ($p['account_id']) { $addProfile->execute([$p['account_id']]); } }
        $db->exec('COMMIT');
    } catch (Throwable $e) { $db->exec('ROLLBACK'); throw $e; }
    return $match;
}
function listMatches(PDO $db): array {
    $now = time();
    $stale = $now - 86400;
    $next = $db->prepare('SELECT id FROM profiles WHERE checked<=? ORDER BY checked,id LIMIT 1');
    $next->execute([$stale]);
    if ($id = $next->fetchColumn()) {
        $claim = $db->prepare('UPDATE profiles SET checked=? WHERE id=? AND checked<=?');
        $claim->execute([$now, $id, $stale]);
        if ($claim->rowCount() === 1) {
            try {
                $profile = openDota('players/' . $id);
                if ($n = cleanName($profile['profile']['personaname'] ?? null)) {
                    $db->prepare('UPDATE profiles SET name=? WHERE id=?')->execute([$n, $id]);
                }
            } catch (ApiError $e) {
                // Failed lookups retain the last known name. Delay retry so other accounts get a turn.
                $db->prepare('UPDATE profiles SET checked=? WHERE id=?')->execute([$stale + 3600, $id]);
            }
        }
    }
    $names = $db->query('SELECT id,name FROM profiles WHERE name IS NOT NULL')->fetchAll(PDO::FETCH_KEY_PAIR);
    $matches = [];
    foreach ($db->query('SELECT payload FROM matches ORDER BY started DESC,id DESC') as $row) {
        $match = json_decode($row['payload'], true, 64, JSON_THROW_ON_ERROR);
        foreach ($match['players'] as &$p) {
            if ($id = $p['account_id']) {
                $names[$id] ??= $p['personaname'] ?? $p['name'] ?? null;
                if ($names[$id] !== null) { $p['personaname'] = $names[$id]; }
            }
        }
        unset($p);
        $matches[] = $match;
    }
    return $matches;
}
function runLedger(): void {
    try {
        $path = rtrim((string)parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/');
        $method = $_SERVER['REQUEST_METHOD'];
        if ($path === '/admin' && $method === 'GET') {
            requireOrganizer();
            header('Cache-Control: no-store');
            header('Location: /', true, 303);
            return;
        }
        if (!in_array($path, ['/api/matches', '/api/replays'], true)) { reject(404, 'Unknown route.'); }
        if ($method === 'GET' && $path === '/api/matches') {
            jsonReply(['matches' => listMatches(db()), 'capabilities' => [
                'nativeReplayUpload' => nativeParserPath() !== null, 'maxReplayBytes' => nativeReplayLimit()
            ]]);
            return;
        }
        if ($method !== 'POST') {
            header('Allow: ' . ($path === '/api/replays' ? 'POST' : 'GET, POST'));
            reject(405, 'Unsupported method.');
        }
        requireOrganizer();
        if (isset($_SERVER['HTTP_ORIGIN'])) {
            $origin = parse_url($_SERVER['HTTP_ORIGIN']);
            $host = is_array($origin) ? ($origin['host'] ?? '') . (isset($origin['port']) ? ':' . $origin['port'] : '') : '';
            if (strcasecmp($host, $_SERVER['HTTP_HOST'] ?? '') !== 0) { reject(403, 'Import from this site or an authenticated CLI.'); }
        }
        $type = strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]));
        if ($path === '/api/replays') {
            if ($type !== 'application/octet-stream') { reject(415, 'Send the .dem file as application/octet-stream.'); }
            jsonReply(['match' => importNativeReplay()]);
            return;
        }
        if ($type !== 'application/json') { reject(415, 'Send the import as application/json.'); }
        $limit = 32 * 1024 * 1024;
        if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > $limit) { reject(413, 'JSON exceeds the 32 MB import limit.'); }
        $body = file_get_contents('php://input', false, null, 0, $limit + 1);
        if ($body === false || strlen($body) > $limit) { reject(413, 'JSON exceeds the 32 MB import limit.'); }
        try { $input = json_decode($body, true, 64, JSON_THROW_ON_ERROR | JSON_BIGINT_AS_STRING); }
        catch (JsonException $e) { reject(400, 'Invalid JSON.'); }
        if (!is_array($input)) { reject(422, 'Provide a match ID or parsed match JSON.'); }
        if (isset($input['id'])) {
            $id = matchId($input['id']);
            $raw = openDota('matches/' . $id);
            if ((string)($raw['match_id'] ?? '') !== $id) { reject(502, 'OpenDota returned an unexpected match ID.'); }
        } else { $raw = $input['match'] ?? null; }
        if (!is_array($raw)) { reject(422, 'Provide a match ID or parsed match JSON.'); }
        if (!isset($raw['match_id'])) {
            try { $raw = tournamentReplayMatch($raw); }
            catch (InvalidArgumentException | TypeError $e) { reject(422, 'Invalid replay-parser match or player fields.'); }
        }
        $match = cleanMatch($raw);
        jsonReply(['match' => storeMatch(db(), $match)]);
    } catch (ApiError $e) { jsonReply(['error' => $e->getMessage()], $e->getCode()); }
    catch (Throwable $e) {
        error_log('XPZ Dota 2 Tracker database or runtime failure (' . get_class($e) . ')');
        jsonReply(['error' => 'The host could not complete this request. Check the PHP extensions and database permissions.'], 500);
    }
}
