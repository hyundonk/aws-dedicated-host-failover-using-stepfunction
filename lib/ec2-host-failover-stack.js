"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EC2HostFailoverStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const sns = __importStar(require("aws-cdk-lib/aws-sns"));
const subs = __importStar(require("aws-cdk-lib/aws-sns-subscriptions"));
const stepfunctions = __importStar(require("aws-cdk-lib/aws-stepfunctions"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const cloudwatch = __importStar(require("aws-cdk-lib/aws-cloudwatch"));
const cloudwatch_actions = __importStar(require("aws-cdk-lib/aws-cloudwatch-actions"));
const path = __importStar(require("path"));
class EC2HostFailoverStack extends cdk.Stack {
    constructor(scope, id, props) {
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
        const updateInstanceMigrationStatusFunction = new lambda.Function(this, 'UpdateInstanceMigrationStatusFunction', {
            ...lambdaConfig,
            code: lambda.Code.fromAsset(path.join(__dirname, 'lambda/update-instance-migration-status')),
            handler: 'index.handler',
        });
        const getMigrationStatusFunction = new lambda.Function(this, 'GetMigrationStatusFunction', {
            ...lambdaConfig,
            code: lambda.Code.fromAsset(path.join(__dirname, 'lambda/get-migration-status')),
            handler: 'index.handler',
        });
        const prepareDetailedNotificationFunction = new lambda.Function(this, 'PrepareDetailedNotificationFunction', {
            ...lambdaConfig,
            code: lambda.Code.fromAsset(path.join(__dirname, 'lambda/prepare-detailed-notification')),
            handler: 'index.handler',
        });
        const sendStepNotificationFunction = new lambda.Function(this, 'SendStepNotificationFunction', {
            ...lambdaConfig,
            code: lambda.Code.fromAsset(path.join(__dirname, 'lambda/send-step-notification')),
            handler: 'index.handler',
        });
        const handleProvisionFailureFunction = new lambda.Function(this, 'HandleProvisionFailureFunction', {
            ...lambdaConfig,
            code: lambda.Code.fromAsset(path.join(__dirname, 'lambda/handle-provision-failure')),
            handler: 'index.handler',
        });
        const handleMigrationFailureFunction = new lambda.Function(this, 'HandleMigrationFailureFunction', {
            ...lambdaConfig,
            code: lambda.Code.fromAsset(path.join(__dirname, 'lambda/handle-migration-failure')),
            handler: 'index.handler',
        });
        const handleMigrationSuccessFunction = new lambda.Function(this, 'HandleMigrationSuccessFunction', {
            ...lambdaConfig,
            code: lambda.Code.fromAsset(path.join(__dirname, 'lambda/handle-migration-success')),
            handler: 'index.handler',
        });
        const handleNoInstancesFunction = new lambda.Function(this, 'HandleNoInstancesFunction', {
            ...lambdaConfig,
            code: lambda.Code.fromAsset(path.join(__dirname, 'lambda/handle-no-instances')),
            handler: 'index.handler',
        });
        const checkInstancesHealthFunction = new lambda.Function(this, 'CheckInstancesHealthFunction', {
            ...lambdaConfig,
            code: lambda.Code.fromAsset(path.join(__dirname, 'lambda/check-instances-health')),
            handler: 'index.handler',
            timeout: cdk.Duration.minutes(5), // Longer timeout for SSM operations
        });
        const markHostHealthyFunction = new lambda.Function(this, 'MarkHostHealthyFunction', {
            ...lambdaConfig,
            code: lambda.Code.fromAsset(path.join(__dirname, 'lambda/mark-host-healthy')),
            handler: 'index.handler',
        });
        const checkHealthyNotificationSentFunction = new lambda.Function(this, 'CheckHealthyNotificationSentFunction', {
            ...lambdaConfig,
            code: lambda.Code.fromAsset(path.join(__dirname, 'lambda/check-healthy-notification-sent')),
            handler: 'index.handler',
        });
        const updateHealthyNotificationSentFunction = new lambda.Function(this, 'UpdateHealthyNotificationSentFunction', {
            ...lambdaConfig,
            code: lambda.Code.fromAsset(path.join(__dirname, 'lambda/update-healthy-notification-sent')),
            handler: 'index.handler',
        });
        // Grant permissions
        queueTable.grantReadWriteData(initializeFunction);
        queueTable.grantReadWriteData(updateStatusFunction);
        queueTable.grantReadWriteData(updateInstanceMigrationStatusFunction);
        queueTable.grantReadWriteData(getInstancesFunction);
        queueTable.grantReadWriteData(handleProvisionFailureFunction);
        queueTable.grantReadWriteData(handleMigrationFailureFunction);
        queueTable.grantReadWriteData(handleMigrationSuccessFunction);
        queueTable.grantReadWriteData(handleNoInstancesFunction);
        queueTable.grantReadWriteData(checkInstancesHealthFunction);
        queueTable.grantReadWriteData(markHostHealthyFunction);
        queueTable.grantReadData(checkHealthyNotificationSentFunction);
        queueTable.grantWriteData(updateHealthyNotificationSentFunction);
        queueTable.grantReadData(getMigrationStatusFunction);
        queueTable.grantReadData(prepareDetailedNotificationFunction);
        queueTable.grantReadData(sendStepNotificationFunction);
        alertTopic.grantPublish(initializeFunction);
        alertTopic.grantPublish(updateStatusFunction);
        alertTopic.grantPublish(sendStepNotificationFunction);
        alertTopic.grantPublish(markHostHealthyFunction);
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
                'ec2:ForceStopInstances',
            ],
            resources: ['*'],
        });
        checkReservedHostFunction.addToRolePolicy(ec2Policy);
        initializeFunction.addToRolePolicy(ec2Policy); // Add EC2 permissions for merged functionality
        provisionReservedHostFunction.addToRolePolicy(ec2Policy);
        checkInstancesHealthFunction.addToRolePolicy(ec2Policy);
        // Add SSM permissions for health check function
        const ssmPolicy = new iam.PolicyStatement({
            actions: [
                'ssm:SendCommand',
                'ssm:GetCommandInvocation',
                'ssm:DescribeInstanceInformation',
                'ssm:ListCommandInvocations'
            ],
            resources: ['*'],
        });
        checkInstancesHealthFunction.addToRolePolicy(ssmPolicy);
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
                CheckInstancesHealthFunction: checkInstancesHealthFunction.functionArn,
                MarkHostHealthyFunction: markHostHealthyFunction.functionArn,
                CheckHealthyNotificationSentFunction: checkHealthyNotificationSentFunction.functionArn,
                UpdateHealthyNotificationSentFunction: updateHealthyNotificationSentFunction.functionArn,
                InitializeMigrationFunction: initializeFunction.functionArn,
                CheckReservedHostFunction: checkReservedHostFunction.functionArn,
                ProvisionReservedHostFunction: provisionReservedHostFunction.functionArn,
                GetInstancesFunction: getInstancesFunction.functionArn,
                StopInstanceFunction: stopInstanceFunction.functionArn,
                CheckInstanceStateFunction: checkInstanceStateFunction.functionArn,
                ModifyPlacementFunction: modifyPlacementFunction.functionArn,
                StartInstanceFunction: startInstanceFunction.functionArn,
                UpdateStatusFunction: updateStatusFunction.functionArn,
                UpdateInstanceMigrationStatusFunction: updateInstanceMigrationStatusFunction.functionArn,
                PrepareDetailedNotificationFunction: prepareDetailedNotificationFunction.functionArn,
                SendStepNotificationFunction: sendStepNotificationFunction.functionArn,
                HandleProvisionFailureFunction: handleProvisionFailureFunction.functionArn,
                HandleMigrationFailureFunction: handleMigrationFailureFunction.functionArn,
                HandleMigrationSuccessFunction: handleMigrationSuccessFunction.functionArn,
                HandleNoInstancesFunction: handleNoInstancesFunction.functionArn,
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
        updateInstanceMigrationStatusFunction.grantInvoke(stateMachine);
        prepareDetailedNotificationFunction.grantInvoke(stateMachine);
        sendStepNotificationFunction.grantInvoke(stateMachine);
        handleProvisionFailureFunction.grantInvoke(stateMachine);
        handleMigrationFailureFunction.grantInvoke(stateMachine);
        handleMigrationSuccessFunction.grantInvoke(stateMachine);
        handleNoInstancesFunction.grantInvoke(stateMachine);
        checkInstancesHealthFunction.grantInvoke(stateMachine);
        markHostHealthyFunction.grantInvoke(stateMachine);
        checkHealthyNotificationSentFunction.grantInvoke(stateMachine);
        updateHealthyNotificationSentFunction.grantInvoke(stateMachine);
        removeReservedTagFunction.grantInvoke(stateMachine);
        handleMigrationSuccessFunction.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'ec2:CreateTags',
                'ec2:DeleteTags',
                'ec2:DescribeTags'
            ],
            resources: ['*']
        }));
        getInstancesFunction.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'ec2:CreateTags',
                'ec2:DeleteTags',
                'ec2:DescribeTags'
            ],
            resources: ['*']
        }));
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
        }
        else {
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
        new cdk.CfnOutput(this, 'GetMigrationStatusFunctionArn', {
            value: getMigrationStatusFunction.functionArn,
            description: 'Lambda function to get detailed migration status',
        });
    }
}
exports.EC2HostFailoverStack = EC2HostFailoverStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWMyLWhvc3QtZmFpbG92ZXItc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJlYzItaG9zdC1mYWlsb3Zlci1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUNuQywrREFBaUQ7QUFDakQsbUVBQXFEO0FBQ3JELHlEQUEyQztBQUMzQyx3RUFBMEQ7QUFDMUQsNkVBQStEO0FBQy9ELHlEQUEyQztBQUMzQyx1RUFBeUQ7QUFDekQsdUZBQXlFO0FBQ3pFLDJDQUE2QjtBQVc3QixNQUFhLG9CQUFxQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ2pELFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBZ0M7UUFDeEUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsMkJBQTJCO1FBQzNCLE1BQU0sVUFBVSxHQUFHLElBQUksUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsb0JBQW9CLEVBQUU7WUFDaEUsWUFBWSxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUU7WUFDckUsV0FBVyxFQUFFLFFBQVEsQ0FBQyxXQUFXLENBQUMsZUFBZTtZQUNqRCxtQkFBbUIsRUFBRSxnQkFBZ0I7U0FDdEMsQ0FBQyxDQUFDO1FBRUgsdUJBQXVCO1FBQ3ZCLE1BQU0sVUFBVSxHQUFHLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUseUJBQXlCLENBQUMsQ0FBQztRQUNsRSxJQUFJLEdBQUcsQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLG1CQUFtQixFQUFFO1lBQzlDLEtBQUssRUFBRSxVQUFVO1lBQ2pCLFFBQVEsRUFBRSxHQUFHLENBQUMsb0JBQW9CLENBQUMsS0FBSztZQUN4QyxRQUFRLEVBQUUsS0FBSyxDQUFDLFVBQVU7U0FDM0IsQ0FBQyxD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Q0FBQyxrQkFBa0IsQ0FBQyxrQ0FBa0M7Z0JBQ3BGLGdCQUFnQixFQUFFLDhDQUE4QztnQkFDaEUsZ0JBQWdCLEVBQUUsVUFBVSxDQUFDLGdCQUFnQixDQUFDLGFBQWE7YUFDNUQsQ0FBQyxDQUFDO1lBRUgsa0JBQWtCLENBQUMsY0FBYyxDQUFDLElBQUksa0JBQWtCLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7UUFDbEYsQ0FBQztRQUVELFVBQVU7UUFDVixJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGdCQUFnQixFQUFFO1lBQ3hDLEtBQUssRUFBRSxVQUFVLENBQUMsU0FBUztZQUMzQixXQUFXLEVBQUUseUNBQXlDO1NBQ3ZELENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsaUJBQWlCLEVBQUU7WUFDekMsS0FBSyxFQUFFLFlBQVksQ0FBQyxlQUFlO1lBQ25DLFdBQVcsRUFBRSxrQ0FBa0M7U0FDaEQsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxlQUFlLEVBQUU7WUFDdkMsS0FBSyxFQUFFLFVBQVUsQ0FBQyxRQUFRO1lBQzFCLFdBQVcsRUFBRSxnQ0FBZ0M7U0FDOUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSwrQkFBK0IsRUFBRTtZQUN2RCxLQUFLLEVBQUUsMEJBQTBCLENBQUMsV0FBVztZQUM3QyxXQUFXLEVBQUUsa0RBQWtEO1NBQ2hFLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQXpaRCxvREF5WkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJztcbmltcG9ydCAqIGFzIHNucyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc25zJztcbmltcG9ydCAqIGFzIHN1YnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNucy1zdWJzY3JpcHRpb25zJztcbmltcG9ydCAqIGFzIHN0ZXBmdW5jdGlvbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXN0ZXBmdW5jdGlvbnMnO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgY2xvdWR3YXRjaCBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWR3YXRjaCc7XG5pbXBvcnQgKiBhcyBjbG91ZHdhdGNoX2FjdGlvbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3Vkd2F0Y2gtYWN0aW9ucyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRUMySG9zdEZhaWxvdmVyU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgYWxlcnRFbWFpbDogc3RyaW5nO1xuICBhdmFpbGFiaWxpdHlab25lOiBzdHJpbmc7XG4gIGluc3RhbmNlVHlwZTogc3RyaW5nO1xuICAvLyBPcHRpb25hbDogQWRkIHNwZWNpZmljIGhvc3QgSURzIHRvIG1vbml0b3JcbiAgZGVkaWNhdGVkSG9zdElkcz86IHN0cmluZ1tdO1xufVxuXG5leHBvcnQgY2xhc3MgRUMySG9zdEZhaWxvdmVyU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogRUMySG9zdEZhaWxvdmVyU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgLy8gRHluYW1vREIgdGFibGUgZm9yIHF1ZXVlXG4gICAgY29uc3QgcXVldWVUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnSG9zdE1pZ3JhdGlvblF1ZXVlJywge1xuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdIb3N0SWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHRpbWVUb0xpdmVBdHRyaWJ1dGU6ICdFeHBpcmF0aW9uVGltZScsXG4gICAgfSk7XG5cbiAgICAvLyBTTlMgdG9waWMgZm9yIGFsZXJ0c1xuICAgIGNvbnN0IGFsZXJ0VG9waWMgPSBuZXcgc25zLlRvcGljKHRoaXMsICdIb3N0TWlncmF0aW9uQWxlcnRUb3BpYycpO1xuICAgIG5ldyBzbnMuU3Vic2NyaXB0aW9uKHRoaXMsICdFbWFpbFN1YnNjcmlwdGlvbicsIHtcbiAgICAgIHRvcGljOiBhbGVydFRvcGljLFxuICAgICAgcHJvdG9jb2w6IHNucy5TdWJzY3JpcHRpb25Qcm90b2NvbC5FTUFJTCxcbiAgICAgIGVuZHBvaW50OiBwcm9wcy5hbGVydEVtYWlsLFxuICAgIH0pO1xuXG4gICAgLy8gTGFtYmRhIGxheWVyIHdpdGggY29tbW9uIGNvZGVcbiAgICBjb25zdCBjb21tb25MYXllciA9IG5ldyBsYW1iZGEuTGF5ZXJWZXJzaW9uKHRoaXMsICdDb21tb25MYXllcicsIHtcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnbGFtYmRhLWxheWVyJykpLFxuICAgICAgY29tcGF0aWJsZVJ1bnRpbWVzOiBbbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1hdLFxuICAgICAgZGVzY3JpcHRpb246ICdDb21tb24gdXRpbGl0aWVzIGZvciBFQzIgaG9zdCBtaWdyYXRpb24nLFxuICAgIH0pO1xuXG4gICAgLy8gQ29tbW9uIExhbWJkYSBjb25maWd1cmF0aW9uXG4gICAgY29uc3QgbGFtYmRhQ29uZmlnID0ge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBRVUVVRV9UQUJMRV9OQU1FOiBxdWV1ZVRhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgQUxFUlRfVE9QSUNfQVJOOiBhbGVydFRvcGljLnRvcGljQXJuLFxuICAgICAgICBBVkFJTEFCSUxJVFlfWk9ORTogcHJvcHMuYXZhaWxhYmlsaXR5Wm9uZSxcbiAgICAgICAgSU5TVEFOQ0VfVFlQRTogcHJvcHMuaW5zdGFuY2VUeXBlLFxuICAgICAgfSxcbiAgICAgIGxheWVyczogW2NvbW1vbkxheWVyXSxcbiAgICB9O1xuXG4gICAgLy8gQ3JlYXRlIExhbWJkYSBmdW5jdGlvbnNcbiAgICBjb25zdCBpbml0aWFsaXplRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdJbml0aWFsaXplTWlncmF0aW9uRnVuY3Rpb24nLCB7XG4gICAgICAuLi5sYW1iZGFDb25maWcsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJ2xhbWJkYS9pbml0aWFsaXplLW1pZ3JhdGlvbicpKSxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICB9KTtcblxuICAgIGNvbnN0IGNoZWNrUmVzZXJ2ZWRIb3N0RnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdDaGVja1Jlc2VydmVkSG9zdEZ1bmN0aW9uJywge1xuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICdsYW1iZGEvY2hlY2stcmVzZXJ2ZWQtaG9zdCcpKSxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICB9KTtcblxuICAgIGNvbnN0IHByb3Zpc2lvblJlc2VydmVkSG9zdEZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnUHJvdmlzaW9uUmVzZXJ2ZWRIb3N0RnVuY3Rpb24nLCB7XG4gICAgICAuLi5sYW1iZGFDb25maWcsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJ2xhbWJkYS9wcm92aXNpb24tcmVzZXJ2ZWQtaG9zdCcpKSxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLCAvLyBQcm92aXNpb25pbmcgY2FuIHRha2UgbG9uZ2VyXG4gICAgfSk7XG5cbiAgICBjb25zdCBnZXRJbnN0YW5jZXNGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0dldEluc3RhbmNlc0Z1bmN0aW9uJywge1xuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICdsYW1iZGEvZ2V0LWluc3RhbmNlcycpKSxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICB9KTtcblxuICAgIGNvbnN0IHN0b3BJbnN0YW5jZUZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnU3RvcEluc3RhbmNlRnVuY3Rpb24nLCB7XG4gICAgICAuLi5sYW1iZGFDb25maWcsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJ2xhbWJkYS9zdG9wLWluc3RhbmNlJykpLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgIH0pO1xuXG4gICAgY29uc3QgY2hlY2tJbnN0YW5jZVN0YXRlRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdDaGVja0luc3RhbmNlU3RhdGVGdW5jdGlvbicsIHtcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnbGFtYmRhL2NoZWNrLWluc3RhbmNlLXN0YXRlJykpLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgIH0pO1xuXG4gICAgY29uc3QgbW9kaWZ5UGxhY2VtZW50RnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdNb2RpZnlQbGFjZW1lbnRGdW5jdGlvbicsIHtcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnbGFtYmRhL21vZGlmeS1wbGFjZW1lbnQnKSksXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgfSk7XG5cbiAgICBjb25zdCBzdGFydEluc3RhbmNlRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdTdGFydEluc3RhbmNlRnVuY3Rpb24nLCB7XG4gICAgICAuLi5sYW1iZGFDb25maWcsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJ2xhbWJkYS9zdGFydC1pbnN0YW5jZScpKSxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICB9KTtcblxuICAgIGNvbnN0IHVwZGF0ZVN0YXR1c0Z1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnVXBkYXRlU3RhdHVzRnVuY3Rpb24nLCB7XG4gICAgICAuLi5sYW1iZGFDb25maWcsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJ2xhbWJkYS91cGRhdGUtc3RhdHVzJykpLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgIH0pO1xuXG4gICAgY29uc3QgdXBkYXRlSW5zdGFuY2VNaWdyYXRpb25TdGF0dXNGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1VwZGF0ZUluc3RhbmNlTWlncmF0aW9uU3RhdHVzRnVuY3Rpb24nLCB7XG4gICAgICAuLi5sYW1iZGFDb25maWcsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJ2xhbWJkYS91cGRhdGUtaW5zdGFuY2UtbWlncmF0aW9uLXN0YXR1cycpKSxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICB9KTtcblxuICAgIGNvbnN0IGdldE1pZ3JhdGlvblN0YXR1c0Z1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnR2V0TWlncmF0aW9uU3RhdHVzRnVuY3Rpb24nLCB7XG4gICAgICAuLi5sYW1iZGFDb25maWcsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJ2xhbWJkYS9nZXQtbWlncmF0aW9uLXN0YXR1cycpKSxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICB9KTtcblxuICAgIGNvbnN0IHByZXBhcmVEZXRhaWxlZE5vdGlmaWNhdGlvbkZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnUHJlcGFyZURldGFpbGVkTm90aWZpY2F0aW9uRnVuY3Rpb24nLCB7XG4gICAgICAuLi5sYW1iZGFDb25maWcsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJ2xhbWJkYS9wcmVwYXJlLWRldGFpbGVkLW5vdGlmaWNhdGlvbicpKSxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICB9KTtcblxuICAgIGNvbnN0IHNlbmRTdGVwTm90aWZpY2F0aW9uRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdTZW5kU3RlcE5vdGlmaWNhdGlvbkZ1bmN0aW9uJywge1xuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICdsYW1iZGEvc2VuZC1zdGVwLW5vdGlmaWNhdGlvbicpKSxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICB9KTtcblxuICAgIGNvbnN0IGhhbmRsZVByb3Zpc2lvbkZhaWx1cmVGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0hhbmRsZVByb3Zpc2lvbkZhaWx1cmVGdW5jdGlvbicsIHtcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnbGFtYmRhL2hhbmRsZS1wcm92aXNpb24tZmFpbHVyZScpKSxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICB9KTtcblxuICAgIGNvbnN0IGhhbmRsZU1pZ3JhdGlvbkZhaWx1cmVGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0hhbmRsZU1pZ3JhdGlvbkZhaWx1cmVGdW5jdGlvbicsIHtcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnbGFtYmRhL2hhbmRsZS1taWdyYXRpb24tZmFpbHVyZScpKSxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICB9KTtcblxuICAgIGNvbnN0IGhhbmRsZU1pZ3JhdGlvblN1Y2Nlc3NGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0hhbmRsZU1pZ3JhdGlvblN1Y2Nlc3NGdW5jdGlvbicsIHtcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnbGFtYmRhL2hhbmRsZS1taWdyYXRpb24tc3VjY2VzcycpKSxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICB9KTtcblxuICAgIGNvbnN0IGhhbmRsZU5vSW5zdGFuY2VzRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdIYW5kbGVOb0luc3RhbmNlc0Z1bmN0aW9uJywge1xuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICdsYW1iZGEvaGFuZGxlLW5vLWluc3RhbmNlcycpKSxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICB9KTtcblxuICAgIGNvbnN0IGNoZWNrSW5zdGFuY2VzSGVhbHRoRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdDaGVja0luc3RhbmNlc0hlYWx0aEZ1bmN0aW9uJywge1xuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICdsYW1iZGEvY2hlY2staW5zdGFuY2VzLWhlYWx0aCcpKSxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLCAvLyBMb25nZXIgdGltZW91dCBmb3IgU1NNIG9wZXJhdGlvbnNcbiAgICB9KTtcblxuICAgIGNvbnN0IG1hcmtIb3N0SGVhbHRoeUZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnTWFya0hvc3RIZWFsdGh5RnVuY3Rpb24nLCB7XG4gICAgICAuLi5sYW1iZGFDb25maWcsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJ2xhbWJkYS9tYXJrLWhvc3QtaGVhbHRoeScpKSxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICB9KTtcblxuICAgIGNvbnN0IGNoZWNrSGVhbHRoeU5vdGlmaWNhdGlvblNlbnRGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0NoZWNrSGVhbHRoeU5vdGlmaWNhdGlvblNlbnRGdW5jdGlvbicsIHtcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnbGFtYmRhL2NoZWNrLWhlYWx0aHktbm90aWZpY2F0aW9uLXNlbnQnKSksXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgfSk7XG5cbiAgICBjb25zdCB1cGRhdGVIZWFsdGh5Tm90aWZpY2F0aW9uU2VudEZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnVXBkYXRlSGVhbHRoeU5vdGlmaWNhdGlvblNlbnRGdW5jdGlvbicsIHtcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnbGFtYmRhL3VwZGF0ZS1oZWFsdGh5LW5vdGlmaWNhdGlvbi1zZW50JykpLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgIH0pO1xuXG4gICAgLy8gR3JhbnQgcGVybWlzc2lvbnNcbiAgICBxdWV1ZVRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShpbml0aWFsaXplRnVuY3Rpb24pO1xuICAgIHF1ZXVlVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKHVwZGF0ZVN0YXR1c0Z1bmN0aW9uKTtcbiAgICBxdWV1ZVRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YSh1cGRhdGVJbnN0YW5jZU1pZ3JhdGlvblN0YXR1c0Z1bmN0aW9uKTtcbiAgICBxdWV1ZVRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShnZXRJbnN0YW5jZXNGdW5jdGlvbik7XG4gICAgcXVldWVUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoaGFuZGxlUHJvdmlzaW9uRmFpbHVyZUZ1bmN0aW9uKTtcbiAgICBxdWV1ZVRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShoYW5kbGVNaWdyYXRpb25GYWlsdXJlRnVuY3Rpb24pO1xuICAgIHF1ZXVlVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGhhbmRsZU1pZ3JhdGlvblN1Y2Nlc3NGdW5jdGlvbik7XG4gICAgcXVldWVUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoaGFuZGxlTm9JbnN0YW5jZXNGdW5jdGlvbik7XG4gICAgcXVldWVUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoY2hlY2tJbnN0YW5jZXNIZWFsdGhGdW5jdGlvbik7XG4gICAgcXVldWVUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEobWFya0hvc3RIZWFsdGh5RnVuY3Rpb24pO1xuICAgIHF1ZXVlVGFibGUuZ3JhbnRSZWFkRGF0YShjaGVja0hlYWx0aHlOb3RpZmljYXRpb25TZW50RnVuY3Rpb24pO1xuICAgIHF1ZXVlVGFibGUuZ3JhbnRXcml0ZURhdGEodXBkYXRlSGVhbHRoeU5vdGlmaWNhdGlvblNlbnRGdW5jdGlvbik7XG4gICAgcXVldWVUYWJsZS5ncmFudFJlYWREYXRhKGdldE1pZ3JhdGlvblN0YXR1c0Z1bmN0aW9uKTtcbiAgICBxdWV1ZVRhYmxlLmdyYW50UmVhZERhdGEocHJlcGFyZURldGFpbGVkTm90aWZpY2F0aW9uRnVuY3Rpb24pO1xuICAgIHF1ZXVlVGFibGUuZ3JhbnRSZWFkRGF0YShzZW5kU3RlcE5vdGlmaWNhdGlvbkZ1bmN0aW9uKTtcbiAgICBhbGVydFRvcGljLmdyYW50UHVibGlzaChpbml0aWFsaXplRnVuY3Rpb24pO1xuICAgIGFsZXJ0VG9waWMuZ3JhbnRQdWJsaXNoKHVwZGF0ZVN0YXR1c0Z1bmN0aW9uKTtcbiAgICBhbGVydFRvcGljLmdyYW50UHVibGlzaChzZW5kU3RlcE5vdGlmaWNhdGlvbkZ1bmN0aW9uKTtcbiAgICBhbGVydFRvcGljLmdyYW50UHVibGlzaChtYXJrSG9zdEhlYWx0aHlGdW5jdGlvbik7XG5cbiAgICAvLyBFQzIgcGVybWlzc2lvbnNcbiAgICBjb25zdCBlYzJQb2xpY3kgPSBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgICdlYzI6RGVzY3JpYmVIb3N0cycsXG4gICAgICAgICdlYzI6QWxsb2NhdGVIb3N0cycsXG4gICAgICAgICdlYzI6RGVzY3JpYmVJbnN0YW5jZXMnLFxuICAgICAgICAnZWMyOlN0b3BJbnN0YW5jZXMnLFxuICAgICAgICAnZWMyOlN0YXJ0SW5zdGFuY2VzJyxcbiAgICAgICAgJ2VjMjpNb2RpZnlJbnN0YW5jZVBsYWNlbWVudCcsXG4gICAgICAgICdlYzI6Q3JlYXRlVGFncycsXG4gICAgICAgICdlYzI6Rm9yY2VTdG9wSW5zdGFuY2VzJyxcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgIH0pO1xuXG4gICAgY2hlY2tSZXNlcnZlZEhvc3RGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3koZWMyUG9saWN5KTtcbiAgICBpbml0aWFsaXplRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KGVjMlBvbGljeSk7IC8vIEFkZCBFQzIgcGVybWlzc2lvbnMgZm9yIG1lcmdlZCBmdW5jdGlvbmFsaXR5XG4gICAgcHJvdmlzaW9uUmVzZXJ2ZWRIb3N0RnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KGVjMlBvbGljeSk7XG4gICAgY2hlY2tJbnN0YW5jZXNIZWFsdGhGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3koZWMyUG9saWN5KTtcblxuICAgIC8vIEFkZCBTU00gcGVybWlzc2lvbnMgZm9yIGhlYWx0aCBjaGVjayBmdW5jdGlvblxuICAgIGNvbnN0IHNzbVBvbGljeSA9IG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ3NzbTpTZW5kQ29tbWFuZCcsXG4gICAgICAgICdzc206R2V0Q29tbWFuZEludm9jYXRpb24nLFxuICAgICAgICAnc3NtOkRlc2NyaWJlSW5zdGFuY2VJbmZvcm1hdGlvbicsXG4gICAgICAgICdzc206TGlzdENvbW1hbmRJbnZvY2F0aW9ucydcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgIH0pO1xuXG4gICAgY2hlY2tJbnN0YW5jZXNIZWFsdGhGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3koc3NtUG9saWN5KTtcbiAgICBnZXRJbnN0YW5jZXNGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3koZWMyUG9saWN5KTtcbiAgICBzdG9wSW5zdGFuY2VGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3koZWMyUG9saWN5KTtcbiAgICBjaGVja0luc3RhbmNlU3RhdGVGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3koZWMyUG9saWN5KTtcbiAgICBtb2RpZnlQbGFjZW1lbnRGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3koZWMyUG9saWN5KTtcbiAgICBzdGFydEluc3RhbmNlRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KGVjMlBvbGljeSk7XG5cbiAgICAvLyBDcmVhdGUgdGhlIHN0YXRlIG1hY2hpbmUgdXNpbmcgdGhlIEpTT04gZGVmaW5pdGlvblxuICAgIC8vIENyZWF0ZSBMYW1iZGEgZnVuY3Rpb24gdG8gcmVtb3ZlIFJlc2VydmVkIHRhZ1xuICAgIGNvbnN0IHJlbW92ZVJlc2VydmVkVGFnRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdSZW1vdmVSZXNlcnZlZFRhZ0Z1bmN0aW9uJywge1xuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICdsYW1iZGEvcmVtb3ZlLXJlc2VydmVkLXRhZycpKSxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICB9KTtcbiAgICBcbiAgICAvLyBHcmFudCBFQzIgcGVybWlzc2lvbnMgdG8gcmVtb3ZlIHRhZ3NcbiAgICByZW1vdmVSZXNlcnZlZFRhZ0Z1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBhY3Rpb25zOiBbJ2VjMjpEZWxldGVUYWdzJ10sXG4gICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgIH0pKTtcblxuICAgIGNvbnN0IHN0YXRlTWFjaGluZSA9IG5ldyBzdGVwZnVuY3Rpb25zLlN0YXRlTWFjaGluZSh0aGlzLCAnSG9zdE1pZ3JhdGlvblN0YXRlTWFjaGluZScsIHtcbiAgICAgIGRlZmluaXRpb25Cb2R5OiBzdGVwZnVuY3Rpb25zLkRlZmluaXRpb25Cb2R5LmZyb21GaWxlKHBhdGguam9pbihfX2Rpcm5hbWUsICdzdGVwLWZ1bmN0aW9ucy9taWdyYXRpb24td29ya2Zsb3cuanNvbicpKSxcbiAgICAgIGRlZmluaXRpb25TdWJzdGl0dXRpb25zOiB7XG4gICAgICAgIENoZWNrSW5zdGFuY2VzSGVhbHRoRnVuY3Rpb246IGNoZWNrSW5zdGFuY2VzSGVhbHRoRnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgICAgIE1hcmtIb3N0SGVhbHRoeUZ1bmN0aW9uOiBtYXJrSG9zdEhlYWx0aHlGdW5jdGlvbi5mdW5jdGlvbkFybixcbiAgICAgICAgQ2hlY2tIZWFsdGh5Tm90aWZpY2F0aW9uU2VudEZ1bmN0aW9uOiBjaGVja0hlYWx0aHlOb3RpZmljYXRpb25TZW50RnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgICAgIFVwZGF0ZUhlYWx0aHlOb3RpZmljYXRpb25TZW50RnVuY3Rpb246IHVwZGF0ZUhlYWx0aHlOb3RpZmljYXRpb25TZW50RnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgICAgIEluaXRpYWxpemVNaWdyYXRpb25GdW5jdGlvbjogaW5pdGlhbGl6ZUZ1bmN0aW9uLmZ1bmN0aW9uQXJuLFxuICAgICAgICBDaGVja1Jlc2VydmVkSG9zdEZ1bmN0aW9uOiBjaGVja1Jlc2VydmVkSG9zdEZ1bmN0aW9uLmZ1bmN0aW9uQXJuLFxuICAgICAgICBQcm92aXNpb25SZXNlcnZlZEhvc3RGdW5jdGlvbjogcHJvdmlzaW9uUmVzZXJ2ZWRIb3N0RnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgICAgIEdldEluc3RhbmNlc0Z1bmN0aW9uOiBnZXRJbnN0YW5jZXNGdW5jdGlvbi5mdW5jdGlvbkFybixcbiAgICAgICAgU3RvcEluc3RhbmNlRnVuY3Rpb246IHN0b3BJbnN0YW5jZUZ1bmN0aW9uLmZ1bmN0aW9uQXJuLFxuICAgICAgICBDaGVja0luc3RhbmNlU3RhdGVGdW5jdGlvbjogY2hlY2tJbnN0YW5jZVN0YXRlRnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgICAgIE1vZGlmeVBsYWNlbWVudEZ1bmN0aW9uOiBtb2RpZnlQbGFjZW1lbnRGdW5jdGlvbi5mdW5jdGlvbkFybixcbiAgICAgICAgU3RhcnRJbnN0YW5jZUZ1bmN0aW9uOiBzdGFydEluc3RhbmNlRnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgICAgIFVwZGF0ZVN0YXR1c0Z1bmN0aW9uOiB1cGRhdGVTdGF0dXNGdW5jdGlvbi5mdW5jdGlvbkFybixcbiAgICAgICAgVXBkYXRlSW5zdGFuY2VNaWdyYXRpb25TdGF0dXNGdW5jdGlvbjogdXBkYXRlSW5zdGFuY2VNaWdyYXRpb25TdGF0dXNGdW5jdGlvbi5mdW5jdGlvbkFybixcbiAgICAgICAgUHJlcGFyZURldGFpbGVkTm90aWZpY2F0aW9uRnVuY3Rpb246IHByZXBhcmVEZXRhaWxlZE5vdGlmaWNhdGlvbkZ1bmN0aW9uLmZ1bmN0aW9uQXJuLFxuICAgICAgICBTZW5kU3RlcE5vdGlmaWNhdGlvbkZ1bmN0aW9uOiBzZW5kU3RlcE5vdGlmaWNhdGlvbkZ1bmN0aW9uLmZ1bmN0aW9uQXJuLFxuICAgICAgICBIYW5kbGVQcm92aXNpb25GYWlsdXJlRnVuY3Rpb246IGhhbmRsZVByb3Zpc2lvbkZhaWx1cmVGdW5jdGlvbi5mdW5jdGlvbkFybixcbiAgICAgICAgSGFuZGxlTWlncmF0aW9uRmFpbHVyZUZ1bmN0aW9uOiBoYW5kbGVNaWdyYXRpb25GYWlsdXJlRnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgICAgIEhhbmRsZU1pZ3JhdGlvblN1Y2Nlc3NGdW5jdGlvbjogaGFuZGxlTWlncmF0aW9uU3VjY2Vzc0Z1bmN0aW9uLmZ1bmN0aW9uQXJuLFxuICAgICAgICBIYW5kbGVOb0luc3RhbmNlc0Z1bmN0aW9uOiBoYW5kbGVOb0luc3RhbmNlc0Z1bmN0aW9uLmZ1bmN0aW9uQXJuLFxuICAgICAgICBSZW1vdmVSZXNlcnZlZFRhZ0Z1bmN0aW9uOiByZW1vdmVSZXNlcnZlZFRhZ0Z1bmN0aW9uLmZ1bmN0aW9uQXJuLFxuICAgICAgICBBbGVydFRvcGljQXJuOiBhbGVydFRvcGljLnRvcGljQXJuLFxuICAgICAgICBBdmFpbGFiaWxpdHlab25lOiBwcm9wcy5hdmFpbGFiaWxpdHlab25lLFxuICAgICAgICBJbnN0YW5jZVR5cGU6IHByb3BzLmluc3RhbmNlVHlwZVxuICAgICAgfSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5ob3VycygyNCksIC8vIEFsbG93IHVwIHRvIDI0IGhvdXJzIGZvciB0aGUgZW50aXJlIG1pZ3JhdGlvblxuICAgICAgc3RhdGVNYWNoaW5lVHlwZTogc3RlcGZ1bmN0aW9ucy5TdGF0ZU1hY2hpbmVUeXBlLlNUQU5EQVJELFxuICAgIH0pO1xuICAgIFxuICAgIC8vIEdyYW50IHBlcm1pc3Npb25zIGZvciB0aGUgc3RhdGUgbWFjaGluZSB0byBpbnZva2UgYWxsIExhbWJkYSBmdW5jdGlvbnNcbiAgICBpbml0aWFsaXplRnVuY3Rpb24uZ3JhbnRJbnZva2Uoc3RhdGVNYWNoaW5lKTtcbiAgICBjaGVja1Jlc2VydmVkSG9zdEZ1bmN0aW9uLmdyYW50SW52b2tlKHN0YXRlTWFjaGluZSk7XG4gICAgcHJvdmlzaW9uUmVzZXJ2ZWRIb3N0RnVuY3Rpb24uZ3JhbnRJbnZva2Uoc3RhdGVNYWNoaW5lKTtcbiAgICBnZXRJbnN0YW5jZXNGdW5jdGlvbi5ncmFudEludm9rZShzdGF0ZU1hY2hpbmUpO1xuICAgIHN0b3BJbnN0YW5jZUZ1bmN0aW9uLmdyYW50SW52b2tlKHN0YXRlTWFjaGluZSk7XG4gICAgY2hlY2tJbnN0YW5jZVN0YXRlRnVuY3Rpb24uZ3JhbnRJbnZva2Uoc3RhdGVNYWNoaW5lKTtcbiAgICBtb2RpZnlQbGFjZW1lbnRGdW5jdGlvbi5ncmFudEludm9rZShzdGF0ZU1hY2hpbmUpO1xuICAgIHN0YXJ0SW5zdGFuY2VGdW5jdGlvbi5ncmFudEludm9rZShzdGF0ZU1hY2hpbmUpO1xuICAgIHVwZGF0ZVN0YXR1c0Z1bmN0aW9uLmdyYW50SW52b2tlKHN0YXRlTWFjaGluZSk7XG4gICAgdXBkYXRlSW5zdGFuY2VNaWdyYXRpb25TdGF0dXNGdW5jdGlvbi5ncmFudEludm9rZShzdGF0ZU1hY2hpbmUpO1xuICAgIHByZXBhcmVEZXRhaWxlZE5vdGlmaWNhdGlvbkZ1bmN0aW9uLmdyYW50SW52b2tlKHN0YXRlTWFjaGluZSk7XG4gICAgc2VuZFN0ZXBOb3RpZmljYXRpb25GdW5jdGlvbi5ncmFudEludm9rZShzdGF0ZU1hY2hpbmUpO1xuICAgIGhhbmRsZVByb3Zpc2lvbkZhaWx1cmVGdW5jdGlvbi5ncmFudEludm9rZShzdGF0ZU1hY2hpbmUpO1xuICAgIGhhbmRsZU1pZ3JhdGlvbkZhaWx1cmVGdW5jdGlvbi5ncmFudEludm9rZShzdGF0ZU1hY2hpbmUpO1xuICAgIGhhbmRsZU1pZ3JhdGlvblN1Y2Nlc3NGdW5jdGlvbi5ncmFudEludm9rZShzdGF0ZU1hY2hpbmUpO1xuICAgIGhhbmRsZU5vSW5zdGFuY2VzRnVuY3Rpb24uZ3JhbnRJbnZva2Uoc3RhdGVNYWNoaW5lKTtcbiAgICBjaGVja0luc3RhbmNlc0hlYWx0aEZ1bmN0aW9uLmdyYW50SW52b2tlKHN0YXRlTWFjaGluZSk7XG4gICAgbWFya0hvc3RIZWFsdGh5RnVuY3Rpb24uZ3JhbnRJbnZva2Uoc3RhdGVNYWNoaW5lKTtcbiAgICBjaGVja0hlYWx0aHlOb3RpZmljYXRpb25TZW50RnVuY3Rpb24uZ3JhbnRJbnZva2Uoc3RhdGVNYWNoaW5lKTtcbiAgICB1cGRhdGVIZWFsdGh5Tm90aWZpY2F0aW9uU2VudEZ1bmN0aW9uLmdyYW50SW52b2tlKHN0YXRlTWFjaGluZSk7XG4gICAgcmVtb3ZlUmVzZXJ2ZWRUYWdGdW5jdGlvbi5ncmFudEludm9rZShzdGF0ZU1hY2hpbmUpO1xuICAgIFxuICAgIGhhbmRsZU1pZ3JhdGlvblN1Y2Nlc3NGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAnZWMyOkNyZWF0ZVRhZ3MnLFxuICAgICAgICAnZWMyOkRlbGV0ZVRhZ3MnLFxuICAgICAgICAnZWMyOkRlc2NyaWJlVGFncydcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFsnKiddXG4gICAgfSkpO1xuXG4gICAgZ2V0SW5zdGFuY2VzRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2VjMjpDcmVhdGVUYWdzJyxcbiAgICAgICAgJ2VjMjpEZWxldGVUYWdzJyxcbiAgICAgICAgJ2VjMjpEZXNjcmliZVRhZ3MnXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbJyonXVxuICAgIH0pKTtcblxuICAgIC8vIEdyYW50IHRoZSBTdGVwIEZ1bmN0aW9uIHBlcm1pc3Npb24gdG8gcHVibGlzaCB0byB0aGUgU05TIHRvcGljXG4gICAgYWxlcnRUb3BpYy5ncmFudFB1Ymxpc2goc3RhdGVNYWNoaW5lKTtcblxuICAgIC8vIENyZWF0ZSBhbGFybSBoYW5kbGVyIExhbWJkYVxuICAgIGNvbnN0IGFsYXJtSGFuZGxlckZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQWxhcm1IYW5kbGVyRnVuY3Rpb24nLCB7XG4gICAgICAuLi5sYW1iZGFDb25maWcsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJ2xhbWJkYS9hbGFybS1oYW5kbGVyJykpLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgLi4ubGFtYmRhQ29uZmlnLmVudmlyb25tZW50LFxuICAgICAgICBNSUdSQVRJT05fU1RBVEVfTUFDSElORV9BUk46IHN0YXRlTWFjaGluZS5zdGF0ZU1hY2hpbmVBcm4sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gR3JhbnQgcGVybWlzc2lvbnMgdG8gc3RhcnQgU3RlcCBGdW5jdGlvbnMgZXhlY3V0aW9uXG4gICAgc3RhdGVNYWNoaW5lLmdyYW50U3RhcnRFeGVjdXRpb24oYWxhcm1IYW5kbGVyRnVuY3Rpb24pO1xuICAgIFxuICAgIC8vIEdyYW50IER5bmFtb0RCIHBlcm1pc3Npb25zIGZvciBHZXRJdGVtIGFuZCBQdXRJdGVtIG9wZXJhdGlvbnNcbiAgICBxdWV1ZVRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShhbGFybUhhbmRsZXJGdW5jdGlvbik7XG5cbiAgICAvLyBDcmVhdGUgU05TIHRvcGljIGZvciBDbG91ZFdhdGNoIGFsYXJtc1xuICAgIGNvbnN0IGFsYXJtVG9waWMgPSBuZXcgc25zLlRvcGljKHRoaXMsICdIb3N0QWxhcm1Ub3BpYycpO1xuICAgIGFsYXJtVG9waWMuYWRkU3Vic2NyaXB0aW9uKG5ldyBzdWJzLkxhbWJkYVN1YnNjcmlwdGlvbihhbGFybUhhbmRsZXJGdW5jdGlvbikpO1xuXG4gICAgLy8gQ3JlYXRlIENsb3VkV2F0Y2ggYWxhcm1zIGZvciBkZWRpY2F0ZWQgaG9zdCBzdGF0dXNcbiAgICBpZiAocHJvcHMuZGVkaWNhdGVkSG9zdElkcyAmJiBwcm9wcy5kZWRpY2F0ZWRIb3N0SWRzLmxlbmd0aCA+IDApIHtcbiAgICAgIHByb3BzLmRlZGljYXRlZEhvc3RJZHMuZm9yRWFjaCgoaG9zdElkLCBpbmRleCkgPT4ge1xuICAgICAgICBjb25zdCBkZWRpY2F0ZWRIb3N0U3RhdHVzTWV0cmljID0gbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICBuYW1lc3BhY2U6ICdBV1MvRUMyJyxcbiAgICAgICAgICBtZXRyaWNOYW1lOiAnU3RhdHVzQ2hlY2tGYWlsZWQnLFxuICAgICAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgICAgIEhvc3RJZDogaG9zdElkLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgc3RhdGlzdGljOiAnTWF4aW11bScsXG4gICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgZGVkaWNhdGVkSG9zdEFsYXJtID0gbmV3IGNsb3Vkd2F0Y2guQWxhcm0odGhpcywgYERlZGljYXRlZEhvc3RTdGF0dXNBbGFybS0ke2luZGV4fWAsIHtcbiAgICAgICAgICBtZXRyaWM6IGRlZGljYXRlZEhvc3RTdGF0dXNNZXRyaWMsXG4gICAgICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDEsXG4gICAgICAgICAgdGhyZXNob2xkOiAxLFxuICAgICAgICAgIGNvbXBhcmlzb25PcGVyYXRvcjogY2xvdWR3YXRjaC5Db21wYXJpc29uT3BlcmF0b3IuR1JFQVRFUl9USEFOX09SX0VRVUFMX1RPX1RIUkVTSE9MRCxcbiAgICAgICAgICBhbGFybURlc2NyaXB0aW9uOiBgQWxhcm0gd2hlbiBkZWRpY2F0ZWQgaG9zdCAke2hvc3RJZH0gc3RhdHVzIGNoZWNrIGZhaWxzYCxcbiAgICAgICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgZGVkaWNhdGVkSG9zdEFsYXJtLmFkZEFsYXJtQWN0aW9uKG5ldyBjbG91ZHdhdGNoX2FjdGlvbnMuU25zQWN0aW9uKGFsYXJtVG9waWMpKTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBDcmVhdGUgYSBwbGFjZWhvbGRlciBhbGFybSAtIHlvdSBzaG91bGQgcmVwbGFjZSB0aGlzIHdpdGggYWN0dWFsIGhvc3QgSURzXG4gICAgICBjb25zdCBkZWRpY2F0ZWRIb3N0U3RhdHVzTWV0cmljID0gbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgbmFtZXNwYWNlOiAnQVdTL0VDMicsXG4gICAgICAgIG1ldHJpY05hbWU6ICdTdGF0dXNDaGVja0ZhaWxlZCcsXG4gICAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgICBIb3N0SWQ6ICdQTEFDRUhPTERFUl9IT1NUX0lEJywgLy8gUmVwbGFjZSB3aXRoIGFjdHVhbCBob3N0IElEXG4gICAgICAgIH0sXG4gICAgICAgIHN0YXRpc3RpYzogJ01heGltdW0nLFxuICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgfSk7XG5cbiAgICAgIGNvbnN0IGRlZGljYXRlZEhvc3RBbGFybSA9IG5ldyBjbG91ZHdhdGNoLkFsYXJtKHRoaXMsICdEZWRpY2F0ZWRIb3N0U3RhdHVzQWxhcm0nLCB7XG4gICAgICAgIG1ldHJpYzogZGVkaWNhdGVkSG9zdFN0YXR1c01ldHJpYyxcbiAgICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDEsXG4gICAgICAgIHRocmVzaG9sZDogMSxcbiAgICAgICAgY29tcGFyaXNvbk9wZXJhdG9yOiBjbG91ZHdhdGNoLkNvbXBhcmlzb25PcGVyYXRvci5HUkVBVEVSX1RIQU5fT1JfRVFVQUxfVE9fVEhSRVNIT0xELFxuICAgICAgICBhbGFybURlc2NyaXB0aW9uOiAnQWxhcm0gd2hlbiBkZWRpY2F0ZWQgaG9zdCBzdGF0dXMgY2hlY2sgZmFpbHMnLFxuICAgICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICAgIH0pO1xuXG4gICAgICBkZWRpY2F0ZWRIb3N0QWxhcm0uYWRkQWxhcm1BY3Rpb24obmV3IGNsb3Vkd2F0Y2hfYWN0aW9ucy5TbnNBY3Rpb24oYWxhcm1Ub3BpYykpO1xuICAgIH1cblxuICAgIC8vIE91dHB1dHNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUXVldWVUYWJsZU5hbWUnLCB7XG4gICAgICB2YWx1ZTogcXVldWVUYWJsZS50YWJsZU5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ0R5bmFtb0RCIHRhYmxlIGZvciBob3N0IG1pZ3JhdGlvbiBxdWV1ZScsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnU3RhdGVNYWNoaW5lQXJuJywge1xuICAgICAgdmFsdWU6IHN0YXRlTWFjaGluZS5zdGF0ZU1hY2hpbmVBcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ1N0ZXAgRnVuY3Rpb25zIHN0YXRlIG1hY2hpbmUgQVJOJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBbGVydFRvcGljQXJuJywge1xuICAgICAgdmFsdWU6IGFsZXJ0VG9waWMudG9waWNBcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ1NOUyB0b3BpYyBmb3IgbWlncmF0aW9uIGFsZXJ0cycsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnR2V0TWlncmF0aW9uU3RhdHVzRnVuY3Rpb25Bcm4nLCB7XG4gICAgICB2YWx1ZTogZ2V0TWlncmF0aW9uU3RhdHVzRnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ0xhbWJkYSBmdW5jdGlvbiB0byBnZXQgZGV0YWlsZWQgbWlncmF0aW9uIHN0YXR1cycsXG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==