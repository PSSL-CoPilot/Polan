/**
 * Glossary mock data
 * ----------------------------------------------------------------------------
 * The Glossary tab is a data-governance catalogue layered on top of the lineage
 * app. There is no glossary backend yet, so this file holds typed mock data
 * (telecom / dashboard examples) plus the governance rules. Everything is
 * intentionally editable in code: swap these objects for an API response later
 * without touching the GlossaryPage UI.
 */

export type CertificationStatus =
  | 'Draft'
  | 'Under Review'
  | 'Certified'
  | 'Deprecated'

/**
 * Provenance of a KPI definition or measure mapping. AI may *suggest* metadata,
 * but human approval is required before anything can be marked Certified.
 */
export type MetadataSource =
  | 'AI Suggested'
  | 'Manually Added'
  | 'Human Verified'
  | 'Certified'

export type MeasureType = 'Power BI DAX' | 'SQL' | 'BigQuery' | 'Manual'

export type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected'

/** A single immediate asset linked to a measure (table, column, dataset…). */
export interface LinkedAsset {
  name: string
  type: string
  relationship: string
  owner: string
  status: string
}

/** Lightweight audit / approval trail shown on each KPI. */
export interface AuditMeta {
  createdBy: string
  lastUpdatedBy: string
  approvedBy: string
  changeReason: string
  approvalStatus: ApprovalStatus
  auditLogCount: number
}

export interface Measure {
  id: string
  name: string
  type: MeasureType
  expression: string
  metadataSource: MetadataSource
  bigQueryTable: string
  columnsUsed: string[]
  powerBiDataset: string
  upstreamSource: string
  downstreamDashboards: string[]
  relatedKpis: string[]
  linkedAssets: LinkedAsset[]
}

export interface Kpi {
  id: string
  name: string
  definition: string
  formula: string
  businessLogic: string
  measureId: string
  kpiOwner: string
  technicalOwner: string
  certification: CertificationStatus
  metadataSource: MetadataSource
  lastReviewed: string
  audit: AuditMeta
}

export interface Dashboard {
  id: string
  name: string
  domain: string
  owner: string
  lastUpdated: string
  certification: CertificationStatus
  kpiIds: string[]
}

export interface GlossaryData {
  dashboards: Dashboard[]
  kpis: Record<string, Kpi>
  measures: Record<string, Measure>
}

// ── Measures ────────────────────────────────────────────────────────────────

const measures: Record<string, Measure> = {
  M_Billed_Base_ARPU: {
    id: 'M_Billed_Base_ARPU',
    name: 'M_Billed_Base_ARPU',
    type: 'Power BI DAX',
    expression: 'DIVIDE([M_Revenue_Amount], [M_Distinct_PIDs])',
    metadataSource: 'Certified',
    bigQueryTable: 'da-prod-dwh-dw01.DWH_QF_MM_BQD.T_BILLED_BASE_FACT',
    columnsUsed: ['revenue_amount', 'pid', 'billing_month'],
    powerBiDataset: 'Revenue Semantic Model',
    upstreamSource: 'BSCS Billing → Oracle EDW',
    downstreamDashboards: ['Billed Base ARPU Dashboard'],
    relatedKpis: ['Billed Base ARPU'],
    linkedAssets: [
      {
        name: 'T_BILLED_BASE_FACT',
        type: 'BigQuery Table',
        relationship: 'Source table',
        owner: 'Data Engineering',
        status: 'Certified',
      },
      {
        name: 'revenue_amount',
        type: 'Column',
        relationship: 'Measure input',
        owner: 'Data Engineering',
        status: 'Certified',
      },
      {
        name: 'pid',
        type: 'Column',
        relationship: 'Distinct count key',
        owner: 'Data Engineering',
        status: 'Certified',
      },
      {
        name: 'Revenue Semantic Model',
        type: 'Power BI Dataset',
        relationship: 'Hosts measure',
        owner: 'BI Platform',
        status: 'Certified',
      },
      {
        name: 'Billed Base ARPU Dashboard',
        type: 'Dashboard',
        relationship: 'Downstream consumer',
        owner: 'Priya Sharma',
        status: 'Certified',
      },
    ],
  },
  M_Acquisition_ARPU: {
    id: 'M_Acquisition_ARPU',
    name: 'M_Acquisition_ARPU',
    type: 'Power BI DAX',
    expression:
      'DIVIDE([M_Revenue_Amount] (new activations), [M_Distinct_PIDs] (new activations))',
    metadataSource: 'Human Verified',
    bigQueryTable: 'da-prod-dwh-dw01.DWH_QF_MM_BQD.T_ACQUISITION_FACT',
    columnsUsed: ['revenue_amount', 'pid', 'activation_date'],
    powerBiDataset: 'Growth Semantic Model',
    upstreamSource: 'CRM Activations → Oracle EDW',
    downstreamDashboards: ['Acquisition ARPU Dashboard'],
    relatedKpis: ['Acquisition ARPU'],
    linkedAssets: [
      {
        name: 'T_ACQUISITION_FACT',
        type: 'BigQuery Table',
        relationship: 'Source table',
        owner: 'Data Engineering',
        status: 'Certified',
      },
      {
        name: 'activation_date',
        type: 'Column',
        relationship: 'Acquisition window filter',
        owner: 'Data Engineering',
        status: 'Under Review',
      },
      {
        name: 'Growth Semantic Model',
        type: 'Power BI Dataset',
        relationship: 'Hosts measure',
        owner: 'BI Platform',
        status: 'Certified',
      },
      {
        name: 'Acquisition ARPU Dashboard',
        type: 'Dashboard',
        relationship: 'Downstream consumer',
        owner: 'Daniel Okoye',
        status: 'Under Review',
      },
    ],
  },
  M_Lost_ARPU: {
    id: 'M_Lost_ARPU',
    name: 'M_Lost_ARPU',
    type: 'Power BI DAX',
    expression:
      'DIVIDE([M_Revenue_Amount] (churned), [M_Distinct_PIDs] (churned))',
    metadataSource: 'AI Suggested',
    bigQueryTable: 'da-prod-dwh-dw01.DWH_QF_MM_BQD.T_CHURN_FACT',
    columnsUsed: ['revenue_amount', 'pid', 'churn_date'],
    powerBiDataset: 'Churn Semantic Model',
    upstreamSource: 'Disconnect Orders → Oracle EDW',
    downstreamDashboards: ['Lost ARPU Dashboard'],
    relatedKpis: ['Lost ARPU'],
    linkedAssets: [
      {
        name: 'T_CHURN_FACT',
        type: 'BigQuery Table',
        relationship: 'Source table',
        owner: 'Data Engineering',
        status: 'Draft',
      },
      {
        name: 'churn_date',
        type: 'Column',
        relationship: 'Churn window filter',
        owner: 'Data Engineering',
        status: 'Draft',
      },
      {
        name: 'Lost ARPU Dashboard',
        type: 'Dashboard',
        relationship: 'Downstream consumer',
        owner: 'Mei Lin',
        status: 'Draft',
      },
    ],
  },
  M_Fiber_Subscribers: {
    id: 'M_Fiber_Subscribers',
    name: 'M_Fiber_Subscribers',
    type: 'BigQuery',
    expression:
      "COUNT(DISTINCT pid) WHERE access_technology = 'FIBER' AND status = 'ACTIVE'",
    metadataSource: 'Certified',
    bigQueryTable: 'da-prod-dwh-dw01.DWH_QF_MM_BQD.CUST_ACCT_DIM_MV',
    columnsUsed: ['pid', 'access_technology', 'status'],
    powerBiDataset: 'Subscriber Semantic Model',
    upstreamSource: 'Network Inventory → Oracle EDW',
    downstreamDashboards: ['Subscriber Trend Dashboard'],
    relatedKpis: ['Fiber Subscribers'],
    linkedAssets: [
      {
        name: 'CUST_ACCT_DIM_MV',
        type: 'BigQuery Table',
        relationship: 'Source table',
        owner: 'Data Engineering',
        status: 'Certified',
      },
      {
        name: 'access_technology',
        type: 'Column',
        relationship: 'Technology filter',
        owner: 'Data Engineering',
        status: 'Certified',
      },
      {
        name: 'Subscriber Trend Dashboard',
        type: 'Dashboard',
        relationship: 'Downstream consumer',
        owner: 'Carlos Méndez',
        status: 'Certified',
      },
    ],
  },
  M_Copper_Subscribers: {
    id: 'M_Copper_Subscribers',
    name: 'M_Copper_Subscribers',
    type: 'BigQuery',
    expression:
      "COUNT(DISTINCT pid) WHERE access_technology = 'COPPER' AND status = 'ACTIVE'",
    metadataSource: 'Human Verified',
    bigQueryTable: 'da-prod-dwh-dw01.DWH_QF_MM_BQD.CUST_ACCT_DIM_MV',
    columnsUsed: ['pid', 'access_technology', 'status'],
    powerBiDataset: 'Subscriber Semantic Model',
    upstreamSource: 'Network Inventory → Oracle EDW',
    downstreamDashboards: ['Subscriber Trend Dashboard'],
    relatedKpis: ['Copper Subscribers'],
    linkedAssets: [
      {
        name: 'CUST_ACCT_DIM_MV',
        type: 'BigQuery Table',
        relationship: 'Source table',
        owner: 'Data Engineering',
        status: 'Certified',
      },
      {
        name: 'access_technology',
        type: 'Column',
        relationship: 'Technology filter',
        owner: 'Data Engineering',
        status: 'Certified',
      },
      {
        name: 'Subscriber Trend Dashboard',
        type: 'Dashboard',
        relationship: 'Downstream consumer',
        owner: 'Carlos Méndez',
        status: 'Certified',
      },
    ],
  },
  M_Revenue_Amount: {
    id: 'M_Revenue_Amount',
    name: 'M_Revenue_Amount',
    type: 'SQL',
    expression: 'SUM(revenue_amount)',
    metadataSource: 'Certified',
    bigQueryTable: 'da-prod-dwh-dw01.DWH_QF_MM_BQD.T_REVENUE_FACT',
    columnsUsed: ['revenue_amount', 'billing_month', 'product_id'],
    powerBiDataset: 'Revenue Semantic Model',
    upstreamSource: 'BSCS Billing → Oracle EDW',
    downstreamDashboards: [
      'Billed Base ARPU Dashboard',
      'Acquisition ARPU Dashboard',
    ],
    relatedKpis: ['Revenue Amount', 'Billed Base ARPU', 'Acquisition ARPU'],
    linkedAssets: [
      {
        name: 'T_REVENUE_FACT',
        type: 'BigQuery Table',
        relationship: 'Source table',
        owner: 'Data Engineering',
        status: 'Certified',
      },
      {
        name: 'revenue_amount',
        type: 'Column',
        relationship: 'Aggregated input',
        owner: 'Data Engineering',
        status: 'Certified',
      },
      {
        name: 'Revenue Semantic Model',
        type: 'Power BI Dataset',
        relationship: 'Hosts measure',
        owner: 'BI Platform',
        status: 'Certified',
      },
    ],
  },
  M_Distinct_PIDs: {
    id: 'M_Distinct_PIDs',
    name: 'M_Distinct_PIDs',
    type: 'BigQuery',
    expression: 'COUNT(DISTINCT pid)',
    metadataSource: 'Human Verified',
    bigQueryTable: 'da-prod-dwh-dw01.DWH_QF_MM_BQD.CUST_ACCT_DIM_MV',
    columnsUsed: ['pid'],
    powerBiDataset: 'Subscriber Semantic Model',
    upstreamSource: 'Network Inventory → Oracle EDW',
    downstreamDashboards: [
      'Billed Base ARPU Dashboard',
      'Lost ARPU Dashboard',
      'Subscriber Trend Dashboard',
    ],
    relatedKpis: ['Distinct PIDs', 'Billed Base ARPU', 'Lost ARPU'],
    linkedAssets: [
      {
        name: 'CUST_ACCT_DIM_MV',
        type: 'BigQuery Table',
        relationship: 'Source table',
        owner: 'Data Engineering',
        status: 'Certified',
      },
      {
        name: 'pid',
        type: 'Column',
        relationship: 'Distinct count key',
        owner: 'Data Engineering',
        status: 'Certified',
      },
    ],
  },
}

// ── KPIs ──────────────────────────────────────────────────────────────────

const kpis: Record<string, Kpi> = {
  'Billed Base ARPU': {
    id: 'Billed Base ARPU',
    name: 'Billed Base ARPU',
    definition:
      'Average revenue per user across the active billed subscriber base for a period.',
    formula: 'Billed Base ARPU = Revenue Amount / Distinct Billed PIDs',
    businessLogic:
      'Revenue and PID counts are restricted to subscribers with at least one billing event in the period. Credits and adjustments are included; one-off hardware charges are excluded.',
    measureId: 'M_Billed_Base_ARPU',
    kpiOwner: 'Priya Sharma',
    technicalOwner: 'Data Engineering',
    certification: 'Certified',
    metadataSource: 'Certified',
    lastReviewed: '2026-05-18',
    audit: {
      createdBy: 'Priya Sharma',
      lastUpdatedBy: 'A. Nair',
      approvedBy: 'Governance Council',
      changeReason: 'Annual definition review',
      approvalStatus: 'Approved',
      auditLogCount: 12,
    },
  },
  'Acquisition ARPU': {
    id: 'Acquisition ARPU',
    name: 'Acquisition ARPU',
    definition:
      'Average revenue per newly acquired subscriber within the acquisition window.',
    formula: 'Acquisition ARPU = New Activation Revenue / New Activation PIDs',
    businessLogic:
      'Counts only PIDs whose activation_date falls inside the reporting period. Win-back customers reactivating within 90 days are excluded.',
    measureId: 'M_Acquisition_ARPU',
    kpiOwner: 'Daniel Okoye',
    technicalOwner: 'Data Engineering',
    certification: 'Under Review',
    metadataSource: 'Human Verified',
    lastReviewed: '2026-06-02',
    audit: {
      createdBy: 'Daniel Okoye',
      lastUpdatedBy: 'Daniel Okoye',
      approvedBy: '—',
      changeReason: 'Added win-back exclusion rule',
      approvalStatus: 'Pending',
      auditLogCount: 5,
    },
  },
  'Lost ARPU': {
    id: 'Lost ARPU',
    name: 'Lost ARPU',
    definition:
      'Average revenue per subscriber lost to churn during the period.',
    formula: 'Lost ARPU = Churned Revenue / Churned PIDs',
    businessLogic:
      'Based on confirmed disconnects (churn_date set). Suspensions and non-pay restorations within the grace period are not treated as churn.',
    measureId: 'M_Lost_ARPU',
    kpiOwner: 'Mei Lin',
    technicalOwner: 'Data Engineering',
    certification: 'Draft',
    metadataSource: 'AI Suggested',
    lastReviewed: '2026-06-10',
    audit: {
      createdBy: 'AI Metadata Assistant',
      lastUpdatedBy: 'Mei Lin',
      approvedBy: '—',
      changeReason: 'Initial AI-suggested definition pending review',
      approvalStatus: 'Pending',
      auditLogCount: 2,
    },
  },
  'Fiber Subscribers': {
    id: 'Fiber Subscribers',
    name: 'Fiber Subscribers',
    definition: 'Count of active subscribers served over fiber access.',
    formula: "Fiber Subscribers = COUNT(DISTINCT PID where technology = 'Fiber')",
    businessLogic:
      'Active status only. A PID with both fiber and copper services is counted under its primary access technology.',
    measureId: 'M_Fiber_Subscribers',
    kpiOwner: 'Carlos Méndez',
    technicalOwner: 'Network Analytics',
    certification: 'Certified',
    metadataSource: 'Certified',
    lastReviewed: '2026-04-29',
    audit: {
      createdBy: 'Carlos Méndez',
      lastUpdatedBy: 'Carlos Méndez',
      approvedBy: 'Governance Council',
      changeReason: 'Primary-technology tie-break clarified',
      approvalStatus: 'Approved',
      auditLogCount: 8,
    },
  },
  'Copper Subscribers': {
    id: 'Copper Subscribers',
    name: 'Copper Subscribers',
    definition: 'Count of active subscribers served over copper access.',
    formula:
      "Copper Subscribers = COUNT(DISTINCT PID where technology = 'Copper')",
    businessLogic:
      'Active status only. Used to track the copper-to-fiber migration trend alongside Fiber Subscribers.',
    measureId: 'M_Copper_Subscribers',
    kpiOwner: 'Carlos Méndez',
    technicalOwner: 'Network Analytics',
    certification: 'Certified',
    metadataSource: 'Human Verified',
    lastReviewed: '2026-04-29',
    audit: {
      createdBy: 'Carlos Méndez',
      lastUpdatedBy: 'Carlos Méndez',
      approvedBy: 'Governance Council',
      changeReason: 'Aligned definition with Fiber Subscribers',
      approvalStatus: 'Approved',
      auditLogCount: 6,
    },
  },
  'Revenue Amount': {
    id: 'Revenue Amount',
    name: 'Revenue Amount',
    definition: 'Total billed revenue recognised for the period.',
    formula: 'Revenue Amount = SUM(revenue_amount)',
    businessLogic:
      'Gross billed revenue including recurring and usage charges, net of credits. Tax is excluded.',
    measureId: 'M_Revenue_Amount',
    kpiOwner: 'Priya Sharma',
    technicalOwner: 'Data Engineering',
    certification: 'Certified',
    metadataSource: 'Certified',
    lastReviewed: '2026-05-18',
    audit: {
      createdBy: 'Priya Sharma',
      lastUpdatedBy: 'A. Nair',
      approvedBy: 'Governance Council',
      changeReason: 'Tax exclusion confirmed',
      approvalStatus: 'Approved',
      auditLogCount: 10,
    },
  },
  'Distinct PIDs': {
    id: 'Distinct PIDs',
    name: 'Distinct PIDs',
    definition: 'Count of distinct product identifiers (subscriber lines).',
    formula: 'Distinct PIDs = COUNT(DISTINCT pid)',
    businessLogic:
      'A PID represents a single billable service line. Shared across ARPU and subscriber KPIs as the denominator / base count.',
    measureId: 'M_Distinct_PIDs',
    kpiOwner: 'Priya Sharma',
    technicalOwner: 'Data Engineering',
    certification: 'Certified',
    metadataSource: 'Human Verified',
    lastReviewed: '2026-05-30',
    audit: {
      createdBy: 'A. Nair',
      lastUpdatedBy: 'A. Nair',
      approvedBy: 'Governance Council',
      changeReason: 'Confirmed PID = single billable line',
      approvalStatus: 'Approved',
      auditLogCount: 7,
    },
  },
}

// ── Dashboards ──────────────────────────────────────────────────────────────

const dashboards: Dashboard[] = [
  {
    id: 'dash-billed-base-arpu',
    name: 'Billed Base ARPU Dashboard',
    domain: 'Revenue Analytics',
    owner: 'Priya Sharma',
    lastUpdated: '2026-06-12',
    certification: 'Certified',
    kpiIds: ['Billed Base ARPU', 'Revenue Amount', 'Distinct PIDs'],
  },
  {
    id: 'dash-acquisition-arpu',
    name: 'Acquisition ARPU Dashboard',
    domain: 'Growth & Acquisition',
    owner: 'Daniel Okoye',
    lastUpdated: '2026-06-08',
    certification: 'Under Review',
    kpiIds: ['Acquisition ARPU', 'Revenue Amount'],
  },
  {
    id: 'dash-lost-arpu',
    name: 'Lost ARPU Dashboard',
    domain: 'Churn & Retention',
    owner: 'Mei Lin',
    lastUpdated: '2026-06-10',
    certification: 'Draft',
    kpiIds: ['Lost ARPU', 'Distinct PIDs'],
  },
  {
    id: 'dash-subscriber-trend',
    name: 'Subscriber Trend Dashboard',
    domain: 'Network & Subscribers',
    owner: 'Carlos Méndez',
    lastUpdated: '2026-05-27',
    certification: 'Certified',
    kpiIds: ['Fiber Subscribers', 'Copper Subscribers', 'Distinct PIDs'],
  },
]

export const glossaryData: GlossaryData = { dashboards, kpis, measures }

/**
 * Change Governance — updating Atlan / the glossary is mandatory whenever any of
 * these changes happen, so downstream lineage and certification stay accurate.
 */
export const governanceRules: string[] = [
  'BigQuery table addition',
  'BigQuery column addition',
  'Power BI measure logic change',
  'Dashboard logic change',
  'KPI definition change',
  'Business formula change',
]
