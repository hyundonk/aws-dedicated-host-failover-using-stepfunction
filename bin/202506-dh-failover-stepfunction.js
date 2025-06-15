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
const app = new cdk.App();
new ec2_host_failover_stack_1.EC2HostFailoverStack(app, 'EC2HostFailoverStack', {
    // Configuration parameters
    alertEmail: 'hyundonk@amazon.com',
    availabilityZone: 'ap-northeast-1a',
    instanceType: 'c5.large', // Replace with your instance type
    // Optional: Add specific host IDs to monitor
    // dedicatedHostIds: ['h-1234567890abcdef0', 'h-0fedcba0987654321'],
    // CDK environment
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: 'ap-northeast-1'
    },
    description: 'EC2 Dedicated Host Failover Solution with Step Functions',
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiMjAyNTA2LWRoLWZhaWxvdmVyLXN0ZXBmdW5jdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIjIwMjUwNi1kaC1mYWlsb3Zlci1zdGVwZnVuY3Rpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFDQSx1Q0FBcUM7QUFDckMsaURBQW1DO0FBQ25DLDRFQUFzRTtBQUV0RSxNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUMxQixJQUFJLDhDQUFvQixDQUFDLEdBQUcsRUFBRSxzQkFBc0IsRUFBRTtJQUNwRCwyQkFBMkI7SUFDM0IsVUFBVSxFQUFFLHFCQUFxQjtJQUNqQyxnQkFBZ0IsRUFBRSxpQkFBaUI7SUFDbkMsWUFBWSxFQUFFLFVBQVUsRUFBYyxrQ0FBa0M7SUFFeEUsNkNBQTZDO0lBQzdDLG9FQUFvRTtJQUVwRSxrQkFBa0I7SUFDbEIsR0FBRyxFQUFFO1FBQ0gsT0FBTyxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW1CO1FBQ3hDLE1BQU0sRUFBRSxnQkFBZ0I7S0FDekI7SUFDRCxXQUFXLEVBQUUsMERBQTBEO0NBQ3hFLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIiMhL3Vzci9iaW4vZW52IG5vZGVcbmltcG9ydCAnc291cmNlLW1hcC1zdXBwb3J0L3JlZ2lzdGVyJztcbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBFQzJIb3N0RmFpbG92ZXJTdGFjayB9IGZyb20gJy4uL2xpYi9lYzItaG9zdC1mYWlsb3Zlci1zdGFjayc7XG5cbmNvbnN0IGFwcCA9IG5ldyBjZGsuQXBwKCk7XG5uZXcgRUMySG9zdEZhaWxvdmVyU3RhY2soYXBwLCAnRUMySG9zdEZhaWxvdmVyU3RhY2snLCB7XG4gIC8vIENvbmZpZ3VyYXRpb24gcGFyYW1ldGVyc1xuICBhbGVydEVtYWlsOiAnaHl1bmRvbmtAYW1hem9uLmNvbScsIFxuICBhdmFpbGFiaWxpdHlab25lOiAnYXAtbm9ydGhlYXN0LTFhJywgICAgXG4gIGluc3RhbmNlVHlwZTogJ2M1LmxhcmdlJywgICAgICAgICAgICAgLy8gUmVwbGFjZSB3aXRoIHlvdXIgaW5zdGFuY2UgdHlwZVxuICBcbiAgLy8gT3B0aW9uYWw6IEFkZCBzcGVjaWZpYyBob3N0IElEcyB0byBtb25pdG9yXG4gIC8vIGRlZGljYXRlZEhvc3RJZHM6IFsnaC0xMjM0NTY3ODkwYWJjZGVmMCcsICdoLTBmZWRjYmEwOTg3NjU0MzIxJ10sXG4gIFxuICAvLyBDREsgZW52aXJvbm1lbnRcbiAgZW52OiB7IFxuICAgIGFjY291bnQ6IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX0FDQ09VTlQsIFxuICAgIHJlZ2lvbjogJ2FwLW5vcnRoZWFzdC0xJyBcbiAgfSxcbiAgZGVzY3JpcHRpb246ICdFQzIgRGVkaWNhdGVkIEhvc3QgRmFpbG92ZXIgU29sdXRpb24gd2l0aCBTdGVwIEZ1bmN0aW9ucycsXG59KTtcbiJdfQ==