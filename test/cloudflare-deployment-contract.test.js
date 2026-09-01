import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ROOT = new URL('../', import.meta.url);

async function read(path) {
  return readFile(new URL(path, ROOT), 'utf8');
}

test('Wrangler deploys the Express Worker on workers.dev with the existing Hyperdrive binding', async () => {
  const config = JSON.parse(await read('wrangler.jsonc'));

  assert.equal(config.main, 'src/worker.js');
  assert.equal(config.workers_dev, true);
  assert.equal(config.preview_urls, true);
  assert.ok(config.triggers.crons.includes('*/15 * * * *'));
  assert.ok(config.compatibility_flags.includes('nodejs_compat'));
  assert.deepEqual(config.hyperdrive, [{
    binding: 'HYPERDRIVE',
    id: '054e6fd0b1bb4910906bd052fbd288fc',
  }]);
  assert.ok(config.rules.some(rule => rule.type === 'Text' && rule.globs.includes('**/*.sh')));
  for (const forbidden of ['route', 'routes', 'custom_domain', 'custom_domains']) {
    assert.equal(forbidden in config, false, `${forbidden} must not be configured`);
  }
});

test('module-scope assets are portable after bundling for Workers', async () => {
  const packageMetadata = JSON.parse(await read('package.json'));
  const version = await read('src/version.js');
  const install = await read('src/routes/install.js');

  assert.doesNotMatch(version, /readFileSync|new URL\(/);
  assert.match(version, new RegExp(`APP_VERSION\\s*=\\s*['"]${packageMetadata.version}['"]`));
  assert.match(install, /import\(['"]\.\.\/\.\.\/scripts\/install\.sh['"]\)/);
  assert.match(install, /Cloudflare-Workers|WebSocketPair/);
});

test('Worker entry uses the official Express bridge and verifies a pre-migrated database', async () => {
  const source = await read('src/worker.js');

  assert.match(source, /from ['"]cloudflare:node['"]/);
  assert.match(source, /httpServerHandler\s*\(/);
  assert.match(source, /app\.listen\s*\(/);
  assert.match(source, /setRuntimeEnv\s*\(env\)/);
  assert.match(source, /ensureDBReady\s*\(\)/);
  assert.match(source, /if\s*\(!initialized\)/);
  assert.match(source, /status:\s*503/);
  assert.match(source, /async scheduled\s*\(/);
  assert.match(source, /cleanupSharedState\s*\(/);
});

test('Worker request graph avoids unsupported process execution and eager runtime secrets', async () => {
  const validator = await read('src/repair-validator.js');
  const diagnose = await read('src/routes/diagnose.js');
  const webhooks = await read('src/routes/webhooks.js');

  assert.doesNotMatch(validator, /from ['"]node:child_process['"]/);
  assert.doesNotMatch(diagnose, /const\s+AI_CONFIG\s*=\s*getAIConfig\(\)/);
  assert.doesNotMatch(diagnose, /const\s+AI_ENABLED\s*=/);
  assert.doesNotMatch(webhooks, /const\s+RESEND_CONFIG\s*=\s*\{/);
  assert.match(diagnose, /consumeRouteRateLimit\s*\(/);
  assert.match(diagnose, /await\s+storeDiagnosis\s*\(/);
});

test('both chat routes lease a conversation for the whole turn', async () => {
  for (const path of ['src/routes/chat.js', 'src/routes/agent-v2.js']) {
    const source = await read(path);
    assert.match(source, /acquireConcurrencyLease\s*\(/, path);
    assert.match(source, /conversationRelease/, path);
    assert.match(source, /await\s+releaseGuards\(\)/, path);
  }
});

test('streaming routes release database leases before ending the response', async () => {
  const chat = await read('src/routes/chat.js');
  const agent = await read('src/routes/agent-v2.js');

  assert.match(chat, /await releaseGuards\(\);\s*res\.write\('data: \[DONE\]/);
  assert.match(agent, /await releaseGuards\(\);\s*sse\.send\('agent\.done'/);
  assert.match(agent, /Agent v2 error:/);
});

test('schema migration is additive and includes durable shared-state tables and indexes', async () => {
  const source = await read('src/db.js');
  const migration = await read('migrations/001-cloudflare-shared-state.sql');

  for (const table of ['conversations', 'rate_limit_windows', 'concurrency_leases']) {
    assert.match(source, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`));
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`));
  }
  assert.match(source, /CREATE INDEX IF NOT EXISTS idx_conversations_touched/);
  assert.match(source, /CREATE INDEX IF NOT EXISTS idx_rate_limit_expires/);
  assert.match(source, /CREATE INDEX IF NOT EXISTS idx_concurrency_leases_expires/);
  assert.doesNotMatch(source, /DROP\s+(?:TABLE|COLUMN|INDEX)/i);
  assert.doesNotMatch(migration, /DROP\s+(?:TABLE|COLUMN|INDEX)/i);
});
