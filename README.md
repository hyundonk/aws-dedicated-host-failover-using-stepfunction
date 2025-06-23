# EC2 Dedicated Host Failover Solution with Step Functions

This project implements an automated failover solution for EC2 dedicated hosts using AWS Step Functions. When a dedicated host enters an unhealthy state (detected via CloudWatch alarms), the system automatically migrates all EC2 instances to a reserved dedicated host with **enhanced instance-level tracking and detailed migration status**.

## Architecture

The solution consists of the following components:

1. **CloudWatch Alarms** - Monitor EC2 dedicated host health
2. **SNS Topic** - Receive alarm notifications
3. **Lambda Function (Alarm Handler)** - Parse alarms and initiate Step Functions workflow
4. **DynamoDB Table** - Store queue of hosts requiring migration and track detailed migration status
5. **Step Functions State Machine** - Orchestrate the migration process with instance-level tracking
6. **Lambda Functions** - Handle individual steps of the migration process
7. **SNS Topic** - Send email notifications for failures/successes with detailed statistics

## Enhanced Features

### Instance-Level Tracking
- **Individual Instance Status**: Track each instance's migration progress separately
- **Detailed Error Handling**: Specific error messages and retry counts per instance
- **Real-time Progress**: Monitor migration progress with percentage completion
- **Migration Statistics**: Comprehensive success/failure counts and timing

### Enhanced Email Notifications
- **Detailed Instance Information**: Email notifications now include comprehensive instance-level details
- **Rich Formatting**: Clear, well-structured messages with emojis and sections
- **Timing Information**: Start time, end time, and duration for each instance migration
- **Error Details**: Specific error messages and retry counts for failed instances
- **Actionable Recommendations**: Troubleshooting guidance for failures

### Enhanced DynamoDB Schema
- **ReservedHostId**: ID of the replacement dedicated host
- **InstanceMigrations**: Map containing detailed status for each instance
- **TotalInstances**: Count of instances to migrate
- **SuccessfulMigrations**: Count of successful migrations
- **FailedMigrations**: Count of failed migrations

For detailed information about enhanced features, see [ENHANCED_FEATURES.md](./ENHANCED_FEATURES.md).

## Workflow

1. When a dedicated host enters an unhealthy state, CloudWatch triggers an alarm
2. The alarm notification is sent to an SNS topic
3. The Alarm Handler Lambda function processes the notification, extracts the host ID, adds it to the DynamoDB queue, and starts a Step Functions execution
4. The Step Functions workflow:
   - Initializes the migration with enhanced tracking
   - Checks for an available reserved dedicated host
   - Provisions a new host if none is available
   - Gets all instances on the failing host and initializes instance-level tracking
   - For each instance:
     - **Updates instance status to "in-progress"**
     - Stops the instance
     - Waits for the instance to stop
     - Modifies the instance placement to the reserved host
     - Starts the instance
     - Waits for the instance to start
     - **Updates instance status to "success" or "failed" with detailed error information**
   - Updates the overall migration status with statistics
   - Removes the "Reserved" tag from the new host
   - Sends notifications about the migration result with detailed statistics
5. Successfully migrated hosts are automatically removed from the queue

## Deployment

### Prerequisites

- AWS CDK installed (`npm install -g aws-cdk`)
- Node.js and npm
- AWS CLI configured with appropriate credentials

### Lambda Layer Dependencies

The Lambda layer requires its own dependencies. Before deployment, install them:

```bash
cd lib/lambda-layer/nodejs
npm install
cd ../../..
```

### Configuration

Edit the `bin/202506-dh-failover-stepfunction.ts` file to configure:

- `alertEmail`: Email address to receive notifications
- `availabilityZone`: Availability zone for reserved hosts
- `instanceType`: Instance type for reserved hosts
- `dedicatedHostIds`: (Optional) Array of dedicated host IDs to monitor

### Deploy the Stack

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Deploy to AWS
cdk deploy
```

## Enhanced Monitoring and Querying

### Query Migration Status

Use the new `GetMigrationStatusFunction` to get detailed migration information:

```bash
aws lambda invoke \
  --function-name <GetMigrationStatusFunctionName> \
  --payload '{"hostId": "h-1234567890abcdef0"}' \
  response.json
```

### Sample Enhanced Response

```json
{
  "hostId": "h-1234567890abcdef0",
  "state": "processing",
  "reservedHostId": "h-0fedcba0987654321",
  "migrationSummary": {
    "totalInstances": 3,
    "successfulMigrations": 2,
    "failedMigrations": 0,
    "inProgressMigrations": 1,
    "progressPercentage": 67
  },
  "instanceMigrations": {
    "i-1111111111111111": {
      "status": "success",
      "startTime": "2025-06-22T04:00:00Z",
      "endTime": "2025-06-22T04:03:00Z",
      "retryCount": 0
    }
  }
}
```

## Customization

### CloudWatch Alarms

The stack includes CloudWatch alarms that monitor the `StatusCheckFailed` metric for dedicated hosts. You should configure these to monitor your specific dedicated hosts:

1. Edit `bin/202506-dh-failover-stepfunction.ts`
2. Add your dedicated host IDs to the `dedicatedHostIds` array
3. If no host IDs are provided, a placeholder alarm is created that you should replace

### Reserved Host Configuration

To customize the reserved host configuration:

1. Edit `lib/lambda/provision-reserved-host/index.js`
2. Modify the EC2 allocation parameters as needed

## Monitoring and Maintenance

- **Enhanced DynamoDB Tracking**: Check the DynamoDB table to view detailed migration status for each instance
- **CloudWatch Logs**: Contain detailed logs from all Lambda functions with instance-level information
- **Step Functions Console**: Provides visual workflow monitoring with enhanced error details
- **Enhanced SNS Notifications**: Email notifications now include detailed migration statistics and progress information
- **Migration Status API**: Use the GetMigrationStatusFunction for programmatic status queries

## Security Considerations

- All Lambda functions have least-privilege IAM permissions
- DynamoDB uses on-demand billing mode with default encryption
- SNS topics are used for notifications and Lambda triggers
- Step Functions state machine uses standard workflow type for better security and visibility
- Enhanced error handling prevents sensitive information leakage

## Cost Optimization

- DynamoDB uses on-demand capacity to minimize costs
- Lambda functions are only invoked when needed
- Step Functions standard workflow is billed per state transition
- CloudWatch alarms are configured with appropriate thresholds
- Enhanced tracking adds minimal overhead to existing operations

## Troubleshooting

- **Enhanced Error Tracking**: Check CloudWatch Logs for detailed instance-level error information
- **Migration Status Queries**: Use the GetMigrationStatusFunction to get real-time status
- **Instance-Level Debugging**: Review individual instance migration details in DynamoDB
- Verify that CloudWatch alarms are correctly configured
- Ensure SNS subscriptions are confirmed
- Check IAM permissions if migrations fail
- Review Step Functions execution history for detailed error information with instance context

## Architecture Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  CloudWatch     │────▶│    SNS Topic    │────▶│  Alarm Handler  │
│    Alarms       │     │                 │     │     Lambda      │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Enhanced      │◀───▶│  Step Functions │◀────│  Start Workflow │
│   DynamoDB      │     │ State Machine   │     │                 │
│   (Instance     │     │ (Enhanced)      │     └─────────────────┘
│   Tracking)     │     └────────┬────────┘
└─────────────────┘              │
                                 ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Enhanced       │     │  EC2 Instance   │     │  Enhanced SNS   │
│  Lambda         │────▶│   Migration     │────▶│  Notifications  │
│  Functions      │     │  (Per Instance) │     │  (Statistics)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Lambda Layer

The project includes a Lambda layer with enhanced utilities for EC2 operations:

- `ec2-utils.js` - Contains helper functions for EC2 operations, enhanced DynamoDB updates, SNS notifications, and instance-level tracking

## New Lambda Functions

1. **UpdateInstanceMigrationStatusFunction** - Updates individual instance migration status
2. **GetMigrationStatusFunction** - Queries detailed migration status with statistics
3. **PrepareDetailedNotificationFunction** - Generates detailed email notifications with instance-level information

## License

This project is licensed under the MIT License - see the LICENSE file for details.
