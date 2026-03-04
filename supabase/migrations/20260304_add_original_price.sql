-- estimate_items に定価（original_price）カラムを追加
ALTER TABLE estimate_items ADD COLUMN original_price integer;

-- shipment_items に定価（original_price）カラムを追加
ALTER TABLE shipment_items ADD COLUMN original_price integer;

-- 既存データのバックフィル: estimate_items
-- rate が設定されていれば unit_price / rate で逆算、なければ unit_price そのまま
UPDATE estimate_items ei
SET original_price = CASE
    WHEN e.rate IS NOT NULL AND e.rate > 0 AND e.rate < 1
        THEN ROUND(ei.unit_price::numeric / e.rate)
    ELSE ei.unit_price
END
FROM estimates e
WHERE ei.estimate_id = e.id;

-- 既存データのバックフィル: shipment_items
-- shipments → estimates 経由で rate を取得
UPDATE shipment_items si
SET original_price = CASE
    WHEN e.rate IS NOT NULL AND e.rate > 0 AND e.rate < 1
        THEN ROUND(si.unit_price::numeric / e.rate)
    ELSE si.unit_price
END
FROM shipments s
LEFT JOIN estimates e ON s.estimate_id = e.id
WHERE si.shipment_id = s.id;

-- 見積なしの出荷（estimate_id が null）で original_price が null のままのものを unit_price で埋める
UPDATE shipment_items
SET original_price = unit_price
WHERE original_price IS NULL;
