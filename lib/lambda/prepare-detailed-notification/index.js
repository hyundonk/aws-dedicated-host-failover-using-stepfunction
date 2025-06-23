const { getMigrationRecord } = require('/opt/nodejs/ec2-utils');

/**
 * Prepare detailed notification message with instance migration details
 */
exports.handler = async (event) => {
  console.log('Preparing detailed notification for host:', event.hostId);
  
  try {
    // Get the complete migration record
    const migrationRecord = await getMigrationRecord(event.hostId);
    
    if (!migrationRecord) {
      throw new Error(`Migration record not found for host ${event.hostId}`);
    }
    
    const {
      HostId: hostId,
      State: state,
      ReservedHostId: reservedHostId,
      TotalInstances: totalInstances = 0,
      SuccessfulMigrations: successfulMigrations = 0,
      FailedMigrations: failedMigrations = 0,
      InstanceMigrations: instanceMigrations = {}
    } = migrationRecord;
    
    // Determine notification type
    const notificationType = event.notificationType || 'success';
    
    // Check for custom message override
    if (event.customMessage) {
      return {
        subject: getSubjectForType(notificationType),
        message: event.customMessage,
        hostId,
        reservedHostId
      };
    }
    
    let subject, message;
    
    if (notificationType === 'success') {
      subject = 'EC2 Dedicated Host Failover - Migration Successful';
      message = buildSuccessMessage(hostId, reservedHostId, totalInstances, successfulMigrations, failedMigrations, instanceMigrations);
    } else if (notificationType === 'failure') {
      subject = 'EC2 Dedicated Host Failover - Migration Failed';
      message = event.errorMessage || buildFailureMessage(hostId, reservedHostId, totalInstances, successfulMigrations, failedMigrations, instanceMigrations, event.failedInstances);
    } else if (notificationType === 'partial') {
      subject = 'EC2 Dedicated Host Failover - Migration Partially Failed';
      message = buildPartialFailureMessage(hostId, reservedHostId, totalInstances, successfulMigrations, failedMigrations, instanceMigrations, event.failedInstances);
    } else {
      subject = 'EC2 Dedicated Host Failover - Status Update';
      message = buildGenericMessage(hostId, reservedHostId, totalInstances, successfulMigrations, failedMigrations, instanceMigrations);
    }
    
    return {
      subject,
      message,
      hostId,
      reservedHostId,
      migrationSummary: {
        totalInstances,
        successfulMigrations,
        failedMigrations,
        progressPercentage: totalInstances > 0 ? Math.round(((successfulMigrations + failedMigrations) / totalInstances) * 100) : 0
      }
    };
    
  } catch (error) {
    console.error('Error preparing detailed notification:', error);
    
    // Fallback to basic notification
    return {
      subject: 'EC2 Dedicated Host Failover - Status Update',
      message: `Migration status update for dedicated host ${event.hostId}. Please check the AWS console for detailed information.`,
      hostId: event.hostId,
      error: error.message
    };
  }
};

/**
 * Get subject line for notification type
 */
function getSubjectForType(notificationType) {
  switch (notificationType) {
    case 'success':
      return 'EC2 Dedicated Host Failover - Migration Successful';
    case 'failure':
      return 'EC2 Dedicated Host Failover - Migration Failed';
    case 'partial':
      return 'EC2 Dedicated Host Failover - Migration Partially Failed';
    default:
      return 'EC2 Dedicated Host Failover - Status Update';
  }
}

/**
 * Build success notification message with detailed instance information
 */
function buildSuccessMessage(hostId, reservedHostId, totalInstances, successfulMigrations, failedMigrations, instanceMigrations) {
  let message = `✅ MIGRATION SUCCESSFUL\n\n`;
  message += `Successfully migrated all instances from dedicated host ${hostId} to ${reservedHostId}.\n\n`;
  
  // Migration Summary
  message += `📊 MIGRATION SUMMARY:\n`;
  message += `• Total Instances: ${totalInstances}\n`;
  message += `• Successful Migrations: ${successfulMigrations}\n`;
  message += `• Failed Migrations: ${failedMigrations}\n`;
  message += `• Success Rate: ${totalInstances > 0 ? Math.round((successfulMigrations / totalInstances) * 100) : 0}%\n\n`;
  
  // Instance Details
  message += `🔍 INSTANCE MIGRATION DETAILS:\n`;
  
  const successfulInstances = [];
  const failedInstances = [];
  
  Object.entries(instanceMigrations).forEach(([instanceId, details]) => {
    if (details.status === 'success') {
      successfulInstances.push({ instanceId, details });
    } else if (details.status === 'failed') {
      failedInstances.push({ instanceId, details });
    }
  });
  
  // Successful instances
  if (successfulInstances.length > 0) {
    message += `\n✅ Successfully Migrated Instances (${successfulInstances.length}):\n`;
    successfulInstances.forEach(({ instanceId, details }) => {
      const duration = calculateDuration(details.startTime, details.endTime);
      message += `• ${instanceId}\n`;
      message += `  - Start Time: ${formatTime(details.startTime)}\n`;
      message += `  - End Time: ${formatTime(details.endTime)}\n`;
      message += `  - Duration: ${duration}\n`;
      message += `  - Retry Count: ${details.retryCount || 0}\n\n`;
    });
  }
  
  // Failed instances (if any)
  if (failedInstances.length > 0) {
    message += `❌ Failed Instances (${failedInstances.length}):\n`;
    failedInstances.forEach(({ instanceId, details }) => {
      message += `• ${instanceId}\n`;
      message += `  - Error: ${details.errorMessage || 'Unknown error'}\n`;
      message += `  - Retry Count: ${details.retryCount || 0}\n\n`;
    });
  }
  
  message += `\n🏁 Migration completed successfully at ${new Date().toISOString()}\n`;
  message += `\nFor more details, check the AWS Step Functions console or DynamoDB migration table.`;
  
  return message;
}

/**
 * Build failure notification message
 */
function buildFailureMessage(hostId, reservedHostId, totalInstances, successfulMigrations, failedMigrations, instanceMigrations, failedInstancesList) {
  let message = `❌ MIGRATION FAILED\n\n`;
  message += `Failed to migrate instances from dedicated host ${hostId} to ${reservedHostId}.\n\n`;
  
  // Migration Summary
  message += `📊 MIGRATION SUMMARY:\n`;
  message += `• Total Instances: ${totalInstances}\n`;
  message += `• Successful Migrations: ${successfulMigrations}\n`;
  message += `• Failed Migrations: ${failedMigrations}\n`;
  message += `• Success Rate: ${totalInstances > 0 ? Math.round((successfulMigrations / totalInstances) * 100) : 0}%\n\n`;
  
  // Instance Details
  message += `🔍 INSTANCE MIGRATION DETAILS:\n`;
  
  const successfulInstances = [];
  const failedInstances = [];
  
  Object.entries(instanceMigrations).forEach(([instanceId, details]) => {
    if (details.status === 'success') {
      successfulInstances.push({ instanceId, details });
    } else if (details.status === 'failed') {
      failedInstances.push({ instanceId, details });
    }
  });
  
  // Failed instances
  if (failedInstances.length > 0) {
    message += `\n❌ Failed Instances (${failedInstances.length}):\n`;
    failedInstances.forEach(({ instanceId, details }) => {
      message += `• ${instanceId}\n`;
      message += `  - Error: ${details.errorMessage || 'Unknown error'}\n`;
      message += `  - Start Time: ${formatTime(details.startTime)}\n`;
      message += `  - Retry Count: ${details.retryCount || 0}\n\n`;
    });
  }
  
  // Successful instances (if any)
  if (successfulInstances.length > 0) {
    message += `✅ Successfully Migrated Instances (${successfulInstances.length}):\n`;
    successfulInstances.forEach(({ instanceId, details }) => {
      const duration = calculateDuration(details.startTime, details.endTime);
      message += `• ${instanceId} (Duration: ${duration})\n`;
    });
    message += `\n`;
  }
  
  message += `\n⚠️ RECOMMENDED ACTIONS:\n`;
  message += `• Check CloudWatch Logs for detailed error information\n`;
  message += `• Verify the health of the reserved host ${reservedHostId}\n`;
  message += `• Consider manual intervention for failed instances\n`;
  message += `• Review instance placement constraints\n\n`;
  
  message += `Migration failed at ${new Date().toISOString()}\n`;
  message += `\nFor troubleshooting, check the AWS Step Functions console and CloudWatch Logs.`;
  
  return message;
}

/**
 * Build partial failure notification message
 */
function buildPartialFailureMessage(hostId, reservedHostId, totalInstances, successfulMigrations, failedMigrations, instanceMigrations, failedInstancesList) {
  let message = `⚠️ MIGRATION PARTIALLY FAILED\n\n`;
  message += `Partially migrated instances from dedicated host ${hostId} to ${reservedHostId}.\n\n`;
  
  // Migration Summary
  message += `📊 MIGRATION SUMMARY:\n`;
  message += `• Total Instances: ${totalInstances}\n`;
  message += `• Successful Migrations: ${successfulMigrations}\n`;
  message += `• Failed Migrations: ${failedMigrations}\n`;
  message += `• Success Rate: ${totalInstances > 0 ? Math.round((successfulMigrations / totalInstances) * 100) : 0}%\n\n`;
  
  // Instance Details
  message += `🔍 INSTANCE MIGRATION DETAILS:\n`;
  
  const successfulInstances = [];
  const failedInstances = [];
  
  Object.entries(instanceMigrations).forEach(([instanceId, details]) => {
    if (details.status === 'success') {
      successfulInstances.push({ instanceId, details });
    } else if (details.status === 'failed') {
      failedInstances.push({ instanceId, details });
    }
  });
  
  // Successful instances
  if (successfulInstances.length > 0) {
    message += `\n✅ Successfully Migrated Instances (${successfulInstances.length}):\n`;
    successfulInstances.forEach(({ instanceId, details }) => {
      const duration = calculateDuration(details.startTime, details.endTime);
      message += `• ${instanceId} (Duration: ${duration})\n`;
    });
    message += `\n`;
  }
  
  // Failed instances
  if (failedInstances.length > 0) {
    message += `❌ Failed Instances (${failedInstances.length}):\n`;
    failedInstances.forEach(({ instanceId, details }) => {
      message += `• ${instanceId}\n`;
      message += `  - Error: ${details.errorMessage || 'Unknown error'}\n`;
      message += `  - Retry Count: ${details.retryCount || 0}\n\n`;
    });
  }
  
  message += `\n⚠️ RECOMMENDED ACTIONS:\n`;
  message += `• Review failed instances and their error messages\n`;
  message += `• Consider manual migration for failed instances\n`;
  message += `• Check CloudWatch Logs for detailed troubleshooting\n\n`;
  
  message += `Migration completed with partial success at ${new Date().toISOString()}\n`;
  message += `\nFor more details, check the AWS Step Functions console or DynamoDB migration table.`;
  
  return message;
}

/**
 * Build generic notification message
 */
function buildGenericMessage(hostId, reservedHostId, totalInstances, successfulMigrations, failedMigrations, instanceMigrations) {
  let message = `📋 MIGRATION STATUS UPDATE\n\n`;
  message += `Migration status for dedicated host ${hostId}:\n\n`;
  
  // Migration Summary
  message += `📊 MIGRATION SUMMARY:\n`;
  message += `• Source Host: ${hostId}\n`;
  message += `• Target Host: ${reservedHostId || 'Not assigned'}\n`;
  message += `• Total Instances: ${totalInstances}\n`;
  message += `• Successful Migrations: ${successfulMigrations}\n`;
  message += `• Failed Migrations: ${failedMigrations}\n`;
  message += `• Progress: ${totalInstances > 0 ? Math.round(((successfulMigrations + failedMigrations) / totalInstances) * 100) : 0}%\n\n`;
  
  message += `Status updated at ${new Date().toISOString()}\n`;
  message += `\nFor detailed information, use the GetMigrationStatusFunction or check the DynamoDB table.`;
  
  return message;
}

/**
 * Calculate duration between two timestamps
 */
function calculateDuration(startTime, endTime) {
  if (!startTime || !endTime) return 'N/A';
  
  try {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationMs = end - start;
    
    if (durationMs < 1000) return `${durationMs}ms`;
    if (durationMs < 60000) return `${Math.round(durationMs / 1000)}s`;
    
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.round((durationMs % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  } catch (error) {
    return 'N/A';
  }
}

/**
 * Format timestamp for display
 */
function formatTime(timestamp) {
  if (!timestamp) return 'N/A';
  
  try {
    return new Date(timestamp).toISOString().replace('T', ' ').replace('Z', ' UTC');
  } catch (error) {
    return timestamp;
  }
}
