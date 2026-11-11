import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../app/AuthContext'
import { ErrorBox, Field } from '../../components/ui'
import { MIN_PASSWORD_LENGTH } from '../../domain/password'
import { INSURANCES, ROLE_LABEL, type Role } from '../../domain/types'
import { errorMessage } from '../../services/errors'

const ROLES: Role[] = ['patient', 'professional', 'manager']

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
      await signIn(
        String(form.get('email')),
        String(form.get('password')),
        form.get('role') as Role,
      )
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
        <Field label="Perfil de acesso" htmlFor="role">
          <select id="role" name="role" defaultValue="patient">
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r === 'manager' ? 'Gestor da clínica' : ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </Field>
        <ErrorBox message={error} />
        <button className="btn" style={{ width: '100%' }} disabled={busy}>
          {busy ? 'Entrando…' : 'Entrar na plataforma'}
        </button>
      </form>
      <div className="notice">
        <b>Contas de demonstração</b> (senha <b>mentcare123</b>)
        <br />
        Paciente: mariana@email.com · Profissional: ana@mentcare.com · Gestor: gestao@mentcare.com
      </div>
    </>
  )
}

function RegisterForm() {
  const { signUp } = useAuth()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const text = (k: string) => String(f.get(k) ?? '')
    setBusy(true)
    setError('')
    try {
      await signUp({
        name: text('name'),
        cpf: text('cpf'),
        birth: text('birth'),
        email: text('email'),
        password: text('password'),
        insurance: text('insurance'),
        city: text('city'),
      })
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <>
      <h2>Crie sua conta</h2>
      <p className="muted">Cadastro para pacientes.</p>
      <form onSubmit={onSubmit}>
        <Field label="Nome completo" htmlFor="name">
          <input id="name" name="name" required autoComplete="name" />
        </Field>
        <div className="formgrid">
          <Field label="CPF" htmlFor="cpf">
            <input
              id="cpf"
              name="cpf"
              maxLength={14}
              placeholder="000.000.000-00"
              required
              inputMode="numeric"
            />
          </Field>
          <Field label="Data de nascimento" htmlFor="birth">
            <input id="birth" name="birth" type="date" required autoComplete="bday" />
          </Field>
          <Field label="E-mail" htmlFor="remail">
            <input id="remail" name="email" type="email" required autoComplete="email" />
          </Field>
          <Field label={`Senha (mínimo ${MIN_PASSWORD_LENGTH} caracteres)`} htmlFor="rpassword">
            <input
              id="rpassword"
              name="password"
              type="password"
              minLength={MIN_PASSWORD_LENGTH}
              required
              autoComplete="new-password"
            />
          </Field>
          <Field label="Convênio" htmlFor="insurance">
            <select id="insurance" name="insurance">
              {INSURANCES.map((i) => (
                <option key={i}>{i}</option>
              ))}
            </select>
          </Field>
          <Field label="Cidade" htmlFor="city">
            <input id="city" name="city" defaultValue="Taboão da Serra" required />
          </Field>
        </div>
        <ErrorBox message={error} />
        <button className="btn" style={{ width: '100%' }} disabled={busy}>
          {busy ? 'Criando…' : 'Criar conta'}
        </button>
      </form>
      <div className="footer">
        Ao continuar, você concorda com o uso demonstrativo dos dados neste navegador.
      </div>
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
