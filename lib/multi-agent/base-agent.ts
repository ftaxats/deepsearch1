import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { 
  Agent, 
  AgentMessage, 
  AgentTask, 
  AgentCapability, 
  AgentEvent,
  MultiAgentConfig 
} from './types';

export abstract class BaseAgent {
  protected llm: ChatOpenAI;
  protected streamingLlm: ChatOpenAI;
  protected agent: Agent;
  protected messageQueue: AgentMessage[] = [];
  protected eventCallbacks: ((event: AgentEvent) => void)[] = [];

  constructor(
    agentId: string,
    name: string,
    description: string,
    capabilities: AgentCapability[],
    llm: ChatOpenAI,
    streamingLlm: ChatOpenAI
  ) {
    this.llm = llm;
    this.streamingLlm = streamingLlm;
    this.agent = {
      id: agentId,
      name,
      description,
      capabilities,
      status: 'idle',
      messageQueue: []
    };
  }

  // Abstract methods that must be implemented by specialized agents
  abstract executeTask(task: AgentTask): Promise<any>;
  abstract getSystemPrompt(): string;

  // Common agent functionality
  async processMessage(message: AgentMessage): Promise<void> {
    this.messageQueue.push(message);
    
    if (message.type === 'request' && this.agent.status === 'idle') {
      await this.handleRequest(message);
    }
  }

  // Enhanced method to emit detailed thinking process
  protected emitThinking(message: string, details?: any): void {
    this.emitEvent({
      type: 'agent-started',
      agentId: this.agent.id,
      timestamp: new Date(),
      message: `🧠 ${this.agent.name}: ${message}`,
      data: details
    });
  }

  // Enhanced method to emit progress updates
  protected emitProgress(step: string, progress: number, details?: any): void {
    this.emitEvent({
      type: 'data-shared',
      agentId: this.agent.id,
      timestamp: new Date(),
      message: `📊 ${this.agent.name}: ${step} (${progress}%)`,
      data: details
    });
  }

  // Enhanced method to emit data findings
  protected emitFinding(type: string, finding: string, confidence?: number): void {
    this.emitEvent({
      type: 'data-shared',
      agentId: this.agent.id,
      timestamp: new Date(),
      message: `🔍 ${this.agent.name}: Found ${type} - ${finding}${confidence ? ` (${Math.round(confidence * 100)}% confidence)` : ''}`,
      data: { type, finding, confidence }
    });
  }

  private async handleRequest(message: AgentMessage): Promise<void> {
    try {
      this.agent.status = 'busy';
      this.emitEvent({
        type: 'task-assigned',
        agentId: this.agent.id,
        timestamp: new Date(),
        data: message.payload
      });

      const task: AgentTask = {
        id: `task-${Date.now()}`,
        agentId: this.agent.id,
        type: message.payload.taskType,
        status: 'in_progress',
        input: message.payload.input,
        priority: message.payload.priority || 1,
        createdAt: new Date()
      };

      this.agent.currentTask = task;

      const result = await this.executeTask(task);
      
      task.status = 'completed';
      task.output = result;
      task.completedAt = new Date();

      this.emitEvent({
        type: 'task-completed',
        agentId: this.agent.id,
        timestamp: new Date(),
        data: result
      });

      // Send response back to sender
      const response: AgentMessage = {
        id: `response-${Date.now()}`,
        from: this.agent.id,
        to: message.from,
        type: 'response',
        payload: {
          taskId: task.id,
          result,
          metadata: {
            agentId: this.agent.id,
            agentName: this.agent.name,
            completedAt: task.completedAt,
            duration: task.completedAt.getTime() - task.createdAt.getTime()
          }
        },
        timestamp: new Date(),
        priority: message.priority
      };

      this.agent.status = 'idle';
      this.agent.currentTask = undefined;

    } catch (error) {
      this.agent.status = 'error';
      this.emitEvent({
        type: 'agent-error',
        agentId: this.agent.id,
        timestamp: new Date(),
        message: error instanceof Error ? error.message : 'Unknown error',
        data: error
      });

      const errorResponse: AgentMessage = {
        id: `error-${Date.now()}`,
        from: this.agent.id,
        to: message.from,
        type: 'error',
        payload: {
          error: error instanceof Error ? error.message : 'Unknown error',
          taskId: message.payload.taskId
        },
        timestamp: new Date(),
        priority: 'high'
      };
    }
  }

  protected async callLLM(messages: any[], streaming: boolean = false): Promise<string> {
    try {
      if (streaming) {
        const stream = await this.streamingLlm.stream(messages);
        let fullText = '';
        
        for await (const chunk of stream) {
          const content = chunk.content;
          if (typeof content === 'string') {
            fullText += content;
          }
        }
        return fullText;
      } else {
        const response = await this.llm.invoke(messages);
        return response.content.toString();
      }
    } catch (error) {
      throw new Error(`LLM call failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  protected async searchAndExtractData(
    query: string, 
    extractionSchema: any,
    maxResults: number = 10
  ): Promise<any[]> {
    // This would integrate with your existing search and extraction logic
    // For now, returning a placeholder structure
    return [];
  }

  protected emitEvent(event: AgentEvent): void {
    this.eventCallbacks.forEach(callback => callback(event));
  }

  public addEventListener(callback: (event: AgentEvent) => void): void {
    this.eventCallbacks.push(callback);
  }

  public removeEventListener(callback: (event: AgentEvent) => void): void {
    const index = this.eventCallbacks.indexOf(callback);
    if (index > -1) {
      this.eventCallbacks.splice(index, 1);
    }
  }

  public getStatus(): Agent {
    return { ...this.agent };
  }

  public getCapabilities(): AgentCapability[] {
    return [...this.agent.capabilities];
  }

  public canHandleTask(taskType: string): boolean {
    return this.agent.capabilities.some(capability => 
      capability.inputTypes.includes(taskType)
    );
  }

  protected validateInput(input: any, expectedType: string): boolean {
    // Basic validation logic - can be extended by specialized agents
    return input && typeof input === 'object';
  }

  protected createErrorResponse(error: string, taskId?: string): AgentMessage {
    return {
      id: `error-${Date.now()}`,
      from: this.agent.id,
      to: 'coordinator',
      type: 'error',
      payload: {
        error,
        taskId
      },
      timestamp: new Date(),
      priority: 'high'
    };
  }

  protected createSuccessResponse(result: any, taskId: string, to: string): AgentMessage {
    return {
      id: `response-${Date.now()}`,
      from: this.agent.id,
      to,
      type: 'response',
      payload: {
        taskId,
        result,
        metadata: {
          agentId: this.agent.id,
          agentName: this.agent.name,
          completedAt: new Date()
        }
      },
      timestamp: new Date(),
      priority: 'medium'
    };
  }
}