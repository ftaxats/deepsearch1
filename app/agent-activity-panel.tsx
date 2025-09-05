'use client';

import { useState } from 'react';
import { AgentEvent } from '@/lib/multi-agent/types';

interface AgentActivityPanelProps {
  events: AgentEvent[];
  isVisible: boolean;
  onToggle: () => void;
}

export function AgentActivityPanel({ events, isVisible, onToggle }: AgentActivityPanelProps) {
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());

  const toggleAgent = (agentId: string) => {
    const newExpanded = new Set(expandedAgents);
    if (newExpanded.has(agentId)) {
      newExpanded.delete(agentId);
    } else {
      newExpanded.add(agentId);
    }
    setExpandedAgents(newExpanded);
  };

  // Group events by agent
  const eventsByAgent = events.reduce((acc, event) => {
    if (!acc[event.agentId]) {
      acc[event.agentId] = [];
    }
    acc[event.agentId].push(event);
    return acc;
  }, {} as Record<string, AgentEvent[]>);

  const getAgentIcon = (agentId: string) => {
    const icons: Record<string, string> = {
      'customer-intelligence-agent': '👥',
      'market-research-agent': '📈',
      'firmographic-agent': '🏢',
      'technographic-agent': '💻',
      'psychographic-agent': '🧠',
      'target-company-discovery-agent': '🎯',
      'icp-synthesis-agent': '🔄',
      'coordinator': '🎛️'
    };
    return icons[agentId] || '🤖';
  };

  const getAgentName = (agentId: string) => {
    const names: Record<string, string> = {
      'customer-intelligence-agent': 'Customer Intelligence',
      'market-research-agent': 'Market Research',
      'firmographic-agent': 'Firmographic Analysis',
      'technographic-agent': 'Technographic Analysis',
      'psychographic-agent': 'Psychographic Analysis',
      'target-company-discovery-agent': 'Target Company Discovery',
      'icp-synthesis-agent': 'ICP Synthesis',
      'coordinator': 'System Coordinator'
    };
    return names[agentId] || agentId;
  };

  const getEventIcon = (type: string) => {
    const icons: Record<string, string> = {
      'agent-started': '🚀',
      'agent-completed': '✅',
      'agent-error': '❌',
      'data-shared': '📊',
      'task-assigned': '📋',
      'task-completed': '🎯'
    };
    return icons[type] || '📝';
  };

  const getEventColor = (type: string) => {
    const colors: Record<string, string> = {
      'agent-started': 'text-blue-600',
      'agent-completed': 'text-green-600',
      'agent-error': 'text-red-600',
      'data-shared': 'text-purple-600',
      'task-assigned': 'text-orange-600',
      'task-completed': 'text-green-600'
    };
    return colors[type] || 'text-gray-600';
  };

  if (!isVisible) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-4 right-4 bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors z-50"
        title="Show Agent Activity"
      >
        🤖 {events.length}
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 max-h-96 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          🤖 Agent Activity
        </h3>
        <button
          onClick={onToggle}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="max-h-80 overflow-y-auto">
        {Object.entries(eventsByAgent).map(([agentId, agentEvents]) => (
          <div key={agentId} className="border-b border-gray-100 dark:border-gray-700 last:border-b-0">
            <button
              onClick={() => toggleAgent(agentId)}
              className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center space-x-2">
                <span className="text-lg">{getAgentIcon(agentId)}</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {getAgentName(agentId)}
                </span>
                <span className="text-xs bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 px-2 py-1 rounded">
                  {agentEvents.length}
                </span>
              </div>
              <span className={`text-sm ${expandedAgents.has(agentId) ? 'rotate-180' : ''} transition-transform`}>
                ▼
              </span>
            </button>

            {expandedAgents.has(agentId) && (
              <div className="px-3 pb-3 space-y-2">
                {agentEvents.map((event, index) => (
                  <div
                    key={index}
                    className="flex items-start space-x-2 p-2 bg-gray-50 dark:bg-gray-700 rounded text-sm"
                  >
                    <span className="text-lg">{getEventIcon(event.type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className={`font-medium ${getEventColor(event.type)}`}>
                        {event.message}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </div>
                      {Boolean(event.data) && (
                        <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                          {JSON.stringify(event.data as Record<string, unknown>, null, 2).substring(0, 100)}...
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {events.length === 0 && (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            No agent activity yet
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
        <div className="text-xs text-gray-600 dark:text-gray-300">
          Total Events: {events.length} | Active Agents: {Object.keys(eventsByAgent).length}
        </div>
      </div>
    </div>
  );
}