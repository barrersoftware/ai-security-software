#!/usr/bin/env node
/**
 * AI Security Scanner - Production Setup Script
 * 
 * This script:
 * 1. Cleans the database (removes test data)
 * 2. Creates admin user with secure password
 * 3. Sets up initial configuration
 * 4. Enables authentication
 * 5. Configures security settings
 */

const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const readline = require('readline');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'data', 'system.db');
const ENV_PATH = path.join(__dirname, '.env');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(prompt) {
    return new Promise((resolve) => {
        rl.question(prompt, resolve);
    });
}

function hiddenQuestion(prompt) {
    return new Promise((resolve) => {
        const stdin = process.stdin;
        const stdout = process.stdout;
        
        stdout.write(prompt);
        stdin.setRawMode(true);
        stdin.resume();
        stdin.setEncoding('utf8');
        
        let password = '';
        
        stdin.on('data', function(char) {
            char = char.toString('utf8');
            
            if (char === '\n' || char === '\r' || char === '\u0004') {
                stdin.setRawMode(false);
                stdin.pause();
                stdout.write('\n');
                resolve(password);
            } else if (char === '\u0003') {
                process.exit();
            } else if (char === '\u007f' || char === '\b') {
                if (password.length > 0) {
                    password = password.slice(0, -1);
                    stdout.write('\b \b');
                }
            } else {
                password += char;
                stdout.write('*');
            }
        });
    });
}

async function cleanDatabase(db) {
    console.log('\n📦 Cleaning database...');
    
    const tables = [
        'users',
        'audit_logs',
        'security_alerts',
        'notification_history',
        'webhook_deliveries',
        'rate_limit_violations',
        'multi_server_scans',
        'server_scan_results',
        'blocked_ips'
    ];
    
    for (const table of tables) {
        await new Promise((resolve, reject) => {
            db.run(`DELETE FROM ${table}`, (err) => {
                if (err) {
                    console.log(`   ⚠️  ${table}: ${err.message}`);
                } else {
                    console.log(`   ✅ ${table} cleaned`);
                }
                resolve();
            });
        });
    }
    
    console.log('✅ Database cleaned successfully\n');
}

async function createAdminUser(db, username, email, password) {
    console.log('👤 Creating admin user...');
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO users (username, email, password, role, status, created) 
             VALUES (?, ?, ?, 'admin', 'active', datetime('now'))`,
            [username, email, hashedPassword],
            function(err) {
                if (err) {
                    reject(err);
                } else {
                    console.log(`✅ Admin user created: ${username}`);
                    console.log(`   Email: ${email}`);
                    console.log(`   Role: admin\n`);
                    resolve(this.lastID);
                }
            }
        );
    });
}

async function updateEnvFile(config) {
    console.log('⚙️  Updating environment configuration...');
    
    let envContent = '';
    
    if (fs.existsSync(ENV_PATH)) {
        envContent = fs.readFileSync(ENV_PATH, 'utf8');
    }
    
    // Update or add configurations
    const updates = {
        'NODE_ENV': 'production',
        'AUTH_ENABLED': 'true',
        'SESSION_SECRET': generateSecret(),
        'JWT_SECRET': generateSecret(),
        'RATE_LIMIT_ENABLED': 'true',
        'AUDIT_LOGGING_ENABLED': 'true'
    };
    
    for (const [key, value] of Object.entries(updates)) {
        const regex = new RegExp(`^${key}=.*$`, 'm');
        if (regex.test(envContent)) {
            envContent = envContent.replace(regex, `${key}=${value}`);
        } else {
            envContent += `\n${key}=${value}`;
        }
    }
    
    fs.writeFileSync(ENV_PATH, envContent.trim() + '\n');
    console.log('✅ Environment configured\n');
}

function generateSecret() {
    return require('crypto').randomBytes(32).toString('hex');
}

async function setupComplete() {
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║           🎉 PRODUCTION SETUP COMPLETE! 🎉            ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('✅ Database cleaned');
    console.log('✅ Admin user created');
    console.log('✅ Environment configured');
    console.log('✅ Authentication enabled');
    console.log('✅ Security features active');
    console.log('');
    console.log('📝 Next Steps:');
    console.log('   1. Restart the server: pm2 restart ai-scanner');
    console.log('   2. Visit: http://s1.pepperbacks.xyz:8081/login.html');
    console.log('   3. Login with your admin credentials');
    console.log('   4. Change your password after first login');
    console.log('');
    console.log('🔐 Security Recommendations:');
    console.log('   - Enable HTTPS/SSL');
    console.log('   - Configure backup schedules');
    console.log('   - Set up monitoring alerts');
    console.log('   - Review security policies');
    console.log('');
}

async function main() {
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║      AI Security Scanner - Production Setup           ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('This script will:');
    console.log('  1. Clean all test data from database');
    console.log('  2. Create your admin user account');
    console.log('  3. Configure production settings');
    console.log('  4. Enable authentication and security');
    console.log('');
    
    const confirm = await question('Continue with production setup? (yes/no): ');
    if (confirm.toLowerCase() !== 'yes') {
        console.log('Setup cancelled.');
        rl.close();
        return;
    }
    
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('  ADMIN USER SETUP');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
    
    const username = await question('Admin username: ');
    const email = await question('Admin email: ');
    const password = await hiddenQuestion('Admin password: ');
    const passwordConfirm = await hiddenQuestion('Confirm password: ');
    
    if (password !== passwordConfirm) {
        console.log('\n❌ Passwords do not match!');
        rl.close();
        return;
    }
    
    if (password.length < 8) {
        console.log('\n❌ Password must be at least 8 characters!');
        rl.close();
        return;
    }
    
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('  SETTING UP PRODUCTION ENVIRONMENT');
    console.log('═══════════════════════════════════════════════════════');
    
    const db = new sqlite3.Database(DB_PATH);
    
    try {
        // 1. Clean database
        await cleanDatabase(db);
        
        // 2. Create admin user
        await createAdminUser(db, username, email, password);
        
        // 3. Update environment
        await updateEnvFile({
            NODE_ENV: 'production',
            AUTH_ENABLED: 'true'
        });
        
        // 4. Setup complete
        await setupComplete();
        
    } catch (error) {
        console.error('\n❌ Setup failed:', error.message);
        process.exit(1);
    } finally {
        db.close();
        rl.close();
    }
}

// Run setup
main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
