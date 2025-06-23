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
        // Grant permissions
        queueTable.grantReadWriteData(initializeFunction);
        queueTable.grantReadWriteData(updateStatusFunction);
        queueTable.grantReadWriteData(updateInstanceMigrationStatusFunction);
        queueTable.grantReadWriteData(getInstancesFunction);
        queueTable.grantReadData(getMigrationStatusFunction);
        queueTable.grantReadData(prepareDetailedNotificationFunction);
        queueTable.grantReadData(sendStepNotificationFunction);
        alertTopic.grantPublish(initializeFunction);
        alertTopic.grantPublish(updateStatusFunction);
        alertTopic.grantPublish(sendStepNotificationFunction);
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
                UpdateInstanceMigrationStatusFunction: updateInstanceMigrationStatusFunction.functionArn,
                PrepareDetailedNotificationFunction: prepareDetailedNotificationFunction.functionArn,
                SendStepNotificationFunction: sendStepNotificationFunction.functionArn,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWMyLWhvc3QtZmFpbG92ZXItc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJlYzItaG9zdC1mYWlsb3Zlci1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUNuQywrREFBaUQ7QUFDakQsbUVBQXFEO0FBQ3JELHlEQUEyQztBQUMzQyx3RUFBMEQ7QUFDMUQsNkVBQStEO0FBQy9ELHlEQUEyQztBQUMzQyx1RUFBeUQ7QUFDekQsdUZBQXlFO0FBQ3pFLDJDQUE2QjtBQVc3QixNQUFhLG9CQUFxQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ2pELFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBZ0M7UUFDeEUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsMkJBQTJCO1FBQzNCLE1BQU0sVUFBVSxHQUFHLElBQUksUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsb0JBQW9CLEVBQUU7WUFDaEUsWUFBWSxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUU7WUFDckUsV0FBVyxFQUFFLFFBQVEsQ0FBQyxXQUFXLENBQUMsZUFBZTtZQUNqRCxtQkFBbUIsRUFBRSxnQkFBZ0I7U0FDdEMsQ0FBQyxDQUFDO1FBRUgsdUJBQXVCO1FBQ3ZCLE1BQU0sVUFBVSxHQUFHLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUseUJBQXlCLENBQUMsQ0FBQztRQUNsRSxJQUFJLEdBQUcsQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLG1CQUFtQixFQUFFO1lBQzlDLEtBQUssRUFBRSxVQUFVO1lBQ2pCLFFBQVEsRUFBRSxHQUFHLENBQUMsb0JBQW9CLENBQUMsS0FBSztZQUN4QyxRQUFRLEVBQUUsS0FBSyxDQUFDLFVBQVU7U0FDM0IsQ0FBQyxD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QUUsQ0FBQztnQkFDcEIsU0FBUyxFQUFFLENBQUM7Z0JBQ1osa0JBQWtCLEVBQUUsVUFBVSxDQUFDLGtCQUFrQixDQUFDLGtDQUFrQztnQkFDcEYsZ0JBQWdCLEVBQUUsOENBQThDO2dCQUNoRSxnQkFBZ0IsRUFBRSxVQUFVLENBQUMsZ0JBQWdCLENBQUMsYUFBYTthQUM1RCxDQUFDLENBQUM7WUFFSCxrQkFBa0IsQ0FBQyxjQUFjLENBQUMsSUFBSSxrQkFBa0IsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztRQUNsRixDQUFDO1FBRUQsVUFBVTtRQUNWLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsZ0JBQWdCLEVBQUU7WUFDeEMsS0FBSyxFQUFFLFVBQVUsQ0FBQyxTQUFTO1lBQzNCLFdBQVcsRUFBRSx5Q0FBeUM7U0FDdkQsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxpQkFBaUIsRUFBRTtZQUN6QyxLQUFLLEVBQUUsWUFBWSxDQUFDLGVBQWU7WUFDbkMsV0FBVyxFQUFFLGtDQUFrQztTQUNoRCxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRTtZQUN2QyxLQUFLLEVBQUUsVUFBVSxDQUFDLFFBQVE7WUFDMUIsV0FBVyxFQUFFLGdDQUFnQztTQUM5QyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLCtCQUErQixFQUFFO1lBQ3ZELEtBQUssRUFBRSwwQkFBMEIsQ0FBQyxXQUFXO1lBQzdDLFdBQVcsRUFBRSxrREFBa0Q7U0FDaEUsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBNVNELG9EQTRTQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0ICogYXMgc25zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zbnMnO1xuaW1wb3J0ICogYXMgc3VicyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc25zLXN1YnNjcmlwdGlvbnMnO1xuaW1wb3J0ICogYXMgc3RlcGZ1bmN0aW9ucyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc3RlcGZ1bmN0aW9ucyc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBjbG91ZHdhdGNoIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZHdhdGNoJztcbmltcG9ydCAqIGFzIGNsb3Vkd2F0Y2hfYWN0aW9ucyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWR3YXRjaC1hY3Rpb25zJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuZXhwb3J0IGludGVyZmFjZSBFQzJIb3N0RmFpbG92ZXJTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBhbGVydEVtYWlsOiBzdHJpbmc7XG4gIGF2YWlsYWJpbGl0eVpvbmU6IHN0cmluZztcbiAgaW5zdGFuY2VUeXBlOiBzdHJpbmc7XG4gIC8vIE9wdGlvbmFsOiBBZGQgc3BlY2lmaWMgaG9zdCBJRHMgdG8gbW9uaXRvclxuICBkZWRpY2F0ZWRIb3N0SWRzPzogc3RyaW5nW107XG59XG5cbmV4cG9ydCBjbGFzcyBFQzJIb3N0RmFpbG92ZXJTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBFQzJIb3N0RmFpbG92ZXJTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICAvLyBEeW5hbW9EQiB0YWJsZSBmb3IgcXVldWVcbiAgICBjb25zdCBxdWV1ZVRhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdIb3N0TWlncmF0aW9uUXVldWUnLCB7XG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ0hvc3RJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgdGltZVRvTGl2ZUF0dHJpYnV0ZTogJ0V4cGlyYXRpb25UaW1lJyxcbiAgICB9KTtcblxuICAgIC8vIFNOUyB0b3BpYyBmb3IgYWxlcnRzXG4gICAgY29uc3QgYWxlcnRUb3BpYyA9IG5ldyBzbnMuVG9waWModGhpcywgJ0hvc3RNaWdyYXRpb25BbGVydFRvcGljJyk7XG4gICAgbmV3IHNucy5TdWJzY3JpcHRpb24odGhpcywgJ0VtYWlsU3Vic2NyaXB0aW9uJywge1xuICAgICAgdG9waWM6IGFsZXJ0VG9waWMsXG4gICAgICBwcm90b2NvbDogc25zLlN1YnNjcmlwdGlvblByb3RvY29sLkVNQUlMLFxuICAgICAgZW5kcG9pbnQ6IHByb3BzLmFsZXJ0RW1haWwsXG4gICAgfSk7XG5cbiAgICAvLyBMYW1iZGEgbGF5ZXIgd2l0aCBjb21tb24gY29kZVxuICAgIGNvbnN0IGNvbW1vbkxheWVyID0gbmV3IGxhbWJkYS5MYXllclZlcnNpb24odGhpcywgJ0NvbW1vbkxheWVyJywge1xuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICdsYW1iZGEtbGF5ZXInKSksXG4gICAgICBjb21wYXRpYmxlUnVudGltZXM6IFtsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWF0sXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvbW1vbiB1dGlsaXRpZXMgZm9yIEVDMiBob3N0IG1pZ3JhdGlvbicsXG4gICAgfSk7XG5cbiAgICAvLyBDb21tb24gTGFtYmRhIGNvbmZpZ3VyYXRpb25cbiAgICBjb25zdCBsYW1iZGFDb25maWcgPSB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIFFVRVVFX1RBQkxFX05BTUU6IHF1ZXVlVGFibGUudGFibGVOYW1lLFxuICAgICAgICBBTEVSVF9UT1BJQ19BUk46IGFsZXJ0VG9waWMudG9waWNBcm4sXG4gICAgICAgIEFWQUlMQUJJTElUWV9aT05FOiBwcm9wcy5hdmFpbGFiaWxpdHlab25lLFxuICAgICAgICBJTlNUQU5DRV9UWVBFOiBwcm9wcy5pbnN0YW5jZVR5cGUsXG4gICAgICB9LFxuICAgICAgbGF5ZXJzOiBbY29tbW9uTGF5ZXJdLFxuICAgIH07XG5cbiAgICAvLyBDcmVhdGUgTGFtYmRhIGZ1bmN0aW9uc1xuICAgIGNvbnN0IGluaXRpYWxpemVGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0luaXRpYWxpemVNaWdyYXRpb25GdW5jdGlvbicsIHtcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnbGFtYmRhL2luaXRpYWxpemUtbWlncmF0aW9uJykpLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgIH0pO1xuXG4gICAgY29uc3QgY2hlY2tSZXNlcnZlZEhvc3RGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0NoZWNrUmVzZXJ2ZWRIb3N0RnVuY3Rpb24nLCB7XG4gICAgICAuLi5sYW1iZGFDb25maWcsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJ2xhbWJkYS9jaGVjay1yZXNlcnZlZC1ob3N0JykpLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgIH0pO1xuXG4gICAgY29uc3QgcHJvdmlzaW9uUmVzZXJ2ZWRIb3N0RnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdQcm92aXNpb25SZXNlcnZlZEhvc3RGdW5jdGlvbicsIHtcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnbGFtYmRhL3Byb3Zpc2lvbi1yZXNlcnZlZC1ob3N0JykpLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksIC8vIFByb3Zpc2lvbmluZyBjYW4gdGFrZSBsb25nZXJcbiAgICB9KTtcblxuICAgIGNvbnN0IGdldEluc3RhbmNlc0Z1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnR2V0SW5zdGFuY2VzRnVuY3Rpb24nLCB7XG4gICAgICAuLi5sYW1iZGFDb25maWcsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJ2xhbWJkYS9nZXQtaW5zdGFuY2VzJykpLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgIH0pO1xuXG4gICAgY29uc3Qgc3RvcEluc3RhbmNlRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdTdG9wSW5zdGFuY2VGdW5jdGlvbicsIHtcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnbGFtYmRhL3N0b3AtaW5zdGFuY2UnKSksXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgfSk7XG5cbiAgICBjb25zdCBjaGVja0luc3RhbmNlU3RhdGVGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0NoZWNrSW5zdGFuY2VTdGF0ZUZ1bmN0aW9uJywge1xuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICdsYW1iZGEvY2hlY2staW5zdGFuY2Utc3RhdGUnKSksXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgfSk7XG5cbiAgICBjb25zdCBtb2RpZnlQbGFjZW1lbnRGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ01vZGlmeVBsYWNlbWVudEZ1bmN0aW9uJywge1xuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICdsYW1iZGEvbW9kaWZ5LXBsYWNlbWVudCcpKSxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICB9KTtcblxuICAgIGNvbnN0IHN0YXJ0SW5zdGFuY2VGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1N0YXJ0SW5zdGFuY2VGdW5jdGlvbicsIHtcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnbGFtYmRhL3N0YXJ0LWluc3RhbmNlJykpLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgIH0pO1xuXG4gICAgY29uc3QgdXBkYXRlU3RhdHVzRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdVcGRhdGVTdGF0dXNGdW5jdGlvbicsIHtcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnbGFtYmRhL3VwZGF0ZS1zdGF0dXMnKSksXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgfSk7XG5cbiAgICBjb25zdCB1cGRhdGVJbnN0YW5jZU1pZ3JhdGlvblN0YXR1c0Z1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnVXBkYXRlSW5zdGFuY2VNaWdyYXRpb25TdGF0dXNGdW5jdGlvbicsIHtcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnbGFtYmRhL3VwZGF0ZS1pbnN0YW5jZS1taWdyYXRpb24tc3RhdHVzJykpLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgIH0pO1xuXG4gICAgY29uc3QgZ2V0TWlncmF0aW9uU3RhdHVzRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdHZXRNaWdyYXRpb25TdGF0dXNGdW5jdGlvbicsIHtcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnbGFtYmRhL2dldC1taWdyYXRpb24tc3RhdHVzJykpLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgIH0pO1xuXG4gICAgY29uc3QgcHJlcGFyZURldGFpbGVkTm90aWZpY2F0aW9uRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdQcmVwYXJlRGV0YWlsZWROb3RpZmljYXRpb25GdW5jdGlvbicsIHtcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnbGFtYmRhL3ByZXBhcmUtZGV0YWlsZWQtbm90aWZpY2F0aW9uJykpLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgIH0pO1xuXG4gICAgY29uc3Qgc2VuZFN0ZXBOb3RpZmljYXRpb25GdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1NlbmRTdGVwTm90aWZpY2F0aW9uRnVuY3Rpb24nLCB7XG4gICAgICAuLi5sYW1iZGFDb25maWcsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJ2xhbWJkYS9zZW5kLXN0ZXAtbm90aWZpY2F0aW9uJykpLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgIH0pO1xuXG4gICAgLy8gR3JhbnQgcGVybWlzc2lvbnNcbiAgICBxdWV1ZVRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShpbml0aWFsaXplRnVuY3Rpb24pO1xuICAgIHF1ZXVlVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKHVwZGF0ZVN0YXR1c0Z1bmN0aW9uKTtcbiAgICBxdWV1ZVRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YSh1cGRhdGVJbnN0YW5jZU1pZ3JhdGlvblN0YXR1c0Z1bmN0aW9uKTtcbiAgICBxdWV1ZVRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShnZXRJbnN0YW5jZXNGdW5jdGlvbik7XG4gICAgcXVldWVUYWJsZS5ncmFudFJlYWREYXRhKGdldE1pZ3JhdGlvblN0YXR1c0Z1bmN0aW9uKTtcbiAgICBxdWV1ZVRhYmxlLmdyYW50UmVhZERhdGEocHJlcGFyZURldGFpbGVkTm90aWZpY2F0aW9uRnVuY3Rpb24pO1xuICAgIHF1ZXVlVGFibGUuZ3JhbnRSZWFkRGF0YShzZW5kU3RlcE5vdGlmaWNhdGlvbkZ1bmN0aW9uKTtcbiAgICBhbGVydFRvcGljLmdyYW50UHVibGlzaChpbml0aWFsaXplRnVuY3Rpb24pO1xuICAgIGFsZXJ0VG9waWMuZ3JhbnRQdWJsaXNoKHVwZGF0ZVN0YXR1c0Z1bmN0aW9uKTtcbiAgICBhbGVydFRvcGljLmdyYW50UHVibGlzaChzZW5kU3RlcE5vdGlmaWNhdGlvbkZ1bmN0aW9uKTtcblxuICAgIC8vIEVDMiBwZXJtaXNzaW9uc1xuICAgIGNvbnN0IGVjMlBvbGljeSA9IG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2VjMjpEZXNjcmliZUhvc3RzJyxcbiAgICAgICAgJ2VjMjpBbGxvY2F0ZUhvc3RzJyxcbiAgICAgICAgJ2VjMjpEZXNjcmliZUluc3RhbmNlcycsXG4gICAgICAgICdlYzI6U3RvcEluc3RhbmNlcycsXG4gICAgICAgICdlYzI6U3RhcnRJbnN0YW5jZXMnLFxuICAgICAgICAnZWMyOk1vZGlmeUluc3RhbmNlUGxhY2VtZW50JyxcbiAgICAgICAgJ2VjMjpDcmVhdGVUYWdzJyxcbiAgICAgICAgJ2VjMjpGb3JjZVN0b3BJbnN0YW5jZXMnLFxuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogWycqJ10sXG4gICAgfSk7XG5cbiAgICBjaGVja1Jlc2VydmVkSG9zdEZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShlYzJQb2xpY3kpO1xuICAgIHByb3Zpc2lvblJlc2VydmVkSG9zdEZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShlYzJQb2xpY3kpO1xuICAgIGdldEluc3RhbmNlc0Z1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShlYzJQb2xpY3kpO1xuICAgIHN0b3BJbnN0YW5jZUZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShlYzJQb2xpY3kpO1xuICAgIGNoZWNrSW5zdGFuY2VTdGF0ZUZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShlYzJQb2xpY3kpO1xuICAgIG1vZGlmeVBsYWNlbWVudEZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShlYzJQb2xpY3kpO1xuICAgIHN0YXJ0SW5zdGFuY2VGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3koZWMyUG9saWN5KTtcblxuICAgIC8vIENyZWF0ZSB0aGUgc3RhdGUgbWFjaGluZSB1c2luZyB0aGUgSlNPTiBkZWZpbml0aW9uXG4gICAgLy8gQ3JlYXRlIExhbWJkYSBmdW5jdGlvbiB0byByZW1vdmUgUmVzZXJ2ZWQgdGFnXG4gICAgY29uc3QgcmVtb3ZlUmVzZXJ2ZWRUYWdGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1JlbW92ZVJlc2VydmVkVGFnRnVuY3Rpb24nLCB7XG4gICAgICAuLi5sYW1iZGFDb25maWcsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJ2xhbWJkYS9yZW1vdmUtcmVzZXJ2ZWQtdGFnJykpLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgIH0pO1xuICAgIFxuICAgIC8vIEdyYW50IEVDMiBwZXJtaXNzaW9ucyB0byByZW1vdmUgdGFnc1xuICAgIHJlbW92ZVJlc2VydmVkVGFnRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGFjdGlvbnM6IFsnZWMyOkRlbGV0ZVRhZ3MnXSxcbiAgICAgIHJlc291cmNlczogWycqJ10sXG4gICAgfSkpO1xuXG4gICAgY29uc3Qgc3RhdGVNYWNoaW5lID0gbmV3IHN0ZXBmdW5jdGlvbnMuU3RhdGVNYWNoaW5lKHRoaXMsICdIb3N0TWlncmF0aW9uU3RhdGVNYWNoaW5lJywge1xuICAgICAgZGVmaW5pdGlvbkJvZHk6IHN0ZXBmdW5jdGlvbnMuRGVmaW5pdGlvbkJvZHkuZnJvbUZpbGUocGF0aC5qb2luKF9fZGlybmFtZSwgJ3N0ZXAtZnVuY3Rpb25zL21pZ3JhdGlvbi13b3JrZmxvdy5qc29uJykpLFxuICAgICAgZGVmaW5pdGlvblN1YnN0aXR1dGlvbnM6IHtcbiAgICAgICAgSW5pdGlhbGl6ZU1pZ3JhdGlvbkZ1bmN0aW9uOiBpbml0aWFsaXplRnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgICAgIENoZWNrUmVzZXJ2ZWRIb3N0RnVuY3Rpb246IGNoZWNrUmVzZXJ2ZWRIb3N0RnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgICAgIFByb3Zpc2lvblJlc2VydmVkSG9zdEZ1bmN0aW9uOiBwcm92aXNpb25SZXNlcnZlZEhvc3RGdW5jdGlvbi5mdW5jdGlvbkFybixcbiAgICAgICAgR2V0SW5zdGFuY2VzRnVuY3Rpb246IGdldEluc3RhbmNlc0Z1bmN0aW9uLmZ1bmN0aW9uQXJuLFxuICAgICAgICBTdG9wSW5zdGFuY2VGdW5jdGlvbjogc3RvcEluc3RhbmNlRnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgICAgIENoZWNrSW5zdGFuY2VTdGF0ZUZ1bmN0aW9uOiBjaGVja0luc3RhbmNlU3RhdGVGdW5jdGlvbi5mdW5jdGlvbkFybixcbiAgICAgICAgTW9kaWZ5UGxhY2VtZW50RnVuY3Rpb246IG1vZGlmeVBsYWNlbWVudEZ1bmN0aW9uLmZ1bmN0aW9uQXJuLFxuICAgICAgICBTdGFydEluc3RhbmNlRnVuY3Rpb246IHN0YXJ0SW5zdGFuY2VGdW5jdGlvbi5mdW5jdGlvbkFybixcbiAgICAgICAgVXBkYXRlU3RhdHVzRnVuY3Rpb246IHVwZGF0ZVN0YXR1c0Z1bmN0aW9uLmZ1bmN0aW9uQXJuLFxuICAgICAgICBVcGRhdGVJbnN0YW5jZU1pZ3JhdGlvblN0YXR1c0Z1bmN0aW9uOiB1cGRhdGVJbnN0YW5jZU1pZ3JhdGlvblN0YXR1c0Z1bmN0aW9uLmZ1bmN0aW9uQXJuLFxuICAgICAgICBQcmVwYXJlRGV0YWlsZWROb3RpZmljYXRpb25GdW5jdGlvbjogcHJlcGFyZURldGFpbGVkTm90aWZpY2F0aW9uRnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgICAgIFNlbmRTdGVwTm90aWZpY2F0aW9uRnVuY3Rpb246IHNlbmRTdGVwTm90aWZpY2F0aW9uRnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgICAgIFJlbW92ZVJlc2VydmVkVGFnRnVuY3Rpb246IHJlbW92ZVJlc2VydmVkVGFnRnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgICAgIEFsZXJ0VG9waWNBcm46IGFsZXJ0VG9waWMudG9waWNBcm4sXG4gICAgICAgIEF2YWlsYWJpbGl0eVpvbmU6IHByb3BzLmF2YWlsYWJpbGl0eVpvbmUsXG4gICAgICAgIEluc3RhbmNlVHlwZTogcHJvcHMuaW5zdGFuY2VUeXBlXG4gICAgICB9LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLmhvdXJzKDI0KSwgLy8gQWxsb3cgdXAgdG8gMjQgaG91cnMgZm9yIHRoZSBlbnRpcmUgbWlncmF0aW9uXG4gICAgICBzdGF0ZU1hY2hpbmVUeXBlOiBzdGVwZnVuY3Rpb25zLlN0YXRlTWFjaGluZVR5cGUuU1RBTkRBUkQsXG4gICAgfSk7XG4gICAgXG4gICAgLy8gR3JhbnQgcGVybWlzc2lvbnMgZm9yIHRoZSBzdGF0ZSBtYWNoaW5lIHRvIGludm9rZSBhbGwgTGFtYmRhIGZ1bmN0aW9uc1xuICAgIGluaXRpYWxpemVGdW5jdGlvbi5ncmFudEludm9rZShzdGF0ZU1hY2hpbmUpO1xuICAgIGNoZWNrUmVzZXJ2ZWRIb3N0RnVuY3Rpb24uZ3JhbnRJbnZva2Uoc3RhdGVNYWNoaW5lKTtcbiAgICBwcm92aXNpb25SZXNlcnZlZEhvc3RGdW5jdGlvbi5ncmFudEludm9rZShzdGF0ZU1hY2hpbmUpO1xuICAgIGdldEluc3RhbmNlc0Z1bmN0aW9uLmdyYW50SW52b2tlKHN0YXRlTWFjaGluZSk7XG4gICAgc3RvcEluc3RhbmNlRnVuY3Rpb24uZ3JhbnRJbnZva2Uoc3RhdGVNYWNoaW5lKTtcbiAgICBjaGVja0luc3RhbmNlU3RhdGVGdW5jdGlvbi5ncmFudEludm9rZShzdGF0ZU1hY2hpbmUpO1xuICAgIG1vZGlmeVBsYWNlbWVudEZ1bmN0aW9uLmdyYW50SW52b2tlKHN0YXRlTWFjaGluZSk7XG4gICAgc3RhcnRJbnN0YW5jZUZ1bmN0aW9uLmdyYW50SW52b2tlKHN0YXRlTWFjaGluZSk7XG4gICAgdXBkYXRlU3RhdHVzRnVuY3Rpb24uZ3JhbnRJbnZva2Uoc3RhdGVNYWNoaW5lKTtcbiAgICB1cGRhdGVJbnN0YW5jZU1pZ3JhdGlvblN0YXR1c0Z1bmN0aW9uLmdyYW50SW52b2tlKHN0YXRlTWFjaGluZSk7XG4gICAgcHJlcGFyZURldGFpbGVkTm90aWZpY2F0aW9uRnVuY3Rpb24uZ3JhbnRJbnZva2Uoc3RhdGVNYWNoaW5lKTtcbiAgICBzZW5kU3RlcE5vdGlmaWNhdGlvbkZ1bmN0aW9uLmdyYW50SW52b2tlKHN0YXRlTWFjaGluZSk7XG4gICAgcmVtb3ZlUmVzZXJ2ZWRUYWdGdW5jdGlvbi5ncmFudEludm9rZShzdGF0ZU1hY2hpbmUpO1xuICAgIFxuICAgIC8vIEdyYW50IHRoZSBTdGVwIEZ1bmN0aW9uIHBlcm1pc3Npb24gdG8gcHVibGlzaCB0byB0aGUgU05TIHRvcGljXG4gICAgYWxlcnRUb3BpYy5ncmFudFB1Ymxpc2goc3RhdGVNYWNoaW5lKTtcblxuICAgIC8vIENyZWF0ZSBhbGFybSBoYW5kbGVyIExhbWJkYVxuICAgIGNvbnN0IGFsYXJtSGFuZGxlckZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQWxhcm1IYW5kbGVyRnVuY3Rpb24nLCB7XG4gICAgICAuLi5sYW1iZGFDb25maWcsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJ2xhbWJkYS9hbGFybS1oYW5kbGVyJykpLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgLi4ubGFtYmRhQ29uZmlnLmVudmlyb25tZW50LFxuICAgICAgICBNSUdSQVRJT05fU1RBVEVfTUFDSElORV9BUk46IHN0YXRlTWFjaGluZS5zdGF0ZU1hY2hpbmVBcm4sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gR3JhbnQgcGVybWlzc2lvbnMgdG8gc3RhcnQgU3RlcCBGdW5jdGlvbnMgZXhlY3V0aW9uXG4gICAgc3RhdGVNYWNoaW5lLmdyYW50U3RhcnRFeGVjdXRpb24oYWxhcm1IYW5kbGVyRnVuY3Rpb24pO1xuICAgIFxuICAgIC8vIEdyYW50IER5bmFtb0RCIHBlcm1pc3Npb25zIGZvciBHZXRJdGVtIGFuZCBQdXRJdGVtIG9wZXJhdGlvbnNcbiAgICBxdWV1ZVRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShhbGFybUhhbmRsZXJGdW5jdGlvbik7XG5cbiAgICAvLyBDcmVhdGUgU05TIHRvcGljIGZvciBDbG91ZFdhdGNoIGFsYXJtc1xuICAgIGNvbnN0IGFsYXJtVG9waWMgPSBuZXcgc25zLlRvcGljKHRoaXMsICdIb3N0QWxhcm1Ub3BpYycpO1xuICAgIGFsYXJtVG9waWMuYWRkU3Vic2NyaXB0aW9uKG5ldyBzdWJzLkxhbWJkYVN1YnNjcmlwdGlvbihhbGFybUhhbmRsZXJGdW5jdGlvbikpO1xuXG4gICAgLy8gQ3JlYXRlIENsb3VkV2F0Y2ggYWxhcm1zIGZvciBkZWRpY2F0ZWQgaG9zdCBzdGF0dXNcbiAgICBpZiAocHJvcHMuZGVkaWNhdGVkSG9zdElkcyAmJiBwcm9wcy5kZWRpY2F0ZWRIb3N0SWRzLmxlbmd0aCA+IDApIHtcbiAgICAgIHByb3BzLmRlZGljYXRlZEhvc3RJZHMuZm9yRWFjaCgoaG9zdElkLCBpbmRleCkgPT4ge1xuICAgICAgICBjb25zdCBkZWRpY2F0ZWRIb3N0U3RhdHVzTWV0cmljID0gbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgICBuYW1lc3BhY2U6ICdBV1MvRUMyJyxcbiAgICAgICAgICBtZXRyaWNOYW1lOiAnU3RhdHVzQ2hlY2tGYWlsZWQnLFxuICAgICAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgICAgIEhvc3RJZDogaG9zdElkLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgc3RhdGlzdGljOiAnTWF4aW11bScsXG4gICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgZGVkaWNhdGVkSG9zdEFsYXJtID0gbmV3IGNsb3Vkd2F0Y2guQWxhcm0odGhpcywgYERlZGljYXRlZEhvc3RTdGF0dXNBbGFybS0ke2luZGV4fWAsIHtcbiAgICAgICAgICBtZXRyaWM6IGRlZGljYXRlZEhvc3RTdGF0dXNNZXRyaWMsXG4gICAgICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDEsXG4gICAgICAgICAgdGhyZXNob2xkOiAxLFxuICAgICAgICAgIGNvbXBhcmlzb25PcGVyYXRvcjogY2xvdWR3YXRjaC5Db21wYXJpc29uT3BlcmF0b3IuR1JFQVRFUl9USEFOX09SX0VRVUFMX1RPX1RIUkVTSE9MRCxcbiAgICAgICAgICBhbGFybURlc2NyaXB0aW9uOiBgQWxhcm0gd2hlbiBkZWRpY2F0ZWQgaG9zdCAke2hvc3RJZH0gc3RhdHVzIGNoZWNrIGZhaWxzYCxcbiAgICAgICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgZGVkaWNhdGVkSG9zdEFsYXJtLmFkZEFsYXJtQWN0aW9uKG5ldyBjbG91ZHdhdGNoX2FjdGlvbnMuU25zQWN0aW9uKGFsYXJtVG9waWMpKTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBDcmVhdGUgYSBwbGFjZWhvbGRlciBhbGFybSAtIHlvdSBzaG91bGQgcmVwbGFjZSB0aGlzIHdpdGggYWN0dWFsIGhvc3QgSURzXG4gICAgICBjb25zdCBkZWRpY2F0ZWRIb3N0U3RhdHVzTWV0cmljID0gbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgICAgbmFtZXNwYWNlOiAnQVdTL0VDMicsXG4gICAgICAgIG1ldHJpY05hbWU6ICdTdGF0dXNDaGVja0ZhaWxlZCcsXG4gICAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgICBIb3N0SWQ6ICdQTEFDRUhPTERFUl9IT1NUX0lEJywgLy8gUmVwbGFjZSB3aXRoIGFjdHVhbCBob3N0IElEXG4gICAgICAgIH0sXG4gICAgICAgIHN0YXRpc3RpYzogJ01heGltdW0nLFxuICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgfSk7XG5cbiAgICAgIGNvbnN0IGRlZGljYXRlZEhvc3RBbGFybSA9IG5ldyBjbG91ZHdhdGNoLkFsYXJtKHRoaXMsICdEZWRpY2F0ZWRIb3N0U3RhdHVzQWxhcm0nLCB7XG4gICAgICAgIG1ldHJpYzogZGVkaWNhdGVkSG9zdFN0YXR1c01ldHJpYyxcbiAgICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDEsXG4gICAgICAgIHRocmVzaG9sZDogMSxcbiAgICAgICAgY29tcGFyaXNvbk9wZXJhdG9yOiBjbG91ZHdhdGNoLkNvbXBhcmlzb25PcGVyYXRvci5HUkVBVEVSX1RIQU5fT1JfRVFVQUxfVE9fVEhSRVNIT0xELFxuICAgICAgICBhbGFybURlc2NyaXB0aW9uOiAnQWxhcm0gd2hlbiBkZWRpY2F0ZWQgaG9zdCBzdGF0dXMgY2hlY2sgZmFpbHMnLFxuICAgICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICAgIH0pO1xuXG4gICAgICBkZWRpY2F0ZWRIb3N0QWxhcm0uYWRkQWxhcm1BY3Rpb24obmV3IGNsb3Vkd2F0Y2hfYWN0aW9ucy5TbnNBY3Rpb24oYWxhcm1Ub3BpYykpO1xuICAgIH1cblxuICAgIC8vIE91dHB1dHNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUXVldWVUYWJsZU5hbWUnLCB7XG4gICAgICB2YWx1ZTogcXVldWVUYWJsZS50YWJsZU5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ0R5bmFtb0RCIHRhYmxlIGZvciBob3N0IG1pZ3JhdGlvbiBxdWV1ZScsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnU3RhdGVNYWNoaW5lQXJuJywge1xuICAgICAgdmFsdWU6IHN0YXRlTWFjaGluZS5zdGF0ZU1hY2hpbmVBcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ1N0ZXAgRnVuY3Rpb25zIHN0YXRlIG1hY2hpbmUgQVJOJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBbGVydFRvcGljQXJuJywge1xuICAgICAgdmFsdWU6IGFsZXJ0VG9waWMudG9waWNBcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ1NOUyB0b3BpYyBmb3IgbWlncmF0aW9uIGFsZXJ0cycsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnR2V0TWlncmF0aW9uU3RhdHVzRnVuY3Rpb25Bcm4nLCB7XG4gICAgICB2YWx1ZTogZ2V0TWlncmF0aW9uU3RhdHVzRnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ0xhbWJkYSBmdW5jdGlvbiB0byBnZXQgZGV0YWlsZWQgbWlncmF0aW9uIHN0YXR1cycsXG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==