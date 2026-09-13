-- Fielduo V2.1 - schema completo
CREATE DATABASE IF NOT EXISTS fielduo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE fielduo;

CREATE TABLE IF NOT EXISTS empresas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(180) NOT NULL,
  documento VARCHAR(40) NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO empresas (nome) SELECT 'Empresa principal' WHERE NOT EXISTS (SELECT 1 FROM empresas LIMIT 1);

CREATE TABLE IF NOT EXISTS usuarios (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS colaboradores (id INT AUTO_INCREMENT PRIMARY KEY, empresa_id INT NOT NULL, nome VARCHAR(150) NOT NULL, INDEX idx_colaboradores_empresa (empresa_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS clientes (id INT AUTO_INCREMENT PRIMARY KEY, empresa_id INT NOT NULL, nome VARCHAR(180) NOT NULL, rua VARCHAR(255), bairro VARCHAR(150), cidade VARCHAR(150), telefone VARCHAR(40), INDEX idx_clientes_empresa (empresa_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS gestores (id INT AUTO_INCREMENT PRIMARY KEY, empresa_id INT NOT NULL, nome VARCHAR(150) NOT NULL, INDEX idx_gestores_empresa (empresa_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS pontos (id INT AUTO_INCREMENT PRIMARY KEY, empresa_id INT NOT NULL, tecnico_id INT NOT NULL, os_id INT NULL, latitude DOUBLE NOT NULL, longitude DOUBLE NOT NULL, dataHora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX idx_pontos_empresa_tecnico_data (empresa_id,tecnico_id,dataHora)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS servicos (id INT AUTO_INCREMENT PRIMARY KEY, empresa_id INT NOT NULL, tecnico_id INT NOT NULL, cliente_id INT NOT NULL, gestor_id INT NOT NULL, relatorio TEXT, foto_conclusao LONGTEXT, cliente_nome_completo VARCHAR(180), cliente_assinatura LONGTEXT, status VARCHAR(40) NOT NULL DEFAULT 'ATRIBUIDA', criada_data DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, aceita_data DATETIME NULL, deslocamento_data DATETIME NULL, chegada_data DATETIME NULL, inicio_data DATETIME NULL, almoco_inicio_data DATETIME NULL, almoco_fim_data DATETIME NULL, fim_data DATETIME NULL, INDEX idx_servicos_empresa_status_data (empresa_id,status,fim_data), INDEX idx_servicos_empresa_tecnico (empresa_id,tecnico_id), INDEX idx_servicos_empresa_cliente (empresa_id,cliente_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS servico_status_historico (id INT AUTO_INCREMENT PRIMARY KEY, empresa_id INT NOT NULL, servico_id INT NOT NULL, status VARCHAR(40) NOT NULL, dataHora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX idx_historico_empresa_servico_data (empresa_id,servico_id,dataHora)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS materiais (id INT AUTO_INCREMENT PRIMARY KEY, empresa_id INT NOT NULL, nome VARCHAR(180) NOT NULL, unidade VARCHAR(20) NOT NULL DEFAULT 'un', preco DECIMAL(10,2) NOT NULL DEFAULT 0, estoque DECIMAL(10,2) NULL, ativo TINYINT(1) NOT NULL DEFAULT 1, INDEX idx_materiais_empresa (empresa_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS servico_materiais (id INT AUTO_INCREMENT PRIMARY KEY, empresa_id INT NOT NULL, servico_id INT NOT NULL, material_id INT NOT NULL, quantidade DECIMAL(10,2) NOT NULL, preco_unitario DECIMAL(10,2) NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'SOLICITADO', observacao VARCHAR(255) NULL, solicitado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX idx_servico_materiais_empresa_servico (empresa_id,servico_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS despesas (id INT AUTO_INCREMENT PRIMARY KEY, empresa_id INT NOT NULL, servico_id INT NOT NULL, tecnico_id INT NOT NULL, tipo VARCHAR(30) NOT NULL, valor DECIMAL(10,2) NOT NULL, descricao VARCHAR(255) NULL, numero_nota VARCHAR(100) NULL, foto_recibo VARCHAR(255) NULL, cobrar_do_cliente TINYINT(1) NOT NULL DEFAULT 1, criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX idx_despesas_empresa_servico (empresa_id,servico_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
