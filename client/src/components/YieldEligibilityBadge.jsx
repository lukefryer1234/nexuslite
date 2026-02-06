import './YieldEligibilityBadge.css'

// Property tier names mapping
const TIER_NAMES = {
  0: 'Vacant',
  1: 'Shack',
  2: 'House',
  3: 'Apartment',
  4: 'Office',
  5: 'Warehouse',
  6: 'Factory',
  7: 'HQ'
}

// Minimum tier required for yield (Office = 4)
const MIN_YIELD_TIER = 4

export default function YieldEligibilityBadge({ property }) {
  const tier = property.slotSubType ?? property.stageLevel ?? 0
  const stakedMafia = property.stMafia ?? property.stakedMafia ?? 0
  const isOperating = property.isOperating === true
  
  const tierName = TIER_NAMES[tier] || `Tier ${tier}`
  const isTierEligible = tier >= MIN_YIELD_TIER
  
  // Determine eligibility status and message
  let status = 'ineligible'
  let statusText = ''
  let tooltip = ''
  
  if (isOperating && stakedMafia > 0) {
    status = 'operating'
    statusText = '✓ Generating Yield'
    tooltip = `${stakedMafia.toLocaleString()} MAFIA staked`
  } else if (!isTierEligible) {
    status = 'low-tier'
    statusText = `${tierName}`
    tooltip = 'Requires Office tier or higher'
  } else if (stakedMafia === 0) {
    status = 'no-stake'
    statusText = 'No Stake'
    tooltip = 'Requires staked MAFIA to operate'
  } else {
    status = 'not-operating'
    statusText = 'Not Operating'
    tooltip = 'Property is not generating yield'
  }
  
  return (
    <span 
      className={`yield-eligibility-badge status-${status}`}
      title={tooltip}
    >
      {statusText}
    </span>
  )
}
