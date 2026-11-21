import React, { useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  Copy,
  Terminal,
} from 'lucide-react';

type JumpTarget = 'scraper' | 'discovery' | 'crm' | 'enrichment' | 'outreach';

interface HelpGuideViewProps {
  onNavigate: (section: JumpTarget) => void;
}

const WORKFLOW_STEPS: Array<{
  num: string;
  title: string;
  summary: string;
  details: string[];
  actionLabel: string;
  target: JumpTarget;
}> = [
  {
    num: '01',
    title: 'Auto-Scrape Public Nextdoor UK Listings',
    summary:
      'Pull public UK business pages from nextdoor.co.uk/pages automatically by postcode, town, or trade niche.',
    details: [
      'Open Nextdoor Ad Scraper -> Auto-Scraper (UK).',
      'Enter a UK postcode or town (for example: Bristol BS8, Wimbledon SW19, or Leeds) and a trade category (for example: Roofing Contractors or Boiler & Heating Engineers).',
      'Click Auto-Scrape UK for an immediate run, or create a Scheduled UK Postcode Monitor and click Enable Schedule to scan automatically every 1, 6, 12, or 24 hours.',
      'Net-new businesses are deduplicated automatically and saved straight into Pipeline CRM.',
    ],
    actionLabel: 'Open Auto-Scraper (UK)',
    target: 'scraper',
  },
  {
    num: '02',
    title: 'Capture Logged-In Nextdoor UK Sponsored Ads',
    summary:
      'Use open-source GitHub scraper patterns locally to harvest in-feed Sponsored posts and Local Deals behind Nextdoor UK sign-in.',
    details: [
      'Browse curated repositories in GitHub Scraper Repos (such as chanwooh/Nextdoor-Script, krautsdubisq1g/nextdoor-business-scraper, and DrBenedictPorkins/sponsored-blur-nextdoor) and click Use in Script Builder.',
      'Download the ready-to-run Python Playwright, Python Selenium, or Node.js script from Script & Webhook Builder.',
      'Run the script on your own computer while signed in to nextdoor.co.uk — it detects obfuscated Sponsored cards and POSTs captured ads straight to your FynderGrid /api/ingest/nextdoor webhook.',
      'Alternatively, upload or paste any exported JSON, HTML, or copied feed text into Feed & Export Parser to extract structured advertisers.',
    ],
    actionLabel: 'Open Script & Parser',
    target: 'scraper',
  },
  {
    num: '03',
    title: 'Run Targeted UK Lead Discovery',
    summary:
      'Search across UK directories and Nextdoor UK listings by industry, postcode area, and decision-maker role.',
    details: [
      'Open Lead Discovery and pick Nextdoor UK Ads & Offers, Nextdoor UK Business Pages, or UK Local B2B Directory.',
      'Use quick UK presets or type your own town, postcode, and niche to retrieve grounded business listings with clickable source links.',
      'Tick the prospects you want and click Save to Pipeline CRM.',
    ],
    actionLabel: 'Open Lead Discovery',
    target: 'discovery',
  },
  {
    num: '04',
    title: 'Verify Contacts with Waterfall Enrichment',
    summary:
      'Turn raw scraped business cards into outreach-ready records using a 3-stage enrichment waterfall.',
    details: [
      'Stage 1 resolves the official UK business domain (.co.uk / .uk / .com) and public web footprint.',
      'Stage 2 extracts publicly listed directors, owners, UK phone numbers, and business email addresses without inventing private addresses.',
      'Stage 3 runs a live DNS MX lookup on the domain so you know whether mail servers are active before sending.',
    ],
    actionLabel: 'Open Waterfall Enrichment',
    target: 'enrichment',
  },
  {
    num: '05',
    title: 'Manage Pipeline CRM & Send Ad-Aware Outreach',
    summary:
      'Track every UK lead from capture to qualified deal and write personalised outreach referencing their actual Nextdoor UK offer.',
    details: [
      'Click any row in Pipeline CRM to inspect captured ad copy, enrichment audit traces, verified links, and account notes.',
      'Use Export CSV in the top bar anytime to download a spreadsheet-safe UK lead export.',
      'Open Outreach Sequences to manage multi-step campaigns or generate a tailored Cold Email, Nextdoor DM, or LinkedIn draft referencing the prospect’s neighbourhood and offer.',
    ],
    actionLabel: 'Open Outreach Sequences',
    target: 'outreach',
  },
];

const FAQ_ITEMS: Array<{ question: string; answer: string }> = [
  {
    question: 'Why does the Auto-Scraper target nextdoor.co.uk/pages instead of my private news feed?',
    answer:
      'Nextdoor UK locks private neighbourhood news feeds and in-feed Sponsored ads behind verified UK address login, browser cookies, and anti-bot checks. Public business directory pages (nextdoor.co.uk/pages) are publicly indexed and can be scraped automatically on the server. To capture logged-in Sponsored feed ads automatically, download your configured Python or Node script from Script & Webhook Builder and run it locally — it streams results directly into FynderGrid via /api/ingest/nextdoor.',
  },
  {
    question: 'Will scheduled UK postcode monitors create duplicate leads in my CRM?',
    answer:
      'No. Every auto-scrape run, feed parser import, and webhook push checks each incoming business against existing CRM records by normalised company name and UK town/city. Existing businesses are automatically skipped and counted as duplicates in the run summary.',
  },
  {
    question: 'What do MX Verified, Pattern Match, Unverified, and Missing mean?',
    answer:
      'MX Verified means Waterfall Enrichment confirmed live DNS MX mail exchanger records on the business domain alongside a public email address. Pattern Match indicates a role-based address format (such as reception@ or info@) not yet DNS-checked. Unverified means an email was scraped or entered but has not been run through the waterfall yet. Missing means no public email was found yet — run Waterfall Enrichment to search for one.',
  },
  {
    question: 'How do I test the webhook endpoint before running a local Python scraper?',
    answer:
      'Open Nextdoor Ad Scraper -> Feed & Export Parser and click Send Test Record in the Live Scraper Webhook Endpoint card on the right. That sends a real POST request to /api/ingest/nextdoor and inserts a sample UK advertiser straight into your Pipeline CRM and Recent Scraper Ingests log.',
  },
  {
    question: 'Can I add optional GitHub authentication if GitHub search hits a rate limit?',
    answer:
      'Yes. Public GitHub repository lookups work without a token, but GitHub limits unauthenticated search requests per hour. If you browse heavily, add a personal access token as GITHUB_TOKEN in your environment secrets to raise the limit.',
  },
];

export default function HelpGuideView({ onNavigate }: HelpGuideViewProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

  const cliSnippets = [
    {
      id: 'playwright',
      title: 'Run Downloaded Python Playwright Script (Recommended)',
      cmd: `pip install playwright requests && playwright install chromium\nNEXTDOOR_EMAIL="you@domain.co.uk" NEXTDOOR_PASS="your-password" python nextdoor_uk_playwright_scraper.py`,
    },
    {
      id: 'selenium',
      title: 'Run Downloaded Python Selenium Script (Nextdoor-Script pattern)',
      cmd: `pip install selenium requests\nNEXTDOOR_EMAIL="you@domain.co.uk" NEXTDOOR_PASS="your-password" python nextdoor_uk_selenium_scraper.py`,
    },
    {
      id: 'curl',
      title: 'Push Custom Scraped UK Ads via Webhook (cURL)',
      cmd: `curl -X POST "${origin}/api/ingest/nextdoor" \\\n  -H "Content-Type: application/json" \\\n  -d '{"sourceRepo":"custom-uk-script","neighborhood":"Clifton (BS8)","city":"Bristol, UK","records":[{"companyName":"Clifton Slate Roofing Ltd","category":"Roofing","phone":"0117 496 0112","adHeadline":"Free Roof Survey in BS8","adOffer":"Free inspection","adFormat":"Sponsored Post"}]}'`,
    },
  ];

  async function copyCommand(id: string, cmd: string) {
    await navigator.clipboard.writeText(cmd);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 1800);
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Help & How to Use FynderGrid UK
        </h1>
        <p className="mt-1 text-sm text-slate-600 max-w-2xl">
          Step-by-step guide to scraping UK leads from{' '}
          <code className="font-mono text-xs">nextdoor.co.uk</code>, connecting GitHub scraper
          scripts, running waterfall MX enrichment, and launching personalised outreach.
        </p>
      </div>

      {/* Step-by-Step Workflow */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-slate-900">
          Quick-Start Workflow (5 Steps)
        </h2>

        <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {WORKFLOW_STEPS.map((step) => (
            <div
              key={step.num}
              className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between"
            >
              <div className="space-y-2 max-w-3xl">
                <div className="flex items-baseline gap-2.5">
                  <span className="font-mono text-xs font-semibold text-emerald-700 tabular-nums">
                    {step.num}.
                  </span>
                  <h3 className="text-sm font-semibold text-slate-900">{step.title}</h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{step.summary}</p>
                <ul className="space-y-1.5 pt-1 text-xs text-slate-700 list-disc pl-5">
                  {step.details.map((line, i) => (
                    <li key={i} className="leading-relaxed">
                      {line}
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                onClick={() => onNavigate(step.target)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:border-emerald-600 hover:text-emerald-800 transition-colors whitespace-nowrap shrink-0 self-start cursor-pointer"
              >
                {step.actionLabel}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Scraping Mode Comparison */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-900">
          Which Nextdoor UK Scraping Method Should I Use?
        </h2>
        <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 font-medium text-slate-500">
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Target Surface</th>
                <th className="px-4 py-3">Nextdoor Login Needed?</th>
                <th className="px-4 py-3">Best For</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              <tr>
                <td className="px-4 py-3.5 font-semibold text-slate-900 whitespace-nowrap">
                  Auto-Scraper (UK)
                </td>
                <td className="px-4 py-3.5 font-mono text-slate-600">
                  nextdoor.co.uk/pages/
                </td>
                <td className="px-4 py-3.5 text-emerald-700 font-medium">
                  No — runs automatically here
                </td>
                <td className="px-4 py-3.5">
                  Hands-free UK postcode monitoring, public business directory pages, and scheduled
                  lead capture.
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3.5 font-semibold text-slate-900 whitespace-nowrap">
                  Script & Webhook Builder
                </td>
                <td className="px-4 py-3.5 font-mono text-slate-600">
                  nextdoor.co.uk/news_feed/
                </td>
                <td className="px-4 py-3.5 text-slate-800 font-medium">
                  Yes — runs on your local machine
                </td>
                <td className="px-4 py-3.5">
                  Capturing paid in-feed Sponsored ads and Local Deals visible inside your UK
                  neighbourhood feed.
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3.5 font-semibold text-slate-900 whitespace-nowrap">
                  Feed & Export Parser
                </td>
                <td className="px-4 py-3.5 font-mono text-slate-600">
                  JSON / HTML / HAR / Text
                </td>
                <td className="px-4 py-3.5 text-slate-600">No — paste or upload file</td>
                <td className="px-4 py-3.5">
                  Converting raw output from any GitHub Nextdoor scraper repository or copied feed
                  posts into clean CRM rows.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Local Script & Webhook Commands */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-900">
          Local Scraper & Webhook Commands
        </h2>
        <div className="space-y-3">
          {cliSnippets.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-slate-200 bg-slate-950 text-slate-100 overflow-hidden"
            >
              <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-2.5">
                <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-200">
                  <Terminal className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  {item.title}
                </span>
                <button
                  type="button"
                  onClick={() => copyCommand(item.id, item.cmd)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-800 cursor-pointer whitespace-nowrap shrink-0"
                >
                  {copiedCmd === item.id ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-400" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      Copy
                    </>
                  )}
                </button>
              </div>
              <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-slate-200">
                <code>{item.cmd}</code>
              </pre>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ Accordion */}
      <section className="space-y-3 pb-4">
        <h2 className="text-base font-semibold text-slate-900">
          Frequently Asked Questions
        </h2>
        <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {FAQ_ITEMS.map((item, idx) => {
            const expanded = openFaq === idx;
            return (
              <div key={item.question}>
                <button
                  type="button"
                  onClick={() => setOpenFaq(expanded ? null : idx)}
                  aria-expanded={expanded}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50/70 transition-colors cursor-pointer"
                >
                  <span className="text-sm font-medium text-slate-900">{item.question}</span>
                  <ChevronDown
                    className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${
                      expanded ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {expanded && (
                  <div className="px-5 pb-4 text-xs leading-relaxed text-slate-600 max-w-3xl">
                    {item.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
