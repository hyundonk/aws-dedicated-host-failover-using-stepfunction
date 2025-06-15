const AWS = require('aws-sdk');
const ec2 = new AWS.EC2();

/**
 * Start an EC2 instance
 */
exports.handler = async (event) => {
  // Handle nested JSONPath structure
  const instanceId = event.instanceId && typeof event.instanceId === 'object' && event.instanceId.$ 
    ? event.instanceId.$ 
    : event.instanceId;
  
  const reservedHostId = event.reservedHostId && typeof event.reservedHostId === 'object' && event.reservedHostId.$ 
    ? event.reservedHostId.$ 
    : event.reservedHostId;
    
  console.log('Starting instance:', instanceId);
  
  try {
    await ec2.startInstances({
      InstanceIds: [instanceId]
    }).promise();
    
    return {
      instanceId: instanceId,
      reservedHostId: reservedHostId,
      action: 'start',
      status: 'initiated',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error starting instance:', error);
    throw new Error('InstanceStartError');
  }
};