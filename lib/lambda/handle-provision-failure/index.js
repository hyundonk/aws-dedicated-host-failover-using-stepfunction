const { updateHostState, getMigrationRecord } = require('/opt/nodejs/ec2-utils');

/**
 * Handle provision failure by updating status and preparing notification message
 * This combines the functionality of HandleProvisionFailure and PrepareProvisionFailureMessage
 */
exports.handler = async (event) => {
  console.log('Handling provision failure for host:', event.hostId);
  console.log('Error details:', JSON.stringify(event.error, null, 2));
  console.log('Total retry attempts:', event.totalRetryAttempts || 'Unknown');
  
  try {
    // Step 1: Update the host state to failed in DynamoDB
    await updateHostState(event.hostId, 'failed', event.error);
    console.log('Updated host status to failed in DynamoDB');
    
    // Step 2: Get the migration record for context
    let migrationRecord = null;
    try {
      migrationRecord = await getMigrationRecord(event.hostId);
    } catch (error) {
      console.log('Could not retrieve migration record, proceeding with basic notification');
    }
    
    // Step 3: Prepare detailed notification message
    const notificationMessage = buildProvisionFailureMessage(
      event.hostId, 
      event.error, 
      migrationRecord,
      event.totalRetryAttempts || 4
    );
    
    // Return in the exact same format as PrepareDetailedNotificationFunction
    return {
      subject: 'EC2 Dedicated Host Failover - Provisioning Failed',
      message: notificationMessage,
      hostId: event.hostId,
      notificationType: 'provision-failure',
      migrationSummary: {
        totalInstances: 0,
        successfulMigrations: 0,
        failedMigrations: 0,
        progressPercentage: 0
      },
      // Additional context for provision failure
      provisionFailure: true,
      totalRetryAttempts: event.totalRetryAttempts || 4,
      updateResult: {
        success: true,
        message: 'Host status updated to failed'
      },
      error: event.error
    };
    
  } catch (error) {
    console.error('Error handling provision failure:', error);
    
    // Return a fallback response in the same format as PrepareDetailedNotificationFunction
    return {
      subject: 'EC2 Dedicated Host Failover - Provisioning Failed',
      message: buildFallbackFailureMessage(event.hostId, event.error, event.totalRetryAttempts || 4),
      hostId: event.hostId,
      notificationType: 'provision-failure',
      migrationSummary: {
        totalInstances: 0,
        successfulMigrations: 0,
        failedMigrations: 0,
        progressPercentage: 0
      },
      // Additional context for provision failure
      provisionFailure: true,
      totalRetryAttempts: event.totalRetryAttempts || 4,
      updateResult: {
        success: false,
        error: error.message
      },
      originalError: event.error,
      handlingError: error.message
    };
  }
};

/**
 * Build detailed provision failure message
 */
function buildProvisionFailureMessage(hostId, error, migrationRecord, totalRetryAttempts = 4) {
  let message = `❌ PROVISIONING FAILED AFTER RETRIES\n\n`;
  message += `Failed to provision a reserved host for dedicated host failover after multiple attempts.\n\n`;
  
  message += `📋 FAILURE DETAILS:\n`;
  message += `• Source Host: ${hostId}\n`;
  message += `• Failed At: ${new Date().toISOString().replace('T', ' ').replace('Z', ' UTC')}\n`;
  message += `• Retry Attempts: ${totalRetryAttempts} attempts with 30-second intervals\n`;
  message += `• Total Retry Duration: ~${Math.floor(totalRetryAttempts * 0.5)} minutes\n`;
  
  // Add error details if available
  if (error) {
    if (typeof error === 'string') {
      message += `• Final Error: ${error}\n`;
    } else if (error.errorMessage) {
      message += `• Final Error: ${error.errorMessage}\n`;
    } else if (error.cause) {
      message += `• Final Error: ${error.cause}\n`;
    } else if (error.Cause) {
      message += `• Final Error: ${error.Cause}\n`;
    } else {
      message += `• Final Error: ${JSON.stringify(error)}\n`;
    }
  }
  
  // Add migration context if available
  if (migrationRecord) {
    message += `• Migration State: ${migrationRecord.State || 'Unknown'}\n`;
    if (migrationRecord.TotalInstances) {
      message += `• Instances Affected: ${migrationRecord.TotalInstances}\n`;
    }
  }
  
  message += `\n⚠️ IMPACT:\n`;
  message += `• Migration workflow has been stopped after exhausting all retry attempts\n`;
  message += `• Instances on the failing host remain at risk\n`;
  message += `• Manual intervention is required\n\n`;
  
  message += `🔧 RECOMMENDED ACTIONS:\n`;
  message += `• Check CloudWatch Logs for detailed error information from all retry attempts\n`;
  message += `• Verify AWS account limits for dedicated hosts\n`;
  message += `• Ensure sufficient capacity in the availability zone\n`;
  message += `• Check IAM permissions for EC2 host allocation\n`;
  message += `• Review AWS service health dashboard for regional issues\n`;
  message += `• Consider manual host provisioning if needed\n`;
  message += `• Review the Step Functions execution for retry attempt details\n\n`;
  
  message += `📞 NEXT STEPS:\n`;
  message += `1. Investigate the root cause using CloudWatch Logs (check all ${totalRetryAttempts} retry attempts)\n`;
  message += `2. Resolve the underlying issue (capacity, permissions, service health, etc.)\n`;
  message += `3. Wait for service recovery if it's a regional AWS issue\n`;
  message += `4. Manually provision a reserved host if necessary\n`;
  message += `5. Re-trigger the migration workflow\n\n`;
  
  message += `⏱️ RETRY BEHAVIOR:\n`;
  message += `The system automatically retried provisioning ${totalRetryAttempts} times with 30-second intervals.\n`;
  message += `Each retry attempt was preceded by an immediate notification.\n`;
  message += `This indicates a persistent issue that requires manual investigation.\n\n`;
  
  message += `For troubleshooting guidance, check the AWS Step Functions console and CloudWatch Logs.`;
  
  return message;
}

/**
 * Build fallback failure message when detailed processing fails
 */
function buildFallbackFailureMessage(hostId, error, totalRetryAttempts = 4) {
  let message = `❌ PROVISIONING FAILED AFTER RETRIES\n\n`;
  message += `Failed to provision a reserved host for dedicated host ${hostId} after ${totalRetryAttempts} retry attempts.\n\n`;
  
  if (error) {
    message += `Final Error: ${typeof error === 'string' ? error : JSON.stringify(error)}\n\n`;
  }
  
  message += `The system automatically retried provisioning ${totalRetryAttempts} times with 30-second intervals.\n`;
  message += `Each retry attempt was preceded by an immediate notification.\n`;
  message += `This indicates a persistent issue that requires manual investigation.\n\n`;
  
  message += `Please check the AWS Step Functions console and CloudWatch Logs for detailed information.\n`;
  message += `Manual intervention is required to resolve this issue.`;
  
  return message;
}
