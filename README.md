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

## Enhanced Workflow Logic

### Proactive Health Checking
The system now includes intelligent health checking using **Zabbix Agent monitoring** before proceeding with failover:

1. **Health Check Execution**: Uses SSM Run Command to execute PowerShell scripts on Windows instances
2. **Zabbix Agent Verification**: Checks service status and port 10050 listening state
3. **Conservative Decision Logic**: Proceeds with failover **only if ALL instances are unhealthy**
4. **False Alarm Prevention**: Skips unnecessary migrations when instances are actually healthy

### Health Check Decision Matrix
- **All instances healthy**: Skip migration, send healthy notification
- **Some instances healthy**: Skip migration (conservative approach)
- **All instances unhealthy**: Proceed with full migration
- **Health check errors**: Proceed with migration (fail-safe)

### Healthy Notification Management
To prevent duplicate notifications for the same host:

#### First Execution (Notification Not Sent):
```
MarkHostHealthy → CheckHealthyNotificationSent → SendHealthyNotification → UpdateHealthyNotificationSent → HealthyExit
```

#### Subsequent Executions (Notification Already Sent):
```
MarkHostHealthy → CheckHealthyNotificationSent → HealthyExit (SKIP notification)
```

### Enhanced DynamoDB Schema with Notification Tracking

#### Before Healthy Notification:
```json
{
  "hostId": "h-0b792777f81cafb12",
  "state": "healthy",
  "timestamp": "2025-07-11T06:00:00Z",
  "healthCheckResults": {
    "totalInstances": 3,
    "healthyInstances": 3,
    "checkTimestamp": "2025-07-11T06:00:00Z"
  }
}
```

#### After Healthy Notification:
```json
{
  "hostId": "h-0b792777f81cafb12", 
  "state": "healthy",
  "timestamp": "2025-07-11T06:00:00Z",
  "healthCheckResults": {
    "totalInstances": 3,
    "healthyInstances": 3,
    "checkTimestamp": "2025-07-11T06:00:00Z"
  },
  "HealthyNotificationSent": true,
  "HealthyNotificationTimestamp": "2025-07-11T06:00:15Z"
}
```

#### Migration Completion Record:
```json
{
  "hostId": "h-0b792777f81cafb12",
  "state": "complete",
  "timestamp": "2025-07-11T06:30:00Z",
  "completedTime": "2025-07-11T06:30:00Z",
  "expirationTime": "2025-07-18T06:30:00Z",
  "migrationSummary": {
    "totalInstances": 3,
    "successfulMigrations": 3,
    "failedMigrations": 0,
    "targetHostId": "h-0fedcba0987654321"
  },
  "instanceMigrations": {
    "i-1111111111111111": {
      "status": "success",
      "startTime": "2025-07-11T06:15:00Z",
      "endTime": "2025-07-11T06:18:00Z",
      "retryCount": 0
    }
  }
}
```

### State Transition Flow
The `state` field in DynamoDB tracks the complete lifecycle:

```
[Initial] → processing → [Health Check Decision] → healthy/complete/failed
```

- **processing**: Migration actively running
- **healthy**: False alarm detected, no migration needed
- **complete**: Migration successful with TTL for cleanup
- **failed**: Migration failed, manual intervention may be needed

## Intelligent Re-evaluation and Notification Management

### Design Intention

The system implements an intelligent approach to handle repeated CloudWatch alarms while preventing notification spam and ensuring continuous health monitoring. The core principle is to **allow health re-evaluation on every alarm while preventing duplicate notifications** for the same health status.

### Key Design Principles

#### **1. Continuous Health Monitoring**
- **Every alarm triggers fresh evaluation**: Each CloudWatch alarm initiates a new health check regardless of previous results
- **Current status assessment**: Always evaluates the present health condition of instances
- **No blocking of health checks**: Previous healthy status doesn't prevent new assessments

#### **2. Smart Notification Management**
- **One notification per health state**: Healthy notifications are sent only once per host
- **Persistent flag approach**: `HealthyNotificationSent` flag remains `true` across multiple evaluations
- **Spam prevention**: Eliminates duplicate "instances are healthy" emails

#### **3. Appropriate Failover Response**
- **Failover when needed**: When health actually degrades, migration proceeds with proper notifications
- **Conservative approach**: Only migrates when ALL instances are confirmed unhealthy
- **Separate notification streams**: Migration notifications are independent of healthy notifications

### Implementation Architecture

#### **AlarmHandler Re-evaluation Logic**
```javascript
if (existingItem.HealthyNotificationSent === true) {
  // Allow re-evaluation - health status may have changed since last check
  // Start new workflow execution to assess current conditions
}
```

#### **Notification Deduplication Logic**
```javascript
if (migrationRecord.HealthyNotificationSent === true) {
  // Skip healthy notification - already informed administrators
  // Proceed directly to HealthyExit
}
```

### Workflow Behavior Scenarios

#### **Scenario 1: Repeated Alarms with Consistently Healthy Instances**
```
1st Alarm: No record → Health check → Instances healthy → Send notification → Set flag=true
2nd Alarm: Flag=true → Allow re-evaluation → Health check → Instances healthy → Skip notification
3rd Alarm: Flag=true → Allow re-evaluation → Health check → Instances healthy → Skip notification
...
```
**Outcome**: Continuous monitoring with single notification

#### **Scenario 2: Health Status Degradation**
```
Previous: Flag=true (instances were healthy)
New Alarm: Allow re-evaluation → Health check → Instances unhealthy → Proceed with failover
```
**Outcome**: Appropriate migration with migration-specific notifications

#### **Scenario 3: Intermittent Issues**
```
Alarm 1: Healthy → Notification sent → Flag=true
Alarm 2: Still healthy → No notification (flag prevents spam)
Alarm 3: Now unhealthy → Migration proceeds → Migration notifications sent
```
**Outcome**: System responds appropriately to actual degradation

### Benefits of This Design

#### **✅ Operational Efficiency**
- **Reduced notification noise**: Administrators receive relevant alerts only
- **Continuous vigilance**: Every alarm triggers health assessment
- **Cost optimization**: Prevents unnecessary migrations while maintaining monitoring

#### **✅ System Reliability**
- **No false negatives**: Health degradation is always detected and acted upon
- **No race conditions**: Flag-based approach prevents concurrent execution conflicts
- **Audit trail**: Complete history of health assessments and decisions

#### **✅ User Experience**
- **Clear communication**: Single healthy notification per host state
- **Actionable alerts**: Migration notifications contain detailed failure information
- **Predictable behavior**: Consistent response to alarm patterns

### DynamoDB State Management

#### **Healthy State with Notification Flag**
```json
{
  "hostId": "h-0123456789abcdef0",
  "state": "healthy",
  "HealthyNotificationSent": true,
  "HealthyNotificationTimestamp": "2025-07-11T06:00:15Z",
  "healthCheckResults": {
    "totalInstances": 3,
    "healthyInstances": 3,
    "checkTimestamp": "2025-07-11T06:00:00Z"
  }
}
```

#### **Processing State (During Re-evaluation)**
```json
{
  "hostId": "h-0123456789abcdef0",
  "state": "processing",
  "HealthyNotificationSent": true,  // Preserved from previous evaluation
  "timestamp": "2025-07-11T07:00:00Z"
}
```

### Monitoring and Troubleshooting

#### **Expected Log Patterns**

**For Re-evaluation (No Notification):**
```
Host h-001a380d750b70915 has HealthyNotificationSent=true, allowing re-evaluation
Previous health check may be outdated, starting new workflow execution
Health check analysis: some-instances-healthy
CheckHealthyNotificationSent: alreadySent = true, reason = notification-already-sent
Workflow: HealthyExit (no notification sent)
```

**For Actual Failover:**
```
Host h-001a380d750b70915 has HealthyNotificationSent=true, allowing re-evaluation
Health check analysis: all-instances-unhealthy
Workflow: Proceeding with migration (bypasses healthy notification check)
Migration notifications: Detailed failure and recovery information sent
```

### Configuration Considerations

- **Alarm sensitivity**: Configure CloudWatch alarms appropriately to balance responsiveness with noise
- **Health check criteria**: Zabbix Agent service running and port 10050 listening
- **Conservative failover**: ALL instances must be unhealthy to trigger migration
- **Notification channels**: Separate SNS topics for healthy vs. migration notifications

This design ensures that the system remains vigilant and responsive while providing a clean, spam-free notification experience for operations teams.

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

The stack now uses environment variables for configuration. Set the following required environment variables before deployment:

#### Required Environment Variables

```bash
# Email address to receive notifications
export ALERT_EMAIL="admin@company.com"

# Availability zone for reserved hosts (must match the region)
export AVAILABILITY_ZONE="ap-northeast-1a"

# AWS region for deployment
export AWS_REGION="ap-northeast-1"
```

#### Optional Configuration

You can also create a `.env` file for easier management:

```bash
# Copy the example file
cp .env.example .env

# Edit with your values
nano .env

# Source the environment variables
source .env
```

#### Legacy Configuration (Deprecated)

The old method of editing `bin/202506-dh-failover-stepfunction.ts` directly is no longer recommended. The following values are now configured via environment variables:

- ~~`alertEmail`~~ → Use `ALERT_EMAIL` environment variable
- ~~`availabilityZone`~~ → Use `AVAILABILITY_ZONE` environment variable  
- ~~`region`~~ → Use `AWS_REGION` environment variable
- `instanceType`: Still hardcoded as `c5.large` (can be modified in the file if needed)
- `dedicatedHostIds`: Still configured in the file (optional)

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
