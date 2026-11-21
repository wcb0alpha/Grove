import type { GithubRepoSummary } from '../src/types/leads.ts';

interface CuratedRepoSeed {
  owner: string;
  name: string;
  category: GithubRepoSummary['category'];
  integrationNote: string;
  fallbackDescription: string;
  fallbackLanguage: string;
}

const CURATED_REPOS: CuratedRepoSeed[] = [
  {
    owner: 'chanwooh',
    name: 'Nextdoor-Script',
    category: 'Post & Feed Scraper',
    integrationNote:
      'Selenium-driven neighborhood feed & post extractor. Export scraped JSON and drop it into FynderGrid Parser or POST to /api/ingest/nextdoor.',
    fallbackDescription:
      'Python + Selenium automation script for scraping Nextdoor neighborhood posts, sponsored feed items, and comments.',
    fallbackLanguage: 'Python',
  },
  {
    owner: 'krautsdubisq1g',
    name: 'nextdoor-business-scraper',
    category: 'Business Directory',
    integrationNote:
      'Targets local Nextdoor business pages, addresses, phones, and neighbor recommendations in JSON format.',
    fallbackDescription:
      'Scraper for extracting local business profiles, recommendations, and directory listings from Nextdoor into structured JSON.',
    fallbackLanguage: 'Python',
  },
  {
    owner: 'DrBenedictPorkins',
    name: 'sponsored-blur-nextdoor',
    category: 'Sponsored Ad Parser',
    integrationNote:
      'Documents DOM selector logic to detect obfuscated "Sponsored" ad labels in the Nextdoor feed — mirrored in our Script Builder.',
    fallbackDescription:
      'Browser extension parsing Nextdoor sponsored posts and character-obfuscated ad containers directly in the DOM.',
    fallbackLanguage: 'JavaScript',
  },
  {
    owner: 'MeltanoLabs',
    name: 'tap-nextdoor',
    category: 'Nextdoor Ads API',
    integrationNote:
      'Singer/Meltano ELT tap for the official Nextdoor Ads v2 API (campaigns, ad groups, creatives, and audience metrics).',
    fallbackDescription:
      'Meltano / Singer tap for extracting advertising campaign and creative data from the Nextdoor Ads API.',
    fallbackLanguage: 'Python',
  },
  {
    owner: 'RosenAdvertising',
    name: 'nextdoorads-mcp',
    category: 'Nextdoor Ads API',
    integrationNote:
      'MCP server exposing Nextdoor Ads API endpoints for automated campaign reporting and creative inspection.',
    fallbackDescription:
      'Model Context Protocol server for interacting with Nextdoor Ads data and advertising workflows.',
    fallbackLanguage: 'TypeScript',
  },
  {
    owner: 'everyl12',
    name: 'Nextdoor-Scraper',
    category: 'Post & Feed Scraper',
    integrationNote:
      'Automated browser-driver harvester for structured Nextdoor community feeds and local service mentions.',
    fallbackDescription:
      'Automated browser scraper using WebDriver to capture structured Nextdoor feed records.',
    fallbackLanguage: 'Python',
  },
];

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'FynderGrid-LeadEngine/1.0',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

const VALID_SEGMENT = /^[a-zA-Z0-9._-]{1,100}$/;

function mapGithubApiRepo(
  data: Record<string, unknown>,
  seed?: CuratedRepoSeed
): GithubRepoSummary {
  const ownerObj = (data.owner as Record<string, unknown> | undefined) ?? {};
  const licenseObj = (data.license as Record<string, unknown> | undefined) ?? {};
  const owner = String(ownerObj.login ?? seed?.owner ?? '');
  const name = String(data.name ?? seed?.name ?? '');
  const fullName = String(data.full_name ?? `${owner}/${name}`);
  return {
    fullName,
    owner,
    name,
    description: String(data.description ?? seed?.fallbackDescription ?? 'Open-source Nextdoor scraping repository'),
    htmlUrl: String(data.html_url ?? `https://github.com/${owner}/${name}`),
    stars: Number(data.stargazers_count ?? 0),
    forks: Number(data.forks_count ?? 0),
    language: String(data.language ?? seed?.fallbackLanguage ?? 'Unknown'),
    updatedAt: String(data.pushed_at ?? data.updated_at ?? ''),
    topics: Array.isArray(data.topics) ? (data.topics as string[]).slice(0, 5) : [],
    license: String(licenseObj.spdx_id ?? 'Unspecified'),
    category: seed?.category ?? inferCategory(fullName, String(data.description ?? '')),
    integrationNote:
      seed?.integrationNote ??
      'Export JSON/CSV from this GitHub scraper and import via FynderGrid Parser or POST /api/ingest/nextdoor.',
    isLiveFetched: true,
  };
}

function inferCategory(fullName: string, desc: string): GithubRepoSummary['category'] {
  const text = `${fullName} ${desc}`.toLowerCase();
  if (text.includes('ad') || text.includes('sponsored')) return 'Sponsored Ad Parser';
  if (text.includes('business') || text.includes('directory')) return 'Business Directory';
  if (text.includes('mcp') || text.includes('tap-') || text.includes('api')) return 'Nextdoor Ads API';
  return 'Post & Feed Scraper';
}

export async function fetchCuratedNextdoorRepos(): Promise<GithubRepoSummary[]> {
  const results = await Promise.all(
    CURATED_REPOS.map(async (seed): Promise<GithubRepoSummary> => {
      try {
        const res = await fetch(
          `https://api.github.com/repos/${encodeURIComponent(seed.owner)}/${encodeURIComponent(seed.name)}`,
          {
            headers: githubHeaders(),
            signal: AbortSignal.timeout(5000),
          }
        );
        if (res.ok) {
          const json = (await res.json()) as Record<string, unknown>;
          return mapGithubApiRepo(json, seed);
        }
      } catch {
        // Fallback to curated baseline metadata if GitHub rate-limits unauthenticated traffic
      }
      return {
        fullName: `${seed.owner}/${seed.name}`,
        owner: seed.owner,
        name: seed.name,
        description: seed.fallbackDescription,
        htmlUrl: `https://github.com/${seed.owner}/${seed.name}`,
        stars: 0,
        forks: 0,
        language: seed.fallbackLanguage,
        updatedAt: '',
        topics: ['nextdoor', 'scraper'],
        license: 'See GitHub',
        category: seed.category,
        integrationNote: seed.integrationNote,
        isLiveFetched: false,
      };
    })
  );

  return results;
}

export async function searchGithubNextdoorRepos(query: string): Promise<{
  repos: GithubRepoSummary[];
  totalCount: number;
  rateLimited: boolean;
}> {
  const sanitized = query.trim().slice(0, 80) || 'nextdoor scraper';
  const finalQuery = sanitized.toLowerCase().includes('nextdoor')
    ? sanitized
    : `nextdoor ${sanitized}`;

  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(
    finalQuery
  )}&sort=stars&order=desc&per_page=10`;

  const res = await fetch(url, {
    headers: githubHeaders(),
    signal: AbortSignal.timeout(7000),
  });

  if (res.status === 403 || res.status === 429) {
    return { repos: [], totalCount: 0, rateLimited: true };
  }

  if (!res.ok) {
    throw new Error(`GitHub search returned HTTP ${res.status}`);
  }

  const data = (await res.json()) as {
    total_count?: number;
    items?: Array<Record<string, unknown>>;
  };

  const repos = (data.items ?? []).map((item) => mapGithubApiRepo(item));
  return {
    repos,
    totalCount: Number(data.total_count ?? repos.length),
    rateLimited: false,
  };
}

export async function fetchGithubRepoReadme(
  owner: string,
  repo: string
): Promise<{ content: string; htmlUrl: string }> {
  if (!VALID_SEGMENT.test(owner) || !VALID_SEGMENT.test(repo)) {
    throw new Error('Invalid repository owner or name.');
  }

  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/readme`;
  const res = await fetch(url, {
    headers: githubHeaders(),
    signal: AbortSignal.timeout(6000),
  });

  if (!res.ok) {
    throw new Error(`README unavailable (GitHub HTTP ${res.status}).`);
  }

  const json = (await res.json()) as {
    content?: string;
    encoding?: string;
    html_url?: string;
  };

  let decoded = '';
  if (json.content && json.encoding === 'base64') {
    decoded = Buffer.from(json.content.replace(/\n/g, ''), 'base64').toString('utf-8');
  }

  return {
    content: decoded.slice(0, 8000),
    htmlUrl: json.html_url || `https://github.com/${owner}/${repo}`,
  };
}
