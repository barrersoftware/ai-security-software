#!/bin/bash
# AI Security Scanner - Simple Production Setup

echo "╔════════════════════════════════════════════════════════╗"
echo "║   AI Security Scanner - Production Setup              ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "This will:"
echo "  1. Clean the database (remove test data)"
echo "  2. Create admin user"
echo "  3. Restart the server"
echo ""
read -p "Continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Setup cancelled."
    exit 0
fi

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  ADMIN USER SETUP"
echo "═══════════════════════════════════════════════════════"
echo ""

read -p "Admin username: " USERNAME
read -p "Admin email: " EMAIL
read -sp "Admin password: " PASSWORD
echo ""
read -sp "Confirm password: " PASSWORD2
echo ""

if [ "$PASSWORD" != "$PASSWORD2" ]; then
    echo "❌ Passwords do not match!"
    exit 1
fi

if [ ${#PASSWORD} -lt 8 ]; then
    echo "❌ Password must be at least 8 characters!"
    exit 1
fi

echo ""
echo "📦 Cleaning database..."

cd /home/ubuntu/ai-security-scanner/web-ui

# Clean database tables
sqlite3 data/system.db << SQLEND
DELETE FROM users;
DELETE FROM audit_logs;
DELETE FROM security_alerts;
DELETE FROM notification_history;
DELETE FROM webhook_deliveries;
DELETE FROM rate_limit_violations;
DELETE FROM multi_server_scans;
DELETE FROM server_scan_results;
DELETE FROM blocked_ips;
SQLEND

echo "✅ Database cleaned"
echo ""

# Create admin user using Node.js for password hashing
echo "👤 Creating admin user..."

node << NODESCRIPT
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const db = new sqlite3.Database('data/system.db');

const username = '$USERNAME';
const email = '$EMAIL';
const password = '$PASSWORD';

bcrypt.hash(password, 10, (err, hash) => {
    if (err) {
        console.error('Error hashing password:', err);
        process.exit(1);
    }
    
    db.run(
        \`INSERT INTO users (username, email, password, role, status, created) 
         VALUES (?, ?, ?, 'admin', 'active', datetime('now'))\`,
        [username, email, hash],
        function(err) {
            if (err) {
                console.error('Error creating user:', err);
                process.exit(1);
            }
            console.log('✅ Admin user created:', username);
            console.log('   Email:', email);
            console.log('   Role: admin');
            db.close();
        }
    );
});
NODESCRIPT

echo ""
echo "🔄 Restarting server..."
pm2 restart ai-scanner
sleep 3

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║         🎉 PRODUCTION SETUP COMPLETE! 🎉              ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "✅ Database cleaned"
echo "✅ Admin user created: $USERNAME"
echo "✅ Server restarted"
echo ""
echo "📝 Next Steps:"
echo "   1. Visit: http://s1.pepperbacks.xyz:8081/login.html"
echo "   2. Login with: $USERNAME"
echo "   3. Explore the dashboard"
echo ""
echo "🔐 Important:"
echo "   - Keep your credentials secure"
echo "   - Consider enabling HTTPS"
echo "   - Set up backup schedules"
echo ""

