import React, { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Loader2,
  Mail,
  Plus,
  Send,
  Trash2,
} from 'lucide-react';
import type { Lead, OutreachSequence } from '../types/leads';

interface OutreachViewProps {
  leads: Lead[];
  sequences: OutreachSequence[];
  initialLeadId?: string | null;
  onCreateSequence: (seq: Omit<OutreachSequence, 'id' | 'createdAt'>) => Promise<void>;
  onToggleSequenceStatus: (seq: OutreachSequence) => Promise<void>;
  onDeleteSequence: (id: string) => Promise<void>;
  onMarkLeadContacted: (leadId: string) => Promise<void>;
  onNotify: (message: string, tone?: 'success' | 'error') => void;
}

export default function OutreachView({
  leads,
  sequences,
  initialLeadId,
  onCreateSequence,
  onToggleSequenceStatus,
  onDeleteSequence,
  onMarkLeadContacted,
  onNotify,
}: OutreachViewProps) {
  const [selectedLeadId, setSelectedLeadId] = useState<string>(
    initialLeadId || leads[0]?.id || ''
  );
  const [yourOffer, setYourOffer] = useState(
    'We build high-converting UK postcode landing pages and automated SMS missed-call follow-up so local service advertisers double booked jobs from Nextdoor UK Ads.'
  );
  const [channel, setChannel] = useState<'Email' | 'Nextdoor DM' | 'LinkedIn'>('Email');
  const [tone, setTone] = useState<'Direct & Concise' | 'Consultative' | 'Neighborly'>(
    'Direct & Concise'
  );
  const [generating, setGenerating] = useState(false);
  const [draftSubject, setDraftSubject] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [copied, setCopied] = useState(false);

  // New Sequence form
  const [showNewSeq, setShowNewSeq] = useState(false);
  const [seqName, setSeqName] = useState('');
  const [seqNiche, setSeqNiche] = useState('');
  const [seqSubject, setSeqSubject] = useState(
    'Quick note on {{companyName}} in {{neighborhood}}'
  );
  const [seqBody, setSeqBody] = useState(
    'Hi {{contactName}},\n\nNoticed your {{neighborhood}} Nextdoor ad for "{{adOffer}}". Happy to share a 3-minute breakdown on capturing more local quote requests from the exact same ad spend.'
  );
  const [savingSeq, setSavingSeq] = useState(false);

  useEffect(() => {
    if (initialLeadId) {
      setSelectedLeadId(initialLeadId);
    } else if (!selectedLeadId && leads[0]) {
      setSelectedLeadId(leads[0].id);
    }
  }, [initialLeadId, leads, selectedLeadId]);

  const activeLead = leads.find((l) => l.id === selectedLeadId) ?? null;

  async function handleGenerateDraft(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedLeadId) {
      onNotify('Select a lead from your pipeline first.', 'error');
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch('/api/outreach/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: selectedLeadId,
          yourOffer,
          channel,
          tone,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to draft message');
      setDraftSubject(data.subject || '');
      setDraftBody(data.body || '');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Drafting failed', 'error');
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveSequence(e: React.FormEvent) {
    e.preventDefault();
    if (!seqName.trim() || !seqNiche.trim()) {
      onNotify('Provide a sequence name and target niche.', 'error');
      return;
    }
    setSavingSeq(true);
    try {
      await onCreateSequence({
        name: seqName.trim(),
        targetNiche: seqNiche.trim(),
        status: 'Active',
        enrolledCount: 0,
        replyRateLabel: 'New sequence',
        steps: [
          {
            id: `step-${Date.now()}`,
            dayOffset: 0,
            channel: 'Email',
            subject: seqSubject.trim(),
            body: seqBody.trim(),
          },
        ],
      });
      setSeqName('');
      setSeqNiche('');
      setShowNewSeq(false);
    } finally {
      setSavingSeq(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Outreach Sequences & Personalizer
          </h1>
          <p className="mt-1 text-sm text-slate-600 max-w-2xl">
            Build multi-touch follow-up campaigns and craft hyper-local openers referencing each
            UK advertiser&apos;s exact Nextdoor neighbourhood offer.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowNewSeq((prev) => !prev)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 self-start cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          New Sequence
        </button>
      </div>

      {/* Create Sequence Inline Form */}
      {showNewSeq && (
        <form
          onSubmit={handleSaveSequence}
          className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
        >
          <h2 className="text-sm font-semibold text-slate-900">Create Outreach Sequence</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Sequence Name
              </label>
              <input
                type="text"
                value={seqName}
                onChange={(e) => setSeqName(e.target.value)}
                placeholder="e.g. Nextdoor Roofing Advertisers — Q4"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Target Niche
              </label>
              <input
                type="text"
                value={seqNiche}
                onChange={(e) => setSeqNiche(e.target.value)}
                placeholder="e.g. Roofing, Solar, Exterior Remodeling"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Day 0 Subject Line (supports {'{{companyName}}'}, {'{{neighborhood}}'}, {'{{adOffer}}'})
            </label>
            <input
              type="text"
              value={seqSubject}
              onChange={(e) => setSeqSubject(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Day 0 Message Template
            </label>
            <textarea
              rows={4}
              value={seqBody}
              onChange={(e) => setSeqBody(e.target.value)}
              className="w-full rounded-lg border border-slate-200 p-3 text-xs text-slate-800 focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowNewSeq(false)}
              className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingSeq}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 cursor-pointer"
            >
              {savingSeq ? 'Creating...' : 'Save Sequence'}
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Left: Saved Multi-Step Sequences */}
        <div className="xl:col-span-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">
            Active & Draft Sequences ({sequences.length})
          </h2>

          {sequences.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
              No outreach sequences created yet.
            </div>
          ) : (
            sequences.map((seq) => (
              <div
                key={seq.id}
                className="rounded-xl border border-slate-200 bg-white overflow-hidden"
              >
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500">
                      <span
                        className={
                          seq.status === 'Active'
                            ? 'text-emerald-700 font-medium'
                            : 'text-slate-500'
                        }
                      >
                        {seq.status}
                      </span>{' '}
                      · {seq.targetNiche} ·{' '}
                      <span className="tabular-nums">{seq.enrolledCount} enrolled</span> ·{' '}
                      {seq.replyRateLabel}
                    </p>
                    <h3 className="mt-0.5 text-sm font-semibold text-slate-900">{seq.name}</h3>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onToggleSequenceStatus(seq)}
                      className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      {seq.status === 'Active' ? 'Pause' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteSequence(seq.id)}
                      aria-label={`Delete ${seq.name}`}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {seq.steps.map((step, index) => (
                    <div key={step.id} className="px-5 py-3.5 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-900">
                          Step {index + 1} · {step.channel}
                        </span>
                        <span className="font-mono text-slate-500 tabular-nums">
                          Day +{step.dayOffset}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-slate-700">{step.subject}</p>
                      <p className="text-xs text-slate-500 whitespace-pre-line line-clamp-3">
                        {step.body}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right: Ad-Aware Personalized Drafter */}
        <div className="xl:col-span-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">
            Nextdoor Ad-Aware Message Drafter
          </h2>

          <form
            onSubmit={handleGenerateDraft}
            className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
          >
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Target Prospect from Pipeline CRM
              </label>
              <select
                value={selectedLeadId}
                onChange={(e) => setSelectedLeadId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
              >
                {leads.length === 0 && <option value="">No leads available</option>}
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.companyName} — {l.neighborhood || l.city} ({l.adFormat})
                  </option>
                ))}
              </select>
            </div>

            {activeLead && (
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3.5 py-3 text-xs space-y-1">
                <p className="font-medium text-slate-800">
                  Observed Nextdoor Ad: {activeLead.adHeadline || 'Business page'}
                </p>
                <p className="text-slate-600">
                  Offer: {activeLead.adOffer || 'Local service listing'} · Contact:{' '}
                  {activeLead.contactName || 'Owner'} ({activeLead.email || 'email pending'})
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Channel</label>
                <select
                  value={channel}
                  onChange={(e) =>
                    setChannel(e.target.value as 'Email' | 'Nextdoor DM' | 'LinkedIn')
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
                >
                  <option value="Email">Cold Email</option>
                  <option value="Nextdoor DM">Nextdoor Business Message</option>
                  <option value="LinkedIn">LinkedIn Note</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Tone</label>
                <select
                  value={tone}
                  onChange={(e) =>
                    setTone(
                      e.target.value as 'Direct & Concise' | 'Consultative' | 'Neighborly'
                    )
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
                >
                  <option value="Direct & Concise">Direct & Concise</option>
                  <option value="Consultative">Consultative</option>
                  <option value="Neighborly">Neighbourly (UK)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Your Offer / Service Pitch
              </label>
              <textarea
                rows={3}
                value={yourOffer}
                onChange={(e) => setYourOffer(e.target.value)}
                className="w-full rounded-lg border border-slate-200 p-3 text-xs leading-relaxed text-slate-800 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={generating || !selectedLeadId}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Drafting Message...
                  </>
                ) : (
                  <>
                    <Mail className="h-3.5 w-3.5" />
                    Generate Personalized Draft
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Draft Output */}
          {(draftSubject || draftBody) && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-slate-900">Ready-to-Send Draft</h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(
                        `Subject: ${draftSubject}\n\n${draftBody}`
                      );
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1800);
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-700" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copy
                      </>
                    )}
                  </button>
                  {activeLead && (
                    <button
                      type="button"
                      onClick={() => onMarkLeadContacted(activeLead.id)}
                      className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800 cursor-pointer"
                    >
                      <Send className="h-3 w-3" />
                      Mark Contacted
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={draftSubject}
                  onChange={(e) => setDraftSubject(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Message Body
                </label>
                <textarea
                  rows={8}
                  value={draftBody}
                  onChange={(e) => setDraftBody(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 p-3 text-xs leading-relaxed text-slate-800 focus:border-emerald-600 focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
