import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../app/AuthContext'
import { ErrorBox, Field } from '../../components/ui'
import { formatCpf } from '../../domain/cpf'
import {
  passwordChecks,
  validateRegistration,
  type FieldErrors,
  type RegisterField,
} from '../../domain/registration'
import { INSURANCES } from '../../domain/types'
import { getBackend } from '../../data/backend'
import { errorMessage, FieldError } from '../../services/errors'

function LoginForm() {
  const { signIn } = useAuth()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setBusy(true)
    setError('')
    try {
      await signIn(String(form.get('email')), String(form.get('password')))
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <>
      <h2>Bem-vindo de volta</h2>
      <p className="muted">Entre para continuar seu acompanhamento.</p>
      <form onSubmit={onSubmit}>
        <Field label="E-mail" htmlFor="email">
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="username"
            placeholder="voce@email.com"
          />
        </Field>
        <Field label="Senha" htmlFor="password">
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </Field>
        <ErrorBox message={error} />
        <button className="btn" style={{ width: '100%' }} disabled={busy}>
          {busy ? 'Entrando…' : 'Entrar na plataforma'}
        </button>
      </form>
      {getBackend().isDemo && (
        <div className="notice">
          <b>Contas de demonstração</b> (senha <b>mentcare123</b>)
          <br />
          Paciente: mariana@email.com · Profissional: ana@mentcare.com · Gestor: gestao@mentcare.com
        </div>
      )}
    </>
  )
}

function RegisterForm() {
  const { signUp } = useAuth()
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [busy, setBusy] = useState(false)
  const [confirmEmail, setConfirmEmail] = useState('')
  const [cpf, setCpf] = useState('')
  const [password, setPassword] = useState('')

  /** Ao corrigir um campo, o vermelho dele some. */
  const clear = (field: RegisterField) =>
    setFieldErrors((errs) => {
      if (!errs[field]) return errs
      const next = { ...errs }
      delete next[field]
      return next
    })

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const text = (k: string) => String(f.get(k) ?? '')
    const input = {
      name: text('name'),
      cpf: text('cpf'),
      birth: text('birth'),
      email: text('email'),
      password: text('password'),
      insurance: text('insurance'),
      city: text('city'),
    }
    setError('')
    const errors = validateRegistration(input)
    setFieldErrors(errors)
    if (Object.keys(errors).length) {
      setError('Corrija os campos destacados em vermelho.')
      return
    }
    setBusy(true)
    try {
      const result = await signUp(input)
      if (result === 'confirm') {
        setConfirmEmail(input.email)
        setBusy(false)
      }
    } catch (err) {
      if (err instanceof FieldError) {
        setFieldErrors({ [err.field]: err.message })
        setError('Corrija o campo destacado em vermelho.')
      } else {
        setError(errorMessage(err))
      }
      setBusy(false)
    }
  }

  if (confirmEmail) {
    return (
      <>
        <h2>Confirme seu e-mail</h2>
        <div className="notice" role="status">
          Enviamos um link de confirmação para <b>{confirmEmail}</b>. Abra a mensagem, clique no
          link e depois entre na plataforma.
        </div>
      </>
    )
  }

  const describedBy = (field: RegisterField, id: string) =>
    fieldErrors[field] ? `${id}-error` : undefined

  return (
    <>
      <h2>Crie sua conta</h2>
      <p className="muted">Cadastro para pacientes.</p>
      <form onSubmit={onSubmit} noValidate>
        <Field label="Nome completo" htmlFor="name" error={fieldErrors.name}>
          <input
            id="name"
            name="name"
            autoComplete="name"
            aria-invalid={!!fieldErrors.name}
            aria-describedby={describedBy('name', 'name')}
            onChange={() => clear('name')}
          />
        </Field>
        <div className="formgrid">
          <Field label="CPF" htmlFor="cpf" error={fieldErrors.cpf}>
            <input
              id="cpf"
              name="cpf"
              maxLength={14}
              placeholder="000.000.000-00"
              inputMode="numeric"
              autoComplete="off"
              value={cpf}
              aria-invalid={!!fieldErrors.cpf}
              aria-describedby={describedBy('cpf', 'cpf')}
              onChange={(e) => {
                setCpf(formatCpf(e.target.value))
                clear('cpf')
              }}
            />
          </Field>
          <Field label="Data de nascimento" htmlFor="birth" error={fieldErrors.birth}>
            <input
              id="birth"
              name="birth"
              type="date"
              autoComplete="bday"
              aria-invalid={!!fieldErrors.birth}
              aria-describedby={describedBy('birth', 'birth')}
              onChange={() => clear('birth')}
            />
          </Field>
          <Field label="E-mail" htmlFor="remail" error={fieldErrors.email}>
            <input
              id="remail"
              name="email"
              type="email"
              autoComplete="email"
              aria-invalid={!!fieldErrors.email}
              aria-describedby={describedBy('email', 'remail')}
              onChange={() => clear('email')}
            />
          </Field>
          <Field label="Senha" htmlFor="rpassword" error={fieldErrors.password}>
            <input
              id="rpassword"
              name="password"
              type="password"
              autoComplete="new-password"
              value={password}
              aria-invalid={!!fieldErrors.password}
              aria-describedby="rpassword-rules"
              onChange={(e) => {
                setPassword(e.target.value)
                clear('password')
              }}
            />
            <ul className="checklist" id="rpassword-rules" aria-label="Requisitos da senha">
              {passwordChecks(password).map((c) => (
                <li key={c.id} className={c.ok ? 'ok' : password ? 'no' : 'muted'}>
                  {c.ok ? '✓' : '•'} {c.label}
                </li>
              ))}
            </ul>
          </Field>
          <Field label="Convênio" htmlFor="insurance">
            <select id="insurance" name="insurance">
              {INSURANCES.map((i) => (
                <option key={i}>{i}</option>
              ))}
            </select>
          </Field>
          <Field label="Cidade" htmlFor="city" error={fieldErrors.city}>
            <input
              id="city"
              name="city"
              defaultValue="Taboão da Serra"
              aria-invalid={!!fieldErrors.city}
              aria-describedby={describedBy('city', 'city')}
              onChange={() => clear('city')}
            />
          </Field>
        </div>
        <ErrorBox message={error} />
        <button className="btn" style={{ width: '100%' }} disabled={busy}>
          {busy ? 'Criando…' : 'Criar conta'}
        </button>
      </form>
    </>
  )
}

export function AuthPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<'login' | 'register'>('login')
  if (user) return <Navigate to="/" replace />

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <div className="logo" aria-hidden="true">
            ✳
          </div>
          MentCare
        </div>
        <span className="muted">Plataforma de cuidado e acompanhamento</span>
      </header>
      <main className="loginwrap">
        <div className="loginhero">
          <div className="eyebrow">Cuidado que conecta</div>
          <h1>Sua saúde mental merece atenção.</h1>
          <p className="muted">
            Encontre clínicas, agende consultas e acompanhe sua jornada de cuidado em um só lugar.
          </p>
          <div className="notice">
            Protótipo acadêmico com dados fictícios. Não insira informações reais de saúde.
          </div>
        </div>
        <div className="loginpanel">
          <div className="tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'login'}
              className={`tab${tab === 'login' ? ' active' : ''}`}
              onClick={() => setTab('login')}
            >
              Entrar
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'register'}
              className={`tab${tab === 'register' ? ' active' : ''}`}
              onClick={() => setTab('register')}
            >
              Criar conta
            </button>
          </div>
          {tab === 'login' ? <LoginForm /> : <RegisterForm />}
        </div>
      </main>
    </>
  )
}
