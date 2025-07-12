const AWS = require('aws-sdk');
const ec2 = new AWS.EC2();

/**
 * Provision a new reserved dedicated host with multiple instance type support
 */
exports.handler = async (event) => {
  console.log('Provisioning new reserved host for host:', event.hostId);
  console.log('Event data:', JSON.stringify(event, null, 2));
  
  // Use dynamic values from the event, fallback to environment variables
  const availabilityZone = event.availabilityZone || process.env.AVAILABILITY_ZONE;
  const instanceFamily = event.instanceFamily || process.env.INSTANCE_TYPE?.split('.')[0] || 'c5';
  
  console.log(`Provisioning host in AZ: ${availabilityZone}, Instance Family: ${instanceFamily}`);
  
  try {
    const response = await ec2.allocateHosts({
      AvailabilityZone: availabilityZone,
      InstanceFamily: instanceFamily,  // Use InstanceFamily instead of InstanceType
      Quantity: 1,
      TagSpecifications: [
        {
          ResourceType: 'dedicated-host',
          Tags: [
            {
              Key: 'Role',
              Value: 'Reserved'
            },
            {
              Key: 'CreatedFor',
              Value: event.hostId
            },
            {
              Key: 'CreatedAt',
              Value: new Date().toISOString()
            },
            {
              Key: 'SourceAvailabilityZone',
              Value: availabilityZone
            },
            {
              Key: 'InstanceFamily',
              Value: instanceFamily
            }
          ]
        }
      ]
    }).promise();
    
    if (!response.HostIds || response.HostIds.length === 0) {
      throw new Error('Failed to provision reserved host');
    }
    
    return {
      hostId: event.hostId,
      reservedHostId: response.HostIds[0],
      provisionedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error provisioning host:', error);
    throw error;
  }
};
