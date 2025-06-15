const { findReservedHost } = require('/opt/nodejs/ec2-utils');

/**
 * Check for an available reserved dedicated host
 */
exports.handler = async (event) => {
  console.log('Checking for available reserved host for host:', event.hostId);
  
  try {
    // Find a reserved dedicated host
    const reservedHost = await findReservedHost();
    
    return {
      hostId: event.hostId,
      isAvailable: !!reservedHost,
      reservedHostId: reservedHost || null
    };
  } catch (error) {
    console.error('Error checking for reserved host:', error);
    throw error;
  }
};
