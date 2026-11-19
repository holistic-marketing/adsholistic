---
name: AdsHolistic — asistente de gerencia
description: Superficie de consulta de cartera en el sistema visual v3 del panel.
colors:
  lienzo: "var(--ui-bg)"
  tarjeta: "var(--ui-surface)"
  borde: "var(--ui-line)"
  acento: "var(--ui-accent)"
  boton-principal: "var(--ui-accent-btn)"
  texto-naranja: "var(--ui-accent-text)"
---

# Asistente de gerencia

Referencia de la implementación en `/asistente`, para gerentes. Sigue la vista «Asistente» del diseño v3 del panel (`.ask`, `.ask-box`, `.sugg`). La página y la API requieren capacidades de staff o superadmin y bloquean el modo «actuar como cliente».

## Alcance y archivos

La consulta abarca la **cartera general**, independientemente del cliente seleccionado en el panel. El compositor y el encabezado de conversación hacen explícito ese alcance. La API recibe `message` y, como contexto, hasta cuatro turnos previos con respuesta (`history`); carga `loadAssistantBrief()` sin un filtro de cliente seleccionado.

La autoridad visual es `OpsAssistant.module.css`; la interacción está en `OpsAssistant.client.tsx`, los reportes en `OpsAssistantReport.tsx` y los iconos en `AssistantIcon.tsx`. El contrato está en `lib/ops/assistant-response.ts`; `assistant-answer.ts` construye respuestas y `assistant-brief.server.ts` reúne los datos. Las rutas de página y API conservan los controles de acceso.

## Tokens y jerarquía

Solo se usan los tokens `--ui-*` de `app/panel-theme.css`, así la pantalla funciona en claro, oscuro y contraste alto sin reglas propias. No hay colores fijos, degradados ni sombras de color: tarjetas `--ui-surface` con borde de 1 px `--ui-line` y sombra `--ui-shadow-sm`; el naranja de botón es `--ui-accent-btn` (texto `--ui-on-accent`) y el texto naranja sobre fondo claro es siempre `--ui-accent-text`. La letra es la del panel (Geist) y las cifras de tablas usan la monoespaciada.

Radios v3: 8 px en botones y el botón de envío, 10 px en el compositor, métricas, tablas y fuentes, 14 px en el índice de consultas y en las tarjetas de respuesta. Los botones no son píldoras; solo las insignias (alcance «Cartera general», fecha de los datos) son redondas. Los iconos locales son trazos de 1.9 px, heredan el color y son decorativos (`aria-hidden`).

## Composición y adaptación

La bienvenida tiene un ancho máximo de 760 px y va alineada a la izquierda: título de 24 px (`h1`), bajada en `--ui-text-2`, el compositor y el índice de seis consultas en una tarjeta de tres columnas (Ingresos, Clientes, Riesgo), con filas de lista, no tarjetas. Bajo 768 px los grupos se apilan. En la conversación (máximo 920 px, por las tablas) hay una sola barra superior: la última pregunta como título (`h1`), el alcance con el número de consultas y el botón «Nueva consulta».

La ruta no lleva el relleno de `.panel-main`; la superficie pone el suyo. Desde 541 px, una conversación iniciada ocupa el alto del lienzo (`100dvh` menos la barra superior y el marco: 64 px en escritorio, 48 px bajo 960 px). Solo el historial tiene desplazamiento interno; el compositor y las sugerencias de consulta quedan fuera de esa zona. El último turno se lleva a la vista al añadirse.

Hasta 540 px, el contenido fluye verticalmente con el desplazamiento de la página. Las sugerencias pasan a una columna, las métricas se apilan y el compositor queda en el flujo con espacio para el área segura inferior. Las tablas conservan encabezados accesibles y muestran cada fila como una cuadrícula de etiquetas y valores; no dependen de desplazamiento horizontal.

## Reportes y procedencia

La API devuelve `reply`, `today` y `blocks`. Cada respuesta va en una tarjeta con el rótulo «Asistente» y la fecha de los datos; cada bloque puede contener título, texto, métricas (recuadros de fondo `--ui-field`), tabla con caption y fuentes desplegables. `reply` sirve para copiar y como presentación alternativa cuando no hay bloques. La primera métrica tiene mayor jerarquía y los valores numéricos usan cifras tabulares.

Las fuentes describen los datos realmente utilizados: Hecom · Cobros, Hecom · Gasto de ads, Hecom · Cartera, AdsHolistic · Recargas y AdsHolistic · Pagos manuales, según el reporte. Conservar fechas de corte, moneda, límites de filas y exclusiones de recargas que entregue el servidor.

Los pagos de hoy están **agrupados por cliente**. La métrica cuenta «Clientes con pagos»; no representa una cantidad de transacciones. No agregar cantidades de transacciones, métodos ni horas ficticias a este reporte. El total incluye todos los clientes aunque la tabla muestre solo los primeros 15.

## Interacción y estados

- Enter envía; Shift+Enter inserta una línea; ↑ con el campo vacío recupera la última pregunta; Escape vacía el borrador; «/» enfoca el compositor desde cualquier parte de la página. El campo crece con el contenido hasta 200 px. La composición de texto con IME no dispara el envío. El campo tiene etiqueta accesible y límite de 500 caracteres.
- Solo hay una solicitud activa. El envío vacío o durante carga está deshabilitado; los accesos de consulta posterior también se deshabilitan mientras se consulta.
- La carga muestra un esqueleto del reporte y, desde los 4 s, los segundos transcurridos; el botón de envío muestra un indicador giratorio. La carga anuncia su estado; las respuestas anuncian disponibilidad. Errores de conexión, respuestas incompletas y el límite de 60 segundos ofrecen reintento del mismo turno.
- «Nueva consulta» cancela una solicitud activa, vacía el historial y borrador, y devuelve el foco al compositor. Al pasar por primera vez a conversación también se conserva el foco del campo.
- «Copiar respuesta» copia `reply` y comunica éxito o fallo. «Actualizar datos» repite la misma pregunta como turno nuevo. Las fuentes usan `details`/`summary` nativos y las tablas incluyen caption y encabezados de columna.
- El foco de teclado es el del panel (contorno `--ui-focus`). El campo señala el foco mediante el borde y el anillo del compositor. La preferencia de movimiento reducido elimina animaciones y transiciones.

El historial vive únicamente en el estado local del componente; no se persiste. Las cuatro últimas preguntas con respuesta viajan como `history` para dar contexto a la IA; no hay memoria entre visitas. Las sugerencias posteriores abren consultas completas.
