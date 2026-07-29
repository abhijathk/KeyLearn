import { type GuideTranslation } from "../guide-content.tsx";

export const es: GuideTranslation = {
  kicker: "Todo lo que puedes hacer",
  title: "Guía del usuario",
  dateline:
    "La guía completa de KeyLearn — desde tu primera visita hasta cerrar sesión",
  navLabel: "En esta página",
  sections: [
    {
      id: "account",
      nav: "¿Necesito una cuenta?",
      heading: "¿Necesito una cuenta?",
      blocks: [
        {
          p: "No. Puedes empezar a escribir en cuanto llegas, y tu progreso se guarda aquí mismo, en este dispositivo. Crea una cuenta gratuita solo si quieres que tu historial te acompañe a otros dispositivos, tener una copia de seguridad o compartir un enlace de perfil. Nada útil queda bloqueado tras iniciar sesión.",
        },
      ],
    },
    {
      id: "signin",
      nav: "Iniciar sesión y contraseñas",
      heading: "Registrarse, iniciar sesión y contraseñas",
      blocks: [
        { p: "Todo está en el menú de la esquina superior derecha." },
        { lab: "Crear una cuenta" },
        {
          steps: [
            "Abre el menú (arriba a la derecha).",
            "Elige Registrarse.",
            "Introduce un correo electrónico y una contraseña.",
            "Confirma — ya estás dentro.",
          ],
        },
        { lab: "Iniciar sesión" },
        {
          steps: [
            "Abre el menú y elige Iniciar sesión.",
            "Introduce tu correo electrónico y tu contraseña.",
          ],
        },
        { lab: "Restablecer una contraseña olvidada" },
        {
          steps: [
            "En la pantalla de Iniciar sesión, elige ¿Olvidaste tu contraseña?.",
            "Introduce tu dirección de correo electrónico.",
            "Abre el enlace de restablecimiento que te enviamos.",
            "Elige una contraseña nueva e inicia sesión.",
          ],
        },
      ],
    },
    {
      id: "profiles",
      nav: "Perfiles",
      heading: "Perfiles para toda la familia",
      blocks: [
        {
          p: "KeyLearn está pensado como un hogar: una cuenta aloja hasta cuatro perfiles (ocho con premium), grandes y pequeños en cualquier combinación. Cada perfil guarda su *propio* progreso por separado en este dispositivo — nada se mezcla nunca.",
        },
        { lab: "Añadir un perfil" },
        {
          steps: [
            "Abre el menú y elige Cuenta (o «Configurar perfiles»).",
            "Selecciona Añadir un perfil.",
            "Escribe un nombre.",
            "Márcalo como Adulto o Niño.",
            "Elige un avatar — un icono simpático, o una Foto de tu dispositivo.",
            "Para un niño, añade un año de nacimiento (solo ajusta las palabras y el ritmo a su edad).",
            "Guarda.",
          ],
        },
        { lab: "Cambiar a otro aprendiz" },
        {
          steps: [
            "Abre el menú.",
            "Toca una cara bajo Aprendices — la aplicación continúa donde lo dejó.",
          ],
        },
        { lab: "Editar o eliminar un perfil" },
        {
          steps: [
            "Abre el menú y elige Cuenta.",
            "Selecciona Editar en un perfil, o elimínalo para liberar un espacio.",
          ],
        },
        {
          p: "Los perfiles infantiles tienen un menú simplificado y protegido, y las acciones de adulto quedan tras una rápida barrera matemática de «¿cuánto es A por B?», para que los más pequeños no se metan por error en los ajustes.",
        },
      ],
    },
    {
      id: "screen",
      nav: "La pantalla de práctica",
      heading: "La pantalla de práctica",
      blocks: [
        {
          p: "Simplemente empieza a escribir. La palabra que necesitas flota justo encima del teclado en pantalla; un cometa brillante señala la siguiente tecla; las teclas están coloreadas por zona de dedo para que aprendas qué dedo llega a cada sitio; y un tenue par de manos en reposo muestra dónde viven tus dedos entre pulsaciones. Toda la destreza se reduce a un solo hábito: mantén la vista en las palabras, no en tus manos.",
        },
      ],
    },
    {
      id: "journey",
      nav: "Tu recorrido",
      heading: "Cómo crecen las lecciones — tu recorrido",
      blocks: [
        {
          p: "KeyLearn es *adaptativo*. Mide con qué rapidez y limpieza pulsas cada tecla y solo añade una letra nueva a tu conjunto cuando ya escribes las actuales con soltura y precisión. Ese conjunto que crece es tu recorrido, desde un puñado de letras hasta el alfabeto completo — la dificultad sube exactamente al mismo ritmo que tú, nunca más rápido, así siempre trabajas justo en tu límite.",
        },
      ],
    },
    {
      id: "readout",
      nav: "Estadísticas en vivo",
      heading: "Los datos en vivo",
      blocks: [
        {
          p: "Mientras escribes, el panel flotante muestra tu velocidad y precisión actuales, un pequeño gráfico de tus intentos recientes, el avance de tus metas y tu racha. Está ahí para animarte, no para regañarte.",
        },
      ],
    },
    {
      id: "tools",
      nav: "Herramientas de práctica",
      heading: "Herramientas de práctica",
      blocks: [
        {
          p: "Las pequeñas herramientas junto al texto te permiten abrir un recorrido guiado, reiniciar la lección actual (Ctrl + Izquierda), saltar a la siguiente (Ctrl + Derecha), mostrar u ocultar el teclado en pantalla y cambiar el tamaño del texto de práctica. El engranaje abre los Ajustes completos, que se describen a continuación.",
        },
      ],
    },
    {
      id: "content",
      nav: "Qué escribes",
      heading: "Elegir qué escribes",
      blocks: [
        {
          p: "Abre los Ajustes y ve a Contenido de práctica para elegir cómo se forman tus palabras:",
        },
        {
          tips: [
            "*Práctica guiada* — la opción adaptativa por defecto, que amplía tu alfabeto tecla a tecla.",
            "*Curso clásico* — un recorrido fijo y ordenado por las teclas.",
            "*Palabras frecuentes* — las palabras más comunes de tu idioma.",
            "*Texto de libros* — escribe a través de libros reales integrados en la aplicación.",
            "*Tu propio texto* — pega lo que quieras y practica con ello.",
            "*Fragmentos de código* — corchetes, símbolos y el ritmo del código.",
            "*Ejercicios de números* — la fila de números y el teclado numérico.",
          ],
        },
        { lab: "Cambiar qué escribes" },
        {
          steps: [
            "Abre los Ajustes (el engranaje junto al texto de práctica).",
            "Ve a Contenido de práctica.",
            "Elige un modo — para Texto de libros escoge un libro, para Tu propio texto pega tus palabras.",
            "Cierra los Ajustes y sigue escribiendo.",
          ],
        },
        {
          p: "En la misma pantalla se ajusta el tamaño de tu alfabeto, una velocidad objetivo, cuánto dura cada lección y una meta diaria.",
        },
      ],
    },
    {
      id: "smart",
      nav: "Práctica inteligente",
      heading: "Ayudas de la Práctica inteligente",
      blocks: [
        {
          p: "Además de la práctica guiada, la Práctica inteligente añade ayudas suaves: un ejercicio que rastrea los pares de teclas más lentos, repetición espaciada, repasos para las teclas que se oxidan, confianza inteligente y recuperación de teclas. Todas están activadas por defecto.",
        },
        { lab: "Activar o desactivar una ayuda" },
        {
          steps: [
            "Abre los Ajustes.",
            "Ve a Práctica inteligente.",
            "Activa la ayuda que quieras — o déjalas todas encendidas.",
          ],
        },
      ],
    },
    {
      id: "keyboard",
      nav: "Configuración del teclado",
      heading: "Configurar tu teclado",
      blocks: [
        {
          p: "En Ajustes, Configuración del teclado es donde ajustas KeyLearn a tu teclado y a la distribución que quieres aprender.",
        },
        { lab: "Cambiar la distribución del teclado" },
        {
          steps: [
            "Abre los Ajustes.",
            "Ve a Configuración del teclado.",
            "Elige tu idioma y luego tu distribución (QWERTY, Dvorak, Colemak y más).",
            "Deja activada «Simular esta distribución» para poder practicarla sea cual sea la configuración de tu ordenador.",
            "Observa la vista previa en vivo para confirmar.",
          ],
        },
        {
          p: "En la misma pantalla puedes elegir la forma del teclado, colorear las teclas por zona de dedo y resaltar la siguiente tecla mientras todavía aprendes dónde está cada cosa.",
        },
      ],
    },
    {
      id: "display",
      nav: "Pantalla",
      heading: "Apariencia y sensación",
      blocks: [
        {
          p: "Los ajustes de Pantalla y Entrada de texto te permiten mostrar tu velocidad en palabras o caracteres por minuto y afinar cómo se siente al escribir. Restaurar valores por defecto está siempre a un clic si quieres empezar de cero.",
        },
      ],
    },
    {
      id: "progress",
      nav: "Tu progreso",
      heading: "Tu progreso — la página de Perfil",
      blocks: [
        {
          p: "La página de Perfil es tu registro completo: estadísticas de Toda la vida y de Hoy en la parte superior (tiempo practicado, lecciones hechas, tu mejor velocidad y precisión y las habituales, y cómo se compara el día de hoy); un mapa de cada letra que has desbloqueado; la historia de cómo se ha ido acelerando cada tecla, con un control de suavizado; la visión de conjunto de todas las teclas a lo largo del tiempo; y las transiciones más lentas que aún te frenan. Incluso puedes competir contra tu último intento como un fantasma para sentir el progreso directamente.",
        },
        { lab: "Abrir tu progreso" },
        {
          steps: [
            "Abre el menú.",
            "Elige Perfil.",
            "Usa la fila de filtros para centrarte en Letras, Dígitos, Puntuación o Símbolos.",
          ],
        },
      ],
    },
    {
      id: "data",
      nav: "Tus datos",
      heading: "Cuidar de tus datos",
      blocks: [
        { lab: "Borrar las estadísticas de un perfil" },
        {
          steps: [
            "Abre el Perfil del aprendiz que quieras reiniciar.",
            "Desplázate hasta el control de reinicio al final de la página.",
            "Confirma «Borrar todo» — solo se borra este perfil.",
          ],
        },
        { lab: "Descargar tus datos" },
        {
          steps: [
            "Abre el Perfil.",
            "Usa la opción de descarga para guardar tu historial como un archivo.",
          ],
        },
        {
          p: "Inicia sesión si quieres que tu historial se sincronice entre dispositivos y compartir un enlace de perfil público. No hay anuncios ni rastreadores, y puedes eliminar tus datos — o toda tu cuenta — cuando quieras.",
        },
      ],
    },
    {
      id: "kids",
      nav: "Modo niños",
      heading: "Modo niños",
      blocks: [
        {
          p: "Los niños practican por un sendero divertido. Cada tecla correcta acerca un paso a su personaje a casa, y el personaje crece desde un pequeño bebé hasta un héroe adulto a medida que se desbloquean más letras. Una tecla recién aprendida desata una pequeña celebración, y cada sesión termina en una acogedora hoguera.",
        },
        { lab: "Cambiar al modo niños" },
        {
          steps: [
            "Abre el menú.",
            "Elige Niños — o escoge un perfil infantil bajo Aprendices.",
          ],
        },
        {
          p: "Hay dos mundos para elegir — Dino Run, con un dinosaurio simpático, y Hero Trail, donde un caballero se aventura por un bosque — cada uno con un personaje que escoger.",
        },
      ],
    },
    {
      id: "toybox",
      nav: "Baúl de juguetes",
      heading: "El baúl de juguetes",
      blocks: [
        { lab: "Abrir el baúl de juguetes" },
        {
          steps: [
            "En la pantalla de niños, toca el engranaje en la parte superior de la zona de juego.",
          ],
        },
        {
          p: "Dentro puedes ajustar el mundo y el personaje, Letras grandes, Sonidos, Manos de ayuda (la guía luminosa de dedos), el Teclado (oculto, simple o el tablero completo de adultos), Letras en el sendero (las palabras mostradas como bloques dentro del juego), un Temporizador de sesión, Ánimos (mensajitos alentadores) y — escondidos en Avanzado — controles para Brillo, Color y cuánta vida tiene el mundo. También hay un aspecto tranquilo de noche además del luminoso de día.",
        },
      ],
    },
    {
      id: "ages",
      nav: "Crecer",
      heading: "Crecer con tu hijo",
      blocks: [
        {
          p: "KeyLearn se ajusta discretamente a la edad de cada niño. Los más pequeños ven letras grandes y amables, un ritmo indulgente, bloques de letras justo en el sendero y la ayuda más suave; los mayores pasan a palabras más largas, el teclado completo y un aspecto más despejado. Basta con poner el año de nacimiento en el perfil y todo lo demás sigue por sí solo.",
        },
      ],
    },
    {
      id: "modes",
      nav: "Otros modos",
      heading: "Otras formas de practicar",
      blocks: [
        {
          p: "Más allá de tu práctica diaria hay una *Prueba de velocidad* — un pasaje rápido y puntual que informa de tus palabras por minuto y tu precisión sin lección asociada; un explorador de *Distribuciones* para comparar distribuciones de teclado y sus mapas de dedos; *Récords* para ver cómo te sitúas; y carreras *Multijugador* para medir tu velocidad contra otros en tiempo real.",
        },
        { lab: "Encontrarlos" },
        {
          steps: [
            "Abre el menú.",
            "Elige Prueba de velocidad, Distribuciones, Récords o Multijugador.",
          ],
        },
      ],
    },
    {
      id: "yours",
      nav: "Hazlo tuyo",
      heading: "Hazlo tuyo",
      blocks: [
        { lab: "Cambiar el tema" },
        {
          steps: [
            "Abre el menú.",
            "Usa el selector de tema — claro, oscuro o el aspecto de KeyLearn.",
          ],
        },
        { lab: "Cambiar el idioma del sitio" },
        {
          steps: [
            "Abre el menú.",
            "En Idioma del sitio, elige tu idioma.",
          ],
        },
        {
          p: "En la pantalla de práctica también puedes cambiar el tamaño del texto y activar o desactivar los sonidos cuando quieras.",
        },
      ],
    },
    {
      id: "privacy",
      nav: "Privacidad",
      heading: "La privacidad, en una frase",
      blocks: [
        {
          p: "Sin anuncios y sin rastreadores. El perfil de un niño nunca sale de tu navegador. Inicia sesión solo si quieres sincronización o compartir; de lo contrario todo se queda en este dispositivo, y eres libre de eliminarlo en cualquier momento.",
        },
      ],
    },
    {
      id: "signout",
      nav: "Cerrar sesión",
      heading: "Cerrar sesión",
      blocks: [
        { lab: "Cerrar sesión" },
        {
          steps: ["Abre el menú.", "Elige Cerrar sesión y confirma."],
        },
        {
          p: "Tu historial de práctica se queda a salvo en este dispositivo — y en tu cuenta, si creaste una — listo para la próxima vez que te sientes a escribir.",
        },
      ],
    },
    {
      id: "tips",
      nav: "Consejos",
      heading: "Unos cuantos hábitos que ayudan de verdad",
      blocks: [
        {
          tips: [
            "Precisión antes que velocidad — lo que se queda es escribir limpio.",
            "Corrige los errores con calma; no corras por recuperar el tiempo.",
            "Apoya los dedos en la fila central — la F y la J tienen pequeños relieves.",
            "Unos minutos cada día valen más que una hora una vez por semana.",
          ],
        },
      ],
    },
  ],
};
