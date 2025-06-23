const { updateInstanceMigrationStatus, incrementInstanceRetryCount } = require('/opt/nodejs/ec2-utils');

/**
 * Update individual instance migration status
 */
exports.handler = async (event) => {
  console.log('Updating instance migration status:', JSON.stringify(event, null, 2));
  
  const { hostId, instanceId, status, errorMessage, incrementRetry } = event;
  
  try {
    // Increment retry count if requested
    if (incrementRetry) {
      await incrementInstanceRetryCount(hostId, instanceId);
    }
    
    // Update the instance migration status
    await updateInstanceMigrationStatus(hostId, instanceId, status, errorMessage);
    
    console.log(`Updated instance ${instanceId} status to ${status}`);
    
    return {
      hostId,
      instanceId,
      status,
      timestamp: new Date().toISOString(),
      success: true
    };
  } catch (error) {
    console.error('Error updating instance migration status:', error);
    throw error;
  }
};
