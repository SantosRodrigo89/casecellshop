# Regras de Negócio

## Cenário 1

Given produto com estoque

When usuário compra

Then pedido é criado

---

## Cenário 2

Given estoque insuficiente

When usuário compra

Then retornar erro 409

---

## Cenário 3

Given quantidade inválida

When usuário compra

Then retornar erro 400

---

## Cenário 4

Given Idempotency-Key existente

When usuário envia novamente

Then retornar pedido existente

---

## Cenário 5

Given falha ERP

When pedido é processado

Then retornar erro temporário