import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileUp,
  FolderGit2,
  GitFork,
  Loader2,
  Play,
  Plus,
  Search,
  Star,
  Terminal,
  Upload,
  Webhook,
  X,
} from 'lucide-react';
import type { GithubRepoSummary, IngestLogEntry, Lead } from '../types/leads';
import {
  formatShortDate,
  generateScraperScript,
  safeExternalUrl,
  type ScriptBuilderConfig,
} from '../utils/format';

interface ParsedAdPreview {
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

interface NextdoorScraperViewProps {
  ingestLogs: IngestLogEntry[];
  onLeadsImported: () => Promise<void>;
  onNotify: (message: string, tone?: 'success' | 'error') => void;
}

const SAMPLE_NEXTDOOR_DUMP = `[
  {
    "feed_label": "S p o n s o r e d · Local Deal",
    "advertiser": "Avon Valley Tree Surgery Ltd",
    "neighborhood": "Cotham & Westbury Park (BS6)",
    "city": "Bristol, UK",
    "headline": "Autumn Crown Reduction & Stump Grinding — £125 Off Full Tree Work",
    "body": "NPTC-qualified arborists serving North Bristol postcodes. Free on-site quotation and green waste clearance. Call 0117 496 0183 or visit https://avonvalleytrees.example for fast booking. Contact: hello@avonvalleytrees.example",
    "nextdoor_page": "https://nextdoor.co.uk/pages/avon-valley-tree-surgery-bristol/"
  },
  {
    "feed_label": "Promoted by Local Business",
    "advertiser": "Surrey Clear Window & Gutter Services",
    "neighborhood": "Wimbledon & Raynes Park (SW20)",
    "city": "London, UK",
    "headline": "3-Bed Exterior Window + Gutter Vacuum Clear Bundle for £149",
    "body": "Over 60 neighbour recommendations across South West London. Owner-operated by Gareth Davies. Text 020 7946 0144 or book at https://surreyclearwindows.example before winter rainfall.",
    "nextdoor_page": "https://nextdoor.co.uk/pages/surrey-clear-windows-london/"
  },
  {
    "feed_label": "S p o n s o r e d",
    "advertiser": "Pennine Roller Garage Doors",
    "neighborhood": "Altrincham & Hale (WA14)",
    "city": "Manchester, UK",
    "headline": "Same-Day Garage Door Spring & Motor Repair — No Call-Out Charge",
    "body": "Local engineers stocked with insulated roller shutters and replacement cones & cables. Mention Nextdoor UK for £40 off servicing. Call 0161 496 0199 or email bookings@penninegaragedoors.example",
    "nextdoor_page": "https://nextdoor.co.uk/pages/pennine-roller-garage-doors-manchester/"
  }
]`;

export default function NextdoorScraperView({
  ingestLogs,
  onLeadsImported,
  onNotify,
}: NextdoorScraperViewProps) {
  const [subTab, setSubTab] = useState<'parser' | 'repos' | 'builder'>('parser');

  // Feed Parser state
  const [rawContent, setRawContent] = useState('');
  const [neighborhoodHint, setNeighborhoodHint] = useState('Clifton & Redland (BS8)');
  const [cityHint, setCityHint] = useState('Bristol, UK');
  const [sourceRepo, setSourceRepo] = useState('chanwooh/Nextdoor-Script');
  const [isParsing, setIsParsing] = useState(false);
  const [parseSummary, setParseSummary] = useState('');
  const [parsedAds, setParsedAds] = useState<ParsedAdPreview[]>([]);
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(new Set());
  const [isSavingParsed, setIsSavingParsed] = useState(false);

  // GitHub Repo Hub state
  const [curatedRepos, setCuratedRepos] = useState<GithubRepoSummary[]>([]);
  const [searchResults, setSearchResults] = useState<GithubRepoSummary[] | null>(null);
  const [repoQuery, setRepoQuery] = useState('nextdoor scraper');
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [searchingRepos, setSearchingRepos] = useState(false);
  const [rateLimitedNotice, setRateLimitedNotice] = useState(false);
  const [readmeModal, setReadmeModal] = useState<{
    repo: GithubRepoSummary;
    content: string;
    loading: boolean;
    error: string;
  } | null>(null);

  // Script & Webhook Builder state
  const [scriptConfig, setScriptConfig] = useState<ScriptBuilderConfig>(() => ({
    runtime: 'python_playwright',
    targetMode: 'sponsored_ads',
    neighborhood: 'Clifton & Redland (BS8)',
    city: 'Bristol, UK',
    keywords: 'roofing, boiler, landscaping, dental, solar',
    maxScrolls: 12,
    sourceRepo: 'chanwooh/Nextdoor-Script',
    webhookUrl:
      typeof window !== 'undefined'
        ? `${window.location.origin}/api/ingest/nextdoor`
        : 'http://localhost:3000/api/ingest/nextdoor',
  }));
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadingRepos(true);
    fetch('/api/scraper/github/curated')
      .then((res) => res.json())
      .then((data) => {
        if (active && Array.isArray(data.repos)) {
          setCuratedRepos(data.repos);
        }
      })
      .catch(() => {
        // handled silently via fallback state
      })
      .finally(() => {
        if (active) setLoadingRepos(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const generatedScript = useMemo(() => generateScraperScript(scriptConfig), [scriptConfig]);

  async function handleParseFeed(e: React.FormEvent) {
    e.preventDefault();
    if (rawContent.trim().length < 15) {
      onNotify('Paste scraped Nextdoor JSON, HTML, or feed text first.', 'error');
      return;
    }
    setIsParsing(true);
    setParseSummary('');
    try {
      const res = await fetch('/api/scraper/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawContent,
          neighborhoodHint,
          cityHint,
          sourceRepo,
          autoSave: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Unable to parse payload');
      }
      const list = Array.isArray(data.extracted) ? (data.extracted as ParsedAdPreview[]) : [];
      setParsedAds(list);
      setSelectedIndexes(new Set(list.map((_, i) => i)));
      setParseSummary(data.summary || `Extracted ${list.length} advertiser records.`);
      if (list.length === 0) {
        onNotify('No advertiser or business entries were detected in that snippet.', 'error');
      }
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Parsing failed', 'error');
    } finally {
      setIsParsing(false);
    }
  }

  async function handleSaveParsedLeads() {
    const chosen = parsedAds.filter((_, idx) => selectedIndexes.has(idx));
    if (chosen.length === 0) return;
    setIsSavingParsed(true);
    try {
      const res = await fetch('/api/leads/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceRepo,
          neighborhood: neighborhoodHint || cityHint,
          summary: `Imported ${chosen.length} parsed Nextdoor ad lead(s) from ${sourceRepo}`,
          leads: chosen.map((item) => ({
            ...item,
            emailStatus: item.email ? 'unverified' : 'missing',
            source: 'nextdoor_ad',
            sourceRepo,
            stage: 'new',
            citations: [],
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save leads');
      await onLeadsImported();
      onNotify(
        `Saved ${data.created?.length ?? 0} lead(s) to Pipeline CRM${
          data.skippedDuplicates ? ` (${data.skippedDuplicates} duplicate skipped)` : ''
        }.`,
        'success'
      );
      setParsedAds([]);
      setSelectedIndexes(new Set());
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Save failed', 'error');
    } finally {
      setIsSavingParsed(false);
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      setRawContent(text.slice(0, 58000));
      onNotify(`Loaded ${file.name} (${text.length.toLocaleString()} chars). Click Parse Nextdoor Feed to extract.`, 'success');
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  async function handleSearchGithub(e: React.FormEvent) {
    e.preventDefault();
    setSearchingRepos(true);
    setRateLimitedNotice(false);
    try {
      const res = await fetch(
        `/api/scraper/github/search?q=${encodeURIComponent(repoQuery.trim() || 'nextdoor scraper')}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'GitHub search failed');
      if (data.rateLimited) {
        setRateLimitedNotice(true);
        setSearchResults(null);
      } else {
        setSearchResults(Array.isArray(data.repos) ? data.repos : []);
      }
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'GitHub search error', 'error');
    } finally {
      setSearchingRepos(false);
    }
  }

  async function openReadme(repo: GithubRepoSummary) {
    setReadmeModal({ repo, content: '', loading: true, error: '' });
    try {
      const res = await fetch(
        `/api/scraper/github/readme?owner=${encodeURIComponent(repo.owner)}&repo=${encodeURIComponent(repo.name)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'README unavailable');
      setReadmeModal({ repo, content: data.content || 'Empty README', loading: false, error: '' });
    } catch (err) {
      setReadmeModal({
        repo,
        content: '',
        loading: false,
        error: err instanceof Error ? err.message : 'Unable to fetch README',
      });
    }
  }

  function adoptRepoInBuilder(repo: GithubRepoSummary) {
    setSourceRepo(repo.fullName);
    setScriptConfig((prev) => ({
      ...prev,
      sourceRepo: repo.fullName,
      runtime:
        repo.language.toLowerCase().includes('javascript') ||
        repo.language.toLowerCase().includes('typescript')
          ? 'node_playwright'
          : repo.name.toLowerCase().includes('script')
            ? 'python_selenium'
            : 'python_playwright',
      targetMode:
        repo.category === 'Business Directory' ? 'business_directory' : 'sponsored_ads',
    }));
    setSubTab('builder');
    onNotify(`Configured Script Builder using ${repo.fullName} pattern.`, 'success');
  }

  async function handleCopyScript() {
    await navigator.clipboard.writeText(generatedScript.code);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 1800);
  }

  function handleDownloadScript() {
    const blob = new Blob([generatedScript.code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = generatedScript.filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleTestWebhook() {
    setTestingWebhook(true);
    try {
      const res = await fetch('/api/ingest/nextdoor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceRepo: scriptConfig.sourceRepo,
          neighborhood: scriptConfig.neighborhood,
          city: scriptConfig.city,
          records: [
            {
              companyName: `Severn Exterior Decorating (${scriptConfig.neighborhood.split('&')[0].trim()})`,
              category: 'Exterior Painting & Decorating',
              neighborhood: scriptConfig.neighborhood,
              city: scriptConfig.city,
              phone: '0117 496 0169',
              website: 'https://severndecorating.example',
              nextdoorUrl: 'https://nextdoor.co.uk/pages/severn-exterior-decorating/',
              adHeadline: 'Masonry & Sash Window Repainting — 10% Neighbour Discount This Month',
              adBody:
                'Local 5-star UK decorators booking exterior jobs across the postcode. Fully insured with a 5-year workmanship guarantee.',
              adOffer: '10% neighbour discount on exterior bookings',
              adFormat: 'Sponsored Post',
            },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Webhook test failed');
      await onLeadsImported();
      onNotify(
        data.ingested > 0
          ? `Webhook verified: ingested ${data.ingested} record into Pipeline CRM.`
          : 'Webhook reachable (record already exists in CRM).',
        'success'
      );
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Webhook test failed', 'error');
    } finally {
      setTestingWebhook(false);
    }
  }

  const displayedRepos = searchResults ?? curatedRepos;

  return (
    <div className="space-y-6">
      {/* Sub-navigation bar */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Nextdoor Ad & Business Scraper
          </h1>
          <p className="mt-1 text-sm text-slate-600 max-w-2xl">
            Connect open-source GitHub Nextdoor scraper repositories, generate ready-to-run browser
            automation scripts, and parse sponsored feed exports straight into your lead pipeline.
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 self-start">
          <button
            type="button"
            onClick={() => setSubTab('parser')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              subTab === 'parser'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Feed & Export Parser
          </button>
          <button
            type="button"
            onClick={() => setSubTab('repos')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              subTab === 'repos'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            GitHub Scraper Repos
          </button>
          <button
            type="button"
            onClick={() => setSubTab('builder')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              subTab === 'builder'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Script & Webhook Builder
          </button>
        </div>
      </div>

      {/* TAB 1: FEED & EXPORT PARSER */}
      {subTab === 'parser' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <form onSubmit={handleParseFeed} className="xl:col-span-7 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Parse Scraped Nextdoor Ads or Feed Exports
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Accepts JSON from GitHub scrapers, raw DOM HTML, HAR excerpts, or copied
                    sponsored feed posts.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRawContent(SAMPLE_NEXTDOOR_DUMP)}
                    className="px-3 py-1.5 text-xs font-medium text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100/80 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Load Sample Dump
                  </button>
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0">
                    <FileUp className="h-3.5 w-3.5" />
                    Upload JSON / TXT
                    <input
                      type="file"
                      accept=".json,.txt,.html,.csv,.har"
                      onChange={handleFileUpload}
                      className="sr-only"
                    />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Source GitHub Repo
                  </label>
                  <input
                    type="text"
                    value={sourceRepo}
                    onChange={(e) => setSourceRepo(e.target.value)}
                    placeholder="chanwooh/Nextdoor-Script"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Default UK Neighbourhood / Postcode
                  </label>
                  <input
                    type="text"
                    value={neighborhoodHint}
                    onChange={(e) => setNeighborhoodHint(e.target.value)}
                    placeholder="Clifton & Redland (BS8)"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Default UK Town / City
                  </label>
                  <input
                    type="text"
                    value={cityHint}
                    onChange={(e) => setCityHint(e.target.value)}
                    placeholder="Bristol, UK"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Raw Nextdoor Output (JSON, HTML, or Feed Text)
                </label>
                <textarea
                  rows={10}
                  value={rawContent}
                  onChange={(e) => setRawContent(e.target.value)}
                  placeholder='Paste exported JSON from Nextdoor-Script, copied sponsored posts (including obfuscated "S p o n s o r e d" blocks), or raw HTML...'
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/50 p-3 font-mono text-xs leading-relaxed text-slate-800 focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-slate-500 tabular-nums">
                  {rawContent.length.toLocaleString()} characters ready
                </span>
                <button
                  type="submit"
                  disabled={isParsing || rawContent.trim().length < 15}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {isParsing ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Extracting Advertisers...
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5" />
                      Parse Nextdoor Feed
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Parsed Extraction Results */}
            {parsedAds.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5 bg-slate-50/60">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Extracted Nextdoor Advertisers ({parsedAds.length})
                    </h3>
                    {parseSummary && (
                      <p className="text-xs text-slate-500 mt-0.5">{parseSummary}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveParsedLeads}
                    disabled={isSavingParsed || selectedIndexes.size === 0}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {isSavingParsed ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    Import {selectedIndexes.size} to Pipeline CRM
                  </button>
                </div>

                <div className="divide-y divide-slate-100">
                  {parsedAds.map((item, idx) => {
                    const checked = selectedIndexes.has(idx);
                    return (
                      <div
                        key={`${item.companyName}-${idx}`}
                        className="flex items-start gap-3.5 px-5 py-4 hover:bg-slate-50/70 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setSelectedIndexes((prev) => {
                              const next = new Set(prev);
                              if (next.has(idx)) next.delete(idx);
                              else next.add(idx);
                              return next;
                            });
                          }}
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600 cursor-pointer"
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-900">
                              {item.companyName}
                            </p>
                            <span className="text-xs text-slate-500">
                              {item.adFormat} · {item.neighborhood}, {item.city}
                            </span>
                          </div>
                          <p className="text-xs font-medium text-emerald-800">
                            {item.adHeadline}
                          </p>
                          <p className="text-xs text-slate-600 line-clamp-2">{item.adBody}</p>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 text-xs text-slate-500">
                            <span>{item.category}</span>
                            {item.phone && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono tabular-nums">{item.phone}</span>
                              </>
                            )}
                            {item.email && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono">{item.email}</span>
                              </>
                            )}
                            {item.adOffer && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>Offer: {item.adOffer}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </form>

          {/* Right Column: Ingestion History & Webhook Reference */}
          <div className="xl:col-span-5 space-y-5">
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">
                  Live Scraper Webhook Endpoint
                </h2>
                <button
                  type="button"
                  onClick={handleTestWebhook}
                  disabled={testingWebhook}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:text-emerald-800 cursor-pointer whitespace-nowrap shrink-0"
                >
                  {testingWebhook ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Webhook className="h-3.5 w-3.5" />
                  )}
                  Send Test Record
                </button>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Point any locally running GitHub scraper (Python Selenium, Playwright, or Meltano
                tap) directly at this POST endpoint to stream scraped Nextdoor ads into your CRM.
              </p>
              <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <code className="truncate font-mono text-xs text-slate-800">
                  POST {scriptConfig.webhookUrl}
                </code>
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(scriptConfig.webhookUrl);
                    setCopiedWebhook(true);
                    setTimeout(() => setCopiedWebhook(false), 1800);
                  }}
                  className="text-slate-500 hover:text-slate-900 p-1 cursor-pointer shrink-0"
                  aria-label="Copy webhook URL"
                >
                  {copiedWebhook ? (
                    <Check className="h-3.5 w-3.5 text-emerald-700" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="border-b border-slate-200 px-5 py-3.5">
                <h2 className="text-sm font-semibold text-slate-900">Recent Scraper Ingests</h2>
              </div>
              {ingestLogs.length === 0 ? (
                <div className="px-5 py-8 text-center text-xs text-slate-500">
                  No scraper imports logged yet. Parse a feed dump or trigger the webhook.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {ingestLogs.slice(0, 8).map((entry) => (
                    <div key={entry.id} className="px-5 py-3.5 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-medium text-slate-900 truncate">
                          {entry.sourceRepo}
                        </span>
                        <span className="text-xs text-slate-500 tabular-nums shrink-0">
                          {entry.recordsParsed} lead{entry.recordsParsed === 1 ? '' : 's'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">{entry.summary}</p>
                      <p className="text-xs text-slate-400">
                        {entry.neighborhood} · {formatShortDate(entry.receivedAt)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: GITHUB SCRAPER REPO HUB */}
      {subTab === 'repos' && (
        <div className="space-y-5">
          <form
            onSubmit={handleSearchGithub}
            className="flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={repoQuery}
                onChange={(e) => setRepoQuery(e.target.value)}
                placeholder="Search GitHub repositories (e.g. nextdoor ads scraper, nextdoor selenium, nextdoor business)"
                className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={searchingRepos}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {searchingRepos ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Search className="h-3.5 w-3.5" />
                )}
                Search GitHub
              </button>
              {searchResults && (
                <button
                  type="button"
                  onClick={() => setSearchResults(null)}
                  className="rounded-lg border border-slate-200 px-3.5 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Reset to Curated
                </button>
              )}
            </div>
          </form>

          {rateLimitedNotice && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
              GitHub unauthenticated search rate limit reached. Showing curated Nextdoor scraping
              repositories below — add an optional <code className="font-mono">GITHUB_TOKEN</code>{' '}
              secret for higher live search limits.
            </div>
          )}

          {loadingRepos && displayedRepos.length === 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="h-44 rounded-xl border border-slate-200 bg-slate-50 animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {displayedRepos.map((repo) => {
                const safeHref = safeExternalUrl(repo.htmlUrl);
                return (
                  <div
                    key={repo.fullName}
                    className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs text-slate-500">
                            {repo.category} · {repo.language}
                            {repo.license && repo.license !== 'NOASSERTION'
                              ? ` · ${repo.license}`
                              : ''}
                          </p>
                          <h3 className="mt-0.5 truncate font-mono text-sm font-semibold text-slate-900">
                            {repo.fullName}
                          </h3>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 tabular-nums shrink-0">
                          <span className="inline-flex items-center gap-1">
                            <Star className="h-3.5 w-3.5 text-slate-400" />
                            {repo.stars.toLocaleString()}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <GitFork className="h-3.5 w-3.5 text-slate-400" />
                            {repo.forks.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs leading-relaxed text-slate-600">{repo.description}</p>
                      <p className="text-xs leading-relaxed text-emerald-800/90">
                        {repo.integrationNote}
                      </p>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3.5">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => openReadme(repo)}
                          className="text-xs font-medium text-slate-700 hover:text-slate-950 underline decoration-slate-300 underline-offset-4 cursor-pointer whitespace-nowrap"
                        >
                          Inspect README
                        </button>
                        {safeHref && (
                          <a
                            href={safeHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap"
                          >
                            GitHub
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => adoptRepoInBuilder(repo)}
                        className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Code2 className="h-3.5 w-3.5" />
                        Use in Script Builder
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SCRIPT & WEBHOOK BUILDER */}
      {subTab === 'builder' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="xl:col-span-4 rounded-xl border border-slate-200 bg-white p-5 space-y-4 self-start">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Scraper Configuration</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Customize target neighborhood, keywords, and automation runtime. Outputs push
                directly into FynderGrid.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Automation Runtime
                </label>
                <select
                  value={scriptConfig.runtime}
                  onChange={(e) =>
                    setScriptConfig((prev) => ({
                      ...prev,
                      runtime: e.target.value as ScriptBuilderConfig['runtime'],
                    }))
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
                >
                  <option value="python_playwright">Python + Playwright (Recommended)</option>
                  <option value="python_selenium">Python + Selenium (Nextdoor-Script)</option>
                  <option value="node_playwright">Node.js + Playwright (.mjs)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Target Surface
                </label>
                <select
                  value={scriptConfig.targetMode}
                  onChange={(e) =>
                    setScriptConfig((prev) => ({
                      ...prev,
                      targetMode: e.target.value as ScriptBuilderConfig['targetMode'],
                    }))
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
                >
                  <option value="sponsored_ads">Sponsored Feed Ads & Local Deals</option>
                  <option value="business_directory">Nextdoor Business Directory Pages</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Reference GitHub Repository
                </label>
                <input
                  type="text"
                  value={scriptConfig.sourceRepo}
                  onChange={(e) =>
                    setScriptConfig((prev) => ({ ...prev, sourceRepo: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    UK Neighbourhood / Postcode
                  </label>
                  <input
                    type="text"
                    value={scriptConfig.neighborhood}
                    onChange={(e) =>
                      setScriptConfig((prev) => ({ ...prev, neighborhood: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">UK Town / City</label>
                  <input
                    type="text"
                    value={scriptConfig.city}
                    onChange={(e) =>
                      setScriptConfig((prev) => ({ ...prev, city: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Category Keywords (comma-separated)
                </label>
                <input
                  type="text"
                  value={scriptConfig.keywords}
                  onChange={(e) =>
                    setScriptConfig((prev) => ({ ...prev, keywords: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Feed Scroll Passes ({scriptConfig.maxScrolls})
                </label>
                <input
                  type="range"
                  min={3}
                  max={40}
                  value={scriptConfig.maxScrolls}
                  onChange={(e) =>
                    setScriptConfig((prev) => ({
                      ...prev,
                      maxScrolls: Number(e.target.value),
                    }))
                  }
                  className="w-full accent-emerald-700 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  FynderGrid Ingest Webhook URL
                </label>
                <input
                  type="text"
                  value={scriptConfig.webhookUrl}
                  onChange={(e) =>
                    setScriptConfig((prev) => ({ ...prev, webhookUrl: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="xl:col-span-8 rounded-xl border border-slate-200 bg-slate-950 text-slate-100 overflow-hidden flex flex-col">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-5 py-3">
              <div className="flex items-center gap-2 min-w-0">
                <Terminal className="h-4 w-4 text-emerald-400 shrink-0" />
                <span className="font-mono text-xs font-medium text-slate-100 truncate">
                  {generatedScript.filename}
                </span>
                <span className="text-xs text-slate-400 hidden sm:inline">
                  · {generatedScript.language}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyScript}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {copiedScript ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Copy Script
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadScript}
                  className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </button>
              </div>
            </div>
            <pre className="flex-1 overflow-auto p-5 font-mono text-xs leading-relaxed text-slate-200 max-h-[560px]">
              <code>{generatedScript.code}</code>
            </pre>
          </div>
        </div>
      )}

      {/* README Inspector Modal */}
      {readmeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setReadmeModal(null)}
        >
          <div
            className="flex max-h-[82vh] w-full max-w-2xl flex-col rounded-xl border border-slate-200 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-2 min-w-0">
                <FolderGit2 className="h-4 w-4 text-emerald-700 shrink-0" />
                <h3 className="truncate font-mono text-sm font-semibold text-slate-900">
                  {readmeModal.repo.fullName} — README
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReadmeModal(null)}
                className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
                aria-label="Close README preview"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {readmeModal.loading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-xs text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Fetching README from GitHub...
                </div>
              ) : readmeModal.error ? (
                <div className="space-y-3 py-6 text-center">
                  <p className="text-xs text-slate-600">{readmeModal.error}</p>
                  {safeExternalUrl(readmeModal.repo.htmlUrl) && (
                    <a
                      href={safeExternalUrl(readmeModal.repo.htmlUrl)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:underline"
                    >
                      Open repository on GitHub
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              ) : (
                <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-slate-700">
                  {readmeModal.content}
                </pre>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
              <button
                type="button"
                onClick={() => {
                  const target = readmeModal.repo;
                  setReadmeModal(null);
                  adoptRepoInBuilder(target);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 cursor-pointer"
              >
                <Upload className="h-3.5 w-3.5" />
                Load Repo in Script Builder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
