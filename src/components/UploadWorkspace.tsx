import { motion } from 'framer-motion'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Columns3,
  FileSpreadsheet,
  Layers3,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react'
import { useRef, useState, type DragEvent } from 'react'
import { REQUIRED_COLUMNS, type WorkbookData } from '../types'

interface UploadWorkspaceProps {
  workbook: WorkbookData | null
  isLoading: boolean
  error: string
  onFiles: (files: File[]) => void
  onContinue: () => void
}

export function UploadWorkspace({
  workbook,
  isLoading,
  error,
  onFiles,
  onContinue,
}: UploadWorkspaceProps) {
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const validSheets =
    workbook?.sheets.filter((sheet) => !sheet.errors.length) ?? []
  const rowCount = validSheets.reduce(
    (total, sheet) => total + sheet.rows.length,
    0,
  )

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    const files = Array.from(event.dataTransfer.files)
    if (files.length) onFiles(files)
  }

  return (
    <div className="page-content upload-page">
      <div className="page-heading upload-heading">
        <div>
          <span className="eyebrow">Workbook intake</span>
          <h1>Turn spreadsheets into living lineage.</h1>
          <p>
            Upload one or more workbooks and Polan will validate every sheet,
            enrich governance metadata, and map the complete asset journey.
          </p>
        </div>
        <div className="trust-note">
          <ShieldCheck size={18} />
          <span>
            <strong>Private by design</strong>
            Processing stays in your browser.
          </span>
        </div>
      </div>

      <div className="upload-layout">
        <motion.div
          animate={{ y: 0, opacity: 1 }}
          className={`dropzone ${dragging ? 'dragging' : ''}`}
          initial={{ y: 10, opacity: 0 }}
          onDragEnter={() => setDragging(true)}
          onDragLeave={() => setDragging(false)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={onDrop}
        >
          <input
            accept=".xlsx,.xls"
            aria-label="Upload Excel workbooks"
            multiple
            onChange={(event) => {
              const files = Array.from(event.target.files ?? [])
              if (files.length) onFiles(files)
              event.target.value = ''
            }}
            ref={fileInputRef}
            type="file"
          />
          <div className="upload-icon">
            <UploadCloud size={28} />
          </div>
          <h2>
            {isLoading
              ? 'Reading your workbooks...'
              : 'Drop your Excel files here'}
          </h2>
          <p>or click to browse from your computer</p>
          <div className="file-rules">
            <span>.XLSX or .XLS</span>
            <span>Multiple files supported</span>
            <span>Up to 25 MB each</span>
          </div>
          <button
            className="secondary-button"
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            Choose workbooks
          </button>
        </motion.div>

        <section className="intake-summary">
          {workbook ? (
            <>
              <div className="section-title-row">
                <div>
                  <span className="eyebrow">Current workbook</span>
                  <h2>Ready to explore</h2>
                </div>
                <span className="success-badge">
                  <CheckCircle2 size={14} />
                  Processed
                </span>
              </div>

              <div className="workbook-file">
                <div className="excel-icon">
                  <FileSpreadsheet size={22} />
                </div>
                <div>
                  <strong>{workbook.name}</strong>
                  <span>{workbook.sizeLabel} · Uploaded workbook</span>
                </div>
              </div>

              <div className="intake-stats">
                <div>
                  <Layers3 size={17} />
                  <span>Sheets discovered</span>
                  <strong>{workbook.sheets.length}</strong>
                </div>
                <div>
                  <FileSpreadsheet size={17} />
                  <span>Valid lineage rows</span>
                  <strong>{rowCount}</strong>
                </div>
              </div>

              <div className="sheet-checks">
                {workbook.sheets.map((sheet) => (
                  <div className="sheet-check" key={sheet.name}>
                    {sheet.errors.length ? (
                      <AlertCircle className="error-icon" size={17} />
                    ) : (
                      <CheckCircle2 size={17} />
                    )}
                    <div>
                      <strong>{sheet.name}</strong>
                      <span>
                        {sheet.errors.length
                          ? sheet.errors[0]
                          : `${sheet.rows.length} rows · ${sheet.originalColumns.length} original columns`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <button
                className="primary-button wide"
                disabled={!validSheets.length}
                onClick={onContinue}
                type="button"
              >
                Open lineage workspace
                <ArrowRight size={16} />
              </button>
            </>
          ) : (
            <div className="schema-guide">
              <div className="schema-icon">
                <Columns3 size={24} />
              </div>
              <span className="eyebrow">Before you upload</span>
              <h2>Required Excel columns</h2>
              <p>
                Each sheet that should create lineage needs these four column
                names. Extra columns are preserved.
              </p>
              <div className="schema-columns">
                {REQUIRED_COLUMNS.map((column) => (
                  <div key={column}>
                    <CheckCircle2 size={15} />
                    <strong>{column}</strong>
                  </div>
                ))}
              </div>
              <div className="schema-note">
                <ShieldCheck size={15} />
                Files are processed locally in your browser.
              </div>
            </div>
          )}

          {error && <div className="error-banner">{error}</div>}
        </section>
      </div>

      <div className="process-strip">
        <div>
          <span>01</span>
          <strong>Upload</strong>
          <p>Read every workbook sheet.</p>
        </div>
        <ArrowRight size={18} />
        <div>
          <span>02</span>
          <strong>Enrich</strong>
          <p>Derive names, MDR, and layers.</p>
        </div>
        <ArrowRight size={18} />
        <div>
          <span>03</span>
          <strong>Explore</strong>
          <p>Trace upstream and downstream.</p>
        </div>
      </div>
    </div>
  )
}
