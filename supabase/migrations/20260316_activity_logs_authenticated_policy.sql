-- activity_logsテーブルにauthenticatedロール用のポリシーを追加
-- anonのみポリシーがあり、ログイン済みユーザーがactivity_logsを読めなかった問題を修正
CREATE POLICY "Allow all for authenticated" ON activity_logs
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);
