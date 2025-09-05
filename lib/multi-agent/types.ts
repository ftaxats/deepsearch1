// Multi-Agent System Types for ICP Analysis
export interface AgentMessage {
  id: string;
  from: string;
  to: string;
  type: 'request' | 'response' | 'error' | 'status';
  payload: unknown;
  timestamp: Date;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface AgentTask {
  id: string;
  agentId: string;
  type: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  input: unknown;
  output?: unknown;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
  priority: number;
}

export interface AgentCapability {
  name: string;
  description: string;
  inputTypes: string[];
  outputTypes: string[];
  estimatedDuration: number; // in milliseconds
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  capabilities: AgentCapability[];
  status: 'idle' | 'busy' | 'error';
  currentTask?: AgentTask;
  messageQueue: AgentMessage[];
}

// Specialized Agent Data Types
export interface CustomerIntelligenceData {
  caseStudies: CustomerCaseStudy[];
  testimonials: CustomerTestimonial[];
  successStories: SuccessStory[];
  customerJourney: CustomerJourneyStep[];
  patterns: CustomerPattern[];
}

export interface CustomerCaseStudy {
  company: string;
  industry: string;
  companySize: string;
  useCase: string;
  results: string;
  implementation: string;
  source: string;
}

export interface CustomerTestimonial {
  company: string;
  quote: string;
  role: string;
  industry: string;
  source: string;
}

export interface SuccessStory {
  company: string;
  challenge: string;
  solution: string;
  outcome: string;
  metrics: string;
  source: string;
}

export interface CustomerJourneyStep {
  stage: string;
  description: string;
  duration: string;
  touchpoints: string[];
  painPoints: string[];
}

export interface CustomerPattern {
  characteristic: string;
  frequency: number;
  confidence: number;
  examples: string[];
}

export interface MarketResearchData {
  industryTrends: IndustryTrend[];
  marketSize: MarketSizeData;
  competitiveLandscape: CompetitiveData[];
  growthRates: GrowthRate[];
  regulatoryEnvironment: RegulatoryInfo[];
}

export interface IndustryTrend {
  trend: string;
  impact: 'high' | 'medium' | 'low';
  timeframe: string;
  source: string;
  description: string;
}

export interface MarketSizeData {
  tam: string; // Total Addressable Market
  sam: string; // Serviceable Addressable Market
  som: string; // Serviceable Obtainable Market
  growthRate: string;
  source: string;
}

export interface CompetitiveData {
  competitor: string;
  marketShare: string;
  strengths: string[];
  weaknesses: string[];
  positioning: string;
  source: string;
}

export interface GrowthRate {
  segment: string;
  rate: string;
  timeframe: string;
  source: string;
}

export interface RegulatoryInfo {
  regulation: string;
  impact: string;
  compliance: string;
  source: string;
}

export interface FirmographicData {
  companySizes: CompanySizeProfile[];
  revenueRanges: RevenueRange[];
  fundingStages: FundingStage[];
  geographicData: GeographicProfile[];
  industrySegments: IndustrySegment[];
}

export interface CompanySizeProfile {
  range: string;
  employeeCount: string;
  characteristics: string[];
  examples: string[];
  source: string;
}

export interface RevenueRange {
  range: string;
  characteristics: string[];
  examples: string[];
  source: string;
}

export interface FundingStage {
  stage: string;
  characteristics: string[];
  examples: string[];
  source: string;
}

export interface GeographicProfile {
  region: string;
  characteristics: string[];
  marketSize: string;
  examples: string[];
  source: string;
}

export interface IndustrySegment {
  segment: string;
  characteristics: string[];
  marketSize: string;
  examples: string[];
  source: string;
}

export interface TechnographicData {
  techStacks: TechStack[];
  integrations: Integration[];
  digitalMaturity: DigitalMaturityLevel[];
  platformRequirements: PlatformRequirement[];
}

export interface TechStack {
  category: string;
  tools: string[];
  characteristics: string[];
  examples: string[];
  source: string;
}

export interface Integration {
  type: string;
  requirements: string[];
  examples: string[];
  source: string;
}

export interface DigitalMaturityLevel {
  level: string;
  characteristics: string[];
  examples: string[];
  source: string;
}

export interface PlatformRequirement {
  requirement: string;
  importance: 'high' | 'medium' | 'low';
  examples: string[];
  source: string;
}

export interface PsychographicData {
  painPoints: PainPoint[];
  buyingTriggers: BuyingTrigger[];
  decisionProcesses: DecisionProcess[];
  budgetBehaviors: BudgetBehavior[];
}

export interface PainPoint {
  painPoint: string;
  severity: 'high' | 'medium' | 'low';
  frequency: number;
  examples: string[];
  source: string;
}

export interface BuyingTrigger {
  trigger: string;
  impact: 'high' | 'medium' | 'low';
  examples: string[];
  source: string;
}

export interface DecisionProcess {
  process: string;
  duration: string;
  stakeholders: string[];
  examples: string[];
  source: string;
}

export interface BudgetBehavior {
  behavior: string;
  characteristics: string[];
  examples: string[];
  source: string;
}

export interface TargetCompanyData {
  companies: TargetCompany[];
  validationResults: CompanyValidation[];
  marketMapping: MarketMap[];
}

export interface TargetCompany {
  name: string;
  domain: string;
  industry: string;
  size: string;
  location: string;
  revenue: string;
  funding: string;
  techStack: string[];
  reasoning: string;
  confidence: number;
  source: string;
}

export interface CompanyValidation {
  company: string;
  isValid: boolean;
  reasons: string[];
  confidence: number;
  source: string;
}

export interface MarketMap {
  segment: string;
  companies: string[];
  marketSize: string;
  opportunity: string;
  source: string;
}

// Combined Research Data
export interface CombinedResearchData {
  customerIntelligence: CustomerIntelligenceData;
  marketResearch: MarketResearchData;
  firmographicData: FirmographicData;
  technographicData: TechnographicData;
  psychographicData: PsychographicData;
  targetCompanyData: TargetCompanyData;
  metadata: {
    totalSources: number;
    confidence: number;
    lastUpdated: Date;
    agentsUsed: string[];
  };
}

// ICP Profile Output
export interface ICPProfile {
  id: string;
  name: string;
  priority: number;
  characteristics: ICPCharacteristics;
  firmographics: ICPFirmographics;
  technographics: ICPTechnographics;
  psychographics: ICPPsychographics;
  targetCompanies: TargetCompany[];
  validation: ICPValidation;
  insights: ICPInsights;
}

export interface ICPCharacteristics {
  industry: string;
  companySize: string;
  revenueRange: string;
  geographicFocus: string;
  businessModel: string;
}

export interface ICPFirmographics {
  fundingStage: string;
  growthStage: string;
  marketPosition: string;
  geographicPresence: string;
}

export interface ICPTechnographics {
  currentTechStack: string[];
  technologyMaturity: string;
  digitalTransformationStage: string;
  integrationRequirements: string[];
}

export interface ICPPsychographics {
  painPoints: string[];
  buyingTriggers: string[];
  decisionMakingProcess: string;
  budgetAllocation: string;
}

export interface ICPValidation {
  marketSize: string;
  competitionLevel: string;
  salesVelocity: string;
  revenuePotential: string;
  confidence: number;
}

export interface ICPInsights {
  keyDifferentiators: string[];
  messagingResonance: string[];
  valuePropositions: string[];
  commonObjections: string[];
  outreachStrategy: string[];
}

// Agent Communication Events
export interface AgentEvent {
  type: 'agent-started' | 'agent-completed' | 'agent-error' | 'data-shared' | 'task-assigned' | 'task-completed';
  agentId: string;
  timestamp: Date;
  data?: unknown;
  message?: string;
}

// Multi-Agent System Configuration
export interface MultiAgentConfig {
  maxConcurrentAgents: number;
  taskTimeout: number;
  retryAttempts: number;
  dataSharingEnabled: boolean;
  priorityWeights: {
    customerIntelligence: number;
    marketResearch: number;
    firmographic: number;
    technographic: number;
    psychographic: number;
    targetCompany: number;
  };
}