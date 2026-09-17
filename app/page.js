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
  const [mobileMenu, setMobileMenu] = useState(false)
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

  const [editModal, setEditModal] = useState(null)
  const [editForm, setEditForm] = useState({})

  function closeEditModal() {
    setEditModal(null)
    setEditForm({})
  }

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
      loadAll()
    } else {
      setCompany(null)
      setMembers([])
      setTasks([])
      setSectors([])
      setTaskMembers([])
      setLogs([])
      setSessions([])
    }
  }, [session])

  useEffect(() => {
    const timer = setInterval(() => {
      setTick(x => x + 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!company) return

    const timer = setInterval(() => {
      refreshProduction()
    }, 5000)

    return () => clearInterval(timer)
  }, [company])

  async function loadAll() {
    setLoading(true)
    setMsg('')

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

    const [memberResult, sectorResult, taskResult] = await Promise.all([
      db
        .from('company_members')
        .select('*')
        .eq('company_id', c.id)
        .order('name'),

      db
        .from('sectors')
        .select('*')
        .eq('company_id', c.id)
        .order('name'),

      db
        .from('tasks')
        .select('*')
        .eq('company_id', c.id)
        .order('created_at', { ascending: false })
    ])

    if (memberResult.error) setMsg(memberResult.error.message)
    if (sectorResult.error) setMsg(sectorResult.error.message)
    if (taskResult.error) setMsg(taskResult.error.message)

    setMembers(memberResult.data || [])
    setSectors(sectorResult.data || [])
    setTasks(taskResult.data || [])

    await loadProductionData(c.id)

    setLoading(false)
  }

  async function loadProductionData(companyId) {
    const [tmResult, logResult, sessionResult] = await Promise.all([
      db.from('task_members').select('*'),

      db
        .from('production_logs')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false }),

      db
        .from('production_sessions')
        .select('*')
        .eq('company_id', companyId)
        .order('started_at', { ascending: false })
    ])

    if (tmResult.error) setMsg(tmResult.error.message)
    if (logResult.error) setMsg(logResult.error.message)
    if (sessionResult.error) setMsg(sessionResult.error.message)

    setTaskMembers(tmResult.data || [])
    setLogs(logResult.data || [])
    setSessions(sessionResult.data || [])
  }

  async function refreshProduction() {
    if (!company) return

    const [taskResult, tmResult, logResult, sessionResult] =
      await Promise.all([
        db
          .from('tasks')
          .select('*')
          .eq('company_id', company.id)
          .order('created_at', { ascending: false }),

        db.from('task_members').select('*'),

        db
          .from('production_logs')
          .select('*')
          .eq('company_id', company.id)
          .order('created_at', { ascending: false }),

        db
          .from('production_sessions')
          .select('*')
          .eq('company_id', company.id)
          .order('started_at', { ascending: false })
      ])

    if (!taskResult.error) setTasks(taskResult.data || [])
    if (!tmResult.error) setTaskMembers(tmResult.data || [])
    if (!logResult.error) setLogs(logResult.data || [])
    if (!sessionResult.error) setSessions(sessionResult.data || [])
  }

  async function login() {
    setMsg('')

    const { error } = await db.auth.signInWithPassword({
      email,
      password
    })

    if (error) setMsg(error.message)
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
        : 'Conta criada. Agora entre na sua conta.'
    )
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
      await loadAll()
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
    await loadAll()
  }

  async function addMember() {
    if (!memberName.trim() || !company) return

    const payload = {
      company_id: company.id,
      name: memberName.trim(),
      active: true
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
    await loadAll()
  }

  function editSector(sector) {
    setEditForm({ name: sector.name || '' })
    setEditModal({ type: 'sector', item: sector })
  }

  async function saveSectorEdit() {
    const sector = editModal?.item
    if (!sector || !String(editForm.name || '').trim()) return
    const { error } = await db.from('sectors').update({ name: String(editForm.name).trim() }).eq('id', sector.id)
    if (error) setMsg(error.message)
    else { closeEditModal(); await loadAll() }
  }

  async function deleteSector(sector) {
    const usedByMembers = members.some(m => m.sector_id === sector.id)
    const usedByTasks = tasks.some(t => t.sector_id === sector.id)

    if (usedByMembers || usedByTasks) {
      alert('Este setor está sendo usado por funcionários ou tarefas. Realoque esses itens antes de excluir o setor.')
      return
    }

    if (!window.confirm(`Excluir o setor "${sector.name}"?`)) return

    const { error } = await db
      .from('sectors')
      .delete()
      .eq('id', sector.id)

    if (error) setMsg(error.message)
    else await loadAll()
  }

  function editMember(member) {
    setEditForm({ name: member.name || '', sector_id: member.sector_id || '' })
    setEditModal({ type: 'member', item: member })
  }

  async function saveMemberEdit() {
    const member = editModal?.item
    if (!member || !String(editForm.name || '').trim()) return
    const { error } = await db.from('company_members').update({
      name: String(editForm.name).trim(), sector_id: editForm.sector_id || null
    }).eq('id', member.id)
    if (error) setMsg(error.message)
    else { closeEditModal(); await loadAll() }
  }

  async function deleteMember(member) {
    const hasHistory =
      taskMembers.some(x => x.member_id === member.id) ||
      logs.some(x => x.member_id === member.id) ||
      sessions.some(x => x.member_id === member.id)

    if (hasHistory) {
      alert('Este funcionário possui histórico de produção. Para não perder o histórico, use Desativar em vez de Excluir.')
      return
    }

    if (!window.confirm(`Excluir definitivamente ${member.name}?`)) return

    const { error } = await db
      .from('company_members')
      .delete()
      .eq('id', member.id)

    if (error) setMsg(error.message)
    else await loadAll()
  }

  async function clearTestData() {
    const ok = window.confirm(
      'ATENÇÃO: isso vai apagar todas as tarefas/programações, histórico de produção e funcionários desta empresa. Os setores serão mantidos. Deseja continuar?'
    )
    if (!ok) return

    const typed = window.prompt('Para confirmar a limpeza, digite LIMPAR')
    if (typed !== 'LIMPAR') {
      alert('Limpeza cancelada.')
      return
    }

    setMsg('Limpando dados de teste...')

    try {
      const taskIds = tasks.map(t => t.id).filter(Boolean)

      // Tabelas de histórico que possuem company_id
      for (const table of ['production_logs', 'production_sessions', 'task_events']) {
        const { error } = await db.from(table).delete().eq('company_id', company.id)
        if (error) throw error
      }

      // Vínculos entre tarefas e funcionários não possuem company_id
      if (taskIds.length) {
        const { error } = await db.from('task_members').delete().in('task_id', taskIds)
        if (error) throw error
      }

      // Apaga as programações/tarefas e depois os funcionários
      {
        const { error } = await db.from('tasks').delete().eq('company_id', company.id)
        if (error) throw error
      }

      {
        const { error } = await db.from('company_members').delete().eq('company_id', company.id)
        if (error) throw error
      }

      setMsg('')
      alert('Dados de teste apagados. Os setores foram mantidos.')
      await loadAll()
    } catch (error) {
      setMsg(error?.message || 'Não foi possível limpar os dados.')
    }
  }

  async function clearSectors() {
    const ok = window.confirm(
      'Isso vai apagar TODOS os setores desta empresa. Faça isso somente depois de limpar tarefas e funcionários. Continuar?'
    )
    if (!ok) return

    const typed = window.prompt('Para confirmar, digite SETORES')
    if (typed !== 'SETORES') {
      alert('Exclusão dos setores cancelada.')
      return
    }

    const { error } = await db.from('sectors').delete().eq('company_id', company.id)
    if (error) setMsg(error.message)
    else {
      setMsg('')
      alert('Todos os setores foram apagados.')
      await loadAll()
    }
  }

  async function toggleMember(member) {
    const activate = member.active === false

    const ok = window.confirm(
      activate
        ? `Reativar ${member.name}?`
        : `Desativar ${member.name}? O histórico será preservado.`
    )

    if (!ok) return

    const { error } = await db
      .from('company_members')
      .update({ active: activate })
      .eq('id', member.id)

    if (error) {
      setMsg(error.message)
    } else {
      await loadAll()
    }
  }

  function toggleSelectedMember(id) {
    setSelectedMembers(current =>
      current.includes(id)
        ? current.filter(x => x !== id)
        : [...current, id]
    )
  }

  async function addTask() {
    setMsg('')

    if (!taskTitle.trim()) {
      alert('Digite o nome do produto/tarefa.')
      return
    }

    if (!selectedMembers.length) {
      alert('Selecione pelo menos um funcionário.')
      return
    }

    const selected = members.filter(m =>
      selectedMembers.includes(m.id)
    )

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

    if (taskSector) {
      payload.sector_id = taskSector
    }

    if (taskGoal) {
      payload.quantity_target = Number(taskGoal)
      payload.goal = taskGoal
    }

    if (taskDeadline) {
      payload.deadline_time = taskDeadline
    }

    if (selected[0]) {
      payload.member_id = selected[0].id
    }

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

    await addEvent(
      created.id,
      null,
      'task_created',
      'Tarefa criada'
    )

    setTaskTitle('')
    setTaskGoal('')
    setTaskSector('')
    setTaskNotes('')
    setTaskDeadline('')
    setTaskPriority('normal')
    setSelectedMembers([])
    setViewDate(taskDate)

    await loadAll()
  }

  async function addEvent(
    taskId,
    memberId,
    type,
    description
  ) {
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
      .filter(
        x =>
          x.task_id === taskId &&
          x.active !== false
      )
      .map(x => x.member_id)

    return members.filter(m =>
      ids.includes(m.id)
    )
  }

  function activeSessionsForTask(taskId) {
    return sessions.filter(
      s =>
        s.task_id === taskId &&
        !s.ended_at
    )
  }

  function memberIsWorking(taskId, memberId) {
    return sessions.some(
      s =>
        s.task_id === taskId &&
        s.member_id === memberId &&
        !s.ended_at
    )
  }

  function memberQuantity(taskId, memberId) {
    return logs
      .filter(
        l =>
          l.task_id === taskId &&
          l.member_id === memberId
      )
      .reduce(
        (sum, l) =>
          sum + Number(l.quantity || 0),
        0
      )
  }

  async function startTask(task) {
    const assigned = membersForTask(task.id)

    if (!assigned.length) {
      alert(
        'Essa tarefa não possui funcionários vinculados.'
      )
      return
    }

    const existing = activeSessionsForTask(task.id)
    const existingIds = existing.map(
      x => x.member_id
    )

    const newSessions = assigned
      .filter(
        m => !existingIds.includes(m.id)
      )
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

    const now = new Date().toISOString()

    const { error } = await db
      .from('tasks')
      .update({
        status: 'in_progress',
        started_at:
          task.started_at || now,
        production_started_at:
          task.production_started_at || now
      })
      .eq('id', task.id)

    if (error) {
      setMsg(error.message)
      return
    }

    await addEvent(
      task.id,
      null,
      'production_started',
      `${assigned.length} funcionário(s) iniciaram a produção`
    )

    await refreshProduction()
  }

  async function changeMemberProgress(
    task,
    member,
    amount
  ) {
    setMsg('')

    const currentTotal =
      Number(task.quantity_done || 0)

    const target =
      Number(
        task.quantity_target ||
        task.goal ||
        0
      )

    const currentMember =
      memberQuantity(task.id, member.id)

    let realAmount = amount

    if (
      amount < 0 &&
      currentMember <= 0
    ) {
      return
    }

    if (
      amount < 0 &&
      currentMember + amount < 0
    ) {
      realAmount = -currentMember
    }

    if (
      amount > 0 &&
      target > 0 &&
      currentTotal >= target
    ) {
      return
    }

    if (
      amount > 0 &&
      target > 0 &&
      currentTotal + amount > target
    ) {
      realAmount =
        target - currentTotal
    }

    if (realAmount === 0) return

    const nextTotal =
      Math.max(
        0,
        currentTotal + realAmount
      )

    const now =
      new Date().toISOString()

    const update = {
      quantity_done: nextTotal,
      completed_at: null
    }

    if (nextTotal === 0) {
      update.status = 'pending'
    } else if (
      target > 0 &&
      nextTotal >= target
    ) {
      update.status = 'completed'
      update.completed_at = now
      update.production_finished_at = now
    } else {
      update.status = 'in_progress'
      update.started_at =
        task.started_at || now
      update.production_started_at =
        task.production_started_at || now
    }

    const { error: taskError } = await db
      .from('tasks')
      .update(update)
      .eq('id', task.id)

    if (taskError) {
      setMsg(taskError.message)
      return
    }

    const { error: logError } = await db
      .from('production_logs')
      .insert({
        company_id: company.id,
        task_id: task.id,
        member_id: member.id,
        quantity: realAmount,
        action_type:
          realAmount > 0
            ? 'progress'
            : 'correction'
      })

    if (logError) {
      setMsg(logError.message)
      return
    }

    if (
      realAmount > 0 &&
      !memberIsWorking(
        task.id,
        member.id
      )
    ) {
      await db
        .from('production_sessions')
        .insert({
          company_id: company.id,
          task_id: task.id,
          member_id: member.id
        })
    }

    if (
      target > 0 &&
      nextTotal >= target
    ) {
      await finishSessions(task.id)

      await addEvent(
        task.id,
        member.id,
        'task_completed',
        `Meta concluída. Último registro por ${member.name}.`
      )
    }

    await refreshProduction()
  }

  async function setMemberQuantity(
    task,
    member
  ) {
    const current =
      memberQuantity(
        task.id,
        member.id
      )

    const answer =
      window.prompt(
        `Quanto ${member.name} produziu nesta tarefa?`,
        String(current)
      )

    if (answer === null) return

    const value =
      Number(
        String(answer).replace(',', '.')
      )

    if (
      Number.isNaN(value) ||
      value < 0
    ) {
      alert(
        'Digite uma quantidade válida.'
      )
      return
    }

    const difference =
      value - current

    if (difference === 0) return

    const taskCurrent =
      Number(task.quantity_done || 0)

    const target =
      Number(
        task.quantity_target ||
        task.goal ||
        0
      )

    let realDifference =
      difference

    if (
      difference > 0 &&
      target > 0 &&
      taskCurrent + difference > target
    ) {
      realDifference =
        target - taskCurrent
    }

    const nextTotal =
      Math.max(
        0,
        taskCurrent + realDifference
      )

    const now =
      new Date().toISOString()

    const completed =
      target > 0 &&
      nextTotal >= target

    const { error: taskError } =
      await db
        .from('tasks')
        .update({
          quantity_done: nextTotal,
          status: completed
            ? 'completed'
            : nextTotal > 0
            ? 'in_progress'
            : 'pending',
          started_at:
            nextTotal > 0
              ? task.started_at || now
              : task.started_at,
          production_started_at:
            nextTotal > 0
              ? task.production_started_at || now
              : task.production_started_at,
          completed_at:
            completed ? now : null,
          production_finished_at:
            completed ? now : null
        })
        .eq('id', task.id)

    if (taskError) {
      setMsg(taskError.message)
      return
    }

    const { error: logError } =
      await db
        .from('production_logs')
        .insert({
          company_id: company.id,
          task_id: task.id,
          member_id: member.id,
          quantity: realDifference,
          action_type: 'manual'
        })

    if (logError) {
      setMsg(logError.message)
      return
    }

    if (
      realDifference > 0 &&
      !memberIsWorking(
        task.id,
        member.id
      )
    ) {
      await db
        .from('production_sessions')
        .insert({
          company_id: company.id,
          task_id: task.id,
          member_id: member.id
        })
    }

    if (completed) {
      await finishSessions(task.id)
    }

    await refreshProduction()
  }

  async function completeTask(task) {
    const target =
      Number(
        task.quantity_target ||
        task.goal ||
        0
      )

    const current =
      Number(task.quantity_done || 0)

    if (
      target > 0 &&
      current < target
    ) {
      const ok =
        window.confirm(
          `A tarefa está em ${current}/${target}. Deseja concluir mesmo assim?`
        )

      if (!ok) return
    }

    const now =
      new Date().toISOString()

    const { error } = await db
      .from('tasks')
      .update({
        status: 'completed',
        completed_at: now,
        production_finished_at: now
      })
      .eq('id', task.id)

    if (error) {
      setMsg(error.message)
      return
    }

    await finishSessions(task.id)

    await addEvent(
      task.id,
      null,
      'task_completed',
      'Tarefa concluída'
    )

    await refreshProduction()
  }

  async function finishSessions(taskId) {
    const active =
      sessions.filter(
        s =>
          s.task_id === taskId &&
          !s.ended_at
      )

    if (!active.length) return

    const now =
      new Date().toISOString()

    for (const s of active) {
      await db
        .from('production_sessions')
        .update({
          ended_at: now
        })
        .eq('id', s.id)
    }
  }

  async function addPerson(task) {
    const current =
      membersForTask(task.id)

    const available =
      members.filter(
        m =>
          m.active !== false &&
          !current.some(
            c => c.id === m.id
          )
      )

    if (!available.length) {
      alert(
        'Todos os funcionários ativos já estão nesta tarefa.'
      )
      return
    }

    const list =
      available
        .map(
          (m, i) =>
            `${i + 1} - ${m.name}`
        )
        .join('\n')

    const answer =
      window.prompt(
        `Quem deseja adicionar?\n\n${list}`
      )

    if (answer === null) return

    const member =
      available[
        Number(answer) - 1
      ]

    if (!member) {
      alert('Funcionário inválido.')
      return
    }

    const existing =
      taskMembers.find(
        x =>
          x.task_id === task.id &&
          x.member_id === member.id
      )

    if (existing) {
      const { error } = await db
        .from('task_members')
        .update({
          active: true,
          left_at: null,
          joined_at:
            new Date().toISOString()
        })
        .eq('id', existing.id)

      if (error) {
        setMsg(error.message)
        return
      }
    } else {
      const { error } = await db
        .from('task_members')
        .insert({
          task_id: task.id,
          member_id: member.id,
          active: true
        })

      if (error) {
        setMsg(error.message)
        return
      }
    }

    if (
      task.status === 'in_progress'
    ) {
      await db
        .from('production_sessions')
        .insert({
          company_id: company.id,
          task_id: task.id,
          member_id: member.id
        })
    }

    await addEvent(
      task.id,
      member.id,
      'member_added',
      `${member.name} entrou na tarefa`
    )

    await refreshProduction()
  }

  async function removePerson(task) {
    const current =
      membersForTask(task.id)

    if (current.length <= 1) {
      alert(
        'A tarefa precisa manter pelo menos um funcionário.'
      )
      return
    }

    const list =
      current
        .map(
          (m, i) =>
            `${i + 1} - ${m.name}`
        )
        .join('\n')

    const answer =
      window.prompt(
        `Quem deseja retirar desta tarefa?\n\n${list}`
      )

    if (answer === null) return

    const member =
      current[
        Number(answer) - 1
      ]

    if (!member) {
      alert('Funcionário inválido.')
      return
    }

    const link =
      taskMembers.find(
        x =>
          x.task_id === task.id &&
          x.member_id === member.id
      )

    if (link) {
      const { error } = await db
        .from('task_members')
        .update({
          active: false,
          left_at:
            new Date().toISOString()
        })
        .eq('id', link.id)

      if (error) {
        setMsg(error.message)
        return
      }
    }

    const activeSession =
      sessions.find(
        s =>
          s.task_id === task.id &&
          s.member_id === member.id &&
          !s.ended_at
      )

    if (activeSession) {
      await db
        .from('production_sessions')
        .update({
          ended_at:
            new Date().toISOString()
        })
        .eq(
          'id',
          activeSession.id
        )
    }

    await addEvent(
      task.id,
      member.id,
      'member_removed',
      `${member.name} saiu da tarefa`
    )

    await refreshProduction()
  }

  function editTask(task) {
    setEditForm({
      title: task.title || '', quantity: String(task.quantity_target || task.goal || ''),
      schedule_date: task.schedule_date || localDate(),
      deadline_time: task.deadline_time ? task.deadline_time.slice(0, 5) : '',
      notes: task.notes || '', priority: task.priority || 'normal', sector_id: task.sector_id || ''
    })
    setEditModal({ type: 'task', item: task })
  }

  async function saveTaskEdit() {
    const task = editModal?.item
    if (!task || !String(editForm.title || '').trim()) return
    const raw = String(editForm.quantity ?? '').trim()
    const q = raw === '' ? null : Number(raw.replace(',', '.'))
    if (q !== null && (!Number.isFinite(q) || q < 0)) { setMsg('Quantidade inválida.'); return }
    const { error } = await db.from('tasks').update({
      title: String(editForm.title).trim(), quantity_target: q, goal: q === null ? null : String(q),
      schedule_date: editForm.schedule_date || localDate(), deadline_time: editForm.deadline_time || null,
      notes: String(editForm.notes || '').trim() || null, priority: editForm.priority || 'normal',
      sector_id: editForm.sector_id || null
    }).eq('id', task.id)
    if (error) { setMsg(error.message); return }
    await addEvent(task.id, null, 'task_edited', 'Tarefa editada')
    closeEditModal(); await loadAll()
  }

  async function deleteTask(task) {
    const ok =
      window.confirm(
        `Excluir "${task.title}"?`
      )

    if (!ok) return

    const { error } = await db
      .from('tasks')
      .delete()
      .eq('id', task.id)

    if (error) {
      setMsg(error.message)
    } else {
      await loadAll()
    }
  }

  function sectorById(id) {
    return (
      sectors.find(
        s => s.id === id
      )?.name ||
      'Sem setor'
    )
  }

  function memberById(id) {
    return members.find(
      m => m.id === id
    )
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
    ) {
      return false
    }

    const now = new Date()

    const [h, m] =
      task.deadline_time
        .split(':')

    const deadline =
      new Date()

    deadline.setHours(
      Number(h),
      Number(m),
      0,
      0
    )

    return now > deadline
  }

  function printEmployeeDay(member) {
    const list =
      tasks.filter(
        t =>
          t.schedule_date ===
            viewDate &&
          membersForTask(
            t.id
          ).some(
            m => m.id === member.id
          )
      )

    if (!list.length) {
      alert(
        `${member.name} não possui tarefas nesta data.`
      )
      return
    }

    const totalProgramado =
      list.reduce(
        (sum, t) =>
          sum +
          Number(
            t.quantity_target ||
            t.goal ||
            0
          ),
        0
      )

    const rows =
      list.map(
        (t, i) => `
        <div style="
          padding:16px 0;
          border-bottom:1px solid #999;
          page-break-inside:avoid;
        ">
          <div style="
            font-size:19px;
          ">
            <b>
              ${i + 1}. ${safe(t.title)}
            </b>
          </div>

          <div style="
            font-size:24px;
            font-weight:bold;
            margin-top:8px;
          ">
            QUANTIDADE:
            ${safe(
              String(
                t.quantity_target ||
                t.goal ||
                '—'
              )
            )}
          </div>

          <div style="
            margin-top:7px;
          ">
            Setor:
            ${safe(
              sectorById(
                t.sector_id
              )
            )}
          </div>

          ${
            t.deadline_time
              ? `
              <div>
                Horário:
                ${safe(
                  t.deadline_time
                    .slice(0, 5)
                )}
              </div>
            `
              : ''
          }

          ${
            t.notes
              ? `
              <div>
                Observação:
                ${safe(t.notes)}
              </div>
            `
              : ''
          }

          <div style="
            margin-top:14px;
            font-size:16px;
          ">
            ☐ Concluído
          </div>
        </div>
      `
      )
      .join('')

    printPage(`
      <div style="
        text-align:center;
      ">
        <h1 style="
          margin-bottom:4px;
        ">
          MG Oper
        </h1>

        <h3 style="
          margin-top:0;
        ">
          ${safe(company.name)}
        </h3>
      </div>

      <hr>

      <h2 style="
        text-align:center;
      ">
        PROGRAMAÇÃO DO DIA
      </h2>

      <div style="
        font-size:18px;
        margin-bottom:15px;
      ">
        <b>Funcionário:</b>
        ${safe(member.name)}
        <br>

        <b>Data:</b>
        ${formatDate(viewDate)}
      </div>

      ${rows}

      <div style="
        margin-top:20px;
        padding:15px;
        border:2px solid #111;
        font-size:21px;
      ">
        <b>
          TOTAL PROGRAMADO:
          ${totalProgramado}
        </b>
      </div>
    `)
  }

  function printPage(html) {
    const w =
      window.open(
        '',
        '_blank'
      )

    if (!w) {
      alert(
        'Permita pop-ups para imprimir.'
      )
      return
    }

    w.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8">

          <title>
            MG Oper - Programação
          </title>

          <style>
            @page {
              size: A4;
              margin: 12mm;
            }

            body {
              font-family:
                Arial,
                Helvetica,
                sans-serif;
              color: #111;
              line-height: 1.4;
            }
          </style>
        </head>

        <body>
          ${html}

          <script>
            window.onload = () => {
              setTimeout(
                () => window.print(),
                300
              )
            }
          </script>
        </body>
      </html>
    `)

    w.document.close()
  }

  const activeMembers =
    members.filter(
      m => m.active !== false
    )

  const dateTasks =
    tasks.filter(
      t =>
        t.schedule_date ===
        viewDate
    )

  const filteredTasks =
    dateTasks.filter(t => {
      if (
        filterMember &&
        !membersForTask(
          t.id
        ).some(
          m =>
            m.id ===
            filterMember
        )
      ) {
        return false
      }

      if (
        filterSector &&
        t.sector_id !==
          filterSector
      ) {
        return false
      }

      return true
    })

  const producingSessions =
    sessions.filter(
      s => !s.ended_at
    )

  const producingMemberIds =
    [
      ...new Set(
        producingSessions.map(
          s => s.member_id
        )
      )
    ]

  const producingNow =
    producingMemberIds.length

  const dayTarget =
    dateTasks.reduce(
      (sum, t) =>
        sum +
        Number(
          t.quantity_target ||
          t.goal ||
          0
        ),
      0
    )

  const dayDone =
    dateTasks.reduce(
      (sum, t) =>
        sum +
        Number(
          t.quantity_done ||
          0
        ),
      0
    )

  const dayPercent =
    dayTarget
      ? Math.min(
          100,
          Math.round(
            (dayDone /
              dayTarget) *
              100
          )
        )
      : 0

  const lateCount =
    dateTasks.filter(
      isLate
    ).length

  const performance =
    useMemo(() => {
      return members
        .filter(
          member =>
            member.active !== false
        )
        .map(member => {
          const quantity =
            logs
              .filter(l => {
                if (
                  l.member_id !==
                  member.id
                ) {
                  return false
                }

                const task =
                  tasks.find(
                    t =>
                      t.id ===
                      l.task_id
                  )

                return (
                  task?.schedule_date ===
                  viewDate
                )
              })
              .reduce(
                (sum, l) =>
                  sum +
                  Number(
                    l.quantity ||
                    0
                  ),
                0
              )

          return {
            member,
            quantity
          }
        })
        .sort(
          (a, b) =>
            b.quantity -
            a.quantity
        )
    }, [
      logs,
      tasks,
      members,
      viewDate
    ])

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
            Gestão operacional
            em tempo real.
          </h1>

          <input
            placeholder="E-mail"
            value={email}
            onChange={
              e =>
                setEmail(
                  e.target.value
                )
            }
          />

          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={
              e =>
                setPassword(
                  e.target.value
                )
            }
          />

          <div className="actions">
            <button
              onClick={login}
            >
              Entrar
            </button>

            <button
              className="secondary"
              onClick={signup}
            >
              Criar conta
            </button>
          </div>

          {msg && (
            <small>{msg}</small>
          )}
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

          <input
            placeholder="Nome da empresa"
            value={companyName}
            onChange={
              e =>
                setCompanyName(
                  e.target.value
                )
            }
          />

          <button
            onClick={createCompany}
          >
            Começar
          </button>

          {msg && (
            <small>{msg}</small>
          )}
        </section>
      </main>
    )
  }

  const taskProps = task => ({
    task,
    people:
      membersForTask(task.id),
    sector:
      sectorById(
        task.sector_id
      ),
    sessions:
      activeSessionsForTask(
        task.id
      ),
    late: isLate(task),
    tick,
    priorityName,
    memberQuantity,
    memberIsWorking,
    onStart: startTask,
    onMemberProgress:
      changeMemberProgress,
    onMemberQuantity:
      setMemberQuantity,
    onComplete:
      completeTask,
    onAddPerson:
      addPerson,
    onRemovePerson:
      removePerson,
    onEdit:
      editTask,
    onDelete:
      deleteTask
  })

  return (
    <div>
      <header>
        <div className="brand">
          MG <b>Oper</b>
        </div>

        <button
          className="mobile-menu-button"
          onClick={() => setMobileMenu(!mobileMenu)}
          aria-label="Abrir menu"
        >
          ☰
        </button>

        <nav className={mobileMenu ? 'mobile-open' : ''}>
          <button
            onClick={() =>
              setTab('dashboard')
            }
          >
            Dashboard
          </button>

          <button
            onClick={() =>
              setTab('programacao')
            }
          >
            Programação
          </button>

          <button
            onClick={() =>
              setTab('agora')
            }
          >
            🟢 Produzindo Agora
          </button>

          <button
            onClick={() =>
              setTab('desempenho')
            }
          >
            Desempenho
          </button>

          <button
            onClick={() =>
              setTab('historico')
            }
          >
            Histórico
          </button>

          <button
            onClick={() =>
              setTab('tv')
            }
          >
            📺 TV
          </button>

          <button
            onClick={() =>
              setTab('equipe')
            }
          >
            Equipe
          </button>

          <button
            onClick={() =>
              setTab('setores')
            }
          >
            Setores
          </button>
        </nav>

        <div>
          <span>
            {company.name}
          </span>

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
              CENTRAL DE PRODUÇÃO
            </p>

            <h1>
              Produção de{' '}
              {formatDate(viewDate)}
            </h1>

            <input
              type="date"
              value={viewDate}
              onChange={
                e =>
                  setViewDate(
                    e.target.value
                  )
              }
            />

            <div className="stats">
              <Card
                n={producingNow}
                t="Produzindo agora"
              />

              <Card
                n={`${dayDone}/${dayTarget}`}
                t="Realizado / Meta"
              />

              <Card
                n={`${dayPercent}%`}
                t="Meta concluída"
              />

              <Card
                n={lateCount}
                t="Precisam de atenção"
              />
            </div>

            <section className="panel">
              <h2>
                Progresso geral do dia
              </h2>

              <Progress
                percent={dayPercent}
              />

              <p>
                {dayDone} produzidos
                de {dayTarget}{' '}
                planejados.
              </p>
            </section>

            <section
              className="panel"
              style={{
                marginTop: 20
              }}
            >
              <h2>
                Programação do dia
              </h2>

              {dateTasks.length ===
                0 && (
                <p>
                  Nenhuma tarefa.
                </p>
              )}

              {dateTasks.map(
                task => (
                  <ProductionTask
                    key={task.id}
                    {...taskProps(task)}
                  />
                )
              )}
            </section>
          </>
        )}

        {tab ===
          'programacao' && (
          <>
            <p className="eyebrow">
              PLANEJAMENTO
            </p>

            <h1>
              Nova programação
            </h1>

            <div className="two">
              <section className="panel">
                <label>Data</label>

                <input
                  type="date"
                  value={taskDate}
                  onChange={
                    e =>
                      setTaskDate(
                        e.target.value
                      )
                  }
                />

                <input
                  placeholder="Produto / tarefa"
                  value={taskTitle}
                  onChange={
                    e =>
                      setTaskTitle(
                        e.target.value
                      )
                  }
                />

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

                  {sectors.map(
                    s => (
                      <option
                        key={s.id}
                        value={s.id}
                      >
                        {s.name}
                      </option>
                    )
                  )}
                </select>

                <input
                  inputMode="numeric"
                  placeholder="Quantidade que deve fazer"
                  value={taskGoal}
                  onChange={
                    e =>
                      setTaskGoal(
                        e.target.value
                      )
                  }
                />

                <label>
                  Horário desejado
                </label>

                <input
                  type="time"
                  value={
                    taskDeadline
                  }
                  onChange={
                    e =>
                      setTaskDeadline(
                        e.target.value
                      )
                  }
                />

                <select
                  value={
                    taskPriority
                  }
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

                <textarea
                  placeholder="Observações..."
                  value={taskNotes}
                  onChange={
                    e =>
                      setTaskNotes(
                        e.target.value
                      )
                  }
                  style={{
                    width: '100%',
                    minHeight: 90,
                    padding: 12,
                    marginBottom: 12,
                    borderRadius: 8
                  }}
                />

                <h3>
                  Funcionário(s)
                </h3>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fit,minmax(150px,1fr))',
                    gap: 8,
                    marginBottom: 16
                  }}
                >
                  {activeMembers.map(
                    m => (
                      <label
                        key={m.id}
                        style={{
                          padding: 10,
                          border:
                            '1px solid #333',
                          borderRadius: 8,
                          cursor:
                            'pointer'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={
                            selectedMembers.includes(
                              m.id
                            )
                          }
                          onChange={() =>
                            toggleSelectedMember(
                              m.id
                            )
                          }
                        />{' '}
                        {m.name}
                      </label>
                    )
                  )}
                </div>

                <button
                  onClick={addTask}
                >
                  Criar programação
                </button>
              </section>

              <section className="panel">
                <h2>
                  Consultar programação
                </h2>

                <input
                  type="date"
                  value={viewDate}
                  onChange={
                    e =>
                      setViewDate(
                        e.target.value
                      )
                  }
                />

                <select
                  value={
                    filterMember
                  }
                  onChange={
                    e =>
                      setFilterMember(
                        e.target.value
                      )
                  }
                >
                  <option value="">
                    Todos os funcionários
                  </option>

                  {members.map(
                    m => (
                      <option
                        key={m.id}
                        value={m.id}
                      >
                        {m.name}
                      </option>
                    )
                  )}
                </select>

                <select
                  value={
                    filterSector
                  }
                  onChange={
                    e =>
                      setFilterSector(
                        e.target.value
                      )
                  }
                >
                  <option value="">
                    Todos os setores
                  </option>

                  {sectors.map(
                    s => (
                      <option
                        key={s.id}
                        value={s.id}
                      >
                        {s.name}
                      </option>
                    )
                  )}
                </select>

                {filterMember && (
                  <button
                    onClick={() => {
                      const m =
                        memberById(
                          filterMember
                        )

                      if (m) {
                        printEmployeeDay(
                          m
                        )
                      }
                    }}
                  >
                    🖨 Imprimir programação do funcionário
                  </button>
                )}

                <h3
                  style={{
                    marginTop: 20
                  }}
                >
                  {
                    filteredTasks.length
                  }{' '}
                  tarefa(s)
                  encontrada(s)
                </h3>
              </section>
            </div>

            <section
              className="panel"
              style={{
                marginTop: 20
              }}
            >
              {filteredTasks.length ===
                0 && (
                <p>
                  Nenhuma tarefa.
                </p>
              )}

              {filteredTasks.map(
                task => (
                  <ProductionTask
                    key={task.id}
                    {...taskProps(task)}
                  />
                )
              )}
            </section>
          </>
        )}

        {tab === 'agora' && (
          <>
            <p className="eyebrow">
              TEMPO REAL
            </p>

            <h1>
              🟢 Produzindo agora:{' '}
              {producingNow}
            </h1>

            {producingSessions.length ===
              0 && (
              <section className="panel">
                <p>
                  Ninguém está
                  produzindo neste
                  momento.
                </p>
              </section>
            )}

            {tasks
              .filter(
                t =>
                  activeSessionsForTask(
                    t.id
                  ).length > 0
              )
              .map(task => (
                <ProductionTask
                  key={task.id}
                  {...taskProps(task)}
                />
              ))}
          </>
        )}

        {tab ===
          'desempenho' && (
          <>
            <p className="eyebrow">
              INDICADORES
            </p>

            <h1>
              Desempenho da equipe
            </h1>

            <input
              type="date"
              value={viewDate}
              onChange={
                e =>
                  setViewDate(
                    e.target.value
                  )
              }
            />

            <section
              className="panel"
              style={{
                marginTop: 20
              }}
            >
              {performance.map(
                (x, i) => (
                  <div
                    className="row"
                    key={
                      x.member.id
                    }
                  >
                    <div>
                      <b>
                        {i + 1}.{' '}
                        {
                          x.member
                            .name
                        }
                      </b>

                      <br />

                      <small>
                        {sectorById(
                          x.member
                            .sector_id
                        )}
                      </small>
                    </div>

                    <strong
                      style={{
                        fontSize: 22
                      }}
                    >
                      {x.quantity}{' '}
                      produzidos
                    </strong>
                  </div>
                )
              )}
            </section>
          </>
        )}

        {tab ===
          'historico' && (
          <>
            <p className="eyebrow">
              HISTÓRICO
            </p>

            <h1>
              Produção por data
            </h1>

            <input
              type="date"
              value={viewDate}
              onChange={
                e =>
                  setViewDate(
                    e.target.value
                  )
              }
            />

            <section
              className="panel"
              style={{
                marginTop: 20
              }}
            >
              {dateTasks.length ===
                0 && (
                <p>
                  Nenhum registro.
                </p>
              )}

              {dateTasks.map(
                t => (
                  <div
                    className="row"
                    key={t.id}
                  >
                    <div>
                      <b>
                        {t.title}
                      </b>

                      <br />

                      <small>
                        {membersForTask(
                          t.id
                        )
                          .map(
                            m =>
                              m.name
                          )
                          .join(
                            ', '
                          ) ||
                          t.assignee ||
                          'Sem responsável'}
                      </small>
                    </div>

                    <strong>
                      {t.quantity_done ||
                        0}{' '}
                      /{' '}
                      {t.quantity_target ||
                        t.goal ||
                        '—'}
                    </strong>
                  </div>
                )
              )}
            </section>
          </>
        )}

        {tab === 'tv' && (
          <div
            style={{
              fontSize: '1.2em'
            }}
          >
            <p className="eyebrow">
              PAINEL OPERACIONAL
            </p>

            <h1>
              📺 MG Oper —
              Produção Agora
            </h1>

            <div className="stats">
              <Card
                n={producingNow}
                t="Pessoas produzindo"
              />

              <Card
                n={`${dayPercent}%`}
                t="Meta do dia"
              />

              <Card
                n={lateCount}
                t="Atenção"
              />
            </div>

            {tasks
              .filter(
                t =>
                  activeSessionsForTask(
                    t.id
                  ).length > 0
              )
              .map(task => (
                <TVTask
                  key={task.id}
                  task={task}
                  people={
                    membersForTask(
                      task.id
                    )
                  }
                  memberQuantity={
                    memberQuantity
                  }
                  sessions={
                    activeSessionsForTask(
                      task.id
                    )
                  }
                  tick={tick}
                />
              ))}
          </div>
        )}

        {tab === 'equipe' && (
          <>
            <p className="eyebrow">
              EQUIPE
            </p>

            <h1>
              Funcionários
            </h1>

            <div className="two">
              <section className="panel">
                <input
                  placeholder="Nome"
                  value={
                    memberName
                  }
                  onChange={
                    e =>
                      setMemberName(
                        e.target.value
                      )
                  }
                />

                <select
                  value={
                    memberSector
                  }
                  onChange={
                    e =>
                      setMemberSector(
                        e.target.value
                      )
                  }
                >
                  <option value="">
                    Sem setor
                  </option>

                  {sectors.map(
                    s => (
                      <option
                        key={s.id}
                        value={s.id}
                      >
                        {s.name}
                      </option>
                    )
                  )}
                </select>

                <button
                  onClick={
                    addMember
                  }
                >
                  Adicionar
                  funcionário
                </button>
              </section>

              <section className="panel">
                <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
                  <b>Limpeza de dados de teste</b>
                  <p style={{ margin: '6px 0 12px' }}>
                    Apaga programações, histórico de produção e funcionários para você começar do zero. Os setores são mantidos.
                  </p>
                  <button className="secondary" onClick={clearTestData}>
                    🧹 Limpar dados de teste
                  </button>
                </div>

                {members.map(
                  m => (
                    <div
                      className="row"
                      key={m.id}
                    >
                      <div>
                        <b>
                          {m.name}
                        </b>

                        <br />

                        <small>
                          {sectorById(
                            m.sector_id
                          )}{' '}
                          ·{' '}
                          {m.active ===
                          false
                            ? 'Inativo'
                            : 'Ativo'}
                        </small>
                      </div>

                      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                        <button
                          className="secondary"
                          onClick={() => editMember(m)}
                        >
                          ✏️ Editar
                        </button>

                        <button
                          className="secondary"
                          onClick={() => toggleMember(m)}
                        >
                          {m.active === false ? 'Reativar' : 'Desativar'}
                        </button>

                        <button
                          className="secondary"
                          onClick={() => deleteMember(m)}
                        >
                          🗑 Excluir
                        </button>
                      </div>
                    </div>
                  )
                )}
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
              Setores
            </h1>

            <div className="two">
              <section className="panel">
                <input
                  placeholder="Novo setor"
                  value={
                    sectorName
                  }
                  onChange={
                    e =>
                      setSectorName(
                        e.target.value
                      )
                  }
                />

                <button
                  onClick={
                    addSector
                  }
                >
                  Criar setor
                </button>
              </section>

              <section className="panel">
                <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
                  <b>Zerar setores</b>
                  <p style={{ margin: '6px 0 12px' }}>
                    Use somente se também quiser recriar todos os setores.
                  </p>
                  <button className="secondary" onClick={clearSectors}>
                    🧹 Excluir todos os setores
                  </button>
                </div>

                {sectors.map(
                  s => (
                    <div
                      className="row"
                      key={s.id}
                    >
                      <b>
                        {s.name}
                      </b>

                      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                        <button
                          className="secondary"
                          onClick={() => editSector(s)}
                        >
                          ✏️ Editar
                        </button>

                        <button
                          className="secondary"
                          onClick={() => deleteSector(s)}
                        >
                          🗑 Excluir
                        </button>
                      </div>
                    </div>
                  )
                )}
              </section>
            </div>
          </>
        )}

        {editModal && (
          <div onClick={closeEditModal} style={{
            position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.72)',
            display: 'grid', placeItems: 'center', padding: 16
          }}>
            <section className="panel" onClick={e => e.stopPropagation()} style={{
              width: 'min(560px, 100%)', maxHeight: '90vh', overflowY: 'auto'
            }}>
              <p className="eyebrow">EDIÇÃO</p>
              <h2>{editModal.type === 'task' ? 'Editar tarefa' : editModal.type === 'member' ? 'Editar funcionário' : 'Editar setor'}</h2>

              {editModal.type === 'sector' && <>
                <label>Nome do setor</label>
                <input autoFocus value={editForm.name || ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
              </>}

              {editModal.type === 'member' && <>
                <label>Nome do funcionário</label>
                <input autoFocus value={editForm.name || ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                <label>Setor</label>
                <select value={editForm.sector_id || ''} onChange={e => setEditForm(f => ({ ...f, sector_id: e.target.value }))}>
                  <option value="">Sem setor</option>
                  {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </>}

              {editModal.type === 'task' && <>
                <label>Produto / tarefa</label>
                <input autoFocus value={editForm.title || ''} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
                <label>Quantidade / meta</label>
                <input inputMode="decimal" value={editForm.quantity ?? ''} onChange={e => setEditForm(f => ({ ...f, quantity: e.target.value }))} />
                <label>Data</label>
                <input type="date" value={editForm.schedule_date || ''} onChange={e => setEditForm(f => ({ ...f, schedule_date: e.target.value }))} />
                <label>Horário desejado</label>
                <input type="time" value={editForm.deadline_time || ''} onChange={e => setEditForm(f => ({ ...f, deadline_time: e.target.value }))} />
                <label>Prioridade</label>
                <select value={editForm.priority || 'normal'} onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))}>
                  <option value="low">Baixa</option><option value="normal">Normal</option><option value="high">Alta</option>
                </select>
                <label>Setor</label>
                <select value={editForm.sector_id || ''} onChange={e => setEditForm(f => ({ ...f, sector_id: e.target.value }))}>
                  <option value="">Sem setor</option>{sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <label>Observação</label>
                <textarea rows={4} value={editForm.notes || ''} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
              </>}

              <div className="actions" style={{ marginTop: 18 }}>
                <button onClick={editModal.type === 'task' ? saveTaskEdit : editModal.type === 'member' ? saveMemberEdit : saveSectorEdit}>✓ Salvar alterações</button>
                <button className="secondary" onClick={closeEditModal}>Cancelar</button>
              </div>
            </section>
          </div>
        )}

        {msg && (
          <p
            className="message"
            style={{
              padding: 12,
              marginTop: 20,
              border:
                '1px solid #ef4444',
              borderRadius: 8
            }}
          >
            {msg}
          </p>
        )}
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
  memberQuantity,
  memberIsWorking,
  onStart,
  onMemberProgress,
  onMemberQuantity,
  onComplete,
  onAddPerson,
  onRemovePerson,
  onEdit,
  onDelete
}) {
  const done =
    Number(
      task.quantity_done ||
      0
    )

  const target =
    Number(
      task.quantity_target ||
      task.goal ||
      0
    )

  const percent =
    target
      ? Math.min(
          100,
          Math.round(
            (done / target) *
              100
          )
        )
      : 0

  const working =
    sessions.length > 0

  return (
    <div
      className="task"
      style={{
        alignItems:
          'stretch',
        marginBottom: 14,
        display: 'block'
      }}
    >
      <div>
        <div
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            alignItems:
              'center'
          }}
        >
          <b
            style={{
              fontSize: 20
            }}
          >
            {task.title}
          </b>

          {working && (
            <span>
              🟢{' '}
              {sessions.length}{' '}
              produzindo agora
            </span>
          )}

          {late && (
            <span>
              🚨 ATRASADA
            </span>
          )}
        </div>

        <p>
          🏭 {sector} ·
          Prioridade:{' '}
          {priorityName(
            task.priority
          )}
        </p>

        {task.notes && (
          <p>
            📝 {task.notes}
          </p>
        )}

        {task.deadline_time && (
          <p>
            ⏰ Prazo:{' '}
            {task.deadline_time.slice(
              0,
              5
            )}
          </p>
        )}

        <div
          style={{
            marginTop: 16,
            padding: 14,
            border:
              '1px solid #303842',
            borderRadius: 10
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent:
                'space-between',
              gap: 15,
              flexWrap: 'wrap'
            }}
          >
            <strong>
              TOTAL DA EQUIPE
            </strong>

            <strong>
              {done} /{' '}
              {target || '—'}{' '}
              {target
                ? `— ${percent}%`
                : ''}
            </strong>
          </div>

          {target > 0 && (
            <Progress
              percent={percent}
            />
          )}
        </div>

        <h3
          style={{
            marginTop: 20
          }}
        >
          👥 Produção
          individual
        </h3>

        {people.length ===
          0 && (
          <p>
            Nenhum funcionário
            vinculado.
          </p>
        )}

        <div
          style={{
            display: 'grid',
            gap: 10
          }}
        >
          {people.map(
            person => {
              const individual =
                memberQuantity(
                  task.id,
                  person.id
                )

              const isWorking =
                memberIsWorking(
                  task.id,
                  person.id
                )

              return (
                <div
                  key={
                    person.id
                  }
                  style={{
                    border:
                      '1px solid #303842',
                    borderRadius: 10,
                    padding: 14,
                    display: 'flex',
                    justifyContent:
                      'space-between',
                    alignItems:
                      'center',
                    gap: 12,
                    flexWrap:
                      'wrap'
                  }}
                >
                  <div>
                    <b
                      style={{
                        fontSize: 17
                      }}
                    >
                      {isWorking
                        ? '🟢'
                        : '⚪'}{' '}
                      {
                        person.name
                      }
                    </b>

                    <div
                      style={{
                        marginTop: 5
                      }}
                    >
                      Produziu:{' '}
                      <strong>
                        {
                          individual
                        }
                      </strong>
                    </div>
                  </div>

                  <div
                    style={{
                      display:
                        'flex',
                      gap: 7,
                      flexWrap:
                        'wrap'
                    }}
                  >
                    {task.status !==
                      'completed' && (
                      <>
                        <button
                          className="secondary"
                          onClick={() =>
                            onMemberProgress(
                              task,
                              person,
                              -5
                            )
                          }
                        >
                          −5
                        </button>

                        <button
                          onClick={() =>
                            onMemberProgress(
                              task,
                              person,
                              5
                            )
                          }
                        >
                          +5
                        </button>

                        <button
                          className="secondary"
                          onClick={() =>
                            onMemberQuantity(
                              task,
                              person
                            )
                          }
                        >
                          ✎ Qtd.
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            }
          )}
        </div>

        {working &&
          sessions.length >
            0 && (
          <p
            style={{
              marginTop: 15
            }}
          >
            ⏱️ Tempo da
            produção:{' '}
            <b>
              {formatDuration(
                Math.min(
                  ...sessions.map(
                    s =>
                      new Date(
                        s.started_at
                      ).getTime()
                  )
                )
              )}
            </b>
          </p>
        )}

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            marginTop: 18
          }}
        >
          {task.status !==
            'completed' &&
            !working && (
            <button
              onClick={() =>
                onStart(task)
              }
            >
              ▶ Iniciar todos
            </button>
          )}

          {task.status !==
            'completed' && (
            <>
              <button
                className="secondary"
                onClick={() =>
                  onAddPerson(
                    task
                  )
                }
              >
                + Pessoa
              </button>

              <button
                className="secondary"
                onClick={() =>
                  onRemovePerson(
                    task
                  )
                }
              >
                − Pessoa
              </button>

              <button
                onClick={() =>
                  onComplete(
                    task
                  )
                }
              >
                ✓ Concluir tarefa
              </button>
            </>
          )}

          <button
            className="secondary"
            onClick={() => onEdit(task)}
          >
            ✏️ Editar
          </button>

          <button
            className="secondary"
            onClick={() => onDelete(task)}
          >
            🗑 Excluir
          </button>
        </div>
      </div>
    </div>
  )
}

function TVTask({
  task,
  people,
  memberQuantity,
  sessions
}) {
  const done =
    Number(
      task.quantity_done ||
      0
    )

  const target =
    Number(
      task.quantity_target ||
      task.goal ||
      0
    )

  const percent =
    target
      ? Math.min(
          100,
          Math.round(
            (done / target) *
              100
          )
        )
      : 0

  return (
    <section
      className="panel"
      style={{
        marginTop: 18,
        padding: 25
      }}
    >
      <h2
        style={{
          fontSize: 28,
          marginBottom: 5
        }}
      >
        🟢 {task.title}
      </h2>

      <h2>
        TOTAL: {done} /{' '}
        {target || '—'} —{' '}
        {percent}%
      </h2>

      <Progress
        percent={percent}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit,minmax(180px,1fr))',
          gap: 10,
          marginTop: 18
        }}
      >
        {people.map(
          person => (
            <div
              key={person.id}
              style={{
                padding: 14,
                border:
                  '1px solid #333',
                borderRadius: 10
              }}
            >
              <b>
                👤 {person.name}
              </b>

              <div
                style={{
                  fontSize: 22,
                  marginTop: 5
                }}
              >
                {memberQuantity(
                  task.id,
                  person.id
                )}
              </div>
            </div>
          )
        )}
      </div>

      {sessions.length >
        0 && (
        <p>
          ⏱️{' '}
          {formatDuration(
            Math.min(
              ...sessions.map(
                s =>
                  new Date(
                    s.started_at
                  ).getTime()
              )
            )
          )}
        </p>
      )}
    </section>
  )
}

function Progress({
  percent
}) {
  return (
    <div
      style={{
        height: 16,
        width: '100%',
        background:
          '#252c32',
        borderRadius: 999,
        overflow: 'hidden',
        margin: '8px 0'
      }}
    >
      <div
        style={{
          width:
            `${percent}%`,
          height: '100%',
          background:
            'linear-gradient(90deg,#4ade80,#22c55e)',
          transition:
            'width .3s ease'
        }}
      />
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

  const [y, m, d] =
    value
      .slice(0, 10)
      .split('-')

  return `${d}/${m}/${y}`
}

function formatDuration(
  startMs
) {
  if (
    !startMs ||
    Number.isNaN(startMs)
  ) {
    return '00:00:00'
  }

  const total =
    Math.max(
      0,
      Math.floor(
        (Date.now() -
          startMs) /
          1000
      )
    )

  const h =
    String(
      Math.floor(
        total / 3600
      )
    ).padStart(2, '0')

  const m =
    String(
      Math.floor(
        (total % 3600) /
          60
      )
    ).padStart(2, '0')

  const s =
    String(
      total % 60
    ).padStart(2, '0')

  return `${h}:${m}:${s}`
}

function safe(value) {
  return String(
    value ?? ''
  )
    .replaceAll(
      '&',
      '&amp;'
    )
    .replaceAll(
      '<',
      '&lt;'
    )
    .replaceAll(
      '>',
      '&gt;'
    )
    .replaceAll(
      '"',
      '&quot;'
    )
    .replaceAll(
      "'",
      '&#039;'
    )
}
