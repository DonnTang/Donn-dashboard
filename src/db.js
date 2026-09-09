import Dexie from 'dexie'

export const db = new Dexie('orbit-workbench')

db.version(1).stores({
  tasks: 'id, done, updatedAt',
  messages: '++id, createdAt',
  usage: 'id, date',
})

db.version(2).stores({
  tasks: 'id, done, updatedAt',
  messages: '++id, createdAt',
  usage: 'id, date',
  notes: '++id, createdAt',
})

db.version(3).stores({
  tasks: 'id, done, updatedAt',
  messages: '++id, createdAt',
  usage: 'id, date',
  notes: '++id, createdAt',
  documents: '&path, project, title, importedAt',
})

db.version(4).stores({
  tasks: 'id, done, updatedAt',
  messages: '++id, createdAt',
  usage: 'id, date',
  notes: '++id, createdAt',
  documents: '&path, project, title, importedAt, updatedAt',
}).upgrade((tx) => tx.table('documents').toCollection().modify((document) => {
  document.updatedAt ??= document.importedAt ?? Date.now()
}))

db.version(5).stores({
  tasks: 'id, done, updatedAt',
  messages: '++id, createdAt',
  usage: 'id, date',
  notes: '++id, createdAt',
  documents: '&path, project, title, importedAt, updatedAt',
  folders: '&name, createdAt, updatedAt',
}).upgrade(async (tx) => {
  const now = Date.now()
  const documents = await tx.table('documents').toArray()
  const names = [...new Set(['个人文件', ...documents.map((document) => document.project || '个人文件')])]
  await tx.table('folders').bulkPut(names.map((name) => ({ name, createdAt: now, updatedAt: now })))
  await tx.table('documents').toCollection().modify((document) => {
    document.project ||= '个人文件'
  })
})

db.version(6).stores({
  tasks: 'id, done, updatedAt',
  messages: '++id, createdAt',
  usage: 'id, date',
  notes: '++id, createdAt',
  documents: '&path, project, title, importedAt, updatedAt',
  folders: '&name, parent, createdAt, updatedAt',
}).upgrade((tx) => tx.table('folders').toCollection().modify((folder) => {
  folder.label ??= folder.name.split('/').at(-1)
  folder.parent ??= null
}))

db.version(7).stores({
  tasks: 'id, done, updatedAt',
  messages: '++id, createdAt',
  usage: 'id, date',
  notes: '++id, createdAt',
  documents: '&path, project, title, importedAt, updatedAt',
  folders: '&name, parent, createdAt, updatedAt',
  resources: '++id, title, category, createdAt',
})

export async function seedDatabase(tasks) {
  if (await db.tasks.count()) return
  await db.tasks.bulkAdd(tasks.map((task) => ({ ...task, updatedAt: Date.now() })))
}

export async function exportDatabase() {
  const data = {}
  for (const table of db.tables) data[table.name] = await table.toArray()
  return { version: 7, exportedAt: new Date().toISOString(), data }
}

export async function importDatabase(backup) {
  if (!backup?.data || typeof backup.data !== 'object') throw new Error('invalid backup')
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
      const rows = Array.isArray(backup.data[table.name]) ? backup.data[table.name] : []
      await table.clear()
      if (rows.length) await table.bulkPut(rows)
    }
    await db.documents.toCollection().modify((document) => {
      document.updatedAt ??= document.importedAt ?? Date.now()
      document.project ||= '个人文件'
    })
    const now = Date.now()
    const documents = await db.documents.toArray()
    const names = [...new Set(['个人文件', ...documents.flatMap((document) => document.project.split('/').map((_, index, parts) => parts.slice(0, index + 1).join('/')))])]
    await db.folders.bulkPut(names.map((name) => ({ name, label: name.split('/').at(-1), parent: name.includes('/') ? name.split('/').slice(0, -1).join('/') : null, createdAt: now, updatedAt: now })))
  })
}
