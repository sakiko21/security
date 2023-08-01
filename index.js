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

const app = express();
const PORT = 3000;
const FRONT_END_PATH = "./views";
TechGeekDB.init();
// ミドルウェアの定義
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.set("view engine", "ejs");

const CRYPT_KEY = process.env.CRYPT_KEY;
console.log("CRYPT_KEY", CRYPT_KEY);
const InitializationVector_LENGTH = 16; // 初期化ベクトルの長さを指定する
const ALGORITHM = 'aes192';//暗号化アルゴリズムを指定する


//暗号化の関数
function encrypt(text) {
  //ランダムな文字列を生成
  let InitializationVector = crypto.randomBytes(InitializationVector_LENGTH);
  //生成したランダムな文字列をクッキーに保存する。
  let cipher = crypto.createCipher(ALGORITHM, text);
  //文字列を暗号化する
  cipher.update(text, "utf8", "hex")
  console.log({cipher, text})
  return cipher.final('hex');
  
  //ランダムな初期化ベクトルを生成する「crypto.randomBytes () メソッドは、暗号的に適切に構築された人工ランダム データと、記述されたコード内で生成されるバイト数を生成するために使用されます。」
  // let InitializationVector = crypto.randomBytes(InitializationVector_LENGTH);
  // let cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(CRYPT_KEY), InitializationVector);
  // //暗号化処理を行う
  // return InitializationVector.toString('hex') + ':' + clipher.update(text).toString('hex');
}
  //復号化の関数
  function decrypt(text) {
    // let textParts = text.split(':');
    // let InitializationVector = Buffer.from(textParts.shift(), 'hex');
    // let encryptedText = Buffer.from(textParts.join(':'), 'hex');
    console.log("複合化:", { text })
    let decipher = crypto.createDecipher(ALGORITHM, text);
    decipher.update(text, "hex", "utf8")
    console.log("複合化:", { decipher })
    // hexに変換
    return decipher.final('utf8');
  }
  
  app.post('/process', function(req, res) {
    const csrfTokenFromCookie = req.cookies.csrfToken; // トークンをクッキーから取得
    const csrfTokenPost = decrypt(req.body._csrf); 
    if (csrfTokenPost === csrfTokenFromCookie) {
      res.status(200).json({ message: 'Content processed successfully' });
    } else {
      res.status(403).json({ error: 'Invalid CSRF token' });
    }
  });

// 全てのCORSリクエストを許可する
// app.use((req, res, next) => {
//   res.header("Access-Control-Allow-Origin", "*");
//   res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
//   next();
// });

app.get("/post", async (req, res, next) => {
  // ログインチェック
  console.log("url", req.url);
  const token = req.cookies.session_key;
  if (!token) {
    return res.redirect("/login.html");
  }
  try {
    const csrfToken = crypto.randomBytes(32).toString('hex'); // ランダムな文字列を生成
    const encryptedToken = encrypt(csrfToken); // 暗号化
    res.cookie('csrfToken', csrfToken, { httpOnly: true }); // cookieを httpOnly にした
  
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
    res.render("post.ejs", { user, posts, csrfToken: encryptedToken });
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
  const token = req.cookies.csrfToken;

  const { content, category, _csrf } = req.body;
  console.log("content, category, _csrf", {content, category, _csrf});
  const csrfTokenPost = decrypt(_csrf);
  console.log("トークンを表示：", csrfTokenPost, token);

  if (csrfTokenPost !== token) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  
  const escapeContent = escape(content); //クロスサイトスクリプティング対策
  console.log(req.body);
  const session = req.cookies.session_key;
  // sessionからユーザー情報を取得
  const user = jwt.verify(session, "techgeek");
  console.log(user);
  const post = await TechGeekDB.createPost(category, content, user.name, user.phone, user.email);
  //const post = await TechGeekDB.createPost(category, escapeContent, user.name, user.phone, user.email);
  console.log({ post });
  return res.redirect("/post");
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