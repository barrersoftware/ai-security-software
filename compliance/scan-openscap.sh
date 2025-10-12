#!/bin/bash

###################################################
# AI Security Scanner - OpenSCAP Integration
# SCAP security compliance scanning with XCCDF/OVAL
###################################################

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPORT_FILE="$HOME/security-reports/openscap_$(date +%Y%m%d_%H%M%S).html"
REPORT_XML="$HOME/security-reports/openscap_$(date +%Y%m%d_%H%M%S).xml"
REPORT_MD="$HOME/security-reports/openscap_$(date +%Y%m%d_%H%M%S).md"
PROFILE="${PROFILE:-xccdf_org.ssgproject.content_profile_standard}"

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

Run OpenSCAP security compliance scans

OPTIONS:
    -p, --profile PROFILE        Security profile to use
    -c, --content FILE           Custom SCAP content file
    -f, --fix                    Automatically remediate failures (DANGEROUS)
    -o, --output FILE            Output HTML report path
    -n, --notify                 Send notification on completion
    -v, --verbose                Verbose output
    -h, --help                   Show this help

PROFILES (Common):
    standard                     Standard system security profile
    pci-dss                      PCI-DSS v3.2.1 compliance
    hipaa                        HIPAA compliance
    cis                          CIS Benchmark Level 1
    cis-server-l2                CIS Server Level 2
    stig                         DISA STIG (use scan-disa-stig.sh)
    ospp                         Common Criteria OSPP
    cui                          Controlled Unclassified Information

EXAMPLES:
    # Run standard security profile
    $0 --profile standard
    
    # Run PCI-DSS with auto-fix (be careful!)
    sudo $0 --profile pci-dss --fix
    
    # Run CIS Benchmark Level 1
    $0 --profile cis --notify
    
    # Use custom SCAP content
    $0 --content /usr/share/xml/scap/ssg/content/ssg-rhel8-ds.xml

NOTES:
    - OpenSCAP must be installed (see install.sh)
    - Some profiles require root privileges
    - Auto-fix can change system configuration
    - Always backup before using --fix

EOF
    exit 0
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
        echo "  Or run: sudo $SCRIPT_DIR/../scripts/install-openscap.sh"
        exit 1
    fi
}

# Detect OS and find appropriate SCAP content
detect_scap_content() {
    local content_file=""
    
    # Detect OS
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        local os_id="$ID"
        local os_version="${VERSION_ID%%.*}"
        
        echo -e "${BLUE}Detected OS: $PRETTY_NAME${NC}"
        
        # Find SCAP content based on OS
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
                if [[ ! -f "$content_file" ]]; then
                    content_file="/usr/share/xml/scap/ssg/content/ssg-centos${os_version}-ds.xml"
                fi
                ;;
            fedora)
                content_file="/usr/share/xml/scap/ssg/content/ssg-fedora-ds.xml"
                ;;
            *)
                echo -e "${YELLOW}⚠️  Unknown OS, trying generic content${NC}"
                content_file="/usr/share/xml/scap/ssg/content/ssg-rhel8-ds.xml"
                ;;
        esac
    fi
    
    # Check if content file exists
    if [[ ! -f "$content_file" ]]; then
        # Try to find any available content
        local available_content=$(find /usr/share/xml/scap/ssg/content -name "ssg-*-ds.xml" 2>/dev/null | head -1)
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

# List available profiles
list_profiles() {
    local content_file="$1"
    
    echo -e "${CYAN}Available Security Profiles:${NC}\n"
    
    oscap info "$content_file" 2>/dev/null | grep -A 1 "Profile" | grep -v "^--$" || true
    
    echo ""
}

# Map profile shortname to full XCCDF ID
map_profile() {
    local profile="$1"
    local content_file="$2"
    
    case "$profile" in
        standard)
            echo "xccdf_org.ssgproject.content_profile_standard"
            ;;
        pci-dss)
            echo "xccdf_org.ssgproject.content_profile_pci-dss"
            ;;
        hipaa)
            echo "xccdf_org.ssgproject.content_profile_hipaa"
            ;;
        cis)
            echo "xccdf_org.ssgproject.content_profile_cis"
            ;;
        cis-server-l1)
            echo "xccdf_org.ssgproject.content_profile_cis_server_l1"
            ;;
        cis-server-l2)
            echo "xccdf_org.ssgproject.content_profile_cis_server_l2"
            ;;
        stig)
            echo "xccdf_org.ssgproject.content_profile_stig"
            ;;
        ospp)
            echo "xccdf_org.ssgproject.content_profile_ospp"
            ;;
        cui)
            echo "xccdf_org.ssgproject.content_profile_cui"
            ;;
        *)
            # Return as-is if already full profile ID
            echo "$profile"
            ;;
    esac
}

# Run OpenSCAP scan
run_scan() {
    local content_file="$1"
    local profile="$2"
    local auto_fix="$3"
    
    mkdir -p "$(dirname "$REPORT_FILE")"
    
    echo -e "${GREEN}🛡️  Starting OpenSCAP Security Scan${NC}\n"
    echo -e "${BLUE}Content: $(basename $content_file)${NC}"
    echo -e "${BLUE}Profile: $profile${NC}\n"
    
    local full_profile=$(map_profile "$profile" "$content_file")
    
    # Build oscap command
    local oscap_cmd="oscap xccdf eval"
    oscap_cmd="$oscap_cmd --profile $full_profile"
    oscap_cmd="$oscap_cmd --results $REPORT_XML"
    oscap_cmd="$oscap_cmd --report $REPORT_FILE"
    
    if [[ "$auto_fix" == "true" ]]; then
        echo -e "${YELLOW}⚠️  AUTO-FIX ENABLED - System will be modified!${NC}"
        echo -e "${YELLOW}Waiting 5 seconds... Press Ctrl+C to cancel${NC}\n"
        sleep 5
        oscap_cmd="$oscap_cmd --remediate"
    fi
    
    oscap_cmd="$oscap_cmd $content_file"
    
    echo -e "${CYAN}Running scan...${NC}\n"
    
    # Run scan (oscap returns non-zero if there are failures, which is expected)
    set +e
    eval "$oscap_cmd"
    local exit_code=$?
    set -e
    
    # Exit codes:
    # 0 - all rules passed
    # 1 - error
    # 2 - at least one rule failed or unknown
    
    if [[ $exit_code -eq 0 ]]; then
        echo -e "\n${GREEN}✅ All security checks passed!${NC}"
    elif [[ $exit_code -eq 2 ]]; then
        echo -e "\n${YELLOW}⚠️  Some security checks failed (see report)${NC}"
    else
        echo -e "\n${RED}❌ Scan encountered errors${NC}"
    fi
    
    # Generate markdown summary
    generate_markdown_summary "$REPORT_XML"
    
    echo ""
    echo -e "${GREEN}✅ Scan complete!${NC}"
    echo -e "${BLUE}📄 HTML Report: $REPORT_FILE${NC}"
    echo -e "${BLUE}📄 XML Report: $REPORT_XML${NC}"
    echo -e "${BLUE}📄 Summary: $REPORT_MD${NC}"
    echo ""
}

# Generate markdown summary from XML results
generate_markdown_summary() {
    local xml_file="$1"
    
    if [[ ! -f "$xml_file" ]]; then
        return
    fi
    
    cat > "$REPORT_MD" << EOF
# OpenSCAP Security Scan Summary
Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
Hostname: $(hostname)

## Scan Results

EOF
    
    # Extract results using oscap (if available) or grep/sed
    if command -v oscap &>/dev/null; then
        # Get score
        local score=$(oscap xccdf generate report "$xml_file" 2>/dev/null | grep -oP 'Score: \K[0-9.]+' | head -1 || echo "N/A")
        
        echo "**Security Score:** ${score}%" >> "$REPORT_MD"
        echo "" >> "$REPORT_MD"
        
        # Count results by status
        local passed=$(grep -c "result>pass<" "$xml_file" 2>/dev/null || echo "0")
        local failed=$(grep -c "result>fail<" "$xml_file" 2>/dev/null || echo "0")
        local error=$(grep -c "result>error<" "$xml_file" 2>/dev/null || echo "0")
        local unknown=$(grep -c "result>unknown<" "$xml_file" 2>/dev/null || echo "0")
        local notapplicable=$(grep -c "result>notapplicable<" "$xml_file" 2>/dev/null || echo "0")
        local notchecked=$(grep -c "result>notchecked<" "$xml_file" 2>/dev/null || echo "0")
        
        cat >> "$REPORT_MD" << EOF
### Results Summary

| Status | Count |
|--------|-------|
| ✅ Pass | $passed |
| ❌ Fail | $failed |
| ⚠️  Error | $error |
| ❓ Unknown | $unknown |
| ➖ Not Applicable | $notapplicable |
| ⏭️  Not Checked | $notchecked |

### Compliance Status

EOF
        
        if [[ $failed -eq 0 ]] && [[ $error -eq 0 ]]; then
            echo "**Status:** ✅ COMPLIANT - All checks passed" >> "$REPORT_MD"
        elif [[ $failed -le 5 ]]; then
            echo "**Status:** ⚠️  MOSTLY COMPLIANT - Minor issues found" >> "$REPORT_MD"
        else
            echo "**Status:** ❌ NON-COMPLIANT - Multiple failures detected" >> "$REPORT_MD"
        fi
        
        cat >> "$REPORT_MD" << EOF

## Failed Checks

The following security checks failed and require attention:

EOF
        
        # Extract failed rules (basic parsing)
        grep -B 5 "result>fail<" "$xml_file" 2>/dev/null | grep "idref=" | sed 's/.*idref="/- /' | sed 's/".*//' | head -20 >> "$REPORT_MD" || true
        
        cat >> "$REPORT_MD" << EOF

## Recommendations

1. Review the detailed HTML report for specific remediation steps
2. Prioritize fixing failed checks marked as "high" or "critical" severity
3. Test any automated fixes in a non-production environment first
4. Document all configuration changes for audit purposes
5. Schedule regular OpenSCAP scans to maintain compliance

## Next Steps

EOF
        
        if [[ $failed -gt 0 ]]; then
            cat >> "$REPORT_MD" << EOF
To remediate failures automatically (USE WITH CAUTION):
\`\`\`bash
sudo $0 --profile $PROFILE --fix
\`\`\`

To view detailed HTML report:
\`\`\`bash
xdg-open $REPORT_FILE
\`\`\`
EOF
        fi
    fi
    
    cat >> "$REPORT_MD" << EOF

---

**Report generated by AI Security Scanner - OpenSCAP Module**
For detailed results, see the HTML report: $REPORT_FILE
EOF
}

# Analyze results with AI
analyze_with_ai() {
    if [[ ! -f "$REPORT_MD" ]]; then
        return
    fi
    
    if ! command -v ollama &>/dev/null; then
        return
    fi
    
    echo -e "${CYAN}🤖 Analyzing results with AI...${NC}\n"
    
    local analysis_file="$HOME/security-reports/openscap_ai_analysis_$(date +%Y%m%d_%H%M%S).md"
    
    # Prepare prompt
    local prompt="You are a security expert analyzing OpenSCAP scan results. Review this scan summary and provide:

1. Critical issues that need immediate attention
2. Risk assessment and potential security impact
3. Prioritized remediation recommendations
4. Best practices for maintaining compliance

Here is the scan summary:

$(cat "$REPORT_MD")

Provide a concise, actionable analysis."
    
    echo "# OpenSCAP AI Security Analysis" > "$analysis_file"
    echo "Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")" >> "$analysis_file"
    echo "" >> "$analysis_file"
    
    # Run AI analysis
    ollama run llama3.1:8b "$prompt" 2>/dev/null >> "$analysis_file" || {
        echo "AI analysis not available" >> "$analysis_file"
    }
    
    echo -e "${GREEN}✅ AI analysis complete: $analysis_file${NC}\n"
}

# Main function
main() {
    local profile="standard"
    local content_file=""
    local auto_fix=false
    local notify=false
    local verbose=false
    local show_profiles=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -p|--profile)
                profile="$2"
                shift 2
                ;;
            -c|--content)
                content_file="$2"
                shift 2
                ;;
            -f|--fix)
                auto_fix=true
                shift
                ;;
            -o|--output)
                REPORT_FILE="$2"
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
            -l|--list-profiles)
                show_profiles=true
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
    
    # Check OpenSCAP
    check_openscap
    
    # Detect SCAP content if not provided
    if [[ -z "$content_file" ]]; then
        content_file=$(detect_scap_content)
    fi
    
    # Show profiles if requested
    if [[ "$show_profiles" == "true" ]]; then
        list_profiles "$content_file"
        exit 0
    fi
    
    # Run scan
    run_scan "$content_file" "$profile" "$auto_fix"
    
    # AI analysis
    analyze_with_ai
    
    # Notification
    if [[ "$notify" == "true" ]] && [[ -f "$SCRIPT_DIR/../integrations/notify.sh" ]]; then
        "$SCRIPT_DIR/../integrations/notify.sh" \
            --platform all \
            --title "OpenSCAP Scan Complete ($profile)" \
            --file "$REPORT_MD" \
            --severity "info" || true
    fi
}

# Run
main "$@"
