# Compliance Framework Scanner 📋

PCI-DSS, HIPAA, SOC2, and GDPR compliance checking.

## Quick Start

```bash
cd compliance

# Run PCI-DSS compliance
./scan-compliance.sh --framework pci-dss
```

## Supported Frameworks

- **PCI-DSS 3.2.1** - Payment Card Industry
- **HIPAA** - Healthcare data protection
- **SOC 2 Type II** - Service organization controls
- **GDPR** - Data protection regulation

## Usage

```bash
# Specific framework
./scan-compliance.sh --framework pci-dss

# All frameworks
./scan-compliance.sh --framework all

# With notifications
./scan-compliance.sh --framework hipaa --notify
```

## Output

- Compliance score (0-100)
- Failed checks with remediation
- Framework-specific recommendations

Report: `~/security-reports/compliance_YYYYMMDD_HHMMSS.md`
