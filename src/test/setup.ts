import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  // Testes de banco rodam em ambiente Node (sem DOM): nada a limpar.
  if (typeof document === 'undefined') return
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
  window.location.hash = ''
})
