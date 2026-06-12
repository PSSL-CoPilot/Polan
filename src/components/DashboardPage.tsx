import {
  BarChart3,
  Database,
  FileBarChart2,
  Layers,
  Layers3,
  ShieldCheck,
  ShieldX,
  Star,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { useMemo } from 'react'
import type { ProcessedRow, SheetData, UploadedWorkbook } from '../types'

interface DashboardPageProps {
  workbooks: UploadedWorkbook[]
  activeWorkbookId: string | null
  onSelectWorkbook: (id: string) => void
  sheets: SheetData[]
  selectedSheet: string
  onSheetChange: (sheet: string) => void
  rows: ProcessedRow[]
}

type KpiAccent =
  | 'violet' | 'indigo' | 'teal'
  | 'gold' | 'silver' | 'bronze'
  | 'green' | 'red' | 'pink' | 'cyan'

interface KpiCard {
  label: string
  value: number
  icon: React.ReactNode
  accent: KpiAccent
  sub: string
}

export function DashboardPage({
  workbooks,
  activeWorkbookId,
  onSelectWorkbook,
  sheets,
  selectedSheet,
  onSheetChange,
  rows,
}: DashboardPageProps) {
  const stats = useMemo(() => {
    const upRows = rows.filter((r) => r.direction === 'upstream')
    const downRows = rows.filter((r) => r.direction === 'downstream')

    const totalAssets = new Set([
      ...rows.map((r) => r.sourceAsset).filter(Boolean),
      ...rows.map((r) => r.impactedAsset).filter(Boolean),
    ]).size

    const upstreamAssets = new Set(
      upRows.map((r) => r.impactedAsset).filter(Boolean),
    ).size

    const downstreamAssets = new Set(
      downRows.map((r) => r.impactedAsset).filter(Boolean),
    ).size

    const gold = new Set(
      rows.filter((r) => r.layer === 'Gold').map((r) => r.sourceAsset),
    ).size
    const silver = new Set(
      rows.filter((r) => r.layer === 'Silver').map((r) => r.sourceAsset),
    ).size
    const raw = new Set(
      rows.filter((r) => r.layer === 'Raw').map((r) => r.sourceAsset),
    ).size

    const mdrYes = new Set(
      rows.filter((r) => r.mdrAvailability).map((r) => r.sourceAsset),
    ).size
    const mdrNo = new Set(
      rows.filter((r) => !r.mdrAvailability).map((r) => r.sourceAsset),
    ).size

    const reports = new Set(
      downRows
        .filter((r) => {
          const t = (r.impactedAssetType ?? '').toLowerCase()
          return (
            t.includes('report') ||
            (!t && /report|dashboard|scorecard|paginated/.test(r.impactedAsset.toLowerCase()))
          )
        })
        .map((r) => r.impactedAsset),
    ).size

    const datasets = new Set(
      downRows
        .filter((r) => {
          const t = (r.impactedAssetType ?? '').toLowerCase()
          return (
            t.includes('dataset') ||
            (!t && /\bdataset\b|semantic|\bmodel\b/.test(r.impactedAsset.toLowerCase()))
          )
        })
        .map((r) => r.impactedAsset),
    ).size

    return {
      totalAssets,
      upstreamAssets,
      downstreamAssets,
      gold,
      silver,
      raw,
      mdrYes,
      mdrNo,
      reports,
      datasets,
    }
  }, [rows])

  const cards: KpiCard[] = [
    {
      label: 'Total assets',
      value: stats.totalAssets,
      icon: <Database size={18} />,
      accent: 'violet',
      sub: 'Unique nodes in lineage',
    },
    {
      label: 'Upstream assets',
      value: stats.upstreamAssets,
      icon: <TrendingUp size={18} />,
      accent: 'indigo',
      sub: 'BigQuery source tables',
    },
    {
      label: 'Downstream assets',
      value: stats.downstreamAssets,
      icon: <TrendingDown size={18} />,
      accent: 'teal',
      sub: 'Datasets and reports',
    },
    {
      label: 'Gold assets',
      value: stats.gold,
      icon: <Star size={18} />,
      accent: 'gold',
      sub: 'USL / GSL layer',
    },
    {
      label: 'Silver assets',
      value: stats.silver,
      icon: <Layers size={18} />,
      accent: 'silver',
      sub: 'INT layer',
    },
    {
      label: 'Bronze / Raw assets',
      value: stats.raw,
      icon: <Layers3 size={18} />,
      accent: 'bronze',
      sub: 'STG / Base layer',
    },
    {
      label: 'MDR available',
      value: stats.mdrYes,
      icon: <ShieldCheck size={18} />,
      accent: 'green',
      sub: 'Governed PBI tables',
    },
    {
      label: 'MDR not available',
      value: stats.mdrNo,
      icon: <ShieldX size={18} />,
      accent: 'red',
      sub: 'Ungoverned PBI tables',
    },
    {
      label: 'Total reports',
      value: stats.reports,
      icon: <FileBarChart2 size={18} />,
      accent: 'pink',
      sub: 'Downstream reports',
    },
    {
      label: 'Total datasets',
      value: stats.datasets,
      icon: <BarChart3 size={18} />,
      accent: 'cyan',
      sub: 'Downstream datasets',
    },
  ]

  return (
    <div className="page-content workspace-page">
      <div className="page-heading workspace-heading">
        <div>
          <span className="eyebrow">Analytics overview</span>
          <h1>Dashboard</h1>
          <p>
            Asset statistics and governance coverage for the selected
            workbook and sheet.
          </p>
        </div>
        <div className="dashboard-filters">
          {workbooks.length > 1 && (
            <select
              aria-label="Select workbook"
              onChange={(e) => onSelectWorkbook(e.target.value)}
              value={activeWorkbookId ?? ''}
            >
              {workbooks.map((wb) => (
                <option key={wb.id} value={wb.id}>
                  {wb.displayName}
                </option>
              ))}
            </select>
          )}
          <select
            aria-label="Select sheet"
            onChange={(e) => onSheetChange(e.target.value)}
            value={selectedSheet}
          >
            <option value="all">All sheets</option>
            {sheets.map((sheet) => (
              <option key={sheet.name} value={sheet.name}>
                {sheet.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="empty-table" style={{ minHeight: 240 }}>
          <Database size={28} />
          <strong>No data to display</strong>
          <span>Upload a workbook with valid lineage rows to see statistics.</span>
        </div>
      ) : (
        <div className="kpi-grid">
          {cards.map((card) => (
            <div className={`kpi-card kpi-${card.accent}`} key={card.label}>
              <div className="kpi-icon">{card.icon}</div>
              <div className="kpi-body">
                <strong className="kpi-value">
                  {card.value.toLocaleString()}
                </strong>
                <span className="kpi-label">{card.label}</span>
                <small className="kpi-sub">{card.sub}</small>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
