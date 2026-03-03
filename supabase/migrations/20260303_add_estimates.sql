-- 見積テーブル
CREATE TABLE estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_number text NOT NULL,
  client_id uuid REFERENCES clients(id),
  rate numeric,
  status text DEFAULT '下書き',
  issued_at date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 見積明細テーブル
CREATE TABLE estimate_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid REFERENCES estimates(id) ON DELETE CASCADE,
  tree_id uuid REFERENCES trees(id),
  unit_price integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 出荷テーブルに見積IDを追加
ALTER TABLE shipments ADD COLUMN estimate_id uuid REFERENCES estimates(id);

-- RLS有効化
ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_items ENABLE ROW LEVEL SECURITY;

-- RLSポリシー（既存テーブルと同じパターン: 認証ユーザーは全操作可能）
CREATE POLICY "Authenticated users can select estimates"
  ON estimates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert estimates"
  ON estimates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update estimates"
  ON estimates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete estimates"
  ON estimates FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can select estimate_items"
  ON estimate_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert estimate_items"
  ON estimate_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update estimate_items"
  ON estimate_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete estimate_items"
  ON estimate_items FOR DELETE TO authenticated USING (true);
