import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";

import { useSincronizacaoOffline } from "@/lib/offlineQueue";
import { Cliente, Gestor, Tecnico, Veiculo } from "@/lib/osTypes";

import { useAuthContext } from "@/hooks/useAuth";
import { useCadastros } from "@/hooks/useCadastros";
import { useLocationTracking } from "@/hooks/useLocationTracking";
import { useMinhasOS } from "@/hooks/useMinhasOS";
import { useOrdemServico } from "@/hooks/useOrdemServico";

import { AbaServico } from "@/components/os/AbaServico";
import { AssinaturaModal } from "@/components/os/AssinaturaModal";
import { NovaOSCard } from "@/components/os/NovaOSCard";
import { OfflineBanner } from "@/components/os/OfflineBanner";
import { SelectionModal } from "@/components/os/SelectionModal";
import { COLORS, styles } from "@/components/os/styles";
import { StatusCard } from "@/components/os/StatusCard";
import { TopBar } from "@/components/os/TopBar";

export default function HomeScreen() {
  const { auth, sair } = useAuthContext();
  const usuario = auth?.usuario;
  // Todos os perfis autenticados podem abrir uma OS. Para o técnico, o
  // backend força o próprio colaborador como técnico da OS.
  const podeCriarOS = Boolean(usuario);

  // Seleção do formulário da etapa 1. Para um técnico logado, é preenchida
  // sozinha com os próprios dados (ver useEffect abaixo); para ADMIN/GESTOR,
  // continua sendo escolhida manualmente nos seletores.
  const [tecnicoSel, setTecnicoSel] = useState<Tecnico | null>(null);
  const [clienteSel, setClienteSel] = useState<Cliente | null>(null);
  const [gestorSel, setGestorSel] = useState<Gestor | null>(null);
  const [veiculoSel, setVeiculoSel] = useState<Veiculo | null>(null);

  const [modalTecnico, setModalTecnico] = useState(false);
  const [modalCliente, setModalCliente] = useState(false);
  const [modalGestor, setModalGestor] = useState(false);
  const [modalVeiculo, setModalVeiculo] = useState(false);
  const [modalAssinatura, setModalAssinatura] = useState(false);

  const signatureRef = useRef<any>(null);

  const cadastros = useCadastros();
  const { minhasOS, carregandoMinhasOS, buscarMinhasOS } = useMinhasOS(tecnicoSel?.id);
  const osAtual = useOrdemServico();
  const { online, pendentes, sincronizando, sincronizarAgora } = useSincronizacaoOffline();

  useLocationTracking(tecnicoSel?.id, osAtual.osId, osAtual.statusOS);

  // Técnico logado: usa o próprio usuário como "técnico" da OS, sem precisar
  // escolher numa lista.
  useEffect(() => {
    if (usuario?.perfil === "TECNICO" && usuario.colaborador_id) {
      setTecnicoSel({ id: usuario.colaborador_id, nome: usuario.nome });
    }
  }, [usuario?.perfil, usuario?.colaborador_id, usuario?.nome]);

  function handleSair() {
    Alert.alert("Sair", "Deseja realmente sair da sua conta?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Sair", style: "destructive", onPress: sair },
    ]);
  }

  function handleRetomarOS(os: any) {
    osAtual.abrirOS(os);
    // Essencial: sem isso, clienteSel/gestorSel/tecnicoSel ficavam nulos ao
    // reabrir uma OS já existente (só eram preenchidos ao CRIAR uma OS
    // nova), e finalizar() quebrava tentando ler .id de null.
    if (os.cliente_id) setClienteSel({ id: os.cliente_id, nome: os.cliente_nome });
    if (os.gestor_id) setGestorSel({ id: os.gestor_id, nome: os.gestor_nome });
    if (os.tecnico_id && !tecnicoSel) setTecnicoSel({ id: os.tecnico_id, nome: os.tecnico_nome || "" });
    setVeiculoSel(os.veiculo_id ? { id: os.veiculo_id, nome: os.veiculo_nome, placa: os.veiculo_placa } : null);
  }

  function handleCriarOS() {
    osAtual.criarOS({ tecnicoSel, clienteSel, gestorSel, veiculoSel });
  }

  function handleFinalizar() {
    osAtual.finalizar({ tecnicoSel, clienteSel, gestorSel }, () => {
      if (podeCriarOS) {
        setClienteSel(null);
        setGestorSel(null);
        setVeiculoSel(null);
      }
      if (tecnicoSel) buscarMinhasOS(tecnicoSel.id);
    });
  }

  // Técnico logado mas sem vínculo com um colaborador cadastrado: não dá
  // pra trabalhar em nenhuma OS até o gestor arrumar esse cadastro.
  if (usuario?.perfil === "TECNICO" && !usuario.colaborador_id) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <TopBar
          online={online}
          carregandoDados={cadastros.carregandoDados}
          onSincronizar={() => cadastros.carregarDados(true)}
          nomeUsuario={usuario.nome}
          onSair={handleSair}
        />
        <View style={styles.card}>
          <Feather name="alert-triangle" size={22} color={COLORS.warning} style={{ alignSelf: "center", marginBottom: 10 }} />
          <Text style={[styles.title, { marginBottom: 6 }]}>Conta sem técnico vinculado</Text>
          <Text style={{ textAlign: "center", color: COLORS.muted, fontSize: 13.5 }}>
            Sua conta ainda não está associada a um cadastro de técnico. Peça ao gestor para
            vincular seu usuário a um colaborador no painel de gestão.
          </Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <TopBar
        online={online}
        carregandoDados={cadastros.carregandoDados}
        onSincronizar={() => cadastros.carregarDados(true)}
        nomeUsuario={usuario?.nome}
        onSair={handleSair}
      />

      <OfflineBanner
        online={online}
        pendentes={pendentes}
        sincronizando={sincronizando}
        onSincronizar={sincronizarAgora}
      />

      {osAtual.etapa === 1 ? (
        <NovaOSCard
          podeCriarOS={podeCriarOS}
          tecnicoSel={tecnicoSel}
          clienteSel={clienteSel}
          gestorSel={gestorSel}
          veiculoSel={veiculoSel}
          onAbrirTecnico={() => setModalTecnico(true)}
          onAbrirCliente={() => setModalCliente(true)}
          onAbrirGestor={() => setModalGestor(true)}
          onAbrirVeiculo={() => setModalVeiculo(true)}
          criandoOS={osAtual.criandoOS}
          mensagemEnvio={osAtual.mensagemEnvio}
          onCriarOS={handleCriarOS}
          minhasOS={minhasOS}
          carregandoMinhasOS={carregandoMinhasOS}
          onRetomarOS={handleRetomarOS}
        />
      ) : (
        <View style={styles.card}>
          <StatusCard
            osId={osAtual.osId}
            statusOS={osAtual.statusOS}
            horarios={osAtual.horarios}
            carregandoAlmoco={osAtual.carregandoAlmoco}
            onMudarStatus={osAtual.mudarStatus}
            onIniciarAlmoco={osAtual.iniciarAlmoco}
            onFinalizarAlmoco={osAtual.finalizarAlmoco}
          />

          <AbaServico
            fotos={osAtual.fotos}
            onSelecionarFotos={osAtual.selecionarFotos}
            onRemoverFoto={osAtual.removerFoto}
            relatorio={osAtual.relatorio}
            onMudarRelatorio={osAtual.setRelatorio}
            nomeClienteFinal={osAtual.nomeClienteFinal}
            onMudarNomeClienteFinal={osAtual.setNomeClienteFinal}
            assinaturaBase64={osAtual.assinaturaBase64}
            onAbrirAssinatura={() => setModalAssinatura(true)}
            carregando={osAtual.carregando}
            mensagemEnvio={osAtual.mensagemEnvio}
            podeFinalizar={osAtual.statusOS === "EM_ATENDIMENTO"}
            onFinalizar={handleFinalizar}
          />

          <TouchableOpacity
            onPress={() => osAtual.setEtapa(1)}
            style={{ marginTop: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            <Feather name="arrow-left" size={14} color={COLORS.danger} />
            <Text style={{ textAlign: "center", color: COLORS.danger, fontWeight: "700", fontSize: 13 }}>
              Voltar para Etapa 1
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {podeCriarOS && (
        <>
          {usuario?.perfil !== "TECNICO" && (
          <SelectionModal
            visible={modalTecnico}
            title="Técnicos"
            items={cadastros.tecnicos}
            emptyMessage="Nenhum técnico cadastrado."
            keyExtractor={(t) => t.id}
            renderLabel={(t) => t.nome}
            onSelect={(t) => { setTecnicoSel(t); setModalTecnico(false); }}
            onClose={() => setModalTecnico(false)}
          />
          )}

          <SelectionModal
            visible={modalCliente}
            title="Clientes"
            items={cadastros.clientes}
            emptyMessage="Nenhum cliente cadastrado."
            keyExtractor={(c) => c.id}
            renderLabel={(c) => `${c.nome} (${c.bairro})`}
            onSelect={(c) => { setClienteSel(c); setModalCliente(false); }}
            onClose={() => setModalCliente(false)}
          />

          <SelectionModal
            visible={modalGestor}
            title="Gestores"
            items={cadastros.gestores}
            emptyMessage="Nenhum gestor cadastrado."
            keyExtractor={(g) => g.id}
            renderLabel={(g) => g.nome}
            onSelect={(g) => { setGestorSel(g); setModalGestor(false); }}
            onClose={() => setModalGestor(false)}
          />

          <SelectionModal
            visible={modalVeiculo}
            title="Veículos"
            items={cadastros.veiculos}
            emptyMessage="Nenhum veículo cadastrado. Peça ao gestor para cadastrar no painel web."
            keyExtractor={(v) => v.id}
            renderLabel={(v) => v.placa ? `${v.nome} (${v.placa})` : v.nome}
            onSelect={(v) => { setVeiculoSel(v); setModalVeiculo(false); }}
            onClose={() => setModalVeiculo(false)}
          />
        </>
      )}

      <AssinaturaModal
        visible={modalAssinatura}
        signatureRef={signatureRef}
        onOK={(s) => { osAtual.setAssinaturaBase64(s); setModalAssinatura(false); }}
        onCancel={() => setModalAssinatura(false)}
      />
    </ScrollView>
  );
}
