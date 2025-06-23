const { SNS } = require('aws-sdk');
const { getMigrationRecord } = require('/opt/nodejs/ec2-utils');

const sns = new SNS();

/**
 * Send step-by-step notification during migration process
 */
exports.handler = async (event) => {
  console.log('Sending step notification:', JSON.stringify(event, null, 2));
  
  try {
    const {
      hostId,
      step,
      instanceId,
      reservedHostId,
      status = 'info',
      additionalInfo = {}
    } = event;
    
    if (!hostId || !step) {
      throw new Error('hostId and step are required parameters');
    }
    
    // Get migration record for context
    let migrationRecord = null;
    try {
      migrationRecord = await getMigrationRecord(hostId);
    } catch (error) {
      console.log('Could not retrieve migration record, proceeding with basic notification');
    }
    
    // Build notification message based on step
    const notification = buildStepNotification(step, {
      hostId,
      instanceId,
      reservedHostId,
      status,
      migrationRecord,
      additionalInfo
    });
    
    // Send SNS notification
    const params = {
      TopicArn: process.env.ALERT_TOPIC_ARN,
      Subject: notification.subject,
      Message: notification.message
    };
    
    await sns.publish(params).promise();
    
    console.log(`Step notification sent successfully for step: ${step}`);
    
    return {
      success: true,
      step,
      hostId,
      instanceId,
      notificationSent: true
    };
    
  } catch (error) {
    console.error('Error sending step notification:', error);
    
    // Don't fail the workflow for notification errors
    return {
      success: false,
      error: error.message,
      step: event.step,
      hostId: event.hostId,
      notificationSent: false
    };
  }
};

/**
 * Build notification message based on the step
 */
function buildStepNotification(step, context) {
  const {
    hostId,
    instanceId,
    reservedHostId,
    status,
    migrationRecord,
    additionalInfo
  } = context;
  
  const timestamp = new Date().toISOString().replace('T', ' ').replace('Z', ' UTC');
  
  switch (step) {
    case 'migration_started':
      return {
        subject: 'EC2 Dedicated Host Failover - Migration Started',
        message: buildMigrationStartedMessage(hostId, reservedHostId, migrationRecord, timestamp)
      };
      
    case 'instances_found':
      return {
        subject: 'EC2 Dedicated Host Failover - Instances Found for Migration',
        message: buildInstancesFoundMessage(hostId, reservedHostId, migrationRecord, timestamp)
      };
      
    case 'instance_stopping':
      return {
        subject: 'EC2 Dedicated Host Failover - Stopping Instance',
        message: buildInstanceStoppingMessage(hostId, instanceId, reservedHostId, timestamp, additionalInfo)
      };
      
    case 'instance_stopped':
      return {
        subject: 'EC2 Dedicated Host Failover - Instance Stopped Successfully',
        message: buildInstanceStoppedMessage(hostId, instanceId, reservedHostId, timestamp, additionalInfo)
      };
      
    case 'placement_modified':
      return {
        subject: 'EC2 Dedicated Host Failover - Instance Placement Modified',
        message: buildPlacementModifiedMessage(hostId, instanceId, reservedHostId, timestamp, additionalInfo)
      };
      
    case 'instance_starting':
      return {
        subject: 'EC2 Dedicated Host Failover - Starting Instance',
        message: buildInstanceStartingMessage(hostId, instanceId, reservedHostId, timestamp, additionalInfo)
      };
      
    case 'instance_started':
      return {
        subject: 'EC2 Dedicated Host Failover - Instance Started Successfully',
        message: buildInstanceStartedMessage(hostId, instanceId, reservedHostId, timestamp, additionalInfo)
      };
      
    default:
      return {
        subject: 'EC2 Dedicated Host Failover - Step Update',
        message: buildGenericStepMessage(step, hostId, instanceId, reservedHostId, timestamp, additionalInfo)
      };
  }
}

/**
 * Build migration started notification
 */
function buildMigrationStartedMessage(hostId, reservedHostId, migrationRecord, timestamp) {
  let message = `🚀 MIGRATION STARTED\n\n`;
  message += `Dedicated host failover migration has been initiated.\n\n`;
  
  message += `📋 MIGRATION DETAILS:\n`;
  message += `• Source Host: ${hostId}\n`;
  message += `• Target Host: ${reservedHostId || 'To be determined'}\n`;
  message += `• Started At: ${timestamp}\n`;
  
  if (migrationRecord && migrationRecord.TotalInstances) {
    message += `• Total Instances to Migrate: ${migrationRecord.TotalInstances}\n`;
  }
  
  message += `\n🔄 The migration workflow is now in progress. You will receive notifications for each major step.\n`;
  
  if (!reservedHostId) {
    message += `\n📋 Next Step: Checking for available reserved hosts or provisioning a new one.\n`;
  }
  
  message += `\nFor real-time status updates, check the AWS Step Functions console.`;
  
  return message;
}

/**
 * Build instances found notification
 */
function buildInstancesFoundMessage(hostId, reservedHostId, migrationRecord, timestamp) {
  let message = `🔍 INSTANCES FOUND FOR MIGRATION\n\n`;
  message += `Found instances on the failing dedicated host that need to be migrated.\n\n`;
  
  message += `📋 MIGRATION DETAILS:\n`;
  message += `• Source Host: ${hostId}\n`;
  message += `• Target Host: ${reservedHostId}\n`;
  message += `• Checked At: ${timestamp}\n`;
  
  if (migrationRecord) {
    message += `• Total Instances Found: ${migrationRecord.TotalInstances || 'Unknown'}\n`;
    
    if (migrationRecord.InstanceMigrations) {
      const instanceIds = Object.keys(migrationRecord.InstanceMigrations);
      if (instanceIds.length > 0) {
        message += `\n📝 INSTANCES TO MIGRATE:\n`;
        instanceIds.forEach(instanceId => {
          message += `• ${instanceId}\n`;
        });
      }
    }
  }
  
  message += `\n⏳ Starting individual instance migrations. You will receive notifications for each instance.\n`;
  message += `\nFor detailed progress, monitor the AWS Step Functions console.`;
  
  return message;
}

/**
 * Build instance stopping notification
 */
function buildInstanceStoppingMessage(hostId, instanceId, reservedHostId, timestamp, additionalInfo) {
  let message = `⏹️ STOPPING INSTANCE\n\n`;
  message += `Attempting to stop instance for migration.\n\n`;
  
  message += `📋 INSTANCE DETAILS:\n`;
  message += `• Instance ID: ${instanceId}\n`;
  message += `• Source Host: ${hostId}\n`;
  message += `• Target Host: ${reservedHostId}\n`;
  message += `• Stop Initiated At: ${timestamp}\n`;
  
  if (additionalInfo.forceStop) {
    message += `• Force Stop: Yes (previous graceful stop attempts failed)\n`;
  } else {
    message += `• Stop Type: Graceful\n`;
  }
  
  if (additionalInfo.retryCount) {
    message += `• Retry Count: ${additionalInfo.retryCount}\n`;
  }
  
  message += `\n⏳ Waiting for instance to stop completely before proceeding with migration.\n`;
  message += `\nThis may take a few minutes depending on the instance's current workload.`;
  
  return message;
}

/**
 * Build instance stopped notification
 */
function buildInstanceStoppedMessage(hostId, instanceId, reservedHostId, timestamp, additionalInfo) {
  let message = `✅ INSTANCE STOPPED SUCCESSFULLY\n\n`;
  message += `Instance has been stopped and is ready for placement modification.\n\n`;
  
  message += `📋 INSTANCE DETAILS:\n`;
  message += `• Instance ID: ${instanceId}\n`;
  message += `• Source Host: ${hostId}\n`;
  message += `• Target Host: ${reservedHostId}\n`;
  message += `• Stopped At: ${timestamp}\n`;
  
  if (additionalInfo.stopDuration) {
    message += `• Stop Duration: ${additionalInfo.stopDuration}\n`;
  }
  
  if (additionalInfo.forceStopUsed) {
    message += `• Force Stop Used: Yes\n`;
  }
  
  message += `\n🔄 Proceeding to modify instance placement to the target host.\n`;
  message += `\nNext step: Modifying instance placement configuration.`;
  
  return message;
}

/**
 * Build placement modified notification
 */
function buildPlacementModifiedMessage(hostId, instanceId, reservedHostId, timestamp, additionalInfo) {
  let message = `🔧 INSTANCE PLACEMENT MODIFIED\n\n`;
  message += `Successfully modified instance placement to the target dedicated host.\n\n`;
  
  message += `📋 PLACEMENT DETAILS:\n`;
  message += `• Instance ID: ${instanceId}\n`;
  message += `• Previous Host: ${hostId}\n`;
  message += `• New Host: ${reservedHostId}\n`;
  message += `• Modified At: ${timestamp}\n`;
  
  if (additionalInfo.placementGroup) {
    message += `• Placement Group: ${additionalInfo.placementGroup}\n`;
  }
  
  if (additionalInfo.tenancy) {
    message += `• Tenancy: ${additionalInfo.tenancy}\n`;
  }
  
  message += `\n🚀 Proceeding to start the instance on the new host.\n`;
  message += `\nNext step: Starting instance on the target dedicated host.`;
  
  return message;
}

/**
 * Build instance starting notification
 */
function buildInstanceStartingMessage(hostId, instanceId, reservedHostId, timestamp, additionalInfo) {
  let message = `🚀 STARTING INSTANCE\n\n`;
  message += `Attempting to start instance on the target dedicated host.\n\n`;
  
  message += `📋 INSTANCE DETAILS:\n`;
  message += `• Instance ID: ${instanceId}\n`;
  message += `• Previous Host: ${hostId}\n`;
  message += `• Current Host: ${reservedHostId}\n`;
  message += `• Start Initiated At: ${timestamp}\n`;
  
  if (additionalInfo.retryCount) {
    message += `• Retry Count: ${additionalInfo.retryCount}\n`;
  }
  
  message += `\n⏳ Waiting for instance to start and become available.\n`;
  message += `\nThis may take a few minutes for the instance to fully initialize.`;
  
  return message;
}

/**
 * Build instance started notification
 */
function buildInstanceStartedMessage(hostId, instanceId, reservedHostId, timestamp, additionalInfo) {
  let message = `✅ INSTANCE STARTED SUCCESSFULLY\n\n`;
  message += `Instance has been successfully migrated and is now running on the target host.\n\n`;
  
  message += `📋 MIGRATION COMPLETED:\n`;
  message += `• Instance ID: ${instanceId}\n`;
  message += `• Previous Host: ${hostId}\n`;
  message += `• Current Host: ${reservedHostId}\n`;
  message += `• Started At: ${timestamp}\n`;
  
  if (additionalInfo.startDuration) {
    message += `• Start Duration: ${additionalInfo.startDuration}\n`;
  }
  
  if (additionalInfo.totalMigrationTime) {
    message += `• Total Migration Time: ${additionalInfo.totalMigrationTime}\n`;
  }
  
  message += `\n🎉 Instance migration completed successfully!\n`;
  message += `\nThe instance is now running on the new dedicated host and should be fully operational.`;
  
  return message;
}

/**
 * Build generic step notification
 */
function buildGenericStepMessage(step, hostId, instanceId, reservedHostId, timestamp, additionalInfo) {
  let message = `📋 MIGRATION STEP UPDATE\n\n`;
  message += `Migration workflow step: ${step}\n\n`;
  
  message += `📋 DETAILS:\n`;
  message += `• Host ID: ${hostId}\n`;
  if (instanceId) message += `• Instance ID: ${instanceId}\n`;
  if (reservedHostId) message += `• Reserved Host: ${reservedHostId}\n`;
  message += `• Timestamp: ${timestamp}\n`;
  
  if (Object.keys(additionalInfo).length > 0) {
    message += `\n📝 ADDITIONAL INFO:\n`;
    Object.entries(additionalInfo).forEach(([key, value]) => {
      message += `• ${key}: ${value}\n`;
    });
  }
  
  message += `\nFor detailed status, check the AWS Step Functions console.`;
  
  return message;
}
