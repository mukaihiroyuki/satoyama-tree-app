-- =============================================
-- 里山プロジェクト RLS（Row Level Security）有効化
-- =============================================
-- 実行方法: Supabase Dashboard > SQL Editor でこのファイルを実行

-- 1. 全テーブルでRLS有効化
ALTER TABLE trees ENABLE ROW LEVEL SECURITY;
ALTER TABLE species_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_items ENABLE ROW LEVEL SECURITY;

-- 2. trees テーブルのポリシー
CREATE POLICY "authenticated_select_trees" ON trees
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "authenticated_insert_trees" ON trees
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "authenticated_update_trees" ON trees
    FOR UPDATE TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "authenticated_delete_trees" ON trees
    FOR DELETE TO authenticated
    USING (true);

-- 3. species_master テーブルのポリシー
CREATE POLICY "authenticated_select_species" ON species_master
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "authenticated_insert_species" ON species_master
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "authenticated_update_species" ON species_master
    FOR UPDATE TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "authenticated_delete_species" ON species_master
    FOR DELETE TO authenticated
    USING (true);

-- 4. clients テーブルのポリシー
CREATE POLICY "authenticated_select_clients" ON clients
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "authenticated_insert_clients" ON clients
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "authenticated_update_clients" ON clients
    FOR UPDATE TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "authenticated_delete_clients" ON clients
    FOR DELETE TO authenticated
    USING (true);

-- 5. shipments テーブルのポリシー
CREATE POLICY "authenticated_select_shipments" ON shipments
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "authenticated_insert_shipments" ON shipments
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "authenticated_update_shipments" ON shipments
    FOR UPDATE TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "authenticated_delete_shipments" ON shipments
    FOR DELETE TO authenticated
    USING (true);

-- 6. shipment_items テーブルのポリシー
CREATE POLICY "authenticated_select_shipment_items" ON shipment_items
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "authenticated_insert_shipment_items" ON shipment_items
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "authenticated_update_shipment_items" ON shipment_items
    FOR UPDATE TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "authenticated_delete_shipment_items" ON shipment_items
    FOR DELETE TO authenticated
    USING (true);

-- =============================================
-- 注意: このSQLを実行後、Supabase Dashboard で
-- Storage > tree-photos > Policies も設定してください
-- =============================================
