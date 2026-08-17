import { useState } from 'react'
import Modal from './Modal.jsx'
import { supabase } from '../lib/supabase.js'

const ROLE_TYPES = ['full-time', 'part-time', 'contract', 'freelance']
const CURRENCIES = ['BHD', 'AED', 'SAR', 'USD']
const WORK_STYLE_OPTIONS = ['Remote', 'Hybrid', 'On-site']

export default function EditRoleModal({ role, onClose, onSaved }) {
  const [title, setTitle] = useState(role.title)
  const [location, setLocation] = useState(role.location || '')
  const [roleType, setRoleType] = useState(role.role_type)
  const [description, setDescription] = useState(role.description || '')
  const [whatMatters, setWhatMatters] = useState(role.what_matters || '')
  const [deadline, setDeadline] = useState(role.deadline || '')
  const [salaryMin, setSalaryMin] = useState(role.salary_min ?? '')
  const [salaryMax, setSalaryMax] = useState(role.salary_max ?? '')
  const [salaryCurrency, setSalaryCurrency] = useState(role.salary_currency || CURRENCIES[0])
  const [workStyle, setWorkStyle] = useState(role.work_style || '')
  const [isUrgent, setIsUrgent] = useState(role.is_urgent || false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const { data, error: saveError } = await supabase
      .from('roles')
      .update({
        title: title.trim(),
        location: location.trim(),
        role_type: roleType,
        description: description.trim(),
        what_matters: whatMatters.trim(),
        deadline: deadline || null,
        salary_min: salaryMin !== '' ? Number(salaryMin) : null,
        salary_max: salaryMax !== '' ? Number(salaryMax) : null,
        salary_currency: salaryMin !== '' || salaryMax !== '' ? salaryCurrency : null,
        work_style: workStyle || null,
        is_urgent: isUrgent,
      })
      .eq('id', role.id)
      .select()
      .single()
    if (saveError) {
      setError(saveError.message)
      setSaving(false)
      return
    }
    onSaved(data)
  }

  return (
    <Modal title="Edit role" onClose={onClose} width={520}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="field">
          <label>Job title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="field">
          <label>Location</label>
          <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} required />
        </div>
        <div className="field">
          <label>Role type</label>
          <select className="input" value={roleType} onChange={(e) => setRoleType(e.target.value)}>
            {ROLE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type[0].toUpperCase() + type.slice(1).replace('-', ' ')}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Work style (optional)</label>
          <select className="input" value={workStyle} onChange={(e) => setWorkStyle(e.target.value)}>
            <option value="">Not specified</option>
            {WORK_STYLE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <input
            id="edit_is_urgent"
            type="checkbox"
            checked={isUrgent}
            onChange={(e) => setIsUrgent(e.target.checked)}
            style={{ width: 'auto' }}
          />
          <label htmlFor="edit_is_urgent" style={{ marginBottom: 0 }}>
            Mark as urgent — we need to fill this quickly
          </label>
        </div>
        <div className="field">
          <label>What does the role involve?</label>
          <textarea className="input" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} required />
        </div>
        <div className="field">
          <label>What matters most in a hire?</label>
          <textarea className="input" rows={3} value={whatMatters} onChange={(e) => setWhatMatters(e.target.value)} />
        </div>
        <div className="field">
          <label>Application deadline (optional)</label>
          <input type="date" className="input" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </div>
        <div className="field">
          <label>Salary range (optional)</label>
          <div style={{ display: 'flex', gap: 10 }}>
            <select
              className="input"
              value={salaryCurrency}
              onChange={(e) => setSalaryCurrency(e.target.value)}
              style={{ flex: '0 0 90px' }}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              className="input"
              placeholder="Min"
              value={salaryMin}
              onChange={(e) => setSalaryMin(e.target.value)}
            />
            <input
              type="number"
              min="0"
              className="input"
              placeholder="Max"
              value={salaryMax}
              onChange={(e) => setSalaryMax(e.target.value)}
            />
          </div>
        </div>
        {error && <p className="form-error">{error}</p>}
        <button className="btn btn-primary" type="submit" disabled={saving} style={{ alignSelf: 'flex-start' }}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </Modal>
  )
}
