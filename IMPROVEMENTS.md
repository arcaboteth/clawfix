# ClawFix Improvement Plan

Based on real crash report from Feb 28, 2026 (see ~/Documents/openclaw-gateway-crash-report-2026-02-28.md).

## Context
ClawFix is an AI-powered OpenClaw diagnostic & repair tool at clawfix.dev. 
Users run `curl -sSL clawfix.dev/fix | bash` or `npx clawfix` to diagnose their OpenClaw issues.
It has two layers: pattern-matching (known-issues.js) and AI analysis (LLM via OpenRouter).

## Problem: The current system missed several real-world failure modes

### Gap 1: LaunchAgent/systemd corrupted state
The gateway process got SIGTERM'd but the LaunchAgent entered a corrupted load state where `launchctl load` returned I/O errors. `openclaw gateway restart` alone wouldn't fix it — needed full `unload` → `load` cycle. ClawFix doesn't detect this.

**Fix needed in known-issues.js:**
- New issue: `launchd-corrupted-state` — detect exit code -15 (SIGTERM) in gateway status or launchctl output
- Fix script should try `launchctl unload && launchctl load` instead of just `openclaw gateway restart`

**Fix needed in diagnostic script (script.js):**
- Collect `launchctl list | grep openclaw` output (exit code, PID, label)
- On Linux, collect `systemctl status openclaw-gateway` if it exists
- Collect the actual exit code from the service manager

### Gap 2: Gateway process exists but not listening
The crash report showed `ps aux` finding a gateway process, but `lsof -i :18789` returned empty — zombie/shutdown state. Current detection only checks if gateway status says "not running" but misses this case.

**Fix needed in diagnostic script:**
- After finding gateway PID, also check if the PID is actually listening on the port
- New field: `portListening: true/false` (is something actually bound to the port?)
- New field: `processExists: true/false` (does PID exist?)

**Fix needed in known-issues.js:**
- New issue: `gateway-zombie` — process exists but not listening on port
- Severity: critical
- Fix: kill the zombie process, then restart via service manager

### Gap 3: Chrome extension retry storm
The Chrome extension was hammering failed WebSocket connections every ~11 seconds, filling error logs. The current `browser-relay-handshake-spam` detection only looks at the diagnostic payload but the script doesn't collect this data well.

**Fix needed in diagnostic script:**
- Count handshake timeout / "closed before connect" lines in error log
- Add `logs.errLogSizeMB` field (check file size of gateway.err.log)
- Add `logs.handshakeTimeoutCount` field

### Gap 4: Error log size not collected
The diagnostic script doesn't report gateway.err.log file size. In the crash report, this could have been 200MB+ of Chrome extension spam.

**Fix needed in diagnostic script:**
- Add error log size in MB to the diagnostic payload
- Add gateway log size too

### Gap 5: Service manager details not collected
On macOS, we need `launchctl list | grep openclaw` to see exit codes and service state.
On Linux, we need `systemctl status` output.

**Fix needed in diagnostic script:**
- New section: "Service Manager"
- macOS: run `launchctl list | grep openclaw` and parse output
- Linux: run `systemctl status openclaw-gateway 2>/dev/null` if exists
- Store in payload as `service.manager` (launchd/systemd/none), `service.exitCode`, `service.runs`, `service.state`

### Gap 6: No watchdog recommendation
When ClawFix detects the gateway was down for an extended period, it should recommend setting up a watchdog script.

**Fix needed in known-issues.js:**
- Enhance `gateway-extended-downtime` fix to include a watchdog script that can be installed as a separate LaunchAgent/cron job
- The watchdog should check `/health` endpoint every 2 minutes and auto-restart if down

### Gap 7: Better AI context
The AI system prompt in diagnose.js should include the crash report knowledge so it can recognize these patterns even if pattern matching misses them.

**Fix needed in diagnose.js:**
- Add crash scenarios to SYSTEM_PROMPT: SIGTERM + launchd corruption, zombie processes, retry storms
- Add knowledge about macOS launchctl vs Linux systemd recovery procedures

## Implementation Order
1. Update diagnostic script (script.js) — collect more data
2. Add new known issues (known-issues.js) — detect new patterns  
3. Improve AI prompt (diagnose.js) — better context
4. Bump version to 0.4.0
5. Update SCRIPT_HASH
6. Test locally, commit, push

## Files to modify
- `src/routes/script.js` — diagnostic bash script
- `src/known-issues.js` — pattern detection + fixes
- `src/routes/diagnose.js` — AI prompt + analysis
- `package.json` — version bump
