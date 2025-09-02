'use client';

import { SearchEvent, SearchStep, SearchPhase } from '@/lib/langgraph-search-engine';
import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { MarkdownRenderer } from './markdown-renderer';
import { getFaviconUrl, getDefaultFavicon, markFaviconFailed } from '@/lib/favicon-utils';

// Component for animated thinking line that cycles through messages
function AnimatedThinkingLine({ messages }: { messages: string[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [isComplete, setIsComplete] = useState(false);
  
  useEffect(() => {
    if (messages.length <= 1) return;
    
    // Detect if this is a "speed run" (many source names)
    const isSpeedRun = messages.some(msg => msg.includes('Analyzing') && messages.length > 5);
    const cycleDelay = isSpeedRun ? 600 : 2000; // Faster for speed runs
    const fadeDelay = isSpeedRun ? 100 : 300;
    
    const cycleMessages = () => {
      setIsVisible(false);
      setTimeout(() => {
        setCurrentIndex((prev) => {
          const next = prev + 1;
          // Stop at the last message if it's a speed run
          if (isSpeedRun && next >= messages.length - 1) {
            setIsComplete(true);
            return messages.length - 1; // Stay on last message
          }
          return next % messages.length;
        });
        setIsVisible(true);
      }, fadeDelay);
    };
    
    if (!isComplete) {
      const interval = setInterval(cycleMessages, cycleDelay);
      return () => clearInterval(interval);
    }
  }, [messages, isComplete]);
  
  // Extract URL from message if it's an "Analyzing" message
  const currentMessage = messages[currentIndex];
  const analyzingMatch = currentMessage.match(/Analyzing (.+)\.\.\./);
  const currentUrl = analyzingMatch ? analyzingMatch[1] : null;
  
  return (
    <div className="flex items-start gap-3 text-gray-700 dark:text-gray-300">
      <div className="w-5 h-5 mt-0.5 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
        {currentUrl ? (
          <Image 
            src={getFaviconUrl(currentUrl)} 
            alt=""
            width={20}
            height={20}
            className={`w-5 h-5 rounded transition-all duration-300 ${isVisible ? 'scale-100 opacity-100' : 'scale-75 opacity-0'}`}
            onError={(e) => {
              const img = e.target as HTMLImageElement;
              img.src = getDefaultFavicon(20);
              markFaviconFailed(currentUrl);
            }}
          />
        ) : (
          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )}
      </div>
      <span className={`text-sm transition-opacity ${isVisible ? 'opacity-100' : 'opacity-0'}`} style={{ transitionDuration: isVisible ? '150ms' : '150ms' }}>
        {currentMessage}
      </span>
    </div>
  );
}

// Component for found sources group with collapse/expand
function FoundSourcesGroup({ 
  event, 
  sources, 
  defaultExpanded, 
  completedPhases, 
  currentPhase, 
  events 
}: {
  event: SearchEvent;
  sources: {
    url: string;
    title: string;
    stage: 'browsing' | 'extracting' | 'analyzing' | 'complete';
    summary?: string;
  }[];
  defaultExpanded: boolean;
  completedPhases: Set<string>;
  currentPhase: SearchPhase | null;
  events: SearchEvent[];
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  
  // Auto-collapse when a new search starts
  useEffect(() => {
    setIsExpanded(defaultExpanded);
  }, [defaultExpanded]);
  
  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1">
          {renderEvent(event, completedPhases, currentPhase, false, events)}
        </div>
        {sources.length > 0 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors flex-shrink-0"
            aria-label={isExpanded ? "Collapse sources" : "Expand sources"}
          >
            <svg 
              className={`w-3 h-3 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>
      <div 
        className={`ml-7 mt-1 overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded && sources.length > 0 ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="space-y-1">
          {sources.map((source, index) => (
            <div
              key={source.url}
              className="animate-slide-down"
              style={{
                animationDelay: `${index * 50}ms`,
                animationFillMode: 'both'
              }}
            >
              <SourceProcessingLine
                url={source.url}
                stage={source.stage}
                summary={source.summary}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Component for animated source processing line
function SourceProcessingLine({ url, stage, summary }: { 
  url: string; 
  stage: 'browsing' | 'extracting' | 'analyzing' | 'complete';
  summary?: string;
}) {
  // const stages = ['browsing', 'extracting', 'analyzing', 'complete'];
  // const _currentStageIndex = stages.indexOf(stage);
  
  
  const stageLabels = {
    browsing: 'Browsing',
    extracting: 'Extracting',
    analyzing: 'Analyzing',
    complete: 'Complete'
  };
  
  return (
    <div className="group flex items-start gap-2 text-xs py-1 animate-fade-in">
      <Image 
        src={getFaviconUrl(url)} 
        alt=""
        width={16}
        height={16}
        className="w-4 h-4 rounded flex-shrink-0 mt-0.5"
        onError={(e) => {
          const img = e.target as HTMLImageElement;
          img.src = getDefaultFavicon(16);
          markFaviconFailed(url);
        }}
      />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-600 dark:text-gray-400 truncate">
          {new URL(url).hostname}
        </div>
        {stage === 'complete' ? (
          summary ? (
            <div className="text-gray-500 dark:text-gray-500 mt-0.5">
              {summary}
            </div>
          ) : (
            <div className="flex items-center gap-1 mt-0.5">
              <svg className="w-3 h-3 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-gray-500 dark:text-gray-500">
                Complete
              </span>
            </div>
          )
        ) : (
          <div className="flex items-center gap-1 mt-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
            <span className="text-gray-500 dark:text-gray-500">
              {stageLabels[stage as keyof typeof stageLabels]}...
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function SearchDisplay({ events }: { events: SearchEvent[] }) {
  const [currentPhase, setCurrentPhase] = useState<SearchPhase>('understanding');
  const [phaseMessages, setPhaseMessages] = useState<string[]>([]);
  const [searchingQueries, setSearchingQueries] = useState<string[]>([]);
  const [foundSources, setFoundSources] = useState<Source[]>([]);
  const [thinkingMessages, setThinkingMessages] = useState<string[]>([]);

  useEffect(() => {
    events.forEach(event => {
      if (event.type === 'phase-update') {
        setCurrentPhase(event.phase);
        setPhaseMessages(prev => [...prev, event.message]);
      } else if (event.type === 'searching') {
        setSearchingQueries(prev => [...prev, event.query]);
      } else if (event.type === 'found') {
        setFoundSources(prev => [...prev, ...event.sources]);
      } else if (event.type === 'thinking') {
        setThinkingMessages(prev => [...prev, event.message]);
      }
    });
  }, [events]);

  const getPhaseInfo = (phase: SearchPhase) => {
    const phaseInfo = {
      understanding: { title: '🔍 Analyzing Request', description: 'Understanding your intelligence gathering needs' },
      planning: { title: '📋 Planning Intelligence Strategy', description: 'Developing comprehensive research approach' },
      searching: { title: '🌐 Gathering Intelligence', description: 'Collecting data from multiple sources' },
      analyzing: { title: '🧠 Processing Intelligence', description: 'Analyzing and validating findings' },
      synthesizing: { title: '📊 Synthesizing Report', description: 'Creating comprehensive intelligence report' },
      complete: { title: '✅ Intelligence Complete', description: 'Your research report is ready' },
      error: { title: '❌ Research Error', description: 'An error occurred during research' }
    };
    return phaseInfo[phase] || { title: 'Processing...', description: 'Working on your request...' };
  };

  return (
    <div className="space-y-4">
      {/* Current Phase */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center space-x-3">
          <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
          <div>
            <h3 className="font-semibold text-blue-900">{getPhaseInfo(currentPhase).title}</h3>
            <p className="text-sm text-blue-700">{getPhaseInfo(currentPhase).description}</p>
          </div>
        </div>
      </div>

      {/* Phase Messages */}
      {phaseMessages.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2">Research Progress:</h4>
          <div className="space-y-2">
            {phaseMessages.map((message, index) => (
              <div key={index} className="text-sm text-gray-700 flex items-start space-x-2">
                <span className="text-green-500">✓</span>
                <span>{message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Thinking Messages */}
      {thinkingMessages.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="font-medium text-yellow-900 mb-2">Intelligence Analysis:</h4>
          <div className="space-y-2">
            {thinkingMessages.map((message, index) => (
              <div key={index} className="text-sm text-yellow-700 flex items-start space-x-2">
                <span className="text-green-500">💭</span>
                <span>{message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search Queries */}
      {searchingQueries.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="font-medium text-green-900 mb-2">Intelligence Gathering Areas:</h4>
          <div className="space-y-2">
            {searchingQueries.map((query, index) => (
              <div key={index} className="text-sm text-green-700 flex items-start space-x-2">
                <span className="text-green-500">🔍</span>
                <span>{query}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Found Sources */}
      {foundSources.length > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h4 className="font-medium text-purple-900 mb-2">Intelligence Sources Found:</h4>
          <div className="space-y-2">
            {foundSources.slice(0, 5).map((source, index) => (
              <div key={index} className="text-sm text-purple-700 flex items-start space-x-2">
                <span className="text-purple-500">📄</span>
                <span className="truncate">{source.title}</span>
              </div>
            ))}
            {foundSources.length > 5 && (
              <div className="text-sm text-purple-600">
                +{foundSources.length - 5} more sources...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function renderEvent(event: SearchEvent, _completedPhases: Set<string>, currentPhase: SearchPhase | null = null, _showLoadingIndicator = false, events: SearchEvent[] = []) { // eslint-disable-line @typescript-eslint/no-unused-vars
  switch (event.type) {
    case 'thinking':
      // Single line animated display
      const messages = event.message.split('|');
      const isAnimated = messages.length > 1;
      
      if (isAnimated) {
        return (
          <AnimatedThinkingLine messages={messages} />
        );
      }
      
      // Check if this is the initial understanding (contains markdown headers)
      const isInitialThinking = event.message.includes('###') || event.message.includes('**');
      
      if (isInitialThinking) {
        return (
          <div className="text-gray-500 dark:text-gray-400 text-sm">
            <MarkdownRenderer content={event.message} />
          </div>
        );
      }
      
      // Check if this is a processing message that should show a spinner
      const isProcessing = event.message.includes('Processing') && event.message.includes('sources');
      const isAnalyzing = event.message.includes('Analyzing content from');
      
      if (isProcessing || isAnalyzing) {
        // Check for single source URL (for individual processing)
        const singleSourceMatch = event.message.match(/\|SOURCE:(.+)$/);
        const singleSourceUrl = singleSourceMatch?.[1];
        const displayMessage = singleSourceUrl ? event.message.replace(/\|SOURCE:.+$/, '') : event.message;
        
        return (
          <div className="flex items-start gap-3 text-gray-700 dark:text-gray-300">
            {singleSourceUrl ? (
              // Show favicon for individual source
              <Image 
                src={getFaviconUrl(singleSourceUrl)} 
                alt=""
                width={20}
                height={20}
                className="w-5 h-5 mt-0.5 rounded flex-shrink-0"
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  img.src = getDefaultFavicon(20);
                  markFaviconFailed(singleSourceUrl);
                }}
              />
            ) : (
              // Show spinner for general processing
              <div className="w-5 h-5 mt-0.5 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            )}
            <span className="text-sm">{displayMessage}</span>
          </div>
        );
      }
      
      return (
        <div className="flex items-start gap-3 text-gray-700 dark:text-gray-300">
          <div className="w-5 h-5 mt-0.5 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <span className="text-sm">{event.message}</span>
        </div>
      );
    
    case 'searching':
      // Check if this search has completed by looking for a matching 'found' event
      const searchingQuery = event.query.toLowerCase().trim();
      const searchCompleted = events.some(e => {
        if (e.type !== 'found') return false;
        const foundQuery = e.query.toLowerCase().trim();
        return foundQuery === searchingQuery;
      });
      
      return (
        <div className="flex items-start gap-3 text-gray-700 dark:text-gray-300">
          <div className="w-5 h-5 mt-0.5 rounded bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
            {searchCompleted ? (
              <svg className="w-3 h-3 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
          </div>
          <span className="text-sm">
            Search {event.index} of {event.total}: <span className="font-medium text-gray-900 dark:text-gray-100">&quot;{event.query}&quot;</span>
            {!searchCompleted && <span className="text-xs text-gray-500 dark:text-gray-500 ml-2">Finding sources...</span>}
          </span>
        </div>
      );
    
    case 'found':
      return (
        <div className="text-sm text-gray-700 dark:text-gray-300">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
              <svg className="w-3 h-3 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span>Found <span className="font-bold text-gray-900 dark:text-gray-100">{event.sources.length} sources</span> for &quot;{event.query}&quot;</span>
          </div>
        </div>
      );
    
    case 'scraping':
      return (
        <div className="flex items-start gap-3">
          <Image 
            src={getFaviconUrl(event.url)} 
            alt=""
            width={20}
            height={20}
            className="w-5 h-5 mt-0.5 flex-shrink-0 rounded"
            onError={(e) => {
              const img = e.target as HTMLImageElement;
              img.src = getDefaultFavicon(20);
              markFaviconFailed(event.url);
            }}
          />
          <div className="flex-1">
            <div className="text-sm text-gray-900 dark:text-gray-100">
              Browsing <span className="font-medium text-orange-600 dark:text-orange-400">{new URL(event.url).hostname}</span> for &quot;{event.query}&quot;
            </div>
          </div>
        </div>
      );
    
    case 'phase-update':
      // Check if this phase has been completed (we've moved past it)
      const phases: SearchPhase[] = ['understanding', 'planning', 'searching', 'analyzing', 'synthesizing', 'complete'];
      const eventPhaseIndex = phases.indexOf(event.phase);
      const currentPhaseIndex = currentPhase ? phases.indexOf(currentPhase) : -1;
      const isCompleted = currentPhaseIndex > eventPhaseIndex || event.phase === 'complete';
      
      return (
        <div className="flex items-start gap-3 text-gray-900 dark:text-gray-100 font-medium">
          <div className="w-5 h-5 mt-0.5 rounded bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            {isCompleted ? (
              <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-3 h-3 animate-spin text-gray-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
          </div>
          <span className="text-sm">{event.message}</span>
        </div>
      );
    
    case 'error':
      return (
        <div className="flex items-start gap-3 text-red-600 dark:text-red-400">
          <div className="w-5 h-5 mt-0.5 rounded bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-sm">
            <span className="font-medium">Error: </span>
            <span>{event.error}</span>
            {event.errorType && <span className="text-xs ml-2">({event.errorType})</span>}
          </div>
        </div>
      );
    
    case 'source-processing':
    case 'source-complete':
      // This will be handled by the SourceProcessingLine component
      return null;
    
    default:
      return null;
  }
}