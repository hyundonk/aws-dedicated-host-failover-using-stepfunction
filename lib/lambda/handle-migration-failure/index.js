const { updateHostState, getMigrationRecord } = require('/opt/nodejs/ec2-utils');

/**
 * Handle migration failure by updating status and preparing detailed notification
 */
exports.handler = async (event) => {
  console.log('Handling migration failure for host:', event.hostId);
  console.log('Event data:', JSON.stringify(event, null, 2));
  
  try {
    // Step 1: Update host status to failed
    console.log('Updating host status to failed...');
    await updateHostState(event.hostId, 'failed');
    
    // Step 2: Get migration record for detailed information
    console.log('Getting migration record for detailed notification...');
    const migrationRecord = await getMigrationRecord(event.hostId);
    
    // Step 3: Prepare detailed failure notification
    const failedInstances = event.failedInstances || [];
    const totalInstances = migrationRecord?.totalInstances || 0;
    const successfulMigrations = totalInstances - failedInstances.length;
    
    console.log(`Migration summary: ${successfulMigrations}/${totalInstances} successful, ${failedInstances.length} failed`);
    
    // Build detailed notification message
    const subject = `🚨 EC2 Dedicated Host Failover - Migration Partially Failed`;
    
    let message = `🚨 MIGRATION PARTIALLY FAILED\n\n`;
    message += `Dedicated host failover migration has completed with some failures.\n\n`;
    message += `📋 MIGRATION SUMMARY:\n`;
    message += `• Source Host: ${event.hostId}\n`;
    message += `• Total Instances: ${totalInstances}\n`;
    message += `• Successful Migrations: ${successfulMigrations}\n`;
    message += `• Failed Migrations: ${failedInstances.length}\n`;
    message += `• Success Rate: ${totalInstances > 0 ? Math.round((successfulMigrations / totalInstances) * 100) : 0}%\n\n`;
    
    if (failedInstances.length > 0) {
      message += `❌ FAILED INSTANCES:\n`;
      failedInstances.forEach((instance, index) => {
        message += `${index + 1}. Instance: ${instance.instanceId}\n`;
        message += `   • Error: ${instance.error || 'Unknown error'}\n`;
        message += `   • Retry Count: ${instance.retryCount || 0}\n`;
        if (instance.lastError) {
          message += `   • Last Error: ${instance.lastError}\n`;
        }
        message += `\n`;
      });
    }
    
    message += `🔧 RECOMMENDED ACTIONS:\n`;
    message += `• Review failed instances and their error messages\n`;
    message += `• Check instance states and placement manually\n`;
    message += `• Consider retrying failed instances individually\n`;
    message += `• Verify target dedicated host capacity and availability\n\n`;
    
    message += `📊 For detailed migration status, check the DynamoDB migration record.\n`;
    message += `🔍 For troubleshooting, review CloudWatch logs for specific error details.`;
    
    const result = {
      statusUpdated: true,
      notificationPrepared: true,
      subject: subject,
      message: message,
      migrationSummary: {
        totalInstances: totalInstances,
        successfulMigrations: successfulMigrations,
        failedMigrations: failedInstances.length,
        successRate: totalInstances > 0 ? Math.round((successfulMigrations / totalInstances) * 100) : 0
      }
    };
    
    console.log('Migration failure handled successfully');
    return result;
    
  } catch (error) {
    console.error('Error handling migration failure:', error);
    
    // Return a basic notification even if detailed processing fails
    return {
      statusUpdated: false,
      notificationPrepared: true,
      subject: `🚨 EC2 Dedicated Host Failover - Migration Failed`,
      message: `Migration failed for dedicated host ${event.hostId}. Please check CloudWatch logs for details.`,
      error: error.message
    };
  }
};
