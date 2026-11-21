import type { LeadSource, LeadStage } from '../types/leads';

export function safeExternalUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

export function formatShortDate(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function stageLabel(stage: LeadStage): string {
  switch (stage) {
    case 'new':
      return 'New';
    case 'enriched':
      return 'Enriched';
    case 'contacted':
      return 'Contacted';
    case 'replied':
      return 'Replied';
    case 'qualified':
      return 'Qualified';
  }
}

export function sourceLabel(source: LeadSource): string {
  switch (source) {
    case 'nextdoor_ad':
      return 'Nextdoor UK Ad';
    case 'nextdoor_page':
      return 'Nextdoor UK Page';
    case 'github_import':
      return 'GitHub Import';
    case 'web_discovery':
      return 'UK Web Discovery';
    case 'webhook_ingest':
      return 'Webhook Ingest';
  }
}

export function emailStatusLabel(
  status: 'verified_mx' | 'pattern_only' | 'unverified' | 'missing'
): string {
  switch (status) {
    case 'verified_mx':
      return 'MX Verified';
    case 'pattern_only':
      return 'Pattern Match';
    case 'unverified':
      return 'Unverified';
    case 'missing':
      return 'Missing';
  }
}

export interface ScriptBuilderConfig {
  runtime: 'python_playwright' | 'python_selenium' | 'node_playwright';
  targetMode: 'sponsored_ads' | 'business_directory';
  neighborhood: string;
  city: string;
  keywords: string;
  maxScrolls: number;
  sourceRepo: string;
  webhookUrl: string;
}

export function generateScraperScript(cfg: ScriptBuilderConfig): {
  filename: string;
  language: string;
  code: string;
} {
  const safeNeighborhood = cfg.neighborhood.trim() || 'Clifton & Redland (BS8)';
  const safeCity = cfg.city.trim() || 'Bristol, UK';
  const safeKeywords = cfg.keywords.trim() || 'roofing, boiler, landscaping, dental, solar';
  const safeRepo = cfg.sourceRepo.trim() || 'chanwooh/Nextdoor-Script';
  const safeWebhook = cfg.webhookUrl.trim() || 'http://localhost:3000/api/ingest/nextdoor';

  if (cfg.runtime === 'node_playwright') {
    return {
      filename: 'nextdoor_uk_ad_scraper.mjs',
      language: 'JavaScript (Node.js + Playwright — UK)',
      code: `/**
 * FynderGrid Nextdoor UK Ad & Business Scraper (Node.js + Playwright)
 * Inspired by: ${safeRepo} & DrBenedictPorkins/sponsored-blur-nextdoor
 * Target UK Area: ${safeNeighborhood}, ${safeCity}
 *
 * Install: npm i playwright
 * Run:     NEXTDOOR_EMAIL="you@domain.co.uk" NEXTDOOR_PASS="..." node nextdoor_uk_ad_scraper.mjs
 */
import { chromium } from 'playwright';

const WEBHOOK_URL = ${JSON.stringify(safeWebhook)};
const NEIGHBOURHOOD = ${JSON.stringify(safeNeighborhood)};
const CITY = ${JSON.stringify(safeCity)};
const KEYWORDS = ${JSON.stringify(safeKeywords)}.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean);
const MAX_SCROLLS = ${cfg.maxScrolls};

function isObfuscatedSponsored(text) {
  // Detects split-character / zero-width obfuscated "Sponsored" labels used in Nextdoor UK DOM
  const normalized = text.replace(/[\\u200B-\\u200D\\uFEFF\\s]/g, '').toLowerCase();
  return normalized.includes('sponsored') || normalized.includes('promotedby') || normalized.includes('localdeal');
}

async function run() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ locale: 'en-GB' });

  await page.goto('https://nextdoor.co.uk/login/', { waitUntil: 'domcontentloaded' });
  if (process.env.NEXTDOOR_EMAIL && process.env.NEXTDOOR_PASS) {
    await page.fill('input[name="email"]', process.env.NEXTDOOR_EMAIL);
    await page.fill('input[name="password"]', process.env.NEXTDOOR_PASS);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);
  } else {
    console.log('Complete Nextdoor UK sign-in in browser window (waiting 25s)...');
    await page.waitForTimeout(25000);
  }

  const targetUrl = ${
    cfg.targetMode === 'business_directory'
      ? "'https://nextdoor.co.uk/pages/'"
      : "'https://nextdoor.co.uk/news_feed/'"
  };
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const captured = new Map();

  for (let i = 0; i < MAX_SCROLLS; i++) {
    const cards = await page.$$eval('article, [data-testid*="feed-item"], [data-testid*="business-card"]', (els) =>
      els.map((el) => ({
        text: el.innerText || '',
        links: Array.from(el.querySelectorAll('a[href]')).map((a) => a.href),
      }))
    );

    for (const card of cards) {
      const sponsoredMatch = ${cfg.targetMode === 'sponsored_ads' ? 'isObfuscatedSponsored(card.text)' : 'true'};
      if (!sponsoredMatch) continue;

      const lines = card.text.split('\\n').map((l) => l.trim()).filter(Boolean);
      if (lines.length < 2) continue;

      const companyName = lines[0].slice(0, 120);
      const bodyText = lines.slice(1).join(' ').slice(0, 1200);
      if (KEYWORDS.length > 0 && !KEYWORDS.some((kw) => bodyText.toLowerCase().includes(kw) || companyName.toLowerCase().includes(kw))) {
        continue;
      }

      const nextdoorUrl = card.links.find((u) => u.includes('nextdoor.co.uk/pages/')) || '';
      const website = card.links.find((u) => !u.includes('nextdoor.co.uk') && !u.includes('nextdoor.com') && u.startsWith('http')) || '';
      const phoneMatch = bodyText.match(/(?:\\+44\\s?|0)(?:\\d[-\\s]?){9,10}/);

      captured.set(companyName.toLowerCase(), {
        companyName,
        category: KEYWORDS[0] || 'UK Local Service',
        neighborhood: NEIGHBOURHOOD,
        city: CITY,
        phone: phoneMatch ? phoneMatch[0].trim() : '',
        website,
        nextdoorUrl,
        adHeadline: lines[1]?.slice(0, 160) || companyName,
        adBody: bodyText,
        adOffer: lines.find((l) => /£|%|free|off|deal|quote|survey/i.test(l))?.slice(0, 140) || 'Sponsored offer',
        adFormat: ${cfg.targetMode === 'business_directory' ? "'Business Page'" : "'Sponsored Post'"},
      });
    }

    await page.mouse.wheel(0, 1400);
    await page.waitForTimeout(1800);
  }

  await browser.close();

  const records = Array.from(captured.values());
  console.log(\`Captured \${records.length} Nextdoor UK records. Posting to FynderGrid...\`);

  if (records.length > 0) {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceRepo: ${JSON.stringify(safeRepo)},
        neighborhood: NEIGHBOURHOOD,
        city: CITY,
        records,
      }),
    });
    console.log('FynderGrid ingest status:', res.status, await res.text());
  }
}

run().catch(console.error);
`,
    };
  }

  if (cfg.runtime === 'python_selenium') {
    return {
      filename: 'nextdoor_uk_selenium_scraper.py',
      language: 'Python (Selenium — Nextdoor-Script UK)',
      code: `"""
FynderGrid Nextdoor UK Ad & Directory Scraper (Python + Selenium)
Modeled on GitHub repos: ${safeRepo} & krautsdubisq1g/nextdoor-business-scraper
Target UK Area: ${safeNeighborhood}, ${safeCity}

Install: pip install selenium requests
Run:     NEXTDOOR_EMAIL="you@domain.co.uk" NEXTDOOR_PASS="..." python nextdoor_uk_selenium_scraper.py
"""
import os
import re
import time
import json
import requests
from selenium import webdriver
from selenium.webdriver.common.by import By

WEBHOOK_URL = ${JSON.stringify(safeWebhook)}
NEIGHBOURHOOD = ${JSON.stringify(safeNeighborhood)}
CITY = ${JSON.stringify(safeCity)}
KEYWORDS = [k.strip().lower() for k in ${JSON.stringify(safeKeywords)}.split(",") if k.strip()]
MAX_SCROLLS = ${cfg.maxScrolls}

def is_sponsored_card(raw_text: str) -> bool:
    collapsed = re.sub(r"[\\s\\u200b-\\u200d\\ufeff]+", "", raw_text).lower()
    return "sponsored" in collapsed or "promotedby" in collapsed or "localdeal" in collapsed

def main():
    driver = webdriver.Chrome()
    driver.get("https://nextdoor.co.uk/login/")

    email = os.getenv("NEXTDOOR_EMAIL", "")
    password = os.getenv("NEXTDOOR_PASS", "")
    if email and password:
        time.sleep(2)
        driver.find_element(By.NAME, "email").send_keys(email)
        driver.find_element(By.NAME, "password").send_keys(password)
        driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()
        time.sleep(6)
    else:
        print("Sign into Nextdoor UK manually in the opened browser window (waiting 25s)...")
        time.sleep(25)

    driver.get(${
      cfg.targetMode === 'business_directory'
        ? '"https://nextdoor.co.uk/pages/"'
        : '"https://nextdoor.co.uk/news_feed/"'
    })
    time.sleep(3)

    captured = {}
    uk_phone_re = re.compile(r"(?:\\+44\\s?|0)(?:\\d[-\\s]?){9,10}")

    for _ in range(MAX_SCROLLS):
        elements = driver.find_elements(By.CSS_SELECTOR, "article, [data-testid*='feed-item']")
        for el in elements:
            text = el.text or ""
            if ${cfg.targetMode === 'sponsored_ads' ? 'not is_sponsored_card(text)' : 'False'}:
                continue
            lines = [line.strip() for line in text.splitlines() if line.strip()]
            if len(lines) < 2:
                continue

            company = lines[0][:120]
            body = " ".join(lines[1:])[:1200]
            if KEYWORDS and not any(kw in body.lower() or kw in company.lower() for kw in KEYWORDS):
                continue

            phone_match = uk_phone_re.search(body)
            captured[company.lower()] = {
                "companyName": company,
                "category": KEYWORDS[0] if KEYWORDS else "UK Local Business",
                "neighborhood": NEIGHBOURHOOD,
                "city": CITY,
                "phone": phone_match.group(0).strip() if phone_match else "",
                "adHeadline": lines[1][:160],
                "adBody": body,
                "adOffer": next((l[:140] for l in lines if any(t in l.lower() for t in ["£", "%", "free", "off", "deal", "survey"])), "Sponsored offer"),
                "adFormat": ${cfg.targetMode === 'business_directory' ? '"Business Page"' : '"Sponsored Post"'},
            }

        driver.execute_script("window.scrollBy(0, 1400);")
        time.sleep(2)

    driver.quit()
    records = list(captured.values())

    with open("nextdoor_uk_ads_export.json", "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2)

    print(f"Saved {len(records)} UK records to nextdoor_uk_ads_export.json")
    if records:
        resp = requests.post(
            WEBHOOK_URL,
            json={
                "sourceRepo": ${JSON.stringify(safeRepo)},
                "neighborhood": NEIGHBOURHOOD,
                "city": CITY,
                "records": records,
            },
            timeout=15,
        )
        print("FynderGrid webhook response:", resp.status_code, resp.text)

if __name__ == "__main__":
    main()
`,
    };
  }

  return {
    filename: 'nextdoor_uk_playwright_scraper.py',
    language: 'Python (Playwright — UK)',
    code: `"""
FynderGrid Nextdoor UK Ad & Business Scraper (Python + Playwright)
Compatible with: ${safeRepo} + FynderGrid /api/ingest/nextdoor webhook
Target UK Area: ${safeNeighborhood}, ${safeCity}

Install: pip install playwright requests && playwright install chromium
Run:     NEXTDOOR_EMAIL="you@domain.co.uk" NEXTDOOR_PASS="..." python nextdoor_uk_playwright_scraper.py
"""
import os
import re
import json
import requests
from playwright.sync_api import sync_playwright

WEBHOOK_URL = ${JSON.stringify(safeWebhook)}
NEIGHBOURHOOD = ${JSON.stringify(safeNeighborhood)}
CITY = ${JSON.stringify(safeCity)}
KEYWORDS = [k.strip().lower() for k in ${JSON.stringify(safeKeywords)}.split(",") if k.strip()]
MAX_SCROLLS = ${cfg.maxScrolls}

def is_sponsored(text: str) -> bool:
    # Handles Nextdoor UK split-span & zero-width character obfuscation
    collapsed = re.sub(r"[\\s\\u200b-\\u200d\\ufeff]+", "", text).lower()
    return "sponsored" in collapsed or "promotedby" in collapsed or "localdeal" in collapsed

def run():
    captured = {}
    uk_phone_re = re.compile(r"(?:\\+44\\s?|0)(?:\\d[-\\s]?){9,10}")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(locale="en-GB")
        page = context.new_page()
        page.goto("https://nextdoor.co.uk/login/")

        email = os.getenv("NEXTDOOR_EMAIL", "")
        password = os.getenv("NEXTDOOR_PASS", "")
        if email and password:
            page.fill("input[name='email']", email)
            page.fill("input[name='password']", password)
            page.click("button[type='submit']")
            page.wait_for_timeout(5000)
        else:
            print("Sign in to Nextdoor UK via browser window (waiting 25s)...")
            page.wait_for_timeout(25000)

        page.goto(${
          cfg.targetMode === 'business_directory'
            ? '"https://nextdoor.co.uk/pages/"'
            : '"https://nextdoor.co.uk/news_feed/"'
        })
        page.wait_for_timeout(3000)

        for _ in range(MAX_SCROLLS):
            cards = page.locator("article, [data-testid*='feed-item']").all()
            for card in cards:
                text = card.inner_text()
                if ${cfg.targetMode === 'sponsored_ads' ? 'not is_sponsored(text)' : 'False'}:
                    continue
                lines = [l.strip() for l in text.splitlines() if l.strip()]
                if len(lines) < 2:
                    continue
                company = lines[0][:120]
                body = " ".join(lines[1:])[:1200]
                if KEYWORDS and not any(kw in body.lower() or kw in company.lower() for kw in KEYWORDS):
                    continue
                phone = uk_phone_re.search(body)
                captured[company.lower()] = {
                    "companyName": company,
                    "category": KEYWORDS[0] if KEYWORDS else "UK Local Service",
                    "neighborhood": NEIGHBOURHOOD,
                    "city": CITY,
                    "phone": phone.group(0).strip() if phone else "",
                    "adHeadline": lines[1][:160],
                    "adBody": body,
                    "adOffer": next((l[:140] for l in lines if any(x in l.lower() for x in ["£", "%", "free", "off", "deal", "survey"])), "Sponsored offer"),
                    "adFormat": ${cfg.targetMode === 'business_directory' ? '"Business Page"' : '"Sponsored Post"'},
                }
            page.mouse.wheel(0, 1400)
            page.wait_for_timeout(1600)

        browser.close()

    records = list(captured.values())
    with open("nextdoor_uk_ads_export.json", "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2)

    if records:
        res = requests.post(
            WEBHOOK_URL,
            json={
                "sourceRepo": ${JSON.stringify(safeRepo)},
                "neighborhood": NEIGHBOURHOOD,
                "city": CITY,
                "records": records,
            },
            timeout=15,
        )
        print(f"Pushed {len(records)} UK leads to FynderGrid -> HTTP {res.status_code}")

if __name__ == "__main__":
    run()
`,
  };
}
