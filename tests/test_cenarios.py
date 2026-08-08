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


def test_main_roda_todos_os_cenarios(capsys):
    v.main()
    saida = capsys.readouterr().out
    assert "Todos os cenários executados" in saida
