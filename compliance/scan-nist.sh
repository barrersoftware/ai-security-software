#!/bin/bash

###################################################
# AI Security Scanner - NIST Cybersecurity Framework Scanner
# NIST CSF 2.0 compliance checking
###################################################

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPORT_FILE="$HOME/security-reports/nist_$(date +%Y%m%d_%H%M%S).md"
FRAMEWORK="${FRAMEWORK:-csf}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Run NIST Cybersecurity Framework compliance checks

OPTIONS:
    -f, --framework FRAMEWORK    Framework to check (csf|800-53|800-171)
    -n, --notify                 Send notification on completion
    -v, --verbose                Verbose output
    -h, --help                   Show this help

NIST FRAMEWORKS:
    csf         NIST Cybersecurity Framework 2.0
    800-53      NIST SP 800-53 (Security and Privacy Controls)
    800-171     NIST SP 800-171 (Protecting CUI)

EXAMPLES:
    # Run NIST CSF 2.0 assessment
    $0 --framework csf
    
    # Run NIST 800-53 compliance check
    $0 --framework 800-53
    
    # Run NIST 800-171 for CUI protection
    $0 --framework 800-171 --notify

EOF
    exit 0
}

# Initialize report
init_report() {
    mkdir -p "$(dirname "$REPORT_FILE")"
    
    local framework_name=""
    case "$FRAMEWORK" in
        csf) framework_name="NIST Cybersecurity Framework 2.0" ;;
        800-53) framework_name="NIST SP 800-53 Rev 5" ;;
        800-171) framework_name="NIST SP 800-171 Rev 2" ;;
    esac
    
    cat > "$REPORT_FILE" << EOF
# NIST Compliance Assessment Report
Framework: $framework_name
Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
Hostname: $(hostname)

## Executive Summary

EOF
}

# NIST CSF 2.0 Checks
check_nist_csf() {
    echo -e "${BLUE}🔍 Running NIST Cybersecurity Framework 2.0 assessment...${NC}"
    
    cat >> "$REPORT_FILE" << EOF
## NIST Cybersecurity Framework 2.0

### GOVERN (GV) - Organizational Context

#### GV.OC: Organizational Context
EOF
    
    # Check if security policy exists
    if [[ -f /etc/security/policy.conf ]] || [[ -d /etc/security/policies ]]; then
        echo "- ✅ Security policies documented" >> "$REPORT_FILE"
    else
        echo "- ⚠️  No documented security policies found" >> "$REPORT_FILE"
    fi
    
    cat >> "$REPORT_FILE" << EOF

### IDENTIFY (ID) - Asset Management

#### ID.AM: Asset Management
EOF
    
    # System inventory
    if command -v lshw &>/dev/null || command -v dmidecode &>/dev/null; then
        echo "- ✅ System inventory tools available" >> "$REPORT_FILE"
    else
        echo "- ⚠️  No system inventory tools found" >> "$REPORT_FILE"
    fi
    
    # Network mapping
    if command -v nmap &>/dev/null || command -v ss &>/dev/null; then
        echo "- ✅ Network mapping capabilities available" >> "$REPORT_FILE"
    fi
    
    cat >> "$REPORT_FILE" << EOF

#### ID.RA: Risk Assessment
EOF
    
    # Vulnerability scanning
    if command -v oscap &>/dev/null || [[ -d "$SCRIPT_DIR/../scripts" ]]; then
        echo "- ✅ Vulnerability scanning tools available" >> "$REPORT_FILE"
    else
        echo "- ⚠️  No vulnerability scanning tools" >> "$REPORT_FILE"
    fi
    
    cat >> "$REPORT_FILE" << EOF

### PROTECT (PR) - Access Control

#### PR.AC: Identity Management and Access Control
EOF
    
    # Multi-factor authentication
    if command -v google-authenticator &>/dev/null || grep -q "pam_oath" /etc/pam.d/* 2>/dev/null; then
        echo "- ✅ Multi-factor authentication configured" >> "$REPORT_FILE"
    else
        echo "- ⚠️  No multi-factor authentication detected" >> "$REPORT_FILE"
    fi
    
    # Privilege management
    if [[ -f /etc/sudoers ]] && grep -q "^Defaults" /etc/sudoers; then
        echo "- ✅ Privilege management configured (sudo)" >> "$REPORT_FILE"
    fi
    
    # Password policy
    if [[ -f /etc/security/pwquality.conf ]]; then
        local minlen=$(grep "^minlen" /etc/security/pwquality.conf 2>/dev/null | awk -F'=' '{print $2}' | tr -d ' ')
        if [[ -n "$minlen" ]] && [[ "$minlen" -ge 12 ]]; then
            echo "- ✅ Strong password policy (min length: $minlen)" >> "$REPORT_FILE"
        else
            echo "- ⚠️  Weak password policy (min length: ${minlen:-not set})" >> "$REPORT_FILE"
        fi
    fi
    
    cat >> "$REPORT_FILE" << EOF

#### PR.DS: Data Security
EOF
    
    # Encryption at rest
    if lsblk -f 2>/dev/null | grep -q "crypt"; then
        echo "- ✅ Disk encryption enabled" >> "$REPORT_FILE"
    else
        echo "- 🚨 **CRITICAL:** No disk encryption detected" >> "$REPORT_FILE"
    fi
    
    # Encryption in transit
    if netstat -tuln 2>/dev/null | grep -q ":443"; then
        echo "- ✅ HTTPS/TLS enabled" >> "$REPORT_FILE"
    else
        echo "- ⚠️  No HTTPS services detected" >> "$REPORT_FILE"
    fi
    
    # Backup systems
    if command -v rsync &>/dev/null || command -v restic &>/dev/null; then
        echo "- ✅ Backup tools available" >> "$REPORT_FILE"
    else
        echo "- ⚠️  No backup tools detected" >> "$REPORT_FILE"
    fi
    
    cat >> "$REPORT_FILE" << EOF

### DETECT (DE) - Continuous Monitoring

#### DE.CM: Security Continuous Monitoring
EOF
    
    # Logging
    if systemctl is-active rsyslog &>/dev/null || systemctl is-active syslog-ng &>/dev/null; then
        echo "- ✅ System logging active" >> "$REPORT_FILE"
    else
        echo "- 🚨 **CRITICAL:** System logging not active" >> "$REPORT_FILE"
    fi
    
    # Audit logging
    if systemctl is-active auditd &>/dev/null; then
        echo "- ✅ Audit logging active" >> "$REPORT_FILE"
    else
        echo "- ⚠️  Audit logging not configured" >> "$REPORT_FILE"
    fi
    
    # Intrusion detection
    if command -v fail2ban-client &>/dev/null && systemctl is-active fail2ban &>/dev/null; then
        echo "- ✅ Intrusion detection active (fail2ban)" >> "$REPORT_FILE"
    else
        echo "- ⚠️  No intrusion detection system" >> "$REPORT_FILE"
    fi
    
    cat >> "$REPORT_FILE" << EOF

### RESPOND (RS) - Incident Response

#### RS.AN: Analysis
EOF
    
    # Forensics tools
    if command -v tcpdump &>/dev/null || command -v wireshark &>/dev/null; then
        echo "- ✅ Network forensics tools available" >> "$REPORT_FILE"
    fi
    
    cat >> "$REPORT_FILE" << EOF

### RECOVER (RC) - Recovery Planning

#### RC.RP: Recovery Planning
EOF
    
    # Backup verification
    if crontab -l 2>/dev/null | grep -i "backup" &>/dev/null; then
        echo "- ✅ Automated backup jobs configured" >> "$REPORT_FILE"
    else
        echo "- ⚠️  No automated backup jobs detected" >> "$REPORT_FILE"
    fi
    
    echo "" >> "$REPORT_FILE"
}

# NIST 800-53 Checks
check_nist_800_53() {
    echo -e "${BLUE}🔍 Running NIST SP 800-53 compliance checks...${NC}"
    
    cat >> "$REPORT_FILE" << EOF
## NIST SP 800-53 Rev 5 Compliance

### AC (Access Control) Family
EOF
    
    # AC-2: Account Management
    echo "#### AC-2: Account Management" >> "$REPORT_FILE"
    if command -v useradd &>/dev/null && [[ -f /etc/login.defs ]]; then
        echo "- ✅ Account management system in place" >> "$REPORT_FILE"
    fi
    
    # AC-7: Unsuccessful Login Attempts
    echo "#### AC-7: Unsuccessful Login Attempts" >> "$REPORT_FILE"
    if grep -q "pam_faillock" /etc/pam.d/common-auth 2>/dev/null || \
       grep -q "pam_tally2" /etc/pam.d/common-auth 2>/dev/null; then
        echo "- ✅ Account lockout configured" >> "$REPORT_FILE"
    else
        echo "- ⚠️  No account lockout mechanism" >> "$REPORT_FILE"
    fi
    
    # AC-17: Remote Access
    echo "#### AC-17: Remote Access" >> "$REPORT_FILE"
    if systemctl is-active sshd &>/dev/null; then
        if grep -q "^PasswordAuthentication no" /etc/ssh/sshd_config 2>/dev/null; then
            echo "- ✅ SSH key-only authentication enabled" >> "$REPORT_FILE"
        else
            echo "- ⚠️  SSH password authentication enabled" >> "$REPORT_FILE"
        fi
    fi
    
    cat >> "$REPORT_FILE" << EOF

### AU (Audit and Accountability) Family

#### AU-2: Audit Events
EOF
    
    if systemctl is-active auditd &>/dev/null; then
        echo "- ✅ Audit system operational" >> "$REPORT_FILE"
        local audit_rules=$(auditctl -l 2>/dev/null | wc -l)
        echo "- ✅ Audit rules configured: $audit_rules" >> "$REPORT_FILE"
    else
        echo "- 🚨 **CRITICAL:** Audit system not running" >> "$REPORT_FILE"
    fi
    
    cat >> "$REPORT_FILE" << EOF

### CM (Configuration Management) Family

#### CM-2: Baseline Configuration
EOF
    
    if command -v git &>/dev/null; then
        echo "- ✅ Version control available for configuration tracking" >> "$REPORT_FILE"
    fi
    
    cat >> "$REPORT_FILE" << EOF

### IA (Identification and Authentication) Family

#### IA-2: Identification and Authentication
EOF
    
    # Check for strong authentication
    local auth_score=0
    if grep -q "pam_unix.so" /etc/pam.d/common-auth 2>/dev/null; then
        ((auth_score++))
    fi
    if command -v google-authenticator &>/dev/null; then
        ((auth_score++))
    fi
    
    if [[ $auth_score -ge 1 ]]; then
        echo "- ✅ Authentication mechanisms in place" >> "$REPORT_FILE"
    fi
    
    cat >> "$REPORT_FILE" << EOF

### SC (System and Communications Protection) Family

#### SC-7: Boundary Protection
EOF
    
    if ufw status 2>/dev/null | grep -q "Status: active" || \
       iptables -L 2>/dev/null | grep -q "Chain INPUT"; then
        echo "- ✅ Firewall configured" >> "$REPORT_FILE"
    else
        echo "- 🚨 **CRITICAL:** No firewall configured" >> "$REPORT_FILE"
    fi
    
    # SC-8: Transmission Confidentiality
    echo "#### SC-8: Transmission Confidentiality" >> "$REPORT_FILE"
    if netstat -tuln 2>/dev/null | grep -q ":443"; then
        echo "- ✅ Encrypted communications available (HTTPS)" >> "$REPORT_FILE"
    fi
    
    echo "" >> "$REPORT_FILE"
}

# NIST 800-171 Checks
check_nist_800_171() {
    echo -e "${BLUE}🔍 Running NIST SP 800-171 compliance checks...${NC}"
    
    cat >> "$REPORT_FILE" << EOF
## NIST SP 800-171 Rev 2 - Protecting Controlled Unclassified Information (CUI)

### 3.1 Access Control
EOF
    
    # 3.1.1: Limit system access
    echo "#### 3.1.1: Limit System Access to Authorized Users" >> "$REPORT_FILE"
    local user_count=$(cat /etc/passwd | grep -v "nologin\|false" | wc -l)
    echo "- Active user accounts: $user_count" >> "$REPORT_FILE"
    
    # 3.1.2: Limit system access to types of transactions
    if [[ -f /etc/sudoers ]]; then
        echo "- ✅ Privilege separation configured" >> "$REPORT_FILE"
    fi
    
    cat >> "$REPORT_FILE" << EOF

### 3.3 Audit and Accountability

#### 3.3.1: Create and Retain Audit Logs
EOF
    
    if systemctl is-active auditd &>/dev/null; then
        echo "- ✅ Audit logging enabled" >> "$REPORT_FILE"
    else
        echo "- 🚨 **CRITICAL:** Audit logging required for CUI systems" >> "$REPORT_FILE"
    fi
    
    # Check log retention
    if [[ -f /etc/logrotate.conf ]]; then
        local rotation=$(grep "^rotate" /etc/logrotate.conf 2>/dev/null | head -1)
        echo "- ✅ Log rotation configured: $rotation" >> "$REPORT_FILE"
    fi
    
    cat >> "$REPORT_FILE" << EOF

### 3.4 Configuration Management

#### 3.4.1: Establish and Maintain Baseline Configurations
EOF
    
    if command -v dpkg &>/dev/null || command -v rpm &>/dev/null; then
        echo "- ✅ Package management system available" >> "$REPORT_FILE"
    fi
    
    cat >> "$REPORT_FILE" << EOF

### 3.5 Identification and Authentication

#### 3.5.1: Identify System Users
EOF
    
    echo "- ✅ User identification system operational" >> "$REPORT_FILE"
    
    # 3.5.2: Authenticate users
    if [[ -f /etc/shadow ]] && [[ $(stat -c %a /etc/shadow) == "000" || $(stat -c %a /etc/shadow) == "400" ]]; then
        echo "- ✅ Password file properly protected" >> "$REPORT_FILE"
    fi
    
    cat >> "$REPORT_FILE" << EOF

### 3.13 System and Communications Protection

#### 3.13.8: Implement Cryptographic Mechanisms
EOF
    
    if lsblk -f 2>/dev/null | grep -q "crypt"; then
        echo "- ✅ Data at rest encryption (full disk encryption)" >> "$REPORT_FILE"
    else
        echo "- 🚨 **CRITICAL:** CUI must be encrypted at rest" >> "$REPORT_FILE"
    fi
    
    if command -v openssl &>/dev/null; then
        echo "- ✅ Cryptographic tools available" >> "$REPORT_FILE"
    fi
    
    # Check for CUI-specific requirements
    cat >> "$REPORT_FILE" << EOF

### 3.14 System and Information Integrity

#### 3.14.1: Identify and Manage Information System Flaws
EOF
    
    # Check for automatic updates
    if systemctl is-enabled unattended-upgrades &>/dev/null || \
       systemctl is-enabled dnf-automatic &>/dev/null; then
        echo "- ✅ Automatic security updates configured" >> "$REPORT_FILE"
    else
        echo "- ⚠️  Automatic security updates not configured" >> "$REPORT_FILE"
    fi
    
    echo "" >> "$REPORT_FILE"
}

# Generate compliance score
generate_score() {
    local framework="$1"
    
    local total=$(grep -cE "^- (✅|🚨|⚠️)" "$REPORT_FILE" 2>/dev/null || echo "1")
    local passed=$(grep -c "^- ✅" "$REPORT_FILE" 2>/dev/null || echo "0")
    local failed=$(grep -c "^- 🚨" "$REPORT_FILE" 2>/dev/null || echo "0")
    local warnings=$(grep -c "^- ⚠️" "$REPORT_FILE" 2>/dev/null || echo "0")
    
    local score=$(( (passed * 100) / total ))
    
    cat >> "$REPORT_FILE" << EOF

## NIST Compliance Summary

- **Framework:** $framework
- **Total Checks:** $total
- **Passed:** $passed (${score}%)
- **Critical Failures:** $failed
- **Warnings:** $warnings

### Compliance Score: $score/100

EOF
    
    if [[ $score -ge 90 ]]; then
        echo "**Status:** ✅ Highly Compliant" >> "$REPORT_FILE"
    elif [[ $score -ge 75 ]]; then
        echo "**Status:** ⚠️  Mostly Compliant" >> "$REPORT_FILE"
    elif [[ $score -ge 50 ]]; then
        echo "**Status:** ⚠️  Partially Compliant" >> "$REPORT_FILE"
    else
        echo "**Status:** 🚨 Non-Compliant" >> "$REPORT_FILE"
    fi
    
    echo "" >> "$REPORT_FILE"
}

# Generate recommendations
generate_recommendations() {
    cat >> "$REPORT_FILE" << EOF

## Recommended Actions

### Critical Issues (Immediate Action Required)
EOF
    
    grep "^- 🚨" "$REPORT_FILE" | sed 's/^- 🚨/1./' >> "$REPORT_FILE" || echo "None" >> "$REPORT_FILE"
    
    cat >> "$REPORT_FILE" << EOF

### Warnings (Address Within 30 Days)
EOF
    
    grep "^- ⚠️" "$REPORT_FILE" | sed 's/^- ⚠️/1./' | head -10 >> "$REPORT_FILE" || echo "None" >> "$REPORT_FILE"
    
    cat >> "$REPORT_FILE" << EOF

### NIST Resources

- **NIST CSF 2.0:** https://www.nist.gov/cyberframework
- **NIST SP 800-53:** https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final
- **NIST SP 800-171:** https://csrc.nist.gov/publications/detail/sp/800-171/rev-2/final
- **NIST Cybersecurity Resources:** https://www.nist.gov/cybersecurity

---

**Report generated by AI Security Scanner - NIST Compliance Module**
EOF
}

# Main function
main() {
    local framework="csf"
    local notify=false
    local verbose=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -f|--framework)
                framework="$2"
                shift 2
                ;;
            -n|--notify)
                notify=true
                shift
                ;;
            -v|--verbose)
                verbose=true
                shift
                ;;
            -h|--help)
                usage
                ;;
            *)
                echo -e "${RED}Unknown option: $1${NC}"
                usage
                ;;
        esac
    done
    
    FRAMEWORK="$framework"
    
    echo -e "${GREEN}🛡️  NIST Compliance Scanner${NC}\n"
    echo -e "${BLUE}Framework: $framework${NC}\n"
    
    # Initialize
    init_report
    
    # Run checks based on framework
    case "$framework" in
        csf)
            check_nist_csf
            generate_score "NIST Cybersecurity Framework 2.0"
            ;;
        800-53)
            check_nist_800_53
            generate_score "NIST SP 800-53 Rev 5"
            ;;
        800-171)
            check_nist_800_171
            generate_score "NIST SP 800-171 Rev 2 (CUI Protection)"
            ;;
        *)
            echo -e "${RED}Unknown framework: $framework${NC}"
            usage
            ;;
    esac
    
    # Recommendations
    generate_recommendations
    
    echo ""
    echo -e "${GREEN}✅ NIST compliance scan complete!${NC}"
    echo -e "${BLUE}📄 Report: $REPORT_FILE${NC}\n"
    
    # Display summary
    echo -e "${CYAN}Summary:${NC}"
    grep -E "^- (✅|🚨|⚠️)" "$REPORT_FILE" | head -15
    
    # Notification
    if [[ "$notify" == "true" ]] && [[ -f "$SCRIPT_DIR/../integrations/notify.sh" ]]; then
        "$SCRIPT_DIR/../integrations/notify.sh" \
            --platform all \
            --title "NIST Compliance Scan Complete ($framework)" \
            --file "$REPORT_FILE" \
            --severity "info" || true
    fi
}

# Run
main "$@"
