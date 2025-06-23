const { getMigrationRecord } = require('/opt/nodejs/ec2-utils');

/**
 * Get detailed migration status for a host
 */
exports.handler = async (event) => {
  console.log('Getting migration status for host:', event.hostId);
  
  try {
    const migrationRecord = await getMigrationRecord(event.hostId);
    
    if (!migrationRecord) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          error: 'Migration record not found',
          hostId: event.hostId
        })
      };
    }
    
    // Calculate migration progress
    const totalInstances = migrationRecord.TotalInstances || 0;
    const successfulMigrations = migrationRecord.SuccessfulMigrations || 0;
    const failedMigrations = migrationRecord.FailedMigrations || 0;
    const inProgressMigrations = totalInstances - successfulMigrations - failedMigrations;
    
    const response = {
      hostId: migrationRecord.HostId,
      state: migrationRecord.State,
      reservedHostId: migrationRecord.ReservedHostId,
      createdAt: migrationRecord.CreatedAt,
      updatedAt: migrationRecord.UpdatedAt,
      migrationSummary: {
        totalInstances,
        successfulMigrations,
        failedMigrations,
        inProgressMigrations,
        progressPercentage: totalInstances > 0 ? Math.round(((successfulMigrations + failedMigrations) / totalInstances) * 100) : 0
      },
      instanceMigrations: migrationRecord.InstanceMigrations || {},
      errorDetails: migrationRecord.ErrorDetails
    };
    
    return {
      statusCode: 200,
      body: JSON.stringify(response, null, 2)
    };
  } catch (error) {
    console.error('Error getting migration status:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};
