# Compliance & Security Auditing 📋

Comprehensive security compliance scanning with support for industry standards, government regulations, and defense-level security requirements.

## 🛡️ Supported Frameworks

### Industry Compliance Standards
- **PCI-DSS 3.2.1** - Payment Card Industry Data Security Standard
- **HIPAA** - Health Insurance Portability and Accountability Act
- **SOC 2 Type II** - Service Organization Control 2
- **GDPR** - General Data Protection Regulation
- **ISO 27001:2022** - Information Security Management System (NEW!)

### Government & Defense Standards (NEW!)
- **OpenSCAP** - Security Content Automation Protocol scanning
- **DISA STIG** - Defense Information Systems Agency Security Technical Implementation Guides
- **NIST CSF 2.0** - NIST Cybersecurity Framework (NEW!)
- **NIST SP 800-53** - Security and Privacy Controls (NEW!)
- **NIST SP 800-171** - Protecting Controlled Unclassified Information (NEW!)
- **CIS Benchmarks** - Center for Internet Security hardening guidelines
- **OSPP** - Common Criteria Operating System Protection Profile
- **CUI** - Controlled Unclassified Information protection

## 📋 Available Tools

### 1. Standard Compliance Scanner
```bash
./scan-compliance.sh --framework <framework>
```
Frameworks: `pci-dss`, `hipaa`, `soc2`, `gdpr`, `all`

### 2. NIST Compliance Scanner (NEW!)
```bash
./scan-nist.sh --framework <framework>
```
Frameworks: `csf` (Cybersecurity Framework 2.0), `800-53`, `800-171`

### 3. ISO 27001 Scanner (NEW!)
```bash
./scan-iso27001.sh
```
International information security standard

### 4. OpenSCAP Scanner (SCAP)
```bash
sudo ./scan-openscap.sh --profile <profile>
```
Profiles: `standard`, `pci-dss`, `hipaa`, `cis`, `stig`, `ospp`, `cui`

### 5. DISA STIG Scanner
```bash
sudo ./scan-disa-stig.sh [--category CAT1|CAT2|CAT3]
```
Government/DoD security compliance scanning.

## 🚀 Quick Start

### Install OpenSCAP (Required for SCAP/STIG)
```bash
cd ../scripts
sudo ./install-openscap.sh
```

### Run Basic Compliance Scan
```bash
# Industry standards (no root needed)
./scan-compliance.sh --framework pci-dss

# NIST Cybersecurity Framework
./scan-nist.sh --framework csf

# ISO 27001 assessment
./scan-iso27001.sh

# OpenSCAP security baseline
sudo ./scan-openscap.sh --profile standard

# DISA STIG (DoD compliance)
sudo ./scan-disa-stig.sh
```

### Run with Notifications
```bash
# NIST with notifications
./scan-nist.sh --framework 800-53 --notify

# ISO 27001 with notifications
./scan-iso27001.sh --notify
```bash
# OpenSCAP with AI-powered analysis
sudo ./scan-openscap.sh --profile cis --analyze

# DISA STIG with AI recommendations
sudo ./scan-disa-stig.sh --analyze
```

## 📊 Examples

### PCI-DSS Compliance
```bash
./scan-compliance.sh --framework pci-dss --notify
```

### OpenSCAP Security Scan
```bash
# List available profiles
sudo ./scan-openscap.sh --list-profiles

# Run CIS Benchmark
sudo ./scan-openscap.sh --profile cis

# Auto-remediate (CAUTION!)
sudo ./scan-openscap.sh --profile standard --fix
```

### DISA STIG Compliance
```bash
# Full STIG scan
sudo ./scan-disa-stig.sh

# CAT I (critical) only
sudo ./scan-disa-stig.sh --category CAT1

# With AI analysis
sudo ./scan-disa-stig.sh --analyze --notify
```

## 🔍 What Gets Scanned

### Standard Compliance (Basic)
- Firewall configuration
- Password policies
- Encryption (disk, SSL/TLS)
- Access controls
- Audit logging
- Backup procedures

### OpenSCAP Checks (200+ rules)
- System hardening
- Service configuration
- File permissions
- Network security
- Kernel parameters
- Security patches

### DISA STIG Checks (300+ requirements)
- **CAT I (High):** Critical vulnerabilities
- **CAT II (Medium):** Significant risks
- **CAT III (Low):** Minor concerns
- Complete DoD security posture

## 📈 Report Formats

- **HTML** - Detailed interactive reports
- **XML** - Machine-readable results
- **Markdown** - Human-readable summaries
- **AI Analysis** - AI-powered recommendations

Reports saved to: `~/security-reports/`

## ⚙️ Advanced Usage

### Automated Remediation
```bash
# ⚠️  WARNING: Changes system configuration!
sudo ./scan-openscap.sh --profile standard --fix
```

### Custom SCAP Content
```bash
sudo ./scan-openscap.sh --content /path/to/custom.xml --profile custom_profile
```

## 🔐 Security Considerations

- OpenSCAP/STIG scans require root/sudo
- `--fix` option modifies system settings
- Always test in non-production first
- Review reports before applying fixes
- Maintain audit logs of changes

## 📚 Compliance Mappings

| Framework | Use Case | Tool |
|-----------|----------|------|
| PCI-DSS | Payment processing | scan-compliance.sh |
| HIPAA | Healthcare data | scan-compliance.sh |
| DISA STIG | DoD/Government | scan-disa-stig.sh |
| CIS Benchmark | General hardening | scan-openscap.sh |

## 🔗 Resources

- **OpenSCAP:** https://www.open-scap.org/
- **DISA STIGs:** https://public.cyber.mil/stigs/
- **CIS Benchmarks:** https://www.cisecurity.org/cis-benchmarks/
- **SCAP Guide:** https://www.open-scap.org/security-policies/scap-security-guide/

## 💡 Tips

1. Start with `standard` profile to get familiar
2. Use `--analyze` for AI insights
3. CAT I STIG findings are critical
4. Review HTML reports for remediation steps
5. Test auto-fix in VMs first
6. Keep SCAP content updated
