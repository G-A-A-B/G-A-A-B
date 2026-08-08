"""Testes de fumaça dos cenários de teste de mesa.

Garantem que cada cenário roda de ponta a ponta sem quebrar invariantes
(o motor levanta ViolacaoDeInvariante se algo sair do modelo) e que produz o
histórico esperado.
"""

from __future__ import annotations

import cenarios.variacoes as v
from cenarios.cenario_base import executar as cenario_base


def test_cenario_base_roda_e_registra_historico():
    motor = cenario_base()
    eventos = [m.evento for m in motor.historico]
    assert eventos[0] == "INICIAL"
    assert eventos.count("RESERVA") == 3
    assert eventos.count("EFETIVACAO") == 1
    assert motor.reservas["Loja"] == 30


def test_cancelamento_devolve_ao_disponivel():
    motor = v.cenario_cancelamento()
    # Após cancelar 20 e efetivar 30, físico caiu só pelas efetivações.
    assert motor.fisico == 70
    assert motor.reservas["Site"] == 0
    assert any(m.evento == "CANCELAMENTO" for m in motor.historico)


def test_disputa_nunca_ultrapassa_o_fisico():
    motor = v.cenario_disputa_ultima_unidade()
    assert motor.reservas_totais <= motor.fisico
    # Reservas recusadas não entram no histórico.
    assert all(m.evento != "INICIAL" or m.seq == 0 for m in motor.historico)


def test_protecao_residual_permite_site_chegar_a_70():
    motor = v.cenario_protecao_residual()
    # Depois que a Loja reservou 25, o Site conseguiu reservar 70.
    assert motor.reservas["Site"] == 70
    assert motor.reservas["Loja"] == 30  # a Loja ainda alcançou sua proteção


def test_restricao_reabre_apos_efetivar_e_cancelar():
    motor = v.cenario_restricao_reabre()
    # Estado final: nada reservado no Marketplace, teto totalmente reaberto.
    assert motor.reservas["Marketplace"] == 0
    assert motor.atp("Marketplace") == 20


def test_saturacao_no_limite_reivindica_todo_o_fisico():
    motor = v.cenario_saturacao_no_limite()
    assert motor.disponivel == 0
    assert motor.reservas["A"] == 60
    assert motor.reservas["B"] == 40


def test_ruptura_e_config_invalida_nao_levantam():
    # Ambos apenas imprimem; não devem propagar exceção.
    v.cenario_ruptura_sem_protecao()
    v.cenario_config_invalida()


def test_fair_share_rateia_e_honra_ambos():
    motor = v.cenario_fair_share()
    assert motor.fair_share is True
    assert motor.protecao_efetiva("A") == 50
    assert motor.protecao_efetiva("B") == 50
    assert motor.disponivel == 0


def test_restricao_acumulada_reabre_no_reinicio():
    motor = v.cenario_restricao_acumulada()
    # Após o reinício de período, a cota volta ao teto cheio.
    assert motor.vendas_periodo["Marketplace"] == 0
    assert motor.atp("Marketplace") == 20
    assert motor.historico[-1].evento == "REINICIO_PERIODO"


def test_piso_e_teto_limita_no_teto():
    motor = v.cenario_piso_e_teto()
    # A Loja parou no teto de 50 (ultrapassando o piso 20, que é soft).
    assert motor.reservas["Loja"] == 50
    assert motor.atp("Loja") == 0


def test_fair_share_tres_canais_rateia_60_30_30():
    motor = v.cenario_fair_share_tres()
    assert motor.protecao_efetiva("A") == 30
    assert motor.protecao_efetiva("B") == 15
    assert motor.protecao_efetiva("C") == 15
    assert motor.disponivel == 0


def test_cota_liberada_por_cancelamento():
    motor = v.cenario_cota_liberada_cancel()
    # Vendeu 12 no período; cota restante = 8 (as canceladas voltaram, as
    # vendidas não).
    assert motor.vendas_periodo["Marketplace"] == 12
    assert motor.atp("Marketplace") == 8


def test_dia_completo_fecha_e_reabre_cota():
    motor = v.cenario_dia_completo()
    assert motor.fisico == 5                       # 100 − 95 vendas no dia
    assert motor.vendas_periodo["Marketplace"] == 0  # reinício zerou o período
    assert motor.historico[-1].evento == "REINICIO_PERIODO"


def test_main_roda_todos_os_cenarios(capsys):
    v.main()
    saida = capsys.readouterr().out
    assert "Todos os cenários executados" in saida
