// Tipos compartilhados entre os hooks e componentes da tela de Ordem de
// Serviço. Ficam soltos (sem "any") só onde já dava pra nomear com clareza;
// o resto continua "any" como estava no arquivo original, pra não mudar
// comportamento numa etapa que é só de organização.

export type Tecnico = { id: number; nome: string };
export type Cliente = { id: number; nome: string; bairro?: string };
export type Gestor = { id: number; nome: string };
export type Material = { id: number; nome: string; unidade: string };

export type MaterialSolicitado = {
  id: number | string;
  material_nome: string;
  unidade: string;
  quantidade: number;
  pendente?: boolean;
};

export type Despesa = {
  id: number | string;
  tipo: string;
  valor: number;
  descricao?: string | null;
  numero_nota?: string | null;
  foto_recibo?: string | null;
  cobrar_do_cliente?: boolean;
  pendente?: boolean;
};

export type Horarios = {
  inicio_data?: string | null;
  almoco_inicio_data?: string | null;
  almoco_fim_data?: string | null;
  fim_data?: string | null;
};

export type AbaOS = "servico" | "materiais" | "despesas";
