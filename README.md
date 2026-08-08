# Simulador de ATP multicanal — Estoque de Proteção e Restrição

Teste de mesa para validar o conceito de **um CD (Centro de Distribuição)
único servindo múltiplos canais de venda** de um SKU, com duas políticas de
alocação de estoque:

- **Estoque de Proteção** — piso reservado a um canal. Blinda estoque contra o
  consumo dos *demais* canais para evitar ruptura do canal protegido. Não
  limita o canal dono (é piso, não teto).
- **Estoque de Restrição** — teto instantâneo de reservas simultâneas de um
  canal, para favorecer os demais.

A concorrência é resolvida por **reserva**: a reserva reduz o disponível até a
efetivação da venda. Na efetivação, a reserva é liberada **e** o físico é
baixado na mesma operação (efeito líquido zero sobre o disponível).

## Modelo (ATP — Available-to-Promise)

```
Disponível            = Físico − Σ Reservas_de_todos_os_canais
proteção_residual(k)  = max(0, Proteção(k) − Reservas(k))

ATP(c) = max(0, min(
             Disponível − Σ_{k≠c} proteção_residual(k),   # sobra após blindar os outros
             Restrição(c) − Reservas(c)                    # teto instantâneo do próprio canal
         ))
```

Usa-se a proteção **residual** (proteção menos o que o dono já reservou) porque
a parte já consumida da proteção saiu do `Disponível`; subtraí-la de novo
blindaria estoque em dobro e desperdiçaria disponibilidade.

## Invariantes garantidas

O motor valida a cada operação:

1. **Não-oversell** — a soma das reservas nunca excede o físico
   (`disponível ≥ 0`).
2. **Proteção honrada** — todo canal protegido sempre consegue alcançar sua
   proteção (limitada pelo físico), somando o já reservado ao ainda reservável.

Se qualquer invariante for violada, o motor levanta `ViolacaoDeInvariante`
(indica bug do modelo, não erro de uso).

📖 **Documentação completa do conceito e suas variações:** [`docs/ATP.md`](docs/ATP.md).

## Estrutura

```
estoque_atp/motor.py       Motor de ATP (Canal, MotorATP) + histórico de movimentos
estoque_atp/planilha.py    Exportação do histórico para .xlsx
cenarios/cenario_base.py   Teste de mesa executável (3 canais, passo a passo)
tests/                     Suíte de testes (motor + histórico/xlsx)
docs/ATP.md                Documentação de referência do modelo
```

## Como rodar

```bash
# Instalar dependências (openpyxl para o .xlsx)
pip install -e .

# Teste de mesa: imprime a tabela de ATP a cada evento
# e exporta o histórico para saida/historico_movimentos.xlsx
python -m cenarios.cenario_base

# Suíte de testes
pytest
```

O `.xlsx` gerado tem duas abas: **Movimentos** (uma linha por evento — físico,
disponível, reservas e ATP por canal, com o tipo de evento colorido) e
**Configuração** (físico inicial e as políticas de cada canal).

## Exemplo de uso

```python
from estoque_atp import Canal, MotorATP

motor = MotorATP(
    fisico=100,
    canais=[
        Canal("Loja", protecao=30),        # 30 garantidas para a Loja
        Canal("Site"),                     # livre
        Canal("Marketplace", restricao=20) # teto de 20 simultâneas
    ],
)

motor.atp("Site")            # 70  (100 − 30 de proteção da Loja)
motor.reservar("Site", 40)   # reserva 40 para o Site
motor.efetivar("Site", 40)   # confirma venda: libera reserva e baixa físico
motor.cancelar("Site", 10)   # (se ainda houvesse reserva) devolve ao disponível

# Histórico de movimentos → .xlsx
from estoque_atp import exportar_xlsx
exportar_xlsx(motor, "saida/historico.xlsx")
```

## Decisões de modelagem já cravadas

- **Restrição = instantânea** (limita reservas simultâneas; o teto reabre ao
  efetivar/cancelar). Não é cota acumulada por período.
- **Proteção = "soft" para o dono** (piso garantido, mas o dono pode
  ultrapassar) e **"hard" para os demais** (nunca invadem o piso alheio).
- **Efetivação = atômica** (libera reserva e baixa físico juntos), evitando o
  *gap* em que a reserva sai antes de o físico baixar — janela de oversell.

## Possíveis próximos passos

- Prioridade entre canais no rateio quando as proteções estão
  sobre-comprometidas (soma das proteções > físico).
- Proteção com **janela temporal** (expira e libera para os demais após um
  horário).
- ATP **time-phased** (com recebimentos futuros do CD).
- Restrição **acumulada por período** como política alternativa.
