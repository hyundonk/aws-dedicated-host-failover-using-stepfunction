const { updateHostState } = require('/opt/nodejs/ec2-utils');

/**
 * Initialize the migration process for a host
 */
exports.handler = async (event) => {
  console.log('Initializing migration for host:', event.hostId);
  
  try {
    // Update the host state to processing in DynamoDB
    await updateHostState(event.hostId, 'processing');
    
    return { 
      hostId: event.hostId,
      startTime: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error initializing migration:', error);
    throw error;
  }
};
