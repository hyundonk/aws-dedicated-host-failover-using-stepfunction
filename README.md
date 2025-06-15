# EC2 Dedicated Host Failover Solution with Step Functions

This project implements an automated failover solution for EC2 dedicated hosts using AWS Step Functions. When a dedicated host enters an unhealthy state (detected via CloudWatch alarms), the system automatically migrates all EC2 instances to a reserved dedicated host.

## Architecture

The solution consists of the following components:

1. **CloudWatch Alarms** - Monitor EC2 dedicated host health
2. **SNS Topic** - Receive alarm notifications
3. **Lambda Function (Alarm Handler)** - Parse alarms and initiate Step Functions workflow
4. **DynamoDB Table** - Store queue of hosts requiring migration and track migration status
5. **Step Functions State Machine** - Orchestrate the migration process
6. **Lambda Functions** - Handle individual steps of the migration process
7. **SNS Topic** - Send email notifications for failures/successes

## Workflow

1. When a dedicated host enters an unhealthy state, CloudWatch triggers an alarm
2. The alarm notification is sent to an SNS topic
3. The Alarm Handler Lambda function processes the notification, extracts the host ID, adds it to the DynamoDB queue, and starts a Step Functions execution
4. The Step Functions workflow:
   - Initializes the migration
   - Checks for an available reserved dedicated host
   - Provisions a new host if none is available
   - Gets all instances on the failing host
   - For each instance:
     - Stops the instance
     - Waits for the instance to stop
     - Modifies the instance placement to the reserved host
     - Starts the instance
     - Waits for the instance to start
   - Updates the migration status
   - Removes the "Reserved" tag from the new host
   - Sends notifications about the migration result
5. Successfully migrated hosts are automatically removed from the queue

## Deployment

### Prerequisites

- AWS CDK installed (`npm install -g aws-cdk`)
- Node.js and npm
- AWS CLI configured with appropriate credentials

### Lambda Layer Dependencies

The Lambda layer requires its own dependencies. Before deployment, install them:

```bash
cd lib/lambda-layer/nodejs
npm install
cd ../../..
```

### Configuration

Edit the `bin/202506-dh-failover-stepfunction.ts` file to configure:

- `alertEmail`: Email address to receive notifications
- `availabilityZone`: Availability zone for reserved hosts
- `instanceType`: Instance type for reserved hosts
- `dedicatedHostIds`: (Optional) Array of dedicated host IDs to monitor

### Deploy the Stack

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Deploy to AWS
cdk deploy
```

## Customization

### CloudWatch Alarms

The stack includes CloudWatch alarms that monitor the `StatusCheckFailed` metric for dedicated hosts. You should configure these to monitor your specific dedicated hosts:

1. Edit `bin/202506-dh-failover-stepfunction.ts`
2. Add your dedicated host IDs to the `dedicatedHostIds` array
3. If no host IDs are provided, a placeholder alarm is created that you should replace

### Reserved Host Configuration

To customize the reserved host configuration:

1. Edit `lib/lambda/provision-reserved-host/index.js`
2. Modify the EC2 allocation parameters as needed

## Monitoring and Maintenance

- Check the DynamoDB table to view the current migration status
- CloudWatch Logs contain detailed logs from all Lambda functions
- Step Functions console provides visual workflow monitoring
- SNS email notifications provide real-time alerts on migration status

## Security Considerations

- All Lambda functions have least-privilege IAM permissions
- DynamoDB uses on-demand billing mode with default encryption
- SNS topics are used for notifications and Lambda triggers
- Step Functions state machine uses standard workflow type for better security and visibility

## Cost Optimization

- DynamoDB uses on-demand capacity to minimize costs
- Lambda functions are only invoked when needed
- Step Functions standard workflow is billed per state transition
- CloudWatch alarms are configured with appropriate thresholds

## Troubleshooting

- Check CloudWatch Logs for Lambda function errors
- Verify that CloudWatch alarms are correctly configured
- Ensure SNS subscriptions are confirmed
- Check IAM permissions if migrations fail
- Review Step Functions execution history for detailed error information

## Architecture Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  CloudWatch     │────▶│    SNS Topic    │────▶│  Alarm Handler  │
│    Alarms       │     │                 │     │     Lambda      │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   DynamoDB      │◀───▶│  Step Functions │◀────│  Start Workflow │
│     Table       │     │ State Machine   │     │                 │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Lambda         │     │  EC2 Instance   │     │    SNS Topic    │
│  Functions      │────▶│   Migration     │────▶│  Notifications  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Lambda Layer

The project includes a Lambda layer with common utilities for EC2 operations:

- `ec2-utils.js` - Contains helper functions for EC2 operations, DynamoDB updates, and SNS notifications

## License

This project is licensed under the MIT License - see the LICENSE file for details.
