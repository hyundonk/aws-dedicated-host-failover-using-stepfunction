const AWS = require('aws-sdk');
const ec2 = new AWS.EC2();

/**
 * Stop an EC2 instance
 * @param {Object} event - The event object
 * @param {string} event.instanceId - The instance ID to stop
 * @param {string} event.reservedHostId - The reserved host ID
 * @param {boolean} [event.force=false] - Whether to force stop the instance
 */
exports.handler = async (event) => {
  console.log('Stopping instance:', JSON.stringify(event.instanceId), 'Force:', event.force ? 'Yes' : 'No');
  
  // Extract the instance ID
  const instanceId = event.instanceId;
  
  if (!instanceId || typeof instanceId !== 'string') {
    console.error('Invalid instance ID:', instanceId);
    throw new Error('InstanceStopError');
  }
  
  try {
    await ec2.stopInstances({
      InstanceIds: [instanceId],
      Force: event.force === true
    }).promise();
    
    return {
      instanceId: instanceId,
      reservedHostId: event.reservedHostId,
      action: 'stop',
      status: 'initiated',
      force: event.force === true,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error stopping instance:', error);
    throw new Error('InstanceStopError');
  }
};