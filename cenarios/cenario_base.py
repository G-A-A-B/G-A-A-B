"""Teste de mesa BASE: 3 canais, 1 SKU, CD único.

  - Físico = 100
  - Loja  : proteção de 30 (piso garantido)
  - Site  : sem proteção, sem restrição
  - Marketplace: restrição de 20 (teto instantâneo)

Rode com:  python -m cenarios.cenario_base
"""

from __future__ import annotations

from cenarios._apresentacao import evento, finalizar, titulo
from estoque_atp import Canal, MotorATP


def executar() -> MotorATP:
    motor = MotorATP(
        fisico=100,
        canais=[
            Canal("Loja", protecao=30),
            Canal("Site"),
            Canal("Marketplace", restricao=20),
        ],
    )

    titulo("BASE — proteção (Loja=30) + restrição instantânea (Marketplace=20)")

    evento(motor, "T0  Estado inicial (nenhuma reserva)")
    motor.reservar("Marketplace", 15, "T1 Marketplace reserva 15")
    evento(motor, "T1  Marketplace reserva 15  (teto 20 → resta 5)")
    motor.reservar("Site", 40, "T2 Site reserva 40")
    evento(motor, "T2  Site reserva 40  (proteção da Loja segue intocada)")
    motor.efetivar("Marketplace", 15, "T3 Marketplace efetiva 15")
    evento(motor, "T3  Marketplace efetiva 15  (libera reserva + baixa físico)")
    motor.reservar("Loja", 30, "T4 Loja reserva 30")
    evento(motor, "T4  Loja reserva 30  (consome exatamente sua proteção)")

    finalizar(motor, "cenario_base.xlsx")
    return motor


if __name__ == "__main__":
    executar()
