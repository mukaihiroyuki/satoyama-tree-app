-- activity_logsにresolved_atカラムを追加（スキャンエラー等のアラート処理済み管理用）
ALTER TABLE activity_logs ADD COLUMN resolved_at timestamptz DEFAULT NULL;
