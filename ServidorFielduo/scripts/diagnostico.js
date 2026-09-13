require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mysql = require("mysql2/promise");

(async () => {
  const cfg = {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "fielduo",
  };
  try {
    const conn = await mysql.createConnection(cfg);
    const [[row]] = await conn.query("SELECT DATABASE() AS banco, VERSION() AS versao");
    console.log("✅ MySQL conectado.");
    console.log(`   Banco: ${row.banco}`);
    console.log(`   Versão: ${row.versao}`);
    await conn.end();
  } catch (err) {
    console.error("❌ Falha na conexão MySQL.");
    console.error("   Código:", err.code || "não informado");
    console.error("   Mensagem:", err.message || "sem mensagem");
    process.exit(1);
  }
})();
