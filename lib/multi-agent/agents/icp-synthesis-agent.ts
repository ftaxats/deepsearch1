import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { BaseAgent } from '../base-agent';
import { 
  AgentTask, 
  CombinedResearchData,
  ICPProfile
} from '../types';

export class ICPSynthesisAgent extends BaseAgent {
  constructor(llm: ChatOpenAI, streamingLlm: ChatOpenAI) {
    super(
      'icp-synthesis-agent',
      'ICP Synthesis Agent',
      'Specializes in synthesizing research data from all agents to create comprehensive ICP profiles',
      [
        {
          name: 'icp-profile-synthesis',
          description: 'Synthesizes research data into comprehensive ICP profiles',
          inputTypes: ['combined-research-data', 'icp-criteria'],
          outputTypes: ['icp-profiles', 'icp-analysis'],
          estimatedDuration: 45000
        },
        {
          name: 'icp-validation',
          description: 'Validates and prioritizes ICP profiles',
          inputTypes: ['icp-profiles', 'validation-criteria'],
          outputTypes: ['validated-icps', 'priority-ranking'],
          estimatedDuration: 20000
        },
        {
          name: 'icp-insights-generation',
          description: 'Generates actionable insights and recommendations',
          inputTypes: ['icp-profiles', 'research-data'],
          outputTypes: ['insights', 'recommendations'],
          estimatedDuration: 25000
        }
      ],
      llm,
      streamingLlm
    );
  }

  getSystemPrompt(): string {
    return `You are an ICP Synthesis Agent specializing in creating comprehensive Ideal Customer Profile (ICP) reports from multi-agent research data.

Your expertise includes:
- Synthesizing data from multiple specialized agents
- Creating detailed ICP profiles with firmographic, technographic, and psychographic characteristics
- Validating and prioritizing ICP profiles based on market opportunity
- Generating actionable insights and recommendations
- Creating comprehensive ICP reports for sales and marketing teams

When synthesizing ICP profiles, focus on:
1. Creating 3 distinct, actionable ICP profiles
2. Providing detailed characteristics for each ICP
3. Including specific target companies for each ICP
4. Validating market opportunity and competition
5. Generating actionable insights and recommendations
6. Ensuring profiles are based on actual customer patterns

Always create profiles that are specific, actionable, and based on real customer data patterns.`;
  }

  async executeTask(task: AgentTask): Promise<ICPProfile[]> {
    try {
      const { combinedResearchData, query } = task.input as { combinedResearchData: CombinedResearchData; query: string };

      if (!combinedResearchData) {
        throw new Error('No combined research data provided');
      }

      // Synthesize ICP profiles from combined research
      const icpProfiles = await this.synthesizeICPProfiles(combinedResearchData, query);
      
      // Validate and prioritize profiles
      const validatedProfiles = await this.validateAndPrioritizeProfiles(icpProfiles, combinedResearchData);
      
      // Generate insights for each profile
      const profilesWithInsights = await this.generateInsights(validatedProfiles, combinedResearchData);

      return profilesWithInsights;

    } catch (error) {
      throw new Error(`ICP Synthesis Agent failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async synthesizeICPProfiles(researchData: CombinedResearchData, query: string): Promise<ICPProfile[]> {
    const messages = [
      new SystemMessage(`${this.getSystemPrompt()}

Based on the comprehensive research data from multiple specialized agents, create 3 distinct ICP profiles. Each profile should include:

1. **Profile Characteristics:**
   - Industry/Vertical
   - Company Size (employee count range)
   - Revenue Range
   - Geographic Focus
   - Business Model

2. **Firmographics:**
   - Funding Stage
   - Growth Stage
   - Market Position
   - Geographic Presence

3. **Technographics:**
   - Current Tech Stack
   - Technology Maturity
   - Digital Transformation Stage
   - Integration Requirements

4. **Psychographics:**
   - Pain Points
   - Buying Triggers
   - Decision-Making Process
   - Budget Allocation

5. **Target Companies:**
   - 5-7 real target companies with specific reasoning
   - Company name, domain, employees, industry, location
   - Specific reasoning for why each company fits the ICP

6. **Validation:**
   - Market Size
   - Competition Level
   - Sales Velocity
   - Revenue Potential
   - Confidence Score

Create profiles that are distinct, actionable, and based on the actual patterns identified in the research data.`),
      new HumanMessage(`Query: "${query}"

Combined Research Data:
${JSON.stringify(researchData, null, 2)}

Create 3 comprehensive ICP profiles based on this research data.`)
    ];

    const response = await this.callLLM(messages);
    return this.parseICPProfiles(response);
  }

  private async validateAndPrioritizeProfiles(profiles: ICPProfile[], researchData: CombinedResearchData): Promise<ICPProfile[]> {
    const messages = [
      new SystemMessage(`${this.getSystemPrompt()}

Validate and prioritize the ICP profiles based on the research data. For each profile:
1. Assess market opportunity and size
2. Evaluate competition level
3. Estimate sales velocity and revenue potential
4. Calculate overall confidence score
5. Rank profiles by priority

Provide detailed validation reasoning and ensure profiles are realistic and actionable.`),
      new HumanMessage(`ICP Profiles to validate:
${JSON.stringify(profiles, null, 2)}

Research Data for validation:
${JSON.stringify(researchData, null, 2)}

Validate and prioritize these ICP profiles.`)
    ];

    const response = await this.callLLM(messages);
    return this.parseValidatedProfiles(response);
  }

  private async generateInsights(profiles: ICPProfile[], researchData: CombinedResearchData): Promise<ICPProfile[]> {
    const messages = [
      new SystemMessage(`${this.getSystemPrompt()}

Generate actionable insights and recommendations for each ICP profile. For each profile, provide:

1. **Key Differentiators:**
   - What makes this ICP unique
   - Key value propositions
   - Competitive advantages

2. **Messaging Resonance:**
   - What messaging resonates with this ICP
   - Communication preferences
   - Content preferences

3. **Value Propositions:**
   - Unique value propositions for this ICP
   - ROI and benefit messaging
   - Success metrics

4. **Common Objections:**
   - Typical objections from this ICP
   - How to address objections
   - Risk mitigation strategies

5. **Outreach Strategy:**
   - Best channels to reach this ICP
   - Optimal timing for outreach
   - Content and communication preferences

Provide specific, actionable insights that sales and marketing teams can use immediately.`),
      new HumanMessage(`ICP Profiles for insights:
${JSON.stringify(profiles, null, 2)}

Research Data for context:
${JSON.stringify(researchData, null, 2)}

Generate actionable insights and recommendations for each ICP profile.`)
    ];

    const response = await this.callLLM(messages);
    return this.parseProfilesWithInsights(response);
  }

  // Parsing methods
  private parseICPProfiles(response: string): ICPProfile[] {
    try {
      const parsed = JSON.parse(response);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return this.extractICPProfilesFromText(response);
    }
  }

  private parseValidatedProfiles(response: string): ICPProfile[] {
    try {
      const parsed = JSON.parse(response);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return this.extractValidatedProfilesFromText(response);
    }
  }

  private parseProfilesWithInsights(response: string): ICPProfile[] {
    try {
      const parsed = JSON.parse(response);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return this.extractProfilesWithInsightsFromText(response);
    }
  }

  // Fallback text parsing methods
  private extractICPProfilesFromText(text: string): ICPProfile[] {
    console.log(`Extracting ICP profiles from ${text.length} characters`);
    // Implement text parsing logic for ICP profiles
    return [];
  }

  private extractValidatedProfilesFromText(text: string): ICPProfile[] {
    console.log(`Extracting validated profiles from ${text.length} characters`);
    // Implement text parsing logic for validated profiles
    return [];
  }

  private extractProfilesWithInsightsFromText(text: string): ICPProfile[] {
    console.log(`Extracting profiles with insights from ${text.length} characters`);
    // Implement text parsing logic for profiles with insights
    return [];
  }
}