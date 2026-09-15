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
      alert('Escolha o funcionário responsável.')
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
      alert('Escolha o funcionário que deseja imprimir.')
      return
    }

    const member = members.find(m => m.id === printMember)

    if (!member) {
      alert('Funcionário não encontrado.')
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
        `${member.name} não possui programação para ${formatDate(printDate)}.`
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
          '—'

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
                ☐ CONCLUÍDO
              </div>
            </div>
          </div>
        `
      })
      .join('')

    const w = window.open('', '_blank')

    if (!w) {
      alert(
        'O navegador bloqueou a impressão. Permita pop-ups para o MG Oper.'
      )
      return
    }

    w.document.write(`
      <!doctype html>

      <html>
        <head>
          <meta charset="utf-8">

          <title>
            Programação - ${safe(member.name)}
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
              PROGRAMAÇÃO DO DIA
            </div>
          </div>

          <div class="info">
            <strong>Funcionário:</strong>
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
            MG Oper — Programação operacional
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
    return 'Concluída'
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
            Esse será seu espaço de trabalho.
          </p>

          <input
            placeholder="Nome da empresa"
            value={companyName}
            onChange={e => setCompanyName(e.target.value)}
          />

          <button onClick={createCompany}>
            Começar a usar
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
            Programação
          </button>

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
        {tab === 'dashboard' && (
          <>
            <p className="eyebrow">
              VISÃO GERAL
            </p>

            <h1>
              Olá! O que precisa ser feito hoje?
            </h1>

            <p>
              Acompanhe a operação da empresa em um só lugar.
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
                t="Concluídas"
              />

              <Card
                n={members.length}
                t="Pessoas"
              />
            </div>

            <section className="panel">
              <h2>
                Programação
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
                      {t.assignee || 'Sem responsável'}
                      {' · '}
                      {sectorNameById(t.sector_id)}

                      {(t.quantity_target || t.goal)
                        ? ` · Quantidade: ${t.quantity_target || t.goal}`
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
              PROGRAMAÇÃO
            </p>

            <h1>
              Programação do dia
            </h1>

            <p>
              Distribua produtos, responsáveis e quantidades.
            </p>

            <section
              className="panel"
              style={{ marginBottom: 20 }}
            >
              <h2>
                🖨 Imprimir programação do dia
              </h2>

              <p>
                Escolha o funcionário e a data.
              </p>

              <label>
                Funcionário
              </label>

              <select
                value={printMember}
                onChange={e => setPrintMember(e.target.value)}
              >
                <option value="">
                  Selecione o funcionário
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
                Data da programação
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
                🖨 IMPRIMIR PROGRAMAÇÃO
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
                    Responsável
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
                        {t.assignee || 'Sem responsável'}
                        {' · '}
                        {sectorNameById(t.sector_id)}

                        {(t.quantity_target || t.goal)
                          ? ` · Quantidade: ${t.quantity_target || t.goal}`
                          : ''}
                      </p>

                      <small>
                        Data: {formatDate(t.schedule_date)}
                        {' · '}
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
              Funcionários
            </h1>

            <p>
              Cadastre as pessoas que trabalham na empresa.
            </p>

            <div className="two">
              <section className="panel">
                <h2>
                  Adicionar funcionário
                </h2>

                <input
                  placeholder="Nome do funcionário"
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
                    Nenhum funcionário cadastrado.
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
              Cada empresa pode montar sua própria operação.
            </p>

            <div className="two">
              <section className="panel">
                <h2>
                  Novo setor
                </h2>

                <input
                  placeholder="Ex.: Produção, Vendas, Expedição..."
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
  if (!value) return '—'

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
