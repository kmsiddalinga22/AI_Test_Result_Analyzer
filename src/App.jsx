import { useState, useRef } from 'react'
import './App.css'

// ── Parse the ## SECTION blocks from the AI response text ───────────────────
function parseResponseText(text) {
  const result = { summary: null, errorBuckets: [], failedTests: [] }

  // Summary counts: "Counts — Total: 55 | Passed: 47 | Failed: 8 | Skipped: 0"
  const countsMatch = text.match(
    /Total:\s*(\d+)\s*\|\s*Passed:\s*(\d+)\s*\|\s*Failed:\s*(\d+)\s*\|\s*Skipped:\s*(\d+)/i
  )
  if (countsMatch) {
    result.summary = {
      total:   parseInt(countsMatch[1]),
      passed:  parseInt(countsMatch[2]),
      failed:  parseInt(countsMatch[3]),
      skipped: parseInt(countsMatch[4]),
    }
  }

  const rateMatch = text.match(/failure rate of ([\d.]+%)/)
  if (rateMatch && result.summary) result.summary.failureRate = rateMatch[1]

  const errorSection = text.match(/##\s*ERROR_BUCKET_SUMMARY\s*\n+([\s\S]*?)(?=\n##|$)/)?.[1] || ''
  result.errorBuckets = errorSection
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(line => {
      const m = line.match(/^(.+?):\s*(\d+)\s*test/i)
      return m ? { category: m[1].trim(), count: parseInt(m[2]) } : null
    })
    .filter(Boolean)

  const failedSection = text.match(/##\s*FAILED_TEST_DETAILS\s*\n+([\s\S]*)$/)?.[1] || ''
  const blocks = failedSection.split(/\n(?=\d+\.\s)/).filter(b => b.trim())
  result.failedTests = blocks.map(block => {
    const nameMatch  = block.match(/Test name:\s*(.+)/i)
    const errorMatch = block.match(/Error message:\s*(.+)/i)
    const retryMatch = block.match(/Retry count:\s*(\d+)/i)
    const bucketMatch = block.match(/Bucket:\s*(.+)/i)
    const error = errorMatch?.[1]?.trim() || null
    // Derive bucket from error message when not explicit
    let bucket = bucketMatch?.[1]?.trim() || null
    if (!bucket) {
      if (!error) bucket = 'Unknown'
      else if (/timeout/i.test(error)) bucket = 'Performance'
      else if (/expect|toBe|toEqual|toHave|assertion/i.test(error)) bucket = 'Assertion'
      else if (/message did not appear/i.test(error)) bucket = 'Application'
      else bucket = 'Unknown'
    }
    return {
      name:  nameMatch?.[1]?.trim() || 'Unknown test',
      error,
      retry: retryMatch ? parseInt(retryMatch[1]) : 0,
      bucket,
    }
  })

  return result
}

const BUCKET_STYLES = {
  Performance: { bg: '#fff3e0', border: '#ff9800', text: '#e65100', icon: 'zap' },
  Assertion:   { bg: '#fff8e1', border: '#ffc107', text: '#b45309', icon: 'search' },
  Application: { bg: '#fce4ec', border: '#f44336', text: '#b91c1c', icon: 'boom' },
  Unknown:     { bg: '#f3e5f5', border: '#9c27b0', text: '#6b21a8', icon: 'question' },
}
const getBucketStyle = cat =>
  BUCKET_STYLES[cat] ?? { bg: '#e8eaf6', border: '#6366f1', text: '#3730a3', icon: 'wrench' }

const BUCKET_ICONS = { zap: '⚡', search: '🔍', boom: '💥', question: '❓', wrench: '🔧' }

export default function App() {
  const [file,    setFile]    = useState(null)
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState(null)
  const [rawText, setRawText] = useState('')
  const [error,   setError]   = useState(null)
  const inputRef = useRef()

  const handleFileChange = f => {
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.json')) {
      setError('Please select a JSON file.')
      return
    }
    setFile(f)
    setResult(null)
    setRawText('')
    setError(null)
  }

  const handleRemove = e => {
    e.stopPropagation()
    setFile(null)
    setResult(null)
    setRawText('')
    setError(null)
  }

  const handleAnalyze = async () => {
    if (!file || loading) return
    setLoading(true)
    setError(null)
    setResult(null)
    setRawText('')

    try {
      const form = new FormData()
      form.append('file', file)
      const res  = await fetch('/api/analyze', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      const text = data?.outputs?.[0]?.outputs?.[0]?.results?.message?.text
      if (!text) throw new Error('Unexpected response structure from Langflow.')
      setRawText(text)
      setResult(parseResponseText(text))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const passRate = result?.summary
    ? Math.round((result.summary.passed / result.summary.total) * 100)
    : 0

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <span className="header-logo">🧪</span>
          <div>
            <h1>Test Result Analyzer</h1>
            <p>AI-powered analysis · Langflow + Groq llama-3.3-70b</p>
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="card upload-card">
          <h2 className="card-title">Upload Test Result</h2>
          <div
            className={`drop-zone${file ? ' has-file' : ''}`}
            onClick={() => !file && inputRef.current.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); handleFileChange(e.dataTransfer.files[0]) }}
          >
            <input
              ref={inputRef} type="file" accept=".json"
              style={{ display: 'none' }}
              onChange={e => handleFileChange(e.target.files[0])}
            />
            {file ? (
              <div className="file-row">
                <span className="file-icon">📄</span>
                <div className="file-meta">
                  <span className="file-name">{file.name}</span>
                  <span className="file-size">{(file.size / 1024).toFixed(1)} KB</span>
                </div>
                <button className="btn-remove" onClick={handleRemove}>✕</button>
              </div>
            ) : (
              <div className="dz-placeholder">
                <div className="dz-big-icon">📂</div>
                <p className="dz-text">Click to browse or drag and drop</p>
                <p className="dz-hint">Playwright / Jest / Cypress JSON result file</p>
              </div>
            )}
          </div>
          <button
            className={`btn-analyze${loading ? ' loading' : ''}`}
            onClick={handleAnalyze}
            disabled={!file || loading}
          >
            {loading ? <><span className="spinner" /> Analyzing…</> : '▶  Run AI Analysis'}
          </button>
        </div>

        {error && <div className="alert-error"><strong>Error — </strong>{error}</div>}

        {result && (
          <div className="results-area">
            {result.summary && (
              <div className="card summary-card">
                <h2 className="card-title">📊 Summary</h2>
                <div className="stats-grid">
                  <div className="stat-box stat-total">
                    <div className="stat-num">{result.summary.total}</div>
                    <div className="stat-lbl">Total</div>
                  </div>
                  <div className="stat-box stat-passed">
                    <div className="stat-num">{result.summary.passed}</div>
                    <div className="stat-lbl">Passed</div>
                  </div>
                  <div className="stat-box stat-failed">
                    <div className="stat-num">{result.summary.failed}</div>
                    <div className="stat-lbl">Failed</div>
                  </div>
                  <div className="stat-box stat-skipped">
                    <div className="stat-num">{result.summary.skipped}</div>
                    <div className="stat-lbl">Skipped</div>
                  </div>
                </div>
                <div className="progress-wrap">
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${passRate}%` }} />
                  </div>
                  <span className="progress-label">{passRate}% pass rate</span>
                </div>
                {result.summary.failureRate && (
                  <p className="failure-note">
                    Failure rate: <strong>{result.summary.failureRate}</strong> — significant issues need attention.
                  </p>
                )}
              </div>
            )}

            {result.errorBuckets.length > 0 && (
              <div className="card">
                <h2 className="card-title">🪣 Error Bucket Summary</h2>
                <div className="buckets-grid">
                  {result.errorBuckets.map(b => {
                    const s = getBucketStyle(b.category)
                    return (
                      <div key={b.category} className="bucket-card"
                        style={{ background: s.bg, borderColor: s.border }}>
                        <div className="bucket-icon">{BUCKET_ICONS[s.icon]}</div>
                        <div className="bucket-count" style={{ color: s.text }}>{b.count}</div>
                        <div className="bucket-name"  style={{ color: s.text }}>{b.category}</div>
                        <div className="bucket-sub">tests</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {result.failedTests.length > 0 && (
              <div className="card">
                <h2 className="card-title">❌ Failed Test Details</h2>
                <div className="table-wrap">
                  <table className="failed-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Test Name</th>
                        <th>Error Message</th>
                        <th>Bucket</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.failedTests.map((t, i) => {
                        const s = getBucketStyle(t.bucket)
                        return (
                          <tr key={i}>
                            <td className="td-num">{i + 1}</td>
                            <td className="td-name">{t.name}</td>
                            <td className="td-error">
                              {t.error
                                ? t.error
                                : <span className="no-detail">No error details available</span>}
                            </td>
                            <td className="td-bucket">
                              <span className="bucket-pill"
                                style={{ background: s.bg, color: s.text, borderColor: s.border }}>
                                {BUCKET_ICONS[s.icon]} {t.bucket}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <details className="card raw-card">
              <summary className="raw-toggle">🤖 Raw AI Output</summary>
              <pre className="raw-text">{rawText}</pre>
            </details>
          </div>
        )}
      </main>
    </div>
  )
}
