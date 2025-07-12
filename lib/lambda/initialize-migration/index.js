const { updateHostState, findReservedHost } = require('/opt/nodejs/ec2-utils');
const AWS = require('aws-sdk');
const ec2 = new AWS.EC2();

/**
 * Get host information including availability zone and instance family
 */
async function getHostInfo(hostId) {
  console.log(`Getting host information for: ${hostId}`);
  
  try {
    const response = await ec2.describeHosts({
      HostIds: [hostId]
    }).promise();
    
    if (!response.Hosts || response.Hosts.length === 0) {
      throw new Error(`Host ${hostId} not found`);
    }
    
    const host = response.Hosts[0];
    
    // Get instance family - this is the primary method
    let instanceFamily;
    
    // Method 1: Use instance family from HostProperties (preferred)
    if (host.HostProperties && host.HostProperties.InstanceFamily) {
      instanceFamily = host.HostProperties.InstanceFamily;
      console.log(`Using instance family from HostProperties: ${instanceFamily}`);
    }
    // Method 2: Extract family from running instances
    else if (host.Instances && host.Instances.length > 0) {
      const firstInstanceType = host.Instances[0].InstanceType;
      instanceFamily = firstInstanceType.split('.')[0]; // Extract family (e.g., 'c5' from 'c5.4xlarge')
      console.log(`Extracted instance family from running instances: ${instanceFamily}`);
    }
    // Method 3: Extract family from available instance types
    else if (host.AvailableCapacity && host.AvailableCapacity.AvailableInstanceCapacity) {
      const firstType = host.AvailableCapacity.AvailableInstanceCapacity[0].InstanceType;
      instanceFamily = firstType.split('.')[0]; // Extract family (e.g., 'c5' from 'c5.large')
      console.log(`Extracted instance family from available capacity: ${instanceFamily}`);
    }
    
    console.log('Host details:', {
      HostId: host.HostId,
      AvailabilityZone: host.AvailabilityZone,
      InstanceFamily: instanceFamily,
      State: host.State,
      RunningInstances: host.Instances?.length || 0,
      SupportsMultipleInstanceTypes: host.AllowsMultipleInstanceTypes
    });
    
    return {
      AvailabilityZone: host.AvailabilityZone,
      InstanceFamily: instanceFamily,
      State: host.State
    };
  } catch (error) {
    console.error('Error in getHostInfo:', error);
    throw error;
  }
}

/**
 * Get the number of instances running on a dedicated host
 * @param {string} hostId - The dedicated host ID
 * @returns {Promise<number>} - The number of instances running on the host
 */
async function getHostInstanceCount(hostId) {
  console.log(`Getting instance count for host: ${hostId}`);
  
  try {
    const response = await ec2.describeHosts({
      HostIds: [hostId]
    }).promise();
    
    if (!response.Hosts || response.Hosts.length === 0) {
      throw new Error(`Host ${hostId} not found`);
    }
    
    const host = response.Hosts[0];
    const instanceCount = host.Instances ? host.Instances.length : 0;
    
    console.log(`Host ${hostId} details:`, {
      HostId: host.HostId,
      State: host.State,
      InstanceCount: instanceCount,
      Instances: host.Instances?.map(inst => ({
        InstanceId: inst.InstanceId,
        InstanceType: inst.InstanceType
      })) || []
    });
    
    return instanceCount;
    
  } catch (error) {
    console.error('Error getting instance count:', error);
    throw error;
  }
}

/**
 * Get the most common instance type from an array of instance types
 */
function getMostCommonInstanceType(instanceTypes) {
  const counts = {};
  instanceTypes.forEach(type => {
    counts[type] = (counts[type] || 0) + 1;
  });
  
  return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
}

/**
 * Initialize the migration process for a host, check for reserved host availability, and prepare migration started notification
 */
exports.handler = async (event) => {
  console.log('Initializing migration for host:', event.hostId);
  
  try {
    // Step 1: Update the host state to processing in DynamoDB
    await updateHostState(event.hostId, 'processing');
    
    // Step 2: Get the availability zone and instance family of the source host
    console.log('Getting availability zone and instance family of source host...');
    let availabilityZone, instanceFamily;
    
    try {
      const sourceHostInfo = await getHostInfo(event.hostId);
      availabilityZone = sourceHostInfo.AvailabilityZone;
      instanceFamily = sourceHostInfo.InstanceFamily; // Only get instance family
      
      console.log(`Source host ${event.hostId} is in AZ: ${availabilityZone}, Instance Family: ${instanceFamily}`);
      
      if (!availabilityZone) {
        throw new Error('Availability zone not found for source host');
      }
      if (!instanceFamily) {
        throw new Error('Instance family not found for source host');
      }
    } catch (error) {
      console.error('Error getting host info:', error);
      // Fallback to environment variables if host info fails
      availabilityZone = process.env.AVAILABILITY_ZONE;
      instanceFamily = process.env.INSTANCE_TYPE?.split('.')[0] || 'c5'; // Extract family from env
      console.log(`Using fallback values - AZ: ${availabilityZone}, Instance Family: ${instanceFamily}`);
    }
    
    // Step 3: Check for available reserved host in the same availability zone
    console.log('Checking for available reserved host in same AZ...');
    const reservedHost = await findReservedHost(event.hostId);
    let isReservedHostAvailable = false;
    const reservedHostId = reservedHost || null;
    
    if (reservedHost) {
      console.log(`Found potential reserved host: ${reservedHost}`);
      
      // Step 4: Check if reserved host has any running instances
      console.log('Checking instance count on reserved host...');
      try {
        const instanceCount = await getHostInstanceCount(reservedHost);
        console.log(`Reserved host ${reservedHost} has ${instanceCount} running instances`);
        
        if (instanceCount === 0) {
          isReservedHostAvailable = true;
          console.log('Reserved host is available (no instances running)');
        } else {
          isReservedHostAvailable = false;
          console.log(`Reserved host is NOT available (${instanceCount} instances running)`);
        }
      } catch (instanceCheckError) {
        console.error('Error checking instance count:', instanceCheckError);
        // If we can't check instance count, assume host is not available for safety
        isReservedHostAvailable = false;
        console.log('Assuming reserved host is NOT available due to instance count check failure');
      }
    } else {
      console.log('No reserved host found in the same availability zone');
    }
    
    console.log(`Reserved host availability: ${isReservedHostAvailable}, Host ID: ${reservedHostId}`);
    
    const startTime = new Date().toISOString();
    
    // Step 5: Prepare migration started notification message
    const notificationMessage = buildMigrationStartedMessage(event.hostId, reservedHostId, startTime);
    
    return { 
      hostId: event.hostId,
      startTime: startTime,
      availabilityZone: availabilityZone,
      instanceFamily: instanceFamily,  // Changed from instanceType to instanceFamily
      reservedHostCheck: {
        isAvailable: isReservedHostAvailable,
        reservedHostId: reservedHostId
      },
      notification: {
        subject: 'EC2 Dedicated Host Failover - Migration Started',
        message: notificationMessage
      }
    };
  } catch (error) {
    console.error('Error initializing migration:', error);
    throw error;
  }
};

/**
 * Build migration started notification message
 */
function buildMigrationStartedMessage(hostId, reservedHostId, startTime) {
  const timestamp = startTime.replace('T', ' ').replace('Z', ' UTC');
  
  let message = `🚀 MIGRATION STARTED\n\n`;
  message += `Dedicated host failover migration has been initiated.\n\n`;
  
  message += `📋 MIGRATION DETAILS:\n`;
  message += `• Source Host: ${hostId}\n`;
  message += `• Target Host: ${reservedHostId || 'To be determined'}\n`;
  message += `• Started At: ${timestamp}\n`;
  
  message += `\n🔄 The migration workflow is now in progress. You will receive notifications for each major step.\n`;
  
  if (reservedHostId) {
    message += `\n✅ Reserved host found: ${reservedHostId}\n`;
    message += `📋 Next Step: Getting instances on the failing host for migration.\n`;
  } else {
    message += `\n📋 Next Step: Provisioning a new reserved host for failover.\n`;
  }
  
  message += `\nFor real-time status updates, check the AWS Step Functions console.`;
  
  return message;
}
