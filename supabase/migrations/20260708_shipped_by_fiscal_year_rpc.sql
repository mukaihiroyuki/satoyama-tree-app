-- トップページ「出荷済み（年度別）」の集計をDB側で行うRPC。
-- 従来はアプリ側で shipped 樹木を全件取得し for 文で集計していた（出荷が増えるほど線形に重い）。
-- 本関数は年度別の件数だけを返す。年度=4月〜翌3月。start_year=年度開始の西暦。
-- start_year が NULL の行は「出荷日を特定できない」件数（画面の「出荷日 未入力」）。
-- security invoker なので trees/shipment_items/shipments の既存RLSがそのまま効く（見える行は従来と同一）。
-- 出荷データ本体は一切変更しない（読み取りのみ）。
create or replace function public.get_shipped_by_fiscal_year()
returns table (start_year integer, cnt bigint)
language sql
stable
security invoker
set search_path = public
as $$
  with per_tree as (
    -- 樹木1本につき1件。JSの shipment_items[0] 相当＝最小idの出荷明細の shipped_at を代表値にする。
    select
      t.id as tree_id,
      (
        select s.shipped_at
        from shipment_items si
        join shipments s on s.id = si.shipment_id
        where si.tree_id = t.id
        order by si.id asc
        limit 1
      ) as shipped_at
    from trees t
    where t.status = 'shipped'
  )
  select
    case
      when shipped_at is null then null
      else extract(year from shipped_at)::int
           - case when extract(month from shipped_at) < 4 then 1 else 0 end
    end as start_year,
    count(*)::bigint as cnt
  from per_tree
  group by 1;
$$;

-- Data API から呼べるようGRANT（サーバークライアントは anon/authenticated で動作）
grant execute on function public.get_shipped_by_fiscal_year() to anon;
grant execute on function public.get_shipped_by_fiscal_year() to authenticated;
grant execute on function public.get_shipped_by_fiscal_year() to service_role;
