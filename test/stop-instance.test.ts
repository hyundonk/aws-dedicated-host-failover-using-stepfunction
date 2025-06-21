import * as AWS from 'aws-sdk';
import { handler } from '../lib/lambda/stop-instance';

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
  let mockEC2: any;
  let mockStopInstances: jest.Mock;
  let mockPromise: jest.Mock;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockEC2 = new AWS.EC2();
    mockStopInstances = mockEC2.stopInstances as jest.Mock;
    mockPromise = mockStopInstances().promise as jest.Mock;
  });
  
  it('should stop an instance without force option by default', async () => {
    const event = {
      instanceId: 'i-12345',
      reservedHostId: 'h-12345'
    };
    
    await handler(event);
    
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
    
    await handler(event);
    
    expect(mockStopInstances).toHaveBeenCalledWith({
      InstanceIds: ['i-12345'],
      Force: true
    });
  });
  
  it('should throw an error for invalid instance ID', async () => {
    // Using type assertion to bypass TypeScript check for test purposes
    // This is intentional as we're testing the runtime validation
    const event = {
      instanceId: null as unknown as string,
      reservedHostId: 'h-12345'
    };
    
    await expect(handler(event)).rejects.toThrow('InstanceStopError');
    expect(mockStopInstances).not.toHaveBeenCalled();
  });
  
  it('should throw an error when AWS API call fails', async () => {
    const event = {
      instanceId: 'i-12345',
      reservedHostId: 'h-12345'
    };
    
    mockPromise.mockRejectedValueOnce(new Error('AWS API Error'));
    
    await expect(handler(event)).rejects.toThrow('InstanceStopError');
    expect(mockStopInstances).toHaveBeenCalled();
  });
});