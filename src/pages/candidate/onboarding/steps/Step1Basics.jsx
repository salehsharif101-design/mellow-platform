import { useState } from 'react'

export default function Step1Basics({ initial, onContinue, saving }) {
  const [fullName, setFullName] = useState(initial.full_name || '')
  const [jobTitle, setJobTitle] = useState(initial.job_title || '')
  const [location, setLocation] = useState(initial.location || '')
  const [bio, setBio] = useState(initial.bio || '')

  const isValid = fullName.trim() && jobTitle.trim() && location.trim() && bio.trim()

  function handleSubmit(e) {
    e.preventDefault()
    if (!isValid) return
    onContinue({
      full_name: fullName.trim(),
      job_title: jobTitle.trim(),
      location: location.trim(),
      bio: bio.trim(),
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
      <button className="btn btn-primary" type="submit" disabled={!isValid || saving} style={{ alignSelf: 'flex-start' }}>
        {saving ? 'Saving…' : 'Continue'}
      </button>
    </form>
  )
}
