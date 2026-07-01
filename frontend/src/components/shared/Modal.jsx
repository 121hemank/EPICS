export default function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="lead-modal" onClick={onClose} style={{ display: 'flex' }}>
      <div className="lead-modal-content" onClick={e => e.stopPropagation()}>
        <div className="lead-modal-header">
          <h3>{title}</h3>
          <button type="button" className="lead-modal-close" onClick={onClose}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
