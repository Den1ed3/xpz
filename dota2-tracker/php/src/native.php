<?php
declare(strict_types=1);

function nativeReplayLimit(): int {
    $limit = filter_var(getenv('LEDGER_REPLAY_MAX_MIB'), FILTER_VALIDATE_INT, [
        'options' => ['min_range' => 1, 'max_range' => 2048],
    ]);
    return ($limit === false ? 512 : $limit) * 1048576;
}

function nativeParserPath(): ?string {
    $configured = getenv('LEDGER_REPLAY_PARSER');
    if (!$configured || $configured[0] !== '/' || PHP_OS_FAMILY !== 'Linux' ||
        !function_exists('proc_open') || !is_executable('/usr/bin/prlimit')) { return null; }
    $parser = realpath($configured);
    return $parser && is_file($parser) && is_executable($parser) ? $parser : null;
}

/** Read the HTTP body through a bounded stream. The browser never chooses a filesystem path. */
function receiveDemo(string $path, int $limit): void {
    $input = fopen('php://input', 'rb');
    $file = fopen($path, 'xb');
    if (!$input || !$file) { reject(503, 'The host could not create a temporary replay file.'); }
    try {
        $header = fread($input, 8);
        if ($header !== "PBDEMS2\0") { reject(422, 'Select a decompressed Source 2 .dem replay.'); }
        if (fwrite($file, $header) !== 8) { reject(507, 'Insufficient temporary disk space for the replay.'); }
        $copied = stream_copy_to_stream($input, $file, $limit - 7);
        if ($copied === false || !fflush($file)) { reject(507, 'The host could not finish writing this replay.'); }
        $length = $copied + 8;
        if ($length > $limit) { reject(413, 'This replay exceeds the server upload limit.'); }
        if (isset($_SERVER['CONTENT_LENGTH']) && $length !== (int)$_SERVER['CONTENT_LENGTH']) {
            reject(400, 'The replay upload was interrupted. Upload the complete file again.');
        }
    } finally {
        fclose($input);
        fclose($file);
    }
}

/** Run the configured parser with fixed arguments, no inherited secrets, and bounded resources. */
function parseDemo(string $parser, string $work): array {
    $maxOutput = 32 * 1048576;
    $output = $work . '/parsed.json';
    $proc = proc_open(
        ['/usr/bin/prlimit', '--as=4294967296', '--cpu=180', '--fsize=' . $maxOutput,
         '--nofile=64', '--', $parser, $work . '/input.dem'],
        [0 => ['file', '/dev/null', 'r'], 1 => ['file', $output, 'x'], 2 => ['file', '/dev/null', 'w']],
        $pipes, $work, ['GOMAXPROCS' => '2', 'GOMEMLIMIT' => '768MiB']
    );
    if (!is_resource($proc)) { reject(503, 'The host could not start the replay parser.'); }
    $stop = static function () use (&$proc): void {
        if (is_resource($proc)) {
            if (proc_get_status($proc)['running']) { proc_terminate($proc, 9); }
            proc_close($proc);
        }
        $proc = null;
    };
    register_shutdown_function($stop);
    $deadline = microtime(true) + 210;
    try {
        do {
            $status = proc_get_status($proc);
            if (!$status['running']) { break; }
            if (microtime(true) >= $deadline) { reject(504, 'Parsing exceeded the time limit. Try local replay export for this game.'); }
            usleep(100000);
        } while (true);
        if ($status['exitcode'] !== 0) {
            reject(422, 'The parser could not finish this replay. Check that the file is complete and supported by the installed parser.');
        }
        $size = filesize($output);
        if (!$size || $size >= $maxOutput) { reject(422, 'The replay parser returned empty or oversized output.'); }
        $json = file_get_contents($output);
        if ($json === false) { reject(503, 'The host could not read the parsed replay.'); }
        try { $match = json_decode($json, true, 64, JSON_THROW_ON_ERROR | JSON_BIGINT_AS_STRING); }
        catch (JsonException $e) { reject(422, 'The parser returned incomplete replay data.'); }
        if (!is_array($match)) { reject(422, 'The parser returned invalid match data.'); }
        return $match;
    } finally { $stop(); }
}

function importNativeReplay(): array {
    $parser = nativeParserPath();
    if (!$parser) { reject(503, 'The host has not enabled native replay parsing.'); }
    $limit = nativeReplayLimit();
    if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > $limit) { reject(413, 'This replay exceeds the server upload limit.'); }
    $dataDir = dirname(getenv('LEDGER_DB') ?: dirname(__DIR__) . '/var/lobby.sqlite');
    if (!is_dir($dataDir) && !mkdir($dataDir, 0700, true) && !is_dir($dataDir)) {
        reject(503, 'The private replay workspace is unavailable.');
    }
    $lock = fopen($dataDir . '/replay-import.lock', 'c');
    if (!$lock) { reject(503, 'The replay import lock is unavailable.'); }
    if (!flock($lock, LOCK_EX | LOCK_NB)) {
        fclose($lock);
        header('Retry-After: 15');
        reject(429, 'Another replay is importing. Try again when it finishes.');
    }
    $work = $dataDir . '/parse-' . bin2hex(random_bytes(16));
    $cleanup = static function () use ($work): void {
        foreach (['input.dem', 'parsed.json'] as $name) {
            $file = $work . '/' . $name;
            if (is_file($file)) { unlink($file); }
        }
        if (is_dir($work)) { rmdir($work); }
    };
    try {
        if (!mkdir($work, 0700)) { reject(503, 'The private replay workspace is unavailable.'); }
        register_shutdown_function($cleanup);
        if (function_exists('set_time_limit')) { set_time_limit(300); }
        receiveDemo($work . '/input.dem', $limit);
        $raw = parseDemo($parser, $work);
        try { $match = tournamentReplayMatch($raw); }
        catch (InvalidArgumentException | TypeError $e) { reject(422, 'The replay is missing required match or player fields.'); }
        unset($raw);
        return storeMatch(db(), cleanMatch($match));
    } finally {
        $cleanup();
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}
