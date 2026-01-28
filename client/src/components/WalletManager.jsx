import { useState } from 'react'

function WalletManager({ onUnlock, apiBase }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showAddWallet, setShowAddWallet] = useState(false)
  const [newWallet, setNewWallet] = useState({ name: '', privateKey: '' })

  const handleUnlock = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    const result = await onUnlock(password)
    if (!result.success) {
      setError(result.error || 'Failed to unlock')
    }
    setLoading(false)
  }

  const handleAddWallet = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`${apiBase}/api/keystore/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWallet)
      })
      const data = await res.json()
      if (data.success) {
        setNewWallet({ name: '', privateKey: '' })
        setShowAddWallet(false)
        // Re-trigger unlock to refresh wallet list
        await onUnlock(password)
      } else {
        setError(data.error)
      }
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  return (
    <div className="wallet-manager">
      <div className="unlock-card">
        <div className="card-header">
          <h2>🔐 Unlock Wallets</h2>
        </div>
        <form onSubmit={handleUnlock}>
          <div className="form-group">
            <label>Global Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your master password"
              autoFocus
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <button type="submit" className="btn-primary" disabled={loading || !password}>
            {loading ? 'Unlocking...' : '🔓 Unlock All Wallets'}
          </button>
        </form>

        <div className="divider">
          <span>or</span>
        </div>

        {!showAddWallet ? (
          <button 
            className="btn-secondary" 
            onClick={() => setShowAddWallet(true)}
          >
            ➕ Add New Wallet
          </button>
        ) : (
          <form className="add-wallet-form" onSubmit={handleAddWallet}>
            <h3>Add New Wallet</h3>
            <div className="form-group">
              <label>Wallet Name</label>
              <input
                type="text"
                value={newWallet.name}
                onChange={(e) => setNewWallet({ ...newWallet, name: e.target.value })}
                placeholder="e.g., my-wallet"
              />
            </div>
            <div className="form-group">
              <label>Private Key</label>
              <input
                type="password"
                value={newWallet.privateKey}
                onChange={(e) => setNewWallet({ ...newWallet, privateKey: e.target.value })}
                placeholder="0x..."
              />
            </div>
            <div className="btn-group">
              <button type="submit" className="btn-primary" disabled={loading || !newWallet.name || !newWallet.privateKey}>
                Add Wallet
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowAddWallet(false)}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
      
      <div className="info-box">
        <h3>ℹ️ First Time Setup</h3>
        <p>If this is your first time, enter a new master password. This will be used to encrypt all your wallet passwords.</p>
        <p>To add existing Foundry keystores, you'll need to import their passwords after unlocking.</p>
      </div>
    </div>
  )
}

export default WalletManager
