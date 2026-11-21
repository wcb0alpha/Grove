import {
  createLeadsBulk,
  getMonitorById,
  getMonitors,
  updateLead,
  updateMonitor,
} from './db.ts';
import { discoverProspects, runWaterfallEnrichment } from './gemini.ts';
import type { AutoScraperMonitor, Lead, SourceCitation } from '../src/types/leads.ts';

const runningMonitors = new Set<string>();
let schedulerStarted = false;

export interface AutoScrapeExecutionResult {
  monitor?: AutoScraperMonitor;
  createdLeads: Lead[];
  skippedDuplicates: number;
  citations: SourceCitation[];
  summary: string;
}

export async function runInstantUkAutoScrape(params: {
  ukLocation: string;
  category: string;
  maxResults: number;
  autoEnrich: boolean;
  sourceTag?: string;
}): Promise<AutoScrapeExecutionResult> {
  const discovery = await discoverProspects({
    niche: params.category,
    location: params.ukLocation,
    role: 'Director / Owner',
    mode: 'nextdoor_pages',
    limit: params.maxResults,
  });

  if (discovery.prospects.length === 0) {
    return {
      createdLeads: [],
      skippedDuplicates: 0,
      citations: discovery.citations,
      summary: `No new public nextdoor.co.uk/pages listings found for ${params.category} in ${params.ukLocation}.`,
    };
  }

  const createdLeads = createLeadsBulk(
    discovery.prospects.map((item) => ({
      ...item,
      emailStatus: item.email ? 'unverified' : 'missing',
      source: 'nextdoor_page',
      sourceRepo: params.sourceTag || 'auto-scraper/nextdoor.co.uk',
      stage: 'new',
      citations: discovery.citations.slice(0, 4),
      enrichmentSteps: [],
    })),
    {
      sourceRepo: params.sourceTag || 'auto-scraper/nextdoor.co.uk',
      neighborhood: params.ukLocation,
      summary: `Auto-scraped ${discovery.prospects.length} public nextdoor.co.uk listing(s) for ${params.category} in ${params.ukLocation}`,
    }
  );

  const skippedDuplicates = Math.max(0, discovery.prospects.length - createdLeads.length);

  // Optional auto-waterfall enrichment (capped at 2 per run to keep response snappy)
  const finalLeads: Lead[] = [];
  for (let i = 0; i < createdLeads.length; i++) {
    const lead = createdLeads[i];
    if (params.autoEnrich && i < 2) {
      try {
        const enriched = await runWaterfallEnrichment(lead);
        const updated = updateLead(lead.id, enriched.patch);
        finalLeads.push(updated ?? lead);
      } catch {
        finalLeads.push(lead);
      }
    } else {
      finalLeads.push(lead);
    }
  }

  const summary =
    finalLeads.length > 0
      ? `Captured ${finalLeads.length} new UK lead${finalLeads.length === 1 ? '' : 's'} from nextdoor.co.uk/pages (${params.ukLocation})${
          skippedDuplicates > 0 ? ` · ${skippedDuplicates} duplicate skipped` : ''
        }.`
      : `Scanned ${discovery.prospects.length} listing(s) in ${params.ukLocation} — all already saved in CRM.`;

  return {
    createdLeads: finalLeads,
    skippedDuplicates,
    citations: discovery.citations,
    summary,
  };
}

export async function executeMonitorRun(
  monitorId: string
): Promise<AutoScrapeExecutionResult> {
  const monitor = getMonitorById(monitorId);
  if (!monitor) {
    throw new Error('Monitor not found');
  }
  if (runningMonitors.has(monitorId)) {
    throw new Error('This UK postcode monitor is already running.');
  }

  runningMonitors.add(monitorId);
  updateMonitor(monitorId, {
    lastStatus: 'running',
    lastSummary: 'Scanning public nextdoor.co.uk/pages listings...',
  });

  try {
    // Run across up to 2 location/category targets per execution to stay fast and focused
    const pairs: Array<{ location: string; category: string }> = [];
    for (const loc of monitor.ukLocations) {
      for (const cat of monitor.categories) {
        pairs.push({ location: loc, category: cat });
      }
    }

    const targets = pairs.slice(0, 2);
    const allCreated: Lead[] = [];
    const allCitations: SourceCitation[] = [];
    const seenCitationUrls = new Set<string>();
    let totalSkipped = 0;
    const perTargetLimit = Math.max(2, Math.ceil(monitor.maxPerRun / Math.max(1, targets.length)));

    for (const target of targets) {
      const result = await runInstantUkAutoScrape({
        ukLocation: target.location,
        category: target.category,
        maxResults: perTargetLimit,
        autoEnrich: monitor.autoEnrich,
        sourceTag: `auto-monitor/${monitor.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32)}`,
      });
      allCreated.push(...result.createdLeads);
      totalSkipped += result.skippedDuplicates;
      for (const cite of result.citations) {
        if (!seenCitationUrls.has(cite.url)) {
          seenCitationUrls.add(cite.url);
          allCitations.push(cite);
        }
      }
    }

    const now = new Date().toISOString();
    const summary =
      allCreated.length > 0
        ? `Added ${allCreated.length} new UK lead${allCreated.length === 1 ? '' : 's'} across ${targets
            .map((t) => t.location)
            .join(', ')}${totalSkipped > 0 ? ` (${totalSkipped} duplicate skipped)` : ''}.`
        : `Completed scan of ${targets.map((t) => t.location).join(', ')} — no net-new listings (${totalSkipped} already in CRM).`;

    const updated =
      updateMonitor(monitorId, {
        lastRunAt: now,
        lastStatus: 'success',
        lastSummary: summary,
        totalLeadsCaptured: monitor.totalLeadsCaptured + allCreated.length,
      }) ?? monitor;

    return {
      monitor: updated,
      createdLeads: allCreated,
      skippedDuplicates: totalSkipped,
      citations: allCitations,
      summary,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Auto-scrape failed';
    updateMonitor(monitorId, {
      lastRunAt: new Date().toISOString(),
      lastStatus: 'error',
      lastSummary: `Run failed: ${message}`,
    });
    throw err;
  } finally {
    runningMonitors.delete(monitorId);
  }
}

export function startAutoScraperScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;

  // Check every 60 seconds whether any enabled UK postcode monitor is due
  setInterval(() => {
    const monitors = getMonitors();
    const nowMs = Date.now();
    for (const mon of monitors) {
      if (!mon.enabled || runningMonitors.has(mon.id)) continue;
      const lastMs = mon.lastRunAt ? new Date(mon.lastRunAt).getTime() : 0;
      const intervalMs = Math.max(15, mon.intervalMinutes) * 60 * 1000;
      if (!lastMs || nowMs - lastMs >= intervalMs) {
        executeMonitorRun(mon.id).catch((err) => {
          console.error(`Scheduled monitor ${mon.id} failed:`, err);
        });
      }
    }
  }, 60_000);
}
