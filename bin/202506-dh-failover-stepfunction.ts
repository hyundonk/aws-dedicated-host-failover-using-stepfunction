#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { EC2HostFailoverStack } from '../lib/ec2-host-failover-stack';

// Get configuration from environment variables with validation
const getRequiredEnvVar = (name: string, defaultValue?: string): string => {
  const value = process.env[name] || defaultValue;
  if (!value) {
    throw new Error(`Environment variable ${name} is required but not set`);
  }
  return value;
};

// Configuration from environment variables
const alertEmail = getRequiredEnvVar('ALERT_EMAIL');
const availabilityZone = getRequiredEnvVar('AVAILABILITY_ZONE');
const region = getRequiredEnvVar('AWS_REGION');

// Validation functions
const validateEmail = (email: string): void => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error(`Invalid email format: ${email}`);
  }
};

const validateAvailabilityZone = (az: string): void => {
  const azRegex = /^[a-z]{2}-[a-z]+-\d+[a-z]$/;
  if (!azRegex.test(az)) {
    throw new Error(`Invalid availability zone format: ${az}. Expected format: us-east-1a`);
  }
};

const validateRegion = (region: string): void => {
  const regionRegex = /^[a-z]{2}-[a-z]+-\d+$/;
  if (!regionRegex.test(region)) {
    throw new Error(`Invalid region format: ${region}. Expected format: us-east-1`);
  }
};

// Validate configuration
try {
  validateEmail(alertEmail);
  validateAvailabilityZone(availabilityZone);
  validateRegion(region);
  
  // Validate that availability zone matches region
  if (!availabilityZone.startsWith(region)) {
    throw new Error(`Availability zone ${availabilityZone} does not match region ${region}`);
  }
  
  console.log('✅ Configuration validation passed');
  console.log(`📧 Alert Email: ${alertEmail}`);
  console.log(`🌍 Region: ${region}`);
  console.log(`📍 Availability Zone: ${availabilityZone}`);
  
} catch (error) {
  console.error('❌ Configuration validation failed:');
  console.error((error as Error).message);
  console.error('\n📋 Required environment variables:');
  console.error('  ALERT_EMAIL - Email address for notifications (e.g., admin@company.com)');
  console.error('  AVAILABILITY_ZONE - Target availability zone (e.g., ap-northeast-1a)');
  console.error('  AWS_REGION - AWS region (e.g., ap-northeast-1)');
  console.error('\n💡 Example usage:');
  console.error('  export ALERT_EMAIL="admin@company.com"');
  console.error('  export AVAILABILITY_ZONE="ap-northeast-1a"');
  console.error('  export AWS_REGION="ap-northeast-1"');
  console.error('  cdk deploy');
  process.exit(1);
}

const app = new cdk.App();
new EC2HostFailoverStack(app, 'EC2HostFailoverStack', {
  // Configuration parameters from environment variables
  alertEmail: alertEmail,
  availabilityZone: availabilityZone,
  instanceType: 'c5.large',             // Keep hardcoded as requested
  
  // Optional: Add specific host IDs to monitor
  // dedicatedHostIds: ['h-1234567890abcdef0', 'h-0fedcba0987654321'],
  
  // CDK environment
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: region  // Use environment variable
  },
  description: 'EC2 Dedicated Host Failover Solution with Step Functions',
});
