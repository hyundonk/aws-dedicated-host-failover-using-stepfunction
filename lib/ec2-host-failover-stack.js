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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWMyLWhvc3QtZmFpbG92ZXItc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJlYzItaG9zdC1mYWlsb3Zlci1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUNuQywrREFBaUQ7QUFDakQsbUVBQXFEO0FBQ3JELHlEQUEyQztBQUMzQyx3RUFBMEQ7QUFDMUQsNkVBQStEO0FBQy9ELHlEQUEyQztBQUMzQyx1RUFBeUQ7QUFDekQsdUZBQXlFO0FBQ3pFLDJDQUE2QjtBQVc3QixNQUFhLG9CQUFxQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ2pELFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBZ0M7UUFDeEUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsMkJBQTJCO1FBQzNCLE1BQU0sVUFBVSxHQUFHLElBQUksUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsb0JBQW9CLEVBQUU7WUFDaEUsWUFBWSxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUU7WUFDckUsV0FBVyxFQUFFLFFBQVEsQ0FBQyxXQUFXLENBQUMsZUFBZTtZQUNqRCxtQkFBbUIsRUFBRSxnQkFBZ0I7U0FDdEMsQ0FBQyxDQUFDO1FBRUgsdUJBQXVCO1FBQ3ZCLE1BQU0sVUFBVSxHQUFHLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUseUJBQXlCLENBQUMsQ0FBQztRQUNsRSxJQUFJLEdBQUcsQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLG1CQUFtQixFQUFFO1lBQzlDLEtBQUssRUFBRSxVQUFVO1lBQ2pCLFFBQVEsRUFBRSxHQUFHLENBQUMsb0JBQW9CLENBQUMsS0FBSztZQUN4QyxRQUFRLEVBQUUsS0FBSyxDQUFDLFVBQVU7U0FDM0IsQ0FBQyxD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QyxXQUFXLEVBQUUsa0NBQWtDO1NBQ2hELENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsZUFBZSxFQUFFO1lBQ3ZDLEtBQUssRUFBRSxVQUFVLENBQUMsUUFBUTtZQUMxQixXQUFXLEVBQUUsZ0NBQWdDO1NBQzlDLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQWxRRCxvREFrUUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJztcbmltcG9ydCAqIGFzIHNucyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc25zJztcbmltcG9ydCAqIGFzIHN1YnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNucy1zdWJzY3JpcHRpb25zJztcbmltcG9ydCAqIGFzIHN0ZXBmdW5jdGlvbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXN0ZXBmdW5jdGlvbnMnO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgY2xvdWR3YXRjaCBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWR3YXRjaCc7XG5pbXBvcnQgKiBhcyBjbG91ZHdhdGNoX2FjdGlvbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3Vkd2F0Y2gtYWN0aW9ucyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRUMySG9zdEZhaWxvdmVyU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgYWxlcnRFbWFpbDogc3RyaW5nO1xuICBhdmFpbGFiaWxpdHlab25lOiBzdHJpbmc7XG4gIGluc3RhbmNlVHlwZTogc3RyaW5nO1xuICAvLyBPcHRpb25hbDogQWRkIHNwZWNpZmljIGhvc3QgSURzIHRvIG1vbml0b3JcbiAgZGVkaWNhdGVkSG9zdElkcz86IHN0cmluZ1tdO1xufVxuXG5leHBvcnQgY2xhc3MgRUMySG9zdEZhaWxvdmVyU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogRUMySG9zdEZhaWxvdmVyU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgLy8gRHluYW1vREIgdGFibGUgZm9yIHF1ZXVlXG4gICAgY29uc3QgcXVldWVUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnSG9zdE1pZ3JhdGlvblF1ZXVlJywge1xuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdIb3N0SWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHRpbWVUb0xpdmVBdHRyaWJ1dGU6ICdFeHBpcmF0aW9uVGltZScsXG4gICAgfSk7XG5cbiAgICAvLyBTTlMgdG9waWMgZm9yIGFsZXJ0c1xuICAgIGNvbnN0IGFsZXJ0VG9waWMgPSBuZXcgc25zLlRvcGljKHRoaXMsICdIb3N0TWlncmF0aW9uQWxlcnRUb3BpYycpO1xuICAgIG5ldyBzbnMuU3Vic2NyaXB0aW9uKHRoaXMsICdFbWFpbFN1YnNjcmlwdGlvbicsIHtcbiAgICAgIHRvcGljOiBhbGVydFRvcGljLFxuICAgICAgcHJvdG9jb2w6IHNucy5TdWJzY3JpcHRpb25Qcm90b2NvbC5FTUFJTCxcbiAgICAgIGVuZHBvaW50OiBwcm9wcy5hbGVydEVtYWlsLFxuICAgIH0pO1xuXG4gICAgLy8gTGFtYmRhIGxheWVyIHdpdGggY29tbW9uIGNvZGVcbiAgICBjb25zdCBjb21tb25MYXllciA9IG5ldyBsYW1iZGEuTGF5ZXJWZXJzaW9uKHRoaXMsICdDb21tb25MYXllcicsIHtcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnbGFtYmRhLWxheWVyJykpLFxuICAgICAgY29tcGF0aWJsZVJ1bnRpbWVzOiBbbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1hdLFxuICAgICAgZGVzY3JpcHRpb246ICdDb21tb24gdXRpbGl0aWVzIGZvciBFQzIgaG9zdCBtaWdyYXRpb24nLFxuICAgIH0pO1xuXG4gICAgLy8gQ29tbW9uIExhbWJkYSBjb25maWd1cmF0aW9uXG4gICAgY29uc3QgbGFtYmRhQ29uZmlnID0ge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBRVUVVRV9UQUJMRV9OQU1FOiBxdWV1ZVRhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgQUxFUlRfVE9QSUNfQVJOOiBhbGVydFRvcGljLnRvcGljQXJuLFxuICAgICAgICBBVkFJTEFCSUxJVFlfWk9ORTogcHJvcHMuYXZhaWxhYmlsaXR5Wm9uZSxcbiAgICAgICAgSU5TVEFOQ0VfVFlQRTogcHJvcHMuaW5zdGFuY2VUeXBlLFxuICAgICAgfSxcbiAgICAgIGxheWVyczogW2NvbW1vbkxheWVyXSxcbiAgICB9O1xuXG4gICAgLy8gQ3JlYXRlIExhbWJkYSBmdW5jdGlvbnNcbiAgICBjb25zdCBpbml0aWFsaXplRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdJbml0aWFsaXplTWlncmF0aW9uRnVuY3Rpb24nLCB7XG4gICAgICAuLi5sYW1iZGFDb25maWcsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJ2xhbWJkYS9pbml0aWFsaXplLW1pZ3JhdGlvbicpKSxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICB9KTtcblxuICAgIGNvbnN0IGNoZWNrUmVzZXJ2ZWRIb3N0RnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdDaGVja1Jlc2VydmVkSG9zdEZ1bmN0aW9uJywge1xuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICdsYW1iZGEvY2hlY2stcmVzZXJ2ZWQtaG9zdCcpKSxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICB9KTtcblxuICAgIGNvbnN0IHByb3Zpc2lvblJlc2VydmVkSG9zdEZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnUHJvdmlzaW9uUmVzZXJ2ZWRIb3N0RnVuY3Rpb24nLCB7XG4gICAgICAuLi5sYW1iZGFDb25maWcsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJ2xhbWJkYS9wcm92aXNpb24tcmVzZXJ2ZWQtaG9zdCcpKSxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLCAvLyBQcm92aXNpb25pbmcgY2FuIHRha2UgbG9uZ2VyXG4gICAgfSk7XG5cbiAgICBjb25zdCBnZXRJbnN0YW5jZXNGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0dldEluc3RhbmNlc0Z1bmN0aW9uJywge1xuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICdsYW1iZGEvZ2V0LWluc3RhbmNlcycpKSxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICB9KTtcblxuICAgIGNvbnN0IHN0b3BJbnN0YW5jZUZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnU3RvcEluc3RhbmNlRnVuY3Rpb24nLCB7XG4gICAgICAuLi5sYW1iZGFDb25maWcsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJ2xhbWJkYS9zdG9wLWluc3RhbmNlJykpLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgIH0pO1xuXG4gICAgY29uc3QgY2hlY2tJbnN0YW5jZVN0YXRlRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdDaGVja0luc3RhbmNlU3RhdGVGdW5jdGlvbicsIHtcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnbGFtYmRhL2NoZWNrLWluc3RhbmNlLXN0YXRlJykpLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgIH0pO1xuXG4gICAgY29uc3QgbW9kaWZ5UGxhY2VtZW50RnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdNb2RpZnlQbGFjZW1lbnRGdW5jdGlvbicsIHtcbiAgICAgIC4uLmxhbWJkYUNvbmZpZyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnbGFtYmRhL21vZGlmeS1wbGFjZW1lbnQnKSksXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgfSk7XG5cbiAgICBjb25zdCBzdGFydEluc3RhbmNlRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdTdGFydEluc3RhbmNlRnVuY3Rpb24nLCB7XG4gICAgICAuLi5sYW1iZGFDb25maWcsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJ2xhbWJkYS9zdGFydC1pbnN0YW5jZScpKSxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICB9KTtcblxuICAgIGNvbnN0IHVwZGF0ZVN0YXR1c0Z1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnVXBkYXRlU3RhdHVzRnVuY3Rpb24nLCB7XG4gICAgICAuLi5sYW1iZGFDb25maWcsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJ2xhbWJkYS91cGRhdGUtc3RhdHVzJykpLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgIH0pO1xuXG4gICAgLy8gR3JhbnQgcGVybWlzc2lvbnNcbiAgICBxdWV1ZVRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShpbml0aWFsaXplRnVuY3Rpb24pO1xuICAgIHF1ZXVlVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKHVwZGF0ZVN0YXR1c0Z1bmN0aW9uKTtcbiAgICBhbGVydFRvcGljLmdyYW50UHVibGlzaChpbml0aWFsaXplRnVuY3Rpb24pO1xuICAgIGFsZXJ0VG9waWMuZ3JhbnRQdWJsaXNoKHVwZGF0ZVN0YXR1c0Z1bmN0aW9uKTtcblxuICAgIC8vIEVDMiBwZXJtaXNzaW9uc1xuICAgIGNvbnN0IGVjMlBvbGljeSA9IG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2VjMjpEZXNjcmliZUhvc3RzJyxcbiAgICAgICAgJ2VjMjpBbGxvY2F0ZUhvc3RzJyxcbiAgICAgICAgJ2VjMjpEZXNjcmliZUluc3RhbmNlcycsXG4gICAgICAgICdlYzI6U3RvcEluc3RhbmNlcycsXG4gICAgICAgICdlYzI6U3RhcnRJbnN0YW5jZXMnLFxuICAgICAgICAnZWMyOk1vZGlmeUluc3RhbmNlUGxhY2VtZW50JyxcbiAgICAgICAgJ2VjMjpDcmVhdGVUYWdzJyxcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgIH0pO1xuXG4gICAgY2hlY2tSZXNlcnZlZEhvc3RGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3koZWMyUG9saWN5KTtcbiAgICBwcm92aXNpb25SZXNlcnZlZEhvc3RGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3koZWMyUG9saWN5KTtcbiAgICBnZXRJbnN0YW5jZXNGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3koZWMyUG9saWN5KTtcbiAgICBzdG9wSW5zdGFuY2VGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3koZWMyUG9saWN5KTtcbiAgICBjaGVja0luc3RhbmNlU3RhdGVGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3koZWMyUG9saWN5KTtcbiAgICBtb2RpZnlQbGFjZW1lbnRGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3koZWMyUG9saWN5KTtcbiAgICBzdGFydEluc3RhbmNlRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KGVjMlBvbGljeSk7XG5cbiAgICAvLyBDcmVhdGUgdGhlIHN0YXRlIG1hY2hpbmUgdXNpbmcgdGhlIEpTT04gZGVmaW5pdGlvblxuICAgIC8vIENyZWF0ZSBMYW1iZGEgZnVuY3Rpb24gdG8gcmVtb3ZlIFJlc2VydmVkIHRhZ1xuICAgIGNvbnN0IHJlbW92ZVJlc2VydmVkVGFnRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdSZW1vdmVSZXNlcnZlZFRhZ0Z1bmN0aW9uJywge1xuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICdsYW1iZGEvcmVtb3ZlLXJlc2VydmVkLXRhZycpKSxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICB9KTtcbiAgICBcbiAgICAvLyBHcmFudCBFQzIgcGVybWlzc2lvbnMgdG8gcmVtb3ZlIHRhZ3NcbiAgICByZW1vdmVSZXNlcnZlZFRhZ0Z1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBhY3Rpb25zOiBbJ2VjMjpEZWxldGVUYWdzJ10sXG4gICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgIH0pKTtcblxuICAgIGNvbnN0IHN0YXRlTWFjaGluZSA9IG5ldyBzdGVwZnVuY3Rpb25zLlN0YXRlTWFjaGluZSh0aGlzLCAnSG9zdE1pZ3JhdGlvblN0YXRlTWFjaGluZScsIHtcbiAgICAgIGRlZmluaXRpb25Cb2R5OiBzdGVwZnVuY3Rpb25zLkRlZmluaXRpb25Cb2R5LmZyb21GaWxlKHBhdGguam9pbihfX2Rpcm5hbWUsICdzdGVwLWZ1bmN0aW9ucy9taWdyYXRpb24td29ya2Zsb3cuanNvbicpKSxcbiAgICAgIGRlZmluaXRpb25TdWJzdGl0dXRpb25zOiB7XG4gICAgICAgIEluaXRpYWxpemVNaWdyYXRpb25GdW5jdGlvbjogaW5pdGlhbGl6ZUZ1bmN0aW9uLmZ1bmN0aW9uQXJuLFxuICAgICAgICBDaGVja1Jlc2VydmVkSG9zdEZ1bmN0aW9uOiBjaGVja1Jlc2VydmVkSG9zdEZ1bmN0aW9uLmZ1bmN0aW9uQXJuLFxuICAgICAgICBQcm92aXNpb25SZXNlcnZlZEhvc3RGdW5jdGlvbjogcHJvdmlzaW9uUmVzZXJ2ZWRIb3N0RnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgICAgIEdldEluc3RhbmNlc0Z1bmN0aW9uOiBnZXRJbnN0YW5jZXNGdW5jdGlvbi5mdW5jdGlvbkFybixcbiAgICAgICAgU3RvcEluc3RhbmNlRnVuY3Rpb246IHN0b3BJbnN0YW5jZUZ1bmN0aW9uLmZ1bmN0aW9uQXJuLFxuICAgICAgICBDaGVja0luc3RhbmNlU3RhdGVGdW5jdGlvbjogY2hlY2tJbnN0YW5jZVN0YXRlRnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgICAgIE1vZGlmeVBsYWNlbWVudEZ1bmN0aW9uOiBtb2RpZnlQbGFjZW1lbnRGdW5jdGlvbi5mdW5jdGlvbkFybixcbiAgICAgICAgU3RhcnRJbnN0YW5jZUZ1bmN0aW9uOiBzdGFydEluc3RhbmNlRnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgICAgIFVwZGF0ZVN0YXR1c0Z1bmN0aW9uOiB1cGRhdGVTdGF0dXNGdW5jdGlvbi5mdW5jdGlvbkFybixcbiAgICAgICAgUmVtb3ZlUmVzZXJ2ZWRUYWdGdW5jdGlvbjogcmVtb3ZlUmVzZXJ2ZWRUYWdGdW5jdGlvbi5mdW5jdGlvbkFybixcbiAgICAgICAgQWxlcnRUb3BpY0FybjogYWxlcnRUb3BpYy50b3BpY0FybixcbiAgICAgICAgQXZhaWxhYmlsaXR5Wm9uZTogcHJvcHMuYXZhaWxhYmlsaXR5Wm9uZSxcbiAgICAgICAgSW5zdGFuY2VUeXBlOiBwcm9wcy5pbnN0YW5jZVR5cGVcbiAgICAgIH0sXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uaG91cnMoMjQpLCAvLyBBbGxvdyB1cCB0byAyNCBob3VycyBmb3IgdGhlIGVudGlyZSBtaWdyYXRpb25cbiAgICAgIHN0YXRlTWFjaGluZVR5cGU6IHN0ZXBmdW5jdGlvbnMuU3RhdGVNYWNoaW5lVHlwZS5TVEFOREFSRCxcbiAgICB9KTtcbiAgICBcbiAgICAvLyBHcmFudCBwZXJtaXNzaW9ucyBmb3IgdGhlIHN0YXRlIG1hY2hpbmUgdG8gaW52b2tlIGFsbCBMYW1iZGEgZnVuY3Rpb25zXG4gICAgaW5pdGlhbGl6ZUZ1bmN0aW9uLmdyYW50SW52b2tlKHN0YXRlTWFjaGluZSk7XG4gICAgY2hlY2tSZXNlcnZlZEhvc3RGdW5jdGlvbi5ncmFudEludm9rZShzdGF0ZU1hY2hpbmUpO1xuICAgIHByb3Zpc2lvblJlc2VydmVkSG9zdEZ1bmN0aW9uLmdyYW50SW52b2tlKHN0YXRlTWFjaGluZSk7XG4gICAgZ2V0SW5zdGFuY2VzRnVuY3Rpb24uZ3JhbnRJbnZva2Uoc3RhdGVNYWNoaW5lKTtcbiAgICBzdG9wSW5zdGFuY2VGdW5jdGlvbi5ncmFudEludm9rZShzdGF0ZU1hY2hpbmUpO1xuICAgIGNoZWNrSW5zdGFuY2VTdGF0ZUZ1bmN0aW9uLmdyYW50SW52b2tlKHN0YXRlTWFjaGluZSk7XG4gICAgbW9kaWZ5UGxhY2VtZW50RnVuY3Rpb24uZ3JhbnRJbnZva2Uoc3RhdGVNYWNoaW5lKTtcbiAgICBzdGFydEluc3RhbmNlRnVuY3Rpb24uZ3JhbnRJbnZva2Uoc3RhdGVNYWNoaW5lKTtcbiAgICB1cGRhdGVTdGF0dXNGdW5jdGlvbi5ncmFudEludm9rZShzdGF0ZU1hY2hpbmUpO1xuICAgIHJlbW92ZVJlc2VydmVkVGFnRnVuY3Rpb24uZ3JhbnRJbnZva2Uoc3RhdGVNYWNoaW5lKTtcbiAgICBcbiAgICAvLyBHcmFudCB0aGUgU3RlcCBGdW5jdGlvbiBwZXJtaXNzaW9uIHRvIHB1Ymxpc2ggdG8gdGhlIFNOUyB0b3BpY1xuICAgIGFsZXJ0VG9waWMuZ3JhbnRQdWJsaXNoKHN0YXRlTWFjaGluZSk7XG5cbiAgICAvLyBDcmVhdGUgYWxhcm0gaGFuZGxlciBMYW1iZGFcbiAgICBjb25zdCBhbGFybUhhbmRsZXJGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0FsYXJtSGFuZGxlckZ1bmN0aW9uJywge1xuICAgICAgLi4ubGFtYmRhQ29uZmlnLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICdsYW1iZGEvYWxhcm0taGFuZGxlcicpKSxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIC4uLmxhbWJkYUNvbmZpZy5lbnZpcm9ubWVudCxcbiAgICAgICAgTUlHUkFUSU9OX1NUQVRFX01BQ0hJTkVfQVJOOiBzdGF0ZU1hY2hpbmUuc3RhdGVNYWNoaW5lQXJuLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IHBlcm1pc3Npb25zIHRvIHN0YXJ0IFN0ZXAgRnVuY3Rpb25zIGV4ZWN1dGlvblxuICAgIHN0YXRlTWFjaGluZS5ncmFudFN0YXJ0RXhlY3V0aW9uKGFsYXJtSGFuZGxlckZ1bmN0aW9uKTtcbiAgICBcbiAgICAvLyBHcmFudCBEeW5hbW9EQiBwZXJtaXNzaW9ucyBmb3IgR2V0SXRlbSBhbmQgUHV0SXRlbSBvcGVyYXRpb25zXG4gICAgcXVldWVUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoYWxhcm1IYW5kbGVyRnVuY3Rpb24pO1xuXG4gICAgLy8gQ3JlYXRlIFNOUyB0b3BpYyBmb3IgQ2xvdWRXYXRjaCBhbGFybXNcbiAgICBjb25zdCBhbGFybVRvcGljID0gbmV3IHNucy5Ub3BpYyh0aGlzLCAnSG9zdEFsYXJtVG9waWMnKTtcbiAgICBhbGFybVRvcGljLmFkZFN1YnNjcmlwdGlvbihuZXcgc3Vicy5MYW1iZGFTdWJzY3JpcHRpb24oYWxhcm1IYW5kbGVyRnVuY3Rpb24pKTtcblxuICAgIC8vIENyZWF0ZSBDbG91ZFdhdGNoIGFsYXJtcyBmb3IgZGVkaWNhdGVkIGhvc3Qgc3RhdHVzXG4gICAgaWYgKHByb3BzLmRlZGljYXRlZEhvc3RJZHMgJiYgcHJvcHMuZGVkaWNhdGVkSG9zdElkcy5sZW5ndGggPiAwKSB7XG4gICAgICBwcm9wcy5kZWRpY2F0ZWRIb3N0SWRzLmZvckVhY2goKGhvc3RJZCwgaW5kZXgpID0+IHtcbiAgICAgICAgY29uc3QgZGVkaWNhdGVkSG9zdFN0YXR1c01ldHJpYyA9IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgICAgbmFtZXNwYWNlOiAnQVdTL0VDMicsXG4gICAgICAgICAgbWV0cmljTmFtZTogJ1N0YXR1c0NoZWNrRmFpbGVkJyxcbiAgICAgICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgICAgICBIb3N0SWQ6IGhvc3RJZCxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHN0YXRpc3RpYzogJ01heGltdW0nLFxuICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IGRlZGljYXRlZEhvc3RBbGFybSA9IG5ldyBjbG91ZHdhdGNoLkFsYXJtKHRoaXMsIGBEZWRpY2F0ZWRIb3N0U3RhdHVzQWxhcm0tJHtpbmRleH1gLCB7XG4gICAgICAgICAgbWV0cmljOiBkZWRpY2F0ZWRIb3N0U3RhdHVzTWV0cmljLFxuICAgICAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAxLFxuICAgICAgICAgIHRocmVzaG9sZDogMSxcbiAgICAgICAgICBjb21wYXJpc29uT3BlcmF0b3I6IGNsb3Vkd2F0Y2guQ29tcGFyaXNvbk9wZXJhdG9yLkdSRUFURVJfVEhBTl9PUl9FUVVBTF9UT19USFJFU0hPTEQsXG4gICAgICAgICAgYWxhcm1EZXNjcmlwdGlvbjogYEFsYXJtIHdoZW4gZGVkaWNhdGVkIGhvc3QgJHtob3N0SWR9IHN0YXR1cyBjaGVjayBmYWlsc2AsXG4gICAgICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2xvdWR3YXRjaC5UcmVhdE1pc3NpbmdEYXRhLk5PVF9CUkVBQ0hJTkcsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGRlZGljYXRlZEhvc3RBbGFybS5hZGRBbGFybUFjdGlvbihuZXcgY2xvdWR3YXRjaF9hY3Rpb25zLlNuc0FjdGlvbihhbGFybVRvcGljKSk7XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gQ3JlYXRlIGEgcGxhY2Vob2xkZXIgYWxhcm0gLSB5b3Ugc2hvdWxkIHJlcGxhY2UgdGhpcyB3aXRoIGFjdHVhbCBob3N0IElEc1xuICAgICAgY29uc3QgZGVkaWNhdGVkSG9zdFN0YXR1c01ldHJpYyA9IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICAgIG5hbWVzcGFjZTogJ0FXUy9FQzInLFxuICAgICAgICBtZXRyaWNOYW1lOiAnU3RhdHVzQ2hlY2tGYWlsZWQnLFxuICAgICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgICAgSG9zdElkOiAnUExBQ0VIT0xERVJfSE9TVF9JRCcsIC8vIFJlcGxhY2Ugd2l0aCBhY3R1YWwgaG9zdCBJRFxuICAgICAgICB9LFxuICAgICAgICBzdGF0aXN0aWM6ICdNYXhpbXVtJyxcbiAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgIH0pO1xuXG4gICAgICBjb25zdCBkZWRpY2F0ZWRIb3N0QWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybSh0aGlzLCAnRGVkaWNhdGVkSG9zdFN0YXR1c0FsYXJtJywge1xuICAgICAgICBtZXRyaWM6IGRlZGljYXRlZEhvc3RTdGF0dXNNZXRyaWMsXG4gICAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAxLFxuICAgICAgICB0aHJlc2hvbGQ6IDEsXG4gICAgICAgIGNvbXBhcmlzb25PcGVyYXRvcjogY2xvdWR3YXRjaC5Db21wYXJpc29uT3BlcmF0b3IuR1JFQVRFUl9USEFOX09SX0VRVUFMX1RPX1RIUkVTSE9MRCxcbiAgICAgICAgYWxhcm1EZXNjcmlwdGlvbjogJ0FsYXJtIHdoZW4gZGVkaWNhdGVkIGhvc3Qgc3RhdHVzIGNoZWNrIGZhaWxzJyxcbiAgICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2xvdWR3YXRjaC5UcmVhdE1pc3NpbmdEYXRhLk5PVF9CUkVBQ0hJTkcsXG4gICAgICB9KTtcblxuICAgICAgZGVkaWNhdGVkSG9zdEFsYXJtLmFkZEFsYXJtQWN0aW9uKG5ldyBjbG91ZHdhdGNoX2FjdGlvbnMuU25zQWN0aW9uKGFsYXJtVG9waWMpKTtcbiAgICB9XG5cbiAgICAvLyBPdXRwdXRzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1F1ZXVlVGFibGVOYW1lJywge1xuICAgICAgdmFsdWU6IHF1ZXVlVGFibGUudGFibGVOYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdEeW5hbW9EQiB0YWJsZSBmb3IgaG9zdCBtaWdyYXRpb24gcXVldWUnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1N0YXRlTWFjaGluZUFybicsIHtcbiAgICAgIHZhbHVlOiBzdGF0ZU1hY2hpbmUuc3RhdGVNYWNoaW5lQXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdTdGVwIEZ1bmN0aW9ucyBzdGF0ZSBtYWNoaW5lIEFSTicsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQWxlcnRUb3BpY0FybicsIHtcbiAgICAgIHZhbHVlOiBhbGVydFRvcGljLnRvcGljQXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdTTlMgdG9waWMgZm9yIG1pZ3JhdGlvbiBhbGVydHMnLFxuICAgIH0pO1xuICB9XG59XG4iXX0=