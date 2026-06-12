import {
  BarChart3,
  Database,
  FileBarChart2,
  Layers,
  ShieldCheck,
  ShieldX,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { useMemo } from 'react'
import type { MetricRecord, ProcessedRow, SheetData, UploadedWorkbook } from '../types'
import {
  computeDashboardMetrics,
  type DashboardMetrics,
} from '../utils/dashboardMetrics'

interface DashboardPageProps {
  workbooks: UploadedWorkbook[]
  activeWorkbookId: string | null
  onSelectWorkbook: (id: string) => void
  sheets: SheetData[]
  selectedSheet: string
  onSheetChange: (sheet: string) => void
  rows: ProcessedRow[]
  metrics?: MetricRecord[]
}

type KpiAccent =
  | 'violet'
  | 'indigo'
  | 'teal'
  | 'gold'
  | 'green'
  | 'red'
  | 'pink'
  | 'cyan'

interface KpiCard {
  label: string
  value: number
  icon: React.ReactNode
  accent: KpiAccent
  sub: string
}

// ── Layer donut chart ─────────────────────────────────────────────────────────

interface DonutSegment {
  label: string
  value: number
  color: string
  frac: number
  len: number
  dashoffset: number
  gapLen: number
}

function LayerDonut({
  gold,
  silver,
  raw,
  noLayer,
}: {
  gold: number
  silver: number
  raw: number
  noLayer: number
}) {
  const total = gold + silver + raw + noLayer
  if (total === 0) return null

  const R = 72
  const SW = 28
  const CX = 100
  const CY = 100
  const C = 2 * Math.PI * R

  const rawData = [
    { label: 'Gold', value: gold, color: '#d97706' },
    { label: 'Silver', value: silver, color: '#64748b' },
    { label: 'Bronze / Raw', value: raw, color: '#b45309' },
    { label: 'No Layers', value: noLayer, color: '#ddd8f0' },
  ].filter((d) => d.value > 0)

  let cumulative = 0
  const segments: DonutSegment[] = rawData.map((d) => {
    const frac = d.value / total
    const len = frac * C
    // C - cumulativeBefore positions the segment start after -90° rotation.
    const dashoffset = C - cumulative
    const gapLen = C - len
    cumulative += len
    return { ...d, frac, len, dashoffset, gapLen }
  })

  return (
    <div className="donut-wrap">
      <svg aria-hidden="true" className="donut-svg" viewBox="0 0 200 200">
        {/* track ring */}
        <circle
          cx={CX}
          cy={CY}
          fill="none"
          r={R}
          stroke="#f0eef8"
          strokeWidth={SW}
        />
        {segments.map((seg) => (
          <circle
            cx={CX}
            cy={CY}
            fill="none"
            key={seg.label}
            r={R}
            stroke={seg.color}
            strokeDasharray={`${seg.len} ${seg.gapLen}`}
            strokeDashoffset={seg.dashoffset}
            strokeLinecap="butt"
            strokeWidth={SW}
            transform={`rotate(-90 ${CX} ${CY})`}
          />
        ))}
        {/* centre label */}
        <text
          dominantBaseline="auto"
          style={{
            fontSize: 24,
            fontWeight: 700,
            fill: '#20202a',
            fontFamily: 'inherit',
          }}
          textAnchor="middle"
          x={CX}
          y={CY - 4}
        >
          {total.toLocaleString()}
        </text>
        <text
          dominantBaseline="auto"
          style={{ fontSize: 11, fill: '#73717e', fontFamily: 'inherit' }}
          textAnchor="middle"
          x={CX}
          y={CY + 15}
        >
          assets
        </text>
      </svg>

      <div className="donut-legend">
        {segments.map((seg) => (
          <div className="donut-legend-item" key={seg.label}>
            <span className="donut-dot" style={{ background: seg.color }} />
            <span className="donut-legend-label">{seg.label}</span>
            <span className="donut-legend-count">
              {seg.value.toLocaleString()}
            </span>
            <span className="donut-legend-pct">
              {Math.round(seg.frac * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Dashboard page ────────────────────────────────────────────────────────────

function makeCards(m: DashboardMetrics): { primary: KpiCard[]; lower: KpiCard[] } {
  return {
    primary: [
      {
        label: 'Total assets',
        value: m.totalAssets,
        icon: <Database size={18} />,
        accent: 'violet',
        sub: 'Unique nodes in lineage',
      },
      {
        label: 'Upstream sources',
        value: m.upstreamAssets,
        icon: <TrendingUp size={18} />,
        accent: 'indigo',
        sub: 'BigQuery source tables',
      },
      {
        label: 'Power BI tables',
        value: m.powerbiAssets,
        icon: <Zap size={18} />,
        accent: 'gold',
        sub: 'PBI semantic layer',
      },
      {
        label: 'Downstream assets',
        value: m.downstreamAssets,
        icon: <TrendingDown size={18} />,
        accent: 'teal',
        sub: 'Datasets and reports',
      },
    ],
    lower: [
      {
        label: 'Total reports',
        value: m.reports,
        icon: <FileBarChart2 size={18} />,
        accent: 'pink',
        sub: 'Downstream reports',
      },
      {
        label: 'Total datasets',
        value: m.datasets,
        icon: <BarChart3 size={18} />,
        accent: 'cyan',
        sub: 'Downstream datasets',
      },
      {
        label: 'MDR available',
        value: m.mdrYes,
        icon: <ShieldCheck size={18} />,
        accent: 'green',
        sub: 'Governed assets',
      },
      {
        label: 'MDR not available',
        value: m.mdrNo,
        icon: <ShieldX size={18} />,
        accent: 'red',
        sub: 'Ungoverned assets',
      },
    ],
  }
}

export function DashboardPage({
  workbooks,
  activeWorkbookId,
  onSelectWorkbook,
  sheets,
  selectedSheet,
  onSheetChange,
  rows,
  metrics = [],
}: DashboardPageProps) {
  const stats = useMemo(
    () => computeDashboardMetrics(rows, metrics),
    [rows, metrics],
  )

  const cards = stats ? makeCards(stats) : null

  return (
    <div className="page-content workspace-page">
      <div className="page-heading workspace-heading">
        <div>
          <span className="eyebrow">Analytics overview</span>
          <h1>Dashboard</h1>
          <p>
            Asset statistics and governance coverage for the selected workbook
            and sheet.
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

      {!stats ? (
        <div className="empty-table" style={{ minHeight: 240 }}>
          <Database size={28} />
          <strong>No data to display</strong>
          <span>
            Upload a workbook with valid lineage rows to see statistics.
          </span>
        </div>
      ) : (
        <div className="dashboard-body">
          {/* Primary KPI strip */}
          <div className="kpi-grid kpi-grid-primary">
            {cards!.primary.map((card) => (
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

          {/* Analysis section: lower KPI cards + layer donut */}
          <div className="dashboard-analysis">
            <div className="analysis-left">
              <div className="kpi-grid">
                {cards!.lower.map((card) => (
                  <div
                    className={`kpi-card kpi-${card.accent}`}
                    key={card.label}
                  >
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
            </div>

            <div className="donut-panel">
              <div className="donut-panel-header">
                <Layers size={15} />
                <strong>Layer distribution</strong>
              </div>
              <LayerDonut
                gold={stats.gold}
                noLayer={stats.noLayer}
                raw={stats.raw}
                silver={stats.silver}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
