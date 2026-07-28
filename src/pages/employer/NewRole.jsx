import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabase.js'

const ROLE_TYPES = ['full-time', 'part-time', 'contract', 'freelance']

export default function NewRole() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [employerId, setEmployerId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [roleType, setRoleType] = useState(ROLE_TYPES[0])
  const [description, setDescription] = useState('')
  const [whatMatters, setWhatMatters] = useState('')

  useEffect(() => {
    if (!user) return

    async function loadEmployer() {
      const { data, error: fetchError } = await supabase
        .from('employer_profiles')
        .select('id, company_name')
        .eq('user_id', user.id)
        .maybeSingle()

      if (fetchError) {
        setError(fetchError.message)
      } else if (!data) {
        navigate('/employer/onboarding')
        return
      } else {
        setEmployerId(data.id)
      }
      setLoading(false)
    }

    loadEmployer()
  }, [user, navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const { error: insertError } = await supabase.from('roles').insert({
        employer_id: employerId,
        title: title.trim(),
        location: location.trim(),
        role_type: roleType,
        description: description.trim(),
        what_matters: whatMatters.trim(),
      })
      if (insertError) throw insertError
      navigate('/employer/roles')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return null

  const isValid = title.trim() && location.trim() && description.trim()

  return (
    <div className="section">
      <div
        style={{
          display: 'flex',
          gap: 48,
          maxWidth: 1000,
          margin: '0 auto',
          alignItems: 'flex-start',
        }}
      >
        <div style={{ flex: '1 1 420px', minWidth: 0 }}>
          <h1 style={{ fontSize: 28 }}>Post a new role</h1>
          <p style={{ marginTop: 8, color: 'var(--color-text-muted)', fontSize: 15 }}>
            Candidates will see this in their feed alongside your company details.
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 28 }}>
            <div className="field">
              <label htmlFor="title">Job title</label>
              <input
                id="title"
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Senior Backend Engineer"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="location">Location</label>
              <input
                id="location"
                className="input"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Remote, or a city"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="role_type">Role type</label>
              <select
                id="role_type"
                className="input"
                value={roleType}
                onChange={(e) => setRoleType(e.target.value)}
              >
                {ROLE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type[0].toUpperCase() + type.slice(1).replace('-', ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="description">What does the role involve?</label>
              <textarea
                id="description"
                className="input"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the day-to-day of this role."
                required
              />
            </div>
            <div className="field">
              <label htmlFor="what_matters">What matters most in a candidate?</label>
              <textarea
                id="what_matters"
                className="input"
                rows={3}
                value={whatMatters}
                onChange={(e) => setWhatMatters(e.target.value)}
                placeholder="Skills, traits, or experience you care about most."
              />
            </div>
            {error && <p className="form-error">{error}</p>}
            <button className="btn btn-primary" type="submit" disabled={!isValid || saving} style={{ alignSelf: 'flex-start' }}>
              {saving ? 'Posting…' : 'Post role'}
            </button>
          </form>
        </div>

        <div
          className="card"
          style={{
            flex: '0 0 280px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            padding: 32,
            background: 'var(--color-bg-soft)',
            border: 'none',
          }}
        >
          <img src="/Your_Requested_Is_Posted.png" alt="" style={{ width: '100%', maxWidth: 220 }} />
          <p style={{ marginTop: 16, fontSize: 14, color: 'var(--color-text-muted)' }}>
            Once posted, your role goes straight into the candidate feed.
          </p>
        </div>
      </div>
    </div>
  )
}
