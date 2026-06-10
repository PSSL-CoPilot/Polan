/**
 * Generates `public/sample-lineage.xlsx` — a ready-to-upload demo workbook so
 * the lineage features (multi-sheet, dense fan-out + "Show more", and the
 * Power BI → Dataset → Report chain) are easy to test.
 *
 * Run:  node scripts/generate-sample.mjs
 *
 * Expected sheet shape (column names must match exactly — spaces included):
 *   | Source Asset | Impacted Asset | Direction | Qualified Name |
 *   Qualified Name = part1/part2/part3/<project>/<dataset>/<table>
 *     → Project Name = 4th part, Dataset Name = 5th part, Table Name = last part
 *   Dataset tokens drive Layers/MDR: USL|GSL→Gold, INT→Silver, STG|base→Raw.
 */
import * as XLSX from 'xlsx'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const COLUMNS = ['Source Asset', 'Impacted Asset', 'Direction', 'Qualified Name']
const qn = (project, dataset, table) =>
  `datalake/prod/bq/${project}/${dataset}/${table}`

// ── Sheet 1: Sales — one Power BI table with a dense upstream fan-out ──────────
const salesPbi = 'Sales Dashboard Model'
const salesRows = []

// 8 upstream BigQuery tables → triggers the "show 3 + Show more" grouping.
const upstreamTables = [
  ['analytics', 'orders_USL', 'orders'],
  ['analytics', 'customers_GSL', 'customers'],
  ['analytics', 'products_INT', 'products'],
  ['analytics', 'returns_STG', 'returns'],
  ['analytics', 'shipping_base', 'shipping'],
  ['finance', 'invoices_USL', 'invoices'],
  ['finance', 'payments_INT', 'payments'],
  ['finance', 'ledger_raw', 'ledger'],
]
for (const [project, dataset, table] of upstreamTables) {
  salesRows.push({
    'Source Asset': salesPbi,
    'Impacted Asset': `bq_${table}`,
    Direction: 'upstream',
    'Qualified Name': qn(project, dataset, table),
  })
}

// Downstream: 1 dataset + 5 reports → chains to Power BI → Dataset → Report.
salesRows.push({
  'Source Asset': salesPbi,
  'Impacted Asset': 'Sales Semantic Dataset',
  Direction: 'downstream',
  'Qualified Name': qn('analytics', 'sales_USL', 'sales_semantic_dataset'),
})
for (const name of [
  'Executive Revenue Report',
  'Regional Sales Report',
  'Margin Analysis Report',
  'Forecast Report',
  'Channel Performance Report',
]) {
  salesRows.push({
    'Source Asset': salesPbi,
    'Impacted Asset': name,
    Direction: 'downstream',
    'Qualified Name': qn('analytics', 'sales_USL', name.toLowerCase().replace(/\s+/g, '_')),
  })
}

// ── Sheet 2: Marketing — a second, smaller lineage + an incomplete row ────────
const mktPbi = 'Marketing Attribution Model'
const marketingRows = [
  {
    'Source Asset': mktPbi,
    'Impacted Asset': 'bq_campaign_events',
    Direction: 'upstream',
    'Qualified Name': qn('marketing', 'events_INT', 'campaign_events'),
  },
  {
    'Source Asset': mktPbi,
    'Impacted Asset': 'bq_web_sessions',
    Direction: 'upstream',
    'Qualified Name': qn('marketing', 'web_STG', 'web_sessions'),
  },
  {
    'Source Asset': mktPbi,
    'Impacted Asset': 'Marketing Dataset',
    Direction: 'downstream',
    'Qualified Name': qn('marketing', 'mkt_GSL', 'marketing_dataset'),
  },
  {
    'Source Asset': mktPbi,
    'Impacted Asset': 'Attribution Report',
    Direction: 'downstream',
    'Qualified Name': qn('marketing', 'mkt_GSL', 'attribution_report'),
  },
  // Incomplete qualified name → app should warn, not crash.
  {
    'Source Asset': mktPbi,
    'Impacted Asset': 'bq_partial_source',
    Direction: 'upstream',
    'Qualified Name': 'short/name',
  },
]

const workbook = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(
  workbook,
  XLSX.utils.json_to_sheet(salesRows, { header: COLUMNS }),
  'Sales Lineage',
)
XLSX.utils.book_append_sheet(
  workbook,
  XLSX.utils.json_to_sheet(marketingRows, { header: COLUMNS }),
  'Marketing Lineage',
)

const outDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public')
mkdirSync(outDir, { recursive: true })
const outPath = resolve(outDir, 'sample-lineage.xlsx')
const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' })
writeFileSync(outPath, buffer)
console.log(`Wrote ${salesRows.length + marketingRows.length} rows → ${outPath}`)
