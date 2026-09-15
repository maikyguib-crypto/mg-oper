'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

const db = supabase()
const today = () => new Date().toISOString().slice(0, 10)

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
  const [taskDate, setTaskDate] = useState(today())

  const [viewDate, setViewDate] = useState(today())
  const [filterMember, setFilterMember] = useState('')
  const [filterSector, setFilterSector] = useState('')

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
    if (session) load()
    else {
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

    const { data: companies } = await db
      .from('companies')
      .select('*')
      .eq('owner_id', uid)
      .limit(1)

    const c = companies?.[0]

    if (!c) {
      setCompany(null)
      setLoading(false)
      return
    }

    setCompany(c)

    const [
      { data: memberData },
      { data: taskData },
      { data: sectorData }
    ] = await Promise.all([
      db.from('company_members')
        .select('*')
        .eq('company_id', c.id)
        .order('name'),

      db.from('tasks')
        .select('*')
        .eq('company_id', c.id)
        .order('created_at', { ascending: false }),

      db.from('sectors')
        .select('*')
        .eq('company_id', c.id)
        .order('name')
    ])

    setMembers(memberData || [])
    setTasks(taskData || [])
    setSectors(sectorData || [])
    setLoading(false)
  }

  async function signup() {
    setMsg('')
    const { error } = await db.auth.signUp({ email, password })
    setMsg(error ? error.message : 'Conta criada.')
  }

  async function login() {
    setMsg('')
    const { error } = await db.auth.signInWithPassword({ email, password })
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

    if (error) setMsg(error.message)
    else load()
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
      name: memberName.trim(),
      active: true
    }

    if (memberSector) payload.sector_id = memberSector

    const { error } = await db.from('company_members').insert(payload)

    if (error) {
      setMsg(error.message)
      return
    }

    setMemberName('')
    setMemberSector('')
    load()
  }

  async function toggleMember(member) {
    const next = member.active === false

    const text = next
      ? `Reativar ${member.name}?`
      : `Desativar ${member.name}? O histórico de produção será mantido.`

    if (!window.confirm(text)) return

    const { error } = await db
      .from('company_members')
      .update({ active: next })
      .eq('id', member.id)

    if (error) {
      setMsg(error.message)
      return
    }

    load()
  }

  async function addTask() {
    if (!taskTitle.trim() || !company) return

    const member = members.find(x => x.id === taskMember)

    const payload = {
      company_id: company.id,
      title: taskTitle.trim(),
      status: 'pending',
      priority: taskPriority,
      schedule_date: taskDate,
      quantity_done: 0
    }

    if (taskGoal) {
      payload.quantity_target = Number(taskGoal)
      payload.goal = taskGoal
    }

    if (taskSector) payload.sector_id = taskSector

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
    setViewDate(taskDate)
    load()
  }

  async function startTask(task) {
    const { error } = await db.from('tasks').update({
      status: 'in_progress',
      started_at: task.started_at || new Date().toISOString()
    }).eq('id', task.id)

    if (error) setMsg(error.message)
    else load()
  }

  async function changeQuantity(task, amount) {
    const current = Number(task.quantity_done || 0)
    const target = Number(task.quantity_target || task.goal || 0)

    let next = current + amount
    if (next < 0) next = 0
    if (target > 0 && next > target) next = target

    const update = { quantity_done: next }

    if (next === 0) {
      update.status = 'pending'
      update.completed_at = null
    } else if (target > 0 && next >= target) {
      update.status = 'completed'
      update.started_at = task.started_at || new Date().toISOString()
      update.completed_at = new Date().toISOString()
    } else {
      update.status = 'in_progress'
      update.started_at = task.started_at || new Date().toISOString()
      update.completed_at = null
    }

    const { error } = await db
      .from('tasks')
      .update(update)
      .eq('id', task.id)

    if (error) setMsg(error.message)
    else load()
  }

  async function informQuantity(task) {
    const target = Number(task.quantity_target || task.goal || 0)

    const answer = window.prompt(
      target ? `Quantidade produzida? Meta: ${target}` : 'Quantidade produzida?'
    )

    if (answer === null) return

    let quantity = Number(String(answer).replace(',', '.'))

    if (Number.isNaN(quantity) || quantity < 0) {
      window.alert('Digite uma quantidade válida.')
      return
    }

    if (target > 0) quantity = Math.min(quantity, target)

    const update = {
      quantity_done: quantity,
      completed_at: null
    }

    if (quantity === 0) {
      update.status = 'pending'
    } else if (target > 0 && quantity >= target) {
      update.status = 'completed'
      update.started_at = task.started_at || new Date().toISOString()
      update.completed_at = new Date().toISOString()
    } else {
      update.status = 'in_progress'
      update.started_at = task.started_at || new Date().toISOString()
    }

    const { error } = await db.from('tasks').update(update).eq('id', task.id)

    if (error) setMsg(error.message)
    else load()
  }

  async function completeTask(task) {
    const target = Number(task.quantity_target || task.goal || 0)
    const current = Number(task.quantity_done || 0)

    const answer = window.prompt(
      target ? `Quantidade final? Meta: ${target}` : 'Quantidade final?',
      String(current || target || '')
    )

    if (answer === null) return

    const quantity = Number(String(answer).replace(',', '.'))

    if (Number.isNaN(quantity) || quantity < 0) {
      window.alert('Digite uma quantidade válida.')
      return
    }

    const { error } = await db.from('tasks').update({
      status: 'completed',
      quantity_done: quantity,
      started_at: task.started_at || new Date().toISOString(),
      completed_at: new Date().toISOString()
    }).eq('id', task.id)

    if (error) setMsg(error.message)
    else load()
  }

  async function deleteTask(task) {
    if (!window.confirm(`Excluir a tarefa "${task.title}"?`)) return

    const { error } = await db.from('tasks').delete().eq('id', task.id)

    if (error) setMsg(error.message)
    else load()
  }

  function sectorNameById(id) {
    return sectors.find(x => x.id === id)?.name || 'Sem setor'
  }

  function priorityName(value) {
    if (value === 'high') return 'Alta'
    if (value === 'low') return 'Baixa'
    return 'Normal'
  }

  function taskGoalValue(task) {
    return task.quantity_target ?? task.goal ?? ''
  }

  function printTask(task) {
    const target = taskGoalValue(task)

    printHTML(`
      <div class="sheet ticket">
        <h1>MG Oper</h1>
        <h3>${escapeHtml(company.name)}</h3>
        <hr>
        <h2>ORDEM DE TAREFA</h2>
        <p><b>Data:</b> ${formatDate(task.schedule_date)}</p>
        <p><b>Responsável:</b> ${escapeHtml(task.assignee || 'Sem responsável')}</p>
        <p><b>Setor:</b> ${escapeHtml(sectorNameById(task.sector_id))}</p>
        <p><b>Tarefa:</b> ${escapeHtml(task.title)}</p>
        <p><b>Prioridade:</b> ${priorityName(task.priority)}</p>
        <div class="meta">META: ${escapeHtml(String(target || '—'))}</div>
        <p><b>Produzido:</b> ${task.quantity_done || 0}</p>
      </div>
    `)
  }

  function printEmployeeDay(member) {
    const list = tasks.filter(t =>
      t.schedule_date === viewDate &&
      t.member_id === member.id
    )

    if (!list.length) {
      window.alert(`${member.name} não possui tarefas nessa data.`)
      return
    }

    const rows = list.map((t, index) => `
      <div class="job">
        <div class="check">☐</div>
        <div>
          <b>${index + 1}. ${escapeHtml(t.title)}</b>
          <p>
            Setor: ${escapeHtml(sectorNameById(t.sector_id))} |
            Meta: ${escapeHtml(String(taskGoalValue(t) || '—'))} |
            Prioridade: ${priorityName(t.priority)}
          </p>
          <div class="write">
            Produzido: __________ &nbsp;&nbsp; Assinatura: __________________
          </div>
        </div>
      </div>
    `).join('')

    printHTML(`
      <div class="sheet">
        <h1>MG Oper</h1>
        <h3>${escapeHtml(company.name)}</h3>
        <hr>
        <h2>PROGRAMAÇÃO DO DIA</h2>
        <p><b>Funcionário:</b> ${escapeHtml(member.name)}</p>
        <p><b>Data:</b> ${formatDate(viewDate)}</p>
        <p><b>Total de tarefas:</b> ${list.length}</p>
        <hr>
        ${rows}
        <div class="footer">
          Início: ______:______ &nbsp;&nbsp;&nbsp;
          Término: ______:______
        </div>
      </div>
    `)
  }

  function printHTML(content) {
    const win = window.open('', '_blank')

    if (!win) {
      window.alert('Permita pop-ups para imprimir.')
      return
    }

    win.document.write(`
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>MG Oper</title>
        <style>
          @page { margin: 12mm; }
          body {
            font-family: Arial, sans-serif;
            color: #111;
            margin: 0;
          }
          .sheet {
            max-width: 760px;
            margin: auto;
          }
          .ticket {
            max-width: 360px;
            border: 2px solid #111;
            padding: 18px;
            border-radius: 10px;
          }
          h1 { margin-bottom: 2px; }
          h3 { margin-top: 0; font-weight: normal; }
          .meta {
            border: 2px solid #111;
            padding: 14px;
            font-size: 24px;
            font-weight: bold;
            text-align: center;
            margin: 18px 0;
          }
          .job {
            display: flex;
            gap: 12px;
            border-bottom: 1px solid #aaa;
            padding: 16px 0;
          }
          .job p { margin: 6px 0; }
          .check { font-size: 26px; }
          .write {
            margin-top: 14px;
            font-size: 13px;
          }
          .footer {
            margin-top: 35px;
            border-top: 1px solid #111;
            padding-top: 20px;
          }
        </style>
      </head>
      <body>
        ${content}
        <script>
          window.onload = () => setTimeout(() => window.print(), 300)
        </script>
      </body>
      </html>
    `)

    win.document.close()
  }

  const activeMembers = members.filter(m => m.active !== false)

  const dateTasks = tasks.filter(t => t.schedule_date === viewDate)

  const filteredTasks = dateTasks.filter(t => {
    if (filterMember && t.member_id !== filterMember) return false
    if (filterSector && t.sector_id !== filterSector) return false
    return true
  })

  const activeTasks = filteredTasks.filter(t => t.status !== 'completed')
  const completedTasks = filteredTasks.filter(t => t.status === 'completed')

  const stats = useMemo(() => ({
    pending: dateTasks.filter(t => t.status === 'pending').length,
    progress: dateTasks.filter(t => t.status === 'in_progress').length,
    completed: dateTasks.filter(t => t.status === 'completed').length
  }), [dateTasks])

  if (loading) {
    return <main className="center"><div className="login">Carregando...</div></main>
  }

  if (!session) {
    return (
      <main className="center">
        <section className="login">
          <div className="brand">MG <b>Oper</b></div>
          <h1>Organize o trabalho do dia.</h1>
          <p>Gerencie sua empresa, equipe, setores e tarefas.</p>

          <input placeholder="E-mail" value={email}
            onChange={e => setEmail(e.target.value)} />

          <input placeholder="Senha" type="password" value={password}
            onChange={e => setPassword(e.target.value)} />

          <div className="actions">
            <button onClick={login}>Entrar</button>
            <button className="secondary" onClick={signup}>Criar conta</button>
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
          <div className="brand">MG <b>Oper</b></div>
          <h1>Crie sua empresa</h1>

          <input placeholder="Nome da empresa" value={companyName}
            onChange={e => setCompanyName(e.target.value)} />

          <button onClick={createCompany}>Começar a usar</button>
          {msg && <small>{msg}</small>}
        </section>
      </main>
    )
  }

  return (
    <div>
      <header>
        <div className="brand">MG <b>Oper</b></div>

        <nav>
          <button onClick={() => setTab('dashboard')}>Dashboard</button>
          <button onClick={() => setTab('programacao')}>Programação</button>
          <button onClick={() => setTab('equipe')}>Equipe</button>
          <button onClick={() => setTab('setores')}>Setores</button>
        </nav>

        <div>
          <span>{company.name}</span>
          <button className="link" onClick={logout}>Sair</button>
        </div>
      </header>

      <main className="page">

        {tab === 'dashboard' && (
          <>
            <p className="eyebrow">VISÃO GERAL</p>
            <h1>Produção do dia</h1>

            <input type="date" value={viewDate}
              onChange={e => setViewDate(e.target.value)} />

            <div className="stats">
              <Card n={stats.pending} t="Pendentes" />
              <Card n={stats.progress} t="Em andamento" />
              <Card n={stats.completed} t="Concluídas" />
              <Card n={activeMembers.length} t="Pessoas ativas" />
            </div>

            <section className="panel">
              <h2>Programação — {formatDate(viewDate)}</h2>

              {dateTasks.length === 0 && <p>Nenhuma tarefa para esta data.</p>}

              {dateTasks.map(t => (
                <TaskItem
                  key={t.id}
                  task={t}
                  sector={sectorNameById(t.sector_id)}
                  goal={taskGoalValue(t)}
                  onStart={startTask}
                  onChangeQuantity={changeQuantity}
                  onInformQuantity={informQuantity}
                  onComplete={completeTask}
                  onPrint={printTask}
                  onDelete={deleteTask}
                  priorityName={priorityName}
                />
              ))}
            </section>
          </>
        )}

        {tab === 'programacao' && (
          <>
            <p className="eyebrow">PROGRAMAÇÃO</p>
            <h1>Programação diária</h1>

            <div className="two">
              <section className="panel">
                <h2>Nova tarefa</h2>

                <label>Data</label>
                <input type="date" value={taskDate}
                  onChange={e => setTaskDate(e.target.value)} />

                <input placeholder="Tarefa" value={taskTitle}
                  onChange={e => setTaskTitle(e.target.value)} />

                <select value={taskMember}
                  onChange={e => setTaskMember(e.target.value)}>
                  <option value="">Responsável</option>
                  {activeMembers.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>

                <select value={taskSector}
                  onChange={e => setTaskSector(e.target.value)}>
                  <option value="">Setor</option>
                  {sectors.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>

                <input
                  placeholder="Meta / quantidade"
                  inputMode="numeric"
                  value={taskGoal}
                  onChange={e => setTaskGoal(e.target.value)}
                />

                <select value={taskPriority}
                  onChange={e => setTaskPriority(e.target.value)}>
                  <option value="low">Prioridade baixa</option>
                  <option value="normal">Prioridade normal</option>
                  <option value="high">Prioridade alta</option>
                </select>

                <button onClick={addTask}>Delegar tarefa</button>
              </section>

              <section className="panel">
                <h2>Consultar programação</h2>

                <label>Data</label>
                <input type="date" value={viewDate}
                  onChange={e => setViewDate(e.target.value)} />

                <select value={filterMember}
                  onChange={e => setFilterMember(e.target.value)}>
                  <option value="">Todos os funcionários</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>

                <select value={filterSector}
                  onChange={e => setFilterSector(e.target.value)}>
                  <option value="">Todos os setores</option>
                  {sectors.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>

                {filterMember && (
                  <button
                    onClick={() => {
                      const m = members.find(x => x.id === filterMember)
                      if (m) printEmployeeDay(m)
                    }}
                  >
                    🖨 Imprimir tarefas do funcionário
                  </button>
                )}
              </section>
            </div>

            <section className="panel" style={{ marginTop: 20 }}>
              <h2>Tarefas em aberto</h2>

              {activeTasks.length === 0 && <p>Nenhuma tarefa em aberto.</p>}

              {activeTasks.map(t => (
                <TaskItem
                  key={t.id}
                  task={t}
                  sector={sectorNameById(t.sector_id)}
                  goal={taskGoalValue(t)}
                  onStart={startTask}
                  onChangeQuantity={changeQuantity}
                  onInformQuantity={informQuantity}
                  onComplete={completeTask}
                  onPrint={printTask}
                  onDelete={deleteTask}
                  priorityName={priorityName}
                />
              ))}
            </section>

            <section className="panel" style={{ marginTop: 20 }}>
              <h2>Concluídas</h2>

              {completedTasks.length === 0 && <p>Nenhuma tarefa concluída.</p>}

              {completedTasks.map(t => (
                <TaskItem
                  key={t.id}
                  task={t}
                  sector={sectorNameById(t.sector_id)}
                  goal={taskGoalValue(t)}
                  onStart={startTask}
                  onChangeQuantity={changeQuantity}
                  onInformQuantity={informQuantity}
                  onComplete={completeTask}
                  onPrint={printTask}
                  onDelete={deleteTask}
                  priorityName={priorityName}
                />
              ))}
            </section>
          </>
        )}

        {tab === 'equipe' && (
          <>
            <p className="eyebrow">EQUIPE</p>
            <h1>Funcionários</h1>

            <div className="two">
              <section className="panel">
                <h2>Adicionar funcionário</h2>

                <input placeholder="Nome do funcionário"
                  value={memberName}
                  onChange={e => setMemberName(e.target.value)} />

                <select value={memberSector}
                  onChange={e => setMemberSector(e.target.value)}>
                  <option value="">Sem setor definido</option>
                  {sectors.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>

                <button onClick={addMember}>Adicionar</button>
              </section>

              <section className="panel">
                <h2>Equipe cadastrada</h2>

                {members.map(m => (
                  <div className="row" key={m.id}>
                    <div>
                      <b>{m.name}</b>
                      <br />
                      <small>
                        {sectorNameById(m.sector_id)} ·
                        {m.active === false ? ' Inativo' : ' Ativo'}
                      </small>
                    </div>

                    <button
                      className="secondary"
                      onClick={() => toggleMember(m)}
                    >
                      {m.active === false ? '↩ Reativar' : '⛔ Desativar'}
                    </button>
                  </div>
                ))}
              </section>
            </div>
          </>
        )}

        {tab === 'setores' && (
          <>
            <p className="eyebrow">ESTRUTURA</p>
            <h1>Setores</h1>

            <div className="two">
              <section className="panel">
                <h2>Novo setor</h2>

                <input placeholder="Nome do setor"
                  value={sectorName}
                  onChange={e => setSectorName(e.target.value)} />

                <button onClick={addSector}>Criar setor</button>
              </section>

              <section className="panel">
                <h2>Setores cadastrados</h2>

                {sectors.map(s => (
                  <div className="row" key={s.id}>
                    <b>{s.name}</b>
                  </div>
                ))}
              </section>
            </div>
          </>
        )}

        {msg && <p className="message">{msg}</p>}
      </main>
    </div>
  )
}

function TaskItem({
  task,
  sector,
  goal,
  onStart,
  onChangeQuantity,
  onInformQuantity,
  onComplete,
  onPrint,
  onDelete,
  priorityName
}) {
  const done = Number(task.quantity_done || 0)
  const target = Number(goal || 0)

  const percent = target > 0
    ? Math.min(100, Math.round((done / target) * 100))
    : 0

  const completed = task.status === 'completed'
  const progress = task.status === 'in_progress'

  return (
    <div className="task" style={{ alignItems: 'stretch', gap: 16 }}>
      <div style={{ flex: 1 }}>
        <b style={{ fontSize: 18 }}>{task.title}</b>

        <p>
          {task.assignee || 'Sem responsável'} · {sector}
          {target > 0 ? ` · Meta: ${target}` : ''}
        </p>

        {target > 0 && (
          <>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 10
            }}>
              <b>{done} / {target}</b>
              <b>{percent}%</b>
            </div>

            <div style={{
              width: '100%',
              height: 14,
              background: '#242b33',
              borderRadius: 999,
              overflow: 'hidden',
              margin: '7px 0 10px'
            }}>
              <div style={{
                width: `${percent}%`,
                height: '100%',
                background: 'linear-gradient(90deg,#58e39b,#72f0ad)',
                transition: 'width .25s ease'
              }} />
            </div>
          </>
        )}

        <small>
          Prioridade: {priorityName(task.priority)} · Status:{' '}
          {completed ? 'Concluída' : progress ? 'Em andamento' : 'Pendente'}
        </small>
      </div>

      <div style={{
        display: 'flex',
        gap: 7,
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'flex-end'
      }}>
        {!completed && !progress && (
          <button onClick={() => onStart(task)}>▶ Iniciar</button>
        )}

        {!completed && (
          <>
            <button className="secondary"
              onClick={() => onChangeQuantity(task, -5)}>
              −5
            </button>

            <button onClick={() => onChangeQuantity(task, 5)}>
              +5
            </button>

            <button className="secondary"
              onClick={() => onInformQuantity(task)}>
              ✎ Quantidade
            </button>

            <button onClick={() => onComplete(task)}>
              ✓ Concluir
            </button>
          </>
        )}

        <button className="secondary" onClick={() => onPrint(task)}>
          🧾 Imprimir
        </button>

        <button className="secondary" onClick={() => onDelete(task)}>
          🗑 Excluir
        </button>
      </div>
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
  const [year, month, day] = value.slice(0, 10).split('-')
  return `${day}/${month}/${year}`
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
