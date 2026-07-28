import { useState } from 'react'
import Modal from './Modal.jsx'
import { supabase } from '../lib/supabase.js'

const ROLE_TYPES = ['full-time', 'part-time', 'contract', 'freelance']

export default function EditRoleModal({ role, onClose, onSaved }) {
  const [title, setTitle] = useState(role.title)
  const [location, setLocation] = useState(role.location || '')
  const [roleType, setRoleType] = useState(role.role_type)
  const [description, setDescription] = useState(role.description || '')
  const [whatMatters, setWhatMatters] = useState(role.what_matters || '')
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
          <label>What does the role involve?</label>
          <textarea className="input" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} required />
        </div>
        <div className="field">
          <label>What matters most in a candidate?</label>
          <textarea className="input" rows={3} value={whatMatters} onChange={(e) => setWhatMatters(e.target.value)} />
        </div>
        {error && <p className="form-error">{error}</p>}
        <button className="btn btn-primary" type="submit" disabled={saving} style={{ alignSelf: 'flex-start' }}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </Modal>
  )
}
