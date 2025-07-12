const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const TABLE_NAME = process.env.QUEUE_TABLE_NAME;

/**
 * Update DynamoDB to mark that healthy notification has been sent
 */
exports.handler = async (event) => {
  console.log('=== UpdateHealthyNotificationSent Function Started ===');
  console.log('Event received:', JSON.stringify(event, null, 2));
  console.log('Table name:', TABLE_NAME);
  console.log('Updating healthy notification sent status for host:', event.hostId);
  
  try {
    const updateParams = {
      TableName: TABLE_NAME,
      Key: {
        HostId: event.hostId  // Use HostId (capital H) to match table schema
      },
      UpdateExpression: 'SET HealthyNotificationSent = :sent, HealthyNotificationTimestamp = :timestamp',
      ExpressionAttributeValues: {
        ':sent': true,
        ':timestamp': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    };
    
    console.log('DynamoDB update parameters:', JSON.stringify(updateParams, null, 2));
    
    const result = await dynamodb.update(updateParams).promise();
    
    console.log('DynamoDB update successful!');
    console.log('Updated record:', JSON.stringify(result.Attributes, null, 2));
    
    const response = {
      hostId: event.hostId,
      updated: true,
      timestamp: result.Attributes.HealthyNotificationTimestamp,
      record: result.Attributes
    };
    
    console.log('Function response:', JSON.stringify(response, null, 2));
    console.log('=== UpdateHealthyNotificationSent Function Completed Successfully ===');
    
    return response;
    
  } catch (error) {
    console.error('=== ERROR in UpdateHealthyNotificationSent Function ===');
    console.error('Error details:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    const errorResponse = {
      hostId: event.hostId,
      updated: false,
      error: error.message,
      errorDetails: {
        code: error.code,
        statusCode: error.statusCode,
        retryable: error.retryable
      }
    };
    
    console.log('Error response:', JSON.stringify(errorResponse, null, 2));
    console.log('=== UpdateHealthyNotificationSent Function Failed ===');
    
    return errorResponse;
  }
};
