import { useState, useEffect } from 'react'
import AutomationPage from './pages/AutomationPage'
import FoundryPage from './pages/FoundryPage'
import SettingsPage from './pages/SettingsPage'
import API_BASE from './config/api'
import './index.css'

function App() {
  const [activeTab, setActiveTab] = useState('automation')
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [globalPassword, setGlobalPassword] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [serverStatus, setServerStatus] = useState('checking')
  const [error, setError] = useState('')
  const [restarting, setRestarting] = useState(false)

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
      if (data.success) {
        setIsUnlocked(true)
        setGlobalPassword(passwordInput)
        localStorage.setItem('app_global_password', passwordInput)
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
    localStorage.removeItem('app_global_password')
  }

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
            <p className="hint">First time? Enter a new password to set up encryption.</p>
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
