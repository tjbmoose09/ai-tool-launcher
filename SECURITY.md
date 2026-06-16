# Security Policy

## Data Handling

AI Tool Launcher is local-first. It stores launcher preferences in the current user's config directory and does not send tool lists, commands, or config data to any external service.

The built-in update check uses the local git checkout. It does not upload local data.

## Secrets

Do not commit API keys, tokens, `.env` files, or local config files.

Before opening a pull request, run:

```bash
npm run security:scan
```

## Reporting Issues

Please open a private security advisory on GitHub when available, or contact the maintainers without including working exploit payloads in public issues.
