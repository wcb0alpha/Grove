import React, { useState } from 'react';
import {
  Building2,
  ExternalLink,
  Globe,
  Loader2,
  MapPin,
  Plus,
  Search,
} from 'lucide-react';
import type { Lead, SourceCitation } from '../types/leads';
import { safeExternalUrl } from '../utils/format';

interface DiscoveredItem {
  companyName: string;
  contactName: string;
  contactRole: string;
  category: string;
  neighborhood: string;
  city: string;
  email: string;
  phone: string;
  website: string;
  nextdoorUrl: string;
  adHeadline: string;
  adBody: string;
  adOffer: string;
  adFormat: Lead['adFormat'];
  notes: string;
}

interface LeadDiscoveryViewProps {
  onLeadsImported: () => Promise<void>;
  onNotify: (message: string, tone?: 'success' | 'error') => void;
}

const QUICK_PRESETS = [
  { label: 'Bristol Roofing on Nextdoor UK', niche: 'Roofing & Exterior Contractors', location: 'Bristol, UK', role: 'Director / Owner', mode: 'nextdoor_ads' as const },
  { label: 'London Boiler & Heating Deals', niche: 'Gas Safe Boiler & Heating Engineers', location: 'Richmond, London, UK', role: 'Operations Manager', mode: 'nextdoor_pages' as const },
  { label: 'Manchester Dental Clinics', niche: 'Private Dental Practice', location: 'Didsbury, Manchester, UK', role: 'Principal Dentist', mode: 'nextdoor_pages' as const },
  { label: 'Edinburgh Garden & Turf', niche: 'Landscape Design & Garden Care', location: 'Edinburgh, UK', role: 'Founder', mode: 'b2b_local' as const },
];

export default function LeadDiscoveryView({
  onLeadsImported,
  onNotify,
}: LeadDiscoveryViewProps) {
  const [niche, setNiche] = useState('Roofing & Solar Contractors');
  const [location, setLocation] = useState('Bristol, UK');
  const [role, setRole] = useState('Director / Owner');
  const [mode, setMode] = useState<'nextdoor_ads' | 'nextdoor_pages' | 'b2b_local'>('nextdoor_ads');
  const [limit, setLimit] = useState(5);

  const [isSearching, setIsSearching] = useState(false);
  const [summary, setSummary] = useState('');
  const [prospects, setProspects] = useState<DiscoveredItem[]>([]);
  const [citations, setCitations] = useState<SourceCitation[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  async function runDiscovery(e?: React.FormEvent, override?: {
    niche: string;
    location: string;
    role: string;
    mode: 'nextdoor_ads' | 'nextdoor_pages' | 'b2b_local';
  }) {
    if (e) e.preventDefault();
    const targetNiche = override?.niche ?? niche;
    const targetLocation = override?.location ?? location;
    const targetRole = override?.role ?? role;
    const targetMode = override?.mode ?? mode;

    if (!targetNiche.trim() || !targetLocation.trim()) {
      onNotify('Enter both an industry/niche and a city or neighborhood.', 'error');
      return;
    }

    setIsSearching(true);
    setSummary('');
    try {
      const res = await fetch('/api/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          niche: targetNiche,
          location: targetLocation,
          role: targetRole,
          mode: targetMode,
          limit,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Discovery search failed');
      const found = Array.isArray(data.prospects) ? (data.prospects as DiscoveredItem[]) : [];
      setProspects(found);
      setCitations(Array.isArray(data.citations) ? (data.citations as SourceCitation[]) : []);
      setSummary(data.searchSummary || '');
      setSelected(new Set(found.map((_, i) => i)));
      if (found.length === 0) {
        onNotify('No matching public businesses found. Try a wider metro area.', 'error');
      }
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Discovery failed', 'error');
    } finally {
      setIsSearching(false);
    }
  }

  async function handleSaveSelected() {
    const items = prospects.filter((_, i) => selected.has(i));
    if (items.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch('/api/leads/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceRepo: mode === 'b2b_local' ? 'web-grounding-discovery' : 'nextdoor-web-discovery',
          neighborhood: location,
          summary: `Discovered ${items.length} local business lead(s) for ${niche} in ${location}`,
          leads: items.map((item) => ({
            ...item,
            emailStatus: item.email ? 'unverified' : 'missing',
            source: mode === 'nextdoor_pages' ? 'nextdoor_page' : mode === 'nextdoor_ads' ? 'nextdoor_ad' : 'web_discovery',
            stage: 'new',
            citations: citations.slice(0, 4),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save prospects');
      await onLeadsImported();
      onNotify(
        `Added ${data.created?.length ?? 0} prospect(s) to Pipeline CRM${
          data.skippedDuplicates ? ` (${data.skippedDuplicates} already in CRM)` : ''
        }.`,
        'success'
      );
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to save leads', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          UK Lead Discovery Engine
        </h1>
        <p className="mt-1 text-sm text-slate-600 max-w-2xl">
          Search real United Kingdom local businesses, Nextdoor UK (<code className="font-mono text-xs">nextdoor.co.uk</code>)
          business pages, and active neighbourhood service advertisers.
        </p>
      </div>

      {/* Search Controls */}
      <form
        onSubmit={(e) => runDiscovery(e)}
        className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
          <div className="md:col-span-4">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Industry or Service Niche
            </label>
            <div className="relative">
              <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="e.g. Roofing, Boiler Engineers, Tree Surgery"
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
              />
            </div>
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              UK Town, City or Postcode
            </label>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Bristol, SW11, Manchester"
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
              />
            </div>
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Target Decision-Maker
            </label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Owner, Founder, Marketing Director"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Max Results
            </label>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
            >
              <option value={3}>3 leads</option>
              <option value={5}>5 leads</option>
              <option value={8}>8 leads</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4">
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            {(
              [
                ['nextdoor_ads', 'Nextdoor UK Ads & Offers'],
                ['nextdoor_pages', 'Nextdoor UK Business Pages'],
                ['b2b_local', 'UK Local B2B Directory'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setMode(key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  mode === key
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={isSearching}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isSearching ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Searching Live Listings...
              </>
            ) : (
              <>
                <Search className="h-3.5 w-3.5" />
                Find UK Leads
              </>
            )}
          </button>
        </div>

        {/* Quick Presets */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-xs">
          <span className="text-slate-400">Quick searches:</span>
          {QUICK_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                setNiche(preset.niche);
                setLocation(preset.location);
                setRole(preset.role);
                setMode(preset.mode);
                runDiscovery(undefined, preset);
              }}
              className="text-slate-600 hover:text-emerald-700 underline decoration-slate-300 underline-offset-4 transition-colors cursor-pointer"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </form>

      {/* Results Area */}
      {isSearching ? (
        <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
          {[1, 2, 3].map((row) => (
            <div key={row} className="p-5 flex items-center gap-4 animate-pulse">
              <div className="h-4 w-4 rounded bg-slate-200" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-56 rounded bg-slate-200" />
                <div className="h-3 w-96 rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      ) : prospects.length > 0 ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/60 px-5 py-3.5">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Discovered Prospects ({prospects.length})
                </h2>
                {summary && <p className="mt-0.5 text-xs text-slate-600">{summary}</p>}
              </div>
              <button
                type="button"
                onClick={handleSaveSelected}
                disabled={saving || selected.size === 0}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                Save {selected.size} to Pipeline CRM
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.size === prospects.length && prospects.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelected(new Set(prospects.map((_, i) => i)));
                          } else {
                            setSelected(new Set());
                          }
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-emerald-700 cursor-pointer"
                        aria-label="Select all discovered prospects"
                      />
                    </th>
                    <th className="px-4 py-3">Business & UK Neighbourhood</th>
                    <th className="px-4 py-3">Observed Listing / Offer</th>
                    <th className="px-4 py-3">Contact Details</th>
                    <th className="px-4 py-3 text-right">Links</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {prospects.map((item, idx) => {
                    const siteHref = safeExternalUrl(item.website);
                    const ndHref = safeExternalUrl(item.nextdoorUrl);
                    return (
                      <tr
                        key={`${item.companyName}-${idx}`}
                        className="hover:bg-slate-50/70 transition-colors align-top"
                      >
                        <td className="px-4 py-3.5">
                          <input
                            type="checkbox"
                            checked={selected.has(idx)}
                            onChange={() => {
                              setSelected((prev) => {
                                const next = new Set(prev);
                                if (next.has(idx)) next.delete(idx);
                                else next.add(idx);
                                return next;
                              });
                            }}
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-700 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3.5 max-w-[260px]">
                          <p className="font-semibold text-slate-900">{item.companyName}</p>
                          <p className="mt-0.5 text-slate-500">
                            {item.category} · {item.neighborhood}
                          </p>
                          {item.contactName && (
                            <p className="mt-1 text-slate-700">
                              {item.contactName} — {item.contactRole}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3.5 max-w-[340px]">
                          <p className="font-medium text-slate-900">{item.adHeadline}</p>
                          <p className="mt-0.5 text-slate-600 line-clamp-2">{item.adBody}</p>
                          <p className="mt-1 text-slate-500">
                            {item.adFormat} · {item.adOffer}
                          </p>
                        </td>
                        <td className="px-4 py-3.5 font-mono text-slate-700 space-y-1">
                          <div>{item.phone || <span className="text-slate-400 font-sans">Phone not listed</span>}</div>
                          <div>{item.email || <span className="text-slate-400 font-sans">Run Waterfall Enrichment</span>}</div>
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap space-x-3">
                          {ndHref && (
                            <a
                              href={ndHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-medium text-emerald-700 hover:underline"
                            >
                              Nextdoor
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          {siteHref && (
                            <a
                              href={siteHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-medium text-slate-700 hover:underline"
                            >
                              <Globe className="h-3 w-3" />
                              Site
                            </a>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Grounded Web Citations */}
          {citations.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-5 py-4">
              <h3 className="text-xs font-semibold text-slate-800">
                Verified Search Sources ({citations.length})
              </h3>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
                {citations.map((cite) => {
                  const href = safeExternalUrl(cite.url);
                  if (!href) return null;
                  return (
                    <a
                      key={href}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-slate-600 hover:text-emerald-700 underline decoration-slate-300 underline-offset-4 max-w-[300px] truncate"
                    >
                      <span className="truncate">{cite.title}</span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/40 px-6 py-12 text-center">
          <p className="text-sm font-medium text-slate-800">
            Ready to discover local businesses & Nextdoor advertisers
          </p>
          <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
            Enter a service niche and neighborhood above, or select one of the quick searches to run
            live grounded discovery with source links.
          </p>
        </div>
      )}
    </div>
  );
}
