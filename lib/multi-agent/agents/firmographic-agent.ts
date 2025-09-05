import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { BaseAgent } from '../base-agent';
import { 
  AgentTask, 
  FirmographicData,
  CompanySizeProfile,
  RevenueRange,
  FundingStage,
  GeographicProfile,
  IndustrySegment
} from '../types';

export class FirmographicAgent extends BaseAgent {
  constructor(llm: ChatOpenAI, streamingLlm: ChatOpenAI) {
    super(
      'firmographic-agent',
      'Firmographic Agent',
      'Specializes in analyzing company demographics including size, revenue, funding, geography, and industry segments',
      [
        {
          name: 'company-size-analysis',
          description: 'Analyzes company size patterns and employee count distributions',
          inputTypes: ['company-data', 'employee-data', 'size-metrics'],
          outputTypes: ['company-size-profiles', 'size-distributions'],
          estimatedDuration: 20000
        },
        {
          name: 'revenue-analysis',
          description: 'Analyzes revenue ranges and financial characteristics',
          inputTypes: ['financial-data', 'revenue-data', 'funding-data'],
          outputTypes: ['revenue-ranges', 'financial-profiles'],
          estimatedDuration: 20000
        },
        {
          name: 'funding-stage-analysis',
          description: 'Analyzes funding stages and investment characteristics',
          inputTypes: ['funding-data', 'investment-data', 'startup-data'],
          outputTypes: ['funding-stages', 'investment-profiles'],
          estimatedDuration: 20000
        },
        {
          name: 'geographic-analysis',
          description: 'Analyzes geographic distribution and regional characteristics',
          inputTypes: ['location-data', 'geographic-data', 'regional-data'],
          outputTypes: ['geographic-profiles', 'regional-analysis'],
          estimatedDuration: 20000
        },
        {
          name: 'industry-segment-analysis',
          description: 'Analyzes industry segments and vertical characteristics',
          inputTypes: ['industry-data', 'vertical-data', 'sector-data'],
          outputTypes: ['industry-segments', 'vertical-profiles'],
          estimatedDuration: 20000
        }
      ],
      llm,
      streamingLlm
    );
  }

  getSystemPrompt(): string {
    return `You are a Firmographic Agent specializing in analyzing company demographics and characteristics.

Your expertise includes:
- Analyzing company size patterns and employee distributions
- Understanding revenue ranges and financial characteristics
- Assessing funding stages and investment patterns
- Analyzing geographic distribution and regional characteristics
- Understanding industry segments and vertical markets
- Identifying firmographic patterns for ICP development

When analyzing firmographic data, focus on:
1. Company size ranges and employee count distributions
2. Revenue ranges and financial characteristics
3. Funding stages and investment patterns
4. Geographic distribution and regional presence
5. Industry segments and vertical markets
6. Firmographic patterns and correlations

Always provide structured, quantifiable data with clear categorizations and examples.`;
  }

  async executeTask(task: AgentTask): Promise<FirmographicData> {
    try {
      const { query, sources } = task.input as { query: string; sources: unknown[] };

      // Extract firmographic content from sources
      const firmographicContent = this.extractFirmographicContent(sources);
      
      if (firmographicContent.length === 0) {
        return this.createEmptyFirmographicData();
      }

      // Analyze company sizes
      const companySizes = await this.analyzeCompanySizes(firmographicContent, query);
      
      // Analyze revenue ranges
      const revenueRanges = await this.analyzeRevenueRanges(firmographicContent, query);
      
      // Analyze funding stages
      const fundingStages = await this.analyzeFundingStages(firmographicContent, query);
      
      // Analyze geographic data
      const geographicData = await this.analyzeGeographicData(firmographicContent, query);
      
      // Analyze industry segments
      const industrySegments = await this.analyzeIndustrySegments(firmographicContent, query);

      return {
        companySizes,
        revenueRanges,
        fundingStages,
        geographicData,
        industrySegments
      };

    } catch (error) {
      throw new Error(`Firmographic Agent failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private extractFirmographicContent(sources: unknown[]): string[] {
    const firmographicKeywords = [
      'company', 'business', 'organization', 'enterprise', 'startup',
      'employees', 'staff', 'team size', 'headcount', 'workforce',
      'revenue', 'sales', 'income', 'earnings', 'financial',
      'funding', 'investment', 'venture', 'capital', 'series',
      'location', 'geography', 'region', 'country', 'city',
      'industry', 'sector', 'vertical', 'market', 'business model'
    ];

    return sources
      .filter(source => (source as { content?: string }).content)
      .map(source => (source as { content: string }).content)
      .filter(content => 
        firmographicKeywords.some(keyword => 
          content.toLowerCase().includes(keyword.toLowerCase())
        )
      );
  }

  private async analyzeCompanySizes(content: string[], query: string): Promise<CompanySizeProfile[]> {
    const messages = [
      new SystemMessage(`${this.getSystemPrompt()}

Analyze company size patterns from the provided content. For each size range, identify:
- Employee count range (e.g., "10-50", "51-200", "201-1000")
- Specific characteristics of companies in this range
- Real examples of companies in this range
- Source of information

Focus on creating meaningful size categories that can be used for ICP development.`),
      new HumanMessage(`Query: "${query}"

Content to analyze:
${content.join('\n\n')}

Extract and analyze company size patterns and create size profiles.`)
    ];

    const response = await this.callLLM(messages);
    return this.parseCompanySizeProfiles(response);
  }

  private async analyzeRevenueRanges(content: string[], query: string): Promise<RevenueRange[]> {
    const messages = [
      new SystemMessage(`${this.getSystemPrompt()}

Analyze revenue ranges from the provided content. For each revenue range, identify:
- Revenue range (e.g., "$1M-$10M", "$10M-$50M", "$50M+")
- Specific characteristics of companies in this range
- Real examples of companies in this range
- Source of information

Focus on creating meaningful revenue categories that correlate with company behavior.`),
      new HumanMessage(`Query: "${query}"

Content to analyze:
${content.join('\n\n')}

Extract and analyze revenue ranges and create revenue profiles.`)
    ];

    const response = await this.callLLM(messages);
    return this.parseRevenueRanges(response);
  }

  private async analyzeFundingStages(content: string[], query: string): Promise<FundingStage[]> {
    const messages = [
      new SystemMessage(`${this.getSystemPrompt()}

Analyze funding stages from the provided content. For each funding stage, identify:
- Funding stage (e.g., "Seed", "Series A", "Series B", "Public")
- Specific characteristics of companies in this stage
- Real examples of companies in this stage
- Source of information

Focus on funding stages that affect company behavior and purchasing decisions.`),
      new HumanMessage(`Query: "${query}"

Content to analyze:
${content.join('\n\n')}

Extract and analyze funding stages and create funding profiles.`)
    ];

    const response = await this.callLLM(messages);
    return this.parseFundingStages(response);
  }

  private async analyzeGeographicData(content: string[], query: string): Promise<GeographicProfile[]> {
    const messages = [
      new SystemMessage(`${this.getSystemPrompt()}

Analyze geographic distribution from the provided content. For each geographic region, identify:
- Geographic region or location
- Specific characteristics of companies in this region
- Market size or opportunity in this region
- Real examples of companies in this region
- Source of information

Focus on geographic patterns that affect market access and customer behavior.`),
      new HumanMessage(`Query: "${query}"

Content to analyze:
${content.join('\n\n')}

Extract and analyze geographic distribution and create geographic profiles.`)
    ];

    const response = await this.callLLM(messages);
    return this.parseGeographicProfiles(response);
  }

  private async analyzeIndustrySegments(content: string[], query: string): Promise<IndustrySegment[]> {
    const messages = [
      new SystemMessage(`${this.getSystemPrompt()}

Analyze industry segments from the provided content. For each industry segment, identify:
- Industry segment or vertical
- Specific characteristics of companies in this segment
- Market size or opportunity in this segment
- Real examples of companies in this segment
- Source of information

Focus on industry segments that represent distinct customer groups with different needs.`),
      new HumanMessage(`Query: "${query}"

Content to analyze:
${content.join('\n\n')}

Extract and analyze industry segments and create industry profiles.`)
    ];

    const response = await this.callLLM(messages);
    return this.parseIndustrySegments(response);
  }

  // Parsing methods
  private parseCompanySizeProfiles(response: string): CompanySizeProfile[] {
    try {
      const parsed = JSON.parse(response);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return this.extractCompanySizeProfilesFromText(response);
    }
  }

  private parseRevenueRanges(response: string): RevenueRange[] {
    try {
      const parsed = JSON.parse(response);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return this.extractRevenueRangesFromText(response);
    }
  }

  private parseFundingStages(response: string): FundingStage[] {
    try {
      const parsed = JSON.parse(response);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return this.extractFundingStagesFromText(response);
    }
  }

  private parseGeographicProfiles(response: string): GeographicProfile[] {
    try {
      const parsed = JSON.parse(response);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return this.extractGeographicProfilesFromText(response);
    }
  }

  private parseIndustrySegments(response: string): IndustrySegment[] {
    try {
      const parsed = JSON.parse(response);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return this.extractIndustrySegmentsFromText(response);
    }
  }

  // Fallback text parsing methods
  private extractCompanySizeProfilesFromText(text: string): CompanySizeProfile[] {
    console.log(`Extracting company size profiles from ${text.length} characters`);
    // Implement text parsing logic for company size profiles
    return [];
  }

  private extractRevenueRangesFromText(text: string): RevenueRange[] {
    console.log(`Extracting revenue ranges from ${text.length} characters`);
    // Implement text parsing logic for revenue ranges
    return [];
  }

  private extractFundingStagesFromText(text: string): FundingStage[] {
    console.log(`Extracting funding stages from ${text.length} characters`);
    // Implement text parsing logic for funding stages
    return [];
  }

  private extractGeographicProfilesFromText(text: string): GeographicProfile[] {
    console.log(`Extracting geographic profiles from ${text.length} characters`);
    // Implement text parsing logic for geographic profiles
    return [];
  }

  private extractIndustrySegmentsFromText(text: string): IndustrySegment[] {
    console.log(`Extracting industry segments from ${text.length} characters`);
    // Implement text parsing logic for industry segments
    return [];
  }

  private createEmptyFirmographicData(): FirmographicData {
    return {
      companySizes: [],
      revenueRanges: [],
      fundingStages: [],
      geographicData: [],
      industrySegments: []
    };
  }
}