# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

La web (React) es una de las interfaces. La app móvil principal es Flutter (`mobile_flutter/`, Android e iOS); la app Android nativa en Kotlin (`mobile/`) está congelada desde el 21/10 como respaldo. Este registro cubre la web.

## Users

- **Marketero de agencia** (usuario principal). Gestiona campañas de varios clientes: las crea (dictando o escribiendo), las envía a aprobación, elige dónde se publican y revisa las estadísticas de las publicaciones de todos sus clientes para decidir qué repetir.
- **Cliente** (dueño del negocio). Revisa y aprueba o rechaza la versión exacta que se publicará, conecta sus propias cuentas de Instagram y Facebook, y ve solo las estadísticas de sus propias publicaciones.
- **Superadmin** (dueño de la plataforma). Ve absolutamente todo: todos los marketeros, clientes, campañas y publicaciones, para medir cuánto rinde la plataforma.
- **Jurado de la sustentación** (contexto académico, Tecsup). Ve una demostración en vivo: lo que se muestre debe estar funcionando de verdad.

## Product Purpose

Convertir una idea dicha en voz en una publicación real en Instagram y Facebook, aprobada por el cliente, y mostrar cuánto rinde. Éxito: que una agencia pase del brief al post publicado con menos esfuerzo que llenando formularios, sin publicar nada que el cliente no haya aprobado, y que agencia y cliente vean resultados reales.

## Positioning

Todo el ciclo en un solo flujo: dictar la idea → la IA crea copy e imagen → el cliente aprueba esa versión exacta → se publica sola en sus redes → se ven sus estadísticas. Las herramientas de programación y métricas (Metricool, Hootsuite) publican y miden, pero no crean la campaña desde la voz ni atan la publicación a la aprobación del cliente.

## Operating Context

- Tres roles con vistas distintas sobre los mismos datos: cliente (lo suyo), marketero (sus clientes), superadmin (todo).
- Publicación en Meta (Instagram profesional + página de Facebook) mediante el login de Meta; en modo desarrollo solo funcionan cuentas registradas como tester. Cuenta de demostración: Instagram `@nexomarkia`.
- Dictado en el navegador con la Web Speech API (Chrome o Edge; Brave no la soporta) y en Android con el reconocedor del sistema.
- Idioma de la interfaz: español (Perú).

## Capabilities and Constraints

- Ya existe: login por roles, creación de campañas por voz o formulario, generación de copy e imagen con IA, historial y comparación de versiones, aprobación/rechazo con valoración y comentario, créditos de IA, conexión de cuentas de Meta, elegir destinos al enviar, publicación automática al aprobar con reintento, métricas por publicación y resumen por red.
- Las métricas de Meta pueden tardar hasta 48 horas y a veces no existen: un dato que Meta no informa se muestra como "sin dato", nunca como 0.
- Aprobar una versión no hereda a ediciones posteriores: lo aprobado es lo publicado.
- Decisión pendiente: planes o suscripciones de los clientes de cada agencia (no existe todavía; no inventar precios ni planes).

## Brand Commitments

- Nombre del producto: **NexoMark IA** (confirmado el 2026-10-06). Reemplaza a "MarketMind IA" / "MarketMind Voice" en la interfaz visible. Los identificadores de código siguen llamándose `marketmind`; el repositorio en GitHub es `JasonGomezzz/NexoMark`.
- La marca de la cuenta de demostración es la misma: Instagram `@nexomarkia` ("NexoMarkAI").
- Sistema visual vigente: identidad **NexoMark «C · Conforme»** (azul marino y turquesa, logo aprobado, modo claro y oscuro), descrita en `DESIGN.md`. Es la única identidad del producto.

## Evidence on Hand

- Campañas, versiones e imágenes generadas reales en la base de desarrollo.
- Una publicación real en `@nexomarkia` (06/10/2026, hecha con el script de prueba, no todavía desde la app) con métricas en 0 al publicar. No fabricar cifras, seguidores, testimonios ni casos de éxito; datos de ejemplo deben rotularse como tales.
- Logos de Instagram y Facebook en `src/assets/social/`.

## Product Principles

1. **Lo aprobado es lo publicado.** La interfaz siempre deja claro qué versión se aprobó y dónde se publicará.
2. **Datos honestos.** Mostrar "sin dato" o "pendiente" antes que un número inventado o un cero falso.
3. **Cada rol ve lo suyo.** El cliente ve solo sus publicaciones; el marketero, las de sus clientes; el superadmin, todo.
4. **La voz acelera, no obliga.** El formulario sigue disponible y converge en la misma campaña.
5. **Funciona antes que adorna.** Para la sustentación vale más un flujo real en vivo que una pantalla decorativa.
