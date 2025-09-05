import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { BaseAgent } from '../base-agent';
import { 
  AgentTask, 
  MarketResearchData,
  IndustryTrend,
  MarketSizeData,
  CompetitiveData,
  GrowthRate,
  RegulatoryInfo
} from '../types';

export class MarketResearchAgent extends BaseAgent {
  constructor(llm: ChatOpenAI, streamingLlm: ChatOpenAI) {
    super(
      'market-research-agent',
      'Market Research Agent',
      'Specializes in gathering market intelligence, industry trends, competitive landscape, and regulatory environment data',
      [
        {
          name: 'industry-trend-analysis',
          description: 'Analyzes industry trends and market dynamics',
          inputTypes: ['market-data', 'industry-reports', 'news-articles'],
          outputTypes: ['industry-trends', 'market-dynamics'],
          estimatedDuration: 25000
        },
        {
          name: 'market-size-analysis',
          description: 'Calculates and analyzes market size metrics (TAM, SAM, SOM)',
          inputTypes: ['market-data', 'industry-reports'],
          outputTypes: ['market-size', 'growth-projections'],
          estimatedDuration: 20000
        },
        {
          name: 'competitive-landscape-analysis',
          description: 'Analyzes competitive landscape and market positioning',
          inputTypes: ['competitor-data', 'market-reports'],
          outputTypes: ['competitive-analysis', 'market-positioning'],
          estimatedDuration: 30000
        },
        {
          name: 'regulatory-environment-analysis',
          description: 'Analyzes regulatory environment and compliance requirements',
          inputTypes: ['regulatory-documents', 'compliance-reports'],
          outputTypes: ['regulatory-analysis', 'compliance-requirements'],
          estimatedDuration: 20000
        }
      ],
      llm,
      streamingLlm
    );
  }

  getSystemPrompt(): string {
    return `You are a Market Research Agent specializing in gathering comprehensive market intelligence and industry analysis.

Your expertise includes:
- Analyzing industry trends and market dynamics
- Calculating market size metrics (TAM, SAM, SOM)
- Assessing competitive landscape and market positioning
- Understanding regulatory environment and compliance requirements
- Identifying growth opportunities and market gaps
- Analyzing market growth rates and projections

When conducting market research, focus on:
1. Current market trends and their impact
2. Market size and growth projections
3. Competitive landscape and key players
4. Regulatory environment and compliance requirements
5. Market opportunities and challenges
6. Industry growth rates and forecasts

Always provide data-driven insights with proper sourcing and confidence levels.`;
  }

  async executeTask(task: AgentTask): Promise<MarketResearchData> {
    try {
      const { query, sources } = task.input;

      this.emitThinking("Starting market research analysis", { query, sourceCount: sources.length });
      this.emitProgress("Initializing market research", 0);

      // Extract market-related content from sources
      this.emitThinking("Extracting market-related content from sources");
      const marketContent = this.extractMarketContent(sources);
      this.emitProgress("Market content extraction", 20, { extractedContent: marketContent.length });
      
      if (marketContent.length === 0) {
        this.emitThinking("No market content found, returning empty data");
        return this.createEmptyMarketResearchData();
      }

      this.emitFinding("Market Content", `Found ${marketContent.length} market-related content pieces`);

      // Analyze industry trends
      this.emitThinking("Analyzing industry trends and market dynamics");
      this.emitProgress("Industry trend analysis", 40);
      const industryTrends = await this.analyzeIndustryTrends(marketContent, query);
      this.emitFinding("Industry Trends", `Identified ${industryTrends.length} key industry trends`, 0.85);
      
      // Calculate market size
      this.emitThinking("Calculating market size metrics (TAM, SAM, SOM)");
      this.emitProgress("Market size calculation", 60);
      const marketSize = await this.calculateMarketSize(marketContent, query);
      this.emitFinding("Market Size", `Calculated TAM: ${marketSize.tam}, SAM: ${marketSize.sam}`, 0.8);
      
      // Analyze competitive landscape
      this.emitThinking("Analyzing competitive landscape and market positioning");
      this.emitProgress("Competitive analysis", 80);
      const competitiveLandscape = await this.analyzeCompetitiveLandscape(marketContent, query);
      this.emitFinding("Competitors", `Identified ${competitiveLandscape.length} key competitors`, 0.9);
      
      // Analyze growth rates
      this.emitThinking("Analyzing market growth rates and projections");
      this.emitProgress("Growth rate analysis", 90);
      const growthRates = await this.analyzeGrowthRates(marketContent, query);
      this.emitFinding("Growth Rates", `Analyzed ${growthRates.length} growth rate segments`, 0.75);
      
      // Analyze regulatory environment
      this.emitThinking("Analyzing regulatory environment and compliance requirements");
      this.emitProgress("Regulatory analysis", 95);
      const regulatoryEnvironment = await this.analyzeRegulatoryEnvironment(marketContent, query);
      this.emitFinding("Regulations", `Identified ${regulatoryEnvironment.length} regulatory factors`, 0.7);

      this.emitProgress("Market research complete", 100);
      this.emitThinking("Market research analysis completed successfully", {
        industryTrends: industryTrends.length,
        marketSize: marketSize,
        competitors: competitiveLandscape.length,
        growthRates: growthRates.length,
        regulations: regulatoryEnvironment.length
      });

      return {
        industryTrends,
        marketSize,
        competitiveLandscape,
        growthRates,
        regulatoryEnvironment
      };

    } catch (error) {
      this.emitEvent({
        type: 'agent-error',
        agentId: this.agent.id,
        timestamp: new Date(),
        message: `❌ Market Research Agent failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        data: error
      });
      throw new Error(`Market Research Agent failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private extractMarketContent(sources: unknown[]): string[] {
    const marketKeywords = [
      'market', 'industry', 'trend', 'growth', 'competition', 'competitive',
      'market size', 'TAM', 'SAM', 'SOM', 'revenue', 'forecast',
      'regulation', 'compliance', 'regulatory', 'policy', 'legislation',
      'market share', 'positioning', 'landscape', 'dynamics'
    ];

    return sources
      .filter(source => source.content)
      .map(source => source.content)
      .filter(content => 
        marketKeywords.some(keyword => 
          content.toLowerCase().includes(keyword.toLowerCase())
        )
      );
  }

  private async analyzeIndustryTrends(content: string[], query: string): Promise<IndustryTrend[]> {
    const messages = [
      new SystemMessage(`${this.getSystemPrompt()}

Analyze industry trends from the provided content. For each trend, identify:
- Specific trend description
- Impact level (high, medium, low)
- Timeframe for the trend
- Source of information
- Detailed description of the trend

Focus on trends that affect the target market and customer segments.`),
      new HumanMessage(`Query: "${query}"

Content to analyze:
${content.join('\n\n')}

Extract and analyze all relevant industry trends.`)
    ];

    const response = await this.callLLM(messages);
    return this.parseIndustryTrends(response);
  }

  private async calculateMarketSize(content: string[], query: string): Promise<MarketSizeData> {
    const messages = [
      new SystemMessage(`${this.getSystemPrompt()}

Calculate market size metrics from the provided content. Identify:
- Total Addressable Market (TAM)
- Serviceable Addressable Market (SAM)
- Serviceable Obtainable Market (SOM)
- Market growth rate
- Source of data

Provide realistic estimates based on available data.`),
      new HumanMessage(`Query: "${query}"

Content to analyze:
${content.join('\n\n')}

Calculate market size metrics and provide structured data.`)
    ];

    const response = await this.callLLM(messages);
    return this.parseMarketSize(response);
  }

  private async analyzeCompetitiveLandscape(content: string[], query: string): Promise<CompetitiveData[]> {
    const messages = [
      new SystemMessage(`${this.getSystemPrompt()}

Analyze the competitive landscape from the provided content. For each competitor, identify:
- Competitor name
- Market share (if available)
- Key strengths
- Key weaknesses
- Market positioning
- Source of information

Focus on direct and indirect competitors in the target market.`),
      new HumanMessage(`Query: "${query}"

Content to analyze:
${content.join('\n\n')}

Analyze the competitive landscape and identify key competitors.`)
    ];

    const response = await this.callLLM(messages);
    return this.parseCompetitiveData(response);
  }

  private async analyzeGrowthRates(content: string[], query: string): Promise<GrowthRate[]> {
    const messages = [
      new SystemMessage(`${this.getSystemPrompt()}

Analyze growth rates from the provided content. For each growth rate, identify:
- Market segment or category
- Growth rate percentage
- Timeframe for the growth rate
- Source of data

Focus on growth rates relevant to the target market segments.`),
      new HumanMessage(`Query: "${query}"

Content to analyze:
${content.join('\n\n')}

Extract and analyze growth rates for relevant market segments.`)
    ];

    const response = await this.callLLM(messages);
    return this.parseGrowthRates(response);
  }

  private async analyzeRegulatoryEnvironment(content: string[], query: string): Promise<RegulatoryInfo[]> {
    const messages = [
      new SystemMessage(`${this.getSystemPrompt()}

Analyze the regulatory environment from the provided content. For each regulatory factor, identify:
- Specific regulation or policy
- Impact on the market
- Compliance requirements
- Source of information

Focus on regulations that affect the target market and customer segments.`),
      new HumanMessage(`Query: "${query}"

Content to analyze:
${content.join('\n\n')}

Analyze the regulatory environment and identify key regulations.`)
    ];

    const response = await this.callLLM(messages);
    return this.parseRegulatoryInfo(response);
  }

  // Parsing methods
  private parseIndustryTrends(response: string): IndustryTrend[] {
    try {
      const parsed = JSON.parse(response);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return this.extractIndustryTrendsFromText(response);
    }
  }

  private parseMarketSize(response: string): MarketSizeData {
    try {
      const parsed = JSON.parse(response);
      return parsed;
    } catch {
      return this.extractMarketSizeFromText(response);
    }
  }

  private parseCompetitiveData(response: string): CompetitiveData[] {
    try {
      const parsed = JSON.parse(response);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return this.extractCompetitiveDataFromText(response);
    }
  }

  private parseGrowthRates(response: string): GrowthRate[] {
    try {
      const parsed = JSON.parse(response);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return this.extractGrowthRatesFromText(response);
    }
  }

  private parseRegulatoryInfo(response: string): RegulatoryInfo[] {
    try {
      const parsed = JSON.parse(response);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return this.extractRegulatoryInfoFromText(response);
    }
  }

  // Fallback text parsing methods
  private extractIndustryTrendsFromText(_text: string): IndustryTrend[] {
    // Implement text parsing logic for industry trends
    return [];
  }

  private extractMarketSizeFromText(_text: string): MarketSizeData {
    // Implement text parsing logic for market size
    return {
      tam: 'Not available',
      sam: 'Not available',
      som: 'Not available',
      growthRate: 'Not available',
      source: 'Text analysis'
    };
  }

  private extractCompetitiveDataFromText(_text: string): CompetitiveData[] {
    // Implement text parsing logic for competitive data
    return [];
  }

  private extractGrowthRatesFromText(_text: string): GrowthRate[] {
    // Implement text parsing logic for growth rates
    return [];
  }

  private extractRegulatoryInfoFromText(_text: string): RegulatoryInfo[] {
    // Implement text parsing logic for regulatory info
    return [];
  }

  private createEmptyMarketResearchData(): MarketResearchData {
    return {
      industryTrends: [],
      marketSize: {
        tam: 'Not available',
        sam: 'Not available',
        som: 'Not available',
        growthRate: 'Not available',
        source: 'No data available'
      },
      competitiveLandscape: [],
      growthRates: [],
      regulatoryEnvironment: []
    };
  }
}