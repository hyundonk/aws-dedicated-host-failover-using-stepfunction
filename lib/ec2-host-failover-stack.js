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
    }
}
exports.EC2HostFailoverStack = EC2HostFailoverStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWMyLWhvc3QtZmFpbG92ZXItc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJlYzItaG9zdC1mYWlsb3Zlci1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUNuQywrREFBaUQ7QUFDakQsbUVBQXFEO0FBQ3JELHlEQUEyQztBQUMzQyx3RUFBMEQ7QUFDMUQsNkVBQStEO0FBQy9ELHlEQUEyQztBQUMzQyx1RUFBeUQ7QUFDekQsdUZBQXlFO0FBQ3pFLDJDQUE2QjtBQVc3QixNQUFhLG9CQUFxQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ2pELFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBZ0M7UUFDeEUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsMkJBQTJCO1FBQzNCLE1BQU0sVUFBVSxHQUFHLElBQUksUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsb0JBQW9CLEVBQUU7WUFDaEUsWUFBWSxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUU7WUFDckUsV0FBVyxFQUFFLFFBQVEsQ0FBQyxXQUFXLENBQUMsZUFBZTtZQUNqRCxtQkFBbUIsRUFBRSxnQkFBZ0I7U0FDdEMsQ0FBQyxDQUFDO1FBRUgsdUJBQXVCO1FBQ3ZCLE1BQU0sVUFBVSxHQUFHLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUseUJBQXlCLENBQUMsQ0FBQztRQUNsRSxJQUFJLEdBQUcsQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLG1CQUFtQixFQUFFO1lBQzlDLEtBQUssRUFBRSxVQUFVO1lBQ2pCLFFBQVEsRUFBRSxHQUFHLENBQUMsb0JBQW9CLENBQUMsS0FBSztZQUN4QyxRQUFRLEVBQUUsS0FBSyxDQUFDLFVBQVU7U0FDM0IsQ0FBQyxD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Q0FBQyxlQUFlO1lBQ25DLFdBQVcsRUFBRSxrQ0FBa0M7U0FDaEQsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxlQUFlLEVBQUU7WUFDdkMsS0FBSyxFQUFFLFVBQVUsQ0FBQyxRQUFRO1lBQzFCLFdBQVcsRUFBRSxnQ0FBZ0M7U0FDOUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBblFELG9EQW1RQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0ICogYXMgc25zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zbnMnO1xuaW1wb3J0ICogYXMgc3VicyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc25zLXN1YnNjcmlwdGlvbnMnO1xuaW1wb3J0ICogYXMgc3RlcGZ1bmN0aW9ucyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc3RlcGZ1bmN0aW9ucyc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBjbG91ZHdhdGNoIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZHdhdGNoJztcbmltcG9ydCAqIGFzIGNsb3Vkd2F0Y2hfYWN0aW9ucyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWR3YXRjaC1hY3Rpb25zJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuZXhwb3J0IGludGVyZmFjZSBFQzJIb3N0RmFpbG92ZXJTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBhbGVydEVtYWlsOiBzdHJpbmc7XG4gIGF2YWlsYWJpbGl0eVpvbmU6IHN0cmluZztcbiAgaW5zdGFuY2VUeXBlOiBzdHJpbmc7XG4gIC8vIE9wdGlvbmFsOiBBZGQgc3BlY2lmaWMgaG9zdCBJRHMgdG8gbW9uaXRvclxuICBkZWRpY2F0ZWRIb3N0SWRzPzogc3RyaW5nW107XG59XG5cbmV4cG9ydCBjbGFzcyBFQzJIb3N0RmFpbG92ZXJTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBFQzJIb3N0RmFpbG92ZXJTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICAvLyBEeW5hbW9EQiB0YWJsZSBmb3IgcXVldWVcbiAgICBjb25zdCBxdWV1ZVRhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdIb3N0TWlncmF0aW9uUXVldWUnLCB7XG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ0hvc3RJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgdGltZVRvTGl2ZUF0dHJpYnV0ZTogJ0V4cGlyYXRpb25UaW1lJyxcbiAgICB9KTtcblxuICAgIC8vIFNOUyB0b3BpYyBmb3IgYWxlcnRzXG4gICAgY29uc3QgYWxlcnRUb3BpYyA9IG5ldyBzbnMuVG9waWModGhpcywgJ0hvc3RNaWdyYXRpb25BbGVydFRvcGljJyk7XG4gICAgbmV3IHNucy5TdWJzY3JpcHRpb24odGhpcywgJ0VtYWlsU3Vic2NyaXB0aW9uJywge1xuICAgICAgdG9waWM6IGFsZXJ0VG9waWMsXG4gICAgICBwcm90b2NvbDogc25zLlN1YnNjcmlwdGlvblByb3RvY29sLkVNQUlMLFxuICAgICAgZW5kcG9pbnQ6IHByb3BzLmFsZXJ0RW1haWwsXG4gICAgfSk7XG5cbiAgICAvLyBMYW1iZGEgbGF5ZXIgd2l0aCBjb21tb24gY29kZVxuICAgIGNvbnN0IGNvbW1vbkxheWVyID0gbmV3IGxhbWJkYS5MYXllclZlcnNpb24odGhpcywgJ0NvbW1vbkxheWVyJywge1xuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICdsYW1iZGEtbGF5ZXInKSksXG4gICAgICBjb21wYXRpYmxlUnVudGltZXM6IFtsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWF0sXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvbW1vbiB1dGlsaXRpZXMgZm9yIEVDMiBob3N0IG1pZ3JhdGlvbicsXG4gICAgfSk7XG5cbiAgICAvLyBDb21tb24gTGFtYmRhIGNvbmZpZ3VyYXRpb25cbiAgICBjb25zdCBsYW1iZGFDb25maWcgPSB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIFFVRVVFX1RBQkxFX05BTUU6IHF1ZXVlVGFibGUudGFibGVOYW1lLFxuICAgICAgICBBTEVSVF9UT1BJQ19BUk46IGFsZXJ0VG9waWMudG9waWNBcm4sXG4gICAgICAgIEFWQUlMQUJJTElUWV9aT05FOiBwcm9wcy5hdmFpbGFiaWxpdHlab25lLFxuICAgICAgICBJTlNUQU5DRV9UWVBFOiBwcm9wcy5pbnN0YW5jZVR5cGUsXG4gICAgICB9LFxuICAgICAgbGF5ZXJzOiBbY29tbW9uTGF5ZXJdLFxuICAgIH07XG5cbiAgICAvLyBDcmVhdGUgTGFtYmRhIGZ1bmN0aW9uc1xuICAgIGNvbnN0IGluaXRpYWxpemVGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0luaXRpYWxpemVNaWdyYXRpb25GdW5jdGlvbicsIHtcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnbGFtYmRhL2luaXRpYWxpemUtbWlncmF0aW9uJykpLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgIH0pO1xuXG4gICAgY29uc3QgY2hlY2tSZXNlcnZlZEhvc3RGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0NoZWNrUmVzZXJ2ZWRIb3N0RnVuY3Rpb24nLCB7XG4gICAgICAuLi5sYW1iZGFDb25maWcsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJ2xhbWJkYS9jaGVjay1yZXNlcnZlZC1ob3N0JykpLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgIH0pO1xuXG4gICAgY29uc3QgcHJvdmlzaW9uUmVzZXJ2ZWRIb3N0RnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdQcm92aXNpb25SZXNlcnZlZEhvc3RGdW5jdGlvbicsIHtcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnbGFtYmRhL3Byb3Zpc2lvbi1yZXNlcnZlZC1ob3N0JykpLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksIC8vIFByb3Zpc2lvbmluZyBjYW4gdGFrZSBsb25nZXJcbiAgICB9KTtcblxuICAgIGNvbnN0IGdldEluc3RhbmNlc0Z1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnR2V0SW5zdGFuY2VzRnVuY3Rpb24nLCB7XG4gICAgICAuLi5sYW1iZGFDb25maWcsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJ2xhbWJkYS9nZXQtaW5zdGFuY2VzJykpLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgIH0pO1xuXG4gICAgY29uc3Qgc3RvcEluc3RhbmNlRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdTdG9wSW5zdGFuY2VGdW5jdGlvbicsIHtcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnbGFtYmRhL3N0b3AtaW5zdGFuY2UnKSksXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgfSk7XG5cbiAgICBjb25zdCBjaGVja0luc3RhbmNlU3RhdGVGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0NoZWNrSW5zdGFuY2VTdGF0ZUZ1bmN0aW9uJywge1xuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICdsYW1iZGEvY2hlY2staW5zdGFuY2Utc3RhdGUnKSksXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgfSk7XG5cbiAgICBjb25zdCBtb2RpZnlQbGFjZW1lbnRGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ01vZGlmeVBsYWNlbWVudEZ1bmN0aW9uJywge1xuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICdsYW1iZGEvbW9kaWZ5LXBsYWNlbWVudCcpKSxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICB9KTtcblxuICAgIGNvbnN0IHN0YXJ0SW5zdGFuY2VGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1N0YXJ0SW5zdGFuY2VGdW5jdGlvbicsIHtcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnbGFtYmRhL3N0YXJ0LWluc3RhbmNlJykpLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgIH0pO1xuXG4gICAgY29uc3QgdXBkYXRlU3RhdHVzRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdVcGRhdGVTdGF0dXNGdW5jdGlvbicsIHtcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnbGFtYmRhL3VwZGF0ZS1zdGF0dXMnKSksXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBwZXJtaXNzaW9uc1xuICAgIHF1ZXVlVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGluaXRpYWxpemVGdW5jdGlvbik7XG4gICAgcXVldWVUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEodXBkYXRlU3RhdHVzRnVuY3Rpb24pO1xuICAgIGFsZXJ0VG9waWMuZ3JhbnRQdWJsaXNoKGluaXRpYWxpemVGdW5jdGlvbik7XG4gICAgYWxlcnRUb3BpYy5ncmFudFB1Ymxpc2godXBkYXRlU3RhdHVzRnVuY3Rpb24pO1xuXG4gICAgLy8gRUMyIHBlcm1pc3Npb25zXG4gICAgY29uc3QgZWMyUG9saWN5ID0gbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgYWN0aW9uczogW1xuICAgICAgICAnZWMyOkRlc2NyaWJlSG9zdHMnLFxuICAgICAgICAnZWMyOkFsbG9jYXRlSG9zdHMnLFxuICAgICAgICAnZWMyOkRlc2NyaWJlSW5zdGFuY2VzJyxcbiAgICAgICAgJ2VjMjpTdG9wSW5zdGFuY2VzJyxcbiAgICAgICAgJ2VjMjpTdGFydEluc3RhbmNlcycsXG4gICAgICAgICdlYzI6TW9kaWZ5SW5zdGFuY2VQbGFjZW1lbnQnLFxuICAgICAgICAnZWMyOkNyZWF0ZVRhZ3MnLFxuICAgICAgICAnZWMyOkZvcmNlU3RvcEluc3RhbmNlcycsXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbJyonXSxcbiAgICB9KTtcblxuICAgIGNoZWNrUmVzZXJ2ZWRIb3N0RnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KGVjMlBvbGljeSk7XG4gICAgcHJvdmlzaW9uUmVzZXJ2ZWRIb3N0RnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KGVjMlBvbGljeSk7XG4gICAgZ2V0SW5zdGFuY2VzRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KGVjMlBvbGljeSk7XG4gICAgc3RvcEluc3RhbmNlRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KGVjMlBvbGljeSk7XG4gICAgY2hlY2tJbnN0YW5jZVN0YXRlRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KGVjMlBvbGljeSk7XG4gICAgbW9kaWZ5UGxhY2VtZW50RnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KGVjMlBvbGljeSk7XG4gICAgc3RhcnRJbnN0YW5jZUZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShlYzJQb2xpY3kpO1xuXG4gICAgLy8gQ3JlYXRlIHRoZSBzdGF0ZSBtYWNoaW5lIHVzaW5nIHRoZSBKU09OIGRlZmluaXRpb25cbiAgICAvLyBDcmVhdGUgTGFtYmRhIGZ1bmN0aW9uIHRvIHJlbW92ZSBSZXNlcnZlZCB0YWdcbiAgICBjb25zdCByZW1vdmVSZXNlcnZlZFRhZ0Z1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnUmVtb3ZlUmVzZXJ2ZWRUYWdGdW5jdGlvbicsIHtcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnbGFtYmRhL3JlbW92ZS1yZXNlcnZlZC10YWcnKSksXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgfSk7XG4gICAgXG4gICAgLy8gR3JhbnQgRUMyIHBlcm1pc3Npb25zIHRvIHJlbW92ZSB0YWdzXG4gICAgcmVtb3ZlUmVzZXJ2ZWRUYWdGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgYWN0aW9uczogWydlYzI6RGVsZXRlVGFncyddLFxuICAgICAgcmVzb3VyY2VzOiBbJyonXSxcbiAgICB9KSk7XG5cbiAgICBjb25zdCBzdGF0ZU1hY2hpbmUgPSBuZXcgc3RlcGZ1bmN0aW9ucy5TdGF0ZU1hY2hpbmUodGhpcywgJ0hvc3RNaWdyYXRpb25TdGF0ZU1hY2hpbmUnLCB7XG4gICAgICBkZWZpbml0aW9uQm9keTogc3RlcGZ1bmN0aW9ucy5EZWZpbml0aW9uQm9keS5mcm9tRmlsZShwYXRoLmpvaW4oX19kaXJuYW1lLCAnc3RlcC1mdW5jdGlvbnMvbWlncmF0aW9uLXdvcmtmbG93Lmpzb24nKSksXG4gICAgICBkZWZpbml0aW9uU3Vic3RpdHV0aW9uczoge1xuICAgICAgICBJbml0aWFsaXplTWlncmF0aW9uRnVuY3Rpb246IGluaXRpYWxpemVGdW5jdGlvbi5mdW5jdGlvbkFybixcbiAgICAgICAgQ2hlY2tSZXNlcnZlZEhvc3RGdW5jdGlvbjogY2hlY2tSZXNlcnZlZEhvc3RGdW5jdGlvbi5mdW5jdGlvbkFybixcbiAgICAgICAgUHJvdmlzaW9uUmVzZXJ2ZWRIb3N0RnVuY3Rpb246IHByb3Zpc2lvblJlc2VydmVkSG9zdEZ1bmN0aW9uLmZ1bmN0aW9uQXJuLFxuICAgICAgICBHZXRJbnN0YW5jZXNGdW5jdGlvbjogZ2V0SW5zdGFuY2VzRnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgICAgIFN0b3BJbnN0YW5jZUZ1bmN0aW9uOiBzdG9wSW5zdGFuY2VGdW5jdGlvbi5mdW5jdGlvbkFybixcbiAgICAgICAgQ2hlY2tJbnN0YW5jZVN0YXRlRnVuY3Rpb246IGNoZWNrSW5zdGFuY2VTdGF0ZUZ1bmN0aW9uLmZ1bmN0aW9uQXJuLFxuICAgICAgICBNb2RpZnlQbGFjZW1lbnRGdW5jdGlvbjogbW9kaWZ5UGxhY2VtZW50RnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgICAgIFN0YXJ0SW5zdGFuY2VGdW5jdGlvbjogc3RhcnRJbnN0YW5jZUZ1bmN0aW9uLmZ1bmN0aW9uQXJuLFxuICAgICAgICBVcGRhdGVTdGF0dXNGdW5jdGlvbjogdXBkYXRlU3RhdHVzRnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgICAgIFJlbW92ZVJlc2VydmVkVGFnRnVuY3Rpb246IHJlbW92ZVJlc2VydmVkVGFnRnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgICAgIEFsZXJ0VG9waWNBcm46IGFsZXJ0VG9waWMudG9waWNBcm4sXG4gICAgICAgIEF2YWlsYWJpbGl0eVpvbmU6IHByb3BzLmF2YWlsYWJpbGl0eVpvbmUsXG4gICAgICAgIEluc3RhbmNlVHlwZTogcHJvcHMuaW5zdGFuY2VUeXBlXG4gICAgICB9LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLmhvdXJzKDI0KSwgLy8gQWxsb3cgdXAgdG8gMjQgaG91cnMgZm9yIHRoZSBlbnRpcmUgbWlncmF0aW9uXG4gICAgICBzdGF0ZU1hY2hpbmVUeXBlOiBzdGVwZnVuY3Rpb25zLlN0YXRlTWFjaGluZVR5cGUuU1RBTkRBUkQsXG4gICAgfSk7XG4gICAgXG4gICAgLy8gR3JhbnQgcGVybWlzc2lvbnMgZm9yIHRoZSBzdGF0ZSBtYWNoaW5lIHRvIGludm9rZSBhbGwgTGFtYmRhIGZ1bmN0aW9uc1xuICAgIGluaXRpYWxpemVGdW5jdGlvbi5ncmFudEludm9rZShzdGF0ZU1hY2hpbmUpO1xuICAgIGNoZWNrUmVzZXJ2ZWRIb3N0RnVuY3Rpb24uZ3JhbnRJbnZva2Uoc3RhdGVNYWNoaW5lKTtcbiAgICBwcm92aXNpb25SZXNlcnZlZEhvc3RGdW5jdGlvbi5ncmFudEludm9rZShzdGF0ZU1hY2hpbmUpO1xuICAgIGdldEluc3RhbmNlc0Z1bmN0aW9uLmdyYW50SW52b2tlKHN0YXRlTWFjaGluZSk7XG4gICAgc3RvcEluc3RhbmNlRnVuY3Rpb24uZ3JhbnRJbnZva2Uoc3RhdGVNYWNoaW5lKTtcbiAgICBjaGVja0luc3RhbmNlU3RhdGVGdW5jdGlvbi5ncmFudEludm9rZShzdGF0ZU1hY2hpbmUpO1xuICAgIG1vZGlmeVBsYWNlbWVudEZ1bmN0aW9uLmdyYW50SW52b2tlKHN0YXRlTWFjaGluZSk7XG4gICAgc3RhcnRJbnN0YW5jZUZ1bmN0aW9uLmdyYW50SW52b2tlKHN0YXRlTWFjaGluZSk7XG4gICAgdXBkYXRlU3RhdHVzRnVuY3Rpb24uZ3JhbnRJbnZva2Uoc3RhdGVNYWNoaW5lKTtcbiAgICByZW1vdmVSZXNlcnZlZFRhZ0Z1bmN0aW9uLmdyYW50SW52b2tlKHN0YXRlTWFjaGluZSk7XG4gICAgXG4gICAgLy8gR3JhbnQgdGhlIFN0ZXAgRnVuY3Rpb24gcGVybWlzc2lvbiB0byBwdWJsaXNoIHRvIHRoZSBTTlMgdG9waWNcbiAgICBhbGVydFRvcGljLmdyYW50UHVibGlzaChzdGF0ZU1hY2hpbmUpO1xuXG4gICAgLy8gQ3JlYXRlIGFsYXJtIGhhbmRsZXIgTGFtYmRhXG4gICAgY29uc3QgYWxhcm1IYW5kbGVyRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdBbGFybUhhbmRsZXJGdW5jdGlvbicsIHtcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnbGFtYmRhL2FsYXJtLWhhbmRsZXInKSksXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAuLi5sYW1iZGFDb25maWcuZW52aXJvbm1lbnQsXG4gICAgICAgIE1JR1JBVElPTl9TVEFURV9NQUNISU5FX0FSTjogc3RhdGVNYWNoaW5lLnN0YXRlTWFjaGluZUFybixcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBwZXJtaXNzaW9ucyB0byBzdGFydCBTdGVwIEZ1bmN0aW9ucyBleGVjdXRpb25cbiAgICBzdGF0ZU1hY2hpbmUuZ3JhbnRTdGFydEV4ZWN1dGlvbihhbGFybUhhbmRsZXJGdW5jdGlvbik7XG4gICAgXG4gICAgLy8gR3JhbnQgRHluYW1vREIgcGVybWlzc2lvbnMgZm9yIEdldEl0ZW0gYW5kIFB1dEl0ZW0gb3BlcmF0aW9uc1xuICAgIHF1ZXVlVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGFsYXJtSGFuZGxlckZ1bmN0aW9uKTtcblxuICAgIC8vIENyZWF0ZSBTTlMgdG9waWMgZm9yIENsb3VkV2F0Y2ggYWxhcm1zXG4gICAgY29uc3QgYWxhcm1Ub3BpYyA9IG5ldyBzbnMuVG9waWModGhpcywgJ0hvc3RBbGFybVRvcGljJyk7XG4gICAgYWxhcm1Ub3BpYy5hZGRTdWJzY3JpcHRpb24obmV3IHN1YnMuTGFtYmRhU3Vic2NyaXB0aW9uKGFsYXJtSGFuZGxlckZ1bmN0aW9uKSk7XG5cbiAgICAvLyBDcmVhdGUgQ2xvdWRXYXRjaCBhbGFybXMgZm9yIGRlZGljYXRlZCBob3N0IHN0YXR1c1xuICAgIGlmIChwcm9wcy5kZWRpY2F0ZWRIb3N0SWRzICYmIHByb3BzLmRlZGljYXRlZEhvc3RJZHMubGVuZ3RoID4gMCkge1xuICAgICAgcHJvcHMuZGVkaWNhdGVkSG9zdElkcy5mb3JFYWNoKChob3N0SWQsIGluZGV4KSA9PiB7XG4gICAgICAgIGNvbnN0IGRlZGljYXRlZEhvc3RTdGF0dXNNZXRyaWMgPSBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICAgIG5hbWVzcGFjZTogJ0FXUy9FQzInLFxuICAgICAgICAgIG1ldHJpY05hbWU6ICdTdGF0dXNDaGVja0ZhaWxlZCcsXG4gICAgICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICAgICAgSG9zdElkOiBob3N0SWQsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBzdGF0aXN0aWM6ICdNYXhpbXVtJyxcbiAgICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCBkZWRpY2F0ZWRIb3N0QWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybSh0aGlzLCBgRGVkaWNhdGVkSG9zdFN0YXR1c0FsYXJtLSR7aW5kZXh9YCwge1xuICAgICAgICAgIG1ldHJpYzogZGVkaWNhdGVkSG9zdFN0YXR1c01ldHJpYyxcbiAgICAgICAgICBldmFsdWF0aW9uUGVyaW9kczogMSxcbiAgICAgICAgICB0aHJlc2hvbGQ6IDEsXG4gICAgICAgICAgY29tcGFyaXNvbk9wZXJhdG9yOiBjbG91ZHdhdGNoLkNvbXBhcmlzb25PcGVyYXRvci5HUkVBVEVSX1RIQU5fT1JfRVFVQUxfVE9fVEhSRVNIT0xELFxuICAgICAgICAgIGFsYXJtRGVzY3JpcHRpb246IGBBbGFybSB3aGVuIGRlZGljYXRlZCBob3N0ICR7aG9zdElkfSBzdGF0dXMgY2hlY2sgZmFpbHNgLFxuICAgICAgICAgIHRyZWF0TWlzc2luZ0RhdGE6IGNsb3Vkd2F0Y2guVHJlYXRNaXNzaW5nRGF0YS5OT1RfQlJFQUNISU5HLFxuICAgICAgICB9KTtcblxuICAgICAgICBkZWRpY2F0ZWRIb3N0QWxhcm0uYWRkQWxhcm1BY3Rpb24obmV3IGNsb3Vkd2F0Y2hfYWN0aW9ucy5TbnNBY3Rpb24oYWxhcm1Ub3BpYykpO1xuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIENyZWF0ZSBhIHBsYWNlaG9sZGVyIGFsYXJtIC0geW91IHNob3VsZCByZXBsYWNlIHRoaXMgd2l0aCBhY3R1YWwgaG9zdCBJRHNcbiAgICAgIGNvbnN0IGRlZGljYXRlZEhvc3RTdGF0dXNNZXRyaWMgPSBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICBuYW1lc3BhY2U6ICdBV1MvRUMyJyxcbiAgICAgICAgbWV0cmljTmFtZTogJ1N0YXR1c0NoZWNrRmFpbGVkJyxcbiAgICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICAgIEhvc3RJZDogJ1BMQUNFSE9MREVSX0hPU1RfSUQnLCAvLyBSZXBsYWNlIHdpdGggYWN0dWFsIGhvc3QgSURcbiAgICAgICAgfSxcbiAgICAgICAgc3RhdGlzdGljOiAnTWF4aW11bScsXG4gICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICB9KTtcblxuICAgICAgY29uc3QgZGVkaWNhdGVkSG9zdEFsYXJtID0gbmV3IGNsb3Vkd2F0Y2guQWxhcm0odGhpcywgJ0RlZGljYXRlZEhvc3RTdGF0dXNBbGFybScsIHtcbiAgICAgICAgbWV0cmljOiBkZWRpY2F0ZWRIb3N0U3RhdHVzTWV0cmljLFxuICAgICAgICBldmFsdWF0aW9uUGVyaW9kczogMSxcbiAgICAgICAgdGhyZXNob2xkOiAxLFxuICAgICAgICBjb21wYXJpc29uT3BlcmF0b3I6IGNsb3Vkd2F0Y2guQ29tcGFyaXNvbk9wZXJhdG9yLkdSRUFURVJfVEhBTl9PUl9FUVVBTF9UT19USFJFU0hPTEQsXG4gICAgICAgIGFsYXJtRGVzY3JpcHRpb246ICdBbGFybSB3aGVuIGRlZGljYXRlZCBob3N0IHN0YXR1cyBjaGVjayBmYWlscycsXG4gICAgICAgIHRyZWF0TWlzc2luZ0RhdGE6IGNsb3Vkd2F0Y2guVHJlYXRNaXNzaW5nRGF0YS5OT1RfQlJFQUNISU5HLFxuICAgICAgfSk7XG5cbiAgICAgIGRlZGljYXRlZEhvc3RBbGFybS5hZGRBbGFybUFjdGlvbihuZXcgY2xvdWR3YXRjaF9hY3Rpb25zLlNuc0FjdGlvbihhbGFybVRvcGljKSk7XG4gICAgfVxuXG4gICAgLy8gT3V0cHV0c1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdRdWV1ZVRhYmxlTmFtZScsIHtcbiAgICAgIHZhbHVlOiBxdWV1ZVRhYmxlLnRhYmxlTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRHluYW1vREIgdGFibGUgZm9yIGhvc3QgbWlncmF0aW9uIHF1ZXVlJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdTdGF0ZU1hY2hpbmVBcm4nLCB7XG4gICAgICB2YWx1ZTogc3RhdGVNYWNoaW5lLnN0YXRlTWFjaGluZUFybixcbiAgICAgIGRlc2NyaXB0aW9uOiAnU3RlcCBGdW5jdGlvbnMgc3RhdGUgbWFjaGluZSBBUk4nLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FsZXJ0VG9waWNBcm4nLCB7XG4gICAgICB2YWx1ZTogYWxlcnRUb3BpYy50b3BpY0FybixcbiAgICAgIGRlc2NyaXB0aW9uOiAnU05TIHRvcGljIGZvciBtaWdyYXRpb24gYWxlcnRzJyxcbiAgICB9KTtcbiAgfVxufVxuIl19