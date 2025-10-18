# HTMLSignage

This repository contains a small HTML signage stack.  
The original monolithic install script has been refactored into a modular
structure:

- `scripts/install.sh` – automated installation and configuration.
- `config/nginx/` – nginx configuration templates with placeholders.
- `webroot/` – static application files and full admin interface.

The installer applies secure defaults (basic auth for the admin interface,
strict file permissions and PHP hardening) and ensures reproducible setup.

## Requirements

PHP extensions `curl` and `gd` must be enabled. On Debian/Ubuntu systems:

```bash
sudo apt-get install php-curl php-gd
```

## Usage

Run the installer as root:

```bash
sudo scripts/install.sh
```

The script will prompt for ports and admin credentials if run interactively
and prints the URLs and configuration paths when finished.
Environment variables such as `SIGNAGE_PUBLIC_PORT`, `SIGNAGE_ADMIN_PORT`,
`SIGNAGE_ADMIN_USER` and `SIGNAGE_ADMIN_PASS` can still be set to override
the defaults.

### Preflight checks

Before deploying on a fresh host you can run the non-destructive preflight
script. It verifies that Docker is installed, checks port availability and
ensures sufficient disk space and write permissions:

```bash
scripts/preflight.sh
```

The installer invokes this script automatically (use `--skip-preflight` to
skip it when re-running on the same machine).

### Local development with Docker

A lightweight Docker Compose stack is available for local development. It
provisions PHP-FPM and nginx containers and mounts the repository into the
containers for hot reloading:

```bash
docker compose up --build
```

The admin UI is then reachable at <http://localhost:8080/admin/> while the
public signage runs on <http://localhost:8080/>.

### Tests and linting

Install both the JavaScript and PHP tooling once before running the suites:

```bash
npm install
composer install
```

Frontend checks use Vitest and ESLint, while backend API tests are covered by
PHPUnit. You can execute them individually or run the combined workflow:

```bash
npm run test:frontend   # Vitest
npm run test:backend    # PHPUnit wrapper
npm run lint            # ESLint

# Run both layers in one go
npm test
```

### User and role management

The admin interface now exposes a “Benutzer” button in the header that opens a
modal to create, edit and remove accounts as well as assign roles. New passwords
can be set or rotated directly from the UI, and attempts to delete the final
admin account are blocked to prevent lock-outs. All changes are persisted to
`data/users.json` and logged in `data/audit.log` together with the acting user
for auditing.

The PHP helper is still available for automation or bootstrapping:

```bash
php scripts/users.php add alice editor
php scripts/users.php list
php scripts/users.php delete bob
```

Available roles are `saunameister`, `editor` and `admin`. Saunameister accounts
may edit the Aufguss grid, adjust the slideshow box, trigger the live preview,
open the slideshow player, store changes and toggle the light/dark mode. Editors
retain access to all other administrative tools except user management. Admins
can manage accounts in addition to all other features, and the initial
`admin` user is protected from deletion. Once at least one account exists the
API requires HTTP Basic authentication.

### Device telemetry

Heartbeats can now include optional telemetry such as firmware, network quality
or resource usage. Send JSON payloads to `/api/heartbeat.php` or
`/admin/api/devices_touch.php`:

```bash
curl -X POST https://signage.example.com/api/heartbeat.php \
  -H 'Content-Type: application/json' \
  -d '{
        "device": "dev_abc123def456",
        "status": {"firmware": "2.1.0", "ip": "192.0.2.41"},
        "metrics": {"cpuLoad": 34, "memoryUsage": 67, "temperature": 48},
        "network": {"type": "wifi", "ssid": "lobby", "signal": -54}
      }'
```

The admin “Geräte” table renders the latest telemetry, highlights missing data
with a hint and records a short heartbeat history so that outages are visible
at a glance.
