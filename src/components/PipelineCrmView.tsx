import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  Layers,
  Loader2,
  Mail,
  Search,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import type { Lead, LeadSource, LeadStage } from '../types/leads';
import {
  emailStatusLabel,
  formatShortDate,
  safeExternalUrl,
  sourceLabel,
  stageLabel,
} from '../utils/format';

interface PipelineCrmViewProps {
  leads: Lead[];
  enrichingId: string | null;
  onUpdateLead: (id: string, patch: Partial<Lead>) => Promise<void>;
  onDeleteLead: (id: string) => Promise<void>;
  onEnrichLead: (id: string) => Promise<void>;
  onDraftForLead: (leadId: string) => void;
  onOpenAddModal: () => void;
}

const STAGES: Array<{ key: 'all' | LeadStage; label: string }> = [
  { key: 'all', label: 'All Leads' },
  { key: 'new', label: 'New' },
  { key: 'enriched', label: 'Enriched' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'replied', label: 'Replied' },
  { key: 'qualified', label: 'Qualified' },
];

export default function PipelineCrmView({
  leads,
  enrichingId,
  onUpdateLead,
  onDeleteLead,
  onEnrichLead,
  onDraftForLead,
  onOpenAddModal,
}: PipelineCrmViewProps) {
  const [query, setQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<'all' | LeadStage>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | LeadSource>('all');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((lead) => {
      if (stageFilter !== 'all' && lead.stage !== stageFilter) return false;
      if (sourceFilter !== 'all' && lead.source !== sourceFilter) return false;
      if (!q) return true;
      return (
        lead.companyName.toLowerCase().includes(q) ||
        lead.contactName.toLowerCase().includes(q) ||
        lead.neighborhood.toLowerCase().includes(q) ||
        lead.city.toLowerCase().includes(q) ||
        lead.category.toLowerCase().includes(q) ||
        lead.adHeadline.toLowerCase().includes(q) ||
        lead.email.toLowerCase().includes(q)
      );
    });
  }, [leads, query, stageFilter, sourceFilter]);

  const metrics = useMemo(() => {
    const total = leads.length;
    const nextdoorCount = leads.filter(
      (l) =>
        l.source === 'nextdoor_ad' ||
        l.source === 'nextdoor_page' ||
        l.source === 'webhook_ingest'
    ).length;
    const mxVerified = leads.filter((l) => l.emailStatus === 'verified_mx').length;
    const qualified = leads.filter(
      (l) => l.stage === 'qualified' || l.stage === 'replied'
    ).length;
    return { total, nextdoorCount, mxVerified, qualified };
  }, [leads]);

  const activeLead = useMemo(
    () => leads.find((l) => l.id === selectedLeadId) ?? null,
    [leads, selectedLeadId]
  );

  function openInspector(lead: Lead) {
    setSelectedLeadId(lead.id);
    setNotesDraft(lead.notes);
  }

  async function saveNotes() {
    if (!activeLead) return;
    setSavingNotes(true);
    try {
      await onUpdateLead(activeLead.id, { notes: notesDraft });
    } finally {
      setSavingNotes(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header & KPI Strip */}
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Pipeline CRM</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage scraped Nextdoor advertisers, track enrichment verification, and advance local
          deals through outreach.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-6 border-t border-slate-100 pt-4 lg:grid-cols-4">
          <div>
            <p className="text-xs text-slate-500">Total Saved Leads</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
              {metrics.total}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Nextdoor UK Ad & Page Captures</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
              {metrics.nextdoorCount}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">MX-Verified Work Emails</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-emerald-700 tabular-nums">
              {metrics.mxVerified}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Replied & Qualified</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
              {metrics.qualified}
            </p>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 overflow-x-auto">
          {STAGES.map((st) => (
            <button
              key={st.key}
              type="button"
              onClick={() => setStageFilter(st.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                stageFilter === st.key
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter company, postcode, UK town..."
              className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
            />
          </div>

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as 'all' | LeadSource)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-emerald-600 focus:outline-none"
            aria-label="Filter by source"
          >
            <option value="all">All Sources</option>
            <option value="nextdoor_ad">Nextdoor UK Ad</option>
            <option value="nextdoor_page">Nextdoor UK Page</option>
            <option value="github_import">GitHub Import</option>
            <option value="webhook_ingest">Webhook Ingest</option>
            <option value="web_discovery">UK Web Discovery</option>
          </select>
        </div>
      </div>

      {/* High-Density Data Grid */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-6 py-14 text-center space-y-3">
            <p className="text-sm font-medium text-slate-800">No leads match your current filter</p>
            <p className="text-xs text-slate-500">
              Clear your search filter, scrape Nextdoor ads, or add a prospect manually.
            </p>
            <button
              type="button"
              onClick={onOpenAddModal}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 transition-colors cursor-pointer"
            >
              Add First Lead
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="px-4 py-3">Company & Contact</th>
                  <th className="px-4 py-3">UK Neighbourhood & Source</th>
                  <th className="px-4 py-3">Nextdoor UK Ad Signal</th>
                  <th className="px-4 py-3">Email & Verification</th>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filtered.map((lead) => {
                  const isEnriching = enrichingId === lead.id;
                  return (
                    <tr
                      key={lead.id}
                      onClick={() => openInspector(lead)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3 max-w-[230px]">
                        <p className="font-semibold text-slate-900 truncate">{lead.companyName}</p>
                        <p className="mt-0.5 text-slate-500 truncate">
                          {lead.contactName || 'Contact unlisted'} · {lead.category}
                        </p>
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        <p className="text-slate-800 truncate">{lead.neighborhood || lead.city}</p>
                        <p className="mt-0.5 text-slate-500 truncate">
                          {sourceLabel(lead.source)}
                          {lead.sourceRepo ? ` · ${lead.sourceRepo.split('/').pop()}` : ''}
                        </p>
                      </td>
                      <td className="px-4 py-3 max-w-[270px]">
                        <p className="text-slate-900 truncate font-medium">
                          {lead.adHeadline || 'Directory listing'}
                        </p>
                        <p className="mt-0.5 text-slate-500 truncate">
                          {lead.adFormat}
                          {lead.adOffer ? ` · ${lead.adOffer}` : ''}
                        </p>
                      </td>
                      <td className="px-4 py-3 max-w-[220px]">
                        <p className="font-mono text-slate-800 truncate">
                          {lead.email || <span className="font-sans text-slate-400">Not enriched</span>}
                        </p>
                        <p
                          className={`mt-0.5 flex items-center gap-1 ${
                            lead.emailStatus === 'verified_mx'
                              ? 'text-emerald-700 font-medium'
                              : lead.emailStatus === 'missing'
                                ? 'text-amber-700'
                                : 'text-slate-500'
                          }`}
                        >
                          {lead.emailStatus === 'verified_mx' && (
                            <CheckCircle2 className="h-3 w-3 shrink-0" />
                          )}
                          <span>{emailStatusLabel(lead.emailStatus)}</span>
                          {lead.phone && (
                            <>
                              <span aria-hidden="true" className="text-slate-300">
                                ·
                              </span>
                              <span className="font-mono text-slate-500 tabular-nums">
                                {lead.phone}
                              </span>
                            </>
                          )}
                        </p>
                      </td>
                      <td
                        className="px-4 py-3 whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <select
                          value={lead.stage}
                          onChange={(e) =>
                            onUpdateLead(lead.id, { stage: e.target.value as LeadStage })
                          }
                          aria-label={`Change stage for ${lead.companyName}`}
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 focus:border-emerald-600 focus:outline-none cursor-pointer"
                        >
                          <option value="new">New</option>
                          <option value="enriched">Enriched</option>
                          <option value="contacted">Contacted</option>
                          <option value="replied">Replied</option>
                          <option value="qualified">Qualified</option>
                        </select>
                      </td>
                      <td
                        className="px-4 py-3 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onEnrichLead(lead.id)}
                            disabled={isEnriching}
                            title="Run Waterfall Enrichment"
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
                          >
                            {isEnriching ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Layers className="h-3 w-3" />
                            )}
                            Enrich
                          </button>
                          <button
                            type="button"
                            onClick={() => onDraftForLead(lead.id)}
                            title="Draft Personalized Outreach"
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                          >
                            <Send className="h-3 w-3" />
                            Draft
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteLead(lead.id)}
                            title="Delete Lead"
                            aria-label={`Delete ${lead.companyName}`}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Lead Inspector Drawer */}
      {activeLead && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-900/30"
          onClick={() => setSelectedLeadId(null)}
        >
          <aside
            className="flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
              <div className="min-w-0">
                <p className="text-xs text-slate-500">
                  {sourceLabel(activeLead.source)} · {stageLabel(activeLead.stage)} · Added{' '}
                  {formatShortDate(activeLead.createdAt)}
                </p>
                <h2 className="mt-0.5 text-lg font-bold text-slate-900 truncate">
                  {activeLead.companyName}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLeadId(null)}
                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
                aria-label="Close lead details"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {/* Contact & Links Grid */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-slate-500">Decision Maker</p>
                  <p className="mt-0.5 font-medium text-slate-900">
                    {activeLead.contactName || 'Unlisted'}{' '}
                    {activeLead.contactRole ? `(${activeLead.contactRole})` : ''}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Location</p>
                  <p className="mt-0.5 font-medium text-slate-900">
                    {activeLead.neighborhood}
                    {activeLead.city ? `, ${activeLead.city}` : ''}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Work Email</p>
                  <p className="mt-0.5 font-mono text-slate-900 break-all">
                    {activeLead.email || 'Not enriched yet'}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {emailStatusLabel(activeLead.emailStatus)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Phone</p>
                  <p className="mt-0.5 font-mono text-slate-900 tabular-nums">
                    {activeLead.phone || 'Not listed'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 border-t border-slate-100 pt-4 text-xs">
                {safeExternalUrl(activeLead.website) && (
                  <a
                    href={safeExternalUrl(activeLead.website)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-slate-800 hover:text-emerald-700 underline decoration-slate-300 underline-offset-4"
                  >
                    Website
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {safeExternalUrl(activeLead.nextdoorUrl) && (
                  <a
                    href={safeExternalUrl(activeLead.nextdoorUrl)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-emerald-700 hover:underline underline-offset-4"
                  >
                    Nextdoor Business Page
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {activeLead.sourceRepo && (
                  <span className="font-mono text-slate-500">
                    Scraper: {activeLead.sourceRepo}
                  </span>
                )}
              </div>

              {/* Nextdoor Ad Creative Captured */}
              <div className="border-t border-slate-100 pt-5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <h3 className="font-semibold text-slate-900">Captured Nextdoor Ad Copy</h3>
                  <span className="text-slate-500">{activeLead.adFormat}</span>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-1.5">
                  <p className="text-sm font-semibold text-slate-900">
                    {activeLead.adHeadline || 'No ad headline captured'}
                  </p>
                  <p className="text-xs leading-relaxed text-slate-600">
                    {activeLead.adBody || 'No body copy captured.'}
                  </p>
                  {activeLead.adOffer && (
                    <p className="pt-1 text-xs font-medium text-emerald-800">
                      Offer: {activeLead.adOffer}
                    </p>
                  )}
                </div>
              </div>

              {/* Enrichment Waterfall Trace */}
              <div className="border-t border-slate-100 pt-5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-900">
                    Waterfall Enrichment Audit
                  </h3>
                  <button
                    type="button"
                    onClick={() => onEnrichLead(activeLead.id)}
                    disabled={enrichingId === activeLead.id}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:text-emerald-800 cursor-pointer"
                  >
                    {enrichingId === activeLead.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Layers className="h-3.5 w-3.5" />
                    )}
                    Run Waterfall Now
                  </button>
                </div>

                {activeLead.enrichmentSteps.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Not yet enriched. Run the waterfall to verify DNS MX records and look up public
                    contact info.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                    {activeLead.enrichmentSteps.map((step, i) => (
                      <div key={i} className="px-3.5 py-2.5 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-slate-900">{step.step}</span>
                          <span
                            className={
                              step.status === 'verified' || step.status === 'found'
                                ? 'text-emerald-700 font-medium'
                                : 'text-slate-500'
                            }
                          >
                            {step.provider} · {step.status}
                          </span>
                        </div>
                        <p className="mt-0.5 text-slate-600">{step.detail}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Grounded Citations */}
              {activeLead.citations.length > 0 && (
                <div className="border-t border-slate-100 pt-5 space-y-2">
                  <h3 className="text-xs font-semibold text-slate-900">Verified Sources</h3>
                  <ul className="space-y-1 text-xs">
                    {activeLead.citations.map((c) => {
                      const href = safeExternalUrl(c.url);
                      if (!href) return null;
                      return (
                        <li key={href}>
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-slate-600 hover:text-emerald-700 underline decoration-slate-300 underline-offset-4"
                          >
                            {c.title}
                            <ExternalLink className="h-3 w-3 shrink-0" />
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* Editable CRM Notes */}
              <div className="border-t border-slate-100 pt-5 space-y-2">
                <label className="block text-xs font-semibold text-slate-900">
                  Account Notes
                </label>
                <textarea
                  rows={4}
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 p-3 text-xs leading-relaxed text-slate-800 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={saveNotes}
                    disabled={savingNotes}
                    className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                  >
                    {savingNotes ? 'Saving...' : 'Save Notes'}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/70 px-6 py-3.5">
              <button
                type="button"
                onClick={() => {
                  const id = activeLead.id;
                  setSelectedLeadId(null);
                  onDeleteLead(id);
                }}
                className="text-xs font-medium text-red-600 hover:text-red-700 cursor-pointer"
              >
                Delete Lead
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = activeLead.id;
                  setSelectedLeadId(null);
                  onDraftForLead(id);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 transition-colors cursor-pointer"
              >
                <Mail className="h-3.5 w-3.5" />
                Draft Personalized Outreach
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
