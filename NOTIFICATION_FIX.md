# Step Function Notification Fix

## Problem

The Step Function failed with the following error:
```
The JSONPath '$.initResult.Payload.reservedHostId' specified for the field 'reservedHostId.$' could not be found in the input
```

## Root Cause

The `InitializeMigration` Lambda function only returns:
```json
{
  "hostId": "h-0e2e58fd82f8fd04c",
  "startTime": "2025-06-23T11:09:05.312Z"
}
```

But the `SendMigrationStartedNotification` step was trying to access `$.initResult.Payload.reservedHostId`, which doesn't exist at this point in the workflow.

## Data Flow Analysis

1. **InitializeMigration**: Only initializes DynamoDB record, doesn't determine reserved host
2. **CheckReservedHostAvailability**: This is where the reserved host ID is determined
3. **Migration Started Notification**: Happens before reserved host is known

## Solution Applied

### 1. Updated Step Function Workflow

**File**: `lib/step-functions/migration-workflow.json`

**Change**: Removed the non-existent `reservedHostId` parameter from the migration started notification:

```json
// BEFORE (causing error)
"Payload": {
  "hostId.$": "$.hostId",
  "step": "migration_started",
  "reservedHostId.$": "$.initResult.Payload.reservedHostId"  // ❌ This doesn't exist
}

// AFTER (fixed)
"Payload": {
  "hostId.$": "$.hostId",
  "step": "migration_started"  // ✅ Only use available data
}
```

### 2. Enhanced Notification Function

**File**: `lib/lambda/send-step-notification/index.js`

**Change**: Updated the migration started message to handle missing `reservedHostId`:

```javascript
// Enhanced message building
message += `• Target Host: ${reservedHostId || 'To be determined'}\n`;

if (!reservedHostId) {
  message += `\n📋 Next Step: Checking for available reserved hosts or provisioning a new one.\n`;
}
```

## Expected Behavior After Fix

### Migration Started Notification
```
🚀 MIGRATION STARTED

Dedicated host failover migration has been initiated.

📋 MIGRATION DETAILS:
• Source Host: h-0e2e58fd82f8fd04c
• Target Host: To be determined
• Started At: 2025-06-23 11:09:05 UTC

📋 Next Step: Checking for available reserved hosts or provisioning a new one.

🔄 The migration workflow is now in progress. You will receive notifications for each major step.

For real-time status updates, check the AWS Step Functions console.
```

### Subsequent Notifications
Once the reserved host is determined (after `CheckReservedHostAvailability`), all subsequent notifications will include the actual reserved host ID.

## Deployment

To apply the fix:

```bash
npm run build
cdk deploy
```

## Testing

After deployment, trigger the Step Function again. The workflow should now proceed past the `SendMigrationStartedNotification` step successfully.

## Prevention

This type of error can be prevented by:

1. **Data Flow Mapping**: Understanding what data is available at each step
2. **Optional Parameters**: Making parameters optional when they might not be available
3. **Defensive Programming**: Handling missing data gracefully
4. **Testing**: Testing each step with realistic data

## Related Files Modified

1. `lib/step-functions/migration-workflow.json` - Removed non-existent parameter
2. `lib/lambda/send-step-notification/index.js` - Enhanced message handling
3. `NOTIFICATION_FIX.md` - This documentation

## Verification

After deployment, verify the fix by:

1. Triggering a Step Function execution
2. Confirming the migration started notification is sent successfully
3. Checking that subsequent notifications include the reserved host ID
4. Monitoring CloudWatch Logs for any remaining errors
