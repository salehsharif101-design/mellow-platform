import Modal from './Modal.jsx'

export default function CalendlyModal({ calendlyUrl, onClose }) {
  return (
    <Modal title="Book a Meeting" onClose={onClose} width={760}>
      <iframe
        title="Meeting scheduling"
        src={calendlyUrl}
        style={{ width: '100%', height: '70vh', border: 'none' }}
      />
    </Modal>
  )
}
