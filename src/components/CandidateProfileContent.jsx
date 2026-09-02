import VideoPlayCard from './VideoPlayCard.jsx'
import CandidateAvatar from './CandidateAvatar.jsx'

const SECTION_TITLE_STYLE = { fontSize: 20, marginBottom: 16 }

// The read-only body of a candidate's profile — avatar/name/headline, intro
// video, Watch me work, about, skills, languages, what I'm most proud of,
// and education. Shared between the public profile page and the employer
// shortlist page's inline right panel, which both need the exact same
// content but different surrounding chrome (PublicProfile's page-level
// hero actions and icon row vs. Shortlist's dedicated message/book-meeting/
// remove action bar) — so the icon row and Book a meeting pill are optional
// slots passed in by the caller rather than baked in here, and there's no
// data fetching or page-level state (modals, view tracking) in this
// component at all.
export default function CandidateProfileContent({ profile, videos = [], isOwner = false, onAddVideo, headerIcons, bookMeetingButton }) {
  return (
    <div className="profile-card">
      <div className="profile-hero-body">
        <div className="profile-hero-info">
          <div className="profile-hero-avatar-row">
            <CandidateAvatar avatarUrl={profile.avatar_url} fullName={profile.full_name} size={96} style={{ fontSize: 32 }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="profile-name-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <h1 style={{ fontSize: 28 }}>{profile.full_name}</h1>
                  {headerIcons}
                </div>
                {bookMeetingButton}
              </div>
              <p style={{ marginTop: 6, fontSize: 16, color: 'var(--color-text-muted)' }}>
                {profile.current_company ? `${profile.job_title} at ${profile.current_company}` : profile.job_title}
                {profile.location && ` · ${profile.location}`}
                {profile.years_of_experience && ` · ${profile.years_of_experience}`}
              </p>

              {profile.headline && (
                <p style={{ marginTop: 12, fontSize: 18, fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.5 }}>
                  {profile.headline}
                </p>
              )}

              {(profile.availability || profile.work_style?.length > 0) && (
                <div className="profile-tag-row" style={{ marginTop: 12 }}>
                  {profile.availability && (
                    <span className="tag" style={{ fontSize: 12, fontWeight: 600, background: '#e3f9e9', color: '#0f7a3d' }}>
                      Available: {profile.availability}
                    </span>
                  )}
                  {profile.work_style?.map((w) => (
                    <span key={w} className="tag" style={{ fontSize: 12 }}>
                      {w}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 40, display: 'flex', justifyContent: 'center' }}>
        {profile.intro_video_url ? (
          <VideoPlayCard url={profile.intro_video_url} format="auto" style={{ width: '100%' }} />
        ) : (
          <div
            style={{
              borderRadius: 10,
              background: 'var(--color-bg-soft)',
              aspectRatio: '9 / 16',
              width: '100%',
              maxWidth: 320,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text-muted)',
              fontSize: 14,
              textAlign: 'center',
              padding: 16,
            }}
          >
            No intro video yet
          </div>
        )}
      </div>

      {(isOwner || videos.length > 0) && (
        <div style={{ marginTop: 48 }}>
          {!isOwner && videos.length > 0 && (
            <>
              <h2 style={SECTION_TITLE_STYLE}>Watch me work</h2>
              <p style={{ marginTop: -8, marginBottom: 16, fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                These videos show how this person thinks, operates, and approaches real work, not just how they
                present themselves.
              </p>
            </>
          )}

          {isOwner && videos.length === 0 && (
            <div>
              <h2 style={SECTION_TITLE_STYLE}>Watch me work</h2>
              <p style={{ marginTop: -8, fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                Add videos to show employers how you think and operate. This is your biggest differentiator.
              </p>
              <button type="button" className="btn btn-primary" onClick={onAddVideo} style={{ marginTop: 16 }}>
                Add a work video
              </button>
            </div>
          )}

          {isOwner && videos.length > 0 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
                ...SECTION_TITLE_STYLE,
              }}
            >
              <h2 style={{ fontSize: 20 }}>Watch me work</h2>
              <button className="btn btn-ghost" style={{ fontSize: 13, padding: '6px 14px' }} onClick={onAddVideo}>
                + Add work video
              </button>
            </div>
          )}

          {videos.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 16,
                marginTop: 16,
              }}
            >
              {videos.map((v) => (
                <div key={v.id}>
                  <VideoPlayCard url={v.video_url} format="horizontal" />
                  <p style={{ marginTop: 8, fontSize: 13, fontWeight: 600 }}>{v.label}</p>
                  {v.description && <p style={{ marginTop: 2, fontSize: 12, color: 'var(--color-text-muted)' }}>{v.description}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {profile.bio && (
        <div id="about-section" style={{ marginTop: 48 }}>
          <h2 style={SECTION_TITLE_STYLE}>About</h2>
          <p style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--color-text)' }}>{profile.bio}</p>
        </div>
      )}

      {profile.skills?.length > 0 && (
        <div style={{ marginTop: 48 }}>
          <h2 style={SECTION_TITLE_STYLE}>Skills</h2>
          <div className="profile-tag-row">
            {profile.skills.map((s) => (
              <span key={s} className="tag">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {profile.languages?.length > 0 && (
        <div style={{ marginTop: 48 }}>
          <h2 style={SECTION_TITLE_STYLE}>Languages</h2>
          <div className="profile-tag-row">
            {profile.languages.map((l) => (
              <span key={l.language} className="tag">
                {l.language} · {l.proficiency}
              </span>
            ))}
          </div>
        </div>
      )}

      {profile.proud_of && (
        <div style={{ marginTop: 48 }}>
          <h2 style={SECTION_TITLE_STYLE}>What I'm most proud of</h2>
          <blockquote
            style={{
              margin: 0,
              paddingLeft: 20,
              borderLeft: '3px solid var(--color-primary)',
              fontSize: 16,
              lineHeight: 1.7,
              fontStyle: 'italic',
              color: 'var(--color-text)',
            }}
          >
            “{profile.proud_of}”
          </blockquote>
        </div>
      )}

      {(profile.education_level || profile.field_of_study || profile.institution_name || profile.graduation_year) && (
        <div style={{ marginTop: 48 }}>
          <h2 style={SECTION_TITLE_STYLE}>Education</h2>
          {(profile.education_level || profile.field_of_study) && (
            <p style={{ fontSize: 16 }}>{[profile.education_level, profile.field_of_study].filter(Boolean).join(' in ')}</p>
          )}
          {(profile.institution_name || profile.graduation_year) && (
            <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginTop: 4 }}>
              {[profile.institution_name, profile.graduation_year].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
