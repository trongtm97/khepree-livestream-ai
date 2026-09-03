import type Database from "better-sqlite3";
import type { ApprovalItem, LiveEvent, ProductDNA } from "../../shared/live-types";

export class ProductRepository {
  constructor(private readonly db: Database.Database) {}

  list(): ProductDNA[] {
    return this.db.prepare("SELECT json FROM products ORDER BY updated_at DESC")
      .all()
      .map((row: any) => JSON.parse(row.json) as ProductDNA);
  }

  save(product: ProductDNA): void {
    this.db.prepare(`
      INSERT INTO products(id, json, updated_at)
      VALUES(?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET json=excluded.json, updated_at=excluded.updated_at
    `).run(product.id, JSON.stringify(product), product.updatedAt);
  }

  get(id: string): ProductDNA | undefined {
    const row = this.db.prepare("SELECT json FROM products WHERE id=?").get(id) as any;
    return row ? JSON.parse(row.json) : undefined;
  }
}

export class LiveEventRepository {
  constructor(private readonly db: Database.Database) {}
  save(sessionId: string | null, event: LiveEvent): void {
    this.db.prepare(`
      INSERT OR IGNORE INTO live_events(id, session_id, sequence, type, source, timestamp, json)
      VALUES(?, ?, ?, ?, ?, ?, ?)
    `).run(
      event.id, sessionId, event.sequence, event.type,
      event.source, event.timestamp, JSON.stringify(event)
    );
  }
}

export class ApprovalRepository {
  constructor(private readonly db: Database.Database) {}
  save(sessionId: string | null, item: ApprovalItem): void {
    this.db.prepare(`
      INSERT INTO approvals(id, session_id, status, created_at, resolved_at, json)
      VALUES(?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status=excluded.status,
        resolved_at=excluded.resolved_at,
        json=excluded.json
    `).run(
      item.id, sessionId, item.status, item.createdAt,
      item.resolvedAt ?? null, JSON.stringify(item)
    );
  }
}
