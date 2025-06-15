#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { EC2HostFailoverStack } from '../lib/ec2-host-failover-stack';

const app = new cdk.App();
new EC2HostFailoverStack(app, 'EC2HostFailoverStack', {
  // Configuration parameters
  alertEmail: 'your-email@example.com', // Replace with your email address
  availabilityZone: 'ap-northeast-1a',    
  instanceType: 'c5.large',             // Replace with your instance type
  
  // Optional: Add specific host IDs to monitor
  // dedicatedHostIds: ['h-1234567890abcdef0', 'h-0fedcba0987654321'],
  
  // CDK environment
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: 'ap-northeast-1' 
  },
  description: 'EC2 Dedicated Host Failover Solution with Step Functions',
});
