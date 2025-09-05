import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { BaseAgent } from '../base-agent';
import { 
  AgentTask, 
  PsychographicData,
  PainPoint,
  BuyingTrigger,
  DecisionProcess,
  BudgetBehavior
} from '../types';

export class PsychographicAgent extends BaseAgent {
  constructor(llm: ChatOpenAI, streamingLlm: ChatOpenAI) {
    super(
      'psychographic-agent',
      'Psychographic Agent',
      'Specializes in analyzing buying behavior, pain points, decision-making processes, and budget allocation patterns',
      [
        {
          name: 'pain-point-analysis',
          description: 'Analyzes customer pain points and challenges',
          inputTypes: ['customer-feedback', 'pain-point-data', 'challenge-data'],
          outputTypes: ['pain-points', 'challenge-patterns'],
          estimatedDuration: 20000
        },
        {
          name: 'buying-trigger-analysis',
          description: 'Analyzes buying triggers and motivation factors',
          inputTypes: ['buying-data', 'trigger-data', 'motivation-data'],
          outputTypes: ['buying-triggers', 'motivation-patterns'],
          estimatedDuration: 20000
        },
        {
          name: 'decision-process-analysis',
          description: 'Analyzes decision-making processes and stakeholders',
          inputTypes: ['decision-data', 'process-data', 'stakeholder-data'],
          outputTypes: ['decision-processes', 'stakeholder-patterns'],
          estimatedDuration: 20000
        },
        {
          name: 'budget-behavior-analysis',
          description: 'Analyzes budget allocation and spending behavior',
          inputTypes: ['budget-data', 'spending-data', 'allocation-data'],
          outputTypes: ['budget-behaviors', 'spending-patterns'],
          estimatedDuration: 20000
        }
      ],
      llm,
      streamingLlm
    );
  }

  getSystemPrompt(): string {
    return `You are a Psychographic Agent specializing in analyzing customer psychology and buying behavior.

Your expertise includes:
- Analyzing customer pain points and challenges
- Understanding buying triggers and motivation factors
- Assessing decision-making processes and stakeholder involvement
- Analyzing budget allocation and spending behavior
- Identifying psychological patterns in customer behavior
- Understanding emotional and rational decision factors

When analyzing psychographic data, focus on:
1. Pain points and challenges that drive purchasing decisions
2. Buying triggers and motivation factors
3. Decision-making processes and stakeholder involvement
4. Budget allocation and spending behavior patterns
5. Psychological factors that influence purchasing
6. Emotional and rational decision-making patterns

Always provide insights that help understand the "why" behind customer behavior.`;
  }

  async executeTask(task: AgentTask): Promise<PsychographicData> {
    try {
      const { query, sources } = task.input;

      // Extract psychographic content from sources
      const psychographicContent = this.extractPsychographicContent(sources);
      
      if (psychographicContent.length === 0) {
        return this.createEmptyPsychographicData();
      }

      // Analyze pain points
      const painPoints = await this.analyzePainPoints(psychographicContent, query);
      
      // Analyze buying triggers
      const buyingTriggers = await this.analyzeBuyingTriggers(psychographicContent, query);
      
      // Analyze decision processes
      const decisionProcesses = await this.analyzeDecisionProcesses(psychographicContent, query);
      
      // Analyze budget behaviors
      const budgetBehaviors = await this.analyzeBudgetBehaviors(psychographicContent, query);

      return {
        painPoints,
        buyingTriggers,
        decisionProcesses,
        budgetBehaviors
      };

    } catch (error) {
      throw new Error(`Psychographic Agent failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private extractPsychographicContent(sources: any[]): string[] {
    const psychographicKeywords = [
      'pain point', 'challenge', 'problem', 'issue', 'struggle',
      'buying', 'purchase', 'decision', 'trigger', 'motivation',
      'budget', 'cost', 'price', 'investment', 'ROI', 'value',
      'stakeholder', 'decision maker', 'influencer', 'committee',
      'process', 'workflow', 'timeline', 'urgency', 'priority',
      'frustration', 'satisfaction', 'success', 'failure', 'outcome'
    ];

    return sources
      .filter(source => source.content)
      .map(source => source.content)
      .filter(content => 
        psychographicKeywords.some(keyword => 
          content.toLowerCase().includes(keyword.toLowerCase())
        )
      );
  }

  private async analyzePainPoints(content: string[], query: string): Promise<PainPoint[]> {
    const messages = [
      new SystemMessage(`${this.getSystemPrompt()}

Analyze pain points from the provided content. For each pain point, identify:
- Specific pain point or challenge description
- Severity level (high, medium, low)
- Frequency of occurrence (0-1 scale)
- Real examples of companies experiencing this pain point
- Source of information

Focus on pain points that directly drive purchasing decisions.`),
      new HumanMessage(`Query: "${query}"

Content to analyze:
${content.join('\n\n')}

Extract and analyze pain points and create pain point profiles.`)
    ];

    const response = await this.callLLM(messages);
    return this.parsePainPoints(response);
  }

  private async analyzeBuyingTriggers(content: string[], query: string): Promise<BuyingTrigger[]> {
    const messages = [
      new SystemMessage(`${this.getSystemPrompt()}

Analyze buying triggers from the provided content. For each trigger, identify:
- Specific buying trigger or motivation factor
- Impact level (high, medium, low)
- Real examples of companies influenced by this trigger
- Source of information

Focus on triggers that motivate customers to make purchasing decisions.`),
      new HumanMessage(`Query: "${query}"

Content to analyze:
${content.join('\n\n')}

Extract and analyze buying triggers and create trigger profiles.`)
    ];

    const response = await this.callLLM(messages);
    return this.parseBuyingTriggers(response);
  }

  private async analyzeDecisionProcesses(content: string[], query: string): Promise<DecisionProcess[]> {
    const messages = [
      new SystemMessage(`${this.getSystemPrompt()}

Analyze decision-making processes from the provided content. For each process, identify:
- Description of the decision-making process
- Typical duration of the process
- Key stakeholders involved
- Real examples of companies following this process
- Source of information

Focus on decision processes that affect sales cycles and purchasing timelines.`),
      new HumanMessage(`Query: "${query}"

Content to analyze:
${content.join('\n\n')}

Extract and analyze decision-making processes and create process profiles.`)
    ];

    const response = await this.callLLM(messages);
    return this.parseDecisionProcesses(response);
  }

  private async analyzeBudgetBehaviors(content: string[], query: string): Promise<BudgetBehavior[]> {
    const messages = [
      new SystemMessage(`${this.getSystemPrompt()}

Analyze budget behaviors from the provided content. For each behavior, identify:
- Description of the budget behavior or allocation pattern
- Specific characteristics of this behavior
- Real examples of companies exhibiting this behavior
- Source of information

Focus on budget behaviors that affect purchasing decisions and spending patterns.`),
      new HumanMessage(`Query: "${query}"

Content to analyze:
${content.join('\n\n')}

Extract and analyze budget behaviors and create behavior profiles.`)
    ];

    const response = await this.callLLM(messages);
    return this.parseBudgetBehaviors(response);
  }

  // Parsing methods
  private parsePainPoints(response: string): PainPoint[] {
    try {
      const parsed = JSON.parse(response);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return this.extractPainPointsFromText(response);
    }
  }

  private parseBuyingTriggers(response: string): BuyingTrigger[] {
    try {
      const parsed = JSON.parse(response);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return this.extractBuyingTriggersFromText(response);
    }
  }

  private parseDecisionProcesses(response: string): DecisionProcess[] {
    try {
      const parsed = JSON.parse(response);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return this.extractDecisionProcessesFromText(response);
    }
  }

  private parseBudgetBehaviors(response: string): BudgetBehavior[] {
    try {
      const parsed = JSON.parse(response);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return this.extractBudgetBehaviorsFromText(response);
    }
  }

  // Fallback text parsing methods
  private extractPainPointsFromText(text: string): PainPoint[] {
    // Implement text parsing logic for pain points
    return [];
  }

  private extractBuyingTriggersFromText(text: string): BuyingTrigger[] {
    // Implement text parsing logic for buying triggers
    return [];
  }

  private extractDecisionProcessesFromText(text: string): DecisionProcess[] {
    // Implement text parsing logic for decision processes
    return [];
  }

  private extractBudgetBehaviorsFromText(text: string): BudgetBehavior[] {
    // Implement text parsing logic for budget behaviors
    return [];
  }

  private createEmptyPsychographicData(): PsychographicData {
    return {
      painPoints: [],
      buyingTriggers: [],
      decisionProcesses: [],
      budgetBehaviors: []
    };
  }
}