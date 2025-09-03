import { StateGraph, END, START, Annotation, MemorySaver } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { FirecrawlClient } from './firecrawl';
import { ContextProcessor } from './context-processor';
import { SEARCH_CONFIG, CRAWL_CONFIG, MODEL_CONFIG } from './config';

// Event types remain the same for frontend compatibility
export type SearchPhase = 
  | 'understanding'
  | 'planning' 
  | 'searching'
  | 'analyzing'
  | 'synthesizing'
  | 'complete'
  | 'error';

export type SearchEvent = 
  | { type: 'phase-update'; phase: SearchPhase; message: string }
  | { type: 'thinking'; message: string }
  | { type: 'searching'; query: string; index: number; total: number }
  | { type: 'found'; sources: Source[]; query: string }
  | { type: 'scraping'; url: string; index: number; total: number; query: string }
  | { type: 'content-chunk'; chunk: string }
  | { type: 'final-result'; content: string; sources: Source[]; followUpQuestions?: string[] }
  | { type: 'error'; error: string; errorType?: ErrorType }
  | { type: 'source-processing'; url: string; title: string; stage: 'browsing' | 'extracting' | 'analyzing' }
  | { type: 'source-complete'; url: string; summary: string };

export type ErrorType = 'search' | 'scrape' | 'llm' | 'unknown';

export interface Source {
  url: string;
  title: string;
  content?: string;
  quality?: number;
  summary?: string;
  metadata?: {
    intelligenceType?: string;
    discoveryMethod?: string;
    crawledAt?: string;
    structuredData?: unknown;
    discoveredUrls?: string[];
  };
}

interface CrawledPage {
  url: string;
  title: string;
  markdown?: string;
  content?: string;
  metadata?: {
    intelligenceType?: string;
    discoveryMethod?: string;
    crawledAt?: string;
    structuredData?: unknown;
    discoveredUrls?: string[];
    relevanceScore?: number;
  };
}

interface SearchResultItem {
  url: string;
  title: string;
  markdown?: string;
  metadata?: {
    discoveryMethod?: string;
    crawledAt?: string;
  };
}

export interface SearchResult {
  url: string;
  title: string;
  content?: string;
  markdown?: string;
}

export interface SearchStep {
  id: SearchPhase | string;
  label: string;
  status: 'pending' | 'active' | 'completed';
  startTime?: number;
}

// Proper LangGraph state using Annotation with reducers
const SearchStateAnnotation = Annotation.Root({
  // Input fields
  query: Annotation<string>({
    reducer: (_, y) => y ?? "",
    default: () => ""
  }),
  context: Annotation<{ query: string; response: string }[] | undefined>({
    reducer: (_, y) => y,
    default: () => undefined
  }),
  
  // Process fields
  understanding: Annotation<string | undefined>({
    reducer: (x, y) => y ?? x,
    default: () => undefined
  }),
  searchQueries: Annotation<string[] | undefined>({
    reducer: (x, y) => y ?? x,
    default: () => undefined
  }),
  currentSearchIndex: Annotation<number>({
    reducer: (x, y) => y ?? x,
    default: () => 0
  }),
  
  // Results fields - with proper array reducers
  sources: Annotation<Source[]>({
    reducer: (existing: Source[], update: Source[] | undefined) => {
      if (!update) return existing;
      // Deduplicate sources by URL
      const sourceMap = new Map<string, Source>();
      [...existing, ...update].forEach(source => {
        sourceMap.set(source.url, source);
      });
      return Array.from(sourceMap.values());
    },
    default: () => []
  }),
  scrapedSources: Annotation<Source[]>({
    reducer: (existing: Source[], update: Source[] | undefined) => {
      if (!update) return existing;
      return [...existing, ...update];
    },
    default: () => []
  }),
  processedSources: Annotation<Source[] | undefined>({
    reducer: (x, y) => y ?? x,
    default: () => undefined
  }),
  finalAnswer: Annotation<string | undefined>({
    reducer: (x, y) => y ?? x,
    default: () => undefined
  }),
  followUpQuestions: Annotation<string[] | undefined>({
    reducer: (x, y) => y ?? x,
    default: () => undefined
  }),
  
  // Answer tracking
  subQueries: Annotation<Array<{
    question: string;
    searchQuery: string;
    answered: boolean;
    answer?: string;
    confidence: number;
    sources: string[];
  }> | undefined>({
    reducer: (x, y) => y ?? x,
    default: () => undefined
  }),
  searchAttempt: Annotation<number>({
    reducer: (x, y) => y ?? x,
    default: () => 0
  }),
  
  // Control fields
  phase: Annotation<SearchPhase>({
    reducer: (x, y) => y ?? x,
    default: () => 'understanding' as SearchPhase
  }),
  error: Annotation<string | undefined>({
    reducer: (x, y) => y ?? x,
    default: () => undefined
  }),
  errorType: Annotation<ErrorType | undefined>({
    reducer: (x, y) => y ?? x,
    default: () => undefined
  }),
  maxRetries: Annotation<number>({
    reducer: (x, y) => y ?? x,
    default: () => SEARCH_CONFIG.MAX_RETRIES
  }),
  retryCount: Annotation<number>({
    reducer: (x, y) => y ?? x,
    default: () => 0
  })
});

type SearchState = typeof SearchStateAnnotation.State;

// Define config type for proper event handling
interface GraphConfig {
  configurable?: {
    eventCallback?: (event: SearchEvent) => void;
    checkpointId?: string;
  };
}

export class LangGraphSearchEngine {
  private firecrawl: FirecrawlClient;
  private contextProcessor: ContextProcessor;
  private graph: ReturnType<typeof this.buildGraph>;
  private llm: ChatOpenAI;
  private streamingLlm: ChatOpenAI;
  private checkpointer?: MemorySaver;

  constructor(firecrawl: FirecrawlClient, options?: { enableCheckpointing?: boolean }) {
    this.firecrawl = firecrawl;
    this.contextProcessor = new ContextProcessor();
    
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    
    // Initialize LangChain models
    this.llm = new ChatOpenAI({
      modelName: MODEL_CONFIG.FAST_MODEL,
      temperature: MODEL_CONFIG.TEMPERATURE,
      openAIApiKey: apiKey,
    });
    
    this.streamingLlm = new ChatOpenAI({
      modelName: MODEL_CONFIG.QUALITY_MODEL,
      temperature: MODEL_CONFIG.TEMPERATURE,
      streaming: true,
      openAIApiKey: apiKey,
    });

    // Enable checkpointing if requested
    if (options?.enableCheckpointing) {
      this.checkpointer = new MemorySaver();
    }
    
    this.graph = this.buildGraph();
  }

  // Company Research: Deep analysis of target company only (NO ICP creation)
  async analyzeCompanyIntelligence(
    url: string,
    onEvent: (event: SearchEvent) => void,
    options?: { 
      intelligenceTypes?: ('pricing' | 'team' | 'customers' | 'products' | 'competitors')[];
      includeCompetitorAnalysis?: boolean;
      context?: { query: string; response: string }[];
    }
  ): Promise<void> {
    try {
      onEvent({ type: 'phase-update', phase: 'understanding', message: 'Initializing comprehensive company research...' });
      
      // Extract domain from URL
      const domain = new URL(url).hostname.replace('www.', '');
      onEvent({ type: 'thinking', message: `🎯 Target: ${domain} - Beginning multi-phase intelligence operation` });

      // Phase 1: Website Structure Discovery
      onEvent({ type: 'phase-update', phase: 'planning', message: 'Mapping website architecture and discovering intelligence sources...' });
      
      const siteMap = await this.firecrawl.mapWebsiteStructure(url);
      if (siteMap.success) {
        const { categorizedUrls, totalUrls } = siteMap;
        onEvent({ 
          type: 'thinking', 
          message: `📊 Architecture Discovery: ${totalUrls} pages mapped across ${Object.keys(categorizedUrls).length} categories` 
        });
      }

      // Phase 2: Targeted Intelligence Gathering
      onEvent({ type: 'phase-update', phase: 'searching', message: 'Conducting systematic intelligence extraction...' });
      
      const intelligenceTypes = options?.intelligenceTypes || ['pricing', 'team', 'customers', 'products'];
      const allSources: Source[] = [];

      for (const type of intelligenceTypes) {
        onEvent({ type: 'thinking', message: `🔍 Phase ${intelligenceTypes.indexOf(type) + 1}/${intelligenceTypes.length}: Gathering ${type} intelligence...` });
        
        const intelligence = await this.firecrawl.gatherWebsiteIntelligence(url, type);
        
        if (intelligence.success && intelligence.rawData) {
          const sources = intelligence.rawData.map((page: CrawledPage) => ({
            url: page.url,
            title: page.title || `${domain} - ${type.toUpperCase()}`,
            content: page.markdown || '',
            quality: 0.9,
            summary: `${type} intelligence extracted via comprehensive crawling`,
            metadata: {
              intelligenceType: type,
              structuredData: intelligence.structuredData,
              crawlSummary: intelligence.summary
            }
          }));
          
          allSources.push(...sources);
          onEvent({ 
            type: 'found', 
            sources: sources, 
            query: `${type} intelligence from ${domain}` 
          });
          
                      onEvent({ 
              type: 'thinking', 
              message: `✅ ${type} Intelligence: ${sources.length} pages analyzed, ${intelligence.summary?.scrapedPages || 0} pages scraped` 
            });
        } else {
          onEvent({ 
            type: 'thinking', 
            message: `⚠️ Limited ${type} intelligence found - continuing with other categories` 
          });
        }
      }

      // Phase 3: Competitor Landscape Analysis (if requested)
      if (options?.includeCompetitorAnalysis) {
        onEvent({ type: 'phase-update', phase: 'analyzing', message: 'Analyzing competitive landscape and market positioning...' });
        
        try {
          const competitorAnalysis = await this.firecrawl.gatherWebsiteIntelligence(url, 'competitors');
          
          if (competitorAnalysis.success) {
            // Include the competitive intelligence in our sources
            const competitorSources = (competitorAnalysis.rawData || []).map((page: CrawledPage) => ({
              url: page.url,
              title: page.title || `${domain} - Competitive Intelligence`,
              content: page.markdown || '',
              quality: 0.95,
              summary: 'Competitive positioning and market analysis'
            }));
            
            allSources.push(...competitorSources);
            onEvent({ 
              type: 'thinking', 
              message: `🏆 Competitive Analysis: ${competitorSources.length} intelligence sources analyzed` 
            });
          }
        } catch {
          onEvent({ 
            type: 'thinking', 
            message: `⚠️ Competitor analysis encountered limitations - focusing on direct intelligence` 
          });
        }
      }

      // Phase 4: Generate Comprehensive Intelligence Report
      onEvent({ type: 'phase-update', phase: 'synthesizing', message: 'Synthesizing comprehensive intelligence report...' });
      
      const query = `Deep company research and analysis for ${domain}`;
      
      const contentCb = (chunk: string) => {
        onEvent({ type: 'content-chunk', chunk });
      };

      const finalReport = await this.generateCompanyResearchReport(query, allSources, contentCb, options?.context);

      onEvent({ 
        type: 'final-result', 
        content: finalReport, 
        sources: allSources,
        followUpQuestions: [
          `Analyze customer case studies to create ICP profiles`,
          `Generate 3 specific ICP cards with target companies`,
          `Expand competitive landscape analysis`
        ]
      });
      
      onEvent({ type: 'phase-update', phase: 'complete', message: `Company research complete: ${allSources.length} sources analyzed` });
      
    } catch (error) {
      onEvent({
        type: 'error',
        error: error instanceof Error ? error.message : 'Website intelligence analysis failed',
        errorType: 'unknown',
      });
    }
  }

  // NEW: Separate ICP Analysis - Creates 3 specific ICP profiles with real company examples
  async generateICPProfiles(
    companyUrl: string,
    onEvent: (event: SearchEvent) => void,
    options?: { 
      companyResearchData?: Source[];
      context?: { query: string; response: string }[];
    }
  ): Promise<void> {
    try {
      const domain = new URL(companyUrl).hostname.replace('www.', '');
      
      onEvent({ type: 'phase-update', phase: 'understanding', message: 'Analyzing customer patterns for ICP creation...' });
      onEvent({ type: 'thinking', message: `🔍 Analyzing ${domain}'s customer base to identify ideal customer profiles` });

      // Phase 1: Deep customer case study analysis
      onEvent({ type: 'phase-update', phase: 'searching', message: 'Extracting customer case studies and success stories...' });
      
      const customerIntelligence = await this.firecrawl.gatherWebsiteIntelligence(companyUrl, 'customers');
      const allSources: Source[] = options?.companyResearchData || [];
      
      if (customerIntelligence.success && customerIntelligence.rawData) {
        const customerSources = customerIntelligence.rawData.map((page: CrawledPage) => ({
          url: page.url,
          title: page.title || `${domain} - Customer Intelligence`,
          content: page.markdown || '',
          quality: 0.95,
          summary: 'Customer case studies and success stories for ICP analysis',
          metadata: {
            intelligenceType: 'customer_analysis',
            discoveryMethod: 'search',
            crawledAt: new Date().toISOString()
          }
        }));
        
        allSources.push(...customerSources);
        onEvent({ type: 'found', sources: customerSources, query: 'Customer case studies and testimonials' });
        onEvent({ type: 'thinking', message: `✅ Found ${customerSources.length} customer case studies for pattern analysis` });
      }

      // Phase 2: Competitor customer analysis for market validation
      onEvent({ type: 'phase-update', phase: 'analyzing', message: 'Analyzing competitor customers for market validation...' });
      
      try {
        const competitorSearch = await this.firecrawl.search(`"${domain}" OR "${domain.split('.')[0]}" customers OR "case study" OR testimonial OR "customer success" OR "client spotlight"`, {
          limit: 10,
          scrapeOptions: { formats: ['markdown'] }
        });
        
        if (competitorSearch.data) {
          const competitorCustomerSources = competitorSearch.data
            .filter((result: SearchResultItem) => result.markdown && result.markdown.length > 300)
            .map((result: SearchResultItem) => ({
              url: result.url,
              title: result.title || 'Market Customer Intelligence',
              content: result.markdown || '',
              quality: 0.8,
              summary: 'Market customer intelligence for ICP validation',
              metadata: {
                intelligenceType: 'market_customers',
                discoveryMethod: 'competitive_search'
              }
            }));
          
          allSources.push(...competitorCustomerSources);
          onEvent({ type: 'thinking', message: `✅ Found ${competitorCustomerSources.length} market customer examples for validation` });
        }
      } catch {
        onEvent({ type: 'thinking', message: '⚠️ Limited market customer data available - proceeding with company analysis' });
      }

      // Phase 3: Generate 3 specific ICP profiles
      onEvent({ type: 'phase-update', phase: 'synthesizing', message: 'Creating 3 specific ICP profiles with target companies...' });
      
      const query = `Generate 3 specific ICP profiles based on ${domain}'s customer analysis`;
      
      const contentCb = (chunk: string) => {
        onEvent({ type: 'content-chunk', chunk });
      };

      const icpReport = await this.generateICPReport(query, allSources, contentCb, options?.context);

      onEvent({ 
        type: 'final-result', 
        content: icpReport, 
        sources: allSources,
        followUpQuestions: [
          'Refine ICP profiles with additional customer research',
          'Generate specific outreach sequences for each ICP',
          'Identify high-priority prospect companies to target'
        ]
      });
      
      onEvent({ type: 'phase-update', phase: 'complete', message: `ICP analysis complete: 3 profiles created from ${allSources.length} sources` });
      
    } catch (error) {
      onEvent({
        type: 'error',
        error: error instanceof Error ? error.message : 'ICP profile generation failed',
        errorType: 'unknown',
      });
    }
  }

  private async generateICPReport(
    query: string,
    sources: Source[],
    onChunk: (chunk: string) => void,
    context?: { query: string; response: string }[]
  ): Promise<string> {
    const sourcesText = sources
      .map((s, i) => {
        if (!s.content) return `[${i + 1}] ${s.title}\n[No content available]`;
        return `[${i + 1}] ${s.title}\n${s.content}`;
      })
      .join('\n\n');
    
    let contextPrompt = '';
    if (context && context.length > 0) {
      contextPrompt = '\n\nPrevious conversation for context:\n';
      context.forEach(c => {
        contextPrompt += `User: ${c.query}\nAssistant: ${c.response.substring(0, 300)}...\n\n`;
      });
    }
    
    const messages = [
      new SystemMessage(`${this.getCurrentDateContext()}

You are a specialized ICP (Ideal Customer Profile) analyst. Based on the provided customer case studies and company intelligence, create 3 specific ICP profiles with real target companies.

CRITICAL INSTRUCTIONS:
- Analyze customer case studies to identify patterns
- Create 3 distinct ICP profiles based on actual customer data
- Provide 5-7 real target companies for each ICP with specific reasoning
- Include detailed firmographics and technographics

ICP ANALYSIS STRUCTURE:

1. CUSTOMER PATTERN ANALYSIS
   - Extract patterns from case studies and customer testimonials
   - Identify common characteristics among successful customers
   - Note industry verticals, company sizes, use cases, and pain points
   - Analyze customer journey and implementation patterns

2. ICP PROFILE #1: [Primary Segment Name]
   
   **Profile Characteristics:**
   - Industry/Vertical: [Specific industry]
   - Company Size: [Employee count range]
   - Revenue Range: [Annual revenue range]
   - Geographic Focus: [Primary regions]
   - Business Model: [B2B, B2C, etc.]
   
   **Firmographics:**
   - Funding Stage: [Startup, Series A-C, Public, etc.]
   - Growth Stage: [Early, Growth, Mature]
   - Market Position: [Leader, Challenger, Niche]
   - Geographic Presence: [Local, National, Global]
   
   **Technographics:**
   - Current Tech Stack: [CRM, Marketing tools, etc.]
   - Technology Maturity: [Basic, Intermediate, Advanced]
   - Digital Transformation Stage: [Beginning, In-progress, Advanced]
   - Integration Requirements: [API needs, platform connections]
   
   **Psychographics & Behaviors:**
   - Pain Points: [Specific challenges they face]
   - Buying Triggers: [What motivates purchase decisions]
   - Decision-Making Process: [Committee, individual, etc.]
   - Budget Allocation: [How they approach purchasing]
   
   **Target Job Roles:**
   - Primary Decision Maker: [Title and seniority]
   - Influencers: [Additional stakeholders]
   - End Users: [Who actually uses the product]
   - Budget Owner: [Who controls purchasing decisions]
   
   **TARGET COMPANIES FOR ICP #1:**
   
   | Company Name | Domain | Employees | Industry | Location | Reasoning |
   |--------------|---------|-----------|----------|----------|-----------|
   | [Company 1] | company1.com | 150-300 | [Industry] | [City, State] | [Specific reasoning based on patterns] |
   | [Company 2] | company2.com | 200-400 | [Industry] | [City, State] | [Specific reasoning based on patterns] |
   | [Company 3] | company3.com | 100-250 | [Industry] | [City, State] | [Specific reasoning based on patterns] |
   | [Company 4] | company4.com | 180-350 | [Industry] | [City, State] | [Specific reasoning based on patterns] |
   | [Company 5] | company5.com | 120-280 | [Industry] | [City, State] | [Specific reasoning based on patterns] |

3. ICP PROFILE #2: [Secondary Segment Name]
   [Same detailed structure as Profile #1]

4. ICP PROFILE #3: [Tertiary Segment Name]
   [Same detailed structure as Profile #1]

5. ICP VALIDATION & PRIORITIZATION
   
   **Priority Ranking:**
   1. ICP #1: [Reasoning for highest priority]
   2. ICP #2: [Reasoning for medium priority]
   3. ICP #3: [Reasoning for lower priority]
   
   **Market Validation:**
   - Market Size: [Estimated TAM for each ICP]
   - Competition Level: [How competitive each segment is]
   - Sales Velocity: [Expected sales cycle length]
   - Revenue Potential: [Average deal size and LTV]

6. ACTIONABLE INSIGHTS
   
   **Key Differentiators by ICP:**
   - What messaging resonates with each segment
   - Unique value propositions for each ICP
   - Common objections and how to address them
   
   **Outreach Strategy Foundation:**
   - Best channels to reach each ICP
   - Optimal timing for outreach
   - Content preferences and communication style

IMPORTANT REQUIREMENTS:
- Base ICP profiles on actual customer patterns from case studies
- Provide REAL company names and domains (research actual companies)
- Include specific reasoning for why each target company fits the ICP
- Ensure all 3 ICPs are distinct and actionable
- Focus on companies that match the patterns of existing successful customers

Formatting:
- Use clear markdown tables for target companies
- Add citations [1], [2], etc. when referencing customer case studies
- Make ICPs specific and actionable for sales teams`),
      new HumanMessage(`ICP Analysis Request: "${query}"${contextPrompt}\n\nBased on these customer intelligence sources:\n${sourcesText}`)
    ];
    
    let fullText = '';
    
    try {
      const stream = await this.streamingLlm.stream(messages);
      
      for await (const chunk of stream) {
        const content = chunk.content;
        if (typeof content === 'string') {
          fullText += content;
          onChunk(content);
        }
      }
    } catch {
      // Fallback to non-streaming if streaming fails
      const response = await this.llm.invoke(messages);
      fullText = response.content.toString();
      onChunk(fullText);
    }
    
    return fullText;
  }

  // Enhanced: Analyze dossier + conduct targeted website crawling for ICP research
  async analyzeDossier(
    dossierText: string,
    onEvent: (event: SearchEvent) => void,
    options?: { query?: string; context?: { query: string; response: string }[] }
  ): Promise<void> {
    const query = options?.query || 'Deep ICP analysis with targeted website crawling';

    try {
      // Phase 1: Extract competitors and targets from dossier
      onEvent({ type: 'phase-update', phase: 'understanding', message: 'Analyzing research dossier for competitor intelligence…' });
      onEvent({ type: 'thinking', message: 'Extracting competitor websites and target companies from provided research data.' });
      
      // Build initial source from dossier
      const dossierSource: Source = {
        url: 'about:research_dossier',
        title: 'Research Dossier - Base Intelligence',
        content: dossierText,
        quality: 1,
      };

      // Extract competitor websites and target domains from dossier
      onEvent({ type: 'phase-update', phase: 'planning', message: 'Identifying competitor websites for targeted crawling…' });
      const competitorData = await this.extractCompetitorWebsites(dossierText);
      
      onEvent({ type: 'thinking', message: `Found ${competitorData.competitors.length} competitors for deep crawling: ${competitorData.competitors.slice(0, 3).join(', ')}${competitorData.competitors.length > 3 ? '...' : ''}` });

      // Phase 2: Systematic website crawling
      onEvent({ type: 'phase-update', phase: 'searching', message: 'Crawling competitor websites and sitemaps…' });
      
      const allSources: Source[] = [dossierSource];
      
      // Crawl each competitor systematically (HEAVILY OPTIMIZED: Circuit breaker for rate limits)
      const maxCompetitorsToAnalyze = Math.min(competitorData.competitors.length, CRAWL_CONFIG.MAX_COMPETITORS_TO_ANALYZE);
      let consecutiveRateLimitErrors = 0;
      const maxConsecutiveRateLimitErrors = 2; // Stop if we hit 2 rate limits in a row
      
      for (let i = 0; i < maxCompetitorsToAnalyze; i++) {
        const domain = competitorData.competitors[i];
        
        // Circuit breaker: Stop if we've hit too many rate limits
        if (consecutiveRateLimitErrors >= maxConsecutiveRateLimitErrors) {
          onEvent({ 
            type: 'thinking', 
            message: `🛑 Stopping competitor analysis due to repeated rate limits. Proceeding with available data.` 
          });
          break;
        }
        
        onEvent({ type: 'thinking', message: `Crawling ${domain} - sitemap, customers, case studies, pricing…` });
        
        // Add delay between competitor crawls to prevent rate limits
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, CRAWL_CONFIG.COMPETITOR_CRAWL_DELAY));
        }
        
        try {
          const crawledSources = await this.crawlCompetitorWebsite(domain, onEvent);
          allSources.push(...crawledSources);
          
          onEvent({ type: 'found', sources: crawledSources, query: `${domain} website crawl` });
          
          // Reset rate limit counter on success
          consecutiveRateLimitErrors = 0;
          
        } catch (error) {
          const isRateLimit = error instanceof Error && 
                             (error.message.includes('Rate limit') || error.message.includes('429'));
          
          if (isRateLimit) {
            consecutiveRateLimitErrors++;
            onEvent({ 
              type: 'thinking', 
              message: `⚠️ Rate limit hit for ${domain} (${consecutiveRateLimitErrors}/${maxConsecutiveRateLimitErrors}). ${consecutiveRateLimitErrors >= maxConsecutiveRateLimitErrors ? 'Stopping analysis.' : 'Continuing with caution.'}` 
            });
          } else {
            onEvent({ 
              type: 'thinking', 
              message: `⚠️ Skipping ${domain} due to crawling limitations: ${error instanceof Error ? error.message : 'Unknown error'}` 
            });
          }
        }
      }

      // Phase 3: Targeted customer extraction
      onEvent({ type: 'phase-update', phase: 'analyzing', message: 'Extracting customer lists and building prospect database…' });
      onEvent({ type: 'thinking', message: 'Processing crawled data for customer names, case studies, and prospect intelligence.' });

      // Phase 4: Generate comprehensive ICP report
      onEvent({ type: 'phase-update', phase: 'synthesizing', message: 'Compiling actionable prospect intelligence report…' });

      const contentCb = (chunk: string) => {
        onEvent({ type: 'content-chunk', chunk });
      };

      const finalText = await this.generateStreamingAnswer(query, allSources, contentCb, options?.context);

      onEvent({ type: 'final-result', content: finalText, sources: allSources });
      onEvent({ type: 'phase-update', phase: 'complete', message: 'Deep ICP research with website crawling complete.' });
      
    } catch (error) {
      onEvent({
        type: 'error',
        error: error instanceof Error ? error.message : 'ICP analysis with crawling failed',
        errorType: 'unknown',
      });
    }
  }

  // Extract competitor websites from dossier text
  private async extractCompetitorWebsites(dossierText: string): Promise<{ competitors: string[]; targets: string[] }> {
    try {
      const messages = [
        new SystemMessage(`Extract competitor websites and target company domains from this research dossier.

Return a JSON object with:
{
  "competitors": ["domain1.com", "domain2.com", ...],
  "targets": ["target1.com", "target2.com", ...]
}

Extract:
- competitors: Direct competitor domains mentioned (clean domains without http/www)
- targets: Potential customer/prospect domains mentioned

Focus on extracting clean domains (example.com format) from the text.`),
        new HumanMessage(`Research dossier to analyze:\n\n${dossierText.slice(0, 8000)}`)
      ];

      const response = await this.llm.invoke(messages);
      let content = response.content.toString();
      
      // Strip markdown code blocks if present
      content = content.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();
      
      const result = JSON.parse(content);
      
      return {
        competitors: result.competitors || [],
        targets: result.targets || []
      };
    } catch (error) {
      console.error('Error extracting competitor websites:', error);
      return { competitors: [], targets: [] };
    }
  }

  // Enhanced: Comprehensive website intelligence gathering using search-first discovery
  private async crawlCompetitorWebsite(domain: string, onEvent: (event: SearchEvent) => void): Promise<Source[]> {
    const sources: Source[] = [];
    
    try {
      onEvent({ type: 'thinking', message: `🔍 Starting search-based intelligence discovery for ${domain}...` });

      // Use search-first intelligence gathering for different aspects (HEAVILY OPTIMIZED: Reduced scope)
      const intelligenceTypes = ['pricing', 'customers'] as const; // REDUCED: Only essential intelligence types
      
      for (let i = 0; i < intelligenceTypes.length; i++) {
        const intelligenceType = intelligenceTypes[i];
        
        // Add delay between intelligence types to prevent rate limits
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 8000)); // 8-second delay (increased from 3s)
        }
        
        try {
          onEvent({ type: 'thinking', message: `🎯 Discovering ${intelligenceType} pages for ${domain} via search...` });
          
          const intelligence = await this.firecrawl.gatherWebsiteIntelligence(`https://${domain}`, intelligenceType);
          
          if (intelligence.success && intelligence.rawData) {
            // Convert discovered and scraped data to sources
            const crawledSources = intelligence.rawData.map((page: CrawledPage) => ({
              url: page.url,
              title: page.title || `${domain} - ${intelligenceType.toUpperCase()}`,
              content: page.markdown || page.content || '',
              quality: 0.9,
              summary: `${intelligenceType} intelligence discovered via search from ${domain}`,
              metadata: {
                intelligenceType,
                discoveryMethod: 'search',
                crawledAt: new Date().toISOString(),
                structuredData: intelligence.structuredData,
                discoveredUrls: intelligence.discoveredUrls || []
              }
            }));
            
            sources.push(...crawledSources);
            
            onEvent({ 
              type: 'thinking', 
              message: `✅ Search discovered ${intelligence.discoveredUrls?.length || 0} ${intelligenceType} URLs, scraped ${crawledSources.length} pages from ${domain}` 
            });
          } else {
            onEvent({ 
              type: 'thinking', 
              message: `⚠️ No ${intelligenceType} pages found via search for ${domain}` 
            });
          }
        } catch (error) {
          onEvent({ 
            type: 'thinking', 
            message: `⚠️ ${intelligenceType} search discovery failed for ${domain}: ${error instanceof Error ? error.message : 'Unknown error'}` 
          });
        }
        
        // Small delay between intelligence gathering operations
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Enhanced search for general competitive intelligence if we haven't found much
      if (sources.length < 5) {
        onEvent({ type: 'thinking', message: `🔄 Searching for additional competitive intelligence on ${domain}...` });
        
        try {
          // Use comprehensive search to find any valuable pages
          const comprehensiveIntel = await this.firecrawl.gatherWebsiteIntelligence(`https://${domain}`, 'comprehensive');
          
          if (comprehensiveIntel.success && comprehensiveIntel.rawData) {
            const additionalSources = comprehensiveIntel.rawData
              .filter((page: CrawledPage) => !sources.some(s => s.url === page.url)) // Avoid duplicates
              .map((page: CrawledPage) => ({
                url: page.url,
                title: page.title || `${domain} - General Intelligence`,
                content: page.markdown || '',
                quality: 0.8,
                summary: 'Additional intelligence discovered via comprehensive search',
                metadata: {
                  discoveryMethod: 'comprehensive_search',
                  crawledAt: new Date().toISOString()
                }
              }));
            
            sources.push(...additionalSources);
            onEvent({ 
              type: 'thinking', 
              message: `✅ Comprehensive search found ${additionalSources.length} additional pages from ${domain}` 
            });
          }
        } catch {
          onEvent({ type: 'thinking', message: `⚠️ Comprehensive search failed for ${domain}` });
        }
      }

      // Final targeted search for high-value competitor content
      try {
        onEvent({ type: 'thinking', message: `🎯 Final targeted search for competitive intelligence on ${domain}...` });
        
        const targetedSearch = await this.firecrawl.search(`site:${domain} (customers OR "case study" OR testimonial OR "success story" OR pricing OR leadership OR about OR products)`, {
          limit: 8,
          scrapeOptions: { formats: ['markdown'] }
        });
        
        if (targetedSearch.data) {
          const searchSources = targetedSearch.data
            .filter((result: SearchResultItem) => result.markdown && result.markdown.length > CRAWL_CONFIG.MIN_PAGE_CONTENT_LENGTH)
            .filter((result: SearchResultItem) => !sources.some(s => s.url === result.url)) // Avoid duplicates
            .map((result: SearchResultItem) => ({
              url: result.url,
              title: result.title || `${domain} - Targeted Search Result`,
              content: result.markdown,
              quality: 0.85,
              summary: 'High-value content found via targeted competitive search',
              metadata: {
                discoveryMethod: 'targeted_search',
                crawledAt: new Date().toISOString()
              }
            }));
          
          sources.push(...searchSources);
          onEvent({ type: 'thinking', message: `🎯 Targeted search discovered ${searchSources.length} additional high-value pages from ${domain}` });
        }
      } catch {
        onEvent({ type: 'thinking', message: `⚠️ Targeted search failed for ${domain}` });
      }

    } catch (error) {
      onEvent({ type: 'thinking', message: `❌ Search-based intelligence discovery failed for ${domain}: ${error instanceof Error ? error.message : 'Unknown error'}` });
    }

    // Remove duplicates by URL and sort by quality
    const uniqueSources = sources
      .filter((source, index, self) => index === self.findIndex(s => s.url === source.url))
      .sort((a, b) => (b.quality || 0) - (a.quality || 0));

    onEvent({ 
      type: 'thinking', 
      message: `🏁 Search-based intelligence discovery complete for ${domain}: ${uniqueSources.length} unique pages discovered and analyzed` 
    });

    return uniqueSources;
  }

  getInitialSteps(): SearchStep[] {
    return [
      { id: 'understanding', label: 'Understanding request', status: 'pending' },
      { id: 'planning', label: 'Planning search', status: 'pending' },
      { id: 'searching', label: 'Searching sources', status: 'pending' },
      { id: 'analyzing', label: 'Analyzing content', status: 'pending' },
      { id: 'synthesizing', label: 'Synthesizing answer', status: 'pending' },
      { id: 'complete', label: 'Complete', status: 'pending' }
    ];
  }

  private buildGraph() {
    // Create closures for helper methods
    const analyzeQuery = this.analyzeQuery.bind(this);
    const scoreContent = this.scoreContent.bind(this);
    const summarizeContent = this.summarizeContent.bind(this);
    const generateStreamingAnswer = this.generateStreamingAnswer.bind(this);
    const generateFollowUpQuestions = this.generateFollowUpQuestions.bind(this);
    const firecrawl = this.firecrawl;
    const contextProcessor = this.contextProcessor;
    
    const workflow = new StateGraph(SearchStateAnnotation)
      // Understanding node
      .addNode("understand", async (state: SearchState, config?: GraphConfig): Promise<Partial<SearchState>> => {
        const eventCallback = config?.configurable?.eventCallback;
        
        if (eventCallback) {
          eventCallback({
            type: 'phase-update',
            phase: 'understanding',
            message: 'Analyzing your request...'
          });
        }
        
        try {
          const understanding = await analyzeQuery(state.query, state.context);
          
          if (eventCallback) {
            eventCallback({
              type: 'thinking',
              message: understanding
            });
          }
          
          return {
            understanding,
            phase: 'planning' as SearchPhase
          };
        } catch (error) {
          return {
            error: error instanceof Error ? error.message : 'Failed to understand query',
            errorType: 'llm' as ErrorType,
            phase: 'error' as SearchPhase
          };
        }
      })
      
      // Planning node
      .addNode("plan", async (state: SearchState, config?: GraphConfig): Promise<Partial<SearchState>> => {
        const eventCallback = config?.configurable?.eventCallback;
        
        if (eventCallback) {
          eventCallback({
            type: 'phase-update',
            phase: 'planning',
            message: 'Planning search strategy...'
          });
        }
        
        try {
          // Extract sub-queries if not already done
          let subQueries = state.subQueries;
          if (!subQueries) {
            const extractSubQueries = this.extractSubQueries.bind(this);
            const extracted = await extractSubQueries(state.query);
            subQueries = extracted.map(sq => ({
              question: sq.question,
              searchQuery: sq.searchQuery,
              answered: false,
              confidence: 0,
              sources: []
            }));
          }
          
          // Generate search queries for unanswered questions
          const unansweredQueries = subQueries.filter(sq => !sq.answered || sq.confidence < SEARCH_CONFIG.MIN_ANSWER_CONFIDENCE);
          
          if (unansweredQueries.length === 0) {
            // All questions answered, skip to analysis
            return {
              subQueries,
              phase: 'analyzing' as SearchPhase
            };
          }
          
          // Use alternative search queries if this is a retry
          let searchQueries: string[];
          if (state.searchAttempt > 0) {
            const generateAlternativeSearchQueries = this.generateAlternativeSearchQueries.bind(this);
            searchQueries = await generateAlternativeSearchQueries(subQueries, state.searchAttempt);
            
            // Update sub-queries with new search queries
            let alternativeIndex = 0;
            subQueries.forEach(sq => {
              if (!sq.answered || sq.confidence < SEARCH_CONFIG.MIN_ANSWER_CONFIDENCE) {
                if (alternativeIndex < searchQueries.length) {
                  sq.searchQuery = searchQueries[alternativeIndex];
                  alternativeIndex++;
                }
              }
            });
          } else {
            // First attempt - use the search queries from sub-queries
            searchQueries = unansweredQueries.map(sq => sq.searchQuery);
          }
          
          if (eventCallback) {
            if (state.searchAttempt === 0) {
              eventCallback({
                type: 'thinking',
                message: searchQueries.length > 3 
                  ? `I detected ${subQueries.length} different questions. I'll search for each one separately.`
                  : `I'll search for information to answer your question.`
              });
            } else {
              eventCallback({
                type: 'thinking',
                message: `Trying alternative search strategies for: ${unansweredQueries.map(sq => sq.question).join(', ')}`
              });
            }
          }
          
          return {
            searchQueries,
            subQueries,
            currentSearchIndex: 0,
            phase: 'searching' as SearchPhase
          };
        } catch (error) {
          return {
            error: error instanceof Error ? error.message : 'Failed to plan search',
            errorType: 'llm' as ErrorType,
            phase: 'error' as SearchPhase
          };
        }
      })
      
      // Search node (handles one search at a time)
      .addNode("search", async (state: SearchState, config?: GraphConfig): Promise<Partial<SearchState>> => {
        const eventCallback = config?.configurable?.eventCallback;
        const searchQueries = state.searchQueries || [];
        const currentIndex = state.currentSearchIndex || 0;
        
        if (currentIndex === 0 && eventCallback) {
          eventCallback({
            type: 'phase-update',
            phase: 'searching',
            message: 'Searching the web...'
          });
        }
        
        if (currentIndex >= searchQueries.length) {
          return {
            phase: 'scrape' as SearchPhase
          };
        }
        
        const searchQuery = searchQueries[currentIndex];
        
        if (eventCallback) {
          eventCallback({
            type: 'searching',
            query: searchQuery,
            index: currentIndex + 1,
            total: searchQueries.length
          });
        }
        
        try {
          const results = await firecrawl.search(searchQuery, {
            limit: SEARCH_CONFIG.MAX_SOURCES_PER_SEARCH,
            scrapeOptions: {
              formats: ['markdown']
            }
          });
          
          const newSources: Source[] = results.data.map((r: SearchResult) => ({
            url: r.url,
            title: r.title,
            content: r.markdown || r.content || '',
            quality: 0
          }));
          
          if (eventCallback) {
            eventCallback({
              type: 'found',
              sources: newSources,
              query: searchQuery
            });
          }
          
          // Process sources in parallel for better performance
          if (SEARCH_CONFIG.PARALLEL_SUMMARY_GENERATION) {
            await Promise.all(newSources.map(async (source) => {
              if (eventCallback) {
                eventCallback({
                  type: 'source-processing',
                  url: source.url,
                  title: source.title,
                  stage: 'browsing'
                });
              }
              
              // Score the content
              source.quality = scoreContent(source.content || '', state.query);
              
              // Generate summary if content is available
              if (source.content && source.content.length > SEARCH_CONFIG.MIN_CONTENT_LENGTH) {
                const summary = await summarizeContent(source.content, searchQuery);
                
                // Store the summary in the source object
                if (summary && !summary.toLowerCase().includes('no specific')) {
                  source.summary = summary;
                  
                  if (eventCallback) {
                    eventCallback({
                      type: 'source-complete',
                      url: source.url,
                      summary: summary
                    });
                  }
                }
              }
            }));
          } else {
            // Original sequential processing
            for (const source of newSources) {
              if (eventCallback) {
                eventCallback({
                  type: 'source-processing',
                  url: source.url,
                  title: source.title,
                  stage: 'browsing'
                });
              }
              
              // Small delay for animation
              await new Promise(resolve => setTimeout(resolve, SEARCH_CONFIG.SOURCE_ANIMATION_DELAY));
              
              // Score the content
              source.quality = scoreContent(source.content || '', state.query);
              
              // Generate summary if content is available
              if (source.content && source.content.length > SEARCH_CONFIG.MIN_CONTENT_LENGTH) {
                const summary = await summarizeContent(source.content, searchQuery);
                
                // Store the summary in the source object
                if (summary && !summary.toLowerCase().includes('no specific')) {
                  source.summary = summary;
                  
                  if (eventCallback) {
                    eventCallback({
                      type: 'source-complete',
                      url: source.url,
                      summary: summary
                    });
                  }
                }
              }
            }
          }
          
          return {
            sources: newSources,
            currentSearchIndex: currentIndex + 1
          };
        } catch {
          return {
            currentSearchIndex: currentIndex + 1,
            errorType: 'search' as ErrorType
          };
        }
      })
      
      // Scraping node
      .addNode("scrape", async (state: SearchState, config?: GraphConfig): Promise<Partial<SearchState>> => {
        const eventCallback = config?.configurable?.eventCallback;
        const sourcesToScrape = state.sources?.filter(s => 
          !s.content || s.content.length < SEARCH_CONFIG.MIN_CONTENT_LENGTH
        ) || [];
        const newScrapedSources: Source[] = [];
        
        // Sources with content were already processed in search node, just pass them through
        const sourcesWithContent = state.sources?.filter(s => 
          s.content && s.content.length >= SEARCH_CONFIG.MIN_CONTENT_LENGTH
        ) || [];
        newScrapedSources.push(...sourcesWithContent);
        
        // Then scrape sources without content
        for (let i = 0; i < Math.min(sourcesToScrape.length, SEARCH_CONFIG.MAX_SOURCES_TO_SCRAPE); i++) {
          const source = sourcesToScrape[i];
          
          if (eventCallback) {
            eventCallback({
              type: 'scraping',
              url: source.url,
              index: newScrapedSources.length + 1,
              total: sourcesWithContent.length + Math.min(sourcesToScrape.length, SEARCH_CONFIG.MAX_SOURCES_TO_SCRAPE),
              query: state.query
            });
          }
          
          try {
            const scraped = await firecrawl.scrapeUrl(source.url, SEARCH_CONFIG.SCRAPE_TIMEOUT);
            if (scraped.success && scraped.markdown) {
              const enrichedSource = {
                ...source,
                content: scraped.markdown,
                quality: scoreContent(scraped.markdown, state.query)
              };
              newScrapedSources.push(enrichedSource);
              
              // Show processing animation
              if (eventCallback) {
                eventCallback({
                  type: 'source-processing',
                  url: source.url,
                  title: source.title,
                  stage: 'browsing'
                });
              }
              
              await new Promise(resolve => setTimeout(resolve, 150));
              
              const summary = await summarizeContent(scraped.markdown, state.query);
              if (summary) {
                enrichedSource.summary = summary;
                
                if (eventCallback) {
                  eventCallback({
                    type: 'source-complete',
                    url: source.url,
                    summary: summary
                  });
                }
              }
            } else if (scraped.error === 'timeout') {
              if (eventCallback) {
                eventCallback({
                  type: 'thinking',
                  message: `${new URL(source.url).hostname} is taking too long to respond, moving on...`
                });
              }
            }
          } catch {
            if (eventCallback) {
              eventCallback({
                type: 'thinking',
                message: `Couldn't access ${new URL(source.url).hostname}, trying other sources...`
              });
            }
          }
        }
        
        return {
          scrapedSources: newScrapedSources,
          phase: 'analyzing' as SearchPhase
        };
      })
      
      // Analyzing node
      .addNode("analyze", async (state: SearchState, config?: GraphConfig): Promise<Partial<SearchState>> => {
        const eventCallback = config?.configurable?.eventCallback;
        
        if (eventCallback) {
          eventCallback({
            type: 'phase-update',
            phase: 'analyzing',
            message: 'Analyzing gathered information...'
          });
        }
        
        // Combine sources and remove duplicates by URL
        const sourceMap = new Map<string, Source>();
        
        // Add all sources (not just those with long content, since summaries contain key info)
        (state.sources || []).forEach(s => sourceMap.set(s.url, s));
        
        // Add scraped sources (may override with better content)
        (state.scrapedSources || []).forEach(s => sourceMap.set(s.url, s));
        
        const allSources = Array.from(sourceMap.values());
        
        // Check which questions have been answered
        if (state.subQueries) {
          const checkAnswersInSources = this.checkAnswersInSources.bind(this);
          const updatedSubQueries = await checkAnswersInSources(state.subQueries, allSources);
          
          const answeredCount = updatedSubQueries.filter(sq => sq.answered).length;
          const totalQuestions = updatedSubQueries.length;
          const searchAttempt = (state.searchAttempt || 0) + 1;
          
          // Check if we have partial answers with decent confidence
          const partialAnswers = updatedSubQueries.filter(sq => sq.confidence >= 0.3);
          const hasPartialInfo = partialAnswers.length > answeredCount;
          
          if (eventCallback) {
            if (answeredCount === totalQuestions) {
              eventCallback({
                type: 'thinking',
                message: `Found answers to all ${totalQuestions} questions across ${allSources.length} sources`
              });
            } else if (answeredCount > 0) {
              eventCallback({
                type: 'thinking',
                message: `Found answers to ${answeredCount} of ${totalQuestions} questions. Still missing: ${updatedSubQueries.filter(sq => !sq.answered).map(sq => sq.question).join(', ')}`
              });
            } else if (searchAttempt >= SEARCH_CONFIG.MAX_SEARCH_ATTEMPTS) {
              // Only show "could not find" message when we've exhausted all attempts
              eventCallback({
                type: 'thinking',
                message: `Could not find specific answers in ${allSources.length} sources. The information may not be publicly available.`
              });
            } else if (hasPartialInfo && searchAttempt >= 3) {
              // If we have partial info and tried 3+ times, stop searching
              eventCallback({
                type: 'thinking',
                message: `Found partial information. Moving forward with what's available.`
              });
            } else {
              // For intermediate attempts, show a different message
              eventCallback({
                type: 'thinking',
                message: `Searching for more specific information...`
              });
            }
          }
          
          // If we haven't found all answers and haven't exceeded attempts, try again
          // BUT stop if we have partial info and already tried 2+ times
          if (answeredCount < totalQuestions && 
              searchAttempt < SEARCH_CONFIG.MAX_SEARCH_ATTEMPTS &&
              !(hasPartialInfo && searchAttempt >= 2)) {
            return {
              sources: allSources,
              subQueries: updatedSubQueries,
              searchAttempt,
              phase: 'planning' as SearchPhase  // Go back to planning for retry
            };
          }
          
          // Otherwise proceed with what we have
          try {
            const processedSources = await contextProcessor.processSources(
              state.query,
              allSources,
              state.searchQueries || []
            );
            
            return {
              sources: allSources,
              processedSources,
              subQueries: updatedSubQueries,
              searchAttempt,
              phase: 'synthesizing' as SearchPhase
            };
          } catch {
            return {
              sources: allSources,
              processedSources: allSources,
              subQueries: updatedSubQueries,
              searchAttempt,
              phase: 'synthesizing' as SearchPhase
            };
          }
        } else {
          // Fallback for queries without sub-queries
          if (eventCallback && allSources.length > 0) {
            eventCallback({
              type: 'thinking',
              message: `Found ${allSources.length} sources with quality information`
            });
          }
          
          try {
            const processedSources = await contextProcessor.processSources(
              state.query,
              allSources,
              state.searchQueries || []
            );
            
            return {
              sources: allSources,
              processedSources,
              phase: 'synthesizing' as SearchPhase
            };
          } catch {
            return {
              sources: allSources,
              processedSources: allSources,
              phase: 'synthesizing' as SearchPhase
            };
          }
        }
      })
      
      // Synthesizing node with streaming
      .addNode("synthesize", async (state: SearchState, config?: GraphConfig): Promise<Partial<SearchState>> => {
        const eventCallback = config?.configurable?.eventCallback;
        
        if (eventCallback) {
          eventCallback({
            type: 'phase-update',
            phase: 'synthesizing',
            message: 'Creating comprehensive answer...'
          });
        }
        
        try {
          const sourcesToUse = state.processedSources || state.sources || [];
          
          const answer = await generateStreamingAnswer(
            state.query,
            sourcesToUse,
            (chunk) => {
              if (eventCallback) {
                eventCallback({ type: 'content-chunk', chunk });
              }
            },
            state.context
          );
          
          // Generate follow-up questions
          const followUpQuestions = await generateFollowUpQuestions(
            state.query,
            answer,
            sourcesToUse,
            state.context
          );
          
          return {
            finalAnswer: answer,
            followUpQuestions,
            phase: 'complete' as SearchPhase
          };
        } catch (error) {
          return {
            error: error instanceof Error ? error.message : 'Failed to generate answer',
            errorType: 'llm' as ErrorType,
            phase: 'error' as SearchPhase
          };
        }
      })
      
      // Error handling node
      .addNode("handleError", async (state: SearchState, config?: GraphConfig): Promise<Partial<SearchState>> => {
        const eventCallback = config?.configurable?.eventCallback;
        
        if (eventCallback) {
          eventCallback({
            type: 'error',
            error: state.error || 'An unknown error occurred',
            errorType: state.errorType
          });
        }
        
        // Retry logic based on error type
        if ((state.retryCount || 0) < (state.maxRetries || SEARCH_CONFIG.MAX_RETRIES)) {
              
          // Different retry strategies based on error type
          const retryPhase = state.errorType === 'search' ? 'searching' : 'understanding';
          
          return {
            retryCount: (state.retryCount || 0) + 1,
            phase: retryPhase as SearchPhase,
            error: undefined,
            errorType: undefined
          };
        }
        
        return {
          phase: 'error' as SearchPhase
        };
      })
      
      // Complete node
      .addNode("complete", async (state: SearchState, config?: GraphConfig): Promise<Partial<SearchState>> => {
        const eventCallback = config?.configurable?.eventCallback;
        
        if (eventCallback) {
          eventCallback({
            type: 'phase-update',
            phase: 'complete',
            message: 'Search complete!'
          });
          
          eventCallback({
            type: 'final-result',
            content: state.finalAnswer || '',
            sources: state.sources || [],
            followUpQuestions: state.followUpQuestions
          });
        }
        
        return {
          phase: 'complete' as SearchPhase
        };
      });

    // Add edges with proper conditional routing
    workflow
      .addEdge(START, "understand")
      .addConditionalEdges(
        "understand",
        (state: SearchState) => state.phase === 'error' ? "handleError" : "plan",
        {
          handleError: "handleError",
          plan: "plan"
        }
      )
      .addConditionalEdges(
        "plan",
        (state: SearchState) => state.phase === 'error' ? "handleError" : "search",
        {
          handleError: "handleError",
          search: "search"
        }
      )
      .addConditionalEdges(
        "search",
        (state: SearchState) => {
          if (state.phase === 'error') return "handleError";
          if ((state.currentSearchIndex || 0) < (state.searchQueries?.length || 0)) {
            return "search"; // Continue searching
          }
          return "scrape"; // Move to scraping
        },
        {
          handleError: "handleError",
          search: "search",
          scrape: "scrape"
        }
      )
      .addConditionalEdges(
        "scrape",
        (state: SearchState) => state.phase === 'error' ? "handleError" : "analyze",
        {
          handleError: "handleError",
          analyze: "analyze"
        }
      )
      .addConditionalEdges(
        "analyze",
        (state: SearchState) => {
          if (state.phase === 'error') return "handleError";
          if (state.phase === 'planning') return "plan";  // Retry with new searches
          return "synthesize";
        },
        {
          handleError: "handleError",
          plan: "plan",
          synthesize: "synthesize"
        }
      )
      .addConditionalEdges(
        "synthesize",
        (state: SearchState) => state.phase === 'error' ? "handleError" : "complete",
        {
          handleError: "handleError",
          complete: "complete"
        }
      )
      .addConditionalEdges(
        "handleError",
        (state: SearchState) => state.phase === 'error' ? END : "understand",
        {
          [END]: END,
          understand: "understand"
        }
      )
      .addEdge("complete", END);

    // Compile with optional checkpointing
    return workflow.compile(this.checkpointer ? { checkpointer: this.checkpointer } : undefined);
  }

  async search(
    query: string,
    onEvent: (event: SearchEvent) => void,
    context?: { query: string; response: string }[],
    checkpointId?: string
  ): Promise<void> {
    try {
      const initialState: SearchState = {
        query,
        context,
        sources: [],
        scrapedSources: [],
        processedSources: undefined,
        phase: 'understanding',
        currentSearchIndex: 0,
        maxRetries: SEARCH_CONFIG.MAX_RETRIES,
        retryCount: 0,
        understanding: undefined,
        searchQueries: undefined,
        finalAnswer: undefined,
        followUpQuestions: undefined,
        error: undefined,
        errorType: undefined,
        subQueries: undefined,
        searchAttempt: 0
      };

      // Configure with event callback
      const config: GraphConfig = {
        configurable: {
          eventCallback: onEvent,
          ...(checkpointId && this.checkpointer ? { thread_id: checkpointId } : {})
        }
      };

      // Invoke the graph with increased recursion limit
      await this.graph.invoke(initialState, {
        ...config,
        recursionLimit: 35  // Increased from default 25 to handle MAX_SEARCH_ATTEMPTS=5
      });
    } catch (error) {
      onEvent({
        type: 'error',
        error: error instanceof Error ? error.message : 'Search failed',
        errorType: 'unknown'
      });
    }
  }


  // Get current date for context
  private getCurrentDateContext(): string {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    
    return `Today's date is ${dateStr}. The current year is ${year} and it's currently ${month}/${year}.`;
  }

  // Pure helper methods (no side effects)
  private async analyzeQuery(query: string, context?: { query: string; response: string }[]): Promise<string> {
    let contextPrompt = '';
    if (context && context.length > 0) {
      contextPrompt = '\n\nPrevious conversation:\n';
      context.forEach(c => {
        contextPrompt += `User: ${c.query}\nAssistant: ${c.response.substring(0, SEARCH_CONFIG.CONTEXT_PREVIEW_LENGTH)}...\n\n`;
      });
    }
    
    const messages = [
      new SystemMessage(`${this.getCurrentDateContext()}

You are a specialized deep research intelligence analyst. Your mission is to conduct comprehensive website intelligence gathering and competitive analysis.

When provided with a website URL, you will execute a systematic 7-phase intelligence gathering protocol:

PHASE 1: DEEP WEBSITE INTELLIGENCE
- Website Architecture Analysis (sitemap, navigation, content audit)
- Pricing Intelligence Deep-Dive (all tiers, hidden pricing, enterprise)
- Leadership & Team Intelligence (bios, LinkedIn research, advisory board)

PHASE 2: OMNICHANNEL SOCIAL INTELLIGENCE
- LinkedIn Deep Analysis (metrics, content themes, employee advocacy)
- Twitter/X Intelligence Gathering (activity patterns, influencer engagement)
- YouTube Content Analysis (strategy, engagement, speaker analysis)
- Reddit Community Intelligence (presence, sentiment, problem discussions)

PHASE 3: COMPETITIVE INTELLIGENCE MATRIX
- Direct Competitor Deep-Dive (feature matrix, pricing strategy)
- Indirect Competitor Mapping (alternative solutions, build vs. buy)
- Competitive Content Analysis (messaging, differentiation, partnerships)

PHASE 4: CUSTOMER INTELLIGENCE MINING
- Customer Profile Deep-Dive (ICP analysis, journey mapping)
- Review & Feedback Analysis (G2, Capterra, Trustpilot)
- Customer Success Intelligence (implementation, training, expansion)

PHASE 5: INDUSTRY & MARKET INTELLIGENCE
- Market Context Research (growth rates, regulatory environment)
- Analyst Relations (Gartner, Forrester, industry recognition)

PHASE 6: TECHNICAL & SECURITY INTELLIGENCE
- Security Posture Analysis (compliance, features, data handling)
- Technical Specifications (API, requirements, scalability)

PHASE 7: FINANCIAL & BUSINESS INTELLIGENCE
- Business Health Indicators (funding, revenue, partnerships)
- Risk Assessment (stability, leadership, market position)

Your analysis will produce:
1. Executive Intelligence Brief (1 page)
2. Detailed Intelligence Report (15-25 pages)
3. Contact Strategy Recommendations
4. Competitive Battle Card

Start by analyzing the user's request and explaining your intelligence gathering approach.`),
      new HumanMessage(`Query: "${query}"${contextPrompt}`)
    ];
    
    const response = await this.llm.invoke(messages);
    return response.content.toString();
  }

  private async checkAnswersInSources(
    subQueries: Array<{ question: string; searchQuery: string; answered: boolean; answer?: string; confidence: number; sources: string[] }>,
    sources: Source[]
  ): Promise<typeof subQueries> {
    if (sources.length === 0) return subQueries;
    
    const messages = [
      new SystemMessage(`Evaluate intelligence gathering findings from the provided sources. Determine if each intelligence question has been adequately answered.

INTELLIGENCE VALIDATION CRITERIA:

Website Intelligence (Phase 1):
- Architecture Analysis: Sitemap, navigation structure, content audit findings (0.8+ confidence)
- Pricing Intelligence: Pricing tiers, enterprise options, hidden costs (0.8+ confidence)
- Leadership Intelligence: Executive bios, team structure, advisory board (0.8+ confidence)

Social Intelligence (Phase 2):
- LinkedIn Analysis: Company metrics, content themes, employee activity (0.7+ confidence)
- Twitter/YouTube: Activity patterns, engagement metrics, content strategy (0.7+ confidence)
- Community Intelligence: Reddit presence, user sentiment, problem discussions (0.6+ confidence)

Competitive Intelligence (Phase 3):
- Direct Competitors: Feature comparisons, pricing analysis, positioning (0.8+ confidence)
- Indirect Competitors: Alternative solutions, market alternatives (0.7+ confidence)
- Competitive Content: Messaging analysis, differentiation points (0.7+ confidence)

Customer Intelligence (Phase 4):
- Customer Profiles: ICP analysis, use cases, success stories (0.8+ confidence)
- Review Analysis: G2, Capterra, Trustpilot feedback (0.8+ confidence)
- Implementation: Customer journey, success metrics, timelines (0.7+ confidence)

Market Intelligence (Phase 5):
- Industry Trends: Market size, growth rates, regulatory environment (0.7+ confidence)
- Analyst Relations: Gartner, Forrester mentions, industry recognition (0.8+ confidence)

Technical Intelligence (Phase 6):
- Security Posture: Compliance, certifications, security features (0.8+ confidence)
- Technical Specs: API documentation, system requirements, integrations (0.8+ confidence)

Business Intelligence (Phase 7):
- Business Health: Funding, revenue indicators, partnerships (0.8+ confidence)
- Risk Assessment: Financial stability, leadership stability, market position (0.7+ confidence)

CONFIDENCE SCORING:
- 0.9-1.0: Comprehensive intelligence with multiple sources and detailed findings
- 0.8-0.89: Strong intelligence with key findings and supporting evidence
- 0.7-0.79: Good intelligence with main points covered
- 0.6-0.69: Basic intelligence with some gaps
- 0.5-0.59: Partial intelligence with significant gaps
- Below 0.5: Insufficient intelligence, needs more research

For each question, determine:
1. If the sources contain adequate intelligence findings
2. The confidence level (0.0-1.0) that the intelligence question was answered
3. A brief summary of key intelligence findings if available
4. Which sources contain the most valuable intelligence

Return ONLY a JSON array, no markdown formatting or code blocks:
[
  {
    "question": "the intelligence question",
    "answered": true/false,
    "confidence": 0.0-1.0,
    "answer": "brief intelligence summary if found",
    "sources": ["urls that contain the intelligence"]
  }
]`),
      new HumanMessage(`Intelligence questions to evaluate:
${subQueries.map(sq => sq.question).join('\n')}

Sources:
${sources.slice(0, SEARCH_CONFIG.MAX_SOURCES_TO_CHECK).map(s => {
  let sourceInfo = `URL: ${s.url}\nTitle: ${s.title}\n`;
  
  // Include summary if available (this is the key insight from the search)
  if (s.summary) {
    sourceInfo += `Summary: ${s.summary}\n`;
  }
  
  // Include content preview
  if (s.content) {
    sourceInfo += `Content: ${s.content.slice(0, SEARCH_CONFIG.ANSWER_CHECK_PREVIEW)}\n`;
  }
  
  return sourceInfo;
}).join('\n---\n')}`)
    ];

    try {
      const response = await this.llm.invoke(messages);
      let content = response.content.toString();
      
      // Strip markdown code blocks if present
      content = content.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();
      
      const results = JSON.parse(content);
      
      // Update sub-queries with results
      return subQueries.map(sq => {
        const result = results.find((r: { question: string }) => r.question === sq.question);
        if (result && result.confidence > sq.confidence) {
          return {
            ...sq,
            answered: result.confidence >= SEARCH_CONFIG.MIN_ANSWER_CONFIDENCE,
            answer: result.answer,
            confidence: result.confidence,
            sources: [...new Set([...sq.sources, ...(result.sources || [])])]
          };
        }
        return sq;
      });
    } catch (error) {
      console.error('Error checking answers:', error);
      return subQueries;
    }
  }

  private async extractSubQueries(query: string): Promise<Array<{ question: string; searchQuery: string }>> {
    const messages = [
      new SystemMessage(`Extract intelligence gathering sub-questions for deep website research. Each question should focus on a specific aspect of the 7-phase intelligence framework.

INTELLIGENCE FRAMEWORK PHASES:
1. Website Intelligence: Architecture, pricing, leadership
2. Social Intelligence: LinkedIn, Twitter, YouTube, Reddit
3. Competitive Intelligence: Direct/indirect competitors, positioning
4. Customer Intelligence: ICP, reviews, success stories
5. Market Intelligence: Industry trends, analyst relations
6. Technical Intelligence: Security, specifications, integrations
7. Business Intelligence: Funding, partnerships, risks

IMPORTANT: 
- When analyzing a company/website, break down into systematic intelligence gathering questions
- Focus on actionable intelligence that would help with competitive analysis, sales strategy, or market research
- Each question should target a specific intelligence area
- Search queries should use company name + intelligence keywords

Examples:
"Research Company X" → 
[
  {"question": "What is Company X's website architecture and content structure?", "searchQuery": "Company X sitemap robots.txt navigation structure"},
  {"question": "What are Company X's pricing tiers and enterprise options?", "searchQuery": "Company X pricing tiers enterprise pricing cost"},
  {"question": "Who are Company X's key executives and leadership team?", "searchQuery": "Company X leadership team executives founders"},
  {"question": "What is Company X's social media presence and engagement?", "searchQuery": "Company X LinkedIn Twitter social media presence"},
  {"question": "Who are Company X's main competitors and how do they compare?", "searchQuery": "Company X competitors comparison alternatives"},
  {"question": "What do customers say about Company X in reviews?", "searchQuery": "Company X reviews G2 Capterra customer feedback"},
  {"question": "What is Company X's technology stack and security posture?", "searchQuery": "Company X technology stack security compliance"},
  {"question": "What is Company X's funding status and business health?", "searchQuery": "Company X funding investors revenue growth"}
]

"Analyze Product Y" →
[
  {"question": "What are Product Y's core features and capabilities?", "searchQuery": "Product Y features capabilities specifications"},
  {"question": "How does Product Y compare to competing solutions?", "searchQuery": "Product Y vs competitors comparison alternatives"},
  {"question": "What is Product Y's pricing model and enterprise options?", "searchQuery": "Product Y pricing cost enterprise pricing"},
  {"question": "What do customers say about Product Y implementation?", "searchQuery": "Product Y customer reviews implementation case studies"},
  {"question": "What is Product Y's technical architecture and integrations?", "searchQuery": "Product Y API integrations technical architecture"}
]

Important: 
- Generate 6-8 intelligence gathering questions covering all major phases
- Each question should be specific and actionable
- Search queries should use company/product name + intelligence keywords
- Focus on competitive intelligence and market research value

Return ONLY a JSON array of {question, searchQuery} objects.`),
      new HumanMessage(`Query: "${query}"`)
    ];

    try {
      const response = await this.llm.invoke(messages);
      return JSON.parse(response.content.toString());
    } catch {
      // Fallback: treat as single query
      return [{ question: query, searchQuery: query }];
    }
  }

  // This method was removed as it's not used in the current implementation
  // Search queries are now generated from sub-queries in the plan node

  private async generateAlternativeSearchQueries(
    subQueries: Array<{ question: string; searchQuery: string; answered: boolean; answer?: string; confidence: number; sources: string[] }>,
    previousAttempts: number
  ): Promise<string[]> {
    const unansweredQueries = subQueries.filter(sq => !sq.answered || sq.confidence < SEARCH_CONFIG.MIN_ANSWER_CONFIDENCE);
    
    // If we're on attempt 3 and still searching for the same thing, just give up on that specific query
    if (previousAttempts >= 2) {
      const problematicQueries = unansweredQueries.filter(sq => {
        // Check if the question contains a version number or specific identifier that might not exist
        const hasVersionPattern = /\b\d{3,4}\b|\bv\d+\.\d+|\bversion\s+\d+/i.test(sq.question);
        const hasFailedMultipleTimes = previousAttempts >= 2;
        return hasVersionPattern && hasFailedMultipleTimes;
      });
      
      if (problematicQueries.length > 0) {
        // Return generic searches that might find partial info
        return problematicQueries.map(sq => {
          const baseTerm = sq.question.replace(/0528|specific version/gi, '').trim();
          return baseTerm.substring(0, 50); // Keep it short
        });
      }
    }
    
    const messages = [
      new SystemMessage(`${this.getCurrentDateContext()}

Generate ALTERNATIVE intelligence gathering search queries for questions that weren't adequately answered in previous attempts.

Previous search attempts: ${previousAttempts}
Previous queries that didn't find sufficient intelligence:
${unansweredQueries.map(sq => `- Intelligence Question: "${sq.question}"\n  Previous search: "${sq.searchQuery}"`).join('\n')}

INTELLIGENCE GATHERING ALTERNATIVE STRATEGIES:

Website Intelligence Alternatives:
- Try broader company research: "[Company] about us team leadership"
- Search for company documents: "[Company] sitemap robots.txt"
- Look for company resources: "[Company] resources downloads case studies"

Social Intelligence Alternatives:
- Search for company social presence: "[Company] LinkedIn Twitter social media"
- Look for employee activity: "[Company] employees team members LinkedIn"
- Search for community mentions: "[Company] Reddit forum community"

Competitive Intelligence Alternatives:
- Broader competitive research: "[Company] competitors alternatives comparison"
- Industry positioning: "[Company] industry market position"
- Partnership research: "[Company] partners integrations ecosystem"

Customer Intelligence Alternatives:
- Review site research: "[Company] G2 Capterra Trustpilot reviews"
- Customer success stories: "[Company] customer success case studies testimonials"
- Implementation research: "[Company] implementation deployment onboarding"

Market Intelligence Alternatives:
- Industry context: "[Company] industry trends market size"
- Analyst coverage: "[Company] Gartner Forrester analyst reports"
- Media coverage: "[Company] press releases news coverage"

Technical Intelligence Alternatives:
- Technology research: "[Company] technology stack architecture"
- Security research: "[Company] security compliance certifications"
- API documentation: "[Company] API developer documentation"

Business Intelligence Alternatives:
- Funding research: "[Company] funding investors Crunchbase"
- Business news: "[Company] revenue growth partnerships"
- Executive research: "[Company] executives founders background"

Generate NEW intelligence gathering search queries using these strategies:
1. Try broader or more general intelligence gathering terms
2. Use different intelligence gathering keywords and phrases
3. Remove overly specific qualifiers that might be too restrictive
4. Try searching for related intelligence areas that might contain the answer
5. For companies that might not have extensive public information, search for industry context

Examples of alternative intelligence searches:
- Original: "Company X pricing enterprise" → Alternative: "Company X pricing cost plans"
- Original: "Company X leadership team" → Alternative: "Company X executives founders about us"
- Original: "Company X competitors comparison" → Alternative: "Company X alternatives competitors industry"

Return one alternative intelligence gathering search query per unanswered question, one per line.`),
      new HumanMessage(`Generate alternative intelligence gathering searches for these ${unansweredQueries.length} unanswered intelligence questions.`)
    ];

    try {
      const response = await this.llm.invoke(messages);
      const result = response.content.toString();
      
      const queries = result
        .split('\n')
        .map(q => q.trim())
        .map(q => q.replace(/^["']|["']$/g, ''))
        .map(q => q.replace(/^\d+\.\s*/, ''))
        .map(q => q.replace(/^[-*#]\s*/, ''))
        .filter(q => q.length > 0)
        .filter(q => !q.match(/^```/))
        .filter(q => q.length > 3);
      
      return queries.slice(0, SEARCH_CONFIG.MAX_SEARCH_QUERIES);
    } catch {
      // Fallback: return original queries with slight modifications
      return unansweredQueries.map(sq => sq.searchQuery + " intelligence research").slice(0, SEARCH_CONFIG.MAX_SEARCH_QUERIES);
    }
  }

  private scoreContent(content: string, query: string): number {
    const queryWords = query.toLowerCase().split(' ');
    const contentLower = content.toLowerCase();
    
    let score = 0;
    for (const word of queryWords) {
      if (contentLower.includes(word)) score += 0.2;
    }
    
    return Math.min(score, 1);
  }

  private async summarizeContent(content: string, query: string): Promise<string> {
    try {
      const messages = [
        new SystemMessage(`${this.getCurrentDateContext()}

Extract ONE key intelligence finding from this content that's SPECIFICALLY relevant to the intelligence gathering query.

CRITICAL: Only summarize intelligence that directly relates to the research query.
- If researching "Company X pricing", only mention pricing intelligence
- If researching "Company X leadership", only mention leadership intelligence
- If researching "Company X competitors", only mention competitive intelligence
- If no relevant intelligence is found, extract the most relevant business insight

INTELLIGENCE FOCUS AREAS:
- Website Intelligence: Architecture, content structure, navigation
- Pricing Intelligence: Pricing models, tiers, enterprise options
- Leadership Intelligence: Executive backgrounds, team structure, expertise
- Social Intelligence: Social media presence, engagement, content themes
- Competitive Intelligence: Competitor analysis, positioning, differentiation
- Customer Intelligence: Customer profiles, reviews, success stories
- Market Intelligence: Industry trends, market position, analyst coverage
- Technical Intelligence: Technology stack, security, integrations
- Business Intelligence: Funding, partnerships, growth indicators

Instructions:
- Return just ONE sentence with a specific intelligence finding
- Include numbers, dates, names, or specific details when available
- Keep it under ${SEARCH_CONFIG.SUMMARY_CHAR_LIMIT} characters
- Focus on actionable intelligence insights
- Don't say "No relevant information was found" - find something relevant to the current intelligence gathering`),
        new HumanMessage(`Intelligence Query: "${query}"\n\nContent: ${content.slice(0, 2000)}`)
      ];
      
      const response = await this.llm.invoke(messages);
      return response.content.toString().trim();
    } catch {
      return '';
    }
  }

  private async generateCompanyResearchReport(
    query: string,
    sources: Source[],
    onChunk: (chunk: string) => void,
    context?: { query: string; response: string }[]
  ): Promise<string> {
    const sourcesText = sources
      .map((s, i) => {
        if (!s.content) return `[${i + 1}] ${s.title}\n[No content available]`;
        return `[${i + 1}] ${s.title}\n${s.content}`;
      })
      .join('\n\n');
    
    let contextPrompt = '';
    if (context && context.length > 0) {
      contextPrompt = '\n\nPrevious conversation for context:\n';
      context.forEach(c => {
        contextPrompt += `User: ${c.query}\nAssistant: ${c.response.substring(0, 300)}...\n\n`;
      });
    }
    
    const messages = [
      new SystemMessage(`${this.getCurrentDateContext()}

You are a specialized company research analyst. Based on the provided sources, create a comprehensive company research report focusing ONLY on the target company analysis. DO NOT create ICP profiles or prospect lists.

COMPANY RESEARCH REPORT STRUCTURE:

1. EXECUTIVE SUMMARY (10-15 bullet points)
   - Market Position & Value Proposition
   - Business Model & Revenue Streams
   - Pricing Strategy & Go-to-Market Approach
   - Leadership Team & Organizational Strength
   - Technology Stack & Competitive Advantages
   - Growth Stage & Market Opportunity
   - Partnership Ecosystem & Channel Strategy
   - Risk Factors & Market Challenges

2. DETAILED COMPANY ANALYSIS
   - Company Overview & Mission
   - Product & Service Portfolio
   - Pricing & Packaging Strategy
   - Leadership & Organizational Structure
   - Technology & Security Profile
   - Marketing & Content Strategy
   - Sales Process & Customer Acquisition
   - Partnership & Channel Strategy
   - Competitive Positioning
   - Financial Health & Growth Indicators

3. CUSTOMER ANALYSIS (for understanding their business, NOT for ICP creation)
   - Customer Case Studies & Success Stories
   - Customer Testimonials & Feedback
   - Customer Journey & Implementation Process
   - Customer Support & Success Programs
   - Customer Retention & Expansion Strategies

4. COMPANY INTELLIGENCE TABLES
   - Key Facts Summary (company details, pricing, technology, compliance)
   - Leadership Matrix (key personnel with backgrounds and expertise)
   - Content Inventory (available resources and marketing materials)
   - Social Media Presence (platform activity and engagement)

5. COMPETITIVE LANDSCAPE
   - Direct Competitors & Market Positioning
   - Competitive Advantages & Differentiators
   - Market Share & Industry Standing
   - Competitive Threats & Opportunities

6. BUSINESS INTELLIGENCE
   - Revenue Model & Monetization Strategy
   - Growth Trajectory & Market Expansion
   - Technology Infrastructure & Scalability
   - Funding History & Financial Backing
   - Strategic Partnerships & Alliances

IMPORTANT GUIDELINES:
- Focus ONLY on analyzing the target company
- Extract factual information from customer case studies to understand their business
- Do NOT create ICP profiles, prospect lists, or outreach strategies
- Do NOT suggest companies to target or contact strategies
- Provide comprehensive company intelligence only

Formatting:
- Use clear markdown subsections
- Add citations [1], [2], etc. next to claims
- Keep analysis focused on the target company only`),
      new HumanMessage(`Company Research Request: "${query}"${contextPrompt}\n\nBased on these company intelligence sources:\n${sourcesText}`)
    ];
    
    let fullText = '';
    
    try {
      const stream = await this.streamingLlm.stream(messages);
      
      for await (const chunk of stream) {
        const content = chunk.content;
        if (typeof content === 'string') {
          fullText += content;
          onChunk(content);
        }
      }
    } catch {
      // Fallback to non-streaming if streaming fails
      const response = await this.llm.invoke(messages);
      fullText = response.content.toString();
      onChunk(fullText);
    }
    
    return fullText;
  }

  private async generateStreamingAnswer(
    query: string,
    sources: Source[],
    onChunk: (chunk: string) => void,
    context?: { query: string; response: string }[]
  ): Promise<string> {
    const sourcesText = sources
      .map((s, i) => {
        if (!s.content) return `[${i + 1}] ${s.title}\n[No content available]`;
        return `[${i + 1}] ${s.title}\n${s.content}`;
      })
      .join('\n\n');
    
    let contextPrompt = '';
    if (context && context.length > 0) {
      contextPrompt = '\n\nPrevious conversation for context:\n';
      context.forEach(c => {
        contextPrompt += `User: ${c.query}\nAssistant: ${c.response.substring(0, 300)}...\n\n`;
      });
    }
    
    const messages = [
      new SystemMessage(`${this.getCurrentDateContext()}

You are a specialized intelligence analyst. Based on the provided sources, create a comprehensive intelligence report following the 7-phase intelligence framework.

INTELLIGENCE REPORT STRUCTURE:

1. EXECUTIVE INTELLIGENCE BRIEF (15-20 bullet points)
   - Market Position, Value Proposition, Customer Profile
   - Pricing Strategy, Growth Stage, Technology Approach
   - Leadership Strength, Partnership Ecosystem, Market Opportunity
   - Competitive Advantages, Risk Factors, Sales Approach
   - Customer Success, Content Strategy, Industry Recognition

2. DETAILED INTELLIGENCE SECTIONS
   - Company Overview & Positioning
   - Product & Service Portfolio
   - Pricing & Packaging Intelligence
   - Leadership & Organizational Structure
   - Customer Intelligence & Success Stories
   - Marketing & Content Strategy
   - Technology & Security Profile
   - Partnership & Channel Strategy
   - Competitive Landscape Analysis
   - Sales Process & Customer Acquisition

3. KEY FACTS SUMMARY TABLE
   - Company details, pricing, technology, compliance

4. EMPLOYEE INTELLIGENCE MATRIX
   - Key personnel with backgrounds and expertise

5. CONTENT INVENTORY CATALOG
   - Available resources and lead generation value

6. SOCIAL MEDIA INTELLIGENCE DASHBOARD
   - Platform presence and engagement metrics

7. COMPETITIVE INTELLIGENCE & MARKET ANALYSIS
   - Market Positioning: How the company positions itself relative to competitors
   - Competitive Advantages: Unique value propositions and differentiators  
   - Market Trends: Industry trends and market dynamics affecting the company
   - Competitor Landscape: Overview of key competitors and market positioning
   - Strategic Insights: Business strategy insights and market opportunities

Formatting:
- Use clear markdown subsections.
- Add citations [1], [2], etc. next to claims.
- Focus on actionable intelligence and strategic insights.
- Conclude with follow-up recommendations for deeper analysis.`),
      new HumanMessage(`Intelligence Research Request: "${query}"${contextPrompt}\n\nBased on these intelligence sources:\n${sourcesText}`)
    ];
    
    let fullText = '';
    
    try {
      const stream = await this.streamingLlm.stream(messages);
      
      for await (const chunk of stream) {
        const content = chunk.content;
        if (typeof content === 'string') {
          fullText += content;
          onChunk(content);
        }
      }
    } catch {
      // Fallback to non-streaming if streaming fails
      const response = await this.llm.invoke(messages);
      fullText = response.content.toString();
      onChunk(fullText);
    }
    
    return fullText;
  }

  private async generateFollowUpQuestions(
    originalQuery: string,
    answer: string,
    _sources: Source[],
    context?: { query: string; response: string }[]
  ): Promise<string[]> {
    try {
      let contextPrompt = '';
      if (context && context.length > 0) {
        contextPrompt = '\n\nPrevious conversation topics:\n';
        context.forEach(c => {
          contextPrompt += `- ${c.query}\n`;
        });
        contextPrompt += '\nConsider the full conversation flow when generating follow-ups.\n';
      }
      
      const messages = [
        new SystemMessage(`${this.getCurrentDateContext()}

Based on this intelligence research and findings, generate 3 short follow-up prompts that:
- Ask the user to VALIDATE the proposed ICPs and sample lookalike accounts (Yes / No / Suggest edits)
- Offer to refine segments by industry, company size, or geo
- Offer to deepen buyer personas (titles, pains, objections) or use-case mapping

Constraints:
- Exactly 3 lines, one per question
- Each under 80 characters
- Actionable and specific to ICP validation/refinement
- No bullets or numbering`),
        new HumanMessage(`Original intelligence research: "${originalQuery}"\n\nIntelligence findings summary: ${answer.length > 1000 ? answer.slice(0, 1000) + '...' : answer}${contextPrompt}`)
      ];
      
      const response = await this.llm.invoke(messages);
      const questions = response.content.toString()
        .split('\n')
        .map(q => q.trim())
        .filter(q => q.length > 0 && q.length < 80)
        .slice(0, 3);
      
      return questions.length > 0 ? questions : [];
    } catch {
      return [];
    }
  }
}