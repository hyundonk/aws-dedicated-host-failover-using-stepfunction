const { SSM, EC2 } = require('aws-sdk');
const { getInstancesOnHost } = require('/opt/nodejs/ec2-utils');

const ssm = new SSM();
const ec2 = new EC2();

/**
 * PowerShell script to check Zabbix Agent health
 */
const ZABBIX_HEALTH_CHECK_SCRIPT = `
# Define port and service name
$port = 10050
$serviceName = "Zabbix Agent"

try {
    # Check if Zabbix Agent service is running
    $serviceStatus = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    
    if ($serviceStatus -and $serviceStatus.Status -eq 'Running') {
        Write-Host "Zabbix Agent service is running"
        
        # Execute netstat and filter results for the port
        $netstatOutput = netstat -an | Select-String ":$port"
        
        # Check for Listening status
        $listening = $netstatOutput | Where-Object { $_ -match "LISTENING" }
        
        if ($listening) {
            Write-Host "Port $port is in LISTENING state"
            Write-Host "Zabbix Agent is healthy - service running and port listening"
            Write-Output "1"
        } else {
            Write-Host "Port $port is not in LISTENING state"
            Write-Output "0"
        }
    } else {
        Write-Host "Zabbix Agent service is not running - no output"
        # Output nothing when service is not running
    }
} catch {
    Write-Host "Error checking Zabbix Agent health: $_"
    # Output nothing on error
}

# Additional system information
Write-Host "Instance ID: $env:COMPUTERNAME"
Write-Host "Current Time: $(Get-Date)"
Write-Host "Port Status Details:"
netstat -an | Select-String ":$port"
`;

/**
 * Check instances health on a dedicated host using SSM Run Command
 */
exports.handler = async (event) => {
  console.log('Checking instances health for host:', event.hostId);
  
  try {
    // Step 1: Get instances on the problematic host
    const instances = await getInstancesOnHost(event.hostId);
    console.log(`Found ${instances.length} instances on host ${event.hostId}`);
    
    if (instances.length === 0) {
      console.log('No instances found on host, considering healthy');
      return {
        hostId: event.hostId,
        healthStatus: 'healthy',
        reason: 'no-instances',
        continueFailover: false,
        instanceResults: [],
        healthySummary: {
          total: 0,
          healthy: 0,
          unhealthy: 0,
          errors: 0
        }
      };
    }
    
    // Step 2: Filter for Windows instances with SSM agent
    const windowsInstances = await filterWindowsInstancesWithSSM(instances);
    console.log(`Found ${windowsInstances.length} Windows instances with SSM`);
    
    if (windowsInstances.length === 0) {
      console.log('No Windows instances with SSM found, continuing failover');
      return {
        hostId: event.hostId,
        healthStatus: 'unknown',
        reason: 'no-ssm-instances',
        continueFailover: true,
        instanceResults: [],
        healthySummary: {
          total: instances.length,
          healthy: 0,
          unhealthy: 0,
          errors: instances.length
        }
      };
    }
    
    // Step 3: Execute Zabbix health check on all Windows instances
    console.log('Executing Zabbix health check on instances...');
    const healthCheckResults = await executeZabbixHealthCheck(windowsInstances);
    
    // Step 4: Analyze results and make failover decision
    const analysis = analyzeHealthCheckResults(healthCheckResults);
    console.log('Health check analysis:', JSON.stringify(analysis, null, 2));
    
    return {
      hostId: event.hostId,
      healthStatus: analysis.overallStatus,
      reason: analysis.reason,
      continueFailover: analysis.shouldFailover,
      instanceResults: healthCheckResults,
      healthySummary: analysis.summary
    };
    
  } catch (error) {
    console.error('Error in health check:', error);
    // If health check fails, assume unhealthy and continue with failover
    return {
      hostId: event.hostId,
      healthStatus: 'error',
      reason: 'health-check-failed',
      continueFailover: true,
      instanceResults: [],
      healthySummary: {
        total: 0,
        healthy: 0,
        unhealthy: 0,
        errors: 1
      },
      error: error.message
    };
  }
};

/**
 * Execute Zabbix health check on Windows instances using SSM
 */
async function executeZabbixHealthCheck(instances) {
  const results = [];
  
  // Execute health check on all instances in parallel
  const promises = instances.map(async (instance) => {
    try {
      console.log(`Executing Zabbix health check on instance: ${instance.InstanceId}`);
      
      const params = {
        DocumentName: 'AWS-RunPowerShellScript',
        InstanceIds: [instance.InstanceId],
        Parameters: {
          commands: [ZABBIX_HEALTH_CHECK_SCRIPT]
        },
        TimeoutSeconds: 300, // 5 minutes timeout
        Comment: `Zabbix health check for dedicated host failover - ${instance.InstanceId}`
      };
      
      const command = await ssm.sendCommand(params).promise();
      const commandId = command.Command.CommandId;
      
      console.log(`SSM command sent to ${instance.InstanceId}, CommandId: ${commandId}`);
      
      // Wait for command completion
      const result = await waitForCommandCompletion(commandId, instance.InstanceId);
      
      return {
        instanceId: instance.InstanceId,
        instanceType: instance.InstanceType,
        commandId: commandId,
        status: result.status,
        output: result.output,
        error: result.error,
        isHealthy: result.isHealthy,
        executionTime: result.executionTime
      };
      
    } catch (error) {
      console.error(`Error executing health check on ${instance.InstanceId}:`, error);
      return {
        instanceId: instance.InstanceId,
        instanceType: instance.InstanceType,
        commandId: null,
        status: 'error',
        output: '',
        error: error.message,
        isHealthy: false,
        executionTime: 0
      };
    }
  });
  
  const results_array = await Promise.all(promises);
  return results_array;
}

/**
 * Wait for SSM command completion and get results
 */
async function waitForCommandCompletion(commandId, instanceId, maxWaitTime = 240000) {
  const startTime = Date.now();
  const pollInterval = 5000; // 5 seconds
  
  while (Date.now() - startTime < maxWaitTime) {
    try {
      const params = {
        CommandId: commandId,
        InstanceId: instanceId
      };
      
      const result = await ssm.getCommandInvocation(params).promise();
      
      if (result.Status === 'Success') {
        console.log(`Command completed successfully on ${instanceId}`);
        
        // Parse the output to determine health status
        const output = result.StandardOutputContent || '';
        const error = result.StandardErrorContent || '';
        
        console.log(`Instance ${instanceId} output:`, output);
        if (error) {
          console.log(`Instance ${instanceId} error:`, error);
        }
        
        // Parse the output to find health status (look for standalone "1" or "0")
        let isHealthy = false;
        const output_text = output || '';
        
        console.log(`Instance ${instanceId} full output:`, output_text);
        
        // Look for standalone "1" or "0" in the output using regex
        // This matches "1" or "0" that appears on its own line or surrounded by whitespace
        const healthMatch = output_text.match(/(?:^|\n|\r\n)\s*([01])\s*(?:\r?\n|$)/);
        
        if (healthMatch) {
          const healthValue = healthMatch[1];
          if (healthValue === '1') {
            isHealthy = true;
            console.log(`Instance ${instanceId} is HEALTHY (found standalone "1" in output)`);
          } else if (healthValue === '0') {
            isHealthy = false;
            console.log(`Instance ${instanceId} is UNHEALTHY (found standalone "0" in output)`);
          }
        } else {
          // No clear health indicator found (service not running) - treat as unhealthy
          isHealthy = false;
          console.log(`Instance ${instanceId} is UNHEALTHY (no standalone health indicator found)`);
        }
        
        return {
          status: 'success',
          output: output,
          error: error,
          isHealthy: isHealthy,
          executionTime: Date.now() - startTime
        };
        
      } else if (result.Status === 'Failed') {
        console.log(`Command failed on ${instanceId}`);
        return {
          status: 'failed',
          output: result.StandardOutputContent || '',
          error: result.StandardErrorContent || 'Command execution failed',
          isHealthy: false,
          executionTime: Date.now() - startTime
        };
        
      } else if (result.Status === 'TimedOut') {
        console.log(`Command timed out on ${instanceId}`);
        return {
          status: 'timeout',
          output: result.StandardOutputContent || '',
          error: 'Command execution timed out',
          isHealthy: false,
          executionTime: Date.now() - startTime
        };
        
      } else {
        // Still running, continue polling
        console.log(`Command still running on ${instanceId}, status: ${result.Status}`);
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
      
    } catch (error) {
      if (error.code === 'InvocationDoesNotExist') {
        // Command might still be initializing, wait a bit more
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } else {
        console.error(`Error checking command status for ${instanceId}:`, error);
        return {
          status: 'error',
          output: '',
          error: error.message,
          isHealthy: false,
          executionTime: Date.now() - startTime
        };
      }
    }
  }
  
  // Timeout reached
  console.log(`Timeout waiting for command completion on ${instanceId}`);
  return {
    status: 'timeout',
    output: '',
    error: 'Timeout waiting for command completion',
    isHealthy: false,
    executionTime: maxWaitTime
  };
}

/**
 * Analyze health check results and determine failover decision
 * Modified logic: Only proceed with failover if ALL instances are unhealthy
 */
function analyzeHealthCheckResults(results) {
  console.log('=== ANALYZING HEALTH CHECK RESULTS ===');
  
  const total = results.length;
  const healthy = results.filter(r => r.isHealthy).length;
  const unhealthy = results.filter(r => !r.isHealthy && r.status === 'success').length;
  const errors = results.filter(r => r.status === 'error' || r.status === 'failed' || r.status === 'timeout').length;
  
  console.log(`Total instances: ${total}`);
  console.log(`Healthy instances: ${healthy}`);
  console.log(`Unhealthy instances: ${unhealthy}`);
  console.log(`Error instances: ${errors}`);
  
  // Log each instance result for debugging
  results.forEach((result, index) => {
    console.log(`Instance ${index + 1} (${result.instanceId}):`, {
      status: result.status,
      isHealthy: result.isHealthy,
      output: result.output ? `"${result.output.trim()}"` : 'empty',
      error: result.error || 'none'
    });
  });
  
  const healthyPercentage = total > 0 ? (healthy / total) * 100 : 0;
  
  let overallStatus, reason, shouldFailover;
  
  if (errors === total) {
    // All instances had errors - can't determine health, proceed with failover
    overallStatus = 'error';
    reason = 'all-instances-error';
    shouldFailover = true;
    console.log('Decision: ALL instances had errors → PROCEED with failover');
  } else if (healthy === 0 && (unhealthy > 0 || errors > 0)) {
    // ALL instances are unhealthy (no healthy instances found) - proceed with failover
    overallStatus = 'all-unhealthy';
    reason = 'all-instances-unhealthy';
    shouldFailover = true;
    console.log('Decision: ALL instances are unhealthy → PROCEED with failover');
  } else {
    // At least one instance is healthy - do NOT proceed with failover
    overallStatus = 'some-healthy';
    reason = 'some-instances-healthy';
    shouldFailover = false;
    console.log('Decision: Some instances are healthy → SKIP failover');
  }
  
  console.log(`Final decision: shouldFailover = ${shouldFailover}`);
  console.log('=== END ANALYSIS ===');
  
  return {
    overallStatus,
    reason,
    shouldFailover,
    summary: {
      total,
      healthy,
      unhealthy,
      errors,
      healthyPercentage: Math.round(healthyPercentage)
    }
  };
}

/**
 * Filter instances to get Windows instances with SSM agent
 */
async function filterWindowsInstancesWithSSM(instances) {
  const windowsInstances = [];
  
  for (const instance of instances) {
    try {
      // Check if instance is Windows and has SSM agent
      const instanceDetails = await ec2.describeInstances({
        InstanceIds: [instance.InstanceId]
      }).promise();
      
      const instanceData = instanceDetails.Reservations[0]?.Instances[0];
      if (instanceData) {
        const platform = instanceData.Platform;
        const state = instanceData.State.Name;
        
        // Check if it's a Windows instance and running
        if (platform === 'windows' && state === 'running') {
          // Check SSM agent status
          try {
            const ssmStatus = await ssm.describeInstanceInformation({
              InstanceInformationFilterList: [
                {
                  key: 'InstanceIds',
                  valueSet: [instance.InstanceId]
                }
              ]
            }).promise();
            
            if (ssmStatus.InstanceInformationList.length > 0) {
              const ssmInfo = ssmStatus.InstanceInformationList[0];
              if (ssmInfo.PingStatus === 'Online') {
                windowsInstances.push(instance);
                console.log(`Instance ${instance.InstanceId} is Windows with active SSM agent`);
              } else {
                console.log(`Instance ${instance.InstanceId} is Windows but SSM agent is ${ssmInfo.PingStatus}`);
              }
            } else {
              console.log(`Instance ${instance.InstanceId} is Windows but no SSM agent found`);
            }
          } catch (ssmError) {
            console.log(`Instance ${instance.InstanceId} is Windows but SSM check failed:`, ssmError.message);
          }
        } else {
          console.log(`Instance ${instance.InstanceId} is not Windows or not running (Platform: ${platform}, State: ${state})`);
        }
      }
    } catch (error) {
      console.error(`Error checking instance ${instance.InstanceId}:`, error);
    }
  }
  
  return windowsInstances;
}
