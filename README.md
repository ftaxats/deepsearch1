# Firesearch - AI-Powered Deep Research Intelligence Tool

<div align="center">
  <img src="https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExd2F2YWo4amdieGVnOXR3aGM5ZnBlcDZvbnRjNW1vNmtpeWNhc3VtbSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/Jw7Q08ll8Vh0BoApI8/giphy.gif" alt="Firesearch Demo" width="100%" />
</div>

Comprehensive website intelligence gathering and competitive analysis powered by [Firecrawl](https://www.firecrawl.dev/) and [LangGraph](https://www.langchain.com/langgraph)

## 🎯 What It Does

Firesearch is a specialized intelligence gathering tool that conducts systematic 7-phase competitive intelligence research on any company, product, or website. Instead of general web search, it provides deep competitive analysis and market research insights.

### 🔍 Intelligence Gathering Framework

**PHASE 1: DEEP WEBSITE INTELLIGENCE**
- Website Architecture Analysis (sitemap, navigation, content audit)
- Pricing Intelligence Deep-Dive (all tiers, enterprise options, hidden costs)
- Leadership & Team Intelligence (executive bios, LinkedIn research, advisory board)

**PHASE 2: OMNICHANNEL SOCIAL INTELLIGENCE**
- LinkedIn Deep Analysis (metrics, content themes, employee advocacy)
- Twitter/X Intelligence Gathering (activity patterns, influencer engagement)
- YouTube Content Analysis (strategy, engagement, speaker analysis)
- Reddit Community Intelligence (presence, sentiment, problem discussions)

**PHASE 3: COMPETITIVE INTELLIGENCE MATRIX**
- Direct Competitor Deep-Dive (feature matrix, pricing strategy, positioning)
- Indirect Competitor Mapping (alternative solutions, build vs. buy options)
- Competitive Content Analysis (messaging, differentiation, partnerships)

**PHASE 4: CUSTOMER INTELLIGENCE MINING**
- Customer Profile Deep-Dive (ICP analysis, journey mapping, success stories)
- Review & Feedback Analysis (G2, Capterra, Trustpilot, industry forums)
- Customer Success Intelligence (implementation, training, expansion patterns)

**PHASE 5: INDUSTRY & MARKET INTELLIGENCE**
- Market Context Research (growth rates, regulatory environment, trends)
- Analyst Relations (Gartner, Forrester mentions, industry recognition)

**PHASE 6: TECHNICAL & SECURITY INTELLIGENCE**
- Security Posture Analysis (compliance, certifications, security features)
- Technical Specifications (API documentation, system requirements, integrations)

**PHASE 7: FINANCIAL & BUSINESS INTELLIGENCE**
- Business Health Indicators (funding, revenue, partnerships, growth)
- Risk Assessment (stability, leadership, market position, technology risks)

## 🚀 How to Use

Simply provide:
- **Company name** (e.g., "Research OpenAI")
- **Website URL** (e.g., "https://openai.com")
- **Product name** (e.g., "Analyze ChatGPT")

The system will automatically:
1. Break down your request into 6-8 intelligence gathering areas
2. Execute systematic research across all 7 phases
3. Generate a comprehensive intelligence report
4. Provide actionable competitive insights

## 📊 Output Deliverables

### 1. Executive Intelligence Brief (15-20 bullet points)
- Market Position, Value Proposition, Customer Profile
- Pricing Strategy, Growth Stage, Technology Approach
- Leadership Strength, Partnership Ecosystem, Market Opportunity
- Competitive Advantages, Risk Factors, Sales Approach

### 2. Detailed Intelligence Report (15-25 pages)
- Organized by intelligence phases with specific findings
- Source attribution and confidence scoring
- Screenshots and direct quotes
- Competitive positioning analysis

### 3. Contact Strategy Recommendations
- Personalized outreach approach
- Pain points to address
- Relevant case studies to reference
- Timing and channel recommendations

### 4. Competitive Battle Card
- Key talking points and differentiation messaging
- Competitive advantages to highlight
- Common objections and responses
- Customer success story ammunition

## 🛠️ Technologies

- **Firecrawl**: Multi-source web content extraction and scraping
- **OpenAI GPT-4o**: Intelligence analysis and report generation
- **LangGraph**: Orchestrated research workflow management
- **Next.js 15**: Modern React framework with App Router

## ⚙️ Setup

### Required API Keys

| Service | Purpose | Get Key |
|---------|---------|---------|
| Firecrawl | Web scraping and content extraction | [firecrawl.dev/app/api-keys](https://www.firecrawl.dev/app/api-keys) |
| OpenAI | Intelligence analysis and synthesis | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |

### Quick Start

1. Clone this repository
2. Create a `.env.local` file with your API keys:
   ```
   FIRECRAWL_API_KEY=your_firecrawl_key
   OPENAI_API_KEY=your_openai_key
   ```
3. Install dependencies: `npm install` or `yarn install`
4. Run the development server: `npm run dev` or `yarn dev`

## 🔧 Configuration

Customize intelligence gathering behavior by modifying [`lib/config.ts`](lib/config.ts):

```typescript
export const SEARCH_CONFIG = {
  // Intelligence Gathering Settings
  MAX_SEARCH_QUERIES: 12,        // Maximum intelligence areas to research
  MAX_SOURCES_PER_SEARCH: 4,     // Maximum sources per intelligence area
  MAX_SOURCES_TO_SCRAPE: 3,      // Maximum sources to scrape for content
  
  // Content Processing
  MIN_CONTENT_LENGTH: 100,       // Minimum content length to consider valid
  SUMMARY_CHAR_LIMIT: 100,       // Character limit for intelligence summaries
  
  // Intelligence Validation
  MAX_RETRIES: 2,                // Maximum retry attempts for failed operations
  MAX_SEARCH_ATTEMPTS: 2,        // Maximum attempts to find intelligence
  MIN_ANSWER_CONFIDENCE: 0.7,    // Minimum confidence (0-1) that intelligence was gathered
  
  // Timeouts
  SCRAPE_TIMEOUT: 15000,         // Timeout for scraping operations (ms)
} as const;
```

## 📈 Example Intelligence Queries

- "Research OpenAI - comprehensive competitive intelligence"
- "Analyze ChatGPT - market positioning and features"
- "Deep dive into AI chatbot market - trends and key players"
- "Competitive analysis of OpenAI vs Anthropic"
- "Website intelligence gathering for Stripe"
- "Social media presence analysis of Notion"
- "Customer intelligence research for Slack"
- "Technical architecture analysis of GitHub"

## 🎯 Use Cases

- **Competitive Intelligence**: Understand competitors' positioning, pricing, and strategy
- **Market Research**: Analyze market trends, customer segments, and opportunities
- **Sales Intelligence**: Research prospects for personalized outreach
- **Investment Research**: Evaluate companies for investment decisions
- **Partnership Research**: Identify potential partners and integration opportunities
- **Product Strategy**: Understand market gaps and competitive advantages

## 🔍 Intelligence Gathering Process

1. **Request Analysis** - Understand your intelligence needs
2. **Strategy Planning** - Develop comprehensive research approach
3. **Intelligence Gathering** - Collect data from multiple sources
4. **Content Analysis** - Process and validate intelligence findings
5. **Report Synthesis** - Create comprehensive intelligence report
6. **Follow-up Generation** - Suggest additional research areas

## 📚 License

MIT License