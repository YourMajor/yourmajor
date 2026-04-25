'use client'

import { useState, useTransition } from 'react'
import Papa from 'papaparse'
import { Upload } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { importRosterCsv, type CsvRosterRow, type CsvImportResult } from '@/lib/roster-actions'

const FIELDS = ['name', 'email', 'phone', 'handicap', '(skip)'] as const
type Field = typeof FIELDS[number]

interface ParsedCsv {
  headers: string[]
  rows: string[][]
}

interface Props {
  tournamentId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

function guessField(header: string): Field {
  const h = header.trim().toLowerCase()
  if (h.includes('name')) return 'name'
  if (h.includes('email') || h.includes('e-mail')) return 'email'
  if (h.includes('phone') || h.includes('mobile') || h.includes('cell')) return 'phone'
  if (h.includes('hcp') || h.includes('handicap') || h.includes('index')) return 'handicap'
  return '(skip)'
}

export function RosterImportDialog({ tournamentId, open, onOpenChange }: Props) {
  const [parsed, setParsed] = useState<ParsedCsv | null>(null)
  const [mapping, setMapping] = useState<Field[]>([])
  const [error, setError] = useState('')
  const [result, setResult] = useState<CsvImportResult | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleFile(file: File) {
    setError('')
    setResult(null)
    Papa.parse<string[]>(file, {
      skipEmptyLines: true,
      complete: (out) => {
        if (out.errors.length > 0) {
          setError(`CSV parse error: ${out.errors[0].message}`)
          return
        }
        const data = out.data
        if (data.length === 0) {
          setError('CSV is empty.')
          return
        }
        const [headers, ...rows] = data
        setParsed({ headers, rows })
        setMapping(headers.map((h) => guessField(h)))
      },
      error: (err) => setError(`CSV parse error: ${err.message}`),
    })
  }

  function buildRows(): CsvRosterRow[] {
    if (!parsed) return []
    return parsed.rows
      .map((cells): CsvRosterRow => {
        const out: CsvRosterRow = {}
        mapping.forEach((field, i) => {
          const v = (cells[i] ?? '').trim()
          if (!v || field === '(skip)') return
          if (field === 'handicap') {
            const num = Number(v)
            if (Number.isFinite(num)) out.handicap = num
          } else {
            out[field] = v
          }
        })
        return out
      })
      .filter((r) => r.name || r.email || r.phone)
  }

  function handleImport() {
    const rows = buildRows()
    if (rows.length === 0) {
      setError('No valid rows to import.')
      return
    }
    startTransition(async () => {
      try {
        const r = await importRosterCsv(tournamentId, rows)
        setResult(r)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Import failed.')
      }
    })
  }

  function reset() {
    setParsed(null)
    setMapping([])
    setError('')
    setResult(null)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk Import Roster</DialogTitle>
          <DialogDescription>
            Upload a CSV with player names, emails, phone numbers, and handicaps. Rows with
            an existing roster member are skipped automatically.
          </DialogDescription>
        </DialogHeader>

        {!parsed && !result && (
          <label className="flex flex-col items-center justify-center gap-2 px-6 py-10 rounded-lg border-2 border-dashed border-border cursor-pointer hover:bg-muted/30 transition-colors">
            <Upload className="w-6 h-6 text-muted-foreground" />
            <span className="text-sm font-medium">Choose a CSV file</span>
            <span className="text-[11px] text-muted-foreground">First row should be headers (name, email, phone, handicap).</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
              }}
            />
          </label>
        )}

        {parsed && !result && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {parsed.rows.length} rows detected. Map each column to a roster field, then import.
            </p>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr>
                    {parsed.headers.map((h, i) => (
                      <th key={i} className="text-left px-3 py-2 font-semibold">
                        <div>{h}</div>
                        <select
                          value={mapping[i]}
                          onChange={(e) => {
                            const next = [...mapping]
                            next[i] = e.target.value as Field
                            setMapping(next)
                          }}
                          className="mt-1 w-full px-2 py-1 rounded border border-border text-[11px] bg-background"
                        >
                          {FIELDS.map((f) => (
                            <option key={f} value={f}>{f}</option>
                          ))}
                        </select>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsed.rows.slice(0, 6).map((r, i) => (
                    <tr key={i} className="border-t border-border">
                      {r.map((c, j) => (
                        <td key={j} className="px-3 py-1.5 truncate max-w-[160px]">{c}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed.rows.length > 6 && (
                <p className="px-3 py-2 text-[11px] text-muted-foreground border-t border-border">
                  Preview: 6 of {parsed.rows.length} rows.
                </p>
              )}
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-2 text-sm">
            <p className="font-semibold">Import complete</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>{result.added} added · {result.reactivated} reactivated · {result.skipped} skipped</li>
              <li>{result.invalid} invalid rows ignored</li>
              <li>{result.invitedEmails} email invites · {result.invitedPhones} SMS invites sent</li>
              {result.duplicateEmails.length > 0 && (
                <li>Already invited: {result.duplicateEmails.slice(0, 5).join(', ')}{result.duplicateEmails.length > 5 ? '…' : ''}</li>
              )}
            </ul>
          </div>
        )}

        {error && <p className="text-xs text-red-500">{error}</p>}

        <DialogFooter>
          {result ? (
            <button
              type="button"
              onClick={() => { reset(); onOpenChange(false) }}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              Done
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={isPending}
                onClick={() => onOpenChange(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-muted/40"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending || !parsed}
                onClick={handleImport}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {isPending ? 'Importing…' : 'Import roster'}
              </button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
