export type LeadStage = 'new' | 'enriched' | 'contacted' | 'replied' | 'qualified';

export type LeadSource =
  | 'nextdoor_ad'
  | 'nextdoor_page'
  | 'github_import'
  | 'web_discovery'
  | 'webhook_ingest';

export interface SourceCitation {
  title: string;
  url: string;
}

export interface EnrichmentStepResult {
  step: string;
  provider: string;
  status: 'found' | 'verified' | 'not_found' | 'skipped';
  detail: string;
  checkedAt: string;
}

export interface Lead {
  id: string;
  companyName: string;
  contactName: string;
  contactRole: string;
  category: string;
  neighborhood: string;
  city: string;
  email: string;
  emailStatus: 'verified_mx' | 'pattern_only' | 'unverified' | 'missing';
  phone: string;
  website: string;
  nextdoorUrl: string;
  source: LeadSource;
  sourceRepo?: string;
  stage: LeadStage;
  adHeadline: string;
  adBody: string;
  adOffer: string;
  adFormat: 'Sponsored Post' | 'Local Deal' | 'Business Page' | 'Neighborhood Banner' | 'Directory Listing';
  notes: string;
  citations: SourceCitation[];
  enrichmentSteps: EnrichmentStepResult[];
  lastEnrichedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SequenceStep {
  id: string;
  dayOffset: number;
  channel: 'Email' | 'Nextdoor DM' | 'Phone Call' | 'LinkedIn';
  subject: string;
  body: string;
}

export interface OutreachSequence {
  id: string;
  name: string;
  targetNiche: string;
  status: 'Active' | 'Draft' | 'Paused';
  enrolledCount: number;
  replyRateLabel: string;
  steps: SequenceStep[];
  createdAt: string;
}

export interface GithubRepoSummary {
  fullName: string;
  owner: string;
  name: string;
  description: string;
  htmlUrl: string;
  stars: number;
  forks: number;
  language: string;
  updatedAt: string;
  topics: string[];
  license: string;
  category: 'Post & Feed Scraper' | 'Business Directory' | 'Nextdoor Ads API' | 'Sponsored Ad Parser';
  integrationNote: string;
  isLiveFetched: boolean;
}

export interface IngestLogEntry {
  id: string;
  receivedAt: string;
  sourceRepo: string;
  recordsParsed: number;
  neighborhood: string;
  summary: string;
}

export interface AutoScraperMonitor {
  id: string;
  name: string;
  ukLocations: string[];
  categories: string[];
  intervalMinutes: number;
  enabled: boolean;
  autoEnrich: boolean;
  maxPerRun: number;
  lastRunAt?: string;
  lastStatus: 'idle' | 'running' | 'success' | 'error';
  lastSummary: string;
  totalLeadsCaptured: number;
  createdAt: string;
}

export interface WorkspaceSnapshot {
  leads: Lead[];
  sequences: OutreachSequence[];
  ingestLogs: IngestLogEntry[];
  monitors: AutoScraperMonitor[];
}
