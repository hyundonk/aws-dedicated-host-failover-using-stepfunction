const AWS = require('aws-sdk');
const ec2 = new AWS.EC2();

/**
 * Provision a new reserved dedicated host
 */
exports.handler = async (event) => {
  console.log('Provisioning new reserved host for host:', event.hostId);
  
  try {
    const response = await ec2.allocateHosts({
      AvailabilityZone: process.env.AVAILABILITY_ZONE,
      InstanceType: process.env.INSTANCE_TYPE,
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
