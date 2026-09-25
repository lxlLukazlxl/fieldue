require("dotenv").config();
require("dns").setDefaultResultOrder("ipv4first");

const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const PDFDocument = require("pdfkit");

const app = express();
const VERSAO = "2.3.2";
const PORT = Number(process.env.PORT || 3000);
const UPLOAD_DIR = path.join(__dirname, "uploads");
const JWT_SECRET = String(process.env.JWT_SECRET || "").trim();
const isProduction = String(process.env.NODE_ENV || "development").toLowerCase() === "production";
const allowDevNoAuth = String(process.env.ALLOW_DEV_NO_AUTH || "true").toLowerCase() === "true" && !isProduction;

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.disable("x-powered-by");
app.set("trust proxy", 1);

const ALLOWED_ORIGINS = String(process.env.ALLOWED_ORIGINS || "")
  .split(",").map(v => v.trim()).filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    if (!origin || ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error("Origem não autorizada pelo CORS."));
  },
}));
app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ limit: "12mb", extended: true }));
app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "7d", index: false }));
// Serve o painel web (gestao.html, index.html, config.js) direto pelo
// servidor: assim o painel funciona na mesma URL do Render, sem precisar
// abrir um arquivo local nem configurar CORS separado pra ele.
// IMPORTANTE: serve só a pasta public/ — nunca __dirname — pra não expor
// server.js, .env, certs/ ou node_modules como download estático.
app.use(express.static(path.join(__dirname, "public"), {
  index: "index.html",
  extensions: ["html"],
  setHeaders(res, filePath) {
    if (filePath.endsWith(".html")) res.setHeader("Cache-Control", "no-cache");
  },
}));

let db;

function montarConfigSSL() {
  if (process.env.DB_SSL !== "true") return {};
  const caPath = process.env.DB_CA_PATH || path.join(__dirname, "certs", "ca.pem");
  if (fs.existsSync(caPath)) {
    return { ssl: { ca: fs.readFileSync(caPath), rejectUnauthorized: true } };
  }
  console.warn(`⚠️ DB_SSL=true mas CA não encontrado em ${caPath}. Usando rejectUnauthorized=false.`);
  return { ssl: { rejectUnauthorized: false } };
}

const DB_CONFIG = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "fielduo",
  charset: "utf8mb4",
  ...montarConfigSSL(),
};

function dbIdentifier(value) {
  if (!/^[A-Za-z0-9_$-]+$/.test(String(value))) throw new Error("DB_NAME inválido.");
  return String(value);
}

async function conectarBanco() {
  const autoCreate = String(process.env.DB_AUTO_CREATE || "").trim() === "true" ||
    ["localhost", "127.0.0.1", "::1"].includes(DB_CONFIG.host);

  if (autoCreate) {
    const bootstrap = mysql.createConnection({ ...DB_CONFIG, database: undefined });
    try {
      const conn = await bootstrap;
      await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbIdentifier(DB_CONFIG.database)}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      await conn.end();
      console.log(`✅ Banco '${DB_CONFIG.database}' verificado/criado.`);
    } catch (err) {
      try { const c = await bootstrap; await c.end(); } catch (_) {}
      throw err;
    }
  }

  db = mysql.createPool({
    ...DB_CONFIG,
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_POOL_SIZE || 10),
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  });
  try {
    await db.query("SELECT 1 AS ok");
  } catch (err) {
    await db.end(); db = null; throw err;
  }
  console.log(`✅ Banco MySQL conectado: ${DB_CONFIG.host}/${DB_CONFIG.database}`);
}

function handleDbError(res, err, mensagem = "Erro ao acessar o banco de dados.") {
  console.error("Erro no banco:", err);
  return res.status(500).json({ erro: mensagem });
}
function validarId(id) { return /^\d+$/.test(String(id)) && Number(id) > 0; }
// Monta um "IN (...)" seguro a partir de uma lista de ids que já vieram do
// próprio banco (nunca direto do usuário) — por isso pode ser inserido
// direto na string, sem parâmetro. Lista vazia cai num "-1" (nunca bate com
// nenhum id real), pra não gerar "IN ()" inválido no SQL.
function inSql(ids) { return ids.length ? ids.map(Number).join(",") : "-1"; }
function normalizarEmail(v) { return String(v || "").trim().toLowerCase(); }
function base64url(input) { return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_"); }
function gerarToken(payload, expSeconds = 60 * 60 * 12) {
  if (JWT_SECRET.length < 32) throw new Error("JWT_SECRET precisa ter pelo menos 32 caracteres.");
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify({ ...payload, iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000) + expSeconds }));
  const sig = base64url(crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest());
  return `${header}.${body}.${sig}`;
}
function verificarToken(token) {
  if (!JWT_SECRET || JWT_SECRET.length < 32) throw new Error("JWT_SECRET não configurado corretamente.");
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new Error("Token inválido.");
  const [h, p, s] = parts;
  const esperado = base64url(crypto.createHmac("sha256", JWT_SECRET).update(`${h}.${p}`).digest());
  if (s.length !== esperado.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(esperado))) throw new Error("Token inválido.");
  const payload = JSON.parse(Buffer.from(p, "base64url").toString("utf8"));
  if (!payload.exp || payload.exp < Math.floor(Date.now()/1000)) throw new Error("Token expirado.");
  return payload;
}
function hashSenha(senha) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString("hex");
    crypto.scrypt(String(senha), salt, 64, { N: 16384, r: 8, p: 1 }, (err, derived) => {
      if (err) return reject(err);
      resolve(`scrypt$${salt}$${derived.toString("hex")}`);
    });
  });
}
function verificarSenha(senha, stored) {
  return new Promise((resolve, reject) => {
    const [alg, salt, hex] = String(stored || "").split("$");
    if (alg !== "scrypt" || !salt || !hex) return resolve(false);
    crypto.scrypt(String(senha), salt, 64, { N: 16384, r: 8, p: 1 }, (err, derived) => {
      if (err) return reject(err);
      const a = Buffer.from(hex, "hex");
      resolve(a.length === derived.length && crypto.timingSafeEqual(a, derived));
    });
  });
}

async function buscarEmpresaPadrao() {
  const [[row]] = await db.query("SELECT id FROM empresas ORDER BY id LIMIT 1");
  if (!row) throw new Error("Nenhuma empresa cadastrada.");
  return Number(row.id);
}

async function autenticar(req, res, next) {
  const auth = String(req.header("authorization") || "");
  const apiKey = String(req.header("x-api-key") || "").trim();

  if (auth.toLowerCase().startsWith("bearer ")) {
    try {
      const payload = verificarToken(auth.slice(7).trim());
      req.auth = { tipo: "jwt", usuarioId: Number(payload.sub), empresaId: Number(payload.empresa_id), perfil: payload.perfil, email: payload.email };
      return next();
    } catch (err) {
      return res.status(401).json({ erro: err.message || "Token inválido ou expirado." });
    }
  }

  const chaveConfigurada = String(process.env.API_KEY || "").trim();
  if (apiKey && chaveConfigurada && apiKey.length === chaveConfigurada.length && crypto.timingSafeEqual(Buffer.from(apiKey), Buffer.from(chaveConfigurada))) {
    try {
      req.auth = { tipo: "api_key", usuarioId: null, empresaId: await buscarEmpresaPadrao(), perfil: "ADMIN" };
      return next();
    } catch (err) { return handleDbError(res, err, "Não foi possível identificar a empresa."); }
  }

  if (allowDevNoAuth) {
    try {
      req.auth = { tipo: "dev", usuarioId: null, empresaId: await buscarEmpresaPadrao(), perfil: "ADMIN" };
      return next();
    } catch (err) { return handleDbError(res, err, "Não foi possível identificar a empresa padrão."); }
  }

  return res.status(401).json({ erro: "Autenticação obrigatória. Faça login e envie Authorization: Bearer <token>." });
}
function exigirPerfil(...perfis) {
  return (req, res, next) => {
    if (!req.auth || !perfis.includes(req.auth.perfil)) return res.status(403).json({ erro: "Você não tem permissão para esta operação." });
    next();
  };
}
function authOpcional(req, _res, next) { autenticar(req, _res, next); }
function empresaWhere(req, alias = "") { return `${alias ? alias + "." : ""}empresa_id=?`; }
async function colaboradorDoUsuario(req) {
  if (!req.auth?.usuarioId) return null;
  const [[row]] = await db.query("SELECT colaborador_id FROM usuarios WHERE id=? AND empresa_id=? AND ativo=1", [req.auth.usuarioId, req.auth.empresaId]);
  return row?.colaborador_id ? Number(row.colaborador_id) : null;
}
async function tecnicoPodeAcessarOS(req, os) {
  if (req.auth.perfil !== "TECNICO") return true;
  const colaboradorId = await colaboradorDoUsuario(req);
  return Boolean(colaboradorId && Number(os.tecnico_id) === colaboradorId);
}

const TABELAS_PERMITIDAS = ["colaboradores", "clientes", "gestores"];
function tipoValido(tipo) { return TABELAS_PERMITIDAS.includes(tipo); }

// Salva uma foto/assinatura recebida em base64 no disco local do servidor.
async function salvarFotoBase64(base64, indice) {
  if (typeof base64 !== "string" || !base64.trim()) return null;
  const match = base64.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/i);
  const dados = match ? match[2] : base64;
  const extensao = match ? (match[1].toLowerCase() === "jpg" ? "jpg" : match[1].toLowerCase()) : "jpg";
  if (!/^[A-Za-z0-9+/=\r\n]+$/.test(dados)) return null;
  const buffer = Buffer.from(dados, "base64");
  if (!buffer.length || buffer.length > 5 * 1024 * 1024) return null;
  const nome = `${Date.now()}-${crypto.randomBytes(5).toString("hex")}-${indice}.${extensao}`;
  await fs.promises.writeFile(path.join(UPLOAD_DIR, nome), buffer);
  return `/uploads/${nome}`;
}
function labelsStatusOSPdf(status) {
  const mapa = { ATRIBUIDA: "Atribuída", ACEITA: "Aceita", EM_DESLOCAMENTO: "Em deslocamento", NO_LOCAL: "No local", EM_ATENDIMENTO: "Em atendimento", EM_ALMOCO: "Em horário de almoço", FINALIZADA: "Finalizada", CANCELADA: "Cancelada" };
  return mapa[status] || status || "—";
}
// Lê uma foto/assinatura como Buffer, seja ela um caminho salvo em disco
// (/uploads/...) ou uma string base64/data-url — usado na geração do PDF.
async function bufferDaImagem(valor) {
  if (typeof valor !== "string" || !valor.trim()) return null;
  try {
    if (valor.startsWith("/uploads/")) {
      const arquivo = path.join(UPLOAD_DIR, path.basename(valor));
      if (!arquivo.startsWith(UPLOAD_DIR) || !fs.existsSync(arquivo)) return null;
      return fs.readFileSync(arquivo);
    }
    const match = valor.match(/^data:image\/(?:jpeg|jpg|png|webp);base64,(.+)$/i);
    const dados = match ? match[1] : valor;
    return Buffer.from(dados, "base64");
  } catch (_) { return null; }
}
function normalizarFotos(valor) {
  if (!valor) return [];
  if (Array.isArray(valor)) return valor;
  try { const parsed = JSON.parse(valor); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}
function excluirArquivosFotos(valor) {
  for (const foto of normalizarFotos(valor)) {
    if (typeof foto !== "string" || !foto.startsWith("/uploads/")) continue;
    const arquivo = path.join(UPLOAD_DIR, path.basename(foto));
    if (arquivo.startsWith(UPLOAD_DIR) && fs.existsSync(arquivo)) { try { fs.unlinkSync(arquivo); } catch (_) {} }
  }
}

async function colunaExiste(tabela, coluna) {
  const [[row]] = await db.query(`SELECT COUNT(*) AS total FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?`, [tabela, coluna]);
  return Number(row.total) > 0;
}
async function adicionarEmpresaId(tabela) {
  if (!(await colunaExiste(tabela, "empresa_id"))) {
    await db.query(`ALTER TABLE \`${tabela}\` ADD COLUMN empresa_id INT NULL`);
  }
  const [[semEmpresa]] = await db.query(`SELECT COUNT(*) AS total FROM \`${tabela}\` WHERE empresa_id IS NULL`);
  if (Number(semEmpresa.total) > 0) {
    const empresa = await buscarEmpresaPadrao();
    await db.query(`UPDATE \`${tabela}\` SET empresa_id=? WHERE empresa_id IS NULL`, [empresa]);
  }
  try { await db.query(`ALTER TABLE \`${tabela}\` MODIFY empresa_id INT NOT NULL`); } catch (_) {}
  try { await db.query(`CREATE INDEX idx_${tabela}_empresa ON \`${tabela}\` (empresa_id)`); } catch (_) {}
}

async function inicializarBanco() {
  await db.query(`CREATE TABLE IF NOT EXISTS empresas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(180) NOT NULL,
    documento VARCHAR(40) NULL,
    ativo TINYINT(1) NOT NULL DEFAULT 1,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  const [[emp]] = await db.query("SELECT id FROM empresas WHERE nome='Empresa principal' LIMIT 1");
  if (!emp) await db.query("INSERT INTO empresas (nome) VALUES ('Empresa principal')");

  await db.query(`CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    empresa_id INT NOT NULL,
    nome VARCHAR(150) NOT NULL,
    email VARCHAR(180) NOT NULL,
    senha_hash VARCHAR(255) NOT NULL,
    perfil VARCHAR(30) NOT NULL DEFAULT 'TECNICO',
    colaborador_id INT NULL,
    ativo TINYINT(1) NOT NULL DEFAULT 1,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ultimo_login DATETIME NULL,
    UNIQUE KEY uq_usuario_empresa_email (empresa_id,email),
    INDEX idx_usuarios_empresa (empresa_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  const tabelas = {
    colaboradores: `CREATE TABLE IF NOT EXISTS colaboradores (id INT AUTO_INCREMENT PRIMARY KEY, nome VARCHAR(150) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    clientes: `CREATE TABLE IF NOT EXISTS clientes (id INT AUTO_INCREMENT PRIMARY KEY, nome VARCHAR(180) NOT NULL, rua VARCHAR(255), bairro VARCHAR(150), cidade VARCHAR(150), telefone VARCHAR(40)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    gestores: `CREATE TABLE IF NOT EXISTS gestores (id INT AUTO_INCREMENT PRIMARY KEY, nome VARCHAR(150) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    pontos: `CREATE TABLE IF NOT EXISTS pontos (id INT AUTO_INCREMENT PRIMARY KEY, tecnico_id INT NOT NULL, os_id INT NULL, latitude DOUBLE NOT NULL, longitude DOUBLE NOT NULL, dataHora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX idx_pontos_tecnico_data (tecnico_id,dataHora)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    veiculos: `CREATE TABLE IF NOT EXISTS veiculos (id INT AUTO_INCREMENT PRIMARY KEY, empresa_id INT NOT NULL, nome VARCHAR(120) NOT NULL, placa VARCHAR(20) NULL, ativo TINYINT(1) NOT NULL DEFAULT 1, criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX idx_veiculos_empresa(empresa_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    servicos: `CREATE TABLE IF NOT EXISTS servicos (id INT AUTO_INCREMENT PRIMARY KEY, tecnico_id INT NOT NULL, cliente_id INT NOT NULL, gestor_id INT NOT NULL, relatorio TEXT, foto_conclusao LONGTEXT, cliente_nome_completo VARCHAR(180), cliente_assinatura LONGTEXT, status VARCHAR(40) NOT NULL DEFAULT 'ATRIBUIDA', criada_data DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, aceita_data DATETIME NULL, deslocamento_data DATETIME NULL, chegada_data DATETIME NULL, inicio_data DATETIME NULL, almoco_inicio_data DATETIME NULL, almoco_fim_data DATETIME NULL, fim_data DATETIME NULL, INDEX idx_servicos_status_data(status,fim_data), INDEX idx_servicos_tecnico(tecnico_id), INDEX idx_servicos_cliente(cliente_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    servico_status_historico: `CREATE TABLE IF NOT EXISTS servico_status_historico (id INT AUTO_INCREMENT PRIMARY KEY, servico_id INT NOT NULL, status VARCHAR(40) NOT NULL, dataHora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX idx_historico_servico_data(servico_id,dataHora)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    materiais: `CREATE TABLE IF NOT EXISTS materiais (id INT AUTO_INCREMENT PRIMARY KEY, nome VARCHAR(180) NOT NULL, unidade VARCHAR(20) NOT NULL DEFAULT 'un', preco DECIMAL(10,2) NOT NULL DEFAULT 0, estoque DECIMAL(10,2) NULL, ativo TINYINT(1) NOT NULL DEFAULT 1) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    servico_materiais: `CREATE TABLE IF NOT EXISTS servico_materiais (id INT AUTO_INCREMENT PRIMARY KEY, servico_id INT NOT NULL, material_id INT NOT NULL, quantidade DECIMAL(10,2) NOT NULL, preco_unitario DECIMAL(10,2) NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'SOLICITADO', observacao VARCHAR(255) NULL, solicitado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX idx_servico_materiais_servico(servico_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    solicitacoes_materiais: `CREATE TABLE IF NOT EXISTS solicitacoes_materiais (id INT AUTO_INCREMENT PRIMARY KEY, empresa_id INT NOT NULL, tecnico_id INT NOT NULL, cliente_id INT NOT NULL, material_id INT NOT NULL, quantidade DECIMAL(10,2) NOT NULL, unidade VARCHAR(20) NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'SOLICITADO', observacao VARCHAR(255) NULL, criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, atendido_em DATETIME NULL, INDEX idx_solicitacoes_empresa_tecnico (empresa_id,tecnico_id,criado_em), INDEX idx_solicitacoes_empresa_cliente (empresa_id,cliente_id), INDEX idx_solicitacoes_status (empresa_id,status)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    despesas: `CREATE TABLE IF NOT EXISTS despesas (id INT AUTO_INCREMENT PRIMARY KEY, servico_id INT NOT NULL, tecnico_id INT NOT NULL, tipo VARCHAR(30) NOT NULL, valor DECIMAL(10,2) NOT NULL, descricao VARCHAR(255) NULL, numero_nota VARCHAR(100) NULL, foto_recibo VARCHAR(255) NULL, cobrar_do_cliente TINYINT(1) NOT NULL DEFAULT 1, criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX idx_despesas_servico(servico_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  };
  for (const sql of Object.values(tabelas)) await db.query(sql);

  const servicoCols = [
    ["criada_data","DATETIME NULL"],["aceita_data","DATETIME NULL"],["deslocamento_data","DATETIME NULL"],["chegada_data","DATETIME NULL"],["inicio_data","DATETIME NULL"],["almoco_inicio_data","DATETIME NULL"],["almoco_fim_data","DATETIME NULL"],["fim_data","DATETIME NULL"],["veiculo_id","INT NULL"]
  ];
  for (const [nome,tipo] of servicoCols) if (!(await colunaExiste("servicos",nome))) await db.query(`ALTER TABLE servicos ADD COLUMN ${nome} ${tipo}`);
  if (!(await colunaExiste("despesas","numero_nota"))) await db.query("ALTER TABLE despesas ADD COLUMN numero_nota VARCHAR(100) NULL AFTER descricao");
  if (!(await colunaExiste("despesas","cliente_id"))) {
    await db.query("ALTER TABLE despesas ADD COLUMN cliente_id INT NULL AFTER servico_id");
    await db.query("UPDATE despesas d JOIN servicos s ON s.id=d.servico_id SET d.cliente_id=s.cliente_id WHERE d.cliente_id IS NULL AND d.servico_id IS NOT NULL");
    try { await db.query("ALTER TABLE despesas MODIFY servico_id INT NULL"); } catch (_) {}
    try { await db.query("CREATE INDEX idx_despesas_cliente ON despesas (cliente_id)"); } catch (_) {}
  }
  if (!(await colunaExiste("servico_status_historico","empresa_id"))) await db.query("ALTER TABLE servico_status_historico ADD COLUMN empresa_id INT NULL");
  if (!(await colunaExiste("usuarios","colaborador_id"))) await db.query("ALTER TABLE usuarios ADD COLUMN colaborador_id INT NULL");
  if (!(await colunaExiste("usuarios","push_token"))) await db.query("ALTER TABLE usuarios ADD COLUMN push_token VARCHAR(255) NULL");
  if (!(await colunaExiste("colaboradores","ativo"))) await db.query("ALTER TABLE colaboradores ADD COLUMN ativo TINYINT(1) NOT NULL DEFAULT 1");
  if (!(await colunaExiste("colaboradores","custo_hora"))) await db.query("ALTER TABLE colaboradores ADD COLUMN custo_hora DECIMAL(10,2) NULL");
  if (!(await colunaExiste("veiculos","custo_km"))) await db.query("ALTER TABLE veiculos ADD COLUMN custo_km DECIMAL(10,2) NULL");
  const [[histNull]] = await db.query("SELECT COUNT(*) total FROM servico_status_historico WHERE empresa_id IS NULL");
  if (Number(histNull.total) > 0) { const empresa = await buscarEmpresaPadrao(); await db.query("UPDATE servico_status_historico h JOIN servicos s ON s.id=h.servico_id SET h.empresa_id=s.empresa_id WHERE h.empresa_id IS NULL"); }
  try { await db.query("ALTER TABLE servico_status_historico MODIFY empresa_id INT NOT NULL"); } catch (_) {}
  if (!(await colunaExiste("pontos","os_id"))) await db.query("ALTER TABLE pontos ADD COLUMN os_id INT NULL AFTER tecnico_id");
  await db.query("UPDATE servicos SET criada_data=COALESCE(criada_data,fim_data,NOW()) WHERE criada_data IS NULL");
  await db.query("UPDATE servicos SET status='FINALIZADA' WHERE status='Finalizado'");

  for (const tabela of Object.keys(tabelas)) await adicionarEmpresaId(tabela);

  const adminEmail = normalizarEmail(process.env.ADMIN_EMAIL);
  const adminSenha = String(process.env.ADMIN_PASSWORD || "");
  if (adminEmail && adminSenha) {
    const empresaId = Number(process.env.ADMIN_EMPRESA_ID || await buscarEmpresaPadrao());
    const [[existe]] = await db.query("SELECT id FROM usuarios WHERE empresa_id=? AND email=? LIMIT 1", [empresaId, adminEmail]);
    if (!existe) {
      const hash = await hashSenha(adminSenha);
      await db.query("INSERT INTO usuarios (empresa_id,nome,email,senha_hash,perfil) VALUES (?,?,?,?, 'ADMIN')", [empresaId, String(process.env.ADMIN_NAME || "Administrador").trim(), adminEmail, hash]);
      console.log(`👤 Usuário administrador criado: ${adminEmail}`);
    }
  }
  console.log("✅ Estrutura do banco verificada/migrada.");
}

async function registrarStatus(servicoId, status, conn = db) {
  await conn.query("INSERT INTO servico_status_historico (servico_id,status,empresa_id) SELECT ?,?,empresa_id FROM servicos WHERE id=?", [servicoId,status,servicoId]);
}

// Saúde e autenticação -------------------------------------------------------
app.get("/", (_req,res) => res.json({ nome:"Fielduo", status:"online", versao:VERSAO, autenticacao:"JWT" }));
app.get("/health", async (_req,res) => { try { await db.query("SELECT 1 AS ok"); res.json({status:"ok",banco:"online",versao:VERSAO,data:new Date().toISOString()}); } catch(err) { res.status(503).json({status:"degraded",banco:"offline"}); } });

// Rate limit do login, em memória — sem depender de nenhuma lib nova.
// Duas travas independentes: por IP (freia varredura ampla) e por e-mail
// (freia ataque direcionado a uma conta, mesmo trocando de IP). Zera no
// primeiro login bem-sucedido daquela chave.
const JANELA_LOGIN_MS = 15 * 60 * 1000; // 15 minutos
const LIMITE_LOGIN_IP = 20;
const LIMITE_LOGIN_EMAIL = 6;
const tentativasLoginPorIp = new Map();
const tentativasLoginPorEmail = new Map();

function checarLimite(mapa, chave, limite) {
  const agora = Date.now();
  const registro = mapa.get(chave);
  if (!registro || agora - registro.desde > JANELA_LOGIN_MS) {
    mapa.set(chave, { contagem: 0, desde: agora });
    return { bloqueado: false };
  }
  if (registro.contagem >= limite) {
    const restanteMs = JANELA_LOGIN_MS - (agora - registro.desde);
    return { bloqueado: true, restanteMin: Math.ceil(restanteMs / 60000) };
  }
  return { bloqueado: false };
}
function registrarFalha(mapa, chave) {
  const registro = mapa.get(chave);
  if (registro) registro.contagem++;
  else mapa.set(chave, { contagem: 1, desde: Date.now() });
}
function limparTentativas(mapa, chave) { mapa.delete(chave); }
// Limpeza periódica pra não crescer pra sempre em memória.
setInterval(() => {
  const agora = Date.now();
  for (const [chave, r] of tentativasLoginPorIp) if (agora - r.desde > JANELA_LOGIN_MS) tentativasLoginPorIp.delete(chave);
  for (const [chave, r] of tentativasLoginPorEmail) if (agora - r.desde > JANELA_LOGIN_MS) tentativasLoginPorEmail.delete(chave);
}, 5 * 60 * 1000).unref?.();

// Notificações push (Expo Push Service) --------------------------------
// Fire-and-forget: se falhar, só loga — nunca deve derrubar a
// requisição principal (criar/atualizar uma OS não pode depender disso).
async function enviarPush(tokens, titulo, corpo, dados) {
  const validos = (Array.isArray(tokens) ? tokens : [tokens]).filter(t => typeof t === "string" && t.startsWith("ExponentPushToken"));
  if (!validos.length) return;
  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(validos.map(to => ({ to, title: titulo, body: corpo, data: dados || {}, sound: "default" }))),
    });
  } catch (err) {
    console.error("Erro ao enviar push notification:", err.message);
  }
}
async function enviarPushParaTecnico(empresaId, tecnicoId, titulo, corpo, dados) {
  try {
    const [usuarios] = await db.query("SELECT push_token FROM usuarios WHERE empresa_id=? AND colaborador_id=? AND ativo=1 AND push_token IS NOT NULL", [empresaId, tecnicoId]);
    if (usuarios.length) await enviarPush(usuarios.map(u => u.push_token), titulo, corpo, dados);
  } catch (err) {
    console.error("Erro ao buscar token de push do técnico:", err.message);
  }
}

async function enviarPushParaGestores(empresaId, titulo, corpo, dados) {
  try {
    const [usuarios] = await db.query("SELECT push_token FROM usuarios WHERE empresa_id=? AND perfil IN ('ADMIN','GESTOR') AND ativo=1 AND push_token IS NOT NULL", [empresaId]);
    if (usuarios.length) await enviarPush(usuarios.map(u => u.push_token), titulo, corpo, dados);
  } catch (err) {
    console.error("Erro ao buscar tokens de push dos gestores:", err.message);
  }
}

app.delete("/auth/usuarios/:id", autenticar, exigirPerfil("ADMIN"), async(req,res)=>{
  const id=req.params.id;
  if(!validarId(id)) return res.status(400).json({erro:"ID inválido."});
  if(Number(id)===req.auth.usuarioId) return res.status(400).json({erro:"Você não pode excluir seu próprio usuário."});
  try{
    const[[alvo]]=await db.query("SELECT perfil FROM usuarios WHERE id=? AND empresa_id=?",[id,req.auth.empresaId]);
    if(!alvo) return res.status(404).json({erro:"Usuário não encontrado."});
    if(alvo.perfil==="ADMIN"){
      const[[{total}]]=await db.query("SELECT COUNT(*) total FROM usuarios WHERE empresa_id=? AND perfil='ADMIN' AND ativo=1",[req.auth.empresaId]);
      if(Number(total)<=1) return res.status(400).json({erro:"Não é possível excluir o último administrador da empresa."});
    }
    const[r]=await db.query("DELETE FROM usuarios WHERE id=? AND empresa_id=?",[id,req.auth.empresaId]);
    if(!r.affectedRows) return res.status(404).json({erro:"Usuário não encontrado."});
    res.json({message:"Usuário excluído com sucesso."});
  }catch(err){handleDbError(res,err,"Não foi possível excluir o usuário.");}
});

// Acha tudo que bate com o termo de busca (clientes, técnicos, gestores,
// veículos, materiais e usuários de login) e também o que está ligado a
// eles (OS, despesas, solicitações de material) — usado tanto pra mostrar
// a prévia quanto pra executar a exclusão de fato, então fica num lugar só.
async function buscarDadosLimpeza(empresaId, usuarioAtualId, termoBusca) {
  const termo = `%${termoBusca}%`;
  const [[clientes], [colaboradores], [gestores], [veiculos], [materiais], [usuariosPorNome]] = await Promise.all([
    db.query("SELECT id,nome FROM clientes WHERE empresa_id=? AND nome LIKE ?", [empresaId, termo]),
    db.query("SELECT id,nome FROM colaboradores WHERE empresa_id=? AND nome LIKE ?", [empresaId, termo]),
    db.query("SELECT id,nome FROM gestores WHERE empresa_id=? AND nome LIKE ?", [empresaId, termo]),
    db.query("SELECT id,nome FROM veiculos WHERE empresa_id=? AND nome LIKE ?", [empresaId, termo]),
    db.query("SELECT id,nome FROM materiais WHERE empresa_id=? AND nome LIKE ?", [empresaId, termo]),
    db.query("SELECT id,nome,email,perfil FROM usuarios WHERE empresa_id=? AND (nome LIKE ? OR email LIKE ?)", [empresaId, termo, termo]),
  ]);
  const clientesIds = clientes.map(r => r.id);
  const colaboradoresIds = colaboradores.map(r => r.id);
  const gestoresIds = gestores.map(r => r.id);
  const veiculosIds = veiculos.map(r => r.id);
  const materiaisIds = materiais.map(r => r.id);

  // Login de um técnico de teste entra também, mesmo que o nome/e-mail do
  // login em si não tenha "teste" — senão sobra um usuário sem colaborador
  // por trás depois que o técnico for excluído.
  let usuariosLigados = [];
  if (colaboradoresIds.length) {
    const [rows] = await db.query(`SELECT id,nome,email,perfil FROM usuarios WHERE empresa_id=? AND colaborador_id IN (${inSql(colaboradoresIds)})`, [empresaId]);
    usuariosLigados = rows;
  }
  const usuariosMapa = new Map();
  [...usuariosPorNome, ...usuariosLigados].forEach(u => usuariosMapa.set(u.id, u));
  // Por segurança, nunca inclui automaticamente o usuário logado nem contas
  // ADMIN na exclusão — essas precisam ser removidas manualmente se for o caso.
  const usuarios = [...usuariosMapa.values()].filter(u => u.id !== usuarioAtualId && u.perfil !== "ADMIN");
  const usuariosIds = usuarios.map(u => u.id);

  let servicos = [];
  const condServicos = [];
  if (colaboradoresIds.length) condServicos.push(`tecnico_id IN (${inSql(colaboradoresIds)})`);
  if (clientesIds.length) condServicos.push(`cliente_id IN (${inSql(clientesIds)})`);
  if (gestoresIds.length) condServicos.push(`gestor_id IN (${inSql(gestoresIds)})`);
  if (veiculosIds.length) condServicos.push(`veiculo_id IN (${inSql(veiculosIds)})`);
  if (condServicos.length) {
    const [rows] = await db.query(`SELECT id,foto_conclusao,cliente_assinatura FROM servicos WHERE empresa_id=? AND (${condServicos.join(" OR ")})`, [empresaId]);
    servicos = rows;
  }
  const servicosIds = servicos.map(r => r.id);

  let despesas = [];
  const condDespesas = [];
  if (servicosIds.length) condDespesas.push(`servico_id IN (${inSql(servicosIds)})`);
  if (clientesIds.length) condDespesas.push(`cliente_id IN (${inSql(clientesIds)})`);
  if (colaboradoresIds.length) condDespesas.push(`tecnico_id IN (${inSql(colaboradoresIds)})`);
  if (condDespesas.length) {
    const [rows] = await db.query(`SELECT id,foto_recibo FROM despesas WHERE empresa_id=? AND (${condDespesas.join(" OR ")})`, [empresaId]);
    despesas = rows;
  }

  let totalSolicitacoes = 0;
  const condSolic = [];
  if (colaboradoresIds.length) condSolic.push(`tecnico_id IN (${inSql(colaboradoresIds)})`);
  if (clientesIds.length) condSolic.push(`cliente_id IN (${inSql(clientesIds)})`);
  if (materiaisIds.length) condSolic.push(`material_id IN (${inSql(materiaisIds)})`);
  if (condSolic.length) {
    const [[linha]] = await db.query(`SELECT COUNT(*) total FROM solicitacoes_materiais WHERE empresa_id=? AND (${condSolic.join(" OR ")})`, [empresaId]);
    totalSolicitacoes = Number(linha.total);
  }

  return { clientes, colaboradores, gestores, veiculos, materiais, usuarios, servicos, despesas, totalSolicitacoes };
}

app.get("/gestao/limpeza-teste", autenticar, exigirPerfil("ADMIN"), async (req, res) => {
  const termoBusca = String(req.query.termo || "").trim();
  if (termoBusca.length < 2) return res.status(400).json({ erro: "Digite pelo menos 2 letras pra buscar." });
  try {
    const d = await buscarDadosLimpeza(req.auth.empresaId, req.auth.usuarioId, termoBusca);
    const total = d.clientes.length + d.colaboradores.length + d.gestores.length + d.veiculos.length + d.materiais.length + d.usuarios.length;
    res.json({
      total,
      clientes: d.clientes, colaboradores: d.colaboradores, gestores: d.gestores,
      veiculos: d.veiculos, materiais: d.materiais, usuarios: d.usuarios,
      servicos: d.servicos.length, despesas: d.despesas.length, solicitacoes: d.totalSolicitacoes,
    });
  } catch (err) { handleDbError(res, err, "Não foi possível buscar os dados."); }
});

app.post("/gestao/limpeza-teste", autenticar, exigirPerfil("ADMIN"), async (req, res) => {
  const termoBusca = String(req.body.termo || "").trim();
  if (termoBusca.length < 2) return res.status(400).json({ erro: "Digite pelo menos 2 letras pra buscar." });
  if (String(req.body.confirmar || "").trim() !== "EXCLUIR") {
    return res.status(400).json({ erro: "Digite EXCLUIR para confirmar a exclusão definitiva." });
  }
  const empresaId = req.auth.empresaId;
  const conn = await db.getConnection();
  try {
    // Refaz a mesma busca no momento de excluir, em vez de confiar em ids
    // que o navegador teria mandado de volta — assim ninguém consegue
    // manipular o que vai ser excluído.
    const d = await buscarDadosLimpeza(empresaId, req.auth.usuarioId, termoBusca);
    const clientesIds = d.clientes.map(r => r.id), colaboradoresIds = d.colaboradores.map(r => r.id),
      gestoresIds = d.gestores.map(r => r.id), veiculosIds = d.veiculos.map(r => r.id),
      materiaisIds = d.materiais.map(r => r.id), usuariosIds = d.usuarios.map(r => r.id),
      servicosIds = d.servicos.map(r => r.id);

    await conn.beginTransaction();
    if (servicosIds.length) {
      await conn.query(`DELETE FROM servico_status_historico WHERE servico_id IN (${inSql(servicosIds)})`);
      await conn.query(`DELETE FROM servico_materiais WHERE servico_id IN (${inSql(servicosIds)})`);
    }
    if (materiaisIds.length) await conn.query(`DELETE FROM servico_materiais WHERE material_id IN (${inSql(materiaisIds)})`);

    const condDespesas = [];
    if (servicosIds.length) condDespesas.push(`servico_id IN (${inSql(servicosIds)})`);
    if (clientesIds.length) condDespesas.push(`cliente_id IN (${inSql(clientesIds)})`);
    if (colaboradoresIds.length) condDespesas.push(`tecnico_id IN (${inSql(colaboradoresIds)})`);
    if (condDespesas.length) await conn.query(`DELETE FROM despesas WHERE empresa_id=? AND (${condDespesas.join(" OR ")})`, [empresaId]);

    const condSolic = [];
    if (colaboradoresIds.length) condSolic.push(`tecnico_id IN (${inSql(colaboradoresIds)})`);
    if (clientesIds.length) condSolic.push(`cliente_id IN (${inSql(clientesIds)})`);
    if (materiaisIds.length) condSolic.push(`material_id IN (${inSql(materiaisIds)})`);
    if (condSolic.length) await conn.query(`DELETE FROM solicitacoes_materiais WHERE empresa_id=? AND (${condSolic.join(" OR ")})`, [empresaId]);

    const condPontos = [];
    if (colaboradoresIds.length) condPontos.push(`tecnico_id IN (${inSql(colaboradoresIds)})`);
    if (servicosIds.length) condPontos.push(`os_id IN (${inSql(servicosIds)})`);
    if (condPontos.length) await conn.query(`DELETE FROM pontos WHERE empresa_id=? AND (${condPontos.join(" OR ")})`, [empresaId]);

    if (servicosIds.length) await conn.query(`DELETE FROM servicos WHERE id IN (${inSql(servicosIds)})`);
    if (usuariosIds.length) await conn.query(`DELETE FROM usuarios WHERE id IN (${inSql(usuariosIds)})`);
    if (clientesIds.length) await conn.query(`DELETE FROM clientes WHERE id IN (${inSql(clientesIds)})`);
    if (colaboradoresIds.length) await conn.query(`DELETE FROM colaboradores WHERE id IN (${inSql(colaboradoresIds)})`);
    if (gestoresIds.length) await conn.query(`DELETE FROM gestores WHERE id IN (${inSql(gestoresIds)})`);
    if (veiculosIds.length) await conn.query(`DELETE FROM veiculos WHERE id IN (${inSql(veiculosIds)})`);
    if (materiaisIds.length) await conn.query(`DELETE FROM materiais WHERE id IN (${inSql(materiaisIds)})`);
    await conn.commit();

    // Só apaga os arquivos de foto/assinatura do disco depois que o banco
    // confirmou de verdade — se a transação caísse, os arquivos ficariam órfãos.
    d.servicos.forEach(s => { excluirArquivosFotos(s.foto_conclusao); excluirArquivosFotos(s.cliente_assinatura); });
    d.despesas.forEach(dp => excluirArquivosFotos(dp.foto_recibo));

    res.json({
      message: `Exclusão concluída: ${clientesIds.length} cliente(s), ${colaboradoresIds.length} técnico(s), ${gestoresIds.length} gestor(es), ${veiculosIds.length} veículo(s), ${materiaisIds.length} material(is), ${usuariosIds.length} usuário(s) de login, ${servicosIds.length} OS e ${d.despesas.length} despesa(s).`,
    });
  } catch (err) {
    await conn.rollback();
    handleDbError(res, err, "Não foi possível concluir a exclusão.");
  } finally {
    conn.release();
  }
});
function distanciaKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
app.get("/gestao/relatorios/:id/km", autenticar, exigirPerfil("ADMIN","GESTOR"), async(req,res)=>{
  if (!validarId(req.params.id)) return res.status(400).json({erro:"ID inválido."});
  try {
    const [pontos] = await db.query(
      "SELECT p.latitude,p.longitude,p.dataHora FROM pontos p JOIN servicos s ON s.id=p.os_id WHERE p.os_id=? AND s.empresa_id=? ORDER BY p.dataHora ASC",
      [req.params.id, req.auth.empresaId]
    );
    let km = 0;
    for (let i = 1; i < pontos.length; i++) {
      km += distanciaKm(pontos[i-1].latitude, pontos[i-1].longitude, pontos[i].latitude, pontos[i].longitude);
    }
    res.json({ km: Number(km.toFixed(2)), pontos: pontos.length });
  } catch (err) { handleDbError(res,err); }
});
app.get("/gestao/veiculos/:id/km", autenticar, exigirPerfil("ADMIN","GESTOR"), async(req,res)=>{
  if (!validarId(req.params.id)) return res.status(400).json({erro:"ID inválido."});
  const inicio = req.query.inicio || null, fim = req.query.fim || null;
  try {
    const cond = ["s.empresa_id=?","s.veiculo_id=?"], vals = [req.auth.empresaId, req.params.id];
    if (inicio) { cond.push("p.dataHora>=?"); vals.push(inicio); }
    if (fim) { cond.push("p.dataHora<=?"); vals.push(fim); }
    const [pontos] = await db.query(
      `SELECT p.os_id,p.latitude,p.longitude,p.dataHora FROM pontos p JOIN servicos s ON s.id=p.os_id WHERE ${cond.join(" AND ")} ORDER BY p.os_id,p.dataHora ASC`,
      vals
    );
    const porOs = {};
    for (const p of pontos) (porOs[p.os_id] = porOs[p.os_id] || []).push(p);
    let km = 0;
    for (const lista of Object.values(porOs)) {
      for (let i = 1; i < lista.length; i++) km += distanciaKm(lista[i-1].latitude, lista[i-1].longitude, lista[i].latitude, lista[i].longitude);
    }
    res.json({ km: Number(km.toFixed(2)), viagens: Object.keys(porOs).length });
  } catch (err) { handleDbError(res,err); }
});

function horasTrabalhadas(os) {
  if (!os.inicio_data || !os.fim_data) return 0;
  let ms = new Date(os.fim_data) - new Date(os.inicio_data);
  if (os.almoco_inicio_data && os.almoco_fim_data) ms -= (new Date(os.almoco_fim_data) - new Date(os.almoco_inicio_data));
  return Math.max(0, ms / 3600000);
}
app.get("/gestao/relatorios/:id/custo", autenticar, exigirPerfil("ADMIN","GESTOR"), async(req,res)=>{
  if (!validarId(req.params.id)) return res.status(400).json({erro:"ID inválido."});
  try {
    const [[os]] = await db.query(
      "SELECT s.*, t.custo_hora, v.custo_km FROM servicos s LEFT JOIN colaboradores t ON s.tecnico_id=t.id AND t.empresa_id=s.empresa_id LEFT JOIN veiculos v ON s.veiculo_id=v.id AND v.empresa_id=s.empresa_id WHERE s.id=? AND s.empresa_id=?",
      [req.params.id, req.auth.empresaId]
    );
    if (!os) return res.status(404).json({erro:"OS não encontrada."});
    const [materiais] = await db.query("SELECT quantidade,preco_unitario FROM servico_materiais WHERE servico_id=? AND status<>'CANCELADO'", [req.params.id]);
    const [despesas] = await db.query("SELECT valor,tipo FROM despesas WHERE servico_id=?", [req.params.id]);
    const [pontos] = await db.query("SELECT latitude,longitude FROM pontos WHERE os_id=? ORDER BY dataHora ASC", [req.params.id]);

    let km = 0;
    for (let i = 1; i < pontos.length; i++) km += distanciaKm(pontos[i-1].latitude, pontos[i-1].longitude, pontos[i].latitude, pontos[i].longitude);

    const custoMaterial = materiais.reduce((s,m)=>s+Number(m.quantidade)*Number(m.preco_unitario), 0);
    // Despesas de combustível ficam de fora daqui pra não contar duas vezes
    // (o combustível já é estimado pelo km × custo/km do veículo).
    const custoDespesas = despesas.filter(d=>d.tipo!=="COMBUSTIVEL").reduce((s,d)=>s+Number(d.valor), 0);
    const horas = horasTrabalhadas(os);
    const custoMaoDeObra = os.custo_hora != null ? horas * Number(os.custo_hora) : null;
    const custoCombustivel = os.custo_km != null ? km * Number(os.custo_km) : null;
    const total = custoMaterial + custoDespesas + (custoMaoDeObra || 0) + (custoCombustivel || 0);

    const avisos = [];
    if (os.custo_hora == null) avisos.push("Técnico sem valor/hora cadastrado — mão de obra não incluída no total.");
    if (os.custo_km == null) avisos.push("Veículo sem custo/km cadastrado (ou nenhum veículo selecionado) — combustível não incluído no total.");

    res.json({
      material: Number(custoMaterial.toFixed(2)),
      despesas: Number(custoDespesas.toFixed(2)),
      maoDeObra: custoMaoDeObra != null ? Number(custoMaoDeObra.toFixed(2)) : null,
      horasTrabalhadas: Number(horas.toFixed(2)),
      combustivel: custoCombustivel != null ? Number(custoCombustivel.toFixed(2)) : null,
      km: Number(km.toFixed(2)),
      total: Number(total.toFixed(2)),
      avisos,
    });
  } catch (err) { handleDbError(res,err); }
});
app.get("/gestao/custos-por-cliente", autenticar, exigirPerfil("ADMIN","GESTOR"), async(req,res)=>{
  try {
    const [oss] = await db.query(
      `SELECT s.id,s.cliente_id,c.nome cliente_nome,s.inicio_data,s.fim_data,s.almoco_inicio_data,s.almoco_fim_data,t.custo_hora,v.custo_km
       FROM servicos s
       LEFT JOIN clientes c ON s.cliente_id=c.id AND c.empresa_id=s.empresa_id
       LEFT JOIN colaboradores t ON s.tecnico_id=t.id AND t.empresa_id=s.empresa_id
       LEFT JOIN veiculos v ON s.veiculo_id=v.id AND v.empresa_id=s.empresa_id
       WHERE s.empresa_id=? AND s.status='FINALIZADA'`,
      [req.auth.empresaId]
    );
    if (!oss.length) return res.json([]);
    const ids = oss.map(o=>o.id);
    const placeholders = ids.map(()=>"?").join(",");
    const [materiaisTodos] = await db.query(`SELECT servico_id,quantidade,preco_unitario FROM servico_materiais WHERE servico_id IN (${placeholders}) AND status<>'CANCELADO'`, ids);
    const [despesasTodas] = await db.query(`SELECT servico_id,valor,tipo FROM despesas WHERE servico_id IN (${placeholders})`, ids);
    const [pontosTodos] = await db.query(`SELECT os_id,latitude,longitude FROM pontos WHERE os_id IN (${placeholders}) ORDER BY os_id,dataHora ASC`, ids);

    const materiaisPorOS = {}, despesasPorOS = {}, pontosPorOS = {};
    materiaisTodos.forEach(m=>(materiaisPorOS[m.servico_id]=materiaisPorOS[m.servico_id]||[]).push(m));
    despesasTodas.forEach(d=>(despesasPorOS[d.servico_id]=despesasPorOS[d.servico_id]||[]).push(d));
    pontosTodos.forEach(p=>(pontosPorOS[p.os_id]=pontosPorOS[p.os_id]||[]).push(p));

    const porCliente = {};
    for (const os of oss) {
      const chave = os.cliente_id || "sem-cliente";
      if (!porCliente[chave]) porCliente[chave] = { cliente_id: os.cliente_id, cliente_nome: os.cliente_nome || "—", os_count: 0, material: 0, despesas: 0, maoDeObra: 0, combustivel: 0, km: 0 };
      const acc = porCliente[chave];
      acc.os_count++;

      const mats = materiaisPorOS[os.id] || [];
      acc.material += mats.reduce((s,m)=>s+Number(m.quantidade)*Number(m.preco_unitario), 0);

      const desp = despesasPorOS[os.id] || [];
      acc.despesas += desp.filter(d=>d.tipo!=="COMBUSTIVEL").reduce((s,d)=>s+Number(d.valor), 0);

      if (os.custo_hora != null) acc.maoDeObra += horasTrabalhadas(os) * Number(os.custo_hora);

      const pontos = pontosPorOS[os.id] || [];
      let km = 0;
      for (let i = 1; i < pontos.length; i++) km += distanciaKm(pontos[i-1].latitude, pontos[i-1].longitude, pontos[i].latitude, pontos[i].longitude);
      acc.km += km;
      if (os.custo_km != null) acc.combustivel += km * Number(os.custo_km);
    }

    const resultado = Object.values(porCliente).map(c => ({
      ...c,
      material: Number(c.material.toFixed(2)),
      despesas: Number(c.despesas.toFixed(2)),
      maoDeObra: Number(c.maoDeObra.toFixed(2)),
      combustivel: Number(c.combustivel.toFixed(2)),
      km: Number(c.km.toFixed(2)),
      total: Number((c.material + c.despesas + c.maoDeObra + c.combustivel).toFixed(2)),
    })).sort((a,b)=>b.total-a.total);

    res.json(resultado);
  } catch (err) { handleDbError(res,err); }
});

app.post("/auth/push-token", autenticar, async (req, res) => {
  const token = String(req.body.token || "").trim();
  if (!token) return res.status(400).json({ erro: "Token é obrigatório." });
  try {
    await db.query("UPDATE usuarios SET push_token=? WHERE id=?", [token, req.auth.usuarioId]);
    res.json({ message: "Token registrado." });
  } catch (err) { handleDbError(res, err); }
});

app.post("/auth/login", async (req,res) => {
  const email = normalizarEmail(req.body.email);
  const senha = String(req.body.senha || req.body.password || "");
  if (!email || !senha) return res.status(400).json({erro:"E-mail e senha são obrigatórios."});

  const ip = req.ip || "desconhecido";
  const limiteIp = checarLimite(tentativasLoginPorIp, ip, LIMITE_LOGIN_IP);
  const limiteEmail = checarLimite(tentativasLoginPorEmail, email, LIMITE_LOGIN_EMAIL);
  if (limiteIp.bloqueado || limiteEmail.bloqueado) {
    const min = Math.max(limiteIp.restanteMin || 0, limiteEmail.restanteMin || 0);
    return res.status(429).json({erro:`Muitas tentativas de login. Tente novamente em cerca de ${min} minuto(s).`});
  }

  try {
    const empresaId = validarId(req.body.empresa_id) ? Number(req.body.empresa_id) : null;
    const [usuarios] = await db.query(`SELECT u.id,u.empresa_id,u.nome,u.email,u.senha_hash,u.perfil,u.colaborador_id,u.ativo,e.nome AS empresa_nome FROM usuarios u JOIN empresas e ON e.id=u.empresa_id WHERE u.email=? AND u.ativo=1 AND e.ativo=1 ${empresaId ? "AND u.empresa_id=?" : ""} ORDER BY u.id`, empresaId ? [email,empresaId] : [email]);
    if (usuarios.length > 1 && !empresaId) return res.status(409).json({erro:"Este e-mail pertence a mais de uma empresa. Informe empresa_id para entrar."});
    const usuario = usuarios[0];
    if (!usuario || !(await verificarSenha(senha,usuario.senha_hash))) {
      registrarFalha(tentativasLoginPorIp, ip);
      registrarFalha(tentativasLoginPorEmail, email);
      return res.status(401).json({erro:"E-mail ou senha inválidos."});
    }
    limparTentativas(tentativasLoginPorIp, ip);
    limparTentativas(tentativasLoginPorEmail, email);
    await db.query("UPDATE usuarios SET ultimo_login=NOW() WHERE id=?",[usuario.id]);
    const token = gerarToken({sub:usuario.id,empresa_id:usuario.empresa_id,perfil:usuario.perfil,email:usuario.email});
    res.json({token,tipo:"Bearer",usuario:{id:usuario.id,nome:usuario.nome,email:usuario.email,perfil:usuario.perfil,colaborador_id:usuario.colaborador_id,empresa_id:usuario.empresa_id,empresa_nome:usuario.empresa_nome}});
  } catch(err) { handleDbError(res,err,"Não foi possível realizar o login."); }
});
app.get("/auth/me", autenticar, async (req,res) => {
  if (!req.auth.usuarioId) return res.json({usuario:null,empresa_id:req.auth.empresaId,perfil:req.auth.perfil,tipo:req.auth.tipo});
  try {
    const [[u]] = await db.query("SELECT u.id,u.nome,u.email,u.perfil,u.colaborador_id,u.empresa_id,e.nome AS empresa_nome FROM usuarios u JOIN empresas e ON e.id=u.empresa_id WHERE u.id=? AND u.empresa_id=? AND u.ativo=1",[req.auth.usuarioId,req.auth.empresaId]);
    if (!u) return res.status(401).json({erro:"Usuário não encontrado ou inativo."});
    res.json({usuario:u});
  } catch(err){handleDbError(res,err);}
});

app.get("/auth/usuarios", autenticar, exigirPerfil("ADMIN","GESTOR"), async (req,res)=>{
  try { const [rows]=await db.query("SELECT id,nome,email,perfil,colaborador_id,ativo,criado_em,ultimo_login FROM usuarios WHERE empresa_id=? ORDER BY nome",[req.auth.empresaId]); res.json(rows); } catch(err){handleDbError(res,err);}
});
app.post("/auth/usuarios", autenticar, exigirPerfil("ADMIN"), async (req,res)=>{
  const nome=String(req.body.nome||"").trim(), email=normalizarEmail(req.body.email), senha=String(req.body.senha||""), perfil=String(req.body.perfil||"TECNICO").toUpperCase(), colaboradorId=validarId(req.body.colaborador_id)?Number(req.body.colaborador_id):null;
  if(!nome||!email||senha.length<8) return res.status(400).json({erro:"Nome, e-mail e senha (mínimo 8 caracteres) são obrigatórios."});
  if(!["ADMIN","GESTOR","TECNICO"].includes(perfil)) return res.status(400).json({erro:"Perfil inválido."});
  try { const hash=await hashSenha(senha); const [r]=await db.query("INSERT INTO usuarios (empresa_id,nome,email,senha_hash,perfil,colaborador_id) VALUES (?,?,?,?,?,?)",[req.auth.empresaId,nome,email,hash,perfil,colaboradorId]); res.status(201).json({id:r.insertId,message:"Usuário criado com sucesso."}); } catch(err){ if(err.code==="ER_DUP_ENTRY") return res.status(409).json({erro:"E-mail já cadastrado nesta empresa."}); handleDbError(res,err,"Não foi possível criar o usuário."); }
});
app.patch("/auth/usuarios/:id", autenticar, exigirPerfil("ADMIN"), async(req,res)=>{ const id=req.params.id; if(!validarId(id)) return res.status(400).json({erro:"ID inválido."}); const {nome,perfil,ativo,senha,colaborador_id}=req.body; try { const campos=[],vals=[]; if(nome!==undefined){campos.push("nome=?");vals.push(String(nome).trim())} if(perfil!==undefined){const p=String(perfil).toUpperCase();if(!["ADMIN","GESTOR","TECNICO"].includes(p))return res.status(400).json({erro:"Perfil inválido."});campos.push("perfil=?");vals.push(p)} if(ativo!==undefined){campos.push("ativo=?");vals.push(ativo?1:0)} if(colaborador_id!==undefined){campos.push("colaborador_id=?");vals.push(validarId(colaborador_id)?Number(colaborador_id):null)} if(senha){if(String(senha).length<8)return res.status(400).json({erro:"Senha deve ter pelo menos 8 caracteres."});campos.push("senha_hash=?");vals.push(await hashSenha(senha))} if(!campos.length)return res.status(400).json({erro:"Nenhuma alteração informada."}); vals.push(id,req.auth.empresaId); const [r]=await db.query(`UPDATE usuarios SET ${campos.join(",")} WHERE id=? AND empresa_id=?`,vals); if(!r.affectedRows)return res.status(404).json({erro:"Usuário não encontrado."});res.json({message:"Usuário atualizado."}); }catch(err){handleDbError(res,err,"Não foi possível atualizar o usuário.");} });

// Cadastros ------------------------------------------------------------------
app.get("/colaboradores", authOpcional, async(req,res)=>{try{const q=req.query.todos==="1"?"":" AND ativo=1";const[rows]=await db.query(`SELECT * FROM colaboradores WHERE empresa_id=?${q} ORDER BY nome`,[req.auth.empresaId]);res.json(rows)}catch(err){handleDbError(res,err)}});
app.get("/clientes", authOpcional, async(req,res)=>{try{const[rows]=await db.query("SELECT * FROM clientes WHERE empresa_id=? ORDER BY nome",[req.auth.empresaId]);res.json(rows)}catch(err){handleDbError(res,err)}});
app.get("/gestores", authOpcional, async(req,res)=>{try{const[rows]=await db.query("SELECT * FROM gestores WHERE empresa_id=? ORDER BY nome",[req.auth.empresaId]);res.json(rows)}catch(err){handleDbError(res,err)}});
app.get("/materiais", authOpcional, async(req,res)=>{try{const q=req.query.todos==="1"?"":" AND ativo=1";const[rows]=await db.query(`SELECT * FROM materiais WHERE empresa_id=?${q} ORDER BY nome`,[req.auth.empresaId]);res.json(rows)}catch(err){handleDbError(res,err)}});

// Materiais --------------------------------------------------------------
// IMPORTANTE: estas 3 rotas específicas de materiais têm que vir ANTES das
// rotas genéricas /gestao/:tipo abaixo — senão o Express casa a rota
// genérica primeiro (que só aceita colaboradores/clientes/gestores) e
// nunca chega aqui.
app.post("/gestao/materiais",autenticar,exigirPerfil("ADMIN","GESTOR"),async(req,res)=>{const{nome,unidade,preco,estoque}=req.body;if(!String(nome||"").trim())return res.status(400).json({erro:"O campo 'nome' é obrigatório."});const p=Number(preco);if(!Number.isFinite(p)||p<0)return res.status(400).json({erro:"Preço inválido."});const e=estoque===""||estoque==null?null:Number(estoque);if(e!==null&&!Number.isFinite(e))return res.status(400).json({erro:"Estoque inválido."});try{const[r]=await db.query("INSERT INTO materiais (empresa_id,nome,unidade,preco,estoque) VALUES (?,?,?,?,?)",[req.auth.empresaId,String(nome).trim(),String(unidade||"un").trim(),p,e]);res.status(201).json({id:r.insertId,message:"Material cadastrado com sucesso."})}catch(err){handleDbError(res,err)}});
app.put("/gestao/materiais/:id",autenticar,exigirPerfil("ADMIN","GESTOR"),async(req,res)=>{const{id}=req.params;if(!validarId(id))return res.status(400).json({erro:"ID inválido."});const{nome,unidade,preco,estoque,ativo}=req.body;const p=Number(preco);if(!String(nome||"").trim()||!Number.isFinite(p)||p<0)return res.status(400).json({erro:"Nome ou preço inválido."});try{const[r]=await db.query("UPDATE materiais SET nome=?,unidade=?,preco=?,estoque=?,ativo=? WHERE id=? AND empresa_id=?",[String(nome).trim(),String(unidade||"un").trim(),p,estoque===""||estoque==null?null:Number(estoque),ativo===false||ativo===0?0:1,id,req.auth.empresaId]);if(!r.affectedRows)return res.status(404).json({erro:"Material não encontrado."});res.json({message:"Material atualizado com sucesso."})}catch(err){handleDbError(res,err)}});
app.delete("/gestao/materiais/:id",autenticar,exigirPerfil("ADMIN","GESTOR"),async(req,res)=>{if(!validarId(req.params.id))return res.status(400).json({erro:"ID inválido."});try{const[r]=await db.query("UPDATE materiais SET ativo=0 WHERE id=? AND empresa_id=?",[req.params.id,req.auth.empresaId]);if(!r.affectedRows)return res.status(404).json({erro:"Material não encontrado."});res.json({message:"Material desativado com sucesso."})}catch(err){handleDbError(res,err)}});
app.post("/gestao/materiais/importar",autenticar,exigirPerfil("ADMIN","GESTOR"),async(req,res)=>{
  const itens = Array.isArray(req.body.itens) ? req.body.itens.slice(0, 2000) : [];
  if (!itens.length) return res.status(400).json({erro:"Envie ao menos um item para importar."});
  let criados = 0, ignorados = 0;
  const erros = [];
  for (const item of itens) {
    const nome = String(item?.nome || "").trim();
    if (!nome) { ignorados++; continue; }
    const unidade = String(item?.unidade || "un").trim().slice(0, 20) || "un";
    const precoNum = Number(item?.preco);
    const preco = Number.isFinite(precoNum) && precoNum >= 0 ? precoNum : 0;
    const estoqueRaw = item?.estoque;
    const estoqueNum = estoqueRaw === "" || estoqueRaw == null ? null : Number(estoqueRaw);
    const estoque = estoqueNum != null && Number.isFinite(estoqueNum) ? estoqueNum : null;
    try {
      await db.query("INSERT INTO materiais (empresa_id,nome,unidade,preco,estoque) VALUES (?,?,?,?,?)", [req.auth.empresaId, nome, unidade, preco, estoque]);
      criados++;
    } catch (err) {
      ignorados++;
      if (erros.length < 10) erros.push(`${nome}: ${err.sqlMessage || err.message}`);
    }
  }
  res.status(201).json({ message: `${criados} material(is) importado(s) com sucesso.`, criados, ignorados, erros });
});

// Colaboradores (técnicos) --------------------------------------------
// Igual materiais: nunca excluídos de verdade (têm OS/despesas/pontos de
// GPS vinculados no histórico) — "excluir" aqui desativa, pra sumir dos
// seletores de nova OS sem perder nada do que já foi registrado.
app.put("/gestao/colaboradores/:id",autenticar,exigirPerfil("ADMIN","GESTOR"),async(req,res)=>{const{id}=req.params;if(!validarId(id))return res.status(400).json({erro:"ID inválido."});const{nome,ativo,custo_hora}=req.body;if(!String(nome||"").trim())return res.status(400).json({erro:"O campo 'nome' é obrigatório."});const ch=custo_hora===""||custo_hora==null?null:Number(custo_hora);if(ch!=null&&(!Number.isFinite(ch)||ch<0))return res.status(400).json({erro:"Valor/hora inválido."});try{const[r]=await db.query("UPDATE colaboradores SET nome=?,ativo=?,custo_hora=? WHERE id=? AND empresa_id=?",[String(nome).trim(),ativo===false||ativo===0?0:1,ch,id,req.auth.empresaId]);if(!r.affectedRows)return res.status(404).json({erro:"Técnico não encontrado."});res.json({message:"Técnico atualizado com sucesso."})}catch(err){handleDbError(res,err)}});
app.delete("/gestao/colaboradores/:id",autenticar,exigirPerfil("ADMIN","GESTOR"),async(req,res)=>{if(!validarId(req.params.id))return res.status(400).json({erro:"ID inválido."});try{const[r]=await db.query("UPDATE colaboradores SET ativo=0 WHERE id=? AND empresa_id=?",[req.params.id,req.auth.empresaId]);if(!r.affectedRows)return res.status(404).json({erro:"Técnico não encontrado."});res.json({message:"Técnico desativado com sucesso."})}catch(err){handleDbError(res,err)}});
app.patch("/gestao/colaboradores/:id/reativar",autenticar,exigirPerfil("ADMIN","GESTOR"),async(req,res)=>{if(!validarId(req.params.id))return res.status(400).json({erro:"ID inválido."});try{const[r]=await db.query("UPDATE colaboradores SET ativo=1 WHERE id=? AND empresa_id=?",[req.params.id,req.auth.empresaId]);if(!r.affectedRows)return res.status(404).json({erro:"Técnico não encontrado."});res.json({message:"Técnico reativado com sucesso."})}catch(err){handleDbError(res,err)}});

// Veículos --------------------------------------------------------------
app.get("/veiculos", authOpcional, async(req,res)=>{try{const q=req.query.todos==="1"?"":" AND ativo=1";const[rows]=await db.query(`SELECT * FROM veiculos WHERE empresa_id=?${q} ORDER BY nome`,[req.auth.empresaId]);res.json(rows)}catch(err){handleDbError(res,err)}});
app.post("/gestao/veiculos",autenticar,exigirPerfil("ADMIN","GESTOR"),async(req,res)=>{const{nome,placa,custo_km}=req.body;if(!String(nome||"").trim())return res.status(400).json({erro:"O campo 'nome' é obrigatório."});const ck=custo_km===""||custo_km==null?null:Number(custo_km);if(ck!=null&&(!Number.isFinite(ck)||ck<0))return res.status(400).json({erro:"Custo/km inválido."});try{const[r]=await db.query("INSERT INTO veiculos (empresa_id,nome,placa,custo_km) VALUES (?,?,?,?)",[req.auth.empresaId,String(nome).trim(),placa?String(placa).trim().toUpperCase():null,ck]);res.status(201).json({id:r.insertId,message:"Veículo cadastrado com sucesso."})}catch(err){handleDbError(res,err)}});
app.put("/gestao/veiculos/:id",autenticar,exigirPerfil("ADMIN","GESTOR"),async(req,res)=>{const{id}=req.params;if(!validarId(id))return res.status(400).json({erro:"ID inválido."});const{nome,placa,ativo,custo_km}=req.body;if(!String(nome||"").trim())return res.status(400).json({erro:"O campo 'nome' é obrigatório."});const ck=custo_km===""||custo_km==null?null:Number(custo_km);if(ck!=null&&(!Number.isFinite(ck)||ck<0))return res.status(400).json({erro:"Custo/km inválido."});try{const[r]=await db.query("UPDATE veiculos SET nome=?,placa=?,ativo=?,custo_km=? WHERE id=? AND empresa_id=?",[String(nome).trim(),placa?String(placa).trim().toUpperCase():null,ativo===false||ativo===0?0:1,ck,id,req.auth.empresaId]);if(!r.affectedRows)return res.status(404).json({erro:"Veículo não encontrado."});res.json({message:"Veículo atualizado com sucesso."})}catch(err){handleDbError(res,err)}});
app.delete("/gestao/veiculos/:id",autenticar,exigirPerfil("ADMIN","GESTOR"),async(req,res)=>{if(!validarId(req.params.id))return res.status(400).json({erro:"ID inválido."});try{const[r]=await db.query("UPDATE veiculos SET ativo=0 WHERE id=? AND empresa_id=?",[req.params.id,req.auth.empresaId]);if(!r.affectedRows)return res.status(404).json({erro:"Veículo não encontrado."});res.json({message:"Veículo desativado com sucesso."})}catch(err){handleDbError(res,err)}});
app.patch("/gestao/veiculos/:id/reativar",autenticar,exigirPerfil("ADMIN","GESTOR"),async(req,res)=>{if(!validarId(req.params.id))return res.status(400).json({erro:"ID inválido."});try{const[r]=await db.query("UPDATE veiculos SET ativo=1 WHERE id=? AND empresa_id=?",[req.params.id,req.auth.empresaId]);if(!r.affectedRows)return res.status(404).json({erro:"Veículo não encontrado."});res.json({message:"Veículo reativado com sucesso."})}catch(err){handleDbError(res,err)}});

app.post("/gestao/:tipo",autenticar,exigirPerfil("ADMIN","GESTOR"),async(req,res)=>{const{tipo}=req.params;if(!tipoValido(tipo))return res.status(400).json({erro:`Tipo inválido: ${tipo}`});const{nome,rua,bairro,cidade,telefone}=req.body;if(!String(nome||"").trim())return res.status(400).json({erro:"O campo 'nome' é obrigatório."});try{const[r]=tipo==="clientes"?await db.query("INSERT INTO clientes (empresa_id,nome,rua,bairro,cidade,telefone) VALUES (?,?,?,?,?,?)",[req.auth.empresaId,String(nome).trim(),rua||null,bairro||null,cidade||null,telefone||null]):await db.query(`INSERT INTO ${tipo} (empresa_id,nome) VALUES (?,?)`,[req.auth.empresaId,String(nome).trim()]);res.status(201).json({id:r.insertId,message:"Cadastro criado com sucesso."})}catch(err){handleDbError(res,err)}});
app.put("/gestao/:tipo/:id",autenticar,exigirPerfil("ADMIN","GESTOR"),async(req,res)=>{const{tipo,id}=req.params;if(!tipoValido(tipo)||!validarId(id))return res.status(400).json({erro:"Tipo ou ID inválido."});const{nome,rua,bairro,cidade,telefone}=req.body;if(!String(nome||"").trim())return res.status(400).json({erro:"O campo 'nome' é obrigatório."});try{const[r]=tipo==="clientes"?await db.query("UPDATE clientes SET nome=?,rua=?,bairro=?,cidade=?,telefone=? WHERE id=? AND empresa_id=?",[String(nome).trim(),rua||null,bairro||null,cidade||null,telefone||null,id,req.auth.empresaId]):await db.query(`UPDATE ${tipo} SET nome=? WHERE id=? AND empresa_id=?`,[String(nome).trim(),id,req.auth.empresaId]);if(!r.affectedRows)return res.status(404).json({erro:"Registro não encontrado."});res.json({message:"Cadastro atualizado com sucesso."})}catch(err){handleDbError(res,err)}});
app.delete("/gestao/:tipo/:id",autenticar,exigirPerfil("ADMIN","GESTOR"),async(req,res)=>{const{tipo,id}=req.params;if(!tipoValido(tipo)||!validarId(id))return res.status(400).json({erro:"Tipo ou ID inválido."});try{const[r]=await db.query(`DELETE FROM ${tipo} WHERE id=? AND empresa_id=?`,[id,req.auth.empresaId]);if(!r.affectedRows)return res.status(404).json({erro:"Registro não encontrado."});res.json({message:"Cadastro excluído com sucesso."})}catch(err){if(["ER_ROW_IS_REFERENCED_2","ER_ROW_IS_REFERENCED"].includes(err.code))return res.status(409).json({erro:"Não é possível excluir: existem registros relacionados."});handleDbError(res,err)}});

// Dashboard ------------------------------------------------------------------
app.get("/gestao/resumo",autenticar,exigirPerfil("ADMIN","GESTOR"),async(req,res)=>{try{const e=req.auth.empresaId;const[[totalOS]] = await db.query("SELECT COUNT(*) total FROM servicos WHERE empresa_id=?",[e]);const[[hoje]]=await db.query("SELECT COUNT(*) total FROM servicos WHERE empresa_id=? AND DATE(fim_data)=CURDATE()",[e]);const[[tecnicos]]=await db.query("SELECT COUNT(*) total FROM colaboradores WHERE empresa_id=?",[e]);const[[clientes]]=await db.query("SELECT COUNT(*) total FROM clientes WHERE empresa_id=?",[e]);const[[gestores]]=await db.query("SELECT COUNT(*) total FROM gestores WHERE empresa_id=?",[e]);res.json({ordens:Number(totalOS.total),ordensHoje:Number(hoje.total),tecnicos:Number(tecnicos.total),clientes:Number(clientes.total),gestores:Number(gestores.total)})}catch(err){handleDbError(res,err)}});
app.get("/gestao/relatorios",autenticar,exigirPerfil("ADMIN","GESTOR"),async(req,res)=>{const limite=Math.min(Math.max(Number(req.query.limite)||100,1),500);try{const[rows]=await db.query(`SELECT s.*,t.nome tecnico_nome,c.nome cliente_nome,g.nome gestor_nome,v.nome veiculo_nome,v.placa veiculo_placa FROM servicos s LEFT JOIN colaboradores t ON s.tecnico_id=t.id AND t.empresa_id=s.empresa_id LEFT JOIN clientes c ON s.cliente_id=c.id AND c.empresa_id=s.empresa_id LEFT JOIN gestores g ON s.gestor_id=g.id AND g.empresa_id=s.empresa_id LEFT JOIN veiculos v ON s.veiculo_id=v.id AND v.empresa_id=s.empresa_id WHERE s.empresa_id=? ORDER BY s.id DESC LIMIT ?`,[req.auth.empresaId,limite]);res.json(rows)}catch(err){handleDbError(res,err)}});

app.get("/gestao/relatorios/:id/pdf",autenticar,exigirPerfil("ADMIN","GESTOR"),async(req,res)=>{
  const id = req.params.id;
  if (!validarId(id)) return res.status(400).json({erro:"ID inválido."});
  try {
    const [[os]] = await db.query(
      `SELECT s.*, t.nome tecnico_nome, t.custo_hora, c.nome cliente_nome, c.rua, c.bairro, c.cidade, g.nome gestor_nome, v.nome veiculo_nome, v.placa veiculo_placa, v.custo_km
       FROM servicos s
       LEFT JOIN colaboradores t ON s.tecnico_id=t.id AND t.empresa_id=s.empresa_id
       LEFT JOIN clientes c ON s.cliente_id=c.id AND c.empresa_id=s.empresa_id
       LEFT JOIN gestores g ON s.gestor_id=g.id AND g.empresa_id=s.empresa_id
       LEFT JOIN veiculos v ON s.veiculo_id=v.id AND v.empresa_id=s.empresa_id
       WHERE s.id=? AND s.empresa_id=?`, [id, req.auth.empresaId]);
    if (!os) return res.status(404).json({ erro: "OS não encontrada." });

    const [materiais] = await db.query(
      "SELECT sm.quantidade, m.nome material_nome, m.unidade FROM servico_materiais sm JOIN materiais m ON m.id=sm.material_id WHERE sm.servico_id=? AND sm.status<>'CANCELADO'", [id]);
    const [despesas] = await db.query(
      "SELECT tipo, valor, descricao, cobrar_do_cliente FROM despesas WHERE servico_id=?", [id]);
    const [pontosOS] = await db.query("SELECT latitude,longitude FROM pontos WHERE os_id=? ORDER BY dataHora ASC", [id]);
    let kmPercorrido = 0;
    for (let i = 1; i < pontosOS.length; i++) kmPercorrido += distanciaKm(pontosOS[i-1].latitude, pontosOS[i-1].longitude, pontosOS[i].latitude, pontosOS[i].longitude);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="OS-${os.id}.pdf"`);

    const doc = new PDFDocument({ margin: 42, size: "A4" });
    doc.on("error", (e) => console.error("Erro ao gerar PDF:", e));
    doc.pipe(res);

    const fmtData = (d) => (d ? new Date(d).toLocaleString("pt-BR") : "—");

    doc.fontSize(19).fillColor("#152238").text(`Ordem de Serviço #${os.id}`);
    doc.fontSize(10).fillColor("#687386").text(`Status: ${labelsStatusOSPdf(os.status)}`);
    doc.moveDown(0.8);

    doc.fontSize(11).fillColor("#152238").text(`Cliente: ${os.cliente_nome || "—"}`);
    if (os.rua || os.bairro || os.cidade) {
      doc.fontSize(9).fillColor("#687386").text([os.rua, os.bairro, os.cidade].filter(Boolean).join(", "));
    }
    doc.fontSize(11).fillColor("#152238").text(`Técnico: ${os.tecnico_nome || "—"}`);
    doc.text(`Gestor: ${os.gestor_nome || "—"}`);
    if (os.veiculo_nome) {
      doc.text(`Veículo: ${os.veiculo_nome}${os.veiculo_placa ? ` (${os.veiculo_placa})` : ""}${pontosOS.length > 1 ? ` — ${kmPercorrido.toFixed(2)} km percorridos` : ""}`);
    }
    doc.moveDown(0.4);

    doc.fontSize(9).fillColor("#687386").text(
      `Criada: ${fmtData(os.criada_data)}  •  Início: ${fmtData(os.inicio_data)}  •  Finalizada: ${fmtData(os.fim_data)}`
    );
    doc.moveDown(0.9);

    doc.fontSize(13).fillColor("#152238").text("Relatório do serviço");
    doc.moveTo(doc.x, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeColor("#E5E9F0").stroke();
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor("#16233B").text(os.relatorio || "—", { align: "justify" });
    doc.moveDown(0.8);

    if (materiais.length) {
      doc.fontSize(13).fillColor("#152238").text("Materiais utilizados");
      doc.moveTo(doc.x, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeColor("#E5E9F0").stroke();
      doc.moveDown(0.3);
      materiais.forEach((m) => doc.fontSize(10).fillColor("#16233B").text(`•  ${m.quantidade} ${m.unidade} — ${m.material_nome}`));
      doc.moveDown(0.7);
    }

    if (despesas.length) {
      doc.fontSize(13).fillColor("#152238").text("Despesas");
      doc.moveTo(doc.x, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeColor("#E5E9F0").stroke();
      doc.moveDown(0.3);
      despesas.forEach((d) => doc.fontSize(10).fillColor("#16233B").text(
        `•  ${d.tipo} — R$ ${Number(d.valor).toFixed(2)}${d.descricao ? ` (${d.descricao})` : ""} ${d.cobrar_do_cliente ? "" : "[custo interno]"}`
      ));
      doc.moveDown(0.7);
    }

    {
      const custoMaterial = materiais.reduce((s,m)=>s+Number(m.quantidade)*Number(m.preco_unitario), 0);
      const custoDespesas = despesas.filter(d=>d.tipo!=="COMBUSTIVEL").reduce((s,d)=>s+Number(d.valor), 0);
      const horas = horasTrabalhadas(os);
      const custoMaoDeObra = os.custo_hora != null ? horas * Number(os.custo_hora) : null;
      const custoCombustivel = os.custo_km != null ? kmPercorrido * Number(os.custo_km) : null;
      const totalCusto = custoMaterial + custoDespesas + (custoMaoDeObra || 0) + (custoCombustivel || 0);

      doc.fontSize(13).fillColor("#152238").text("Custo estimado desta OS");
      doc.moveTo(doc.x, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeColor("#E5E9F0").stroke();
      doc.moveDown(0.3);
      doc.fontSize(10).fillColor("#16233B").text(`Material: R$ ${custoMaterial.toFixed(2)}`);
      doc.text(`Outras despesas (sem combustível): R$ ${custoDespesas.toFixed(2)}`);
      doc.text(`Mão de obra${horas ? ` (${horas.toFixed(2)}h)` : ""}: ${custoMaoDeObra != null ? `R$ ${custoMaoDeObra.toFixed(2)}` : "não calculado (técnico sem valor/hora)"}`);
      doc.text(`Combustível${pontosOS.length > 1 ? ` (${kmPercorrido.toFixed(2)} km)` : ""}: ${custoCombustivel != null ? `R$ ${custoCombustivel.toFixed(2)}` : "não calculado (veículo sem custo/km)"}`);
      doc.fontSize(11).fillColor("#152238").text(`Total estimado: R$ ${totalCusto.toFixed(2)}`, { underline: true });
      doc.moveDown(0.7);
    }

    const fotos = normalizarFotos(os.foto_conclusao);
    if (fotos.length) {
      if (doc.y + 150 > doc.page.height - doc.page.margins.bottom) doc.addPage();
      doc.fontSize(13).fillColor("#152238").text("Fotos do serviço");
      doc.moveDown(0.4);
      const larguraImg = 160, alturaImg = 120, gap = 14;
      let x = doc.page.margins.left, y = doc.y;
      for (const caminho of fotos) {
        const buffer = await bufferDaImagem(caminho);
        if (!buffer) continue;
        if (x + larguraImg > doc.page.width - doc.page.margins.right) { x = doc.page.margins.left; y += alturaImg + gap; }
        if (y + alturaImg > doc.page.height - doc.page.margins.bottom) { doc.addPage(); x = doc.page.margins.left; y = doc.page.margins.top; }
        try { doc.image(buffer, x, y, { fit: [larguraImg, alturaImg] }); } catch (_) {}
        x += larguraImg + gap;
      }
      doc.y = y + alturaImg + gap;
    }

    if (doc.y + 170 > doc.page.height - doc.page.margins.bottom) doc.addPage();
    doc.fontSize(13).fillColor("#152238").text("Assinatura de quem recebeu o serviço");
    doc.moveDown(0.5);
    const bufferAssinatura = await bufferDaImagem(os.cliente_assinatura);
    if (bufferAssinatura) {
      try { doc.image(bufferAssinatura, { fit: [260, 140] }); } catch (_) {}
    }
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor("#687386").text(`Assinado por: ${os.cliente_nome_completo || "—"}`);

    doc.end();
  } catch (err) {
    console.error("Erro ao gerar PDF da OS:", err);
    if (!res.headersSent) res.status(500).json({ erro: "Não foi possível gerar o PDF." });
    else res.end();
  }
});

// Pontos/GPS -----------------------------------------------------------------
app.post("/pontos",autenticar,async(req,res)=>{
  let {tecnico_id,os_id,latitude,longitude}=req.body;
  const lat=Number(latitude),lng=Number(longitude);
  if(req.auth.perfil==="TECNICO"){
    const proprio=await colaboradorDoUsuario(req);
    if(!proprio)return res.status(403).json({erro:"Usuário técnico não está vinculado a um colaborador."});
    tecnico_id=proprio;
  }
  if(!validarId(tecnico_id)||!Number.isFinite(lat)||!Number.isFinite(lng)||lat<-90||lat>90||lng<-180||lng>180)return res.status(400).json({erro:"Técnico, latitude e longitude válidos são obrigatórios."});
  try{
    const[[tec]]=await db.query("SELECT id FROM colaboradores WHERE id=? AND empresa_id=?",[tecnico_id,req.auth.empresaId]);
    if(!tec)return res.status(404).json({erro:"Técnico não pertence à empresa."});
    let osNumero=null;
    if(validarId(os_id)){
      const[[os]]=await db.query("SELECT id,tecnico_id,status FROM servicos WHERE id=? AND empresa_id=?",[os_id,req.auth.empresaId]);
      if(!os)return res.status(404).json({erro:"OS não encontrada."});
      if(Number(os.tecnico_id)!==Number(tecnico_id))return res.status(403).json({erro:"A OS não pertence ao técnico informado."});
      if(["FINALIZADA","CANCELADA"].includes(os.status))return res.status(409).json({erro:"Não é permitido registrar GPS em uma OS encerrada."});
      osNumero=Number(os.id);
    }
    const[r]=await db.query("INSERT INTO pontos (empresa_id,tecnico_id,os_id,latitude,longitude) VALUES (?,?,?,?,?)",[req.auth.empresaId,tecnico_id,osNumero,lat,lng]);
    res.status(201).json({message:"Localização registrada",id:r.insertId});
  }catch(err){handleDbError(res,err,"Não foi possível registrar a localização.")}
});
app.get("/pontos",autenticar,exigirPerfil("ADMIN","GESTOR"),async(req,res)=>{try{const[rows]=await db.query(`SELECT p.id,p.tecnico_id,p.os_id,p.latitude,p.longitude,p.dataHora,t.nome tecnico FROM pontos p INNER JOIN colaboradores t ON t.id=p.tecnico_id AND t.empresa_id=p.empresa_id INNER JOIN (SELECT empresa_id,tecnico_id,MAX(id) max_id FROM pontos GROUP BY empresa_id,tecnico_id) ultimo ON ultimo.empresa_id=p.empresa_id AND ultimo.tecnico_id=p.tecnico_id AND ultimo.max_id=p.id WHERE p.empresa_id=? ORDER BY p.dataHora DESC`,[req.auth.empresaId]);res.json(rows)}catch(err){handleDbError(res,err)}});

// Ordens de serviço ----------------------------------------------------------
const STATUS_VALIDOS=["ABERTA","ATRIBUIDA","ACEITA","EM_DESLOCAMENTO","NO_LOCAL","EM_ATENDIMENTO","EM_ALMOCO","FINALIZADA","CANCELADA"];
const TRANSICOES={ATRIBUIDA:"ACEITA",ACEITA:"EM_DESLOCAMENTO",EM_DESLOCAMENTO:"NO_LOCAL",NO_LOCAL:"EM_ATENDIMENTO"};

app.get("/tecnico/dashboard",autenticar,exigirPerfil("TECNICO"),async(req,res)=>{
  try{
    const tecnicoId=await colaboradorDoUsuario(req);
    if(!tecnicoId)return res.status(403).json({erro:"Usuário técnico não está vinculado a um colaborador."});
    const [[totais]]=await db.query(`SELECT
      SUM(status IN ('ATRIBUIDA','ACEITA','EM_DESLOCAMENTO','NO_LOCAL','EM_ATENDIMENTO','EM_ALMOCO')) pendentes,
      SUM(status='EM_DESLOCAMENTO') deslocamento,
      SUM(status='NO_LOCAL') no_local,
      SUM(status='EM_ATENDIMENTO') atendimento,
      SUM(status='EM_ALMOCO') almoco,
      SUM(status='FINALIZADA' AND DATE(fim_data)=CURDATE()) finalizadas_hoje
      FROM servicos WHERE empresa_id=? AND tecnico_id=?`,[req.auth.empresaId,tecnicoId]);
    const [[despesasHoje]]=await db.query(`SELECT COALESCE(SUM(valor),0) total FROM despesas WHERE empresa_id=? AND tecnico_id=? AND DATE(criado_em)=CURDATE()`,[req.auth.empresaId,tecnicoId]);
    const [[solicitacoes]]=await db.query(`SELECT COUNT(*) total FROM solicitacoes_materiais WHERE empresa_id=? AND tecnico_id=? AND status IN ('SOLICITADO','APROVADO')`,[req.auth.empresaId,tecnicoId]);
    const [recentes]=await db.query(`SELECT s.id,s.status,s.criada_data,c.nome cliente_nome FROM servicos s LEFT JOIN clientes c ON c.id=s.cliente_id AND c.empresa_id=s.empresa_id WHERE s.empresa_id=? AND s.tecnico_id=? ORDER BY s.criada_data DESC LIMIT 5`,[req.auth.empresaId,tecnicoId]);
    res.json({tecnico_id:tecnicoId,totais:{pendentes:Number(totais.pendentes||0),deslocamento:Number(totais.deslocamento||0),no_local:Number(totais.no_local||0),atendimento:Number(totais.atendimento||0),almoco:Number(totais.almoco||0),finalizadas_hoje:Number(totais.finalizadas_hoje||0)},despesas_hoje:Number(despesasHoje.total||0),solicitacoes_materiais:Number(solicitacoes.total||0),recentes});
  }catch(err){handleDbError(res,err,"Não foi possível carregar o dashboard do técnico.")}
});

app.get("/servico",authOpcional,async(req,res)=>{const{tecnico_id,status}=req.query;const c=["s.empresa_id=?"],v=[req.auth.empresaId];if(req.auth.perfil==="TECNICO"){const cid=await colaboradorDoUsuario(req);if(!cid)return res.status(403).json({erro:"Usuário técnico não está vinculado a um colaborador."});c.push("s.tecnico_id=?");v.push(cid)}else if(tecnico_id){c.push("s.tecnico_id=?");v.push(tecnico_id)}if(status){c.push("s.status=?");v.push(String(status).toUpperCase())}try{const[rows]=await db.query(`SELECT s.*,c.nome cliente_nome,g.nome gestor_nome,ve.nome veiculo_nome,ve.placa veiculo_placa FROM servicos s LEFT JOIN clientes c ON s.cliente_id=c.id AND c.empresa_id=s.empresa_id LEFT JOIN gestores g ON s.gestor_id=g.id AND g.empresa_id=s.empresa_id LEFT JOIN veiculos ve ON s.veiculo_id=ve.id AND ve.empresa_id=s.empresa_id WHERE ${c.join(" AND ")} ORDER BY s.criada_data DESC LIMIT 100`,v);res.json(rows)}catch(err){handleDbError(res,err)}});
app.post("/servico/criar",autenticar,async(req,res)=>{let{tecnico_id,cliente_id,gestor_id,veiculo_id,data_criacao}=req.body;
let criadaDataSql=null;
if(data_criacao){
  const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(data_criacao).trim());
  if(!m)return res.status(400).json({erro:"Data retroativa inválida. Use o formato DD/MM/AAAA."});
  const dia=Number(m[1]),mes=Number(m[2]),ano=Number(m[3]);
  const dataInformada=new Date(ano,mes-1,dia);
  if(dataInformada.getDate()!==dia||dataInformada.getMonth()!==mes-1||dataInformada.getFullYear()!==ano)return res.status(400).json({erro:"Data retroativa inválida."});
  const hoje=new Date();const hojeSemHora=new Date(hoje.getFullYear(),hoje.getMonth(),hoje.getDate());
  if(dataInformada.getTime()>hojeSemHora.getTime())return res.status(400).json({erro:"A data retroativa não pode ser no futuro."});
  const agora=new Date();const pad=(n)=>String(n).padStart(2,"0");
  criadaDataSql=`${ano}-${pad(mes)}-${pad(dia)} ${pad(agora.getHours())}:${pad(agora.getMinutes())}:${pad(agora.getSeconds())}`;
}if(req.auth.perfil==="TECNICO"){const proprioTecnico=await colaboradorDoUsuario(req);if(!proprioTecnico)return res.status(403).json({erro:"Usuário técnico não está vinculado a um colaborador."});tecnico_id=proprioTecnico;}if(!validarId(tecnico_id)||!validarId(cliente_id)||!validarId(gestor_id))return res.status(400).json({erro:"Técnico, cliente e gestor válidos são obrigatórios."});veiculo_id=validarId(veiculo_id)?Number(veiculo_id):null;const conn=await db.getConnection();try{await conn.beginTransaction();const[[ok]]=await conn.query("SELECT 1 FROM colaboradores t JOIN clientes c ON c.empresa_id=t.empresa_id JOIN gestores g ON g.empresa_id=t.empresa_id WHERE t.id=? AND c.id=? AND g.id=? AND t.empresa_id=? LIMIT 1",[tecnico_id,cliente_id,gestor_id,req.auth.empresaId]);if(!ok){await conn.rollback();return res.status(400).json({erro:"Técnico, cliente e gestor devem pertencer à mesma empresa."})}if(veiculo_id){const[[veiculoOk]]=await conn.query("SELECT 1 FROM veiculos WHERE id=? AND empresa_id=? AND ativo=1",[veiculo_id,req.auth.empresaId]);if(!veiculoOk){await conn.rollback();return res.status(400).json({erro:"Veículo inválido."})}}const[r]=criadaDataSql
  ?await conn.query("INSERT INTO servicos (empresa_id,tecnico_id,cliente_id,gestor_id,veiculo_id,status,criada_data) VALUES (?,?,?,?,?, 'ATRIBUIDA',?)",[req.auth.empresaId,tecnico_id,cliente_id,gestor_id,veiculo_id,criadaDataSql])
  :await conn.query("INSERT INTO servicos (empresa_id,tecnico_id,cliente_id,gestor_id,veiculo_id,status,criada_data) VALUES (?,?,?,?,?, 'ATRIBUIDA',NOW())",[req.auth.empresaId,tecnico_id,cliente_id,gestor_id,veiculo_id]);await registrarStatus(r.insertId,"ATRIBUIDA",conn);await conn.commit();res.status(201).json({id:r.insertId,status:"ATRIBUIDA",message:"Ordem de serviço criada."});const[[cli]]=await db.query("SELECT nome FROM clientes WHERE id=? AND empresa_id=?",[cliente_id,req.auth.empresaId]).catch(()=>[[null]]);enviarPushParaTecnico(req.auth.empresaId,tecnico_id,"Nova OS atribuída",`Você recebeu uma nova ordem de serviço${cli?.nome?` para ${cli.nome}`:""}.`,{tipo:"nova_os",os_id:r.insertId});}catch(err){await conn.rollback();handleDbError(res,err,"Não foi possível criar a ordem de serviço.")}finally{conn.release()}});
app.get("/servico/:id",autenticar,async(req,res)=>{if(!validarId(req.params.id))return res.status(400).json({erro:"ID inválido."});try{const[[os]]=await db.query(`SELECT s.*,t.nome tecnico_nome,c.nome cliente_nome,g.nome gestor_nome FROM servicos s LEFT JOIN colaboradores t ON s.tecnico_id=t.id AND t.empresa_id=s.empresa_id LEFT JOIN clientes c ON s.cliente_id=c.id AND c.empresa_id=s.empresa_id LEFT JOIN gestores g ON s.gestor_id=g.id AND g.empresa_id=s.empresa_id WHERE s.id=? AND s.empresa_id=?`,[req.params.id,req.auth.empresaId]);if(!os)return res.status(404).json({erro:"OS não encontrada."});if(!(await tecnicoPodeAcessarOS(req,os)))return res.status(403).json({erro:"Esta OS não pertence ao técnico autenticado."});const[historico]=await db.query("SELECT status,dataHora FROM servico_status_historico WHERE servico_id=? AND empresa_id=? ORDER BY id",[req.params.id,req.auth.empresaId]);res.json({...os,historico})}catch(err){handleDbError(res,err)}});
app.post("/servico/:id/status",autenticar,async(req,res)=>{const id=req.params.id,proximo=String(req.body.status||"").trim().toUpperCase();if(!validarId(id)||!STATUS_VALIDOS.includes(proximo)||["FINALIZADA","CANCELADA"].includes(proximo))return res.status(400).json({erro:"OS ou status inválido. Use finalização/cancelamento para encerrar."});const conn=await db.getConnection();try{await conn.beginTransaction();const[[os]]=await conn.query("SELECT id,status,tecnico_id FROM servicos WHERE id=? AND empresa_id=? FOR UPDATE",[id,req.auth.empresaId]);if(!os){await conn.rollback();return res.status(404).json({erro:"OS não encontrada."});}if(!(await tecnicoPodeAcessarOS(req,os))){await conn.rollback();return res.status(403).json({erro:"Esta OS não pertence ao técnico autenticado."});} if(TRANSICOES[os.status]!==proximo){await conn.rollback();return res.status(409).json({erro:`Transição inválida: ${os.status} → ${proximo}.`});}const coluna={ACEITA:"aceita_data",EM_DESLOCAMENTO:"deslocamento_data",NO_LOCAL:"chegada_data",EM_ATENDIMENTO:"inicio_data"}[proximo];await conn.query(`UPDATE servicos SET status=?,${coluna}=NOW() WHERE id=? AND empresa_id=?`,[proximo,id,req.auth.empresaId]);await registrarStatus(id,proximo,conn);await conn.commit();res.json({id:Number(id),status:proximo,message:"Status atualizado com sucesso."})}catch(err){await conn.rollback();handleDbError(res,err,"Não foi possível atualizar o status da OS.")}finally{conn.release()}});
app.post("/servico/finalizar",autenticar,async(req,res)=>{
  let{os_id,tecnico_id,cliente_id,gestor_id,relatorio,fotos,cliente_nome_completo,cliente_assinatura}=req.body;
  if(req.auth.perfil==="TECNICO"){tecnico_id=await colaboradorDoUsuario(req);}
  if(!validarId(os_id)||!validarId(tecnico_id)||!validarId(cliente_id)||!validarId(gestor_id))return res.status(400).json({erro:"OS, técnico, cliente e gestor válidos são obrigatórios."});
  if(!String(relatorio||"").trim())return res.status(400).json({erro:"O relatório do serviço é obrigatório."});
  if(!String(cliente_nome_completo||"").trim()||!cliente_assinatura)return res.status(400).json({erro:"Nome e assinatura do responsável são obrigatórios."});
  const fotosRecebidas=normalizarFotos(fotos);
  if(fotosRecebidas.length<3)return res.status(400).json({erro:"São necessárias pelo menos 3 fotos."});

  // 1) Checagem rápida (sem travar nada) antes de gastar tempo/CPU salvando
  // fotos — evita gravar arquivo em disco pra depois descobrir que a OS já
  // não está mais no status certo.
  try{
    const[[osAtual]]=await db.query("SELECT * FROM servicos WHERE id=? AND empresa_id=?",[os_id,req.auth.empresaId]);
    if(!osAtual)return res.status(404).json({erro:"OS não encontrada."});
    if(!(await tecnicoPodeAcessarOS(req,osAtual)))return res.status(403).json({erro:"Esta OS não pertence ao técnico autenticado."});
    if(Number(osAtual.tecnico_id)!==Number(tecnico_id)||Number(osAtual.cliente_id)!==Number(cliente_id)||Number(osAtual.gestor_id)!==Number(gestor_id))return res.status(409).json({erro:"Os dados não correspondem à OS selecionada."});
    if(osAtual.status!=="EM_ATENDIMENTO")return res.status(409).json({erro:`A OS precisa estar em EM_ATENDIMENTO. Status atual: ${osAtual.status}.`});
  }catch(err){return handleDbError(res,err);}

  // 2) Salva as fotos em paralelo, FORA de qualquer transação — é a parte
  // mais lenta (decodificar base64 + gravar em disco), e no plano free do
  // Render (CPU bem limitada) fazer isso de forma síncrona e sequencial
  // dentro de uma transação já causou timeout consistente. Assim, nenhum
  // lock de banco fica preso enquanto isso roda.
  let fotosSalvas;
  try{
    fotosSalvas = await Promise.all(fotosRecebidas.map(async(foto,i)=>{
      if(typeof foto==="string"&&foto.startsWith("/uploads/"))return foto;
      const url = await salvarFotoBase64(foto,i+1);
      if(!url) throw new Error(`Foto ${i+1} inválida ou maior que 5 MB.`);
      return url;
    }));
  }catch(err){
    return res.status(400).json({erro:err.message||"Não foi possível processar as fotos."});
  }

  // 3) Só agora abre a transação — rápida, só o UPDATE final — e revalida o
  // status por segurança (pode ter mudado entre o passo 1 e agora).
  const conn=await db.getConnection();
  try{
    await conn.beginTransaction();
    const[[os]]=await conn.query("SELECT * FROM servicos WHERE id=? AND empresa_id=? FOR UPDATE",[os_id,req.auth.empresaId]);
    if(!os){await conn.rollback();fotosSalvas.forEach(f=>excluirArquivosFotos(JSON.stringify([f])));return res.status(404).json({erro:"OS não encontrada."});}
    if(os.status!=="EM_ATENDIMENTO"){await conn.rollback();fotosSalvas.forEach(f=>excluirArquivosFotos(JSON.stringify([f])));return res.status(409).json({erro:`A OS precisa estar em EM_ATENDIMENTO. Status atual: ${os.status}.`});}
    await conn.query("UPDATE servicos SET relatorio=?,foto_conclusao=?,cliente_nome_completo=?,cliente_assinatura=?,status='FINALIZADA',fim_data=NOW() WHERE id=? AND empresa_id=?",[String(relatorio).trim(),JSON.stringify(fotosSalvas),String(cliente_nome_completo).trim(),cliente_assinatura,os_id,req.auth.empresaId]);
    await registrarStatus(os_id,"FINALIZADA",conn);
    await conn.commit();
    res.json({message:"Ordem de serviço finalizada com sucesso.",id:Number(os_id),fotos:fotosSalvas,status:"FINALIZADA"});
    Promise.all([
      db.query("SELECT nome FROM colaboradores WHERE id=?",[tecnico_id]),
      db.query("SELECT nome FROM clientes WHERE id=?",[cliente_id]),
    ]).then(([[[t]],[[c]]])=>{
      enviarPushParaGestores(req.auth.empresaId,"OS finalizada",`${t?.nome||"Um técnico"} finalizou a OS #${os_id} (${c?.nome||"cliente"}).`,{tipo:"os_finalizada",os_id:Number(os_id)});
    }).catch(()=>{});
  }catch(err){
    try{await conn.rollback()}catch(_){}
    fotosSalvas.forEach(f=>excluirArquivosFotos(JSON.stringify([f])));
    handleDbError(res,err,"Erro ao salvar a ordem de serviço.");
  }finally{conn.release()}
});
app.post("/servico/:id/almoco/iniciar",autenticar,async(req,res)=>{const id=req.params.id;if(!validarId(id))return res.status(400).json({erro:"ID inválido."});const conn=await db.getConnection();try{await conn.beginTransaction();const[[os]]=await conn.query("SELECT id,status FROM servicos WHERE id=? AND empresa_id=? FOR UPDATE",[id,req.auth.empresaId]);if(!os){await conn.rollback();return res.status(404).json({erro:"OS não encontrada."})}if(!(await tecnicoPodeAcessarOS(req,os))){await conn.rollback();return res.status(403).json({erro:"Esta OS não pertence ao técnico autenticado."});}if(os.status!=="EM_ATENDIMENTO"){await conn.rollback();return res.status(409).json({erro:`Só é possível iniciar o almoço com a OS em atendimento. Status atual: ${os.status}.`})}await conn.query("UPDATE servicos SET status='EM_ALMOCO',almoco_inicio_data=NOW() WHERE id=? AND empresa_id=?",[id,req.auth.empresaId]);await registrarStatus(id,"EM_ALMOCO",conn);await conn.commit();res.json({id:Number(id),status:"EM_ALMOCO",message:"Horário de almoço registrado."})}catch(err){await conn.rollback();handleDbError(res,err,"Não foi possível iniciar o almoço.")}finally{conn.release()}});
app.post("/servico/:id/almoco/finalizar",autenticar,async(req,res)=>{const id=req.params.id;if(!validarId(id))return res.status(400).json({erro:"ID inválido."});const conn=await db.getConnection();try{await conn.beginTransaction();const[[os]]=await conn.query("SELECT id,status FROM servicos WHERE id=? AND empresa_id=? FOR UPDATE",[id,req.auth.empresaId]);if(!os){await conn.rollback();return res.status(404).json({erro:"OS não encontrada."})}if(!(await tecnicoPodeAcessarOS(req,os))){await conn.rollback();return res.status(403).json({erro:"Esta OS não pertence ao técnico autenticado."});}if(os.status!=="EM_ALMOCO"){await conn.rollback();return res.status(409).json({erro:`A OS não está em horário de almoço. Status atual: ${os.status}.`})}await conn.query("UPDATE servicos SET status='EM_ATENDIMENTO',almoco_fim_data=NOW() WHERE id=? AND empresa_id=?",[id,req.auth.empresaId]);await registrarStatus(id,"EM_ATENDIMENTO",conn);await conn.commit();res.json({id:Number(id),status:"EM_ATENDIMENTO",message:"Retorno do almoço registrado."})}catch(err){await conn.rollback();handleDbError(res,err,"Não foi possível finalizar o almoço.")}finally{conn.release()}});

// Digitar o horário de almoço direto (em vez de apertar "iniciar"/"voltar"
// no momento exato) — não muda o status da OS, só grava os horários.
app.patch("/servico/:id/almoco",autenticar,async(req,res)=>{
  const id=req.params.id;
  if(!validarId(id))return res.status(400).json({erro:"ID inválido."});
  const validarHora=h=>typeof h==="string"&&/^([01]\d|2[0-3]):([0-5]\d)$/.test(h.trim());
  const{inicio,fim}=req.body;
  if(inicio!=null&&inicio!==""&&!validarHora(inicio))return res.status(400).json({erro:"Horário de início inválido. Use o formato HH:MM."});
  if(fim!=null&&fim!==""&&!validarHora(fim))return res.status(400).json({erro:"Horário de fim inválido. Use o formato HH:MM."});
  try{
    const[[os]]=await db.query("SELECT * FROM servicos WHERE id=? AND empresa_id=?",[id,req.auth.empresaId]);
    if(!os)return res.status(404).json({erro:"OS não encontrada."});
    if(!(await tecnicoPodeAcessarOS(req,os)))return res.status(403).json({erro:"Esta OS não pertence ao técnico autenticado."});

    const dataBase=os.criada_data?new Date(os.criada_data):new Date();
    const montar=hhmm=>{const[h,m]=hhmm.split(":").map(Number);const d=new Date(dataBase);d.setHours(h,m,0,0);return d;};

    const novoInicio=inicio===""?null:(inicio?montar(inicio):undefined);
    const novoFim=fim===""?null:(fim?montar(fim):undefined);
    if(novoInicio&&novoFim&&novoFim<=novoInicio)return res.status(400).json({erro:"O fim do almoço precisa ser depois do início."});

    const campos=[],valores=[];
    if(novoInicio!==undefined){campos.push("almoco_inicio_data=?");valores.push(novoInicio)}
    if(novoFim!==undefined){campos.push("almoco_fim_data=?");valores.push(novoFim)}
    if(!campos.length)return res.status(400).json({erro:"Informe ao menos um horário."});

    valores.push(id,req.auth.empresaId);
    await db.query(`UPDATE servicos SET ${campos.join(",")} WHERE id=? AND empresa_id=?`,valores);
    res.json({message:"Horário de almoço salvo com sucesso."});
  }catch(err){handleDbError(res,err,"Não foi possível salvar o horário de almoço.")}
});

// Solicitação de materiais antes da OS -------------------------------------
app.get("/materiais/solicitacoes",autenticar,async(req,res)=>{
  try{
    const c=["sm.empresa_id=?"],v=[req.auth.empresaId];
    if(req.auth.perfil==="TECNICO"){const tid=await colaboradorDoUsuario(req);if(!tid)return res.status(403).json({erro:"Usuário técnico não está vinculado a um colaborador."});c.push("sm.tecnico_id=?");v.push(tid);}
    if(req.query.status){c.push("sm.status=?");v.push(String(req.query.status).toUpperCase());}
    const[rows]=await db.query(`SELECT sm.*,m.nome material_nome,c.nome cliente_nome,t.nome tecnico_nome FROM solicitacoes_materiais sm JOIN materiais m ON m.id=sm.material_id AND m.empresa_id=sm.empresa_id JOIN clientes c ON c.id=sm.cliente_id AND c.empresa_id=sm.empresa_id JOIN colaboradores t ON t.id=sm.tecnico_id AND t.empresa_id=sm.empresa_id WHERE ${c.join(" AND ")} ORDER BY sm.criado_em DESC LIMIT 200`,v);
    res.json(rows);
  }catch(err){handleDbError(res,err)}
});

app.post("/materiais/solicitacoes",autenticar,exigirPerfil("TECNICO","GESTOR","ADMIN"),async(req,res)=>{
  let{tecnico_id,cliente_id,itens,observacao}=req.body;
  if(req.auth.perfil==="TECNICO"){tecnico_id=await colaboradorDoUsuario(req);}
  if(!validarId(tecnico_id)||!validarId(cliente_id)||!Array.isArray(itens)||!itens.length)return res.status(400).json({erro:"Técnico, cliente e pelo menos um material são obrigatórios."});
  try{
    const[[vinculo]]=await db.query("SELECT 1 FROM colaboradores t JOIN clientes c ON c.empresa_id=t.empresa_id WHERE t.id=? AND c.id=? AND t.empresa_id=?",[tecnico_id,cliente_id,req.auth.empresaId]);
    if(!vinculo)return res.status(400).json({erro:"Técnico e cliente devem pertencer à mesma empresa."});
    const conn=await db.getConnection();
    try{await conn.beginTransaction();const ids=[];
      for(const item of itens){
        const mid=item?.material_id,qtd=Number(item?.quantidade);
        if(!validarId(mid)||!Number.isFinite(qtd)||qtd<=0)throw new Error("Material ou quantidade inválidos.");
        const[[m]]=await conn.query("SELECT id,nome,unidade FROM materiais WHERE id=? AND empresa_id=? AND ativo=1",[mid,req.auth.empresaId]);
        if(!m)throw new Error("Um dos materiais não está disponível.");
        const[r]=await conn.query("INSERT INTO solicitacoes_materiais (empresa_id,tecnico_id,cliente_id,material_id,quantidade,unidade,status,observacao) VALUES (?,?,?,?,?,?, 'SOLICITADO',?)",[req.auth.empresaId,tecnico_id,cliente_id,mid,qtd,m.unidade,String(item?.observacao||observacao||"").trim()||null]);
        ids.push(r.insertId);
      }
      await conn.commit();res.status(201).json({message:"Solicitação de material enviada.",ids});
      Promise.all([
        db.query("SELECT nome FROM colaboradores WHERE id=?",[tecnico_id]),
        db.query("SELECT nome FROM clientes WHERE id=?",[cliente_id]),
      ]).then(([[[t]],[[c]]])=>{
        enviarPushParaGestores(req.auth.empresaId,"Nova solicitação de material",`${t?.nome||"Um técnico"} pediu material para ${c?.nome||"um cliente"}.`,{tipo:"solicitacao_material"});
      }).catch(()=>{});
    }catch(err){await conn.rollback();throw err}finally{conn.release()}
  }catch(err){if(err.message?.includes("inválid")||err.message?.includes("disponível"))return res.status(400).json({erro:err.message});handleDbError(res,err,"Não foi possível solicitar os materiais.")}
});

app.patch("/materiais/solicitacoes/:id",autenticar,exigirPerfil("ADMIN","GESTOR"),async(req,res)=>{
  const id=req.params.id,status=String(req.body.status||"").toUpperCase();
  const permitidos=["SOLICITADO","APROVADO","SEPARADO","ENTREGUE","CANCELADO"];
  if(!validarId(id)||!permitidos.includes(status))return res.status(400).json({erro:"Solicitação ou status inválido."});
  try{const[r]=await db.query("UPDATE solicitacoes_materiais SET status=?,atendido_em=CASE WHEN ? IN ('ENTREGUE','CANCELADO') THEN NOW() ELSE atendido_em END WHERE id=? AND empresa_id=?",[status,status,id,req.auth.empresaId]);if(!r.affectedRows)return res.status(404).json({erro:"Solicitação não encontrada."});res.json({message:"Solicitação atualizada.",id:Number(id),status});}catch(err){handleDbError(res,err,"Não foi possível atualizar a solicitação.")}});

// Materiais e despesas da OS -------------------------------------------------
app.post("/servico/:id/materiais",autenticar,async(req,res)=>{const servicoId=req.params.id,{material_id,quantidade,observacao}=req.body;if(!validarId(servicoId)||!validarId(material_id))return res.status(400).json({erro:"OS e material válidos são obrigatórios."});const qtd=Number(quantidade);if(!Number.isFinite(qtd)||qtd<=0)return res.status(400).json({erro:"Quantidade inválida."});try{const[[servico]]=await db.query("SELECT id,tecnico_id FROM servicos WHERE id=? AND empresa_id=?",[servicoId,req.auth.empresaId]);if(!servico)return res.status(404).json({erro:"OS não encontrada."});if(!(await tecnicoPodeAcessarOS(req,servico)))return res.status(403).json({erro:"Esta OS não pertence ao técnico autenticado."});const[[material]]=await db.query("SELECT id,preco FROM materiais WHERE id=? AND empresa_id=? AND ativo=1",[material_id,req.auth.empresaId]);if(!material)return res.status(404).json({erro:"Material não encontrado ou inativo."});const[r]=await db.query("INSERT INTO servico_materiais (empresa_id,servico_id,material_id,quantidade,preco_unitario,observacao) VALUES (?,?,?,?,?,?)",[req.auth.empresaId,servicoId,material_id,qtd,material.preco,observacao?String(observacao).trim():null]);res.status(201).json({id:r.insertId,message:"Material solicitado com sucesso."})}catch(err){handleDbError(res,err,"Não foi possível registrar a solicitação de material.")}});
app.get("/servico/:id/materiais",autenticar,async(req,res)=>{if(!validarId(req.params.id))return res.status(400).json({erro:"ID inválido."});try{const[[os]]=await db.query("SELECT id,tecnico_id FROM servicos WHERE id=? AND empresa_id=?",[req.params.id,req.auth.empresaId]);if(!os)return res.status(404).json({erro:"OS não encontrada."});if(!(await tecnicoPodeAcessarOS(req,os)))return res.status(403).json({erro:"Esta OS não pertence ao técnico autenticado."});const[rows]=await db.query(`SELECT sm.*,m.nome material_nome,m.unidade FROM servico_materiais sm JOIN materiais m ON m.id=sm.material_id AND m.empresa_id=sm.empresa_id WHERE sm.servico_id=? AND sm.empresa_id=? ORDER BY sm.solicitado_em DESC`,[req.params.id,req.auth.empresaId]);res.json(rows)}catch(err){handleDbError(res,err)}});
app.delete("/servico/materiais/:id",autenticar,exigirPerfil("ADMIN","GESTOR"),async(req,res)=>{if(!validarId(req.params.id))return res.status(400).json({erro:"ID inválido."});try{const[r]=await db.query("DELETE FROM servico_materiais WHERE id=? AND empresa_id=?",[req.params.id,req.auth.empresaId]);if(!r.affectedRows)return res.status(404).json({erro:"Solicitação não encontrada."});res.json({message:"Solicitação removida."})}catch(err){handleDbError(res,err)}});

const TIPOS_DESPESA_VALIDOS=["PEDAGIO","HOSPEDAGEM","MATERIAL","ALIMENTACAO","COMBUSTIVEL","ESTACIONAMENTO","OUTRO"];
app.post("/servico/:id/despesas",autenticar,async(req,res)=>{const servicoId=req.params.id;let {tecnico_id,tipo,valor,descricao,numero_nota,foto_recibo,cobrar_do_cliente}=req.body;if(req.auth.perfil==="TECNICO"){tecnico_id=await colaboradorDoUsuario(req);};const tn=String(tipo||"").trim().toUpperCase();if(!validarId(servicoId)||!validarId(tecnico_id))return res.status(400).json({erro:"OS e técnico válidos são obrigatórios."});if(!TIPOS_DESPESA_VALIDOS.includes(tn))return res.status(400).json({erro:`Tipo de despesa inválido. Use um de: ${TIPOS_DESPESA_VALIDOS.join(", ")}.`});const vn=Number(valor);if(!Number.isFinite(vn)||vn<=0)return res.status(400).json({erro:"Valor inválido."});try{const[[s]]=await db.query("SELECT id,tecnico_id FROM servicos WHERE id=? AND empresa_id=?",[servicoId,req.auth.empresaId]);if(s && !(await tecnicoPodeAcessarOS(req,s)))return res.status(403).json({erro:"Esta OS não pertence ao técnico autenticado."});const[[t]]=await db.query("SELECT id FROM colaboradores WHERE id=? AND empresa_id=?",[tecnico_id,req.auth.empresaId]);if(!s||!t)return res.status(404).json({erro:"OS ou técnico não encontrado."});let foto=null;if(foto_recibo){foto=typeof foto_recibo==="string"&&foto_recibo.startsWith("/uploads/")?foto_recibo:await salvarFotoBase64(foto_recibo,"recibo");if(!foto)return res.status(400).json({erro:"Foto do recibo inválida ou maior que 5 MB."})}const[r]=await db.query("INSERT INTO despesas (empresa_id,servico_id,tecnico_id,tipo,valor,descricao,numero_nota,foto_recibo,cobrar_do_cliente) VALUES (?,?,?,?,?,?,?,?,?)",[req.auth.empresaId,servicoId,tecnico_id,tn,vn,descricao?String(descricao).trim():null,numero_nota?String(numero_nota).trim():null,foto,cobrar_do_cliente===false||cobrar_do_cliente===0?0:1]);res.status(201).json({id:r.insertId,message:"Despesa registrada com sucesso."})}catch(err){handleDbError(res,err,"Não foi possível registrar a despesa.")}});
app.get("/servico/:id/despesas",autenticar,async(req,res)=>{if(!validarId(req.params.id))return res.status(400).json({erro:"ID inválido."});try{const[[os]]=await db.query("SELECT id,tecnico_id FROM servicos WHERE id=? AND empresa_id=?",[req.params.id,req.auth.empresaId]);if(!os)return res.status(404).json({erro:"OS não encontrada."});if(!(await tecnicoPodeAcessarOS(req,os)))return res.status(403).json({erro:"Esta OS não pertence ao técnico autenticado."});const[rows]=await db.query("SELECT * FROM despesas WHERE servico_id=? AND empresa_id=? ORDER BY criado_em DESC",[req.params.id,req.auth.empresaId]);res.json(rows)}catch(err){handleDbError(res,err)}});

// Despesa avulsa: não depende de estar dentro de uma OS aberta — o técnico
// escolhe direto para qual cliente foi o gasto (pedágio, alimentação etc.
// podem acontecer fora do horário de atendimento de uma OS específica).
app.post("/despesas",autenticar,async(req,res)=>{
  let{tecnico_id,cliente_id,tipo,valor,descricao,numero_nota,foto_recibo,cobrar_do_cliente}=req.body;
  if(req.auth.perfil==="TECNICO"){tecnico_id=await colaboradorDoUsuario(req);}
  const tn=String(tipo||"").trim().toUpperCase();
  if(!validarId(tecnico_id)||!validarId(cliente_id))return res.status(400).json({erro:"Técnico e cliente válidos são obrigatórios."});
  if(!TIPOS_DESPESA_VALIDOS.includes(tn))return res.status(400).json({erro:`Tipo de despesa inválido. Use um de: ${TIPOS_DESPESA_VALIDOS.join(", ")}.`});
  const vn=Number(valor);if(!Number.isFinite(vn)||vn<=0)return res.status(400).json({erro:"Valor inválido."});
  try{
    const[[t]]=await db.query("SELECT id,nome FROM colaboradores WHERE id=? AND empresa_id=?",[tecnico_id,req.auth.empresaId]);
    const[[c]]=await db.query("SELECT id,nome FROM clientes WHERE id=? AND empresa_id=?",[cliente_id,req.auth.empresaId]);
    if(!t||!c)return res.status(404).json({erro:"Técnico ou cliente não encontrado."});
    let foto=null;if(foto_recibo){foto=typeof foto_recibo==="string"&&foto_recibo.startsWith("/uploads/")?foto_recibo:await salvarFotoBase64(foto_recibo,"recibo");if(!foto)return res.status(400).json({erro:"Foto do recibo inválida ou maior que 5 MB."})}
    const[r]=await db.query("INSERT INTO despesas (empresa_id,servico_id,cliente_id,tecnico_id,tipo,valor,descricao,numero_nota,foto_recibo,cobrar_do_cliente) VALUES (?,NULL,?,?,?,?,?,?,?,?)",[req.auth.empresaId,cliente_id,tecnico_id,tn,vn,descricao?String(descricao).trim():null,numero_nota?String(numero_nota).trim():null,foto,cobrar_do_cliente===false||cobrar_do_cliente===0?0:1]);
    res.status(201).json({id:r.insertId,message:"Despesa registrada com sucesso."});
    enviarPushParaGestores(req.auth.empresaId,"Nova despesa lançada",`${t.nome} lançou uma despesa de R$ ${vn.toFixed(2)} (${c.nome}).`,{tipo:"despesa"});
  }catch(err){handleDbError(res,err,"Não foi possível registrar a despesa.")}
});
app.get("/despesas",autenticar,async(req,res)=>{
  const c=["d.empresa_id=?"],v=[req.auth.empresaId];
  if(req.auth.perfil==="TECNICO"){const tid=await colaboradorDoUsuario(req);if(!tid)return res.status(403).json({erro:"Usuário técnico não está vinculado a um colaborador."});c.push("d.tecnico_id=?");v.push(tid);}
  else if(req.query.tecnico_id){c.push("d.tecnico_id=?");v.push(req.query.tecnico_id);}
  if(req.query.cliente_id){c.push("d.cliente_id=?");v.push(req.query.cliente_id);}
  try{const[rows]=await db.query(`SELECT d.*,cl.nome cliente_nome,t.nome tecnico_nome FROM despesas d LEFT JOIN clientes cl ON cl.id=d.cliente_id AND cl.empresa_id=d.empresa_id LEFT JOIN colaboradores t ON t.id=d.tecnico_id AND t.empresa_id=d.empresa_id WHERE ${c.join(" AND ")} ORDER BY d.criado_em DESC LIMIT 200`,v);res.json(rows)}catch(err){handleDbError(res,err)}
});

app.get("/gestao/despesas",autenticar,exigirPerfil("ADMIN","GESTOR"),async(req,res)=>{try{const[rows]=await db.query(`SELECT d.*,c.nome cliente_nome,t.nome tecnico_nome FROM despesas d LEFT JOIN clientes c ON c.id=d.cliente_id AND c.empresa_id=d.empresa_id LEFT JOIN colaboradores t ON t.id=d.tecnico_id AND t.empresa_id=d.empresa_id WHERE d.empresa_id=? ORDER BY d.criado_em DESC LIMIT 500`,[req.auth.empresaId]);res.json(rows)}catch(err){handleDbError(res,err)}});
app.delete("/despesas/:id",autenticar,exigirPerfil("ADMIN","GESTOR"),async(req,res)=>{if(!validarId(req.params.id))return res.status(400).json({erro:"ID inválido."});try{const[r]=await db.query("DELETE FROM despesas WHERE id=? AND empresa_id=?",[req.params.id,req.auth.empresaId]);if(!r.affectedRows)return res.status(404).json({erro:"Despesa não encontrada."});res.json({message:"Despesa removida."})}catch(err){handleDbError(res,err)}});
app.post("/servico/:id/cancelar",autenticar,exigirPerfil("ADMIN","GESTOR"),async(req,res)=>{if(!validarId(req.params.id))return res.status(400).json({erro:"ID inválido."});try{const[[os]]=await db.query("SELECT id,tecnico_id FROM servicos WHERE id=? AND empresa_id=?",[req.params.id,req.auth.empresaId]);if(!os)return res.status(404).json({erro:"OS não encontrada."});if(!(await tecnicoPodeAcessarOS(req,os)))return res.status(403).json({erro:"Esta OS não pertence ao técnico autenticado."});const[r]=await db.query("UPDATE servicos SET status='CANCELADA' WHERE id=? AND empresa_id=? AND status NOT IN ('FINALIZADA','CANCELADA')",[req.params.id,req.auth.empresaId]);if(!r.affectedRows)return res.status(409).json({erro:"OS não encontrada ou já encerrada."});await registrarStatus(req.params.id,"CANCELADA");res.json({id:Number(req.params.id),status:"CANCELADA"})}catch(err){handleDbError(res,err,"Não foi possível cancelar a OS.")}});

app.use((_req,res,next)=>{res.status(404).json({erro:"Rota não encontrada."});});
app.use((err,_req,res,_next)=>{console.error("Erro não tratado:",err);res.status(500).json({erro:"Erro interno do servidor."})});

async function iniciar(){try{if(JWT_SECRET.length<32)console.warn("⚠️ JWT_SECRET ausente ou curto. Configure pelo menos 32 caracteres.");await conectarBanco();await inicializarBanco();app.listen(PORT,"0.0.0.0",()=>{console.log(`🚀 Fielduo ${VERSAO} rodando na porta ${PORT}`);console.log(`📁 Fotos locais: ${UPLOAD_DIR}`);console.log(`🔗 Health: http://localhost:${PORT}/health`);if(allowDevNoAuth)console.warn("⚠️ MODO DESENVOLVIMENTO: ALLOW_DEV_NO_AUTH=true. Em produção, use JWT e desative isso.");});}catch(err){console.error("❌ Não foi possível iniciar o servidor.");console.error("   Código:",err.code||"não informado");console.error("   Mensagem:",err.message||"sem mensagem");if(err.sqlMessage)console.error("   MySQL:",err.sqlMessage);process.exit(1)}}

iniciar();
