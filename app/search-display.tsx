'use client';

import { useState, useEffect } from 'react';
import { SearchEvent, SearchPhase, Source } from '@/lib/langgraph-search-engine';

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