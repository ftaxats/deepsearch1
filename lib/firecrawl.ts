/* eslint-disable @typescript-eslint/no-explicit-any */
import FirecrawlApp from '@mendable/firecrawl-js';
import { CRAWL_CONFIG } from './config';

export interface CrawlOptions {
  limit?: number;
  maxDepth?: number;
  allowSubdomains?: boolean;
  includePaths?: string[];
  excludePaths?: string[];
  scrapeOptions?: {
    formats?: string[];
    onlyMainContent?: boolean;
    waitFor?: number;
    timeout?: number;
  };
}

export interface StructuredExtractionSchema {
  type: 'object';
  properties: {
    [key: string]: {
      type: string;
      description: string;
    };
  };
  required?: string[];
}

export interface CrawlResult {
  success: boolean;
  id?: string;
  status?: 'scraping' | 'completed' | 'failed';
  total?: number;
  completed?: number;
  creditsUsed?: number;
  data?: any[];
  error?: string;
}

export class FirecrawlClient {
  private client: FirecrawlApp;

  constructor(providedApiKey?: string) {
    const apiKey = providedApiKey || process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      throw new Error('FIRECRAWL_API_KEY is required - either provide it or set it as an environment variable');
    }
    this.client = new FirecrawlApp({ apiKey });
  }

  async scrapeUrl(url: string, timeoutMs: number = 15000) {
    try {
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Scraping timeout')), timeoutMs);
      });
      
      // Race the scraping against the timeout
      const scrapePromise = this.client.scrapeUrl(url, {
        formats: ['markdown', 'html'],
      });
      
      const result = await Promise.race([scrapePromise, timeoutPromise]) as any;
      
      if ('success' in result && !result.success) {
        throw new Error(result.error || 'Scrape failed');
      }
      
      return {
        markdown: (result as any).markdown || '',
        html: (result as any).html || '',
        metadata: (result as any).metadata || {},
        success: true,
      };
    } catch (error: any) {
      
      // Handle timeout errors
      if (error?.message === 'Scraping timeout') {
        return {
          markdown: '',
          html: '',
          metadata: {
            error: 'Scraping took too long and was stopped',
            timeout: true,
          },
          success: false,
          error: 'timeout',
        };
      }
      
      // Handle 403 errors gracefully
      if (error?.statusCode === 403 || error?.message?.includes('403')) {
        return {
          markdown: '',
          html: '',
          metadata: {
            error: 'This website is not supported by Firecrawl',
            statusCode: 403,
          },
          success: false,
          error: 'unsupported',
        };
      }
      
      // Return error info for other failures
      return {
        markdown: '',
        html: '',
        metadata: {
          error: error?.message || 'Failed to scrape URL',
          statusCode: error?.statusCode,
        },
        success: false,
        error: 'failed',
      };
    }
  }

  async mapUrl(url: string, options?: { search?: string; limit?: number }) {
    try {
      const result = await this.client.mapUrl(url, {
        search: options?.search,
        limit: options?.limit || 10,
      });
      
      if ('success' in result && !result.success) {
        throw new Error((result as any).error || 'Map failed');
      }
      
      return {
        links: (result as any).links || [],
        metadata: (result as any).metadata || {},
      };
    } catch (error) {
      throw error;
    }
  }

  async search(query: string, options?: { limit?: number; scrapeOptions?: any }) {
    try {
      // Search with scrape - this gets us content immediately!
      const searchParams: any = {
        limit: options?.limit || 10,
      };
      
      // Add scrapeOptions to get content with search results
      if (options?.scrapeOptions !== false) {
        searchParams.scrapeOptions = {
          formats: ['markdown'],
          ...options?.scrapeOptions
        };
      }
      
      
      const result = await this.client.search(query, searchParams);
      
      
      // Handle the actual Firecrawl v1 API response format
      if (result && typeof result === 'object' && 'success' in result) {
        if (!(result as any).success) {
          throw new Error((result as any).error || 'Search failed');
        }
      }
      
      // Extract data - search with scrape returns data with content
      const data = (result as any)?.data || [];
      
      // Transform to include scraped content
      const enrichedData = data.map((item: any) => {
        // Try to extract favicon from metadata or construct default
        let favicon = item.metadata?.favicon || null;
        if (!favicon && item.metadata?.ogImage) {
          favicon = item.metadata.ogImage;
        } else if (!favicon && item.url) {
          // Default favicon URL
          const domain = new URL(item.url).hostname;
          favicon = `https://${domain}/favicon.ico`;
        }
        
        return {
          url: item.url,
          title: item.title || item.metadata?.title || 'Untitled',
          description: item.description || item.metadata?.description || '',
          markdown: item.markdown || '',
          html: item.html || '',
          links: item.links || [],
          screenshot: item.screenshot || null,
          metadata: {
            ...item.metadata,
            favicon: favicon,
            screenshot: item.screenshot
          },
          scraped: true, // Mark as already scraped
          content: item.markdown || '', // For compatibility
          favicon: favicon // Add at top level for easy access
        };
      });
      
      return {
        data: enrichedData,
        results: enrichedData, // For backward compatibility
        metadata: (result as any)?.metadata || {},
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Comprehensive website crawling using Firecrawl's /crawl endpoint
   * Recursively discovers and scrapes all pages on a website
   */
  async crawlWebsite(url: string, options: CrawlOptions = {}): Promise<CrawlResult> {
    try {
      const crawlParams: any = {
        url,
        limit: options.limit || CRAWL_CONFIG.DEFAULT_CRAWL_LIMIT,
        ...options
      };

      // Configure scrape options for comprehensive data extraction
      if (options.scrapeOptions) {
        crawlParams.scrapeOptions = {
          formats: ['markdown', 'html'],
          onlyMainContent: true,
          waitFor: 0,
          timeout: 30000,
          ...options.scrapeOptions
        };
      }

      // Note: Using crawlUrl method - adjust based on actual Firecrawl API
      const result = await this.client.crawlUrl(crawlParams.url, crawlParams);
      
      if (!result || !(result as any).success) {
        throw new Error((result as any)?.error || 'Crawl failed');
      }

      return {
        success: true,
        data: (result as any).data || [],
        total: (result as any).total || 0,
        completed: (result as any).completed || 0,
        creditsUsed: (result as any).creditsUsed || 0,
        status: (result as any).status || 'completed'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Crawl operation failed'
      };
    }
  }

  /**
   * Advanced website intelligence gathering with search-first URL discovery
   * Discovers relevant pages through search before targeted scraping
   */
  async gatherWebsiteIntelligence(url: string, intelligenceType: 'pricing' | 'team' | 'customers' | 'products' | 'competitors' | 'comprehensive' = 'comprehensive') {
    try {
      // Extract domain for search targeting
      const domain = new URL(url).hostname.replace('www.', '');
      
      // Define search strategies based on intelligence type
      const searchStrategies = {
        pricing: {
          searchQueries: [
            `site:${domain} (pricing OR plans OR cost OR subscription OR enterprise)`,
            `site:${domain} ("pricing" OR "plans" OR "cost" OR "enterprise pricing")`,
            `site:${domain} (price OR billing OR payment OR subscription)`
          ],
          limit: CRAWL_CONFIG.INTELLIGENCE_CRAWL_LIMIT,
          schema: {
            type: 'object' as const,
            properties: {
              pricingTiers: { type: 'array', description: 'List of pricing tiers with names and costs' },
              enterpriseOptions: { type: 'string', description: 'Enterprise pricing and contact information' },
              freeTrial: { type: 'string', description: 'Free trial availability and duration' },
              paymentMethods: { type: 'array', description: 'Accepted payment methods' }
            }
          }
        },
        team: {
          searchQueries: [
            `site:${domain} (team OR leadership OR founders OR executives OR about)`,
            `site:${domain} ("team" OR "leadership" OR "founders" OR "executives")`,
            `site:${domain} ("about us" OR "our team" OR "management" OR "staff")`
          ],
          limit: CRAWL_CONFIG.INTELLIGENCE_CRAWL_LIMIT,
          schema: {
            type: 'object' as const,
            properties: {
              leadership: { type: 'array', description: 'Leadership team members with names, titles, and backgrounds' },
              founders: { type: 'array', description: 'Company founders and their backgrounds' },
              teamSize: { type: 'string', description: 'Approximate company size or employee count' },
              keyPersonnel: { type: 'array', description: 'Key personnel and their expertise areas' }
            }
          }
        },
        customers: {
          searchQueries: [
            `site:${domain} (customers OR "case studies" OR testimonials OR clients OR "success stories")`,
            `site:${domain} ("customer" OR "case study" OR "testimonial" OR "client")`,
            `site:${domain} ("our customers" OR "customer success" OR "client testimonials")`
          ],
          limit: CRAWL_CONFIG.INTELLIGENCE_CRAWL_LIMIT,
          schema: {
            type: 'object' as const,
            properties: {
              customerNames: { type: 'array', description: 'Named customers and client companies' },
              caseStudies: { type: 'array', description: 'Customer case studies with outcomes' },
              testimonials: { type: 'array', description: 'Customer testimonials and quotes' },
              industries: { type: 'array', description: 'Industries served based on customer examples' }
            }
          }
        },
        products: {
          searchQueries: [
            `site:${domain} (products OR features OR solutions OR platform OR services)`,
            `site:${domain} ("products" OR "features" OR "solutions" OR "platform")`,
            `site:${domain} ("our products" OR "product features" OR "what we offer")`
          ],
          limit: CRAWL_CONFIG.INTELLIGENCE_CRAWL_LIMIT,
          schema: {
            type: 'object' as const,
            properties: {
              products: { type: 'array', description: 'Product names and descriptions' },
              features: { type: 'array', description: 'Key features and capabilities' },
              integrations: { type: 'array', description: 'Third-party integrations and API capabilities' },
              useCases: { type: 'array', description: 'Primary use cases and applications' }
            }
          }
        },
        competitors: {
          searchQueries: [
            `site:${domain} (compare OR vs OR alternatives OR competition OR competitors)`,
            `site:${domain} ("compare" OR "vs" OR "alternative" OR "competitor")`,
            `site:${domain} ("compared to" OR "versus" OR "competitive advantage")`
          ],
          limit: CRAWL_CONFIG.INTELLIGENCE_CRAWL_LIMIT,
          schema: {
            type: 'object' as const,
            properties: {
              competitors: { type: 'array', description: 'Named competitors and alternatives' },
              comparisons: { type: 'array', description: 'Feature comparisons and differentiators' },
              advantages: { type: 'array', description: 'Claimed competitive advantages' }
            }
          }
        },
        comprehensive: {
          searchQueries: [
            `site:${domain} (about OR company OR pricing OR team OR customers OR products)`,
            `site:${domain} ("about us" OR "company" OR "pricing" OR "team")`,
            `site:${domain} ("our mission" OR "what we do" OR "services" OR "solutions")`
          ],
          limit: CRAWL_CONFIG.DEFAULT_CRAWL_LIMIT,
          schema: {
            type: 'object' as const,
            properties: {
              companyOverview: { type: 'string', description: 'Company mission, vision, and overview' },
              products: { type: 'array', description: 'Products and services offered' },
              pricing: { type: 'object', description: 'Pricing information and models' },
              leadership: { type: 'array', description: 'Leadership team and key personnel' },
              customers: { type: 'array', description: 'Customer names and case studies' },
              competitors: { type: 'array', description: 'Competitors and market positioning' },
              contact: { type: 'object', description: 'Contact information and locations' }
            }
          }
        }
      };

      const strategy = searchStrategies[intelligenceType];
      
      // Step 1: Discover relevant URLs through search
      const discoveredUrls = await this.discoverRelevantUrls(strategy.searchQueries, strategy.limit);
      
      if (discoveredUrls.length === 0) {
        return {
          success: false,
          error: `No relevant ${intelligenceType} pages found through search discovery`
        };
      }

      // Step 2: Scrape the discovered URLs
      const scrapedData = await this.scrapeDiscoveredUrls(discoveredUrls);

      if (scrapedData.length === 0) {
        return {
          success: false,
          error: `Failed to scrape discovered ${intelligenceType} pages`
        };
      }

      // Step 3: Extract structured data using schema
      const structuredData = await this.extractStructuredData(scrapedData, strategy.schema);

      return {
        success: true,
        intelligenceType,
        rawData: scrapedData,
        structuredData,
        discoveredUrls: discoveredUrls.map(u => u.url),
        summary: {
          totalPages: discoveredUrls.length,
          scrapedPages: scrapedData.length,
          searchQueries: strategy.searchQueries.length
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Intelligence gathering failed'
      };
    }
  }

  /**
   * Discover relevant URLs through targeted search queries
   */
  private async discoverRelevantUrls(searchQueries: string[], limit: number): Promise<Array<{url: string, title: string, relevanceScore: number}>> {
    const discoveredUrls: Array<{url: string, title: string, relevanceScore: number}> = [];
    const seenUrls = new Set<string>();

    for (const query of searchQueries) {
      try {
        const searchResults = await this.search(query, {
          limit: Math.ceil(limit / searchQueries.length),
          scrapeOptions: false // Don't scrape yet, just discover URLs
        });

        if (searchResults.data) {
          searchResults.data.forEach((result: any) => {
            if (!seenUrls.has(result.url)) {
              seenUrls.add(result.url);
              
              // Calculate relevance score based on title, description, and URL
              let relevanceScore = 0.3; // Base score
              
              const titleLower = (result.title || '').toLowerCase();
              const descLower = (result.description || '').toLowerCase();
              const urlLower = result.url.toLowerCase();
              
              // Boost score for high-value keywords in title
              const titleKeywords = ['pricing', 'team', 'customers', 'products', 'about', 'leadership', 'case', 'testimonial'];
              titleKeywords.forEach(keyword => {
                if (titleLower.includes(keyword)) {
                  relevanceScore += 0.2;
                }
              });
              
              // Boost score for high-value keywords in URL
              titleKeywords.forEach(keyword => {
                if (urlLower.includes(keyword)) {
                  relevanceScore += 0.15;
                }
              });
              
              // Boost score for substantial description
              if (descLower.length > 100) {
                relevanceScore += 0.15;
              } else if (descLower.length > 50) {
                relevanceScore += 0.1;
              }
              
              // Reduce score for excluded patterns
              const shouldExclude = CRAWL_CONFIG.EXCLUDE_PATTERNS.some(pattern => 
                urlLower.includes(pattern) || titleLower.includes(pattern)
              );
              
              if (shouldExclude) {
                relevanceScore *= 0.3; // Heavily penalize excluded content
              }
              
              // Only include URLs above threshold
              if (relevanceScore >= CRAWL_CONFIG.RELEVANCE_SCORE_THRESHOLD) {
                discoveredUrls.push({
                  url: result.url,
                  title: result.title || 'Untitled',
                  relevanceScore
                });
              }
            }
          });
        }
      } catch (error) {
        console.error(`Search query failed: ${query}`, error);
        continue;
      }
    }

    // Sort by relevance score and return top results
    return discoveredUrls
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
  }

  /**
   * Scrape the discovered URLs to get their content
   */
  private async scrapeDiscoveredUrls(urls: Array<{url: string, title: string, relevanceScore: number}>): Promise<any[]> {
    const scrapedData: any[] = [];

    for (const urlInfo of urls) {
      try {
        const scraped = await this.scrapeUrl(urlInfo.url);
        
        if (scraped.success && scraped.markdown && scraped.markdown.length > CRAWL_CONFIG.MIN_PAGE_CONTENT_LENGTH) {
          scrapedData.push({
            url: urlInfo.url,
            title: urlInfo.title,
            markdown: scraped.markdown,
            html: scraped.html,
            metadata: {
              ...scraped.metadata,
              relevanceScore: urlInfo.relevanceScore,
              discoveryMethod: 'search'
            }
          });
        }
      } catch (error) {
        console.error(`Failed to scrape ${urlInfo.url}:`, error);
        continue;
      }
      
      // Small delay between scrapes to be respectful
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return scrapedData;
  }

  /**
   * Extract structured data from crawled content using LLM analysis
   */
  private async extractStructuredData(pages: any[], schema: StructuredExtractionSchema): Promise<any> {
    try {
      // Combine content from all pages for analysis
      const combinedContent = pages
        .filter(page => page.markdown && page.markdown.length > 100)
        .map(page => `=== ${page.title} (${page.url}) ===\n${page.markdown.slice(0, 2000)}`)
        .join('\n\n');

      if (!combinedContent) {
        return null;
      }

      // Use OpenAI for structured extraction (this would typically be called from the search engine)
      // For now, return the raw content with basic structure
      return {
        extractedAt: new Date().toISOString(),
        schema: schema,
        content: combinedContent.slice(0, 5000), // Limit content size
        pages: pages.length
      };

    } catch (error) {
      console.error('Error extracting structured data:', error);
      return null;
    }
  }

  /**
   * Systematic competitor analysis crawling
   * Discovers competitors and gathers comprehensive intelligence
   */
  async analyzeCompetitorLandscape(primaryDomain: string, knownCompetitors: string[] = []): Promise<any> {
    try {
      const competitorIntelligence = [];

      // Analyze primary domain
      const primaryIntel = await this.gatherWebsiteIntelligence(primaryDomain, 'comprehensive');
      competitorIntelligence.push({
        domain: primaryDomain,
        type: 'primary',
        intelligence: primaryIntel
      });

      // Analyze known competitors
      for (const competitor of knownCompetitors.slice(0, 3)) { // Limit to avoid rate limits
        const competitorIntel = await this.gatherWebsiteIntelligence(competitor, 'comprehensive');
        competitorIntelligence.push({
          domain: competitor,
          type: 'competitor',
          intelligence: competitorIntel
        });

        // Small delay to be respectful
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      return {
        success: true,
        analysisDate: new Date().toISOString(),
        primaryDomain,
        competitorCount: knownCompetitors.length,
        intelligence: competitorIntelligence
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Competitor analysis failed'
      };
    }
  }

  /**
   * Map website structure using search-based discovery for accurate categorization
   */
  async mapWebsiteStructure(url: string): Promise<any> {
    try {
      const domain = new URL(url).hostname.replace('www.', '');
      
      // Use search-based discovery for each intelligence type
      const intelligenceTypes = ['pricing', 'team', 'customers', 'products'] as const;
      const categorizedUrls: any = {
        pricing: [],
        team: [],
        customers: [],
        products: [],
        other: []
      };
      
      let totalDiscovered = 0;

      // Discover URLs for each intelligence type through search
      for (const type of intelligenceTypes) {
        try {
          // Use the same search queries as gatherWebsiteIntelligence but just for discovery
          const searchQueries = this.getSearchQueriesForType(domain, type);
          const discoveredUrls = await this.discoverRelevantUrls(searchQueries, CRAWL_CONFIG.URL_DISCOVERY_LIMIT);
          
          categorizedUrls[type] = discoveredUrls.map(u => u.url);
          totalDiscovered += discoveredUrls.length;
        } catch (error) {
          console.error(`Failed to discover ${type} URLs for ${domain}:`, error);
          categorizedUrls[type] = [];
        }
      }

      // Also try general sitemap discovery as fallback
      try {
        const mapResult = await this.mapUrl(url, { limit: CRAWL_CONFIG.SITEMAP_DISCOVERY_LIMIT });
        
        if (mapResult.links && mapResult.links.length > 0) {
          // Filter out URLs already discovered through search
          const allDiscoveredUrls = new Set(
            Object.values(categorizedUrls).flat()
          );
          
          const additionalUrls = mapResult.links.filter((link: string) => 
            !allDiscoveredUrls.has(link) && 
            !CRAWL_CONFIG.EXCLUDE_PATTERNS.some(pattern => 
              link.toLowerCase().includes(pattern)
            )
          );
          
          categorizedUrls.other = additionalUrls;
          totalDiscovered += additionalUrls.length;
        }
      } catch (error) {
        console.error('Sitemap discovery failed:', error);
      }

      return {
        success: true,
        totalUrls: totalDiscovered,
        categorizedUrls,
        discoveryMethod: 'search-based',
        metadata: {
          searchBasedDiscovery: true,
          intelligenceTypes: intelligenceTypes.length,
          domain
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Website structure discovery failed'
      };
    }
  }

  /**
   * Get search queries for a specific intelligence type
   */
  private getSearchQueriesForType(domain: string, type: string): string[] {
    const queryMap: { [key: string]: string[] } = {
      pricing: [
        `site:${domain} (pricing OR plans OR cost OR subscription OR enterprise)`,
        `site:${domain} ("pricing" OR "plans" OR "cost" OR "enterprise pricing")`,
        `site:${domain} (price OR billing OR payment OR subscription)`
      ],
      team: [
        `site:${domain} (team OR leadership OR founders OR executives OR about)`,
        `site:${domain} ("team" OR "leadership" OR "founders" OR "executives")`,
        `site:${domain} ("about us" OR "our team" OR "management" OR "staff")`
      ],
      customers: [
        `site:${domain} (customers OR "case studies" OR testimonials OR clients OR "success stories")`,
        `site:${domain} ("customer" OR "case study" OR "testimonial" OR "client")`,
        `site:${domain} ("our customers" OR "customer success" OR "client testimonials")`
      ],
      products: [
        `site:${domain} (products OR features OR solutions OR platform OR services)`,
        `site:${domain} ("products" OR "features" OR "solutions" OR "platform")`,
        `site:${domain} ("our products" OR "product features" OR "what we offer")`
      ]
    };
    
    return queryMap[type] || [];
  }
}