const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

/**
 * Update the host migration status in DynamoDB
 */
exports.handler = async (event) => {
  console.log('Updating host status:', event.hostId, 'to', event.status);
  
  try {
    const updateParams = {
      TableName: process.env.QUEUE_TABLE_NAME,
      Key: { HostId: event.hostId },
      UpdateExpression: 'SET #state = :state, UpdatedAt = :now',
      ExpressionAttributeNames: {
        '#state': 'State'
      },
      ExpressionAttributeValues: {
        ':state': event.status,
        ':now': Math.floor(Date.now() / 1000)
      }
    };
    
    // Add expiration time if requested (for completed migrations)
    if (event.expirationTime) {
      const expirationTime = Math.floor(Date.now() / 1000) + (48 * 60 * 60); // 48 hours
      updateParams.UpdateExpression += ', ExpirationTime = :exp';
      updateParams.ExpressionAttributeValues[':exp'] = expirationTime;
    }
    
    await dynamodb.update(updateParams).promise();
    
    return {
      hostId: event.hostId,
      status: event.status,
      updatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error updating status:', error);
    throw error;
  }
};
