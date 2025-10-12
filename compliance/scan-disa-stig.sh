#!/bin/bash

###################################################
# AI Security Scanner - DISA STIG Scanner
# Defense Information Systems Agency Security Technical Implementation Guides
###################################################

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPORT_FILE="$HOME/security-reports/disa-stig_$(date +%Y%m%d_%H%M%S).html"
REPORT_XML="$HOME/security-reports/disa-stig_$(date +%Y%m%d_%H%M%S).xml"
REPORT_MD="$HOME/security-reports/disa-stig_$(date +%Y%m%d_%H%M%S).md"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

usage() {
    cat << 'EOF'
Usage: $0 [OPTIONS]

Run DISA STIG (Security Technical Implementation Guide) compliance scans

DISA STIGs are security configuration standards for DoD systems.
This tool scans systems against STIG requirements using OpenSCAP.

OPTIONS:
    -c, --category CAT           Filter by category (CAT1|CAT2|CAT3|all)
    -f, --fix                    Automatically remediate failures (DANGEROUS)
    -s, --severity LEVEL         Filter by severity (high|medium|low)
    -o, --output FILE            Output HTML report path
    -n, --notify                 Send notification on completion
    -a, --analyze                Run AI analysis on results
    -h, --help                   Show this help

STIG CATEGORIES:
    CAT1 (Category I)            High severity - immediate threat
                                 Any vulnerability could result in loss of
                                 confidentiality, availability, or integrity
    
    CAT2 (Category II)           Medium severity - significant risk
                                 Could result in loss of confidentiality,
                                 availability, or integrity
    
    CAT3 (Category III)          Low severity - minor risk
                                 Degrades security measures but not immediate

EXAMPLES:
    # Run full DISA STIG scan
    sudo $0
    
    # Scan only CAT1 (critical) items
    sudo $0 --category CAT1
    
    # Run scan with AI analysis
    sudo $0 --analyze
    
    # Auto-remediate (use with extreme caution!)
    sudo $0 --fix

NOTES:
    - Requires root/sudo privileges
    - OpenSCAP and SCAP Security Guide must be installed
    - DISA STIGs are very strict - expect many failures initially
    - Auto-fix can significantly change system configuration
    - Always test fixes in non-production environment first
    - For DoD/Government systems, follow official STIG guidelines

REFERENCES:
    - DISA STIG Library: https://public.cyber.mil/stigs/
    - SCAP Security Guide: https://www.open-scap.org/security-policies/scap-security-guide/

EOF
    exit 0
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        echo -e "${YELLOW}⚠️  DISA STIG scans require root privileges${NC}"
        echo -e "${YELLOW}Please run with sudo${NC}\n"
        exit 1
    fi
}

# Check if OpenSCAP is installed
check_openscap() {
    if ! command -v oscap &>/dev/null; then
        echo -e "${RED}❌ OpenSCAP is not installed${NC}"
        echo ""
        echo "To install OpenSCAP:"
        echo ""
        echo "  Ubuntu/Debian:"
        echo "    sudo apt-get install -y libopenscap8 openscap-scanner scap-security-guide"
        echo ""
        echo "  RHEL/CentOS/Fedora:"
        echo "    sudo dnf install -y openscap-scanner scap-security-guide"
        echo ""
        exit 1
    fi
}

# Detect OS and find STIG content
detect_stig_content() {
    local content_file=""
    
    # Detect OS
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        local os_id="$ID"
        local os_version="${VERSION_ID%%.*}"
        
        echo -e "${BLUE}Detected OS: $PRETTY_NAME${NC}"
        
        # Find STIG content based on OS
        case "$os_id" in
            ubuntu)
                content_file="/usr/share/xml/scap/ssg/content/ssg-ubuntu${os_version}-ds.xml"
                if [[ ! -f "$content_file" ]]; then
                    content_file="/usr/share/xml/scap/ssg/content/ssg-ubuntu2004-ds.xml"
                fi
                ;;
            debian)
                content_file="/usr/share/xml/scap/ssg/content/ssg-debian${os_version}-ds.xml"
                ;;
            rhel|centos|rocky|almalinux)
                content_file="/usr/share/xml/scap/ssg/content/ssg-rhel${os_version}-ds.xml"
                # RHEL has official DISA STIG content
                local stig_file="/usr/share/xml/scap/ssg/content/ssg-rhel${os_version}-stig-ds.xml"
                if [[ -f "$stig_file" ]]; then
                    content_file="$stig_file"
                fi
                ;;
            fedora)
                content_file="/usr/share/xml/scap/ssg/content/ssg-fedora-ds.xml"
                ;;
            *)
                echo -e "${YELLOW}⚠️  Unknown OS, trying RHEL 8 STIG content${NC}"
                content_file="/usr/share/xml/scap/ssg/content/ssg-rhel8-ds.xml"
                ;;
        esac
    fi
    
    # Check if content file exists
    if [[ ! -f "$content_file" ]]; then
        # Try to find any STIG content
        local available_content=$(find /usr/share/xml/scap/ssg/content -name "*stig*.xml" 2>/dev/null | head -1)
        if [[ -z "$available_content" ]]; then
            # Fall back to regular content
            available_content=$(find /usr/share/xml/scap/ssg/content -name "ssg-*-ds.xml" 2>/dev/null | head -1)
        fi
        
        if [[ -n "$available_content" ]]; then
            content_file="$available_content"
            echo -e "${YELLOW}⚠️  Using available content: $(basename $content_file)${NC}"
        else
            echo -e "${RED}❌ No SCAP content found. Install scap-security-guide package.${NC}"
            exit 1
        fi
    fi
    
    echo "$content_file"
}

# Run DISA STIG scan
run_stig_scan() {
    local content_file="$1"
    local category="$2"
    local auto_fix="$3"
    
    mkdir -p "$(dirname "$REPORT_FILE")"
    
    echo -e "${GREEN}🛡️  DISA STIG Security Scan${NC}\n"
    echo -e "${BLUE}Content: $(basename $content_file)${NC}"
    echo -e "${BLUE}Category Filter: $category${NC}\n"
    
    # Find STIG profile
    local stig_profile=$(oscap info "$content_file" 2>/dev/null | grep -i "profile.*stig" | head -1 | grep -oP 'xccdf_[^ ]+' || echo "")
    
    if [[ -z "$stig_profile" ]]; then
        # Try common STIG profile IDs
        stig_profile="xccdf_org.ssgproject.content_profile_stig"
        echo -e "${YELLOW}⚠️  Using default STIG profile${NC}"
    else
        echo -e "${GREEN}✅ Found STIG profile: $stig_profile${NC}\n"
    fi
    
    # Build oscap command
    local oscap_cmd="oscap xccdf eval"
    oscap_cmd="$oscap_cmd --profile $stig_profile"
    oscap_cmd="$oscap_cmd --results $REPORT_XML"
    oscap_cmd="$oscap_cmd --report $REPORT_FILE"
    
    if [[ "$auto_fix" == "true" ]]; then
        echo -e "${RED}⚠️  ⚠️  ⚠️  AUTO-FIX ENABLED - SYSTEM WILL BE MODIFIED! ⚠️  ⚠️  ⚠️${NC}"
        echo -e "${YELLOW}This will enforce DISA STIG requirements on your system${NC}"
        echo -e "${YELLOW}This may break applications or change critical settings${NC}"
        echo -e "${YELLOW}Waiting 10 seconds... Press Ctrl+C to cancel${NC}\n"
        sleep 10
        oscap_cmd="$oscap_cmd --remediate"
    fi
    
    oscap_cmd="$oscap_cmd $content_file"
    
    echo -e "${CYAN}Running DISA STIG scan...${NC}"
    echo -e "${CYAN}This may take several minutes...${NC}\n"
    
    # Run scan
    set +e
    eval "$oscap_cmd"
    local exit_code=$?
    set -e
    
    # Interpret exit code
    if [[ $exit_code -eq 0 ]]; then
        echo -e "\n${GREEN}✅ All STIG requirements met!${NC}"
    elif [[ $exit_code -eq 2 ]]; then
        echo -e "\n${YELLOW}⚠️  Some STIG requirements failed${NC}"
    else
        echo -e "\n${RED}❌ Scan encountered errors${NC}"
    fi
    
    # Generate markdown summary
    generate_stig_summary "$REPORT_XML" "$category"
    
    echo ""
    echo -e "${GREEN}✅ DISA STIG scan complete!${NC}"
    echo -e "${BLUE}📄 HTML Report: $REPORT_FILE${NC}"
    echo -e "${BLUE}📄 XML Report: $REPORT_XML${NC}"
    echo -e "${BLUE}📄 Summary: $REPORT_MD${NC}"
    echo ""
}

# Generate STIG summary report
generate_stig_summary() {
    local xml_file="$1"
    local category="$2"
    
    if [[ ! -f "$xml_file" ]]; then
        return
    fi
    
    cat > "$REPORT_MD" << EOF
# DISA STIG Security Compliance Report
Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
Hostname: $(hostname)
Classification: UNCLASSIFIED

## Overview

The Defense Information Systems Agency (DISA) Security Technical Implementation 
Guides (STIGs) are the configuration standards for DoD IA and IA-enabled devices/systems.

This report shows compliance status against STIG requirements.

## Scan Results

EOF
    
    # Count results by status
    local passed=$(grep -c "result>pass<" "$xml_file" 2>/dev/null || echo "0")
    local failed=$(grep -c "result>fail<" "$xml_file" 2>/dev/null || echo "0")
    local error=$(grep -c "result>error<" "$xml_file" 2>/dev/null || echo "0")
    local unknown=$(grep -c "result>unknown<" "$xml_file" 2>/dev/null || echo "0")
    local notapplicable=$(grep -c "result>notapplicable<" "$xml_file" 2>/dev/null || echo "0")
    local total=$((passed + failed + error + unknown))
    
    # Calculate compliance percentage
    local compliance=0
    if [[ $total -gt 0 ]]; then
        compliance=$(( (passed * 100) / total ))
    fi
    
    cat >> "$REPORT_MD" << EOF
### Compliance Summary

| Metric | Value |
|--------|-------|
| **Compliance Score** | **${compliance}%** |
| ✅ Pass | $passed |
| ❌ Fail | $failed |
| ⚠️  Error | $error |
| ❓ Unknown | $unknown |
| ➖ Not Applicable | $notapplicable |
| **Total Checks** | **$total** |

### STIG Status

EOF
    
    if [[ $compliance -ge 95 ]]; then
        echo "**Status:** ✅ FULLY COMPLIANT" >> "$REPORT_MD"
        echo "" >> "$REPORT_MD"
        echo "System meets DISA STIG requirements." >> "$REPORT_MD"
    elif [[ $compliance -ge 80 ]]; then
        echo "**Status:** ⚠️  MOSTLY COMPLIANT" >> "$REPORT_MD"
        echo "" >> "$REPORT_MD"
        echo "System is largely compliant but has some failures that need attention." >> "$REPORT_MD"
    elif [[ $compliance -ge 50 ]]; then
        echo "**Status:** ⚠️  PARTIALLY COMPLIANT" >> "$REPORT_MD"
        echo "" >> "$REPORT_MD"
        echo "System has significant compliance gaps. Immediate action required." >> "$REPORT_MD"
    else
        echo "**Status:** ❌ NON-COMPLIANT" >> "$REPORT_MD"
        echo "" >> "$REPORT_MD"
        echo "System fails to meet DISA STIG requirements. Critical remediation needed." >> "$REPORT_MD"
    fi
    
    cat >> "$REPORT_MD" << EOF

## Failed STIG Requirements

The following STIG checks failed (showing first 30):

EOF
    
    # Extract failed rules
    grep -B 5 "result>fail<" "$xml_file" 2>/dev/null | \
        grep "idref=" | \
        sed 's/.*idref="//' | \
        sed 's/".*//' | \
        head -30 | \
        while read rule; do
            echo "- ❌ $rule" >> "$REPORT_MD"
        done || echo "No failures found" >> "$REPORT_MD"
    
    cat >> "$REPORT_MD" << EOF

## STIG Category Breakdown

DISA STIGs categorize findings by severity:

- **CAT I (High):** Any vulnerability that could result in loss of 
  Confidentiality, Availability, or Integrity
- **CAT II (Medium):** Could result in loss of CIA 
- **CAT III (Low):** Degrades security measures

### Severity Analysis

EOF
    
    # Try to extract severity info (this is basic - full implementation would parse XML properly)
    local cat1_fail=$(grep -c "severity>high.*result>fail" "$xml_file" 2>/dev/null || echo "0")
    local cat2_fail=$(grep -c "severity>medium.*result>fail" "$xml_file" 2>/dev/null || echo "0")
    local cat3_fail=$(grep -c "severity>low.*result>fail" "$xml_file" 2>/dev/null || echo "0")
    
    cat >> "$REPORT_MD" << EOF
| Category | Failed | Priority |
|----------|--------|----------|
| CAT I (High) | $cat1_fail | 🔴 CRITICAL |
| CAT II (Medium) | $cat2_fail | 🟡 Important |
| CAT III (Low) | $cat3_fail | 🟢 Minor |

EOF
    
    if [[ $cat1_fail -gt 0 ]]; then
        echo "⚠️  **WARNING:** $cat1_fail Category I (Critical) findings require immediate attention!" >> "$REPORT_MD"
        echo "" >> "$REPORT_MD"
    fi
    
    cat >> "$REPORT_MD" << EOF

## Remediation Actions

### Immediate Actions Required (CAT I)

EOF
    
    if [[ $cat1_fail -gt 0 ]]; then
        echo "1. Review all Category I failures in the HTML report" >> "$REPORT_MD"
        echo "2. Prioritize remediation of high-severity findings" >> "$REPORT_MD"
        echo "3. Document all changes for audit trail" >> "$REPORT_MD"
        echo "4. Re-scan after remediation" >> "$REPORT_MD"
    else
        echo "✅ No critical (CAT I) issues found" >> "$REPORT_MD"
    fi
    
    cat >> "$REPORT_MD" << EOF

### Automated Remediation

⚠️  **CAUTION:** Automated remediation can change critical system settings.
Always test in non-production environment first!

To apply STIG hardening automatically:
\`\`\`bash
# BACKUP YOUR SYSTEM FIRST!
sudo $0 --fix
\`\`\`

### Manual Remediation

For detailed remediation steps:
1. Open the HTML report in a browser
2. Review each failed check
3. Follow the remediation procedures provided
4. Test changes in non-production first
5. Document all configuration changes

### Verification

After remediation, re-run the scan:
\`\`\`bash
sudo $0
\`\`\`

## Compliance Roadmap

To achieve full DISA STIG compliance:

1. **Week 1-2:** Remediate all CAT I (Critical) findings
2. **Week 3-4:** Address CAT II (Medium) findings
3. **Week 5-6:** Fix CAT III (Low) findings
4. **Week 7:** Final verification scan
5. **Week 8:** Documentation and audit preparation

## Additional Resources

- **DISA STIG Library:** https://public.cyber.mil/stigs/
- **SCAP Security Guide:** https://www.open-scap.org/
- **STIG Viewer:** https://public.cyber.mil/stigs/srg-stig-tools/
- **OpenSCAP Documentation:** https://www.open-scap.org/resources/documentation/

## Notes for DoD/Government Systems

If this is a DoD or government system:
- Follow official DISA STIG guidance
- Obtain proper authorization before making changes
- Maintain audit trails of all modifications
- Coordinate with your ISSO/ISSM
- Document exceptions through proper channels

---

**Report generated by AI Security Scanner - DISA STIG Module**

For detailed results and remediation steps, see: $REPORT_FILE

**Classification:** UNCLASSIFIED
EOF
}

# Analyze STIG results with AI
analyze_stig_with_ai() {
    if [[ ! -f "$REPORT_MD" ]]; then
        return
    fi
    
    if ! command -v ollama &>/dev/null; then
        echo -e "${YELLOW}⚠️  Ollama not available for AI analysis${NC}"
        return
    fi
    
    echo -e "${CYAN}🤖 Analyzing DISA STIG results with AI...${NC}\n"
    
    local analysis_file="$HOME/security-reports/disa-stig_ai_analysis_$(date +%Y%m%d_%H%M%S).md"
    
    # Prepare prompt
    local prompt="You are a DoD cybersecurity expert analyzing DISA STIG compliance scan results. 

Review this STIG scan summary and provide:

1. **Critical Security Gaps:** Identify the most serious compliance failures
2. **Risk Assessment:** Explain potential security impacts of failures
3. **Prioritized Remediation Plan:** Step-by-step plan to achieve compliance
4. **Operational Impact:** Discuss what STIG compliance means for operations
5. **Best Practices:** Recommendations for maintaining ongoing compliance

Here is the STIG scan summary:

$(cat "$REPORT_MD")

Provide detailed, actionable analysis suitable for presentation to security leadership."
    
    echo "# DISA STIG AI Security Analysis" > "$analysis_file"
    echo "Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")" >> "$analysis_file"
    echo "Classification: UNCLASSIFIED" >> "$analysis_file"
    echo "" >> "$analysis_file"
    
    # Run AI analysis
    echo -e "${CYAN}Processing with AI model...${NC}"
    ollama run llama3.1:8b "$prompt" 2>/dev/null >> "$analysis_file" || {
        echo "AI analysis failed" >> "$analysis_file"
    }
    
    echo ""
    echo -e "${GREEN}✅ AI analysis complete: $analysis_file${NC}\n"
}

# Main function
main() {
    local category="all"
    local auto_fix=false
    local notify=false
    local ai_analyze=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -c|--category)
                category="$2"
                shift 2
                ;;
            -f|--fix)
                auto_fix=true
                shift
                ;;
            -s|--severity)
                # Map severity to category
                case "$2" in
                    high) category="CAT1" ;;
                    medium) category="CAT2" ;;
                    low) category="CAT3" ;;
                esac
                shift 2
                ;;
            -o|--output)
                REPORT_FILE="$2"
                REPORT_XML="${REPORT_FILE%.html}.xml"
                REPORT_MD="${REPORT_FILE%.html}.md"
                shift 2
                ;;
            -n|--notify)
                notify=true
                shift
                ;;
            -a|--analyze)
                ai_analyze=true
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
    
    # Check requirements
    check_root
    check_openscap
    
    # Detect STIG content
    local content_file=$(detect_stig_content)
    
    # Run STIG scan
    run_stig_scan "$content_file" "$category" "$auto_fix"
    
    # AI analysis
    if [[ "$ai_analyze" == "true" ]]; then
        analyze_stig_with_ai
    fi
    
    # Notification
    if [[ "$notify" == "true" ]] && [[ -f "$SCRIPT_DIR/../integrations/notify.sh" ]]; then
        "$SCRIPT_DIR/../integrations/notify.sh" \
            --platform all \
            --title "DISA STIG Scan Complete" \
            --file "$REPORT_MD" \
            --severity "critical" || true
    fi
    
    echo -e "${CYAN}💡 Tip: View the HTML report for detailed remediation steps${NC}"
    echo -e "${CYAN}💡 Tip: Use --analyze flag for AI-powered security analysis${NC}"
}

# Run
main "$@"
