import * as fs from 'fs';
import * as path from 'path';

describe('Step Function Definition', () => {
  let stepFunctionDefinition: any;
  
  beforeAll(() => {
    const definitionPath = path.join(__dirname, '../lib/step-functions/migration-workflow.json');
    const definitionContent = fs.readFileSync(definitionPath, 'utf8');
    stepFunctionDefinition = JSON.parse(definitionContent);
  });
  
  it('should have ExtractCurrentInstanceId state that initializes forceStop to false', () => {
    const extractState = stepFunctionDefinition.States.ExtractCurrentInstanceId;
    
    expect(extractState).toBeDefined();
    expect(extractState.Type).toBe('Pass');
    expect(extractState.Parameters.forceStop).toBe(false);
  });
  
  it('should have StopInstance state that accepts force parameter', () => {
    const stopState = stepFunctionDefinition.States.StopInstance;
    
    expect(stopState).toBeDefined();
    expect(stopState.Type).toBe('Task');
    expect(stopState.Parameters.Payload['force.$']).toBe('$.currentInstance.forceStop');
  });
  
  it('should have InitializeStopCounter state after StopInstance', () => {
    const stopState = stepFunctionDefinition.States.StopInstance;
    const initCounterState = stepFunctionDefinition.States.InitializeStopCounter;
    
    expect(stopState.Next).toBe('InitializeStopCounter');
    expect(initCounterState).toBeDefined();
    expect(initCounterState.Type).toBe('Pass');
    expect(initCounterState.Parameters.stopCheckCounter).toBe(0);
  });
  
  it('should have IncrementStopCounter state as default from IsInstanceStopped', () => {
    const isStoppedState = stepFunctionDefinition.States.IsInstanceStopped;
    
    expect(isStoppedState).toBeDefined();
    expect(isStoppedState.Default).toBe('IncrementStopCounter');
  });
  
  it('should have CheckStopRetryCount state that checks for 4 attempts', () => {
    const checkCountState = stepFunctionDefinition.States.CheckStopRetryCount;
    
    expect(checkCountState).toBeDefined();
    expect(checkCountState.Type).toBe('Choice');
    expect(checkCountState.Choices[0].Variable).toBe('$.stopCheckCounter');
    expect(checkCountState.Choices[0].NumericEquals).toBe(4);
    expect(checkCountState.Choices[0].Next).toBe('PrepareForceStop');
    expect(checkCountState.Default).toBe('WaitForInstanceToStop');
  });
  
  it('should have PrepareForceStop state that sets forceStop to true', () => {
    const prepareForceState = stepFunctionDefinition.States.PrepareForceStop;
    
    expect(prepareForceState).toBeDefined();
    expect(prepareForceState.Type).toBe('Pass');
    expect(prepareForceState.Parameters.forceStop).toBe(true);
    expect(prepareForceState.Next).toBe('StopInstance');
  });
});