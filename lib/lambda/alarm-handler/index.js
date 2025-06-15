const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();
const stepfunctions = new AWS.StepFunctions();

/**
 * Handle CloudWatch alarms for dedicated host failures
 */
exports.handler = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));
  
  try {
    // Parse the SNS message
    const message = event.Records[0].Sns.Message;
    const alarmData = JSON.parse(message);
    
    // Extract the host ID from the alarm
    const hostId = extractHostIdFromAlarm(alarmData);
    
    if (!hostId) {
      console.error('Could not extract host ID from alarm data');
      return;
    }
    
    console.log(`Extracted host ID: ${hostId}`);
    
    // Check if this host is already in the queue
    const existingItem = await checkHostInQueue(hostId);
    
    if (existingItem) {
      console.log(`Host ${hostId} is already in the queue with state: ${existingItem.State}`);
      return;
    }
    
    // Add the host to the queue
    await addHostToQueue(hostId);
    
    // Start the Step Functions execution
    await startMigrationWorkflow(hostId);
    
    return {
      statusCode: 200,
      body: `Successfully processed alarm for host ${hostId}`
    };
  } catch (error) {
    console.error('Error processing alarm:', error);
    throw error;
  }
};

/**
 * Extract the host ID from the CloudWatch alarm data
 */
function extractHostIdFromAlarm(alarmData) {
  // Try to extract from dimensions
  if (alarmData.Trigger && alarmData.Trigger.Dimensions) {
    const hostDimension = alarmData.Trigger.Dimensions.find(dim => dim.name === 'HostId');
    if (hostDimension) {
      return hostDimension.value;
    }
  }
  
  // Try to extract from the alarm name
  if (alarmData.AlarmName) {
    const match = alarmData.AlarmName.match(/host-([h-][a-zA-Z0-9]+)/);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Check if a host is already in the queue
 */
async function checkHostInQueue(hostId) {
  const response = await dynamodb.get({
    TableName: process.env.QUEUE_TABLE_NAME,
    Key: { HostId: hostId }
  }).promise();
  
  return response.Item;
}

/**
 * Add a host to the migration queue
 */
async function addHostToQueue(hostId) {
  await dynamodb.put({
    TableName: process.env.QUEUE_TABLE_NAME,
    Item: {
      HostId: hostId,
      State: 'pending',
      CreatedAt: Math.floor(Date.now() / 1000),
      UpdatedAt: Math.floor(Date.now() / 1000)
    }
  }).promise();
}

/**
 * Start the Step Functions migration workflow
 */
async function startMigrationWorkflow(hostId) {
  await stepfunctions.startExecution({
    stateMachineArn: process.env.MIGRATION_STATE_MACHINE_ARN,
    input: JSON.stringify({
      hostId: hostId
    }),
    name: `host-migration-${hostId}-${Date.now()}`
  }).promise();
}
