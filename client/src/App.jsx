import { useState, useEffect } from 'react'
import { usePersistentState } from './hooks/usePersistentState'
import AutomationPage from './pages/AutomationPage'
import FoundryPage from './pages/FoundryPage'
import SettingsPage from './pages/SettingsPage'
import API_BASE from './config/api'
import './index.css'

function App() {
  const [activeTab, setActiveTab] = usePersistentState('nexus_active_tab', 'automation')
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [globalPassword, setGlobalPassword] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [serverStatus, setServerStatus] = useState('checking')
  const [error, setError] = useState('')
  const [restarting, setRestarting] = useState(false)
  const [lockTimeout, setLockTimeout] = usePersistentState('nexus_lock_timeout', 'never')
  const [unlockTime, setUnlockTime] = useState(null)

  const handleRestart = async () => {
    if (!confirm('Restart the server? This will stop all running scripts.')) return
    setRestarting(true)
    try {
      await fetch(`${API_BASE}/api/restart`, { method: 'POST' })
      // Wait and check for server to come back
      setTimeout(() => {
        setServerStatus('offline')
        setRestarting(false)
      }, 1000)
    } catch {
      setRestarting(false)
    }
  }

  // Check server health
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/health`)
        if (res.ok) {
          setServerStatus('online')
        } else {
          setServerStatus('offline')
        }
      } catch {
        setServerStatus('offline')
      }
    }
    checkHealth()
    const interval = setInterval(checkHealth, 30000)
    return () => clearInterval(interval)
  }, [])

  // Check keystore unlock status
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/keystore/status`)
        const data = await res.json()
        setIsUnlocked(data.isUnlocked)
      } catch {
        // Ignore
      }
    }
    if (serverStatus === 'online') {
      checkStatus()
    }
  }, [serverStatus])

  const handleUnlock = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const res = await fetch(`${API_BASE}/api/keystore/unlock-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput })
      })
      const data = await res.json()
      console.log('[App] Unlock response:', data)
      if (data.success) {
        setIsUnlocked(true)
        setGlobalPassword(passwordInput)
        localStorage.setItem('app_global_password', passwordInput)
        
        // Save wallet addresses from auto-test (makes detect buttons work immediately)
        if (data.addresses && Object.keys(data.addresses).length > 0) {
          console.log('[App] Saving addresses to localStorage:', data.addresses)
          localStorage.setItem('keystoreAddresses', JSON.stringify(data.addresses))
          // Also save individual wallet addresses for other features
          for (const [name, address] of Object.entries(data.addresses)) {
            localStorage.setItem(`wallet_addr_${name}`, address)
          }
        } else {
          console.warn('[App] No addresses returned from unlock!')
        }
        // Set unlock time for auto-lock timer
        setUnlockTime(Date.now())
      } else {
        setError(data.error || 'Failed to unlock')
      }
    } catch (err) {
      setError(err.message)
    }
  }

  const handleLock = async () => {
    await fetch(`${API_BASE}/api/keystore/lock-all`, { method: 'POST' })
    setIsUnlocked(false)
    setGlobalPassword('')
    setUnlockTime(null)
    localStorage.removeItem('app_global_password')
  }

  // Auto-lock timer
  useEffect(() => {
    if (!isUnlocked || lockTimeout === 'never' || !unlockTime) return
    
    const timeoutMs = parseInt(lockTimeout) * 60 * 60 * 1000 // Convert hours to ms
    const lockAt = unlockTime + timeoutMs
    const remaining = lockAt - Date.now()
    
    if (remaining <= 0) {
      handleLock()
      return
    }
    
    const timer = setTimeout(() => {
      handleLock()
      alert('Session locked due to timeout')
    }, remaining)
    
    return () => clearTimeout(timer)
  }, [isUnlocked, lockTimeout, unlockTime])

  if (serverStatus === 'offline') {
    return (
      <div className="app-container">
        <header className="app-header">
          <h1>🎮 Nexus Lite</h1>
          <span className="status offline">● Offline</span>
        </header>
        <main className="offline-message">
          <h2>⚠️ Server Offline</h2>
          <p>Start the server with:</p>
          <code>cd server && npm start</code>
        </main>
      </div>
    )
  }

  if (!isUnlocked) {
    return (
      <div className="app-container">
        <header className="app-header">
          <h1>🎮 Nexus Lite</h1>
          <span className="status online">● Online</span>
        </header>
        <main className="unlock-container">
          <div className="unlock-card">
            <h2>🔐 Unlock Wallets</h2>
            <form onSubmit={handleUnlock}>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter global password"
                autoFocus
              />
              {error && <div className="error">{error}</div>}
              <button type="submit" className="btn-primary">🔓 Unlock All Wallets</button>
            </form>
            
            <div className="first-time-info">
              <h3>📋 First Time Setup</h3>
              <div className="info-step">
                <strong>Step 1: App Password</strong>
                <p>Enter a password above. This encrypts your wallet passwords locally and is required each session.</p>
              </div>
              <div className="info-step">
                <strong>Step 2: Foundry Password</strong>
                <p>When creating wallets, you'll set a Foundry keystore password. This is used by the blockchain scripts.</p>
              </div>
              <div className="info-warning">
                <strong>⚠️ Important:</strong> All Foundry keystores must use the <em>same password</em> for automation to work. 
                Choose one password for all your wallets when creating them.
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>🎮 Nexus Lite</h1>
        <nav className="nav-tabs">
          <button 
            className={activeTab === 'automation' ? 'active' : ''} 
            onClick={() => setActiveTab('automation')}
          >
            ⚡ Automation
          </button>
          <button 
            className={activeTab === 'foundry' ? 'active' : ''} 
            onClick={() => setActiveTab('foundry')}
          >
            🔧 Foundry Wallets
          </button>
          <button 
            className={activeTab === 'settings' ? 'active' : ''} 
            onClick={() => setActiveTab('settings')}
          >
            ⚙️ Settings
          </button>
        </nav>
        <div className="header-controls">
          <span className="status online">● Online</span>
          <select 
            className="lock-timeout-select"
            value={lockTimeout}
            onChange={(e) => setLockTimeout(e.target.value)}
            title="Auto-lock timeout"
          >
            <option value="1">Lock: 1h</option>
            <option value="2">Lock: 2h</option>
            <option value="4">Lock: 4h</option>
            <option value="8">Lock: 8h</option>
            <option value="12">Lock: 12h</option>
            <option value="24">Lock: 24h</option>
            <option value="never">Never</option>
          </select>
          <button 
            className="btn-restart" 
            onClick={handleRestart}
            disabled={restarting}
            title="Restart server"
          >
            {restarting ? '⏳' : '🔄'} Restart
          </button>
          <button className="btn-lock" onClick={handleLock}>🔒 Lock</button>
        </div>
      </header>
      <main className="app-main">
        {activeTab === 'automation' && <AutomationPage />}
        {activeTab === 'foundry' && <FoundryPage />}
        {activeTab === 'settings' && <SettingsPage />}
      </main>
    </div>
  )
}

export default App
