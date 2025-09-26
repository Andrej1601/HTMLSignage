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

JavaScript tooling is managed through `npm`. Install dependencies once and use
Vitest for unit tests as well as ESLint for static analysis:

```bash
npm install
npm run test
npm run lint
```

### User and role management

The admin APIs now support role-based access control. Create and maintain user
accounts via the CLI helper:

```bash
php scripts/users.php add alice editor
php scripts/users.php list
php scripts/users.php delete bob
```

Available roles are `viewer`, `editor` and `admin`. When at least one user is
defined the API requires HTTP Basic authentication. Accounts are stored in
`data/users.json` and all write operations are logged to `data/audit.log` with
the acting username and payload metadata.
