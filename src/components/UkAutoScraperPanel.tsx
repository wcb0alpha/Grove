import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  Pause,
  Play,
  Plus,
  Radar,
  Trash2,
} from 'lucide-react';
import type { AutoScraperMonitor, Lead, SourceCitation } from '../types/leads';
import { formatShortDate, safeExternalUrl } from '../utils/format';

interface UkAutoScraperPanelProps {
  monitors: AutoScraperMonitor[];
  onRefreshWorkspace: () => Promise<void>;
  onNotify: (message: string, tone?: 'success' | 'error') => void;
}

function formatInterval(minutes: number): string {
  if (minutes < 60) return `Every ${minutes} mins`;
  if (minutes === 60) return 'Every 1 hour';
  if (minutes < 1440) return `Every ${Math.round(minutes / 60)} hours`;
  return 'Daily (24h)';
}

export default function UkAutoScraperPanel({
  monitors,
  onRefreshWorkspace,
  onNotify,
}: UkAutoScraperPanelProps) {
  // Instant Auto-Scrape state
  const [ukLocation, setUkLocation] = useState('Bristol BS8');
  const [category, setCategory] = useState('Roofing Contractors');
  const [maxResults, setMaxResults] = useState(5);
  const [autoEnrich, setAutoEnrich] = useState(true);
  const [runningInstant, setRunningInstant] = useState(false);
  const [lastRunResult, setLastRunResult] = useState<{
    summary: string;
    createdLeads: Lead[];
    citations: SourceCitation[];
  } | null>(null);

  // Monitor actions & creator
  const [runningMonitorId, setRunningMonitorId] = useState<string | null>(null);
  const [showCreateMonitor, setShowCreateMonitor] = useState(false);
  const [monName, setMonName] = useState('');
  const [monLocations, setMonLocations] = useState('Leeds LS6, York YO1');
  const [monCategories, setMonCategories] = useState('Boiler & Heating Engineers, Solar Installers');
  const [monInterval, setMonInterval] = useState(360);
  const [monMax, setMonMax] = useState(5);
  const [monAutoEnrich, setMonAutoEnrich] = useState(true);
  const [monEnabled, setMonEnabled] = useState(true);
  const [creatingMonitor, setCreatingMonitor] = useState(false);

  async function handleInstantScrape(e: React.FormEvent) {
    e.preventDefault();
    if (!ukLocation.trim() || !category.trim()) {
      onNotify('Enter a UK postcode/town and a trade or business niche.', 'error');
      return;
    }
    setRunningInstant(true);
    try {
      const res = await fetch('/api/autoscraper/run-instant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ukLocation: ukLocation.trim(),
          category: category.trim(),
          maxResults,
          autoEnrich,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Auto-scrape failed');
      setLastRunResult({
        summary: data.summary || 'Auto-scrape finished.',
        createdLeads: Array.isArray(data.createdLeads) ? data.createdLeads : [],
        citations: Array.isArray(data.citations) ? data.citations : [],
      });
      await onRefreshWorkspace();
      onNotify(data.summary || 'Auto-scrape completed.', 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Auto-scrape failed', 'error');
    } finally {
      setRunningInstant(false);
    }
  }

  async function handleRunMonitorNow(monitor: AutoScraperMonitor) {
    setRunningMonitorId(monitor.id);
    try {
      const res = await fetch(`/api/monitors/${encodeURIComponent(monitor.id)}/run`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Monitor run failed');
      setLastRunResult({
        summary: data.summary || 'Monitor run finished.',
        createdLeads: Array.isArray(data.createdLeads) ? data.createdLeads : [],
        citations: Array.isArray(data.citations) ? data.citations : [],
      });
      await onRefreshWorkspace();
      onNotify(data.summary || `Completed ${monitor.name}.`, 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Monitor run failed', 'error');
    } finally {
      setRunningMonitorId(null);
    }
  }

  async function handleToggleMonitor(monitor: AutoScraperMonitor) {
    try {
      const res = await fetch(`/api/monitors/${encodeURIComponent(monitor.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !monitor.enabled }),
      });
      if (!res.ok) throw new Error('Could not update schedule');
      await onRefreshWorkspace();
      onNotify(
        !monitor.enabled
          ? `Scheduled auto-scraping enabled for "${monitor.name}".`
          : `Scheduled auto-scraping paused for "${monitor.name}".`,
        'success'
      );
    } catch {
      onNotify('Failed to update monitor schedule.', 'error');
    }
  }

  async function handleDeleteMonitor(id: string) {
    try {
      const res = await fetch(`/api/monitors/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Delete failed');
      await onRefreshWorkspace();
      onNotify('Postcode monitor removed.', 'success');
    } catch {
      onNotify('Failed to remove monitor.', 'error');
    }
  }

  async function handleCreateMonitor(e: React.FormEvent) {
    e.preventDefault();
    const locations = monLocations
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const categories = monCategories
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (!monName.trim() || locations.length === 0 || categories.length === 0) {
      onNotify('Provide a monitor name, at least one UK postcode/town, and one niche.', 'error');
      return;
    }

    setCreatingMonitor(true);
    try {
      const res = await fetch('/api/monitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: monName.trim(),
          ukLocations: locations,
          categories,
          intervalMinutes: monInterval,
          enabled: monEnabled,
          autoEnrich: monAutoEnrich,
          maxPerRun: monMax,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create monitor');
      await onRefreshWorkspace();
      setShowCreateMonitor(false);
      setMonName('');
      onNotify(`Created UK auto-scraper monitor "${data.monitor.name}".`, 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to create monitor', 'error');
    } finally {
      setCreatingMonitor(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Instant One-Click UK Auto-Scraper */}
      <form
        onSubmit={handleInstantScrape}
        className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Instant Nextdoor UK Auto-Scraper (<code className="font-mono text-xs">nextdoor.co.uk/pages</code>)
            </h2>
            <p className="mt-0.5 text-xs text-slate-600 max-w-2xl">
              Automatically discovers public Nextdoor UK business pages for any UK postcode or
              town, deduplicates against your CRM, saves new leads directly, and optionally runs
              live DNS MX enrichment.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="md:col-span-4">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              UK Postcode, Town or City
            </label>
            <input
              type="text"
              value={ukLocation}
              onChange={(e) => setUkLocation(e.target.value)}
              placeholder="e.g. Bristol BS8, Wimbledon SW19, Leeds"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
            />
          </div>

          <div className="md:col-span-4">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              UK Trade or Local Niche
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Roofing Contractors, Boiler Engineers"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Leads per Run
            </label>
            <select
              value={maxResults}
              onChange={(e) => setMaxResults(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
            >
              <option value={3}>Up to 3</option>
              <option value={5}>Up to 5</option>
              <option value={8}>Up to 8</option>
            </select>
          </div>

          <div className="md:col-span-2 flex items-end">
            <button
              type="submit"
              disabled={runningInstant}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 transition-colors whitespace-nowrap cursor-pointer"
            >
              {runningInstant ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Scraping...
                </>
              ) : (
                <>
                  <Radar className="h-3.5 w-3.5" />
                  Auto-Scrape UK
                </>
              )}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={autoEnrich}
              onChange={(e) => setAutoEnrich(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600 cursor-pointer"
            />
            Automatically run Waterfall MX Enrichment on newly captured UK leads
          </label>
          <span className="text-xs text-slate-500">
            Scope: Public <code className="font-mono">nextdoor.co.uk/pages</code> · Auto-saves to Pipeline CRM
          </span>
        </div>
      </form>

      {/* Latest Auto-Scrape Output */}
      {lastRunResult && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-200 bg-emerald-50/40 px-5 py-3.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-900">
              <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
              <span>{lastRunResult.summary}</span>
            </div>
          </div>

          {lastRunResult.createdLeads.length > 0 && (
            <div className="divide-y divide-slate-100">
              {lastRunResult.createdLeads.map((lead) => {
                const ndHref = safeExternalUrl(lead.nextdoorUrl);
                const webHref = safeExternalUrl(lead.website);
                return (
                  <div
                    key={lead.id}
                    className="flex flex-wrap items-start justify-between gap-4 px-5 py-3.5 text-xs"
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="font-semibold text-slate-900">{lead.companyName}</p>
                      <p className="text-slate-500">
                        {lead.category} · {lead.neighborhood}, {lead.city}
                      </p>
                      <p className="text-slate-700">{lead.adHeadline}</p>
                      <p className="font-mono text-slate-600">
                        {lead.email || 'Email pending'} · {lead.phone || 'Phone unlisted'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {ndHref && (
                        <a
                          href={ndHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-medium text-emerald-700 hover:underline"
                        >
                          Nextdoor UK
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      {webHref && (
                        <a
                          href={webHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-medium text-slate-700 hover:underline"
                        >
                          Website
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {lastRunResult.citations.length > 0 && (
            <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-xs">
              <span className="font-medium text-slate-700">Verified Sources: </span>
              <span className="space-x-3">
                {lastRunResult.citations.slice(0, 5).map((cite) => {
                  const href = safeExternalUrl(cite.url);
                  if (!href) return null;
                  return (
                    <a
                      key={href}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-600 hover:text-emerald-700 underline decoration-slate-300 underline-offset-4"
                    >
                      {cite.title}
                    </a>
                  );
                })}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Scheduled UK Postcode Monitors */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Scheduled UK Postcode Monitors ({monitors.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Enable any monitor to run automatically in the background on its configured UK
              postcode interval, or trigger a manual scan anytime.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateMonitor((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            New UK Monitor
          </button>
        </div>

        {/* Create Monitor Form */}
        {showCreateMonitor && (
          <form
            onSubmit={handleCreateMonitor}
            className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 text-xs"
          >
            <h3 className="text-sm font-semibold text-slate-900">
              Create Automated UK Postcode Monitor
            </h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Monitor Name *</label>
                <input
                  required
                  type="text"
                  value={monName}
                  onChange={(e) => setMonName(e.target.value)}
                  placeholder="e.g. Yorkshire Heating & Solar"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  UK Postcodes / Towns (comma-separated)
                </label>
                <input
                  required
                  type="text"
                  value={monLocations}
                  onChange={(e) => setMonLocations(e.target.value)}
                  placeholder="Leeds LS6, York YO1, Harrogate"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  UK Niches (comma-separated)
                </label>
                <input
                  required
                  type="text"
                  value={monCategories}
                  onChange={(e) => setMonCategories(e.target.value)}
                  placeholder="Roofing, Boiler Engineers"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Run Frequency</label>
                <select
                  value={monInterval}
                  onChange={(e) => setMonInterval(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 focus:border-emerald-600 focus:outline-none"
                >
                  <option value={60}>Every 1 hour</option>
                  <option value={360}>Every 6 hours</option>
                  <option value={720}>Every 12 hours</option>
                  <option value={1440}>Daily (every 24 hours)</option>
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Max Leads per Run</label>
                <select
                  value={monMax}
                  onChange={(e) => setMonMax(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 focus:border-emerald-600 focus:outline-none"
                >
                  <option value={3}>3 leads</option>
                  <option value={5}>5 leads</option>
                  <option value={8}>8 leads</option>
                </select>
              </div>
              <div className="flex flex-col justify-end gap-2">
                <label className="inline-flex items-center gap-2 text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={monAutoEnrich}
                    onChange={(e) => setMonAutoEnrich(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-700 cursor-pointer"
                  />
                  Auto-run Waterfall MX Enrichment
                </label>
                <label className="inline-flex items-center gap-2 text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={monEnabled}
                    onChange={(e) => setMonEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-700 cursor-pointer"
                  />
                  Start background schedule immediately
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowCreateMonitor(false)}
                className="rounded-lg border border-slate-200 px-3.5 py-2 font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingMonitor}
                className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 cursor-pointer"
              >
                {creatingMonitor ? 'Saving...' : 'Save UK Monitor'}
              </button>
            </div>
          </form>
        )}

        {/* Monitor Rows */}
        <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
          {monitors.length === 0 ? (
            <div className="px-6 py-10 text-center text-xs text-slate-500">
              No UK postcode monitors configured yet. Create one above to schedule automated
              Nextdoor UK directory captures.
            </div>
          ) : (
            monitors.map((mon) => {
              const isRunning = runningMonitorId === mon.id || mon.lastStatus === 'running';
              return (
                <div
                  key={mon.id}
                  className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                      <span
                        className={
                          mon.enabled
                            ? 'font-semibold text-emerald-700'
                            : 'font-medium text-slate-500'
                        }
                      >
                        {mon.enabled ? 'Schedule Active' : 'Schedule Paused'}
                      </span>
                      <span className="text-slate-300" aria-hidden="true">
                        ·
                      </span>
                      <span className="inline-flex items-center gap-1 text-slate-600">
                        <Clock className="h-3 w-3 text-slate-400" />
                        {formatInterval(mon.intervalMinutes)}
                      </span>
                      <span className="text-slate-300" aria-hidden="true">
                        ·
                      </span>
                      <span className="font-mono text-slate-600 tabular-nums">
                        {mon.totalLeadsCaptured} captured
                      </span>
                      {mon.autoEnrich && (
                        <>
                          <span className="text-slate-300" aria-hidden="true">
                            ·
                          </span>
                          <span className="text-slate-600">Auto-MX Enrich</span>
                        </>
                      )}
                    </div>

                    <h3 className="text-sm font-semibold text-slate-900">{mon.name}</h3>

                    <p className="text-xs text-slate-600">
                      UK Areas: {mon.ukLocations.join(', ')} · Niches: {mon.categories.join(', ')}
                    </p>

                    <p className="text-xs text-slate-500">
                      {mon.lastSummary}
                      {mon.lastRunAt ? ` · Last run ${formatShortDate(mon.lastRunAt)}` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleRunMonitorNow(mon)}
                      disabled={isRunning}
                      className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      {isRunning ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Running...
                        </>
                      ) : (
                        <>
                          <Play className="h-3.5 w-3.5" />
                          Run Now
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleMonitor(mon)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      {mon.enabled ? (
                        <>
                          <Pause className="h-3.5 w-3.5" />
                          Pause
                        </>
                      ) : (
                        <>
                          <Clock className="h-3.5 w-3.5" />
                          Enable Schedule
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteMonitor(mon.id)}
                      aria-label={`Delete ${mon.name}`}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
