const { updateHostState } = require('/opt/nodejs/ec2-utils');

/**
 * Handle the case where no instances are found on the failing host
 * Updates status to complete and prepares notification
 */
exports.handler = async (event) => {
  console.log('Handling no instances scenario for host:', event.hostId);
  console.log('Event data:', JSON.stringify(event, null, 2));
  
  try {
    const hostId = event.hostId;
    
    // Step 1: Update host status to complete since there's nothing to migrate
    console.log('Updating host status to complete (no instances to migrate)...');
    await updateHostState(hostId, 'complete');
    
    // Step 2: Prepare detailed notification message
    console.log('Preparing no instances notification...');
    
    const subject = `ℹ️ EC2 Dedicated Host Failover - No Instances to Migrate`;
    
    let message = `ℹ️ NO INSTANCES TO MIGRATE\n\n`;
    message += `Dedicated host failover was initiated, but no instances were found on the source host.\n\n`;
    message += `📋 DETAILS:\n`;
    message += `• Source Host: ${hostId}\n`;
    message += `• Instances Found: 0\n`;
    message += `• Migration Status: Completed (Nothing to migrate)\n`;
    message += `• Timestamp: ${new Date().toISOString().replace('T', ' ').replace('Z', ' UTC')}\n\n`;
    
    message += `✅ RESULT:\n`;
    message += `• No instances required migration\n`;
    message += `• Host status updated to complete\n`;
    message += `• Failover process completed successfully\n\n`;
    
    message += `🔍 POSSIBLE REASONS:\n`;
    message += `• Host was empty (no instances were running)\n`;
    message += `• Instances were terminated before failover triggered\n`;
    message += `• Instances were manually migrated to another host\n`;
    message += `• Host was used for testing and is now unused\n\n`;
    
    message += `📊 RECOMMENDED ACTIONS:\n`;
    message += `• Verify the dedicated host is no longer needed\n`;
    message += `• Consider terminating unused dedicated hosts to save costs\n`;
    message += `• Review monitoring alerts to prevent false alarms\n`;
    message += `• Check if the host should be removed from monitoring\n\n`;
    
    message += `📋 This completes the failover process with no further action required.`;
    
    const result = {
      statusUpdated: true,
      notificationPrepared: true,
      subject: subject,
      message: message,
      migrationSummary: {
        totalInstances: 0,
        successfulMigrations: 0,
        failedMigrations: 0,
        successRate: 100, // 100% success since there was nothing to fail
        reason: 'no_instances_found'
      }
    };
    
    console.log('No instances scenario handled successfully');
    return result;
    
  } catch (error) {
    console.error('Error handling no instances scenario:', error);
    
    // Return a basic notification even if detailed processing fails
    return {
      statusUpdated: false,
      notificationPrepared: true,
      subject: `ℹ️ EC2 Dedicated Host Failover - No Instances Found`,
      message: `No instances found on dedicated host ${event.hostId}. Migration completed with no instances to migrate.`,
      error: error.message
    };
  }
};
