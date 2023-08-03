# 開発内容
## 共通部分
  - ヘッダー
    - トップに戻るリンク
## トップページ 
  - 会員登録とログインボタンを設置。
  - ログイン済みであれば投稿画面にリダイレクトする
## 会員登録ページ
  - 会員登録フォームを設置。
    - ユーザー名
    - メールアドレス
    - 電話番号
    - パスワード
## ログインページ
  - ログインフォームを設置。
## 投稿画面
  - 記事のタイトルと本文を入力するフォームを設置。
  - 自分が投稿した内容の一覧を確認できる# security
# security
  -  [XSS対策]escape-htmlライブラリをインストール。index.jsにて、/api/postというエンドポイントについて、投稿内容をエスケープ
  -  [SQLインジェクション]getPostsByCategoryについて、 Category = $1 AND user_email = $2と変更
  -  [セッションハイジャック]XSSによりセッションが盗まれる可能性があるため、cookieのsecure属性をtrueに設定。セッションIDを定期的にリフレッシュする,ユーザがログアウトするときや一定時間アクティビティがないときにはセッションを破棄する→すでに{ expiresIn:'1d' })となっており、対策済み
  -  [CSRF]学習メモ一覧ページへアクセスする時(app.get("/post",~~~~)に、HTMLに平文のCSRFトークンを埋め込む。フォーム送信する際に、ハッシュ化したCSRFトークンをcookieに保存する。このコードで比較を行う→const isValidCsrfToken = await bcryptjs.compare(csrfToken, hashedCsrfToken);