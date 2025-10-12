# OpenSCAP & DISA STIG Quick Start Guide 🚀

Fast track to government-grade security auditing with OpenSCAP and DISA STIG.

## ⚡ 5-Minute Setup

### Step 1: Install OpenSCAP (One-time)
```bash
cd ai-security-scanner/scripts
sudo ./install-openscap.sh
```

### Step 2: Run Your First Scan
```bash
cd ../compliance

# Option A: Standard security baseline
sudo ./scan-openscap.sh --profile standard

# Option B: CIS Benchmark
sudo ./scan-openscap.sh --profile cis

# Option C: DISA STIG (DoD/Government)
sudo ./scan-disa-stig.sh
```

### Step 3: View Report
```bash
# Open HTML report in browser
xdg-open ~/security-reports/openscap_*.html

# Or read Markdown summary
cat ~/security-reports/openscap_*.md | less
```

## 📋 Common Commands

### OpenSCAP Scans

```bash
# List available security profiles
sudo ./scan-openscap.sh --list-profiles

# Standard security baseline
sudo ./scan-openscap.sh --profile standard

# PCI-DSS compliance
sudo ./scan-openscap.sh --profile pci-dss

# HIPAA compliance
sudo ./scan-openscap.sh --profile hipaa

# CIS Benchmark Level 1
sudo ./scan-openscap.sh --profile cis

# With AI analysis
sudo ./scan-openscap.sh --profile standard --analyze

# With notifications
sudo ./scan-openscap.sh --profile cis --notify
```

### DISA STIG Scans

```bash
# Full DISA STIG scan
sudo ./scan-disa-stig.sh

# Critical (CAT I) findings only
sudo ./scan-disa-stig.sh --category CAT1

# With AI analysis
sudo ./scan-disa-stig.sh --analyze

# With AI analysis and notifications
sudo ./scan-disa-stig.sh --analyze --notify
```

### Automated Remediation (⚠️  USE WITH CAUTION!)

```bash
# Review what would be changed first!
# Then run with --fix to apply changes

# Auto-fix OpenSCAP findings (DANGEROUS!)
sudo ./scan-openscap.sh --profile standard --fix

# Auto-fix DISA STIG findings (VERY DANGEROUS!)
sudo ./scan-disa-stig.sh --fix
```

**Warning:** `--fix` changes system configuration! Always:
1. Backup your system first
2. Test in non-production environment
3. Review the report before applying fixes
4. Document all changes

## 🎯 Security Profile Guide

| Profile | Use Case | Strictness | Recommended For |
|---------|----------|------------|-----------------|
| `standard` | Basic security hardening | ⭐⭐ | Development, testing |
| `pci-dss` | Payment processing | ⭐⭐⭐ | E-commerce, fintech |
| `hipaa` | Healthcare data | ⭐⭐⭐ | Healthcare systems |
| `cis` | Industry best practices | ⭐⭐⭐⭐ | Production servers |
| `stig` | DoD/Government | ⭐⭐⭐⭐⭐ | Government systems |
| `ospp` | High security | ⭐⭐⭐⭐⭐ | Critical infrastructure |

## 🚦 DISA STIG Categories

| Category | Severity | Priority | Action Timeline |
|----------|----------|----------|-----------------|
| **CAT I** | High | 🔴 Critical | Fix immediately |
| **CAT II** | Medium | 🟡 Important | Fix within 30 days |
| **CAT III** | Low | 🟢 Minor | Fix when convenient |

## 📊 Understanding Reports

### Compliance Scores

- **95-100%** ✅ Fully Compliant
- **80-94%** ⚠️  Mostly Compliant (minor issues)
- **50-79%** ⚠️  Partially Compliant (needs work)
- **0-49%** ❌ Non-Compliant (critical issues)

### Report Files Generated

Each scan creates three files in `~/security-reports/`:

1. **`.html`** - Detailed interactive report
   - Open in web browser
   - Contains all findings with remediation steps
   - Searchable and navigable

2. **`.xml`** - Machine-readable results
   - For automation and parsing
   - SCAP-compliant format
   - Can be imported into security tools

3. **`.md`** - Human-readable summary
   - Quick overview of results
   - Compliance score
   - Failed checks list
   - Remediation recommendations

## 🔄 Automation Examples

### Daily STIG Scan (Critical Only)
```bash
# Add to crontab: crontab -e
0 2 * * * /path/to/scan-disa-stig.sh --category CAT1 --notify >> /var/log/stig-scan.log 2>&1
```

### Weekly Full Compliance Scan
```bash
# Add to crontab: crontab -e
0 3 * * 0 /path/to/scan-openscap.sh --profile cis --analyze --notify >> /var/log/openscap-scan.log 2>&1
```

### CI/CD Integration
```bash
#!/bin/bash
# In your deployment pipeline

# Run security scan
if ! sudo /path/to/scan-openscap.sh --profile standard; then
    echo "Security scan failed - blocking deployment"
    exit 1
fi

echo "Security scan passed - proceeding with deployment"
```

## 💡 Pro Tips

1. **Start with `standard` profile** - Get familiar before trying stricter profiles
2. **Read reports before fixing** - Understand what will change
3. **Test in staging first** - Never auto-fix in production without testing
4. **Schedule regular scans** - Weekly or monthly for ongoing compliance
5. **Use `--analyze` flag** - Get AI insights for complex issues
6. **Keep SCAP content updated** - `sudo apt update && sudo apt upgrade scap-security-guide`
7. **Document everything** - Maintain audit trail of all changes
8. **CAT I is critical** - DISA STIG CAT I findings need immediate attention

## 🆘 Troubleshooting

### OpenSCAP Not Installed?
```bash
cd scripts
sudo ./install-openscap.sh
```

### No SCAP Content Found?
```bash
# Ubuntu/Debian
sudo apt-get install scap-security-guide

# RHEL/CentOS/Fedora
sudo dnf install scap-security-guide
```

### Scan Takes Too Long?
- Use category filtering for STIG: `--category CAT1`
- Run during off-hours
- Increase system resources

### Permission Denied?
- OpenSCAP scans require root: `sudo ./scan-openscap.sh`
- Check file permissions: `chmod +x scan-*.sh`

### Profile Not Found?
```bash
# List available profiles
sudo ./scan-openscap.sh --list-profiles

# Check SCAP content location
ls /usr/share/xml/scap/ssg/content/
```

## 📚 Learn More

- **OpenSCAP Documentation:** https://www.open-scap.org/
- **SCAP Security Guide:** https://www.open-scap.org/security-policies/scap-security-guide/
- **DISA STIG Library:** https://public.cyber.mil/stigs/
- **CIS Benchmarks:** https://www.cisecurity.org/cis-benchmarks/

## 🎓 Compliance Workflow

### Week 1: Baseline
1. Run initial scan: `sudo ./scan-openscap.sh --profile standard`
2. Review report to understand current state
3. Document all findings
4. Create remediation plan

### Week 2-3: Critical Issues
1. Fix CAT I (critical) findings first
2. Test changes in staging
3. Document all modifications
4. Re-scan to verify fixes

### Week 4-6: Medium Priority
1. Address CAT II findings
2. Test thoroughly
3. Apply to production with change control
4. Monitor for issues

### Week 7-8: Minor Issues & Ongoing
1. Fix remaining CAT III items
2. Set up automated scanning
3. Integrate into change management
4. Schedule regular reviews

## ✅ Pre-Deployment Checklist

Before using in production:

- [ ] Tested in development/staging environment
- [ ] Reviewed sample reports
- [ ] Understand impact of auto-remediation
- [ ] Backup procedures in place
- [ ] Change management approval obtained
- [ ] Team trained on report interpretation
- [ ] Monitoring and alerting configured
- [ ] Rollback plan documented

## 🎯 Quick Reference Card

```bash
# Installation
sudo ./scripts/install-openscap.sh

# Basic scans
sudo ./scan-openscap.sh --profile standard    # Standard security
sudo ./scan-disa-stig.sh                      # DISA STIG

# With AI analysis
sudo ./scan-openscap.sh --profile cis --analyze

# View reports
xdg-open ~/security-reports/*.html
cat ~/security-reports/*.md

# List profiles
sudo ./scan-openscap.sh --list-profiles

# Category filtering (STIG)
sudo ./scan-disa-stig.sh --category CAT1

# Auto-remediate (CAUTION!)
sudo ./scan-openscap.sh --profile standard --fix
```

---

**Need Help?** Check the full documentation in `compliance/README.md`

**Status:** ✅ Production Ready - Start scanning today!
