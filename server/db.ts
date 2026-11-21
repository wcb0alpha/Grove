import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type {
  AutoScraperMonitor,
  IngestLogEntry,
  Lead,
  OutreachSequence,
  WorkspaceSnapshot,
} from '../src/types/leads.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'fyndergrid-db.json');

function seedWorkspace(): WorkspaceSnapshot {
  const now = new Date().toISOString();
  const leads: Lead[] = [
    {
      id: 'lead-nd-uk-01',
      companyName: 'Cotswold Timber & Garden Rooms Ltd',
      contactName: 'Oliver Bennett',
      contactRole: 'Founder & Surveyor',
      category: 'Outdoor Living & Carpentry',
      neighborhood: 'Clifton & Redland (BS8)',
      city: 'Bristol, UK',
      email: 'oliver@cotswoldgardenrooms.co.uk',
      emailStatus: 'verified_mx',
      phone: '0117 496 0148',
      website: 'https://cotswoldgardenrooms.co.uk',
      nextdoorUrl: 'https://nextdoor.co.uk/pages/cotswold-timber-garden-rooms-bristol/',
      source: 'nextdoor_ad',
      sourceRepo: 'chanwooh/Nextdoor-Script',
      stage: 'enriched',
      adHeadline: 'Bespoke Cedar Garden Offices — £450 Off for Clifton Neighbours',
      adBody:
        'Insulated Western Red Cedar garden rooms and covered pergolas built in 5 days. Locally run in Bristol with 42 neighbourhood recommendations.',
      adOffer: '£450 off bookings confirmed before month-end',
      adFormat: 'Sponsored Post',
      notes:
        'Actively running paid Nextdoor UK carousel ads targeting BS8 and BS6 postcodes. Strong fit for landing-page conversion optimisation and local quote capture.',
      citations: [
        {
          title: 'Nextdoor UK Business Directory — Bristol Home & Garden',
          url: 'https://nextdoor.co.uk/pages/',
        },
      ],
      enrichmentSteps: [
        {
          step: 'Domain & DNS MX Verification',
          provider: 'DNS Resolver',
          status: 'verified',
          detail: 'MX records active (Google Workspace UK mail exchanger)',
          checkedAt: now,
        },
        {
          step: 'Nextdoor UK Advertiser Footprint',
          provider: 'Sponsored Feed Parser',
          status: 'found',
          detail: 'Active sponsored post detected across BS6, BS8, and BS9 postcodes',
          checkedAt: now,
        },
      ],
      lastEnrichedAt: now,
      createdAt: '2026-11-18T14:20:00.000Z',
      updatedAt: now,
    },
    {
      id: 'lead-nd-uk-02',
      companyName: 'Thames Valley Boiler & Heating',
      contactName: 'Hannah Gallagher',
      contactRole: 'Operations Manager',
      category: 'Boiler & Heating Engineers',
      neighborhood: 'Richmond & Twickenham (TW1)',
      city: 'London, UK',
      email: 'hannah@thamesvalleyheating.co.uk',
      emailStatus: 'verified_mx',
      phone: '020 7946 0192',
      website: 'https://thamesvalleyheating.co.uk',
      nextdoorUrl: 'https://nextdoor.co.uk/pages/thames-valley-heating-london/',
      source: 'nextdoor_ad',
      sourceRepo: 'krautsdubisq1g/nextdoor-business-scraper',
      stage: 'contacted',
      adHeadline: '£69 Gas Safe Boiler Service — Same-Week Visits in Richmond',
      adBody:
        'Family-run Gas Safe registered engineers covering TW1, TW9, and SW14 for winter boiler servicing, powerflushing, and heat pump grants.',
      adOffer: '£69 winter boiler safety service',
      adFormat: 'Local Deal',
      notes:
        'Running seasonal Nextdoor UK Local Deals. Sent email sequence step 1 highlighting mobile callback gap on their Nextdoor offer page.',
      citations: [],
      enrichmentSteps: [
        {
          step: 'Domain & DNS MX Verification',
          provider: 'DNS Resolver',
          status: 'verified',
          detail: 'MX records confirmed on thamesvalleyheating.co.uk',
          checkedAt: now,
        },
      ],
      lastEnrichedAt: now,
      createdAt: '2026-11-17T10:05:00.000Z',
      updatedAt: now,
    },
    {
      id: 'lead-nd-uk-03',
      companyName: 'Didsbury Smile Dental Studio',
      contactName: 'Dr. Priya Patel',
      contactRole: 'Principal Dentist',
      category: 'Dental & Orthodontics',
      neighborhood: 'Didsbury & Chorlton (M20)',
      city: 'Manchester, UK',
      email: 'reception@didsburysmile.co.uk',
      emailStatus: 'pattern_only',
      phone: '0161 496 0174',
      website: 'https://didsburysmile.co.uk',
      nextdoorUrl: 'https://nextdoor.co.uk/pages/didsbury-smile-dental-manchester/',
      source: 'nextdoor_page',
      sourceRepo: 'DrBenedictPorkins/sponsored-blur-nextdoor',
      stage: 'new',
      adHeadline: 'New Patient Consultation & 3D Scan — Evening Appointments Open',
      adBody:
        'Independent dental clinic on Wilmslow Road. Mention our Nextdoor post for complimentary whitening consultation with your new patient exam.',
      adOffer: 'Complimentary whitening consultation for new patients',
      adFormat: 'Sponsored Post',
      notes: 'Captured via sponsored post selector scan on nextdoor.co.uk. Ready for waterfall enrichment to locate practice manager contact.',
      citations: [],
      enrichmentSteps: [],
      createdAt: '2026-11-19T18:45:00.000Z',
      updatedAt: now,
    },
    {
      id: 'lead-nd-uk-04',
      companyName: 'Peak Slate Roofing & Solar Ltd',
      contactName: 'Callum Wright',
      contactRole: 'Commercial Director',
      category: 'Roofing & Solar',
      neighborhood: 'Ecclesall & Dore (S11)',
      city: 'Sheffield, UK',
      email: 'cwright@peakslateroofing.co.uk',
      emailStatus: 'verified_mx',
      phone: '0114 496 0163',
      website: 'https://peakslateroofing.co.uk',
      nextdoorUrl: 'https://nextdoor.co.uk/pages/peak-slate-roofing-sheffield/',
      source: 'github_import',
      sourceRepo: 'MeltanoLabs/tap-nextdoor',
      stage: 'qualified',
      adHeadline: 'Free Drone Roof & Slate Inspection Ahead of Winter Gales',
      adBody:
        'NFRC-accredited Yorkshire roofing and solar installers serving S10, S11, and S17. 10-year workmanship guarantee on slate re-roofs.',
      adOffer: 'Free 24-point drone roof survey report',
      adFormat: 'Neighborhood Banner',
      notes: 'Replied positively on 20 Nov — booked discovery call to automate their multi-postcode Nextdoor UK lead capture.',
      citations: [],
      enrichmentSteps: [
        {
          step: 'Domain & DNS MX Verification',
          provider: 'DNS Resolver',
          status: 'verified',
          detail: 'MX active via Microsoft 365 UK',
          checkedAt: now,
        },
        {
          step: 'Decision Maker Discovery',
          provider: 'Public Web Grounding',
          status: 'found',
          detail: 'Confirmed Commercial Director overseeing South Yorkshire ad spend',
          checkedAt: now,
        },
      ],
      lastEnrichedAt: now,
      createdAt: '2026-11-15T09:15:00.000Z',
      updatedAt: now,
    },
    {
      id: 'lead-nd-uk-05',
      companyName: 'Morningside Turf & Garden Care',
      contactName: 'Fiona MacLeod',
      contactRole: 'Director',
      category: 'Landscaping & Garden Maintenance',
      neighborhood: 'Morningside & Bruntsfield (EH10)',
      city: 'Edinburgh, UK',
      email: '',
      emailStatus: 'missing',
      phone: '0131 496 0129',
      website: 'https://morningsideturf.example',
      nextdoorUrl: 'https://nextdoor.co.uk/pages/morningside-turf-edinburgh/',
      source: 'nextdoor_ad',
      sourceRepo: 'chanwooh/Nextdoor-Script',
      stage: 'new',
      adHeadline: 'Autumn Lawn Scarification & Hedge Tidy Slots Filling in EH10',
      adBody:
        'Local Edinburgh garden maintenance team offering stone patio jet-washing and winter lawn prep. 15% multi-neighbour booking discount.',
      adOffer: '15% multi-neighbour bundle discount',
      adFormat: 'Sponsored Post',
      notes: 'Imported from nextdoor.co.uk feed scrape without email — ready for Waterfall Enrichment run.',
      citations: [],
      enrichmentSteps: [],
      createdAt: '2026-11-20T16:10:00.000Z',
      updatedAt: now,
    },
  ];

  const sequences: OutreachSequence[] = [
    {
      id: 'seq-nd-uk-advertisers',
      name: 'Nextdoor UK Active Advertisers — Conversion Audit',
      targetNiche: 'UK Trades & Home Services (Heating, Roofing, Landscaping)',
      status: 'Active',
      enrolledCount: 18,
      replyRateLabel: '22.4% reply rate',
      createdAt: '2026-11-10T12:00:00.000Z',
      steps: [
        {
          id: 'step-1',
          dayOffset: 0,
          channel: 'Email',
          subject: 'Saw your {{neighborhood}} Nextdoor ad — quick landing page note',
          body: 'Hi {{contactName}},\n\nI came across {{companyName}}\'s sponsored post in {{neighborhood}} featuring "{{adOffer}}". The offer itself is strong, but when neighbours tap through on mobile there is no instant postcode quote form.\n\nWe help UK local service teams convert Nextdoor ad clicks into booked surveys at double the rate. Open to a 4-minute teardown video tailored to your current ad?\n\nBest regards,\nMaya',
        },
        {
          id: 'step-2',
          dayOffset: 3,
          channel: 'Email',
          subject: 'Re: {{companyName}} in {{neighborhood}}',
          body: 'Hi {{contactName}},\n\nFollowing up briefly — I mocked up a postcode-specific landing header for {{companyName}} matching your "{{adHeadline}}" copy. Happy to send the preview link across if useful?',
        },
        {
          id: 'step-3',
          dayOffset: 7,
          channel: 'Nextdoor DM',
          subject: 'Quick note on your local deal',
          body: 'Hi {{contactName}}, great seeing {{companyName}} active in {{neighborhood}} this week. Dropped a brief conversion idea to your work inbox if you are scaling local enquiries this quarter.',
        },
      ],
    },
    {
      id: 'seq-dental-uk',
      name: 'UK Private Practices — Neighbour Trust & Reactivation',
      targetNiche: 'UK Dental, Aesthetics & Physiotherapy Clinics',
      status: 'Draft',
      enrolledCount: 6,
      replyRateLabel: '16.7% reply rate',
      createdAt: '2026-11-14T09:30:00.000Z',
      steps: [
        {
          id: 'step-d1',
          dayOffset: 0,
          channel: 'Email',
          subject: 'Turning {{neighborhood}} Nextdoor recommendations into booked visits',
          body: 'Hi {{contactName}},\n\nNoticed {{companyName}} promoting "{{adOffer}}" to {{neighborhood}} residents. UK clinics running Nextdoor ads often lose half their enquiries when patients have to ring during reception hours.\n\nHappy to share how similar practices add 15–25 new local patients a month from the exact same ad spend.',
        },
      ],
    },
  ];

  const ingestLogs: IngestLogEntry[] = [
    {
      id: 'log-uk-01',
      receivedAt: '2026-11-20T16:10:00.000Z',
      sourceRepo: 'chanwooh/Nextdoor-Script',
      recordsParsed: 2,
      neighborhood: 'Clifton (BS8) & Morningside (EH10)',
      summary: 'Parsed 2 sponsored feed cards via Nextdoor-Script JSON export (nextdoor.co.uk)',
    },
    {
      id: 'log-uk-02',
      receivedAt: '2026-11-18T11:30:00.000Z',
      sourceRepo: 'krautsdubisq1g/nextdoor-business-scraper',
      recordsParsed: 1,
      neighborhood: 'Richmond & Twickenham, London',
      summary: 'Imported UK local business directory page & active Local Deal offer',
    },
  ];

  const monitors = defaultUkMonitors();

  return { leads, sequences, ingestLogs, monitors };
}

function defaultUkMonitors(): AutoScraperMonitor[] {
  return [
    {
      id: 'mon-uk-01',
      name: 'South West UK Trades (Bristol & Bath)',
      ukLocations: ['Bristol BS8', 'Bath BA1'],
      categories: ['Roofing Contractors', 'Boiler & Heating Engineers'],
      intervalMinutes: 360,
      enabled: false,
      autoEnrich: true,
      maxPerRun: 5,
      lastStatus: 'idle',
      lastSummary: 'Ready to run — click Run Now or enable scheduled auto-scraping.',
      totalLeadsCaptured: 0,
      createdAt: '2026-11-20T09:00:00.000Z',
    },
    {
      id: 'mon-uk-02',
      name: 'Greater London & Manchester Clinics',
      ukLocations: ['Richmond London TW9', 'Didsbury Manchester M20'],
      categories: ['Private Dental Practice', 'Garden Landscaping'],
      intervalMinutes: 1440,
      enabled: false,
      autoEnrich: false,
      maxPerRun: 5,
      lastStatus: 'idle',
      lastSummary: 'Ready to run — targets public nextdoor.co.uk/pages directory listings.',
      totalLeadsCaptured: 0,
      createdAt: '2026-11-20T11:30:00.000Z',
    },
  ];
}

function ensureDbFile(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const initial = seedWorkspace();
    writeSnapshot(initial);
  }
}

function readSnapshot(): WorkspaceSnapshot {
  ensureDbFile();
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<WorkspaceSnapshot>;
    if (!Array.isArray(parsed.leads) || !Array.isArray(parsed.sequences)) {
      throw new Error('Corrupt DB structure');
    }
    const snapshot: WorkspaceSnapshot = {
      leads: parsed.leads,
      sequences: parsed.sequences,
      ingestLogs: Array.isArray(parsed.ingestLogs) ? parsed.ingestLogs : [],
      monitors: Array.isArray(parsed.monitors) ? parsed.monitors : defaultUkMonitors(),
    };
    if (!Array.isArray(parsed.monitors)) {
      writeSnapshot(snapshot);
    }
    return snapshot;
  } catch {
    const fallback = seedWorkspace();
    writeSnapshot(fallback);
    return fallback;
  }
}

function writeSnapshot(snapshot: WorkspaceSnapshot): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpFile = `${DB_FILE}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(snapshot, null, 2), 'utf-8');
  fs.renameSync(tmpFile, DB_FILE);
}

export function getWorkspace(): WorkspaceSnapshot {
  return readSnapshot();
}

export function getLeads(): Lead[] {
  return readSnapshot().leads;
}

export function getLeadById(id: string): Lead | undefined {
  return readSnapshot().leads.find((l) => l.id === id);
}

export function createLead(input: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>): Lead {
  const snapshot = readSnapshot();
  const now = new Date().toISOString();
  const lead: Lead = {
    ...input,
    id: `lead-${crypto.randomUUID().slice(0, 8)}`,
    createdAt: now,
    updatedAt: now,
  };
  snapshot.leads.unshift(lead);
  writeSnapshot(snapshot);
  return lead;
}

export function createLeadsBulk(
  inputs: Array<Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>>,
  logMeta?: { sourceRepo: string; neighborhood: string; summary: string }
): Lead[] {
  const snapshot = readSnapshot();
  const now = new Date().toISOString();
  const existingKeys = new Set(
    snapshot.leads.map((l) => `${l.companyName.toLowerCase().trim()}|${l.city.toLowerCase().trim()}`)
  );

  const created: Lead[] = [];
  for (const input of inputs) {
    const key = `${input.companyName.toLowerCase().trim()}|${input.city.toLowerCase().trim()}`;
    if (existingKeys.has(key)) {
      continue;
    }
    existingKeys.add(key);
    const lead: Lead = {
      ...input,
      id: `lead-${crypto.randomUUID().slice(0, 8)}`,
      createdAt: now,
      updatedAt: now,
    };
    snapshot.leads.unshift(lead);
    created.push(lead);
  }

  if (logMeta && created.length > 0) {
    snapshot.ingestLogs.unshift({
      id: `log-${crypto.randomUUID().slice(0, 6)}`,
      receivedAt: now,
      sourceRepo: logMeta.sourceRepo,
      recordsParsed: created.length,
      neighborhood: logMeta.neighborhood || 'Multi-Postcode UK',
      summary: logMeta.summary,
    });
    snapshot.ingestLogs = snapshot.ingestLogs.slice(0, 30);
  }

  writeSnapshot(snapshot);
  return created;
}

export function updateLead(id: string, patch: Partial<Lead>): Lead | null {
  const snapshot = readSnapshot();
  const index = snapshot.leads.findIndex((l) => l.id === id);
  if (index === -1) return null;
  const updated: Lead = {
    ...snapshot.leads[index],
    ...patch,
    id: snapshot.leads[index].id,
    createdAt: snapshot.leads[index].createdAt,
    updatedAt: new Date().toISOString(),
  };
  snapshot.leads[index] = updated;
  writeSnapshot(snapshot);
  return updated;
}

export function deleteLead(id: string): boolean {
  const snapshot = readSnapshot();
  const before = snapshot.leads.length;
  snapshot.leads = snapshot.leads.filter((l) => l.id !== id);
  if (snapshot.leads.length === before) return false;
  writeSnapshot(snapshot);
  return true;
}

export function getSequences(): OutreachSequence[] {
  return readSnapshot().sequences;
}

export function createSequence(
  input: Omit<OutreachSequence, 'id' | 'createdAt'>
): OutreachSequence {
  const snapshot = readSnapshot();
  const seq: OutreachSequence = {
    ...input,
    id: `seq-${crypto.randomUUID().slice(0, 8)}`,
    createdAt: new Date().toISOString(),
  };
  snapshot.sequences.unshift(seq);
  writeSnapshot(snapshot);
  return seq;
}

export function updateSequence(
  id: string,
  patch: Partial<OutreachSequence>
): OutreachSequence | null {
  const snapshot = readSnapshot();
  const idx = snapshot.sequences.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  snapshot.sequences[idx] = {
    ...snapshot.sequences[idx],
    ...patch,
    id: snapshot.sequences[idx].id,
  };
  writeSnapshot(snapshot);
  return snapshot.sequences[idx];
}

export function deleteSequence(id: string): boolean {
  const snapshot = readSnapshot();
  const before = snapshot.sequences.length;
  snapshot.sequences = snapshot.sequences.filter((s) => s.id !== id);
  if (snapshot.sequences.length === before) return false;
  writeSnapshot(snapshot);
  return true;
}

export function getMonitors(): AutoScraperMonitor[] {
  return readSnapshot().monitors;
}

export function getMonitorById(id: string): AutoScraperMonitor | undefined {
  return readSnapshot().monitors.find((m) => m.id === id);
}

export function createMonitor(
  input: Omit<AutoScraperMonitor, 'id' | 'createdAt' | 'lastStatus' | 'lastSummary' | 'totalLeadsCaptured'>
): AutoScraperMonitor {
  const snapshot = readSnapshot();
  const monitor: AutoScraperMonitor = {
    ...input,
    id: `mon-${crypto.randomUUID().slice(0, 8)}`,
    lastStatus: 'idle',
    lastSummary: 'Monitor created — click Run Now or turn on automatic scheduling.',
    totalLeadsCaptured: 0,
    createdAt: new Date().toISOString(),
  };
  snapshot.monitors.unshift(monitor);
  writeSnapshot(snapshot);
  return monitor;
}

export function updateMonitor(
  id: string,
  patch: Partial<AutoScraperMonitor>
): AutoScraperMonitor | null {
  const snapshot = readSnapshot();
  const idx = snapshot.monitors.findIndex((m) => m.id === id);
  if (idx === -1) return null;
  snapshot.monitors[idx] = {
    ...snapshot.monitors[idx],
    ...patch,
    id: snapshot.monitors[idx].id,
    createdAt: snapshot.monitors[idx].createdAt,
  };
  writeSnapshot(snapshot);
  return snapshot.monitors[idx];
}

export function deleteMonitor(id: string): boolean {
  const snapshot = readSnapshot();
  const before = snapshot.monitors.length;
  snapshot.monitors = snapshot.monitors.filter((m) => m.id !== id);
  if (snapshot.monitors.length === before) return false;
  writeSnapshot(snapshot);
  return true;
}
