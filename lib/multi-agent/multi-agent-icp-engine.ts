import { ChatOpenAI } from "@langchain/openai";
import { AgentHub } from './agent-hub';
import { 
  CustomerIntelligenceAgent 
} from './agents/customer-intelligence-agent';
import { 
  MarketResearchAgent 
} from './agents/market-research-agent';
import { 
  FirmographicAgent 
} from './agents/firmographic-agent';
import { 
  TechnographicAgent 
} from './agents/technographic-agent';
import { 
  PsychographicAgent 
} from './agents/psychographic-agent';
import { 
  TargetCompanyDiscoveryAgent 
} from './agents/target-company-discovery-agent';
import { 
  ICPSynthesisAgent 
} from './agents/icp-synthesis-agent';
import { 
  MultiAgentConfig, 
  ICPProfile, 
  AgentEvent 
} from './types';

export class MultiAgentICPEngine {
  private agentHub: AgentHub;
  private llm: ChatOpenAI;
  private streamingLlm: ChatOpenAI;
  private config: MultiAgentConfig;

  constructor(
    llm: ChatOpenAI,
    streamingLlm: ChatOpenAI,
    config?: Partial<MultiAgentConfig>
  ) {
    this.llm = llm;
    this.streamingLlm = streamingLlm;
    
    // Default configuration
    this.config = {
      maxConcurrentAgents: 6,
      taskTimeout: 60000,
      retryAttempts: 2,
      dataSharingEnabled: true,
      priorityWeights: {
        customerIntelligence: 10,
        marketResearch: 9,
        firmographic: 8,
        technographic: 7,
        psychographic: 6,
        targetCompany: 5
      },
      ...config
    };

    this.agentHub = new AgentHub(this.config);
    this.initializeAgents();
  }

  private initializeAgents(): void {
    // Initialize all specialized agents
    const customerIntelligenceAgent = new CustomerIntelligenceAgent(this.llm, this.streamingLlm);
    const marketResearchAgent = new MarketResearchAgent(this.llm, this.streamingLlm);
    const firmographicAgent = new FirmographicAgent(this.llm, this.streamingLlm);
    const technographicAgent = new TechnographicAgent(this.llm, this.streamingLlm);
    const psychographicAgent = new PsychographicAgent(this.llm, this.streamingLlm);
    const targetCompanyDiscoveryAgent = new TargetCompanyDiscoveryAgent(this.llm, this.streamingLlm);
    const icpSynthesisAgent = new ICPSynthesisAgent(this.llm, this.streamingLlm);

    // Register agents with the hub
    this.agentHub.registerAgent(customerIntelligenceAgent);
    this.agentHub.registerAgent(marketResearchAgent);
    this.agentHub.registerAgent(firmographicAgent);
    this.agentHub.registerAgent(technographicAgent);
    this.agentHub.registerAgent(psychographicAgent);
    this.agentHub.registerAgent(targetCompanyDiscoveryAgent);
    this.agentHub.registerAgent(icpSynthesisAgent);
  }

  /**
   * Main method to perform comprehensive ICP analysis using multi-agent system
   */
  async analyzeICP(
    query: string,
    sources: unknown[],
    onProgress?: (event: AgentEvent) => void
  ): Promise<ICPProfile[]> {
    try {
      // Phase 1: Parallel data gathering by specialized agents
      const researchData = await this.agentHub.coordinateICPAnalysis(
        query,
        sources,
        onProgress
      );

      // Phase 2: ICP synthesis
      const synthesisTask = {
        type: 'icp-profile-synthesis',
        input: {
          combinedResearchData: researchData,
          query
        },
        priority: 10
      };

      // Execute ICP synthesis directly
      let icpProfiles: ICPProfile[] = [];
      try {
        console.log('Looking for ICP synthesis agents...');
        const suitableAgents = this.agentHub.findSuitableAgents('icp-profile-synthesis');
        console.log('Found suitable agents:', suitableAgents.length);
        
        if (suitableAgents.length > 0) {
          const selectedAgent = this.agentHub.selectBestAgent(suitableAgents, synthesisTask.priority);
          const agent = this.agentHub.getAgent(selectedAgent.id);
          
          console.log('Selected agent:', selectedAgent.id, 'Agent found:', !!agent);
          
          if (agent) {
            console.log('Executing ICP synthesis with input:', synthesisTask.input);
            icpProfiles = await agent.executeTask({
              id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              agentId: selectedAgent.id,
              type: 'icp-profile-synthesis',
              status: 'in_progress',
              input: synthesisTask.input,
              priority: synthesisTask.priority,
              createdAt: new Date()
            }) as ICPProfile[];
            
            console.log('ICP synthesis completed, profiles:', icpProfiles.length);
          }
        } else {
          console.log('No suitable agents found for ICP synthesis');
        }
      } catch (error) {
        console.error('Error executing ICP synthesis:', error);
        throw new Error(`ICP synthesis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      return icpProfiles;

    } catch (error) {
      throw new Error(`Multi-Agent ICP Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Perform ICP analysis with streaming updates
   */
  async analyzeICPWithStreaming(
    query: string,
    sources: unknown[],
    onChunk: (chunk: string) => void,
    onProgress?: (event: AgentEvent) => void
  ): Promise<ICPProfile[]> {
    try {
      // Set up progress monitoring
      if (onProgress) {
        this.agentHub.addEventListener(onProgress);
      }

      // Perform analysis
      const icpProfiles = await this.analyzeICP(query, sources, onProgress);

      // Stream the results
      const resultsText = this.formatICPResults(icpProfiles);
      onChunk(resultsText);

      return icpProfiles;

    } finally {
      if (onProgress) {
        this.agentHub.removeEventListener(onProgress);
      }
    }
  }

  /**
   * Get system status and agent information
   */
  getSystemStatus(): {
    totalAgents: number;
    activeAgents: number;
    idleAgents: number;
    busyAgents: number;
    errorAgents: number;
    queuedMessages: number;
    agents: Array<{
      id: string;
      name: string;
      status: string;
      currentTask?: string;
    }>;
  } {
    const systemStatus = this.agentHub.getSystemStatus();
    const agents = this.agentHub.getAllAgents().map(agent => {
      const status = agent.getStatus();
      return {
        id: status.id,
        name: status.name,
        status: status.status,
        currentTask: status.currentTask?.type
      };
    });

    return {
      ...systemStatus,
      agents
    };
  }

  /**
   * Get specific agent information
   */
  getAgentInfo(agentId: string): unknown {
    const agent = this.agentHub.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }
    return agent.getStatus();
  }

  /**
   * Get agent capabilities
   */
  getAgentCapabilities(agentId: string): unknown[] {
    const agent = this.agentHub.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }
    return agent.getCapabilities();
  }

  /**
   * Wait for a specific task to complete
   */
  private async waitForTaskCompletion(taskId: string, timeout: number = 120000): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkTask = () => {
        if (Date.now() - startTime > timeout) {
          reject(new Error(`Task ${taskId} timed out after ${timeout}ms`));
          return;
        }
        
        // This is a simplified implementation
        // In a real system, you would have proper task tracking
        setTimeout(() => {
          // For now, return a placeholder
          resolve([]);
        }, 1000);
      };

      checkTask();
    });
  }

  /**
   * Format ICP results for streaming
   */
  private formatICPResults(icpProfiles: ICPProfile[]): string {
    let result = '# ICP Analysis Results\n\n';
    
    icpProfiles.forEach((profile, index) => {
      result += `## ICP Profile ${index + 1}: ${profile.name}\n\n`;
      result += `**Priority:** ${profile.priority}\n\n`;
      
      result += `### Characteristics\n`;
      result += `- Industry: ${profile.characteristics.industry}\n`;
      result += `- Company Size: ${profile.characteristics.companySize}\n`;
      result += `- Revenue Range: ${profile.characteristics.revenueRange}\n`;
      result += `- Geographic Focus: ${profile.characteristics.geographicFocus}\n`;
      result += `- Business Model: ${profile.characteristics.businessModel}\n\n`;
      
      result += `### Firmographics\n`;
      result += `- Funding Stage: ${profile.firmographics.fundingStage}\n`;
      result += `- Growth Stage: ${profile.firmographics.growthStage}\n`;
      result += `- Market Position: ${profile.firmographics.marketPosition}\n`;
      result += `- Geographic Presence: ${profile.firmographics.geographicPresence}\n\n`;
      
      result += `### Technographics\n`;
      result += `- Technology Maturity: ${profile.technographics.technologyMaturity}\n`;
      result += `- Digital Transformation Stage: ${profile.technographics.digitalTransformationStage}\n`;
      result += `- Current Tech Stack: ${profile.technographics.currentTechStack.join(', ')}\n`;
      result += `- Integration Requirements: ${profile.technographics.integrationRequirements.join(', ')}\n\n`;
      
      result += `### Psychographics\n`;
      result += `- Pain Points: ${profile.psychographics.painPoints.join(', ')}\n`;
      result += `- Buying Triggers: ${profile.psychographics.buyingTriggers.join(', ')}\n`;
      result += `- Decision-Making Process: ${profile.psychographics.decisionMakingProcess}\n`;
      result += `- Budget Allocation: ${profile.psychographics.budgetAllocation}\n\n`;
      
      result += `### Target Companies\n`;
      profile.targetCompanies.forEach((company, companyIndex) => {
        result += `${companyIndex + 1}. **${company.name}** (${company.domain})\n`;
        result += `   - Industry: ${company.industry}\n`;
        result += `   - Size: ${company.size}\n`;
        result += `   - Location: ${company.location}\n`;
        result += `   - Reasoning: ${company.reasoning}\n\n`;
      });
      
      result += `### Validation\n`;
      result += `- Market Size: ${profile.validation.marketSize}\n`;
      result += `- Competition Level: ${profile.validation.competitionLevel}\n`;
      result += `- Sales Velocity: ${profile.validation.salesVelocity}\n`;
      result += `- Revenue Potential: ${profile.validation.revenuePotential}\n`;
      result += `- Confidence: ${profile.validation.confidence}\n\n`;
      
      result += `### Key Insights\n`;
      result += `- Key Differentiators: ${profile.insights.keyDifferentiators.join(', ')}\n`;
      result += `- Messaging Resonance: ${profile.insights.messagingResonance.join(', ')}\n`;
      result += `- Value Propositions: ${profile.insights.valuePropositions.join(', ')}\n`;
      result += `- Common Objections: ${profile.insights.commonObjections.join(', ')}\n`;
      result += `- Outreach Strategy: ${profile.insights.outreachStrategy.join(', ')}\n\n`;
      
      result += '---\n\n';
    });
    
    return result;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<MultiAgentConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): MultiAgentConfig {
    return { ...this.config };
  }
}