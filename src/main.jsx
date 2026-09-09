import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import {
  ArrowUpRight, BarChart3, Bell, BookOpen, Bot, Check, CheckCircle2, ChevronLeft, ChevronRight,
  Circle, Clock3, ChevronDown, Edit3, Eye, FileText, FolderKanban, FolderOpen, FolderUp, ImagePlus, LayoutDashboard, Menu, MessageSquare,
  ExternalLink, Globe2, Monitor, Moon, MoreHorizontal, Palette, Plus, Save, Search, Send, Settings2, Sparkles, StickyNote, Sun, Target, Trash2, X, Zap
} from 'lucide-react'
import './styles.css'
import './task-effects.css'
import './dashboard-cards.css'
import './dashboard-capture.css'
import './result-chat.css'
import './surface-neutral.css'
import './theme.css'
import { db, exportDatabase, importDatabase, seedDatabase } from './db'

gsap.registerPlugin(useGSAP)

const nav = [
  { label: '总览', icon: LayoutDashboard },
  { label: 'AI 工作台', icon: Bot, badge: '3' },
  { label: '瞬记', icon: StickyNote },
  { label: '任务流', icon: FolderKanban },
  { label: '知识文档', icon: BookOpen },
  { label: '设计资源中心', icon: Palette },
]

const initialTasks = [
  { id: 1, title: '整理 Q3 用户访谈洞察', project: '增长实验室', time: '今天 14:00', color: 'lime', done: false },
  { id: 2, title: '确认 AI 工作台信息架构', project: '个人工作台', time: '今天 16:30', color: 'blue', done: true },
  { id: 3, title: '给设计团队同步结论', project: '增长实验室', time: '明天 09:30', color: 'coral', done: false },
]

const docs = [
  { folder: 'AI 工作台', title: '产品决策记录', type: '决策记录', count: 8, date: '刚刚更新', color: 'lime' },
  { folder: 'Q3 用户访谈', title: '主题聚类', type: '研究笔记', count: 12, date: '昨天', color: 'blue' },
  { folder: '增长实验室', title: '会议纪要', type: '会议纪要', count: 6, date: '8 月 31 日', color: 'coral' },
]

const conversations = [
  { title: 'Q3 用户访谈洞察', meta: '今天 09:12', active: true },
  { title: '竞品动态周报', meta: '昨天 16:40' },
  { title: '落地页文案变体', meta: '8 月 31 日' },
  { title: '会议纪要整理', meta: '8 月 30 日' },
]

function getDocumentTitle(content, filename) {
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  const frontmatterTitle = frontmatter?.[1].match(/^title:\s*["']?(.+?)["']?\s*$/m)?.[1]
  const heading = content.match(/^#\s+(.+)$/m)?.[1]
  return (frontmatterTitle || heading || filename.replace(/\.(md|markdown)$/i, '')).trim()
}

function getFolderPathsFromPath(path) {
  const folders = path.split('/').filter(Boolean).slice(1, -1).slice(0, 3)
  return folders.length ? folders.map((_, index) => folders.slice(0, index + 1).join('/')) : [DEFAULT_FOLDER]
}

function getExcerpt(content) {
  return content.replace(/^---[\s\S]*?---\s*/m, '').replace(/^#{1,6}\s+.*$/gm, '').replace(/!?(?:\[([^\]]*)\])?\([^)]*\)/g, '$1').replace(/[`*_>#-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150)
}

const getDocumentUpdatedAt = (document) => document?.updatedAt ?? document?.importedAt ?? 0
const sortDocumentsByUpdate = (documents) => [...documents].sort((left, right) => getDocumentUpdatedAt(right) - getDocumentUpdatedAt(left))
const getFolderLabel = (folder) => folder?.label ?? folder?.name?.split('/').at(-1) ?? DEFAULT_FOLDER
const getFolderBreadcrumb = (folder) => folder?.name ?? DEFAULT_FOLDER
const getFolderDepth = (folder) => folder?.name?.split('/').length ?? 3
const sortFolders = (folders) => [...folders].sort((left, right) => (left.parent || '').localeCompare(right.parent || '', 'zh-CN') || getFolderLabel(left).localeCompare(getFolderLabel(right), 'zh-CN'))
const formatDocumentDate = (document, withTime = false) => new Intl.DateTimeFormat('zh-CN', withTime ? { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' } : { month: 'short', day: 'numeric' }).format(getDocumentUpdatedAt(document))
const formatTaskDueAt = (dueAt) => {
  const due = new Date(dueAt)
  const today = new Date()
  const tomorrow = new Date(today)
  today.setHours(0, 0, 0, 0)
  tomorrow.setHours(24, 0, 0, 0)
  const time = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(due)
  if (due >= today && due < tomorrow) return `今天 ${time}`
  const nextDay = new Date(tomorrow)
  nextDay.setHours(24, 0, 0, 0)
  if (due >= tomorrow && due < nextDay) return `明天 ${time}`
  return `${new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' }).format(due)} ${time}`
}

function AIWorkspace({ prompt, setPrompt, sent, sendPrompt, profile }) {
  return <div className="ai-workspace">
    <section className="ai-workspace-head"><div><p className="date-line">AI 工作台 <span className="live-dot" /> 上下文已同步</p><h1>把复杂问题，变成清晰下一步。</h1><p className="lede">连接你的任务与知识文档，和 AI 一起完成研究、分析与决策。</p></div><button className="primary-btn"><Plus size={17} /> 新建对话</button></section>
    <div className="ai-layout">
      <aside className="conversation-list"><div className="conversation-head"><strong>最近对话</strong><button className="icon-btn small" aria-label="更多对话"><MoreHorizontal size={16} /></button></div><button className="new-chat"><Plus size={15} /> 开始新对话</button>{conversations.map((item) => <button className={`conversation-item ${item.active ? 'active' : ''}`} key={item.title}><div className="conversation-icon"><MessageSquare size={15} /></div><div><strong>{item.title}</strong><small>{item.meta}</small></div><ChevronRight size={14} className="muted" /></button>)}</aside>
      <section className="chat-surface"><div className="chat-header"><div><span className="eyebrow"><Bot size={13} /> ORBIT AI</span><h2>Q3 用户访谈洞察</h2></div><div className="chat-header-actions"><span className="model-pill">Orbit Reasoning <ChevronRight size={12} /></span><button className="icon-btn small" aria-label="对话设置"><Settings2 size={16} /></button></div></div><div className="chat-body"><div className="message user-message"><div className="message-avatar user">{profile.avatar ? <img src={profile.avatar} alt="" /> : profile.name.slice(0, 1).toLocaleUpperCase()}</div><div><span className="message-label">{profile.name} · 09:10</span><p>帮我从最近的用户访谈里，找出最值得今天验证的产品问题。</p></div></div><div className="message ai-message"><div className="message-avatar ai"><Sparkles size={14} /></div><div><span className="message-label">Orbit AI · 09:12</span><p>最值得验证的是：<strong>首次使用的理解成本正在阻碍用户完成第一次关键动作。</strong></p><p>我在 4 份访谈中找到 11 次相关表达，集中在“入口不知道点哪里”和“看不懂下一步”两个环节。</p><div className="answer-block"><div className="answer-row"><span className="answer-index">01</span><div><strong>建议验证</strong><span>首屏引导是否能让新用户在 30 秒内完成第一次关键动作</span></div></div><div className="answer-row"><span className="answer-index">02</span><div><strong>推荐方法</strong><span>邀请 5 位新用户完成无提示体验，记录首次犹豫点</span></div></div></div><div className="source-row"><span><BookOpen size={13} /> 引用 4 份文档</span><button className="text-btn">展开来源 <ArrowUpRight size={14} /></button></div></div></div></div><form className="chat-composer" onSubmit={sendPrompt}><div className="composer-context"><span><BookOpen size={13} /> 工作台上下文</span><button type="button">清除</button></div><div className="composer-input"><input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="继续追问，或让 AI 帮你完成下一步..." aria-label="继续追问" /><button type="submit" aria-label="发送"><Send size={16} /></button></div>{sent && <div className="sent-toast"><Check size={13} /> 已加入当前对话</div>}</form></section>
      <aside className="ai-context"><div className="context-title"><span>当前上下文</span><button className="icon-btn small" aria-label="编辑上下文"><Settings2 size={15} /></button></div><div className="context-score"><div><strong>82</strong><span>上下文相关度</span></div><div className="score-ring"><span>良好</span></div></div><div className="context-section"><span className="context-label">已连接来源</span><div className="context-source"><div className="result-icon lime"><BookOpen size={15} /></div><div><strong>知识文档</strong><small>4 份已引用</small></div><CheckCircle2 size={14} className="source-check" /></div><div className="context-source"><div className="result-icon blue"><FolderKanban size={15} /></div><div><strong>任务流</strong><small>3 个相关任务</small></div><CheckCircle2 size={14} className="source-check" /></div></div><div className="context-section"><span className="context-label">今日调用</span><div className="call-stat"><span>已用 tokens</span><strong>6.8k <small>/ 10k</small></strong></div><div className="progress"><i style={{ width: '68%' }} /></div><div className="call-stat"><span>本月剩余</span><strong>15.8k</strong></div></div><button className="view-all-btn">管理 AI 偏好 <ArrowUpRight size={14} /></button></aside>
    </div>
    <section className="ai-shortcuts"><div><h3>从这里开始</h3><p>几个适合今天的工作动作</p></div><button><Sparkles size={15} /><span><strong>总结今日重点</strong><small>基于任务和文档生成行动清单</small></span><ArrowUpRight size={14} /></button><button><BarChart3 size={15} /><span><strong>分析一份数据</strong><small>发现趋势、异常与可验证假设</small></span><ArrowUpRight size={14} /></button><button><FileText size={15} /><span><strong>整理会议纪要</strong><small>提取决定、负责人和下一步</small></span><ArrowUpRight size={14} /></button></section>
  </div>
}

function QuickNoteCapture({ noteText, setNoteText, noteImage, noteError, onImageChange, onSave, clearImage, isSavingNote, onOpenNotes }) {
  return <section className="quick-capture">
    <div className="quick-capture-head"><div><span className="eyebrow"><StickyNote size={13} /> 瞬记</span><h3>把刚想到的记下来</h3></div><button className="subtle-btn" type="button" onClick={onOpenNotes}>查看全部 <ArrowUpRight size={14} /></button></div>
    <form onSubmit={onSave}><textarea value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="此刻你在想什么？" aria-label="瞬记内容" rows="3" />{noteImage && <div className="image-preview"><img src={noteImage.dataUrl} alt="待保存的图片" /><div><strong>{noteImage.name}</strong><small>随这条瞬记一起保存</small></div><button type="button" className="icon-btn small" onClick={clearImage} aria-label="移除图片"><X size={16} /></button></div>}{noteError && <p className="note-error">{noteError}</p>}<div className="note-composer-actions"><label className="attachment-btn" htmlFor="dashboard-note-image"><ImagePlus size={16} /> 添加图片</label><input id="dashboard-note-image" type="file" accept="image/*" onChange={onImageChange} /><span>文字或一张图片</span><button className="primary-btn" type="submit" disabled={isSavingNote}>{isSavingNote ? '保存中...' : <><Send size={16} /> 记录下来</>}</button></div></form>
  </section>
}

function DashboardNoteHistory({ notes, onOpenNotes }) {
  if (!notes.length) return null
  return <section className="dashboard-note-history"><div className="section-heading"><div><h3>瞬记记录</h3><p>已经保存的想法，留在今天的工作脉络里。</p></div><button className="subtle-btn" type="button" onClick={onOpenNotes}>查看全部 <ArrowUpRight size={15} /></button></div><div className="dashboard-note-list">{notes.slice(0, 2).map((note) => <button className="dashboard-note-item" type="button" key={note.id} onClick={onOpenNotes}><div className="dashboard-note-stamp"><StickyNote size={14} /><time>{new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(note.createdAt)}</time></div><p>{note.content || '已添加一张图片'}</p>{note.image && <img src={note.image.dataUrl} alt="" />}</button>)}</div></section>
}

function QuickNotes({ notes, noteText, setNoteText, noteImage, noteError, onImageChange, onSave, clearImage, isSavingNote }) {
  return <div className="quick-notes">
    <section className="quick-notes-head"><div><p className="date-line">瞬记 <span className="live-dot" /> 自动保存到本地</p><h1>不让任何一个想法溜走。</h1><p className="lede">灵感、问题、截图和零散判断，先记下来。整理和归类，留给之后的自己。</p></div><div className="note-count"><strong>{notes.length}</strong><span>条已记录</span></div></section>
    <section className="note-composer"><div className="note-composer-head"><span className="eyebrow"><Sparkles size={13} /> 新的瞬记</span><span>今天</span></div><form onSubmit={onSave}><textarea value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="此刻你在想什么？" aria-label="瞬记内容" rows="5" />{noteImage && <div className="image-preview"><img src={noteImage.dataUrl} alt="待保存的图片" /><div><strong>{noteImage.name}</strong><small>随这条瞬记一起保存</small></div><button type="button" className="icon-btn small" onClick={clearImage} aria-label="移除图片"><X size={16} /></button></div>}{noteError && <p className="note-error">{noteError}</p>}<div className="note-composer-actions"><label className="attachment-btn" htmlFor="note-image"><ImagePlus size={16} /> 添加图片</label><input id="note-image" type="file" accept="image/*" onChange={onImageChange} /><span>文字或一张图片</span><button className="primary-btn" type="submit" disabled={isSavingNote}>{isSavingNote ? '保存中...' : <><Send size={16} /> 记录下来</>}</button></div></form></section>
    <section className="notes-feed"><div className="section-heading"><div><h3>最近的瞬记</h3><p>按记录时间倒序排列。</p></div></div>{notes.length ? <div className="notes-grid">{notes.map((note) => <article className="note-card" key={note.id}><div className="note-card-top"><span><StickyNote size={14} /> 瞬记</span><time>{new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(note.createdAt)}</time></div>{note.content && <p>{note.content}</p>}{note.image && <img className="note-image" src={note.image.dataUrl} alt={note.image.name || '瞬记图片'} />}</article>)}</div> : <div className="notes-empty"><StickyNote size={20} /><strong>第一条想法，从这里开始。</strong><span>写下一段文字，或附上一张图片。</span></div>}</section>
  </div>
}

function DesignResources({ resources, selectedResource, onSelect, onAdd, onDelete }) {
  const resourceRef = useRef(null)
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [category, setCategory] = useState('灵感站点')
  const [error, setError] = useState('')

  useGSAP(() => {
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.timeline({ defaults: { ease: 'power3.out' } })
        .from('.design-resources-header', { y: 16, autoAlpha: 0, duration: 0.42 })
        .from('.resource-collection', { x: -14, autoAlpha: 0, duration: 0.42 }, '-=0.2')
        .from('.design-preview-stage', { y: 14, autoAlpha: 0, duration: 0.48 }, '-=0.24')
    })
    return () => mm.revert()
  }, { scope: resourceRef })
  useGSAP(() => {
    if (!selectedResource) return
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo('.design-preview-stage', { autoAlpha: 0.5, y: 10, scale: 0.992 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.32, ease: 'power2.out', clearProps: 'transform' })
    })
    return () => mm.revert()
  }, { scope: resourceRef, dependencies: [selectedResource?.id], revertOnUpdate: true })

  const submit = async (event) => {
    event.preventDefault()
    let parsed
    try {
      parsed = new URL(url.trim())
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error()
    } catch {
      setError('请输入以 http:// 或 https:// 开头的有效网址。')
      return
    }
    await onAdd({ title: title.trim() || parsed.hostname.replace(/^www\./, ''), url: parsed.href, category })
    setTitle('')
    setUrl('')
    setCategory('灵感站点')
    setError('')
    setAdding(false)
  }

  return <div className="design-resources-page" ref={resourceRef}>
    <section className="design-resources-header"><div><p className="date-line">设计收藏 <span className="live-dot" /> 保存在当前浏览器</p><h1>让灵感，随时回到工作流。</h1><p className="lede">集中收录值得反复研究的 UI、组件、字体与视觉参考，在一个预览面板中快速回看。</p></div><button className="primary-btn" type="button" onClick={() => { setAdding((current) => !current); setError('') }}><Plus size={17} /> 添加资源</button></section>
    {adding && <form className="resource-add-form" onSubmit={submit}><label><span>名称</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：Mobbin" maxLength="80" /></label><label className="resource-url-field"><span>网址</span><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://..." type="url" inputMode="url" required autoFocus /></label><label><span>分类</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option>灵感站点</option><option>组件库</option><option>字体与配色</option><option>未分类</option></select></label><div className="resource-form-actions"><button className="primary-btn" type="submit"><Save size={16} /> 收藏资源</button><button className="icon-btn" type="button" onClick={() => { setAdding(false); setError('') }} aria-label="取消添加资源"><X size={17} /></button></div>{error && <p className="resource-form-error" role="alert">{error}</p>}</form>}
    <div className="design-resources-layout"><aside className="resource-collection"><div className="resource-collection-head"><div><h2>已收藏</h2><p>{resources.length} 个设计资源</p></div></div>{resources.length ? <div className="resource-list">{resources.map((resource) => <article className={`resource-row ${selectedResource?.id === resource.id ? 'active' : ''}`} key={resource.id}><button className="resource-row-main" type="button" onClick={() => onSelect(resource)}><span className="resource-icon"><Globe2 size={17} /></span><span><strong>{resource.title}</strong><small>{resource.category}</small></span></button><button className="icon-btn small resource-delete" type="button" onClick={() => onDelete(resource)} aria-label={`删除 ${resource.title}`}><Trash2 size={15} /></button></article>)}</div> : <div className="resource-empty"><Palette size={22} /><strong>收藏第一个设计资源</strong><span>把常看的设计网站、组件库或灵感页收进来。</span><button className="text-btn" type="button" onClick={() => setAdding(true)}>添加资源 <Plus size={14} /></button></div>}</aside>
      <section className="design-preview-stage">{selectedResource ? <><header className="design-preview-head"><div><span>{selectedResource.category}</span><h2>{selectedResource.title}</h2></div><a className="icon-btn" href={selectedResource.url} target="_blank" rel="noreferrer" aria-label={`在新窗口打开 ${selectedResource.title}`} title="在新窗口打开"><ExternalLink size={18} /></a></header><div className="resource-address"><Globe2 size={15} /><span>{selectedResource.url}</span></div><div className="resource-frame-wrap"><iframe key={selectedResource.id} src={selectedResource.url} title={`${selectedResource.title} 预览`} sandbox="allow-scripts allow-forms allow-popups" referrerPolicy="no-referrer" loading="eager" /></div><p className="resource-preview-note">部分网站会因安全策略禁止嵌入；遇到空白预览时，可使用右上角在新窗口打开。</p></> : <div className="resource-preview-empty"><div className="resource-preview-mark"><Palette size={28} /></div><h2>这里会成为你的设计参考台。</h2><p>添加一条网址后，在左侧选择资源即可开始预览。</p></div>}</section></div>
  </div>
}

function DocumentEditor({ document, folders, onChange, onSave, onDelete, onCancel }) {
  const [preview, setPreview] = useState(!document.isNew)
  const [saveState, setSaveState] = useState(document.isNew ? '本地草稿' : '已保存')
  const [savedNotice, setSavedNotice] = useState(false)
  const [markdownTheme, setMarkdownTheme] = useState(() => localStorage.getItem('orbit-markdown-theme') || 'system')
  const editorRef = useRef(null)
  const documentRef = useRef(document)
  const dirtyRef = useRef(false)
  const saveTimer = useRef(null)
  const noticeTimer = useRef(null)
  const savePromise = useRef(null)

  useEffect(() => {
    if (!dirtyRef.current) documentRef.current = document
  }, [document])
  useEffect(() => () => { window.clearTimeout(saveTimer.current); window.clearTimeout(noticeTimer.current) }, [])
  useGSAP(() => {
    if (!savedNotice) return
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo('.editor-saved-toast', { autoAlpha: 0, y: -8, scale: 0.96 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.24, ease: 'power2.out' })
    })
    return () => mm.revert()
  }, { scope: editorRef, dependencies: [savedNotice], revertOnUpdate: true })

  const persist = () => {
    if (savePromise.current) return savePromise.current
    if (!dirtyRef.current) return Promise.resolve()
    const current = documentRef.current
    setSaveState('保存中...')
    savePromise.current = onSave(current).then((saved) => {
      if (documentRef.current !== current) {
        setSaveState('等待保存...')
        window.setTimeout(() => { void persist() }, 0)
        return
      }
      documentRef.current = saved
      dirtyRef.current = false
      onChange(saved)
      setSaveState('已保存')
      setSavedNotice(true)
      window.clearTimeout(noticeTimer.current)
      noticeTimer.current = window.setTimeout(() => setSavedNotice(false), 2200)
    }).catch(() => setSaveState('保存失败')).finally(() => { savePromise.current = null })
    return savePromise.current
  }
  const scheduleSave = () => {
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => { void persist() }, 650)
  }
  const updateDocument = (changes) => {
    const next = { ...documentRef.current, ...changes }
    documentRef.current = next
    dirtyRef.current = true
    onChange(next)
    setSaveState('等待保存...')
    scheduleSave()
  }
  const closeEditor = async () => {
    window.clearTimeout(saveTimer.current)
    await persist()
    if (dirtyRef.current) await persist()
    onCancel()
  }
  const changeMarkdownTheme = (theme) => { setMarkdownTheme(theme); localStorage.setItem('orbit-markdown-theme', theme) }
  const deleteDocument = () => { void onDelete(documentRef.current) }
  const currentFolder = folders.find((folder) => folder.name === document.project)
  return <div className="editor-page" ref={editorRef} data-markdown-theme={markdownTheme}><header className="editor-topbar"><button className="editor-back" onClick={closeEditor}><X size={16} /> 返回知识库</button><div className="editor-actions">{!document.isNew && <button className="danger-btn editor-delete" type="button" onClick={deleteDocument}><Trash2 size={15} /> 删除文档</button>}<button className={`editor-tab ${!preview ? 'active' : ''}`} onClick={() => setPreview(false)}><Edit3 size={14} /> 编辑</button><button className={`editor-tab ${preview ? 'active' : ''}`} onClick={() => setPreview(true)}><Eye size={14} /> 预览</button>{preview && <select className="markdown-theme-select" value={markdownTheme} onChange={(event) => changeMarkdownTheme(event.target.value)} aria-label="阅读主题"><option value="system">跟随界面</option><option value="paper">纸白</option><option value="ink">墨黑</option></select>}<span className="editor-save" role="status"><Save size={15} /> {saveState}</span></div></header>{savedNotice && <div className="editor-saved-toast" role="status"><CheckCircle2 size={15} /> 已保存</div>}<main className="editor-stage"><div className="editor-document-head">{preview ? <><h1 className="document-title-preview">{document.title || '未命名文档'}</h1><div className="editor-project-row"><span>所属分类</span><strong>{getFolderBreadcrumb(currentFolder)}</strong></div></> : <><input className="document-title-input" id="document-title" value={document.title} onChange={(event) => updateDocument({ title: event.target.value })} aria-label="文档标题" placeholder="未命名文档" autoFocus /><div className="editor-project-row"><label htmlFor="document-project">所属分类</label><select id="document-project" value={document.project} onChange={(event) => updateDocument({ project: event.target.value })} aria-label="所属分类">{folders.map((folder) => <option key={folder.name} value={folder.name}>{getFolderBreadcrumb(folder)}</option>)}</select></div></>}</div><section className="editor-work-area">{preview ? <div className="markdown-preview">{document.content.trim() ? <div className="markdown-preview-content"><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}>{document.content}</ReactMarkdown></div> : <span className="preview-empty">暂无内容</span>}</div> : <textarea className="markdown-editor" value={document.content} onChange={(event) => updateDocument({ content: event.target.value })} spellCheck="false" aria-label="Markdown 文档内容" placeholder="# 从这里开始写" />}</section></main><footer className="editor-status"><span>{document.isNew ? 'Markdown · 仅保存在本地知识库' : document.path}</span><span>{document.content.length} 字符</span></footer></div>
}

function KnowledgeBase({ documents, folders, importStatus, onImport, onExportBackup, onRestoreBackup, selectedPaths, onToggleSelected, onToggleAll, onDeleteSelected, onCreate, onEdit, onCreateFolder, onRenameFolder, activeProject, onOpenProject, onCloseProject }) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('updated')
  const [visibleCount, setVisibleCount] = useState(30)
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [renamingFolder, setRenamingFolder] = useState(null)
  const [renamedFolder, setRenamedFolder] = useState('')
  const [folderError, setFolderError] = useState('')
  const groupedDocuments = documents.reduce((groups, document) => {
    const folder = document.project || DEFAULT_FOLDER
    groups[folder] ??= []
    groups[folder].push(document)
    return groups
  }, {})
  const activeFolder = folders.find((folder) => folder.name === activeProject)
  const folderEntries = folders.filter((folder) => !folder.parent).map((folder) => ({ folder, documents: sortDocumentsByUpdate(groupedDocuments[folder.name] || []) })).sort((left, right) => getDocumentUpdatedAt(right.documents[0]) - getDocumentUpdatedAt(left.documents[0]) || getFolderLabel(left.folder).localeCompare(getFolderLabel(right.folder), 'zh-CN'))
  const childFolders = activeProject ? folders.filter((folder) => folder.parent === activeProject) : []
  const recentDocuments = sortDocumentsByUpdate(documents).slice(0, 6)
  const projectDocuments = activeProject ? sortDocumentsByUpdate(groupedDocuments[activeProject] || []) : []
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filteredDocuments = projectDocuments.filter((document) => !normalizedQuery || [document.title, document.excerpt, document.path].some((value) => value?.toLocaleLowerCase().includes(normalizedQuery)))
  const sortedDocuments = sort === 'title' ? [...filteredDocuments].sort((left, right) => left.title.localeCompare(right.title, 'zh-CN')) : filteredDocuments
  const visibleDocuments = sortedDocuments.slice(0, visibleCount)
  const selectedProjectPaths = selectedPaths.filter((path) => projectDocuments.some((document) => document.path === path))
  const allVisibleSelected = visibleDocuments.length > 0 && visibleDocuments.every((document) => selectedPaths.includes(document.path))

  useEffect(() => setVisibleCount(30), [activeProject, query, sort])

  const submitFolder = async (event) => {
    event.preventDefault()
    try {
      await onCreateFolder(folderName, activeProject)
      setFolderName('')
      setCreatingFolder(false)
      setFolderError('')
    } catch (error) {
      setFolderError(error.message)
    }
  }
  const submitRename = async (event, folder) => {
    event.preventDefault()
    try {
      await onRenameFolder(folder, renamedFolder)
      setRenamingFolder(null)
      setFolderError('')
    } catch (error) {
      setFolderError(error.message)
    }
  }

  const closeImportMenu = (event, callback) => { event.currentTarget.closest('details').open = false; callback(event) }
  const importPanel = <div className="knowledge-import-menu"><details><summary className="subtle-btn"><FolderUp size={16} /> 导入 <ChevronDown size={14} /></summary><div className="import-menu-content"><span className="import-menu-label">导入来源</span><label className="import-menu-item" htmlFor="obsidian-folder"><FolderUp size={16} /><span><strong>Obsidian</strong><small>选择本地知识库文件夹</small></span></label><input id="obsidian-folder" type="file" accept=".md,.markdown,text/markdown" multiple webkitdirectory="" onChange={(event) => closeImportMenu(event, onImport)} /><div className="import-menu-divider" /><button className="import-menu-item" onClick={onExportBackup}><Save size={16} /><span><strong>导出本地备份</strong><small>下载当前工作台数据</small></span></button><label className="import-menu-item" htmlFor="orbit-backup"><FolderUp size={16} /><span><strong>恢复本地备份</strong><small>导入之前导出的数据</small></span></label><input id="orbit-backup" type="file" accept="application/json,.json" onChange={(event) => closeImportMenu(event, onRestoreBackup)} /></div></details>{importStatus && <p className={`knowledge-import-status ${importStatus.error ? 'error' : ''}`} role="status">{importStatus.message}</p>}</div>

  if (activeProject) return <div className="knowledge-base knowledge-project-page">
    <section className="knowledge-project-head"><div><button className="knowledge-back" onClick={onCloseProject}><ChevronLeft size={16} /> 知识文档</button><p className="date-line">文件夹 <span className="live-dot" /> {projectDocuments.length} 篇文档</p><h1>{getFolderBreadcrumb(activeFolder)}</h1><p className="lede">在这里浏览、筛选和管理这个文件夹中的 Markdown 文档。</p></div><div className="knowledge-actions">{getFolderDepth(activeFolder) < 3 && <button className="primary-btn" onClick={() => { setCreatingFolder(true); setFolderError('') }}><FolderKanban size={16} /> 新建子文件夹</button>}<button className="primary-btn" onClick={() => onCreate(activeProject)}><Plus size={17} /> 新建文档</button></div></section>
    {creatingFolder && <form className="folder-name-form" onSubmit={submitFolder}><FolderKanban size={17} /><input value={folderName} onChange={(event) => setFolderName(event.target.value)} placeholder="输入子文件夹名称" aria-label="子文件夹名称" autoFocus /><button className="icon-btn small" type="submit" aria-label="创建子文件夹"><Check size={16} /></button><button className="icon-btn small" type="button" onClick={() => { setCreatingFolder(false); setFolderError('') }} aria-label="取消创建"><X size={16} /></button>{folderError && <span className="folder-form-error">{folderError}</span>}</form>}
    {childFolders.length > 0 && <section className="knowledge-list folder-browser nested-folder-browser"><div className="section-heading"><div><h3>子文件夹</h3><p>进入下一级后继续管理文档，最多支持三级。</p></div><span className="folder-count">{childFolders.length} 个文件夹</span></div><div className="folder-grid">{childFolders.map((folder) => <button className="folder-card" key={folder.name} onClick={() => onOpenProject(folder.name)}><div className="folder-card-icon"><FolderKanban size={20} /></div><div className="folder-card-copy"><strong>{getFolderLabel(folder)}</strong><span>{(groupedDocuments[folder.name] || []).length} 篇文档</span></div><ChevronRight size={16} /></button>)}</div></section>}
    <section className="knowledge-project-toolbar"><label className="document-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索本项目文档" aria-label="搜索本项目文档" /></label><label className="document-sort">排序<select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="文档排序"><option value="updated">最近修改</option><option value="title">文档标题</option></select></label></section>
    <section className="knowledge-list"><div className="section-heading"><div><h3>全部文档</h3><p>{normalizedQuery ? `找到 ${sortedDocuments.length} 篇匹配文档` : `共 ${projectDocuments.length} 篇文档`}</p></div>{visibleDocuments.length > 0 && <div className="document-tools"><label className="select-all"><input type="checkbox" checked={allVisibleSelected} onChange={() => onToggleAll(visibleDocuments)} /> <span>全选本页</span></label>{selectedProjectPaths.length > 0 && <><span className="selected-count">已选择 {selectedProjectPaths.length} 篇</span><button className="danger-btn" onClick={onDeleteSelected}><Trash2 size={15} /> 删除所选</button></>}</div>}</div>{sortedDocuments.length ? <div className="document-rows project-document-rows">{visibleDocuments.map((document) => <article className={`document-row ${selectedPaths.includes(document.path) ? 'selected' : ''}`} key={document.path}><label className="document-check"><input type="checkbox" checked={selectedPaths.includes(document.path)} onChange={() => onToggleSelected(document.path)} aria-label={`选择 ${document.title}`} /><span /></label><div className="document-icon"><FileText size={17} /></div><div className="document-main"><button className="document-title-btn" onClick={() => onEdit(document)}>{document.title}</button><p>{document.excerpt || '没有可预览的正文内容。'}</p></div><div className="document-meta"><span>{document.path.split('/').slice(-1)[0]}</span><time>{formatDocumentDate(document)}</time></div><button className="icon-btn small document-edit" onClick={() => onEdit(document)} aria-label={`编辑 ${document.title}`}><Edit3 size={15} /></button></article>)}</div> : <div className="knowledge-empty"><FileText size={22} /><strong>{normalizedQuery ? '没有找到匹配文档。' : '这个项目还没有文档。'}</strong><span>{normalizedQuery ? '换一个关键词试试。' : '从这里新建一篇，或重新导入本地文件夹。'}</span></div>}{visibleDocuments.length < sortedDocuments.length && <button className="load-more-documents" onClick={() => setVisibleCount((count) => count + 30)}>加载更多文档（还剩 {sortedDocuments.length - visibleDocuments.length} 篇）</button>}</section>
  </div>

  return <div className="knowledge-base">
    <section className="knowledge-header"><div><p className="date-line">本地知识库 <span className="live-dot" /> 不会同步到远程</p><h1>你的工作记忆，按文件夹归位。</h1><p className="lede">最近变动优先呈现，文档在对应文件夹中持续生长。</p></div><div className="knowledge-actions">{importPanel}<button className="primary-btn" onClick={() => { setCreatingFolder(true); setFolderError('') }}><FolderKanban size={16} /> 新建文件夹</button><button className="primary-btn" onClick={() => onCreate(DEFAULT_FOLDER)}><Plus size={17} /> 新建文档</button><div className="knowledge-count"><strong>{documents.length}</strong><span>篇本地文档</span></div></div></section>
    {creatingFolder && <form className="folder-name-form" onSubmit={submitFolder}><FolderKanban size={17} /><input value={folderName} onChange={(event) => setFolderName(event.target.value)} placeholder="输入文件夹名称" aria-label="文件夹名称" autoFocus /><button className="icon-btn small" type="submit" aria-label="创建文件夹"><Check size={16} /></button><button className="icon-btn small" type="button" onClick={() => { setCreatingFolder(false); setFolderError('') }} aria-label="取消创建"><X size={16} /></button>{folderError && <span className="folder-form-error">{folderError}</span>}</form>}
    {documents.length > 0 && <section className="knowledge-list recent-changes"><div className="section-heading"><div><h3>最近变动</h3><p>新建、导入或修改过的文档会优先显示在这里。</p></div><span className="recent-limit">最近 6 篇</span></div><div className="recent-document-list">{recentDocuments.map((document) => <button className="recent-document" key={document.path} onClick={() => { onOpenProject(document.project || DEFAULT_FOLDER); onEdit(document) }}><div className="document-icon"><FileText size={17} /></div><div><strong>{document.title}</strong><span>{document.project || DEFAULT_FOLDER} · {document.excerpt || '没有可预览的正文内容。'}</span></div><time>{formatDocumentDate(document, true)}</time><ChevronRight size={16} /></button>)}</div></section>}
    <section className="knowledge-list folder-browser"><div className="section-heading"><div><h3>文件夹</h3><p>首页展示一级文件夹，进入后可继续管理下级文件夹与文档。</p></div><span className="folder-count">{folderEntries.length} 个一级文件夹</span></div><div className="folder-grid">{folderEntries.map(({ folder, documents: folderDocuments }) => <article className="folder-card" key={folder.name}>{renamingFolder === folder.name ? <form className="folder-card-rename" onSubmit={(event) => submitRename(event, folder.name)}><input value={renamedFolder} onChange={(event) => setRenamedFolder(event.target.value)} aria-label="新的文件夹名称" autoFocus /><button className="icon-btn small" type="submit" aria-label="保存文件夹名称"><Check size={15} /></button><button className="icon-btn small" type="button" onClick={() => { setRenamingFolder(null); setFolderError('') }} aria-label="取消重命名"><X size={15} /></button>{folderError && <span className="folder-form-error">{folderError}</span>}</form> : <><div className="folder-card-top"><button className="folder-card-main" onClick={() => onOpenProject(folder.name)}><div className="folder-card-icon"><FolderKanban size={20} /></div><div className="folder-card-copy"><strong>{getFolderLabel(folder)}</strong><span>{folderDocuments.length} 篇文档{folderDocuments[0] ? ` · 最近 ${formatDocumentDate(folderDocuments[0])}` : ''}</span></div><ChevronRight size={16} /></button><button className="icon-btn small folder-rename" onClick={() => { setRenamingFolder(folder.name); setRenamedFolder(getFolderLabel(folder)); setFolderError('') }} aria-label={`重命名 ${getFolderLabel(folder)}`}><Edit3 size={15} /></button></div><div className="folder-document-list">{folderDocuments.length ? folderDocuments.slice(0, 3).map((document) => <button key={document.path} onClick={() => { onOpenProject(folder.name); onEdit(document) }}><FileText size={14} /><span>{document.title}</span></button>) : <span className="folder-empty">暂无文档</span>}</div></>}</article>)}</div></section>
  </div>

  return <div className="knowledge-base">
    <section className="knowledge-header"><div><p className="date-line">本地知识库 <span className="live-dot" /> 不会同步到远程</p><h1>你的工作记忆，按项目归位。</h1><p className="lede">最近变动优先呈现，历史文档按项目文件夹收纳。</p></div><div className="knowledge-actions"><button className="primary-btn" onClick={() => onCreate('未分类')}><Plus size={17} /> 新建文档</button><div className="knowledge-count"><strong>{documents.length}</strong><span>篇本地文档</span></div></div></section>
    {importPanel}
    {documents.length ? <><section className="knowledge-list recent-changes"><div className="section-heading"><div><h3>最近变动</h3><p>新建、导入或修改过的文档会优先显示在这里。</p></div><span className="recent-limit">最近 6 篇</span></div><div className="recent-document-list">{recentDocuments.map((document) => <button className="recent-document" key={document.path} onClick={() => { onOpenProject(document.project || '未分类'); onEdit(document) }}><div className="document-icon"><FileText size={17} /></div><div><strong>{document.title}</strong><span>{document.project || '未分类'} · {document.excerpt || '没有可预览的正文内容。'}</span></div><time>{formatDocumentDate(document, true)}</time><ChevronRight size={16} /></button>)}</div></section><section className="knowledge-list folder-browser"><div className="section-heading"><div><h3>项目文件夹</h3><p>历史文档按项目收纳，进入后再集中管理。</p></div><span className="folder-count">{projectEntries.length} 个项目</span></div><div className="folder-grid">{projectEntries.map(({ project, documents: projectDocs }) => <button className="folder-card" key={project} onClick={() => onOpenProject(project)}><div className="folder-card-icon"><FolderKanban size={20} /></div><div className="folder-card-copy"><strong>{project}</strong><span>{projectDocs.length} 篇文档 · 最近 {formatDocumentDate(projectDocs[0])}</span><small>{projectDocs[0].title}</small></div><ChevronRight size={16} /></button>)}</div></section></> : <section className="knowledge-list"><div className="knowledge-empty"><FolderUp size={22} /><strong>从一个 Obsidian 文件夹开始。</strong><span>导入后，最近变动和项目文件夹都会出现在这里。</span></div></section>}
  </div>
}

function AIAssistantPanel({ prompt, setPrompt, sent, sendPrompt }) {
  return <section className="ai-panel dashboard-ai-panel"><div className="ai-panel-top"><div><span className="eyebrow"><Bot size={13} /> AI 助手</span><h3>把想法变成下一步</h3></div><span className="status-pill"><i /> 在线</span></div><p>从你的工作台上下文开始提问，AI 会引用相关任务和文档。</p><form className="prompt-box" onSubmit={sendPrompt}><input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="问问你的工作台..." aria-label="问问你的工作台" /><button aria-label="发送" type="submit"><Send size={16} /></button></form>{sent && <div className="sent-toast"><Check size={13} /> 已加入 AI 对话</div>}<div className="prompt-suggestions"><button type="button" onClick={() => setPrompt('总结我今天最重要的三件事')}>总结今天 <ArrowUpRight size={13} /></button><button type="button" onClick={() => setPrompt('哪些任务可以交给 AI？')}>找点灵感 <ArrowUpRight size={13} /></button></div></section>
}

function UsageStats({ tasks, documents, folders, notes }) {
  const usageRef = useRef(null)
  const completedTasks = tasks.filter((task) => task.done).length
  const completionRate = tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const updatedToday = documents.filter((document) => getDocumentUpdatedAt(document) >= today.getTime()).length
  const contentCharacters = documents.reduce((total, document) => total + (document.content?.length || 0), 0)
  const folderActivity = folders.map((folder) => ({ name: getFolderBreadcrumb(folder), count: documents.filter((document) => (document.project || DEFAULT_FOLDER) === folder.name).length })).sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, 'zh-CN')).slice(0, 6)
  const mostDocuments = folderActivity[0]?.count || 1
  useGSAP(() => {
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.timeline({ defaults: { ease: 'power3.out' } })
        .from('.usage-header', { y: 12, autoAlpha: 0, duration: 0.34 })
        .from('.usage-summary article', { y: 14, autoAlpha: 0, duration: 0.36, stagger: 0.07 }, '-=0.12')
        .from('.usage-panel', { y: 12, autoAlpha: 0, duration: 0.36, stagger: 0.08 }, '-=0.16')
      gsap.from('.usage-meter i, .folder-usage-row div i', { scaleX: 0, transformOrigin: 'left center', duration: 0.64, delay: 0.24, ease: 'power3.out', stagger: 0.05 })
    })
    return () => mm.revert()
  }, { scope: usageRef, dependencies: [tasks, documents, folders, notes], revertOnUpdate: true })

  return <div className="usage-page" ref={usageRef}>
    <section className="usage-header"><div><h1>工作节奏，一目了然。</h1><p className="lede">数据来自当前浏览器中的本地待办、知识文档和瞬记。</p></div><span className="usage-local">本地实时统计</span></section>
    <section className="usage-summary" aria-label="使用统计概览"><article><span>待办完成率</span><strong>{completionRate}%</strong><small>{completedTasks} / {tasks.length || 0} 项已完成</small></article><article><span>知识文档</span><strong>{documents.length}</strong><small>分布在 {folders.length} 个文件夹中</small></article><article><span>瞬记沉淀</span><strong>{notes.length}</strong><small>条本地记录</small></article></section>
    <section className="usage-detail-grid"><section className="usage-panel"><div className="usage-panel-head"><div><h2>待办完成情况</h2><p>已完成与待处理的当前分布。</p></div><CheckCircle2 size={19} /></div><div className="completion-row"><strong>{completedTasks}</strong><span>已完成</span><i /><strong>{tasks.length - completedTasks}</strong><span>待处理</span></div><div className="usage-meter" aria-label={`待办完成率 ${completionRate}%`}><i style={{ width: `${completionRate}%` }} /></div><p className="usage-caption">完成率 {completionRate}% · 所有待办均会在勾选后即时更新。</p></section><section className="usage-panel"><div className="usage-panel-head"><div><h2>知识库概况</h2><p>按最新版本的文件夹组织方式统计。</p></div><BookOpen size={19} /></div><div className="knowledge-summary"><div><strong>{updatedToday}</strong><span>今日更新</span></div><div><strong>{contentCharacters.toLocaleString()}</strong><span>正文字符</span></div><div><strong>{folders.filter((folder) => !documents.some((document) => (document.project || DEFAULT_FOLDER) === folder.name)).length}</strong><span>空文件夹</span></div></div></section></section>
    <section className="usage-panel folder-usage"><div className="usage-panel-head"><div><h2>文件夹文档分布</h2><p>按文件数量排序，仅展示占用最多的 6 个文件夹。</p></div><FolderKanban size={19} /></div>{folderActivity.length ? <div className="folder-usage-list">{folderActivity.map((folder) => <div className="folder-usage-row" key={folder.name}><span>{folder.name}</span><div><i style={{ width: `${(folder.count / mostDocuments) * 100}%` }} /></div><strong>{folder.count}</strong></div>)}</div> : <p className="usage-empty">还没有可统计的文件夹。</p>}</section>
  </div>
}

function Preferences({ profile, themePreference, onSave, onThemeChange }) {
  const preferencesRef = useRef(null)
  const [name, setName] = useState(profile.name)
  const [avatar, setAvatar] = useState(profile.avatar)
  const [avatarError, setAvatarError] = useState('')
  const initial = (name.trim() || 'Donn').slice(0, 1).toLocaleUpperCase()
  useEffect(() => { setName(profile.name); setAvatar(profile.avatar) }, [profile])
  const { contextSafe } = useGSAP(() => {
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.timeline({ defaults: { ease: 'power3.out' } })
        .from('.preferences-header', { y: 12, autoAlpha: 0, duration: 0.34 })
        .from('.preference-panel', { y: 14, autoAlpha: 0, duration: 0.38, stagger: 0.08 }, '-=0.12')
    })
    return () => mm.revert()
  }, { scope: preferencesRef })
  const feedback = contextSafe((target) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !target) return
    gsap.fromTo(target, { scale: 0.96 }, { scale: 1, duration: 0.2, ease: 'power2.out', clearProps: 'transform' })
  })
  const selectAvatar = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) return setAvatarError('请选择图片文件。')
    if (file.size > 1024 * 1024) return setAvatarError('头像请控制在 1MB 以内。')
    const reader = new FileReader()
    reader.onload = () => { setAvatar(reader.result); setAvatarError('') }
    reader.readAsDataURL(file)
  }
  const saveProfile = (event) => {
    event.preventDefault()
    onSave({ name: name.trim() || 'Donn', avatar })
    feedback(preferencesRef.current?.querySelector('[data-profile-save]'))
  }
  const changeTheme = (event) => {
    onThemeChange(event.target.value)
    feedback(event.currentTarget)
  }

  return <div className="preferences-page" ref={preferencesRef}><section className="preferences-header"><div><h1>偏好设置</h1><p className="lede">这些设置只保存在当前浏览器，方便你按自己的工作方式使用工作台。</p></div></section><div className="preferences-grid"><form className="preference-panel profile-preferences" onSubmit={saveProfile}><div className="preference-panel-head"><div><h2>个人资料</h2><p>修改后会同步更新工作台中的称呼与头像。</p></div></div><div className="avatar-setting"><div className="avatar-preview">{avatar ? <img src={avatar} alt="当前头像" /> : initial}</div><div><label className="attachment-btn" htmlFor="profile-avatar"><ImagePlus size={16} /> 选择头像</label><input id="profile-avatar" type="file" accept="image/*" onChange={selectAvatar} /><p>支持常见图片格式，最大 1MB。</p>{avatar && <button className="text-btn" type="button" onClick={() => setAvatar('')}>移除头像</button>}</div></div>{avatarError && <p className="preference-error">{avatarError}</p>}<label className="preference-field" htmlFor="profile-name"><span>昵称</span><input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} maxLength="24" placeholder="输入昵称" /></label><div className="preference-actions"><button className="primary-btn" type="submit" data-profile-save><Check size={16} /> 保存资料</button></div></form><section className="preference-panel"><div className="preference-panel-head"><div><h2>显示偏好</h2><p>主题选择会立即应用并保存在当前浏览器。</p></div></div><label className="preference-field" htmlFor="preference-theme"><span>界面主题</span><select id="preference-theme" value={themePreference} onChange={changeTheme}><option value="system">跟随系统</option><option value="light">亮色模式</option><option value="dark">暗色模式</option></select></label><p className="preference-note">工作台会优先遵从这个选择；选择“跟随系统”时则依据设备当前主题自动切换。</p></section></div></div>
}

const themeOptions = [
  { value: 'system', label: '跟随系统', icon: Monitor },
  { value: 'light', label: '亮色模式', icon: Sun },
  { value: 'dark', label: '暗色模式', icon: Moon },
]

const DEFAULT_FOLDER = '个人文件'

function getStoredProfile() {
  try {
    const stored = JSON.parse(localStorage.getItem('orbit-profile') || '{}')
    return { name: typeof stored.name === 'string' && stored.name.trim() ? stored.name : 'Donn', avatar: typeof stored.avatar === 'string' ? stored.avatar : '' }
  } catch {
    return { name: 'Donn', avatar: '' }
  }
}

function ThemePicker({ theme, onChange }) {
  const [open, setOpen] = useState(false)
  const selected = themeOptions.find((option) => option.value === theme) ?? themeOptions[0]
  const ThemeIcon = selected.icon
  return <div className="theme-picker"><button className="icon-btn theme-trigger" type="button" onClick={() => setOpen((current) => !current)} aria-label={`主题：${selected.label}`} aria-expanded={open}><ThemeIcon size={17} /></button>{open && <div className="theme-menu" role="menu" aria-label="主题选择">{themeOptions.map(({ value, label, icon: Icon }) => <button type="button" role="menuitemradio" aria-checked={theme === value} className={theme === value ? 'active' : ''} key={value} onClick={() => { onChange(value); setOpen(false) }}><Icon size={16} /><span>{label}</span>{theme === value && <Check size={15} />}</button>)}</div>}</div>
}

function App() {
  const appRef = useRef(null)
  const [active, setActive] = useState('总览')
  const [tasks, setTasks] = useState(initialTasks)
  const [prompt, setPrompt] = useState('')
  const [sent, setSent] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [isAddingTask, setIsAddingTask] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskDueAt, setNewTaskDueAt] = useState('')
  const taskMeterRef = useRef(null)
  const [completedTaskId, setCompletedTaskId] = useState(null)
  const [notes, setNotes] = useState([])
  const [noteText, setNoteText] = useState('')
  const [noteImage, setNoteImage] = useState(null)
  const [noteError, setNoteError] = useState('')
  const [isSavingNote, setIsSavingNote] = useState(false)
  const [documents, setDocuments] = useState([])
  const [folders, setFolders] = useState([])
  const [resources, setResources] = useState([])
  const [selectedResource, setSelectedResource] = useState(null)
  const [importStatus, setImportStatus] = useState(null)
  const [selectedDocuments, setSelectedDocuments] = useState([])
  const [knowledgeProject, setKnowledgeProject] = useState(null)
  const [editingDocument, setEditingDocument] = useState(null)
  const [profile, setProfile] = useState(getStoredProfile)
  const [themePreference, setThemePreference] = useState(() => localStorage.getItem('orbit-theme') || 'system')
  const [systemTheme, setSystemTheme] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  const activeTheme = themePreference === 'system' ? systemTheme : themePreference
  useGSAP(() => {
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const intro = gsap.timeline({ defaults: { ease: 'power3.out' } })
      intro.from('.topbar', { y: -10, autoAlpha: 0, duration: 0.35 })
        .from('.welcome-row, .ai-workspace-head, .quick-notes-head, .knowledge-header', { y: 18, autoAlpha: 0, duration: 0.5 }, '-=0.12')
        .from('.insight-card, .stat-card, .ai-layout', { y: 16, autoAlpha: 0, duration: 0.45, stagger: 0.07 }, '-=0.22')
        .from('.task-row, .result-item, .doc-row, .ai-shortcuts', { y: 10, autoAlpha: 0, duration: 0.3, stagger: 0.035 }, '-=0.18')
      const pulse = gsap.to('.brand-mark', { rotation: 6, scale: 1.04, duration: 1.8, repeat: -1, yoyo: true, ease: 'sine.inOut' })
      return () => pulse.kill()
    })
    return () => mm.revert()
  }, { scope: appRef, dependencies: [active], revertOnUpdate: true })
  useGSAP(() => {
    const meter = taskMeterRef.current
    if (!meter) return
    const progress = tasks.length ? (tasks.filter((task) => task.done).length / tasks.length) * 100 : 0
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.to(meter, { width: `${progress}%`, duration: 0.65, ease: 'power2.out', overwrite: true })
    })
    mm.add('(prefers-reduced-motion: reduce)', () => {
      gsap.set(meter, { width: `${progress}%` })
    })
    return () => mm.revert()
  }, { scope: appRef, dependencies: [tasks, active] })
  useGSAP(() => {
    if (completedTaskId == null) return
    const row = appRef.current?.querySelector(`[data-task-id="${completedTaskId}"]`)
    if (!row) return
    const button = row.querySelector('.check-btn')
    const sweep = row.querySelector('.task-complete-sweep')
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const animation = gsap.timeline({ defaults: { overwrite: true } })
        .fromTo(button, { scale: 0.72, boxShadow: '0 0 0 0 rgba(199,243,107,0)' }, { scale: 1.14, boxShadow: '0 0 0 8px rgba(199,243,107,0.18)', duration: 0.22, ease: 'back.out(3)' })
        .to(button, { scale: 1, boxShadow: '0 0 0 0 rgba(199,243,107,0)', duration: 0.42, ease: 'power2.out' })
      if (sweep) animation.fromTo(sweep, { scaleX: 0, opacity: 0.16 }, { scaleX: 1, opacity: 0, duration: 0.7, ease: 'power2.out' }, 0)
      return () => animation.kill()
    })
    mm.add('(prefers-reduced-motion: reduce)', () => {
      gsap.set(button, { clearProps: 'all' })
      if (sweep) gsap.set(sweep, { clearProps: 'all' })
    })
    const reset = window.setTimeout(() => setCompletedTaskId(null), 850)
    return () => { window.clearTimeout(reset); mm.revert() }
  }, { scope: appRef, dependencies: [completedTaskId] })
  useEffect(() => {
    seedDatabase(initialTasks).then(() => db.tasks.toArray()).then(setTasks).catch(() => setTasks(initialTasks))
    db.notes.orderBy('createdAt').reverse().toArray().then(setNotes).catch(() => setNotes([]))
    const loadKnowledge = async () => {
      const loadedFolders = await db.folders.toArray()
      if (!loadedFolders.some((folder) => folder.name === DEFAULT_FOLDER)) {
        await db.folders.add({ name: DEFAULT_FOLDER, label: DEFAULT_FOLDER, parent: null, createdAt: Date.now(), updatedAt: Date.now() })
        loadedFolders.push({ name: DEFAULT_FOLDER, label: DEFAULT_FOLDER, parent: null })
      }
      setFolders(sortFolders(loadedFolders))
      setDocuments(sortDocumentsByUpdate(await db.documents.toArray()))
    }
    loadKnowledge().catch(() => { setDocuments([]); setFolders([{ name: DEFAULT_FOLDER, label: DEFAULT_FOLDER, parent: null }]) })
    db.resources.orderBy('createdAt').reverse().toArray().then((loaded) => {
      setResources(loaded)
      setSelectedResource(loaded[0] || null)
    }).catch(() => setResources([]))
  }, [])
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const updateSystemTheme = () => setSystemTheme(media.matches ? 'dark' : 'light')
    media.addEventListener('change', updateSystemTheme)
    return () => media.removeEventListener('change', updateSystemTheme)
  }, [])
  useEffect(() => {
    document.documentElement.dataset.theme = activeTheme
    document.documentElement.style.colorScheme = activeTheme
  }, [activeTheme])
  const changeTheme = (theme) => {
    setThemePreference(theme)
    localStorage.setItem('orbit-theme', theme)
  }
  const saveProfile = (nextProfile) => {
    const savedProfile = { name: nextProfile.name.trim() || 'Donn', avatar: nextProfile.avatar || '' }
    setProfile(savedProfile)
    localStorage.setItem('orbit-profile', JSON.stringify(savedProfile))
  }
  const openTasks = useMemo(() => tasks.filter((task) => !task.done).length, [tasks])
  const profileInitial = (profile.name.trim() || 'Donn').slice(0, 1).toLocaleUpperCase()

  const toggleTask = (id) => setTasks((current) => current.map((task) => {
    if (task.id !== id) return task
    const next = { ...task, done: !task.done, updatedAt: Date.now() }
    db.tasks.put(next)
    if (!task.done) setCompletedTaskId(id)
    return next
  }))
  const addTask = async (event) => {
    event.preventDefault()
    const title = newTaskTitle.trim()
    if (!title) return
    const dueAt = newTaskDueAt ? new Date(newTaskDueAt).getTime() : null
    const task = { id: crypto.randomUUID(), title, project: '个人工作台', time: dueAt ? formatTaskDueAt(dueAt) : '今天', dueAt, color: 'lime', done: false, updatedAt: Date.now() }
    await db.tasks.add(task)
    setTasks((current) => [...current, task])
    setNewTaskTitle('')
    setNewTaskDueAt('')
    setIsAddingTask(false)
  }
  const sendPrompt = (event) => {
    event.preventDefault()
    if (!prompt.trim()) return
    db.messages.add({ role: 'user', content: prompt.trim(), createdAt: Date.now() })
    setSent(true)
    setPrompt('')
    setTimeout(() => setSent(false), 2600)
  }
  const selectNoteImage = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return setNoteError('请选择图片文件。')
    if (file.size > 3 * 1024 * 1024) return setNoteError('图片请控制在 3MB 以内。')
    const reader = new FileReader()
    reader.onload = () => { setNoteImage({ name: file.name, dataUrl: reader.result }); setNoteError('') }
    reader.readAsDataURL(file)
  }
  const saveNote = async (event) => {
    event.preventDefault()
    const content = noteText.trim()
    if (!content && !noteImage) return setNoteError('写点内容，或添加一张图片。')
    setIsSavingNote(true)
    const note = { content, image: noteImage, createdAt: Date.now() }
    try {
      const id = await db.notes.add(note)
      setNotes((current) => [{ ...note, id }, ...current])
      setNoteText('')
      setNoteImage(null)
      setNoteError('')
    } catch {
      setNoteError('保存失败，请再试一次。')
    } finally {
      setIsSavingNote(false)
    }
  }
  const importObsidianDocuments = async (event) => {
    const files = Array.from(event.target.files || [])
    const markdownFiles = files.filter((file) => /\.(md|markdown)$/i.test(file.name) && file.size <= 5 * 1024 * 1024)
    event.target.value = ''
    if (!markdownFiles.length) return setImportStatus({ error: true, message: '没有找到可导入的 Markdown 文件，单个文件需小于 5MB。' })
    try {
      const importedAt = Date.now()
      const importedDocuments = await Promise.all(markdownFiles.map(async (file) => {
        const content = await file.text()
        const path = file.webkitRelativePath || file.name
        const folderPaths = getFolderPathsFromPath(path)
        return { path, project: folderPaths.at(-1), title: getDocumentTitle(content, file.name), excerpt: getExcerpt(content), content, importedAt, updatedAt: importedAt }
      }))
      await db.documents.bulkPut(importedDocuments)
      const folderNames = [...new Set(importedDocuments.flatMap((document) => getFolderPathsFromPath(document.path)))]
      await db.folders.bulkPut(folderNames.map((name) => ({ name, label: name.split('/').at(-1), parent: name.includes('/') ? name.split('/').slice(0, -1).join('/') : null, createdAt: importedAt, updatedAt: importedAt })))
      setDocuments(sortDocumentsByUpdate(await db.documents.toArray()))
      setFolders(sortFolders(await db.folders.toArray()))
      const restoredResources = await db.resources.orderBy('createdAt').reverse().toArray()
      setResources(restoredResources)
      setSelectedResource(restoredResources[0] || null)
      setSelectedDocuments([])
      const skippedCount = files.length - markdownFiles.length
      setImportStatus({ message: `已导入 ${importedDocuments.length} 篇本地文档${skippedCount ? `，跳过 ${skippedCount} 个非 Markdown 或过大文件` : ''}。` })
    } catch {
      setImportStatus({ error: true, message: '导入失败，请重新选择本地文件夹。' })
    }
  }
  const downloadBackup = async () => {
    const backup = await exportDatabase()
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `orbit-workbench-backup-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    setImportStatus({ message: '本地数据备份已导出。' })
  }
  const restoreBackup = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      await importDatabase(JSON.parse(await file.text()))
      setTasks(await db.tasks.toArray())
      setNotes(await db.notes.orderBy('createdAt').reverse().toArray())
      setDocuments(sortDocumentsByUpdate(await db.documents.toArray()))
      setFolders(sortFolders(await db.folders.toArray()))
      setSelectedDocuments([])
      setImportStatus({ message: '本地数据已恢复。' })
    } catch {
      setImportStatus({ error: true, message: '备份文件无效，未修改本地数据。' })
    }
  }
  const toggleDocumentSelected = (path) => setSelectedDocuments((current) => current.includes(path) ? current.filter((item) => item !== path) : [...current, path])
  const toggleAllDocuments = (scope) => setSelectedDocuments((current) => {
    const paths = scope.map((document) => document.path)
    return paths.every((path) => current.includes(path)) ? current.filter((path) => !paths.includes(path)) : [...new Set([...current, ...paths])]
  })
  const deleteSelectedDocuments = async () => {
    if (!selectedDocuments.length) return
    if (!window.confirm(`确定删除选中的 ${selectedDocuments.length} 篇文档吗？本地副本将被移除。`)) return
    await db.documents.bulkDelete(selectedDocuments)
    setDocuments((current) => {
      const remaining = current.filter((document) => !selectedDocuments.includes(document.path))
      return remaining
    })
    if (editingDocument && selectedDocuments.includes(editingDocument.path)) setEditingDocument(null)
    setSelectedDocuments([])
  }
  const deleteDocument = async (document) => {
    if (!document.path || !window.confirm(`确定删除“${document.title || '未命名文档'}”吗？本地副本将被移除。`)) return
    await db.documents.delete(document.path)
    setDocuments((current) => current.filter((item) => item.path !== document.path))
    setSelectedDocuments((current) => current.filter((path) => path !== document.path))
    setEditingDocument(null)
  }
  const createFolder = async (name, parent = null) => {
    const folderName = name.trim()
    if (!folderName) throw new Error('请输入文件夹名称。')
    if (folderName.includes('/')) throw new Error('文件夹名称不能包含斜杠。')
    if (parent && !folders.some((folder) => folder.name === parent)) throw new Error('上级文件夹不存在。')
    if (parent && parent.split('/').length >= 3) throw new Error('文件夹最多支持三级。')
    if (folders.some((folder) => folder.parent === parent && getFolderLabel(folder) === folderName)) throw new Error('当前层级已存在同名文件夹。')
    const folder = { name: parent ? `${parent}/${folderName}` : folderName, label: folderName, parent, createdAt: Date.now(), updatedAt: Date.now() }
    await db.folders.add(folder)
    setFolders((current) => sortFolders([...current, folder]))
  }
  const renameFolder = async (oldName, nextName) => {
    const folderName = nextName.trim()
    if (!folderName) throw new Error('请输入文件夹名称。')
    if (folderName.includes('/')) throw new Error('文件夹名称不能包含斜杠。')
    const folder = folders.find((item) => item.name === oldName)
    if (!folder) throw new Error('未找到该文件夹。')
    if (folderName === getFolderLabel(folder)) return
    if (folders.some((item) => item.parent === folder.parent && item.name !== oldName && getFolderLabel(item) === folderName)) throw new Error('当前层级已存在同名文件夹。')
    const renamedRoot = folder.parent ? `${folder.parent}/${folderName}` : folderName
    const affectedFolders = folders.filter((item) => item.name === oldName || item.name.startsWith(`${oldName}/`))
    const renamedFolders = affectedFolders.map((item) => ({ ...item, name: `${renamedRoot}${item.name.slice(oldName.length)}`, label: item.name === oldName ? folderName : getFolderLabel(item), parent: item.parent === oldName ? renamedRoot : item.parent?.startsWith(`${oldName}/`) ? `${renamedRoot}${item.parent.slice(oldName.length)}` : item.parent, updatedAt: Date.now() }))
    const affectedDocuments = documents.filter((document) => document.project === oldName || document.project?.startsWith(`${oldName}/`)).map((document) => ({ ...document, project: `${renamedRoot}${document.project.slice(oldName.length)}` }))
    await db.transaction('rw', db.folders, db.documents, async () => {
      await db.folders.bulkDelete(affectedFolders.map((item) => item.name))
      await db.folders.bulkPut(renamedFolders)
      await db.documents.bulkPut(affectedDocuments)
    })
    setFolders((current) => sortFolders([...current.filter((item) => !affectedFolders.some((affected) => affected.name === item.name)), ...renamedFolders]))
    setDocuments((current) => current.map((document) => affectedDocuments.find((item) => item.path === document.path) || document))
    if (knowledgeProject === oldName || knowledgeProject?.startsWith(`${oldName}/`)) setKnowledgeProject(`${renamedRoot}${knowledgeProject.slice(oldName.length)}`)
    if (editingDocument?.project === oldName || editingDocument?.project?.startsWith(`${oldName}/`)) setEditingDocument((current) => ({ ...current, project: `${renamedRoot}${current.project.slice(oldName.length)}` }))
  }
  const createDocument = (project = DEFAULT_FOLDER) => {
    const now = Date.now()
    setEditingDocument({ path: '', project, title: '未命名文档', content: '', importedAt: now, updatedAt: now, isNew: true })
  }
  const addResource = async (resource) => {
    const saved = { ...resource, createdAt: Date.now() }
    const id = await db.resources.add(saved)
    const next = { ...saved, id }
    setResources((current) => [next, ...current])
    setSelectedResource(next)
  }
  const deleteResource = async (resource) => {
    if (!window.confirm(`确定删除“${resource.title}”吗？`)) return
    await db.resources.delete(resource.id)
    setResources((current) => {
      const next = current.filter((item) => item.id !== resource.id)
      setSelectedResource((selected) => selected?.id === resource.id ? next[0] || null : selected)
      return next
    })
  }
  const persistDocument = async (document) => {
    const title = document.title.trim() || getDocumentTitle(document.content, document.path.split('/').pop()) || '未命名文档'
    const project = document.project || DEFAULT_FOLDER
    const pathSegment = (value) => value.replace(/[\\/:*?"<>|]/g, '-').trim() || '未分类'
    const now = Date.now()
    const { isNew, ...updated } = { ...document, path: document.isNew ? `工作台/${pathSegment(project)}/${pathSegment(title)}-${now}.md` : document.path, project, title, excerpt: getExcerpt(document.content), importedAt: document.importedAt ?? now, updatedAt: now }
    await db.documents.put(updated)
    setDocuments((current) => sortDocumentsByUpdate(document.isNew ? [updated, ...current] : current.map((item) => item.path === updated.path ? updated : item)))
    setKnowledgeProject(project)
    return updated
  }

  if (editingDocument) return <DocumentEditor document={editingDocument} folders={folders} onChange={setEditingDocument} onSave={persistDocument} onDelete={deleteDocument} onCancel={() => setEditingDocument(null)} />

  return (
    <div className="app-shell" ref={appRef}>
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
        <div className="brand-row">
          <div className="brand-mark"><Sparkles size={16} strokeWidth={2.5} /></div>
          <span>ORBIT</span>
          <button className="icon-btn mobile-close" onClick={() => setMobileNav(false)} aria-label="关闭导航"><X size={18} /></button>
        </div>
          <div className="workspace-switcher">
          <div className="avatar">{profile.avatar ? <img src={profile.avatar} alt="" /> : profileInitial}</div>
          <div><strong>{profile.name} 的工作台</strong><small>个人空间</small></div>
          <ChevronRight size={15} className="muted" />
        </div>
        <nav className="main-nav" aria-label="主导航">
          <span className="nav-caption">工作空间</span>
          {nav.map(({ label, icon: Icon, badge }) => <button key={label} className={`nav-item ${active === label ? 'active' : ''}`} onClick={() => { setActive(label); if (label === '知识文档') setKnowledgeProject(null); setMobileNav(false) }}><Icon size={17} /><span>{label}</span>{badge && <em>{badge}</em>}</button>)}
          <span className="nav-caption second">系统</span>
          <button className={`nav-item ${active === '使用统计' ? 'active' : ''}`} onClick={() => { setActive('使用统计'); setMobileNav(false) }}><BarChart3 size={17} /><span>使用统计</span></button>
          <button className={`nav-item ${active === '偏好设置' ? 'active' : ''}`} onClick={() => { setActive('偏好设置'); setMobileNav(false) }}><Settings2 size={17} /><span>偏好设置</span></button>
        </nav>
        <div className="sidebar-bottom">
          <div className="usage-mini"><div className="usage-mini-head"><span>本月 AI 额度</span><span>68%</span></div><div className="progress"><i style={{ width: '68%' }} /></div><small>34.2k / 50k tokens</small></div>
          <div className="profile-row"><div className="avatar avatar-small">{profile.avatar ? <img src={profile.avatar} alt="" /> : profileInitial}</div><div><strong>{profile.name}</strong><small>Pro workspace</small></div><MoreHorizontal size={17} className="muted" /></div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar"><button className="icon-btn menu-toggle" onClick={() => setMobileNav(true)} aria-label="打开导航"><Menu size={20} /></button><div className="breadcrumbs"><span>工作空间</span><ChevronRight size={14} /><strong>{active}</strong></div><div className="top-actions"><button className="search-btn"><Search size={17} /><span>搜索工作台</span><kbd>⌘ K</kbd></button><ThemePicker theme={themePreference} onChange={changeTheme} /><button className="icon-btn"><Bell size={18} /><i className="notification-dot" /></button><div className="top-avatar">{profile.avatar ? <img src={profile.avatar} alt="" /> : profileInitial}</div></div></header>

          <div className="page-wrap">
            {active === 'AI 工作台' ? <AIWorkspace prompt={prompt} setPrompt={setPrompt} sent={sent} sendPrompt={sendPrompt} profile={profile} /> : active === '瞬记' ? <QuickNotes notes={notes} noteText={noteText} setNoteText={setNoteText} noteImage={noteImage} noteError={noteError} onImageChange={selectNoteImage} onSave={saveNote} clearImage={() => setNoteImage(null)} isSavingNote={isSavingNote} /> : active === '知识文档' ? <KnowledgeBase documents={documents} folders={folders} importStatus={importStatus} onImport={importObsidianDocuments} onExportBackup={downloadBackup} onRestoreBackup={restoreBackup} selectedPaths={selectedDocuments} onToggleSelected={toggleDocumentSelected} onToggleAll={toggleAllDocuments} onDeleteSelected={deleteSelectedDocuments} onCreate={createDocument} onEdit={setEditingDocument} onCreateFolder={createFolder} onRenameFolder={renameFolder} activeProject={knowledgeProject} onOpenProject={(project) => { setKnowledgeProject(project); setSelectedDocuments([]) }} onCloseProject={() => { setKnowledgeProject(null); setSelectedDocuments([]) }} /> : active === '设计资源中心' ? <DesignResources resources={resources} selectedResource={selectedResource} onSelect={setSelectedResource} onAdd={addResource} onDelete={deleteResource} /> : active === '使用统计' ? <UsageStats tasks={tasks} documents={documents} folders={folders} notes={notes} /> : active === '偏好设置' ? <Preferences profile={profile} themePreference={themePreference} onSave={saveProfile} onThemeChange={changeTheme} /> : <>
          <section className="welcome-row"><div><p className="date-line">星期四，2026 年 9 月 4 日 <span className="live-dot" /> 工作状态良好</p><h1>早上好，{profile.name}<span className="wave">。</span></h1><p className="lede">这是你的今日工作脉络。AI 已经替你整理好重点，接下来专注于最重要的事。</p></div><button className="primary-btn"><Plus size={17} /> 新建工作流</button></section>

          <section className="insight-grid">
            <article className="insight-card hero-insight"><div className="card-top"><span className="eyebrow"><Sparkles size={13} /> 今日 AI 结论</span><span className="card-time">09:12 更新</span></div><div className="insight-copy"><h2>你的下一步，应该更靠近用户。</h2><p>过去 7 天的访谈与反馈里，“首次使用的理解成本”出现了 11 次。建议今天优先验证首屏引导，而不是继续扩展功能范围。</p></div><div className="insight-foot"><span><Target size={15} /> 基于 4 份知识文档</span><button className="text-btn">查看完整分析 <ArrowUpRight size={15} /></button></div></article>
            <article className="stat-card"><div className="stat-head"><span>AI 消耗</span><button className="icon-btn small"><MoreHorizontal size={16} /></button></div><div className="stat-value">34.2k <small>tokens</small></div><div className="stat-meta up"><ArrowUpRight size={14} /> 12.8% <span>较上周</span></div><div className="bars" aria-label="近七日 AI 消耗"><i style={{ height: '36%' }} /><i style={{ height: '54%' }} /><i style={{ height: '44%' }} /><i style={{ height: '70%' }} /><i style={{ height: '58%' }} /><i style={{ height: '82%' }} /><i className="today" style={{ height: '68%' }} /></div><div className="bars-label"><span>8/29</span><span>今天</span></div></article>
            <article className="stat-card stat-tasks"><div className="stat-head"><span>今日待办</span><span className="count-badge">{openTasks} 项待处理</span></div><div className="stat-value">{tasks.filter((task) => task.done).length}<small> / {tasks.length}</small></div><div className="task-meter"><i ref={taskMeterRef} /></div><div className="stat-meta"><CheckCircle2 size={14} /> 完成进度 <span>{Math.round((tasks.filter((task) => task.done).length / tasks.length) * 100)}%</span></div></article>
          </section>

          <section className="section-grid"><div className="section-main"><div className="section-heading"><div><h3>今天要做什么</h3><p>把注意力放在真正推动事情前进的地方。</p></div><button className="subtle-btn">查看全部 <ArrowUpRight size={15} /></button></div><div className="task-list">{tasks.map((task) => <div className={`task-row ${task.done ? 'done' : ''}`} data-task-id={task.id} key={task.id}><span className="task-complete-sweep" aria-hidden="true" /><button className="check-btn" onClick={() => toggleTask(task.id)} aria-label={task.done ? '标记未完成' : '标记完成'}>{task.done ? <Check size={14} /> : <Circle size={17} />}</button><div className={`task-accent ${task.color}`} /><div className="task-info"><strong>{task.title}</strong><div><span>{task.project}</span><span className="task-divider" /><Clock3 size={13} /> <span>{task.dueAt ? formatTaskDueAt(task.dueAt) : task.time}</span></div></div><button className="icon-btn small task-more" aria-label="更多操作"><MoreHorizontal size={16} /></button></div>)}</div>{isAddingTask ? <form className="add-task-form" onSubmit={addTask}><Plus size={16} /><input className="task-title-input" autoFocus value={newTaskTitle} onChange={(event) => setNewTaskTitle(event.target.value)} onKeyDown={(event) => event.key === 'Escape' && (setIsAddingTask(false), setNewTaskTitle(''), setNewTaskDueAt(''))} placeholder="输入待办内容" aria-label="待办内容" /><label className="task-due-field"><Clock3 size={15} /><span className="task-due-label">完成时间</span><input className="task-due-input" type="datetime-local" value={newTaskDueAt} onChange={(event) => setNewTaskDueAt(event.target.value)} aria-label="完成时间" /></label><button type="submit" className="icon-btn small" aria-label="保存待办"><Check size={16} /></button><button type="button" className="icon-btn small" onClick={() => { setIsAddingTask(false); setNewTaskTitle(''); setNewTaskDueAt('') }} aria-label="取消添加"><X size={16} /></button></form> : <button className="add-task" onClick={() => setIsAddingTask(true)}><Plus size={16} /> 添加一个待办</button>}</div>
            <div className="section-side"><div className="section-heading compact"><div><h3>最近结果</h3><p>AI 帮你完成的工作</p></div><button className="icon-btn small"><MoreHorizontal size={16} /></button></div><div className="result-list"><div className="result-item"><div className="result-icon blue"><MessageSquare size={16} /></div><div><strong>竞品动态周报</strong><small>已生成 · 12 分钟前</small></div><ChevronRight size={15} className="muted" /></div><div className="result-item"><div className="result-icon lime"><FileText size={16} /></div><div><strong>访谈摘要 · 03</strong><small>已整理 · 昨天 18:40</small></div><ChevronRight size={15} className="muted" /></div><div className="result-item"><div className="result-icon coral"><Zap size={16} /></div><div><strong>落地页文案变体</strong><small>已生成 · 昨天 16:22</small></div><ChevronRight size={15} className="muted" /></div></div><button className="view-all-btn">进入结果库 <ArrowUpRight size={15} /></button></div></section>

          <section className="dashboard-upper-grid"><AIAssistantPanel prompt={prompt} setPrompt={setPrompt} sent={sent} sendPrompt={sendPrompt} /><QuickNoteCapture noteText={noteText} setNoteText={setNoteText} noteImage={noteImage} noteError={noteError} onImageChange={selectNoteImage} onSave={saveNote} clearImage={() => setNoteImage(null)} isSavingNote={isSavingNote} onOpenNotes={() => setActive('瞬记')} /></section>

          <DashboardNoteHistory notes={notes} onOpenNotes={() => setActive('瞬记')} />

          <section className="bottom-grid"><div className="docs-panel"><div className="section-heading"><div><h3>知识文档</h3><p>你的工作记忆，持续被 AI 理解。</p></div><button className="subtle-btn">打开知识库 <ArrowUpRight size={15} /></button></div><div className="doc-list">{docs.map((doc) => <div className="doc-row" key={doc.title}><div className={`doc-icon ${doc.color}`}><FolderOpen size={19} /></div><div className="doc-info"><strong>{doc.folder}</strong><span>{doc.count} 篇文档 · 最近：{doc.title}</span></div><time>{doc.date}</time><ChevronRight size={15} className="muted" /></div>)}</div></div></section>
            </>}
        </div>
      </main>
    </div>
  )
}

export default App

createRoot(document.getElementById('root')).render(<App />)
