import { Migration } from '@mikro-orm/migrations';

export class Migration20200101046370_outfits extends Migration {
  override name = 'Migration20200101046370_outfits';

  override up(): void {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS outfits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        day_id INTEGER NOT NULL REFERENCES days(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL DEFAULT 'Daywear',
        time_of_day TEXT,
        notes TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    this.addSql(`
      CREATE TABLE IF NOT EXISTS outfit_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        outfit_id INTEGER NOT NULL REFERENCES outfits(id) ON DELETE CASCADE,
        trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        packing_item_id INTEGER REFERENCES packing_items(id) ON DELETE SET NULL,
        category TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // One statement per addSql: better-sqlite3 refuses a string that carries more
    // than one, which kept a fresh install from ever finishing its migrations.
    this.addSql(`CREATE INDEX IF NOT EXISTS idx_outfits_trip_day ON outfits(trip_id, day_id);`);
    this.addSql(`CREATE INDEX IF NOT EXISTS idx_outfits_user ON outfits(user_id);`);
    this.addSql(`CREATE INDEX IF NOT EXISTS idx_outfit_items_outfit ON outfit_items(outfit_id);`);
    this.addSql(`CREATE INDEX IF NOT EXISTS idx_outfit_items_packing ON outfit_items(packing_item_id);`);
  }
}
