import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  Layers,
  Loader2,
  Play,
  ShieldCheck,
} from 'lucide-react';
import type { Lead } from '../types/leads';
import {
  emailStatusLabel,
  formatShortDate,
  safeExternalUrl,
  sourceLabel,
} from '../utils/format';

interface EnrichmentViewProps {
  leads: Lead[];
  enrichingId: string | null;
  onEnrichLead: (id: string) => Promise<void>;
}

export default function EnrichmentView({
  leads,
  enrichingId,
  onEnrichLead,
}: EnrichmentViewProps) {
  const [filterMode, setFilterMode] = useState<'needs_enrichment' | 'all'>('needs_enrichment');
  const [batchRunning, setBatchRunning] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(leads[0]?.id ?? null);

  const queue = useMemo(() => {
    if (filterMode === 'all') return leads;
    return leads.filter(
      (l) => l.emailStatus !== 'verified_mx' || l.enrichmentSteps.length === 0
    );
  }, [leads, filterMode]);

  const inspected = useMemo(
    () => leads.find((l) => l.id === selectedLeadId) ?? queue[0] ?? leads[0] ?? null,
    [leads, queue, selectedLeadId]
  );

  async function runBatchEnrichment() {
    const targets = leads
      .filter((l) => l.emailStatus !== 'verified_mx' || l.enrichmentSteps.length === 0)
      .slice(0, 3);
    if (targets.length === 0) return;
    setBatchRunning(true);
    try {
      for (const lead of targets) {
        setSelectedLeadId(lead.id);
        await onEnrichLead(lead.id);
      }
    } finally {
      setBatchRunning(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Waterfall Enrichment
          </h1>
          <p className="mt-1 text-sm text-slate-600 max-w-2xl">
            Run LeadsFynder-style multi-stage enrichment on scraped Nextdoor leads: public domain
            resolution, decision-maker contact discovery, and live DNS MX mail-server verification.
          </p>
        </div>

        <button
          type="button"
          onClick={runBatchEnrichment}
          disabled={batchRunning || enrichingId !== null || queue.length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 self-start cursor-pointer"
        >
          {batchRunning ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Running Batch Waterfall...
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5" />
              Enrich Next 3 Unverified
            </>
          )}
        </button>
      </div>

      {/* 3-Stage Pipeline Explanation Strip */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold text-slate-900">01. Domain & Web Footprint</p>
          <p className="mt-1 text-xs text-slate-600 leading-relaxed">
            Resolves the advertiser&apos;s official business website and active local directories
            via live search grounding.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold text-slate-900">02. Contact & Role Extraction</p>
          <p className="mt-1 text-xs text-slate-600 leading-relaxed">
            Extracts publicly listed owner/manager names, phone numbers, and verified business
            inboxes without guessing.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold text-slate-900">03. Live DNS MX Check</p>
          <p className="mt-1 text-xs text-slate-600 leading-relaxed">
            Queries live DNS MX records on the business domain to confirm active mail exchangers
            before outreach.
          </p>
        </div>
      </div>

      {/* Split Workspace */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Left Queue */}
        <div className="xl:col-span-6 rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5 bg-slate-50/60">
            <h2 className="text-sm font-semibold text-slate-900">
              Enrichment Queue ({queue.length})
            </h2>
            <div className="flex items-center gap-1 rounded-md bg-slate-200/70 p-0.5">
              <button
                type="button"
                onClick={() => setFilterMode('needs_enrichment')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                  filterMode === 'needs_enrichment'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Needs Enrichment
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                  filterMode === 'all'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Leads
              </button>
            </div>
          </div>

          {queue.length === 0 ? (
            <div className="px-6 py-12 text-center text-xs text-slate-500">
              Every lead in your pipeline has already been verified. Switch to &ldquo;All Leads&rdquo;
              to re-run any record.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {queue.map((lead) => {
                const isSelected = inspected?.id === lead.id;
                const isRunning = enrichingId === lead.id;
                return (
                  <div
                    key={lead.id}
                    onClick={() => setSelectedLeadId(lead.id)}
                    className={`flex items-center justify-between gap-4 px-5 py-3.5 cursor-pointer transition-colors ${
                      isSelected ? 'bg-emerald-50/50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {lead.companyName}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500 truncate">
                        {lead.neighborhood}, {lead.city} · {sourceLabel(lead.source)}
                      </p>
                      <p className="mt-0.5 font-mono text-xs text-slate-600 truncate">
                        {lead.email || 'No email on file'} ·{' '}
                        <span
                          className={
                            lead.emailStatus === 'verified_mx'
                              ? 'text-emerald-700 font-sans font-medium'
                              : 'text-slate-500 font-sans'
                          }
                        >
                          {emailStatusLabel(lead.emailStatus)}
                        </span>
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedLeadId(lead.id);
                        onEnrichLead(lead.id);
                      }}
                      disabled={isRunning || batchRunning}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {isRunning ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-700" />
                          Running...
                        </>
                      ) : (
                        <>
                          <Layers className="h-3.5 w-3.5 text-emerald-700" />
                          Run Waterfall
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Waterfall Inspector */}
        <div className="xl:col-span-6 rounded-xl border border-slate-200 bg-white p-5 space-y-5 self-start">
          {inspected ? (
            <>
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">
                    {inspected.category} · {inspected.neighborhood}, {inspected.city}
                  </p>
                  <h2 className="mt-0.5 text-lg font-bold text-slate-900">
                    {inspected.companyName}
                  </h2>
                </div>
                <div className="text-right text-xs text-slate-500 shrink-0">
                  <p>Last Checked</p>
                  <p className="font-mono text-slate-800 tabular-nums">
                    {formatShortDate(inspected.lastEnrichedAt)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-slate-500">Contact & Role</p>
                  <p className="mt-0.5 font-medium text-slate-900">
                    {inspected.contactName || 'Unlisted'}
                    {inspected.contactRole ? ` · ${inspected.contactRole}` : ''}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Phone</p>
                  <p className="mt-0.5 font-mono text-slate-900 tabular-nums">
                    {inspected.phone || 'Not listed'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Work Email</p>
                  <p className="mt-0.5 font-mono text-slate-900 break-all">
                    {inspected.email || 'Not found yet'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Deliverability Status</p>
                  <p
                    className={`mt-0.5 inline-flex items-center gap-1 font-medium ${
                      inspected.emailStatus === 'verified_mx'
                        ? 'text-emerald-700'
                        : 'text-slate-700'
                    }`}
                  >
                    {inspected.emailStatus === 'verified_mx' && (
                      <ShieldCheck className="h-3.5 w-3.5" />
                    )}
                    {emailStatusLabel(inspected.emailStatus)}
                  </p>
                </div>
              </div>

              <div className="space-y-2.5 border-t border-slate-100 pt-4">
                <h3 className="text-xs font-semibold text-slate-900">Waterfall Step Trace</h3>
                {inspected.enrichmentSteps.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-5 text-center space-y-2">
                    <p className="text-xs text-slate-600">
                      No waterfall checks recorded yet for {inspected.companyName}.
                    </p>
                    <button
                      type="button"
                      onClick={() => onEnrichLead(inspected.id)}
                      disabled={enrichingId === inspected.id}
                      className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 cursor-pointer"
                    >
                      {enrichingId === inspected.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Layers className="h-3.5 w-3.5" />
                      )}
                      Run Waterfall Now
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                    {inspected.enrichmentSteps.map((step, i) => (
                      <div key={i} className="p-3.5 text-xs space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-900">{step.step}</span>
                          <span
                            className={`inline-flex items-center gap-1 font-medium ${
                              step.status === 'verified' || step.status === 'found'
                                ? 'text-emerald-700'
                                : 'text-slate-500'
                            }`}
                          >
                            {(step.status === 'verified' || step.status === 'found') && (
                              <CheckCircle2 className="h-3 w-3" />
                            )}
                            {step.provider} · {step.status}
                          </span>
                        </div>
                        <p className="text-slate-600">{step.detail}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {inspected.citations.length > 0 && (
                <div className="border-t border-slate-100 pt-4 space-y-1.5">
                  <h3 className="text-xs font-semibold text-slate-900">Verified Public Sources</h3>
                  <div className="flex flex-col gap-1 text-xs">
                    {inspected.citations.map((cite) => {
                      const href = safeExternalUrl(cite.url);
                      if (!href) return null;
                      return (
                        <a
                          key={href}
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-slate-600 hover:text-emerald-700 underline decoration-slate-300 underline-offset-4 truncate"
                        >
                          <span className="truncate">{cite.title}</span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="py-12 text-center text-xs text-slate-500">
              Select a lead from the queue to inspect its waterfall trace.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
