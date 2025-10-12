# AI Security Scanner 🛡️

**Enterprise-grade security analysis powered by local AI - completely private, no data ever leaves your server.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/Version-3.1.1-blue.svg)](https://github.com/ssfdre38/ai-security-scanner/releases/tag/v3.1.1)
[![Security Score](https://img.shields.io/badge/Security%20Score-100%2F100-brightgreen.svg)](SECURITY_SCORE_100.md)
[![Platform: Linux](https://img.shields.io/badge/Platform-Linux%20%7C%20macOS%20%7C%20Windows-blue.svg)](https://www.kernel.org/)
[![AI Model: Llama 3.1](https://img.shields.io/badge/AI-Llama%203.1-green.svg)](https://ollama.com/)

Comprehensive security analysis tools using local Large Language Models (LLMs) for analyzing system configurations, detecting vulnerabilities, reviewing code, and monitoring threats in real-time. Perfect for security professionals, DevOps engineers, and system administrators who need enterprise-grade security without compromising privacy.

**🎉 NEW in v3.1.1: Perfect 100/100 Security Score Achieved!** - See [Release Notes](RELEASE_NOTES_v3.1.0.md)

📍 **[View Roadmap](ROADMAP.md)** | 💡 **[Request Features](https://github.com/ssfdre38/ai-security-scanner/discussions/new?category=ideas)** | ⭐ **[Star on GitHub](https://github.com/ssfdre38/ai-security-scanner)**

## 🌟 Features

### Core Security Features
- **🔍 Comprehensive Security Scanning** - Full system audits with AI-powered analysis
- **🛡️ Real-time Threat Monitoring** - Live log analysis with instant threat assessment
- **🦠 Malware & Rootkit Detection** - ClamAV, rkhunter, chkrootkit with AI analysis
- **📋 Code Security Review** - Automated vulnerability detection in code
- **💬 Interactive Security Assistant** - Chat with AI security expert
- **🔒 100% Private** - Runs entirely on your infrastructure, zero external calls
- **⚡ Automated Scheduling** - Set up daily/hourly scans via cron
- **📊 Detailed Reports** - Actionable recommendations with priority levels

### 🆕 Advanced Security Features (v3.1.0+)
- **🔐 Multi-Factor Authentication (MFA/2FA)** - TOTP-based 2FA with QR code setup
- **🌐 OAuth 2.0 Integration** - Sign in with Google/Microsoft
- **🚨 Intrusion Detection System** - Real-time threat detection with automated blocking
- **🔒 Account Lockout Protection** - Automatic lockout after failed login attempts
- **📊 IP Whitelist/Blacklist** - Manage allowed and blocked IPs
- **⏱️ Advanced Rate Limiting** - 3-tier rate limiting (general, auth, admin)
- **🔄 Secrets Rotation** - Automated secret rotation scheduler
- **✅ Configuration Validator** - Startup validation for security configs
- **📝 Audit Logging** - Comprehensive logging with 90-day retention
- **💾 Automated Backups** - Scheduled backups with disaster recovery
- **🔐 SSL/TLS Support** - HTTPS for production environments
- **🛡️ Enhanced Security Headers** - Helmet.js security middleware

**Security Score: 100/100** ✨ - See [detailed breakdown](SECURITY_SCORE_100.md)

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

### One-Command Installation ⚡

**Linux/macOS:**
```bash
curl -fsSL https://raw.githubusercontent.com/ssfdre38/ai-security-scanner/master/setup.sh | bash
```

**Windows (PowerShell as Admin):**
```powershell
irm https://raw.githubusercontent.com/ssfdre38/ai-security-scanner/master/setup.ps1 | iex
```

The setup script automatically:
- ✅ Detects your OS and installs dependencies
- ✅ Installs Node.js, Ollama, and security tools
- ✅ Generates secure random secrets
- ✅ Configures SSL/TLS certificates
- ✅ Sets up firewall rules
- ✅ Creates systemd/Windows service
- ✅ Tests the installation

**That's it!** Access at `https://localhost:3000` after installation.

See [SETUP_GUIDE.md](SETUP_GUIDE.md) for advanced configuration options.

### Manual Installation (Alternative)

### Prerequisites

- Linux, BSD, macOS, or Windows system
- 8GB RAM minimum (16GB+ recommended for 70B model)
- 50GB+ free disk space
- Internet connection (for initial setup only)

### Installation Steps

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

### 4. Malware & Rootkit Scanner
```bash
./scripts/malware-scanner.sh
```
Comprehensive malware detection using ClamAV, rkhunter, chkrootkit, and AI analysis.

**What it does:**
- Virus and malware scanning (ClamAV)
- Rootkit detection (rkhunter, chkrootkit)
- Process and network analysis
- Web shell detection
- File system anomaly detection
- AI-powered threat analysis

**Windows version:** `.\windows\scripts\MalwareScanner.ps1` (uses Windows Defender)

### 5. Interactive Security Assistant
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

## 💖 Why Open Source?

We believe security tools should be open source for several critical reasons:

**Transparency & Trust** - Security software deals with your most sensitive systems and data. Closed-source security tools ask you to trust them blindly. With open source, you can audit every line of code, verify there are no backdoors, and ensure your data stays private. Trust should be earned through transparency, not demanded through obscurity.

**Community Strength** - Security is a collaborative effort. The global security community can review, improve, and contribute to this project, making it stronger and more reliable than any single vendor could achieve. Bugs are found faster, vulnerabilities are patched quicker, and features are built based on real-world needs.

**Freedom & Control** - You own your security infrastructure. No vendor lock-in, no forced updates, no licensing headaches, no telemetry collecting your data. You control when and how to deploy updates, customize the tool for your specific needs, and run it anywhere without restrictions or ongoing costs.

**Educational Value** - Learning security is hard when tools are black boxes. This project serves as both a production tool and an educational resource. Study the code, understand how AI-powered security analysis works, modify it for your use cases, and share your improvements with others.

**Longevity & Sustainability** - Proprietary security companies can be acquired, discontinued, or pivot away from products you depend on. Open source projects live beyond any single organization. Even if the original maintainers move on, the community can continue development, ensuring your investment in this tool isn't wasted.

**Privacy by Design** - We built this tool to run 100% locally because we believe your security data should never leave your infrastructure. This isn't just a feature—it's a philosophy. Open source ensures we can't quietly add telemetry or "phone home" functionality in future updates. The code is the proof.

**No Hidden Costs** - Security tools shouldn't be prohibitively expensive. Organizations of all sizes deserve enterprise-grade security analysis. By making this tool free and open source, we're democratizing access to AI-powered security analysis, whether you're a Fortune 500 company or a solo developer.

This project embodies the principles that have made Linux, OpenSSL, and countless other critical security projects successful. Security through transparency, not obscurity. Community over profit. Freedom over lock-in.

If this project helps you secure your infrastructure, consider contributing back—whether through code, documentation, bug reports, or simply spreading the word. Together, we can build security tools that serve everyone, not just those who can afford expensive proprietary solutions.

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
- [**Product Roadmap**](ROADMAP.md) - Future plans and feature requests

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

**NEW!** Industry standards, government regulations, and defense-level security auditing.

```bash
cd compliance

# Industry compliance standards
./scan-compliance.sh --framework pci-dss

# OpenSCAP security scanning (200+ checks)
sudo ./scan-openscap.sh --profile standard

# DISA STIG (DoD/Government compliance)
sudo ./scan-disa-stig.sh
```

**Industry Frameworks:**
- PCI-DSS 3.2.1 (Payment Card Industry)
- HIPAA Security Rule (Healthcare)
- SOC 2 Type II (Service organizations)
- GDPR (Data protection)

**Government & Defense Standards:**
- **OpenSCAP** - Security Content Automation Protocol scanning
- **DISA STIG** - Defense Information Systems Agency Security Technical Implementation Guides
- **CIS Benchmarks** - Center for Internet Security hardening guidelines
- **OSPP** - Common Criteria Operating System Protection Profile
- **CUI** - Controlled Unclassified Information protection

**Key Features:**
- 🛡️ 200-300+ automated security checks per profile
- 🎯 CAT I/II/III severity classification (DISA STIG)
- 🤖 AI-powered risk analysis and remediation recommendations
- 📊 Multiple report formats (HTML, XML, Markdown)
- ⚡ Optional automated remediation (use with caution!)
- 🔔 Integration with team notifications

**Installation:**
```bash
# Install OpenSCAP tools (required for SCAP/STIG)
cd scripts
sudo ./install-openscap.sh

# Verify installation
oscap --version
```

**Examples:**
```bash
# Run CIS Benchmark with AI analysis
sudo ./scan-openscap.sh --profile cis --analyze

# Scan only critical (CAT I) STIG requirements
sudo ./scan-disa-stig.sh --category CAT1 --notify

# Auto-remediate based on SCAP profile (DANGEROUS - test first!)
sudo ./scan-openscap.sh --profile standard --fix
```

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
- [x] ✅ Malware, virus, and rootkit detection (Linux & Windows)
- [x] ✅ **OpenSCAP integration** - SCAP security compliance scanning
- [x] ✅ **DISA STIG support** - DoD/Government security auditing

**🎉 100% Complete + Government/DoD Security Standards!**

All major roadmap features implemented including enterprise compliance and government-level security auditing with OpenSCAP and DISA STIG support!

## 📚 Documentation

- **[Installation Guide](INSTALL.md)** - Quick installation instructions
- **[Setup Guide](SETUP_GUIDE.md)** - Comprehensive setup for all platforms
- **[Security Features](QUICK_START_SECURITY_FEATURES.md)** - Guide to MFA, OAuth, and more
- **[Security Score 100/100](SECURITY_SCORE_100.md)** - Detailed security breakdown
- **[Release Notes v3.1.0](RELEASE_NOTES_v3.1.0.md)** - What's new in latest release
- **[Mobile App Feasibility](MOBILE_APP_FEASIBILITY.md)** - Future mobile app development
- **[Compliance](compliance/README.md)** - Compliance frameworks and STIG
- **[Multi-Server](multi-server/README.md)** - Manage multiple servers
- **[Cloud Security](cloud-security/README.md)** - AWS, GCP, Azure scanning
- **[Windows Support](windows/README.md)** - Windows-specific documentation

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

**Ways to contribute:**
- 🐛 Report bugs
- 💡 Suggest features
- 📝 Improve documentation
- 🔧 Submit pull requests
- ⭐ Star the repository
- 🗣️ Spread the word!

## 🛡️ Security

Found a security vulnerability? Please see [SECURITY.md](SECURITY.md) for responsible disclosure.

**Security Score: 100/100** - See [detailed analysis](SECURITY_SCORE_100.md)

## 📜 Code of Conduct

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🌟 Mission

**Making enterprise-grade cybersecurity accessible to everyone.**

We believe that security should not be a luxury reserved for corporations with deep pockets. Everyone deserves to be safe online, regardless of technical knowledge or financial resources. This project exists to democratize cybersecurity and help bring down the all-time high data breach rates by giving everyone access to the same defensive capabilities that Fortune 500 companies have.

**Open Source. Local AI. Perfect Privacy. Zero Cost.**

---

**Star ⭐ this repo if you find it useful!**

**Latest Release:** [v3.1.1 - Perfect Security Score 100/100](https://github.com/ssfdre38/ai-security-scanner/releases/tag/v3.1.1) ✨

Made with ❤️ for the security community
