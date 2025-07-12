#!/usr/bin/env node
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
require("source-map-support/register");
const cdk = __importStar(require("aws-cdk-lib"));
const ec2_host_failover_stack_1 = require("../lib/ec2-host-failover-stack");
// Get configuration from environment variables with validation
const getRequiredEnvVar = (name, defaultValue) => {
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
const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        throw new Error(`Invalid email format: ${email}`);
    }
};
const validateAvailabilityZone = (az) => {
    const azRegex = /^[a-z]{2}-[a-z]+-\d+[a-z]$/;
    if (!azRegex.test(az)) {
        throw new Error(`Invalid availability zone format: ${az}. Expected format: us-east-1a`);
    }
};
const validateRegion = (region) => {
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
}
catch (error) {
    console.error('❌ Configuration validation failed:');
    console.error(error.message);
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
new ec2_host_failover_stack_1.EC2HostFailoverStack(app, 'EC2HostFailoverStack', {
    // Configuration parameters from environment variables
    alertEmail: alertEmail,
    availabilityZone: availabilityZone,
    instanceType: 'c5.large', // Keep hardcoded as requested
    // Optional: Add specific host IDs to monitor
    // dedicatedHostIds: ['h-1234567890abcdef0', 'h-0fedcba0987654321'],
    // CDK environment
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: region // Use environment variable
    },
    description: 'EC2 Dedicated Host Failover Solution with Step Functions',
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiMjAyNTA2LWRoLWZhaWxvdmVyLXN0ZXBmdW5jdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIjIwMjUwNi1kaC1mYWlsb3Zlci1zdGVwZnVuY3Rpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFDQSx1Q0FBcUM7QUFDckMsaURBQW1DO0FBQ25DLDRFQUFzRTtBQUV0RSwrREFBK0Q7QUFDL0QsTUFBTSxpQkFBaUIsR0FBRyxDQUFDLElBQVksRUFBRSxZQUFxQixFQUFVLEVBQUU7SUFDeEUsTUFBTSxLQUFLLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxZQUFZLENBQUM7SUFDaEQsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQ1gsTUFBTSxJQUFJLEtBQUssQ0FBQyx3QkFBd0IsSUFBSSwwQkFBMEIsQ0FBQyxDQUFDO0lBQzFFLENBQUM7SUFDRCxPQUFPLEtBQUssQ0FBQztBQUNmLENBQUMsQ0FBQztBQUVGLDJDQUEyQztBQUMzQyxNQUFNLFVBQVUsR0FBRyxpQkFBaUIsQ0FBQyxhQUFhLENBQUMsQ0FBQztBQUNwRCxNQUFNLGdCQUFnQixHQUFHLGlCQUFpQixDQUFDLG1CQUFtQixDQUFDLENBQUM7QUFDaEUsTUFBTSxNQUFNLEdBQUcsaUJBQWlCLENBQUMsWUFBWSxDQUFDLENBQUM7QUFFL0MsdUJBQXVCO0FBQ3ZCLE1BQU0sYUFBYSxHQUFHLENBQUMsS0FBYSxFQUFRLEVBQUU7SUFDNUMsTUFBTSxVQUFVLEdBQUcsNEJBQTRCLENBQUM7SUFDaEQsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQztRQUM1QixNQUFNLElBQUksS0FBSyxDQUFDLHlCQUF5QixLQUFLLEVBQUUsQ0FBQyxDQUFDO0lBQ3BELENBQUM7QUFDSCxDQUFDLENBQUM7QUFFRixNQUFNLHdCQUF3QixHQUFHLENBQUMsRUFBVSxFQUFRLEVBQUU7SUFD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L3Vzci9iaW4vZW52IG5vZGVcbmltcG9ydCAnc291cmNlLW1hcC1zdXBwb3J0L3JlZ2lzdGVyJztcbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBFQzJIb3N0RmFpbG92ZXJTdGFjayB9IGZyb20gJy4uL2xpYi9lYzItaG9zdC1mYWlsb3Zlci1zdGFjayc7XG5cbi8vIEdldCBjb25maWd1cmF0aW9uIGZyb20gZW52aXJvbm1lbnQgdmFyaWFibGVzIHdpdGggdmFsaWRhdGlvblxuY29uc3QgZ2V0UmVxdWlyZWRFbnZWYXIgPSAobmFtZTogc3RyaW5nLCBkZWZhdWx0VmFsdWU/OiBzdHJpbmcpOiBzdHJpbmcgPT4ge1xuICBjb25zdCB2YWx1ZSA9IHByb2Nlc3MuZW52W25hbWVdIHx8IGRlZmF1bHRWYWx1ZTtcbiAgaWYgKCF2YWx1ZSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgRW52aXJvbm1lbnQgdmFyaWFibGUgJHtuYW1lfSBpcyByZXF1aXJlZCBidXQgbm90IHNldGApO1xuICB9XG4gIHJldHVybiB2YWx1ZTtcbn07XG5cbi8vIENvbmZpZ3VyYXRpb24gZnJvbSBlbnZpcm9ubWVudCB2YXJpYWJsZXNcbmNvbnN0IGFsZXJ0RW1haWwgPSBnZXRSZXF1aXJlZEVudlZhcignQUxFUlRfRU1BSUwnKTtcbmNvbnN0IGF2YWlsYWJpbGl0eVpvbmUgPSBnZXRSZXF1aXJlZEVudlZhcignQVZBSUxBQklMSVRZX1pPTkUnKTtcbmNvbnN0IHJlZ2lvbiA9IGdldFJlcXVpcmVkRW52VmFyKCdBV1NfUkVHSU9OJyk7XG5cbi8vIFZhbGlkYXRpb24gZnVuY3Rpb25zXG5jb25zdCB2YWxpZGF0ZUVtYWlsID0gKGVtYWlsOiBzdHJpbmcpOiB2b2lkID0+IHtcbiAgY29uc3QgZW1haWxSZWdleCA9IC9eW15cXHNAXStAW15cXHNAXStcXC5bXlxcc0BdKyQvO1xuICBpZiAoIWVtYWlsUmVnZXgudGVzdChlbWFpbCkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgZW1haWwgZm9ybWF0OiAke2VtYWlsfWApO1xuICB9XG59O1xuXG5jb25zdCB2YWxpZGF0ZUF2YWlsYWJpbGl0eVpvbmUgPSAoYXo6IHN0cmluZyk6IHZvaWQgPT4ge1xuICBjb25zdCBhelJlZ2V4ID0gL15bYS16XXsyfS1bYS16XSstXFxkK1thLXpdJC87XG4gIGlmICghYXpSZWdleC50ZXN0KGF6KSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBhdmFpbGFiaWxpdHkgem9uZSBmb3JtYXQ6ICR7YXp9LiBFeHBlY3RlZCBmb3JtYXQ6IHVzLWVhc3QtMWFgKTtcbiAgfVxufTtcblxuY29uc3QgdmFsaWRhdGVSZWdpb24gPSAocmVnaW9uOiBzdHJpbmcpOiB2b2lkID0+IHtcbiAgY29uc3QgcmVnaW9uUmVnZXggPSAvXlthLXpdezJ9LVthLXpdKy1cXGQrJC87XG4gIGlmICghcmVnaW9uUmVnZXgudGVzdChyZWdpb24pKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIHJlZ2lvbiBmb3JtYXQ6ICR7cmVnaW9ufS4gRXhwZWN0ZWQgZm9ybWF0OiB1cy1lYXN0LTFgKTtcbiAgfVxufTtcblxuLy8gVmFsaWRhdGUgY29uZmlndXJhdGlvblxudHJ5IHtcbiAgdmFsaWRhdGVFbWFpbChhbGVydEVtYWlsKTtcbiAgdmFsaWRhdGVBdmFpbGFiaWxpdHlab25lKGF2YWlsYWJpbGl0eVpvbmUpO1xuICB2YWxpZGF0ZVJlZ2lvbihyZWdpb24pO1xuICBcbiAgLy8gVmFsaWRhdGUgdGhhdCBhdmFpbGFiaWxpdHkgem9uZSBtYXRjaGVzIHJlZ2lvblxuICBpZiAoIWF2YWlsYWJpbGl0eVpvbmUuc3RhcnRzV2l0aChyZWdpb24pKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBBdmFpbGFiaWxpdHkgem9uZSAke2F2YWlsYWJpbGl0eVpvbmV9IGRvZXMgbm90IG1hdGNoIHJlZ2lvbiAke3JlZ2lvbn1gKTtcbiAgfVxuICBcbiAgY29uc29sZS5sb2coJ+KchSBDb25maWd1cmF0aW9uIHZhbGlkYXRpb24gcGFzc2VkJyk7XG4gIGNvbnNvbGUubG9nKGDwn5OnIEFsZXJ0IEVtYWlsOiAke2FsZXJ0RW1haWx9YCk7XG4gIGNvbnNvbGUubG9nKGDwn4yNIFJlZ2lvbjogJHtyZWdpb259YCk7XG4gIGNvbnNvbGUubG9nKGDwn5ONIEF2YWlsYWJpbGl0eSBab25lOiAke2F2YWlsYWJpbGl0eVpvbmV9YCk7XG4gIFxufSBjYXRjaCAoZXJyb3IpIHtcbiAgY29uc29sZS5lcnJvcign4p2MIENvbmZpZ3VyYXRpb24gdmFsaWRhdGlvbiBmYWlsZWQ6Jyk7XG4gIGNvbnNvbGUuZXJyb3IoKGVycm9yIGFzIEVycm9yKS5tZXNzYWdlKTtcbiAgY29uc29sZS5lcnJvcignXFxu8J+TiyBSZXF1aXJlZCBlbnZpcm9ubWVudCB2YXJpYWJsZXM6Jyk7XG4gIGNvbnNvbGUuZXJyb3IoJyAgQUxFUlRfRU1BSUwgLSBFbWFpbCBhZGRyZXNzIGZvciBub3RpZmljYXRpb25zIChlLmcuLCBhZG1pbkBjb21wYW55LmNvbSknKTtcbiAgY29uc29sZS5lcnJvcignICBBVkFJTEFCSUxJVFlfWk9ORSAtIFRhcmdldCBhdmFpbGFiaWxpdHkgem9uZSAoZS5nLiwgYXAtbm9ydGhlYXN0LTFhKScpO1xuICBjb25zb2xlLmVycm9yKCcgIEFXU19SRUdJT04gLSBBV1MgcmVnaW9uIChlLmcuLCBhcC1ub3J0aGVhc3QtMSknKTtcbiAgY29uc29sZS5lcnJvcignXFxu8J+SoSBFeGFtcGxlIHVzYWdlOicpO1xuICBjb25zb2xlLmVycm9yKCcgIGV4cG9ydCBBTEVSVF9FTUFJTD1cImFkbWluQGNvbXBhbnkuY29tXCInKTtcbiAgY29uc29sZS5lcnJvcignICBleHBvcnQgQVZBSUxBQklMSVRZX1pPTkU9XCJhcC1ub3J0aGVhc3QtMWFcIicpO1xuICBjb25zb2xlLmVycm9yKCcgIGV4cG9ydCBBV1NfUkVHSU9OPVwiYXAtbm9ydGhlYXN0LTFcIicpO1xuICBjb25zb2xlLmVycm9yKCcgIGNkayBkZXBsb3knKTtcbiAgcHJvY2Vzcy5leGl0KDEpO1xufVxuXG5jb25zdCBhcHAgPSBuZXcgY2RrLkFwcCgpO1xubmV3IEVDMkhvc3RGYWlsb3ZlclN0YWNrKGFwcCwgJ0VDMkhvc3RGYWlsb3ZlclN0YWNrJywge1xuICAvLyBDb25maWd1cmF0aW9uIHBhcmFtZXRlcnMgZnJvbSBlbnZpcm9ubWVudCB2YXJpYWJsZXNcbiAgYWxlcnRFbWFpbDogYWxlcnRFbWFpbCxcbiAgYXZhaWxhYmlsaXR5Wm9uZTogYXZhaWxhYmlsaXR5Wm9uZSxcbiAgaW5zdGFuY2VUeXBlOiAnYzUubGFyZ2UnLCAgICAgICAgICAgICAvLyBLZWVwIGhhcmRjb2RlZCBhcyByZXF1ZXN0ZWRcbiAgXG4gIC8vIE9wdGlvbmFsOiBBZGQgc3BlY2lmaWMgaG9zdCBJRHMgdG8gbW9uaXRvclxuICAvLyBkZWRpY2F0ZWRIb3N0SWRzOiBbJ2gtMTIzNDU2Nzg5MGFiY2RlZjAnLCAnaC0wZmVkY2JhMDk4NzY1NDMyMSddLFxuICBcbiAgLy8gQ0RLIGVudmlyb25tZW50XG4gIGVudjogeyBcbiAgICBhY2NvdW50OiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9BQ0NPVU5ULCBcbiAgICByZWdpb246IHJlZ2lvbiAgLy8gVXNlIGVudmlyb25tZW50IHZhcmlhYmxlXG4gIH0sXG4gIGRlc2NyaXB0aW9uOiAnRUMyIERlZGljYXRlZCBIb3N0IEZhaWxvdmVyIFNvbHV0aW9uIHdpdGggU3RlcCBGdW5jdGlvbnMnLFxufSk7XG4iXX0=