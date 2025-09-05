import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { BaseAgent } from '../base-agent';
import { 
  AgentTask, 
  CustomerIntelligenceData,
  CustomerCaseStudy,
  CustomerTestimonial,
  SuccessStory,
  CustomerJourneyStep,
  CustomerPattern
} from '../types';

export class CustomerIntelligenceAgent extends BaseAgent {
  constructor(llm: ChatOpenAI, streamingLlm: ChatOpenAI) {
    super(
      'customer-intelligence-agent',
      'Customer Intelligence Agent',
      'Specializes in analyzing customer case studies, testimonials, and success stories to identify patterns and characteristics of successful customers',
      [
        {
          name: 'customer-pattern-analysis',
          description: 'Analyzes customer case studies to identify common patterns and characteristics',
          inputTypes: ['customer-case-studies', 'testimonials', 'success-stories'],
          outputTypes: ['customer-patterns', 'customer-journey'],
          estimatedDuration: 30000
        },
        {
          name: 'testimonial-analysis',
          description: 'Extracts insights from customer testimonials and reviews',
          inputTypes: ['testimonials', 'reviews'],
          outputTypes: ['testimonial-insights', 'customer-sentiment'],
          estimatedDuration: 20000
        },
        {
          name: 'success-story-extraction',
          description: 'Identifies and analyzes customer success stories',
          inputTypes: ['case-studies', 'success-stories'],
          outputTypes: ['success-patterns', 'outcome-metrics'],
          estimatedDuration: 25000
        }
      ],
      llm,
      streamingLlm
    );
  }

  getSystemPrompt(): string {
    return `You are a Customer Intelligence Agent specializing in analyzing customer data to identify patterns and characteristics of successful customers.

Your expertise includes:
- Analyzing customer case studies to extract key characteristics
- Identifying common patterns among successful customers
- Understanding customer journey stages and touchpoints
- Extracting pain points and success factors
- Analyzing customer testimonials for sentiment and insights

When analyzing customer data, focus on:
1. Company characteristics (size, industry, revenue, location)
2. Use cases and implementation patterns
3. Pain points and challenges faced
4. Success metrics and outcomes
5. Decision-making processes
6. Customer journey stages

Always provide structured, actionable insights that can be used for ICP development.`;
  }

  async executeTask(task: AgentTask): Promise<CustomerIntelligenceData> {
    try {
      const { query, sources } = task.input as { query: string; sources: unknown[] };

      this.emitThinking("Starting customer intelligence analysis", { query, sourceCount: sources.length });
      this.emitProgress("Initializing analysis", 0);

      // Extract customer-related content from sources
      this.emitThinking("Extracting customer-related content from sources");
      const customerContent = this.extractCustomerContent(sources);
      this.emitProgress("Content extraction", 20, { extractedContent: customerContent.length });
      
      if (customerContent.length === 0) {
        this.emitThinking("No customer content found, returning empty data");
        return this.createEmptyCustomerIntelligenceData();
      }

      this.emitFinding("Content Sources", `Found ${customerContent.length} customer-related content pieces`);

      // Analyze customer case studies
      this.emitThinking("Analyzing customer case studies for patterns and characteristics");
      this.emitProgress("Case study analysis", 40);
      const caseStudies = await this.analyzeCaseStudies(customerContent, query);
      this.emitFinding("Case Studies", `Identified ${caseStudies.length} customer case studies`, 0.9);
      
      // Analyze testimonials
      this.emitThinking("Extracting and analyzing customer testimonials");
      this.emitProgress("Testimonial analysis", 60);
      const testimonials = await this.analyzeTestimonials(customerContent, query);
      this.emitFinding("Testimonials", `Found ${testimonials.length} customer testimonials`, 0.8);
      
      // Extract success stories
      this.emitThinking("Identifying customer success stories and outcomes");
      this.emitProgress("Success story extraction", 80);
      const successStories = await this.extractSuccessStories(customerContent, query);
      this.emitFinding("Success Stories", `Extracted ${successStories.length} success stories`, 0.85);
      
      // Map customer journey
      this.emitThinking("Mapping customer journey stages and touchpoints");
      this.emitProgress("Journey mapping", 90);
      const customerJourney = await this.mapCustomerJourney(customerContent, query);
      this.emitFinding("Customer Journey", `Mapped ${customerJourney.length} journey stages`, 0.75);
      
      // Identify patterns
      this.emitThinking("Identifying common patterns across all customer data");
      this.emitProgress("Pattern identification", 95);
      const patterns = await this.identifyCustomerPatterns(caseStudies, testimonials, successStories);
      this.emitFinding("Customer Patterns", `Identified ${patterns.length} key patterns`, 0.9);

      this.emitProgress("Analysis complete", 100);
      this.emitThinking("Customer intelligence analysis completed successfully", {
        caseStudies: caseStudies.length,
        testimonials: testimonials.length,
        successStories: successStories.length,
        journeyStages: customerJourney.length,
        patterns: patterns.length
      });

      return {
        caseStudies,
        testimonials,
        successStories,
        customerJourney,
        patterns
      };

    } catch (error) {
      this.emitEvent({
        type: 'agent-error',
        agentId: this.agent.id,
        timestamp: new Date(),
        message: `❌ Customer Intelligence Agent failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        data: error
      });
      throw new Error(`Customer Intelligence Agent failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private extractCustomerContent(sources: unknown[]): string[] {
    const customerKeywords = [
      'customer', 'client', 'case study', 'testimonial', 'success story',
      'implementation', 'results', 'outcome', 'ROI', 'benefits',
      'challenge', 'solution', 'before', 'after', 'transformation'
    ];

    return sources
      .filter(source => (source as { content?: string }).content)
      .map(source => (source as { content: string }).content)
      .filter(content => 
        customerKeywords.some(keyword => 
          content.toLowerCase().includes(keyword.toLowerCase())
        )
      );
  }

  private async analyzeCaseStudies(content: string[], query: string): Promise<CustomerCaseStudy[]> {
    const messages = [
      new SystemMessage(`${this.getSystemPrompt()}

Extract customer case studies from the provided content. For each case study, identify:
- Company name and industry
- Company size (employee count or revenue range)
- Specific use case or challenge
- Results and outcomes achieved
- Implementation details
- Source of information

Format as structured data with clear company identification and measurable outcomes.`),
      new HumanMessage(`Query: "${query}"

Content to analyze:
${content.join('\n\n')}

Extract all customer case studies and format them as structured data.`)
    ];

    const response = await this.callLLM(messages);
    return this.parseCaseStudies(response);
  }

  private async analyzeTestimonials(content: string[], query: string): Promise<CustomerTestimonial[]> {
    const messages = [
      new SystemMessage(`${this.getSystemPrompt()}

Extract customer testimonials and quotes from the provided content. For each testimonial, identify:
- Company name
- Quote or testimonial text
- Role/title of the person quoted
- Industry of the company
- Source of the testimonial

Focus on authentic customer quotes and feedback.`),
      new HumanMessage(`Query: "${query}"

Content to analyze:
${content.join('\n\n')}

Extract all customer testimonials and format them as structured data.`)
    ];

    const response = await this.callLLM(messages);
    return this.parseTestimonials(response);
  }

  private async extractSuccessStories(content: string[], query: string): Promise<SuccessStory[]> {
    const messages = [
      new SystemMessage(`${this.getSystemPrompt()}

Extract customer success stories from the provided content. For each success story, identify:
- Company name
- Initial challenge or problem
- Solution implemented
- Specific outcomes and results
- Quantifiable metrics (if available)
- Source of information

Focus on stories with clear before/after scenarios and measurable results.`),
      new HumanMessage(`Query: "${query}"

Content to analyze:
${content.join('\n\n')}

Extract all customer success stories and format them as structured data.`)
    ];

    const response = await this.callLLM(messages);
    return this.parseSuccessStories(response);
  }

  private async mapCustomerJourney(content: string[], query: string): Promise<CustomerJourneyStep[]> {
    const messages = [
      new SystemMessage(`${this.getSystemPrompt()}

Map the customer journey based on the provided content. Identify:
- Different stages in the customer journey
- Description of each stage
- Typical duration for each stage
- Key touchpoints and interactions
- Pain points at each stage

Focus on the complete customer lifecycle from awareness to success.`),
      new HumanMessage(`Query: "${query}"

Content to analyze:
${content.join('\n\n')}

Map the customer journey and format as structured data.`)
    ];

    const response = await this.callLLM(messages);
    return this.parseCustomerJourney(response);
  }

  private async identifyCustomerPatterns(
    caseStudies: CustomerCaseStudy[],
    testimonials: CustomerTestimonial[],
    successStories: SuccessStory[]
  ): Promise<CustomerPattern[]> {
    // const allData = [...caseStudies, ...testimonials, ...successStories];
    
    const messages = [
      new SystemMessage(`${this.getSystemPrompt()}

Analyze the provided customer data to identify common patterns and characteristics. For each pattern, identify:
- The specific characteristic or pattern
- How frequently it appears (frequency score)
- Confidence level in the pattern (0-1)
- Specific examples that demonstrate the pattern

Focus on patterns that can be used for ICP development.`),
      new HumanMessage(`Customer Data to analyze:

Case Studies: ${JSON.stringify(caseStudies, null, 2)}
Testimonials: ${JSON.stringify(testimonials, null, 2)}
Success Stories: ${JSON.stringify(successStories, null, 2)}

Identify common patterns and characteristics.`)
    ];

    const response = await this.callLLM(messages);
    return this.parseCustomerPatterns(response);
  }

  private parseCaseStudies(response: string): CustomerCaseStudy[] {
    // Parse the LLM response to extract structured case study data
    // This would include JSON parsing and validation
    try {
      const parsed = JSON.parse(response);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // Fallback parsing logic for non-JSON responses
      return this.extractCaseStudiesFromText(response);
    }
  }

  private parseTestimonials(response: string): CustomerTestimonial[] {
    try {
      const parsed = JSON.parse(response);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return this.extractTestimonialsFromText(response);
    }
  }

  private parseSuccessStories(response: string): SuccessStory[] {
    try {
      const parsed = JSON.parse(response);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return this.extractSuccessStoriesFromText(response);
    }
  }

  private parseCustomerJourney(response: string): CustomerJourneyStep[] {
    try {
      const parsed = JSON.parse(response);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return this.extractCustomerJourneyFromText(response);
    }
  }

  private parseCustomerPatterns(response: string): CustomerPattern[] {
    try {
      const parsed = JSON.parse(response);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return this.extractCustomerPatternsFromText(response);
    }
  }

  // Fallback text parsing methods
  private extractCaseStudiesFromText(text: string): CustomerCaseStudy[] {
    console.log(`Extracting case studies from ${text.length} characters`);
    // Implement text parsing logic for case studies
    return [];
  }

  private extractTestimonialsFromText(text: string): CustomerTestimonial[] {
    console.log(`Extracting testimonials from ${text.length} characters`);
    // Implement text parsing logic for testimonials
    return [];
  }

  private extractSuccessStoriesFromText(text: string): SuccessStory[] {
    console.log(`Extracting success stories from ${text.length} characters`);
    // Implement text parsing logic for success stories
    return [];
  }

  private extractCustomerJourneyFromText(text: string): CustomerJourneyStep[] {
    console.log(`Extracting customer journey from ${text.length} characters`);
    // Implement text parsing logic for customer journey
    return [];
  }

  private extractCustomerPatternsFromText(text: string): CustomerPattern[] {
    console.log(`Extracting customer patterns from ${text.length} characters`);
    // Implement text parsing logic for customer patterns
    return [];
  }

  private createEmptyCustomerIntelligenceData(): CustomerIntelligenceData {
    return {
      caseStudies: [],
      testimonials: [],
      successStories: [],
      customerJourney: [],
      patterns: []
    };
  }
}