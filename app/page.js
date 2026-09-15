'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

const db = supabase()

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
    setMsg('')
    load()
  }

  async function addMember() {
    if (!memberName.trim() || !company) return

    const payload = {
      company_id: company.id,
      name: memberName.trim()
    }

    if (memberSector) payload.sector_id = memberSector

    const { error } = await db
      .from('company_members')
      .insert(payload)

    if (error) {
      setMsg(error.message)
      return
    }

    setMemberName('')
    setMemberSector('')
    setMsg('')
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
      schedule_date: new Date().toISOString().slice(0, 10),
      quantity_done: 0
    }

    if (taskGoal) {
      payload.quantity_target = Number(taskGoal)
      payload.goal = taskGoal
    }

    if (taskSector) {
      payload.sector_id = taskSector
    }

    if (member) {
      payload.member_id = member.id
      payload.assignee = member.name
    }

    const { error } = await db
      .from('tasks')
      .insert(payload)

    if (error) {
      setMsg(error.message)
      return
    }

    setTaskTitle('')
    setTaskGoal('')
    setTaskMember('')
    setTaskSector('')
    setTaskPriority('normal')
    setMsg('')
    load()
  }

  async function startTask(task) {
    const { error } = await db
      .from('tasks')
      .update({
        status: 'in_progress',
        started_at: task.started_at || new Date().toISOString()
      })
      .eq('id', task.id)

    if (error) {
      setMsg(error.message)
      return
    }

    load()
  }

  async function changeQuantity(task, amount) {
    const current = Number(task.quantity_done || 0)
    const target = Number(task.quantity_target || task.goal || 0)

    let next = current + amount

    if (next < 0) next = 0
    if (target > 0 && next > target) next = target

    const update = {
      quantity_done: next
    }

    if (next > 0 && task.status === 'pending') {
      update.status = 'in_progress'
      update.started_at =
        task.started_at || new Date().toISOString()
    }

    if (target > 0 && next >= target) {
      update.status = 'completed'
      update.completed_at = new Date().toISOString()
    } else if (task.status === 'completed' && next < target) {
      update.status = next > 0 ? 'in_progress' : 'pending'
      update.completed_at = null
    }

    const { error } = await db
      .from('tasks')
      .update(update)
      .eq('id', task.id)

    if (error) {
      setMsg(error.message)
      return
    }

    setMsg('')
    load()
  }

  async function informQuantity(task) {
    const target = Number(
      task.quantity_target || task.goal || 0
    )

    const answer = window.prompt(
      target
        ? `Quantidade produzida até agora? Meta: ${target}`
        : 'Quantidade produzida até agora?'
    )

    if (answer === null) return

    const quantity = Number(
      String(answer).replace(',', '.')
    )

    if (
      answer.trim() === '' ||
      Number.isNaN(quantity) ||
      quantity < 0
    ) {
      window.alert('Digite uma quantidade válida.')
      return
    }

    const finalQuantity =
      target > 0
        ? Math.min(quantity, target)
        : quantity

    const update = {
      quantity_done: finalQuantity
    }

    if (finalQuantity > 0) {
      update.status = 'in_progress'
      update.started_at =
        task.started_at || new Date().toISOString()
    } else {
      update.status = 'pending'
    }

    if (target > 0 && finalQuantity >= target) {
      update.status = 'completed'
      update.completed_at = new Date().toISOString()
    } else {
      update.completed_at = null
    }

    const { error } = await db
      .from('tasks')
      .update(update)
      .eq('id', task.id)

    if (error) {
      setMsg(error.message)
      return
    }

    load()
  }

  async function completeTask(task) {
    const target = Number(
      task.quantity_target || task.goal || 0
    )

    const current = Number(task.quantity_done || 0)

    const answer = window.prompt(
      target
        ? `Quantidade final realizada? Meta: ${target}`
        : 'Quantidade final realizada?',
      String(current || target || '')
    )

    if (answer === null) return

    const quantity = Number(
      String(answer).replace(',', '.')
    )

    if (
      answer.trim() === '' ||
      Number.isNaN(quantity) ||
      quantity < 0
    ) {
      window.alert('Digite uma quantidade válida.')
      return
    }

    const { error } = await db
      .from('tasks')
      .update({
        status: 'completed',
        quantity_done: quantity,
        completed_at: new Date().toISOString()
      })
      .eq('id', task.id)

    if (error) {
      setMsg(error.message)
      return
    }

    load()
  }

  async function deleteTask(task) {
    const ok = window.confirm(
      `Excluir a tarefa "${task.title}"?\n\nEssa ação não poderá ser desfeita.`
    )

    if (!ok) return

    const { error } = await db
      .from('tasks')
      .delete()
      .eq('id', task.id)

    if (error) {
      setMsg(error.message)
      return
    }

    load()
  }

  function printTask(task) {
    const sector = sectorNameById(task.sector_id)

    const target =
      task.quantity_target ??
      task.goal ??
      'Não informada'

    const done = task.quantity_done ?? 0

    const date = formatDate(
      task.schedule_date || task.created_at
    )

    const priority =
      task.priority === 'high'
        ? 'Alta'
        : task.priority === 'low'
        ? 'Baixa'
        : 'Normal'

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1"
          />

          <title>Ordem de tarefa</title>

          <style>
            @page {
              size: 80mm auto;
              margin: 5mm;
            }

            body {
              margin: 0;
              font-family: Arial, sans-serif;
              color: #000;
              background: #fff;
            }

            .ticket {
              width: 70mm;
              margin: 0 auto;
              border: 2px solid #000;
              border-radius: 8px;
              padding: 12px;
              box-sizing: border-box;
            }

            .brand {
              font-size: 22px;
              font-weight: 800;
              text-align: center;
            }

            .company {
              text-align: center;
              margin-top: 4px;
              font-size: 13px;
            }

            .title {
              text-align: center;
              font-weight: 800;
              margin: 14px 0;
              padding: 8px 0;
              border-top: 1px dashed #000;
              border-bottom: 1px dashed #000;
            }

            .line {
              margin: 8px 0;
              font-size: 14px;
            }

            .goal {
              margin: 14px 0;
              padding: 10px;
              border: 2px solid #000;
              text-align: center;
              font-size: 20px;
              font-weight: 800;
            }

            .footer {
              margin-top: 16px;
              padding-top: 10px;
              border-top: 1px dashed #000;
              font-size: 11px;
              text-align: center;
            }
          </style>
        </head>

        <body>
          <div class="ticket">

            <div class="brand">MG Oper</div>

            <div class="company">
              ${escapeHtml(company?.name || '')}
            </div>

            <div class="title">
              ORDEM DE TAREFA
            </div>

            <div class="line">
              <b>Tarefa:</b>
              ${escapeHtml(task.title)}
            </div>

            <div class="line">
              <b>Responsável:</b>
              ${escapeHtml(
                task.assignee || 'Sem responsável'
              )}
            </div>

            <div class="line">
              <b>Setor:</b>
              ${escapeHtml(sector)}
            </div>

            <div class="line">
              <b>Data:</b>
              ${escapeHtml(date)}
            </div>

            <div class="line">
              <b>Prioridade:</b>
              ${priority}
            </div>

            <div class="goal">
              META: ${escapeHtml(String(target))}
            </div>

            ${
              Number(done) > 0
                ? `
                <div class="line">
                  <b>Realizado:</b>
                  ${escapeHtml(String(done))}
                </div>
              `
                : ''
            }

            <div class="footer">
              Gerado pelo MG Oper
            </div>

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
    `

    const win = window.open('', '_blank')

    if (!win) {
      window.alert(
        'Permita pop-ups para imprimir a ordem.'
      )
      return
    }

    win.document.open()
    win.document.write(html)
    win.document.close()
  }

  const stats = useMemo(() => ({
    pending:
      tasks.filter(x => x.status === 'pending').length,

    progress:
      tasks.filter(x => x.status === 'in_progress').length,

    completed:
      tasks.filter(x => x.status === 'completed').length
  }), [tasks])

  const activeTasks =
    tasks.filter(x => x.status !== 'completed')

  const completedTasks =
    tasks.filter(x => x.status === 'completed')

  function sectorNameById(id) {
    return (
      sectors.find(x => x.id === id)?.name ||
      'Sem setor'
    )
  }

  function priorityName(priority) {
    if (priority === 'high') return 'Alta'
    if (priority === 'low') return 'Baixa'
    return 'Normal'
  }

  function formatDate(value) {
    if (!value) {
      return new Date().toLocaleDateString('pt-BR')
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split('-')
      return `${day}/${month}/${year}`
    }

    return new Date(value)
      .toLocaleDateString('pt-BR')
  }

  function taskGoalValue(task) {
    return (
      task.quantity_target ??
      task.goal ??
      ''
    )
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
            Gerencie sua empresa, equipe,
            setores e tarefas.
          </p>

          <input
            placeholder="E-mail"
            value={email}
            onChange={
              e => setEmail(e.target.value)
            }
          />

          <input
            placeholder="Senha"
            type="password"
            value={password}
            onChange={
              e => setPassword(e.target.value)
            }
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

          <h1>Crie sua empresa</h1>

          <p>
            Esse será seu espaço de trabalho.
          </p>

          <input
            placeholder="Nome da empresa"
            value={companyName}
            onChange={
              e => setCompanyName(e.target.value)
            }
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

          <button
            onClick={
              () => setTab('dashboard')
            }
          >
            Dashboard
          </button>

          <button
            onClick={
              () => setTab('programacao')
            }
          >
            Programação
          </button>

          <button
            onClick={
              () => setTab('equipe')
            }
          >
            Equipe
          </button>

          <button
            onClick={
              () => setTab('setores')
            }
          >
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
              Acompanhe a operação da empresa
              em um só lugar.
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

              <h2>Produção de hoje</h2>

              {activeTasks.length === 0 && (
                <p>
                  Nenhuma tarefa pendente.
                </p>
              )}

              {activeTasks
                .slice(0, 10)
                .map(t => (
                  <TaskItem
                    key={t.id}
                    task={t}
                    sector={
                      sectorNameById(
                        t.sector_id
                      )
                    }
                    goal={
                      taskGoalValue(t)
                    }
                    onStart={startTask}
                    onChangeQuantity={
                      changeQuantity
                    }
                    onInformQuantity={
                      informQuantity
                    }
                    onComplete={
                      completeTask
                    }
                    onPrint={printTask}
                    onDelete={deleteTask}
                    priorityName={
                      priorityName
                    }
                  />
                ))}

            </section>

            {completedTasks.length > 0 && (
              <section className="panel">

                <h2>
                  Concluídas recentemente
                </h2>

                {completedTasks
                  .slice(0, 5)
                  .map(t => (
                    <TaskItem
                      key={t.id}
                      task={t}
                      sector={
                        sectorNameById(
                          t.sector_id
                        )
                      }
                      goal={
                        taskGoalValue(t)
                      }
                      onStart={startTask}
                      onChangeQuantity={
                        changeQuantity
                      }
                      onInformQuantity={
                        informQuantity
                      }
                      onComplete={
                        completeTask
                      }
                      onPrint={printTask}
                      onDelete={deleteTask}
                      priorityName={
                        priorityName
                      }
                    />
                  ))}

              </section>
            )}

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
              Distribua tarefas,
              responsáveis e metas.
            </p>

            <div className="two">

              <section className="panel">

                <h2>Nova tarefa</h2>

                <input
                  placeholder="Ex.: Biotina"
                  value={taskTitle}
                  onChange={
                    e =>
                      setTaskTitle(
                        e.target.value
                      )
                  }
                />

                <select
                  value={taskMember}
                  onChange={
                    e =>
                      setTaskMember(
                        e.target.value
                      )
                  }
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
                  onChange={
                    e =>
                      setTaskSector(
                        e.target.value
                      )
                  }
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
                  placeholder="Meta / quantidade"
                  inputMode="numeric"
                  value={taskGoal}
                  onChange={
                    e =>
                      setTaskGoal(
                        e.target.value
                      )
                  }
                />

                <select
                  value={taskPriority}
                  onChange={
                    e =>
                      setTaskPriority(
                        e.target.value
                      )
                  }
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
                  Produção em aberto
                </h2>

                {activeTasks.length === 0 && (
                  <p>
                    Nenhuma tarefa em aberto.
                  </p>
                )}

                {activeTasks.map(t => (
                  <TaskItem
                    key={t.id}
                    task={t}
                    sector={
                      sectorNameById(
                        t.sector_id
                      )
                    }
                    goal={
                      taskGoalValue(t)
                    }
                    onStart={startTask}
                    onChangeQuantity={
                      changeQuantity
                    }
                    onInformQuantity={
                      informQuantity
                    }
                    onComplete={
                      completeTask
                    }
                    onPrint={printTask}
                    onDelete={deleteTask}
                    priorityName={
                      priorityName
                    }
                  />
                ))}

              </section>

            </div>

            <section
              className="panel"
              style={{ marginTop: 20 }}
            >

              <h2>
                Histórico de concluídas
              </h2>

              {completedTasks.length === 0 && (
                <p>
                  Nenhuma tarefa concluída ainda.
                </p>
              )}

              {completedTasks.map(t => (
                <TaskItem
                  key={t.id}
                  task={t}
                  sector={
                    sectorNameById(
                      t.sector_id
                    )
                  }
                  goal={
                    taskGoalValue(t)
                  }
                  onStart={startTask}
                  onChangeQuantity={
                    changeQuantity
                  }
                  onInformQuantity={
                    informQuantity
                  }
                  onComplete={
                    completeTask
                  }
                  onPrint={printTask}
                  onDelete={deleteTask}
                  priorityName={
                    priorityName
                  }
                />
              ))}

            </section>

          </>
        )}

        {tab === 'equipe' && (
          <>

            <p className="eyebrow">
              EQUIPE
            </p>

            <h1>Funcionários</h1>

            <p>
              Cadastre as pessoas que
              trabalham na empresa.
            </p>

            <div className="two">

              <section className="panel">

                <h2>
                  Adicionar funcionário
                </h2>

                <input
                  placeholder="Nome do funcionário"
                  value={memberName}
                  onChange={
                    e =>
                      setMemberName(
                        e.target.value
                      )
                  }
                />

                <select
                  value={memberSector}
                  onChange={
                    e =>
                      setMemberSector(
                        e.target.value
                      )
                  }
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

                    <b>{m.name}</b>

                    <span>
                      {sectorNameById(
                        m.sector_id
                      )}
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
              Cada empresa pode montar
              sua própria operação.
            </p>

            <div className="two">

              <section className="panel">

                <h2>Novo setor</h2>

                <input
                  placeholder="Ex.: Manual, Produção..."
                  value={sectorName}
                  onChange={
                    e =>
                      setSectorName(
                        e.target.value
                      )
                  }
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
                    <b>{s.name}</b>
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
  const done =
    Number(task.quantity_done || 0)

  const target =
    Number(goal || 0)

  const percent =
    target > 0
      ? Math.min(
          100,
          Math.round(
            (done / target) * 100
          )
        )
      : 0

  const completed =
    task.status === 'completed'

  const progress =
    task.status === 'in_progress'

  return (
    <div
      className="task"
      style={{
        alignItems: 'stretch',
        gap: 16
      }}
    >

      <div style={{ flex: 1 }}>

        <b style={{ fontSize: 18 }}>
          {task.title}
        </b>

        <p>
          {task.assignee ||
            'Sem responsável'}
          {' · '}
          {sector}
        </p>

        {target > 0 && (
          <>
            <div
              style={{
                display: 'flex',
                justifyContent:
                  'space-between',
                gap: 10,
                marginTop: 10
              }}
            >
              <b>
                {done} / {target}
              </b>

              <b>
                {percent}%
              </b>
            </div>

            <div
              style={{
                width: '100%',
                height: 14,
                background: '#242b33',
                borderRadius: 999,
                overflow: 'hidden',
                marginTop: 7,
                marginBottom: 10
              }}
            >
              <div
                style={{
                  width: `${percent}%`,
                  height: '100%',
                  background:
                    'linear-gradient(90deg, #58e39b, #72f0ad)',
                  transition:
                    'width .25s ease'
                }}
              />
            </div>
          </>
        )}

        <small>
          Prioridade:{' '}
          {priorityName(
            task.priority
          )}
          {' · '}
          Status:{' '}
          {completed
            ? 'Concluída'
            : progress
            ? 'Em andamento'
            : 'Pendente'}
        </small>

      </div>

      <div
        style={{
          display: 'flex',
          gap: 7,
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent:
            'flex-end'
        }}
      >

        {!completed &&
          !progress && (
            <button
              onClick={
                () =>
                  onStart(task)
              }
            >
              ▶ Iniciar
            </button>
          )}

        {!completed && (
          <>
            <button
              className="secondary"
              onClick={
                () =>
                  onChangeQuantity(
                    task,
                    -5
                  )
              }
            >
              −5
            </button>

            <button
              onClick={
                () =>
                  onChangeQuantity(
                    task,
                    5
                  )
              }
            >
              +5
            </button>

            <button
              className="secondary"
              onClick={
                () =>
                  onInformQuantity(
                    task
                  )
              }
            >
              ✎ Quantidade
            </button>

            <button
              onClick={
                () =>
                  onComplete(task)
              }
            >
              ✓ Concluir
            </button>
          </>
        )}

        <button
          className="secondary"
          onClick={
            () => onPrint(task)
          }
        >
          🧾 Imprimir
        </button>

        <button
          className="secondary"
          onClick={
            () => onDelete(task)
          }
        >
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

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
