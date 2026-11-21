import dns from 'dns/promises';
import { GoogleGenAI, Type } from '@google/genai';
import type {
  EnrichmentStepResult,
  Lead,
  SourceCitation,
} from '../src/types/leads.ts';

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Add it in Settings > Secrets to run live discovery, parsing, and enrichment.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function extractGroundingCitations(response: {
  candidates?: Array<{
    groundingMetadata?: {
      groundingChunks?: Array<{
        web?: { uri?: string; title?: string };
      }>;
    };
  }>;
}): SourceCitation[] {
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const seen = new Set<string>();
  const citations: SourceCitation[] = [];
  for (const chunk of chunks) {
    const uri = chunk.web?.uri;
    const title = chunk.web?.title;
    if (uri && (uri.startsWith('https://') || uri.startsWith('http://')) && !seen.has(uri)) {
      seen.add(uri);
      citations.push({
        title: title || uri,
        url: uri,
      });
    }
  }
  return citations.slice(0, 12);
}

function parseJsonSafely<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
}

export interface DiscoverParams {
  niche: string;
  location: string;
  role: string;
  mode: 'nextdoor_ads' | 'nextdoor_pages' | 'b2b_local';
  limit: number;
}

export interface DiscoveredProspect {
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
  adFormat: 'Sponsored Post' | 'Local Deal' | 'Business Page' | 'Neighborhood Banner' | 'Directory Listing';
  notes: string;
}

export async function discoverProspects(params: DiscoverParams): Promise<{
  prospects: DiscoveredProspect[];
  citations: SourceCitation[];
  searchSummary: string;
}> {
  const ai = getClient();

  const ukLocation = /uk|united kingdom|england|scotland|wales|northern ireland/i.test(params.location)
    ? params.location
    : `${params.location}, United Kingdom`;

  const focusDirective =
    params.mode === 'nextdoor_ads'
      ? `Focus strictly on real United Kingdom businesses in ${ukLocation} active on Nextdoor UK (nextdoor.co.uk/pages) or running local UK neighbourhood promotions/offers in GBP (£) within the ${params.niche} category. Exclude all non-UK and US businesses.`
      : params.mode === 'nextdoor_pages'
        ? `Search strictly for UK Nextdoor business directory pages (site:nextdoor.co.uk/pages) for ${params.niche} in ${ukLocation}. Exclude all non-UK and US listings.`
        : `Search strictly for real United Kingdom B2B and local service businesses in ${ukLocation} within ${params.niche} where the target decision-maker role is ${params.role || 'Director / Owner'}. Exclude all non-UK and US businesses.`;

  // Step 1: Grounded web search using googleSearch tool
  const groundedResponse = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Find up to ${params.limit} real UNITED KINGDOM (UK) ONLY businesses matching these prospecting criteria:
- Country: United Kingdom ONLY (reject any US, Canadian, or non-UK businesses)
- Industry / Niche: ${params.niche}
- UK Town / City / Postcode: ${ukLocation}
- Target Decision-Maker Role: ${params.role || 'Director / Owner'}
- Mode: ${focusDirective}

For each real UK business found via search, collect ONLY factually verified details found in search results:
1. Exact UK business name
2. Public director/owner/founder name if publicly listed (otherwise leave blank)
3. UK Neighbourhood / Postcode area & UK Town/City
4. Public website URL (.co.uk / .uk / .com) and Nextdoor UK page URL (nextdoor.co.uk/pages/...) if found
5. Public UK phone number or public contact email if shown on their site/listing (never invent fake emails or fake phone numbers)
6. Current service offer, promotional deal (in £ GBP), or local positioning observed in their listing/ad/website.

Return a clear factual research brief listing each UK business and its observed facts.`,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  const citations = extractGroundingCitations(groundedResponse);
  const researchBrief = groundedResponse.text ?? '';

  if (!researchBrief.trim()) {
    return {
      prospects: [],
      citations,
      searchSummary: 'No public UK results were returned for this query. Try broadening the UK town, postcode, or category.',
    };
  }

  // Step 2: Convert grounded brief into strict structured JSON
  const structuredResponse = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Extract the real United Kingdom (UK) businesses from the research brief below into a clean JSON array.
Rules:
- ONLY include UK-based businesses actually named in the research brief; omit any US or non-UK entities.
- Never fabricate email addresses, phone numbers, or URLs that are not present in the brief; use empty string "" when unknown.
- Format city as "<UK Town/City>, UK" and use GBP (£) and British English spelling.
- Keep adHeadline concise (under 90 chars) summarizing their observed local offer or core service headline.
- Set adFormat to one of: "Sponsored Post", "Local Deal", "Business Page", "Neighborhood Banner", "Directory Listing".

Research Brief:
${researchBrief}

Known Verified Source URLs:
${citations.map((c) => `- ${c.title}: ${c.url}`).join('\n')}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          searchSummary: { type: Type.STRING },
          prospects: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                companyName: { type: Type.STRING },
                contactName: { type: Type.STRING },
                contactRole: { type: Type.STRING },
                category: { type: Type.STRING },
                neighborhood: { type: Type.STRING },
                city: { type: Type.STRING },
                email: { type: Type.STRING },
                phone: { type: Type.STRING },
                website: { type: Type.STRING },
                nextdoorUrl: { type: Type.STRING },
                adHeadline: { type: Type.STRING },
                adBody: { type: Type.STRING },
                adOffer: { type: Type.STRING },
                adFormat: { type: Type.STRING },
                notes: { type: Type.STRING },
              },
              required: [
                'companyName',
                'category',
                'city',
                'adHeadline',
                'adBody',
                'adFormat',
              ],
            },
          },
        },
        required: ['searchSummary', 'prospects'],
      },
    },
  });

  const parsed = parseJsonSafely<{
    searchSummary?: string;
    prospects?: DiscoveredProspect[];
  }>(structuredResponse.text, { searchSummary: '', prospects: [] });

  const allowedFormats = new Set([
    'Sponsored Post',
    'Local Deal',
    'Business Page',
    'Neighborhood Banner',
    'Directory Listing',
  ]);

  const normalized = (parsed.prospects ?? [])
    .filter((p) => p.companyName && p.companyName.trim().length > 1)
    .slice(0, params.limit)
    .map((p) => ({
      companyName: p.companyName.trim(),
      contactName: (p.contactName || '').trim(),
      contactRole: (p.contactRole || params.role || 'Owner').trim(),
      category: (p.category || params.niche).trim(),
      neighborhood: (p.neighborhood || params.location).trim(),
      city: (p.city || params.location).trim(),
      email: (p.email || '').trim(),
      phone: (p.phone || '').trim(),
      website: normalizeUrl(p.website || ''),
      nextdoorUrl: normalizeUrl(p.nextdoorUrl || ''),
      adHeadline: (p.adHeadline || `${p.companyName} — Local Services`).trim(),
      adBody: (p.adBody || '').trim(),
      adOffer: (p.adOffer || 'Neighborhood inquiry').trim(),
      adFormat: (allowedFormats.has(p.adFormat)
        ? p.adFormat
        : params.mode === 'nextdoor_pages'
          ? 'Business Page'
          : 'Directory Listing') as DiscoveredProspect['adFormat'],
      notes: (p.notes || '').trim(),
    }));

  return {
    prospects: normalized,
    citations,
    searchSummary:
      parsed.searchSummary ||
      `Found ${normalized.length} public local prospects for ${params.niche} in ${params.location}.`,
  };
}

export async function parseNextdoorFeedPayload(params: {
  rawContent: string;
  neighborhoodHint: string;
  cityHint: string;
  sourceRepo: string;
}): Promise<{
  extracted: DiscoveredProspect[];
  summary: string;
}> {
  const ai = getClient();

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `You are a Nextdoor UK (nextdoor.co.uk) Ad & Business Scraper data normaliser compatible with outputs from GitHub repositories like Nextdoor-Script, nextdoor-business-scraper, sponsored-blur-nextdoor, and tap-nextdoor.

Parse the raw Nextdoor UK HTML snippet, JSON dump, HAR excerpt, CSV rows, or copied neighbourhood feed text below.
Handle Nextdoor sponsored-label obfuscation (e.g., split spans like "S p o n s o r e d", zero-width spaces, or "Promoted by").
Extract every distinct UK business advertisement, local deal, or business listing present in the input.

Rules:
- Focus on United Kingdom (UK) businesses, UK postcodes, UK phone numbers (+44 / 01xxx / 020 / 07xxx), and GBP (£) offers.
- Only extract businesses/advertisers genuinely present in the input text.
- If contact email or UK phone appears in the text, extract it verbatim; otherwise return "".
- Use neighborhoodHint="${params.neighborhoodHint}" and cityHint="${params.cityHint}" only when the record itself omits location.
- Set adFormat to one of: "Sponsored Post", "Local Deal", "Business Page", "Neighborhood Banner", "Directory Listing".

RAW SCRAPED INPUT:
${params.rawContent.slice(0, 28000)}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          extracted: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                companyName: { type: Type.STRING },
                contactName: { type: Type.STRING },
                contactRole: { type: Type.STRING },
                category: { type: Type.STRING },
                neighborhood: { type: Type.STRING },
                city: { type: Type.STRING },
                email: { type: Type.STRING },
                phone: { type: Type.STRING },
                website: { type: Type.STRING },
                nextdoorUrl: { type: Type.STRING },
                adHeadline: { type: Type.STRING },
                adBody: { type: Type.STRING },
                adOffer: { type: Type.STRING },
                adFormat: { type: Type.STRING },
                notes: { type: Type.STRING },
              },
              required: ['companyName', 'adHeadline', 'adBody', 'adFormat'],
            },
          },
        },
        required: ['summary', 'extracted'],
      },
    },
  });

  const parsed = parseJsonSafely<{
    summary?: string;
    extracted?: DiscoveredProspect[];
  }>(response.text, { summary: '', extracted: [] });

  const allowedFormats = new Set([
    'Sponsored Post',
    'Local Deal',
    'Business Page',
    'Neighborhood Banner',
    'Directory Listing',
  ]);

  const extracted = (parsed.extracted ?? [])
    .filter((item) => item.companyName && item.companyName.trim().length > 1)
    .map((item) => ({
      companyName: item.companyName.trim(),
      contactName: (item.contactName || '').trim(),
      contactRole: (item.contactRole || 'Owner').trim(),
      category: (item.category || 'Local Business').trim(),
      neighborhood: (item.neighborhood || params.neighborhoodHint || 'Local Feed').trim(),
      city: (item.city || params.cityHint || 'Unspecified').trim(),
      email: (item.email || '').trim(),
      phone: (item.phone || '').trim(),
      website: normalizeUrl(item.website || ''),
      nextdoorUrl: normalizeUrl(item.nextdoorUrl || ''),
      adHeadline: (item.adHeadline || item.companyName).trim(),
      adBody: (item.adBody || '').trim(),
      adOffer: (item.adOffer || 'Sponsored offer').trim(),
      adFormat: (allowedFormats.has(item.adFormat)
        ? item.adFormat
        : 'Sponsored Post') as DiscoveredProspect['adFormat'],
      notes: (item.notes || `Extracted via ${params.sourceRepo}`).trim(),
    }));

  return {
    extracted,
    summary:
      parsed.summary ||
      `Parsed ${extracted.length} Nextdoor advertiser record${extracted.length === 1 ? '' : 's'} from payload.`,
  };
}

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  try {
    const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return url.toString();
  } catch {
    return '';
  }
}

function extractHostname(website: string, email: string): string {
  if (website) {
    try {
      return new URL(website).hostname.replace(/^www\./i, '');
    } catch {
      // ignore
    }
  }
  if (email && email.includes('@')) {
    return email.split('@')[1].trim().toLowerCase();
  }
  return '';
}

async function checkDomainMx(domain: string): Promise<{
  verified: boolean;
  detail: string;
}> {
  if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain) || domain.endsWith('.example')) {
    return { verified: false, detail: 'No live public domain available for MX lookup' };
  }
  try {
    const records = await dns.resolveMx(domain);
    if (records && records.length > 0) {
      const top = records.sort((a, b) => a.priority - b.priority)[0];
      return {
        verified: true,
        detail: `Active MX host ${top.exchange} (priority ${top.priority})`,
      };
    }
    return { verified: false, detail: `No MX records published for ${domain}` };
  } catch {
    return { verified: false, detail: `DNS MX lookup did not resolve for ${domain}` };
  }
}

export async function runWaterfallEnrichment(lead: Lead): Promise<{
  patch: Partial<Lead>;
  steps: EnrichmentStepResult[];
  citations: SourceCitation[];
}> {
  const ai = getClient();
  const checkedAt = new Date().toISOString();
  const steps: EnrichmentStepResult[] = [];

  // Waterfall Step 1: Grounded Public Web & Directory Search
  const searchResponse = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Research this United Kingdom (UK) local business for B2B sales enrichment:
- Company: ${lead.companyName}
- UK Town / Neighbourhood: ${lead.neighborhood}, ${lead.city}
- Category: ${lead.category}
- Existing Website: ${lead.website || 'Unknown'}

Find any publicly available factual UK information (prioritise .co.uk/.uk sites, UK directories, and Companies House public records):
1. Official UK website domain
2. Public business email address (e.g. info@, hello@, enquiries@ listed publicly) — do NOT guess or invent private emails
3. Public UK phone number
4. Director / Founder / Owner / Operations Manager name if publicly listed
5. Brief British English outreach insight based on their local UK services, reviews, or neighbourhood marketing presence.`,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  const citations = extractGroundingCitations(searchResponse);
  const brief = searchResponse.text ?? '';

  // Waterfall Step 2: Structured extraction from grounded findings
  const structRes = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Extract ONLY verified public enrichment fields from this research brief. Leave fields empty "" if not explicitly confirmed in the brief.
Brief:
${brief}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          website: { type: Type.STRING },
          email: { type: Type.STRING },
          phone: { type: Type.STRING },
          contactName: { type: Type.STRING },
          contactRole: { type: Type.STRING },
          outreachAngle: { type: Type.STRING },
        },
        required: ['outreachAngle'],
      },
    },
  });

  const found = parseJsonSafely<{
    website?: string;
    email?: string;
    phone?: string;
    contactName?: string;
    contactRole?: string;
    outreachAngle?: string;
  }>(structRes.text, {});

  const finalWebsite = normalizeUrl(found.website || '') || lead.website;
  const finalEmail = (found.email || '').trim() || lead.email;
  const finalPhone = (found.phone || '').trim() || lead.phone;
  const finalContactName = (found.contactName || '').trim() || lead.contactName;
  const finalContactRole = (found.contactRole || '').trim() || lead.contactRole;

  steps.push({
    step: '1. Public Business & Domain Lookup',
    provider: 'Web Search Grounding',
    status: finalWebsite ? 'found' : 'not_found',
    detail: finalWebsite
      ? `Resolved domain ${finalWebsite} (${citations.length} public sources)`
      : 'No verified public domain located',
    checkedAt,
  });

  steps.push({
    step: '2. Decision-Maker & Contact Waterfall',
    provider: 'Public Listing Extractor',
    status: finalEmail || finalContactName ? 'found' : 'not_found',
    detail:
      finalEmail || finalContactName
        ? `Contact: ${finalContactName || 'Unlisted'} · Email: ${finalEmail || 'Not published'}`
        : 'No public email or executive name published',
    checkedAt,
  });

  // Waterfall Step 3: Live DNS MX Verification
  const domain = extractHostname(finalWebsite, finalEmail);
  const mx = await checkDomainMx(domain);

  steps.push({
    step: '3. Mail Server (MX) Deliverability Check',
    provider: 'Live DNS Resolver',
    status: mx.verified ? 'verified' : domain ? 'not_found' : 'skipped',
    detail: mx.detail,
    checkedAt,
  });

  const emailStatus: Lead['emailStatus'] = !finalEmail
    ? 'missing'
    : mx.verified
      ? 'verified_mx'
      : 'unverified';

  const mergedCitations = [...lead.citations];
  const seenUrls = new Set(mergedCitations.map((c) => c.url));
  for (const c of citations) {
    if (!seenUrls.has(c.url)) {
      seenUrls.add(c.url);
      mergedCitations.push(c);
    }
  }

  const noteAddition = found.outreachAngle?.trim()
    ? `[Enrichment Insight] ${found.outreachAngle.trim()}`
    : '';
  const combinedNotes = noteAddition
    ? lead.notes
      ? `${lead.notes}\n\n${noteAddition}`
      : noteAddition
    : lead.notes;

  return {
    patch: {
      website: finalWebsite,
      email: finalEmail,
      emailStatus,
      phone: finalPhone,
      contactName: finalContactName,
      contactRole: finalContactRole,
      stage: lead.stage === 'new' ? 'enriched' : lead.stage,
      notes: combinedNotes,
      citations: mergedCitations.slice(0, 10),
      enrichmentSteps: steps,
      lastEnrichedAt: checkedAt,
    },
    steps,
    citations: mergedCitations,
  };
}

export async function draftPersonalizedOutreach(params: {
  lead: Lead;
  yourOffer: string;
  channel: 'Email' | 'Nextdoor DM' | 'LinkedIn';
  tone: 'Direct & Concise' | 'Consultative' | 'Neighborly';
}): Promise<{ subject: string; body: string }> {
  const ai = getClient();

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Write a crisp, high-converting, natural-sounding UK B2B outreach message in British English (e.g. neighbourhood, enquiry, £) to a UK local business discovered via Nextdoor UK (nextdoor.co.uk).
No buzzwords, no "I hope this email finds you well", no hype. Keep it under 120 words and reference their actual UK neighbourhood/postcode and ad offer naturally.

Prospect Details:
- Company: ${params.lead.companyName}
- Contact: ${params.lead.contactName || 'Team'} (${params.lead.contactRole || 'Director'})
- Category: ${params.lead.category}
- UK Neighbourhood / Town: ${params.lead.neighborhood}, ${params.lead.city}
- Observed Nextdoor UK Ad Headline: ${params.lead.adHeadline}
- Observed Offer: ${params.lead.adOffer}
- Ad Copy Excerpt: ${params.lead.adBody}

Sender's Offer / Value Proposition:
${params.yourOffer}

Channel: ${params.channel}
Tone: ${params.tone}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          subject: { type: Type.STRING },
          body: { type: Type.STRING },
        },
        required: ['subject', 'body'],
      },
    },
  });

  const parsed = parseJsonSafely<{ subject?: string; body?: string }>(
    response.text,
    {}
  );

  return {
    subject:
      parsed.subject?.trim() ||
      `Quick note on ${params.lead.companyName}'s ${params.lead.neighborhood} offer`,
    body:
      parsed.body?.trim() ||
      `Hi ${params.lead.contactName || 'there'}, saw ${params.lead.companyName} active in ${params.lead.neighborhood}. Would love to share a quick idea around ${params.yourOffer}.`,
  };
}
