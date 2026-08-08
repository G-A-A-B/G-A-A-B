"""Variações do teste de mesa — cada cenário isola um comportamento do modelo.

Rode todos com:      python -m cenarios.variacoes
Rode só o base com:  python -m cenarios.cenario_base

Cenários:
  1. cancelamento          — cancelar devolve ao disponível sem mexer no físico
  2. disputa_ultima_unidade— não-oversell: só um canal leva a última unidade
  3. ruptura_sem_protecao  — o "porquê" da proteção (com vs. sem)
  4. protecao_residual     — residual não bloqueia estoque em dobro
  5. restricao_reabre      — o teto instantâneo reabre ao efetivar/cancelar
  6. saturacao_no_limite   — duas proteções somando exatamente o físico
  7. config_invalida       — proteções sobre-comprometidas são recusadas
  8. fair_share            — sobre-comprometido rateado proporcionalmente
"""

from __future__ import annotations

from cenarios._apresentacao import evento, finalizar, tentar_reservar, titulo
from cenarios.cenario_base import executar as cenario_base
from estoque_atp import Canal, ConfiguracaoInvalida, MotorATP


def cenario_cancelamento() -> MotorATP:
    """Cancelar devolve ao disponível (físico intacto); efetivar baixa o físico."""
    motor = MotorATP(
        fisico=100,
        canais=[Canal("Loja", protecao=30), Canal("Site"), Canal("Marketplace", restricao=20)],
    )
    titulo("1) CANCELAMENTO — reserva → cancela (físico intacto) → efetiva")

    evento(motor, "T0  Estado inicial")
    motor.reservar("Site", 50, "T1 Site reserva 50")
    evento(motor, "T1  Site reserva 50  (disponível cai para 50)")
    motor.cancelar("Site", 20, "T2 Site cancela 20")
    evento(motor, "T2  Site cancela 20  (volta ao disponível; físico segue 100)")
    motor.efetivar("Site", 30, "T3 Site efetiva 30")
    evento(motor, "T3  Site efetiva 30  (agora sim o físico baixa para 70)")

    finalizar(motor, "cenario_cancelamento.xlsx")
    return motor


def cenario_disputa_ultima_unidade() -> MotorATP:
    """Não-oversell: reservas concorrentes nunca ultrapassam o físico."""
    motor = MotorATP(fisico=10, canais=[Canal("A"), Canal("B"), Canal("C")])
    titulo("2) DISPUTA PELA ÚLTIMA UNIDADE — não-oversell (físico=10)")

    evento(motor, "T0  Estado inicial (10 unidades, 3 canais livres)")
    motor.reservar("A", 10, "T1 A reserva 10")
    evento(motor, "T1  A reserva 10  (esgota o disponível)")
    tentar_reservar(motor, "B", 1, "T2  B tenta reservar 1  (não há disponível)")
    motor.cancelar("A", 4, "T3 A cancela 4")
    evento(motor, "T3  A cancela 4  (devolve 4 ao disponível)")
    motor.reservar("C", 4, "T4 C reserva 4")
    evento(motor, "T4  C reserva 4  (leva o que A devolveu)")
    tentar_reservar(motor, "A", 1, "T5  A tenta reservar 1  (disponível zerado de novo)")

    finalizar(motor, "cenario_disputa_ultima_unidade.xlsx")
    return motor


def cenario_ruptura_sem_protecao() -> None:
    """Contraste: SEM proteção o canal secundário rompe; COM proteção, não."""
    titulo("3) POR QUE PROTEGER — VIP sem vs. com proteção (físico=50)")

    print(">>> SEM proteção: Massa consome tudo e o VIP fica sem estoque")
    sem = MotorATP(fisico=50, canais=[Canal("VIP"), Canal("Massa")])
    evento(sem, "T0  Estado inicial")
    sem.reservar("Massa", 50, "Massa reserva 50")
    evento(sem, "T1  Massa reserva 50  →  ATP do VIP zera (RUPTURA)")
    finalizar(sem, "cenario_ruptura_sem_protecao.xlsx")

    print(">>> COM proteção de 20 para o VIP: Massa não invade o piso")
    com = MotorATP(fisico=50, canais=[Canal("VIP", protecao=20), Canal("Massa")])
    evento(com, "T0  Estado inicial  (ATP Massa já limitado a 30)")
    tentar_reservar(com, "Massa", 50, "T1  Massa tenta reservar 50  (teto pela proteção do VIP)")
    com.reservar("Massa", 30, "Massa reserva 30")
    evento(com, "T2  Massa reserva 30  →  VIP mantém ATP 20 (SEM ruptura)")
    finalizar(com, "cenario_ruptura_com_protecao.xlsx")


def cenario_protecao_residual() -> MotorATP:
    """O dono consome parte da proteção; o residual evita bloqueio em dobro."""
    motor = MotorATP(fisico=100, canais=[Canal("Loja", protecao=30), Canal("Site")])
    titulo("4) PROTEÇÃO RESIDUAL — não bloqueia estoque em dobro")

    evento(motor, "T0  Estado inicial  (Loja protege 30)")
    motor.reservar("Loja", 25, "T1 Loja reserva 25")
    evento(motor, "T1  Loja reserva 25  →  residual da proteção = 5")
    print("     Site vê 100 − 25 (reservas) − 5 (residual) = 70")
    print("     (sem residual veria 100 − 25 − 30 = 45: 5 unidades presas à toa)")
    print("-" * 72)
    motor.reservar("Site", 70, "T2 Site reserva 70")
    evento(motor, "T2  Site reserva 70  (conseguiu tudo que sobrou)")
    motor.reservar("Loja", 5, "T3 Loja reserva 5")
    evento(motor, "T3  Loja reserva 5  →  Loja alcança suas 30 (proteção honrada)")

    finalizar(motor, "cenario_protecao_residual.xlsx")
    return motor


def cenario_restricao_reabre() -> MotorATP:
    """O teto instantâneo da restrição reabre ao efetivar ou cancelar."""
    motor = MotorATP(fisico=100, canais=[Canal("Marketplace", restricao=20), Canal("Outro")])
    titulo("5) RESTRIÇÃO INSTANTÂNEA — o teto reabre ao efetivar/cancelar")

    evento(motor, "T0  Estado inicial  (Marketplace com teto de 20)")
    motor.reservar("Marketplace", 20, "T1 Marketplace reserva 20")
    evento(motor, "T1  Marketplace reserva 20  (teto cheio → ATP 0)")
    tentar_reservar(motor, "Marketplace", 1, "T2  Marketplace tenta reservar 1  (teto estourado)")
    motor.efetivar("Marketplace", 20, "T3 Marketplace efetiva 20")
    evento(motor, "T3  Marketplace efetiva 20  →  teto REABRE (ATP volta a 20)")
    motor.reservar("Marketplace", 12, "T4 Marketplace reserva 12")
    evento(motor, "T4  Marketplace reserva 12  (teto 20 − 12 = 8)")
    motor.cancelar("Marketplace", 12, "T5 Marketplace cancela 12")
    evento(motor, "T5  Marketplace cancela 12  →  teto REABRE de novo (ATP 20)")

    finalizar(motor, "cenario_restricao_reabre.xlsx")
    return motor


def cenario_saturacao_no_limite() -> MotorATP:
    """Duas proteções somando exatamente o físico: cada uma reivindica sua fatia."""
    motor = MotorATP(fisico=100, canais=[Canal("A", protecao=60), Canal("B", protecao=40)])
    titulo("6) SATURAÇÃO NO LIMITE — proteções 60 + 40 = físico 100")

    evento(motor, "T0  Estado inicial  (cada canal vê exatamente sua proteção)")
    motor.reservar("A", 60, "T1 A reserva 60")
    evento(motor, "T1  A reserva 60  (sua proteção inteira)")
    motor.reservar("B", 40, "T2 B reserva 40")
    evento(motor, "T2  B reserva 40  (sua proteção inteira; disponível zera)")
    tentar_reservar(motor, "A", 1, "T3  A tenta reservar 1  (nada sobrou)")

    finalizar(motor, "cenario_saturacao_no_limite.xlsx")
    return motor


def cenario_config_invalida() -> None:
    """Proteções que somam mais que o físico são recusadas na construção."""
    titulo("7) CONFIG INVÁLIDA — proteções sobre-comprometidas (60 + 60 > 100)")
    try:
        MotorATP(fisico=100, canais=[Canal("A", protecao=60), Canal("B", protecao=60)])
        print("  (não deveria chegar aqui)")
    except ConfiguracaoInvalida as erro:
        print(f"  ⛔ RECUSADO na construção: {erro}")
        print("  → habilite fair_share=True para ratear em vez de recusar (cenário 8).")
    print("-" * 72 + "\n")


def cenario_fair_share() -> MotorATP:
    """Sobre-comprometido COM fair_share: o físico é rateado proporcionalmente."""
    motor = MotorATP(
        fisico=100,
        canais=[Canal("A", protecao=60), Canal("B", protecao=60)],
        fair_share=True,
    )
    titulo("8) FAIR-SHARE — proteções 60 + 60 > 100 rateadas em 50 + 50")

    print("     Σ proteções = 120 > físico 100 → rateio proporcional:")
    print(f"     proteções efetivas = {motor._protecoes_efetivas()}")
    print("-" * 72)
    evento(motor, "T0  Estado inicial  (cada canal recebe sua fatia de 50)")
    motor.reservar("A", 50, "T1 A reserva 50")
    evento(motor, "T1  A reserva 50  (sua fatia rateada)")
    motor.reservar("B", 50, "T2 B reserva 50")
    evento(motor, "T2  B reserva 50  (disponível zera; ambos honrados)")

    finalizar(motor, "cenario_fair_share.xlsx")
    return motor


def main() -> None:
    cenario_base()
    cenario_cancelamento()
    cenario_disputa_ultima_unidade()
    cenario_ruptura_sem_protecao()
    cenario_protecao_residual()
    cenario_restricao_reabre()
    cenario_saturacao_no_limite()
    cenario_config_invalida()
    cenario_fair_share()
    print("Todos os cenários executados. Planilhas em ./saida/")


if __name__ == "__main__":
    main()
