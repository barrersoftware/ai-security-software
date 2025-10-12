# Usage Examples

Real-world examples of using AI Security Scanner.

## Basic Usage

### Run Complete Security Scan
\`\`\`bash
ai-security-scan
# Or directly:
./scripts/security-scanner.sh
\`\`\`

### Review Latest Report
\`\`\`bash
cat ~/security-reports/security_analysis_*.md | tail -100
\`\`\`

## Code Review Examples

### Scan Web Application
\`\`\`bash
ai-code-review /var/www/myapp/
\`\`\`

### Scan Specific File
\`\`\`bash
ai-code-review /path/to/auth.php
\`\`\`

### Scan Multiple Directories
\`\`\`bash
for dir in /var/www/*; do
  echo "Scanning $dir..."
  ai-code-review "$dir"
done
\`\`\`

## Interactive Chat Examples

\`\`\`bash
ai-security-chat
\`\`\`

Example conversations:

**Q:** "How do I secure my Nginx server?"
**A:** *Provides detailed Nginx hardening steps*

**Q:** "I see failed login attempts from 45.135.194.73. What should I do?"
**A:** *Analyzes IP, provides blocking recommendations*

**Q:** "Explain SQL injection and how to prevent it"
**A:** *Educational explanation with code examples*

## Monitoring Examples

### Run in Background
\`\`\`bash
ai-security-monitor &
\`\`\`

### Run in tmux/screen
\`\`\`bash
tmux new -s security-monitor
ai-security-monitor
# Detach with Ctrl+B, D
\`\`\`

### Monitor and Alert
\`\`\`bash
ai-security-monitor | while read line; do
  echo "$line"
  # Send alert if critical
  if echo "$line" | grep -i "critical"; then
    echo "$line" | mail -s "Security Alert" admin@example.com
  fi
done
\`\`\`

## Automated Scanning

### Daily Scan at 3:30 AM
\`\`\`bash
./scripts/setup-cron.sh
# Enter: 03:30
\`\`\`

### Hourly Scans
\`\`\`bash
crontab -e
# Add: 0 * * * * /path/to/scripts/security-scanner.sh >> ~/security-reports/cron.log 2>&1
\`\`\`

### Scan and Email Report
\`\`\`bash
#!/bin/bash
ai-security-scan
LATEST_REPORT=$(ls -t ~/security-reports/security_analysis_*.md | head -1)
mail -s "Security Report $(date)" admin@example.com < "$LATEST_REPORT"
\`\`\`

## Integration Examples

### CI/CD Pipeline (GitHub Actions)
\`\`\`yaml
name: Security Scan
on: [push]
jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Install Scanner
        run: |
          curl -fsSL https://ollama.com/install.sh | sh
          git clone https://github.com/ssfdre38/ai-security-scanner.git
          cd ai-security-scanner && ./install.sh
      - name: Scan Code
        run: ai-code-review .
\`\`\`

### Pre-commit Hook
\`\`\`bash
#!/bin/bash
# .git/hooks/pre-commit
echo "Running security scan..."
ai-code-review $(git diff --cached --name-only --diff-filter=ACM)
\`\`\`

### Slack Integration
\`\`\`bash
#!/bin/bash
ai-security-scan
REPORT=$(ls -t ~/security-reports/security_analysis_*.md | head -1)
SUMMARY=$(grep -A 5 "CRITICAL ISSUES" "$REPORT")
curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
  -H 'Content-Type: application/json' \
  -d "{\"text\":\"Security Scan Complete\n$SUMMARY\"}"
\`\`\`

## Advanced Usage

### Custom Model
\`\`\`bash
# Edit script
MODEL="codellama:13b" ai-security-scan
\`\`\`

### Focused Scan
\`\`\`bash
# Modify security-scanner.sh to only run specific sections
# Comment out sections you don't need
\`\`\`

### Multi-Server Scanning
\`\`\`bash
#!/bin/bash
SERVERS="server1 server2 server3"
for server in $SERVERS; do
  echo "Scanning $server..."
  ssh $server "bash -s" < scripts/security-scanner.sh
done
\`\`\`

### Compare Reports
\`\`\`bash
diff ~/security-reports/security_analysis_20250112_*.md \
     ~/security-reports/security_analysis_20250113_*.md
\`\`\`
