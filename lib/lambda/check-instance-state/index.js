const { getInstanceState } = require('/opt/nodejs/ec2-utils');

/**
 * Check the state of an EC2 instance
 */
exports.handler = async (event) => {
  // Handle nested JSONPath structure
  const instanceId = event.instanceId && typeof event.instanceId === 'object' && event.instanceId.$ 
    ? event.instanceId.$ 
    : event.instanceId;
  
  const reservedHostId = event.reservedHostId && typeof event.reservedHostId === 'object' && event.reservedHostId.$ 
    ? event.reservedHostId.$ 
    : event.reservedHostId;
    
  console.log('Checking instance state:', instanceId, 'Expected:', event.expectedState);
  
  try {
    const currentState = await getInstanceState(instanceId);
    
    return {
      instanceId: instanceId,
      reservedHostId: reservedHostId,
      currentState: currentState,
      expectedState: event.expectedState,
      inExpectedState: currentState === event.expectedState,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error checking instance state:', error);
    throw error;
  }
};