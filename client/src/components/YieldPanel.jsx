import { useState, useEffect } from 'react'
import API_BASE from '../config/api'
import YieldEligibilityBadge from './YieldEligibilityBadge'
import './YieldPanel.css'

const CHAINS = [
  { id: 'pulsechain', label: 'PLS', color: '#00d4aa' },
  { id: 'bnb', label: 'BNB', color: '#f0b90b' }
]

export default function YieldPanel({ wallets = [] }) {
  // Store yield data per chain
  const [yieldData, setYieldData] = useState({ pulsechain: {}, bnb: {} })
  const [loading, setLoading] = useState({ pulsechain: false, bnb: false })
  const [claiming, setClaiming] = useState(null)
  const [config, setConfig] = useState({ claimIntervalHours: 24 })
  const [expandedWallet, setExpandedWallet] = useState(null)

  // Get address from wallet object
  const getAddress = (wallet) => {
    if (typeof wallet === 'object' && wallet.address) return wallet.address
    return null
  }

  // Get wallet name
  const getWalletName = (wallet) => {
    if (typeof wallet === 'string') return wallet
    return wallet.name || ''
  }

  // Fetch yield status for all wallets on a specific chain
  const fetchYieldForChain = async (chainId) => {
    setLoading(prev => ({ ...prev, [chainId]: true }))
    const data = {}
    
    for (const wallet of wallets) {
      const address = getAddress(wallet)
      const name = getWalletName(wallet)
      if (!address) continue
      
      try {
        const res = await fetch(`${API_BASE}/api/yield/status/${address}?chain=${chainId}`)
        const json = await res.json()
        if (json.success) {
          data[name] = json
        }
      } catch (err) {
        console.error(`Failed to fetch yield for ${name} on ${chainId}:`, err)
      }
    }
    
    setYieldData(prev => ({ ...prev, [chainId]: data }))
    setLoading(prev => ({ ...prev, [chainId]: false }))
  }

  // Fetch both chains
  const fetchAllChains = () => {
    CHAINS.forEach(chain => fetchYieldForChain(chain.id))
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
  }, [])

  useEffect(() => {
    if (wallets.length > 0) {
      fetchAllChains()
    }
  }, [wallets])

  // Claim yields for a wallet on a chain
  const handleClaim = async (wallet, chainId, force = false) => {
    const address = getAddress(wallet)
    const name = getWalletName(wallet)
    if (!address) return
    
    setClaiming(`${name}-${chainId}`)
    try {
      const res = await fetch(`${API_BASE}/api/yield/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keystoreName: name, address, chain: chainId, force })
      })
      const json = await res.json()
      if (json.success) {
        fetchYieldForChain(chainId)
      }
    } catch (err) {
      console.error(`Failed to claim for ${name}:`, err)
    }
    setClaiming(null)
  }

  // Claim all yields for a chain across all wallets
  const handleClaimAll = async (chainId) => {
    setClaiming(`all-${chainId}`)
    for (const wallet of wallets) {
      const address = getAddress(wallet)
      const name = getWalletName(wallet)
      const data = yieldData[chainId]?.[name]
      if (!address || !data?.readyToClaim) continue
      
      try {
        await fetch(`${API_BASE}/api/yield/claim`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keystoreName: name, address, chain: chainId, force: false })
        })
      } catch (err) {
        console.error(`Failed to claim for ${name}:`, err)
      }
    }
    fetchYieldForChain(chainId)
    setClaiming(null)
  }

  // Get display name
  const getDisplayName = (wallet) => {
    const name = getWalletName(wallet)
    return name.length > 10 ? name.slice(0, 10) + '…' : name
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

  // Calculate totals for a chain
  const getTotals = (chainId) => {
    return Object.values(yieldData[chainId] || {}).reduce((acc, data) => {
      acc.properties += data.totalProperties || 0
      acc.yielding += data.yieldingProperties || 0
      acc.ready += data.readyToClaim || 0
      acc.estimated += data.totalEstimatedYield || 0
      return acc
    }, { properties: 0, yielding: 0, ready: 0, estimated: 0 })
  }

  const isAnyLoading = loading.pulsechain || loading.bnb

  return (
    <div className="yield-panel glass-panel">
      <div className="yield-header">
        <h3>🏠 Property Yields</h3>
        <div className="yield-controls">
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
            onClick={fetchAllChains}
            disabled={isAnyLoading}
          >
            {isAnyLoading ? '⏳' : '🔄'} Refresh
          </button>
        </div>
      </div>

      {/* Per-Chain Summary Stats */}
      <div className="yield-chains-grid">
        {CHAINS.map(chain => {
          const totals = getTotals(chain.id)
          const chainLoading = loading[chain.id]
          
          const isClaimingAll = claiming === `all-${chain.id}`
          
          return (
            <div key={chain.id} className={`yield-chain-summary chain-${chain.id}`}>
              <div className="chain-header" style={{ borderColor: chain.color }}>
                <span className="chain-badge" style={{ background: chain.color }}>{chain.label}</span>
                {chainLoading && <span className="loading-dot">⏳</span>}
                <button
                  className="btn-claim-all-chain"
                  onClick={() => handleClaimAll(chain.id)}
                  disabled={isClaimingAll || totals.ready === 0}
                  style={{ borderColor: chain.color }}
                >
                  {isClaimingAll ? '⏳ Claiming...' : `Claim All ${chain.label}`}
                </button>
              </div>
              <div className="yield-summary-compact">
                <div className="yield-stat-mini">
                  <span className="value">{totals.properties}</span>
                  <span className="label">Props</span>
                </div>
                <div className="yield-stat-mini">
                  <span className="value text-green">{totals.yielding}</span>
                  <span className="label">Yielding</span>
                </div>
                <div className="yield-stat-mini highlight">
                  <span className="value text-amber">{totals.ready}</span>
                  <span className="label">Ready</span>
                </div>
                <div className="yield-stat-mini highlight-gold">
                  <span className="value">${totals.estimated.toLocaleString()}</span>
                  <span className="label">Est.</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Combined Wallet Cards */}
      <div className="yield-wallets">
        {wallets.map(wallet => {
          const name = getWalletName(wallet)
          const displayName = getDisplayName(wallet)
          const address = getAddress(wallet)
          const isExpanded = expandedWallet === name
          
          if (!address) return null
          
          return (
            <div key={name} className={`yield-wallet-card ${isExpanded ? 'expanded' : ''}`}>
              <div 
                className="yield-wallet-header"
                onClick={() => setExpandedWallet(isExpanded ? null : name)}
              >
                <span className="wallet-name">{displayName}</span>
                <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
              </div>
              
              {/* Per-chain stats inline */}
              <div className="yield-wallet-chains">
                {CHAINS.map(chain => {
                  const data = yieldData[chain.id]?.[name]
                  const isClaiming = claiming === `${name}-${chain.id}`
                  
                  return (
                    <div key={chain.id} className={`wallet-chain-row chain-${chain.id}`}>
                      <span className="chain-mini-badge" style={{ background: chain.color }}>
                        {chain.label}
                      </span>
                      {data ? (
                        <>
                          <span className="stat">{data.totalProperties || 0} props</span>
                          <span className="stat text-green">{data.yieldingProperties || 0} yielding</span>
                          <span className={`stat ${data.readyToClaim > 0 ? 'text-amber' : ''}`}>
                            {data.readyToClaim || 0} ready
                          </span>
                          <span className="stat text-gold">
                            ${(data.totalEstimatedYield || 0).toLocaleString()}
                          </span>
                          <button
                            className="btn-claim-mini"
                            onClick={(e) => { e.stopPropagation(); handleClaim(wallet, chain.id, false) }}
                            disabled={isClaiming || !data?.readyToClaim}
                          >
                            {isClaiming ? '⏳' : 'Claim'}
                          </button>
                        </>
                      ) : (
                        <span className="no-data">No data</span>
                      )}
                    </div>
                  )
                })}
              </div>
              
              {/* Expanded property details */}
              {isExpanded && (
                <div className="yield-properties-expanded">
                  {CHAINS.map(chain => {
                    const data = yieldData[chain.id]?.[name]
                    if (!data?.properties?.length) return null
                    
                    return (
                      <div key={chain.id} className="chain-properties">
                        <h4 style={{ color: chain.color }}>{chain.label} Properties</h4>
                        <div className="yield-properties">
                          {data.properties.map(prop => (
                            <div key={prop.tileId} className={`yield-property ${prop.canYield ? '' : 'ineligible'}`}>
                              <span className="prop-stage">{prop.stage}</span>
                              <span className="prop-city">{prop.cityName}</span>
                              <YieldEligibilityBadge property={prop} />
                              {prop.canYield && (
                                <>
                                  <span className="prop-yield">${prop.estimatedYield?.toLocaleString()}</span>
                                  <span className={`prop-status ${prop.readyToClaim ? 'ready' : ''}`}>
                                    {prop.readyToClaim ? '✓ Ready' : `${prop.hoursSinceClaim?.toFixed(0) || '?'}h`}
                                  </span>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
