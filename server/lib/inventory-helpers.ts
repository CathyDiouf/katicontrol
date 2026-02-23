import { db, row } from '../db.js'

export function getQuantityConsumedBreakdown(
  itemId: number,
  dropId: number | null
): { total: number; production: number; sampling: number } {
  const sql = dropId
    ? `SELECT
        COALESCE(SUM(COALESCE(oiu.quantity_used, ipu.usage_per_piece)), 0) AS total,
        COALESCE(SUM(CASE WHEN (o.is_sample IS NULL OR o.is_sample = 0) THEN COALESCE(oiu.quantity_used, ipu.usage_per_piece) ELSE 0 END), 0) AS production,
        COALESCE(SUM(CASE WHEN o.is_sample = 1 THEN COALESCE(oiu.quantity_used, ipu.usage_per_piece) ELSE 0 END), 0) AS sampling
       FROM orders o
       JOIN inventory_product_usages ipu ON ipu.product_id = o.product_id AND ipu.item_id = ?
       LEFT JOIN order_inventory_usages oiu ON oiu.order_id = o.order_id AND oiu.item_id = ?
       WHERE o.production_status NOT IN ('cancelled','returned')
         AND o.drop_id = ?`
    : `SELECT
        COALESCE(SUM(COALESCE(oiu.quantity_used, ipu.usage_per_piece)), 0) AS total,
        COALESCE(SUM(CASE WHEN (o.is_sample IS NULL OR o.is_sample = 0) THEN COALESCE(oiu.quantity_used, ipu.usage_per_piece) ELSE 0 END), 0) AS production,
        COALESCE(SUM(CASE WHEN o.is_sample = 1 THEN COALESCE(oiu.quantity_used, ipu.usage_per_piece) ELSE 0 END), 0) AS sampling
       FROM orders o
       JOIN inventory_product_usages ipu ON ipu.product_id = o.product_id AND ipu.item_id = ?
       LEFT JOIN order_inventory_usages oiu ON oiu.order_id = o.order_id AND oiu.item_id = ?
       WHERE o.production_status NOT IN ('cancelled','returned')`

  const params = dropId ? [itemId, itemId, dropId] : [itemId, itemId]
  const r = row(db.prepare(sql).get(...params)) as any
  return {
    total:      r?.total      || 0,
    production: r?.production || 0,
    sampling:   r?.sampling   || 0,
  }
}

export function getQuantityConsumed(itemId: number, dropId: number | null): number {
  return getQuantityConsumedBreakdown(itemId, dropId).total
}
