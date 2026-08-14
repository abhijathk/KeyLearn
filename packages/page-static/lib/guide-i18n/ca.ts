import { type GuideTranslation } from "../guide-content.tsx";

export const ca: GuideTranslation = {
  kicker: "Tot el que pots fer",
  title: "Guia d'usuari",
  dateline:
    "La guia completa de KeyLearn — des de la primera visita fins a tancar la sessió",
  navLabel: "En aquesta pàgina",
  sections: [
    {
      id: "account",
      nav: "Necessito un compte?",
      heading: "Necessito un compte?",
      blocks: [
        {
          p: "No. Pots començar a escriure just en arribar, i el teu progrés es desa aquí mateix, en aquest dispositiu. Crea un compte gratuït només si vols que el teu historial et segueixi a altres dispositius, si en vols una còpia de seguretat o si vols compartir un enllaç de perfil. No hi ha res útil tancat darrere del registre.",
        },
      ],
    },
    {
      id: "signin",
      nav: "Inici de sessió i contrasenyes",
      heading: "Registrar-se, iniciar la sessió i contrasenyes",
      blocks: [
        { p: "Ho trobaràs tot al menú de dalt a la dreta." },
        { lab: "Crear un compte" },
        {
          steps: [
            "Obre el menú (a dalt a la dreta).",
            "Tria Registra't.",
            "Introdueix un correu electrònic i una contrasenya.",
            "Confirma — ja hi ets.",
          ],
        },
        { lab: "Iniciar la sessió" },
        {
          steps: [
            "Obre el menú i tria Inicia la sessió.",
            "Introdueix el teu correu i la teva contrasenya.",
          ],
        },
        { lab: "Restablir una contrasenya oblidada" },
        {
          steps: [
            "A la pantalla d'inici de sessió, tria He oblidat la contrasenya.",
            "Introdueix la teva adreça de correu.",
            "Obre l'enllaç de restabliment que t'enviem.",
            "Tria una contrasenya nova i inicia la sessió.",
          ],
        },
      ],
    },
    {
      id: "profiles",
      nav: "Perfils",
      heading: "Perfils per a tota la casa",
      blocks: [
        {
          p: "KeyLearn està pensat com una casa: un compte conté fins a quatre perfils (vuit amb premium), grans i petits en qualsevol combinació. Cada perfil manté el *seu propi* progrés en aquest dispositiu — mai no es barreja res.",
        },
        { lab: "Afegir un perfil" },
        {
          steps: [
            "Obre el menú i tria Compte (o «Configura els perfils»).",
            "Selecciona Afegeix un perfil.",
            "Escriu un nom.",
            "Marca'l com a Adult o Infant.",
            "Tria un avatar — una icona simpàtica, o una Foto del teu dispositiu.",
            "Per a un infant, afegeix l'any de naixement (només serveix per ajustar les paraules i el ritme a la seva edat).",
            "Desa.",
          ],
        },
        { lab: "Canviar a un altre aprenent" },
        {
          steps: [
            "Obre el menú.",
            "Toca una cara sota Aprenents — l'aplicació continua on ho havia deixat.",
          ],
        },
        { lab: "Editar o esborrar un perfil" },
        {
          steps: [
            "Obre el menú i tria Compte.",
            "Selecciona Edita en un perfil, o esborra'l per alliberar una plaça.",
          ],
        },
        {
          p: "Els perfils d'infant tenen un menú simplificat i protegit, i les accions de persona gran queden darrere d'un càlcul ràpid del tipus «quant fa A per B?», així els més petits no es fiquen dins de la configuració.",
        },
      ],
    },
    {
      id: "screen",
      nav: "La pantalla de pràctica",
      heading: "La pantalla de pràctica",
      blocks: [
        {
          p: "Només cal que comencis a escriure. La paraula que necessites flota just damunt del teclat en pantalla; un cometa lluminós assenyala la tecla següent; les tecles estan tenyides per zona de dit perquè aprenguis quin dit arriba on; i un parell de mans en repòs, gairebé transparents, mostren on viuen els teus dits entre pulsació i pulsació. Tota l'habilitat és un sol hàbit: mantén els ulls a les paraules, no a les mans.",
        },
      ],
    },
    {
      id: "journey",
      nav: "El teu viatge",
      heading: "Com creixen les lliçons — el teu viatge",
      blocks: [
        {
          p: "KeyLearn és *adaptatiu*. Mesura amb quina rapidesa i quina netedat prems cada tecla, i només afegeix una lletra nova al teu conjunt quan ja escrius les que tens de pressa i sense errors. Aquest conjunt que creix és el teu viatge, d'un grapat de lletres a tot l'abecedari — la dificultat puja exactament tan de pressa com tu, mai més, així sempre treballes just al teu límit.",
        },
      ],
    },
    {
      id: "readout",
      nav: "Estadístiques en directe",
      heading: "El marcador en directe",
      blocks: [
        {
          p: "Mentre escrius, el plafó flotant mostra la teva velocitat i precisió actuals, un petit gràfic de les últimes sessions, els teus objectius i la teva ratxa. Hi és per animar-te, no per empipar.",
        },
      ],
    },
    {
      id: "tools",
      nav: "Eines de pràctica",
      heading: "Eines de pràctica",
      blocks: [
        {
          p: "Les eines petites del costat del text et permeten obrir una visita guiada, reiniciar la lliçó actual (Ctrl + Esquerra), passar a la següent (Ctrl + Dreta), mostrar o amagar el teclat en pantalla i canviar la mida del text de pràctica. La roda dentada obre tota la Configuració, que es descriu tot seguit.",
        },
      ],
    },
    {
      id: "content",
      nav: "Què escrius",
      heading: "Triar què escrius",
      blocks: [
        {
          p: "Obre la Configuració i ves a Contingut de pràctica per triar com es fan les teves paraules:",
        },
        {
          tips: [
            "*Pràctica guiada* — l'opció adaptativa per defecte, que fa créixer el teu abecedari tecla a tecla.",
            "*Curs clàssic* — un recorregut fix i ordenat per les tecles.",
            "*Paraules freqüents* — les paraules més habituals de la teva llengua.",
            "*Text de llibre* — escriu-te llibres de veritat, dels que porta l'aplicació.",
            "*El teu propi text* — enganxa el que vulguis i practica-hi.",
            "*Fragments de codi* — parèntesis, símbols i el ritme del codi.",
            "*Exercicis de números* — la fila de números i el teclat numèric.",
          ],
        },
        { lab: "Canviar què escrius" },
        {
          steps: [
            "Obre la Configuració (la roda dentada al costat del text de pràctica).",
            "Ves a Contingut de pràctica.",
            "Tria un mode — per a Text de llibre tria un llibre, per a El teu propi text enganxa les teves paraules.",
            "Tanca la Configuració i continua escrivint.",
          ],
        },
        {
          p: "La mateixa pantalla defineix la mida del teu abecedari, una velocitat objectiu, quant dura cada lliçó i un objectiu diari.",
        },
      ],
    },
    {
      id: "smart",
      nav: "Pràctica intel·ligent",
      heading: "Els ajudants de la Pràctica intel·ligent",
      blocks: [
        {
          p: "A sobre de la pràctica guiada, la Pràctica intel·ligent hi afegeix ajudants discrets: un exercici de colls d'ampolla que caça les teves parelles de tecles més lentes, repetició espaiada, repassos contra l'oblit que tornen a les tecles rovellades, confiança intel·ligent i recuperació de tecles. Tots estan activats per defecte.",
        },
        { lab: "Activar o desactivar un ajudant" },
        {
          steps: [
            "Obre la Configuració.",
            "Ves a Pràctica intel·ligent.",
            "Activa o desactiva l'ajudant que vulguis — o deixa'ls tots engegats.",
          ],
        },
      ],
    },
    {
      id: "keyboard",
      nav: "Configuració del teclat",
      heading: "Configurar el teu teclat",
      blocks: [
        {
          p: "A Configuració, Configuració del teclat és on adaptes KeyLearn al teu teclat i a la disposició que vols aprendre.",
        },
        { lab: "Canviar la disposició del teclat" },
        {
          steps: [
            "Obre la Configuració.",
            "Ves a Configuració del teclat.",
            "Tria la teva llengua i després la teva disposició (QWERTY, Dvorak, Colemak i més).",
            "Deixa activat «Simula aquesta disposició» perquè puguis practicar-la sigui quina sigui la del teu ordinador.",
            "Mira la previsualització en directe per confirmar-ho.",
          ],
        },
        {
          p: "A la mateixa pantalla pots triar la forma del teclat, acolorir les tecles per zona de dit i il·luminar la tecla següent mentre encara estàs aprenent on és cada cosa.",
        },
      ],
    },
    {
      id: "display",
      nav: "Visualització",
      heading: "Visualització i sensació",
      blocks: [
        {
          p: "La configuració de Visualització i Entrada de text et deixa mostrar la velocitat en paraules o en caràcters per minut i afinar com se sent l'escriptura. Restaura els valors per defecte sempre és a un clic si vols començar de nou.",
        },
      ],
    },
    {
      id: "progress",
      nav: "El teu progrés",
      heading: "El teu progrés — la pàgina de Perfil",
      blocks: [
        {
          p: "La pàgina de Perfil és el teu registre complet: estadístiques de Sempre i d'Avui a dalt (temps practicat, lliçons fetes, la teva millor velocitat i precisió i les habituals, i com queda l'avui en comparació); un mapa de cada lletra que has desbloquejat; la història de com s'ha anat accelerant cada tecla, amb un control de suavitzat; la visió de conjunt de totes les tecles al llarg del temps; i les transicions més lentes que encara et frenen. Fins i tot pots córrer contra la teva última sessió com un fantasma per notar el progrés directament.",
        },
        { lab: "Obrir el teu progrés" },
        {
          steps: [
            "Obre el menú.",
            "Tria Perfil.",
            "Fes servir la fila de filtres per centrar-te en Lletres, Xifres, Puntuació o Símbols.",
          ],
        },
      ],
    },
    {
      id: "data",
      nav: "Les teves dades",
      heading: "Tenir cura de les teves dades",
      blocks: [
        { lab: "Esborrar les estadístiques d'un perfil" },
        {
          steps: [
            "Obre el Perfil de l'aprenent que vols reiniciar.",
            "Baixa fins al control de reinici, al final de la pàgina.",
            "Confirma «Esborra-ho tot» — només s'esborra aquest perfil.",
          ],
        },
        { lab: "Descarregar les teves dades" },
        {
          steps: [
            "Obre el Perfil.",
            "Fes servir l'opció de descàrrega per desar el teu historial com a fitxer.",
          ],
        },
        {
          p: "Inicia la sessió si vols que el teu historial se sincronitzi entre dispositius i poder compartir un enllaç de perfil públic. No hi ha anuncis ni rastrejadors, i pots esborrar les teves dades — o tot el compte — quan vulguis.",
        },
      ],
    },
    {
      id: "kids",
      nav: "Mode infantil",
      heading: "Mode infantil",
      blocks: [
        {
          p: "Els infants practiquen en un camí ple de joc. Cada tecla encertada fa avançar el seu personatge un pas cap a casa, i el personatge creix de nadó petitó fins a heroi ben gran a mesura que es desbloquegen més lletres. Una tecla acabada d'aprendre desencadena una petita festa, i cada sessió acaba en una foguera acollidora.",
        },
        { lab: "Passar al mode infantil" },
        {
          steps: [
            "Obre el menú.",
            "Tria Infants — o tria un perfil d'infant sota Aprenents.",
          ],
        },
        {
          p: "Hi ha dos mons per triar — Dino Run, amb un dinosaure simpàtic, i Hero Trail, on un cavaller fa camí per un bosc — cadascun amb un personatge per escollir.",
        },
      ],
    },
    {
      id: "toybox",
      nav: "Caixa de joguines",
      heading: "La caixa de joguines dels infants",
      blocks: [
        { lab: "Obrir la caixa de joguines" },
        {
          steps: [
            "A la pantalla infantil, toca la roda dentada de dalt de l'àrea de joc.",
          ],
        },
        {
          p: "A dins pots triar el món i el personatge, Lletres grans, Sons, Mans ajudants (la guia lluminosa dels dits), el Teclat (amagat, senzill o el complet de persones grans), Lletres al camí (les paraules mostrades com a blocs dins del joc mateix), un Temporitzador de sessió, Ànims (missatgets d'encoratjament) i — amagats sota Avançat — controls de Brillantor, Color i com de viu es veu el món. Hi ha un aspecte nocturn tranquil a més del diürn ben lluminós.",
        },
      ],
    },
    {
      id: "ages",
      nav: "Fer-se gran",
      heading: "Créixer amb el teu fill o filla",
      blocks: [
        {
          p: "KeyLearn s'ajusta discretament a l'edat de cada infant. Els més petits veuen lletres grosses i simpàtiques, un ritme indulgent, blocs de lletres al camí mateix i l'ajuda més suau; els més grans passen a paraules més llargues, al teclat complet i a un aspecte més net. Només cal posar l'any de naixement al perfil i la resta ve tot sol.",
        },
      ],
    },
    {
      id: "modes",
      nav: "Altres modes",
      heading: "Altres maneres de practicar",
      blocks: [
        {
          p: "Més enllà de la pràctica diària hi ha una *Prova de velocitat* — un text ràpid i únic que t'indica les paraules per minut i la precisió, sense cap lliçó al darrere; un explorador de *Disposicions* per comparar disposicions de teclat i els seus mapes de dits; *Millors puntuacions* per veure com et compares; i curses *Multijugador* per posar a prova la teva velocitat contra altres en temps real.",
        },
        { lab: "On trobar-ho" },
        {
          steps: [
            "Obre el menú.",
            "Tria Prova de velocitat, Disposicions, Millors puntuacions o Multijugador.",
          ],
        },
      ],
    },
    {
      id: "access",
      nav: "Si alguna cosa et destorba",
      heading: "Si alguna cosa de l'aplicació et destorba",
      blocks: [
        {
          p: "Hi ha tota una pàgina dedicada a això, i es configura *per a cada aprenent* — així els ajustos d'una persona no canvien mai els de ningú altre.",
        },
        { lab: "Com obrir-la" },
        {
          steps: [
            "Obre el menú i tria Compte.",
            "Tria Accessibilitat.",
            "Tria l'aprenent a dalt i després activa tants ajustos com et calguin.",
          ],
        },
        {
          p: "Els cinc ajustos es *combinen*. Algú amb dislèxia i tremolor en necessita dos, i obligar-lo a triar-ne només un seria com si l'aplicació li preguntés quina dificultat vol que li tinguin en compte.",
        },
        {
          tips: [
            "Calma — no es mou res, no es compta res, no es cronometra res, i saltar-se un dia no trenca la ratxa.",
            "Menys coses alhora — la pràctica s'obre només amb les paraules i el teclat.",
            "Més fàcil de llegir — la lletra feta per a la dislèxia, més espai entre lletres i línies, text més marcat.",
            "Colors ben diferenciats — colors de dits que continuen distingint-se amb daltonisme, i errors que sonen a més de veure's en vermell.",
            "Mans més estables — coses més grans per prémer, mai dues tecles alhora, i una tecla que es repeteix sola no compta dues vegades.",
          ],
        },
        {
          p: "A sota, *Ajustar-ho tot jo mateix* obre cada interruptor per separat — quinze en total, inclosos la velocitat de la veu, els subtítols de tot el que es diu en veu alta, un número de dit a cada tecla i quanta estona s'ha d'ignorar una tecla repetida. Un sol botó ho torna tot com estava.",
        },
      ],
    },
    {
      id: "braille",
      nav: "Braille",
      heading: "Aprendre amb un teclat braille",
      blocks: [
        {
          p: "Un aprenent cec o amb baixa visió té una pàgina completament diferent — entrada braille de sis tecles, un pla d'aprenentatge fet de cel·les en lloc de lletres i guia parlada de cap a cap. És una altra manera d'aprendre a escriure, no la pàgina per a vidents llegida en veu alta.",
        },
        { lab: "Activar-ho per a un aprenent" },
        {
          steps: [
            "Obre el menú i tria Compte, després Aprenents.",
            "Edita l'aprenent, o afegeix-ne un de nou.",
            "Activa el suport visual i desa.",
          ],
        },
        {
          p: "A partir d'ara, aquest aprenent va directe a la pàgina de braille sempre que li toqui practicar. El seu progrés es compta en cel·les en lloc de lletres, i pot obtenir un certificat amb les mateixes condicions que qualsevol altre.",
        },
      ],
    },
    {
      id: "courses",
      nav: "Els dos cursos",
      heading: "Pràctica guiada, Clàssic i codi",
      blocks: [
        {
          p: "*Pràctica guiada* és el curs adaptatiu: mira quines tecles et frenen i construeix les lliçons al voltant seu, i només afegeix una lletra quan ja escrius les que tens de pressa i sense errors.",
        },
        {
          p: "*Curs clàssic* és el de tota la vida — una escala fixa de lliçons en un ordre establert, tal com ho ensenyaria un manual de mecanografia. Hi ha qui simplement prefereix saber què ve després.",
        },
        {
          p: "Són cursos separats amb historials separats, i el certificat s'obté en un o en l'altre — mai amb els dos sumats, perquè això comptaria la teva primera setmana dues vegades. La pàgina Curs del teu compte diu de quin està informant.",
        },
        {
          p: "*Taller de codi* és un tercer tipus de pràctica: fragments reals en el llenguatge que triïs, perquè els parèntesis, els punts i comes i el sagnat rebin l'entrenament que la prosa normal no els dona mai.",
        },
        { lab: "Canviar d'un a l'altre" },
        {
          steps: [
            "A la pantalla de pràctica, obre la configuració de la lliçó.",
            "Tria Pràctica guiada, Curs clàssic o Taller de codi.",
          ],
        },
      ],
    },
    {
      id: "certificates",
      nav: "Certificats",
      heading: "Obtenir un certificat",
      blocks: [
        {
          p: "Un certificat diu que un aprenent amb nom i cognoms va escriure a una velocitat i una precisió mesurades, en una llengua concreta i en una data concreta. L'emetem nosaltres — no és una titulació que cap tribunal d'exàmens ni cap empresa hagi acordat reconèixer — i és una prova honesta del que algú va fer de debò.",
        },
        { lab: "Veure quant et falta" },
        {
          steps: [
            "Obre el menú i tria Compte.",
            "Tria Curs.",
            "Cada aprenent té una fila amb totes les condicions i com de lluny és de cadascuna.",
          ],
        },
        {
          p: "Les condicions són coses com haver vist totes les lletres, tenir-les totes ben assentades i no només vistes una vegada, prou lliçons, prou dies diferents, i una velocitat i una precisió sostingudes. Quan es compleixen totes, apareix a la fila un enllaç per fer la prova.",
        },
        {
          p: "La prova és curta, i es corregeix als nostres servidors, no al teu navegador. Si l'aproves, s'emet el certificat amb un número. Qualsevol persona a qui donis aquest número el pot comprovar a la pàgina *Comprova un certificat* — i tu tries si se li mostra el teu nom.",
        },
      ],
    },
    {
      id: "security",
      nav: "Mantenir el compte segur",
      heading: "Claus d'accés, codis i qui ha iniciat la sessió",
      blocks: [
        {
          p: "Pots iniciar la sessió amb una contrasenya, amb un proveïdor com ara Google, amb un enllaç enviat al teu correu — o amb una *clau d'accés*, que és la que triaríem nosaltres. Una clau d'accés fa servir l'empremta, la cara o el PIN del teu propi dispositiu; no hi ha cap contrasenya que es pugui filtrar, i res del que guardem serviria per iniciar la sessió com si fossis tu.",
        },
        { lab: "Afegir una clau d'accés" },
        {
          steps: [
            "Obre el menú i tria Compte, després Seguretat.",
            "Tria Afegeix una clau d'accés i segueix les indicacions del teu dispositiu.",
          ],
        },
        {
          p: "També hi ha la *verificació en dos passos*, amb una aplicació d'autenticació i codis de recuperació per si perds el telèfon. Imprimeix-los i guarda'ls en un lloc que no sigui el telèfon.",
        },
        {
          p: "La mateixa pàgina llista l'activitat recent — inicis de sessió, intents fallits, una clau d'accés afegida, una contrasenya canviada — cadascun amb la ubicació aproximada d'on venia, així és fàcil detectar alguna cosa que no hagis fet tu. Si hi veus res estrany, *tanca la sessió a tot arreu* acaba totes les sessions menys la que fas servir.",
        },
        {
          p: "També hi ha un *PIN de pare o mare*, que bloqueja la configuració del compte perquè un infant del dispositiu familiar no la pugui canviar ni esborrar cap perfil.",
        },
      ],
    },
    {
      id: "yours",
      nav: "Fes-la teva",
      heading: "Fes-la teva",
      blocks: [
        { lab: "Canviar el tema" },
        {
          steps: [
            "Obre el menú i tria Compte, després Aparença.",
            "Tria clar, fosc, o seguir el dispositiu.",
          ],
        },
        {
          p: "Si cap dels temes que venen de sèrie no és el que vols, el *dissenyador de temes* et deixa fer-te'n un de propi — inclosos els colors dels dits amb què ensenya el teclat. L'aplicació mesura el contrast del que triïs i rebutja les combinacions que ningú no podria llegir.",
        },
        {
          p: "Cada aprenent de la casa pot tenir el seu color, així un dispositiu compartit continua semblant de qui hi seu.",
        },
        { lab: "Canviar l'idioma del lloc" },
        {
          steps: ["Obre el menú.", "A Idioma del lloc, tria la teva llengua."],
        },
        {
          p: "A la pantalla de pràctica també pots canviar la mida del text i activar o desactivar els sons quan vulguis.",
        },
      ],
    },
    {
      id: "privacy",
      nav: "Privadesa",
      heading: "La privadesa, en una frase",
      blocks: [
        {
          p: "Ni anuncis ni rastrejadors. El perfil d'un infant no surt mai del teu navegador. Inicia la sessió només si vols sincronitzar o compartir; si no, tot es queda en aquest dispositiu, i el pots esborrar quan vulguis.",
        },
      ],
    },
    {
      id: "signout",
      nav: "Tancar la sessió",
      heading: "Tancar la sessió",
      blocks: [
        { lab: "Tancar la sessió" },
        { steps: ["Obre el menú.", "Tria Tanca la sessió i confirma."] },
        {
          p: "El teu historial de pràctica es queda ben desat en aquest dispositiu — i al teu compte, si te n'has fet un — a punt per a la pròxima vegada que t'asseguis a escriure.",
        },
      ],
    },
    {
      id: "tips",
      nav: "Consells",
      heading: "Uns quants hàbits que ajuden de debò",
      blocks: [
        {
          tips: [
            "Primer la precisió, després la velocitat — el que s'aprèn de veritat és escriure net.",
            "Corregeix els errors amb calma; no corris per recuperar el temps.",
            "Descansa els dits a la fila central — la F i la J tenen un relleu petit.",
            "Uns minuts cada dia valen més que una hora un cop per setmana.",
          ],
        },
      ],
    },
  ],
};
