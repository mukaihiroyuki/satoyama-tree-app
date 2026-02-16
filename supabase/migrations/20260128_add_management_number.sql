-- 管理番号機能追加
-- フォーマット: 25-AO-0001 (年-樹種コード-通し番号)

-- 1. species_master に樹種コード追加
ALTER TABLE species_master ADD COLUMN IF NOT EXISTS code TEXT;

-- コードにユニーク制約（NULL許容）
CREATE UNIQUE INDEX IF NOT EXISTS idx_species_master_code ON species_master(code) WHERE code IS NOT NULL;

-- 2. trees に管理番号追加
ALTER TABLE trees ADD COLUMN IF NOT EXISTS management_number TEXT;

-- 管理番号にユニーク制約とインデックス
CREATE UNIQUE INDEX IF NOT EXISTS idx_trees_management_number ON trees(management_number) WHERE management_number IS NOT NULL;
