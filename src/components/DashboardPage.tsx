import {
  BarChart3,
  Database,
  FileBarChart2,
  Layers3,
  ShieldCheck,
  Table2,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { memo, useMemo, useState } from 'react'
import type { UploadedWorkbook } from '../types'
import {
  ALL_DASHBOARD_SHEETS,
  ALL_DASHBOARD_WORKBOOKS,
  computeDashboardMetrics,
  getDashboardRows,
  getDashboardSheetOptions,
  type DashboardMetrics,
} from '../utils/dashboardMetrics'

interface DashboardPageProps {
  workbooks: UploadedWorkbook[]
}

type KpiAccent = 'violet' | 'indigo' | 'teal' | 'gold' | 'pink' | 'cyan'

interface KpiCard {
  label: string
  value: number
  icon: React.ReactNode
  accent: KpiAccent
  sub: string
}

interface DonutItem {
  label: string
  value: number
  color: string
}

interface DonutChartProps {
  title: string
  description: string
  centerLabel: string
  icon: React.ReactNode
  items: DonutItem[]
}

const DonutChart = memo(function DonutChart({
  title,
  description,
  centerLabel,
  icon,
  items,
}: DonutChartProps) {
  const total = items.reduce((sum, item) => sum + item.value, 0)
  const radius = 78
  const circumference = 2 * Math.PI * radius
  const segments = items.reduce<
    Array<DonutItem & { fraction: number; length: number; offset: number }>
  >((result, item) => {
    const previous = result.at(-1)
    const offset = previous ? previous.offset + previous.length : 0
    const fraction = total ? item.value / total : 0
    return [
      ...result,
      {
        ...item,
        fraction,
        length: fraction * circumference,
        offset,
      },
    ]
  }, [])

  return (
    <section className="dashboard-donut-panel">
      <header className="dashboard-donut-header">
        <span className="dashboard-donut-icon">{icon}</span>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </header>
      <div className="dashboard-donut-content">
        <svg
          aria-label={`${title}: ${total.toLocaleString()} total rows`}
          className="dashboard-donut-svg"
          role="img"
          viewBox="0 0 220 220"
        >
          <circle
            className="dashboard-donut-track"
            cx="110"
            cy="110"
            fill="none"
            r={radius}
            strokeWidth="30"
          />
          {segments
            .filter((segment) => segment.value > 0)
            .map((segment) => (
              <circle
                cx="110"
                cy="110"
                fill="none"
                key={segment.label}
                r={radius}
                stroke={segment.color}
                strokeDasharray={`${segment.length} ${circumference - segment.length}`}
                strokeDashoffset={-segment.offset}
                strokeWidth="30"
                transform="rotate(-90 110 110)"
              />
            ))}
          <text
            className="dashboard-donut-total"
            textAnchor="middle"
            x="110"
            y="105"
          >
            {total.toLocaleString()}
          </text>
          <text
            className="dashboard-donut-center-label"
            textAnchor="middle"
            x="110"
            y="128"
          >
            {centerLabel}
          </text>
        </svg>
        <div className="dashboard-donut-legend">
          {segments.map((segment) => (
            <div className="dashboard-donut-legend-row" key={segment.label}>
              <span
                className="dashboard-donut-swatch"
                style={{ backgroundColor: segment.color }}
              />
              <span className="dashboard-donut-legend-label">
                {segment.label}
              </span>
              <strong>{segment.value.toLocaleString()}</strong>
              <span className="dashboard-donut-percentage">
                {Math.round(segment.fraction * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
})

function makeCards(metrics: DashboardMetrics): KpiCard[] {
  return [
    {
      label: 'Total assets',
      value: metrics.totalAssets,
      icon: <Database size={20} />,
      accent: 'violet',
      sub: 'Processed lineage rows',
    },
    {
      label: 'Upstream sources',
      value: metrics.upstreamAssets,
      icon: <TrendingUp size={20} />,
      accent: 'indigo',
      sub: 'Rows marked upstream',
    },
    {
      label: 'Downstream assets',
      value: metrics.downstreamAssets,
      icon: <TrendingDown size={20} />,
      accent: 'teal',
      sub: 'Rows marked downstream',
    },
    {
      label: 'Power BI tables',
      value: metrics.powerbiAssets,
      icon: <Zap size={20} />,
      accent: 'gold',
      sub: 'Unique source assets',
    },
    {
      label: 'Total reports',
      value: metrics.reports,
      icon: <FileBarChart2 size={20} />,
      accent: 'pink',
      sub: 'Downstream report rows',
    },
    {
      label: 'Total datasets',
      value: metrics.datasets,
      icon: <BarChart3 size={20} />,
      accent: 'cyan',
      sub: 'Downstream dataset rows',
    },
  ]
}

export function DashboardPage({ workbooks }: DashboardPageProps) {
  const [selectedWorkbookId, setSelectedWorkbookId] = useState(
    ALL_DASHBOARD_WORKBOOKS,
  )
  const [selectedSheet, setSelectedSheet] = useState(ALL_DASHBOARD_SHEETS)

  const effectiveWorkbookId =
    selectedWorkbookId === ALL_DASHBOARD_WORKBOOKS ||
    workbooks.some((workbook) => workbook.id === selectedWorkbookId)
      ? selectedWorkbookId
      : ALL_DASHBOARD_WORKBOOKS
  const sheetOptions = useMemo(
    () => getDashboardSheetOptions(workbooks, effectiveWorkbookId),
    [workbooks, effectiveWorkbookId],
  )
  const effectiveSheet =
    selectedSheet === ALL_DASHBOARD_SHEETS ||
    sheetOptions.some(
      (sheet) => sheet.toLowerCase() === selectedSheet.toLowerCase(),
    )
      ? selectedSheet
      : ALL_DASHBOARD_SHEETS
  const rows = useMemo(
    () =>
      getDashboardRows(workbooks, {
        workbookId: effectiveWorkbookId,
        sheetName: effectiveSheet,
      }),
    [workbooks, effectiveWorkbookId, effectiveSheet],
  )
  const stats = useMemo(() => computeDashboardMetrics(rows), [rows])
  const cards = useMemo(() => makeCards(stats), [stats])
  const layerItems = useMemo(
    () => [
      { label: 'Gold', value: stats.gold, color: '#d99a24' },
      { label: 'Silver', value: stats.silver, color: '#7c8798' },
      { label: 'Raw / Bronze', value: stats.raw, color: '#b86838' },
      { label: 'No Layers', value: stats.noLayer, color: '#c9c4dc' },
    ],
    [stats],
  )
  const mdrItems = useMemo(
    () => [
      { label: 'MDR available', value: stats.mdrYes, color: '#2d9b6f' },
      {
        label: 'MDR not available',
        value: stats.mdrNo,
        color: '#e36f65',
      },
    ],
    [stats],
  )
  const tableViewItems = useMemo(
    () => [
      { label: 'Table', value: stats.tableCount, color: '#6557dc' },
      { label: 'View', value: stats.viewCount, color: '#d99a24' },
    ],
    [stats],
  )
  const layerIcon = useMemo(() => <Layers3 size={19} />, [])
  const mdrIcon = useMemo(() => <ShieldCheck size={19} />, [])
  const tableViewIcon = useMemo(() => <Table2 size={19} />, [])

  const handleWorkbookChange = (workbookId: string) => {
    setSelectedWorkbookId(workbookId)
    setSelectedSheet(ALL_DASHBOARD_SHEETS)
  }

  return (
    <div className="page-content workspace-page dashboard-page">
      <div className="page-heading workspace-heading dashboard-heading">
        <div>
          <span className="eyebrow">Analytics overview</span>
          <h1>Dashboard</h1>
          <p>
            Row-level lineage and governance coverage for the selected scope.
          </p>
        </div>
        <div className="dashboard-filters">
          <label>
            <span>Workbook</span>
            <select
              aria-label="Select workbook"
              onChange={(event) => handleWorkbookChange(event.target.value)}
              value={effectiveWorkbookId}
            >
              <option value={ALL_DASHBOARD_WORKBOOKS}>All Workbooks</option>
              {workbooks.map((workbook) => (
                <option key={workbook.id} value={workbook.id}>
                  {workbook.displayName}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Sheet</span>
            <select
              aria-label="Select sheet"
              onChange={(event) => setSelectedSheet(event.target.value)}
              value={effectiveSheet}
            >
              <option value={ALL_DASHBOARD_SHEETS}>All Sheets</option>
              {sheetOptions.map((sheet) => (
                <option key={sheet} value={sheet}>
                  {sheet}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="dashboard-body">
        <div className="dashboard-scope-summary">
          <span>{rows.length.toLocaleString()} processed rows in scope</span>
          {!rows.length && (
            <small>No processed rows match the selected filters.</small>
          )}
        </div>

        <div className="dashboard-kpi-grid">
          {cards.map((card) => (
            <article
              className={`dashboard-kpi-card kpi-${card.accent}`}
              key={card.label}
            >
              <div className="kpi-icon">{card.icon}</div>
              <div className="kpi-body">
                <span className="kpi-label">{card.label}</span>
                <strong className="kpi-value">
                  {card.value.toLocaleString()}
                </strong>
                <small className="kpi-sub">{card.sub}</small>
              </div>
            </article>
          ))}
        </div>

        <div className="dashboard-donut-grid">
          <DonutChart
            centerLabel="rows"
            description="Processed rows grouped by governed data layer."
            icon={layerIcon}
            items={layerItems}
            title="Layer Distribution"
          />
          <DonutChart
            centerLabel="rows"
            description="Processed rows with and without MDR availability."
            icon={mdrIcon}
            items={mdrItems}
            title="MDR Coverage"
          />
          <DonutChart
            centerLabel="assets"
            description="Impacted assets split by table and view type."
            icon={tableViewIcon}
            items={tableViewItems}
            title="Table vs View"
          />
        </div>
      </div>
    </div>
  )
}
