import * as SQLite from 'expo-sqlite';

const DB_NAME = 'finpath.db';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync(DB_NAME);
    await db.execAsync('PRAGMA journal_mode = WAL;');
    await db.execAsync('PRAGMA foreign_keys = ON;');
  }
  return db;
}

export async function initializeDatabase(): Promise<void> {
  const database = await getDatabase();

  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      dob TEXT NOT NULL,
      monthly_income REAL DEFAULT 0,
      currency TEXT DEFAULT 'INR',
      pin TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      current_value REAL NOT NULL,
      currency TEXT DEFAULT 'INR',
      expected_roi REAL DEFAULT 0,
      is_recurring INTEGER DEFAULT 0,
      recurring_amount REAL,
      recurring_frequency TEXT,
      next_vesting_date TEXT,
      is_self_use INTEGER DEFAULT 0,
      gold_silver_unit TEXT,
      gold_silver_quantity REAL,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'INR',
      expense_type TEXT NOT NULL,
      frequency TEXT,
      start_date TEXT,
      end_date TEXT,
      inflation_rate REAL DEFAULT 6.0,
      is_income INTEGER DEFAULT 0,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL UNIQUE,
      retirement_age INTEGER NOT NULL,
      sip_stop_age INTEGER NOT NULL,
      fire_corpus REAL,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS inflation_defaults (
      category TEXT PRIMARY KEY,
      default_rate REAL NOT NULL
    );

    INSERT OR IGNORE INTO inflation_defaults VALUES ('GENERAL', 6.0);
    INSERT OR IGNORE INTO inflation_defaults VALUES ('EDUCATION', 10.0);
    INSERT OR IGNORE INTO inflation_defaults VALUES ('MEDICAL', 8.0);
    INSERT OR IGNORE INTO inflation_defaults VALUES ('FOOD', 6.0);
    INSERT OR IGNORE INTO inflation_defaults VALUES ('REAL_ESTATE', 7.0);
  `);

  // Migrations: add columns that may not exist in older installs
  try {
    await database.execAsync('ALTER TABLE goals ADD COLUMN pension_income REAL DEFAULT 0');
  } catch (_) {
    // column already exists — safe to ignore
  }
  try {
    await database.execAsync('ALTER TABLE profiles ADD COLUMN failed_attempts INTEGER DEFAULT 0');
  } catch (_) {}
  try {
    await database.execAsync('ALTER TABLE profiles ADD COLUMN lockout_until INTEGER DEFAULT 0');
  } catch (_) {}
}
