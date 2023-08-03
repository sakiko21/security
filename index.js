import express from "express";
import { readFileSync } from "fs";
import serveStatic from "serve-static";
import { TechGeekDB } from "./techgeek-db.js";
import cookieParser from "cookie-parser";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import escape from "escape-html"; // クロスサイトスクリプティング対策
//import csrf from "csrf"; // CSRF対策
import crypto from 'crypto'; // CSRF対策
import dotenv from "dotenv";
dotenv.config();
import bodyParser from "body-parser";//


const app = express();
const PORT = 3000;
const FRONT_END_PATH = "./views";
TechGeekDB.init();
// ミドルウェアの定義
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: false }));//

//CSRFトークン生成用の関数
async function generateRandomString() {
  const csrfToken = crypto.randomBytes(32).toString('hex');
  const hashedCsrfToken = await bcryptjs.hash(csrfToken, 10);
  console.log("//CSRFトークン生成用の関数csrfToken:", csrfToken);
  console.log("//CSRFトークン生成用の関数hashedCsrfToken:", hashedCsrfToken);
  return {csrfToken, hashedCsrfToken};
}


// 全てのCORSリクエストを許可する
// app.use((req, res, next) => {
//   res.header("Access-Control-Allow-Origin", "*");
//   res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
//   next();
// });

app.get("/post", async (req, res, next) => {
  // ログインチェック
  const token = req.cookies.session_key;
  if (!token) {
    return res.redirect("/login.html");
  }
  try {
    const { csrfToken, hashedCsrfToken } = await generateRandomString();
    console.log("ハッシュ化する前csrfToken:", csrfToken);
    console.log("クッキーに保存したハッシュ化済みのトークンhashedCsrfToken:", hashedCsrfToken)
    res.cookie('hashedCsrfToken', hashedCsrfToken, { httpOnly: true });

    const user = jwt.verify(token, "techgeek");
    req.user = user;
    const { category } = req.query;
    console.log("body:", req.body, category)
    let posts;
    if (category) {
      posts = await TechGeekDB.getPostsByCategory(user.email, category);
    } else {
      posts = await TechGeekDB.getAllPosts();
    }
    res.render("post.ejs", { user, posts, csrfToken});
  } catch (err) {
    console.log(err);
    return res.redirect("/login.html");
  }
});

app.post("/api/signup", async (req, res) => {
  const { name, email, phone, password, confirm_password } = req.body;
  console.log(req.body);
  const hasedPassword = await bcryptjs.hash(password, 10);
  const user = await TechGeekDB.createUser(name, phone, email, hasedPassword);
  const token = jwt.sign(user, "techgeek", { expiresIn: '1d' });
  res.cookie("session_key", token, { maxAge: 1000 * 60 * 60 * 24 });
  return res.redirect("/post");
});
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  console.log(req.body);
  const user = await TechGeekDB.getUser(email);
  if (!user) {
    console.log("ユーザーが見つかりません");
    return res.redirect("/login.html");
  }
  const isValidPassword = await bcryptjs.compare(password, user.password);
  if (!isValidPassword) {
    console.log("パスワードが間違っています");
    return res.redirect("/login.html");
  }

  const token = jwt.sign(user, "techgeek", { expiresIn: '1d' });
  res.cookie("session_key", token, { 
    maxAge: 1000 * 60 * 60 * 24,
    httpOnly: true,//クッキーをJavaScriptからアクセスできないようにする（XSSによってセッションキーを盗まれないように）
    secure: true, //セッションIDはHTTPSでのみ送信することで、中間者攻撃を防ぐ。HTTPS接続を前提とする設定なので環境に応じて設定を切り替える
  });
  return res.redirect("/post");
});

app.post("/api/post", async (req, res) => {
  try{
  const hashedCsrfToken = req.cookies.hashedCsrfToken;
  console.log("クッキーから取得したハッシュ化済みトークンhashedCsrfToken:", hashedCsrfToken);
  const { category, content, csrfToken } = req.body;
  console.log("csrfToken:", csrfToken);
  //csrfTokenがない場合
  if (!csrfToken) {
    return res.status(400).json({ error: 'CSRFトークンが提供されていません' });
  }
  const isValidCsrfToken = await bcryptjs.compare(csrfToken, hashedCsrfToken);
  console.log("isValidCsrfToken:", isValidCsrfToken);
  if (!isValidCsrfToken) {
    return res.status(403).json({ error: 'CSRFトークンが違います' });
  }
  const escapeContent = escape(content); //クロスサイトスクリプティング対策
  console.log(req.body);
  const session = req.cookies.session_key;
  // sessionからユーザー情報を取得
  const user = jwt.verify(session, "techgeek");
  console.log(user);
  console.log('Category:', category);

  //const post = await TechGeekDB.createPost(category, content, user.name, user.phone, user.email);
  const post = await TechGeekDB.createPost(category, escapeContent, user.name, user.phone, user.email);
  console.log({ post });
  return res.redirect("/post");
} catch (error) {
  console.error(error);
    return res.status(500).json({ error: 'サーバーエラーが発生しました' });
    throw error;
  }
});
app.get("/api/posts", async (req, res) => {
  console.log("/api/posts");
  const { category } = req.query;
  let posts;
  if (category) {
    posts = await TechGeekDB.getPostsByCategory(category);
  } else {
    posts = await TechGeekDB.getAllPosts();
  }
  return res.status(200).json(posts);
});


app.use(serveStatic(FRONT_END_PATH, { index: false }));

app.get("/*", (req, res) => {
  return res
    .status(200)
    .set("Content-Type", "text/html")
    .send(readFileSync(`${FRONT_END_PATH}/index.html`));
});

app.listen(PORT, () => {
  console.log(`Server is running on port http://localhost:${PORT}`);
});