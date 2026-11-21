import React, { useCallback, useEffect, useState } from 'react';
import {
  Compass,
  Download,
  Layers,
  Loader2,
  Menu,
  Plus,
  Radar,
  Send,
  Table2,
  X,
} from 'lucide-react';
import type {
  IngestLogEntry,
  Lead,
  OutreachSequence,
  WorkspaceSnapshot,
} from './types/leads';
import NextdoorScraperView from './components/NextdoorScraperView';
import LeadDiscoveryView from './components/LeadDiscoveryView';
import PipelineCrmView from './components/PipelineCrmView';
import EnrichmentView from './components/EnrichmentView';
import OutreachView from './components/OutreachView';

type NavSection = 'scraper' | 'discovery' | 'crm' | 'enrichment' | 'outreach';

const NAV_ITEMS: Array<{
  id: NavSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'scraper', label: 'Nextdoor Ad Scraper', icon: Radar },
  { id: 'discovery', label: 'Lead Discovery', icon: Compass },
  { id: 'crm', label: 'Pipeline CRM', icon: Table2 },
  { id: 'enrichment', label: 'Waterfall Enrichment', icon: Layers },
  { id: 'outreach', label: 'Outreach Sequences', icon: Send },
];

const AVATAR_URL = '/src/assets/images/avatar_workspace_owner_1795292568269.jpg';

export default function App() {
  const [section, setSection] = useState<NavSection>('scraper');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [sequences, setSequences] = useState<OutreachSequence[]>([]);
  const [ingestLogs, setIngestLogs] = useState<IngestLogEntry[]>([]);
  const [loadingWorkspace, setLoadingWorkspace] = useState(true);

  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [draftLeadId, setDraftLeadId] = useState<string | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  const [toast, setToast] = useState<{
    message: string;
    tone: 'success' | 'error';
  } | null>(null);

  // Add Lead form state
  const [newCompany, setNewCompany] = useState('');
  const [newContact, setNewContact] = useState('');
  const [newCategory, setNewCategory] = useState('Home Services');
  const [newNeighborhood, setNewNeighborhood] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newWebsite, setNewWebsite] = useState('');
  const [newAdHeadline, setNewAdHeadline] = useState('');
  const [newAdOffer, setNewAdOffer] = useState('');
  const [creatingLead, setCreatingLead] = useState(false);

  const notify = useCallback((message: string, tone: 'success' | 'error' = 'success') => {
    setToast({ message, tone });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(t);
  }, [toast]);

  const loadWorkspace = useCallback(async () => {
    try {
      const res = await fetch('/api/workspace');
      if (!res.ok) throw new Error('Failed to load workspace');
      const data = (await res.json()) as WorkspaceSnapshot;
      setLeads(data.leads ?? []);
      setSequences(data.sequences ?? []);
      setIngestLogs(data.ingestLogs ?? []);
    } catch {
      notify('Unable to reach FynderGrid server.', 'error');
    } finally {
      setLoadingWorkspace(false);
    }
  }, [notify]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  async function handleUpdateLead(id: string, patch: Partial<Lead>) {
    try {
      const res = await fetch(`/api/leads/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      setLeads((prev) => prev.map((l) => (l.id === id ? data.lead : l)));
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to update lead', 'error');
    }
  }

  async function handleDeleteLead(id: string) {
    try {
      const res = await fetch(`/api/leads/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Delete failed');
      setLeads((prev) => prev.filter((l) => l.id !== id));
      notify('Lead removed from pipeline.', 'success');
    } catch {
      notify('Could not delete lead.', 'error');
    }
  }

  async function handleEnrichLead(id: string) {
    setEnrichingId(id);
    try {
      const res = await fetch(`/api/enrich/${encodeURIComponent(id)}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Waterfall enrichment failed');
      if (data.lead) {
        setLeads((prev) => prev.map((l) => (l.id === id ? data.lead : l)));
      }
      notify(`Waterfall enrichment completed for ${data.lead?.companyName || 'lead'}.`, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Enrichment failed', 'error');
    } finally {
      setEnrichingId(null);
    }
  }

  async function handleCreateManualLead(e: React.FormEvent) {
    e.preventDefault();
    if (!newCompany.trim()) {
      notify('Company name is required.', 'error');
      return;
    }
    setCreatingLead(true);
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: newCompany.trim(),
          contactName: newContact.trim(),
          contactRole: 'Owner',
          category: newCategory.trim() || 'Local Service',
          neighborhood: newNeighborhood.trim(),
          city: newCity.trim(),
          email: newEmail.trim(),
          emailStatus: newEmail.trim() ? 'unverified' : 'missing',
          phone: newPhone.trim(),
          website: newWebsite.trim(),
          nextdoorUrl: '',
          source: 'nextdoor_ad',
          stage: 'new',
          adHeadline: newAdHeadline.trim() || `${newCompany.trim()} — Nextdoor Listing`,
          adBody: '',
          adOffer: newAdOffer.trim(),
          adFormat: 'Sponsored Post',
          notes: '',
          citations: [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not add lead');
      setLeads((prev) => [data.lead, ...prev]);
      setAddModalOpen(false);
      setNewCompany('');
      setNewContact('');
      setNewNeighborhood('');
      setNewCity('');
      setNewEmail('');
      setNewPhone('');
      setNewWebsite('');
      setNewAdHeadline('');
      setNewAdOffer('');
      notify(`Added ${data.lead.companyName} to Pipeline CRM.`, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to create lead', 'error');
    } finally {
      setCreatingLead(false);
    }
  }

  async function handleCreateSequence(seq: Omit<OutreachSequence, 'id' | 'createdAt'>) {
    const res = await fetch('/api/sequences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(seq),
    });
    const data = await res.json();
    if (!res.ok) {
      notify(data.error || 'Could not create sequence', 'error');
      return;
    }
    setSequences((prev) => [data.sequence, ...prev]);
    notify(`Created sequence "${data.sequence.name}".`, 'success');
  }

  async function handleToggleSequenceStatus(seq: OutreachSequence) {
    const nextStatus = seq.status === 'Active' ? 'Paused' : 'Active';
    const res = await fetch(`/api/sequences/${encodeURIComponent(seq.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
    const data = await res.json();
    if (res.ok && data.sequence) {
      setSequences((prev) => prev.map((s) => (s.id === seq.id ? data.sequence : s)));
      notify(`Sequence set to ${nextStatus}.`, 'success');
    }
  }

  async function handleDeleteSequence(id: string) {
    const res = await fetch(`/api/sequences/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      setSequences((prev) => prev.filter((s) => s.id !== id));
      notify('Sequence deleted.', 'success');
    }
  }

  const activeNavLabel = NAV_ITEMS.find((n) => n.id === section)?.label ?? 'Workspace';

  return (
    <div className="flex min-h-screen bg-white text-slate-900">
      {/* Desktop Sidebar (256px) */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-slate-200 bg-slate-50/75">
        <div className="flex h-14 items-center gap-2.5 border-b border-slate-200 px-5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-700 text-white shrink-0">
            <Radar className="h-4 w-4" />
          </div>
          <span className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            FynderGrid
          </span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            const count =
              item.id === 'crm'
                ? leads.length
                : item.id === 'enrichment'
                  ? leads.filter((l) => l.emailStatus !== 'verified_mx').length
                  : item.id === 'outreach'
                    ? sequences.length
                    : null;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`flex w-full items-center justify-between gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-emerald-700/10 text-emerald-900'
                    : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      active ? 'text-emerald-700' : 'text-slate-400'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                {count !== null && (
                  <span className="font-mono text-xs text-slate-500 tabular-nums shrink-0">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Workspace Profile Footer */}
        <div className="border-t border-slate-200 p-4">
          <div className="flex items-center gap-3">
            {!avatarFailed ? (
              <img
                src={AVATAR_URL}
                alt="Workspace owner portrait"
                referrerPolicy="no-referrer"
                onError={() => setAvatarFailed(true)}
                className="h-9 w-9 rounded-full object-cover border border-slate-200 shrink-0"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white shrink-0">
                FG
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-900">Growth Ops</p>
              <p className="truncate text-xs text-slate-500 tabular-nums">
                {leads.length} leads · {ingestLogs.length} ingests
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex lg:hidden bg-slate-900/40"
          onClick={() => setMobileMenuOpen(false)}
        >
          <aside
            className="flex w-64 flex-col bg-white border-r border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-14 items-center justify-between border-b border-slate-200 px-5">
              <span className="font-display text-base font-bold text-slate-900">FynderGrid</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 text-slate-500 hover:text-slate-900 cursor-pointer"
                aria-label="Close navigation menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = section === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSection(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium cursor-pointer ${
                      active
                        ? 'bg-emerald-700/10 text-emerald-900'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex flex-1 flex-col lg:pl-64 min-w-0">
        {/* Top Bar Contract: Breadcrumb Left + 1-2 Actions Right */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-8 border-b border-slate-200 bg-white/95 backdrop-blur-xs px-5 lg:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden cursor-pointer"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 hidden sm:inline whitespace-nowrap">Workspace</span>
              <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
                /
              </span>
              <span className="font-medium text-slate-900 truncate">{activeNavLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <a
              href="/api/leads/export.csv"
              download="fyndergrid-leads.csv"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </a>
            <button
              type="button"
              onClick={() => setAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Lead
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 px-5 py-7 lg:px-8 max-w-[1440px] w-full mx-auto">
          {loadingWorkspace ? (
            <div className="flex items-center justify-center gap-2 py-24 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-700" />
              Loading workspace...
            </div>
          ) : (
            <>
              {section === 'scraper' && (
                <NextdoorScraperView
                  ingestLogs={ingestLogs}
                  onLeadsImported={loadWorkspace}
                  onNotify={notify}
                />
              )}
              {section === 'discovery' && (
                <LeadDiscoveryView
                  onLeadsImported={loadWorkspace}
                  onNotify={notify}
                />
              )}
              {section === 'crm' && (
                <PipelineCrmView
                  leads={leads}
                  enrichingId={enrichingId}
                  onUpdateLead={handleUpdateLead}
                  onDeleteLead={handleDeleteLead}
                  onEnrichLead={handleEnrichLead}
                  onDraftForLead={(leadId) => {
                    setDraftLeadId(leadId);
                    setSection('outreach');
                  }}
                  onOpenAddModal={() => setAddModalOpen(true)}
                />
              )}
              {section === 'enrichment' && (
                <EnrichmentView
                  leads={leads}
                  enrichingId={enrichingId}
                  onEnrichLead={handleEnrichLead}
                />
              )}
              {section === 'outreach' && (
                <OutreachView
                  leads={leads}
                  sequences={sequences}
                  initialLeadId={draftLeadId}
                  onCreateSequence={handleCreateSequence}
                  onToggleSequenceStatus={handleToggleSequenceStatus}
                  onDeleteSequence={handleDeleteSequence}
                  onMarkLeadContacted={async (id) => {
                    await handleUpdateLead(id, { stage: 'contacted' });
                    notify('Lead moved to Contacted stage.', 'success');
                  }}
                  onNotify={notify}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Add Lead Modal */}
      {addModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setAddModalOpen(false)}
        >
          <form
            onSubmit={handleCreateManualLead}
            className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-900">Add Lead to Pipeline CRM</h2>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="rounded-md p-1 text-slate-500 hover:bg-slate-100 cursor-pointer"
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Company Name *</label>
                  <input
                    required
                    type="text"
                    value={newCompany}
                    onChange={(e) => setNewCompany(e.target.value)}
                    placeholder="e.g. Oakridge Roofing Ltd"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:border-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Contact Name</label>
                  <input
                    type="text"
                    value={newContact}
                    onChange={(e) => setNewContact(e.target.value)}
                    placeholder="e.g. James Fletcher"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Category</label>
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:border-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">UK Neighbourhood</label>
                  <input
                    type="text"
                    value={newNeighborhood}
                    onChange={(e) => setNewNeighborhood(e.target.value)}
                    placeholder="e.g. Clifton (BS8)"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:border-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">UK Town / City</label>
                  <input
                    type="text"
                    value={newCity}
                    onChange={(e) => setNewCity(e.target.value)}
                    placeholder="e.g. Bristol, UK"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Work Email</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="owner@company.co.uk"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:border-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">UK Phone</label>
                  <input
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="0117 496 0190"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Website</label>
                <input
                  type="url"
                  value={newWebsite}
                  onChange={(e) => setNewWebsite(e.target.value)}
                  placeholder="https://company.co.uk"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Nextdoor Ad Headline</label>
                  <input
                    type="text"
                    value={newAdHeadline}
                    onChange={(e) => setNewAdHeadline(e.target.value)}
                    placeholder="Observed sponsored headline"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:border-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Observed Offer</label>
                  <input
                    type="text"
                    value={newAdOffer}
                    onChange={(e) => setNewAdOffer(e.target.value)}
                    placeholder="e.g. Free roof inspection"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3.5">
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingLead}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 cursor-pointer"
              >
                {creatingLead ? 'Saving...' : 'Save Lead'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Toast Feedback */}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-5 right-5 z-50 max-w-sm rounded-lg border px-4 py-3 text-xs font-medium shadow-lg ${
            toast.tone === 'error'
              ? 'border-red-200 bg-red-50 text-red-900'
              : 'border-emerald-200 bg-white text-slate-900'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
