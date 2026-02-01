import { useState, useEffect } from 'react'
import API_BASE from '../config/api'
import './YieldPanel.css'

const WALLETS = ['Mum', 'MGB', '36c1', 'Jigsaw']

export default function YieldPanel() {
  const [chain, setChain] = useState('pulsechain')
  const [yieldData, setYieldData] = useState({})
  const [loading, setLoading] = useState(false)
  const [claiming, setClaiming] = useState(null)
  const [config, setConfig] = useState({ claimIntervalHours: 24 })

  // Load addresses from localStorage
  const getAddress = (name) => {
    return localStorage.getItem(`wallet_addr_${name}`) || ''
  }

  // Fetch yield status for all wallets
  const fetchYieldStatus = async () => {
    setLoading(true)
    const data = {}
    
    for (const wallet of WALLETS) {
      const address = getAddress(wallet)
      if (!address) continue
      
      try {
        const res = await fetch(`${API_BASE}/api/yield/status/${address}?chain=${chain}`)
        const json = await res.json()
        if (json.success) {
          data[wallet] = json
        }
      } catch (err) {
        console.error(`Failed to fetch yield for ${wallet}:`, err)
      }
    }
    
    setYieldData(data)
    setLoading(false)
  }

  // Fetch config
  const fetchConfig = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/yield/config`)
      const json = await res.json()
      if (json.success) {
        setConfig(json.config)
      }
    } catch (err) {
      console.error('Failed to fetch config:', err)
    }
  }

  useEffect(() => {
    fetchConfig()
    fetchYieldStatus()
  }, [chain])

  // Claim yields for a wallet
  const handleClaim = async (wallet, force = false) => {
    const address = getAddress(wallet)
    if (!address) return
    
    setClaiming(wallet)
    try {
      const endpoint = force ? '/api/yield/claim-all' : '/api/yield/claim'
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keystoreName: wallet, address, chain })
      })
      const json = await res.json()
      
      if (json.success) {
        alert(`Claimed ${json.claimed || 0} properties, ${json.failed || 0} failed`)
        fetchYieldStatus()
      } else {
        alert(json.error || 'Claim failed')
      }
    } catch (err) {
      alert(err.message)
    }
    setClaiming(null)
  }

  // Update claim interval
  const handleIntervalChange = async (hours) => {
    try {
      await fetch(`${API_BASE}/api/yield/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimIntervalHours: parseInt(hours) })
      })
      setConfig(c => ({ ...c, claimIntervalHours: parseInt(hours) }))
    } catch (err) {
      console.error('Failed to update config:', err)
    }
  }

  // Calculate totals
  const totals = Object.values(yieldData).reduce((acc, data) => {
    acc.properties += data.totalProperties || 0
    acc.yielding += data.yieldingProperties || 0
    acc.ready += data.readyToClaim || 0
    acc.estimated += data.totalEstimatedYield || 0
    return acc
  }, { properties: 0, yielding: 0, ready: 0, estimated: 0 })

  return (
    <div className="yield-panel glass-panel">
      <div className="yield-header">
        <h3>🏠 Property Yields</h3>
        <div className="yield-controls">
          <select value={chain} onChange={(e) => setChain(e.target.value)}>
            <option value="pulsechain">PulseChain</option>
            <option value="bnb">BNB Chain</option>
          </select>
          <select 
            value={config.claimIntervalHours} 
            onChange={(e) => handleIntervalChange(e.target.value)}
            title="Auto-claim interval"
          >
            <option value="12">Every 12h</option>
            <option value="24">Every 24h</option>
            <option value="48">Every 48h</option>
            <option value="72">Every 72h</option>
          </select>
          <button 
            className="btn-secondary" 
            onClick={fetchYieldStatus}
            disabled={loading}
          >
            {loading ? '⏳' : '🔄'} Refresh
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="yield-summary">
        <div className="yield-stat">
          <span className="yield-stat-value">{totals.properties}</span>
          <span className="yield-stat-label">Properties</span>
        </div>
        <div className="yield-stat">
          <span className="yield-stat-value">{totals.yielding}</span>
          <span className="yield-stat-label">Yielding</span>
        </div>
        <div className="yield-stat highlight">
          <span className="yield-stat-value">{totals.ready}</span>
          <span className="yield-stat-label">Ready</span>
        </div>
        <div className="yield-stat highlight-gold">
          <span className="yield-stat-value">${totals.estimated.toLocaleString()}</span>
          <span className="yield-stat-label">Est. Yield</span>
        </div>
      </div>

      {/* Wallet Cards */}
      <div className="yield-wallets">
        {WALLETS.map(wallet => {
          const data = yieldData[wallet]
          const address = getAddress(wallet)
          
          if (!address) return null
          
          return (
            <div key={wallet} className="yield-wallet-card">
              <div className="yield-wallet-header">
                <span className="wallet-name">{wallet}</span>
                <div className="wallet-actions">
                  <button
                    className="btn-claim"
                    onClick={() => handleClaim(wallet, false)}
                    disabled={claiming === wallet || !data?.readyToClaim}
                    title="Claim ready properties"
                  >
                    {claiming === wallet ? '⏳' : '💰'} Claim
                  </button>
                  <button
                    className="btn-claim-all"
                    onClick={() => handleClaim(wallet, true)}
                    disabled={claiming === wallet}
                    title="Force claim all (override timer)"
                  >
                    ⚡ All
                  </button>
                </div>
              </div>
              
              {data ? (
                <div className="yield-wallet-stats">
                  <div className="stat-row">
                    <span>Properties</span>
                    <span>{data.totalProperties}</span>
                  </div>
                  <div className="stat-row">
                    <span>Yielding</span>
                    <span className="text-green">{data.yieldingProperties}</span>
                  </div>
                  <div className="stat-row">
                    <span>Ready to Claim</span>
                    <span className={data.readyToClaim > 0 ? 'text-amber' : ''}>{data.readyToClaim}</span>
                  </div>
                  <div className="stat-row highlight">
                    <span>Est. Yield</span>
                    <span className="text-gold">${(data.totalEstimatedYield || 0).toLocaleString()}</span>
                  </div>
                </div>
              ) : (
                <div className="yield-wallet-loading">
                  {loading ? 'Loading...' : 'No data'}
                </div>
              )}
              
              {/* Property Details */}
              {data?.properties?.length > 0 && (
                <div className="yield-properties">
                  {data.properties.filter(p => p.canYield).map(prop => (
                    <div key={prop.tileId} className="yield-property">
                      <span className="prop-stage">{prop.stage}</span>
                      <span className="prop-city">{prop.cityName}</span>
                      <span className="prop-yield">${prop.estimatedYield?.toLocaleString()}</span>
                      <span className={`prop-status ${prop.readyToClaim ? 'ready' : ''}`}>
                        {prop.readyToClaim ? '✓ Ready' : `${prop.hoursSinceClaim?.toFixed(0) || '?'}h`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
