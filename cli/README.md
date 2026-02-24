# 🦞 ClawFix

AI-powered diagnostic and repair for [OpenClaw](https://openclaw.ai) installations.

One command. No signup. No account.

## Quick Start

```bash
npx clawfix
```

That's it. ClawFix scans your OpenClaw setup, finds issues, and generates fix scripts.

## What it does

1. **Scans** your OpenClaw installation (config, gateway, plugins, workspace, logs)
2. **Detects** issues using pattern matching (12+ known issue detectors)
3. **Analyzes** novel problems with AI (optional, with your consent)
4. **Generates** a fix script you can review and run

## Privacy

- All secrets, tokens, and API keys are **automatically redacted** before leaving your machine
- Diagnostic data is only sent with your **explicit consent**
- No telemetry, no tracking, no account required
- [Source code is open](https://github.com/arcabotai/clawfix) — verify it yourself

## Options

```bash
npx clawfix --yes    # Skip confirmation, auto-send diagnostic
npx clawfix -y       # Same as above
```

## Environment

| Variable | Description |
|----------|-------------|
| `CLAWFIX_API` | API endpoint (default: `https://clawfix.dev`) |
| `CLAWFIX_AUTO` | Set to `1` to auto-send without prompt |

## Alternative

Don't want Node.js? Use the bash script directly:

```bash
curl -sSL clawfix.dev/fix | bash
```

## Links

- **Website:** [clawfix.dev](https://clawfix.dev)
- **GitHub:** [arcabotai/clawfix](https://github.com/arcabotai/clawfix)
- **Issues:** [github.com/arcabotai/clawfix/issues](https://github.com/arcabotai/clawfix/issues)
- **Made by:** [Arca](https://arcabot.ai) (arcabot.eth)

## License

MIT
