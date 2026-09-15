import React, { createContext, useContext, useEffect, useState } from "react";

import {
  AuthData,
  buscarUsuarioAtual,
  carregarAuthSalvo,
  limparAuthSalvo,
  login as loginApi,
} from "@/lib/auth";
import { registrarPushToken } from "@/lib/pushNotifications";

type AuthContextValue = {
  auth: AuthData | null;
  carregandoSessao: boolean;
  entrando: boolean;
  entrar: (email: string, senha: string) => Promise<void>;
  sair: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthData | null>(null);
  const [carregandoSessao, setCarregandoSessao] = useState(true);
  const [entrando, setEntrando] = useState(false);

  useEffect(() => {
    (async () => {
      const salvo = await carregarAuthSalvo();
      if (salvo) {
        // Confirma com o servidor que o token ainda vale e atualiza os
        // dados do usuário (perfil/empresa podem ter mudado desde o login).
        const usuarioAtual = await buscarUsuarioAtual(salvo.token);
        if (usuarioAtual) {
          setAuth({ token: salvo.token, usuario: usuarioAtual });
          registrarPushToken();
        } else {
          await limparAuthSalvo();
        }
      }
      setCarregandoSessao(false);
    })();
  }, []);

  async function entrar(email: string, senha: string) {
    setEntrando(true);
    try {
      const dados = await loginApi(email, senha);
      setAuth(dados);
      registrarPushToken();
    } finally {
      setEntrando(false);
    }
  }

  async function sair() {
    await limparAuthSalvo();
    setAuth(null);
  }

  return (
    <AuthContext.Provider value={{ auth, carregandoSessao, entrando, entrar, sair }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext precisa estar dentro de <AuthProvider>.");
  return ctx;
}
