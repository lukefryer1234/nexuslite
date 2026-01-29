import { useState, useEffect, useCallback, useRef } from 'react'
import TravelSettingsPanel from './TravelSettingsPanel'

const CHAINS = [
  { id: 'pls', name: 'PulseChain', icon: '💜' },
  { id: 'bnb', name: 'BNB Chain', icon: '💛' }
]

const SCRIPTS = [
  { name: 'crime', displayName: 'Crime Loop', icon: '🔫', hasParams: true },
  { name: 'nickcar', displayName: 'Nick Car', icon: '🚗', hasParams: false },
  { name: 'killskill', displayName: 'Kill Skill', icon: '🎯', hasParams: true },
  { name: 'travel', displayName: 'Travel', icon: '✈️', hasParams: true }
]

function AutomationPanel({ selectedWallet, apiBase, socket }) {
  const [selectedChain, setSelectedChain] = useState('pls')
  const [scriptStatuses, setScriptStatuses] = useState({})
  const [logs, setLogs] = useState({})
  const [loading, setLoading] = useState({})
  const [travelSettings, setTravelSettings] = useState(null)
  const logRef = useRef(null)

  const fetchAllStatuses = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/scripts/all/status`)
      const data = await res.json()
      setScriptStatuses(data)
    } catch (err) {
      console.error('Failed to fetch statuses:', err)
    }
  }, [apiBase])

  const startScript = async (scriptName) => {
    if (!selectedWallet) return
    
    setLoading(prev => ({ ...prev, [`${scriptName}-${selectedChain}`]: true }))
    
    try {
      // Get wallet password first
      const pwRes = await fetch(`${apiBase}/api/keystore/address/${selectedWallet}`)
      const pwData = await pwRes.json()
      if (!pwData.success) {
        addLog(scriptName, selectedChain, `Error: ${pwData.error}`, 'error')
        return
      }

      // Build request body
      const requestBody = {
        chain: selectedChain,
        keystore: selectedWallet,
        walletId: selectedWallet
      }

      // Add travel settings if starting travel script
      if (scriptName === 'travel' && travelSettings) {
        const chainSettings = travelSettings[selectedChain]
        if (chainSettings) {
          requestBody.startCity = chainSettings.startCity
          requestBody.endCity = chainSettings.endCity
          requestBody.travelType = chainSettings.travelType
        }
      }

      const res = await fetch(`${apiBase}/api/scripts/${scriptName}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })
      const data = await res.json()
      if (data.success) {
        addLog(scriptName, selectedChain, `✅ Started for ${selectedWallet}`, 'success')
        fetchAllStatuses()
      } else {
        addLog(scriptName, selectedChain, `❌ ${data.error}`, 'error')
      }
    } catch (err) {
      addLog(scriptName, selectedChain, `❌ ${err.message}`, 'error')
    } finally {
      setLoading(prev => ({ ...prev, [`${scriptName}-${selectedChain}`]: false }))
    }
  }

  const stopScript = async (scriptName) => {
    setLoading(prev => ({ ...prev, [`${scriptName}-${selectedChain}`]: true }))
    
    try {
      const res = await fetch(`${apiBase}/api/scripts/${scriptName}/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chain: selectedChain,
          walletId: selectedWallet
        })
      })
      const data = await res.json()
      if (data.success || data.stopped) {
        addLog(scriptName, selectedChain, `⏹ Stopped`, 'info')
        fetchAllStatuses()
      }
    } catch (err) {
      addLog(scriptName, selectedChain, `❌ ${err.message}`, 'error')
    } finally {
      setLoading(prev => ({ ...prev, [`${scriptName}-${selectedChain}`]: false }))
    }
  }

  const addLog = (scriptName, chain, message, type = 'info') => {
    const key = `${scriptName}-${chain}`
    const logEntry = {
      timestamp: new Date().toISOString(),
      message,
      type
    }
    setLogs(prev => ({
      ...prev,
      [key]: [...(prev[key] || []).slice(-100), logEntry]
    }))
  }

  const isRunning = (scriptName, chain) => {
    const status = scriptStatuses[scriptName]?.[chain]
    if (!status) return false
    // Check if there's a running process for the selected wallet
    return status[selectedWallet]?.running || status.default?.running
  }

  const getScriptLogs = (scriptName) => {
    const key = `${scriptName}-${selectedChain}`
    return logs[key] || []
  }

  useEffect(() => {
    fetchAllStatuses()
    const interval = setInterval(fetchAllStatuses, 5000)
    return () => clearInterval(interval)
  }, [fetchAllStatuses])

  useEffect(() => {
    // Subscribe to socket events for real-time logs
    const eventNames = ['crime-log', 'nickcar-log', 'killskill-log', 'travel-log']
    
    const handleLog = (data) => {
      const { type, chain, output, walletId } = data
      if (walletId === selectedWallet || !walletId) {
        const scriptName = type?.replace('-log', '') || 'unknown'
        addLog(scriptName, chain, output, 'log')
      }
    }

    eventNames.forEach(event => {
      socket.on(event, handleLog)
    })

    return () => {
      eventNames.forEach(event => {
        socket.off(event, handleLog)
      })
    }
  }, [socket, selectedWallet])

  useEffect(() => {
    // Auto-scroll logs
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [logs])

  return (
    <div className="automation-panel">
      <div className="panel-header">
        <h2>⚡ Automation Scripts</h2>
        <div className="chain-selector">
          {CHAINS.map(chain => (
            <button
              key={chain.id}
              className={`chain-btn ${selectedChain === chain.id ? 'active' : ''}`}
              onClick={() => setSelectedChain(chain.id)}
            >
              {chain.icon} {chain.name}
            </button>
          ))}
        </div>
      </div>

      <div className="wallet-indicator">
        Active Wallet: <strong>{selectedWallet || 'None selected'}</strong>
      </div>

      <TravelSettingsPanel onSettingsChange={setTravelSettings} />

      <div className="scripts-grid">
        {SCRIPTS.map(script => {
          const running = isRunning(script.name, selectedChain)
          const isLoading = loading[`${script.name}-${selectedChain}`]
          
          return (
            <div key={script.name} className={`script-card ${running ? 'running' : ''}`}>
              <div className="script-header">
                <span className="script-icon">{script.icon}</span>
                <span className="script-name">{script.displayName}</span>
                {running && <span className="running-indicator">● Running</span>}
              </div>
              
              <div className="script-actions">
                {!running ? (
                  <button
                    className="btn-start"
                    onClick={() => startScript(script.name)}
                    disabled={isLoading || !selectedWallet}
                  >
                    {isLoading ? '...' : '▶ Start'}
                  </button>
                ) : (
                  <button
                    className="btn-stop"
                    onClick={() => stopScript(script.name)}
                    disabled={isLoading}
                  >
                    {isLoading ? '...' : '■ Stop'}
                  </button>
                )}
              </div>

              <div className="script-logs" ref={logRef}>
                {getScriptLogs(script.name).slice(-10).map((log, i) => (
                  <div key={i} className={`log-entry ${log.type}`}>
                    <span className="log-time">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="log-msg">{log.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default AutomationPanel
