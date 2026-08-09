# ATP (Available-to-Promise) — conceito, funcionamento e variações

Documentação de referência do modelo de **ATP multicanal** usado neste
simulador: um CD (Centro de Distribuição) único que atende vários canais de
venda de um mesmo SKU, com políticas de **Estoque de Proteção** e **Estoque de
Restrição**.

> **Índice**
> 1. [O que é ATP](#1-o-que-é-atp)
> 2. [Os quatro estoques que não se confundem](#2-os-quatro-estoques-que-não-se-confundem)
> 3. [Variações do ATP](#3-variações-do-atp)
> 4. [Alocação multicanal: proteção e restrição](#4-alocação-multicanal-proteção-e-restrição)
> 5. [Controle de concorrência por reserva](#5-controle-de-concorrência-por-reserva)
> 6. [O modelo formal implementado](#6-o-modelo-formal-implementado)
> 7. [Invariantes garantidas](#7-invariantes-garantidas)
> 8. [Exemplo completo (teste de mesa)](#8-exemplo-completo-teste-de-mesa)
> 9. [Glossário e equivalência de mercado](#9-glossário-e-equivalência-de-mercado)
> 10. [Variações ainda não implementadas](#10-variações-ainda-não-implementadas)

---

## 1. O que é ATP

**ATP (Available-to-Promise — "disponível para promessa")** é a quantidade de
um SKU que você pode **prometer a um novo pedido agora**, sem quebrar
compromissos já assumidos.

O ponto central: **ATP não é o estoque físico**. É o estoque *livre para
prometer*. Vender é, no fundo, "prometer entregar" — e o ATP é a resposta para
a pergunta que o sistema faz a cada pedido:

> *"Posso aceitar esta venda sem furar nenhuma promessa anterior nem nenhuma
> política de canal?"*

O conceito nasce em MRP/ERP (planejamento de produção) e hoje é o coração dos
sistemas de **OMS/DOM** (Order / Distributed Order Management) que orquestram
estoque em operações omnichannel.

---

## 2. Os quatro estoques que não se confundem

Metade dos erros de modelagem vêm de tratar "estoque" como um número só. São
quatro conceitos distintos:

| Conceito | Definição | Neste modelo |
|---|---|---|
| **On-hand (Físico)** | O que está fisicamente no CD | `fisico` |
| **Reservado** | Retido por pedidos em aberto, ainda não faturados | `reservas[canal]` |
| **Disponível** | Físico − Reservado − Bloqueado (avaria, quarentena) | `disponivel` |
| **ATP** | Disponível − compromissos e políticas, por canal/janela | `atp(canal)` |

```
Físico  ─── (− bloqueios) ───►  Disponível  ─── (− políticas) ───►  ATP
  100                               100                          por canal
```

**Atenção terminológica — ATP ≠ Estoque de Segurança (safety stock):**
- *Safety stock* protege contra **variabilidade** de demanda/lead time (buffer
  estatístico, agnóstico de canal).
- Neste modelo, o **Estoque de Proteção** protege um **canal específico** da
  competição interna entre canais. É política de alocação, não buffer de
  incerteza. São coisas diferentes que por acaso "reservam" estoque.

---

## 3. Variações do ATP

### 3.1 ATP instantâneo (snapshot)

Olha **apenas o estoque atual**. Responde "posso vender agora?" com base no
disponível deste instante.

- **Prós:** simples, barato, ideal para tempo real (checkout de e-commerce).
- **Contras:** ignora o futuro — não sabe que chega reposição amanhã.
- **Este simulador usa ATP instantâneo.**

### 3.2 ATP cumulativo (time-phased)

Projeta o estoque **no tempo**, somando *recebimentos futuros* (ordens de
compra, produção, transferências) e subtraindo *demanda futura já
comprometida*, período a período.

```
ATP(t) = Estoque_inicial
       + Σ Recebimentos até t
       − Σ Demanda comprometida até t
```

Responde "consigo prometer para **entregar no dia X**?". É mais poderoso, mas
exige um **calendário de supply** (quando chega o quê). Usado em manufatura,
distribuição e vendas B2B com prazo.

Uma refinação comum é o **ATP cumulativo com look-ahead**: a promessa de hoje
não pode "roubar" estoque que já está comprometido para um pedido futuro com
data anterior.

### 3.3 CTP (Capable-to-Promise)

Extensão do ATP para quando **não há estoque, mas há capacidade de produzir**.
Consulta capacidade fabril e materiais para prometer com base no que *pode ser
feito a tempo*. Fora do escopo deste simulador (não há produção), mas é a
evolução natural em ambientes make-to-order.

### 3.4 Resumo comparativo

| Variação | Horizonte | Precisa de calendário de supply? | Caso típico |
|---|---|---|---|
| **Instantâneo** | Agora | Não | E-commerce em tempo real |
| **Cumulativo (time-phased)** | Futuro | Sim (recebimentos) | Distribuição, B2B com prazo |
| **CTP** | Futuro | Sim (+ capacidade fabril) | Make-to-order |

---

## 4. Alocação multicanal: proteção e restrição

Quando **N canais** compartilham o mesmo estoque, o ATP deixa de ser um número
e vira **um número por canal**. Duas políticas moldam essa divisão.

### 4.1 Estoque de Proteção (piso reservado a um canal)

Uma quantidade **garantida** a um canal, para evitar sua ruptura por
competição interna. Blinda estoque contra o consumo dos **demais** canais.

- É **piso, não teto**: o canal dono pode ultrapassar sua proteção se houver
  disponível; os outros é que não podem invadi-la.
- Equivale, no mercado, a **inventory fencing / reserved / ring-fenced /
  dedicated inventory**.

**Variações da proteção:**

| Variação | Comportamento |
|---|---|
| **Hard** | Ninguém toca, mesmo que o dono não use e outro canal esteja em ruptura |
| **Soft** | Pode ser "emprestada" aos demais se o dono não consumir até certo momento |
| **Com janela temporal** | Reserva vale até um horário (ex.: 18h), depois libera para os demais |
| **Proteção residual** | Só a parte *não consumida* da proteção é blindada (ver §6) |

> **Neste simulador:** a proteção é **soft para o dono** (piso, ele pode
> exceder) e **hard para os demais** (nunca invadem o piso), usando **proteção
> residual** para não bloquear estoque em dobro.

### 4.2 Estoque de Restrição (teto de consumo de um canal)

Um **limite** de quanto um canal pode consumir, para favorecer os demais.

- No mercado: **allocation cap / limit / quota**, *inventory throttling*.
- Proteção e restrição são frequentemente **as duas faces da mesma moeda**:
  reservar X para o canal A é, na prática, restringir esse X dos demais.

**Duas semânticas bem diferentes para "restrição":**

| Semântica | O que limita | O teto reabre? | Uso |
|---|---|---|---|
| **Instantânea** | Reservas **simultâneas** do canal | Sim, ao efetivar/cancelar | Balancear disponibilidade entre canais |
| **Acumulada por período** | Vendas **confirmadas** no período | Não, só no reset (dia/semana) | Cota comercial ("Mkt vende ≤ 20/dia") |

> **Neste simulador:** ambas as semânticas existem e podem coexistir num mesmo
> canal. A **instantânea** (`restricao`) limita reservas ativas e reabre ao
> efetivar/cancelar. A **acumulada** (`restricaoAcumulada`) limita vendas +
> reservas do período e só reabre em `reiniciarPeriodo()` — efetivar apenas
> converte reserva em venda, sem reabrir a cota. Com as duas setadas, vale o
> menor teto.

### 4.3 Proteções sobre-comprometidas e fair-share

Se a soma das proteções excede o físico (ex.: A=60, B=60, C=0, físico=100), as
proteções "estouram". Estratégias de mercado:

- **Rejeitar na configuração** (não deixar cadastrar proteções que somam > físico).
- **Fair-share / rateio proporcional**: quando aperta, distribui o disponível
  proporcionalmente às proteções, em vez de "primeiro a chegar leva tudo".

> **Neste simulador:** por padrão, proteções sobre-comprometidas são
> **recusadas na construção** (`ConfiguracaoInvalida`). Habilitando
> `fairShare = true`, o físico é **rateado proporcionalmente** às proteções
> (método do maior resto, as fatias somam exatamente o físico) e a proteção
> efetiva de cada canal passa a ser sua fatia.

---

## 5. Controle de concorrência por reserva (status)

O estoque é organizado em **posições**, cada uma identificada por
**(SKU, Centro de Distribuição)** com seu próprio físico, canais e reservas. A
**chave da reserva** é **SKU + Centro + canal** (mais o id da reserva
individual); o ATP é calculado por posição e posições diferentes são
independentes.

A concorrência é resolvida por **reserva**, modelada com ciclo de vida por
**status** — cada reserva é uma entidade (id, sku, centro, canal, quantidade,
status):

```
                    ┌──efetivar(novoFísico)──► EFFECTIVE
   (nova)──► RESERVED│
                    └──cancelar──────────────► CANCELLED

   Disponível = Físico − Σ Reservas RESERVED
```

- **RESERVED:** garante a intenção de compra e **debita o saldo disponível**.
  Resolve a concorrência — dois pedidos não reservam a mesma unidade (evita
  *oversell*).
- **EFFECTIVE:** venda confirmada. **Recompõe o saldo** (o hold é liberado) e,
  no mesmo momento, o **estoque físico é atualizado pela quantidade vinda de
  outro sistema** — refletindo as vendas realizadas **e** a reposição da
  indústria. A efetivação **não** baixa o físico por conta própria; ela aplica
  o físico autoritativo do feed externo (`novoFísico`).
- **CANCELLED:** intenção desfeita. Recompõe o saldo; o físico não muda.

### Por que o físico vem de fora

Quem atualiza o estoque físico é **outro sistema** (ERP/WMS), que consolida
vendas faturadas e recebimentos da indústria. Por isso a efetivação recebe o
`novoFísico` em vez de simplesmente fazer `físico − quantidade`:

- Se o feed reflete só a venda: `novoFísico = físico − quantidade` (padrão).
- Se houve reposição junto: `novoFísico > físico − quantidade` (o disponível
  sobe).

Para preservar o **não-oversell**, a efetivação é recusada se o `novoFísico`
informado ficar **abaixo do que segue reservado** por outras reservas RESERVED
(deixaria o disponível negativo).

---

## 6. O modelo formal implementado

Para o canal `c`:

```
Disponível            = Físico − Σ Reservas_de_todos_os_canais

proteção_residual(k)  = max(0, Proteção(k) − Reservas(k))

ATP(c) = max(0, min(
             Disponível − Σ_{k≠c} proteção_residual(k),   # sobra após blindar os outros
             Restrição(c) − Reservas(c)                    # teto instantâneo do próprio canal
         ))
```

**Por que proteção *residual* e não a proteção cheia?**
A parte da proteção que o próprio dono já reservou **já saiu do `Disponível`**.
Subtraí-la de novo do ATP dos outros blindaria o mesmo estoque em dobro,
desperdiçando disponibilidade. O residual (`Proteção − Reservas` do dono) é
exatamente o que ainda precisa ficar guardado.

**Exemplo do bloqueio em dobro:** Loja protege 30 e já reservou 25 (residual =
5). Físico = 100.
- Com residual: Site vê `100 − 25 − 5 = 70`. ✅
- Sem residual (erro): Site veria `100 − 25 − 30 = 45` — 5 unidades presas à toa.

**O `max(0, …)`** garante que ATP nunca é negativo (importante quando as
proteções estão sobre-comprometidas).

---

## 7. Invariantes garantidas

O motor valida estas garantias **após cada operação**; violá-las levanta
`ViolacaoDeInvariante` (sinaliza bug do modelo, não erro de uso):

1. **Não-oversell** — a soma das reservas nunca excede o físico
   (`Disponível ≥ 0`). Nenhuma unidade é prometida duas vezes.
2. **Proteção honrada** — todo canal protegido sempre consegue alcançar sua
   proteção (limitada pelo físico), somando o que já reservou ao que ainda
   pode reservar (`Reservas(k) + ATP(k) ≥ min(Proteção(k), Físico)`).

**Critério de sucesso do teste de mesa, em uma linha:**

> Sob qualquer sequência de reservas/efetivações/cancelamentos concorrentes,
> nenhuma venda confirmada excede o físico **e** nenhum canal protegido sofre
> ruptura enquanto houver estoque protegido não consumido para ele.

---

## 8. Exemplo completo (teste de mesa)

Físico = 100. **Loja** protege 30 · **Site** livre · **Marketplace** restringe 20.

| Evento | Ação | Físico | Disp. | ATP Loja | ATP Site | ATP Mkt |
|---|---|---:|---:|---:|---:|---:|
| **T0** | inicial | 100 | 100 | 100 | 70 | 20 |
| **T1** | Mkt reserva 15 | 100 | 85 | 85 | 55 | 5 |
| **T2** | Site reserva 40 | 100 | 45 | 45 | 15 | 5 |
| **T3** | Mkt efetiva 15 | 85 | 45 | 45 | 15 | 15 |
| **T4** | Loja reserva 30 | 85 | 15 | 15 | 15 | 15 |

Leitura dos pontos-chave:
- **T1:** o teto de 20 do Marketplace, menos as 15 reservadas, deixa ATP = 5.
- **T2:** mesmo com 55 unidades reservadas, a **proteção da Loja segue intocada**
  — `Disponível − 30` blinda as 30 da Loja; Site e Mkt nunca as tocam.
- **T3:** ao efetivar, o feed externo informa o físico 85 (aqui, `100 − 15`, só
  a venda); o hold é liberado, o disponível **não muda** e o teto do Marketplace
  **reabre** (0→15).
- **T4:** a Loja consome exatamente sua proteção; nenhuma invariante quebra.

Este fluxo é reproduzível no app (`npm run dev`): crie as reservas, efetive
informando o **Novo físico** e exporte o histórico em `.xlsx` pelo botão
**Exportar .xlsx**.

A planilha tem duas abas: **Movimentos** (uma linha por evento, com físico,
disponível, reservas e ATP por canal) e **Configuração** (físico inicial e as
políticas de cada canal).

---

## 9. Glossário e equivalência de mercado

| Termo do projeto | Equivalente de mercado |
|---|---|
| **Estoque de Proteção** | Inventory fencing, reserved / ring-fenced / dedicated inventory, channel allocation |
| **Estoque de Restrição** | Allocation cap / limit / quota, inventory throttling |
| **Reserva** | Soft allocation / hold / order reservation |
| **Efetivação** | Hard allocation / fulfillment / faturamento |
| **Disponível** | Available-to-sell (ATS) |
| **ATP** | Available-to-Promise |
| **Fair-share** | Fair-share allocation / proportional rationing |
| **Estoque de Segurança** (≠ Proteção) | Safety stock |

---

## 10. Variações ainda não implementadas

Extensões naturais, cada uma isolando uma variação do modelo:

- **Rateio por prioridade/segmento** sob escassez (o fair-share atual é
  proporcional; uma variante seria priorizar canais mais rentáveis — cf. PTP).
- **Proteção com janela temporal** (expira num horário e libera aos demais).
- **ATP time-phased** com recebimentos futuros do CD (§3.2).
- **Multi-CD**: mesmo SKU em vários CDs, com regra de sourcing por canal.

---

*Este documento descreve o modelo implementado em `src/atp/engine.ts`. Para a
referência rápida de uso, veja o [README](../README.md).*
