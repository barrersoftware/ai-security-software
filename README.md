# AI Security Scanner 🛡️

**Enterprise-grade security analysis powered by local AI - completely private, no data ever leaves your server.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Platform: Linux](https://img.shields.io/badge/Platform-Linux%20%7C%20BSD%20%7C%20macOS-blue.svg)](https://www.kernel.org/)
[![AI Model: Llama 3.1](https://img.shields.io/badge/AI-Llama%203.1-green.svg)](https://ollama.com/)

Comprehensive security analysis tools using local Large Language Models (LLMs) for analyzing system configurations, detecting vulnerabilities, reviewing code, and monitoring threats in real-time. Perfect for security professionals, DevOps engineers, and system administrators who need enterprise-grade security without compromising privacy.

## 🌟 Features

- **🔍 Comprehensive Security Scanning** - Full system audits with AI-powered analysis
- **🛡️ Real-time Threat Monitoring** - Live log analysis with instant threat assessment
- **📋 Code Security Review** - Automated vulnerability detection in code
- **💬 Interactive Security Assistant** - Chat with AI security expert
- **🔒 100% Private** - Runs entirely on your infrastructure, zero external calls
- **⚡ Automated Scheduling** - Set up daily/hourly scans via cron
- **📊 Detailed Reports** - Actionable recommendations with priority levels

## 🎯 What It Scans

### System Security
- Listening ports and exposed services
- Firewall configurations (UFW/iptables)
- User accounts and privilege escalation risks
- Login attempts (successful/failed)
- Cron jobs and scheduled tasks
- SUID/SGID binaries
- File permissions and world-writable files

### Network Security
- Active connections and routing tables
- DNS configurations
- Suspicious network activity
- Open ports analysis

### Application Security
- Web server configs (Nginx/Apache)
- SSH configurations and keys
- Docker containers
- Node.js/Python/PHP applications
- Environment variables and secrets

### Log Analysis
- Authentication logs
- System logs
- Security incidents
- Anomaly detection
- Intrusion attempts

## 🪟 Windows Support

**Full Windows support now available!** See [Windows README](windows/README.md) for details.

```powershell
cd windows
.\install.ps1
```

## 🚀 Quick Start

### Prerequisites

- Linux, BSD, macOS, or Windows system
- 8GB RAM minimum (16GB+ recommended for 70B model)
- 50GB+ free disk space
- Internet connection (for initial setup only)

### Installation

```bash
# Clone the repository
git clone https://github.com/ssfdre38/ai-security-scanner.git
cd ai-security-scanner

# Run the installer
sudo ./install.sh

# Or manual installation:
chmod +x scripts/*.sh
sudo scripts/install-ollama.sh
```

### Choose Your AI Model

**Recommended models by system specs:**

| RAM | Model | Quality | Speed |
|-----|-------|---------|-------|
| 8GB | llama3.2:3b | Good | Fast |
| 16GB | llama3.1:8b | Better | Medium |
| 32GB+ | llama3.1:70b | Best | Slower |

```bash
# Install your chosen model
ollama pull llama3.1:70b    # Best quality
# OR
ollama pull llama3.1:8b     # Balanced
# OR
ollama pull llama3.2:3b     # Fastest
```

### First Scan

```bash
# Run comprehensive security scan
./scripts/security-scanner.sh

# View the report
cat ~/security-reports/security_analysis_*.md | less
```

## 📚 Tools Included

### 1. Comprehensive Security Scanner
```bash
./scripts/security-scanner.sh
```
Complete system security audit with AI analysis and prioritized recommendations.

**What it does:**
- Full system configuration review
- Network and firewall analysis
- Application security assessment
- Log analysis for threats
- Executive summary with actionable fixes

**Output:** Detailed markdown report in `~/security-reports/`

### 2. Real-time Security Monitor
```bash
./scripts/security-monitor.sh
```
Monitors authentication logs in real-time and provides instant AI threat analysis.

**Use case:** Run in background or tmux/screen session for continuous monitoring.

### 3. Code Security Review
```bash
./scripts/code-review.sh /path/to/code
```
Scans code for vulnerabilities including SQL injection, XSS, command injection, hardcoded secrets, and more.

**Supported languages:** JavaScript, Python, PHP, Shell, Java, Ruby, Go

### 4. Interactive Security Assistant
```bash
./scripts/security-chat.sh
```
Interactive chat with AI security expert for questions, incident response, and guidance.

**Example questions:**
- "How do I secure my nginx configuration?"
- "What are signs my server has been compromised?"
- "Analyze this suspicious IP: X.X.X.X"
- "Best practices for SSH hardening?"

## ⏰ Automated Scanning

### Set up daily scans

```bash
# Schedule daily scan at 3:30 AM (adjust timezone as needed)
./scripts/setup-cron.sh

# Or manually add to crontab:
crontab -e
# Add: 30 3 * * * /path/to/scripts/security-scanner.sh >> ~/security-reports/cron.log 2>&1
```

## 📊 Example Output

```markdown
# AI Security Analysis Report
Generated: 2025-10-12 11:30:00 UTC

## Executive Summary

### CRITICAL ISSUES - Fix Immediately
1. SSH root login enabled - Disable PermitRootLogin in /etc/ssh/sshd_config
2. Firewall not configured - Enable UFW: sudo ufw enable
3. World-writable files in /var/www - Run: find /var/www -perm -002 -exec chmod o-w {} \;

### HIGH PRIORITY - Fix within 24 hours
1. Outdated SSL/TLS protocols in Nginx
2. Password authentication enabled for SSH
3. Multiple failed login attempts from suspicious IPs

### Security Score: 6.5/10
```

## 🔧 Configuration

### Customize AI Behavior

Edit the model and parameters in any script:

```bash
# scripts/security-scanner.sh
MODEL="llama3.1:70b"          # Change model
TEMPERATURE=0.3               # Lower = more focused, Higher = more creative
```

### Adjust Scan Depth

Modify what gets scanned by editing the script sections:
- System info collection (lines ~40-80)
- Log analysis depth (lines ~180-200)
- File system scan paths (lines ~130-150)

## 🌍 Use Cases

- **Pre-deployment Security Checks** - Scan before production deployment
- **Compliance Audits** - Generate reports for compliance requirements
- **Incident Response** - Analyze logs during security incidents
- **Code Reviews** - Automated security review of pull requests
- **Continuous Monitoring** - Daily automated scans with alerts
- **Security Training** - Learn security best practices interactively
- **Threat Hunting** - Search for indicators of compromise

## 🔐 Privacy & Security

- **100% Local Execution** - All analysis happens on your server
- **No External Calls** - Zero data transmission to third parties
- **No Telemetry** - No usage tracking or analytics
- **Open Source** - Full transparency, audit the code yourself
- **Air-gap Compatible** - Works on isolated networks (after initial model download)

## 💡 Tips

1. **Start with smaller model** - Test with 8B model first, upgrade if needed
2. **Run during off-hours** - Schedule scans when server load is low
3. **Review reports regularly** - Set up weekly report review process
4. **Customize for your stack** - Edit scripts to focus on your specific technologies
5. **Combine with other tools** - Complement existing security tools, don't replace them

## 🤝 Contributing

Contributions welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) first.

### Ways to contribute:
- Add support for new security checks
- Improve AI prompts for better analysis
- Add support for additional platforms
- Report bugs and issues
- Improve documentation
- Share your use cases

## 📖 Documentation

- [Installation Guide](docs/INSTALLATION.md)
- [Configuration Guide](docs/CONFIGURATION.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [API Reference](docs/API.md)
- [Security Best Practices](docs/SECURITY.md)

## 🐛 Troubleshooting

### Model not responding?
```bash
systemctl restart ollama
ollama ps  # Check what's running
```

### Out of memory?
```bash
ollama stop llama3.1:70b
ollama pull llama3.1:8b  # Use smaller model
```

### Slow performance?
- Lower model size (70b → 8b → 3b)
- Reduce scan frequency
- Limit concurrent scans
- Add more RAM if possible

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Ollama](https://ollama.com/) - For making local LLMs accessible
- [Meta AI](https://ai.meta.com/) - Llama models
- Security community - For best practices and feedback

## ⚠️ Disclaimer

This tool is for security analysis and educational purposes. It complements but does not replace professional security audits, penetration testing, or other security measures. Always follow your organization's security policies and consult security professionals for critical systems.

## 📞 Support

- **Issues:** [GitHub Issues](https://github.com/ssfdre38/ai-security-scanner/issues)
- **Discussions:** [GitHub Discussions](https://github.com/ssfdre38/ai-security-scanner/discussions)
- **Security Issues:** security@yourdomain.com (private disclosure)

## 🌐 Web UI Dashboard

**NEW!** Modern web-based dashboard for managing scans and viewing reports.

```bash
cd web-ui
./start-web-ui.sh
```

Access at `http://localhost:3000`

**Features:**
- 📊 Real-time dashboard with live updates
- 🔍 Start and monitor scans from browser
- 📄 Browse and view security reports
- 💬 Interactive AI security assistant
- ⚙️ System monitoring and status
- 📱 Responsive design for mobile/tablet

See [web-ui/README.md](web-ui/README.md) for full documentation.

## 🔔 Team Notifications (Slack/Discord/Teams)

**NEW!** Send security alerts and reports to your team communication platforms.

```bash
cd integrations
./setup-integrations.sh
```

**Features:**
- 🔔 Slack, Discord, and Microsoft Teams support
- 🎨 Color-coded severity levels (critical, warning, info, success)
- 📄 Attach full security reports to notifications
- ⚡ Automatic notifications on scan completion
- 📊 Rich formatting with emojis and detailed messages

**Examples:**
```bash
# Send notification to Slack
./integrations/notify.sh --platform slack --message "Scan completed"

# Run scan with auto-notification to all platforms
./integrations/auto-notify.sh comprehensive

# Send critical alert with report
./integrations/notify.sh --platform all --title "Security Alert" \
    --file ~/security-reports/latest.md --severity critical
```

See [integrations/README.md](integrations/README.md) for full documentation.

## 🖥️ Multi-Server Scanning

**NEW!** Scan multiple servers from a central location using SSH.

```bash
cd multi-server
cp servers.yaml.example servers.yaml
# Edit servers.yaml with your infrastructure
./scan-servers.sh --group production --notify
```

**Features:**
- 🔄 Parallel scanning with GNU Parallel
- 📋 YAML-based server inventory with groups and tags
- 🎯 Flexible targeting (by name, group, or tags)
- 📊 Consolidated reports across all servers
- 🔔 Automatic notifications on completion
- ⚡ Fast execution (scan 50 servers in ~15 minutes)

**Examples:**
```bash
# Scan production servers
./scan-servers.sh --group production --parallel 8

# Scan specific servers with consolidated report
./scan-servers.sh --servers web-01,db-01 --consolidated

# Scan by tags with notifications
./scan-servers.sh --tags critical --notify
```

See [multi-server/README.md](multi-server/README.md) for full documentation.

## ☁️ Cloud Security Scanning

**NEW!** Comprehensive security audits for AWS, GCP, and Azure.

```bash
cd cloud-security

# Scan individual clouds
./scan-aws.sh
./scan-gcp.sh
./scan-azure.sh

# Or scan all at once
./scan-all-clouds.sh --all --notify
```

**Supported Services:**
- **AWS:** IAM, EC2, S3, VPC, RDS, CloudTrail, Security Groups
- **GCP:** IAM, Compute Engine, Cloud Storage, VPC, Cloud SQL, Logging
- **Azure:** Azure AD, VMs, Storage, NSGs, SQL, Key Vault, Security Center

**Features:**
- ☁️ Multi-cloud support (AWS, GCP, Azure)
- 🔍 Comprehensive service coverage
- 🤖 AI-powered analysis and recommendations
- 📊 Detailed markdown reports
- 🎨 Color-coded severity levels
- 🔔 Integration with notification system

**Examples:**
```bash
# Daily AWS security audit
./scan-aws.sh && ../integrations/notify.sh --file ~/security-reports/aws_*.md

# Multi-cloud compliance scan
./scan-all-clouds.sh --all --notify

# Specific clouds only
./scan-all-clouds.sh --aws --gcp
```

See [cloud-security/README.md](cloud-security/README.md) for full documentation.

## 🎯 Custom Rule Engine

**NEW!** Define your own security checks with YAML.

```bash
cd custom-rules
cp rules.yaml.example rules.yaml
./run-rules.sh --group critical
```

**Features:**
- 📝 YAML-based rule definitions
- ⚡ Parallel execution support
- 🎨 Severity levels (critical/warning/info)
- 📊 Rule grouping and filtering
- 🔧 Custom remediation instructions

See [custom-rules/README.md](custom-rules/README.md) for full documentation.

## ☸️ Kubernetes Security

**NEW!** Comprehensive K8s cluster security auditing.

```bash
cd kubernetes
./scan-k8s.sh
```

**Coverage:**
- Pod security (privileged, root)
- RBAC analysis
- Network policies
- Secrets management
- Resource quotas
- Container images

See [kubernetes/README.md](kubernetes/README.md) for full documentation.

## 🗄️ Database Security

**NEW!** Audit MySQL, PostgreSQL, MongoDB, and Redis.

```bash
cd database-security
./scan-databases.sh --all
```

**Checks:**
- Connection security (bind addresses)
- Authentication configuration
- Encryption (SSL/TLS, at-rest)
- Public exposure detection
- Configuration best practices

See [database-security/README.md](database-security/README.md) for full documentation.

## 📋 Compliance Frameworks

**NEW!** PCI-DSS, HIPAA, SOC2, GDPR compliance scanning.

```bash
cd compliance
./scan-compliance.sh --framework pci-dss
```

**Frameworks:**
- PCI-DSS 3.2.1 (Payment Card Industry)
- HIPAA Security Rule (Healthcare)
- SOC 2 Type II (Service organizations)
- GDPR (Data protection)

See [compliance/README.md](compliance/README.md) for full documentation.

## 🗺️ Roadmap

- [x] ✅ Web UI dashboard
- [x] ✅ Integration with Slack/Discord/Teams
- [x] ✅ Multi-server scanning from central location
- [x] ✅ Cloud provider security (AWS/GCP/Azure)
- [x] ✅ Custom rule engine
- [x] ✅ Kubernetes security scanning
- [x] ✅ Database security analysis
- [x] ✅ Compliance framework templates (PCI-DSS, HIPAA, SOC2, GDPR)

**🎉 100% Complete!** All roadmap features implemented!

---

**Star ⭐ this repo if you find it useful!**

Made with ❤️ for the security community
