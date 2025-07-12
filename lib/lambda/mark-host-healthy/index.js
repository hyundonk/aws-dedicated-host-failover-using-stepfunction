const { updateHostStateWithFields } = require('/opt/nodejs/ec2-utils');

/**
 * Mark host as healthy and prepare notification
 */
exports.handler = async (event) => {
  console.log('Marking host as healthy:', event.hostId);
  console.log('Health summary:', JSON.stringify(event.healthySummary, null, 2));
  
  try {
    // Update host state in DynamoDB with health status
    await updateHostStateWithFields(event.hostId, 'healthy', {
      'application-health': 'ok',
      'health-check-time': new Date().toISOString(),
      'health-check-results': JSON.stringify(event.healthySummary),
      'last-health-check': new Date().toISOString()
    });
    
    console.log('Host marked as healthy in DynamoDB');
    
    // Prepare notification message
    const notificationMessage = buildHealthyNotificationMessage(
      event.hostId, 
      event.healthySummary,
      event.instanceResults || []
    );
    
    return {
      hostId: event.hostId,
      status: 'healthy',
      notification: {
        subject: 'EC2 Dedicated Host - Health Check Passed',
        message: notificationMessage
      }
    };
    
  } catch (error) {
    console.error('Error marking host as healthy:', error);
    throw error;
  }
};

/**
 * Build notification message for healthy host
 */
function buildHealthyNotificationMessage(hostId, summary, instanceResults) {
  let message = `✅ DEDICATED HOST HEALTH CHECK PASSED\n\n`;
  message += `The dedicated host ${hostId} has passed the application health check.\n\n`;
  
  message += `📋 HEALTH CHECK RESULTS:\n`;
  message += `• Total Instances Checked: ${summary.total}\n`;
  message += `• Healthy Instances: ${summary.healthy}\n`;
  message += `• Unhealthy Instances: ${summary.unhealthy}\n`;
  message += `• Error Instances: ${summary.errors}\n`;
  message += `• Check Time: ${new Date().toISOString().replace('T', ' ').replace('Z', ' UTC')}\n\n`;
  
  if (instanceResults && instanceResults.length > 0) {
    message += `🔍 INSTANCE DETAILS:\n`;
    instanceResults.forEach(result => {
      const status = result.isHealthy ? '✅ Healthy' : '❌ Unhealthy';
      const errorInfo = result.error ? ` (${result.error})` : '';
      message += `• ${result.instanceId}: ${status}${errorInfo}\n`;
    });
    message += `\n`;
  }
  
  message += `✅ OUTCOME:\n`;
  message += `• Host Status: Marked as healthy\n`;
  message += `• Action Taken: No failover required\n`;
  message += `• Next Steps: Continue monitoring\n\n`;
  
  message += `🔄 HEALTH CHECK DETAILS:\n`;
  message += `• Service Monitored: Zabbix Agent\n`;
  message += `• Port Checked: 10050\n`;
  message += `• Criteria: Service running + Active connections\n\n`;
  
  message += `The dedicated host failover process has been cancelled as the applications are running normally.\n`;
  message += `The host will continue to be monitored for future health status changes.`;
  
  return message;
}
