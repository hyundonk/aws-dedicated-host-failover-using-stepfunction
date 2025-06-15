const { removeReservedTag } = require('/opt/nodejs/ec2-utils');

/**
 * Remove the Reserved tag from a dedicated host
 */
exports.handler = async (event) => {
  const hostId = event.reservedHostId;
  
  console.log(`Removing Reserved tag from host: ${hostId}`);
  
  try {
    await removeReservedTag(hostId);
    
    return {
      hostId: hostId,
      action: 'remove_reserved_tag',
      status: 'success',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error removing Reserved tag:', error);
    // Don't fail the workflow if tag removal fails
    return {
      hostId: hostId,
      action: 'remove_reserved_tag',
      status: 'failed',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};