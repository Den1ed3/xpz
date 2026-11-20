<?php
declare(strict_types=1);

/** Convert a Resolut1onEDL/dota-replay-parser export to the tracker's match shape.
 * Decode JSON with JSON_BIGINT_AS_STRING on a 64-bit PHP runtime. */
function tournamentReplayMatch(array $input): array
{
    if (isset($input['match_id'])) {
        return $input;
    }
    if (!is_bool($input['didRadiantWin'] ?? null) || !is_array($input['players'] ?? null)) {
        throw new InvalidArgumentException('Choose an OpenDota match or a dota-replay-parser JSON export.');
    }
    $players = [];
    $slots = [0, 128];
    foreach ($input['players'] as $p) {
        if (empty($p['heroId'])) {
            continue;
        }
        if (!is_bool($p['isRadiant'] ?? null)) {
            throw new InvalidArgumentException('The replay is missing team assignments.');
        }
        $side = $p['isRadiant'] ? 0 : 1;
        $id = (int) ($p['steamAccountId'] ?? 0);
        if ($id >= 76561197960265728) {
            $id -= 76561197960265728;
        }
        $player = ['account_id' => $id > 0 && $id < 4294967295 ? $id : null,
            'player_slot' => $slots[$side]++, 'hero_id' => $p['heroId']];
        $fields = ['kills'=>'kills','deaths'=>'deaths','assists'=>'assists',
            'goldPerMinute'=>'gold_per_min','experiencePerMinute'=>'xp_per_min','networth'=>'net_worth',
            'numLastHits'=>'last_hits','numDenies'=>'denies','level'=>'level','heroDamage'=>'hero_damage',
            'heroHealing'=>'hero_healing','towerDamage'=>'tower_damage'];
        foreach ($fields as $from => $to) {
            if (isset($p[$from])) {
                $player[$to] = $p[$from];
            }
        }
        for ($i=0; $i<6; $i++) {
            $player['item_'.$i] = $p['item'.$i.'Id'] ?? 0;
        }
        $stats = $p['stats'] ?? [];
        foreach (['goldPerMinute'=>'gold_t','experiencePerMinute'=>'xp_t'] as $from => $to) {
            if (isset($stats[$from])) {
                $player[$to] = $stats[$from];
            }
        }
        if (isset($stats['itemPurchases'])) {
            $player['purchase_log'] = array_map(static function (array $item): array {
                return ['key'=>preg_replace('/^item_/', '', $item['itemName'] ?? '') ?: 'item_'.$item['itemId'],
                    'time'=>(int)floor($item['time']), 'item_id'=>$item['itemId']];
            }, $stats['itemPurchases']);
        }
        if (isset($stats['skillBuild'])) {
            $player['skill_build'] = array_map(static fn(array $skill): array =>
                ['key'=>$skill['abilityName'], 'time'=>(int)floor($skill['time']), 'hero_level'=>$skill['heroLevel']],
                $stats['skillBuild']);
        }
        $slotsHeld=array_fill(0,6,0); $history=[];
        foreach ($stats['inventory'] ?? [] as $ev) {
            $s=$ev['s'] ?? -1;
            if (!is_int($s) || $s<0 || $s>5 || !is_numeric($ev['t'] ?? null)) { continue; }
            $item=preg_replace('/^item_/', '', $ev['item'] ?? '') ?: 0;
            if ($slotsHeld[$s] === $item && $history) { continue; }
            $slotsHeld[$s]=$item; $t=(int)floor($ev['t']);
            $history[$t]=['time'=>$t,'items'=>$slotsHeld];
        }
        if ($history) { $player['inventory_snapshots']=array_values($history); }
        $players[] = $player;
    }
    return array_filter(['match_id'=>$input['id'] ?? null,'radiant_win'=>$input['didRadiantWin'],
        'start_time'=>$input['startDateTime'] ?? $input['hornDateTime'] ?? null,
        'duration'=>$input['durationSeconds'] ?? null,'lobby_type'=>$input['lobbyType'] ?? null,
        'game_mode'=>$input['gameMode'] ?? null,
        'position_track'=>array_values(array_filter($input['positionTrack'] ?? [], static fn($r)=>isset($r['t']) && (int)$r['t']%5===0)),'radiant_gold_adv'=>$input['radiantNetworthLeads'] ?? null,
        'radiant_xp_adv'=>$input['radiantExperienceLeads'] ?? null,'players'=>$players],
        static fn($value) => $value !== null);
}
