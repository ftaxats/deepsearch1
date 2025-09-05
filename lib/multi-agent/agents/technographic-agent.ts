import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { BaseAgent } from '../base-agent';
import { 
  AgentTask, 
  TechnographicData,
  TechStack,
  Integration,
  DigitalMaturityLevel,
  PlatformRequirement
} from '../types';

export class TechnographicAgent extends BaseAgent {
  constructor(llm: ChatOpenAI, streamingLlm: ChatOpenAI) {
    super(
      'technographic-agent',
      'Technographic Agent',
      'Specializes in analyzing technology stacks, integrations, digital maturity, and platform requirements',
      [
        {
          name: 'tech-stack-analysis',
          description: 'Analyzes technology stacks and tool usage patterns',
          inputTypes: ['tech-data', 'tool-data', 'platform-data'],
          outputTypes: ['tech-stacks', 'tool-patterns'],
          estimatedDuration: 25000
        },
        {
          name: 'integration-analysis',
          description: 'Analyzes integration requirements and API usage',
          inputTypes: ['integration-data', 'api-data', 'connectivity-data'],
          outputTypes: ['integration-requirements', 'api-patterns'],
          estimatedDuration: 20000
        },
        {
          name: 'digital-maturity-analysis',
          description: 'Analyzes digital transformation maturity levels',
          inputTypes: ['maturity-data', 'transformation-data', 'adoption-data'],
          outputTypes: ['maturity-levels', 'transformation-patterns'],
          estimatedDuration: 20000
        },
        {
          name: 'platform-requirements-analysis',
          description: 'Analyzes platform and infrastructure requirements',
          inputTypes: ['platform-data', 'infrastructure-data', 'requirements-data'],
          outputTypes: ['platform-requirements', 'infrastructure-patterns'],
          estimatedDuration: 20000
        }
      ],
      llm,
      streamingLlm
    );
  }

  getSystemPrompt(): string {
    return `You are a Technographic Agent specializing in analyzing technology adoption and usage patterns.

Your expertise includes:
- Analyzing technology stacks and tool usage patterns
- Understanding integration requirements and API usage
- Assessing digital transformation maturity levels
- Analyzing platform and infrastructure requirements
- Identifying technology adoption patterns
- Understanding technical decision-making processes

When analyzing technographic data, focus on:
1. Current technology stacks and tools used
2. Integration requirements and API needs
3. Digital transformation maturity levels
4. Platform and infrastructure requirements
5. Technology adoption patterns and trends
6. Technical decision-making criteria

Always provide structured, actionable insights about technology usage and requirements.`;
  }

  async executeTask(task: AgentTask): Promise<TechnographicData> {
    try {
      const { query, sources } = task.input as { query: string; sources: unknown[] };

      // Extract technographic content from sources
      const technographicContent = this.extractTechnographicContent(sources);
      
      if (technographicContent.length === 0) {
        return this.createEmptyTechnographicData();
      }

      // Analyze tech stacks
      const techStacks = await this.analyzeTechStacks(technographicContent, query);
      
      // Analyze integrations
      const integrations = await this.analyzeIntegrations(technographicContent, query);
      
      // Analyze digital maturity
      const digitalMaturity = await this.analyzeDigitalMaturity(technographicContent, query);
      
      // Analyze platform requirements
      const platformRequirements = await this.analyzePlatformRequirements(technographicContent, query);

      return {
        techStacks,
        integrations,
        digitalMaturity,
        platformRequirements
      };

    } catch (error) {
      throw new Error(`Technographic Agent failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private extractTechnographicContent(sources: unknown[]): string[] {
    const technographicKeywords = [
      'technology', 'tech stack', 'software', 'platform', 'tool',
      'integration', 'API', 'connectivity', 'system', 'infrastructure',
      'cloud', 'SaaS', 'on-premise', 'hybrid', 'digital',
      'transformation', 'adoption', 'migration', 'upgrade',
      'CRM', 'ERP', 'marketing automation', 'analytics', 'database',
      'security', 'compliance', 'scalability', 'performance'
    ];

    return sources
      .filter(source => (source as { content?: string }).content)
      .map(source => (source as { content: string }).content)
      .filter(content => 
        technographicKeywords.some(keyword => 
          content.toLowerCase().includes(keyword.toLowerCase())
        )
      );
  }

  private async analyzeTechStacks(content: string[], query: string): Promise<TechStack[]> {
    const messages = [
      new SystemMessage(`${this.getSystemPrompt()}

Analyze technology stacks from the provided content. For each tech stack category, identify:
- Technology category (e.g., "CRM", "Marketing Automation", "Analytics")
- Specific tools and platforms used
- Characteristics of companies using these tools
- Real examples of companies using these tools
- Source of information

Focus on technology categories that are relevant to the target market.`),
      new HumanMessage(`Query: "${query}"

Content to analyze:
${content.join('\n\n')}

Extract and analyze technology stacks and create tech stack profiles.`)
    ];

    const response = await this.callLLM(messages);
    return this.parseTechStacks(response);
  }

  private async analyzeIntegrations(content: string[], query: string): Promise<Integration[]> {
    const messages = [
      new SystemMessage(`${this.getSystemPrompt()}

Analyze integration requirements from the provided content. For each integration type, identify:
- Type of integration (e.g., "API", "Webhook", "Database", "File Transfer")
- Specific requirements and capabilities needed
- Real examples of companies with these integration needs
- Source of information

Focus on integration requirements that affect purchasing decisions.`),
      new HumanMessage(`Query: "${query}"

Content to analyze:
${content.join('\n\n')}

Extract and analyze integration requirements and create integration profiles.`)
    ];

    const response = await this.callLLM(messages);
    return this.parseIntegrations(response);
  }

  private async analyzeDigitalMaturity(content: string[], query: string): Promise<DigitalMaturityLevel[]> {
    const messages = [
      new SystemMessage(`${this.getSystemPrompt()}

Analyze digital maturity levels from the provided content. For each maturity level, identify:
- Maturity level (e.g., "Basic", "Intermediate", "Advanced", "Leading")
- Specific characteristics of companies at this level
- Real examples of companies at this maturity level
- Source of information

Focus on digital maturity levels that correlate with technology adoption and purchasing behavior.`),
      new HumanMessage(`Query: "${query}"

Content to analyze:
${content.join('\n\n')}

Extract and analyze digital maturity levels and create maturity profiles.`)
    ];

    const response = await this.callLLM(messages);
    return this.parseDigitalMaturityLevels(response);
  }

  private async analyzePlatformRequirements(content: string[], query: string): Promise<PlatformRequirement[]> {
    const messages = [
      new SystemMessage(`${this.getSystemPrompt()}

Analyze platform requirements from the provided content. For each requirement, identify:
- Specific platform requirement (e.g., "Scalability", "Security", "Compliance", "Performance")
- Importance level (high, medium, low)
- Real examples of companies with these requirements
- Source of information

Focus on platform requirements that are critical for purchasing decisions.`),
      new HumanMessage(`Query: "${query}"

Content to analyze:
${content.join('\n\n')}

Extract and analyze platform requirements and create requirement profiles.`)
    ];

    const response = await this.callLLM(messages);
    return this.parsePlatformRequirements(response);
  }

  // Parsing methods
  private parseTechStacks(response: string): TechStack[] {
    try {
      const parsed = JSON.parse(response);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return this.extractTechStacksFromText(response);
    }
  }

  private parseIntegrations(response: string): Integration[] {
    try {
      const parsed = JSON.parse(response);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return this.extractIntegrationsFromText(response);
    }
  }

  private parseDigitalMaturityLevels(response: string): DigitalMaturityLevel[] {
    try {
      const parsed = JSON.parse(response);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return this.extractDigitalMaturityLevelsFromText(response);
    }
  }

  private parsePlatformRequirements(response: string): PlatformRequirement[] {
    try {
      const parsed = JSON.parse(response);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return this.extractPlatformRequirementsFromText(response);
    }
  }

  // Fallback text parsing methods
  private extractTechStacksFromText(text: string): TechStack[] {
    console.log(`Extracting tech stacks from ${text.length} characters`);
    // Implement text parsing logic for tech stacks
    return [];
  }

  private extractIntegrationsFromText(text: string): Integration[] {
    console.log(`Extracting integrations from ${text.length} characters`);
    // Implement text parsing logic for integrations
    return [];
  }

  private extractDigitalMaturityLevelsFromText(text: string): DigitalMaturityLevel[] {
    console.log(`Extracting digital maturity levels from ${text.length} characters`);
    // Implement text parsing logic for digital maturity levels
    return [];
  }

  private extractPlatformRequirementsFromText(text: string): PlatformRequirement[] {
    console.log(`Extracting platform requirements from ${text.length} characters`);
    // Implement text parsing logic for platform requirements
    return [];
  }

  private createEmptyTechnographicData(): TechnographicData {
    return {
      techStacks: [],
      integrations: [],
      digitalMaturity: [],
      platformRequirements: []
    };
  }
}