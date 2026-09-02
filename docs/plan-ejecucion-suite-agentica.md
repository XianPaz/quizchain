# Plan de ejecución con suite agéntica

## Principio

No tenemos una restricción de cantidad de desarrolladores.

Podemos levantar tantos agentes como haga falta para:

- implementar;
- escribir tests;
- revisar código;
- probar flujos;
- buscar regresiones;
- verificar mobile;
- revisar seguridad;
- integrar PRs.

Por lo tanto, el objetivo no es repartir trabajo entre personas sino **maximizar paralelismo sin romper las invariantes compartidas del juego**.

La unidad de trabajo sigue siendo el PR.

Cada PR debe:

- tener un alcance acotado;
- declarar sus dependencias;
- incluir sus propios tests;
- poder revisarse aisladamente;
- no mezclar cambios de producto no relacionados.

---

# Regla principal de paralelización

No mandar cinco agentes distintos a modificar simultáneamente:

- `server.js`
- `HostGame.jsx`
- `StudentGame.jsx`

sin un contrato común.

Eso produce velocidad aparente y después una cola enorme de conflictos, regresiones y comportamiento inconsistente.

Primero fijamos las **interfaces compartidas**.

Después paralelizamos agresivamente.

---

# OLA 1 — Fundaciones

Estos trabajos empiezan **todos en paralelo**.

---

## PR 1 — Contrato del juego

Este PR define las reglas compartidas sobre las que trabajan los demás agentes.

No necesita implementar toda la UI.

### Definir

Estados de una partida:

- lobby;
- pregunta abierta;
- pregunta cerrada;
- mostrando resultados;
- transición;
- finalizando;
- revelando podio;
- resultados finales;
- distribuyendo recompensas.

Payloads/eventos:

- apertura de pregunta;
- deadline;
- envío de respuesta;
- cierre de pregunta;
- resultado individual;
- ranking parcial;
- highlight;
- resultado final;
- revelación del podio.

Modelo de score:

- QTKN de la pregunta;
- QTKN acumulados;
- posición;
- posición anterior;
- diferencia con el puesto superior;
- correctas;
- racha.

### Curva definitiva

1º → **21 QTKN**

2º → 18

3º → 16

4º → 15

5º → 14

6º → 13

7º → 12

8º → 11

9º correcto en adelante → 10

Incorrecta / timeout → 0

### Ranking

1. QTKN;
2. respuestas correctas;
3. empate real si siguen iguales.

### Objetivo

Que backend, host y alumno hablen exactamente el mismo idioma.

---

## PR 2 — Scoring server-side

Puede desarrollarse en paralelo usando el contrato definido en PR 1.

### Incluye

- eliminar `speedScore` como dato confiado al cliente;
- registrar orden de llegada server-side;
- determinar respuesta correcta;
- asignar 21/18/16/etc.;
- actualizar QTKN acumulados;
- correctas;
- rachas;
- ranking;
- delta de posición;
- distancia al puesto inmediatamente superior.

### Tests obligatorios

Casos con:

- 1 alumno;
- 3 alumnos;
- 8 alumnos;
- 20+ alumnos;
- todos correctos;
- todos incorrectos;
- mezcla;
- empate en QTKN;
- empate QTKN + correctas;
- múltiples respuestas casi simultáneas;
- respuesta duplicada;
- respuesta después del cierre.

---

## PR 3 — Timer server-side

En paralelo.

### Incluye

- `openedAt`;
- `deadline`;
- cierre automático;
- cierre cuando respondieron todos;
- cierre anticipado por host;
- rechazo de respuestas tardías;
- deadline persistente al reconectar.

El timer del frontend es sólo una representación del deadline del servidor.

### Tests

- deadline normal;
- todos responden antes;
- host cierra antes;
- alumno responde exactamente en el borde;
- respuesta posterior;
- reconexión;
- cliente con reloj incorrecto;
- cliente que nunca envía `timeout`.

---

## PR 4 — Hardening de sockets y reconexiones

En paralelo.

### Resolver

- eventos duplicados;
- handlers duplicados;
- idempotencia;
- doble respuesta;
- reconexión del host;
- reconexión del alumno;
- pregunta abierta durante reconnect;
- resultados durante reconnect;
- distribución durante reconnect.

### Invariante

Desconectarse y volver a entrar nunca cambia el resultado del juego.

---

## PR 5 — Room codes con BIP-39

Completamente paralelo.

### Incluye

Dos palabras tomadas de una whitelist basada en la wordlist inglesa de BIP-39.

Ejemplo:

`cactus maple`

Normalizar:

- espacios;
- guiones;
- mayúsculas/minúsculas.

### Tests

- generación;
- colisiones;
- normalización;
- lookup;
- códigos inválidos;
- reconexión;
- dos salas simultáneas.

---

## PR 6 — Base de español rioplatense

Completamente paralelo.

En vez de reemplazar strings al azar, crear una capa centralizada de copy cuando tenga sentido.

Traducir las pantallas existentes que no están siendo rediseñadas.

### Regla

Todo copy **nuevo** que creen los demás PRs debe nacer directamente en español.

No implementar primero:

`Correct!`

para después traducirlo.

Implementar directamente:

`¡Correcto!`

---

## PR 7 — Contrato NFT

Puede arrancar desde el día uno porque casi no depende del frontend.

### NFT de podio

- ERC-721;
- no transferible;
- oro / plata / bronce;
- soporte para empates;
- identificador único de quiz/session.

### Metadata

- puesto;
- fecha;
- clase;
- quiz;
- QTKN;
- correctas;
- total de preguntas;
- nickname;
- wallet;
- session ID.

### Importante

Fecha y clase van:

**en la imagen + en metadata.**

La imagen es presentación.

La metadata es la fuente estructurada.

### Tests del contrato

- mint autorizado;
- mint no autorizado;
- transferencia bloqueada;
- empate;
- duplicación;
- metadata;
- permisos;
- supply;
- comportamiento ante mint repetido.

---

## PR 8 — Harness de tests end-to-end

También empieza desde el día uno.

Este PR es importante porque permite que los agentes posteriores validen el juego automáticamente.

Crear escenarios automatizados con varios alumnos simulados.

### Escenarios base

- 3 alumnos;
- 10 alumnos;
- 25 alumnos;
- todos contestan;
- algunos timeout;
- desconexiones;
- reconnect;
- final;
- empate;
- distribución.

El harness debe poder afirmar:

- scoring esperado;
- ranking esperado;
- cierre correcto;
- estado del host;
- estado de cada alumno.

---

# OLA 2 — Experiencia de juego

Arranca en cuanto el contrato de PR 1 está estable.

No hace falta esperar a que absolutamente toda la Ola 1 esté mergeada.

Se pueden levantar varios agentes trabajando contra las interfaces acordadas.

---

## PR 9 — Resultado personal

Pantalla del alumno después de cada pregunta.

Mostrar:

- correcto / incorrecto;
- QTKN de esa pregunta;
- QTKN totales;
- posición;
- ↑ / ↓ posiciones;
- racha;
- distancia al puesto inmediatamente superior.

Ejemplo:

**✅ ¡Correcto! +18 QTKN**

**Estás 5º ↑2**

**Te faltan 4 QTKN para alcanzar a Sofi**

No mostrar todo el ranking.

---

## PR 10 — Top 3 público

Pantalla del profesor/proyector.

Mostrar únicamente:

🥇 1º  
🥈 2º  
🥉 3º

No top 5.

No ranking completo.

El resto de los alumnos sólo conoce su propia posición desde el celular.

---

## PR 11 — Motor de highlights

Puede ser un módulo separado, idealmente una función pura.

Inputs:

- ranking anterior;
- ranking actual;
- rachas;
- respuestas de la pregunta;
- porcentaje de aciertos;
- highlights recientes.

Output:

**como máximo un highlight.**

### Prioridad

1. entrada al podio;
2. cambio relevante de podio;
3. subida de 3+ puestos;
4. racha;
5. resultado colectivo;
6. primero en acertar.

### Regla

Evitar repetir protagonista dos rondas consecutivas cuando exista otra historia válida.

### Tests

Este módulo se presta muy bien para una batería grande de casos unitarios generados por agentes.

---

## PR 12 — Presentación del highlight

Separado de la lógica del PR 11.

Implementa:

- animación;
- copy;
- duración;
- transición hacia la siguiente pregunta.

Así un agente trabaja la lógica y otro la presentación sin pisarse.

---

# OLA 3 — Final de partida

También puede correr prácticamente en paralelo con la Ola 2.

---

## PR 13 — Estado de suspense final

Después de la última pregunta:

el servidor calcula el resultado pero **no lo revela todavía a los alumnos**.

El celular muestra:

**🏁 Terminó el quiz**

**👀 Mirá la pantalla**

No recibe todavía:

- puesto final;
- oro/plata/bronce;
- resultado definitivo.

---

## PR 14 — Revelación del podio

Pantalla pública:

1. cierre;
2. pequeña pausa;
3. 🥉 tercero;
4. 🥈 segundo;
5. 🥇 primero;
6. resultado completo.

### Regla fundamental

La pantalla pública es la primera en revelar quién terminó en el podio.

No repetir el problema de Kahoot donde el alumno ya sabe el resultado desde su celular.

---

## PR 15 — Release del resultado individual

Después de terminar la revelación pública, el servidor libera los resultados finales a los celulares.

Mostrar:

- puesto final;
- QTKN;
- correctas;
- podio;
- distancia al anterior si corresponde.

El ganador simplemente ve:

**🥇 Terminaste 1º**

---

# OLA 4 — Integración blockchain

Puede desarrollarse mientras se prueba la experiencia del juego, pero no debe bloquearla.

---

## PR 16 — Generación del NFT visual

Separado del contrato.

Generar arte del trofeo con:

- 🥇 / 🥈 / 🥉;
- clase;
- nombre del quiz;
- fecha;
- resultado.

Ejemplo:

**🥇 1º puesto**

**Clase 7 — Bitcoin y Lightning**

**1 de septiembre de 2026**

**184 QTKN · 9/10**

---

## PR 17 — Coordinador de recompensas

Resolver el requisito:

**una sola interacción/firma del profesor.**

Debe coordinar:

- QTKN;
- NFTs de podio.

La implementación técnica puede ser un contrato coordinador u otra arquitectura equivalente.

El requisito de producto no cambia:

**el profesor confirma una vez.**

---

## PR 18 — Retry y fallos on-chain

Separar explícitamente este comportamiento.

Si falla NFT:

- el resultado sigue existiendo;
- el podio sigue visible;
- el quiz termina;
- QTKN no deben quedar innecesariamente bloqueados;
- queda un estado reintentable.

Blockchain nunca congela el aula.

---

# OLA 5 — Vitrina

## PR 19 — Historial de podios

Mostrar:

- oros;
- platas;
- bronces;
- detalle del quiz;
- fecha;
- clase.

Ejemplo:

**Sofi · 🥇×2 · 🥈×1**

---

## PR 20 — Logros en lobby

Cuando entra un alumno que ya tiene podios:

**Sofi entró · 🥇×2**

Sin exagerarlo.

Es reconocimiento histórico, no ventaja económica.

---

# Agentes de calidad permanentes

Además de los agentes que implementan PRs, levantar agentes cuyo único trabajo sea intentar romper lo que hicieron los demás.

---

## Agente QA — unit/integration

Por cada PR:

- inspecciona diff;
- identifica invariantes;
- agrega casos borde;
- ejecuta suite;
- reporta regresiones.

No escribe features.

---

## Agente E2E

Corre partidas completas automatizadas.

Especialmente:

- multiplayer;
- timers;
- reconnect;
- último segundo;
- podio;
- empates.

---

## Agente Mobile

Valida las tres escenas críticas en viewport real de teléfono:

1. responder;
2. ver resultado personal;
3. ver resultado final.

El mobile gate no es una feature futura.

Es requisito de cada PR que toque StudentGame.

---

## Agente de seguridad

Prueba principalmente:

- manipular payloads;
- mandar respuestas duplicadas;
- falsear timestamps;
- enviar respuesta después del deadline;
- cambiar wallet/address;
- llamar eventos de host siendo alumno;
- doble mint;
- distribución repetida.

Especialmente importante porque es una app de una materia de blockchain: algún alumno eventualmente va a intentar romperla, y estaría buenísimo que no pueda.

---

## Agente de copy

Recorre UI final buscando:

- inglés residual;
- español neutro raro;
- inconsistencias;
- mensajes técnicos expuestos al alumno.

Objetivo:

**100% español rioplatense visible.**

---

## Agente integrador

No desarrolla features.

Su trabajo es:

- mantener el grafo de dependencias;
- rebasear PRs;
- resolver conflictos;
- asegurar compatibilidad entre eventos;
- ejecutar la suite agregada;
- decidir cuándo una ola está lista para merge.

Este rol es clave con muchos agentes.

---

# Estrategia de merge

No esperar a tener veinte PRs abiertos para integrarlos todos juntos.

Usar integración continua.

### Primer bloque

Mergear apenas estén verdes:

**PR 1 — contrato**

**PR 2 — scoring**

**PR 3 — timer**

**PR 4 — reconnect/hardening**

con QA entre cada merge.

---

Room code, español, NFT y harness pueden entrar independientemente cuando estén verdes:

**PR 5**

**PR 6**

**PR 7**

**PR 8**

---

Después integrar de manera incremental:

**PR 9 → PR 10 → PR 11 → PR 12**

y en otro carril:

**PR 13 → PR 14 → PR 15**

No hace falta terminar completamente el carril de preguntas para trabajar sobre el carril del final.

---

# Uso de branches/worktrees

Cada agente de implementación trabaja sobre:

- branch propia;
- idealmente worktree propio;
- alcance explícito.

No compartir un working tree mutable entre agentes.

Los PRs dependientes pueden branch-ear temporalmente desde la rama del contrato mientras PR 1 todavía está en review.

Cuando PR 1 mergea:

- rebase;
- tests;
- continuar.

---

# Política de calidad

Un agente que termina código **no significa que el PR está terminado**.

Definition of Done:

1. implementación;
2. tests del autor;
3. revisión de agente independiente;
4. tests adicionales del reviewer si encuentra huecos;
5. suite completa;
6. E2E cuando corresponda;
7. mobile cuando corresponda;
8. seguridad cuando corresponda;
9. `git diff --check`;
10. merge.

---

# Qué buscamos optimizar

No:

**cantidad de código generado por hora.**

Sí:

**cantidad de comportamiento validado que llega a main por hora.**

Con una suite agéntica, escribir el código probablemente sea la parte rápida.

El cuello de botella pasa a ser:

- integración;
- conflictos;
- invariantes compartidas;
- tests;
- detectar regresiones antes de llevarlas al aula.

Por eso conviene tener muchos agentes construyendo, pero también varios agentes intentando demostrar que lo construido está mal.