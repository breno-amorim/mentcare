import type { ReactNode } from 'react'
import { STATUS_LABEL, type AppointmentStatus, type Role, ROLE_LABEL } from '../domain/types'

const STATUS_CLASS: Record<AppointmentStatus, string> = {
  completed: 'green',
  cancelled: 'red',
  scheduled: 'amber',
}

export function StatusPill({ status }: { status: AppointmentStatus }) {
  return <span className={`pill ${STATUS_CLASS[status]}`}>{STATUS_LABEL[status]}</span>
}

export function PageHeading(props: {
  role: Role
  title: string
  subtitle: string
  action?: ReactNode
}) {
  return (
    <div className="welcome">
      <div>
        <div className="eyebrow">MentCare / {ROLE_LABEL[props.role]}</div>
        <h1>{props.title}</h1>
        <div className="muted">{props.subtitle}</div>
      </div>
      {props.action}
    </div>
  )
}

export function Stat({ label, value, icon }: { label: string; value: ReactNode; icon: string }) {
  return (
    <div className="stat">
      <span className="stat-icon" aria-hidden="true">
        {icon}
      </span>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  )
}

export function Empty({ title, children }: { title?: string; children?: ReactNode }) {
  return (
    <div className="empty">
      {title && <b>{title}</b>}
      {children}
    </div>
  )
}

export function ErrorBox({ message }: { message: string }) {
  return message ? (
    <div className="errorbox" role="alert">
      {message}
    </div>
  ) : null
}

export function Field(props: {
  label: string
  htmlFor: string
  wide?: boolean
  children: ReactNode
}) {
  return (
    <div className={`field${props.wide ? ' wide' : ''}`}>
      <label htmlFor={props.htmlFor}>{props.label}</label>
      {props.children}
    </div>
  )
}
