-- shipment_items.tree_id は外部キーだが索引が無く、tree_id で引く問い合わせが
-- shipment_items 全件の Seq Scan になっていた。
-- トップの出荷年度別集計(get_shipped_by_fiscal_year)が、出荷済み2,444本×全件スキャンで ~1.3秒かかっていた。
-- FK列の索引不足という典型。tree_id 索引を足して index scan にする。
-- 読み取り高速化のみ。データ・スキーマの意味は変えない。
create index if not exists idx_shipment_items_tree on public.shipment_items (tree_id);
