// Search Engine Configuration
export const SEARCH_CONFIG = {
  // Search Settings
  MAX_SEARCH_QUERIES: 4,        // Maximum number of search queries to generate
  MAX_SOURCES_PER_SEARCH: 6,     // Maximum sources to return per search query
  MAX_SOURCES_TO_SCRAPE: 6,      // Maximum sources to scrape for additional content
  
  // Content Processing
  MIN_CONTENT_LENGTH: 100,       // Minimum content length to consider valid
  SUMMARY_CHAR_LIMIT: 100,       // Character limit for source summaries
  CONTEXT_PREVIEW_LENGTH: 500,   // Preview length for previous context
  ANSWER_CHECK_PREVIEW: 2500,    // Content preview length for answer checking
  MAX_SOURCES_TO_CHECK: 10,      // Maximum sources to check for answers
  
  // Retry Logic
  MAX_RETRIES: 2,                // Maximum retry attempts for failed operations
  MAX_SEARCH_ATTEMPTS: 3,        // Maximum attempts to find answers via search
  MIN_ANSWER_CONFIDENCE: 0.3,    // Minimum confidence (0-1) that a question was answered
  EARLY_TERMINATION_CONFIDENCE: 0.8, // Confidence level to skip additional searches
  
  // Timeouts
  SCRAPE_TIMEOUT: 15000,         // Timeout for scraping operations (ms)
  CRAWL_TIMEOUT: 60000,          // Timeout for comprehensive crawling operations (ms)
  
  // Performance
  SOURCE_ANIMATION_DELAY: 50,    // Delay between source animations (ms) - reduced from 150
  PARALLEL_SUMMARY_GENERATION: true, // Generate summaries in parallel
} as const;

// Enhanced Crawling Configuration
export const CRAWL_CONFIG = {
  // Website Intelligence Gathering
  DEFAULT_CRAWL_LIMIT: 50,       // Default number of pages to crawl per website
  MAX_CRAWL_LIMIT: 100,          // Maximum pages to crawl for comprehensive analysis
  INTELLIGENCE_CRAWL_LIMIT: 20,  // Pages per intelligence type (pricing, team, etc.)
  
  // Competitor Analysis
  MAX_COMPETITORS_TO_ANALYZE: 3, // Maximum competitors to analyze in parallel
  COMPETITOR_CRAWL_DELAY: 1000,  // Delay between competitor crawls (ms)
  
  // Content Quality Thresholds
  MIN_PAGE_CONTENT_LENGTH: 200,  // Minimum content length for page to be valuable
  HIGH_VALUE_CONTENT_LENGTH: 1000, // Content length that indicates high-value page
  
  // Intelligence Type Priorities
  INTELLIGENCE_PRIORITIES: {
    pricing: 0.95,               // Highest priority for business intelligence
    customers: 0.90,             // High priority for customer intelligence
    team: 0.85,                  // High priority for team intelligence
    products: 0.80,              // Medium-high priority for product intelligence
    competitors: 0.75            // Medium priority for competitive intelligence
  },
  
  // Search-Based Discovery Settings
  SEARCH_QUERIES_PER_TYPE: 3,   // Number of search queries per intelligence type
  URL_DISCOVERY_LIMIT: 20,      // Maximum URLs to discover per intelligence type
  RELEVANCE_SCORE_THRESHOLD: 0.4, // Minimum relevance score for discovered URLs
  
  // Content Filtering (for excluding low-value content)
  EXCLUDE_PATTERNS: [
    'blog', 'news', 'press', 'careers',
    'support', 'help', 'docs', 'legal',
    'privacy', 'terms', 'cookie'
  ],
  
  // Website Mapping
  SITEMAP_DISCOVERY_LIMIT: 100, // Maximum URLs to discover via sitemap
  URL_CATEGORIZATION_ENABLED: true, // Enable automatic URL categorization
  
  // Structured Data Extraction
  ENABLE_STRUCTURED_EXTRACTION: true, // Enable schema-based data extraction
  MAX_CONTENT_FOR_EXTRACTION: 5000,  // Maximum content length for LLM analysis
  EXTRACTION_BATCH_SIZE: 10,          // Number of pages to process in each extraction batch
} as const;

// You can also export individual configs for different components
export const UI_CONFIG = {
  ANIMATION_DURATION: 300,       // Default animation duration (ms)
  SOURCE_FADE_DELAY: 50,         // Delay between source animations (ms)
  MESSAGE_CYCLE_DELAY: 2000,     // Delay for cycling through messages (ms)
} as const;

// Model Configuration
export const MODEL_CONFIG = {
  FAST_MODEL: "gpt-4o-mini",     // Fast model for quick operations
  QUALITY_MODEL: "gpt-4o",       // High-quality model for final synthesis
  TEMPERATURE: 0,                // Model temperature (0 = deterministic)
} as const;