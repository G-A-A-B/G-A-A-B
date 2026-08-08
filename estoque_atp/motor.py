"""Motor de ATP (Available-to-Promise) multicanal.

Modela um CD (Centro de Distribuição) único com estoque físico de um SKU,
servindo múltiplos canais de venda. Cada canal calcula seu próprio ATP a
partir de duas políticas:

- Estoque de Proteção: piso reservado a um canal. Blinda estoque contra o
  consumo dos DEMAIS canais (não reduz o ATP do canal dono).
- Estoque de Restrição: teto instantâneo de reservas simultâneas de um canal,
  para favorecer os demais.

A concorrência é resolvida por RESERVA: a reserva reduz o disponível até a
efetivação da venda. Na efetivação, a reserva é liberada e o estoque físico é
baixado na mesma operação (o efeito líquido sobre o disponível é zero).

Fórmulas
--------
    Disponível        = Físico − Σ Reservas_de_todos_os_canais
    proteção_residual(k) = max(0, Proteção(k) − Reservas(k))
    ATP(c) = max(0, min(
                 Disponível − Σ_{k≠c} proteção_residual(k),   # sobra após blindar os outros
                 Restrição(c) − Reservas(c)                    # teto instantâneo do próprio canal
             ))

Usa-se a proteção *residual* (e não a proteção cheia) porque a parte da
proteção já consumida via reserva do próprio dono já saiu do Disponível;
subtraí-la de novo blindaria estoque em dobro.
"""

from __future__ import annotations

from dataclasses import dataclass, field


class ErroDeReserva(Exception):
    """Reserva recusada por exceder o ATP do canal."""


class ErroDeEfetivacao(Exception):
    """Efetivação/cancelamento maior que a reserva ativa do canal."""


class ViolacaoDeInvariante(Exception):
    """Estado do estoque violou uma garantia do modelo (bug do motor)."""


@dataclass
class Canal:
    """Configuração de um canal de venda.

    protecao:  unidades garantidas a ESTE canal (blinda dos demais). 0 = sem proteção.
    restricao: teto de reservas simultâneas deste canal. None = sem teto.
    """

    nome: str
    protecao: int = 0
    restricao: int | None = None

    def __post_init__(self) -> None:
        if self.protecao < 0:
            raise ValueError(f"proteção do canal {self.nome} não pode ser negativa")
        if self.restricao is not None and self.restricao < 0:
            raise ValueError(f"restrição do canal {self.nome} não pode ser negativa")


@dataclass
class MotorATP:
    """Motor de ATP para um SKU em um CD único.

    fisico:  estoque físico total no CD.
    canais:  configuração por canal (proteção/restrição).
    """

    fisico: int
    canais: dict[str, Canal] = field(default_factory=dict)
    reservas: dict[str, int] = field(default_factory=dict)

    def __init__(self, fisico: int, canais: list[Canal]) -> None:
        if fisico < 0:
            raise ValueError("estoque físico não pode ser negativo")
        self.fisico = fisico
        self.canais = {c.nome: c for c in canais}
        self.reservas = {c.nome: 0 for c in canais}

    # ------------------------------------------------------------------ #
    # Consultas
    # ------------------------------------------------------------------ #
    @property
    def reservas_totais(self) -> int:
        return sum(self.reservas.values())

    @property
    def disponivel(self) -> int:
        """Físico menos tudo que está reservado (por qualquer canal)."""
        return self.fisico - self.reservas_totais

    def protecao_residual(self, nome: str) -> int:
        """Parte da proteção do canal ainda não consumida por suas reservas."""
        canal = self.canais[nome]
        return max(0, canal.protecao - self.reservas[nome])

    def atp(self, nome: str) -> int:
        """Quantidade que o canal pode reservar AGORA sem quebrar compromissos."""
        if nome not in self.canais:
            raise KeyError(f"canal desconhecido: {nome}")

        # Estoque que sobra depois de blindar a proteção residual dos OUTROS canais.
        blindagem_alheia = sum(
            self.protecao_residual(k) for k in self.canais if k != nome
        )
        sobra = self.disponivel - blindagem_alheia

        # Teto instantâneo do próprio canal (restrição menos o já reservado).
        restricao = self.canais[nome].restricao
        if restricao is None:
            teto = sobra  # sem restrição: não limita
        else:
            teto = restricao - self.reservas[nome]

        return max(0, min(sobra, teto))

    def snapshot(self) -> dict[str, int]:
        """ATP corrente de todos os canais (para inspeção/log do teste de mesa)."""
        return {nome: self.atp(nome) for nome in self.canais}

    # ------------------------------------------------------------------ #
    # Operações
    # ------------------------------------------------------------------ #
    def reservar(self, nome: str, quantidade: int) -> None:
        """Reserva `quantidade` para o canal. Recusa se exceder o ATP."""
        self._exige_canal(nome)
        self._exige_positivo(quantidade)
        disponivel_atp = self.atp(nome)
        if quantidade > disponivel_atp:
            raise ErroDeReserva(
                f"{nome}: reserva de {quantidade} excede o ATP de {disponivel_atp}"
            )
        self.reservas[nome] += quantidade
        self._checar_invariantes()

    def efetivar(self, nome: str, quantidade: int) -> None:
        """Efetiva a venda: libera a reserva E baixa o físico na mesma operação.

        Modela a efetivação atômica (sem gap entre liberar reserva e baixar o
        físico), que é a condição para o disponível permanecer consistente.
        """
        self._exige_canal(nome)
        self._exige_positivo(quantidade)
        if quantidade > self.reservas[nome]:
            raise ErroDeEfetivacao(
                f"{nome}: efetivar {quantidade} excede a reserva ativa "
                f"de {self.reservas[nome]}"
            )
        self.reservas[nome] -= quantidade
        self.fisico -= quantidade
        self._checar_invariantes()

    def cancelar(self, nome: str, quantidade: int) -> None:
        """Cancela parte da reserva do canal (físico permanece inalterado)."""
        self._exige_canal(nome)
        self._exige_positivo(quantidade)
        if quantidade > self.reservas[nome]:
            raise ErroDeEfetivacao(
                f"{nome}: cancelar {quantidade} excede a reserva ativa "
                f"de {self.reservas[nome]}"
            )
        self.reservas[nome] -= quantidade
        self._checar_invariantes()

    # ------------------------------------------------------------------ #
    # Invariantes (garantias do modelo)
    # ------------------------------------------------------------------ #
    def _checar_invariantes(self) -> None:
        # 1. Não-oversell: nunca se reserva mais do que existe fisicamente.
        if self.reservas_totais > self.fisico:
            raise ViolacaoDeInvariante(
                f"oversell: reservas {self.reservas_totais} > físico {self.fisico}"
            )
        if self.disponivel < 0:
            raise ViolacaoDeInvariante(f"disponível negativo: {self.disponivel}")

        # 2. Proteção honrada: cada canal protegido consegue alcançar sua
        #    proteção (limitada pelo físico), somando o que já reservou ao que
        #    ainda pode reservar (ATP).
        for nome, canal in self.canais.items():
            if canal.protecao == 0:
                continue
            alcancavel = self.reservas[nome] + self.atp(nome)
            alvo = min(canal.protecao, self.fisico)
            if alcancavel < alvo:
                raise ViolacaoDeInvariante(
                    f"proteção violada em {nome}: alcançável {alcancavel} < alvo {alvo}"
                )

    # ------------------------------------------------------------------ #
    # Helpers
    # ------------------------------------------------------------------ #
    def _exige_canal(self, nome: str) -> None:
        if nome not in self.canais:
            raise KeyError(f"canal desconhecido: {nome}")

    @staticmethod
    def _exige_positivo(quantidade: int) -> None:
        if quantidade <= 0:
            raise ValueError("quantidade deve ser positiva")
