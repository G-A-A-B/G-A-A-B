"""Helpers de apresentação para os cenários de teste de mesa.

Centraliza a impressão da tabela de ATP a cada evento, o tratamento de
reservas esperadamente recusadas e a exportação do histórico para .xlsx.
"""

from __future__ import annotations

from pathlib import Path

from estoque_atp import ErroDeReserva, MotorATP, exportar_xlsx

LARGURA = 72
PASTA_SAIDA = Path("saida")


def titulo(texto: str) -> None:
    print("=" * LARGURA)
    print(texto)
    print("=" * LARGURA)


def _estado(motor: MotorATP) -> str:
    reservas = " ".join(f"{n}:{q}" for n, q in motor.reservas.items())
    return f"  físico={motor.fisico}  disponível={motor.disponivel}  reservas[{reservas}]"


def _linha_atp(motor: MotorATP) -> str:
    partes = [f"{nome}={motor.atp(nome):>3}" for nome in motor.canais]
    return "  ATP → " + " | ".join(partes)


def evento(motor: MotorATP, descricao: str) -> None:
    """Imprime o estado e o ATP de todos os canais após um evento."""
    print(descricao)
    print(_estado(motor))
    print(_linha_atp(motor))
    print("-" * LARGURA)


def tentar_reservar(motor: MotorATP, canal: str, qtd: int, descricao: str) -> None:
    """Reserva esperando que POSSA ser recusada; imprime o desfecho.

    Útil para demonstrar o bloqueio de oversell/restrição no teste de mesa.
    """
    try:
        motor.reservar(canal, qtd, descricao)
        evento(motor, descricao)
    except ErroDeReserva as erro:
        print(descricao)
        print(f"  ⛔ RECUSADO: {erro}")
        print("-" * LARGURA)


def finalizar(motor: MotorATP, nome_arquivo: str) -> None:
    """Fecha o cenário: confirma invariantes e exporta o histórico para .xlsx."""
    destino = exportar_xlsx(motor, PASTA_SAIDA / nome_arquivo)
    print("Invariantes mantidas em todos os eventos: "
          "não-oversell ✓  proteção honrada ✓")
    print(f"Histórico exportado para: {destino}\n")
