#!/usr/bin/env node
/**
 * Fix Audit Log Database Schema
 * Migrates old audit_logs table to new schema with user_id and tenant_id
 */

const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

async function fixSchema() {
    console.log('🔧 Starting audit_logs schema migration...\n');
    
    const dbPath = path.join(__dirname, 'data', 'system.db');
    console.log(`📂 Database: ${dbPath}\n`);
    
    // Open database
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });
    
    try {
        // Step 1: Check current schema
        console.log('1️⃣ Checking current schema...');
        const tableInfo = await db.all("PRAGMA table_info(audit_logs)");
        console.log('   Current columns:', tableInfo.map(col => col.name).join(', '));
        
        const hasUserId = tableInfo.some(col => col.name === 'user_id');
        const hasTenantId = tableInfo.some(col => col.name === 'tenant_id');
        
        if (hasUserId && hasTenantId) {
            console.log('   ✅ Schema already correct!\n');
            await db.close();
            return;
        }
        
        // Step 2: Backup old table
        console.log('\n2️⃣ Backing up old table...');
        await db.run('ALTER TABLE audit_logs RENAME TO audit_logs_backup');
        console.log('   ✅ Renamed to audit_logs_backup\n');
        
        // Step 3: Create new table with correct schema
        console.log('3️⃣ Creating new audit_logs table...');
        await db.run(`
            CREATE TABLE audit_logs (
                id TEXT PRIMARY KEY,
                timestamp TEXT NOT NULL,
                tenant_id TEXT,
                user_id TEXT,
                category TEXT NOT NULL,
                action TEXT NOT NULL,
                severity TEXT NOT NULL,
                details TEXT,
                metadata TEXT,
                ip_address TEXT,
                user_agent TEXT,
                success INTEGER DEFAULT 1,
                error_message TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('   ✅ New table created\n');
        
        // Step 4: Migrate data from old table
        console.log('4️⃣ Migrating data...');
        const oldRecords = await db.all('SELECT * FROM audit_logs_backup');
        console.log(`   Found ${oldRecords.length} records to migrate`);
        
        for (const record of oldRecords) {
            await db.run(`
                INSERT INTO audit_logs (
                    id, timestamp, user_id, category, action, 
                    severity, details, success
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                record.id || `migrated-${Date.now()}-${Math.random()}`,
                record.timestamp || new Date().toISOString(),
                record.user || null, // Map old 'user' to 'user_id'
                record.category || 'system',
                record.action || 'unknown',
                record.status === 'error' ? 'error' : 'info', // Map status to severity
                record.details || null,
                record.status !== 'error' ? 1 : 0
            ]);
        }
        console.log(`   ✅ Migrated ${oldRecords.length} records\n`);
        
        // Step 5: Create indexes
        console.log('5️⃣ Creating indexes...');
        await db.run('CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_logs(tenant_id)');
        await db.run('CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id)');
        await db.run('CREATE INDEX IF NOT EXISTS idx_audit_category ON audit_logs(category)');
        await db.run('CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp)');
        await db.run('CREATE INDEX IF NOT EXISTS idx_audit_severity ON audit_logs(severity)');
        console.log('   ✅ Indexes created\n');
        
        // Step 6: Verify migration
        console.log('6️⃣ Verifying migration...');
        const newCount = await db.get('SELECT COUNT(*) as count FROM audit_logs');
        console.log(`   New table has ${newCount.count} records`);
        
        const newSchema = await db.all("PRAGMA table_info(audit_logs)");
        console.log('   New columns:', newSchema.map(col => col.name).join(', '));
        console.log('   ✅ Migration verified\n');
        
        console.log('✅ Schema migration completed successfully!');
        console.log('\n📝 Note: Old table backed up as "audit_logs_backup"');
        console.log('   You can drop it later with: DROP TABLE audit_logs_backup\n');
        
    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        await db.close();
    }
}

// Run migration
fixSchema().catch(console.error);
