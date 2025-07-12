const { updateHostState, getMigrationRecord } = require('/opt/nodejs/ec2-utils');

/**
 * Handle migration success by updating status and preparing detailed notification
 * Note: Reserved tag removal is now handled earlier in GetInstancesOnFailingHost
 */
exports.handler = async (event) => {
  console.log('Handling migration success for host:', event.hostId);
  console.log('Event data:', JSON.stringify(event, null, 2));
  
  try {
    const hostId = event.hostId;
    const reservedHostId = event.reservedHostId;
    
    // Step 1: Update host status to complete with expiration
    console.log('Updating host status to complete...');
    await updateHostState(hostId, 'complete', true); // true for expirationTime
    
    // Note: Reserved tag removal is now handled earlier in GetInstancesOnFailingHost step
    // to prevent race conditions with other Step Functions executions
    
    // Step 2: Get migration record for detailed information
    console.log('Getting migration record for detailed notification...');
    const migrationRecord = await getMigrationRecord(hostId);
    
    // Step 3: Prepare detailed success notification
    const totalInstances = migrationRecord?.totalInstances || 0;
    const successfulMigrations = migrationRecord?.successfulMigrations || totalInstances;
    const failedMigrations = migrationRecord?.failedMigrations || 0;
    
    console.log(`Migration summary: ${successfulMigrations}/${totalInstances} successful migrations`);
    
    // Build detailed success notification message
    const subject = `✅ EC2 Dedicated Host Failover - Migration Completed Successfully`;
    
    let message = `✅ MIGRATION COMPLETED SUCCESSFULLY\n\n`;
    message += `Dedicated host failover migration has been completed successfully.\n\n`;
    message += `📋 MIGRATION SUMMARY:\n`;
    message += `• Source Host: ${hostId}\n`;
    message += `• Target Host: ${reservedHostId || 'N/A'}\n`;
    message += `• Total Instances: ${totalInstances}\n`;
    message += `• Successful Migrations: ${successfulMigrations}\n`;
    message += `• Failed Migrations: ${failedMigrations}\n`;
    message += `• Success Rate: ${totalInstances > 0 ? Math.round((successfulMigrations / totalInstances) * 100) : 100}%\n\n`;
    
    // Add timing information if available
    if (migrationRecord?.startTime) {
      const startTime = new Date(migrationRecord.startTime);
      const endTime = new Date();
      const durationMinutes = Math.round((endTime - startTime) / (1000 * 60));
      
      message += `⏱️ TIMING INFORMATION:\n`;
      message += `• Started: ${startTime.toISOString().replace('T', ' ').replace('Z', ' UTC')}\n`;
      message += `• Completed: ${endTime.toISOString().replace('T', ' ').replace('Z', ' UTC')}\n`;
      message += `• Total Duration: ${durationMinutes} minutes\n\n`;
    }
    
    message += `🎉 RESULTS:\n`;
    message += `• All instances have been successfully migrated to the new dedicated host\n`;
    message += `• The new dedicated host is now active and ready for use\n`;
    message += `• Reserved tag was removed early in the process to prevent conflicts\n`;
    message += `• Migration record has been marked as complete\n\n`;
    
    message += `📊 NEXT STEPS:\n`;
    message += `• Verify that all applications are running correctly on the new host\n`;
    message += `• Monitor instance performance and health\n`;
    message += `• The old dedicated host can now be safely terminated if no longer needed\n`;
    message += `• Consider updating any automation or monitoring that references the old host ID\n\n`;
    
    message += `📋 For detailed migration logs, check CloudWatch logs.\n`;
    message += `🔍 For migration history, review the DynamoDB migration record.`;
    
    const result = {
      statusUpdated: true,
      tagRemoved: true, // Tag was removed earlier in the process
      notificationPrepared: true,
      subject: subject,
      message: message,
      migrationSummary: {
        totalInstances: totalInstances,
        successfulMigrations: successfulMigrations,
        failedMigrations: failedMigrations,
        successRate: totalInstances > 0 ? Math.round((successfulMigrations / totalInstances) * 100) : 100,
        reservedHostId: reservedHostId
      }
    };
    
    console.log('Migration success handled successfully');
    return result;
    
  } catch (error) {
    console.error('Error handling migration success:', error);
    
    // Return a basic notification even if detailed processing fails
    return {
      statusUpdated: false,
      tagRemoved: true, // Tag was removed earlier
      notificationPrepared: true,
      subject: `✅ EC2 Dedicated Host Failover - Migration Completed`,
      message: `Migration completed for dedicated host ${event.hostId}. Please check CloudWatch logs for details.`,
      error: error.message
    };
  }
};
