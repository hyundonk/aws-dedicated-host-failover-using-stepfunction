# Step-by-Step Notifications Implementation

## Overview

This document describes the implementation of step-by-step email notifications for the EC2 Dedicated Host Failover solution. The enhancement adds detailed notifications at key points during the migration workflow to provide real-time visibility into the migration process.

## New Features Added

### 1. New Lambda Function: SendStepNotificationFunction

**Location**: `lib/lambda/send-step-notification/index.js`

**Purpose**: Sends targeted email notifications for specific workflow steps

**Key Features**:
- Supports 7 different notification types
- Includes contextual information for each step
- Graceful error handling (doesn't fail the workflow if notifications fail)
- Retrieves migration context from DynamoDB when available

### 2. Enhanced Step Functions Workflow

**Modified File**: `lib/step-functions/migration-workflow.json`

**Approach**: **Surgical modifications** to the existing workflow - only added new notification steps without changing existing logic.

## Notification Points Added

The following notifications are now sent during the migration process:

### 1. Migration Started (after InitializeMigration)
- **Step**: `migration_started`
- **Trigger**: After the migration is initialized
- **Content**: Migration start confirmation with source/target host details

### 2. Instances Found (after CheckInstancesExist)
- **Step**: `instances_found`
- **Trigger**: When instances are found on the failing host
- **Content**: List of instances to be migrated

### 3. Instance Stopping (after StopInstance)
- **Step**: `instance_stopping`
- **Trigger**: When attempting to stop an instance
- **Content**: Instance details, force stop status, retry information

### 4. Instance Stopped (after IsInstanceStopped)
- **Step**: `instance_stopped`
- **Trigger**: When instance successfully stops
- **Content**: Stop confirmation, duration, force stop usage

### 5. Placement Modified (after ModifyInstancePlacement)
- **Step**: `placement_modified`
- **Trigger**: When instance placement is successfully modified
- **Content**: Placement change details, previous/new host information

### 6. Instance Starting (after StartInstance)
- **Step**: `instance_starting`
- **Trigger**: When attempting to start an instance
- **Content**: Start attempt details, retry information

### 7. Instance Started (after IsInstanceStarted)
- **Step**: `instance_started`
- **Trigger**: When instance successfully starts
- **Content**: Start confirmation, migration completion for the instance

## Implementation Details

### Error Handling Strategy

All notification steps include comprehensive error handling:

```json
"Catch": [
  {
    "ErrorEquals": ["States.ALL"],
    "ResultPath": "$.notificationError",
    "Next": "NextStep"
  }
]
```

**Key Points**:
- Notification failures don't interrupt the migration workflow
- Errors are logged but don't propagate
- The workflow continues even if notifications fail

### Notification Message Structure

Each notification includes:
- **Subject**: Descriptive subject line for the email
- **Message**: Detailed, formatted message with emojis and sections
- **Context**: Host IDs, instance IDs, timestamps
- **Additional Info**: Step-specific details (force stop, retry counts, etc.)

### CDK Stack Updates

**Modified File**: `lib/ec2-host-failover-stack.ts`

**Changes Made**:
1. Added `SendStepNotificationFunction` Lambda function
2. Granted DynamoDB read permissions for context retrieval
3. Added function ARN to Step Functions substitutions
4. Granted Step Functions permission to invoke the new function

## Deployment

### Prerequisites
Ensure Lambda layer dependencies are installed:
```bash
cd lib/lambda-layer/nodejs
npm install
cd ../../..
```

### Deploy Changes
```bash
npm run build
cdk deploy
```

## Testing

### Manual Testing
You can trigger a test notification by invoking the Lambda function directly:

```bash
aws lambda invoke \
  --function-name <SendStepNotificationFunctionName> \
  --payload '{
    "hostId": "h-1234567890abcdef0",
    "step": "migration_started",
    "reservedHostId": "h-0fedcba0987654321"
  }' \
  response.json
```

### Integration Testing
The notifications will be automatically sent during actual migration workflows triggered by CloudWatch alarms.

## Notification Examples

### Migration Started
```
🚀 MIGRATION STARTED

Dedicated host failover migration has been initiated.

📋 MIGRATION DETAILS:
• Source Host: h-1234567890abcdef0
• Target Host: h-0fedcba0987654321
• Started At: 2025-06-23 10:00:00 UTC
• Total Instances to Migrate: 3

🔄 The migration workflow is now in progress. You will receive notifications for each major step.

For real-time status updates, check the AWS Step Functions console.
```

### Instance Migration Steps
Each instance migration includes detailed notifications for:
- Stop attempt and success
- Placement modification
- Start attempt and success

## Benefits

1. **Real-time Visibility**: Know exactly what's happening during migration
2. **Proactive Monitoring**: Identify issues early in the process
3. **Detailed Context**: Rich information for troubleshooting
4. **Non-intrusive**: Notifications don't affect migration reliability
5. **Actionable Information**: Clear next steps and recommendations

## Backward Compatibility

- **Existing functionality preserved**: All original features remain unchanged
- **Existing notifications maintained**: End-of-migration notifications still work
- **Graceful degradation**: System works even if new notifications fail

## Monitoring and Troubleshooting

### CloudWatch Logs
- Check `SendStepNotificationFunction` logs for notification issues
- Notification errors are logged but don't affect migration

### Step Functions Console
- Visual workflow shows notification steps
- Failed notifications appear as warnings, not errors

### Email Delivery
- Verify SNS subscription is confirmed
- Check spam folders for notification emails
- Monitor SNS topic metrics for delivery issues

## Future Enhancements

Potential improvements for future versions:
1. **Configurable Notifications**: Allow users to enable/disable specific notification types
2. **Multiple Channels**: Support Slack, Teams, or other notification channels
3. **Notification Throttling**: Prevent spam during large migrations
4. **Rich Formatting**: HTML emails with better formatting
5. **Notification History**: Store notification history in DynamoDB

## Summary

This implementation provides comprehensive step-by-step visibility into the migration process while maintaining the reliability and robustness of the existing system. The surgical approach to modifying the workflow ensures minimal risk while maximizing the value of real-time notifications.
