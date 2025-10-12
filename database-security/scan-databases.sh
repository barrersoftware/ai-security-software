#!/bin/bash

###################################################
# AI Security Scanner - Database Security Audit
# Scan MySQL, PostgreSQL, MongoDB, Redis
###################################################

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_REMATCH[0]}")" && pwd)"
REPORT_FILE="$HOME/security-reports/database_security_$(date +%Y%m%d_%H%M%S).md"
TEMP_DIR="/tmp/db-security-scan-$$"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Scan database security configurations

OPTIONS:
    --mysql         Scan MySQL/MariaDB
    --postgresql    Scan PostgreSQL
    --mongodb       Scan MongoDB
    --redis         Scan Redis
    --all           Scan all detected databases
    -h, --help      Show this help

EXAMPLES:
    # Scan all databases
    $0 --all
    
    # Scan specific database
    $0 --mysql
    
    # Scan multiple databases
    $0 --mysql --postgresql

EOF
    exit 0
}

# Initialize report
init_report() {
    mkdir -p "$(dirname "$REPORT_FILE")"
    mkdir -p "$TEMP_DIR"
    
    cat > "$REPORT_FILE" << EOF
# Database Security Analysis Report
Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
Hostname: $(hostname)

## Table of Contents
- [MySQL/MariaDB](#mysqlmariadb)
- [PostgreSQL](#postgresql)
- [MongoDB](#mongodb)
- [Redis](#redis)
- [Recommendations](#recommendations)

---

EOF
}

# Scan MySQL
scan_mysql() {
    echo -e "${BLUE}🔍 Scanning MySQL/MariaDB...${NC}"
    
    cat >> "$REPORT_FILE" << EOF
## MySQL/MariaDB

EOF
    
    # Check if MySQL is running
    if ! pgrep -x mysqld &>/dev/null && ! pgrep -x mariadbd &>/dev/null; then
        echo "- ℹ️  MySQL/MariaDB not running" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
        return
    fi
    
    echo "### Connection Security" >> "$REPORT_FILE"
    
    # Check bind address
    local bind_addr=$(grep "^bind-address" /etc/mysql/my.cnf /etc/mysql/mysql.conf.d/*.cnf 2>/dev/null | head -1 | awk -F'=' '{print $2}' | tr -d ' ')
    
    if [[ -z "$bind_addr" ]] || [[ "$bind_addr" == "0.0.0.0" ]]; then
        echo "- 🚨 **CRITICAL:** MySQL bound to all interfaces (0.0.0.0)" >> "$REPORT_FILE"
    elif [[ "$bind_addr" == "127.0.0.1" ]] || [[ "$bind_addr" == "localhost" ]]; then
        echo "- ✅ MySQL bound to localhost only" >> "$REPORT_FILE"
    else
        echo "- ℹ️  MySQL bound to: $bind_addr" >> "$REPORT_FILE"
    fi
    
    # Check for public exposure
    if netstat -tuln 2>/dev/null | grep ":3306" | grep -q "0.0.0.0"; then
        echo "- 🚨 **CRITICAL:** MySQL port 3306 exposed to internet" >> "$REPORT_FILE"
    fi
    
    echo "" >> "$REPORT_FILE"
    echo "### Authentication & Users" >> "$REPORT_FILE"
    
    # Try to connect and check
    if command -v mysql &>/dev/null; then
        # Check for anonymous users (requires auth)
        echo "- ℹ️  User audit requires database credentials" >> "$REPORT_FILE"
        echo "  Run: \`mysql -e \"SELECT user,host FROM mysql.user WHERE user='';\"\`" >> "$REPORT_FILE"
    fi
    
    echo "" >> "$REPORT_FILE"
    echo "### SSL/TLS Configuration" >> "$REPORT_FILE"
    
    if grep -q "ssl-ca" /etc/mysql/my.cnf /etc/mysql/mysql.conf.d/*.cnf 2>/dev/null; then
        echo "- ✅ SSL configuration found" >> "$REPORT_FILE"
    else
        echo "- ⚠️  No SSL configuration detected" >> "$REPORT_FILE"
    fi
    
    echo "" >> "$REPORT_FILE"
}

# Scan PostgreSQL
scan_postgresql() {
    echo -e "${BLUE}🔍 Scanning PostgreSQL...${NC}"
    
    cat >> "$REPORT_FILE" << EOF
## PostgreSQL

EOF
    
    # Check if PostgreSQL is running
    if ! pgrep -x postgres &>/dev/null; then
        echo "- ℹ️  PostgreSQL not running" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
        return
    fi
    
    echo "### Connection Security" >> "$REPORT_FILE"
    
    # Check listen addresses
    local pg_conf=$(find /etc/postgresql -name postgresql.conf 2>/dev/null | head -1)
    if [[ -n "$pg_conf" ]]; then
        local listen_addr=$(grep "^listen_addresses" "$pg_conf" 2>/dev/null | awk -F'=' '{print $2}' | tr -d ' ' | tr -d "'")
        
        if [[ "$listen_addr" == "*" ]] || [[ "$listen_addr" == "0.0.0.0" ]]; then
            echo "- 🚨 **CRITICAL:** PostgreSQL listening on all interfaces" >> "$REPORT_FILE"
        elif [[ "$listen_addr" == "localhost" ]] || [[ "$listen_addr" == "127.0.0.1" ]]; then
            echo "- ✅ PostgreSQL listening on localhost only" >> "$REPORT_FILE"
        else
            echo "- ℹ️  PostgreSQL listening on: $listen_addr" >> "$REPORT_FILE"
        fi
    fi
    
    # Check for public exposure
    if netstat -tuln 2>/dev/null | grep ":5432" | grep -q "0.0.0.0"; then
        echo "- 🚨 **CRITICAL:** PostgreSQL port 5432 exposed to internet" >> "$REPORT_FILE"
    fi
    
    echo "" >> "$REPORT_FILE"
    echo "### Authentication Methods" >> "$REPORT_FILE"
    
    local pg_hba=$(find /etc/postgresql -name pg_hba.conf 2>/dev/null | head -1)
    if [[ -n "$pg_hba" ]]; then
        if grep -v "^#" "$pg_hba" | grep -q "trust"; then
            echo "- 🚨 **CRITICAL:** 'trust' authentication method found (no password required)" >> "$REPORT_FILE"
        else
            echo "- ✅ No 'trust' authentication methods" >> "$REPORT_FILE"
        fi
        
        if grep -v "^#" "$pg_hba" | grep -q "md5"; then
            echo "- ⚠️  MD5 authentication in use (consider upgrading to scram-sha-256)" >> "$REPORT_FILE"
        fi
    fi
    
    echo "" >> "$REPORT_FILE"
    echo "### SSL Configuration" >> "$REPORT_FILE"
    
    if [[ -n "$pg_conf" ]] && grep -q "^ssl = on" "$pg_conf" 2>/dev/null; then
        echo "- ✅ SSL enabled" >> "$REPORT_FILE"
    else
        echo "- ⚠️  SSL not enabled" >> "$REPORT_FILE"
    fi
    
    echo "" >> "$REPORT_FILE"
}

# Scan MongoDB
scan_mongodb() {
    echo -e "${BLUE}🔍 Scanning MongoDB...${NC}"
    
    cat >> "$REPORT_FILE" << EOF
## MongoDB

EOF
    
    # Check if MongoDB is running
    if ! pgrep -x mongod &>/dev/null; then
        echo "- ℹ️  MongoDB not running" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
        return
    fi
    
    echo "### Connection Security" >> "$REPORT_FILE"
    
    # Check bind IP
    local mongo_conf="/etc/mongod.conf"
    if [[ -f "$mongo_conf" ]]; then
        local bind_ip=$(grep "bindIp:" "$mongo_conf" 2>/dev/null | awk '{print $2}')
        
        if [[ "$bind_ip" == "0.0.0.0" ]] || [[ -z "$bind_ip" ]]; then
            echo "- 🚨 **CRITICAL:** MongoDB bound to all interfaces" >> "$REPORT_FILE"
        elif [[ "$bind_ip" == "127.0.0.1" ]] || [[ "$bind_ip" == "localhost" ]]; then
            echo "- ✅ MongoDB bound to localhost only" >> "$REPORT_FILE"
        else
            echo "- ℹ️  MongoDB bound to: $bind_ip" >> "$REPORT_FILE"
        fi
    fi
    
    # Check for public exposure
    if netstat -tuln 2>/dev/null | grep ":27017" | grep -q "0.0.0.0"; then
        echo "- 🚨 **CRITICAL:** MongoDB port 27017 exposed to internet" >> "$REPORT_FILE"
    fi
    
    echo "" >> "$REPORT_FILE"
    echo "### Authentication" >> "$REPORT_FILE"
    
    if [[ -f "$mongo_conf" ]]; then
        if grep -q "authorization: enabled" "$mongo_conf" 2>/dev/null; then
            echo "- ✅ Authentication enabled" >> "$REPORT_FILE"
        else
            echo "- 🚨 **CRITICAL:** Authentication not enabled" >> "$REPORT_FILE"
        fi
    fi
    
    echo "" >> "$REPORT_FILE"
    echo "### Encryption" >> "$REPORT_FILE"
    
    if [[ -f "$mongo_conf" ]] && grep -q "enableEncryption: true" "$mongo_conf" 2>/dev/null; then
        echo "- ✅ Encryption at rest enabled" >> "$REPORT_FILE"
    else
        echo "- ⚠️  Encryption at rest not configured" >> "$REPORT_FILE"
    fi
    
    echo "" >> "$REPORT_FILE"
}

# Scan Redis
scan_redis() {
    echo -e "${BLUE}🔍 Scanning Redis...${NC}"
    
    cat >> "$REPORT_FILE" << EOF
## Redis

EOF
    
    # Check if Redis is running
    if ! pgrep -x redis-server &>/dev/null; then
        echo "- ℹ️  Redis not running" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
        return
    fi
    
    echo "### Connection Security" >> "$REPORT_FILE"
    
    # Check bind address
    local redis_conf="/etc/redis/redis.conf"
    if [[ -f "$redis_conf" ]]; then
        local bind_addr=$(grep "^bind " "$redis_conf" 2>/dev/null | awk '{print $2}')
        
        if [[ -z "$bind_addr" ]] || [[ "$bind_addr" == "0.0.0.0" ]]; then
            echo "- 🚨 **CRITICAL:** Redis bound to all interfaces" >> "$REPORT_FILE"
        elif [[ "$bind_addr" == "127.0.0.1" ]] || [[ "$bind_addr" == "localhost" ]]; then
            echo "- ✅ Redis bound to localhost only" >> "$REPORT_FILE"
        else
            echo "- ℹ️  Redis bound to: $bind_addr" >> "$REPORT_FILE"
        fi
    fi
    
    # Check for public exposure
    if netstat -tuln 2>/dev/null | grep ":6379" | grep -q "0.0.0.0"; then
        echo "- 🚨 **CRITICAL:** Redis port 6379 exposed to internet" >> "$REPORT_FILE"
    fi
    
    echo "" >> "$REPORT_FILE"
    echo "### Authentication" >> "$REPORT_FILE"
    
    if [[ -f "$redis_conf" ]]; then
        if grep -q "^requirepass" "$redis_conf" 2>/dev/null; then
            echo "- ✅ Password authentication configured" >> "$REPORT_FILE"
        else
            echo "- 🚨 **CRITICAL:** No password authentication (requirepass not set)" >> "$REPORT_FILE"
        fi
        
        # Check for renamed dangerous commands
        if grep -q "^rename-command" "$redis_conf" 2>/dev/null; then
            echo "- ✅ Dangerous commands renamed" >> "$REPORT_FILE"
        else
            echo "- ⚠️  Consider renaming dangerous commands (FLUSHDB, FLUSHALL, CONFIG, etc.)" >> "$REPORT_FILE"
        fi
    fi
    
    echo "" >> "$REPORT_FILE"
}

# AI Analysis
ai_analysis() {
    if ! command -v ollama &>/dev/null; then
        echo -e "${YELLOW}⚠️  Skipping AI analysis - Ollama not available${NC}"
        return
    fi
    
    echo -e "${BLUE}🤖 Running AI security analysis...${NC}"
    
    cat >> "$REPORT_FILE" << EOF
## AI Security Analysis

EOF
    
    local analysis_input=$(cat "$REPORT_FILE")
    
    local ai_response=$(ollama run llama3.1:8b "You are a database security expert. Analyze this database security audit report and provide:
1. Top 3 critical security issues
2. Data protection concerns
3. Recommended remediation steps
4. Security score (1-10)

Report:
$analysis_input

Provide a concise analysis." 2>/dev/null | head -100)
    
    echo "$ai_response" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
}

# Generate recommendations
generate_recommendations() {
    cat >> "$REPORT_FILE" << EOF

## Recommendations

### High Priority - Fix Immediately
1. Bind all databases to localhost or private network only
2. Enable authentication on all databases
3. Close public access to database ports
4. Use strong passwords for all database users
5. Enable SSL/TLS for all database connections

### Medium Priority - Fix Within 7 Days
1. Configure firewall rules to restrict database access
2. Implement encryption at rest
3. Regular backup verification
4. Enable audit logging
5. Remove default/test databases and users

### Best Practices
1. Use separate database users per application
2. Implement principle of least privilege
3. Regular security updates and patches
4. Monitor failed authentication attempts
5. Use connection pooling with proper limits

### Database-Specific Recommendations

**MySQL/MariaDB:**
- Use mysql_secure_installation
- Remove anonymous users
- Disable remote root login
- Use SSL for connections

**PostgreSQL:**
- Use scram-sha-256 instead of md5
- Configure pg_hba.conf restrictively
- Enable SSL with valid certificates
- Regular VACUUM and analyze

**MongoDB:**
- Enable authorization
- Use role-based access control
- Enable audit logging
- Implement encryption at rest

**Redis:**
- Set requirepass
- Rename dangerous commands
- Use Redis ACLs (Redis 6+)
- Enable TLS

---

**Report generated by AI Security Scanner**
EOF
}

# Main function
main() {
    local scan_mysql=false
    local scan_postgresql=false
    local scan_mongodb=false
    local scan_redis=false
    local scan_all=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --mysql)
                scan_mysql=true
                shift
                ;;
            --postgresql)
                scan_postgresql=true
                shift
                ;;
            --mongodb)
                scan_mongodb=true
                shift
                ;;
            --redis)
                scan_redis=true
                shift
                ;;
            --all)
                scan_all=true
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
    
    # If --all, enable all scans
    if [[ "$scan_all" == "true" ]]; then
        scan_mysql=true
        scan_postgresql=true
        scan_mongodb=true
        scan_redis=true
    fi
    
    # If no scans selected, scan all
    if [[ "$scan_mysql" == "false" ]] && [[ "$scan_postgresql" == "false" ]] && \
       [[ "$scan_mongodb" == "false" ]] && [[ "$scan_redis" == "false" ]]; then
        scan_all=true
        scan_mysql=true
        scan_postgresql=true
        scan_mongodb=true
        scan_redis=true
    fi
    
    echo -e "${GREEN}🛡️  Database Security Scanner${NC}\n"
    echo -e "${BLUE}Starting database security audit...${NC}\n"
    
    # Initialize
    init_report
    
    # Run scans
    [[ "$scan_mysql" == "true" ]] && scan_mysql
    [[ "$scan_postgresql" == "true" ]] && scan_postgresql
    [[ "$scan_mongodb" == "true" ]] && scan_mongodb
    [[ "$scan_redis" == "true" ]] && scan_redis
    
    # AI analysis
    ai_analysis
    
    # Recommendations
    generate_recommendations
    
    # Cleanup
    rm -rf "$TEMP_DIR"
    
    echo ""
    echo -e "${GREEN}✅ Database security audit complete!${NC}"
    echo -e "${BLUE}📄 Report: $REPORT_FILE${NC}\n"
    
    # Display summary
    echo -e "${CYAN}Summary:${NC}"
    grep -E "^- \*\*|^- 🚨|^- ⚠️|^- ✅" "$REPORT_FILE" | head -20
}

# Run
main "$@"
