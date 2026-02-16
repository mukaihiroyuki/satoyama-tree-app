-- ==========================================
-- 100点設計：出荷・クライアント管理 拡張SQL
-- ==========================================

-- 1. クライアントマスター（将来の拡張性を持たせる）
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,                -- 氏名・会社名
  tel text,                          -- 電話番号
  email text,                        -- メールアドレス
  postal_code text,                  -- 郵便番号
  address text,                      -- 住所/納品先
  notes text,                        -- 取引上の注意点
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. 出荷履歴の拡張
-- destination カラムをより柔軟にするため、カラムを追加
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES clients(id);
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS destination_name text; -- 現場名など
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS logistics_info text;   -- 運送会社名など

-- 3. 出荷明細の拡張（実売価格の記録）
ALTER TABLE shipment_items ADD COLUMN IF NOT EXISTS unit_price integer;     -- その時の実売単価
ALTER TABLE shipment_items ADD COLUMN IF NOT EXISTS discount_amount integer DEFAULT 0; -- 値引き額

-- 4. 樹木テーブルのステータス制約の確認と更新（必要に応じて）
-- すでに trees テーブルがある前提
-- 予約済み (reserved) をより活用できるようにする
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trees_status_check') THEN
    ALTER TABLE trees ADD CONSTRAINT trees_status_check CHECK (status IN ('in_stock', 'reserved', 'shipped', 'dead'));
  END IF;
END $$;

-- インデックスの追加
CREATE INDEX IF NOT EXISTS idx_shipments_client ON shipments(client_id);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);
