import { type GuideTranslation } from "../guide-content.tsx";

export const it: GuideTranslation = {
  kicker: "Tutto ciò che puoi fare",
  title: "Guida utente",
  dateline:
    "La guida completa a KeyLearn — dalla tua prima visita fino alla disconnessione",
  navLabel: "In questa pagina",
  sections: [
    {
      id: "account",
      nav: "Mi serve un account?",
      heading: "Mi serve un account?",
      blocks: [
        {
          p: "No. Puoi iniziare a digitare nell'istante in cui arrivi, e i tuoi progressi vengono salvati proprio qui su questo dispositivo. Crea un account gratuito solo se vuoi che la tua cronologia ti segua su altri dispositivi, tenere una copia di sicurezza o condividere un link al profilo. Nulla di utile è bloccato dietro l'accesso.",
        },
      ],
    },
    {
      id: "signin",
      nav: "Accesso e password",
      heading: "Registrazione, accesso e password",
      blocks: [
        { p: "Tutto si trova nel menu in alto a destra." },
        { lab: "Creare un account" },
        {
          steps: [
            "Apri il menu (in alto a destra).",
            "Scegli Registrati.",
            "Inserisci un'email e una password.",
            "Conferma — sei dentro.",
          ],
        },
        { lab: "Accedere" },
        {
          steps: [
            "Apri il menu e scegli Accedi.",
            "Inserisci la tua email e la tua password.",
          ],
        },
        { lab: "Reimpostare una password dimenticata" },
        {
          steps: [
            "Nella schermata di Accesso, scegli Password dimenticata.",
            "Inserisci il tuo indirizzo email.",
            "Apri il link di reimpostazione che ti inviamo.",
            "Scegli una nuova password e accedi.",
          ],
        },
      ],
    },
    {
      id: "profiles",
      nav: "Profili",
      heading: "Profili per tutta la famiglia",
      blocks: [
        {
          p: "KeyLearn è pensato come una famiglia: un account contiene fino a quattro profili (otto con il premium), grandi e piccoli in qualsiasi combinazione. Ogni profilo mantiene i *propri* progressi separati su questo dispositivo — nulla viene mai mescolato insieme.",
        },
        { lab: "Aggiungere un profilo" },
        {
          steps: [
            "Apri il menu e scegli Account (o “Configura profili”).",
            "Seleziona Aggiungi un profilo.",
            "Scrivi un nome.",
            "Contrassegnalo come Grande o Bambino.",
            "Scegli un avatar — un'icona simpatica, oppure una Foto dal tuo dispositivo.",
            "Per un bambino, aggiungi l'anno di nascita (serve solo ad adattare le parole e il ritmo alla sua età).",
            "Salva.",
          ],
        },
        { lab: "Passare a un altro allievo" },
        {
          steps: [
            "Apri il menu.",
            "Tocca un volto sotto Allievi — l'app riprende da dove aveva lasciato.",
          ],
        },
        { lab: "Modificare o rimuovere un profilo" },
        {
          steps: [
            "Apri il menu e scegli Account.",
            "Seleziona Modifica su un profilo, oppure eliminalo per liberare uno spazio.",
          ],
        },
        {
          p: "I profili dei bambini hanno un menu semplificato e protetto, e le azioni riservate ai grandi sono nascoste dietro un rapido enigma matematico “quanto fa A per B?”, così i più piccoli non possono finire nelle impostazioni.",
        },
      ],
    },
    {
      id: "screen",
      nav: "La schermata di pratica",
      heading: "La schermata di pratica",
      blocks: [
        {
          p: "Basta iniziare a digitare. La parola che ti serve fluttua appena sopra la tastiera sullo schermo; una cometa luminosa indica il tasto successivo; i tasti sono colorati per zona delle dita così impari quale dito raggiunge quale tasto; e una debole coppia di mani a riposo mostra dove vivono le tue dita tra una pressione e l'altra. Tutta l'abilità sta in un'unica abitudine: tieni gli occhi sulle parole, non sulle mani.",
        },
      ],
    },
    {
      id: "journey",
      nav: "Il tuo percorso",
      heading: "Come crescono le lezioni — il tuo percorso",
      blocks: [
        {
          p: "KeyLearn è *adattivo*. Misura con quanta rapidità e pulizia premi ogni tasto e aggiunge una nuova lettera al tuo insieme solo quando riesci a digitare quelle attuali in modo veloce e preciso. Quell'insieme che cresce è il tuo percorso, da una manciata di lettere all'intero alfabeto — la difficoltà sale esattamente alla tua stessa velocità, mai più in fretta, così lavori sempre proprio al tuo limite.",
        },
      ],
    },
    {
      id: "readout",
      nav: "Statistiche live",
      heading: "Il pannello in tempo reale",
      blocks: [
        {
          p: "Mentre digiti, il pannello fluttuante mostra la tua velocità e precisione attuali, un piccolo grafico delle prove recenti, l'andamento dei tuoi obiettivi e la tua serie. È lì per incoraggiarti, non per assillarti.",
        },
      ],
    },
    {
      id: "tools",
      nav: "Strumenti di pratica",
      heading: "Strumenti di pratica",
      blocks: [
        {
          p: "I piccoli strumenti accanto al testo ti permettono di aprire un tour guidato, riavviare la lezione corrente (Ctrl + Sinistra), passare alla successiva (Ctrl + Destra), mostrare o nascondere la tastiera sullo schermo e ridimensionare il testo di pratica. L'ingranaggio apre le Impostazioni complete, descritte qui di seguito.",
        },
      ],
    },
    {
      id: "content",
      nav: "Cosa digiti",
      heading: "Scegliere cosa digitare",
      blocks: [
        {
          p: "Apri le Impostazioni e vai su Contenuto di pratica per scegliere come sono composte le tue parole:",
        },
        {
          tips: [
            "*Pratica guidata* — l'impostazione adattiva predefinita che fa crescere il tuo alfabeto tasto dopo tasto.",
            "*Corso classico* — una marcia fissa e ordinata attraverso i tasti.",
            "*Parole frequenti* — le parole più comuni nella tua lingua.",
            "*Testi di libri* — digita attraverso veri libri integrati nell'app.",
            "*Il tuo testo* — incolla ciò che vuoi ed esercitati su di esso.",
            "*Frammenti di codice* — parentesi, simboli e il ritmo del codice.",
            "*Esercizi con i numeri* — la riga dei numeri e il tastierino.",
          ],
        },
        { lab: "Cambiare cosa digiti" },
        {
          steps: [
            "Apri le Impostazioni (l'ingranaggio vicino al testo di pratica).",
            "Vai su Contenuto di pratica.",
            "Scegli una modalità — per i Testi di libri scegli un libro, per Il tuo testo incolla le tue parole.",
            "Chiudi le Impostazioni e continua a digitare.",
          ],
        },
        {
          p: "La stessa schermata imposta la dimensione del tuo alfabeto, una velocità obiettivo, la durata di ogni lezione e un obiettivo giornaliero.",
        },
      ],
    },
    {
      id: "smart",
      nav: "Pratica intelligente",
      heading: "Aiuti della Pratica intelligente",
      blocks: [
        {
          p: "Oltre alla pratica guidata, la Pratica intelligente aggiunge aiuti delicati: un esercizio sui punti deboli che scova le tue coppie di tasti più lente, la ripetizione dilazionata, ripassi contro il calo delle abilità che rivisitano i tasti arrugginiti, la fiducia intelligente e il recupero dei tasti. Sono tutti attivi per impostazione predefinita.",
        },
        { lab: "Attivare o disattivare un aiuto" },
        {
          steps: [
            "Apri le Impostazioni.",
            "Vai su Pratica intelligente.",
            "Attiva o disattiva l'aiuto che preferisci — oppure lasciali tutti attivi.",
          ],
        },
      ],
    },
    {
      id: "keyboard",
      nav: "Configurazione tastiera",
      heading: "Configurare la tua tastiera",
      blocks: [
        {
          p: "Impostazioni, Configurazione tastiera è dove abbini KeyLearn alla tua tastiera e al layout che vuoi imparare.",
        },
        { lab: "Cambiare il layout della tastiera" },
        {
          steps: [
            "Apri le Impostazioni.",
            "Vai su Configurazione tastiera.",
            "Scegli la tua lingua, poi il tuo layout (QWERTY, Dvorak, Colemak e altri).",
            "Lascia attivo “Simula questo layout” così puoi esercitarti qualunque sia l'impostazione del tuo computer.",
            "Osserva l'anteprima in tempo reale per confermare.",
          ],
        },
        {
          p: "Nella stessa schermata puoi scegliere la forma della tastiera, colorare i tasti per zona delle dita ed evidenziare il tasto successivo mentre stai ancora imparando dove si trovano le cose.",
        },
      ],
    },
    {
      id: "display",
      nav: "Visualizzazione",
      heading: "Visualizzazione e sensazione",
      blocks: [
        {
          p: "Le impostazioni di Visualizzazione e Inserimento testo ti permettono di mostrare la tua velocità in parole o caratteri al minuto e di regolare con precisione la sensazione della digitazione. Ripristina impostazioni predefinite è sempre a un clic di distanza se vuoi ricominciare da capo.",
        },
      ],
    },
    {
      id: "progress",
      nav: "I tuoi progressi",
      heading: "I tuoi progressi — la pagina Profilo",
      blocks: [
        {
          p: "La pagina Profilo è il tuo registro completo: le statistiche di Sempre e di Oggi in alto (tempo di pratica, lezioni svolte, la tua velocità e precisione migliore e tipica, e come si confronta oggi); una mappa di ogni lettera che hai sbloccato; la storia di come ogni singolo tasto è diventato più veloce, con un cursore di smussatura; il quadro d'insieme di ogni tasto nel tempo; e le transizioni più lente che ancora ti trattengono. Puoi persino gareggiare contro la tua ultima prova come un fantasma per sentire i progressi in modo diretto.",
        },
        { lab: "Aprire i tuoi progressi" },
        {
          steps: [
            "Apri il menu.",
            "Scegli Profilo.",
            "Usa la riga dei filtri per concentrarti su Lettere, Cifre, Punteggiatura o Simboli.",
          ],
        },
      ],
    },
    {
      id: "data",
      nav: "I tuoi dati",
      heading: "Prendersi cura dei tuoi dati",
      blocks: [
        { lab: "Cancellare le statistiche di un profilo" },
        {
          steps: [
            "Apri il Profilo dell'allievo che vuoi azzerare.",
            "Scorri fino al comando di azzeramento in fondo alla pagina.",
            "Conferma “Cancella tutto” — viene azzerato solo questo profilo.",
          ],
        },
        { lab: "Scaricare i tuoi dati" },
        {
          steps: [
            "Apri il Profilo.",
            "Usa l'opzione di download per salvare la tua cronologia come file.",
          ],
        },
        {
          p: "Accedi se vuoi che la tua cronologia si sincronizzi tra i dispositivi e condividere un link pubblico al profilo. Non ci sono pubblicità né tracker, e puoi eliminare i tuoi dati — o il tuo intero account — quando vuoi.",
        },
      ],
    },
    {
      id: "kids",
      nav: "Modalità bambini",
      heading: "Modalità bambini",
      blocks: [
        {
          p: "I bambini si esercitano su un sentiero giocoso. Ogni tasto corretto avvicina il loro personaggio di un passo verso casa, e il personaggio cresce da un minuscolo neonato a un eroe adulto man mano che si sbloccano più lettere. Un tasto appena imparato scatena una piccola festa, e ogni sessione si conclude presso un accogliente falò.",
        },
        { lab: "Passare alla Modalità bambini" },
        {
          steps: [
            "Apri il menu.",
            "Scegli Bambini — oppure scegli un profilo bambino sotto Allievi.",
          ],
        },
        {
          p: "Ci sono due mondi tra cui scegliere — Dino Run, con un dinosauro simpatico, e Hero Trail, dove un cavaliere si avventura in una foresta — ognuno con un personaggio da scegliere.",
        },
      ],
    },
    {
      id: "toybox",
      nav: "Scatola dei giochi",
      heading: "La scatola dei giochi dei bambini",
      blocks: [
        { lab: "Aprire la scatola dei giochi" },
        {
          steps: [
            "Nella schermata dei bambini, tocca l'ingranaggio in cima all'area di gioco.",
          ],
        },
        {
          p: "All'interno puoi impostare il mondo e il personaggio, Lettere grandi, Suoni, Mani d'aiuto (la guida luminosa delle dita), la Tastiera (nascosta, semplice o la tastiera completa dei grandi), Lettere sul sentiero (le parole mostrate come blocchi proprio nel gioco), un Timer della sessione, Applausi (piccoli messaggi di incoraggiamento) e — nascosti sotto Avanzate — cursori per Luminosità, Colore e quanto è vivace il mondo. C'è anche un aspetto notturno tranquillo oltre a quello luminoso del giorno.",
        },
      ],
    },
    {
      id: "ages",
      nav: "Crescere",
      heading: "Crescere insieme al tuo bambino",
      blocks: [
        {
          p: "KeyLearn si adatta silenziosamente all'età di un bambino. I più piccoli vedono lettere grandi e amichevoli, un ritmo indulgente, blocchi di lettere proprio sul sentiero e l'aiuto più delicato; i bambini più grandi passano a parole più lunghe, alla tastiera completa e a un aspetto più pulito. Basta impostare l'anno di nascita sul profilo e il resto viene da sé.",
        },
      ],
    },
    {
      id: "modes",
      nav: "Altre modalità",
      heading: "Altri modi per esercitarsi",
      blocks: [
        {
          p: "Oltre alla tua pratica quotidiana c'è un *Test di velocità* — un rapido brano occasionale che riporta le tue parole al minuto e la precisione senza alcuna lezione collegata; un esploratore di *Layout* per confrontare i layout di tastiera e le loro mappe delle dita; una *Classifica* per vedere come ti posizioni; e le gare *Multigiocatore* per spingere la tua velocità contro gli altri in tempo reale.",
        },
        { lab: "Trovarli" },
        {
          steps: [
            "Apri il menu.",
            "Scegli Test di velocità, Layout, Classifica o Multigiocatore.",
          ],
        },
      ],
    },
    {
      id: "access",
      nav: "Se qualcosa ti ostacola",
      heading: "Se qualcosa dell'app ti ostacola",
      blocks: [
        {
          p: "C'è un'intera pagina dedicata a questo, e si imposta *per ogni allievo* — così le modifiche di una persona non cambiano mai quelle di nessun altro.",
        },
        { lab: "Aprirla" },
        {
          steps: [
            "Apri il menu e scegli Account.",
            "Scegli Accessibilità.",
            "Seleziona l'allievo in cima, poi attiva tutte le impostazioni che ti servono.",
          ],
        },
        {
          p: "Le cinque impostazioni si *combinano*. Chi è dislessico e ha un tremore ne ha bisogno di due, e costringerlo a sceglierne una sola equivarrebbe a un'app che chiede quale difficoltà accogliere.",
        },
        {
          tips: [
            "Con calma — nulla si muove, nulla viene contato, nulla è cronometrato, e un giorno saltato non spezza la serie.",
            "Meno cose alla volta — la pratica si apre con le sole parole e la tastiera.",
            "Più facile da leggere — il carattere creato per la dislessia, più spazio tra lettere e righe, testo più marcato.",
            "Colori distinti — colori delle dita che restano distinguibili anche con il daltonismo, ed errori segnalati con un suono oltre che in rosso.",
            "Mani più ferme — elementi più grandi da premere, mai due tasti insieme, e un tasto che si ripete da solo non viene contato due volte.",
          ],
        },
        {
          p: "Sotto di esse, *Imposto tutto da me* apre ogni singolo interruttore — quindici in tutto, tra cui la velocità della voce, i sottotitoli per tutto ciò che viene detto ad alta voce, il numero del dito su ogni tasto e per quanto tempo ignorare un tasto ripetuto. Un solo pulsante li riporta tutti com'erano.",
        },
      ],
    },
    {
      id: "braille",
      nav: "Braille",
      heading: "Imparare su una tastiera braille",
      blocks: [
        {
          p: "Un allievo cieco o ipovedente ottiene una pagina del tutto diversa — inserimento braille a sei tasti, un percorso fatto di celle invece che di lettere, e una guida vocale in ogni momento. È un modo diverso di imparare a digitare, non la pagina per vedenti letta ad alta voce.",
        },
        { lab: "Attivarlo per un allievo" },
        {
          steps: [
            "Apri il menu e scegli Account, poi Allievi.",
            "Modifica l'allievo, oppure aggiungine uno nuovo.",
            "Attiva il supporto per la vista e salva.",
          ],
        },
        {
          p: "Da quel momento quell'allievo va dritto alla pagina braille ogni volta che tocca a lui esercitarsi. I suoi progressi si contano in celle invece che in lettere, e può ottenere un certificato alle stesse condizioni di chiunque altro.",
        },
      ],
    },
    {
      id: "courses",
      nav: "I due corsi",
      heading: "Pratica guidata, Corso classico e codice",
      blocks: [
        {
          p: "*Pratica guidata* è il corso adattivo: osserva quali tasti ti rallentano e costruisce le lezioni attorno a essi, aggiungendo una lettera solo quando riesci a digitare quelle che hai già in modo veloce e preciso.",
        },
        {
          p: "*Corso classico* è quello all'antica — una scala fissa di lezioni in un ordine stabilito, come lo insegnerebbe un manuale di dattilografia. C'è semplicemente chi preferisce sapere che cosa viene dopo.",
        },
        {
          p: "Sono corsi separati con cronologie separate, e un certificato si ottiene sull'uno o sull'altro — mai sui due sommati insieme, il che conterebbe due volte la tua prima settimana. La pagina Corso nel tuo account dice a quale dei due si riferisce.",
        },
        {
          p: "*Codice sorgente* è un terzo tipo di pratica: frammenti veri in un linguaggio che scegli tu, così parentesi, punti e virgola e indentazione ricevono l'allenamento che la prosa normale non dà loro mai.",
        },
        { lab: "Passare dall'uno all'altro" },
        {
          steps: [
            "Nella schermata di pratica, apri le impostazioni della lezione.",
            "Scegli Pratica guidata, Corso classico o Codice sorgente.",
          ],
        },
      ],
    },
    {
      id: "certificates",
      nav: "Certificati",
      heading: "Ottenere un certificato",
      blocks: [
        {
          p: "Un certificato attesta che un allievo con un nome preciso ha digitato a una velocità e a una precisione misurate, in una determinata lingua, in una determinata data. Lo rilasciamo noi — non è un titolo che qualche ente d'esame o datore di lavoro abbia accettato di riconoscere — ed è una prova onesta di ciò che qualcuno ha davvero fatto.",
        },
        { lab: "Vedere quanto ti manca" },
        {
          steps: [
            "Apri il menu e scegli Account.",
            "Scegli Corso.",
            "Ogni allievo ha una riga che mostra tutte le condizioni, con il punto a cui è arrivato.",
          ],
        },
        {
          p: "Le condizioni sono cose come tutte le lettere introdotte, tutte le lettere affidabili e non solo incontrate, abbastanza lezioni, abbastanza giorni distinti, e una velocità e una precisione mantenute nel tempo. Quando sono tutte soddisfatte, su quella riga compare un link per sostenere la prova.",
        },
        {
          p: "La prova è breve, ed è valutata sui nostri server invece che nel tuo browser. Superala e il certificato viene rilasciato con sopra un numero. Chiunque riceva da te quel numero può verificarlo nella pagina *Verifica un certificato* — e sei tu a scegliere se mostrargli il tuo nome.",
        },
      ],
    },
    {
      id: "security",
      nav: "Tenere al sicuro il tuo account",
      heading: "Passkey, codici e chi ha effettuato l'accesso",
      blocks: [
        {
          p: "Puoi accedere con una password, con un provider come Google, con un link inviato alla tua email — oppure con una *passkey*, che è quella che sceglieremmo noi. Una passkey usa l'impronta, il volto o il PIN del tuo stesso dispositivo; non c'è nessuna password che possa trapelare, e nulla di ciò che conserviamo potrebbe essere usato per accedere al posto tuo.",
        },
        { lab: "Aggiungere una passkey" },
        {
          steps: [
            "Apri il menu e scegli Account, poi Sicurezza.",
            "Scegli Aggiungi una passkey e segui la richiesta del tuo dispositivo.",
          ],
        },
        {
          p: "C'è anche la *verifica in due passaggi*, che usa un'app di autenticazione, con codici di recupero nel caso perdessi il telefono. Stampali e tienili da qualche parte che non sia il telefono.",
        },
        {
          p: "La stessa pagina elenca l'attività recente — accessi, tentativi falliti, una passkey aggiunta, una password cambiata — ognuno con la posizione approssimativa da cui è arrivato, così qualcosa che non hai fatto tu si nota subito. Se qualcosa non torna, *disconnetti ovunque* chiude tutte le sessioni tranne quella che stai usando.",
        },
        {
          p: "C'è anche un *PIN genitore*, che blocca le impostazioni dell'account così un bambino sul dispositivo di famiglia non può cambiarle né eliminare un profilo.",
        },
      ],
    },
    {
      id: "yours",
      nav: "Rendilo tuo",
      heading: "Rendilo tuo",
      blocks: [
        { lab: "Cambiare il tema" },
        {
          steps: [
            "Apri il menu e scegli Account, poi Aspetto.",
            "Scegli chiaro, scuro o segui il dispositivo.",
          ],
        },
        {
          p: "Se nessuno dei temi già pronti è quello che vuoi, il *creatore di temi* ti permette di comporre il tuo — compresi i colori delle dita con cui la tastiera insegna. L'app misura il contrasto di qualunque cosa tu scelga e rifiuta le combinazioni che nessuno riuscirebbe a leggere.",
        },
        {
          p: "Ogni allievo della casa può avere il proprio colore, così un dispositivo condiviso continua a sembrare di chi ci si siede davanti.",
        },
        { lab: "Cambiare la lingua del sito" },
        {
          steps: [
            "Apri il menu.",
            "Sotto Lingua del sito, scegli la tua lingua.",
          ],
        },
        {
          p: "Nella schermata di pratica puoi anche ridimensionare il testo e attivare o disattivare i suoni quando preferisci.",
        },
      ],
    },
    {
      id: "privacy",
      nav: "Privacy",
      heading: "La privacy, in una frase",
      blocks: [
        {
          p: "Niente pubblicità e niente tracker. Il profilo di un bambino non lascia mai il tuo browser. Accedi solo se vuoi la sincronizzazione o la condivisione; altrimenti tutto rimane su questo dispositivo, e sei libero di eliminarlo in qualsiasi momento.",
        },
      ],
    },
    {
      id: "signout",
      nav: "Disconnessione",
      heading: "Disconnessione",
      blocks: [
        { lab: "Disconnettersi" },
        {
          steps: ["Apri il menu.", "Scegli Disconnetti e conferma."],
        },
        {
          p: "La tua cronologia di pratica rimane al sicuro su questo dispositivo — e sul tuo account, se ne hai creato uno — pronta per la prossima volta che ti siedi a digitare.",
        },
      ],
    },
    {
      id: "tips",
      nav: "Consigli",
      heading: "Alcune abitudini che aiutano davvero",
      blocks: [
        {
          tips: [
            "Prima la precisione, poi la velocità — è la digitazione pulita a rimanere.",
            "Correggi gli errori con calma; non affrettarti per recuperare.",
            "Appoggia le dita sulla riga base — F e J hanno piccole sporgenze.",
            "Pochi minuti ogni giorno valgono più di un'ora una volta a settimana.",
          ],
        },
      ],
    },
  ],
};
