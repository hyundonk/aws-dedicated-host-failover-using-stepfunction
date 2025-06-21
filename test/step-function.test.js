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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
describe('Step Function Definition', () => {
    let stepFunctionDefinition;
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
        expect(initCounterState.ResultPath).toBe('$');
    });
    it('should have IncrementStopCounter state as default from IsInstanceStopped', () => {
        const isStoppedState = stepFunctionDefinition.States.IsInstanceStopped;
        expect(isStoppedState).toBeDefined();
        expect(isStoppedState.Default).toBe('IncrementStopCounter');
    });
    it('should have IncrementStopCounter state that properly increments the counter', () => {
        const incrementState = stepFunctionDefinition.States.IncrementStopCounter;
        expect(incrementState).toBeDefined();
        expect(incrementState.Type).toBe('Pass');
        expect(incrementState.Parameters['stopCheckCounter.$']).toBe('States.MathAdd($.stopCheckCounter, 1)');
        expect(incrementState.ResultPath).toBe('$');
        expect(incrementState.Next).toBe('CheckStopRetryCount');
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RlcC1mdW5jdGlvbi50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic3RlcC1mdW5jdGlvbi50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSx1Q0FBeUI7QUFDekIsMkNBQTZCO0FBRTdCLFFBQVEsQ0FBQywwQkFBMEIsRUFBRSxHQUFHLEVBQUU7SUFDeEMsSUFBSSxzQkFBMkIsQ0FBQztJQUVoQyxTQUFTLENBQUMsR0FBRyxFQUFFO1FBQ2IsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsK0NBQStDLENBQUMsQ0FBQztRQUM3RixNQUFNLGlCQUFpQixHQUFHLEVBQUUsQ0FBQyxZQUFZLENBQUMsY0FBYyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQ2xFLHNCQUFzQixHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsaUJBQWlCLENBQUMsQ0FBQztJQUN6RCxDQUFDLENBQUMsQ0FBQztJQUVILEVBQUUsQ0FBQyxnRkFBZ0YsRUFBRSxHQUFHLEVBQUU7UUFDeEYsTUFBTSxZQUFZLEdBQUcsc0JBQXNCLENBQUMsTUFBTSxDQUFDLHdCQUF3QixDQUFDO1FBRTVFLE1BQU0sQ0FBQyxZQUFZLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztRQUNuQyxNQUFNLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUN2QyxNQUFNLENBQUMsWUFBWSxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDeEQsQ0FBQyxDQUFDLENBQUM7SUFFSCxFQUFFLENBQUMsNkRBQTZELEVBQUUsR0FBRyxFQUFFO1FBQ3JFLE1BQU0sU0FBUyxHQUFHLHNCQUFzQixDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUM7UUFFN0QsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDLFdBQVcsRUFBRSxD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QUFDLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLENBQUM7UUFDakUsTUFBTSxDQUFDLGVBQWUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsdUJBQXVCLENBQUMsQ0FBQztJQUNoRSxDQUFDLENBQUMsQ0FBQztJQUVILEVBQUUsQ0FBQyxnRUFBZ0UsRUFBRSxHQUFHLEVBQUU7UUFDeEUsTUFBTSxpQkFBaUIsR0FBRyxzQkFBc0IsQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLENBQUM7UUFFekUsTUFBTSxDQUFDLGlCQUFpQixDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7UUFDeEMsTUFBTSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUM1QyxNQUFNLENBQUMsaUJBQWlCLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUMxRCxNQUFNLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDO0lBQ3RELENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuXG5kZXNjcmliZSgnU3RlcCBGdW5jdGlvbiBEZWZpbml0aW9uJywgKCkgPT4ge1xuICBsZXQgc3RlcEZ1bmN0aW9uRGVmaW5pdGlvbjogYW55O1xuICBcbiAgYmVmb3JlQWxsKCgpID0+IHtcbiAgICBjb25zdCBkZWZpbml0aW9uUGF0aCA9IHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi9saWIvc3RlcC1mdW5jdGlvbnMvbWlncmF0aW9uLXdvcmtmbG93Lmpzb24nKTtcbiAgICBjb25zdCBkZWZpbml0aW9uQ29udGVudCA9IGZzLnJlYWRGaWxlU3luYyhkZWZpbml0aW9uUGF0aCwgJ3V0ZjgnKTtcbiAgICBzdGVwRnVuY3Rpb25EZWZpbml0aW9uID0gSlNPTi5wYXJzZShkZWZpbml0aW9uQ29udGVudCk7XG4gIH0pO1xuICBcbiAgaXQoJ3Nob3VsZCBoYXZlIEV4dHJhY3RDdXJyZW50SW5zdGFuY2VJZCBzdGF0ZSB0aGF0IGluaXRpYWxpemVzIGZvcmNlU3RvcCB0byBmYWxzZScsICgpID0+IHtcbiAgICBjb25zdCBleHRyYWN0U3RhdGUgPSBzdGVwRnVuY3Rpb25EZWZpbml0aW9uLlN0YXRlcy5FeHRyYWN0Q3VycmVudEluc3RhbmNlSWQ7XG4gICAgXG4gICAgZXhwZWN0KGV4dHJhY3RTdGF0ZSkudG9CZURlZmluZWQoKTtcbiAgICBleHBlY3QoZXh0cmFjdFN0YXRlLlR5cGUpLnRvQmUoJ1Bhc3MnKTtcbiAgICBleHBlY3QoZXh0cmFjdFN0YXRlLlBhcmFtZXRlcnMuZm9yY2VTdG9wKS50b0JlKGZhbHNlKTtcbiAgfSk7XG4gIFxuICBpdCgnc2hvdWxkIGhhdmUgU3RvcEluc3RhbmNlIHN0YXRlIHRoYXQgYWNjZXB0cyBmb3JjZSBwYXJhbWV0ZXInLCAoKSA9PiB7XG4gICAgY29uc3Qgc3RvcFN0YXRlID0gc3RlcEZ1bmN0aW9uRGVmaW5pdGlvbi5TdGF0ZXMuU3RvcEluc3RhbmNlO1xuICAgIFxuICAgIGV4cGVjdChzdG9wU3RhdGUpLnRvQmVEZWZpbmVkKCk7XG4gICAgZXhwZWN0KHN0b3BTdGF0ZS5UeXBlKS50b0JlKCdUYXNrJyk7XG4gICAgZXhwZWN0KHN0b3BTdGF0ZS5QYXJhbWV0ZXJzLlBheWxvYWRbJ2ZvcmNlLiQnXSkudG9CZSgnJC5jdXJyZW50SW5zdGFuY2UuZm9yY2VTdG9wJyk7XG4gIH0pO1xuICBcbiAgaXQoJ3Nob3VsZCBoYXZlIEluaXRpYWxpemVTdG9wQ291bnRlciBzdGF0ZSBhZnRlciBTdG9wSW5zdGFuY2UnLCAoKSA9PiB7XG4gICAgY29uc3Qgc3RvcFN0YXRlID0gc3RlcEZ1bmN0aW9uRGVmaW5pdGlvbi5TdGF0ZXMuU3RvcEluc3RhbmNlO1xuICAgIGNvbnN0IGluaXRDb3VudGVyU3RhdGUgPSBzdGVwRnVuY3Rpb25EZWZpbml0aW9uLlN0YXRlcy5Jbml0aWFsaXplU3RvcENvdW50ZXI7XG4gICAgXG4gICAgZXhwZWN0KHN0b3BTdGF0ZS5OZXh0KS50b0JlKCdJbml0aWFsaXplU3RvcENvdW50ZXInKTtcbiAgICBleHBlY3QoaW5pdENvdW50ZXJTdGF0ZSkudG9CZURlZmluZWQoKTtcbiAgICBleHBlY3QoaW5pdENvdW50ZXJTdGF0ZS5UeXBlKS50b0JlKCdQYXNzJyk7XG4gICAgZXhwZWN0KGluaXRDb3VudGVyU3RhdGUuUGFyYW1ldGVycy5zdG9wQ2hlY2tDb3VudGVyKS50b0JlKDApO1xuICAgIGV4cGVjdChpbml0Q291bnRlclN0YXRlLlJlc3VsdFBhdGgpLnRvQmUoJyQnKTtcbiAgfSk7XG4gIFxuICBpdCgnc2hvdWxkIGhhdmUgSW5jcmVtZW50U3RvcENvdW50ZXIgc3RhdGUgYXMgZGVmYXVsdCBmcm9tIElzSW5zdGFuY2VTdG9wcGVkJywgKCkgPT4ge1xuICAgIGNvbnN0IGlzU3RvcHBlZFN0YXRlID0gc3RlcEZ1bmN0aW9uRGVmaW5pdGlvbi5TdGF0ZXMuSXNJbnN0YW5jZVN0b3BwZWQ7XG4gICAgXG4gICAgZXhwZWN0KGlzU3RvcHBlZFN0YXRlKS50b0JlRGVmaW5lZCgpO1xuICAgIGV4cGVjdChpc1N0b3BwZWRTdGF0ZS5EZWZhdWx0KS50b0JlKCdJbmNyZW1lbnRTdG9wQ291bnRlcicpO1xuICB9KTtcbiAgXG4gIGl0KCdzaG91bGQgaGF2ZSBJbmNyZW1lbnRTdG9wQ291bnRlciBzdGF0ZSB0aGF0IHByb3Blcmx5IGluY3JlbWVudHMgdGhlIGNvdW50ZXInLCAoKSA9PiB7XG4gICAgY29uc3QgaW5jcmVtZW50U3RhdGUgPSBzdGVwRnVuY3Rpb25EZWZpbml0aW9uLlN0YXRlcy5JbmNyZW1lbnRTdG9wQ291bnRlcjtcbiAgICBcbiAgICBleHBlY3QoaW5jcmVtZW50U3RhdGUpLnRvQmVEZWZpbmVkKCk7XG4gICAgZXhwZWN0KGluY3JlbWVudFN0YXRlLlR5cGUpLnRvQmUoJ1Bhc3MnKTtcbiAgICBleHBlY3QoaW5jcmVtZW50U3RhdGUuUGFyYW1ldGVyc1snc3RvcENoZWNrQ291bnRlci4kJ10pLnRvQmUoJ1N0YXRlcy5NYXRoQWRkKCQuc3RvcENoZWNrQ291bnRlciwgMSknKTtcbiAgICBleHBlY3QoaW5jcmVtZW50U3RhdGUuUmVzdWx0UGF0aCkudG9CZSgnJCcpO1xuICAgIGV4cGVjdChpbmNyZW1lbnRTdGF0ZS5OZXh0KS50b0JlKCdDaGVja1N0b3BSZXRyeUNvdW50Jyk7XG4gIH0pO1xuICBcbiAgaXQoJ3Nob3VsZCBoYXZlIENoZWNrU3RvcFJldHJ5Q291bnQgc3RhdGUgdGhhdCBjaGVja3MgZm9yIDQgYXR0ZW1wdHMnLCAoKSA9PiB7XG4gICAgY29uc3QgY2hlY2tDb3VudFN0YXRlID0gc3RlcEZ1bmN0aW9uRGVmaW5pdGlvbi5TdGF0ZXMuQ2hlY2tTdG9wUmV0cnlDb3VudDtcbiAgICBcbiAgICBleHBlY3QoY2hlY2tDb3VudFN0YXRlKS50b0JlRGVmaW5lZCgpO1xuICAgIGV4cGVjdChjaGVja0NvdW50U3RhdGUuVHlwZSkudG9CZSgnQ2hvaWNlJyk7XG4gICAgZXhwZWN0KGNoZWNrQ291bnRTdGF0ZS5DaG9pY2VzWzBdLlZhcmlhYmxlKS50b0JlKCckLnN0b3BDaGVja0NvdW50ZXInKTtcbiAgICBleHBlY3QoY2hlY2tDb3VudFN0YXRlLkNob2ljZXNbMF0uTnVtZXJpY0VxdWFscykudG9CZSg0KTtcbiAgICBleHBlY3QoY2hlY2tDb3VudFN0YXRlLkNob2ljZXNbMF0uTmV4dCkudG9CZSgnUHJlcGFyZUZvcmNlU3RvcCcpO1xuICAgIGV4cGVjdChjaGVja0NvdW50U3RhdGUuRGVmYXVsdCkudG9CZSgnV2FpdEZvckluc3RhbmNlVG9TdG9wJyk7XG4gIH0pO1xuICBcbiAgaXQoJ3Nob3VsZCBoYXZlIFByZXBhcmVGb3JjZVN0b3Agc3RhdGUgdGhhdCBzZXRzIGZvcmNlU3RvcCB0byB0cnVlJywgKCkgPT4ge1xuICAgIGNvbnN0IHByZXBhcmVGb3JjZVN0YXRlID0gc3RlcEZ1bmN0aW9uRGVmaW5pdGlvbi5TdGF0ZXMuUHJlcGFyZUZvcmNlU3RvcDtcbiAgICBcbiAgICBleHBlY3QocHJlcGFyZUZvcmNlU3RhdGUpLnRvQmVEZWZpbmVkKCk7XG4gICAgZXhwZWN0KHByZXBhcmVGb3JjZVN0YXRlLlR5cGUpLnRvQmUoJ1Bhc3MnKTtcbiAgICBleHBlY3QocHJlcGFyZUZvcmNlU3RhdGUuUGFyYW1ldGVycy5mb3JjZVN0b3ApLnRvQmUodHJ1ZSk7XG4gICAgZXhwZWN0KHByZXBhcmVGb3JjZVN0YXRlLk5leHQpLnRvQmUoJ1N0b3BJbnN0YW5jZScpO1xuICB9KTtcbn0pOyJdfQ==