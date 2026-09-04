import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import {
  ArrowUpRight, BarChart3, Bell, BookOpen, Bot, Check, CheckCircle2, ChevronRight,
  Circle, Clock3, Edit3, Eye, FileText, FolderKanban, FolderOpen, FolderUp, ImagePlus, LayoutDashboard, Menu, MessageSquare,
  MoreHorizontal, Plus, Save, Search, Send, Settings2, Sparkles, StickyNote, Target, Trash2, X, Zap
} from 'lucide-react'
import './styles.css'
import './task-effects.css'
import './dashboard-cards.css'
import './dashboard-capture.css'
import './result-chat.css'
import './surface-neutral.css'
import { db, exportDatabase, importDatabase, seedDatabase } from './db'

gsap.registerPlugin(useGSAP)

const nav = [
  { label: '总览', icon: LayoutDashboard },
  { label: 'AI 工作台', icon: Bot, badge: '3' },
  { label: '瞬记', icon: StickyNote },
  { label: '任务流', icon: FolderKanban },
  { label: '知识文档', icon: BookOpen },
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

function getProjectFromPath(path) {
  const parts = path.split('/').filter(Boolean)
  return parts.length > 2 ? parts[1] : '未分类'
}

function getExcerpt(content) {
  return content.replace(/^---[\s\S]*?---\s*/m, '').replace(/^#{1,6}\s+.*$/gm, '').replace(/!?(?:\[([^\]]*)\])?\([^)]*\)/g, '$1').replace(/[`*_>#-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150)
}

function inlineMarkdown(text) {
  return text.split(/(\[[^\]]+\]\(https?:\/\/[^)\s]+\)|\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*]+\*|_[^_]+_)/g).filter(Boolean).map((part, index) => {
    if (/^\[[^\]]+\]\(https?:\/\//.test(part)) {
      const match = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/)
      return <a key={index} href={match[2]} target="_blank" rel="noreferrer">{match[1]}</a>
    }
    if (/^\*\*|^__/.test(part)) return <strong key={index}>{part.slice(2, -2)}</strong>
    if (/^`/.test(part)) return <code key={index}>{part.slice(1, -1)}</code>
    if (/^\*|^_/.test(part)) return <em key={index}>{part.slice(1, -1)}</em>
    return <React.Fragment key={index}>{part}</React.Fragment>
  })
}

function renderMarkdown(markdown) {
  const lines = markdown.split(/\r?\n/)
  const blocks = []
  let index = 0
  while (index < lines.length) {
    const line = lines[index]
    if (!line.trim()) { index += 1; continue }
    if (/^```/.test(line)) {
      const language = line.slice(3).trim()
      const code = []
      index += 1
      while (index < lines.length && !/^```/.test(lines[index])) code.push(lines[index++])
      index += 1
      blocks.push(<pre key={`code-${index}`}><code className={language ? `language-${language}` : ''}>{code.join('\n')}</code></pre>)
      continue
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/)
    if (heading) {
      const Heading = `h${heading[1].length}`
      blocks.push(<Heading key={`heading-${index}`}>{inlineMarkdown(heading[2])}</Heading>)
      index += 1
      continue
    }
    if (/^>\s?/.test(line)) {
      const quote = []
      while (index < lines.length && /^>\s?/.test(lines[index])) quote.push(lines[index++].replace(/^>\s?/, ''))
      blocks.push(<blockquote key={`quote-${index}`}>{quote.map((item) => <p key={item}>{inlineMarkdown(item)}</p>)}</blockquote>)
      continue
    }
    if (/^[-*+]\s+/.test(line)) {
      const items = []
      while (index < lines.length && /^[-*+]\s+/.test(lines[index])) items.push(lines[index++].replace(/^[-*+]\s+/, ''))
      blocks.push(<ul key={`ul-${index}`}>{items.map((item, itemIndex) => <li key={`${item}-${itemIndex}`}>{inlineMarkdown(item)}</li>)}</ul>)
      continue
    }
    if (/^\d+\.\s+/.test(line)) {
      const items = []
      while (index < lines.length && /^\d+\.\s+/.test(lines[index])) items.push(lines[index++].replace(/^\d+\.\s+/, ''))
      blocks.push(<ol key={`ol-${index}`}>{items.map((item, itemIndex) => <li key={`${item}-${itemIndex}`}>{inlineMarkdown(item)}</li>)}</ol>)
      continue
    }
    const paragraph = [line]
    index += 1
    while (index < lines.length && lines[index].trim() && !/^(#{1,6})\s|^```|^>\s?|^[-*+]\s+|^\d+\.\s+/.test(lines[index])) paragraph.push(lines[index++])
    blocks.push(<p key={`paragraph-${index}`}>{paragraph.map((item, itemIndex) => <React.Fragment key={itemIndex}>{itemIndex > 0 && <br />}{inlineMarkdown(item)}</React.Fragment>)}</p>)
  }
  return blocks
}

function AIWorkspace({ prompt, setPrompt, sent, sendPrompt }) {
  return <div className="ai-workspace">
    <section className="ai-workspace-head"><div><p className="date-line">AI 工作台 <span className="live-dot" /> 上下文已同步</p><h1>把复杂问题，变成清晰下一步。</h1><p className="lede">连接你的任务与知识文档，和 AI 一起完成研究、分析与决策。</p></div><button className="primary-btn"><Plus size={17} /> 新建对话</button></section>
    <div className="ai-layout">
      <aside className="conversation-list"><div className="conversation-head"><strong>最近对话</strong><button className="icon-btn small" aria-label="更多对话"><MoreHorizontal size={16} /></button></div><button className="new-chat"><Plus size={15} /> 开始新对话</button>{conversations.map((item) => <button className={`conversation-item ${item.active ? 'active' : ''}`} key={item.title}><div className="conversation-icon"><MessageSquare size={15} /></div><div><strong>{item.title}</strong><small>{item.meta}</small></div><ChevronRight size={14} className="muted" /></button>)}</aside>
      <section className="chat-surface"><div className="chat-header"><div><span className="eyebrow"><Bot size={13} /> ORBIT AI</span><h2>Q3 用户访谈洞察</h2></div><div className="chat-header-actions"><span className="model-pill">Orbit Reasoning <ChevronRight size={12} /></span><button className="icon-btn small" aria-label="对话设置"><Settings2 size={16} /></button></div></div><div className="chat-body"><div className="message user-message"><div className="message-avatar user">D</div><div><span className="message-label">Donn · 09:10</span><p>帮我从最近的用户访谈里，找出最值得今天验证的产品问题。</p></div></div><div className="message ai-message"><div className="message-avatar ai"><Sparkles size={14} /></div><div><span className="message-label">Orbit AI · 09:12</span><p>最值得验证的是：<strong>首次使用的理解成本正在阻碍用户完成第一次关键动作。</strong></p><p>我在 4 份访谈中找到 11 次相关表达，集中在“入口不知道点哪里”和“看不懂下一步”两个环节。</p><div className="answer-block"><div className="answer-row"><span className="answer-index">01</span><div><strong>建议验证</strong><span>首屏引导是否能让新用户在 30 秒内完成第一次关键动作</span></div></div><div className="answer-row"><span className="answer-index">02</span><div><strong>推荐方法</strong><span>邀请 5 位新用户完成无提示体验，记录首次犹豫点</span></div></div></div><div className="source-row"><span><BookOpen size={13} /> 引用 4 份文档</span><button className="text-btn">展开来源 <ArrowUpRight size={14} /></button></div></div></div></div><form className="chat-composer" onSubmit={sendPrompt}><div className="composer-context"><span><BookOpen size={13} /> 工作台上下文</span><button type="button">清除</button></div><div className="composer-input"><input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="继续追问，或让 AI 帮你完成下一步..." aria-label="继续追问" /><button type="submit" aria-label="发送"><Send size={16} /></button></div>{sent && <div className="sent-toast"><Check size={13} /> 已加入当前对话</div>}</form></section>
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

function QuickNotes({ notes, noteText, setNoteText, noteImage, noteError, onImageChange, onSave, clearImage, isSavingNote }) {
  return <div className="quick-notes">
    <section className="quick-notes-head"><div><p className="date-line">瞬记 <span className="live-dot" /> 自动保存到本地</p><h1>不让任何一个想法溜走。</h1><p className="lede">灵感、问题、截图和零散判断，先记下来。整理和归类，留给之后的自己。</p></div><div className="note-count"><strong>{notes.length}</strong><span>条已记录</span></div></section>
    <section className="note-composer"><div className="note-composer-head"><span className="eyebrow"><Sparkles size={13} /> 新的瞬记</span><span>今天</span></div><form onSubmit={onSave}><textarea value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="此刻你在想什么？" aria-label="瞬记内容" rows="5" />{noteImage && <div className="image-preview"><img src={noteImage.dataUrl} alt="待保存的图片" /><div><strong>{noteImage.name}</strong><small>随这条瞬记一起保存</small></div><button type="button" className="icon-btn small" onClick={clearImage} aria-label="移除图片"><X size={16} /></button></div>}{noteError && <p className="note-error">{noteError}</p>}<div className="note-composer-actions"><label className="attachment-btn" htmlFor="note-image"><ImagePlus size={16} /> 添加图片</label><input id="note-image" type="file" accept="image/*" onChange={onImageChange} /><span>文字或一张图片</span><button className="primary-btn" type="submit" disabled={isSavingNote}>{isSavingNote ? '保存中...' : <><Send size={16} /> 记录下来</>}</button></div></form></section>
    <section className="notes-feed"><div className="section-heading"><div><h3>最近的瞬记</h3><p>按记录时间倒序排列。</p></div></div>{notes.length ? <div className="notes-grid">{notes.map((note) => <article className="note-card" key={note.id}><div className="note-card-top"><span><StickyNote size={14} /> 瞬记</span><time>{new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(note.createdAt)}</time></div>{note.content && <p>{note.content}</p>}{note.image && <img className="note-image" src={note.image.dataUrl} alt={note.image.name || '瞬记图片'} />}</article>)}</div> : <div className="notes-empty"><StickyNote size={20} /><strong>第一条想法，从这里开始。</strong><span>写下一段文字，或附上一张图片。</span></div>}</section>
  </div>
}

function DocumentEditor({ document, onChange, onSave, onCancel }) {
  const [preview, setPreview] = useState(false)
  return <div className="editor-page"><header className="editor-topbar"><button className="editor-back" onClick={onCancel}><X size={16} /> 返回知识库</button><div className="editor-actions"><button className={`editor-tab ${!preview ? 'active' : ''}`} onClick={() => setPreview(false)}><Edit3 size={14} /> 编辑</button><button className={`editor-tab ${preview ? 'active' : ''}`} onClick={() => setPreview(true)}><Eye size={14} /> 预览</button><button className="primary-btn editor-save" onClick={() => onSave(document)}><Save size={15} /> {document.isNew ? '创建文档' : '保存修改'}</button></div></header><main className="editor-stage"><div className="editor-document-head"><input className="document-title-input" id="document-title" value={document.title} onChange={(event) => onChange({ ...document, title: event.target.value })} aria-label="文档标题" placeholder="未命名文档" autoFocus /><div className="editor-project-row"><label htmlFor="document-project">所属项目</label><input id="document-project" value={document.project} onChange={(event) => onChange({ ...document, project: event.target.value })} aria-label="所属项目" /></div></div><section className="editor-work-area">{preview ? <div className="markdown-preview">{document.content.trim() ? renderMarkdown(document.content) : <span className="preview-empty">暂无内容</span>}</div> : <textarea className="markdown-editor" value={document.content} onChange={(event) => onChange({ ...document, content: event.target.value })} spellCheck="false" aria-label="Markdown 文档内容" placeholder="# 从这里开始写" />}</section></main><footer className="editor-status"><span>{document.isNew ? 'Markdown · 仅保存在本地知识库' : document.path}</span><span>{document.content.length} 字符</span></footer></div>
}

function KnowledgeBase({ documents, importStatus, onImport, onExportBackup, onRestoreBackup, selectedPaths, onToggleSelected, onToggleAll, onDeleteSelected, onCreate, onEdit }) {
  const [collapsedProjects, setCollapsedProjects] = useState([])
  const groupedDocuments = documents.reduce((groups, document) => {
    groups[document.project] ??= []
    groups[document.project].push(document)
    return groups
  }, {})
  const allSelected = documents.length > 0 && selectedPaths.length === documents.length
  const toggleProject = (project) => setCollapsedProjects((current) => current.includes(project) ? current.filter((item) => item !== project) : [...current, project])
  return <div className="knowledge-base">
    <section className="knowledge-header"><div><p className="date-line">本地知识库 <span className="live-dot" /> 不会同步到远程</p><h1>你的工作记忆，按项目归位。</h1><p className="lede">从 Obsidian 导入 Markdown 文件夹后，工作台会保留本地副本，并按照项目和文档标题整理。</p></div><div className="knowledge-actions"><button className="primary-btn" onClick={onCreate}><Plus size={17} /> 新建文档</button><div className="knowledge-count"><strong>{documents.length}</strong><span>篇本地文档</span></div></div></section>
    <section className="knowledge-import"><div className="import-icon"><FolderUp size={21} /></div><div className="import-copy"><h2>导入 Obsidian 知识库</h2><p>选择你的知识库文件夹，只读取其中的 Markdown 文档。</p></div><label className="primary-btn" htmlFor="obsidian-folder"><FolderUp size={17} /> 选择本地文件夹</label><input id="obsidian-folder" type="file" accept=".md,.markdown,text/markdown" multiple webkitdirectory="" onChange={onImport} /><div className="knowledge-backup-actions"><button className="subtle-btn" onClick={onExportBackup}><Save size={14} /> 导出本地备份</button><label className="subtle-btn" htmlFor="orbit-backup"><FolderUp size={14} /> 恢复备份</label><input id="orbit-backup" type="file" accept="application/json,.json" onChange={onRestoreBackup} /></div>{importStatus && <p className={`import-status ${importStatus.error ? 'error' : ''}`}>{importStatus.message}</p>}</section>
    <section className="knowledge-list"><div className="section-heading"><div><h3>已导入文档</h3><p>{documents.length ? `来自 ${Object.keys(groupedDocuments).length} 个项目` : '导入后会按项目展示文档标题。'}</p></div>{documents.length > 0 && <div className="document-tools"><label className="select-all"><input type="checkbox" checked={allSelected} onChange={onToggleAll} /> <span>全选</span></label>{selectedPaths.length > 0 && <><span className="selected-count">已选择 {selectedPaths.length} 篇</span><button className="danger-btn" onClick={onDeleteSelected}><Trash2 size={15} /> 删除所选</button></>}</div>}</div>{documents.length ? <div className="project-groups">{Object.entries(groupedDocuments).sort(([left], [right]) => left.localeCompare(right, 'zh-CN')).map(([project, projectDocuments]) => { const collapsed = collapsedProjects.includes(project); return <section className={`project-group ${collapsed ? 'collapsed' : ''}`} key={project}><button className="project-group-head" onClick={() => toggleProject(project)} aria-expanded={!collapsed}><div><FolderKanban size={16} /><h2>{project}</h2>{!collapsed && <span>{projectDocuments.length} 篇</span>}</div><ChevronRight size={16} className="project-group-toggle" /></button>{!collapsed && <div className="document-rows">{projectDocuments.sort((left, right) => right.importedAt - left.importedAt).map((document) => <article className={`document-row ${selectedPaths.includes(document.path) ? 'selected' : ''}`} key={document.path}><label className="document-check"><input type="checkbox" checked={selectedPaths.includes(document.path)} onChange={() => onToggleSelected(document.path)} aria-label={`选择 ${document.title}`} /><span /></label><div className="document-icon"><FileText size={17} /></div><div className="document-main"><button className="document-title-btn" onClick={() => onEdit(document)}>{document.title}</button><p>{document.excerpt || '没有可预览的正文内容。'}</p></div><div className="document-meta"><span>{document.path.split('/').slice(-1)[0]}</span><time>{new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' }).format(document.importedAt)}</time></div><button className="icon-btn small document-edit" onClick={() => onEdit(document)} aria-label={`编辑 ${document.title}`}><Edit3 size={15} /></button></article>)}</div>}</section>})}</div> : <div className="knowledge-empty"><FolderUp size={22} /><strong>从一个 Obsidian 文件夹开始。</strong><span>导入后，你会在这里看到每个项目下的文档标题。</span></div>}</section>
  </div>
}

function AIAssistantPanel({ prompt, setPrompt, sent, sendPrompt }) {
  return <section className="ai-panel dashboard-ai-panel"><div className="ai-panel-top"><div><span className="eyebrow"><Bot size={13} /> AI 助手</span><h3>把想法变成下一步</h3></div><span className="status-pill"><i /> 在线</span></div><p>从你的工作台上下文开始提问，AI 会引用相关任务和文档。</p><form className="prompt-box" onSubmit={sendPrompt}><input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="问问你的工作台..." aria-label="问问你的工作台" /><button aria-label="发送" type="submit"><Send size={16} /></button></form>{sent && <div className="sent-toast"><Check size={13} /> 已加入 AI 对话</div>}<div className="prompt-suggestions"><button type="button" onClick={() => setPrompt('总结我今天最重要的三件事')}>总结今天 <ArrowUpRight size={13} /></button><button type="button" onClick={() => setPrompt('哪些任务可以交给 AI？')}>找点灵感 <ArrowUpRight size={13} /></button></div></section>
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
  const taskMeterRef = useRef(null)
  const [completedTaskId, setCompletedTaskId] = useState(null)
  const [notes, setNotes] = useState([])
  const [noteText, setNoteText] = useState('')
  const [noteImage, setNoteImage] = useState(null)
  const [noteError, setNoteError] = useState('')
  const [isSavingNote, setIsSavingNote] = useState(false)
  const [documents, setDocuments] = useState([])
  const [importStatus, setImportStatus] = useState(null)
  const [selectedDocuments, setSelectedDocuments] = useState([])
  const [editingDocument, setEditingDocument] = useState(null)
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
    db.documents.orderBy('importedAt').reverse().toArray().then(setDocuments).catch(() => setDocuments([]))
  }, [])
  const openTasks = useMemo(() => tasks.filter((task) => !task.done).length, [tasks])

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
    const task = { id: crypto.randomUUID(), title, project: '个人工作台', time: '今天', color: 'lime', done: false, updatedAt: Date.now() }
    await db.tasks.add(task)
    setTasks((current) => [...current, task])
    setNewTaskTitle('')
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
        return { path, project: getProjectFromPath(path), title: getDocumentTitle(content, file.name), excerpt: getExcerpt(content), content, importedAt }
      }))
      await db.documents.bulkPut(importedDocuments)
      setDocuments(await db.documents.orderBy('importedAt').reverse().toArray())
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
      setDocuments(await db.documents.orderBy('importedAt').reverse().toArray())
      setSelectedDocuments([])
      setImportStatus({ message: '本地数据已恢复。' })
    } catch {
      setImportStatus({ error: true, message: '备份文件无效，未修改本地数据。' })
    }
  }
  const toggleDocumentSelected = (path) => setSelectedDocuments((current) => current.includes(path) ? current.filter((item) => item !== path) : [...current, path])
  const toggleAllDocuments = () => setSelectedDocuments((current) => current.length === documents.length ? [] : documents.map((document) => document.path))
  const deleteSelectedDocuments = async () => {
    if (!selectedDocuments.length) return
    if (!window.confirm(`确定删除选中的 ${selectedDocuments.length} 篇文档吗？本地副本将被移除。`)) return
    await db.documents.bulkDelete(selectedDocuments)
    setDocuments((current) => current.filter((document) => !selectedDocuments.includes(document.path)))
    if (editingDocument && selectedDocuments.includes(editingDocument.path)) setEditingDocument(null)
    setSelectedDocuments([])
  }
  const createDocument = () => setEditingDocument({ path: '', project: '未分类', title: '未命名文档', content: '', importedAt: Date.now(), isNew: true })
  const saveEditedDocument = async (document) => {
    const title = document.title.trim() || getDocumentTitle(document.content, document.path.split('/').pop()) || '未命名文档'
    const project = document.project.trim() || '未分类'
    const pathSegment = (value) => value.replace(/[\\/:*?"<>|]/g, '-').trim() || '未分类'
    const { isNew, ...updated } = { ...document, path: document.isNew ? `工作台/${pathSegment(project)}/${pathSegment(title)}-${Date.now()}.md` : document.path, project, title, excerpt: getExcerpt(document.content), importedAt: Date.now() }
    await db.documents.put(updated)
    setDocuments((current) => document.isNew ? [updated, ...current] : current.map((item) => item.path === updated.path ? updated : item))
    setEditingDocument(null)
  }

  if (editingDocument) return <DocumentEditor document={editingDocument} onChange={setEditingDocument} onSave={saveEditedDocument} onCancel={() => setEditingDocument(null)} />

  return (
    <div className="app-shell" ref={appRef}>
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
        <div className="brand-row">
          <div className="brand-mark"><Sparkles size={16} strokeWidth={2.5} /></div>
          <span>ORBIT</span>
          <button className="icon-btn mobile-close" onClick={() => setMobileNav(false)} aria-label="关闭导航"><X size={18} /></button>
        </div>
        <div className="workspace-switcher">
          <div className="avatar">D</div>
          <div><strong>Donn 的工作台</strong><small>个人空间</small></div>
          <ChevronRight size={15} className="muted" />
        </div>
        <nav className="main-nav" aria-label="主导航">
          <span className="nav-caption">工作空间</span>
          {nav.map(({ label, icon: Icon, badge }) => <button key={label} className={`nav-item ${active === label ? 'active' : ''}`} onClick={() => { setActive(label); setMobileNav(false) }}><Icon size={17} /><span>{label}</span>{badge && <em>{badge}</em>}</button>)}
          <span className="nav-caption second">系统</span>
          <button className="nav-item"><BarChart3 size={17} /><span>使用统计</span></button>
          <button className="nav-item"><Settings2 size={17} /><span>偏好设置</span></button>
        </nav>
        <div className="sidebar-bottom">
          <div className="usage-mini"><div className="usage-mini-head"><span>本月 AI 额度</span><span>68%</span></div><div className="progress"><i style={{ width: '68%' }} /></div><small>34.2k / 50k tokens</small></div>
          <div className="profile-row"><div className="avatar avatar-small">D</div><div><strong>Donn</strong><small>Pro workspace</small></div><MoreHorizontal size={17} className="muted" /></div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar"><button className="icon-btn menu-toggle" onClick={() => setMobileNav(true)} aria-label="打开导航"><Menu size={20} /></button><div className="breadcrumbs"><span>工作空间</span><ChevronRight size={14} /><strong>{active}</strong></div><div className="top-actions"><button className="search-btn"><Search size={17} /><span>搜索工作台</span><kbd>⌘ K</kbd></button><button className="icon-btn"><Bell size={18} /><i className="notification-dot" /></button><div className="top-avatar">D</div></div></header>

          <div className="page-wrap">
            {active === 'AI 工作台' ? <AIWorkspace prompt={prompt} setPrompt={setPrompt} sent={sent} sendPrompt={sendPrompt} /> : active === '瞬记' ? <QuickNotes notes={notes} noteText={noteText} setNoteText={setNoteText} noteImage={noteImage} noteError={noteError} onImageChange={selectNoteImage} onSave={saveNote} clearImage={() => setNoteImage(null)} isSavingNote={isSavingNote} /> : active === '知识文档' ? <KnowledgeBase documents={documents} importStatus={importStatus} onImport={importObsidianDocuments} onExportBackup={downloadBackup} onRestoreBackup={restoreBackup} selectedPaths={selectedDocuments} onToggleSelected={toggleDocumentSelected} onToggleAll={toggleAllDocuments} onDeleteSelected={deleteSelectedDocuments} onCreate={createDocument} onEdit={setEditingDocument} /> : <>
          <section className="welcome-row"><div><p className="date-line">星期四，2026 年 9 月 4 日 <span className="live-dot" /> 工作状态良好</p><h1>早上好，Donn<span className="wave">。</span></h1><p className="lede">这是你的今日工作脉络。AI 已经替你整理好重点，接下来专注于最重要的事。</p></div><button className="primary-btn"><Plus size={17} /> 新建工作流</button></section>

          <section className="insight-grid">
            <article className="insight-card hero-insight"><div className="card-top"><span className="eyebrow"><Sparkles size={13} /> 今日 AI 结论</span><span className="card-time">09:12 更新</span></div><div className="insight-copy"><h2>你的下一步，应该更靠近用户。</h2><p>过去 7 天的访谈与反馈里，“首次使用的理解成本”出现了 11 次。建议今天优先验证首屏引导，而不是继续扩展功能范围。</p></div><div className="insight-foot"><span><Target size={15} /> 基于 4 份知识文档</span><button className="text-btn">查看完整分析 <ArrowUpRight size={15} /></button></div></article>
            <article className="stat-card"><div className="stat-head"><span>AI 消耗</span><button className="icon-btn small"><MoreHorizontal size={16} /></button></div><div className="stat-value">34.2k <small>tokens</small></div><div className="stat-meta up"><ArrowUpRight size={14} /> 12.8% <span>较上周</span></div><div className="bars" aria-label="近七日 AI 消耗"><i style={{ height: '36%' }} /><i style={{ height: '54%' }} /><i style={{ height: '44%' }} /><i style={{ height: '70%' }} /><i style={{ height: '58%' }} /><i style={{ height: '82%' }} /><i className="today" style={{ height: '68%' }} /></div><div className="bars-label"><span>8/29</span><span>今天</span></div></article>
            <article className="stat-card stat-tasks"><div className="stat-head"><span>今日待办</span><span className="count-badge">{openTasks} 项待处理</span></div><div className="stat-value">{tasks.filter((task) => task.done).length}<small> / {tasks.length}</small></div><div className="task-meter"><i ref={taskMeterRef} /></div><div className="stat-meta"><CheckCircle2 size={14} /> 完成进度 <span>{Math.round((tasks.filter((task) => task.done).length / tasks.length) * 100)}%</span></div></article>
          </section>

          <section className="section-grid"><div className="section-main"><div className="section-heading"><div><h3>今天要做什么</h3><p>把注意力放在真正推动事情前进的地方。</p></div><button className="subtle-btn">查看全部 <ArrowUpRight size={15} /></button></div><div className="task-list">{tasks.map((task) => <div className={`task-row ${task.done ? 'done' : ''}`} data-task-id={task.id} key={task.id}><span className="task-complete-sweep" aria-hidden="true" /><button className="check-btn" onClick={() => toggleTask(task.id)} aria-label={task.done ? '标记未完成' : '标记完成'}>{task.done ? <Check size={14} /> : <Circle size={17} />}</button><div className={`task-accent ${task.color}`} /><div className="task-info"><strong>{task.title}</strong><div><span>{task.project}</span><span className="task-divider" /><Clock3 size={13} /> <span>{task.time}</span></div></div><button className="icon-btn small task-more" aria-label="更多操作"><MoreHorizontal size={16} /></button></div>)}</div>{isAddingTask ? <form className="add-task-form" onSubmit={addTask}><Plus size={16} /><input autoFocus value={newTaskTitle} onChange={(event) => setNewTaskTitle(event.target.value)} onKeyDown={(event) => event.key === 'Escape' && (setIsAddingTask(false), setNewTaskTitle(''))} placeholder="输入待办内容" aria-label="待办内容" /><button type="submit" className="icon-btn small" aria-label="保存待办"><Check size={16} /></button><button type="button" className="icon-btn small" onClick={() => { setIsAddingTask(false); setNewTaskTitle('') }} aria-label="取消添加"><X size={16} /></button></form> : <button className="add-task" onClick={() => setIsAddingTask(true)}><Plus size={16} /> 添加一个待办</button>}</div>
            <div className="section-side"><div className="section-heading compact"><div><h3>最近结果</h3><p>AI 帮你完成的工作</p></div><button className="icon-btn small"><MoreHorizontal size={16} /></button></div><div className="result-list"><div className="result-item"><div className="result-icon blue"><MessageSquare size={16} /></div><div><strong>竞品动态周报</strong><small>已生成 · 12 分钟前</small></div><ChevronRight size={15} className="muted" /></div><div className="result-item"><div className="result-icon lime"><FileText size={16} /></div><div><strong>访谈摘要 · 03</strong><small>已整理 · 昨天 18:40</small></div><ChevronRight size={15} className="muted" /></div><div className="result-item"><div className="result-icon coral"><Zap size={16} /></div><div><strong>落地页文案变体</strong><small>已生成 · 昨天 16:22</small></div><ChevronRight size={15} className="muted" /></div></div><button className="view-all-btn">进入结果库 <ArrowUpRight size={15} /></button></div></section>

          <section className="dashboard-upper-grid"><AIAssistantPanel prompt={prompt} setPrompt={setPrompt} sent={sent} sendPrompt={sendPrompt} /><QuickNoteCapture noteText={noteText} setNoteText={setNoteText} noteImage={noteImage} noteError={noteError} onImageChange={selectNoteImage} onSave={saveNote} clearImage={() => setNoteImage(null)} isSavingNote={isSavingNote} onOpenNotes={() => setActive('瞬记')} /></section>

          <section className="bottom-grid"><div className="docs-panel"><div className="section-heading"><div><h3>知识文档</h3><p>你的工作记忆，持续被 AI 理解。</p></div><button className="subtle-btn">打开知识库 <ArrowUpRight size={15} /></button></div><div className="doc-list">{docs.map((doc) => <div className="doc-row" key={doc.title}><div className={`doc-icon ${doc.color}`}><FolderOpen size={19} /></div><div className="doc-info"><strong>{doc.folder}</strong><span>{doc.count} 篇文档 · 最近：{doc.title}</span></div><time>{doc.date}</time><ChevronRight size={15} className="muted" /></div>)}</div></div></section>
            </>}
        </div>
      </main>
    </div>
  )
}

export default App

createRoot(document.getElementById('root')).render(<App />)
