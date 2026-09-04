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

export async function seedDatabase(tasks) {
  if (await db.tasks.count()) return
  await db.tasks.bulkAdd(tasks.map((task) => ({ ...task, updatedAt: Date.now() })))
}

export async function exportDatabase() {
  const data = {}
  for (const table of db.tables) data[table.name] = await table.toArray()
  return { version: 3, exportedAt: new Date().toISOString(), data }
}

export async function importDatabase(backup) {
  if (!backup?.data || typeof backup.data !== 'object') throw new Error('invalid backup')
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
      const rows = Array.isArray(backup.data[table.name]) ? backup.data[table.name] : []
      await table.clear()
      if (rows.length) await table.bulkPut(rows)
    }
  })
}
