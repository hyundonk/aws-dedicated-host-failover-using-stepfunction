const { getInstancesOnHost, initializeMigrationRecord, removeReservedTag } = require('/opt/nodejs/ec2-utils');

/**
 * Get instances on a dedicated host and initialize migration tracking
 */
exports.handler = async (event) => {
  console.log('Getting instances on host:', event.hostId);
  console.log('Event data:', JSON.stringify(event, null, 2));
  
  try {
    // Determine the target reserved host ID from either source
    const targetHostId = event.reservedHostId || event.provisionedHostId;
    
    if (!targetHostId) {
      throw new Error('No target host ID provided (neither reservedHostId nor provisionedHostId)');
    }
    
    console.log(`Target reserved host ID: ${targetHostId}`);
    
    // Remove Reserved tag immediately after committing to this host
    // This prevents race conditions with other Step Functions executions
    console.log(`Removing Reserved tag from committed host: ${targetHostId}`);
    try {
      await removeReservedTag(targetHostId);
      console.log('Reserved tag removed successfully - host is now committed to this migration');
    } catch (tagError) {
      console.warn('Failed to remove Reserved tag, but continuing with migration:', tagError.message);
      // Don't fail the entire migration if tag removal fails
    }
    
    const instances = await getInstancesOnHost(event.hostId);
    const instanceIds = instances.map(instance => instance.InstanceId);
    
    console.log(`Found ${instanceIds.length} instances on host ${event.hostId}`);
    
    // If we have instances, initialize the migration record
    if (instanceIds.length > 0) {
      console.log(`Initializing migration record for ${instanceIds.length} instances`);
      await initializeMigrationRecord(event.hostId, targetHostId, instanceIds);
    }
    
    return {
      hostId: event.hostId,
      reservedHostId: targetHostId,
      hasInstances: instanceIds.length > 0,
      instanceIds: instanceIds,
      instanceCount: instanceIds.length,
      tagRemoved: true // Indicate that the Reserved tag has been removed
    };
  } catch (error) {
    console.error('Error getting instances:', error);
    throw error;
  }
};
