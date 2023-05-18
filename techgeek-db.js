// DBは、PostgreSQLを採用
// postgres://ユーザー名:パスワード@localhost:port/DB名
import pg from 'pg';
export const TechGeekDB = {
  init: async function () {
    const hasUsersTable = await this.__hasUsersTable();
    console.log(hasUsersTable);
    if (hasUsersTable) {
      this.ready = Promise.resolve();
    } else {
      const query = `
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          phone VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL,
          password VARCHAR(255) NOT NULL,
          createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `;
      this.ready = this.__query(query);
    }

    const hasPostsTable = await this.__hasPostsTable();

    if (hasPostsTable) {
      this.ready = Promise.resolve();
    } else {
      const query = `
        CREATE TABLE posts (
          id SERIAL PRIMARY KEY,
          user_name VARCHAR(255) NOT NULL,
          user_email VARCHAR(255) NOT NULL,
          user_phone VARCHAR(255) NOT NULL,
          content VARCHAR(255) NOT NULL,
          category VARCHAR(255) NOT NULL,
          createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `;
      this.ready = this.__query(query);
    }

  },
  __hasUsersTable: async function () {
    const query = `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_name = 'users'
      )
    `;
    const result = await this.__query(query);
    return result.rows[0].exists;
  },
  __hasPostsTable: async function () {
    const query = `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_name = 'posts'
      )
    `;
    const result = await this.__query(query);
    return result.rows[0].exists;
  },
  __query: function (sql, params = []) {
    const pool = new pg.Pool({
      connectionString: "postgres://morimotoryuuji:@localhost:5432/security",     //process.env.DATABASE_URL,
      ssl: false //process.env.NODE_ENV == "development" ? false : { rejectUnauthorized: false }
    });
    return new Promise((resolve, reject) => {
      pool.query(sql, params, (err, result) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(result);
      });
    });
  },
  createUser: async function (name, phone, email, password) {
    await this.ready;
    const query = `
      INSERT INTO users (name, phone, email, password)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, phone, email, createdAt
    `;
    const result = await this.__query(query, [name, phone, email, password]);
    console.log(result.rows[0]);
    return result.rows[0];
  },
  getUser: async function (email) {
    await this.ready;
    const query = `
      SELECT * FROM users
      WHERE email = $1
    `;
    const result = await this.__query(query, [email]);
    return result.rows[0];
  },
  getUserById: async function (id) {
    await this.ready;
    const query = `
      SELECT * FROM users
      WHERE id = $1
    `;
    const result = await this.__query(query, [id]);
    return result.rows[0];
  },
  createPost: async function (category, content, user_name, user_phone, user_email) {
    await this.ready;
    const query = `
      INSERT INTO posts (category, content, user_name, user_phone, user_email)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, category, content, user_name, user_phone, user_email, createdAt
    `;
    const result = await this.__query(query, [category, content, user_name, user_phone, user_email]);
    return result.rows[0];
  },
  getPosts: async function (user_email) {
    await this.ready;
    const query = `
      SELECT * FROM posts
      WHERE user_email = $1
    `;
    const result = await this.__query(query, [user_email]);
    return result.rows;
  },
  getPost: async function (id) {
    await this.ready;
    const query = `
      SELECT * FROM posts
      WHERE id = $1
    `;
    const result = await this.__query(query, [id]);
    return result.rows[0];
  },
  getAllPosts: async function () {
    await this.ready;
    const query = `
      SELECT * FROM posts
    `;
    const result = await this.__query(query);
    return result.rows;
  },
  getPostsByCategory: async function (user_email, category) {
    await this.ready;
    const query = `
      SELECT * FROM posts
      WHERE category = '${category}' AND user_email = '${user_email}'
    `;
    console.log(query);
    const result = await this.__query(query);
    return result.rows;
  },
  updatePost: async function (id, category, content, user_name, user_phone, user_email) {
    await this.ready;
    const query = `
      UPDATE posts
      SET category = $2, content = $3, user_name = $4, user_phone = $5, user_email = $6
      WHERE id = $1
      RETURNING id, category, content, user_name, user_phone, user_email, createdAt
    `;
    const result = await this.__query(query, [id, category, content, user_name, user_phone, user_email]);
    return result.rows[0];
  },
  deletePost: async function (id) {
    await this.ready;
    const query = `
      DELETE FROM posts
      WHERE id = $1
    `;
    await this.__query(query, [id]);
  }
};