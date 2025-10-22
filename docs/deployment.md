# Deployment notes

The automated installer (`scripts/install.sh`) performs an idempotent setup of
all system dependencies and application assets. During every run the script
checks whether each package is already installed (`dpkg -s` with fallbacks to
`command -v` for tools such as Node.js) and only downloads missing packages. If
no packages need to be installed the script skips the `apt-get` phase entirely
and reports the situation in the log output.

## Package groups

Package installation is organised into logical groups so that hosts which
already provide parts of the stack can opt out of redundant steps. The
`--skip-package-group <name>` flag accepts the following group names and can be
passed multiple times:

| Group | Packages |
|-------|----------|
| `web` | `nginx` |
| `php` | `php8.3-fpm`, `php8.3-cli`, `php8.3-sqlite3`, `php8.3-xml`, `php8.3-mbstring`, `php8.3-curl`, `php8.3-gd` |
| `database` | `sqlite3` |
| `tools` | `jq`, `unzip`, `curl`, `git`, `rsync`, `openssl` |
| `node` | `nodejs`, `npm` |

Example:

```bash
sudo scripts/install.sh --skip-package-group=node --skip-package-group=tools
```

## Reinstalling packages on demand

By default the installer only adds missing packages. To mirror the historical
behaviour and force a reinstall you can pass `--force-package-reinstall`. This
option re-runs `apt-get install` for every package in the selected groups while
retaining the new logging so that the output still indicates which packages were
already present.

To emphasise the default mode when called from provisioning scripts, use
`--install-missing-only`.
