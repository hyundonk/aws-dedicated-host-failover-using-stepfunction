# IAM Permissions Required for CDK Deployment

This document outlines the comprehensive IAM permissions required to deploy the EC2 Dedicated Host Failover Step Functions CDK project.

## Overview

The CDK project creates multiple AWS resources including Lambda functions, DynamoDB tables, Step Functions state machines, SNS topics, CloudWatch alarms, and associated IAM roles. Your IAM user or role needs sufficient permissions to create, update, and manage these resources.

## Quick Start (Recommended for Development)

For development environments, the simplest approach is to use AWS managed policies:

```bash
# Attach these managed policies to your IAM user/role:
- PowerUserAccess
- IAMFullAccess
```

**Note**: These policies provide broad permissions. For production environments, consider using the custom policies detailed below.

## Detailed Permission Requirements

### 1. Core CDK Deployment Permissions

#### CloudFormation Permissions
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:CreateStack",
        "cloudformation:UpdateStack",
        "cloudformation:DeleteStack",
        "cloudformation:DescribeStacks",
        "cloudformation:DescribeStackEvents",
        "cloudformation:DescribeStackResources",
        "cloudformation:GetTemplate",
        "cloudformation:ListStacks",
        "cloudformation:ValidateTemplate",
        "cloudformation:CreateChangeSet",
        "cloudformation:DescribeChangeSet",
        "cloudformation:ExecuteChangeSet",
        "cloudformation:DeleteChangeSet",
        "cloudformation:ListChangeSets",
        "cloudformation:GetStackPolicy",
        "cloudformation:SetStackPolicy"
      ],
      "Resource": "*"
    }
  ]
}
```

#### S3 Permissions (CDK Assets)
```json
{
  "Effect": "Allow",
  "Action": [
    "s3:CreateBucket",
    "s3:DeleteBucket",
    "s3:GetBucketLocation",
    "s3:GetBucketPolicy",
    "s3:PutBucketPolicy",
    "s3:GetBucketVersioning",
    "s3:PutBucketVersioning",
    "s3:GetBucketAcl",
    "s3:PutBucketAcl",
    "s3:GetBucketCors",
    "s3:PutBucketCors",
    "s3:GetBucketWebsite",
    "s3:PutBucketWebsite",
    "s3:DeleteBucketWebsite",
    "s3:GetBucketNotification",
    "s3:PutBucketNotification",
    "s3:GetBucketLogging",
    "s3:PutBucketLogging",
    "s3:GetBucketTagging",
    "s3:PutBucketTagging",
    "s3:GetObject",
    "s3:PutObject",
    "s3:DeleteObject",
    "s3:ListBucket",
    "s3:GetBucketPublicAccessBlock",
    "s3:PutBucketPublicAccessBlock"
  ],
  "Resource": [
    "arn:aws:s3:::cdk-*",
    "arn:aws:s3:::cdk-*/*"
  ]
}
```

### 2. Service-Specific Permissions

#### Lambda Permissions
```json
{
  "Effect": "Allow",
  "Action": [
    "lambda:CreateFunction",
    "lambda:DeleteFunction",
    "lambda:UpdateFunctionCode",
    "lambda:UpdateFunctionConfiguration",
    "lambda:GetFunction",
    "lambda:ListFunctions",
    "lambda:InvokeFunction",
    "lambda:AddPermission",
    "lambda:RemovePermission",
    "lambda:GetPolicy",
    "lambda:CreateEventSourceMapping",
    "lambda:DeleteEventSourceMapping",
    "lambda:UpdateEventSourceMapping",
    "lambda:ListEventSourceMappings",
    "lambda:PublishLayerVersion",
    "lambda:DeleteLayerVersion",
    "lambda:GetLayerVersion",
    "lambda:ListLayerVersions",
    "lambda:ListLayers",
    "lambda:TagResource",
    "lambda:UntagResource",
    "lambda:ListTags"
  ],
  "Resource": "*"
}
```

#### DynamoDB Permissions
```json
{
  "Effect": "Allow",
  "Action": [
    "dynamodb:CreateTable",
    "dynamodb:DeleteTable",
    "dynamodb:DescribeTable",
    "dynamodb:UpdateTable",
    "dynamodb:ListTables",
    "dynamodb:TagResource",
    "dynamodb:UntagResource",
    "dynamodb:ListTagsOfResource",
    "dynamodb:UpdateTimeToLive",
    "dynamodb:DescribeTimeToLive"
  ],
  "Resource": "*"
}
```

#### Step Functions Permissions
```json
{
  "Effect": "Allow",
  "Action": [
    "states:CreateStateMachine",
    "states:DeleteStateMachine",
    "states:UpdateStateMachine",
    "states:DescribeStateMachine",
    "states:ListStateMachines",
    "states:TagResource",
    "states:UntagResource",
    "states:ListTagsForResource"
  ],
  "Resource": "*"
}
```

#### SNS Permissions
```json
{
  "Effect": "Allow",
  "Action": [
    "sns:CreateTopic",
    "sns:DeleteTopic",
    "sns:GetTopicAttributes",
    "sns:SetTopicAttributes",
    "sns:Subscribe",
    "sns:Unsubscribe",
    "sns:ListTopics",
    "sns:ListSubscriptions",
    "sns:ListSubscriptionsByTopic",
    "sns:GetSubscriptionAttributes",
    "sns:SetSubscriptionAttributes",
    "sns:TagResource",
    "sns:UntagResource",
    "sns:ListTagsForResource"
  ],
  "Resource": "*"
}
```

#### CloudWatch Permissions
```json
{
  "Effect": "Allow",
  "Action": [
    "cloudwatch:PutMetricAlarm",
    "cloudwatch:DeleteAlarms",
    "cloudwatch:DescribeAlarms",
    "cloudwatch:EnableAlarmActions",
    "cloudwatch:DisableAlarmActions",
    "cloudwatch:TagResource",
    "cloudwatch:UntagResource",
    "cloudwatch:ListTagsForResource"
  ],
  "Resource": "*"
}
```

#### IAM Permissions (for Lambda execution roles)
```json
{
  "Effect": "Allow",
  "Action": [
    "iam:CreateRole",
    "iam:DeleteRole",
    "iam:GetRole",
    "iam:UpdateRole",
    "iam:AttachRolePolicy",
    "iam:DetachRolePolicy",
    "iam:PutRolePolicy",
    "iam:DeleteRolePolicy",
    "iam:GetRolePolicy",
    "iam:ListRolePolicies",
    "iam:ListAttachedRolePolicies",
    "iam:CreatePolicy",
    "iam:DeletePolicy",
    "iam:GetPolicy",
    "iam:GetPolicyVersion",
    "iam:ListPolicyVersions",
    "iam:TagRole",
    "iam:UntagRole",
    "iam:TagPolicy",
    "iam:UntagPolicy",
    "iam:PassRole"
  ],
  "Resource": "*"
}
```

### SSM Permissions (for CDK version updates)
```json
{
  "Effect": "Allow",
  "Action": [
    "ssm:GetParameter",
    "ssm:PutParameter"
  ],
  "Resource": [
    "arn:aws:ssm:*:*:parameter/cdk-bootstrap/*"
  ]
}
```

## Complete Custom Policy for Production

For production environments where you need more restrictive permissions, use this comprehensive policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:*",
        "lambda:*",
        "dynamodb:*",
        "states:*",
        "sns:*",
        "cloudwatch:*",
        "iam:CreateRole",
        "iam:DeleteRole",
        "iam:GetRole",
        "iam:UpdateRole",
        "iam:AttachRolePolicy",
        "iam:DetachRolePolicy",
        "iam:PutRolePolicy",
        "iam:DeleteRolePolicy",
        "iam:GetRolePolicy",
        "iam:ListRolePolicies",
        "iam:ListAttachedRolePolicies",
        "iam:CreatePolicy",
        "iam:DeletePolicy",
        "iam:GetPolicy",
        "iam:GetPolicyVersion",
        "iam:ListPolicyVersions",
        "iam:TagRole",
        "iam:UntagRole",
        "iam:TagPolicy",
        "iam:UntagPolicy",
        "iam:PassRole"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:CreateBucket",
        "s3:DeleteBucket",
        "s3:GetBucketLocation",
        "s3:GetBucketPolicy",
        "s3:PutBucketPolicy",
        "s3:GetBucketVersioning",
        "s3:PutBucketVersioning",
        "s3:GetBucketAcl",
        "s3:PutBucketAcl",
        "s3:GetBucketCors",
        "s3:PutBucketCors",
        "s3:GetBucketWebsite",
        "s3:PutBucketWebsite",
        "s3:DeleteBucketWebsite",
        "s3:GetBucketNotification",
        "s3:PutBucketNotification",
        "s3:GetBucketLogging",
        "s3:PutBucketLogging",
        "s3:GetBucketTagging",
        "s3:PutBucketTagging",
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket",
        "s3:GetBucketPublicAccessBlock",
        "s3:PutBucketPublicAccessBlock"
      ],
      "Resource": [
        "arn:aws:s3:::cdk-*",
        "arn:aws:s3:::cdk-*/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:PutParameter"
      ],
      "Resource": [
        "arn:aws:ssm:*:*:parameter/cdk-bootstrap/*"
      ]
    }
  ]
}
```

## Resources Created by This CDK Project

### AWS Resources
- **DynamoDB Table**: `HostMigrationQueue` with TTL enabled
- **SNS Topics**: 
  - `HostMigrationAlertTopic` (for notifications)
  - `HostAlarmTopic` (for CloudWatch alarms)
- **Lambda Functions**: 18 functions + 1 layer
  - Health checking functions
  - Migration orchestration functions
  - Notification functions
  - Utility functions
- **Step Functions**: `HostMigrationStateMachine` (Standard workflow)
- **CloudWatch Alarms**: For dedicated host monitoring
- **IAM Roles**: Execution roles for all Lambda functions and Step Functions

### Estimated Monthly Costs
- **Lambda**: $5-20 (depending on execution frequency)
- **DynamoDB**: $1-5 (on-demand pricing)
- **Step Functions**: $1-10 (standard workflow pricing)
- **SNS**: $1 (notification costs)
- **CloudWatch**: $1-5 (alarms and logs)
- **Total**: ~$10-40/month

## Deployment Instructions

### Prerequisites
1. **AWS CLI configured** with appropriate credentials
2. **Node.js and npm** installed
3. **AWS CDK** installed globally: `npm install -g aws-cdk`

### Deployment Steps
You can deploy this CDK stack on CloudShell in AWS Console after you get the proper permissions described above.

```bash
#0. Clone this repo
git clone https://github.com/hyundonk/aws-dedicated-host-failover-using-stepfunction.git 

# 1. Navigate to project directory
cd aws-dedicated-host-failover-using-stepfunction/

# 1. Install aws-cdk
sudo npm install -g aws-cdk

# 3. Install Lambda layer dependencies
cd lib/lambda-layer/nodejs
npm install
cd ../../..

# 4. Install project dependencies
npm install

# 5. Build the project
npm run build

# 6. Deploy the stack with environment variables
ALERT_EMAIL="admin@company.com" AVAILABILITY_ZONE="ap-northeast-2a" AWS_REGION="ap-northeast-2"  cdk deploy
```

## Security Best Practices

### 1. Principle of Least Privilege
- Start with managed policies for initial deployment
- Create more restrictive policies after successful deployment
- Regularly audit and remove unused permissions

### 2. Resource-Specific ARNs
Replace `"*"` with specific resource ARNs where possible:
```json
{
  "Resource": [
    "arn:aws:lambda:ap-northeast-1:123456789012:function:EC2HostFailoverStack-*",
    "arn:aws:dynamodb:ap-northeast-1:123456789012:table/EC2HostFailoverStack-*"
  ]
}
```

### 3. Temporary Credentials
Consider using temporary credentials or AWS SSO for deployment:
```bash
# Using AWS SSO
aws sso login --profile your-profile
export AWS_PROFILE=your-profile

# Using temporary credentials
aws sts assume-role --role-arn arn:aws:iam::123456789012:role/DeploymentRole --role-session-name CDKDeployment
```

### 4. Environment Separation
Use different IAM policies for different environments:
- **Development**: Broader permissions for experimentation
- **Staging**: Moderate restrictions for testing
- **Production**: Strict least-privilege policies

## Conclusion

This document provides comprehensive IAM permissions required for deploying the EC2 Dedicated Host Failover CDK project. Start with managed policies for development, then implement more restrictive policies for production environments. Always follow the principle of least privilege and regularly audit your permissions.

For immediate deployment, use the managed policies approach. For production deployments, implement the custom policies with appropriate resource-specific ARNs and regular security reviews.
