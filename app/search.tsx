'use server';

import { createStreamableValue } from 'ai/rsc';
import { FirecrawlClient } from '@/lib/firecrawl';
import { LangGraphSearchEngine as SearchEngine, SearchEvent } from '@/lib/langgraph-search-engine';

export async function search(query: string, context?: { query: string; response: string }[], apiKey?: string) {
  const stream = createStreamableValue<SearchEvent>();
  
  // Create FirecrawlClient with API key if provided
  const firecrawl = new FirecrawlClient(apiKey);
  const searchEngine = new SearchEngine(firecrawl);

  // Run search in background
  (async () => {
    try {
      // Stream events as they happen
      await searchEngine.search(query, (event) => {
        stream.update(event);
      }, context);
      
      stream.done();
    } catch (error) {
      stream.error(error);
    }
  })();

  return { stream: stream.value };
}

export async function analyzeICP(dossierText: string, query?: string, context?: { query: string; response: string }[], apiKey?: string) {
  'use server';
  const stream = createStreamableValue<SearchEvent>();

  const firecrawl = new FirecrawlClient(apiKey);
  const searchEngine = new SearchEngine(firecrawl);

  (async () => {
    try {
      await searchEngine.analyzeDossier(dossierText, (event) => {
        stream.update(event);
      }, { query, context });
      stream.done();
    } catch (error) {
      stream.error(error);
    }
  })();

  return { stream: stream.value };
}

export async function analyzeWebsiteIntelligence(
  url: string,
  options?: {
    intelligenceTypes?: ('pricing' | 'team' | 'customers' | 'products' | 'competitors')[];
    includeCompetitorAnalysis?: boolean;
    context?: { query: string; response: string }[];
  },
  apiKey?: string
) {
  'use server';
  const stream = createStreamableValue<SearchEvent>();

  const firecrawl = new FirecrawlClient(apiKey);
  const searchEngine = new SearchEngine(firecrawl);

  (async () => {
    try {
      await searchEngine.analyzeWebsiteIntelligence(url, (event) => {
        stream.update(event);
      }, options);
      stream.done();
    } catch (error) {
      stream.error(error);
    }
  })();

  return { stream: stream.value };
}