import { 
  Agent, 
  AgentMessage, 
  AgentTask, 
  AgentEvent, 
  MultiAgentConfig,
  CombinedResearchData 
} from './types';
import { BaseAgent } from './base-agent';

export class AgentHub {
  private agents: Map<string, BaseAgent> = new Map();
  private messageQueue: AgentMessage[] = [];
  private eventCallbacks: ((event: AgentEvent) => void)[] = [];
  private config: MultiAgentConfig;
  private isProcessing: boolean = false;

  constructor(config: MultiAgentConfig) {
    this.config = config;
  }

  // Register agents with the hub
  public registerAgent(agent: BaseAgent): void {
    this.agents.set(agent.getStatus().id, agent);
    
    // Set up event forwarding
    agent.addEventListener((event: AgentEvent) => {
      this.emitEvent(event);
    });

    this.emitEvent({
      type: 'agent-started',
      agentId: agent.getStatus().id,
      timestamp: new Date(),
      message: `Agent ${agent.getStatus().name} registered`
    });
  }

  // Send message between agents
  public async sendMessage(message: AgentMessage): Promise<void> {
    this.messageQueue.push(message);
    
    if (!this.isProcessing) {
      await this.processMessageQueue();
    }
  }

  // Broadcast message to all agents
  public async broadcastMessage(message: Omit<AgentMessage, 'to'>): Promise<void> {
    const broadcastPromises = Array.from(this.agents.keys()).map(agentId => 
      this.sendMessage({
        ...message,
        to: agentId
      })
    );

    await Promise.all(broadcastPromises);
  }

  // Assign task to the most suitable agent
  public async assignTask(task: Omit<AgentTask, 'id' | 'agentId' | 'status' | 'createdAt'>): Promise<string> {
    const suitableAgents = this.findSuitableAgents(task.type);
    
    if (suitableAgents.length === 0) {
      throw new Error(`No suitable agent found for task type: ${task.type}`);
    }

    // Select agent based on priority and current workload
    const selectedAgent = this.selectBestAgent(suitableAgents, task.priority);
    
    const fullTask: AgentTask = {
      ...task,
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      agentId: selectedAgent.id,
      status: 'pending',
      createdAt: new Date()
    };

    const message: AgentMessage = {
      id: `task-${Date.now()}`,
      from: 'coordinator',
      to: selectedAgent.id,
      type: 'request',
      payload: {
        taskType: task.type,
        input: task.input,
        priority: task.priority
      },
      timestamp: new Date(),
      priority: task.priority > 5 ? 'high' : task.priority > 2 ? 'medium' : 'low'
    };

    await this.sendMessage(message);
    return fullTask.id;
  }

  // Coordinate multi-agent ICP analysis
  public async coordinateICPAnalysis(
    query: string,
    initialSources: unknown[],
    onProgress?: (event: AgentEvent) => void
  ): Promise<CombinedResearchData> {
    if (onProgress) {
      this.addEventListener(onProgress);
    }

    try {
      // Emit coordination start
      this.emitEvent({
        type: 'agent-started',
        agentId: 'coordinator',
        timestamp: new Date(),
        message: '🎯 Starting multi-agent ICP coordination',
        data: { query, sourceCount: initialSources.length }
      });

      // Phase 1: Parallel data gathering by specialized agents
      this.emitEvent({
        type: 'data-shared',
        agentId: 'coordinator',
        timestamp: new Date(),
        message: '📋 Phase 1: Deploying specialized agents for parallel data gathering',
        data: { phase: 'data-gathering', agents: 5 }
      });

      const dataGatheringTasks = [
        {
          type: 'customer-intelligence',
          input: { query, sources: initialSources },
          priority: this.config.priorityWeights.customerIntelligence
        },
        {
          type: 'market-research',
          input: { query, sources: initialSources },
          priority: this.config.priorityWeights.marketResearch
        },
        {
          type: 'firmographic-analysis',
          input: { query, sources: initialSources },
          priority: this.config.priorityWeights.firmographic
        },
        {
          type: 'technographic-analysis',
          input: { query, sources: initialSources },
          priority: this.config.priorityWeights.technographic
        },
        {
          type: 'psychographic-analysis',
          input: { query, sources: initialSources },
          priority: this.config.priorityWeights.psychographic
        }
      ];

      // Execute data gathering tasks in parallel
      this.emitEvent({
        type: 'data-shared',
        agentId: 'coordinator',
        timestamp: new Date(),
        message: '🚀 Assigning tasks to specialized agents',
        data: { tasks: dataGatheringTasks.length }
      });

      const dataGatheringPromises = dataGatheringTasks.map(task => 
        this.assignTask(task)
      );

      const dataGatheringTaskIds = await Promise.all(dataGatheringPromises);

      this.emitEvent({
        type: 'data-shared',
        agentId: 'coordinator',
        timestamp: new Date(),
        message: '⏳ Waiting for all agents to complete data gathering',
        data: { taskIds: dataGatheringTaskIds }
      });

      // Wait for all data gathering to complete
      const gatheredData = await this.waitForTasks(dataGatheringTaskIds);

      this.emitEvent({
        type: 'data-shared',
        agentId: 'coordinator',
        timestamp: new Date(),
        message: '✅ Phase 1 complete: All agents finished data gathering',
        data: { completedTasks: Object.keys(gatheredData).length }
      });

      // Phase 2: Target company discovery based on gathered data
      this.emitEvent({
        type: 'data-shared',
        agentId: 'coordinator',
        timestamp: new Date(),
        message: '📋 Phase 2: Deploying Target Company Discovery Agent',
        data: { phase: 'target-discovery', inputData: Object.keys(gatheredData) }
      });

      const targetCompanyTask = {
        type: 'target-company-discovery',
        input: { 
          query, 
          customerIntelligence: gatheredData['customer-intelligence'],
          marketResearch: gatheredData['market-research'],
          firmographicData: gatheredData['firmographic-analysis']
        },
        priority: this.config.priorityWeights.targetCompany
      };

      const targetCompanyTaskId = await this.assignTask(targetCompanyTask);
      const targetCompanyData = await this.waitForTask(targetCompanyTaskId);

      this.emitEvent({
        type: 'data-shared',
        agentId: 'coordinator',
        timestamp: new Date(),
        message: '✅ Phase 2 complete: Target companies discovered and validated',
        data: { targetCompanies: targetCompanyData?.companies?.length || 0 }
      });

      // Combine all research data
      this.emitEvent({
        type: 'data-shared',
        agentId: 'coordinator',
        timestamp: new Date(),
        message: '🔄 Combining all research data from specialized agents',
        data: { dataSources: Object.keys(gatheredData).length + 1 }
      });

      const combinedData: CombinedResearchData = {
        customerIntelligence: gatheredData['customer-intelligence'],
        marketResearch: gatheredData['market-research'],
        firmographicData: gatheredData['firmographic-analysis'],
        technographicData: gatheredData['technographic-analysis'],
        psychographicData: gatheredData['psychographic-analysis'],
        targetCompanyData: targetCompanyData,
        metadata: {
          totalSources: initialSources.length,
          confidence: this.calculateOverallConfidence(gatheredData),
          lastUpdated: new Date(),
          agentsUsed: Array.from(this.agents.keys())
        }
      };

      this.emitEvent({
        type: 'agent-completed',
        agentId: 'coordinator',
        timestamp: new Date(),
        message: '🎯 Multi-agent coordination completed successfully',
        data: { 
          totalAgents: this.agents.size,
          dataPoints: Object.keys(combinedData).length,
          confidence: combinedData.metadata.confidence
        }
      });

      return combinedData;

    } finally {
      if (onProgress) {
        this.removeEventListener(onProgress);
      }
    }
  }

  // Process message queue
  private async processMessageQueue(): Promise<void> {
    if (this.isProcessing || this.messageQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.messageQueue.length > 0) {
        const message = this.messageQueue.shift();
        if (!message) continue;

        const agent = this.agents.get(message.to);
        if (agent) {
          await agent.processMessage(message);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  // Find agents capable of handling a specific task type
  private findSuitableAgents(taskType: string): Agent[] {
    const suitableAgents: Agent[] = [];

    for (const agent of this.agents.values()) {
      if (agent.canHandleTask(taskType)) {
        suitableAgents.push(agent.getStatus());
      }
    }

    return suitableAgents;
  }

  // Select the best agent for a task based on priority and workload
  private selectBestAgent(agents: Agent[], _priority: number): Agent {
    // Sort by status (idle agents first) and then by current workload
    const sortedAgents = agents.sort((a, b) => {
      if (a.status === 'idle' && b.status !== 'idle') return -1;
      if (a.status !== 'idle' && b.status === 'idle') return 1;
      return a.messageQueue.length - b.messageQueue.length;
    });

    return sortedAgents[0];
  }

  // Wait for a specific task to complete
  private async waitForTask(taskId: string, timeout: number = 30000): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkTask = () => {
        // This would need to be implemented with proper task tracking
        // For now, returning a placeholder
        if (Date.now() - startTime > timeout) {
          reject(new Error(`Task ${taskId} timed out`));
          return;
        }
        
        // Check if task is completed
        // This is a simplified implementation
        setTimeout(checkTask, 100);
      };

      checkTask();
    });
  }

  // Wait for multiple tasks to complete
  private async waitForTasks(taskIds: string[], timeout: number = 60000): Promise<Record<string, unknown>> {
    const results: Record<string, unknown> = {};
    
    const promises = taskIds.map(async (taskId) => {
      const result = await this.waitForTask(taskId, timeout);
      results[taskId] = result;
    });

    await Promise.all(promises);
    return results;
  }

  // Calculate overall confidence based on individual agent results
  private calculateOverallConfidence(data: Record<string, unknown>): number {
    const confidences = Object.values(data)
      .filter(item => item && typeof item === 'object' && 'confidence' in item)
      .map(item => (item as { confidence: unknown }).confidence)
      .filter(conf => typeof conf === 'number');

    if (confidences.length === 0) return 0.5;

    return confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
  }

  // Event management
  public addEventListener(callback: (event: AgentEvent) => void): void {
    this.eventCallbacks.push(callback);
  }

  public removeEventListener(callback: (event: AgentEvent) => void): void {
    const index = this.eventCallbacks.indexOf(callback);
    if (index > -1) {
      this.eventCallbacks.splice(index, 1);
    }
  }

  private emitEvent(event: AgentEvent): void {
    this.eventCallbacks.forEach(callback => callback(event));
  }

  // Get system status
  public getSystemStatus(): {
    totalAgents: number;
    activeAgents: number;
    idleAgents: number;
    busyAgents: number;
    errorAgents: number;
    queuedMessages: number;
  } {
    const agents = Array.from(this.agents.values()).map(agent => agent.getStatus());
    
    return {
      totalAgents: agents.length,
      activeAgents: agents.filter(a => a.status === 'idle' || a.status === 'busy').length,
      idleAgents: agents.filter(a => a.status === 'idle').length,
      busyAgents: agents.filter(a => a.status === 'busy').length,
      errorAgents: agents.filter(a => a.status === 'error').length,
      queuedMessages: this.messageQueue.length
    };
  }

  // Get agent by ID
  public getAgent(agentId: string): BaseAgent | undefined {
    return this.agents.get(agentId);
  }

  // Get all agents
  public getAllAgents(): BaseAgent[] {
    return Array.from(this.agents.values());
  }
}