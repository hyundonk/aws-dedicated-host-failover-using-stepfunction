# Enhanced DynamoDB Schema and Instance-Level Tracking

This document describes the enhanced features added to the EC2 Dedicated Host Failover solution.

## Enhanced Email Notifications

The email notifications now include comprehensive instance-level details instead of just summary information.

### Before (Simple Notification)
```
Subject: EC2 Dedicated Host Failover - Migration Successful
Message: Successfully migrated all instances from dedicated host h-0e2e58fd82f8fd04c to h-0a2d4fda63c688801. Migration summary: 2 total instances, 2 successful, 0 failed.
```

### After (Detailed Notification)
```
Subject: EC2 Dedicated Host Failover - Migration Successful
Message: 
✅ MIGRATION SUCCESSFUL

Successfully migrated all instances from dedicated host h-1234567890abcdef0 to h-0fedcba0987654321.

📊 MIGRATION SUMMARY:
• Total Instances: 3
• Successful Migrations: 2
• Failed Migrations: 1
• Success Rate: 67%

🔍 INSTANCE MIGRATION DETAILS:

✅ Successfully Migrated Instances (2):
• i-1111111111111111
  - Start Time: 2025-06-22 04:00:00 UTC
  - End Time: 2025-06-22 04:03:00 UTC
  - Duration: 3m 0s
  - Retry Count: 0

• i-2222222222222222
  - Start Time: 2025-06-22 04:03:30 UTC
  - End Time: 2025-06-22 04:06:30 UTC
  - Duration: 3m 0s
  - Retry Count: 1

❌ Failed Instances (1):
• i-3333333333333333
  - Error: Instance failed to start after placement modification
  - Retry Count: 3

🏁 Migration completed successfully at 2025-06-22T05:14:09.033Z

For more details, check the AWS Step Functions console or DynamoDB migration table.
```

### Notification Types

1. **Success Notifications**: Include detailed instance migration information with timing and retry counts
2. **Partial Failure Notifications**: Show both successful and failed instances with specific error messages
3. **Complete Failure Notifications**: Focus on failed instances with troubleshooting recommendations
4. **Custom Notifications**: Support for special cases like "no instances to migrate"

## Enhanced DynamoDB Schema

The DynamoDB table now includes the following additional fields:

### New Fields

| Field Name | Type | Description |
|------------|------|-------------|
| `ReservedHostId` | String | ID of the replacement dedicated host |
| `InstanceMigrations` | Map | Detailed migration status for each instance |
| `TotalInstances` | Number | Total count of instances to migrate |
| `SuccessfulMigrations` | Number | Count of successfully migrated instances |
| `FailedMigrations` | Number | Count of failed instance migrations |
| `ErrorDetails` | String | Overall error details if migration fails |

### Instance Migration Schema

Each entry in `InstanceMigrations` follows this structure:

```json
{
  "i-1234567890abcdef0": {
    "status": "pending|in-progress|success|failed",
    "startTime": "2025-06-22T04:00:00Z",
    "endTime": "2025-06-22T04:05:00Z",
    "errorMessage": "Optional error details",
    "retryCount": 0
  }
}
```

## New Lambda Functions

### 1. UpdateInstanceMigrationStatusFunction

**Purpose**: Update individual instance migration status
**Location**: `lib/lambda/update-instance-migration-status/`

**Input Parameters**:
- `hostId`: The problematic host ID
- `instanceId`: The instance being migrated
- `status`: New status (pending, in-progress, success, failed)
- `errorMessage`: Optional error message
- `incrementRetry`: Boolean to increment retry count

### 2. GetMigrationStatusFunction

**Purpose**: Query detailed migration status
**Location**: `lib/lambda/get-migration-status/`

**Input Parameters**:
- `hostId`: The host ID to query

**Output**: Detailed migration status including:
- Overall migration state
- Reserved host ID
- Migration summary with counts and progress percentage
- Individual instance migration details

### 3. PrepareDetailedNotificationFunction

**Purpose**: Generate detailed email notification messages with instance-level information
**Location**: `lib/lambda/prepare-detailed-notification/`

**Input Parameters**:
- `hostId`: The host ID for the migration
- `notificationType`: Type of notification (success, failure, partial)
- `failedInstances`: Array of failed instance IDs (optional)
- `customMessage`: Custom message override (optional)
- `errorMessage`: Error message for provision failures (optional)

**Features**:
- Rich formatting with emojis and clear sections
- Instance-level timing and duration calculations
- Error message details and retry counts
- Actionable recommendations for failures
- Support for different notification scenarios
- Migration summary with counts and progress percentage
- Individual instance migration details

## Enhanced Step Functions Workflow

The Step Functions workflow now includes:

1. **Instance-Level Status Tracking**: Each instance migration is tracked individually
2. **Enhanced Error Handling**: Specific error messages per instance
3. **Progress Monitoring**: Real-time progress updates
4. **Detailed Notifications**: Enhanced SNS messages with migration statistics

### New States Added

- `UpdateInstanceStatusToInProgress`: Mark instance as in-progress
- `UpdateInstanceStatusToSuccess`: Mark instance as successfully migrated
- `HandleInstanceMigrationFailure`: Handle individual instance failures with detailed error tracking
- `UpdateFailedInstancesList`: Maintain list of failed instances

## Enhanced Lambda Layer Utilities

New utility functions added to `ec2-utils.js`:

### `initializeMigrationRecord(hostId, reservedHostId, instanceIds)`
Initializes the enhanced DynamoDB record with instance tracking

### `updateInstanceMigrationStatus(hostId, instanceId, status, errorMessage)`
Updates individual instance migration status

### `incrementInstanceRetryCount(hostId, instanceId)`
Increments retry count for an instance

### `getMigrationRecord(hostId)`
Retrieves complete migration record with enhanced details

## Usage Examples

### Query Migration Status

```bash
aws lambda invoke \
  --function-name GetMigrationStatusFunction \
  --payload '{"hostId": "h-1234567890abcdef0"}' \
  response.json
```

### Sample Response

```json
{
  "hostId": "h-1234567890abcdef0",
  "state": "processing",
  "reservedHostId": "h-0fedcba0987654321",
  "createdAt": 1719028800,
  "updatedAt": 1719029100,
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
      "errorMessage": null,
      "retryCount": 0
    },
    "i-2222222222222222": {
      "status": "success",
      "startTime": "2025-06-22T04:03:30Z",
      "endTime": "2025-06-22T04:06:30Z",
      "errorMessage": null,
      "retryCount": 0
    },
    "i-3333333333333333": {
      "status": "in-progress",
      "startTime": "2025-06-22T04:07:00Z",
      "endTime": null,
      "errorMessage": null,
      "retryCount": 0
    }
  }
}
```

## Benefits

1. **Detailed Visibility**: Complete tracking of each instance's migration status
2. **Better Error Handling**: Specific error messages and retry tracking per instance
3. **Progress Monitoring**: Real-time progress updates and percentage completion
4. **Enhanced Reporting**: Detailed migration statistics and summaries
5. **Improved Troubleshooting**: Easy identification of problematic instances
6. **Operational Metrics**: Better data for monitoring and alerting

## Backward Compatibility

The enhanced schema maintains backward compatibility with existing records:
- Old records without enhanced fields continue to work
- New fields are optional and have default values
- Existing Lambda functions continue to function normally

## Monitoring and Alerting

Enhanced SNS notifications now include:
- Total instance counts
- Success/failure statistics
- Detailed error information
- Migration progress updates

## Deployment Notes

1. The enhanced schema is automatically applied to new migration records
2. Existing records are gradually enhanced as they are updated
3. No manual migration of existing data is required
4. All new Lambda functions are automatically deployed with the CDK stack
