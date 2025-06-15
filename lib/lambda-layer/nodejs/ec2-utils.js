const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();
const ec2 = new AWS.EC2();
const sns = new AWS.SNS();

/**
 * Update the host state in DynamoDB
 * @param {string} hostId - The host ID
 * @param {string} state - The new state
 * @returns {Promise<void>}
 */
async function updateHostState(hostId, state) {
  const updateParams = {
    TableName: process.env.QUEUE_TABLE_NAME,
    Key: { HostId: hostId },
    UpdateExpression: 'SET #state = :state, UpdatedAt = :now',
    ExpressionAttributeNames: {
      '#state': 'State'
    },
    ExpressionAttributeValues: {
      ':state': state,
      ':now': Math.floor(Date.now() / 1000)
    }
  };
  
  await dynamodb.update(updateParams).promise();
}

/**
 * Send an alert notification
 * @param {string} message - The alert message
 * @param {string} subject - Optional subject line
 * @returns {Promise<void>}
 */
async function sendAlert(message, subject = 'EC2 Dedicated Host Failover Alert') {
  await sns.publish({
    TopicArn: process.env.ALERT_TOPIC_ARN,
    Subject: subject,
    Message: message
  }).promise();
}

/**
 * Find a reserved dedicated host
 * @returns {Promise<string|null>} - The host ID or null if none found
 */
async function findReservedHost() {
  const response = await ec2.describeHosts({
    Filter: [
      {
        Name: 'state',
        Values: ['available']
      },
      {
        Name: 'tag:Role',
        Values: ['Reserved']
      }
    ]
  }).promise();
  
  if (response.Hosts && response.Hosts.length > 0) {
    return response.Hosts[0].HostId;
  }
  return null;
}

/**
 * Get instances on a dedicated host
 * @param {string} hostId - The host ID
 * @returns {Promise<Array>} - Array of instance objects
 */
async function getInstancesOnHost(hostId) {
  const response = await ec2.describeInstances({
    Filters: [
      {
        Name: 'host-id',
        Values: [hostId]
      }
    ]
  }).promise();
  
  const instances = [];
  
  if (response.Reservations) {
    for (const reservation of response.Reservations) {
      if (reservation.Instances) {
        for (const instance of reservation.Instances) {
          instances.push(instance);
        }
      }
    }
  }
  
  return instances;
}

/**
 * Check the state of an EC2 instance
 * @param {string} instanceId - The instance ID
 * @returns {Promise<string>} - The instance state
 */
async function getInstanceState(instanceId) {
  const response = await ec2.describeInstances({
    InstanceIds: [instanceId]
  }).promise();
  
  if (response.Reservations && 
      response.Reservations[0].Instances && 
      response.Reservations[0].Instances[0].State) {
    return response.Reservations[0].Instances[0].State.Name;
  }
  
  throw new Error(`Unable to get state for instance ${instanceId}`);
}

/**
 * Remove the Reserved tag from a dedicated host
 * @param {string} hostId - The host ID
 * @returns {Promise<void>}
 */
async function removeReservedTag(hostId) {
  await ec2.deleteTags({
    Resources: [hostId],
    Tags: [
      {
        Key: 'Role',
        Value: 'Reserved'
      }
    ]
  }).promise();
}

module.exports = {
  updateHostState,
  sendAlert,
  findReservedHost,
  getInstancesOnHost,
  getInstanceState,
  removeReservedTag
};
