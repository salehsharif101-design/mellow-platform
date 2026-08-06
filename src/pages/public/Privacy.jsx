export default function Privacy() {
  return (
    <div className="section">
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <h1 style={{ fontSize: 32 }}>Privacy Policy</h1>
        <p style={{ marginTop: 8, fontSize: 14, color: 'var(--color-text-muted)' }}>Last updated: August 2026</p>

        <p style={{ marginTop: 28, fontSize: 16, lineHeight: 1.7 }}>
          Mellow is committed to protecting your privacy. This policy explains what data we collect, how we use it,
          and your rights.
        </p>

        <h3 style={{ marginTop: 32, fontSize: 18 }}>What we collect</h3>
        <p style={{ marginTop: 10, fontSize: 16, lineHeight: 1.7, color: 'var(--color-text-muted)' }}>
          Your name, email address, location, skills, languages, LinkedIn URL, and video files you upload. We also
          collect usage data such as profile views and application activity.
        </p>

        <h3 style={{ marginTop: 32, fontSize: 18 }}>How we use it</h3>
        <p style={{ marginTop: 10, fontSize: 16, lineHeight: 1.7, color: 'var(--color-text-muted)' }}>
          To operate your Mellow profile, match candidates with employers, send you notifications about activity on
          your account, and improve the platform.
        </p>

        <h3 style={{ marginTop: 32, fontSize: 18 }}>Video content</h3>
        <p style={{ marginTop: 10, fontSize: 16, lineHeight: 1.7, color: 'var(--color-text-muted)' }}>
          Videos you upload are stored securely and are only visible to verified employers on the platform. You can
          delete your videos at any time from your profile.
        </p>

        <h3 style={{ marginTop: 32, fontSize: 18 }}>Your rights</h3>
        <p style={{ marginTop: 10, fontSize: 16, lineHeight: 1.7, color: 'var(--color-text-muted)' }}>
          You can edit or delete your profile and all associated data at any time. To request full account deletion
          email{' '}
          <a href="mailto:hello@joinmellow.xyz" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
            hello@joinmellow.xyz
          </a>
          .
        </p>

        <h3 style={{ marginTop: 32, fontSize: 18 }}>Third parties</h3>
        <p style={{ marginTop: 10, fontSize: 16, lineHeight: 1.7, color: 'var(--color-text-muted)' }}>
          We use Supabase for data storage, Resend for email delivery, and Vercel for hosting. We do not sell your
          data to any third party.
        </p>

        <h3 style={{ marginTop: 32, fontSize: 18 }}>Contact</h3>
        <p style={{ marginTop: 10, fontSize: 16, lineHeight: 1.7, color: 'var(--color-text-muted)' }}>
          For any privacy questions email{' '}
          <a href="mailto:hello@joinmellow.xyz" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
            hello@joinmellow.xyz
          </a>
          .
        </p>
      </div>
    </div>
  )
}
