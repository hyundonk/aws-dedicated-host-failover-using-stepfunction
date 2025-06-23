const AWS = require('aws-sdk');
const { getMigrationRecord } = require('/opt/nodejs/ec2-utils');
const dynamodb = new AWS.DynamoDB.DocumentClient();

/**
 * Update the host migration status in DynamoDB
 */
exports.handler = async (event) => {
  console.log('Updating host status:', event.hostId, 'to', event.status);
  
  try {
    // Get current migration record to preserve enhanced fields
    const currentRecord = await getMigrationRecord(event.hostId);
    
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
    
    // Add error information if provided
    if (event.error) {
      updateParams.UpdateExpression += ', ErrorDetails = :error';
      updateParams.ExpressionAttributeValues[':error'] = event.error;
    }
    
    await dynamodb.update(updateParams).promise();
    
    // Return enhanced status information if available
    const result = {
      hostId: event.hostId,
      status: event.status,
      updatedAt: new Date().toISOString()
    };
    
    // Include migration statistics if available
    if (currentRecord && currentRecord.TotalInstances !== undefined) {
      result.migrationSummary = {
        totalInstances: currentRecord.TotalInstances || 0,
        successfulMigrations: currentRecord.SuccessfulMigrations || 0,
        failedMigrations: currentRecord.FailedMigrations || 0,
        reservedHostId: currentRecord.ReservedHostId
      };
    }
    
    return result;
  } catch (error) {
    console.error('Error updating status:', error);
    throw error;
  }
};
