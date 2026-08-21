// Compact "Book a meeting" pill, kept as its own component (rather than
// bundled with the other hero icons) so callers can push it to the far
// right of the row with marginLeft: 'auto' — separated from the grouped
// LinkedIn/website/message/share icons on the left.
export default function BookMeetingButton({ onClick, style }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="btn btn-ghost"
      style={{ fontSize: 13, fontWeight: 600, padding: '6px 14px', whiteSpace: 'nowrap', ...style }}
    >
      Book a meeting
    </button>
  )
}
