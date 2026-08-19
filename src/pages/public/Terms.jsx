export default function Terms() {
  return (
    <div className="section">
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <h1 style={{ fontSize: 32 }}>Terms of Service</h1>
        <p style={{ marginTop: 8, fontSize: 14, color: 'var(--color-text-muted)' }}>Last updated: August 2026</p>

        <p style={{ marginTop: 28, fontSize: 16, lineHeight: 1.7 }}>
          These terms cover how Mellow works and what we ask of everyone who uses it. By creating an account or
          using the platform, you agree to them. Mellow is currently in beta, so these terms may evolve as the
          platform does.
        </p>

        <h3 style={{ marginTop: 32, fontSize: 18 }}>What Mellow is</h3>
        <p style={{ marginTop: 10, fontSize: 16, lineHeight: 1.7, color: 'var(--color-text-muted)' }}>
          Mellow is a video-first hiring platform that helps talent and employers meet each other as people, not
          just documents. Talent can build a profile with video introductions and apply to open roles. Employers can
          post roles, browse talent, and message candidates directly. Mellow is open to anyone who creates an
          account as either talent or an employer and agrees to these terms.
        </p>

        <h3 style={{ marginTop: 32, fontSize: 18 }}>Your responsibilities</h3>
        <p style={{ marginTop: 10, fontSize: 16, lineHeight: 1.7, color: 'var(--color-text-muted)' }}>
          You agree to keep the information on your profile accurate and up to date, and to only upload content you
          have the right to share. Videos, messages, and other content you post should be appropriate for a
          professional hiring context. Spam, harassment, misleading claims, and abusive behaviour toward other users
          are not allowed and may result in content removal or account suspension.
        </p>

        <h3 style={{ marginTop: 32, fontSize: 18 }}>Video content</h3>
        <p style={{ marginTop: 10, fontSize: 16, lineHeight: 1.7, color: 'var(--color-text-muted)' }}>
          You own the videos and other content you upload to Mellow. By uploading content, you grant Mellow a
          licence to host, store, and display it on the platform for the purpose of connecting you with employers or
          talent. You can remove your videos at any time from your profile, which ends that licence for the removed
          content.
        </p>

        <h3 style={{ marginTop: 32, fontSize: 18 }}>Employer responsibilities</h3>
        <p style={{ marginTop: 10, fontSize: 16, lineHeight: 1.7, color: 'var(--color-text-muted)' }}>
          Employers agree to only post genuine, currently open roles, and to represent their company and the role
          accurately. Employers should respond to applicants in good faith and use candidate information only for
          the purpose of evaluating them for a role.
        </p>

        <h3 style={{ marginTop: 32, fontSize: 18 }}>What Mellow can do</h3>
        <p style={{ marginTop: 10, fontSize: 16, lineHeight: 1.7, color: 'var(--color-text-muted)' }}>
          We can remove content or suspend or terminate accounts that violate these terms, including fake profiles,
          fake roles, or abusive behaviour. We'll generally try to let you know if this happens to your account, but
          we may act without notice where necessary to protect the platform or other users.
        </p>

        <h3 style={{ marginTop: 32, fontSize: 18 }}>Limitation of liability</h3>
        <p style={{ marginTop: 10, fontSize: 16, lineHeight: 1.7, color: 'var(--color-text-muted)' }}>
          Mellow is a platform that connects talent and employers — we are not a party to any employment
          relationship, offer, or agreement formed between users. We don't guarantee the accuracy of information
          users provide, and we're not responsible for hiring decisions, employment outcomes, or interactions
          between users on the platform.
        </p>

        <h3 style={{ marginTop: 32, fontSize: 18 }}>Contact</h3>
        <p style={{ marginTop: 10, fontSize: 16, lineHeight: 1.7, color: 'var(--color-text-muted)' }}>
          Questions about these terms? Email{' '}
          <a href="mailto:hello@joinmellow.xyz" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
            hello@joinmellow.xyz
          </a>
          .
        </p>
      </div>
    </div>
  )
}
