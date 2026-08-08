"""Testes do motor de ATP multicanal."""

from __future__ import annotations

import pytest

from estoque_atp import (
    Canal,
    ErroDeEfetivacao,
    ErroDeReserva,
    MotorATP,
)


def motor_padrao() -> MotorATP:
    """Físico 100; Loja protege 30; Marketplace restringe 20; Site livre."""
    return MotorATP(
        fisico=100,
        canais=[
            Canal("Loja", protecao=30),
            Canal("Site"),
            Canal("Marketplace", restricao=20),
        ],
    )


# --------------------------------------------------------------------------- #
# ATP inicial
# --------------------------------------------------------------------------- #
def test_atp_inicial_reflete_protecao_e_restricao():
    m = motor_padrao()
    assert m.disponivel == 100
    assert m.atp("Loja") == 100          # dono da proteção não é limitado por ela
    assert m.atp("Site") == 70           # 100 − 30 (proteção da Loja)
    assert m.atp("Marketplace") == 20    # min(70, teto 20) → 20


# --------------------------------------------------------------------------- #
# Restrição instantânea
# --------------------------------------------------------------------------- #
def test_restricao_limita_reservas_simultaneas_do_canal():
    m = motor_padrao()
    m.reservar("Marketplace", 15)
    # teto 20 − 15 reservados = 5
    assert m.atp("Marketplace") == 5


def test_restricao_recusa_reserva_acima_do_teto():
    m = motor_padrao()
    with pytest.raises(ErroDeReserva):
        m.reservar("Marketplace", 21)


def test_restricao_reabre_ao_efetivar():
    m = motor_padrao()
    m.reservar("Marketplace", 20)         # teto cheio
    assert m.atp("Marketplace") == 0
    m.efetivar("Marketplace", 20)         # vendas saem do físico, reservas zeram
    assert m.fisico == 80
    assert m.atp("Marketplace") == 20     # teto instantâneo reabriu


# --------------------------------------------------------------------------- #
# Proteção
# --------------------------------------------------------------------------- #
def test_protecao_blinda_estoque_dos_outros_canais():
    m = motor_padrao()
    # Site tenta consumir tudo: só alcança 70, as 30 da Loja ficam blindadas.
    assert m.atp("Site") == 70
    m.reservar("Site", 70)
    assert m.atp("Site") == 0
    assert m.atp("Loja") == 30            # proteção preservada mesmo com Site "esgotando"


def test_protecao_usa_residual_e_nao_bloqueia_em_dobro():
    m = motor_padrao()
    # Loja consome 25 da própria proteção: residual = 5.
    m.reservar("Loja", 25)
    # Site vê 100 − 25 (reservas) − 5 (residual da Loja) = 70.
    # (Sem residual, veria 100 − 25 − 30 = 45: estoque bloqueado em dobro.)
    assert m.atp("Site") == 70
    # E o residual continua garantindo à Loja alcançar sua proteção (30):
    # 25 já reservados + ao menos 5 ainda reserváveis.
    assert m.reservas["Loja"] + m.atp("Loja") >= 30


def test_protecao_soft_nao_impede_dono_de_ultrapassar():
    m = motor_padrao()
    # A proteção é piso, não teto: a Loja pode reservar além das 30.
    m.reservar("Loja", 50)
    assert m.reservas["Loja"] == 50


# --------------------------------------------------------------------------- #
# Ciclo de reserva / efetivação / cancelamento
# --------------------------------------------------------------------------- #
def test_efetivacao_mantem_disponivel_consistente():
    m = motor_padrao()
    m.reservar("Site", 40)
    disp_antes = m.disponivel
    m.efetivar("Site", 40)
    # libera reserva (+40) e baixa físico (−40): efeito líquido zero.
    assert m.disponivel == disp_antes
    assert m.fisico == 60
    assert m.reservas["Site"] == 0


def test_cancelamento_devolve_ao_disponivel_sem_mexer_no_fisico():
    m = motor_padrao()
    m.reservar("Site", 40)
    m.cancelar("Site", 40)
    assert m.fisico == 100
    assert m.reservas["Site"] == 0
    assert m.disponivel == 100


def test_efetivar_alem_da_reserva_falha():
    m = motor_padrao()
    m.reservar("Site", 10)
    with pytest.raises(ErroDeEfetivacao):
        m.efetivar("Site", 11)


# --------------------------------------------------------------------------- #
# Invariante de não-oversell
# --------------------------------------------------------------------------- #
def test_nao_oversell_soma_das_reservas_nunca_excede_fisico():
    m = motor_padrao()
    # Consome todo o estoque distribuído entre canais respeitando políticas.
    m.reservar("Marketplace", 20)
    m.reservar("Site", 50)
    m.reservar("Loja", 30)
    assert m.reservas_totais == 100
    assert m.disponivel == 0
    # Qualquer reserva adicional é recusada.
    with pytest.raises(ErroDeReserva):
        m.reservar("Site", 1)


def test_disputa_pela_ultima_unidade_apenas_um_ganha():
    m = MotorATP(fisico=1, canais=[Canal("A"), Canal("B")])
    m.reservar("A", 1)
    assert m.atp("B") == 0
    with pytest.raises(ErroDeReserva):
        m.reservar("B", 1)


# --------------------------------------------------------------------------- #
# Proteção sobre-comprometida (soma das proteções > físico)
# --------------------------------------------------------------------------- #
def test_protecao_sobrecomprometida_nao_gera_atp_negativo():
    # Proteções somam 120 > físico 100. ATP deve saturar em 0, nunca negativo.
    m = MotorATP(
        fisico=100,
        canais=[
            Canal("A", protecao=60),
            Canal("B", protecao=60),
            Canal("C"),
        ],
    )
    assert m.atp("C") == 0                 # 100 − (60 + 60) saturado em 0
    assert m.atp("A") >= 0
    assert m.atp("B") >= 0


# --------------------------------------------------------------------------- #
# Cenário base completo (mesmo do teste de mesa executável)
# --------------------------------------------------------------------------- #
def test_cenario_base_passo_a_passo():
    m = motor_padrao()

    # T0
    assert m.snapshot() == {"Loja": 100, "Site": 70, "Marketplace": 20}

    # T1 — Marketplace reserva 15
    m.reservar("Marketplace", 15)
    assert m.snapshot() == {"Loja": 85, "Site": 55, "Marketplace": 5}

    # T2 — Site reserva 40
    m.reservar("Site", 40)
    assert m.snapshot() == {"Loja": 45, "Site": 15, "Marketplace": 5}

    # T3 — Marketplace efetiva 15
    m.efetivar("Marketplace", 15)
    assert m.fisico == 85
    assert m.snapshot() == {"Loja": 45, "Site": 15, "Marketplace": 15}

    # T4 — Loja reserva 30 (sua proteção)
    m.reservar("Loja", 30)
    assert m.reservas["Loja"] == 30
