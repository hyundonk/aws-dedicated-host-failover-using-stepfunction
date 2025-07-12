const { getMigrationRecord } = require('/opt/nodejs/ec2-utils');

/**
 * Check if healthy notification was already sent for this host
 */
exports.handler = async (event) => {
  console.log('Checking if healthy notification was already sent for host:', event.hostId);
  
  try {
    // Get the migration record from DynamoDB
    const migrationRecord = await getMigrationRecord(event.hostId);
    
    if (!migrationRecord) {
      console.log('No migration record found, notification not sent yet');
      return {
        hostId: event.hostId,
        alreadySent: false,
        reason: 'no-record-found'
      };
    }
    
    // Check if HealthyNotificationSent field exists and is true
    const alreadySent = migrationRecord.HealthyNotificationSent === true;
    
    console.log(`Healthy notification sent status: ${alreadySent}`);
    
    return {
      hostId: event.hostId,
      alreadySent: alreadySent,
      reason: alreadySent ? 'notification-already-sent' : 'notification-not-sent',
      recordFound: true
    };
    
  } catch (error) {
    console.error('Error checking healthy notification status:', error);
    
    // If we can't check, assume not sent to be safe
    return {
      hostId: event.hostId,
      alreadySent: false,
      reason: 'check-failed',
      error: error.message
    };
  }
};
