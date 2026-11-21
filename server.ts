import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import {
  createLead,
  createLeadsBulk,
  createSequence,
  deleteLead,
  deleteSequence,
  getLeadById,
  getWorkspace,
  updateLead,
  updateSequence,
} from './server/db.ts';
import {
  discoverProspects,
  draftPersonalizedOutreach,
  parseNextdoorFeedPayload,
  runWaterfallEnrichment,
} from './server/gemini.ts';
import {
  fetchCuratedNextdoorRepos,
  fetchGithubRepoReadme,
  searchGithubNextdoorRepos,
} from './server/github.ts';
import type { Lead } from './src/types/leads.ts';

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

const leadStageSchema = z.enum(['new', 'enriched', 'contacted', 'replied', 'qualified']);
const leadSourceSchema = z.enum([
  'nextdoor_ad',
  'nextdoor_page',
  'github_import',
  'web_discovery',
  'webhook_ingest',
]);
const adFormatSchema = z.enum([
  'Sponsored Post',
  'Local Deal',
  'Business Page',
  'Neighborhood Banner',
  'Directory Listing',
]);

const createLeadSchema = z.object({
  companyName: z.string().trim().min(1).max(160),
  contactName: z.string().trim().max(120).default(''),
  contactRole: z.string().trim().max(120).default('Owner'),
  category: z.string().trim().max(100).default('Local Service'),
  neighborhood: z.string().trim().max(120).default(''),
  city: z.string().trim().max(120).default(''),
  email: z.string().trim().max(160).default(''),
  emailStatus: z
    .enum(['verified_mx', 'pattern_only', 'unverified', 'missing'])
    .default('unverified'),
  phone: z.string().trim().max(60).default(''),
  website: z.string().trim().max(300).default(''),
  nextdoorUrl: z.string().trim().max(300).default(''),
  source: leadSourceSchema.default('nextdoor_ad'),
  sourceRepo: z.string().trim().max(120).optional(),
  stage: leadStageSchema.default('new'),
  adHeadline: z.string().trim().max(240).default(''),
  adBody: z.string().trim().max(2000).default(''),
  adOffer: z.string().trim().max(240).default(''),
  adFormat: adFormatSchema.default('Sponsored Post'),
  notes: z.string().trim().max(3000).default(''),
  citations: z
    .array(z.object({ title: z.string().max(240), url: z.string().max(500) }))
    .max(12)
    .default([]),
});

const patchLeadSchema = createLeadSchema.partial();

const discoverSchema = z.object({
  niche: z.string().trim().min(2).max(120),
  location: z.string().trim().min(2).max(120),
  role: z.string().trim().max(100).default('Owner / Founder'),
  mode: z.enum(['nextdoor_ads', 'nextdoor_pages', 'b2b_local']).default('nextdoor_ads'),
  limit: z.number().int().min(1).max(10).default(5),
});

const parseFeedSchema = z.object({
  rawContent: z.string().trim().min(15).max(60000),
  neighborhoodHint: z.string().trim().max(120).default(''),
  cityHint: z.string().trim().max(120).default(''),
  sourceRepo: z.string().trim().max(120).default('chanwooh/Nextdoor-Script'),
  autoSave: z.boolean().default(false),
});

const webhookIngestSchema = z.object({
  sourceRepo: z.string().trim().max(120).default('custom-nextdoor-scraper'),
  neighborhood: z.string().trim().max(120).default('Neighborhood Feed'),
  city: z.string().trim().max(120).default(''),
  records: z
    .array(
      z.object({
        companyName: z.string().trim().min(1).max(160),
        contactName: z.string().trim().max(120).optional().default(''),
        category: z.string().trim().max(100).optional().default('Local Business'),
        neighborhood: z.string().trim().max(120).optional().default(''),
        city: z.string().trim().max(120).optional().default(''),
        email: z.string().trim().max(160).optional().default(''),
        phone: z.string().trim().max(60).optional().default(''),
        website: z.string().trim().max(300).optional().default(''),
        nextdoorUrl: z.string().trim().max(300).optional().default(''),
        adHeadline: z.string().trim().max(240).optional().default(''),
        adBody: z.string().trim().max(2000).optional().default(''),
        adOffer: z.string().trim().max(240).optional().default(''),
        adFormat: adFormatSchema.optional().default('Sponsored Post'),
      })
    )
    .min(1)
    .max(50),
});

const draftOutreachSchema = z.object({
  leadId: z.string().trim().min(1),
  yourOffer: z.string().trim().min(5).max(800),
  channel: z.enum(['Email', 'Nextdoor DM', 'LinkedIn']).default('Email'),
  tone: z.enum(['Direct & Concise', 'Consultative', 'Neighborly']).default('Direct & Concise'),
});

const createSequenceSchema = z.object({
  name: z.string().trim().min(2).max(140),
  targetNiche: z.string().trim().min(2).max(140),
  status: z.enum(['Active', 'Draft', 'Paused']).default('Draft'),
  enrolledCount: z.number().int().min(0).max(10000).default(0),
  replyRateLabel: z.string().trim().max(60).default('New sequence'),
  steps: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(60),
        dayOffset: z.number().int().min(0).max(90),
        channel: z.enum(['Email', 'Nextdoor DM', 'Phone Call', 'LinkedIn']),
        subject: z.string().trim().max(200),
        body: z.string().trim().min(5).max(3000),
      })
    )
    .min(1)
    .max(10),
});

function csvCell(value: string): string {
  const formulaSafe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  const safe = formulaSafe.replace(/"/g, '""');
  return `"${safe}"`;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Workspace snapshot
  app.get('/api/workspace', (_req, res) => {
    res.json(getWorkspace());
  });

  // Create single lead
  app.post('/api/leads', (req, res) => {
    const parsed = createLeadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid lead payload', details: parsed.error.flatten() });
      return;
    }
    const lead = createLead({
      ...parsed.data,
      enrichmentSteps: [],
    });
    res.status(201).json({ lead });
  });

  // Bulk import leads
  app.post('/api/leads/bulk', (req, res) => {
    const schema = z.object({
      leads: z.array(createLeadSchema).min(1).max(50),
      sourceRepo: z.string().trim().max(120).optional(),
      neighborhood: z.string().trim().max(120).optional(),
      summary: z.string().trim().max(240).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid bulk lead payload', details: parsed.error.flatten() });
      return;
    }
    const created = createLeadsBulk(
      parsed.data.leads.map((item) => ({ ...item, enrichmentSteps: [] })),
      parsed.data.sourceRepo
        ? {
            sourceRepo: parsed.data.sourceRepo,
            neighborhood: parsed.data.neighborhood || 'Multi-Neighborhood',
            summary:
              parsed.data.summary ||
              `Imported ${parsed.data.leads.length} lead(s) from ${parsed.data.sourceRepo}`,
          }
        : undefined
    );
    res.status(201).json({
      created,
      skippedDuplicates: parsed.data.leads.length - created.length,
    });
  });

  // Update lead
  app.patch('/api/leads/:id', (req, res) => {
    const parsed = patchLeadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid update payload', details: parsed.error.flatten() });
      return;
    }
    const updated = updateLead(req.params.id, parsed.data);
    if (!updated) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }
    res.json({ lead: updated });
  });

  // Delete lead
  app.delete('/api/leads/:id', (req, res) => {
    const deleted = deleteLead(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }
    res.json({ ok: true });
  });

  // Export CRM leads as CSV
  app.get('/api/leads/export.csv', (_req, res) => {
    const { leads } = getWorkspace();
    const header = [
      'Company',
      'Contact Name',
      'Role',
      'Category',
      'Neighborhood',
      'City',
      'Email',
      'Email Status',
      'Phone',
      'Website',
      'Nextdoor URL',
      'Stage',
      'Source',
      'Source Repo',
      'Ad Format',
      'Ad Headline',
      'Ad Offer',
    ];
    const rows = leads.map((l) =>
      [
        l.companyName,
        l.contactName,
        l.contactRole,
        l.category,
        l.neighborhood,
        l.city,
        l.email,
        l.emailStatus,
        l.phone,
        l.website,
        l.nextdoorUrl,
        l.stage,
        l.source,
        l.sourceRepo || '',
        l.adFormat,
        l.adHeadline,
        l.adOffer,
      ]
        .map((v) => csvCell(String(v ?? '')))
        .join(',')
    );
    const csv = [header.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="fyndergrid-leads.csv"');
    res.send(csv);
  });

  // Live Grounded Lead & Nextdoor Discovery
  app.post('/api/discover', async (req, res) => {
    const parsed = discoverSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Please provide a valid niche and location.' });
      return;
    }
    try {
      const result = await discoverProspects(parsed.data);
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Discovery failed';
      res.status(502).json({ error: message });
    }
  });

  // Live GitHub Curated Nextdoor Scraper Repos
  app.get('/api/scraper/github/curated', async (_req, res) => {
    try {
      const repos = await fetchCuratedNextdoorRepos();
      res.json({ repos });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load GitHub repositories';
      res.status(502).json({ error: message });
    }
  });

  // Live GitHub Repo Search
  app.get('/api/scraper/github/search', async (req, res) => {
    const query = typeof req.query.q === 'string' ? req.query.q : 'nextdoor scraper';
    try {
      const result = await searchGithubNextdoorRepos(query);
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'GitHub search failed';
      res.status(502).json({ error: message });
    }
  });

  // Live GitHub Repo README Preview
  app.get('/api/scraper/github/readme', async (req, res) => {
    const owner = typeof req.query.owner === 'string' ? req.query.owner : '';
    const repo = typeof req.query.repo === 'string' ? req.query.repo : '';
    try {
      const result = await fetchGithubRepoReadme(owner, repo);
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to fetch README';
      res.status(400).json({ error: message });
    }
  });

  // Parse pasted Nextdoor feed / HTML / JSON export from GitHub scrapers
  app.post('/api/scraper/parse', async (req, res) => {
    const parsed = parseFeedSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Paste at least 15 characters of Nextdoor HTML, JSON, or feed text.' });
      return;
    }
    try {
      const result = await parseNextdoorFeedPayload(parsed.data);
      let savedLeads: Lead[] = [];
      if (parsed.data.autoSave && result.extracted.length > 0) {
        savedLeads = createLeadsBulk(
          result.extracted.map((item) => ({
            ...item,
            emailStatus: item.email ? 'unverified' : 'missing',
            source: 'nextdoor_ad',
            sourceRepo: parsed.data.sourceRepo,
            stage: 'new',
            citations: [],
            enrichmentSteps: [],
          })),
          {
            sourceRepo: parsed.data.sourceRepo,
            neighborhood: parsed.data.neighborhoodHint || parsed.data.cityHint || 'Parsed Feed',
            summary: result.summary,
          }
        );
      }
      res.json({ ...result, savedLeads });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to parse Nextdoor payload';
      res.status(502).json({ error: message });
    }
  });

  // Direct Webhook Ingest endpoint for local GitHub Python/Selenium/Playwright scripts
  app.post('/api/ingest/nextdoor', (req, res) => {
    const parsed = webhookIngestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid webhook payload', details: parsed.error.flatten() });
      return;
    }
    const created = createLeadsBulk(
      parsed.data.records.map((r) => ({
        companyName: r.companyName,
        contactName: r.contactName,
        contactRole: 'Owner',
        category: r.category,
        neighborhood: r.neighborhood || parsed.data.neighborhood,
        city: r.city || parsed.data.city,
        email: r.email,
        emailStatus: r.email ? 'unverified' : 'missing',
        phone: r.phone,
        website: r.website,
        nextdoorUrl: r.nextdoorUrl,
        source: 'webhook_ingest',
        sourceRepo: parsed.data.sourceRepo,
        stage: 'new',
        adHeadline: r.adHeadline || `${r.companyName} — Nextdoor Sponsored Ad`,
        adBody: r.adBody,
        adOffer: r.adOffer,
        adFormat: r.adFormat,
        notes: `Ingested live via /api/ingest/nextdoor from ${parsed.data.sourceRepo}`,
        citations: [],
        enrichmentSteps: [],
      })),
      {
        sourceRepo: parsed.data.sourceRepo,
        neighborhood: parsed.data.neighborhood,
        summary: `Webhook received ${parsed.data.records.length} scraped Nextdoor ad record(s)`,
      }
    );
    res.status(201).json({
      ingested: created.length,
      skippedDuplicates: parsed.data.records.length - created.length,
      leads: created,
    });
  });

  // Waterfall Enrichment for a saved lead
  app.post('/api/enrich/:id', async (req, res) => {
    const lead = getLeadById(req.params.id);
    if (!lead) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }
    try {
      const { patch, steps, citations } = await runWaterfallEnrichment(lead);
      const updated = updateLead(lead.id, patch);
      res.json({ lead: updated, steps, citations });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Enrichment failed';
      res.status(502).json({ error: message });
    }
  });

  // Draft personalized outreach for a lead
  app.post('/api/outreach/draft', async (req, res) => {
    const parsed = draftOutreachSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Provide a valid lead and offer pitch.' });
      return;
    }
    const lead = getLeadById(parsed.data.leadId);
    if (!lead) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }
    try {
      const draft = await draftPersonalizedOutreach({
        lead,
        yourOffer: parsed.data.yourOffer,
        channel: parsed.data.channel,
        tone: parsed.data.tone,
      });
      res.json(draft);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to generate outreach draft';
      res.status(502).json({ error: message });
    }
  });

  // Sequences CRUD
  app.post('/api/sequences', (req, res) => {
    const parsed = createSequenceSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid sequence payload', details: parsed.error.flatten() });
      return;
    }
    const sequence = createSequence(parsed.data);
    res.status(201).json({ sequence });
  });

  app.patch('/api/sequences/:id', (req, res) => {
    const parsed = createSequenceSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid sequence update' });
      return;
    }
    const updated = updateSequence(req.params.id, parsed.data);
    if (!updated) {
      res.status(404).json({ error: 'Sequence not found' });
      return;
    }
    res.json({ sequence: updated });
  });

  app.delete('/api/sequences/:id', (req, res) => {
    const ok = deleteSequence(req.params.id);
    if (!ok) {
      res.status(404).json({ error: 'Sequence not found' });
      return;
    }
    res.json({ ok: true });
  });

  // Mount Vite dev middleware or serve static build
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FynderGrid server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start FynderGrid server:', err);
  process.exit(1);
});
