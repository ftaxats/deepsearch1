import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { BaseAgent } from '../base-agent';
import { 
  AgentTask, 
  TargetCompanyData,
  TargetCompany,
  CompanyValidation,
  MarketMap
} from '../types';

export class TargetCompanyDiscoveryAgent extends BaseAgent {
  constructor(llm: ChatOpenAI, streamingLlm: ChatOpenAI) {
    super(
      'target-company-discovery-agent',
      'Target Company Discovery Agent',
      'Specializes in discovering and validating specific target companies based on ICP characteristics and patterns',
      [
        {
          name: 'company-discovery',
          description: 'Discovers specific target companies matching ICP criteria',
          inputTypes: ['icp-criteria', 'company-database', 'market-data'],
          outputTypes: ['target-companies', 'company-profiles'],
          estimatedDuration: 30000
        },
        {
          name: 'company-validation',
          description: 'Validates discovered companies against ICP criteria',
          inputTypes: ['company-list', 'validation-criteria', 'icp-profile'],
          outputTypes: ['validation-results', 'company-scores'],
          estimatedDuration: 25000
        },
        {
          name: 'market-mapping',
          description: 'Creates market maps and opportunity analysis',
          inputTypes: ['company-data', 'market-segments', 'opportunity-data'],
          outputTypes: ['market-maps', 'opportunity-analysis'],
          estimatedDuration: 20000
        }
      ],
      llm,
      streamingLlm
    );
  }

  getSystemPrompt(): string {
    return `You are a Target Company Discovery Agent specializing in finding and validating specific companies that match ICP criteria.

Your expertise includes:
- Discovering specific target companies based on ICP characteristics
- Validating companies against firmographic, technographic, and psychographic criteria
- Creating market maps and opportunity analysis
- Researching company details including size, industry, location, and technology stack
- Assessing company fit and confidence scores
- Identifying market segments and opportunities

When discovering target companies, focus on:
1. Specific company names and domains
2. Company size and employee count
3. Industry and business model
4. Geographic location
5. Technology stack and digital maturity
6. Revenue and funding information
7. Fit confidence and reasoning

Always provide real, verifiable companies with specific reasoning for why they fit the ICP.`;
  }

  async executeTask(task: AgentTask): Promise<TargetCompanyData> {
    try {
      const { query, customerIntelligence, marketResearch, firmographicData } = task.input;

      // Extract ICP criteria from gathered data
      const icpCriteria = this.extractICPCriteria(customerIntelligence, marketResearch, firmographicData);
      
      if (Object.keys(icpCriteria).length === 0) {
        return this.createEmptyTargetCompanyData();
      }

      // Discover target companies
      const companies = await this.discoverTargetCompanies(icpCriteria, query);
      
      // Validate discovered companies
      const validationResults = await this.validateCompanies(companies, icpCriteria);
      
      // Create market maps
      const marketMapping = await this.createMarketMaps(companies, icpCriteria);

      return {
        companies,
        validationResults,
        marketMapping
      };

    } catch (error) {
      throw new Error(`Target Company Discovery Agent failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private extractICPCriteria(
    customerIntelligence: unknown,
    marketResearch: unknown,
    firmographicData: unknown
  ): Record<string, unknown> {
    const criteria: Record<string, unknown> = {};

    // Extract from customer intelligence
    if (customerIntelligence?.patterns) {
      criteria.industryPatterns = customerIntelligence.patterns
        .filter((p: unknown) => (p as { characteristic: string }).characteristic.includes('industry'))
        .map((p: unknown) => (p as { examples: unknown }).examples);
      
      criteria.sizePatterns = customerIntelligence.patterns
        .filter((p: unknown) => {
          const pattern = p as { characteristic: string };
          return pattern.characteristic.includes('size') || pattern.characteristic.includes('employee');
        })
        .map((p: unknown) => (p as { examples: unknown }).examples);
    }

    // Extract from market research
    if (marketResearch?.industryTrends) {
      criteria.targetIndustries = marketResearch.industryTrends
        .map((trend: unknown) => (trend as { trend: string }).trend)
        .filter((trend: string) => trend.includes('industry') || trend.includes('sector'));
    }

    // Extract from firmographic data
    if (firmographicData?.companySizes) {
      criteria.sizeRanges = firmographicData.companySizes
        .map((size: unknown) => (size as { range: string }).range);
    }

    if (firmographicData?.industrySegments) {
      criteria.industrySegments = firmographicData.industrySegments
        .map((segment: unknown) => (segment as { segment: string }).segment);
    }

    if (firmographicData?.geographicData) {
      criteria.targetRegions = firmographicData.geographicData
        .map((geo: unknown) => (geo as { region: string }).region);
    }

    return criteria;
  }

  private async discoverTargetCompanies(criteria: Record<string, any>, query: string): Promise<TargetCompany[]> {
    const messages = [
      new SystemMessage(`${this.getSystemPrompt()}

Based on the provided ICP criteria, discover specific target companies that match the characteristics. For each company, provide:
- Company name and domain
- Industry and business model
- Company size (employee count range)
- Geographic location
- Revenue range (if available)
- Funding stage (if available)
- Technology stack indicators
- Specific reasoning for why this company fits the ICP
- Confidence score (0-1)

Focus on finding real, verifiable companies that match the patterns identified in the customer intelligence data.`),
      new HumanMessage(`Query: "${query}"

ICP Criteria:
${JSON.stringify(criteria, null, 2)}

Discover 15-20 specific target companies that match these criteria. Provide real company names and domains.`)
    ];

    const response = await this.callLLM(messages);
    return this.parseTargetCompanies(response);
  }

  private async validateCompanies(companies: TargetCompany[], criteria: Record<string, unknown>): Promise<CompanyValidation[]> {
    const messages = [
      new SystemMessage(`${this.getSystemPrompt()}

Validate the discovered companies against the ICP criteria. For each company, assess:
- Whether the company is a valid match for the ICP
- Specific reasons for validation or rejection
- Confidence score in the validation (0-1)
- Source of validation information

Focus on ensuring companies truly match the identified patterns and characteristics.`),
      new HumanMessage(`Companies to validate:
${JSON.stringify(companies, null, 2)}

ICP Criteria:
${JSON.stringify(criteria, null, 2)}

Validate each company and provide detailed reasoning.`)
    ];

    const response = await this.callLLM(messages);
    return this.parseCompanyValidations(response);
  }

  private async createMarketMaps(companies: TargetCompany[], criteria: Record<string, unknown>): Promise<MarketMap[]> {
    const messages = [
      new SystemMessage(`${this.getSystemPrompt()}

Create market maps based on the discovered companies. For each market segment, identify:
- Market segment name
- Companies in this segment
- Market size or opportunity
- Key characteristics of this segment
- Source of information

Group companies into logical market segments based on industry, size, geography, or other relevant factors.`),
      new HumanMessage(`Companies to map:
${JSON.stringify(companies, null, 2)}

ICP Criteria:
${JSON.stringify(criteria, null, 2)}

Create market maps and segment the companies logically.`)
    ];

    const response = await this.callLLM(messages);
    return this.parseMarketMaps(response);
  }

  // Parsing methods
  private parseTargetCompanies(response: string): TargetCompany[] {
    try {
      const parsed = JSON.parse(response);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return this.extractTargetCompaniesFromText(response);
    }
  }

  private parseCompanyValidations(response: string): CompanyValidation[] {
    try {
      const parsed = JSON.parse(response);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return this.extractCompanyValidationsFromText(response);
    }
  }

  private parseMarketMaps(response: string): MarketMap[] {
    try {
      const parsed = JSON.parse(response);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return this.extractMarketMapsFromText(response);
    }
  }

  // Fallback text parsing methods
  private extractTargetCompaniesFromText(_text: string): TargetCompany[] {
    // Implement text parsing logic for target companies
    return [];
  }

  private extractCompanyValidationsFromText(_text: string): CompanyValidation[] {
    // Implement text parsing logic for company validations
    return [];
  }

  private extractMarketMapsFromText(_text: string): MarketMap[] {
    // Implement text parsing logic for market maps
    return [];
  }

  private createEmptyTargetCompanyData(): TargetCompanyData {
    return {
      companies: [],
      validationResults: [],
      marketMapping: []
    };
  }
}