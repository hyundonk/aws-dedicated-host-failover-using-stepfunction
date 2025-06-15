const AWS = require('aws-sdk');
const ec2 = new AWS.EC2();

/**
 * Modify instance placement to move to the reserved host
 */
exports.handler = async (event) => {
  const instanceId = event.instanceId;
  const reservedHostId = event.reservedHostId;
    
  console.log('Modifying instance placement:', instanceId, 'to host:', reservedHostId);
  
  try {
    await ec2.modifyInstancePlacement({
      InstanceId: instanceId,
      Affinity: 'host',
      HostId: reservedHostId
    }).promise();
    
    return {
      instanceId: instanceId,
      reservedHostId: reservedHostId,
      action: 'modify_placement',
      status: 'success',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error modifying instance placement:', error);
    throw new Error('PlacementError');
  }
};