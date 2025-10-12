#!/bin/bash

####################################################
# AI Security Scanner - Multi-Server Scanner
# Scan multiple servers from central location
####################################################

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INVENTORY_FILE="${INVENTORY_FILE:-$SCRIPT_DIR/servers.yaml}"
REPORTS_DIR="${REPORTS_DIR:-$HOME/security-reports/multi-server}"
SCANNER_SCRIPT="$SCRIPT_DIR/../scripts/security-scanner.sh"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Check for dependencies
check_dependencies() {
    local missing=()
    
    command -v ssh >/dev/null 2>&1 || missing+=("ssh")
    command -v scp >/dev/null 2>&1 || missing+=("scp")
    command -v parallel >/dev/null 2>&1 || missing+=("parallel")
    
    if [ ${#missing[@]} -gt 0 ]; then
        echo -e "${RED}❌ Missing dependencies: ${missing[*]}${NC}"
        echo -e "${YELLOW}Install with: sudo apt install openssh-client parallel${NC}"
        exit 1
    fi
}

usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Scan multiple servers from a central location

OPTIONS:
    -i, --inventory FILE     Server inventory file (default: servers.yaml)
    -s, --servers LIST       Comma-separated server names to scan
    -g, --group GROUP        Scan servers in specific group
    -t, --tags TAGS          Scan servers with specific tags (comma-separated)
    -p, --parallel N         Max parallel scans (default: 4)
    -q, --quick              Quick scan mode
    -r, --reports DIR        Reports directory (default: ~/security-reports/multi-server)
    -n, --notify             Send notifications on completion
    -c, --consolidated       Generate consolidated report
    -h, --help               Show this help

EXAMPLES:
    # Scan all production servers
    $0 --group production
    
    # Scan specific servers
    $0 --servers web-prod-01,db-prod-01
    
    # Scan servers with 'critical' tag
    $0 --tags critical --notify
    
    # Quick scan with 8 parallel jobs
    $0 --group production --quick --parallel 8
    
    # Scan all servers and generate consolidated report
    $0 --consolidated --notify

EOF
    exit 0
}

# Parse YAML inventory (simple parser)
parse_inventory() {
    local inventory="$1"
    
    if [[ ! -f "$inventory" ]]; then
        echo -e "${RED}❌ Inventory file not found: $inventory${NC}"
        echo -e "${YELLOW}Copy servers.yaml.example to servers.yaml and configure${NC}"
        exit 1
    fi
    
    # Export for other functions to use
    export INVENTORY_CONTENT=$(cat "$inventory")
}

# Get servers from inventory
get_servers() {
    local filter_type="$1"  # all, group, tags, names
    local filter_value="$2"
    
    case "$filter_type" in
        all)
            echo "$INVENTORY_CONTENT" | grep -A1 "^  - name:" | grep "name:" | awk '{print $3}'
            ;;
        names)
            echo "$filter_value" | tr ',' '\n'
            ;;
        group)
            # Extract servers from group
            local in_group=false
            local group_name="$filter_value"
            echo "$INVENTORY_CONTENT" | while IFS= read -r line; do
                if [[ "$line" =~ ^[[:space:]]*${group_name}: ]]; then
                    in_group=true
                    continue
                fi
                if $in_group; then
                    if [[ "$line" =~ ^[[:space:]]*- ]]; then
                        echo "$line" | sed 's/^[[:space:]]*- //'
                    elif [[ "$line" =~ ^[[:space:]]*[a-zA-Z] ]]; then
                        break
                    fi
                fi
            done
            ;;
        tags)
            # Get servers with matching tags
            local tags="$filter_value"
            # Simple implementation - you might want to enhance this
            echo "$INVENTORY_CONTENT" | grep -B5 "$tags" | grep "name:" | awk '{print $3}'
            ;;
    esac
}

# Get server details
get_server_info() {
    local server_name="$1"
    local field="$2"  # host, user, ssh_key, port
    
    local in_server=false
    echo "$INVENTORY_CONTENT" | while IFS= read -r line; do
        if [[ "$line" =~ name:[[:space:]]*${server_name}$ ]]; then
            in_server=true
            continue
        fi
        
        if $in_server; then
            if [[ "$line" =~ ^[[:space:]]*-[[:space:]]name: ]]; then
                break
            fi
            
            case "$field" in
                host)
                    if [[ "$line" =~ host:[[:space:]]*(.*) ]]; then
                        echo "${BASH_REMATCH[1]}"
                        break
                    fi
                    ;;
                user)
                    if [[ "$line" =~ user:[[:space:]]*(.*) ]]; then
                        echo "${BASH_REMATCH[1]}"
                        break
                    fi
                    ;;
                ssh_key)
                    if [[ "$line" =~ ssh_key:[[:space:]]*(.*) ]]; then
                        echo "${BASH_REMATCH[1]}"
                        break
                    fi
                    ;;
                port)
                    if [[ "$line" =~ port:[[:space:]]*(.*) ]]; then
                        echo "${BASH_REMATCH[1]}"
                        break
                    fi
                    ;;
            esac
        fi
    done
}

# Test SSH connection
test_connection() {
    local server_name="$1"
    local host=$(get_server_info "$server_name" "host")
    local user=$(get_server_info "$server_name" "user")
    local key=$(get_server_info "$server_name" "ssh_key")
    local port=$(get_server_info "$server_name" "port")
    
    key="${key/#\~/$HOME}"  # Expand tilde
    
    if ssh -i "$key" -p "$port" -o ConnectTimeout=10 -o BatchMode=yes \
        "${user}@${host}" "echo ok" >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Scan single server
scan_server() {
    local server_name="$1"
    local quick_mode="$2"
    
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  Scanning: $server_name${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    local host=$(get_server_info "$server_name" "host")
    local user=$(get_server_info "$server_name" "user")
    local key=$(get_server_info "$server_name" "ssh_key")
    local port=$(get_server_info "$server_name" "port")
    
    key="${key/#\~/$HOME}"  # Expand tilde
    
    # Test connection
    echo -e "${BLUE}🔌 Testing connection to $host...${NC}"
    if ! test_connection "$server_name"; then
        echo -e "${RED}❌ Failed to connect to $server_name ($host)${NC}"
        echo "FAILED:$server_name:Connection failed" >> "$REPORTS_DIR/scan_status.log"
        return 1
    fi
    echo -e "${GREEN}✅ Connected successfully${NC}"
    
    # Create remote directory for scripts
    ssh -i "$key" -p "$port" "${user}@${host}" \
        "mkdir -p /tmp/ai-security-scanner/scripts" 2>/dev/null
    
    # Copy scanner script
    echo -e "${BLUE}📤 Uploading scanner script...${NC}"
    scp -i "$key" -P "$port" -q \
        "$SCANNER_SCRIPT" \
        "${user}@${host}:/tmp/ai-security-scanner/scripts/"
    
    # Run scan
    echo -e "${BLUE}🔍 Running security scan...${NC}"
    local start_time=$(date +%s)
    
    if ssh -i "$key" -p "$port" "${user}@${host}" \
        "cd /tmp/ai-security-scanner/scripts && bash security-scanner.sh" \
        > "$REPORTS_DIR/${server_name}_scan.log" 2>&1; then
        
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        echo -e "${GREEN}✅ Scan completed in ${duration}s${NC}"
        
        # Download report
        echo -e "${BLUE}📥 Downloading report...${NC}"
        scp -i "$key" -P "$port" -q \
            "${user}@${host}:~/security-reports/security_analysis_*.md" \
            "$REPORTS_DIR/${server_name}_report.md" 2>/dev/null || true
        
        # Cleanup
        ssh -i "$key" -p "$port" "${user}@${host}" \
            "rm -rf /tmp/ai-security-scanner" 2>/dev/null
        
        echo "SUCCESS:$server_name:${duration}s" >> "$REPORTS_DIR/scan_status.log"
        return 0
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        echo -e "${RED}❌ Scan failed after ${duration}s${NC}"
        echo "FAILED:$server_name:Scan error" >> "$REPORTS_DIR/scan_status.log"
        return 1
    fi
}

# Generate consolidated report
generate_consolidated_report() {
    local report_file="$REPORTS_DIR/consolidated_report_$(date +%Y%m%d_%H%M%S).md"
    
    echo -e "${BLUE}📊 Generating consolidated report...${NC}"
    
    cat > "$report_file" << EOF
# Multi-Server Security Analysis Report
Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")

## Executive Summary

### Scan Overview
EOF
    
    # Count successes and failures
    local total=$(grep -c ":" "$REPORTS_DIR/scan_status.log" 2>/dev/null || echo "0")
    local success=$(grep -c "^SUCCESS:" "$REPORTS_DIR/scan_status.log" 2>/dev/null || echo "0")
    local failed=$(grep -c "^FAILED:" "$REPORTS_DIR/scan_status.log" 2>/dev/null || echo "0")
    
    cat >> "$report_file" << EOF

- **Total Servers Scanned:** $total
- **Successful Scans:** $success
- **Failed Scans:** $failed
- **Success Rate:** $(( success * 100 / total ))%

## Scan Results by Server

EOF
    
    # Add each server's report
    for report in "$REPORTS_DIR"/*_report.md; do
        if [[ -f "$report" ]]; then
            local server_name=$(basename "$report" "_report.md")
            cat >> "$report_file" << EOF

---

### Server: $server_name

EOF
            # Extract key findings from report
            grep -A20 "## Executive Summary" "$report" >> "$report_file" 2>/dev/null || echo "Report data not available" >> "$report_file"
        fi
    done
    
    echo -e "${GREEN}✅ Consolidated report: $report_file${NC}"
}

# Main function
main() {
    local servers=""
    local filter_type="all"
    local filter_value=""
    local parallel_jobs=4
    local quick_mode=false
    local notify=false
    local consolidated=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -i|--inventory)
                INVENTORY_FILE="$2"
                shift 2
                ;;
            -s|--servers)
                filter_type="names"
                filter_value="$2"
                shift 2
                ;;
            -g|--group)
                filter_type="group"
                filter_value="$2"
                shift 2
                ;;
            -t|--tags)
                filter_type="tags"
                filter_value="$2"
                shift 2
                ;;
            -p|--parallel)
                parallel_jobs="$2"
                shift 2
                ;;
            -q|--quick)
                quick_mode=true
                shift
                ;;
            -r|--reports)
                REPORTS_DIR="$2"
                shift 2
                ;;
            -n|--notify)
                notify=true
                shift
                ;;
            -c|--consolidated)
                consolidated=true
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
    
    # Check dependencies
    check_dependencies
    
    # Create reports directory
    mkdir -p "$REPORTS_DIR"
    
    # Clear previous status log
    > "$REPORTS_DIR/scan_status.log"
    
    # Parse inventory
    echo -e "${BLUE}📋 Loading server inventory...${NC}"
    parse_inventory "$INVENTORY_FILE"
    
    # Get list of servers to scan
    mapfile -t server_list < <(get_servers "$filter_type" "$filter_value")
    
    if [[ ${#server_list[@]} -eq 0 ]]; then
        echo -e "${RED}❌ No servers found matching criteria${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Found ${#server_list[@]} server(s) to scan${NC}"
    echo ""
    
    # Display server list
    echo -e "${CYAN}Servers to scan:${NC}"
    for server in "${server_list[@]}"; do
        echo -e "  • $server"
    done
    echo ""
    
    # Start scanning
    local start_time=$(date +%s)
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  Starting Multi-Server Security Scan${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
    
    # Export function for parallel
    export -f scan_server get_server_info test_connection
    export INVENTORY_CONTENT REPORTS_DIR SCANNER_SCRIPT
    export RED GREEN YELLOW BLUE CYAN NC
    
    # Scan servers in parallel
    printf '%s\n' "${server_list[@]}" | \
        parallel -j "$parallel_jobs" --line-buffer \
        scan_server {} "$quick_mode"
    
    local end_time=$(date +%s)
    local total_duration=$((end_time - start_time))
    
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  Scan Complete${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
    
    # Summary
    local total=${#server_list[@]}
    local success=$(grep -c "^SUCCESS:" "$REPORTS_DIR/scan_status.log" 2>/dev/null || echo "0")
    local failed=$(grep -c "^FAILED:" "$REPORTS_DIR/scan_status.log" 2>/dev/null || echo "0")
    
    echo -e "${BLUE}📊 Scan Summary:${NC}"
    echo -e "  Total servers: $total"
    echo -e "  ${GREEN}Successful: $success${NC}"
    [[ $failed -gt 0 ]] && echo -e "  ${RED}Failed: $failed${NC}"
    echo -e "  Duration: ${total_duration}s"
    echo -e "  Reports: $REPORTS_DIR"
    echo ""
    
    # Generate consolidated report
    if [[ "$consolidated" == "true" ]]; then
        generate_consolidated_report
    fi
    
    # Send notification
    if [[ "$notify" == "true" ]] && [[ -f "$SCRIPT_DIR/../integrations/notify.sh" ]]; then
        local severity="success"
        [[ $failed -gt 0 ]] && severity="warning"
        
        "$SCRIPT_DIR/../integrations/notify.sh" \
            --platform all \
            --title "Multi-Server Scan Complete" \
            --message "Scanned $total servers: $success successful, $failed failed (${total_duration}s)" \
            --severity "$severity" || true
    fi
    
    echo -e "${GREEN}✅ All done!${NC}"
}

# Run main
main "$@"
