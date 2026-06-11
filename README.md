# Polan — Lineage Studio

by Polestar Analytics

A browser-based React application that turns Excel workbooks into enriched
lineage tables and interactive upstream/downstream asset graphs.

## Run locally

```bash
npm install
npm run dev
```

Open the URL printed by Vite, then upload a `.xlsx` or `.xls` workbook to
generate the preview, enriched data, and lineage graph.

## Workbook schema

Each processed sheet must contain these columns:

| Column | Meaning |
| --- | --- |
| `Source Asset` | Power BI table or the source node for a downstream edge |
| `Impacted Asset` | Upstream source, dataset, or report |
| `Direction` | `upstream` or `downstream` |
| `Qualified Name` | Slash-separated asset identifier |

Example:

```text
catalog/prod/analytics/my_project/customer_USL/customer_profile
```

This produces `Project Name = my_project`, `Dataset Name = customer_USL`,
`Table Name = customer_profile`, `MDR Availability = Yes`, and `Layers = Gold`.

## Commands

```bash
npm run build
npm run lint
npm test
```

Workbook parsing happens locally in the browser. Processed rows can be exported
as Excel or CSV from the Processed Data screen.
