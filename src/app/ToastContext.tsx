import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

const ToastContext = createContext<(message: string) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('')
  const show = useCallback((m: string) => setMessage(m), [])

  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setMessage(''), 3000)
    return () => clearTimeout(t)
  }, [message])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" role="status">
        {message && (
          <div
            className="notice"
            style={{
              position: 'fixed',
              bottom: 20,
              right: 20,
              zIndex: 30,
              boxShadow: 'var(--shadow)',
            }}
          >
            {message}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
