import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as path from 'path';
import { Construct } from 'constructs';

export interface EC2HostFailoverStackProps extends cdk.StackProps {
  alertEmail: string;
  availabilityZone: string;
  instanceType: string;
  // Optional: Add specific host IDs to monitor
  dedicatedHostIds?: string[];
}

export class EC2HostFailoverStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: EC2HostFailoverStackProps) {
    super(scope, id, props);

    // DynamoDB table for queue
    const queueTable = new dynamodb.Table(this, 'HostMigrationQueue', {
      partitionKey: { name: 'HostId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ExpirationTime',
    });

    // SNS topic for alerts
    const alertTopic = new sns.Topic(this, 'HostMigrationAlertTopic');
    new sns.Subscription(this, 'EmailSubscription', {
      topic: alertTopic,
      protocol: sns.SubscriptionProtocol.EMAIL,
      endpoint: props.alertEmail,
    });

    // Lambda layer with common code
    const commonLayer = new lambda.LayerVersion(this, 'CommonLayer', {
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda-layer')),
      compatibleRuntimes: [lambda.Runtime.NODEJS_18_X],
      description: 'Common utilities for EC2 host migration',
    });

    // Common Lambda configuration
    const lambdaConfig = {
      runtime: lambda.Runtime.NODEJS_18_X,
      timeout: cdk.Duration.seconds(30),
      environment: {
        QUEUE_TABLE_NAME: queueTable.tableName,
        ALERT_TOPIC_ARN: alertTopic.topicArn,
        AVAILABILITY_ZONE: props.availabilityZone,
        INSTANCE_TYPE: props.instanceType,
      },
      layers: [commonLayer],
    };

    // Create Lambda functions
    const initializeFunction = new lambda.Function(this, 'InitializeMigrationFunction', {
      ...lambdaConfig,
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda/initialize-migration')),
      handler: 'index.handler',
    });

    const checkReservedHostFunction = new lambda.Function(this, 'CheckReservedHostFunction', {
      ...lambdaConfig,
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda/check-reserved-host')),
      handler: 'index.handler',
    });

    const provisionReservedHostFunction = new lambda.Function(this, 'ProvisionReservedHostFunction', {
      ...lambdaConfig,
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda/provision-reserved-host')),
      handler: 'index.handler',
      timeout: cdk.Duration.minutes(5), // Provisioning can take longer
    });

    const getInstancesFunction = new lambda.Function(this, 'GetInstancesFunction', {
      ...lambdaConfig,
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda/get-instances')),
      handler: 'index.handler',
    });

    const stopInstanceFunction = new lambda.Function(this, 'StopInstanceFunction', {
      ...lambdaConfig,
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda/stop-instance')),
      handler: 'index.handler',
    });

    const checkInstanceStateFunction = new lambda.Function(this, 'CheckInstanceStateFunction', {
      ...lambdaConfig,
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda/check-instance-state')),
      handler: 'index.handler',
    });

    const modifyPlacementFunction = new lambda.Function(this, 'ModifyPlacementFunction', {
      ...lambdaConfig,
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda/modify-placement')),
      handler: 'index.handler',
    });

    const startInstanceFunction = new lambda.Function(this, 'StartInstanceFunction', {
      ...lambdaConfig,
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda/start-instance')),
      handler: 'index.handler',
    });

    const updateStatusFunction = new lambda.Function(this, 'UpdateStatusFunction', {
      ...lambdaConfig,
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda/update-status')),
      handler: 'index.handler',
    });

    // Grant permissions
    queueTable.grantReadWriteData(initializeFunction);
    queueTable.grantReadWriteData(updateStatusFunction);
    alertTopic.grantPublish(initializeFunction);
    alertTopic.grantPublish(updateStatusFunction);

    // EC2 permissions
    const ec2Policy = new iam.PolicyStatement({
      actions: [
        'ec2:DescribeHosts',
        'ec2:AllocateHosts',
        'ec2:DescribeInstances',
        'ec2:StopInstances',
        'ec2:StartInstances',
        'ec2:ModifyInstancePlacement',
        'ec2:CreateTags',
      ],
      resources: ['*'],
    });

    checkReservedHostFunction.addToRolePolicy(ec2Policy);
    provisionReservedHostFunction.addToRolePolicy(ec2Policy);
    getInstancesFunction.addToRolePolicy(ec2Policy);
    stopInstanceFunction.addToRolePolicy(ec2Policy);
    checkInstanceStateFunction.addToRolePolicy(ec2Policy);
    modifyPlacementFunction.addToRolePolicy(ec2Policy);
    startInstanceFunction.addToRolePolicy(ec2Policy);

    // Create the state machine using the JSON definition
    // Create Lambda function to remove Reserved tag
    const removeReservedTagFunction = new lambda.Function(this, 'RemoveReservedTagFunction', {
      ...lambdaConfig,
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda/remove-reserved-tag')),
      handler: 'index.handler',
    });
    
    // Grant EC2 permissions to remove tags
    removeReservedTagFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ec2:DeleteTags'],
      resources: ['*'],
    }));

    const stateMachine = new stepfunctions.StateMachine(this, 'HostMigrationStateMachine', {
      definitionBody: stepfunctions.DefinitionBody.fromFile(path.join(__dirname, 'step-functions/migration-workflow.json')),
      definitionSubstitutions: {
        InitializeMigrationFunction: initializeFunction.functionArn,
        CheckReservedHostFunction: checkReservedHostFunction.functionArn,
        ProvisionReservedHostFunction: provisionReservedHostFunction.functionArn,
        GetInstancesFunction: getInstancesFunction.functionArn,
        StopInstanceFunction: stopInstanceFunction.functionArn,
        CheckInstanceStateFunction: checkInstanceStateFunction.functionArn,
        ModifyPlacementFunction: modifyPlacementFunction.functionArn,
        StartInstanceFunction: startInstanceFunction.functionArn,
        UpdateStatusFunction: updateStatusFunction.functionArn,
        RemoveReservedTagFunction: removeReservedTagFunction.functionArn,
        AlertTopicArn: alertTopic.topicArn,
        AvailabilityZone: props.availabilityZone,
        InstanceType: props.instanceType
      },
      timeout: cdk.Duration.hours(24), // Allow up to 24 hours for the entire migration
      stateMachineType: stepfunctions.StateMachineType.STANDARD,
    });
    
    // Grant permissions for the state machine to invoke all Lambda functions
    initializeFunction.grantInvoke(stateMachine);
    checkReservedHostFunction.grantInvoke(stateMachine);
    provisionReservedHostFunction.grantInvoke(stateMachine);
    getInstancesFunction.grantInvoke(stateMachine);
    stopInstanceFunction.grantInvoke(stateMachine);
    checkInstanceStateFunction.grantInvoke(stateMachine);
    modifyPlacementFunction.grantInvoke(stateMachine);
    startInstanceFunction.grantInvoke(stateMachine);
    updateStatusFunction.grantInvoke(stateMachine);
    removeReservedTagFunction.grantInvoke(stateMachine);
    
    // Grant the Step Function permission to publish to the SNS topic
    alertTopic.grantPublish(stateMachine);

    // Create alarm handler Lambda
    const alarmHandlerFunction = new lambda.Function(this, 'AlarmHandlerFunction', {
      ...lambdaConfig,
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda/alarm-handler')),
      handler: 'index.handler',
      environment: {
        ...lambdaConfig.environment,
        MIGRATION_STATE_MACHINE_ARN: stateMachine.stateMachineArn,
      },
    });

    // Grant permissions to start Step Functions execution
    stateMachine.grantStartExecution(alarmHandlerFunction);
    
    // Grant DynamoDB permissions for GetItem and PutItem operations
    queueTable.grantReadWriteData(alarmHandlerFunction);

    // Create SNS topic for CloudWatch alarms
    const alarmTopic = new sns.Topic(this, 'HostAlarmTopic');
    alarmTopic.addSubscription(new subs.LambdaSubscription(alarmHandlerFunction));

    // Create CloudWatch alarms for dedicated host status
    if (props.dedicatedHostIds && props.dedicatedHostIds.length > 0) {
      props.dedicatedHostIds.forEach((hostId, index) => {
        const dedicatedHostStatusMetric = new cloudwatch.Metric({
          namespace: 'AWS/EC2',
          metricName: 'StatusCheckFailed',
          dimensionsMap: {
            HostId: hostId,
          },
          statistic: 'Maximum',
          period: cdk.Duration.minutes(5),
        });

        const dedicatedHostAlarm = new cloudwatch.Alarm(this, `DedicatedHostStatusAlarm-${index}`, {
          metric: dedicatedHostStatusMetric,
          evaluationPeriods: 1,
          threshold: 1,
          comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
          alarmDescription: `Alarm when dedicated host ${hostId} status check fails`,
          treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });

        dedicatedHostAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alarmTopic));
      });
    } else {
      // Create a placeholder alarm - you should replace this with actual host IDs
      const dedicatedHostStatusMetric = new cloudwatch.Metric({
        namespace: 'AWS/EC2',
        metricName: 'StatusCheckFailed',
        dimensionsMap: {
          HostId: 'PLACEHOLDER_HOST_ID', // Replace with actual host ID
        },
        statistic: 'Maximum',
        period: cdk.Duration.minutes(5),
      });

      const dedicatedHostAlarm = new cloudwatch.Alarm(this, 'DedicatedHostStatusAlarm', {
        metric: dedicatedHostStatusMetric,
        evaluationPeriods: 1,
        threshold: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        alarmDescription: 'Alarm when dedicated host status check fails',
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      dedicatedHostAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alarmTopic));
    }

    // Outputs
    new cdk.CfnOutput(this, 'QueueTableName', {
      value: queueTable.tableName,
      description: 'DynamoDB table for host migration queue',
    });

    new cdk.CfnOutput(this, 'StateMachineArn', {
      value: stateMachine.stateMachineArn,
      description: 'Step Functions state machine ARN',
    });

    new cdk.CfnOutput(this, 'AlertTopicArn', {
      value: alertTopic.topicArn,
      description: 'SNS topic for migration alerts',
    });
  }
}
