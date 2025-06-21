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
    alertEmail: 'hyundonk@amazon.com', // Replace with your email address
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiMjAyNTA2LWRoLWZhaWxvdmVyLXN0ZXBmdW5jdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIjIwMjUwNi1kaC1mYWlsb3Zlci1zdGVwZnVuY3Rpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFDQSx1Q0FBcUM7QUFDckMsaURBQW1DO0FBQ25DLDRFQUFzRTtBQUV0RSxNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUMxQixJQUFJLDhDQUFvQixDQUFDLEdBQUcsRUFBRSxzQkFBc0IsRUFBRTtJQUNwRCwyQkFBMkI7SUFDM0IsVUFBVSxFQUFFLHFCQUFxQixFQUFFLGtDQUFrQztJQUNyRSxnQkFBZ0IsRUFBRSxpQkFBaUI7SUFDbkMsWUFBWSxFQUFFLFVBQVUsRUFBYyxrQ0FBa0M7SUFFeEUsNkNBQTZDO0lBQzdDLG9FQUFvRTtJQUVwRSxrQkFBa0I7SUFDbEIsR0FBRyxFQUFFO1FBQ0gsT0FBTyxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW1CO1FBQ3hDLE1BQU0sRUFBRSxnQkFBZ0I7S0FDekI7SUFDRCxXQUFXLEVBQUUsMERBQTBEO0NBQ3hFLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIiMhL3Vzci9iaW4vZW52IG5vZGVcbmltcG9ydCAnc291cmNlLW1hcC1zdXBwb3J0L3JlZ2lzdGVyJztcbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBFQzJIb3N0RmFpbG92ZXJTdGFjayB9IGZyb20gJy4uL2xpYi9lYzItaG9zdC1mYWlsb3Zlci1zdGFjayc7XG5cbmNvbnN0IGFwcCA9IG5ldyBjZGsuQXBwKCk7XG5uZXcgRUMySG9zdEZhaWxvdmVyU3RhY2soYXBwLCAnRUMySG9zdEZhaWxvdmVyU3RhY2snLCB7XG4gIC8vIENvbmZpZ3VyYXRpb24gcGFyYW1ldGVyc1xuICBhbGVydEVtYWlsOiAnaHl1bmRvbmtAYW1hem9uLmNvbScsIC8vIFJlcGxhY2Ugd2l0aCB5b3VyIGVtYWlsIGFkZHJlc3NcbiAgYXZhaWxhYmlsaXR5Wm9uZTogJ2FwLW5vcnRoZWFzdC0xYScsICAgIFxuICBpbnN0YW5jZVR5cGU6ICdjNS5sYXJnZScsICAgICAgICAgICAgIC8vIFJlcGxhY2Ugd2l0aCB5b3VyIGluc3RhbmNlIHR5cGVcbiAgXG4gIC8vIE9wdGlvbmFsOiBBZGQgc3BlY2lmaWMgaG9zdCBJRHMgdG8gbW9uaXRvclxuICAvLyBkZWRpY2F0ZWRIb3N0SWRzOiBbJ2gtMTIzNDU2Nzg5MGFiY2RlZjAnLCAnaC0wZmVkY2JhMDk4NzY1NDMyMSddLFxuICBcbiAgLy8gQ0RLIGVudmlyb25tZW50XG4gIGVudjogeyBcbiAgICBhY2NvdW50OiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9BQ0NPVU5ULCBcbiAgICByZWdpb246ICdhcC1ub3J0aGVhc3QtMScgXG4gIH0sXG4gIGRlc2NyaXB0aW9uOiAnRUMyIERlZGljYXRlZCBIb3N0IEZhaWxvdmVyIFNvbHV0aW9uIHdpdGggU3RlcCBGdW5jdGlvbnMnLFxufSk7XG4iXX0=