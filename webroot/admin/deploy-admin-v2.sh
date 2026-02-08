#!/bin/bash
# =====================================================
# Deploy Admin V2 - Modern Dashboard Interface
# =====================================================

set -e

echo "=== HTMLSignage Admin V2 Deployment ==="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

WEBROOT="/var/www/signage"
ADMIN_DIR="$WEBROOT/admin"
SOURCE_DIR="$(dirname "$0")"

# Check if running with sudo
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Bitte mit sudo ausführen${NC}"
    echo "  sudo $0"
    exit 1
fi

# Step 1: Backup existing admin interface
echo -e "${YELLOW}1. Backup der bestehenden Admin-Oberfläche...${NC}"
BACKUP_DIR="$ADMIN_DIR/backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
if [ -f "$ADMIN_DIR/index.php" ]; then
    cp "$ADMIN_DIR/index.php" "$BACKUP_DIR/"
fi
if [ -d "$ADMIN_DIR/css" ]; then
    cp -r "$ADMIN_DIR/css" "$BACKUP_DIR/"
fi
if [ -d "$ADMIN_DIR/js" ]; then
    cp -r "$ADMIN_DIR/js" "$BACKUP_DIR/"
fi
echo -e "${GREEN}   Backup erstellt: $BACKUP_DIR${NC}"

# Step 2: Copy new admin files
echo -e "${YELLOW}2. Kopiere neue Admin V2 Dateien...${NC}"

# Copy PHP
cp "$SOURCE_DIR/admin-v2.php" "$ADMIN_DIR/"
echo "   - admin-v2.php kopiert"

# Ensure CSS directory exists
mkdir -p "$ADMIN_DIR/css"
cp "$SOURCE_DIR/css/admin-v2.css" "$ADMIN_DIR/css/"
echo "   - admin-v2.css kopiert"

# Ensure JS directory exists
mkdir -p "$ADMIN_DIR/js"
cp "$SOURCE_DIR/js/admin-v2.js" "$ADMIN_DIR/js/"
echo "   - admin-v2.js kopiert"

echo -e "${GREEN}   Dateien erfolgreich kopiert${NC}"

# Step 3: Set permissions
echo -e "${YELLOW}3. Setze Berechtigungen...${NC}"
chown -R www-data:www-data "$ADMIN_DIR/admin-v2.php" "$ADMIN_DIR/css/admin-v2.css" "$ADMIN_DIR/js/admin-v2.js"
chmod 644 "$ADMIN_DIR/admin-v2.php" "$ADMIN_DIR/css/admin-v2.css" "$ADMIN_DIR/js/admin-v2.js"
echo -e "${GREEN}   Berechtigungen gesetzt${NC}"

# Step 4: Create symbolic link or update index.php
echo -e "${YELLOW}4. Aktiviere Admin V2 als Standard...${NC}"

# Option A: Replace index.php with redirect to admin-v2.php
# Option B: Replace index.php with admin-v2.php content

read -p "Soll Admin V2 als Standard aktiviert werden? (j/n): " ACTIVATE
if [ "$ACTIVATE" = "j" ] || [ "$ACTIVATE" = "J" ]; then
    if [ -f "$ADMIN_DIR/index.php" ]; then
        cp "$ADMIN_DIR/index.php" "$ADMIN_DIR/index-old.php"
    fi
    cp "$ADMIN_DIR/admin-v2.php" "$ADMIN_DIR/index.php"
    chown www-data:www-data "$ADMIN_DIR/index.php"
    echo -e "${GREEN}   Admin V2 ist jetzt unter /admin/ erreichbar${NC}"
else
    echo -e "${YELLOW}   Admin V2 ist unter /admin/admin-v2.php erreichbar${NC}"
fi

# Step 5: Reload PHP-FPM
echo -e "${YELLOW}5. Starte PHP-FPM neu...${NC}"
if systemctl is-active --quiet php8.3-fpm; then
    systemctl reload php8.3-fpm
    echo -e "${GREEN}   PHP-FPM neugeladen${NC}"
elif systemctl is-active --quiet php8.2-fpm; then
    systemctl reload php8.2-fpm
    echo -e "${GREEN}   PHP-FPM neugeladen${NC}"
elif systemctl is-active --quiet php8.1-fpm; then
    systemctl reload php8.1-fpm
    echo -e "${GREEN}   PHP-FPM neugeladen${NC}"
else
    echo -e "${YELLOW}   PHP-FPM Service nicht gefunden, bitte manuell neustarten${NC}"
fi

echo ""
echo -e "${GREEN}=== Deployment abgeschlossen ===${NC}"
echo ""
echo "Die neue Admin-Oberfläche ist jetzt verfügbar:"
echo "  - Admin V2: http://localhost:8888/admin/admin-v2.php"
if [ "$ACTIVATE" = "j" ] || [ "$ACTIVATE" = "J" ]; then
    echo "  - Standard: http://localhost:8888/admin/"
fi
echo ""
echo "Bei Problemen kann das Backup wiederhergestellt werden:"
echo "  sudo cp $BACKUP_DIR/* $ADMIN_DIR/"
echo ""
