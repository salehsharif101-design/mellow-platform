// Shared grid/list toggle for the employer talent feed and candidate browse
// roles pages — identical look, identical localStorage-backed behavior.
export default function ViewToggle({ mode, onChange }) {
  return (
    <div className="view-toggle">
      <button
        type="button"
        className={`view-toggle-btn${mode === 'grid' ? ' active' : ''}`}
        onClick={() => onChange('grid')}
        aria-pressed={mode === 'grid'}
      >
        <GridIcon /> Grid
      </button>
      <button
        type="button"
        className={`view-toggle-btn${mode === 'list' ? ' active' : ''}`}
        onClick={() => onChange('list')}
        aria-pressed={mode === 'list'}
      >
        <ListIcon /> List
      </button>
    </div>
  )
}

function GridIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

function ListIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  )
}
