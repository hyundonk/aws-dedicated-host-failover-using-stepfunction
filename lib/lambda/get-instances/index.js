const { getInstancesOnHost, initializeMigrationRecord } = require('/opt/nodejs/ec2-utils');

/**
 * Get instances on a dedicated host and initialize migration tracking
 */
exports.handler = async (event) => {
  console.log('Getting instances on host:', event.hostId);
  
  try {
    const instances = await getInstancesOnHost(event.hostId);
    const instanceIds = instances.map(instance => instance.InstanceId);
    
    console.log(`Found ${instanceIds.length} instances on host ${event.hostId}`);
    
    // If we have instances and a reserved host, initialize the migration record
    if (instanceIds.length > 0 && event.reservedHostId) {
      console.log(`Initializing migration record for ${instanceIds.length} instances`);
      await initializeMigrationRecord(event.hostId, event.reservedHostId, instanceIds);
    }
    
    return {
      hostId: event.hostId,
      reservedHostId: event.reservedHostId,
      hasInstances: instanceIds.length > 0,
      instanceIds: instanceIds,
      instanceCount: instanceIds.length
    };
  } catch (error) {
    console.error('Error getting instances:', error);
    throw error;
  }
};
