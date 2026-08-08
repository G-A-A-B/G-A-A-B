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
from datetime import datetime


class ConfiguracaoInvalida(Exception):
    """Configuração de estoque/canais inconsistente (ex.: proteções que somam
    mais que o físico — impossível honrar todas sem uma política de rateio)."""


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
    restricao: teto INSTANTÂNEO de reservas simultâneas. None = sem teto.
               Reabre ao efetivar/cancelar.
    restricao_acumulada: cota de vendas confirmadas + reservas ativas no
               PERÍODO. None = sem cota. Só reabre em reiniciar_periodo(), não
               ao efetivar (efetivar apenas converte reserva em venda).
    """

    nome: str
    protecao: int = 0
    restricao: int | None = None
    restricao_acumulada: int | None = None

    def __post_init__(self) -> None:
        if self.protecao < 0:
            raise ValueError(f"proteção do canal {self.nome} não pode ser negativa")
        if self.restricao is not None and self.restricao < 0:
            raise ValueError(f"restrição do canal {self.nome} não pode ser negativa")
        if self.restricao_acumulada is not None and self.restricao_acumulada < 0:
            raise ValueError(
                f"restrição acumulada do canal {self.nome} não pode ser negativa"
            )


@dataclass
class Movimento:
    """Uma linha do histórico de movimentos do teste de mesa.

    Captura o estado do estoque LOGO APÓS o evento: físico, disponível,
    reservas por canal e ATP por canal.
    """

    seq: int
    momento: datetime
    evento: str          # INICIAL | RESERVA | EFETIVACAO | CANCELAMENTO
    canal: str           # "-" no evento INICIAL
    quantidade: int      # 0 no evento INICIAL
    rotulo: str          # descrição livre (ex.: "T1 Marketplace reserva 15")
    fisico: int
    disponivel: int
    reservas: dict[str, int]
    atp: dict[str, int]


@dataclass
class MotorATP:
    """Motor de ATP para um SKU em um CD único.

    fisico:  estoque físico total no CD.
    canais:  configuração por canal (proteção/restrição).
    """

    fisico: int
    canais: dict[str, Canal] = field(default_factory=dict)
    reservas: dict[str, int] = field(default_factory=dict)

    def __init__(
        self, fisico: int, canais: list[Canal], fair_share: bool = False
    ) -> None:
        if fisico < 0:
            raise ValueError("estoque físico não pode ser negativo")
        self.fair_share = fair_share
        soma_protecoes = sum(c.protecao for c in canais)
        if soma_protecoes > fisico and not fair_share:
            raise ConfiguracaoInvalida(
                f"proteções somam {soma_protecoes} > físico {fisico}: "
                "impossível honrar todas (habilite fair_share para ratear)"
            )
        self.fisico = fisico
        self.canais = {c.nome: c for c in canais}
        self.reservas = {c.nome: 0 for c in canais}
        # Vendas confirmadas no período corrente (para a restrição acumulada).
        self.vendas_periodo = {c.nome: 0 for c in canais}
        self.historico: list[Movimento] = []
        self._registrar("INICIAL", "-", 0, "Estado inicial")

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

    def protecao_efetiva(self, nome: str) -> int:
        """Proteção que o canal efetivamente recebe.

        Se as proteções cabem no físico, é a própria proteção configurada.
        Se estão sobre-comprometidas (Σ proteções > físico) e o fair_share está
        ligado, o físico é rateado proporcionalmente às proteções, pelo método
        do maior resto (as fatias somam exatamente o físico).
        """
        return self._protecoes_efetivas()[nome]

    def _protecoes_efetivas(self) -> dict[str, int]:
        protecoes = {n: c.protecao for n, c in self.canais.items()}
        soma = sum(protecoes.values())
        if soma == 0 or soma <= self.fisico:
            return protecoes  # cabem no físico: cada canal recebe sua proteção

        # Sobre-comprometido: rateio proporcional pelo método do maior resto.
        exatas = {n: self.fisico * p / soma for n, p in protecoes.items()}
        base = {n: int(v) for n, v in exatas.items()}
        resto = self.fisico - sum(base.values())
        # Distribui as `resto` unidades aos maiores restos fracionários.
        ordem = sorted(
            protecoes, key=lambda n: (exatas[n] - base[n], protecoes[n]), reverse=True
        )
        for n in ordem[:resto]:
            base[n] += 1
        return base

    def protecao_residual(self, nome: str) -> int:
        """Parte da proteção efetiva do canal ainda não consumida por reservas."""
        return max(0, self.protecao_efetiva(nome) - self.reservas[nome])

    def atp(self, nome: str) -> int:
        """Quantidade que o canal pode reservar AGORA sem quebrar compromissos."""
        if nome not in self.canais:
            raise KeyError(f"canal desconhecido: {nome}")

        # Estoque que sobra depois de blindar a proteção residual dos OUTROS canais.
        blindagem_alheia = sum(
            self.protecao_residual(k) for k in self.canais if k != nome
        )
        sobra = self.disponivel - blindagem_alheia

        canal = self.canais[nome]
        limites = [sobra]

        # Teto INSTANTÂNEO: restrição menos o já reservado (reabre ao efetivar).
        if canal.restricao is not None:
            limites.append(canal.restricao - self.reservas[nome])

        # Teto ACUMULADO: cota do período menos vendas já confirmadas e reservas
        # ativas (só reabre em reiniciar_periodo, não ao efetivar).
        if canal.restricao_acumulada is not None:
            limites.append(
                canal.restricao_acumulada
                - self.vendas_periodo[nome]
                - self.reservas[nome]
            )

        return max(0, min(limites))

    def snapshot(self) -> dict[str, int]:
        """ATP corrente de todos os canais (para inspeção/log do teste de mesa)."""
        return {nome: self.atp(nome) for nome in self.canais}

    # ------------------------------------------------------------------ #
    # Operações
    # ------------------------------------------------------------------ #
    def reservar(self, nome: str, quantidade: int, rotulo: str = "") -> None:
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
        self._registrar("RESERVA", nome, quantidade, rotulo)

    def efetivar(self, nome: str, quantidade: int, rotulo: str = "") -> None:
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
        # Venda confirmada conta contra a cota acumulada do período.
        self.vendas_periodo[nome] += quantidade
        self._checar_invariantes()
        self._registrar("EFETIVACAO", nome, quantidade, rotulo)

    def reiniciar_periodo(self, rotulo: str = "Reinício de período") -> None:
        """Zera as vendas do período, reabrindo as cotas de restrição acumulada.

        Modela a virada de dia/semana: só aqui a restrição acumulada volta ao
        teto cheio (a instantânea, essa reabre a cada efetivação/cancelamento).
        """
        for nome in self.vendas_periodo:
            self.vendas_periodo[nome] = 0
        self._registrar("REINICIO_PERIODO", "-", 0, rotulo)

    def cancelar(self, nome: str, quantidade: int, rotulo: str = "") -> None:
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
        self._registrar("CANCELAMENTO", nome, quantidade, rotulo)

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
        #    proteção EFETIVA (a própria proteção, ou a fatia do fair-share
        #    quando sobre-comprometido), somando o já reservado ao ATP.
        for nome, canal in self.canais.items():
            if canal.protecao == 0:
                continue
            alcancavel = self.reservas[nome] + self.atp(nome)
            alvo = min(self.protecao_efetiva(nome), self.fisico)
            if alcancavel < alvo:
                raise ViolacaoDeInvariante(
                    f"proteção violada em {nome}: alcançável {alcancavel} < alvo {alvo}"
                )

    # ------------------------------------------------------------------ #
    # Histórico de movimentos
    # ------------------------------------------------------------------ #
    def _registrar(self, evento: str, canal: str, quantidade: int, rotulo: str) -> None:
        self.historico.append(
            Movimento(
                seq=len(self.historico),
                momento=datetime.now(),
                evento=evento,
                canal=canal,
                quantidade=quantidade,
                rotulo=rotulo,
                fisico=self.fisico,
                disponivel=self.disponivel,
                reservas=dict(self.reservas),
                atp=self.snapshot(),
            )
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
