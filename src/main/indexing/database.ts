import type Database from 'better-sqlite3'
export function initializeIndex(db:Database.Database){
 db.pragma('journal_mode = WAL');db.pragma('busy_timeout = 5000')
 db.exec('CREATE TABLE IF NOT EXISTS documents(id TEXT PRIMARY KEY,path TEXT NOT NULL,hash TEXT NOT NULL,title TEXT NOT NULL,body TEXT NOT NULL,module TEXT NOT NULL,kind TEXT NOT NULL,role TEXT NOT NULL,date TEXT NOT NULL,updated_at TEXT NOT NULL,search_text TEXT NOT NULL,json TEXT NOT NULL); CREATE INDEX IF NOT EXISTS document_filter ON documents(module,kind,date)')
}
