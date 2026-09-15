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
  const [sectors, setSectors] = useState([])
  const [tasks, setTasks] = useState([])
  const [taskMembers, setTaskMembers] = useState([])
  const [logs, setLogs] = useState([])
  const [sessions, setSessions] = useState([])

  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('dashboard')
  const [msg, setMsg] = useState('')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [companyName, setCompanyName] = useState('')

  const [sectorName, setSectorName] = useState('')
  const [memberName, setMemberName] = useState('')
  const [memberSector, setMemberSector] = useState('')

  const [taskTitle, setTaskTitle] = useState('')
  const [taskSector, setTaskSector] = useState('')
  const [taskGoal, setTaskGoal] = useState('')
  const [taskPriority, setTaskPriority] = useState('normal')
  const [taskDate, setTaskDate] = useState(localDate())
  const [taskNotes, setTaskNotes] = useState('')
  const [taskDeadline, setTaskDeadline] = useState('')
  const [selectedMembers, setSelectedMembers] = useState([])

  const [viewDate, setViewDate] = useState(localDate())
  const [filterMember, setFilterMember] = useState('')
  const [filterSector, setFilterSector] = useState('')
  const [tick, setTick] = useState(0)

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
    if (session) loadAll()
  }, [session])

  useEffect(() => {
    const timer = setInterval(() => setTick(x => x + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  // Atualização quase em tempo real
  useEffect(() => {
    if (!company) return

    const timer = setInterval(() => {
      refreshProduction()
    }, 5000)

    return () => clearInterval(timer)
  }, [company])

  async function loadAll() {
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
      { data: ms },
      { data: ss },
      { data: ts }
    ] = await Promise.all([
      db.from('company_members')
        .select('*')
        .eq('company_id', c.id)
        .order('name'),

      db.from('sectors')
        .select('*')
        .eq('company_id', c.id)
        .order('name'),

      db.from('tasks')
        .select('*')
        .eq('company_id', c.id)
        .order('created_at', { ascending: false })
    ])

    setMembers(ms || [])
    setSectors(ss || [])
    setTasks(ts || [])

    await loadProductionData(c.id)
    setLoading(false)
  }

  async function loadProductionData(companyId) {
    const [
      { data: tm },
      { data: pl },
      { data: ps }
    ] = await Promise.all([
      db.from('task_members').select('*'),
      db.from('production_logs')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false }),
      db.from('production_sessions')
        .select('*')
        .eq('company_id', companyId)
        .order('started_at', { ascending: false })
    ])

    setTaskMembers(tm || [])
    setLogs(pl || [])
    setSessions(ps || [])
  }

  async function refreshProduction() {
    if (!company) return

    const [
      { data: ts },
      { data: tm },
      { data: pl },
      { data: ps }
    ] = await Promise.all([
      db.from('tasks')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false }),
      db.from('task_members').select('*'),
      db.from('production_logs')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false }),
      db.from('production_sessions')
        .select('*')
        .eq('company_id', company.id)
        .order('started_at', { ascending: false })
    ])

    setTasks(ts || [])
    setTaskMembers(tm || [])
    setLogs(pl || [])
    setSessions(ps || [])
  }

  async function login() {
    setMsg('')
    const { error } = await db.auth.signInWithPassword({ email, password })
    if (error) setMsg(error.message)
  }

  async function signup() {
    setMsg('')
    const { error } = await db.auth.signUp({ email, password })
    setMsg(error ? error.message : 'Conta criada. Agora entre na sua conta.')
  }

  async function logout() {
    await db.auth.signOut()
    setCompany(null)
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
    else loadAll()
  }

  async function addSector() {
    if (!sectorName.trim()) return

    const { error } = await db.from('sectors').insert({
      company_id: company.id,
      name: sectorName.trim()
    })

    if (error) return setMsg(error.message)

    setSectorName('')
    loadAll()
  }

  async function addMember() {
    if (!memberName.trim()) return

    const payload = {
      company_id: company.id,
      name: memberName.trim(),
      active: true
    }

    if (memberSector) payload.sector_id = memberSector

    const { error } = await db.from('company_members').insert(payload)

    if (error) return setMsg(error.message)

    setMemberName('')
    setMemberSector('')
    loadAll()
  }

  async function toggleMember(member) {
    const activate = member.active === false

    if (!confirm(
      activate
        ? `Reativar ${member.name}?`
        : `Desativar ${member.name}? O histórico será preservado.`
    )) return

    const { error } = await db
      .from('company_members')
      .update({ active: activate })
      .eq('id', member.id)

    if (error) setMsg(error.message)
    else loadAll()
  }

  function toggleSelectedMember(id) {
    setSelectedMembers(current =>
      current.includes(id)
        ? current.filter(x => x !== id)
        : [...current, id]
    )
  }

  async function addTask() {
    if (!taskTitle.trim()) {
      alert('Digite o nome da tarefa.')
      return
    }

    if (!selectedMembers.length) {
      alert('Selecione pelo menos um funcionário.')
      return
    }

    const selected = members.filter(m => selectedMembers.includes(m.id))

    const payload = {
      company_id: company.id,
      title: taskTitle.trim(),
      status: 'pending',
      priority: taskPriority,
      schedule_date: taskDate,
      quantity_done: 0,
      notes: taskNotes.trim() || null,
      assignee: selected.map(m => m.name).join(', ')
    }

    if (taskSector) payload.sector_id = taskSector

    if (taskGoal) {
      payload.quantity_target = Number(taskGoal)
      payload.goal = taskGoal
    }

    if (taskDeadline) payload.deadline_time = taskDeadline

    // Mantém compatibilidade com o sistema anterior
    if (selected[0]) payload.member_id = selected[0].id

    const { data: created, error } = await db
      .from('tasks')
      .insert(payload)
      .select()
      .single()

    if (error) {
      setMsg(error.message)
      return
    }

    const links = selectedMembers.map(memberId => ({
      task_id: created.id,
      member_id: memberId,
      active: true
    }))

    const { error: linkError } = await db
      .from('task_members')
      .insert(links)

    if (linkError) {
      setMsg(linkError.message)
      return
    }

    await addEvent(created.id, null, 'task_created', 'Tarefa criada')

    setTaskTitle('')
    setTaskGoal('')
    setTaskSector('')
    setTaskNotes('')
    setTaskDeadline('')
    setTaskPriority('normal')
    setSelectedMembers([])
    setViewDate(taskDate)

    loadAll()
  }

  async function addEvent(taskId, memberId, type, description) {
    await db.from('task_events').insert({
      company_id: company.id,
      task_id: taskId,
      member_id: memberId || null,
      event_type: type,
      description
    })
  }

  function membersForTask(taskId) {
    const ids = taskMembers
      .filter(x => x.task_id === taskId && x.active !== false)
      .map(x => x.member_id)

    return members.filter(m => ids.includes(m.id))
  }

  function activeSessionsForTask(taskId) {
    return sessions.filter(s => s.task_id === taskId && !s.ended_at)
  }

  async function startTask(task) {
    const assigned = membersForTask(task.id)

    if (!assigned.length) {
      alert('Essa tarefa não possui funcionários vinculados.')
      return
    }

    const existing = activeSessionsForTask(task.id)
    const existingIds = existing.map(x => x.member_id)

    const newSessions = assigned
      .filter(m => !existingIds.includes(m.id))
      .map(m => ({
        company_id: company.id,
        task_id: task.id,
        member_id: m.id
      }))

    if (newSessions.length) {
      const { error } = await db
        .from('production_sessions')
        .insert(newSessions)

      if (error) {
        setMsg(error.message)
        return
      }
    }

    await db.from('tasks').update({
      status: 'in_progress',
      started_at: task.started_at || new Date().toISOString(),
      production_started_at:
        task.production_started_at || new Date().toISOString()
    }).eq('id', task.id)

    await addEvent(
      task.id,
      null,
      'production_started',
      `${assigned.length} funcionário(s) iniciaram a produção`
    )

    refreshProduction()
  }

  async function addProgress(task, amount) {
    const assigned = membersForTask(task.id)

    let memberId = assigned[0]?.id

    if (assigned.length > 1) {
      const names = assigned
        .map((m, i) => `${i + 1} - ${m.name}`)
        .join('\n')

      const answer = prompt(
        `Quem está registrando ${amount > 0 ? '+' : ''}${amount}?\n\n${names}`
      )

      if (answer === null) return

      const index = Number(answer) - 1

      if (!assigned[index]) {
        alert('Funcionário inválido.')
        return
      }

      memberId = assigned[index].id
    }

    const current = Number(task.quantity_done || 0)
    const target = Number(task.quantity_target || task.goal || 0)

    let next = current + amount
    if (next < 0) next = 0
    if (target > 0 && next > target) next = target

    const realAmount = next - current

    const update = {
      quantity_done: next
    }

    if (next === 0) {
      update.status = 'pending'
      update.completed_at = null
    } else if (target > 0 && next >= target) {
      update.status = 'completed'
      update.completed_at = new Date().toISOString()
      update.production_finished_at = new Date().toISOString()
    } else {
      update.status = 'in_progress'
      update.started_at = task.started_at || new Date().toISOString()
      update.production_started_at =
        task.production_started_at || new Date().toISOString()
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

    if (realAmount !== 0) {
      await db.from('production_logs').insert({
        company_id: company.id,
        task_id: task.id,
        member_id: memberId || null,
        quantity: realAmount,
        action_type: realAmount > 0 ? 'progress' : 'correction'
      })
    }

    if (target > 0 && next >= target) {
      await finishSessions(task.id)
      await addEvent(task.id, memberId, 'task_completed', 'Meta concluída')
    }

    refreshProduction()
  }

  async function setQuantity(task) {
    const answer = prompt(
      `Quantidade produzida? Meta: ${task.quantity_target || task.goal || 'sem meta'}`,
      String(task.quantity_done || 0)
    )

    if (answer === null) return

    const value = Number(String(answer).replace(',', '.'))

    if (Number.isNaN(value) || value < 0) {
      alert('Digite uma quantidade válida.')
      return
    }

    const current = Number(task.quantity_done || 0)
    const target = Number(task.quantity_target || task.goal || 0)
    const next = target > 0 ? Math.min(value, target) : value
    const difference = next - current

    const assigned = membersForTask(task.id)
    let memberId = assigned[0]?.id || null

    const update = {
      quantity_done: next,
      status:
        target > 0 && next >= target
          ? 'completed'
          : next > 0
            ? 'in_progress'
            : 'pending',
      completed_at:
        target > 0 && next >= target
          ? new Date().toISOString()
          : null
    }

    if (target > 0 && next >= target) {
      update.production_finished_at = new Date().toISOString()
    }

    const { error } = await db
      .from('tasks')
      .update(update)
      .eq('id', task.id)

    if (error) return setMsg(error.message)

    if (difference !== 0) {
      await db.from('production_logs').insert({
        company_id: company.id,
        task_id: task.id,
        member_id: memberId,
        quantity: difference,
        action_type: 'manual'
      })
    }

    if (update.status === 'completed') {
      await finishSessions(task.id)
    }

    refreshProduction()
  }

  async function completeTask(task) {
    const target = Number(task.quantity_target || task.goal || 0)
    const current = Number(task.quantity_done || 0)

    const answer = prompt(
      target ? `Quantidade final? Meta: ${target}` : 'Quantidade final?',
      String(current || target || '')
    )

    if (answer === null) return

    const value = Number(String(answer).replace(',', '.'))

    if (Number.isNaN(value) || value < 0) {
      alert('Quantidade inválida.')
      return
    }

    const difference = value - current
    const assigned = membersForTask(task.id)

    await db.from('tasks').update({
      quantity_done: value,
      status: 'completed',
      completed_at: new Date().toISOString(),
      production_finished_at: new Date().toISOString()
    }).eq('id', task.id)

    if (difference !== 0) {
      await db.from('production_logs').insert({
        company_id: company.id,
        task_id: task.id,
        member_id: assigned[0]?.id || null,
        quantity: difference,
        action_type: 'completion'
      })
    }

    await finishSessions(task.id)
    await addEvent(task.id, null, 'task_completed', 'Tarefa concluída manualmente')
    refreshProduction()
  }

  async function finishSessions(taskId) {
    const active = sessions.filter(s => s.task_id === taskId && !s.ended_at)

    for (const s of active) {
      await db.from('production_sessions')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', s.id)
    }
  }

  async function transferMember(task) {
    const current = membersForTask(task.id)
    const active = members.filter(m => m.active !== false)

    const list = active
      .map((m, i) =>
        `${i + 1} - ${m.name}${current.some(x => x.id === m.id) ? ' ✓' : ''}`
      )
      .join('\n')

    const answer = prompt(
      `Digite o número do funcionário que deseja adicionar à tarefa:\n\n${list}`
    )

    if (answer === null) return

    const member = active[Number(answer) - 1]

    if (!member) {
      alert('Funcionário inválido.')
      return
    }

    const existing = taskMembers.find(
      x => x.task_id === task.id && x.member_id === member.id
    )

    if (existing) {
      await db.from('task_members')
        .update({
          active: true,
          left_at: null,
          joined_at: new Date().toISOString()
        })
        .eq('id', existing.id)
    } else {
      await db.from('task_members').insert({
        task_id: task.id,
        member_id: member.id,
        active: true
      })
    }

    if (task.status === 'in_progress') {
      const alreadyWorking = sessions.some(
        s =>
          s.task_id === task.id &&
          s.member_id === member.id &&
          !s.ended_at
      )

      if (!alreadyWorking) {
        await db.from('production_sessions').insert({
          company_id: company.id,
          task_id: task.id,
          member_id: member.id
        })
      }
    }

    await addEvent(
      task.id,
      member.id,
      'member_added',
      `${member.name} entrou na tarefa`
    )

    refreshProduction()
  }

  async function removeMemberFromTask(task) {
    const current = membersForTask(task.id)

    if (current.length <= 1) {
      alert('A tarefa precisa manter pelo menos um funcionário.')
      return
    }

    const list = current.map((m, i) => `${i + 1} - ${m.name}`).join('\n')

    const answer = prompt(
      `Quem deseja retirar desta produção?\n\n${list}`
    )

    if (answer === null) return

    const member = current[Number(answer) - 1]

    if (!member) {
      alert('Funcionário inválido.')
      return
    }

    const link = taskMembers.find(
      x => x.task_id === task.id && x.member_id === member.id
    )

    if (link) {
      await db.from('task_members').update({
        active: false,
        left_at: new Date().toISOString()
      }).eq('id', link.id)
    }

    const activeSession = sessions.find(
      s =>
        s.task_id === task.id &&
        s.member_id === member.id &&
        !s.ended_at
    )

    if (activeSession) {
      await db.from('production_sessions')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', activeSession.id)
    }

    await addEvent(
      task.id,
      member.id,
      'member_removed',
      `${member.name} saiu da tarefa`
    )

    refreshProduction()
  }

  async function deleteTask(task) {
    if (!confirm(`Excluir "${task.title}"?`)) return

    const { error } = await db.from('tasks').delete().eq('id', task.id)

    if (error) setMsg(error.message)
    else loadAll()
  }

  function sectorById(id) {
    return sectors.find(s => s.id === id)?.name || 'Sem setor'
  }

  function memberById(id) {
    return members.find(m => m.id === id)
  }

  function priorityName(p) {
    if (p === 'high') return 'Alta'
    if (p === 'low') return 'Baixa'
    return 'Normal'
  }

  function isLate(task) {
    if (
      task.status === 'completed' ||
      !task.deadline_time ||
      task.schedule_date !== localDate()
    ) return false

    const now = new Date()
    const [h, m] = task.deadline_time.split(':')
    const deadline = new Date()
    deadline.setHours(Number(h), Number(m), 0, 0)

    return now > deadline
  }

  function printEmployeeDay(member) {
    const list = tasks.filter(t =>
      t.schedule_date === viewDate &&
      membersForTask(t.id).some(m => m.id === member.id)
    )

    if (!list.length) {
      alert(`${member.name} não possui tarefas nesta data.`)
      return
    }

    const rows = list.map((t, i) => `
      <div style="padding:14px 0;border-bottom:1px solid #aaa">
        <b>☐ ${i + 1}. ${safe(t.title)}</b><br>
        Setor: ${safe(sectorById(t.sector_id))}<br>
        Meta: ${safe(String(t.quantity_target || t.goal || '—'))}<br>
        Prioridade: ${priorityName(t.priority)}
        ${t.notes ? `<br>Observação: ${safe(t.notes)}` : ''}
        <br><br>Produzido: __________
      </div>
    `).join('')

    printPage(`
      <h1>MG Oper</h1>
      <h3>${safe(company.name)}</h3>
      <hr>
      <h2>PROGRAMAÇÃO DO DIA</h2>
      <p><b>Funcionário:</b> ${safe(member.name)}</p>
      <p><b>Data:</b> ${formatDate(viewDate)}</p>
      ${rows}
    `)
  }

  function printPage(html) {
    const w = window.open('', '_blank')
    if (!w) return alert('Permita pop-ups para imprimir.')

    w.document.write(`
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          @page { size:A4; margin:12mm; }
          body { font-family:Arial; color:#111; }
        </style>
      </head>
      <body>
        ${html}
        <script>
          window.onload=()=>setTimeout(()=>window.print(),300)
        </script>
      </body>
      </html>
    `)
    w.document.close()
  }

  const activeMembers = members.filter(m => m.active !== false)

  const dateTasks = tasks.filter(t => t.schedule_date === viewDate)

  const filteredTasks = dateTasks.filter(t => {
    if (
      filterMember &&
      !membersForTask(t.id).some(m => m.id === filterMember)
    ) return false

    if (filterSector && t.sector_id !== filterSector) return false

    return true
  })

  const producingSessions = sessions.filter(s => !s.ended_at)
  const producingMemberIds = [...new Set(producingSessions.map(s => s.member_id))]
  const producingNow = producingMemberIds.length

  const dayTarget = dateTasks.reduce(
    (sum, t) => sum + Number(t.quantity_target || t.goal || 0),
    0
  )

  const dayDone = dateTasks.reduce(
    (sum, t) => sum + Number(t.quantity_done || 0),
    0
  )

  const dayPercent = dayTarget
    ? Math.min(100, Math.round(dayDone / dayTarget * 100))
    : 0

  const lateCount = dateTasks.filter(isLate).length

  const performance = useMemo(() => {
    return activeMembers.map(member => {
      const quantity = logs
        .filter(l =>
          l.member_id === member.id &&
          tasks.find(t =>
            t.id === l.task_id &&
            t.schedule_date === viewDate
          )
        )
        .reduce((sum, l) => sum + Number(l.quantity || 0), 0)

      return { member, quantity }
    }).sort((a, b) => b.quantity - a.quantity)
  }, [logs, tasks, members, viewDate])

  if (loading) {
    return <main className="center"><div className="login">Carregando...</div></main>
  }

  if (!session) {
    return (
      <main className="center">
        <section className="login">
          <div className="brand">MG <b>Oper</b></div>
          <h1>Gestão operacional em tempo real.</h1>

          <input
            placeholder="E-mail"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />

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

          <input
            placeholder="Nome da empresa"
            value={companyName}
            onChange={e => setCompanyName(e.target.value)}
          />

          <button onClick={createCompany}>Começar</button>
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
          <button onClick={() => setTab('agora')}>🟢 Produzindo Agora</button>
          <button onClick={() => setTab('desempenho')}>Desempenho</button>
          <button onClick={() => setTab('historico')}>Histórico</button>
          <button onClick={() => setTab('tv')}>📺 TV</button>
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
            <p className="eyebrow">CENTRAL DE PRODUÇÃO</p>
            <h1>Produção de {formatDate(viewDate)}</h1>

            <input
              type="date"
              value={viewDate}
              onChange={e => setViewDate(e.target.value)}
            />

            <div className="stats">
              <Card n={producingNow} t="Produzindo agora" />
              <Card n={`${dayDone}/${dayTarget}`} t="Realizado / Meta" />
              <Card n={`${dayPercent}%`} t="Meta concluída" />
              <Card n={lateCount} t="Precisam de atenção" />
            </div>

            <section className="panel">
              <h2>Progresso geral do dia</h2>
              <Progress percent={dayPercent} />
              <p>{dayDone} produzidos de {dayTarget} planejados.</p>
            </section>

            <section className="panel" style={{ marginTop:20 }}>
              <h2>Programação do dia</h2>

              {dateTasks.length === 0 && <p>Nenhuma tarefa.</p>}

              {dateTasks.map(task => (
                <ProductionTask
                  key={task.id}
                  task={task}
                  people={membersForTask(task.id)}
                  sector={sectorById(task.sector_id)}
                  sessions={activeSessionsForTask(task.id)}
                  late={isLate(task)}
                  tick={tick}
                  priorityName={priorityName}
                  onStart={startTask}
                  onProgress={addProgress}
                  onQuantity={setQuantity}
                  onComplete={completeTask}
                  onAddPerson={transferMember}
                  onRemovePerson={removeMemberFromTask}
                  onDelete={deleteTask}
                />
              ))}
            </section>
          </>
        )}

        {tab === 'programacao' && (
          <>
            <p className="eyebrow">PLANEJAMENTO</p>
            <h1>Nova programação</h1>

            <div className="two">
              <section className="panel">
                <label>Data</label>
                <input
                  type="date"
                  value={taskDate}
                  onChange={e => setTaskDate(e.target.value)}
                />

                <input
                  placeholder="Nome da tarefa"
                  value={taskTitle}
                  onChange={e => setTaskTitle(e.target.value)}
                />

                <select
                  value={taskSector}
                  onChange={e => setTaskSector(e.target.value)}
                >
                  <option value="">Setor</option>
                  {sectors.map(s =>
                    <option key={s.id} value={s.id}>{s.name}</option>
                  )}
                </select>

                <input
                  inputMode="numeric"
                  placeholder="Meta / quantidade"
                  value={taskGoal}
                  onChange={e => setTaskGoal(e.target.value)}
                />

                <label>Prazo / horário desejado</label>
                <input
                  type="time"
                  value={taskDeadline}
                  onChange={e => setTaskDeadline(e.target.value)}
                />

                <select
                  value={taskPriority}
                  onChange={e => setTaskPriority(e.target.value)}
                >
                  <option value="low">Prioridade baixa</option>
                  <option value="normal">Prioridade normal</option>
                  <option value="high">Prioridade alta</option>
                </select>

                <textarea
                  placeholder="Observações da tarefa..."
                  value={taskNotes}
                  onChange={e => setTaskNotes(e.target.value)}
                  style={{
                    width:'100%',
                    minHeight:90,
                    padding:12,
                    marginBottom:12,
                    borderRadius:8
                  }}
                />

                <h3>Funcionários</h3>

                <div style={{
                  display:'grid',
                  gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',
                  gap:8,
                  marginBottom:16
                }}>
                  {activeMembers.map(m => (
                    <label
                      key={m.id}
                      style={{
                        padding:10,
                        border:'1px solid #333',
                        borderRadius:8,
                        cursor:'pointer'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedMembers.includes(m.id)}
                        onChange={() => toggleSelectedMember(m.id)}
                      />{' '}
                      {m.name}
                    </label>
                  ))}
                </div>

                <button onClick={addTask}>Criar programação</button>
              </section>

              <section className="panel">
                <h2>Consultar</h2>

                <input
                  type="date"
                  value={viewDate}
                  onChange={e => setViewDate(e.target.value)}
                />

                <select
                  value={filterMember}
                  onChange={e => setFilterMember(e.target.value)}
                >
                  <option value="">Todos os funcionários</option>
                  {members.map(m =>
                    <option key={m.id} value={m.id}>{m.name}</option>
                  )}
                </select>

                <select
                  value={filterSector}
                  onChange={e => setFilterSector(e.target.value)}
                >
                  <option value="">Todos os setores</option>
                  {sectors.map(s =>
                    <option key={s.id} value={s.id}>{s.name}</option>
                  )}
                </select>

                {filterMember && (
                  <button
                    onClick={() => {
                      const m = memberById(filterMember)
                      if (m) printEmployeeDay(m)
                    }}
                  >
                    🖨 Imprimir programação do funcionário
                  </button>
                )}

                <h3 style={{marginTop:20}}>
                  {filteredTasks.length} tarefa(s) encontrada(s)
                </h3>
              </section>
            </div>

            <section className="panel" style={{marginTop:20}}>
              {filteredTasks.map(task => (
                <ProductionTask
                  key={task.id}
                  task={task}
                  people={membersForTask(task.id)}
                  sector={sectorById(task.sector_id)}
                  sessions={activeSessionsForTask(task.id)}
                  late={isLate(task)}
                  tick={tick}
                  priorityName={priorityName}
                  onStart={startTask}
                  onProgress={addProgress}
                  onQuantity={setQuantity}
                  onComplete={completeTask}
                  onAddPerson={transferMember}
                  onRemovePerson={removeMemberFromTask}
                  onDelete={deleteTask}
                />
              ))}
            </section>
          </>
        )}

        {tab === 'agora' && (
          <>
            <p className="eyebrow">TEMPO REAL</p>
            <h1>🟢 Produzindo agora: {producingNow}</h1>

            {producingSessions.length === 0 && (
              <section className="panel">
                <p>Ninguém está produzindo neste momento.</p>
              </section>
            )}

            {tasks
              .filter(t => activeSessionsForTask(t.id).length > 0)
              .map(task => (
                <ProductionTask
                  key={task.id}
                  task={task}
                  people={membersForTask(task.id)}
                  sector={sectorById(task.sector_id)}
                  sessions={activeSessionsForTask(task.id)}
                  late={isLate(task)}
                  tick={tick}
                  priorityName={priorityName}
                  onStart={startTask}
                  onProgress={addProgress}
                  onQuantity={setQuantity}
                  onComplete={completeTask}
                  onAddPerson={transferMember}
                  onRemovePerson={removeMemberFromTask}
                  onDelete={deleteTask}
                />
              ))}
          </>
        )}

        {tab === 'desempenho' && (
          <>
            <p className="eyebrow">INDICADORES</p>
            <h1>Desempenho da equipe</h1>

            <input
              type="date"
              value={viewDate}
              onChange={e => setViewDate(e.target.value)}
            />

            <section className="panel" style={{marginTop:20}}>
              {performance.map((x, i) => (
                <div className="row" key={x.member.id}>
                  <div>
                    <b>{i + 1}. {x.member.name}</b>
                    <br />
                    <small>{sectorById(x.member.sector_id)}</small>
                  </div>

                  <strong style={{fontSize:22}}>
                    {x.quantity}
                  </strong>
                </div>
              ))}
            </section>
          </>
        )}

        {tab === 'historico' && (
          <>
            <p className="eyebrow">HISTÓRICO</p>
            <h1>Produção por data</h1>

            <input
              type="date"
              value={viewDate}
              onChange={e => setViewDate(e.target.value)}
            />

            <section className="panel" style={{marginTop:20}}>
              {dateTasks.length === 0 && <p>Nenhum registro.</p>}

              {dateTasks.map(t => (
                <div className="row" key={t.id}>
                  <div>
                    <b>{t.title}</b>
                    <br />
                    <small>
                      {membersForTask(t.id).map(m => m.name).join(', ') ||
                        t.assignee ||
                        'Sem responsável'}
                    </small>
                  </div>

                  <strong>
                    {t.quantity_done || 0} / {t.quantity_target || t.goal || '—'}
                  </strong>
                </div>
              ))}
            </section>
          </>
        )}

        {tab === 'tv' && (
          <div style={{fontSize:'1.2em'}}>
            <p className="eyebrow">PAINEL OPERACIONAL</p>
            <h1>📺 MG Oper — Produção Agora</h1>

            <div className="stats">
              <Card n={producingNow} t="Pessoas produzindo" />
              <Card n={`${dayPercent}%`} t="Meta do dia" />
              <Card n={lateCount} t="Atenção" />
            </div>

            {tasks
              .filter(t => activeSessionsForTask(t.id).length > 0)
              .map(task => (
                <TVTask
                  key={task.id}
                  task={task}
                  people={membersForTask(task.id)}
                  sessions={activeSessionsForTask(task.id)}
                  tick={tick}
                />
              ))}
          </div>
        )}

        {tab === 'equipe' && (
          <>
            <p className="eyebrow">EQUIPE</p>
            <h1>Funcionários</h1>

            <div className="two">
              <section className="panel">
                <input
                  placeholder="Nome"
                  value={memberName}
                  onChange={e => setMemberName(e.target.value)}
                />

                <select
                  value={memberSector}
                  onChange={e => setMemberSector(e.target.value)}
                >
                  <option value="">Sem setor</option>
                  {sectors.map(s =>
                    <option key={s.id} value={s.id}>{s.name}</option>
                  )}
                </select>

                <button onClick={addMember}>Adicionar funcionário</button>
              </section>

              <section className="panel">
                {members.map(m => (
                  <div className="row" key={m.id}>
                    <div>
                      <b>{m.name}</b>
                      <br />
                      <small>
                        {sectorById(m.sector_id)} ·{' '}
                        {m.active === false ? 'Inativo' : 'Ativo'}
                      </small>
                    </div>

                    <button
                      className="secondary"
                      onClick={() => toggleMember(m)}
                    >
                      {m.active === false ? 'Reativar' : 'Desativar'}
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
                <input
                  placeholder="Novo setor"
                  value={sectorName}
                  onChange={e => setSectorName(e.target.value)}
                />
                <button onClick={addSector}>Criar setor</button>
              </section>

              <section className="panel">
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

function ProductionTask({
  task,
  people,
  sector,
  sessions,
  late,
  tick,
  priorityName,
  onStart,
  onProgress,
  onQuantity,
  onComplete,
  onAddPerson,
  onRemovePerson,
  onDelete
}) {
  const done = Number(task.quantity_done || 0)
  const target = Number(task.quantity_target || task.goal || 0)
  const percent = target
    ? Math.min(100, Math.round(done / target * 100))
    : 0

  const working = sessions.length > 0

  return (
    <div className="task" style={{alignItems:'stretch', marginBottom:12}}>
      <div style={{flex:1}}>
        <div style={{
          display:'flex',
          gap:8,
          flexWrap:'wrap',
          alignItems:'center'
        }}>
          <b style={{fontSize:19}}>{task.title}</b>

          {working && <span>🟢 {sessions.length} produzindo</span>}
          {late && <span>🚨 ATRASADA</span>}
        </div>

        <p>
          👥 {people.map(p => p.name).join(', ') || task.assignee || '—'}
          {' · '}
          {sector}
        </p>

        {task.notes && <p>📝 {task.notes}</p>}

        {task.deadline_time && (
          <small>⏰ Prazo: {task.deadline_time.slice(0,5)} · </small>
        )}

        <small>
          Prioridade: {priorityName(task.priority)}
        </small>

        {working && (
          <p>
            ⏱️ Em produção:{' '}
            <b>{formatDuration(
              Math.min(...sessions.map(s =>
                new Date(s.started_at).getTime()
              ))
            )}</b>
          </p>
        )}

        {target > 0 && (
          <>
            <div style={{
              display:'flex',
              justifyContent:'space-between'
            }}>
              <b>{done} / {target}</b>
              <b>{percent}%</b>
            </div>
            <Progress percent={percent} />
          </>
        )}
      </div>

      <div style={{
        display:'flex',
        flexWrap:'wrap',
        gap:7,
        alignItems:'center',
        justifyContent:'flex-end'
      }}>
        {task.status !== 'completed' && !working && (
          <button onClick={() => onStart(task)}>▶ Iniciar</button>
        )}

        {task.status !== 'completed' && (
          <>
            <button
              className="secondary"
              onClick={() => onProgress(task, -5)}
            >
              −5
            </button>

            <button onClick={() => onProgress(task, 5)}>+5</button>

            <button
              className="secondary"
              onClick={() => onQuantity(task)}
            >
              ✎ Quantidade
            </button>

            <button onClick={() => onComplete(task)}>
              ✓ Concluir
            </button>

            <button
              className="secondary"
              onClick={() => onAddPerson(task)}
            >
              + Pessoa
            </button>

            <button
              className="secondary"
              onClick={() => onRemovePerson(task)}
            >
              − Pessoa
            </button>
          </>
        )}

        <button
          className="secondary"
          onClick={() => onDelete(task)}
        >
          🗑
        </button>
      </div>
    </div>
  )
}

function TVTask({ task, people, sessions }) {
  const done = Number(task.quantity_done || 0)
  const target = Number(task.quantity_target || task.goal || 0)
  const percent = target
    ? Math.min(100, Math.round(done / target * 100))
    : 0

  return (
    <section className="panel" style={{marginTop:18, padding:25}}>
      <h2 style={{fontSize:28, marginBottom:5}}>
        🟢 {task.title}
      </h2>

      <p style={{fontSize:20}}>
        👥 {people.map(p => p.name).join(', ')}
      </p>

      <h2>{done} / {target || '—'} — {percent}%</h2>
      <Progress percent={percent} />

      {sessions.length > 0 && (
        <p>
          ⏱️ {formatDuration(
            Math.min(...sessions.map(s =>
              new Date(s.started_at).getTime()
            ))
          )}
        </p>
      )}
    </section>
  )
}

function Progress({ percent }) {
  return (
    <div style={{
      height:16,
      width:'100%',
      background:'#252c32',
      borderRadius:999,
      overflow:'hidden',
      margin:'8px 0'
    }}>
      <div style={{
        width:`${percent}%`,
        height:'100%',
        background:'linear-gradient(90deg,#4ade80,#22c55e)',
        transition:'width .3s ease'
      }} />
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
  const [y,m,d] = value.slice(0,10).split('-')
  return `${d}/${m}/${y}`
}

function formatDuration(startMs) {
  if (!startMs || Number.isNaN(startMs)) return '00:00:00'

  const total = Math.max(
    0,
    Math.floor((Date.now() - startMs) / 1000)
  )

  const h = String(Math.floor(total / 3600)).padStart(2,'0')
  const m = String(Math.floor((total % 3600) / 60)).padStart(2,'0')
  const s = String(total % 60).padStart(2,'0')

  return `${h}:${m}:${s}`
}

function safe(value) {
  return String(value ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#039;')
}
