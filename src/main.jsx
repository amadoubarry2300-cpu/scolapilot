import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createClient } from '@supabase/supabase-js'
import readXlsxFile from 'read-excel-file/browser'
import './styles.css'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || import.meta.env.supabaseurl
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.anonkey || import.meta.env.Apikey || import.meta.env['clé anonyme'] || import.meta.env['âne anonyme'] || import.meta.env['Clé API']
const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null

const levelGroups = [
  { label: 'Préscolaire', category: 'preschool', items: ['Petite section', 'Moyenne section', 'Grande section'] },
  { label: 'Primaire', category: 'primary', items: ['CP1', 'CP2', 'CE1', 'CE2', 'CM1', 'CM2'] },
  { label: 'Postprimaire', category: 'postprimary', items: ['6e', '5e', '4e', '3e'] },
  { label: 'Secondaire', category: 'secondary', items: ['2nde', '1ère', 'Tle'] },
]

const levelCategory = Object.fromEntries(levelGroups.flatMap(group => group.items.map(name => [name, group.category])))
const initials = (name = '') => name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'SP'
const money = amount => `${Number(amount || 0).toLocaleString('fr-FR').replace(/\u202f/g, ' ')} FCFA`
const normalizeHeader = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
function parseCsvText(text) {
  const rows = []
  let row = [], cell = '', quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i], next = text[i + 1]
    if (char === '"' && quoted && next === '"') { cell += '"'; i += 1 }
    else if (char === '"') quoted = !quoted
    else if ((char === ',' || char === ';' || char === '\\t') && !quoted) { row.push(cell.trim()); cell = '' }
    else if ((char === '\\n' || char === '\\r') && !quoted) { if (char === '\\r' && next === '\\n') i += 1; row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row = []; cell = '' }
    else cell += char
  }
  row.push(cell.trim()); if (row.some(Boolean)) rows.push(row)
  return rows
}

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState({ email: '', password: '', fullName: '' })
  const [authMessage, setAuthMessage] = useState('')
  const [workspaceLoading, setWorkspaceLoading] = useState(false)
  const [school, setSchool] = useState(null)
  const [levels, setLevels] = useState([])
  const [classes, setClasses] = useState([])
  const [enrollments, setEnrollments] = useState([])
  const [members, setMembers] = useState([])
  const [invitations, setInvitations] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [memberRole, setMemberRole] = useState('teacher')
  const [students, setStudents] = useState([])
  const [subjects, setSubjects] = useState([])
  const [assessments, setAssessments] = useState([])
  const [grades, setGrades] = useState([])
  const [guardians, setGuardians] = useState([])
  const [payments, setPayments] = useState([])
  const [fees, setFees] = useState([])
  const [attendanceRecords, setAttendanceRecords] = useState([])
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10))
  const [activeView, setActiveView] = useState('overview')
  const [toast, setToast] = useState('')
  const [onboarding, setOnboarding] = useState({ name: '', city: 'Ouagadougou', phone: '' })
  const [studentForm, setStudentForm] = useState({ firstName: '', lastName: '', studentNumber: '', classId: '' })
  const [classForm, setClassForm] = useState({ name: '', levelId: '' })
  const [subjectForm, setSubjectForm] = useState({ name: '', code: '', coefficient: '1', levelId: '' })
  const [assessmentForm, setAssessmentForm] = useState({ subjectId: '', classId: '', title: 'Évaluation 1', term: 'Trimestre 1', maxScore: '20', assessmentDate: new Date().toISOString().slice(0, 10) })
  const [selectedAssessmentId, setSelectedAssessmentId] = useState('')
  const [scoreDrafts, setScoreDrafts] = useState({})
  const [paymentForm, setPaymentForm] = useState({ studentId: '', amount: '', method: 'cash', receiptNumber: '', note: '' })
  const [feeForm, setFeeForm] = useState({ studentId: '', label: 'Scolarité — tranche 1', amount: '', dueDate: '', discount: '' })
  const [guardianForm, setGuardianForm] = useState({ fullName: '', phone: '', whatsapp: '', email: '', relationship: 'Parent', studentId: '' })
  const [teamForm, setTeamForm] = useState({ email: '', role: 'teacher' })
  const [inviteLink, setInviteLink] = useState('')
  const [pendingInviteToken] = useState(() => new URLSearchParams(window.location.search).get('invite') || '')
  const [importRows, setImportRows] = useState([])
  const [importFileName, setImportFileName] = useState('')
  const [importError, setImportError] = useState('')
  const [guardianImportRows, setGuardianImportRows] = useState([])
  const [guardianImportFileName, setGuardianImportFileName] = useState('')
  const [guardianImportError, setGuardianImportError] = useState('')
  const [importing, setImporting] = useState(false)
  const [studentSearch, setStudentSearch] = useState('')
  const [modal, setModal] = useState(null)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session?.user) loadWorkspace(session.user)
    else {
      setSchool(null)
      setLevels([])
      setClasses([])
      setEnrollments([])
      setMembers([])
      setInvitations([])
      setAuditLogs([])
      setMemberRole('teacher')
      setStudents([])
      setSubjects([])
      setAssessments([])
      setGrades([])
      setGuardians([])
      setPayments([])
      setFees([])
      setAttendanceRecords([])
    }
  }, [session])

  useEffect(() => {
    if (school && session?.user) loadSchoolData(school)
  }, [attendanceDate])

  useEffect(() => {
    if (session?.user && pendingInviteToken) acceptInvitation()
  }, [session])

  async function loadWorkspace(user) {
    setWorkspaceLoading(true)
    const { data: memberships, error: memberError } = await supabase
      .from('school_members')
      .select('school_id, role')
      .eq('user_id', user.id)
    if (memberError) {
      notify(memberError.message)
      setWorkspaceLoading(false)
      return
    }
    if (!memberships?.length) {
      setSchool(null)
      setWorkspaceLoading(false)
      return
    }
    const schoolIds = memberships.map(item => item.school_id)
    const { data: schools, error: schoolError } = await supabase.from('schools').select('*').in('id', schoolIds)
    if (schoolError) {
      notify(schoolError.message)
      setWorkspaceLoading(false)
      return
    }
    const active = schools?.[0]
    const activeMembership = memberships.find(item => item.school_id === active?.id)
    setMemberRole(activeMembership?.role || 'teacher')
    setSchool(active)
    await loadSchoolData(active, activeMembership?.role)
    setWorkspaceLoading(false)
  }

  async function loadSchoolData(activeSchool = school, roleOverride = memberRole) {
    if (!activeSchool) return
    const currentRole = roleOverride || memberRole || 'teacher'
    const canFinance = ['owner', 'director', 'accountant'].includes(currentRole)
    const canAcademic = ['owner', 'director', 'teacher'].includes(currentRole)
    const canTeam = ['owner', 'director'].includes(currentRole)
    const financePaymentsQuery = canFinance ? supabase.from('payments').select('*').eq('school_id', activeSchool.id).order('paid_at', { ascending: false }) : Promise.resolve({ data: [], error: null })
    const financeFeesQuery = canFinance ? supabase.from('fee_assignments').select('*').eq('school_id', activeSchool.id).order('due_date') : Promise.resolve({ data: [], error: null })
    const subjectsQuery = canAcademic ? supabase.from('subjects').select('*').eq('school_id', activeSchool.id).order('name') : Promise.resolve({ data: [], error: null })
    const assessmentsQuery = canAcademic ? supabase.from('assessments').select('*').eq('school_id', activeSchool.id).order('assessment_date', { ascending: false }) : Promise.resolve({ data: [], error: null })
    const gradesQuery = canAcademic ? supabase.from('grades').select('*').eq('school_id', activeSchool.id).order('updated_at', { ascending: false }) : Promise.resolve({ data: [], error: null })
    const invitationsQuery = canTeam ? supabase.from('school_invitations').select('id, email, role, token, expires_at, accepted_at, created_at').eq('school_id', activeSchool.id).order('created_at', { ascending: false }) : Promise.resolve({ data: [], error: null })
    const auditQuery = canTeam ? supabase.from('audit_logs').select('id, action, entity, metadata, created_at, user_id').eq('school_id', activeSchool.id).order('created_at', { ascending: false }).limit(50) : Promise.resolve({ data: [], error: null })
    const [{ data: nextLevels, error: levelError }, { data: nextClasses, error: classError }, { data: nextEnrollments, error: enrollmentError }, { data: nextStudents, error: studentError }, { data: nextSubjects, error: subjectError }, { data: nextAssessments, error: assessmentError }, { data: nextGrades, error: gradeError }, { data: nextGuardians, error: guardianError }, { data: nextPayments, error: paymentError }, { data: nextFees, error: feeError }, { data: nextAttendance, error: attendanceError }, { data: nextMembers, error: memberError }, { data: nextInvitations, error: invitationError }, { data: nextAuditLogs, error: auditError }] = await Promise.all([
      supabase.from('levels').select('*').eq('school_id', activeSchool.id).order('sort_order'),
      supabase.from('classes').select('id, name, section, level_id, academic_year_id').eq('school_id', activeSchool.id).order('name'),
      supabase.from('enrollments').select('id, student_id, class_id, academic_year_id, status').eq('school_id', activeSchool.id).eq('status', 'active'),
      supabase.from('students').select('*').eq('school_id', activeSchool.id).order('created_at', { ascending: false }),
      subjectsQuery,
      assessmentsQuery,
      gradesQuery,
      supabase.from('guardians').select('*').eq('school_id', activeSchool.id).order('created_at', { ascending: false }),
      financePaymentsQuery,
      financeFeesQuery,
      supabase.from('attendance_records').select('*').eq('school_id', activeSchool.id).eq('attendance_date', attendanceDate),
      supabase.from('school_members').select('id, user_id, role, created_at').eq('school_id', activeSchool.id).order('created_at'),
      invitationsQuery,
      auditQuery,
    ])
    if (levelError || classError || enrollmentError || studentError || guardianError || paymentError || feeError || attendanceError) {
      notify(levelError?.message || classError?.message || enrollmentError?.message || studentError?.message || guardianError?.message || paymentError?.message || feeError?.message || attendanceError?.message)
      return
    }
    setLevels(nextLevels || [])
    setClasses(nextClasses || [])
    setEnrollments(nextEnrollments || [])
    setStudents(nextStudents || [])
    setSubjects(nextSubjects || [])
    setAssessments(nextAssessments || [])
    setGrades(nextGrades || [])
    setGuardians(nextGuardians || [])
    setPayments(nextPayments || [])
    setFees(nextFees || [])
    setAttendanceRecords(nextAttendance || [])
    setMembers(nextMembers || [])
    setInvitations(nextInvitations || [])
    setAuditLogs(nextAuditLogs || [])
    setPaymentForm(form => ({ ...form, studentId: form.studentId || nextStudents?.[0]?.id || '', receiptNumber: form.receiptNumber || `SP-${String((nextPayments?.length || 0) + 1).padStart(4, '0')}` }))
    setFeeForm(form => ({ ...form, studentId: form.studentId || nextStudents?.[0]?.id || '' }))
    setStudentForm(form => ({ ...form, classId: form.classId || nextClasses?.[0]?.id || '' }))
    setClassForm(form => ({ ...form, levelId: form.levelId || nextLevels?.[0]?.id || '' }))
    setSelectedAssessmentId(current => current || nextAssessments?.[0]?.id || '')
    setAssessmentForm(form => ({ ...form, subjectId: form.subjectId || nextSubjects?.[0]?.id || '', classId: form.classId || nextClasses?.[0]?.id || '' }))
  }

  function notify(message) {
    setToast(message)
    window.clearTimeout(window.scolaTimer)
    window.scolaTimer = window.setTimeout(() => setToast(''), 3600)
  }

  async function writeAudit(action, entity, entityId = null, metadata = {}) {
    if (!school || !session?.user) return
    await supabase.from('audit_logs').insert({ school_id: school.id, user_id: session.user.id, action, entity, entity_id: entityId, metadata })
  }

  async function handleAuth(event) {
    event.preventDefault()
    setAuthMessage('')
    if (!supabase) return
    const email = authForm.email.trim()
    if (authMode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: authForm.password,
        options: { data: { full_name: authForm.fullName.trim() } },
      })
      if (error) return setAuthMessage(error.message)
      if (!data.session) return setAuthMessage('Compte créé. Vérifie ton adresse e-mail puis connecte-toi.')
      setAuthMessage('Compte créé avec succès.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password: authForm.password })
      if (error) setAuthMessage(error.message)
    }
  }

  async function createSchool(event) {
    event.preventDefault()
    if (!onboarding.name.trim()) return setAuthMessage('Le nom de l’école est obligatoire.')
    setWorkspaceLoading(true)
    const { error } = await supabase.rpc('create_school_with_defaults', {
      p_name: onboarding.name.trim(),
      p_city: onboarding.city.trim(),
      p_phone: onboarding.phone.trim(),
    })
    if (error) {
      setAuthMessage(error.message)
      setWorkspaceLoading(false)
      return
    }
    notify('École créée avec ses niveaux par défaut.')
    await loadWorkspace(session.user)
    setWorkspaceLoading(false)
  }

  async function addClass(event) {
    event.preventDefault()
    const level = levels.find(item => item.id === classForm.levelId)
    if (!level || !classForm.name.trim()) return notify('Choisis un niveau et un nom de classe.')
    const { data: years } = await supabase.from('academic_years').select('id').eq('school_id', school.id).eq('is_current', true).limit(1)
    const year = years?.[0]
    if (!year) return notify('Aucune année scolaire active.')
    const { error } = await supabase.from('classes').insert({ school_id: school.id, level_id: level.id, academic_year_id: year.id, name: classForm.name.trim() })
    if (error) return notify(error.message)
    await writeAudit('create', 'class', null, { name: classForm.name.trim(), level: level.name })
    setClassForm({ name: '', levelId: level.id })
    setModal(null)
    await loadSchoolData()
    notify('Classe ajoutée.')
  }

  async function addStudent(event) {
    event.preventDefault()
    if (!studentForm.firstName.trim() || !studentForm.lastName.trim() || !studentForm.studentNumber.trim()) return notify('Complète les informations obligatoires.')
    const { data: created, error } = await supabase.from('students').insert({
      school_id: school.id,
      student_number: studentForm.studentNumber.trim(),
      first_name: studentForm.firstName.trim(),
      last_name: studentForm.lastName.trim(),
    }).select().single()
    if (error) return notify(error.message)
    if (studentForm.classId) {
      const { data: years } = await supabase.from('academic_years').select('id').eq('school_id', school.id).eq('is_current', true).limit(1)
      if (years?.[0]) {
        const { error: enrollmentError } = await supabase.from('enrollments').insert({ school_id: school.id, student_id: created.id, class_id: studentForm.classId, academic_year_id: years[0].id })
        if (enrollmentError) notify(`Élève ajouté, mais classe non affectée : ${enrollmentError.message}`)
      }
    }
    await writeAudit('create', 'student', created.id, { student_number: created.student_number, name: `${created.first_name} ${created.last_name}` })
    setStudentForm({ firstName: '', lastName: '', studentNumber: '', classId: classes[0]?.id || '' })
    setModal(null)
    await loadSchoolData()
    notify('Élève ajouté avec succès.')
  }

  async function addPayment(event) {
    event.preventDefault()
    const amount = Number(paymentForm.amount)
    if (!paymentForm.studentId || !amount || amount <= 0) return notify('Choisis un élève et indique un montant valide.')
    const receiptNumber = paymentForm.receiptNumber.trim() || `SP-${Date.now().toString().slice(-6)}`
    const { error } = await supabase.from('payments').insert({
      school_id: school.id,
      student_id: paymentForm.studentId,
      receipt_number: receiptNumber,
      amount,
      method: paymentForm.method,
      note: paymentForm.note.trim() || null,
      created_by: session.user.id,
    })
    if (error) return notify(error.message)
    await writeAudit('create', 'payment', null, { receipt_number: receiptNumber, amount, method: paymentForm.method })
    setPaymentForm({ studentId: students[0]?.id || '', amount: '', method: 'cash', receiptNumber: `SP-${String(payments.length + 2).padStart(4, '0')}`, note: '' })
    setModal(null)
    await loadSchoolData()
    notify('Paiement enregistré avec succès.')
  }

  async function addFee(event) {
    event.preventDefault()
    const amount = Number(feeForm.amount)
    if (!feeForm.studentId || !feeForm.label.trim() || !amount || amount <= 0) return notify('Choisis un élève et indique un montant valide.')
    const { data: years } = await supabase.from('academic_years').select('id').eq('school_id', school.id).eq('is_current', true).limit(1)
    const year = years?.[0]
    if (!year) return notify('Aucune année scolaire active.')
    const { error } = await supabase.from('fee_assignments').insert({
      school_id: school.id,
      student_id: feeForm.studentId,
      academic_year_id: year.id,
      label: feeForm.label.trim(),
      amount,
      discount: Number(feeForm.discount || 0),
      due_date: feeForm.dueDate || null,
    })
    if (error) return notify(error.message)
    await writeAudit('create', 'fee_assignment', null, { student_id: feeForm.studentId, label: feeForm.label.trim(), amount })
    setFeeForm({ studentId: students[0]?.id || '', label: 'Scolarité — tranche 1', amount: '', dueDate: '', discount: '' })
    setModal(null)
    await loadSchoolData()
    notify('Frais scolaires assignés avec succès.')
  }

  function toggleAttendance(studentId) {
    setAttendanceRecords(current => {
      const existing = current.find(item => item.student_id === studentId)
      if (existing) return current.map(item => item.student_id === studentId ? { ...item, status: item.status === 'present' ? 'absent' : 'present' } : item)
      return [...current, { student_id: studentId, attendance_date: attendanceDate, status: 'absent' }]
    })
  }

  async function saveAttendance() {
    if (!students.length) return notify('Ajoute d’abord des élèves.')
    const rows = students.map(student => ({
      school_id: school.id,
      student_id: student.id,
      attendance_date: attendanceDate,
      status: attendanceRecords.find(item => item.student_id === student.id)?.status || 'present',
      recorded_by: session.user.id,
    }))
    const { error } = await supabase.from('attendance_records').upsert(rows, { onConflict: 'student_id,attendance_date' })
    if (error) return notify(error.message)
    await writeAudit('update', 'attendance', null, { date: attendanceDate, students: rows.length })
    await loadSchoolData()
    notify('Présences enregistrées.')
  }

  async function handleImportFile(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setImportFileName(file.name)
    setImportError('')
    try {
      const rawRows = file.name.toLowerCase().endsWith('.csv') ? parseCsvText(await file.text()) : await readXlsxFile(file)
      if (!rawRows?.length) return setImportError('Le fichier est vide.')
      const headers = rawRows[0].map(normalizeHeader)
      const findColumn = names => headers.findIndex(header => names.includes(header))
      const firstIndex = findColumn(['prenom', 'first_name', 'firstname', 'given_name'])
      const lastIndex = findColumn(['nom', 'last_name', 'lastname', 'family_name'])
      const numberIndex = findColumn(['matricule', 'student_number', 'numero', 'numero_eleve', 'id_eleve'])
      const classIndex = findColumn(['classe', 'class', 'class_name'])
      if (firstIndex < 0 || lastIndex < 0) return setImportError('Colonnes obligatoires introuvables. Utilise : prénom, nom, matricule, classe.')
      const usedNumbers = new Set(students.map(student => String(student.student_number || '').toLowerCase()))
      const seenNumbers = new Set()
      const nextRows = rawRows.slice(1).map((values, index) => {
        const firstName = String(values[firstIndex] ?? '').trim()
        const lastName = String(values[lastIndex] ?? '').trim()
        let studentNumber = numberIndex >= 0 ? String(values[numberIndex] ?? '').trim() : ''
        if (!studentNumber) studentNumber = `SP-${new Date().getFullYear()}-${String(students.length + index + 1).padStart(4, '0')}`
        const className = classIndex >= 0 ? String(values[classIndex] ?? '').trim() : ''
        const foundClass = classes.find(item => item.name.toLowerCase() === className.toLowerCase())
        let issue = ''
        if (!firstName || !lastName) issue = 'Prénom ou nom manquant'
        else if (usedNumbers.has(studentNumber.toLowerCase()) || seenNumbers.has(studentNumber.toLowerCase())) issue = 'Matricule déjà utilisé'
        seenNumbers.add(studentNumber.toLowerCase())
        return { firstName, lastName, studentNumber, className, classId: foundClass?.id || '', issue }
      }).filter(row => row.firstName || row.lastName || row.studentNumber)
      setImportRows(nextRows)
      if (!nextRows.length) setImportError('Aucune ligne exploitable dans ce fichier.')
    } catch (error) {
      setImportError(`Lecture impossible : ${error.message || 'format non reconnu'}`)
      setImportRows([])
    }
  }

  async function importStudents() {
    const validRows = importRows.filter(row => !row.issue)
    if (!validRows.length) return notify('Aucune ligne valide à importer.')
    setImporting(true)
    const { data: years } = await supabase.from('academic_years').select('id').eq('school_id', school.id).eq('is_current', true).limit(1)
    const year = years?.[0]
    const { data: created, error } = await supabase.from('students').insert(validRows.map(row => ({ school_id: school.id, student_number: row.studentNumber, first_name: row.firstName, last_name: row.lastName }))).select()
    if (error) { setImporting(false); return setImportError(error.message) }
    const classRows = created.map(student => { const source = validRows.find(row => row.studentNumber === student.student_number); return source?.classId && year ? { school_id: school.id, student_id: student.id, class_id: source.classId, academic_year_id: year.id } : null }).filter(Boolean)
    if (classRows.length) {
      const { error: enrollmentError } = await supabase.from('enrollments').insert(classRows)
      if (enrollmentError) { setImporting(false); return setImportError(`Élèves importés, mais affectation aux classes impossible : ${enrollmentError.message}`) }
    }
    setImporting(false)
    setModal(null)
    await loadSchoolData()
    notify(`${created.length} élève(s) importé(s) avec succès.`)
  }

  async function addSubject(event) {
    event.preventDefault()
    if (!subjectForm.name.trim()) return notify('Le nom de la matière est obligatoire.')
    const { error } = await supabase.from('subjects').insert({ school_id: school.id, name: subjectForm.name.trim(), code: subjectForm.code.trim() || null, coefficient: Number(subjectForm.coefficient || 1), level_id: subjectForm.levelId || null })
    if (error) return notify(error.message)
    setSubjectForm({ name: '', code: '', coefficient: '1', levelId: '' })
    setModal(null)
    await loadSchoolData()
    notify('Matière ajoutée.')
  }

  async function addAssessment(event) {
    event.preventDefault()
    if (!assessmentForm.subjectId || !assessmentForm.title.trim()) return notify('Choisis une matière et un titre d’évaluation.')
    const { error } = await supabase.from('assessments').insert({ school_id: school.id, subject_id: assessmentForm.subjectId, class_id: assessmentForm.classId || null, title: assessmentForm.title.trim(), term: assessmentForm.term, max_score: Number(assessmentForm.maxScore || 20), assessment_date: assessmentForm.assessmentDate || new Date().toISOString().slice(0, 10), created_by: session.user.id })
    if (error) return notify(error.message)
    setAssessmentForm({ subjectId: subjects[0]?.id || '', classId: classes[0]?.id || '', title: 'Évaluation 1', term: 'Trimestre 1', maxScore: '20', assessmentDate: new Date().toISOString().slice(0, 10) })
    setModal(null)
    await loadSchoolData()
    notify('Évaluation créée.')
  }

  async function saveGrades() {
    const assessment = assessments.find(item => item.id === selectedAssessmentId)
    if (!assessment) return notify('Choisis une évaluation.')
    const rows = students.filter(student => scoreDrafts[student.id] !== undefined && scoreDrafts[student.id] !== '').map(student => ({ school_id: school.id, assessment_id: assessment.id, student_id: student.id, score: Number(scoreDrafts[student.id]), created_by: session.user.id, updated_at: new Date().toISOString() }))
    if (!rows.length) return notify('Saisis au moins une note.')
    const invalid = rows.find(row => Number.isNaN(row.score) || row.score < 0 || row.score > Number(assessment.max_score))
    if (invalid) return notify(`Les notes doivent être comprises entre 0 et ${assessment.max_score}.`)
    const { error } = await supabase.from('grades').upsert(rows, { onConflict: 'assessment_id,student_id' })
    if (error) return notify(error.message)
    await writeAudit('update', 'grades', assessment.id, { assessment: assessment.title, count: rows.length })
    await loadSchoolData()
    notify('Notes enregistrées.')
  }

  async function createInvitation(event) {
    event.preventDefault()
    const email = teamForm.email.trim().toLowerCase()
    if (!email || !email.includes('@')) return notify('Saisis une adresse e-mail valide.')
    const { data: invitation, error } = await supabase.from('school_invitations').insert({ school_id: school.id, email, role: teamForm.role, invited_by: session.user.id }).select().single()
    if (error) return notify(error.message)
    const link = `${window.location.origin}/app?invite=${invitation.token}`
    await writeAudit('invite', 'school_member', invitation.id, { email, role: teamForm.role })
    setInviteLink(link)
    setTeamForm({ email: '', role: 'teacher' })
    await loadSchoolData()
    notify('Invitation créée. Partage le lien à ton collaborateur.')
  }

  async function acceptInvitation() {
    if (!pendingInviteToken || !session?.user) return
    const { error } = await supabase.rpc('accept_school_invitation', { p_token: pendingInviteToken })
    if (!error) {
      window.history.replaceState({}, '', '/app')
      await loadWorkspace(session.user)
      await writeAudit('accept', 'school_member', null, { invitation: pendingInviteToken })
      notify('Invitation acceptée. Bienvenue dans l’équipe.')
    }
  }

  async function handleGuardianImportFile(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setGuardianImportFileName(file.name)
    setGuardianImportError('')
    try {
      const rawRows = file.name.toLowerCase().endsWith('.csv') ? parseCsvText(await file.text()) : await readXlsxFile(file)
      if (!rawRows?.length) return setGuardianImportError('Le fichier est vide.')
      const headers = rawRows[0].map(normalizeHeader)
      const findColumn = names => headers.findIndex(header => names.includes(header))
      const fullNameIndex = findColumn(['nom_complet', 'full_name', 'parent', 'tuteur', 'nom_parent', 'nom_tuteur'])
      const firstIndex = findColumn(['prenom', 'first_name'])
      const lastIndex = findColumn(['nom', 'last_name'])
      const phoneIndex = findColumn(['telephone', 'phone', 'tel', 'mobile'])
      const whatsappIndex = findColumn(['whatsapp', 'whatsapp_number'])
      const emailIndex = findColumn(['email', 'e_mail', 'courriel'])
      const relationIndex = findColumn(['lien', 'relation', 'relationship', 'type'])
      const studentNumberIndex = findColumn(['matricule', 'student_number', 'numero_eleve', 'id_eleve'])
      const studentNameIndex = findColumn(['eleve', 'student', 'nom_eleve', 'enfant'])
      if ((fullNameIndex < 0 && (firstIndex < 0 || lastIndex < 0)) || phoneIndex < 0) return setGuardianImportError('Colonnes obligatoires introuvables. Utilise : nom complet, téléphone, matricule ou élève.')
      const usedPhones = new Set(guardians.map(item => String(item.phone || '').replace(/\\s/g, '').toLowerCase()))
      const seenPhones = new Set()
      const nextRows = rawRows.slice(1).map(values => {
        const fullName = fullNameIndex >= 0 ? String(values[fullNameIndex] ?? '').trim() : `${String(values[firstIndex] ?? '').trim()} ${String(values[lastIndex] ?? '').trim()}`.trim()
        const phone = String(values[phoneIndex] ?? '').trim()
        const whatsapp = whatsappIndex >= 0 ? String(values[whatsappIndex] ?? '').trim() : ''
        const email = emailIndex >= 0 ? String(values[emailIndex] ?? '').trim() : ''
        const relationship = relationIndex >= 0 ? String(values[relationIndex] ?? '').trim() || 'Parent' : 'Parent'
        const studentNumber = studentNumberIndex >= 0 ? String(values[studentNumberIndex] ?? '').trim() : ''
        const studentName = studentNameIndex >= 0 ? String(values[studentNameIndex] ?? '').trim() : ''
        const student = students.find(item => (studentNumber && String(item.student_number).toLowerCase() === studentNumber.toLowerCase()) || (studentName && `${item.first_name} ${item.last_name}`.toLowerCase() === studentName.toLowerCase()))
        const cleanPhone = phone.replace(/\\s/g, '').toLowerCase()
        let issue = ''
        if (!fullName) issue = 'Nom manquant'
        else if (!phone) issue = 'Téléphone manquant'
        else if (usedPhones.has(cleanPhone) || seenPhones.has(cleanPhone)) issue = 'Téléphone déjà utilisé'
        else if ((studentNumber || studentName) && !student) issue = 'Élève non trouvé'
        seenPhones.add(cleanPhone)
        return { fullName, phone, whatsapp, email, relationship, studentId: student?.id || '', studentLabel: student ? `${student.first_name} ${student.last_name}` : (studentNumber || studentName || '—'), issue }
      }).filter(row => row.fullName || row.phone)
      setGuardianImportRows(nextRows)
      if (!nextRows.length) setGuardianImportError('Aucune ligne exploitable dans ce fichier.')
    } catch (error) {
      setGuardianImportError(`Lecture impossible : ${error.message || 'format non reconnu'}`)
      setGuardianImportRows([])
    }
  }

  async function importGuardians() {
    const validRows = guardianImportRows.filter(row => !row.issue)
    if (!validRows.length) return notify('Aucune ligne valide à importer.')
    setImporting(true)
    const { data: created, error } = await supabase.from('guardians').insert(validRows.map(row => ({ school_id: school.id, full_name: row.fullName, phone: row.phone, whatsapp: row.whatsapp || null, email: row.email || null }))).select()
    if (error) { setImporting(false); return setGuardianImportError(error.message) }
    const links = created.map((guardian, index) => validRows[index].studentId ? { guardian_id: guardian.id, student_id: validRows[index].studentId, relationship: validRows[index].relationship || 'Parent', is_primary: true } : null).filter(Boolean)
    if (links.length) {
      const { error: linkError } = await supabase.from('student_guardians').insert(links)
      if (linkError) { setImporting(false); return setGuardianImportError(`Parents importés, mais liaison élève impossible : ${linkError.message}`) }
    }
    setImporting(false)
    setModal(null)
    await loadSchoolData()
    notify(`${created.length} parent(s) importé(s) avec succès.`)
  }

  async function addGuardian(event) {
    event.preventDefault()
    if (!guardianForm.fullName.trim() || !guardianForm.phone.trim()) return notify('Le nom et le téléphone du parent sont obligatoires.')
    const { data: guardian, error } = await supabase.from('guardians').insert({
      school_id: school.id,
      full_name: guardianForm.fullName.trim(),
      phone: guardianForm.phone.trim(),
      whatsapp: guardianForm.whatsapp.trim() || null,
      email: guardianForm.email.trim() || null,
    }).select().single()
    if (error) return notify(error.message)
    if (guardianForm.studentId) {
      const { error: linkError } = await supabase.from('student_guardians').insert({ student_id: guardianForm.studentId, guardian_id: guardian.id, relationship: guardianForm.relationship, is_primary: true })
      if (linkError) return notify(`Parent ajouté, mais liaison élève impossible : ${linkError.message}`)
    }
    setGuardianForm({ fullName: '', phone: '', whatsapp: '', email: '', relationship: 'Parent', studentId: students[0]?.id || '' })
    setModal(null)
    await loadSchoolData()
    notify('Parent ajouté avec succès.')
  }

  async function signOut() {
    await supabase.auth.signOut()
    setActiveView('overview')
  }

  const filteredStudents = useMemo(() => {
    const q = studentSearch.toLowerCase().trim()
    return students.filter(student => `${student.first_name} ${student.last_name} ${student.student_number}`.toLowerCase().includes(q))
  }, [students, studentSearch])

  const accessMap = {
    owner: ['overview', 'students', 'classes', 'payments', 'fees', 'guardians', 'attendance', 'grades', 'team', 'settings'],
    director: ['overview', 'students', 'classes', 'payments', 'fees', 'guardians', 'attendance', 'grades', 'team', 'settings'],
    accountant: ['overview', 'students', 'payments', 'fees', 'guardians'],
    secretary: ['overview', 'students', 'classes', 'guardians', 'attendance'],
    teacher: ['overview', 'students', 'attendance', 'grades'],
  }
  const canAccess = view => (accessMap[memberRole] || accessMap.teacher).includes(view)
  useEffect(() => {
    if (school && !canAccess(activeView)) setActiveView('overview')
  }, [memberRole, school?.id, activeView])

  if (!supabase) return <SetupCard />
  if (loading) return <LoadingScreen />
  if (!session) return <AuthScreen mode={authMode} setMode={setAuthMode} form={authForm} setForm={setAuthForm} message={authMessage} onSubmit={handleAuth} />
  if (workspaceLoading && !school) return <LoadingScreen label="Chargement de votre espace…" />
  if (!school) return <Onboarding user={session.user} form={onboarding} setForm={setOnboarding} message={authMessage} onSubmit={createSchool} loading={workspaceLoading} signOut={signOut} />

  const activeLevelCount = levels.length
  const currentView = activeView === 'overview' ? <Overview school={school} students={students} classes={classes} levels={levels} payments={payments} onAddStudent={() => setModal('student')} onAddClass={() => setModal('class')} onAddPayment={() => setModal('payment')} /> : activeView === 'students' ? <Students students={filteredStudents} total={students.length} search={studentSearch} setSearch={setStudentSearch} onAdd={() => setModal('student')} onImport={() => { setImportRows([]); setImportFileName(''); setImportError(''); setModal('import') }} classes={classes} /> : activeView === 'classes' ? <Classes levels={levels} classes={classes} onAdd={() => setModal('class')} /> : activeView === 'payments' ? <Payments payments={payments} students={students} onAdd={() => setModal('payment')} /> : activeView === 'fees' ? <Fees fees={fees} payments={payments} students={students} onAdd={() => setModal('fee')} /> : activeView === 'guardians' ? <Guardians guardians={guardians} students={students} onAdd={() => setModal('guardian')} onImport={() => { setGuardianImportRows([]); setGuardianImportFileName(''); setGuardianImportError(''); setModal('guardian-import') }} /> : activeView === 'attendance' ? <Attendance students={students} records={attendanceRecords} date={attendanceDate} setDate={setAttendanceDate} toggle={toggleAttendance} save={saveAttendance} /> : activeView === 'grades' ? <Grades subjects={subjects} assessments={assessments} grades={grades} students={students} classes={classes} enrollments={enrollments} selectedId={selectedAssessmentId} setSelectedId={setSelectedAssessmentId} scoreDrafts={scoreDrafts} setScoreDrafts={setScoreDrafts} onSubject={() => setModal('subject')} onAssessment={() => setModal('assessment')} onSave={saveGrades} /> : activeView === 'team' ? <Team members={members} invitations={invitations} auditLogs={auditLogs} inviteLink={inviteLink} onAdd={() => { setInviteLink(''); setModal('team') }} /> : <Settings school={school} levels={levels} classes={classes} />

  return <div className="cloud-app">
    <aside className="cloud-sidebar">
      <a href="/" className="cloud-brand"><img src="/assets/logo-light.svg" alt="ScolaPilot" /></a>
      <div className="school-switch"><span className="school-badge">{initials(school.name)}</span><div><small>Établissement actif</small><strong>{school.name}</strong></div><span>⌄</span></div>
      <p className="menu-label">Espace école</p>
      <div className="cloud-nav">
        {canAccess('overview') && <NavButton active={activeView === 'overview'} icon="◈" label="Vue d’ensemble" onClick={() => setActiveView('overview')} />}
        {canAccess('students') && <NavButton active={activeView === 'students'} icon="♙" label="Élèves" onClick={() => setActiveView('students')} count={students.length} />}
        {canAccess('classes') && <NavButton active={activeView === 'classes'} icon="▦" label="Niveaux & classes" onClick={() => setActiveView('classes')} count={activeLevelCount} />}
        {canAccess('payments') && <NavButton active={activeView === 'payments'} icon="▣" label="Paiements" onClick={() => setActiveView('payments')} count={payments.length} />}
        {canAccess('fees') && <NavButton active={activeView === 'fees'} icon="◷" label="Frais & impayés" onClick={() => setActiveView('fees')} count={fees.length} />}
        {canAccess('guardians') && <NavButton active={activeView === 'guardians'} icon="♧" label="Parents" onClick={() => setActiveView('guardians')} count={guardians.length} />}
        {canAccess('attendance') && <NavButton active={activeView === 'attendance'} icon="◷" label="Présences" onClick={() => setActiveView('attendance')} count={students.length} />}
        {canAccess('grades') && <NavButton active={activeView === 'grades'} icon="⌁" label="Notes & bulletins" onClick={() => setActiveView('grades')} count={assessments.length} />}
        {canAccess('team') && <NavButton active={activeView === 'team'} icon="♧" label="Équipe" onClick={() => setActiveView('team')} count={members.length} />}
        {canAccess('settings') && <NavButton active={activeView === 'settings'} icon="⚙" label="Paramètres" onClick={() => setActiveView('settings')} />}
      </div>
      <div className="cloud-sidebar-bottom"><div className="cloud-help"><strong>Besoin d’aide ?</strong><p>Votre espace est sécurisé par Supabase.</p><a href="/#demo">Contacter l’équipe →</a></div><button className="cloud-user" onClick={signOut}><span className="user-avatar">{initials(session.user.user_metadata?.full_name || session.user.email)}</span><span><b>{session.user.user_metadata?.full_name || session.user.email}</b><small>Se déconnecter</small></span><i>↗</i></button></div>
    </aside>
    <main className="cloud-main">
      <header className="cloud-topbar"><div><span className="crumb">ScolaPilot <b>›</b></span><strong>{activeView === 'overview' ? 'Vue d’ensemble' : activeView === 'students' ? 'Élèves' : activeView === 'classes' ? 'Niveaux & classes' : activeView === 'payments' ? 'Paiements' : activeView === 'fees' ? 'Frais & impayés' : activeView === 'guardians' ? 'Parents & tuteurs' : activeView === 'attendance' ? 'Présences' : activeView === 'grades' ? 'Notes & bulletins' : activeView === 'team' ? 'Équipe & accès' : 'Paramètres'}</strong></div><div className="top-actions"><span className="live"><i></i> Données en direct</span><span className="top-user">{initials(session.user.user_metadata?.full_name || session.user.email)}</span></div></header>
      <div className="cloud-content">{currentView}</div>
    </main>
    {modal === 'team' && <Modal title="Inviter un collaborateur" onClose={() => setModal(null)}><form className="modal-form" onSubmit={createInvitation}><p className="modal-intro">L’invitation crée un lien sécurisé à partager par WhatsApp ou e-mail. Le collaborateur devra se connecter avec la même adresse.</p><div className="form-grid"><Field label="Adresse e-mail"><input required type="email" value={teamForm.email} onChange={e => setTeamForm({ ...teamForm, email: e.target.value })} placeholder="comptable@ecole.com" /></Field><Field label="Rôle"><select value={teamForm.role} onChange={e => setTeamForm({ ...teamForm, role: e.target.value })}><option value="director">Directeur</option><option value="accountant">Comptable</option><option value="secretary">Secrétaire</option><option value="teacher">Enseignant</option></select></Field></div><ModalFooter onClose={() => setModal(null)} submit="Créer l’invitation" /></form></Modal>}
    {modal === 'subject' && <Modal title="Ajouter une matière" onClose={() => setModal(null)}><form className="modal-form" onSubmit={addSubject}><div className="form-grid"><Field label="Nom de la matière"><input required value={subjectForm.name} onChange={e => setSubjectForm({ ...subjectForm, name: e.target.value })} placeholder="Mathématiques" /></Field><Field label="Code"><input value={subjectForm.code} onChange={e => setSubjectForm({ ...subjectForm, code: e.target.value })} placeholder="MATH" /></Field><Field label="Coefficient"><input required type="number" min="0.5" step="0.5" value={subjectForm.coefficient} onChange={e => setSubjectForm({ ...subjectForm, coefficient: e.target.value })} /></Field><Field label="Niveau (optionnel)"><select value={subjectForm.levelId} onChange={e => setSubjectForm({ ...subjectForm, levelId: e.target.value })}><option value="">Tous les niveaux</option>{levels.map(level => <option key={level.id} value={level.id}>{level.name}</option>)}</select></Field></div><ModalFooter onClose={() => setModal(null)} submit="Ajouter la matière" /></form></Modal>}
    {modal === 'assessment' && <Modal title="Créer une évaluation" onClose={() => setModal(null)}><form className="modal-form" onSubmit={addAssessment}><div className="form-grid"><Field label="Matière"><select required value={assessmentForm.subjectId} onChange={e => setAssessmentForm({ ...assessmentForm, subjectId: e.target.value })}><option value="">Choisir</option>{subjects.map(subject => <option key={subject.id} value={subject.id}>{subject.name} · coef. {subject.coefficient}</option>)}</select></Field><Field label="Classe"><select value={assessmentForm.classId} onChange={e => setAssessmentForm({ ...assessmentForm, classId: e.target.value })}><option value="">Toutes les classes</option>{classes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Titre"><input required value={assessmentForm.title} onChange={e => setAssessmentForm({ ...assessmentForm, title: e.target.value })} placeholder="Devoir surveillé 1" /></Field><Field label="Barème"><input required type="number" min="1" value={assessmentForm.maxScore} onChange={e => setAssessmentForm({ ...assessmentForm, maxScore: e.target.value })} /></Field><Field label="Trimestre"><select value={assessmentForm.term} onChange={e => setAssessmentForm({ ...assessmentForm, term: e.target.value })}><option>Trimestre 1</option><option>Trimestre 2</option><option>Trimestre 3</option><option>Semestre 1</option><option>Semestre 2</option></select></Field><Field label="Date"><input type="date" value={assessmentForm.assessmentDate} onChange={e => setAssessmentForm({ ...assessmentForm, assessmentDate: e.target.value })} /></Field></div><ModalFooter onClose={() => setModal(null)} submit="Créer l’évaluation" /></form></Modal>}
    {modal === 'import' && <Modal title="Importer des élèves" onClose={() => setModal(null)}><div className="import-modal"><p className="modal-intro">Importe un fichier Excel ou CSV avec les colonnes <b>prénom</b>, <b>nom</b>, <b>matricule</b> et <b>classe</b>. Les lignes incorrectes seront signalées avant l’enregistrement.</p><label className="upload-zone"><input type="file" accept=".xlsx,.xls,.csv" onChange={handleImportFile} /><span className="upload-icon">↑</span><b>{importFileName || 'Choisir un fichier Excel ou CSV'}</b><small>Formats acceptés · .xlsx, .xls, .csv</small></label>{importError && <div className="import-error">{importError}</div>}{importRows.length > 0 && <><div className="import-summary"><span><b>{importRows.filter(row => !row.issue).length}</b> ligne(s) prêtes</span><span className={importRows.some(row => row.issue) ? 'has-errors' : ''}><b>{importRows.filter(row => row.issue).length}</b> erreur(s)</span></div><div className="import-preview"><table><thead><tr><th>Élève</th><th>Matricule</th><th>Classe</th><th>Contrôle</th></tr></thead><tbody>{importRows.slice(0, 80).map((row, index) => <tr key={`${row.studentNumber}-${index}`}><td>{row.firstName} {row.lastName}</td><td>{row.studentNumber}</td><td>{row.className || '—'}</td><td><span className={row.issue ? 'import-bad' : 'import-ok'}>{row.issue || 'OK'}</span></td></tr>)}</tbody></table></div>{importRows.length > 80 && <small className="import-more">Aperçu limité aux 80 premières lignes.</small>}</>}{importRows.length > 0 && <div className="modal-footer"><button type="button" className="light-btn" onClick={() => setModal(null)}>Annuler</button><button type="button" className="primary-btn" disabled={importing || !importRows.some(row => !row.issue)} onClick={importStudents}>{importing ? 'Import en cours…' : `Importer ${importRows.filter(row => !row.issue).length} élève(s)`}</button></div>}</div></Modal>}
    {modal === 'student' && <Modal title="Ajouter un élève" onClose={() => setModal(null)}><form className="modal-form" onSubmit={addStudent}><div className="form-grid"><Field label="Prénom"><input required value={studentForm.firstName} onChange={e => setStudentForm({ ...studentForm, firstName: e.target.value })} placeholder="Ex. Aïcha" /></Field><Field label="Nom"><input required value={studentForm.lastName} onChange={e => setStudentForm({ ...studentForm, lastName: e.target.value })} placeholder="Ex. Ouédraogo" /></Field><Field label="Matricule"><input required value={studentForm.studentNumber} onChange={e => setStudentForm({ ...studentForm, studentNumber: e.target.value })} placeholder="Ex. SP-2026-0001" /></Field><Field label="Classe"><select value={studentForm.classId} onChange={e => setStudentForm({ ...studentForm, classId: e.target.value })}><option value="">À affecter plus tard</option>{classes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field></div><ModalFooter onClose={() => setModal(null)} submit="Ajouter l’élève" /></form></Modal>}
    {modal === 'payment' && <Modal title="Enregistrer un paiement" onClose={() => setModal(null)}><form className="modal-form" onSubmit={addPayment}><div className="form-grid"><Field label="Élève"><select required value={paymentForm.studentId} onChange={e => setPaymentForm({ ...paymentForm, studentId: e.target.value })}><option value="">Choisir un élève</option>{students.map(item => <option key={item.id} value={item.id}>{item.first_name} {item.last_name}</option>)}</select></Field><Field label="Montant (FCFA)"><input required type="number" min="1" value={paymentForm.amount} onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })} placeholder="75000" /></Field><Field label="Mode de paiement"><select value={paymentForm.method} onChange={e => setPaymentForm({ ...paymentForm, method: e.target.value })}><option value="cash">Espèces</option><option value="orange_money">Orange Money</option><option value="moov_money">Moov Money</option><option value="telecel_money">Telecel Money</option><option value="bank_transfer">Virement</option><option value="cheque">Chèque</option></select></Field><Field label="N° de reçu"><input required value={paymentForm.receiptNumber} onChange={e => setPaymentForm({ ...paymentForm, receiptNumber: e.target.value })} placeholder="SP-0001" /></Field><Field label="Note"><input value={paymentForm.note} onChange={e => setPaymentForm({ ...paymentForm, note: e.target.value })} placeholder="Tranche 1, inscription..." /></Field></div><ModalFooter onClose={() => setModal(null)} submit="Enregistrer le paiement" /></form></Modal>}
    {modal === 'guardian-import' && <Modal title="Importer les parents" onClose={() => setModal(null)}><div className="import-modal"><p className="modal-intro">Importe les familles avec les colonnes <b>nom complet</b>, <b>téléphone</b>, <b>WhatsApp</b>, <b>e-mail</b>, <b>matricule</b> et <b>lien</b>. La liaison à l’élève sera automatique par matricule.</p><label className="upload-zone"><input type="file" accept=".xlsx,.xls,.csv" onChange={handleGuardianImportFile} /><span className="upload-icon">↑</span><b>{guardianImportFileName || 'Choisir un fichier Excel ou CSV'}</b><small>Formats acceptés · .xlsx, .xls, .csv</small></label>{guardianImportError && <div className="import-error">{guardianImportError}</div>}{guardianImportRows.length > 0 && <><div className="import-summary"><span><b>{guardianImportRows.filter(row => !row.issue).length}</b> ligne(s) prêtes</span><span className={guardianImportRows.some(row => row.issue) ? 'has-errors' : ''}><b>{guardianImportRows.filter(row => row.issue).length}</b> erreur(s)</span></div><div className="import-preview"><table><thead><tr><th>Parent</th><th>Téléphone</th><th>Élève lié</th><th>Contrôle</th></tr></thead><tbody>{guardianImportRows.slice(0, 80).map((row, index) => <tr key={`${row.phone}-${index}`}><td>{row.fullName}</td><td>{row.phone}</td><td>{row.studentLabel}</td><td><span className={row.issue ? 'import-bad' : 'import-ok'}>{row.issue || 'OK'}</span></td></tr>)}</tbody></table></div></>}{guardianImportRows.length > 0 && <div className="modal-footer"><button type="button" className="light-btn" onClick={() => setModal(null)}>Annuler</button><button type="button" className="primary-btn" disabled={importing || !guardianImportRows.some(row => !row.issue)} onClick={importGuardians}>{importing ? 'Import en cours…' : `Importer ${guardianImportRows.filter(row => !row.issue).length} parent(s)`}</button></div>}</div></Modal>}
    {modal === 'guardian' && <Modal title="Ajouter un parent / tuteur" onClose={() => setModal(null)}><form className="modal-form" onSubmit={addGuardian}><div className="form-grid"><Field label="Nom complet"><input required value={guardianForm.fullName} onChange={e => setGuardianForm({ ...guardianForm, fullName: e.target.value })} placeholder="Ex. Mariam Ouédraogo" /></Field><Field label="Téléphone"><input required value={guardianForm.phone} onChange={e => setGuardianForm({ ...guardianForm, phone: e.target.value })} placeholder="+226 70 00 00 00" /></Field><Field label="WhatsApp"><input value={guardianForm.whatsapp} onChange={e => setGuardianForm({ ...guardianForm, whatsapp: e.target.value })} placeholder="+226 ..." /></Field><Field label="Lien avec l’élève"><select value={guardianForm.relationship} onChange={e => setGuardianForm({ ...guardianForm, relationship: e.target.value })}><option>Parent</option><option>Père</option><option>Mère</option><option>Tuteur</option><option>Autre</option></select></Field><Field label="Rattacher à un élève"><select value={guardianForm.studentId} onChange={e => setGuardianForm({ ...guardianForm, studentId: e.target.value })}><option value="">Plus tard</option>{students.map(item => <option key={item.id} value={item.id}>{item.first_name} {item.last_name}</option>)}</select></Field><Field label="E-mail"><input type="email" value={guardianForm.email} onChange={e => setGuardianForm({ ...guardianForm, email: e.target.value })} placeholder="parent@email.com" /></Field></div><ModalFooter onClose={() => setModal(null)} submit="Ajouter le parent" /></form></Modal>}
    {modal === 'fee' && <Modal title="Ajouter des frais scolaires" onClose={() => setModal(null)}><form className="modal-form" onSubmit={addFee}><div className="form-grid"><Field label="Élève"><select required value={feeForm.studentId} onChange={e => setFeeForm({ ...feeForm, studentId: e.target.value })}><option value="">Choisir un élève</option>{students.map(item => <option key={item.id} value={item.id}>{item.first_name} {item.last_name}</option>)}</select></Field><Field label="Libellé"><input required value={feeForm.label} onChange={e => setFeeForm({ ...feeForm, label: e.target.value })} placeholder="Scolarité — tranche 1" /></Field><Field label="Montant (FCFA)"><input required type="number" min="1" value={feeForm.amount} onChange={e => setFeeForm({ ...feeForm, amount: e.target.value })} placeholder="75000" /></Field><Field label="Réduction (FCFA)"><input type="number" min="0" value={feeForm.discount} onChange={e => setFeeForm({ ...feeForm, discount: e.target.value })} placeholder="0" /></Field><Field label="Date d’échéance"><input type="date" value={feeForm.dueDate} onChange={e => setFeeForm({ ...feeForm, dueDate: e.target.value })} /></Field></div><ModalFooter onClose={() => setModal(null)} submit="Enregistrer les frais" /></form></Modal>}
    {modal === 'class' && <Modal title="Ajouter une classe" onClose={() => setModal(null)}><form className="modal-form" onSubmit={addClass}><div className="form-grid"><Field label="Niveau"><select required value={classForm.levelId} onChange={e => setClassForm({ ...classForm, levelId: e.target.value })}>{levels.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Nom de la classe"><input required value={classForm.name} onChange={e => setClassForm({ ...classForm, name: e.target.value })} placeholder="Ex. CP1 A ou 3e" /></Field></div><p className="form-hint">Une classe peut être nommée CP1 A, CP1 B, 6e 1, Tle D, etc.</p><ModalFooter onClose={() => setModal(null)} submit="Créer la classe" /></form></Modal>}
    {toast && <div className="cloud-toast"><span>✓</span>{toast}</div>}
  </div>
}

function NavButton({ active, icon, label, count, onClick }) { return <button type="button" className={`cloud-nav-button ${active ? 'active' : ''}`} onClick={onClick}><span>{icon}</span>{label}{count !== undefined && <b>{count}</b>}</button> }
function Field({ label, children }) { return <label className="field"><span>{label}</span>{children}</label> }
function Modal({ title, onClose, children }) { return <div className="modal-layer" onMouseDown={e => e.target === e.currentTarget && onClose()}><div className="cloud-modal"><div className="modal-header"><h2>{title}</h2><button type="button" onClick={onClose}>×</button></div>{children}</div></div> }
function ModalFooter({ onClose, submit }) { return <div className="modal-footer"><button type="button" className="light-btn" onClick={onClose}>Annuler</button><button type="submit" className="primary-btn">{submit}</button></div> }

function Overview({ school, students, classes, levels, payments, onAddStudent, onAddClass, onAddPayment }) {
  const grouped = levels.map(level => ({ ...level, count: students.length ? Math.max(0, Math.round(students.length / Math.max(levels.length, 1))) : 0 })).slice(0, 6)
  return <>
    <PageHeading eyebrow="Espace connecté" title={`Bonjour, ${school.name}`} subtitle="Votre établissement est prêt. Commencez par créer vos classes et vos premiers élèves." actions={<><button className="light-btn" onClick={onAddClass}>+ Créer une classe</button><button className="light-btn" onClick={onAddPayment}>+ Paiement</button><button className="primary-btn" onClick={onAddStudent}>+ Ajouter un élève</button></>} />
    <div className="cloud-notice"><span>☁</span><div><b>Base Supabase connectée.</b> Les données saisies ici seront enregistrées dans votre espace sécurisé.</div></div>
    <div className="cloud-kpis"><Metric icon="♙" label="Élèves actifs" value={students.length} note="Données réelles" /><Metric icon="▦" label="Classes créées" value={classes.length} note={`${levels.length} niveaux disponibles`} /><Metric icon="↗" label="Niveaux configurés" value={levels.length} note="Préscolaire à Tle" /><Metric icon="▣" label="Paiements enregistrés" value={payments.length} note="Données Supabase" /></div>
    <div className="cloud-two-columns"><div className="cloud-panel"><div className="panel-heading"><div><h2>Votre structure scolaire</h2><p>Les niveaux prêts à accueillir vos classes</p></div><button className="text-btn" onClick={() => {}}>Voir les détails →</button></div><div className="level-cloud">{grouped.map(level => <div className="level-tile" key={level.id}><span className={`level-symbol ${level.category}`}>{level.name.slice(0, 2)}</span><div><b>{level.name}</b><small>{level.count} élève{level.count > 1 ? 's' : ''}</small></div><span className="tile-arrow">›</span></div>)}</div><div className="level-note">Les niveaux restants sont disponibles dans <b>Niveaux & classes</b>.</div></div><div className="cloud-panel accent-panel"><span className="panel-kicker">Prochaine action recommandée</span><h2>Créez votre première classe</h2><p>Une classe relie un niveau à une année scolaire. Vous pourrez ensuite affecter les élèves et suivre les paiements par classe.</p><button className="primary-btn" onClick={onAddClass}>Créer une classe <span>↗</span></button><div className="accent-dots"><i></i><i></i><i></i></div></div></div>
    <div className="cloud-panel recent-panel"><div className="panel-heading"><div><h2>Premiers élèves</h2><p>Les élèves apparaîtront ici après leur création.</p></div><button className="light-btn" onClick={onAddStudent}>+ Ajouter</button></div>{students.length === 0 ? <EmptyState icon="♙" title="Aucun élève pour le moment" text="Commencez par ajouter votre premier élève." action="Ajouter un élève" onClick={onAddStudent} /> : <div className="simple-list">{students.slice(0, 5).map(student => <div className="simple-row" key={student.id}><span className="student-avatar">{initials(`${student.first_name} ${student.last_name}`)}</span><div><b>{student.first_name} {student.last_name}</b><small>{student.student_number}</small></div><span className="active-pill">Actif</span></div>)}</div>}</div>
  </>
}

function Students({ students, total, search, setSearch, onAdd, onImport, classes }) { return <><PageHeading eyebrow="Base élèves" title="Élèves" subtitle={`${total} élève${total > 1 ? 's' : ''} dans votre établissement.`} actions={<><button type="button" className="light-btn" onClick={onImport}>↑ Importer</button><button type="button" className="light-btn" onClick={() => { const rows = students.map(student => [student.student_number, student.first_name, student.last_name]); const csv = [['matricule', 'prénom', 'nom'], ...rows].map(row => row.map(cell => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(';')).join('\\n'); const url = URL.createObjectURL(new Blob([`\\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' })); const link = document.createElement('a'); link.href = url; link.download = 'eleves-scolapilot.csv'; link.click(); URL.revokeObjectURL(url) }}>↓ Exporter</button><button type="button" className="primary-btn" onClick={onAdd}>+ Ajouter un élève</button></>} /><div className="cloud-panel"><div className="table-toolbar"><div className="search"><span>⌕</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher par nom ou matricule..." /></div><span className="muted-count">{students.length} résultat{students.length > 1 ? 's' : ''}</span></div>{students.length ? <div className="table-scroll"><table><thead><tr><th>Élève</th><th>Matricule</th><th>Statut</th><th></th></tr></thead><tbody>{students.map(student => <tr key={student.id}><td><div className="table-person"><span className="student-avatar">{initials(`${student.first_name} ${student.last_name}`)}</span><div><b>{student.first_name} {student.last_name}</b><small>Élève ScolaPilot</small></div></div></td><td>{student.student_number}</td><td><span className="active-pill">Actif</span></td><td><button className="row-menu">•••</button></td></tr>)}</tbody></table></div> : <EmptyState icon="⌕" title="Aucun résultat" text="Ajoutez un élève ou modifiez votre recherche." action="Ajouter un élève" onClick={onAdd} />}</div></> }

function Team({ members, invitations, auditLogs, inviteLink, onAdd }) {
  const roleLabel = role => ({ owner: 'Propriétaire', director: 'Directeur', accountant: 'Comptable', secretary: 'Secrétaire', teacher: 'Enseignant' })[role] || role
  const copyInvite = async () => { if (inviteLink) { await navigator.clipboard?.writeText(inviteLink); } }
  return <><PageHeading eyebrow="Gouvernance école" title="Équipe & accès" subtitle="Invitez vos collaborateurs et gardez une séparation claire des responsabilités." actions={<button type="button" className="primary-btn" onClick={onAdd}>+ Inviter un membre</button>} /><div className="cloud-kpis"><Metric icon="♧" label="Membres" value={members.length} note="Accès école"/><Metric icon="↗" label="Invitations" value={invitations.filter(item => !item.accepted_at).length} note="En attente"/><Metric icon="⚙" label="Rôles" value="5" note="Directeur à enseignant"/><Metric icon="🔐" label="Sécurité" value="RLS" note="Supabase"/></div>{inviteLink && <div className="invite-share"><div><b>Invitation prête à partager</b><small>Envoie ce lien par WhatsApp ou e-mail au collaborateur invité.</small><code>{inviteLink}</code></div><button type="button" className="light-btn" onClick={copyInvite}>Copier le lien</button></div>}<div className="cloud-panel"><div className="panel-heading"><div><h2>Membres de l’école</h2><p>Chaque membre utilisera son propre compte.</p></div><span className="count-badge">{members.length} membre(s)</span></div>{members.length ? <div className="simple-list">{members.map(member => <div className="simple-row" key={member.id}><span className="student-avatar">{member.role.slice(0, 1).toUpperCase()}</span><div><b>{member.user_id.slice(0, 8)}…</b><small>Compte Supabase · ajouté le {new Date(member.created_at).toLocaleDateString('fr-FR')}</small></div><span className="active-pill">{roleLabel(member.role)}</span></div>)}</div> : <EmptyState icon="♧" title="Aucun membre" text="Invitez un directeur, un comptable ou un enseignant." action="Inviter un membre" onClick={onAdd} />}</div><div className="cloud-panel"><div className="panel-heading"><div><h2>Invitations récentes</h2><p>Le lien expire automatiquement après 7 jours.</p></div></div>{invitations.length ? <div className="simple-list">{invitations.map(invitation => <div className="simple-row" key={invitation.id}><span className="class-icon">↗</span><div><b>{invitation.email}</b><small>{roleLabel(invitation.role)} · expire le {new Date(invitation.expires_at).toLocaleDateString('fr-FR')}</small></div><span className={`active-pill ${invitation.accepted_at ? '' : 'late-pill'}`}>{invitation.accepted_at ? 'Acceptée' : 'En attente'}</span></div>)}</div> : <EmptyState icon="↗" title="Aucune invitation" text="La prochaine invitation de votre équipe apparaîtra ici." action="Inviter un membre" onClick={onAdd} />}</div><div className="cloud-panel"><div className="panel-heading"><div><h2>Journal d’activité</h2><p>Les opérations sensibles sont conservées pour la direction.</p></div><span className="count-badge">{auditLogs.length} événement(s)</span></div>{auditLogs.length ? <div className="activity-list">{auditLogs.slice(0, 12).map(log => <div className="activity" key={log.id}><span className="activity-icon">✓</span><span className="activity-text"><strong>{log.action} · {log.entity}</strong><br />{log.metadata?.name || log.metadata?.receipt_number || log.metadata?.email || 'Opération enregistrée'}</span><span className="activity-time">{new Date(log.created_at).toLocaleDateString('fr-FR')}</span></div>)}</div> : <EmptyState icon="✓" title="Journal prêt" text="Les prochaines actions de votre équipe apparaîtront ici." action="Inviter un membre" onClick={onAdd} />}</div></>
}

function Grades({ subjects, assessments, grades, students, classes, enrollments, selectedId, setSelectedId, scoreDrafts, setScoreDrafts, onSubject, onAssessment, onSave }) {
  const assessment = assessments.find(item => item.id === selectedId)
  useEffect(() => {
    if (assessment) setScoreDrafts(Object.fromEntries(grades.filter(grade => grade.assessment_id === assessment.id).map(grade => [grade.student_id, String(grade.score)])))
  }, [selectedId, grades, assessment?.id])
  const classStudents = assessment?.class_id ? students.filter(student => enrollments.some(enrollment => enrollment.student_id === student.id && enrollment.class_id === assessment.class_id)) : students
  const entered = classStudents.filter(student => scoreDrafts[student.id] !== undefined && scoreDrafts[student.id] !== '').length
  const average = entered ? classStudents.reduce((sum, student) => sum + Number(scoreDrafts[student.id] || 0), 0) / entered : 0
  const subjectName = subjectId => subjects.find(subject => subject.id === subjectId)?.name || 'Matière'
  const printBulletin = student => {
    const lines = grades.filter(grade => grade.student_id === student.id).map(grade => { const item = assessments.find(candidate => candidate.id === grade.assessment_id); return item ? `<tr><td>${subjectName(item.subject_id)}</td><td>${item.title}</td><td>${grade.score} / ${item.max_score}</td></tr>` : '' }).join('')
    const page = window.open('', '_blank', 'width=760,height=850')
    if (!page) return
    page.document.write(`<html lang="fr"><head><title>Bulletin — ${student.first_name} ${student.last_name}</title><style>body{font-family:Arial,sans-serif;color:#17333a;padding:38px;max-width:720px;margin:auto}header{display:flex;justify-content:space-between;border-bottom:3px solid #1d6b60;padding-bottom:18px}h1{font-size:24px;margin:0 0 7px}h2{font-size:17px;margin-top:32px}table{width:100%;border-collapse:collapse;margin-top:14px}th,td{padding:12px 8px;text-align:left;border-bottom:1px solid #e2ebe5;font-size:12px}th{color:#6e817c}.footer{margin-top:45px;text-align:center;color:#71837e;font-size:11px}</style></head><body><header><div><h1>ScolaPilot</h1><div>Bulletin scolaire</div></div><div style="text-align:right"><b>${student.first_name} ${student.last_name}</b><div>${student.student_number}</div></div></header><h2>Résultats enregistrés</h2><table><thead><tr><th>Matière</th><th>Évaluation</th><th>Note</th></tr></thead><tbody>${lines || '<tr><td colspan="3">Aucune note enregistrée</td></tr>'}</tbody></table><div class="footer">Document généré depuis l’espace école ScolaPilot.</div><script>window.onload=()=>setTimeout(()=>window.print(),250)</script></body></html>`)
    page.document.close()
  }
  return <><PageHeading eyebrow="Performance scolaire" title="Notes & bulletins" subtitle="Saisissez les évaluations, suivez les moyennes et préparez les bulletins." actions={<><button type="button" className="light-btn" onClick={onSubject}>+ Matière</button><button type="button" className="primary-btn" onClick={onAssessment}>+ Évaluation</button></>} /><div className="cloud-kpis"><Metric icon="⌁" label="Matières" value={subjects.length} note="Catalogue école"/><Metric icon="▣" label="Évaluations" value={assessments.length} note="Toutes périodes"/><Metric icon="✓" label="Notes saisies" value={grades.length} note="Données réelles"/><Metric icon="↗" label="Moyenne actuelle" value={entered ? `${average.toFixed(2)} / ${assessment?.max_score || 20}` : '—'} note={assessment?.title || 'Choisir une évaluation'}/></div><div className="cloud-panel"><div className="panel-heading"><div><h2>Carnet de notes</h2><p>Choisis une évaluation puis saisis les notes de la classe.</p></div><div className="grades-controls"><select value={selectedId} onChange={e => setSelectedId(e.target.value)}><option value="">Choisir une évaluation</option>{assessments.map(item => <option key={item.id} value={item.id}>{subjectName(item.subject_id)} · {item.title} · {item.term}</option>)}</select><button type="button" className="primary-btn" disabled={!assessment} onClick={onSave}>Enregistrer les notes</button></div></div>{assessment ? <><div className="assessment-banner"><b>{subjectName(assessment.subject_id)} · {assessment.title}</b><span>{assessment.term} · barème {assessment.max_score} · {assessment.class_id ? classes.find(item => item.id === assessment.class_id)?.name : 'Toutes les classes'}</span></div><div className="table-scroll"><table><thead><tr><th>Élève</th><th>Matricule</th><th>Note / {assessment.max_score}</th><th>Statut</th><th></th></tr></thead><tbody>{classStudents.map(student => <tr key={student.id}><td><div className="table-person"><span className="student-avatar">{initials(`${student.first_name} ${student.last_name}`)}</span><div><b>{student.first_name} {student.last_name}</b><small>Élève actif</small></div></div></td><td>{student.student_number}</td><td><input className="score-input" type="number" min="0" max={assessment.max_score} step="0.25" value={scoreDrafts[student.id] ?? ''} onChange={e => setScoreDrafts({ ...scoreDrafts, [student.id]: e.target.value })} placeholder="—" /></td><td>{scoreDrafts[student.id] !== undefined && scoreDrafts[student.id] !== '' ? <span className="active-pill">Saisie</span> : <span className="muted-count">À saisir</span>}</td><td><button type="button" className="row-menu" onClick={() => printBulletin(student)} title="Imprimer le bulletin">↗</button></td></tr>)}</tbody></table></div></> : <EmptyState icon="⌁" title="Aucune évaluation sélectionnée" text="Crée d’abord une matière et une évaluation pour commencer la saisie." action="Créer une évaluation" onClick={onAssessment} />}</div><div className="cloud-panel"><div className="panel-heading"><div><h2>Bulletins</h2><p>Imprime un relevé individuel à partir des notes enregistrées.</p></div></div>{students.length ? <div className="simple-list">{students.slice(0, 12).map(student => <div className="simple-row" key={student.id}><span className="student-avatar">{initials(`${student.first_name} ${student.last_name}`)}</span><div><b>{student.first_name} {student.last_name}</b><small>{grades.filter(grade => grade.student_id === student.id).length} note(s) enregistrée(s)</small></div><button type="button" className="light-btn" onClick={() => printBulletin(student)}>Imprimer le bulletin</button></div>)}</div> : <EmptyState icon="♙" title="Aucun élève" text="Ajoute des élèves avant de préparer les bulletins." action="Ajouter un élève" onClick={() => {}} />}</div></>
}

function Attendance({ students, records, date, setDate, toggle, save }) {
  const presentCount = students.filter(student => (records.find(item => item.student_id === student.id)?.status || 'present') === 'present').length
  return <><PageHeading eyebrow="Vie scolaire" title="Présences" subtitle="Faites l’appel depuis votre téléphone et gardez un historique fiable." actions={<><input className="date-input" type="date" value={date} onChange={e => setDate(e.target.value)} /><button className="primary-btn" onClick={save}>Enregistrer l’appel</button></>} /><div className="cloud-kpis"><Metric icon="✓" label="Présents" value={presentCount} note={`sur ${students.length} élève(s)`}/><Metric icon="!" label="Absents" value={Math.max(students.length - presentCount, 0)} note="À justifier"/><Metric icon="◷" label="Date" value={new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} note="Appel du jour"/><Metric icon="↗" label="Taux" value={students.length ? `${Math.round((presentCount / students.length) * 100)}%` : '—'} note="Présence"/></div><div className="cloud-panel"><div className="panel-heading"><div><h2>Appel de la classe</h2><p>Appuie sur une ligne pour basculer présent / absent.</p></div><span className="count-badge">{presentCount} présent(s)</span></div>{students.length ? <div className="attendance-list">{students.map(student => { const status = records.find(item => item.student_id === student.id)?.status || 'present'; const isPresent = status === 'present'; return <button className={`attendance-row ${isPresent ? 'is-present' : 'is-absent'}`} key={student.id} onClick={() => toggle(student.id)}><span className="student-avatar">{initials(`${student.first_name} ${student.last_name}`)}</span><span><b>{student.first_name} {student.last_name}</b><small>{student.student_number}</small></span><strong>{isPresent ? 'Présent' : 'Absent'}</strong><i>{isPresent ? '✓' : '!'}</i></button>})}</div> : <EmptyState icon="◷" title="Aucun élève à appeler" text="Ajoutez vos élèves avant de commencer l’appel." action="Ajouter des élèves" onClick={() => {}} />}</div></>
}

function Guardians({ guardians, students, onAdd, onImport }) {
  return <><PageHeading eyebrow="Communication famille" title="Parents & tuteurs" subtitle="Centralisez les contacts et rattachez chaque famille aux élèves." actions={<><button type="button" className="light-btn" onClick={onImport}>↑ Importer</button><button type="button" className="primary-btn" onClick={onAdd}>+ Ajouter un parent</button></>} /><div className="cloud-kpis"><Metric icon="♧" label="Contacts enregistrés" value={guardians.length} note="Données Supabase" /><Metric icon="☎" label="Téléphones" value={guardians.filter(item => item.phone).length} note="Prêts pour les relances" /><Metric icon="◉" label="WhatsApp" value={guardians.filter(item => item.whatsapp).length} note="À contacter" /><Metric icon="♙" label="Élèves" value={students.length} note="Base active" /></div><div className="cloud-panel"><div className="panel-heading"><div><h2>Répertoire des familles</h2><p>Les parents pourront bientôt recevoir les relances et reçus directement.</p></div><span className="count-badge">{guardians.length} contact(s)</span></div>{guardians.length ? <div className="table-scroll"><table><thead><tr><th>Parent / tuteur</th><th>Téléphone</th><th>WhatsApp</th><th>E-mail</th><th></th></tr></thead><tbody>{guardians.map(item => <tr key={item.id}><td><div className="table-person"><span className="student-avatar">{initials(item.full_name)}</span><div><b>{item.full_name}</b><small>Contact famille</small></div></div></td><td>{item.phone || '—'}</td><td>{item.whatsapp || '—'}</td><td>{item.email || '—'}</td><td><button className="row-menu">•••</button></td></tr>)}</tbody></table></div> : <EmptyState icon="♧" title="Aucun parent enregistré" text="Ajoutez un parent ou tuteur pour préparer la communication famille." action="Ajouter un parent" onClick={onAdd} />}</div></>
}

function Fees({ fees, payments, students, onAdd }) {
  const studentName = id => { const student = students.find(item => item.id === id); return student ? `${student.first_name} ${student.last_name}` : 'Élève non trouvé' }
  const assigned = fees.reduce((sum, item) => sum + Number(item.amount || 0) - Number(item.discount || 0), 0)
  const paid = payments.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const outstanding = Math.max(assigned - paid, 0)
  return <><PageHeading eyebrow="Scolarité" title="Frais & impayés" subtitle="Définissez ce que chaque élève doit payer et repérez les soldes restants." actions={<button className="primary-btn" onClick={onAdd}>+ Ajouter des frais</button>} /><div className="cloud-kpis payment-kpis"><Metric icon="◷" label="Frais assignés" value={fees.length} note={money(assigned)} /><Metric icon="↗" label="Déjà encaissé" value={money(paid).replace(' FCFA', '')} note="Tous paiements" /><Metric icon="!" label="Solde estimé" value={money(outstanding).replace(' FCFA', '')} note="À recouvrer" /><Metric icon="✓" label="Suivi" value={fees.length ? 'Actif' : 'Prêt'} note="Par élève" /></div><div className="cloud-panel"><div className="panel-heading"><div><h2>Échéances configurées</h2><p>Les frais assignés apparaissent dans le dossier de chaque élève.</p></div><span className="count-badge">{fees.length} ligne(s)</span></div>{fees.length ? <div className="table-scroll"><table><thead><tr><th>Élève</th><th>Libellé</th><th>Montant net</th><th>Échéance</th><th>Statut</th></tr></thead><tbody>{fees.map(fee => { const net = Number(fee.amount || 0) - Number(fee.discount || 0); const studentPaid = payments.filter(item => item.student_id === fee.student_id).reduce((sum, item) => sum + Number(item.amount || 0), 0); const isPaid = studentPaid >= net; return <tr key={fee.id}><td><div className="table-person"><span className="student-avatar">{initials(studentName(fee.student_id))}</span><div><b>{studentName(fee.student_id)}</b><small>Frais scolaires</small></div></div></td><td>{fee.label}</td><td><b>{money(net)}</b></td><td>{fee.due_date ? new Date(fee.due_date).toLocaleDateString('fr-FR') : 'Non définie'}</td><td><span className={`active-pill ${isPaid ? '' : 'late-pill'}`}>{isPaid ? 'Payé' : 'À recouvrer'}</span></td></tr>})}</tbody></table></div> : <EmptyState icon="◷" title="Aucun frais configuré" text="Commencez par assigner une tranche de scolarité à un élève." action="Ajouter des frais" onClick={onAdd} />}</div></>
}

function Payments({ payments, students, onAdd }) {
  const studentName = id => { const student = students.find(item => item.id === id); return student ? `${student.first_name} ${student.last_name}` : 'Élève non trouvé' }
  const methodLabel = method => ({ cash: 'Espèces', orange_money: 'Orange Money', moov_money: 'Moov Money', telecel_money: 'Telecel Money', bank_transfer: 'Virement', cheque: 'Chèque', other: 'Autre' })[method] || method
  const printReceipt = payment => {
    const name = studentName(payment.student_id)
    const receipt = window.open('', '_blank', 'width=720,height=800')
    if (!receipt) return
    receipt.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Reçu ${payment.receipt_number}</title><style>body{font-family:Arial,sans-serif;color:#17333a;padding:38px;max-width:650px;margin:auto}header{display:flex;justify-content:space-between;border-bottom:3px solid #1d6b60;padding-bottom:18px}h1{font-size:23px;margin:0 0 5px}h2{font-size:17px;margin:34px 0 15px}.muted{color:#738582;font-size:12px}.total{margin:25px 0;padding:22px;border-radius:13px;background:#e5f3ec;color:#1d6b60;font-size:30px;font-weight:800}.row{display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #e5ebe6;font-size:13px}.row b{color:#17333a}.footer{margin-top:48px;color:#738582;font-size:11px;text-align:center}</style></head><body><header><div><h1>ScolaPilot</h1><div class="muted">Reçu de paiement scolaire</div></div><div style="text-align:right"><b>${payment.receipt_number}</b><div class="muted">${new Date(payment.paid_at).toLocaleDateString('fr-FR')}</div></div></header><h2>Élève</h2><div class="row"><span>Nom complet</span><b>${name}</b></div><div class="row"><span>Mode de paiement</span><b>${methodLabel(payment.method)}</b></div><div class="total">${money(payment.amount)}</div><div class="row"><span>Note</span><b>${payment.note || 'Paiement scolaire'}</b></div><div class="footer">Document généré par ScolaPilot · À conserver comme justificatif.</div><script>window.onload=()=>setTimeout(()=>window.print(),250)</script></body></html>`)
    receipt.document.close()
  }
  const total = payments.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  return <><PageHeading eyebrow="Suivi financier" title="Paiements" subtitle="Enregistrez les règlements et gardez une trace de chaque reçu." actions={<button className="primary-btn" onClick={onAdd}>+ Enregistrer un paiement</button>} /><div className="cloud-kpis payment-kpis"><Metric icon="▣" label="Paiements enregistrés" value={payments.length} note="Depuis Supabase" /><Metric icon="↗" label="Total encaissé" value={total ? `${Math.round(total / 1000)}k` : '0'} note="FCFA" /><Metric icon="◷" label="Dernier reçu" value={payments[0]?.receipt_number || '—'} note={payments[0] ? 'Dernière opération' : 'Aucun reçu'} /><Metric icon="✓" label="Statut" value="Actif" note="RLS sécurisé" /></div><div className="cloud-panel"><div className="panel-heading"><div><h2>Historique des paiements</h2><p>Les paiements sont enregistrés avec leur reçu et leur mode de règlement.</p></div><span className="count-badge">{payments.length} reçu(s)</span></div>{payments.length ? <div className="table-scroll"><table><thead><tr><th>Reçu</th><th>Élève</th><th>Montant</th><th>Mode</th><th>Date</th><th></th></tr></thead><tbody>{payments.map(payment => <tr key={payment.id}><td><b>{payment.receipt_number}</b></td><td><div className="table-person"><span className="student-avatar">{initials(studentName(payment.student_id))}</span><div><b>{studentName(payment.student_id)}</b><small>{payment.note || 'Paiement scolaire'}</small></div></div></td><td><b>{money(payment.amount)}</b></td><td><span className="active-pill">{methodLabel(payment.method)}</span></td><td>{new Date(payment.paid_at).toLocaleDateString('fr-FR')}</td><td><button className="row-menu" onClick={() => printReceipt(payment)} title="Imprimer le reçu">↗</button></td></tr>)}</tbody></table></div> : <EmptyState icon="▣" title="Aucun paiement enregistré" text="Le premier règlement de l’école apparaîtra ici avec son numéro de reçu." action="Enregistrer un paiement" onClick={onAdd} />}</div></>
}

function Classes({ levels, classes, onAdd }) { return <><PageHeading eyebrow="Organisation" title="Niveaux & classes" subtitle="La structure officielle de votre établissement est prête à être configurée." actions={<button className="primary-btn" onClick={onAdd}>+ Ajouter une classe</button>} /><div className="cloud-panel"><div className="panel-heading"><div><h2>Catalogue des niveaux</h2><p>Préscolaire, primaire, postprimaire et secondaire.</p></div><span className="count-badge">{levels.length} niveaux</span></div><div className="levels-full-grid">{levels.map(level => <div className="level-row" key={level.id}><span className={`level-symbol ${level.category}`}>{level.name.slice(0, 2)}</span><div><b>{level.name}</b><small>{level.category === 'preschool' ? 'Préscolaire' : level.category === 'primary' ? 'Primaire' : level.category === 'postprimary' ? 'Postprimaire' : 'Secondaire'}</small></div><span className="class-count">{classes.filter(item => item.level_id === level.id).length} classe(s)</span></div>)}</div></div><div className="cloud-panel class-list-panel"><div className="panel-heading"><div><h2>Classes créées</h2><p>Une classe peut avoir plusieurs sections.</p></div></div>{classes.length ? <div className="simple-list">{classes.map(item => <div className="simple-row" key={item.id}><span className="class-icon">▦</span><div><b>{item.name}</b><small>Niveau configuré</small></div><span className="active-pill">Active</span></div>)}</div> : <EmptyState icon="▦" title="Aucune classe créée" text="Créez CP1 A, 6e 1, Tle D ou toute autre classe de votre établissement." action="Créer une classe" onClick={onAdd} />}</div></> }

function Settings({ school, levels, classes }) { return <><PageHeading eyebrow="Configuration" title="Paramètres" subtitle="Les informations de votre espace ScolaPilot." actions={<button className="light-btn">Modifier l’établissement</button>} /><div className="cloud-two-columns"><div className="cloud-panel info-panel"><div className="big-school-avatar">{initials(school.name)}</div><h2>{school.name}</h2><p>{school.city || 'Ville à compléter'}</p><div className="info-lines"><div><span>Devise</span><b>{school.currency}</b></div><div><span>Niveaux</span><b>{levels.length}</b></div><div><span>Classes</span><b>{classes.length}</b></div></div></div><div className="cloud-panel"><div className="panel-heading"><div><h2>Checklist de démarrage</h2><p>Les prochaines étapes pour votre équipe.</p></div></div><div className="check-list"><div><span>✓</span> École créée dans Supabase</div><div><span>✓</span> Niveaux scolaires préparés</div><div className={classes.length ? '' : 'pending'}><span>{classes.length ? '✓' : '○'}</span> Première classe configurée</div><div className={classes.length && false ? '' : 'pending'}><span>○</span> Premier élève ajouté</div></div></div></div></> }

function Metric({ icon, label, value, note }) { return <div className="cloud-metric"><div><span>{label}</span><i>{icon}</i></div><strong>{value}</strong><small>{note}</small></div> }
function PageHeading({ eyebrow, title, subtitle, actions }) { return <div className="cloud-heading"><div><span className="cloud-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{subtitle}</p></div><div className="heading-actions">{actions}</div></div> }
function EmptyState({ icon, title, text, action, onClick }) { return <div className="empty-state"><span>{icon}</span><h3>{title}</h3><p>{text}</p><button className="primary-btn" onClick={onClick}>{action}</button></div> }
function LoadingScreen({ label = 'Chargement de ScolaPilot…' }) { return <div className="center-screen"><div className="loader-mark">S</div><strong>{label}</strong><span>Connexion sécurisée en cours</span></div> }
function SetupCard() { return <div className="center-screen"><div className="setup-card"><div className="logo-mini">S</div><h1>Configuration Supabase manquante</h1><p>Ajoutez <code>supabaseurl</code> et <code>anonkey</code> ou <code>Apikey</code> dans Vercel, puis redéployez l’application.</p></div></div> }
function AuthScreen({ mode, setMode, form, setForm, message, onSubmit }) { return <div className="auth-shell"><div className="auth-visual"><a href="/" className="cloud-brand"><img src="/assets/logo-light.svg" alt="ScolaPilot" /></a><div className="auth-visual-copy"><span className="cloud-eyebrow">Espace sécurisé</span><h1>Votre école mérite une gestion qui avance avec elle.</h1><p>Élèves, classes, paiements : commencez à organiser votre établissement depuis un seul espace.</p><div className="auth-stats"><span><b>16</b> niveaux intégrés</span><span><b>100%</b> vos données</span></div></div><div className="auth-orb orb-one"></div><div className="auth-orb orb-two"></div></div><div className="auth-box"><div className="auth-box-inner"><span className="mobile-logo">ScolaPilot</span><h2>{mode === 'login' ? 'Bon retour 👋' : 'Créer votre espace'}</h2><p>{mode === 'login' ? 'Connectez-vous à l’administration de votre école.' : 'Commencez par créer votre compte administrateur.'}</p><form onSubmit={onSubmit}>{mode === 'signup' && <Field label="Nom complet"><input required value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} placeholder="Ex. Ousmane Diallo" /></Field>}<Field label="Adresse e-mail"><input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="vous@ecole.com" /></Field><Field label="Mot de passe"><input required minLength="6" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="••••••••" /></Field>{message && <div className="auth-message">{message}</div>}<button className="primary-btn auth-submit" type="submit">{mode === 'login' ? 'Se connecter' : 'Créer mon compte'} <span>↗</span></button></form><div className="auth-switch">{mode === 'login' ? 'Pas encore de compte ?' : 'Vous avez déjà un compte ?'} <button type="button" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>{mode === 'login' ? 'Créer un compte' : 'Se connecter'}</button></div><a className="back-link" href="/">← Retour à la vitrine</a></div></div></div> }
function Onboarding({ user, form, setForm, message, onSubmit, loading, signOut }) { return <div className="onboarding-shell"><div className="onboarding-card"><a href="/" className="cloud-brand dark"><img src="/assets/logo.svg" alt="ScolaPilot" /></a><div className="onboarding-mark">✦</div><span className="cloud-eyebrow">Première étape</span><h1>Créons l’espace de votre école.</h1><p>Votre compte est prêt. Ajoutez les informations de l’établissement pour charger automatiquement les niveaux CP1 à Tle.</p><form onSubmit={onSubmit}><Field label="Nom de l’établissement"><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex. Complexe Scolaire Horizon" /></Field><div className="form-grid"><Field label="Ville"><input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="Ouagadougou" /></Field><Field label="Téléphone"><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+226 ..." /></Field></div>{message && <div className="auth-message">{message}</div>}<button className="primary-btn auth-submit" disabled={loading}>{loading ? 'Création…' : 'Créer mon espace école'} <span>↗</span></button></form><button type="button" className="back-link button-link" onClick={signOut}>Utiliser un autre compte</button></div></div> }

createRoot(document.getElementById('root')).render(<App />)
