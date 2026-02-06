import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import API_BASE from '../config/api'
import './LogsPage.css'

const SOCKET_URL = API_BASE

const LEVEL_COLORS = {
  INFO: '#60a5fa',
  WARN: '#fbbf24', 
  ERROR: '#ef4444',
  DEBUG: '#a78bfa',
  SUCCESS: '#22c55e'
}

const LEVEL_ICONS = {
  INFO: 'ℹ️',
  WARN: '⚠️',
  ERROR: '❌',
  DEBUG: '🔍',
  SUCCESS: '✅'
}

export default function LogsPage() {
  const [logs, setLogs] = useState([])
  const [connected, setConnected] = useState(false)
  const [filter, setFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [scriptTypeFilter, setScriptTypeFilter] = useState('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const [paused, setPaused] = useState(false)
  const logsEndRef = useRef(null)
  const socketRef = useRef(null)

  // Get unique sources from logs
  const sources = [...new Set(logs.map(l => l.source))].sort()

  // Script type categories for filtering
  const SCRIPT_TYPES = [
    { value: 'all', label: 'All Types' },
    { value: 'crime', label: '🔪 Crime' },
    { value: 'nickcar', label: '🚗 Nick Car' },
    { value: 'killskill', label: '⚔️ Kill Skill' },
    { value: 'travel', label: '✈️ Travel' },
    { value: 'yield', label: '🏠 Yield Claim' },
    { value: 'gas', label: '⛽ Gas Balance' },
    { value: 'server', label: '🖥️ Server' },
    { value: 'other', label: '📦 Other' }
  ]

  // Helper to extract script type from source
  const getScriptType = (source) => {
    const lowerSource = source.toLowerCase()
    if (lowerSource.includes('crime')) return 'crime'
    if (lowerSource.includes('nickcar') || lowerSource.includes('nick')) return 'nickcar'
    if (lowerSource.includes('killskill') || lowerSource.includes('kill')) return 'killskill'
    if (lowerSource.includes('travel')) return 'travel'
    if (lowerSource.includes('yield') || lowerSource.includes('property')) return 'yield'
    if (lowerSource.includes('gas') || lowerSource.includes('balance')) return 'gas'
    if (lowerSource.includes('server') || lowerSource.includes('keystore')) return 'server'
    return 'other'
  }

  useEffect(() => {
    // Connect to socket
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling']
    })
    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      socket.emit('logs:subscribe')
    })

    socket.on('disconnect', () => {
      setConnected(false)
    })

    socket.on('logs:history', (history) => {
      setLogs(history)
    })

    socket.on('logs:new', (entry) => {
      if (!paused) {
        setLogs(prev => [...prev.slice(-999), entry])
      }
    })

    socket.on('logs:cleared', () => {
      setLogs([])
    })

    return () => {
      socket.emit('logs:unsubscribe')
      socket.disconnect()
    }
  }, [paused])

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, autoScroll])

  const handleClear = async () => {
    try {
      await fetch(`${API_BASE}/api/logs/clear`, { method: 'POST' })
      setLogs([])
    } catch (e) {
      console.error('Failed to clear logs:', e)
    }
  }

  const handleExport = () => {
    const content = filteredLogs.map(l => 
      `[${l.timestamp}] [${l.level}] [${l.source}] ${l.message}${Object.keys(l.meta || {}).length ? ' ' + JSON.stringify(l.meta) : ''}`
    ).join('\n')
    
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `nexus-logs-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Filter logs
  const filteredLogs = logs.filter(log => {
    if (filter !== 'all' && log.level !== filter) return false
    if (sourceFilter !== 'all' && log.source !== sourceFilter) return false
    if (scriptTypeFilter !== 'all' && getScriptType(log.source) !== scriptTypeFilter) return false
    if (searchQuery && !log.message.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !log.source.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  // Stats
  const stats = {
    total: logs.length,
    errors: logs.filter(l => l.level === 'ERROR').length,
    warnings: logs.filter(l => l.level === 'WARN').length,
    success: logs.filter(l => l.level === 'SUCCESS').length
  }

  return (
    <div className="logs-page">
      <div className="logs-header">
        <div className="logs-title">
          <h2>📋 Activity Logs</h2>
          <span className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
            {connected ? '● Live' : '○ Disconnected'}
          </span>
        </div>

        <div className="logs-stats">
          <span className="stat">Total: <strong>{stats.total}</strong></span>
          <span className="stat error">Errors: <strong>{stats.errors}</strong></span>
          <span className="stat warning">Warnings: <strong>{stats.warnings}</strong></span>
          <span className="stat success">Success: <strong>{stats.success}</strong></span>
        </div>

        <div className="logs-controls">
          <input
            type="text"
            placeholder="Search logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />

          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All Levels</option>
            <option value="INFO">Info</option>
            <option value="WARN">Warnings</option>
            <option value="ERROR">Errors</option>
            <option value="SUCCESS">Success</option>
            <option value="DEBUG">Debug</option>
          </select>

          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
            <option value="all">All Sources</option>
            {sources.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select value={scriptTypeFilter} onChange={(e) => setScriptTypeFilter(e.target.value)} title="Filter by script type">
            {SCRIPT_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>

          <button 
            className={`btn-toggle ${autoScroll ? 'active' : ''}`}
            onClick={() => setAutoScroll(!autoScroll)}
            title="Auto-scroll to new logs"
          >
            {autoScroll ? '📍 Auto-scroll' : '📍 Manual'}
          </button>

          <button 
            className={`btn-toggle ${paused ? 'active' : ''}`}
            onClick={() => setPaused(!paused)}
            title={paused ? 'Resume live updates' : 'Pause live updates'}
          >
            {paused ? '▶️ Resume' : '⏸️ Pause'}
          </button>

          <button className="btn-secondary" onClick={handleExport} title="Export logs">
            📥 Export
          </button>

          <button className="btn-danger" onClick={handleClear} title="Clear all logs">
            🗑️ Clear
          </button>
        </div>
      </div>

      <div className="logs-container">
        {filteredLogs.length === 0 ? (
          <div className="logs-empty">
            <p>No logs to display</p>
            <span>Activity will appear here as it happens</span>
          </div>
        ) : (
          <div className="logs-list">
            {filteredLogs.map(log => (
              <div 
                key={log.id} 
                className={`log-entry level-${log.level.toLowerCase()}`}
              >
                <span className="log-time">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span 
                  className="log-level" 
                  style={{ color: LEVEL_COLORS[log.level] }}
                >
                  {LEVEL_ICONS[log.level]} {log.level}
                </span>
                <span className="log-source">[{log.source}]</span>
                <span className="log-message">{log.message}</span>
                {log.meta && Object.keys(log.meta).length > 0 && (
                  <span className="log-meta">{JSON.stringify(log.meta)}</span>
                )}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>
    </div>
  )
}
