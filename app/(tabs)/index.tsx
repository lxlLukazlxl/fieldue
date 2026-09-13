import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";

import { useSincronizacaoOffline } from "@/lib/offlineQueue";
import { Cliente, Gestor, Tecnico } from "@/lib/osTypes";

import { useAuthContext } from "@/hooks/useAuth";
import { useCadastros } from "@/hooks/useCadastros";
import { useDespesasOS } from "@/hooks/useDespesasOS";
import { useLocationTracking } from "@/hooks/useLocationTracking";
import { useMateriaisOS } from "@/hooks/useMateriaisOS";
import { useMinhasOS } from "@/hooks/useMinhasOS";
import { useOrdemServico } from "@/hooks/useOrdemServico";

import { AbaDespesas } from "@/components/os/AbaDespesas";
import { AbaMateriais } from "@/components/os/AbaMateriais";
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

  const [modalTecnico, setModalTecnico] = useState(false);
  const [modalCliente, setModalCliente] = useState(false);
  const [modalGestor, setModalGestor] = useState(false);
  const [modalAssinatura, setModalAssinatura] = useState(false);

  const signatureRef = useRef<any>(null);

  const cadastros = useCadastros();
  const { minhasOS, carregandoMinhasOS, buscarMinhasOS } = useMinhasOS(tecnicoSel?.id);
  const osAtual = useOrdemServico();
  const materiaisOS = useMateriaisOS();
  const despesasOS = useDespesasOS();
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
    const id = osAtual.abrirOS(os);
    materiaisOS.buscarMateriaisSolicitados(id);
    despesasOS.buscarDespesas(id);
  }

  function handleCriarOS() {
    osAtual.criarOS({ tecnicoSel, clienteSel, gestorSel }, () => {
      materiaisOS.resetMateriaisSolicitados();
      despesasOS.resetDespesas();
    });
  }

  function handleMudarAba(aba: "servico" | "materiais" | "despesas") {
    osAtual.setAbaOS(aba);
    if (aba === "materiais" && osAtual.osId) materiaisOS.buscarMateriaisSolicitados(osAtual.osId);
    if (aba === "despesas" && osAtual.osId) despesasOS.buscarDespesas(osAtual.osId);
  }

  function handleFinalizar() {
    osAtual.finalizar({ tecnicoSel, clienteSel, gestorSel }, () => {
      if (podeCriarOS) {
        setClienteSel(null);
        setGestorSel(null);
      }
      materiaisOS.resetMateriaisSolicitados();
      despesasOS.resetDespesas();
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
          onAbrirTecnico={() => setModalTecnico(true)}
          onAbrirCliente={() => setModalCliente(true)}
          onAbrirGestor={() => setModalGestor(true)}
          criandoOS={osAtual.criandoOS}
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
            abaOS={osAtual.abaOS}
            onMudarAba={handleMudarAba}
          />

          {osAtual.abaOS === "servico" && (
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
              podeFinalizar={osAtual.statusOS === "EM_ATENDIMENTO"}
              onFinalizar={handleFinalizar}
            />
          )}

          {osAtual.abaOS === "materiais" && (
            <AbaMateriais
              materialSel={materiaisOS.materialSel}
              onAbrirModalMaterial={() => materiaisOS.setModalMaterial(true)}
              quantidadeMaterial={materiaisOS.quantidadeMaterial}
              onMudarQuantidade={materiaisOS.setQuantidadeMaterial}
              enviandoMaterial={materiaisOS.enviandoMaterial}
              onSolicitarMaterial={() => materiaisOS.solicitarMaterial(osAtual.osId)}
              materiaisSolicitados={materiaisOS.materiaisSolicitados}
            />
          )}

          {osAtual.abaOS === "despesas" && (
            <AbaDespesas
              tipoDespesa={despesasOS.tipoDespesa}
              onMudarTipo={despesasOS.setTipoDespesa}
              valorDespesa={despesasOS.valorDespesa}
              onMudarValor={despesasOS.setValorDespesa}
              descricaoDespesa={despesasOS.descricaoDespesa}
              onMudarDescricao={despesasOS.setDescricaoDespesa}
              numeroNota={despesasOS.numeroNota}
              onMudarNumeroNota={despesasOS.setNumeroNota}
              fotoRecibo={despesasOS.fotoRecibo}
              onSelecionarFotoRecibo={despesasOS.selecionarFotoRecibo}
              cobrarDoCliente={despesasOS.cobrarDoCliente}
              onAlternarCobrarDoCliente={() => despesasOS.setCobrarDoCliente((v) => !v)}
              enviandoDespesa={despesasOS.enviandoDespesa}
              onLancarDespesa={() => despesasOS.lancarDespesa(osAtual.osId, tecnicoSel?.id)}
              despesas={despesasOS.despesas}
            />
          )}

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
        </>
      )}

      <SelectionModal
        visible={materiaisOS.modalMaterial}
        title="Materiais"
        items={cadastros.materiais}
        emptyMessage="Nenhum material cadastrado. Peça ao gestor para cadastrar no painel web."
        keyExtractor={(m) => m.id}
        renderLabel={(m) => (
          <>
            {m.nome} <Text style={{ color: "#8a94a6" }}>({m.unidade})</Text>
          </>
        )}
        onSelect={(m) => { materiaisOS.setMaterialSel(m); materiaisOS.setModalMaterial(false); }}
        onClose={() => materiaisOS.setModalMaterial(false)}
      />

      <AssinaturaModal
        visible={modalAssinatura}
        signatureRef={signatureRef}
        onOK={(s) => { osAtual.setAssinaturaBase64(s); setModalAssinatura(false); }}
        onCancel={() => setModalAssinatura(false)}
      />
    </ScrollView>
  );
}
