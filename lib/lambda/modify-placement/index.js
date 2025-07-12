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
    console.error('Error details:', {
      instanceId: instanceId,
      reservedHostId: reservedHostId,
      errorCode: error.code,
      errorMessage: error.message,
      statusCode: error.statusCode
    });
    
    // Provide specific error information for debugging
    const errorDetails = {
      instanceId: instanceId,
      reservedHostId: reservedHostId,
      action: 'modify_placement',
      status: 'failed',
      timestamp: new Date().toISOString(),
      errorCode: error.code || 'Unknown',
      errorMessage: error.message || 'Unknown error',
      awsError: error
    };
    
    throw new Error(`PlacementError: ${error.code || 'Unknown'} - ${error.message || 'Unknown error'}`);
  }
};