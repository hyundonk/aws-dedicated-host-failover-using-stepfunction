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
const AWS = __importStar(require("aws-sdk"));
const stop_instance_1 = require("../lib/lambda/stop-instance");
// Mock AWS SDK
jest.mock('aws-sdk', () => {
    const mockPromise = jest.fn().mockResolvedValue({});
    const mockStopInstances = jest.fn().mockReturnValue({
        promise: mockPromise
    });
    return {
        EC2: jest.fn(() => ({
            stopInstances: mockStopInstances
        }))
    };
});
describe('stop-instance Lambda function', () => {
    let mockEC2;
    let mockStopInstances;
    let mockPromise;
    beforeEach(() => {
        jest.clearAllMocks();
        mockEC2 = new AWS.EC2();
        mockStopInstances = mockEC2.stopInstances;
        mockPromise = mockStopInstances().promise;
    });
    it('should stop an instance without force option by default', async () => {
        const event = {
            instanceId: 'i-12345',
            reservedHostId: 'h-12345'
        };
        await (0, stop_instance_1.handler)(event);
        expect(mockStopInstances).toHaveBeenCalledWith({
            InstanceIds: ['i-12345'],
            Force: false
        });
    });
    it('should stop an instance with force option when specified', async () => {
        const event = {
            instanceId: 'i-12345',
            reservedHostId: 'h-12345',
            force: true
        };
        await (0, stop_instance_1.handler)(event);
        expect(mockStopInstances).toHaveBeenCalledWith({
            InstanceIds: ['i-12345'],
            Force: true
        });
    });
    it('should throw an error for invalid instance ID', async () => {
        // Using type assertion to bypass TypeScript check for test purposes
        // This is intentional as we're testing the runtime validation
        const event = {
            instanceId: null,
            reservedHostId: 'h-12345'
        };
        await expect((0, stop_instance_1.handler)(event)).rejects.toThrow('InstanceStopError');
        expect(mockStopInstances).not.toHaveBeenCalled();
    });
    it('should throw an error when AWS API call fails', async () => {
        const event = {
            instanceId: 'i-12345',
            reservedHostId: 'h-12345'
        };
        mockPromise.mockRejectedValueOnce(new Error('AWS API Error'));
        await expect((0, stop_instance_1.handler)(event)).rejects.toThrow('InstanceStopError');
        expect(mockStopInstances).toHaveBeenCalled();
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RvcC1pbnN0YW5jZS50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic3RvcC1pbnN0YW5jZS50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSw2Q0FBK0I7QUFDL0IsK0RBQXNEO0FBRXRELGVBQWU7QUFDZixJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxHQUFHLEVBQUU7SUFDeEIsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLEVBQUUsRUFBRSxDQUFDLGlCQUFpQixDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQ3BELE1BQU0saUJBQWlCLEdBQUcsSUFBSSxDQUFDLEVBQUUsRUFBRSxDQUFDLGVBQWUsQ0FBQztRQUNsRCxPQUFPLEVBQUUsV0FBVztLQUNyQixDQUFDLENBQUM7SUFFSCxPQUFPO1FBQ0wsR0FBRyxFQUFFLElBQUksQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQztZQUNsQixhQUFhLEVBQUUsaUJBQWlCO1NBQ2pDLENBQUMsQ0FBQztLQUNKLENBQUM7QUFDSixDQUFDLENBQUMsQ0FBQztBQUVILFFBQVEsQ0FBQywrQkFBK0IsRUFBRSxHQUFHLEVBQUU7SUFDN0MsSUFBSSxPQUFZLENBQUM7SUFDakIsSUFBSSxpQkFBNEIsQ0FBQztJQUNqQyxJQUFJLFdBQXNCLENBQUM7SUFFM0IsVUFBVSxDQUFDLEdBQUcsRUFBRTtRQUNkLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztRQUNyQixPQUFPLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7UUFDeEIsaUJBQWlCLEdBQUcsT0FBTyxDQUFDLGFBQTBCLENBQUM7UUFDdkQsV0FBVyxHQUFHLGlCQUFpQixFQUFFLENBQUMsT0FBb0IsQ0FBQztJQUN6RCxDQUFDLENBQUMsQ0FBQztJQUVILEVBQUUsQ0FBQyx5REFBeUQsRUFBRSxLQUFLLElBQUksRUFBRTtRQUN2RSxNQUFNLEtBQUssR0FBRztZQUNaLFVBQVUsRUFBRSxTQUFTO1lBQ3JCLGNBQWMsRUFBRSxTQUFTO1NBQzFCLENBQUM7UUFFRixNQUFNLElBQUEsdUJBQU8sRUFBQyxLQUFLLENBQUMsQ0FBQztRQUVyQixNQUFNLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxvQkFBb0IsQ0FBQztZQUM3QyxXQUFXLEVBQUUsQ0FBQyxTQUFTLENBQUM7WUFDeEIsS0FBSyxFQUFFLEtBQUs7U0FDYixDQUFDLENBQUM7SUFDTCxDQUFDLENBQUMsQ0FBQztJQUVILEVBQUUsQ0FBQywwREFBMEQsRUFBRSxLQUFLLElBQUksRUFBRTtRQUN4RSxNQUFNLEtBQUssR0FBRztZQUNaLFVBQVUsRUFBRSxTQUFTO1lBQ3JCLGNBQWMsRUFBRSxTQUFTO1lBQ3pCLEtBQUssRUFBRSxJQUFJO1NBQ1osQ0FBQztRQUVGLE1BQU0sSUFBQSx1QkFBTyxFQUFDLEtBQUssQ0FBQyxDQUFDO1FBRXJCLE1BQU0sQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLG9CQUFvQixDQUFDO1lBQzdDLFdBQVcsRUFBRSxDQUFDLFNBQVMsQ0FBQztZQUN4QixLQUFLLEVBQUUsSUFBSTtTQUNaLENBQUMsQ0FBQztJQUNMLENBQUMsQ0FBQyxDQUFDO0lBRUgsRUFBRSxDQUFDLCtDQUErQyxFQUFFLEtBQUssSUFBSSxFQUFFO1FBQzdELG9FQUFvRTtRQUNwRSw4REFBOEQ7UUFDOUQsTUFBTSxLQUFLLEdBQUc7WUFDWixVQUFVLEVBQUUsSUFBeUI7WUFDckMsY0FBYyxFQUFFLFNBQVM7U0FDMUIsQ0FBQztRQUVGLE1BQU0sTUFBTSxDQUFDLElBQUEsdUJBQU8sRUFBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsbUJBQW1CLENBQUMsQ0FBQztRQUNsRSxNQUFNLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztJQUNuRCxDQUFDLENBQUMsQ0FBQztJQUVILEVBQUUsQ0FBQywrQ0FBK0MsRUFBRSxLQUFLLElBQUksRUFBRTtRQUM3RCxNQUFNLEtBQUssR0FBRztZQUNaLFVBQVUsRUFBRSxTQUFTO1lBQ3JCLGNBQWMsRUFBRSxTQUFTO1NBQzFCLENBQUM7UUFFRixXQUFXLENBQUMscUJBQXFCLENBQUMsSUFBSSxLQUFLLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQztRQUU5RCxNQUFNLE1BQU0sQ0FBQyxJQUFBLHVCQUFPLEVBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLG1CQUFtQixDQUFDLENBQUM7UUFDbEUsTUFBTSxDQUFDLGlCQUFpQixDQUFDLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztJQUMvQyxDQUFDLENBQUMsQ0FBQztBQUNMLENBQUMsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgQVdTIGZyb20gJ2F3cy1zZGsnO1xuaW1wb3J0IHsgaGFuZGxlciB9IGZyb20gJy4uL2xpYi9sYW1iZGEvc3RvcC1pbnN0YW5jZSc7XG5cbi8vIE1vY2sgQVdTIFNES1xuamVzdC5tb2NrKCdhd3Mtc2RrJywgKCkgPT4ge1xuICBjb25zdCBtb2NrUHJvbWlzZSA9IGplc3QuZm4oKS5tb2NrUmVzb2x2ZWRWYWx1ZSh7fSk7XG4gIGNvbnN0IG1vY2tTdG9wSW5zdGFuY2VzID0gamVzdC5mbigpLm1vY2tSZXR1cm5WYWx1ZSh7XG4gICAgcHJvbWlzZTogbW9ja1Byb21pc2VcbiAgfSk7XG4gIFxuICByZXR1cm4ge1xuICAgIEVDMjogamVzdC5mbigoKSA9PiAoe1xuICAgICAgc3RvcEluc3RhbmNlczogbW9ja1N0b3BJbnN0YW5jZXNcbiAgICB9KSlcbiAgfTtcbn0pO1xuXG5kZXNjcmliZSgnc3RvcC1pbnN0YW5jZSBMYW1iZGEgZnVuY3Rpb24nLCAoKSA9PiB7XG4gIGxldCBtb2NrRUMyOiBhbnk7XG4gIGxldCBtb2NrU3RvcEluc3RhbmNlczogamVzdC5Nb2NrO1xuICBsZXQgbW9ja1Byb21pc2U6IGplc3QuTW9jaztcbiAgXG4gIGJlZm9yZUVhY2goKCkgPT4ge1xuICAgIGplc3QuY2xlYXJBbGxNb2NrcygpO1xuICAgIG1vY2tFQzIgPSBuZXcgQVdTLkVDMigpO1xuICAgIG1vY2tTdG9wSW5zdGFuY2VzID0gbW9ja0VDMi5zdG9wSW5zdGFuY2VzIGFzIGplc3QuTW9jaztcbiAgICBtb2NrUHJvbWlzZSA9IG1vY2tTdG9wSW5zdGFuY2VzKCkucHJvbWlzZSBhcyBqZXN0Lk1vY2s7XG4gIH0pO1xuICBcbiAgaXQoJ3Nob3VsZCBzdG9wIGFuIGluc3RhbmNlIHdpdGhvdXQgZm9yY2Ugb3B0aW9uIGJ5IGRlZmF1bHQnLCBhc3luYyAoKSA9PiB7XG4gICAgY29uc3QgZXZlbnQgPSB7XG4gICAgICBpbnN0YW5jZUlkOiAnaS0xMjM0NScsXG4gICAgICByZXNlcnZlZEhvc3RJZDogJ2gtMTIzNDUnXG4gICAgfTtcbiAgICBcbiAgICBhd2FpdCBoYW5kbGVyKGV2ZW50KTtcbiAgICBcbiAgICBleHBlY3QobW9ja1N0b3BJbnN0YW5jZXMpLnRvSGF2ZUJlZW5DYWxsZWRXaXRoKHtcbiAgICAgIEluc3RhbmNlSWRzOiBbJ2ktMTIzNDUnXSxcbiAgICAgIEZvcmNlOiBmYWxzZVxuICAgIH0pO1xuICB9KTtcbiAgXG4gIGl0KCdzaG91bGQgc3RvcCBhbiBpbnN0YW5jZSB3aXRoIGZvcmNlIG9wdGlvbiB3aGVuIHNwZWNpZmllZCcsIGFzeW5jICgpID0+IHtcbiAgICBjb25zdCBldmVudCA9IHtcbiAgICAgIGluc3RhbmNlSWQ6ICdpLTEyMzQ1JyxcbiAgICAgIHJlc2VydmVkSG9zdElkOiAnaC0xMjM0NScsXG4gICAgICBmb3JjZTogdHJ1ZVxuICAgIH07XG4gICAgXG4gICAgYXdhaXQgaGFuZGxlcihldmVudCk7XG4gICAgXG4gICAgZXhwZWN0KG1vY2tTdG9wSW5zdGFuY2VzKS50b0hhdmVCZWVuQ2FsbGVkV2l0aCh7XG4gICAgICBJbnN0YW5jZUlkczogWydpLTEyMzQ1J10sXG4gICAgICBGb3JjZTogdHJ1ZVxuICAgIH0pO1xuICB9KTtcbiAgXG4gIGl0KCdzaG91bGQgdGhyb3cgYW4gZXJyb3IgZm9yIGludmFsaWQgaW5zdGFuY2UgSUQnLCBhc3luYyAoKSA9PiB7XG4gICAgLy8gVXNpbmcgdHlwZSBhc3NlcnRpb24gdG8gYnlwYXNzIFR5cGVTY3JpcHQgY2hlY2sgZm9yIHRlc3QgcHVycG9zZXNcbiAgICAvLyBUaGlzIGlzIGludGVudGlvbmFsIGFzIHdlJ3JlIHRlc3RpbmcgdGhlIHJ1bnRpbWUgdmFsaWRhdGlvblxuICAgIGNvbnN0IGV2ZW50ID0ge1xuICAgICAgaW5zdGFuY2VJZDogbnVsbCBhcyB1bmtub3duIGFzIHN0cmluZyxcbiAgICAgIHJlc2VydmVkSG9zdElkOiAnaC0xMjM0NSdcbiAgICB9O1xuICAgIFxuICAgIGF3YWl0IGV4cGVjdChoYW5kbGVyKGV2ZW50KSkucmVqZWN0cy50b1Rocm93KCdJbnN0YW5jZVN0b3BFcnJvcicpO1xuICAgIGV4cGVjdChtb2NrU3RvcEluc3RhbmNlcykubm90LnRvSGF2ZUJlZW5DYWxsZWQoKTtcbiAgfSk7XG4gIFxuICBpdCgnc2hvdWxkIHRocm93IGFuIGVycm9yIHdoZW4gQVdTIEFQSSBjYWxsIGZhaWxzJywgYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IGV2ZW50ID0ge1xuICAgICAgaW5zdGFuY2VJZDogJ2ktMTIzNDUnLFxuICAgICAgcmVzZXJ2ZWRIb3N0SWQ6ICdoLTEyMzQ1J1xuICAgIH07XG4gICAgXG4gICAgbW9ja1Byb21pc2UubW9ja1JlamVjdGVkVmFsdWVPbmNlKG5ldyBFcnJvcignQVdTIEFQSSBFcnJvcicpKTtcbiAgICBcbiAgICBhd2FpdCBleHBlY3QoaGFuZGxlcihldmVudCkpLnJlamVjdHMudG9UaHJvdygnSW5zdGFuY2VTdG9wRXJyb3InKTtcbiAgICBleHBlY3QobW9ja1N0b3BJbnN0YW5jZXMpLnRvSGF2ZUJlZW5DYWxsZWQoKTtcbiAgfSk7XG59KTsiXX0=