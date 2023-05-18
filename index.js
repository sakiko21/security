import express from "express";
import { readFileSync } from "fs";
import serveStatic from "serve-static";
import { TechGeekDB } from "./techgeek-db.js";
import cookieParser from "cookie-parser";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";

const app = express();
const PORT = 3000;
const FRONT_END_PATH = "./views";
TechGeekDB.init();
// ミドルウェアの定義
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.set("view engine", "ejs");

// 全てのCORSリクエストを許可する
// app.use((req, res, next) => {
//   res.header("Access-Control-Allow-Origin", "*");
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
    const user = jwt.verify(token, "techgeek");
    req.user = user;
    const { category } = req.query;
    console.log("body:", req.body, category)
    let posts;
    if (category) {
      posts = await TechGeekDB.getPostsByCategory(user.email, category);
    } else {
      posts = await TechGeekDB.getPosts(user.email);
    }
    return res.render("post.ejs", { user, posts });
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
  res.cookie("session_key", token, { maxAge: 1000 * 60 * 60 * 24 });
  return res.redirect("/post");
});

app.post("/api/post", async (req, res) => {
  const { content, session, category } = req.body;
  console.log(req.body);
  // sessionからユーザー情報を取得
  const user = jwt.verify(session, "techgeek");
  console.log(user);
  const post = await TechGeekDB.createPost(category, content, user.name, user.phone, user.email);
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