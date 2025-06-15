const AWS = require('aws-sdk');
const ec2 = new AWS.EC2();

/**
 * Stop an EC2 instance
 */
exports.handler = async (event) => {
  console.log('Stopping instance:', JSON.stringify(event.instanceId));
  
  // Extract the instance ID
  const instanceId = event.instanceId;
  
  if (!instanceId || typeof instanceId !== 'string') {
    console.error('Invalid instance ID:', instanceId);
    throw new Error('InstanceStopError');
  }
  
  try {
    await ec2.stopInstances({
      InstanceIds: [instanceId]
    }).promise();
    
    return {
      instanceId: instanceId,
      reservedHostId: event.reservedHostId,
      action: 'stop',
      status: 'initiated',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error stopping instance:', error);
    throw new Error('InstanceStopError');
  }
};