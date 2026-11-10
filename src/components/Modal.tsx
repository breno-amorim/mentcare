import { useEffect, useId, type ReactNode } from 'react'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
}

export function Modal({ title, onClose, children }: ModalProps) {
  const titleId = useId()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modalback" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="row">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="btn ghost small" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
