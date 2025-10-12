#!/bin/bash
# Real-time Security Monitoring with AI Analysis
# Monitors logs and alerts on suspicious activity

MODEL="llama3.1:70b"
ALERT_LOG="/home/ubuntu/security-reports/security-alerts.log"
mkdir -p "$(dirname "$ALERT_LOG")"

echo "=== AI Security Monitor Started ==="
echo "Monitoring system for threats..."
echo "Press Ctrl+C to stop"
echo ""

# Monitor auth logs for suspicious activity
tail -f /var/log/auth.log 2>/dev/null | while read line; do
    # Check for failed login attempts
    if echo "$line" | grep -qi "failed\|invalid\|refused\|break"; then
        echo "[$(date)] ALERT: $line"
        
        # Get AI analysis of the suspicious activity
        ANALYSIS=$(curl -s http://localhost:11434/api/generate -d "{
            \"model\": \"$MODEL\",
            \"prompt\": \"Security Alert Analysis: $line\n\nIs this suspicious? What action should be taken? Respond in 2-3 sentences.\",
            \"stream\": false,
            \"options\": {\"temperature\": 0.2}
        }" | jq -r '.response')
        
        echo "[$(date)] AI Analysis: $ANALYSIS" | tee -a "$ALERT_LOG"
        echo ""
    fi
done
