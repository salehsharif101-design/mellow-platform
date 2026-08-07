import { useState } from 'react'

const AVAILABILITY_OPTIONS = ['Immediately', 'Within a month', '1 to 3 months', 'Just exploring']
const WORK_STYLE_OPTIONS = ['Remote', 'Hybrid', 'On-site']

export default function Step1Basics({ initial, onContinue, saving }) {
  const [fullName, setFullName] = useState(initial.full_name || '')
  const [jobTitle, setJobTitle] = useState(initial.job_title || '')
  const [currentCompany, setCurrentCompany] = useState(initial.current_company || '')
  const [location, setLocation] = useState(initial.location || '')
  const [bio, setBio] = useState(initial.bio || '')
  const [threeWords, setThreeWords] = useState(initial.three_words || '')
  const [proudOf, setProudOf] = useState(initial.proud_of || '')
  const [availability, setAvailability] = useState(initial.availability || '')
  const [workStyle, setWorkStyle] = useState(initial.work_style || [])

  const isValid = fullName.trim() && jobTitle.trim() && location.trim() && bio.trim() && availability

  function toggleWorkStyle(option) {
    setWorkStyle((prev) => (prev.includes(option) ? prev.filter((w) => w !== option) : [...prev, option]))
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!isValid) return
    onContinue({
      full_name: fullName.trim(),
      job_title: jobTitle.trim(),
      current_company: currentCompany.trim() || null,
      location: location.trim(),
      bio: bio.trim(),
      three_words: threeWords.trim() || null,
      proud_of: proudOf.trim() || null,
      availability,
      work_style: workStyle,
    })
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="field">
        <label htmlFor="full_name">Full name</label>
        <input
          id="full_name"
          className="input"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Jamie Rivera"
          required
        />
      </div>
      <div className="field">
        <label htmlFor="job_title">Current role or title</label>
        <input
          id="job_title"
          className="input"
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
          placeholder="Product Designer"
          required
        />
      </div>
      <div className="field">
        <label htmlFor="current_company">Current company (optional)</label>
        <input
          id="current_company"
          className="input"
          value={currentCompany}
          onChange={(e) => setCurrentCompany(e.target.value)}
          placeholder="e.g. Beanboat, Freelance, Between roles"
        />
      </div>
      <div className="field">
        <label htmlFor="location">Location (city)</label>
        <input
          id="location"
          className="input"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Lisbon, Portugal"
          required
        />
      </div>
      <div className="field">
        <label htmlFor="bio">Bio (2-3 sentences)</label>
        <textarea
          id="bio"
          className="input"
          rows={4}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Tell employers who you are in a couple of sentences."
          required
        />
      </div>
      <div className="field">
        <label htmlFor="three_words">How would your closest colleague describe you in three words? (optional)</label>
        <input
          id="three_words"
          className="input"
          value={threeWords}
          onChange={(e) => setThreeWords(e.target.value)}
          placeholder="e.g. curious, reliable, creative"
        />
      </div>
      <div className="field">
        <label htmlFor="proud_of">What is something you have done that you are genuinely proud of? (optional)</label>
        <textarea
          id="proud_of"
          className="input"
          rows={3}
          value={proudOf}
          onChange={(e) => setProudOf(e.target.value)}
          placeholder="Could be work, could be personal — anything that matters to you"
        />
      </div>

      <div className="field">
        <label>When can you start?</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginTop: 4 }}>
          {AVAILABILITY_OPTIONS.map((option) => {
            const selected = availability === option
            return (
              <button
                key={option}
                type="button"
                onClick={() => setAvailability(option)}
                className="card"
                style={{
                  padding: '14px 16px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                  background: selected ? 'var(--color-bg-soft)' : '#fff',
                  border: selected ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                  color: selected ? 'var(--color-primary)' : 'var(--color-text)',
                }}
              >
                {option}
              </button>
            )
          })}
        </div>
      </div>

      <div className="field">
        <label>How do you prefer to work? (optional)</label>
        <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
          {WORK_STYLE_OPTIONS.map((option) => {
            const selected = workStyle.includes(option)
            return (
              <button
                key={option}
                type="button"
                onClick={() => toggleWorkStyle(option)}
                className="tag"
                style={{
                  border: 'none',
                  cursor: 'pointer',
                  background: selected ? 'var(--color-primary)' : 'var(--color-bg-soft)',
                  color: selected ? '#fff' : 'var(--color-primary)',
                }}
              >
                {option}
              </button>
            )
          })}
        </div>
      </div>

      <button className="btn btn-primary" type="submit" disabled={!isValid || saving} style={{ alignSelf: 'flex-start' }}>
        {saving ? 'Saving…' : 'Continue'}
      </button>
    </form>
  )
}
