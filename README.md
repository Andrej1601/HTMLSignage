# HTMLSignage

This repository contains a small HTML signage stack.  
The original monolithic install script has been refactored into a modular
structure:

- `scripts/install.sh` – automated installation and configuration.
- `config/nginx/` – nginx configuration templates with placeholders.
- `webroot/` – static application files and full admin interface.

The installer applies secure defaults (basic auth for the admin interface,
strict file permissions and PHP hardening) and ensures reproducible setup.

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
