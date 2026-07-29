import { type GuideTranslation } from "../guide-content.tsx";

export const de: GuideTranslation = {
  kicker: "Alles, was du tun kannst",
  title: "Benutzerhandbuch",
  dateline:
    "Das komplette Handbuch zu KeyLearn — vom ersten Besuch bis zum Abmelden",
  navLabel: "Auf dieser Seite",
  sections: [
    {
      id: "account",
      nav: "Brauche ich ein Konto?",
      heading: "Brauche ich ein Konto?",
      blocks: [
        {
          p: "Nein. Du kannst sofort losschreiben, sobald du ankommst, und dein Fortschritt wird direkt hier auf diesem Gerät gespeichert. Erstelle nur dann ein kostenloses Konto, wenn du möchtest, dass dein Verlauf dir auf andere Geräte folgt, du eine Sicherung behalten oder einen Profil-Link teilen willst. Nichts Nützliches ist hinter der Anmeldung verborgen.",
        },
      ],
    },
    {
      id: "signin",
      nav: "Anmelden und Passwörter",
      heading: "Registrieren, anmelden und Passwörter",
      blocks: [
        { p: "Alles findest du im Menü oben rechts." },
        { lab: "Ein Konto erstellen" },
        {
          steps: [
            "Öffne das Menü (oben rechts).",
            "Wähle Registrieren.",
            "Gib eine E-Mail-Adresse und ein Passwort ein.",
            "Bestätige — und schon bist du drin.",
          ],
        },
        { lab: "Anmelden" },
        {
          steps: [
            "Öffne das Menü und wähle Anmelden.",
            "Gib deine E-Mail-Adresse und dein Passwort ein.",
          ],
        },
        { lab: "Ein vergessenes Passwort zurücksetzen" },
        {
          steps: [
            "Wähle auf der Anmeldeseite Passwort vergessen.",
            "Gib deine E-Mail-Adresse ein.",
            "Öffne den Link zum Zurücksetzen, den wir dir senden.",
            "Wähle ein neues Passwort und melde dich an.",
          ],
        },
      ],
    },
    {
      id: "profiles",
      nav: "Profile",
      heading: "Profile für den ganzen Haushalt",
      blocks: [
        {
          p: "KeyLearn ist wie ein Haushalt aufgebaut: Ein Konto umfasst bis zu vier Profile (acht mit Premium), Erwachsene und Kinder in jeder Mischung. Jedes Profil behält seinen *eigenen* separaten Fortschritt auf diesem Gerät — nichts wird jemals vermischt.",
        },
        { lab: "Ein Profil hinzufügen" },
        {
          steps: [
            "Öffne das Menü und wähle Konto (oder „Profile einrichten“).",
            "Wähle Profil hinzufügen.",
            "Gib einen Vornamen ein.",
            "Markiere es als Erwachsener oder Kind.",
            "Wähle einen Avatar — ein freundliches Symbol oder ein Foto von deinem Gerät.",
            "Füge bei einem Kind ein Geburtsjahr hinzu (es passt nur die Wörter und das Tempo an das Alter an).",
            "Speichern.",
          ],
        },
        { lab: "Zu einem anderen Lernenden wechseln" },
        {
          steps: [
            "Öffne das Menü.",
            "Tippe auf ein Gesicht unter Lernende — die App macht dort weiter, wo aufgehört wurde.",
          ],
        },
        { lab: "Ein Profil bearbeiten oder entfernen" },
        {
          steps: [
            "Öffne das Menü und wähle Konto.",
            "Wähle Bearbeiten bei einem Profil oder lösche es, um einen Platz frei zu machen.",
          ],
        },
        {
          p: "Kinderprofile bekommen ein vereinfachtes, geschütztes Menü, und Aktionen für Erwachsene liegen hinter einer schnellen Rechenaufgabe „Was ist A mal B?“, damit die Kleinen nicht in die Einstellungen gelangen.",
        },
      ],
    },
    {
      id: "screen",
      nav: "Der Übungsbildschirm",
      heading: "Der Übungsbildschirm",
      blocks: [
        {
          p: "Fang einfach an zu tippen. Das Wort, das du brauchst, schwebt direkt über der Bildschirmtastatur; ein leuchtender Komet zeigt auf die nächste Taste; die Tasten sind nach Fingerzonen eingefärbt, damit du lernst, welcher Finger wohin reicht; und ein zartes Paar ruhender Hände zeigt, wo deine Finger zwischen den Anschlägen liegen. Die ganze Fertigkeit ist eine einzige Gewohnheit: Halte deine Augen auf den Wörtern, nicht auf deinen Händen.",
        },
      ],
    },
    {
      id: "journey",
      nav: "Deine Reise",
      heading: "Wie Lektionen wachsen — deine Reise",
      blocks: [
        {
          p: "KeyLearn ist *adaptiv*. Es misst, wie schnell und sauber du jede Taste triffst, und fügt deinem Set erst dann einen neuen Buchstaben hinzu, wenn du die aktuellen sowohl schnell als auch genau tippen kannst. Dieses wachsende Set ist deine Reise, von einer Handvoll Buchstaben bis zum ganzen Alphabet — die Schwierigkeit steigt genau so schnell wie du, nie schneller, sodass du immer genau an deiner Grenze arbeitest.",
        },
      ],
    },
    {
      id: "readout",
      nav: "Live-Statistiken",
      heading: "Die Live-Anzeige",
      blocks: [
        {
          p: "Während du tippst, zeigt das schwebende Panel deine aktuelle Geschwindigkeit und Genauigkeit, eine kleine Sparkline der letzten Durchläufe, deine Ziel-Fortschritte und deine Serie. Sie ist da, um dich zu ermutigen, nicht um zu nörgeln.",
        },
      ],
    },
    {
      id: "tools",
      nav: "Übungswerkzeuge",
      heading: "Übungswerkzeuge",
      blocks: [
        {
          p: "Mit den kleinen Werkzeugen neben dem Text kannst du eine geführte Tour öffnen, die aktuelle Lektion neu starten (Ctrl + Links), zur nächsten springen (Ctrl + Rechts), die Bildschirmtastatur ein- oder ausblenden und die Größe des Übungstextes anpassen. Das Zahnrad öffnet die vollständigen Einstellungen, die als Nächstes beschrieben werden.",
        },
      ],
    },
    {
      id: "content",
      nav: "Was du tippst",
      heading: "Auswählen, was du tippst",
      blocks: [
        {
          p: "Öffne die Einstellungen und gehe zu Übungsinhalt, um zu wählen, wie deine Wörter zusammengestellt werden:",
        },
        {
          tips: [
            "*Geführte Übung* — die adaptive Standardeinstellung, die dein Alphabet Taste für Taste erweitert.",
            "*Klassischer Kurs* — ein fester, geordneter Marsch durch die Tasten.",
            "*Häufige Wörter* — die gebräuchlichsten Wörter deiner Sprache.",
            "*Buchtext* — tippe dich durch echte Bücher, die in der App eingebaut sind.",
            "*Eigener Text* — füge alles ein, was dir gefällt, und übe damit.",
            "*Code-Schnipsel* — Klammern, Symbole und der Rhythmus des Codes.",
            "*Zahlenübungen* — die Zahlenreihe und der Ziffernblock.",
          ],
        },
        { lab: "Ändern, was du tippst" },
        {
          steps: [
            "Öffne die Einstellungen (das Zahnrad neben dem Übungstext).",
            "Gehe zu Übungsinhalt.",
            "Wähle einen Modus — bei Buchtext wähle ein Buch, bei Eigener Text füge deine Wörter ein.",
            "Schließe die Einstellungen und tippe weiter.",
          ],
        },
        {
          p: "Auf demselben Bildschirm legst du deine Alphabetgröße, eine Zielgeschwindigkeit, die Dauer jeder Lektion und ein Tagesziel fest.",
        },
      ],
    },
    {
      id: "smart",
      nav: "Intelligente Übung",
      heading: "Helfer der intelligenten Übung",
      blocks: [
        {
          p: "Zusätzlich zur geführten Übung bietet die Intelligente Übung sanfte Helfer: eine Engpass-Übung, die deine langsamsten Tastenpaare aufspürt, verteilte Wiederholung, Auffrischer gegen den Verfall von Fertigkeiten, die rostige Tasten erneut aufgreifen, intelligentes Selbstvertrauen und Tastenwiederherstellung. Sie sind alle standardmäßig aktiviert.",
        },
        { lab: "Einen Helfer ein- oder ausschalten" },
        {
          steps: [
            "Öffne die Einstellungen.",
            "Gehe zu Intelligente Übung.",
            "Schalte jeden Helfer nach Belieben um — oder lass sie alle an.",
          ],
        },
      ],
    },
    {
      id: "keyboard",
      nav: "Tastatur-Einrichtung",
      heading: "Deine Tastatur einrichten",
      blocks: [
        {
          p: "In den Einstellungen unter Tastatur-Einrichtung passt du KeyLearn an deine Tastatur und an das Layout an, das du lernen möchtest.",
        },
        { lab: "Dein Tastaturlayout ändern" },
        {
          steps: [
            "Öffne die Einstellungen.",
            "Gehe zu Tastatur-Einrichtung.",
            "Wähle deine Sprache, dann dein Layout (QWERTY, Dvorak, Colemak und mehr).",
            "Lass „Dieses Layout simulieren“ aktiviert, damit du es üben kannst, egal wie dein Computer eingestellt ist.",
            "Beobachte die Live-Vorschau zur Bestätigung.",
          ],
        },
        {
          p: "Auf demselben Bildschirm kannst du die Tastaturform wählen, die Tasten nach Fingerzonen einfärben und die nächste Taste hervorheben, solange du noch lernst, wo alles liegt.",
        },
      ],
    },
    {
      id: "display",
      nav: "Darstellung",
      heading: "Darstellung und Gefühl",
      blocks: [
        {
          p: "Mit den Einstellungen für Darstellung und Texteingabe kannst du deine Geschwindigkeit in Wörtern oder Zeichen pro Minute anzeigen und genau abstimmen, wie sich das Tippen anfühlt. Standardwerte wiederherstellen ist immer nur einen Klick entfernt, falls du neu beginnen möchtest.",
        },
      ],
    },
    {
      id: "progress",
      nav: "Dein Fortschritt",
      heading: "Dein Fortschritt — die Profilseite",
      blocks: [
        {
          p: "Die Profilseite ist dein vollständiger Verlauf: Lebenszeit- und Heute-Statistiken oben (geübte Zeit, absolvierte Lektionen, deine beste und typische Geschwindigkeit und Genauigkeit und wie sich der heutige Tag vergleicht); eine Karte aller Buchstaben, die du freigeschaltet hast; die Geschichte, wie jede einzelne Taste schneller geworden ist, mit einem Glättungsregler; das Gesamtbild jeder Taste über die Zeit; und die langsamsten Übergänge, die dich noch zurückhalten. Du kannst sogar gegen deinen eigenen letzten Durchlauf als Geist antreten, um den Fortschritt direkt zu spüren.",
        },
        { lab: "Deinen Fortschritt öffnen" },
        {
          steps: [
            "Öffne das Menü.",
            "Wähle Profil.",
            "Nutze die Filterzeile, um dich auf Buchstaben, Ziffern, Satzzeichen oder Symbole zu konzentrieren.",
          ],
        },
      ],
    },
    {
      id: "data",
      nav: "Deine Daten",
      heading: "Auf deine Daten achten",
      blocks: [
        { lab: "Die Statistiken eines Profils löschen" },
        {
          steps: [
            "Öffne Profil für den Lernenden, den du zurücksetzen möchtest.",
            "Scrolle zum Zurücksetzen-Steuerelement am Ende der Seite.",
            "Bestätige „Alles löschen“ — nur dieses Profil wird gelöscht.",
          ],
        },
        { lab: "Deine Daten herunterladen" },
        {
          steps: [
            "Öffne Profil.",
            "Nutze die Download-Option, um deinen Verlauf als Datei zu speichern.",
          ],
        },
        {
          p: "Melde dich an, wenn du möchtest, dass dein Verlauf über Geräte hinweg synchronisiert wird und du einen öffentlichen Profil-Link teilen kannst. Es gibt keine Werbung und keine Tracker, und du kannst deine Daten — oder dein gesamtes Konto — löschen, wann immer du willst.",
        },
      ],
    },
    {
      id: "kids",
      nav: "Kindermodus",
      heading: "Kindermodus",
      blocks: [
        {
          p: "Kinder üben auf einem verspielten Pfad. Jede richtige Taste bringt ihre Figur einen Schritt näher nach Hause, und die Figur wächst von einem winzigen Baby zu einem ausgewachsenen Helden, während mehr Buchstaben freigeschaltet werden. Eine neu gelernte Taste löst eine kleine Feier aus, und jede Sitzung endet an einem gemütlichen Lagerfeuer.",
        },
        { lab: "Zum Kindermodus wechseln" },
        {
          steps: [
            "Öffne das Menü.",
            "Wähle Kinder — oder wähle ein Kinderprofil unter Lernende.",
          ],
        },
        {
          p: "Es gibt zwei Welten zur Auswahl — Dino Run mit einem freundlichen Dinosaurier und Hero Trail, wo ein Ritter durch einen Wald zieht — jede mit einer Figur zum Auswählen.",
        },
      ],
    },
    {
      id: "toybox",
      nav: "Kinder-Spielkiste",
      heading: "Die Kinder-Spielkiste",
      blocks: [
        { lab: "Die Spielkiste öffnen" },
        {
          steps: [
            "Tippe auf dem Kinderbildschirm auf das Zahnrad oben im Spielbereich.",
          ],
        },
        {
          p: "Darin kannst du Welt und Figur einstellen, Große Buchstaben, Töne, Helferhände (die leuchtende Fingerführung), die Tastatur (versteckt, einfach oder das volle Erwachsenenbrett), Buchstaben auf dem Pfad (die als Blöcke direkt im Spiel gezeigten Wörter), einen Sitzungs-Timer, Jubel (ermutigende kleine Nachrichten) und — versteckt unter Erweitert — Regler für Helligkeit, Farbe und wie lebendig sich die Welt anfühlt. Es gibt auch ein ruhiges Nacht-Erscheinungsbild neben dem hellen Tag-Look.",
        },
      ],
    },
    {
      id: "ages",
      nav: "Aufwachsen",
      heading: "Mit deinem Kind mitwachsen",
      blocks: [
        {
          p: "KeyLearn stimmt sich unbemerkt auf das Alter eines Kindes ab. Die Jüngsten sehen große, freundliche Buchstaben, nachsichtiges Tempo, Buchstabenblöcke direkt auf dem Pfad und die sanfteste Hilfe; ältere Kinder steigen zu längeren Wörtern, der vollen Tastatur und einem klareren Look auf. Stell einfach das Geburtsjahr im Profil ein, und der Rest folgt von selbst.",
        },
      ],
    },
    {
      id: "modes",
      nav: "Weitere Modi",
      heading: "Weitere Möglichkeiten zu üben",
      blocks: [
        {
          p: "Über deine tägliche Übung hinaus gibt es einen *Geschwindigkeitstest* — eine schnelle einmalige Passage, die deine Wörter pro Minute und Genauigkeit ohne angehängte Lektion meldet; einen *Layouts*-Explorer zum Vergleichen von Tastaturlayouts und ihren Fingerkarten; *Bestenlisten*, um zu sehen, wie du dich schlägst; und *Mehrspieler*-Rennen, um deine Geschwindigkeit in Echtzeit gegen andere zu messen.",
        },
        { lab: "So findest du sie" },
        {
          steps: [
            "Öffne das Menü.",
            "Wähle Geschwindigkeitstest, Layouts, Bestenlisten oder Mehrspieler.",
          ],
        },
      ],
    },
    {
      id: "yours",
      nav: "Mach es zu deinem",
      heading: "Mach es zu deinem",
      blocks: [
        { lab: "Das Design ändern" },
        {
          steps: [
            "Öffne das Menü.",
            "Nutze den Design-Schalter — hell, dunkel oder den KeyLearn-Look.",
          ],
        },
        { lab: "Die Sprache der Seite ändern" },
        {
          steps: ["Öffne das Menü.", "Wähle unter Sprache der Seite deine Sprache."],
        },
        {
          p: "Auf dem Übungsbildschirm kannst du außerdem jederzeit die Textgröße anpassen und Töne ein- oder ausschalten, wann immer du möchtest.",
        },
      ],
    },
    {
      id: "privacy",
      nav: "Datenschutz",
      heading: "Datenschutz, in einem Satz",
      blocks: [
        {
          p: "Keine Werbung und keine Tracker. Das Profil eines Kindes verlässt niemals deinen Browser. Melde dich nur an, wenn du synchronisieren oder teilen möchtest; ansonsten bleibt alles auf diesem Gerät, und du kannst es jederzeit löschen.",
        },
      ],
    },
    {
      id: "signout",
      nav: "Abmelden",
      heading: "Abmelden",
      blocks: [
        { lab: "Abmelden" },
        { steps: ["Öffne das Menü.", "Wähle Abmelden und bestätige."] },
        {
          p: "Dein Übungsverlauf bleibt sicher auf diesem Gerät — und in deinem Konto, falls du eines erstellt hast — bereit für das nächste Mal, wenn du dich zum Tippen hinsetzt.",
        },
      ],
    },
    {
      id: "tips",
      nav: "Tipps",
      heading: "Ein paar Gewohnheiten, die wirklich helfen",
      blocks: [
        {
          tips: [
            "Genauigkeit vor Geschwindigkeit — sauberes Tippen ist das, was bleibt.",
            "Korrigiere Fehler in Ruhe; hetze nicht, um aufzuholen.",
            "Lass deine Finger auf der Grundreihe ruhen — F und J haben kleine Erhebungen.",
            "Ein paar Minuten jeden Tag sind besser als eine Stunde einmal pro Woche.",
          ],
        },
      ],
    },
  ],
};
