#!/usr/bin/env node

/**
 * Safe SQL Migration Script with Tracking
 * Ensures migrations are only applied once and tracks their status
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Migration files in order
const migrations = [
  '001_migration_tracking.sql',  // Must be first to create tracking table
  '000_cleanup.sql',
  '001_enums.sql',
  '010_core_tables.sql',
  '020_constraints.sql',
  '030_indexes.sql',
  '040_views.sql',
  '050_triggers.sql',
  '060_seed_minimal.sql',
  '070_sample_functions.sql',
  '080_critical_fixes.sql',
  '090_missing_indexes.sql',
  '095_test_migrations_table.sql',
  '100_add_invoice_assigned_to.sql',
  '110_add_validation_fields.sql',
  '111_create_validation_tables.sql',
  '112_update_invoice_statuses_simple.sql',
  '112a_update_draft_status.sql',
  '113_seed_enhanced_invoices.sql',
  '114_add_missing_line_items.sql',
  '115_add_remaining_line_items.sql',
  '116_update_match_status_and_add_exception_invoices.sql',
  '117_fixed_exception_invoices.sql',
  '120_seed_purchase_orders_and_receipts.sql',
  '121_create_match_results_for_all_po_invoices.sql',
  '122_create_more_matching_po_lines.sql',
  '123_create_missing_pos.sql',
  '091_add_electricity_vendor.sql',
  '092_update_match_function_nonpo.sql',
  '093_add_ledger_field.sql',
  '124_update_invoice_dates_2025.sql',
  '125_add_vendor_verification.sql',
  '126_add_gr_numbers_cached.sql',
  '200_add_tax_rate_percent.sql',
  '201_add_accounting_classification.sql',
  '100_add_field_confidence_tracking.sql',
  '202_add_payment_method_fields.sql',
  '203_add_vendor_payment_method.sql',
  '204_update_invoice_status_workflow.sql',
  '120_add_total_tracking_fields.sql',
  '130_fix_invoice_totals_trigger.sql',
  '205_add_approval_routing_features.sql',
  '206_add_config_agent_session_log.sql'
];

/**
 * Calculate checksum of migration file
 */
function calculateChecksum(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Create migration tracking table if it doesn't exist
 */
async function ensureMigrationTable(client) {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      checksum VARCHAR(64) NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT NOW(),
      execution_time_ms INTEGER,
      success BOOLEAN DEFAULT true,
      error_message TEXT,
      rolled_back BOOLEAN DEFAULT false,
      rolled_back_at TIMESTAMPTZ
    );
    
    -- Index for quick lookups
    CREATE INDEX IF NOT EXISTS idx_schema_migrations_filename 
    ON schema_migrations(filename);
    
    -- Index for finding failed migrations
    CREATE INDEX IF NOT EXISTS idx_schema_migrations_success 
    ON schema_migrations(success) 
    WHERE success = false;
  `;
  
  await client.query(createTableSQL);
  console.log('✅ Migration tracking table ready');
}

/**
 * Check if a migration has already been applied
 */
async function isMigrationApplied(client, filename) {
  const result = await client.query(
    'SELECT filename, checksum, success FROM schema_migrations WHERE filename = $1',
    [filename]
  );
  
  if (result.rows.length === 0) {
    return { applied: false };
  }
  
  const migration = result.rows[0];
  return {
    applied: true,
    checksum: migration.checksum,
    success: migration.success
  };
}

/**
 * Record a migration as applied
 */
async function recordMigration(client, filename, checksum, executionTime, success, error = null) {
  await client.query(
    `INSERT INTO schema_migrations (filename, checksum, execution_time_ms, success, error_message)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (filename) 
     DO UPDATE SET 
       checksum = $2,
       applied_at = NOW(),
       execution_time_ms = $3,
       success = $4,
       error_message = $5`,
    [filename, checksum, executionTime, success, error]
  );
}

/**
 * Run migrations with proper tracking
 */
async function runMigrations() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🚀 Connecting to database...');
    await client.connect();
    
    // Ensure migration tracking table exists
    await ensureMigrationTable(client);
    
    console.log('📦 Running SQL migrations...\n');
    
    let appliedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const migration of migrations) {
      const filePath = path.join(__dirname, '..', 'migrations', migration);
      
      // Skip if file doesn't exist
      if (!fs.existsSync(filePath)) {
        console.warn(`⚠️  Migration file not found: ${migration}`);
        continue;
      }
      
      // Read migration content
      const sql = fs.readFileSync(filePath, 'utf8');
      const checksum = calculateChecksum(sql);
      
      // Check if already applied
      const status = await isMigrationApplied(client, migration);
      
      if (status.applied) {
        if (status.success) {
          if (status.checksum === checksum) {
            console.log(`⏭️  ${migration} - Already applied (unchanged)`);
            skippedCount++;
          } else {
            console.warn(`⚠️  ${migration} - File changed since last apply!`);
            console.warn(`    Previous checksum: ${status.checksum.substring(0, 8)}...`);
            console.warn(`    Current checksum:  ${checksum.substring(0, 8)}...`);
            skippedCount++;
          }
        } else {
          console.log(`🔄 ${migration} - Retrying previously failed migration`);
        }
        continue;
      }
      
      console.log(`▶️  Running ${migration}...`);
      const startTime = Date.now();
      
      try {
        // Special handling for cleanup script
        if (migration === '000_cleanup.sql') {
          // Set the safety flag for development
          if (process.env.ALLOW_DESTRUCTIVE_MIGRATIONS === 'true') {
            await client.query("SET LOCAL app.allow_destructive = 'true'");
          }
        }
        
        await client.query(sql);
        const executionTime = Date.now() - startTime;
        
        await recordMigration(client, migration, checksum, executionTime, true);
        console.log(`✅ ${migration} completed (${executionTime}ms)`);
        appliedCount++;
        
      } catch (error) {
        const executionTime = Date.now() - startTime;
        errorCount++;
        
        console.error(`❌ ${migration} failed: ${error.message}`);
        await recordMigration(client, migration, checksum, executionTime, false, error.message);
        
        // Don't stop on error for idempotent migrations
        if (migration.startsWith('0') && migration !== '001_migration_tracking.sql') {
          console.log('   Continuing with next migration...');
        }
      }
    }
    
    // Summary
    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Applied: ${appliedCount}`);
    console.log(`   ⏭️  Skipped: ${skippedCount}`);
    if (errorCount > 0) {
      console.log(`   ❌ Failed: ${errorCount}`);
    }
    
    // Verify database health
    console.log('\n🏥 Verifying database health...');
    const healthCheck = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public') as tables,
        (SELECT COUNT(*) FROM information_schema.views WHERE table_schema = 'public') as views,
        (SELECT COUNT(*) FROM invoice_headers) as invoices
    `);
    
    const health = healthCheck.rows[0];
    console.log(`   Tables: ${health.tables}`);
    console.log(`   Views: ${health.views}`);
    console.log(`   Invoices: ${health.invoices}`);
    
    if (health.tables < 30) {
      console.warn('⚠️  Warning: Fewer tables than expected!');
    } else {
      console.log('✅ Database structure looks healthy!');
    }
    
  } catch (error) {
    console.error('💥 Fatal error during migration:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Migration rollback capability
async function rollbackMigration(migrationName) {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    await client.connect();
    
    // Mark migration as rolled back
    await client.query(
      `UPDATE schema_migrations 
       SET rolled_back = true, rolled_back_at = NOW() 
       WHERE filename = $1`,
      [migrationName]
    );
    
    console.log(`✅ Marked ${migrationName} as rolled back`);
    console.log('⚠️  Note: Manual database cleanup may be required');
    
  } finally {
    await client.end();
  }
}

// Check command line arguments
if (process.argv[2] === '--rollback' && process.argv[3]) {
  rollbackMigration(process.argv[3]).catch(error => {
    console.error('Rollback failed:', error);
    process.exit(1);
  });
} else if (require.main === module) {
  runMigrations().catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
}

module.exports = { runMigrations, rollbackMigration };