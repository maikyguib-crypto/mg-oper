'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

const db = supabase()

function localDate() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function Home() {
  const [session, setSession] = useState(null)
  const [company, setCompany] = useState(null)
  const [members, setMembers] = useState([])
  const [tasks, setTasks] = useState([])
  const [sectors, setSectors] = useState([])
  const [tab, setTab] = useState('dashboard')
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [companyName, setCompanyName] = useState('')

  const [memberName, setMemberName] = useState('')
  const [memberSector, setMemberSector] = useState('')
  const [sectorName, setSectorName] = useState('')

  const [taskTitle, setTaskTitle] = useState('')
  const [taskMember, setTaskMember] = useState('')
  const [taskSector, setTaskSector] = useState('')
  const [taskGoal, setTaskGoal] = useState('')
  const [taskPriority, setTaskPriority] = useState('normal')
  const [taskDate, setTaskDate] = useState(localDate())

  const [printMember, setPrintMember] = useState('')
  const [printDate, setPrintDate] = useState(localDate())

  useEffect(() => {
    db.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data } = db.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })

    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) {
      load()
    } else {
      setCompany(null)
      setMembers([])
      setTasks([])
      setSectors([])
    }
  }, [session])

  async function load() {
    setLoading(true)

    const { data: userData } = await db.auth.getUser()
    const uid = userData.user?.id

    if (!uid) {
      setLoading(false)
      return
    }

    const { data: companies, error: companyError } = await db
      .from('companies')
      .select('*')
      .eq('owner_id', uid)
      .limit(1)

    if (companyError) {
      setMsg(companyError.message)
      setLoading(false)
      return
    }

    const c = companies?.[0]

    if (!c) {
      setCompany(null)
      setLoading(false)
      return
    }

    setCompany(c)

    const [
      { data: memberData, error: memberError },
      { data: taskData, error: taskError },
      { data: sectorData, error: sectorError }
    ] = await Promise.all([
      db
        .from('company_members')
        .select('*')
        .eq('company_id', c.id)
        .order('name'),

      db
        .from('tasks')
        .select('*')
        .eq('company_id', c.id)
        .order('created_at', { ascending: false }),

      db
        .from('sectors')
        .select('*')
        .eq('company_id', c.id)
        .order('name')
    ])

    if (memberError) setMsg(memberError.message)
    if (taskError) setMsg(taskError.message)
    if (sectorError) setMsg(sectorError.message)

    setMembers(memberData || [])
    setTasks(taskData || [])
    setSectors(sectorData || [])

    setLoading(false)
  }

  async function signup() {
    setMsg('')

    const { error } = await db.auth.signUp({
      email,
      password
    })

    setMsg(
      error
        ? error.message
        : 'Conta criada. Confirme seu e-mail se solicitado.'
    )
  }

  async function login() {
    setMsg('')

    const { error } = await db.auth.signInWithPassword({
      email,
      password
    })

    if (error) setMsg(error.message)
  }

  async function logout() {
    await db.auth.signOut()
  }

  async function createCompany() {
    if (!companyName.trim()) return

    const { data } = await db.auth.getUser()
    const uid = data.user?.id

    if (!uid) return

    const { error } = await db.from('companies').insert({
      name: companyName.trim(),
      owner_id: uid
    })

    if (error) {
      setMsg(error.message)
    } else {
      load()
    }
  }

  async function addSector() {
    if (!sectorName.trim() || !company) return

    const { error } = await db.from('sectors').insert({
      company_id: company.id,
      name: sectorName.trim()
    })

    if (error) {
      setMsg(error.message)
      return
    }

    setSectorName('')
    load()
  }

  async function addMember() {
    if (!memberName.trim() || !company) return

    const payload = {
      company_id: company.id,
      name: memberName.trim()
    }

    if (memberSector) {
      payload.sector_id = memberSector
    }

    const { error } = await db
      .from('company_members')
      .insert(payload)

    if (error) {
      setMsg(error.message)
      return
    }

    setMemberName('')
    setMemberSector('')
    load()
  }

  async function addTask() {
    if (!taskTitle.trim() || !company) {
      alert('Digite o produto ou tarefa.')
      return
    }

    if (!taskMember) {
      alert('Escolha o funcionÃ¡rio responsÃ¡vel.')
      return
    }

    const member = members.find(x => x.id === taskMember)

    const payload = {
      company_id: company.id,
      title: taskTitle.trim(),
      status: 'pending',
      priority: taskPriority,
      schedule_date: taskDate
    }

    if (taskGoal) {
      payload.goal = taskGoal
      payload.quantity_target = Number(taskGoal)
    }

    if (taskSector) {
      payload.sector_id = taskSector
    }

    if (member) {
      payload.member_id = member.id
      payload.assignee = member.name
    }

    const { error } = await db.from('tasks').insert(payload)

    if (error) {
      setMsg(error.message)
      return
    }

    setTaskTitle('')
    setTaskGoal('')
    setTaskMember('')
    setTaskSector('')
    setTaskPriority('normal')

    load()
  }

  async function advance(task) {
    const next =
      task.status === 'pending'
        ? 'in_progress'
        : task.status === 'in_progress'
        ? 'completed'
        : 'pending'

    const { error } = await db
      .from('tasks')
      .update({ status: next })
      .eq('id', task.id)

    if (error) {
      setMsg(error.message)
      return
    }

    load()
  }

  function printEmployeeDay() {
    if (!printMember) {
      alert('Escolha o funcionÃ¡rio que deseja imprimir.')
      return
    }

    const member = members.find(m => m.id === printMember)

    if (!member) {
      alert('FuncionÃ¡rio nÃ£o encontrado.')
      return
    }

    const list = tasks.filter(t => {
      const sameDate = t.schedule_date === printDate

      const sameMember =
        t.member_id === member.id ||
        t.assigned_to === member.id ||
        t.assignee === member.name

      return sameDate && sameMember
    })

    if (!list.length) {
      alert(
        `${member.name} nÃ£o possui programaÃ§Ã£o para ${formatDate(printDate)}.`
      )
      return
    }

    const totalProgramado = list.reduce((sum, task) => {
      return (
        sum +
        Number(
          task.quantity_target ||
          task.goal ||
          0
        )
      )
    }, 0)

    const rows = list
      .map((task, index) => {
        const quantidade =
          task.quantity_target ||
          task.goal ||
          'â€”'

        return `
          <div class="produto">
            <div class="numero">
              ${index + 1}
            </div>

            <div class="dados">
              <div class="nome">
                ${safe(task.title)}
              </div>

              <div class="quantidade">
                QUANTIDADE A FAZER:
                <strong>${safe(quantidade)}</strong>
              </div>

              <div class="detalhes">
                Setor:
                ${safe(sectorNameById(task.sector_id))}
              </div>

              <div class="detalhes">
                Prioridade:
                ${safe(priorityName(task.priority))}
              </div>

              <div class="concluido">
                â˜ CONCLUÃDO
              </div>
            </div>
          </div>
        `
      })
      .join('')

    const w = window.open('', '_blank')

    if (!w) {
      alert(
        'O navegador bloqueou a impressÃ£o. Permita pop-ups para o MG Oper.'
      )
      return
    }

    w.document.write(`
      <!doctype html>

      <html>
        <head>
          <meta charset="utf-8">

          <title>
            ProgramaÃ§Ã£o - ${safe(member.name)}
          </title>

          <style>
            @page {
              size: A4;
              margin: 12mm;
            }

            * {
              box-sizing: border-box;
            }

            body {
              font-family: Arial, Helvetica, sans-serif;
              color: #111;
              margin: 0;
              padding: 0;
            }

            .cabecalho {
              text-align: center;
              border-bottom: 3px solid #111;
              padding-bottom: 12px;
              margin-bottom: 20px;
            }

            .logo {
              font-size: 30px;
              font-weight: bold;
            }

            .empresa {
              font-size: 16px;
              margin-top: 4px;
            }

            .titulo {
              font-size: 22px;
              font-weight: bold;
              margin-top: 15px;
            }

            .info {
              border: 2px solid #111;
              padding: 12px;
              margin-bottom: 18px;
              font-size: 17px;
            }

            .produto {
              display: flex;
              gap: 12px;
              padding: 15px 0;
              border-bottom: 2px solid #bbb;
              page-break-inside: avoid;
            }

            .numero {
              width: 36px;
              height: 36px;
              border: 2px solid #111;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: bold;
              font-size: 18px;
            }

            .dados {
              flex: 1;
            }

            .nome {
              font-size: 21px;
              font-weight: bold;
              text-transform: uppercase;
            }

            .quantidade {
              font-size: 22px;
              margin-top: 8px;
            }

            .quantidade strong {
              font-size: 27px;
            }

            .detalhes {
              margin-top: 5px;
              font-size: 15px;
            }

            .concluido {
              margin-top: 12px;
              font-weight: bold;
            }

            .total {
              margin-top: 22px;
              border: 3px solid #111;
              padding: 14px;
              text-align: center;
              font-size: 22px;
              font-weight: bold;
            }

            .rodape {
              margin-top: 25px;
              font-size: 13px;
              text-align: center;
            }
          </style>
        </head>

        <body>
          <div class="cabecalho">
            <div class="logo">
              MG OPER
            </div>

            <div class="empresa">
              ${safe(company.name)}
            </div>

            <div class="titulo">
              PROGRAMAÃ‡ÃƒO DO DIA
            </div>
          </div>

          <div class="info">
            <strong>FuncionÃ¡rio:</strong>
            ${safe(member.name)}

            <br>

            <strong>Data:</strong>
            ${formatDate(printDate)}

            <br>

            <strong>Produtos / tarefas:</strong>
            ${list.length}
          </div>

          ${rows}

          <div class="total">
            TOTAL PROGRAMADO:
            ${safe(totalProgramado)}
          </div>

          <div class="rodape">
            MG Oper â€” ProgramaÃ§Ã£o operacional
          </div>

          <script>
            window.onload = function () {
              setTimeout(function () {
                window.print()
              }, 300)
            }
          </script>
        </body>
      </html>
    `)

    w.document.close()
  }

  const stats = useMemo(
    () => ({
      pending: tasks.filter(x => x.status === 'pending').length,
      progress: tasks.filter(x => x.status === 'in_progress').length,
      completed: tasks.filter(x => x.status === 'completed').length
    }),
    [tasks]
  )

  function sectorNameById(id) {
    return (
      sectors.find(x => x.id === id)?.name ||
      'Sem setor'
    )
  }

  function statusName(status) {
    if (status === 'pending') return 'Pendente'
    if (status === 'in_progress') return 'Em andamento'
    return 'ConcluÃ­da'
  }

  function priorityName(priority) {
    if (priority === 'high') return 'Alta'
    if (priority === 'low') return 'Baixa'
    return 'Normal'
  }

  if (loading) {
    return (
      <main className="center">
        <div className="login">
          Carregando...
        </div>
      </main>
    )
  }

  if (!session) {
    return (
      <main className="center">
        <section className="login">
          <div className="brand">
            MG <b>Oper</b>
          </div>

          <h1>
            Organize o trabalho do dia.
          </h1>

          <p>
            Gerencie sua empresa, equipe, setores e tarefas.
          </p>

          <input
            placeholder="E-mail"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />

          <input
            placeholder="Senha"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />

          <div className="actions">
            <button onClick={login}>
              Entrar
            </button>

            <button
              className="secondary"
              onClick={signup}
            >
              Criar conta
            </button>
          </div>

          {msg && <small>{msg}</small>}
        </section>
      </main>
    )
  }

  if (!company) {
    return (
      <main className="center">
        <section className="login">
          <div className="brand">
            MG <b>Oper</b>
          </div>

          <h1>
            Crie sua empresa
          </h1>

          <p>
            Esse serÃ¡ seu espaÃ§o de trabalho.
          </p>

          <input
            placeholder="Nome da empresa"
            value={companyName}
            onChange={e => setCompanyName(e.target.value)}
          />

          <button onClick={createCompany}>
            ComeÃ§ar a usar
          </button>

          {msg && <small>{msg}</small>}
        </section>
      </main>
    )
  }

  return (
    <div>
      <header>
        <div className="brand">
          MG <b>Oper</b>
        </div>

        <nav>
          <button onClick={() => setTab('dashboard')}>
            Dashboard
          </button>

          <button onClick={() => setTab('programacao')}>
            ProgramaÃ§Ã£o
          </button>

          <button onClick={() => setTab('producao')}>ProduÃ§Ã£o</button>

          <button onClick={() => setTab('equipe')}>
            Equipe
          </button>

          <button onClick={() => setTab('setores')}>
            Setores
          </button>
        </nav>

        <div>
          <span>{company.name}</span>

          <button
            className="link"
            onClick={logout}
          >
            Sair
          </button>
        </div>
      </header>

      <main className="page">
        {tab === 'producao' && <ProductionReport key={company.id} company={company} members={members} />}
        {tab === 'dashboard' && (
          <>
            <p className="eyebrow">
              VISÃƒO GERAL
            </p>

            <h1>
              OlÃ¡! O que precisa ser feito hoje?
            </h1>

            <p>
              Acompanhe a operaÃ§Ã£o da empresa em um sÃ³ lugar.
            </p>

            <div className="stats">
              <Card
                n={stats.pending}
                t="Pendentes"
              />

              <Card
                n={stats.progress}
                t="Em andamento"
              />

              <Card
                n={stats.completed}
                t="ConcluÃ­das"
              />

              <Card
                n={members.length}
                t="Pessoas"
              />
            </div>

            <section className="panel">
              <h2>
                ProgramaÃ§Ã£o
              </h2>

              {tasks.length === 0 && (
                <p>
                  Nenhuma tarefa cadastrada.
                </p>
              )}

              {tasks.slice(0, 8).map(t => (
                <div
                  className="task"
                  key={t.id}
                >
                  <div>
                    <b>{t.title}</b>

                    <p>
                      {t.assignee || 'Sem responsÃ¡vel'}
                      {' Â· '}
                      {sectorNameById(t.sector_id)}

                      {(t.quantity_target || t.goal)
                        ? ` Â· Quantidade: ${t.quantity_target || t.goal}`
                        : ''}
                    </p>
                  </div>

                  <button
                    onClick={() => advance(t)}
                  >
                    {statusName(t.status)}
                  </button>
                </div>
              ))}
            </section>
          </>
        )}

        {tab === 'programacao' && (
          <>
            <p className="eyebrow">
              PROGRAMAÃ‡ÃƒO
            </p>

            <h1>
              ProgramaÃ§Ã£o do dia
            </h1>

            <p>
              Distribua produtos, responsÃ¡veis e quantidades.
            </p>

            <section
              className="panel"
              style={{ marginBottom: 20 }}
            >
              <h2>
                ðŸ–¨ Imprimir programaÃ§Ã£o do dia
              </h2>

              <p>
                Escolha o funcionÃ¡rio e a data.
              </p>

              <label>
                FuncionÃ¡rio
              </label>

              <select
                value={printMember}
                onChange={e => setPrintMember(e.target.value)}
              >
                <option value="">
                  Selecione o funcionÃ¡rio
                </option>

                {members.map(m => (
                  <option
                    key={m.id}
                    value={m.id}
                  >
                    {m.name}
                  </option>
                ))}
              </select>

              <label>
                Data da programaÃ§Ã£o
              </label>

              <input
                type="date"
                value={printDate}
                onChange={e => setPrintDate(e.target.value)}
              />

              <button
                onClick={printEmployeeDay}
                style={{
                  width: '100%',
                  marginTop: 10,
                  fontSize: 18,
                  padding: 14
                }}
              >
                ðŸ–¨ IMPRIMIR PROGRAMAÃ‡ÃƒO
              </button>
            </section>

            <div className="two">
              <section className="panel">
                <h2>
                  Nova tarefa / produto
                </h2>

                <label>
                  Data
                </label>

                <input
                  type="date"
                  value={taskDate}
                  onChange={e => setTaskDate(e.target.value)}
                />

                <input
                  placeholder="Ex.: Minoxidil"
                  value={taskTitle}
                  onChange={e => setTaskTitle(e.target.value)}
                />

                <select
                  value={taskMember}
                  onChange={e => setTaskMember(e.target.value)}
                >
                  <option value="">
                    ResponsÃ¡vel
                  </option>

                  {members.map(m => (
                    <option
                      key={m.id}
                      value={m.id}
                    >
                      {m.name}
                    </option>
                  ))}
                </select>

                <select
                  value={taskSector}
                  onChange={e => setTaskSector(e.target.value)}
                >
                  <option value="">
                    Setor
                  </option>

                  {sectors.map(s => (
                    <option
                      key={s.id}
                      value={s.id}
                    >
                      {s.name}
                    </option>
                  ))}
                </select>

                <input
                  inputMode="numeric"
                  placeholder="Quantidade que deve fazer"
                  value={taskGoal}
                  onChange={e => setTaskGoal(e.target.value)}
                />

                <select
                  value={taskPriority}
                  onChange={e => setTaskPriority(e.target.value)}
                >
                  <option value="low">
                    Prioridade baixa
                  </option>

                  <option value="normal">
                    Prioridade normal
                  </option>

                  <option value="high">
                    Prioridade alta
                  </option>
                </select>

                <button onClick={addTask}>
                  Delegar tarefa
                </button>
              </section>

              <section className="panel">
                <h2>
                  Tarefas
                </h2>

                {tasks.length === 0 && (
                  <p>
                    Nenhuma tarefa ainda.
                  </p>
                )}

                {tasks.map(t => (
                  <div
                    className="task"
                    key={t.id}
                  >
                    <div>
                      <b>
                        {t.title}
                      </b>

                      <p>
                        {t.assignee || 'Sem responsÃ¡vel'}
                        {' Â· '}
                        {sectorNameById(t.sector_id)}

                        {(t.quantity_target || t.goal)
                          ? ` Â· Quantidade: ${t.quantity_target || t.goal}`
                          : ''}
                      </p>

                      <small>
                        Data: {formatDate(t.schedule_date)}
                        {' Â· '}
                        Prioridade: {priorityName(t.priority)}
                      </small>
                    </div>

                    <button
                      onClick={() => advance(t)}
                    >
                      {statusName(t.status)}
                    </button>
                  </div>
                ))}
              </section>
            </div>
          </>
        )}

        {tab === 'equipe' && (
          <>
            <p className="eyebrow">
              EQUIPE
            </p>

            <h1>
              FuncionÃ¡rios
            </h1>

            <p>
              Cadastre as pessoas que trabalham na empresa.
            </p>

            <div className="two">
              <section className="panel">
                <h2>
                  Adicionar funcionÃ¡rio
                </h2>

                <input
                  placeholder="Nome do funcionÃ¡rio"
                  value={memberName}
                  onChange={e => setMemberName(e.target.value)}
                />

                <select
                  value={memberSector}
                  onChange={e => setMemberSector(e.target.value)}
                >
                  <option value="">
                    Sem setor definido
                  </option>

                  {sectors.map(s => (
                    <option
                      key={s.id}
                      value={s.id}
                    >
                      {s.name}
                    </option>
                  ))}
                </select>

                <button onClick={addMember}>
                  Adicionar
                </button>
              </section>

              <section className="panel">
                <h2>
                  Equipe cadastrada
                </h2>

                {members.length === 0 && (
                  <p>
                    Nenhum funcionÃ¡rio cadastrado.
                  </p>
                )}

                {members.map(m => (
                  <div
                    className="row"
                    key={m.id}
                  >
                    <b>
                      {m.name}
                    </b>

                    <span>
                      {sectorNameById(m.sector_id)}
                    </span>
                  </div>
                ))}
              </section>
            </div>
          </>
        )}

        {tab === 'setores' && (
          <>
            <p className="eyebrow">
              ESTRUTURA
            </p>

            <h1>
              Setores da empresa
            </h1>

            <p>
              Cada empresa pode montar sua prÃ³pria operaÃ§Ã£o.
            </p>

            <div className="two">
              <section className="panel">
                <h2>
                  Novo setor
                </h2>

                <input
                  placeholder="Ex.: ProduÃ§Ã£o, Vendas, ExpediÃ§Ã£o..."
                  value={sectorName}
                  onChange={e => setSectorName(e.target.value)}
                />

                <button onClick={addSector}>
                  Criar setor
                </button>
              </section>

              <section className="panel">
                <h2>
                  Setores cadastrados
                </h2>

                {sectors.length === 0 && (
                  <p>
                    Nenhum setor cadastrado.
                  </p>
                )}

                {sectors.map(s => (
                  <div
                    className="row"
                    key={s.id}
                  >
                    <b>
                      {s.name}
                    </b>
                  </div>
                ))}
              </section>
            </div>
          </>
        )}

        {msg && (
          <p className="message">
            {msg}
          </p>
        )}
      </main>
    </div>
  )
}

function Card({ n, t }) {
  return (
    <div className="card">
      <b>{n}</b>
      <span>{t}</span>
    </div>
  )
}

function formatDate(value) {
  if (!value) return 'â€”'

  const parts = value
    .slice(0, 10)
    .split('-')

  if (parts.length !== 3) {
    return value
  }

  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

function safe(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}


function ProductionReport({ company, members }) {
  const [month, setMonth] = useState(localDate().slice(0, 7))
  const [rows, setRows] = useState([])
  const [person, setPerson] = useState('')
  const [day, setDay] = useState(localDate())
  const [quantity, setQuantity] = useState('')
  const [filter, setFilter] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [year, mon] = month.split('-').map(Number)
  const days = Array.from({ length: new Date(year, mon, 0).getDate() }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)
  const weeks = []
  for (const date of days) {
    if (!weeks.length || new Date(`${date}T12:00:00`).getDay() === 1) weeks.push([])
    weeks[weeks.length - 1].push(date)
  }
  useEffect(() => {
    let active = true
    setReady(false); setRows([]); setError('')
    async function read() {
      const all = []
      for (let offset = 0; ; offset += 500) {
        const result = await db.from('mg_daily_production').select('*').eq('company_id', company.id)
          .gte('production_date', days[0]).lte('production_date', days[days.length - 1])
          .order('id').range(offset, offset + 499)
        if (!active) return
        if (result.error) { setError('NÃ£o foi possÃ­vel carregar a produÃ§Ã£o: ' + result.error.message); return }
        all.push(...result.data)
        if (result.data.length < 500) break
      }
      if (active) { setRows(all); setReady(true) }
    }
    read().catch(e => { if (active) setError(e.message) })
    return () => { active = false }
  }, [company.id, month, refresh])
  const values = new Map(rows.map(row => [`${row.member_id}:${row.production_date}`, Number(row.quantity)]))
  const total = (id, dates) => dates.reduce((sum, date) => sum + (values.get(`${id}:${date}`) || 0), 0)
  const fmt = n => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
  const people = members.filter(m => !filter || m.id === filter)
  async function save(event) {
    event.preventDefault()
    const amount = Number(quantity)
    if (!person || !day || quantity === '' || !Number.isSafeInteger(amount) || amount < 0) return
    const existing = await db.from('mg_daily_production').select('quantity').eq('company_id', company.id).eq('member_id', person).eq('production_date', day).maybeSingle()
    if (existing.error) { setError(existing.error.message); return }
    if (existing.data && !window.confirm(`JÃ¡ existe total de ${existing.data.quantity} fÃ³rmulas nesse dia. Substituir por ${amount}?`)) return
    setBusy(true); setError('')
    try {
      const result = await db.from('mg_daily_production').upsert({ company_id: company.id, member_id: person, production_date: day, quantity: amount }, { onConflict: 'company_id,member_id,production_date' })
      if (result.error) throw result.error
      setQuantity(''); setMonth(day.slice(0, 7)); setRefresh(n => n + 1)
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  const average = id => {
    const count = days.filter(date => values.has(`${id}:${date}`)).length
    return count ? total(id, days) / count : 0
  }
  function exportCSV() {
    const quote = value => '"' + String(value).replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"', '""') + '"'
    const data = [
      ['FuncionÃ¡rio', ...days.map(formatDate), ...weeks.map((w, i) => `Semana ${i + 1} (${formatDate(w[0])} a ${formatDate(w[w.length - 1])})`), 'Total do mÃªs', 'MÃ©dia por dia com lanÃ§amento'],
      ...people.map(m => [m.name, ...days.map(date => values.has(`${m.id}:${date}`) ? values.get(`${m.id}:${date}`) : ''), ...weeks.map(w => total(m.id, w)), total(m.id, days), average(m.id).toFixed(2).replace('.', ',')])
    ]
    const blob = new Blob(['\uFEFF' + data.map(row => row.map(quote).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `producao-${month}${filter ? '-individual' : '-equipe'}.csv`; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const cell = { padding: 10, borderBottom: '1px solid #ddd', textAlign: 'right' }
  return <>
    <h1>CalendÃ¡rio de produÃ§Ã£o</h1>
    <section className="panel">
      <h2>LanÃ§ar total produzido no dia</h2>
      <p>Informe o total real de fÃ³rmulas da pessoa nessa data. Um novo lanÃ§amento substitui o total anterior, sem somar novamente.</p>
      <form onSubmit={save}>
        <label>FuncionÃ¡rio<select required value={person} onChange={e => setPerson(e.target.value)}><option value="">Selecione</option>{members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
        <label>Data<input required type="date" value={day} onChange={e => setDay(e.target.value)} /></label>
        <label>Total de fÃ³rmulas<input required type="number" min="0" step="1" value={quantity} onChange={e => setQuantity(e.target.value)} /></label>
        <button disabled={busy}>{busy ? 'Salvandoâ€¦' : 'Salvar total do dia'}</button>
      </form>
    </section>
    <section className="panel" style={{ marginTop: 20 }}>
      <label>MÃªs<input type="month" value={month} onChange={e => { if(e.target.value) setMonth(e.target.value) }} /></label>
      <label>Exibir<select value={filter} onChange={e => setFilter(e.target.value)}><option value="">Toda a equipe</option>{members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      <button disabled={!ready} onClick={exportCSV}>Baixar CSV para Excel</button>{' '}
      <button onClick={() => setRefresh(n => n + 1)}>Atualizar</button>
      <p>Semanas de segunda a domingo, limitadas ao mÃªs escolhido. â€œâ€”â€ significa sem lanÃ§amento; zero Ã© um total registrado. A mÃ©dia considera os dias com lanÃ§amento, inclusive zero.</p>
      {error && <p role="alert">{error}</p>}
      {!ready ? <p>{error ? 'RelatÃ³rio indisponÃ­vel. Os totais nÃ£o foram calculados.' : 'Carregando produÃ§Ã£oâ€¦'}</p> : <div role="region" aria-label="CalendÃ¡rio de produÃ§Ã£o" tabIndex={0} style={{ overflowX: 'auto', maxHeight: '65vh' }}>
        <table style={{ borderCollapse: 'collapse', whiteSpace: 'nowrap', width: '100%' }}>
          <caption>ProduÃ§Ã£o real â€” {month}</caption>
          <thead><tr><th scope="col">FuncionÃ¡rio</th>{days.map(d => <th style={cell} scope="col" key={d}>{d.slice(8)}</th>)}{weeks.map((w,i) => <th style={cell} key={i} scope="col">Semana {i+1} ({w[0].slice(8)}â€“{w[w.length-1].slice(8)})</th>)}<th style={cell} scope="col">Total mÃªs</th><th style={cell} scope="col">MÃ©dia/dia</th></tr></thead>
          <tbody>{people.map(m => <tr key={m.id}><th scope="row" style={{ ...cell, position: 'sticky', left: 0, background: '#fff', color: '#111', textAlign: 'left' }}>{m.name}</th>{days.map(d => <td key={d} style={cell}>{values.has(`${m.id}:${d}`) ? fmt(values.get(`${m.id}:${d}`)) : 'â€”'}</td>)}{weeks.map((w,i) => <td key={i} style={cell}>{fmt(total(m.id,w))}</td>)}<td style={cell}><strong>{fmt(total(m.id,days))}</strong></td><td style={cell}>{fmt(average(m.id))}</td></tr>)}</tbody>
          <tfoot><tr><th scope="row">Total equipe exibida</th>{[...days.map(d => [d]), ...weeks, days].map((dates,i) => <td style={cell} key={i}>{fmt(people.reduce((sum,m) => sum + total(m.id,dates),0))}</td>)}<td /></tr></tfoot>
        </table>
        {!people.length && <p>Cadastre os funcionÃ¡rios na aba Equipe.</p>}
      </div>}
    </section>
  </>
}
