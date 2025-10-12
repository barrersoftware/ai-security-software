#!/bin/bash
# Setup automated security scanning with cron

echo "================================================"
echo "  Setup Automated Security Scanning"
echo "================================================"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCANNER="${SCRIPT_DIR}/security-scanner.sh"

if [ ! -f "$SCANNER" ]; then
    echo "Error: security-scanner.sh not found at $SCANNER"
    exit 1
fi

echo "This will set up daily automated security scans."
echo ""
echo "Current system time: $(date)"
echo "System timezone: $(timedatectl show --property=Timezone --value 2>/dev/null || date +%Z)"
echo ""

read -p "Enter scan time (24h format, e.g., 03:30): " SCAN_TIME

if [ -z "$SCAN_TIME" ]; then
    SCAN_TIME="03:30"
    echo "Using default time: $SCAN_TIME"
fi

# Parse time
HOUR=$(echo "$SCAN_TIME" | cut -d: -f1)
MINUTE=$(echo "$SCAN_TIME" | cut -d: -f2)

# Validate
if ! [[ "$HOUR" =~ ^[0-9]+$ ]] || ! [[ "$MINUTE" =~ ^[0-9]+$ ]]; then
    echo "Error: Invalid time format. Use HH:MM (e.g., 03:30)"
    exit 1
fi

if [ "$HOUR" -gt 23 ] || [ "$MINUTE" -gt 59 ]; then
    echo "Error: Invalid time. Hour must be 0-23, minute must be 0-59"
    exit 1
fi

echo ""
echo "Setting up daily scan at $SCAN_TIME"
echo ""

# Remove any existing cron jobs for this scanner
crontab -l 2>/dev/null | grep -v "$SCANNER" | crontab - 2>/dev/null || true

# Add new cron job
(
    crontab -l 2>/dev/null || true
    echo "# AI Security Scanner - Daily scan at $SCAN_TIME"
    echo "$MINUTE $HOUR * * * $SCANNER >> $HOME/security-reports/cron.log 2>&1"
) | crontab -

echo "✓ Cron job configured"
echo ""
echo "Current crontab:"
crontab -l | grep -A1 "AI Security Scanner"
echo ""
echo "Logs will be saved to: $HOME/security-reports/cron.log"
echo "Reports will be in: $HOME/security-reports/"
echo ""
echo "To modify or remove:"
echo "  crontab -e"
echo ""
