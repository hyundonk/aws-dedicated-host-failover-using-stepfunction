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
 * Initialize migration record with enhanced schema
 * @param {string} hostId - The problematic host ID
 * @param {string} reservedHostId - The replacement host ID
 * @param {Array<string>} instanceIds - Array of instance IDs to migrate
 * @returns {Promise<void>}
 */
async function initializeMigrationRecord(hostId, reservedHostId, instanceIds) {
  const instanceMigrations = {};
  instanceIds.forEach(instanceId => {
    instanceMigrations[instanceId] = {
      status: 'pending',
      startTime: null,
      endTime: null,
      errorMessage: null,
      retryCount: 0
    };
  });

  const updateParams = {
    TableName: process.env.QUEUE_TABLE_NAME,
    Key: { HostId: hostId },
    UpdateExpression: `SET 
      ReservedHostId = :reservedHostId,
      InstanceMigrations = :instanceMigrations,
      TotalInstances = :totalInstances,
      SuccessfulMigrations = :successfulMigrations,
      FailedMigrations = :failedMigrations,
      UpdatedAt = :now`,
    ExpressionAttributeValues: {
      ':reservedHostId': reservedHostId,
      ':instanceMigrations': instanceMigrations,
      ':totalInstances': instanceIds.length,
      ':successfulMigrations': 0,
      ':failedMigrations': 0,
      ':now': Math.floor(Date.now() / 1000)
    }
  };
  
  await dynamodb.update(updateParams).promise();
}

/**
 * Update individual instance migration status
 * @param {string} hostId - The host ID
 * @param {string} instanceId - The instance ID
 * @param {string} status - The new status (pending, in-progress, success, failed)
 * @param {string} errorMessage - Optional error message
 * @returns {Promise<void>}
 */
async function updateInstanceMigrationStatus(hostId, instanceId, status, errorMessage = null) {
  const now = new Date().toISOString();
  let updateExpression = `SET 
    InstanceMigrations.#instanceId.#status = :status,
    UpdatedAt = :now`;
  
  const expressionAttributeNames = {
    '#instanceId': instanceId,
    '#status': 'status'
  };
  
  const expressionAttributeValues = {
    ':status': status,
    ':now': Math.floor(Date.now() / 1000)
  };

  // Set start time for in-progress status
  if (status === 'in-progress') {
    updateExpression += ', InstanceMigrations.#instanceId.startTime = :startTime';
    expressionAttributeValues[':startTime'] = now;
  }

  // Set end time and error message for completed statuses
  if (status === 'success' || status === 'failed') {
    updateExpression += ', InstanceMigrations.#instanceId.endTime = :endTime';
    expressionAttributeValues[':endTime'] = now;
    
    if (errorMessage) {
      updateExpression += ', InstanceMigrations.#instanceId.errorMessage = :errorMessage';
      expressionAttributeValues[':errorMessage'] = errorMessage;
    }
  }

  // Update counters based on status
  if (status === 'success') {
    updateExpression += ', SuccessfulMigrations = SuccessfulMigrations + :one';
    expressionAttributeValues[':one'] = 1;
  } else if (status === 'failed') {
    updateExpression += ', FailedMigrations = FailedMigrations + :one';
    expressionAttributeValues[':one'] = 1;
  }

  await dynamodb.update({
    TableName: process.env.QUEUE_TABLE_NAME,
    Key: { HostId: hostId },
    UpdateExpression: updateExpression,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues
  }).promise();
}

/**
 * Increment retry count for an instance
 * @param {string} hostId - The host ID
 * @param {string} instanceId - The instance ID
 * @returns {Promise<void>}
 */
async function incrementInstanceRetryCount(hostId, instanceId) {
  await dynamodb.update({
    TableName: process.env.QUEUE_TABLE_NAME,
    Key: { HostId: hostId },
    UpdateExpression: 'SET InstanceMigrations.#instanceId.retryCount = InstanceMigrations.#instanceId.retryCount + :one, UpdatedAt = :now',
    ExpressionAttributeNames: {
      '#instanceId': instanceId
    },
    ExpressionAttributeValues: {
      ':one': 1,
      ':now': Math.floor(Date.now() / 1000)
    }
  }).promise();
}

/**
 * Get migration record with enhanced details
 * @param {string} hostId - The host ID
 * @returns {Promise<Object>} - Migration record
 */
async function getMigrationRecord(hostId) {
  const response = await dynamodb.get({
    TableName: process.env.QUEUE_TABLE_NAME,
    Key: { HostId: hostId }
  }).promise();
  
  return response.Item;
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
  initializeMigrationRecord,
  updateInstanceMigrationStatus,
  incrementInstanceRetryCount,
  getMigrationRecord,
  sendAlert,
  findReservedHost,
  getInstancesOnHost,
  getInstanceState,
  removeReservedTag
};
