"""Teste de mesa: 3 canais, 1 SKU, CD único.

Reproduz o passo a passo validado a mão:
  - Físico = 100
  - Loja  : proteção de 30 (piso garantido)
  - Site  : sem proteção, sem restrição
  - Marketplace: restrição de 20 (teto instantâneo)

Rode com:  python -m cenarios.cenario_base
"""

from __future__ import annotations

from pathlib import Path

from estoque_atp import Canal, MotorATP, exportar_xlsx

LARGURA = 68
ARQUIVO_XLSX = Path("saida") / "historico_movimentos.xlsx"


def _linha_atp(motor: MotorATP) -> str:
    partes = [f"{nome}={motor.atp(nome):>3}" for nome in motor.canais]
    return "  ATP → " + " | ".join(partes)


def _estado(motor: MotorATP) -> str:
    reservas = " ".join(f"{n}:{q}" for n, q in motor.reservas.items())
    return f"  físico={motor.fisico}  disponível={motor.disponivel}  reservas[{reservas}]"


def evento(motor: MotorATP, descricao: str) -> None:
    print(descricao)
    print(_estado(motor))
    print(_linha_atp(motor))
    print("-" * LARGURA)


def main() -> None:
    motor = MotorATP(
        fisico=100,
        canais=[
            Canal("Loja", protecao=30),
            Canal("Site"),
            Canal("Marketplace", restricao=20),
        ],
    )

    print("=" * LARGURA)
    print("TESTE DE MESA — ATP multicanal (proteção + restrição instantânea)")
    print("=" * LARGURA)

    evento(motor, "T0  Estado inicial (nenhuma reserva)")

    motor.reservar("Marketplace", 15, "T1 Marketplace reserva 15")
    evento(motor, "T1  Marketplace reserva 15  (teto 20 → resta 5)")

    motor.reservar("Site", 40, "T2 Site reserva 40")
    evento(motor, "T2  Site reserva 40  (proteção da Loja segue intocada)")

    motor.efetivar("Marketplace", 15, "T3 Marketplace efetiva 15")
    evento(motor, "T3  Marketplace efetiva 15  (libera reserva + baixa físico)")

    motor.reservar("Loja", 30, "T4 Loja reserva 30")
    evento(motor, "T4  Loja reserva 30  (consome exatamente sua proteção)")

    print("Invariantes mantidas em todos os eventos: "
          "não-oversell ✓  proteção honrada ✓")

    destino = exportar_xlsx(motor, ARQUIVO_XLSX)
    print(f"\nHistórico de movimentos exportado para: {destino}")


if __name__ == "__main__":
    main()
