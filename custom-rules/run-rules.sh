#!/bin/bash

###################################################
# AI Security Scanner - Custom Rule Engine
# Run custom security rules defined in YAML
###################################################

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RULES_FILE="${RULES_FILE:-$SCRIPT_DIR/rules.yaml}"
REPORT_FILE="$HOME/security-reports/custom_rules_$(date +%Y%m%d_%H%M%S).md"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Run custom security rules

OPTIONS:
    -r, --rules FILE      Rules file (default: rules.yaml)
    -g, --group GROUP     Run specific rule group
    -i, --id RULE_ID      Run specific rule by ID
    -s, --severity LEVEL  Filter by severity (critical|warning|info)
    -n, --notify          Send notification on completion
    -v, --verbose         Verbose output
    -h, --help            Show this help

EXAMPLES:
    # Run all rules
    $0
    
    # Run critical rules only
    $0 --severity critical
    
    # Run specific group
    $0 --group web-security
    
    # Run specific rule
    $0 --id custom-001

EOF
    exit 0
}

# Parse YAML (simple parser for our format)
parse_rules() {
    local rules_file="$1"
    
    if [[ ! -f "$rules_file" ]]; then
        echo -e "${RED}❌ Rules file not found: $rules_file${NC}"
        echo -e "${YELLOW}Copy rules.yaml.example to rules.yaml${NC}"
        exit 1
    fi
    
    export RULES_CONTENT=$(cat "$rules_file")
}

# Get rule IDs
get_rule_ids() {
    local filter_type="$1"
    local filter_value="$2"
    
    case "$filter_type" in
        all)
            echo "$RULES_CONTENT" | grep "^  - id:" | awk '{print $3}'
            ;;
        id)
            echo "$filter_value"
            ;;
        group)
            # Extract IDs from group
            local in_group=false
            echo "$RULES_CONTENT" | while IFS= read -r line; do
                if [[ "$line" =~ ^[[:space:]]*${filter_value}: ]]; then
                    in_group=true
                    continue
                fi
                if $in_group; then
                    if [[ "$line" =~ ^[[:space:]]*- ]]; then
                        echo "$line" | sed 's/^[[:space:]]*- //'
                    elif [[ "$line" =~ ^[[:space:]]*[a-zA-Z] ]] && [[ ! "$line" =~ ^[[:space:]]*- ]]; then
                        break
                    fi
                fi
            done
            ;;
        severity)
            # Get rules by severity
            local in_rule=false
            local current_id=""
            local current_severity=""
            
            echo "$RULES_CONTENT" | while IFS= read -r line; do
                if [[ "$line" =~ ^[[:space:]]*-[[:space:]]*id:[[:space:]]*(.*) ]]; then
                    if [[ -n "$current_id" ]] && [[ "$current_severity" == "$filter_value" ]]; then
                        echo "$current_id"
                    fi
                    current_id="${BASH_REMATCH[1]}"
                    current_severity=""
                    in_rule=true
                elif $in_rule && [[ "$line" =~ ^[[:space:]]*severity:[[:space:]]*(.*) ]]; then
                    current_severity="${BASH_REMATCH[1]}"
                fi
            done
            
            # Print last rule if matches
            if [[ -n "$current_id" ]] && [[ "$current_severity" == "$filter_value" ]]; then
                echo "$current_id"
            fi
            ;;
    esac
}

# Get rule details
get_rule_field() {
    local rule_id="$1"
    local field="$2"
    
    local in_rule=false
    local in_command=false
    local command_text=""
    
    echo "$RULES_CONTENT" | while IFS= read -r line; do
        # Check if we're entering the target rule
        if [[ "$line" =~ ^[[:space:]]*-[[:space:]]*id:[[:space:]]*${rule_id}$ ]]; then
            in_rule=true
            continue
        fi
        
        # Check if we've left the rule
        if $in_rule && [[ "$line" =~ ^[[:space:]]*-[[:space:]]*id: ]]; then
            break
        fi
        
        if $in_rule; then
            case "$field" in
                name|description|severity|category|remediation)
                    if [[ "$line" =~ ^[[:space:]]*${field}:[[:space:]]*(.*) ]]; then
                        echo "${BASH_REMATCH[1]}"
                        break
                    fi
                    ;;
                enabled)
                    if [[ "$line" =~ ^[[:space:]]*enabled:[[:space:]]*(.*) ]]; then
                        echo "${BASH_REMATCH[1]}"
                        break
                    fi
                    ;;
                command)
                    if [[ "$line" =~ ^[[:space:]]*command:[[:space:]]*\| ]]; then
                        in_command=true
                        continue
                    fi
                    if $in_command; then
                        if [[ "$line" =~ ^[[:space:]]*[a-zA-Z]+: ]] || [[ "$line" =~ ^[[:space:]]*- ]]; then
                            echo "$command_text"
                            break
                        else
                            command_text+="$line"$'\n'
                        fi
                    fi
                    ;;
                expect)
                    if [[ "$line" =~ ^[[:space:]]*expect:[[:space:]]*(.*) ]]; then
                        echo "${BASH_REMATCH[1]}"
                        break
                    fi
                    ;;
            esac
        fi
    done
}

# Run single rule
run_rule() {
    local rule_id="$1"
    local verbose="$2"
    
    local name=$(get_rule_field "$rule_id" "name")
    local description=$(get_rule_field "$rule_id" "description")
    local severity=$(get_rule_field "$rule_id" "severity")
    local enabled=$(get_rule_field "$rule_id" "enabled")
    local command=$(get_rule_field "$rule_id" "command")
    local expect=$(get_rule_field "$rule_id" "expect")
    local remediation=$(get_rule_field "$rule_id" "remediation")
    
    # Skip if disabled
    if [[ "$enabled" == "false" ]]; then
        [[ "$verbose" == "true" ]] && echo -e "${YELLOW}⊘ $rule_id - $name (disabled)${NC}"
        return 0
    fi
    
    echo -e "${BLUE}🔍 Testing: $name${NC}"
    
    # Run command
    local output
    local exit_code
    
    output=$(eval "$command" 2>&1) || exit_code=$?
    exit_code=${exit_code:-0}
    
    # Check result
    local status="unknown"
    case "$expect" in
        zero)
            [[ $exit_code -eq 0 ]] && status="pass" || status="fail"
            ;;
        non-zero)
            [[ $exit_code -ne 0 ]] && status="pass" || status="fail"
            ;;
        *)
            # Check output content
            if [[ "$output" == "$expect" ]]; then
                status="pass"
            else
                status="fail"
            fi
            ;;
    esac
    
    # Report
    if [[ "$status" == "pass" ]]; then
        echo -e "${GREEN}✅ PASS${NC}"
        echo "PASS:$rule_id:$name:$severity" >> "$TEMP_DIR/results.log"
    else
        case "$severity" in
            critical)
                echo -e "${RED}🚨 FAIL (CRITICAL)${NC}"
                ;;
            warning)
                echo -e "${YELLOW}⚠️  FAIL (WARNING)${NC}"
                ;;
            info)
                echo -e "${BLUE}ℹ️  FAIL (INFO)${NC}"
                ;;
        esac
        echo "FAIL:$rule_id:$name:$severity:$remediation" >> "$TEMP_DIR/results.log"
    fi
    
    echo ""
}

# Generate report
generate_report() {
    local results_file="$1"
    
    mkdir -p "$(dirname "$REPORT_FILE")"
    
    cat > "$REPORT_FILE" << EOF
# Custom Security Rules Report
Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")

## Summary

EOF
    
    local total=$(grep -c ":" "$results_file" 2>/dev/null || echo "0")
    local passed=$(grep -c "^PASS:" "$results_file" 2>/dev/null || echo "0")
    local failed=$(grep -c "^FAIL:" "$results_file" 2>/dev/null || echo "0")
    local critical=$(grep "^FAIL:.*:critical:" "$results_file" 2>/dev/null | wc -l || echo "0")
    local warning=$(grep "^FAIL:.*:warning:" "$results_file" 2>/dev/null | wc -l || echo "0")
    
    cat >> "$REPORT_FILE" << EOF
- **Total Rules Executed:** $total
- **Passed:** $passed
- **Failed:** $failed
  - Critical: $critical
  - Warning: $warning

## Failed Rules

EOF
    
    if [[ $failed -gt 0 ]]; then
        # Critical failures
        if [[ $critical -gt 0 ]]; then
            echo "### 🚨 Critical Issues" >> "$REPORT_FILE"
            echo "" >> "$REPORT_FILE"
            
            grep "^FAIL:.*:critical:" "$results_file" | while IFS=: read -r status id name severity remediation; do
                cat >> "$REPORT_FILE" << EOF
#### $name ($id)
**Severity:** Critical

**Remediation:**
\`\`\`bash
$remediation
\`\`\`

EOF
            done
        fi
        
        # Warning failures
        if [[ $warning -gt 0 ]]; then
            echo "### ⚠️  Warnings" >> "$REPORT_FILE"
            echo "" >> "$REPORT_FILE"
            
            grep "^FAIL:.*:warning:" "$results_file" | while IFS=: read -r status id name severity remediation; do
                cat >> "$REPORT_FILE" << EOF
#### $name ($id)
**Severity:** Warning

**Remediation:**
\`\`\`bash
$remediation
\`\`\`

EOF
            done
        fi
    else
        echo "✅ All rules passed!" >> "$REPORT_FILE"
    fi
    
    echo "" >> "$REPORT_FILE"
    echo "---" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "**Report generated by AI Security Scanner - Custom Rule Engine**" >> "$REPORT_FILE"
}

# Main function
main() {
    local filter_type="all"
    local filter_value=""
    local notify=false
    local verbose=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -r|--rules)
                RULES_FILE="$2"
                shift 2
                ;;
            -g|--group)
                filter_type="group"
                filter_value="$2"
                shift 2
                ;;
            -i|--id)
                filter_type="id"
                filter_value="$2"
                shift 2
                ;;
            -s|--severity)
                filter_type="severity"
                filter_value="$2"
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
    
    echo -e "${GREEN}🛡️  Custom Rule Engine${NC}\n"
    
    # Parse rules
    parse_rules "$RULES_FILE"
    
    # Create temp directory
    TEMP_DIR="/tmp/custom-rules-$$"
    mkdir -p "$TEMP_DIR"
    > "$TEMP_DIR/results.log"
    
    # Get rules to run
    mapfile -t rule_ids < <(get_rule_ids "$filter_type" "$filter_value")
    
    if [[ ${#rule_ids[@]} -eq 0 ]]; then
        echo -e "${RED}❌ No rules found matching criteria${NC}"
        rm -rf "$TEMP_DIR"
        exit 1
    fi
    
    echo -e "${BLUE}📋 Running ${#rule_ids[@]} rule(s)...${NC}\n"
    
    # Run rules
    for rule_id in "${rule_ids[@]}"; do
        run_rule "$rule_id" "$verbose"
    done
    
    # Generate report
    generate_report "$TEMP_DIR/results.log"
    
    # Summary
    local total=${#rule_ids[@]}
    local passed=$(grep -c "^PASS:" "$TEMP_DIR/results.log" 2>/dev/null || echo "0")
    local failed=$(grep -c "^FAIL:" "$TEMP_DIR/results.log" 2>/dev/null || echo "0")
    
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  Scan Complete${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
    
    echo -e "${BLUE}📊 Results:${NC}"
    echo -e "  Total: $total"
    echo -e "  ${GREEN}Passed: $passed${NC}"
    [[ $failed -gt 0 ]] && echo -e "  ${RED}Failed: $failed${NC}"
    echo -e "  Report: $REPORT_FILE"
    echo ""
    
    # Cleanup
    rm -rf "$TEMP_DIR"
    
    # Notification
    if [[ "$notify" == "true" ]] && [[ -f "$SCRIPT_DIR/../integrations/notify.sh" ]]; then
        local severity="success"
        [[ $failed -gt 0 ]] && severity="warning"
        
        "$SCRIPT_DIR/../integrations/notify.sh" \
            --platform all \
            --title "Custom Rules Scan Complete" \
            --message "Rules: $total, Passed: $passed, Failed: $failed" \
            --severity "$severity" \
            --file "$REPORT_FILE" || true
    fi
    
    echo -e "${GREEN}✅ Done!${NC}"
    
    # Exit with error if there were failures
    [[ $failed -gt 0 ]] && exit 1 || exit 0
}

# Run
main "$@"
