// Roda o schema.sql no banco configurado no .env.
//
// Uso: dentro da pasta ServidorFielduo, com o .env já preenchido:
//   npm install
//   node scripts/rodar-schema.js
//
// Não precisa de nenhuma ferramenta extra (Workbench, DBeaver, etc.) —
// usa a mesma biblioteca mysql2 que o server.js já usa.

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

async function main() {
  const schemaPath = path.join(__dirname, "..", "schema.sql");
  let sql = fs.readFileSync(schemaPath, "utf8");

  // Remove as linhas de CREATE DATABASE / USE: no Aiven (e na maioria dos
  // bancos na nuvem) você já se conecta direto no banco que foi criado pra
  // você — não precisa (e às vezes não tem permissão) criar outro do zero.
  sql = sql
    .split("\n")
    .filter((linha) => !/^\s*(CREATE DATABASE|USE)\b/i.test(linha))
    .join("\n");

  const caPath = process.env.DB_CA_PATH || path.join(__dirname, "..", "certs", "ca.pem");
  const temCertificado = fs.existsSync(caPath);
  const config = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true, // permite rodar o arquivo inteiro de uma vez
    ...(process.env.DB_SSL === "true"
      ? temCertificado
        ? { ssl: { ca: fs.readFileSync(caPath), rejectUnauthorized: true } }
        : { ssl: { rejectUnauthorized: false } }
      : {}),
  };

  if (process.env.DB_SSL === "true" && !temCertificado) {
    console.warn(
      `⚠️  Certificado não encontrado em ${caPath} — conectando sem verificar a identidade do servidor. ` +
      `Baixe o "CA certificate" no painel do Aiven e salve nesse caminho para a verificação completa.`,
    );
  }

  if (!config.host || !config.user || !config.database) {
    console.error("❌ Preencha DB_HOST, DB_USER, DB_PASSWORD e DB_NAME no arquivo .env antes de rodar este script.");
    process.exit(1);
  }

  console.log(`Conectando em ${config.host}:${config.port}/${config.database}...`);
  const connection = await mysql.createConnection(config);

  console.log("Rodando schema.sql...");
  await connection.query(sql);

  console.log("✅ Schema aplicado com sucesso!");

  const [tabelas] = await connection.query("SHOW TABLES");
  console.log("Tabelas no banco agora:", tabelas.map((t) => Object.values(t)[0]).join(", "));

  await connection.end();
}

main().catch((err) => {
  console.error("❌ Erro ao rodar o schema:", err.message);
  process.exit(1);
});
