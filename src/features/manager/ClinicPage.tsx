import { useState, type FormEvent } from 'react'
import { useUser } from '../../app/AuthContext'
import { useToast } from '../../app/ToastContext'
import { ErrorBox, Field, PageHeading } from '../../components/ui'
import { Modal } from '../../components/Modal'
import { errorMessage } from '../../services/errors'
import { saveClinic } from '../../services/clinics'
import { useDb } from '../../services/store'

export function ClinicPage() {
  const user = useUser()
  const db = useDb()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const clinic = db.clinics.find((c) => c.id === user.clinicId)

  const close = () => {
    setOpen(false)
    setError('')
  }

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const text = (k: string) => String(f.get(k) ?? '')
    try {
      saveClinic(user.id, {
        name: text('name'),
        city: text('city'),
        address: text('address'),
        insurance: text('insurance'),
        specialties: text('specialties'),
      })
      toast('Dados da clínica salvos.')
      close()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <>
      <PageHeading
        role="manager"
        title="Minha clínica"
        subtitle={
          clinic
            ? 'Gerencie os dados exibidos na busca de pacientes.'
            : 'Cadastre os dados do estabelecimento.'
        }
        action={
          <button type="button" className="btn" onClick={() => setOpen(true)}>
            {clinic ? 'Editar clínica' : 'Cadastrar clínica'}
          </button>
        }
      />
      {clinic && (
        <div className="card">
          <h2>{clinic.name}</h2>
          <p>
            {clinic.address} · {clinic.city}
          </p>
          <p>
            <b>Convênios:</b> {clinic.insurance.join(', ')}
          </p>
          <p>
            <b>Especialidades:</b> {clinic.specialties.join(', ')}
          </p>
          <p>
            <b>Visibilidade:</b> {clinic.approved ? 'Aprovada / visível na busca' : 'Pendente'}
          </p>
        </div>
      )}

      {open && (
        <Modal title={`${clinic ? 'Editar' : 'Cadastrar'} clínica`} onClose={close}>
          <form onSubmit={onSubmit}>
            <Field label="Nome da clínica" htmlFor="name">
              <input id="name" name="name" defaultValue={clinic?.name} required />
            </Field>
            <div className="formgrid">
              <Field label="Cidade" htmlFor="city">
                <input id="city" name="city" defaultValue={clinic?.city} required />
              </Field>
              <Field label="Endereço" htmlFor="address">
                <input id="address" name="address" defaultValue={clinic?.address} required />
              </Field>
              <Field label="Convênios aceitos (separe por vírgula)" htmlFor="insurance" wide>
                <input
                  id="insurance"
                  name="insurance"
                  defaultValue={clinic?.insurance.join(', ')}
                  placeholder="Unimed, SUS, Particular"
                />
              </Field>
              <Field label="Especialidades (separe por vírgula)" htmlFor="specialties" wide>
                <input
                  id="specialties"
                  name="specialties"
                  defaultValue={clinic?.specialties.join(', ') ?? 'Psicologia'}
                />
              </Field>
            </div>
            <div className="notice">
              Nesta versão, clínicas cadastradas pelo gestor ficam visíveis imediatamente. Um fluxo
              de aprovação administrativa pode ser incluído depois.
            </div>
            <ErrorBox message={error} />
            <div className="modalfoot">
              <button type="button" className="btn ghost" onClick={close}>
                Cancelar
              </button>
              <button className="btn">Salvar clínica</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
