-- =============================================
-- 里山プロジェクト Storage RLSポリシー
-- =============================================
-- tree-photos バケットのセキュリティ設定
-- 認証ユーザーのみアップロード・閲覧可能にする

-- 1. 認証ユーザーのみ画像をアップロード可能
CREATE POLICY "authenticated_upload_tree_photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'tree-photos');

-- 2. 認証ユーザーのみ画像を閲覧可能
CREATE POLICY "authenticated_select_tree_photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'tree-photos');

-- 3. 認証ユーザーのみ画像を更新可能
CREATE POLICY "authenticated_update_tree_photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'tree-photos')
WITH CHECK (bucket_id = 'tree-photos');

-- 4. 認証ユーザーのみ画像を削除可能
CREATE POLICY "authenticated_delete_tree_photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'tree-photos');
