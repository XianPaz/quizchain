// Copy visible. Español rioplatense. No nacer en inglés para traducir después.
// Ver docs/plan-ejecucion-suite-agentica.md — PR 6.

export const copy = {
  brand: "QUIZCHAIN",

  wallet: {
    connect: "Conectar MetaMask",
    connecting: "Conectando…",
    disconnect: "Desconectar",
    network: "Sepolia",
  },

  landing: {
    badge: "En Sepolia testnet",
    hero1: "JUGÁ.",
    hero2: "COMPETÍ.",
    hero3: "COBRÁ.",
    subtitle:
      "Un quiz en vivo para el aula. Si contestás bien y llegás antes, te llevás más QTKN directo a la wallet.",
    hostCta: "Armar un quiz",
    joinCta: "Entrar a un quiz",
    stats: [
      { label: "Primer puesto", value: "21 QTKN", sub: "por pregunta correcta" },
      { label: "Piso si acertás", value: "10 QTKN", sub: "desde el 9º en adelante" },
      { label: "Si fallás o no llegás", value: "0", sub: "sin premio de consuelo" },
    ],
    features: [
      {
        icon: "⚡",
        title: "El orden lo marca el server",
        desc: "No cuenta el reloj del celular. El primero en acertar se lleva 21 QTKN, el segundo 18, y así.",
      },
      {
        icon: "🦊",
        title: "Tu wallet, tus fichas",
        desc: "Conectás MetaMask en Sepolia. El profe confirma una vez y te llegan los QTKN.",
      },
      {
        icon: "🎮",
        title: "Se juega en el momento",
        desc: "Pregunta, timer y resultado personal. El ranking completo no se lo ve nadie desde el celu.",
      },
      {
        icon: "📝",
        title: "Quizzes propios",
        desc: "El profe sube un CSV con las preguntas, el tiempo y las opciones.",
      },
    ],
  },

  hostDashboard: {
    title: "SALA DEL PROFE",
    back: "Volver",
    tabUpload: "Subir quiz",
    tabPreview: (n) => `Vista previa (${n})`,
    templateTitle: "Plantilla de Google Sheets",
    templateIntro: "Armá una hoja con esta estructura y exportala como CSV:",
    templateRules: [
      ["Fila 1", "quiz_name en A1, el título del quiz en B1"],
      ["Fila 2", "dejala vacía"],
      ["Fila 3", "encabezados (van, pero no se importan)"],
      ["Fila 4+", "una pregunta por fila"],
      ["opciones", "de 2 a 6 columnas (option_a a option_f); las que no uses, vacías"],
      ["correct", "tiene que ser A, B, C, D, E o F, según las opciones que haya"],
      ["time_limit", "segundos, entre 5 y 120"],
    ],
    sheetsHint: "En Google Sheets: Archivo → Descargar → Valores separados por comas (.csv)",
    dropTitle: "Soltá el CSV acá",
    dropHint: "o hacé clic para buscarlo",
    csvOnly: "Subí un archivo .csv. En Google Sheets: Archivo → Descargar → CSV.",
    quizName: "NOMBRE DEL QUIZ",
    questions: "PREGUNTAS",
    uploadOther: "Subir otro archivo",
    launch: "Abrir la sala",
  },

  rejoin: {
    title: "Hay una sala abierta",
    body: "Estabas hosteando un quiz. ¿Volvés a entrar?",
    quizName: "NOMBRE DEL QUIZ",
    roomCode: "CÓDIGO DE SALA",
    wallet: "TU WALLET",
    rejoin: "Volver a la sala",
    leave: "Salir",
  },

  join: {
    title: "ENTRAR AL QUIZ",
    subtitle: "Ingresá las dos palabras que te dijo el profe",
    nickname: "Apodo",
    nicknamePlaceholder: "Cómo te van a ver en la sala",
    codePlaceholder: "cactus maple",
    connectFirst: "Conectá la wallet primero para llevarte los QTKN",
    missingWallet: "Conectá MetaMask primero.",
    badWallet: "La dirección de la wallet no cierra. Desconectá y volvé a conectar MetaMask.",
    missingNickname: "Poné un apodo.",
    shortCode: "El código es muy corto. Son dos palabras.",
    joining: "Entrando…",
    join: "Entrar",
  },

  game: {
    correct: "¡Correcto!",
    incorrect: "Incorrecto",
    timeout: "Se acabó el tiempo",
    lookAtScreen: "Mirá la pantalla",
    quizOver: "Terminó el quiz",
    waitingOthers: "Esperando al resto…",
    waitingHost: "Esperando al profe…",
    youAre: (rank) => `Estás ${rank}º`,
    gapToNext: (n, name) => `Te faltan ${n} QTKN para alcanzar a ${name}`,
    streak: (n) => `Racha de ${n}`,
    finishedFirst: "Terminaste 1º",
    qtkn: "QTKN",
  },

  highlights: {
    firstCorrect: (name, qtkn) => `⚡ ${name} acertó primero (+${qtkn} QTKN)`,
    climb: (name, delta, from, to) => `📈 ${name} subió ${delta} puestos (${from} → ${to})`,
    podium: (name) => `${name} entró al podio`,
    streak: (name, n) => `🔥 ${name} va ${n} seguidas`,
  },

  csv: {
    tooShort: "El archivo es muy corto. Tiene que seguir la plantilla.",
    missingQuizNameKey: "La celda A1 tiene que decir quiz_name. Revisá la plantilla.",
    missingQuizName: "Falta el nombre del quiz en la celda B1.",
    noQuestions: "No hay preguntas. Agregá por lo menos una desde la fila 4.",
    missingQuestion: (row) => `Fila ${row}: falta el texto de la pregunta.`,
    missingCorrect: (row) => `Fila ${row}: no encuentro la respuesta correcta (tiene que ser A–F).`,
    minOptions: (row) => `Fila ${row}: hacen falta por lo menos 2 opciones.`,
    maxOptions: (row) => `Fila ${row}: como máximo 6 opciones.`,
    correctMissingOption: (row, letter) =>
      `Fila ${row}: la respuesta "${letter}" apunta a una opción que no existe.`,
    badTime: (row) => `Fila ${row}: time_limit tiene que ser un número entre 5 y 120.`,
  },
};

export default copy;
