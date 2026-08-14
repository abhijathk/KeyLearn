import { type GuideTranslation } from "../guide-content.tsx";

export const nl: GuideTranslation = {
  kicker: "Alles wat je kunt doen",
  title: "Gebruikershandleiding",
  dateline:
    "De complete gids voor KeyLearn — van je eerste bezoek tot het afmelden",
  navLabel: "Op deze pagina",
  sections: [
    {
      id: "account",
      nav: "Heb ik een account nodig?",
      heading: "Heb ik een account nodig?",
      blocks: [
        {
          p: "Nee. Je kunt beginnen met typen op het moment dat je aankomt, en je voortgang wordt hier gewoon op dit apparaat bewaard. Maak alleen een gratis account aan als je wilt dat je geschiedenis met je meereist naar andere apparaten, als je een back-up wilt houden of een profiellink wilt delen. Niets nuttigs zit achter het aanmelden verstopt.",
        },
      ],
    },
    {
      id: "signin",
      nav: "Aanmelden en wachtwoorden",
      heading: "Registreren, inloggen en wachtwoorden",
      blocks: [
        { p: "Alles zit in het menu rechtsboven." },
        { lab: "Een account aanmaken" },
        {
          steps: [
            "Open het menu (rechtsboven).",
            "Kies Registreren.",
            "Voer een e-mailadres en een wachtwoord in.",
            "Bevestig — je bent binnen.",
          ],
        },
        { lab: "Inloggen" },
        {
          steps: [
            "Open het menu en kies Inloggen.",
            "Voer je e-mailadres en wachtwoord in.",
          ],
        },
        { lab: "Een vergeten wachtwoord opnieuw instellen" },
        {
          steps: [
            "Kies op het inlogscherm Wachtwoord vergeten.",
            "Voer je e-mailadres in.",
            "Open de herstellink die we je sturen.",
            "Kies een nieuw wachtwoord en log in.",
          ],
        },
      ],
    },
    {
      id: "profiles",
      nav: "Profielen",
      heading: "Profielen voor het hele huishouden",
      blocks: [
        {
          p: "KeyLearn is opgebouwd als een huishouden: één account bevat tot vier profielen (acht met premium), volwassenen en kinderen in elke samenstelling. Elk profiel houdt zijn *eigen* aparte voortgang bij op dit apparaat — er wordt nooit iets door elkaar gehaald.",
        },
        { lab: "Een profiel toevoegen" },
        {
          steps: [
            "Open het menu en kies Account (of “Profielen instellen”).",
            "Selecteer Een profiel toevoegen.",
            "Typ een voornaam.",
            "Markeer het als een Volwassene of een Kind.",
            "Kies een avatar — een vriendelijk icoontje of een Foto van je apparaat.",
            "Voeg voor een kind een geboortejaar toe (dat stemt alleen de woorden en het tempo af op hun leeftijd).",
            "Opslaan.",
          ],
        },
        { lab: "Naar een andere leerling wisselen" },
        {
          steps: [
            "Open het menu.",
            "Tik op een gezicht onder Leerlingen — de app gaat verder waar zij gebleven waren.",
          ],
        },
        { lab: "Een profiel bewerken of verwijderen" },
        {
          steps: [
            "Open het menu en kies Account.",
            "Kies Bewerken bij een profiel, of verwijder het om een plek vrij te maken.",
          ],
        },
        {
          p: "Kinderprofielen krijgen een vereenvoudigd, vergrendeld menu, en acties voor volwassenen zitten achter een snelle “hoeveel is A keer B?”-rekenpoort, zodat de kleintjes niet in de instellingen kunnen verdwalen.",
        },
      ],
    },
    {
      id: "screen",
      nav: "Het oefenscherm",
      heading: "Het oefenscherm",
      blocks: [
        {
          p: "Begin gewoon met typen. Het woord dat je nodig hebt zweeft net boven het toetsenbord op het scherm; een gloeiende komeet wijst naar de eerstvolgende toets; de toetsen zijn getint per vingerzone zodat je leert welke vinger waar reikt; en een vaag paar rustende handen laat zien waar je vingers tussen de aanslagen door verblijven. De hele vaardigheid draait om één gewoonte: houd je ogen op de woorden, niet op je handen.",
        },
      ],
    },
    {
      id: "journey",
      nav: "Jouw reis",
      heading: "Hoe lessen groeien — jouw reis",
      blocks: [
        {
          p: "KeyLearn is *adaptief*. Het meet hoe snel en zuiver je elke toets aanslaat en voegt pas een nieuwe letter aan je set toe zodra je de huidige zowel snel als accuraat kunt typen. Die groeiende set is jouw reis, van een handvol letters tot het hele alfabet — de moeilijkheid stijgt precies zo snel als jij, nooit sneller, zodat je altijd precies aan je grens werkt.",
        },
      ],
    },
    {
      id: "readout",
      nav: "Live statistieken",
      heading: "De live weergave",
      blocks: [
        {
          p: "Terwijl je typt, toont het zwevende paneel je huidige snelheid en nauwkeurigheid, een klein grafiekje van recente runs, je doelen en je reeks. Het is er om je aan te moedigen, niet om te zeuren.",
        },
      ],
    },
    {
      id: "tools",
      nav: "Oefengereedschap",
      heading: "Oefengereedschap",
      blocks: [
        {
          p: "Met de kleine hulpmiddelen naast de tekst kun je een rondleiding openen, de huidige les opnieuw starten (Ctrl + Links), naar de volgende springen (Ctrl + Rechts), het toetsenbord op het scherm tonen of verbergen, en de oefentekst vergroten of verkleinen. Het tandwiel opent de volledige Instellingen, die hierna worden beschreven.",
        },
      ],
    },
    {
      id: "content",
      nav: "Wat je typt",
      heading: "Kiezen wat je typt",
      blocks: [
        {
          p: "Open Instellingen en ga naar Oefeninhoud om te kiezen hoe je woorden worden samengesteld:",
        },
        {
          tips: [
            "*Begeleide oefening* — de adaptieve standaard die je alfabet toets voor toets laat groeien.",
            "*Klassieke cursus* — een vaste, geordende mars door de toetsen.",
            "*Veelvoorkomende woorden* — de meest gebruikte woorden in jouw taal.",
            "*Boektekst* — typ je een weg door echte boeken die in de app zijn ingebouwd.",
            "*Je eigen tekst* — plak wat je maar wilt en oefen daarop.",
            "*Codefragmenten* — haakjes, symbolen en het ritme van code.",
            "*Cijferoefeningen* — de cijferrij en het numerieke toetsenblok.",
          ],
        },
        { lab: "Verander wat je typt" },
        {
          steps: [
            "Open Instellingen (het tandwiel bij de oefentekst).",
            "Ga naar Oefeninhoud.",
            "Kies een modus — voor Boektekst kies je een boek, voor Je eigen tekst plak je je woorden.",
            "Sluit Instellingen en blijf typen.",
          ],
        },
        {
          p: "Op datzelfde scherm stel je de grootte van je alfabet in, een streefsnelheid, hoe lang elke les duurt en een dagelijks doel.",
        },
      ],
    },
    {
      id: "smart",
      nav: "Slim oefenen",
      heading: "Hulpjes voor slim oefenen",
      blocks: [
        {
          p: "Bovenop de begeleide oefening voegt Slim oefenen zachte hulpjes toe: een knelpuntoefening die je traagste toetsparen opspoort, gespreide herhaling, opfrissers tegen vaardigheidsverval die roestige toetsen weer oppakken, slim vertrouwen en toetsherstel. Ze staan allemaal standaard aan.",
        },
        { lab: "Een hulpje aan- of uitzetten" },
        {
          steps: [
            "Open Instellingen.",
            "Ga naar Slim oefenen.",
            "Schakel elk gewenst hulpje in of uit — of laat ze allemaal aan.",
          ],
        },
      ],
    },
    {
      id: "keyboard",
      nav: "Toetsenbord instellen",
      heading: "Je toetsenbord instellen",
      blocks: [
        {
          p: "Bij Instellingen, Toetsenbord instellen stem je KeyLearn af op je toetsenbord en op de indeling die je wilt leren.",
        },
        { lab: "Je toetsenbordindeling wijzigen" },
        {
          steps: [
            "Open Instellingen.",
            "Ga naar Toetsenbord instellen.",
            "Kies je taal en daarna je indeling (QWERTY, Dvorak, Colemak en meer).",
            "Laat “Deze indeling simuleren” aan staan zodat je hem kunt oefenen ongeacht waarop je computer is ingesteld.",
            "Bekijk het live voorbeeld om het te bevestigen.",
          ],
        },
        {
          p: "Op hetzelfde scherm kun je de vorm van het toetsenbord kiezen, de toetsen inkleuren per vingerzone en de volgende toets uitlichten terwijl je nog leert waar alles zit.",
        },
      ],
    },
    {
      id: "display",
      nav: "Weergave",
      heading: "Weergave en gevoel",
      blocks: [
        {
          p: "Met de instellingen voor Weergave en Tekstinvoer kun je je snelheid tonen in woorden- of tekens-per-minuut en fijnafstemmen hoe het typen aanvoelt. Standaardwaarden herstellen is altijd één klik verwijderd als je opnieuw wilt beginnen.",
        },
      ],
    },
    {
      id: "progress",
      nav: "Je voortgang",
      heading: "Je voortgang — de Profielpagina",
      blocks: [
        {
          p: "De Profielpagina is je volledige verslag: statistieken voor Levenslang en Vandaag bovenaan (geoefende tijd, voltooide lessen, je beste en gebruikelijke snelheid en nauwkeurigheid, en hoe vandaag zich verhoudt); een kaart van elke letter die je hebt ontgrendeld; het verhaal van hoe elke afzonderlijke toets sneller is geworden, met een gladstrijkschuif; het grote geheel van elke toets in de loop van de tijd; en de traagste overgangen die je nog tegenhouden. Je kunt zelfs tegen je eigen vorige run als een schaduw racen om de voortgang direct te voelen.",
        },
        { lab: "Je voortgang openen" },
        {
          steps: [
            "Open het menu.",
            "Kies Profiel.",
            "Gebruik de filterrij om je te richten op Letters, Cijfers, Leestekens of Symbolen.",
          ],
        },
      ],
    },
    {
      id: "data",
      nav: "Je gegevens",
      heading: "Voor je gegevens zorgen",
      blocks: [
        { lab: "De statistieken van een profiel wissen" },
        {
          steps: [
            "Open Profiel voor de leerling die je wilt resetten.",
            "Scrol naar de resetknop onderaan de pagina.",
            "Bevestig “Alles wissen” — alleen dit profiel wordt gewist.",
          ],
        },
        { lab: "Je gegevens downloaden" },
        {
          steps: [
            "Open Profiel.",
            "Gebruik de downloadoptie om je geschiedenis als bestand op te slaan.",
          ],
        },
        {
          p: "Log in als je wilt dat je geschiedenis synchroniseert tussen apparaten en om een openbare profiellink te delen. Er zijn geen advertenties en geen trackers, en je kunt je gegevens — of je hele account — verwijderen wanneer je maar wilt.",
        },
      ],
    },
    {
      id: "kids",
      nav: "Kindermodus",
      heading: "Kindermodus",
      blocks: [
        {
          p: "Kinderen oefenen op een speels pad. Elke juiste toets laat hun personage een stap dichter naar huis lopen, en het personage groeit van een piepklein baby'tje tot een volwassen held naarmate er meer letters worden ontgrendeld. Een nieuw geleerde toets zet een klein feestje in gang, en elke sessie eindigt bij een knus kampvuur.",
        },
        { lab: "Naar Kinderen wisselen" },
        {
          steps: [
            "Open het menu.",
            "Kies Kinderen — of kies een kinderprofiel onder Leerlingen.",
          ],
        },
        {
          p: "Er zijn twee werelden om uit te kiezen — Dino Run, met een vriendelijke dinosaurus, en Hero Trail, waar een ridder door een bos op avontuur gaat — elk met een personage om te kiezen.",
        },
      ],
    },
    {
      id: "toybox",
      nav: "Speelgoedkist voor kinderen",
      heading: "De speelgoedkist voor kinderen",
      blocks: [
        { lab: "De speelgoedkist openen" },
        {
          steps: [
            "Tik op het kinderscherm op het tandwiel bovenaan het speelgebied.",
          ],
        },
        {
          p: "Daarin kun je de wereld en het personage instellen, Grote letters, Geluiden, Helpende handen (de gloeiende vingergids), het Toetsenbord (verborgen, eenvoudig of het volledige bord voor volwassenen), Letters op het pad (de woorden getoond als blokken midden in het spel), een sessie-Timer, Aanmoedigingen (bemoedigende berichtjes), en — verstopt onder Geavanceerd — schuiven voor Helderheid, Kleur en hoe levendig de wereld aanvoelt. Er is een rustige nachtweergave naast de heldere dagweergave.",
        },
      ],
    },
    {
      id: "ages",
      nav: "Opgroeien",
      heading: "Meegroeien met je kind",
      blocks: [
        {
          p: "KeyLearn stemt zichzelf stilletjes af op de leeftijd van een kind. De jongsten zien grote, vriendelijke letters, een vergevingsgezind tempo, letterblokken direct op het pad en de zachtste hulp; oudere kinderen stromen door naar langere woorden, het volledige toetsenbord en een strakkere weergave. Stel gewoon het geboortejaar in op het profiel en de rest volgt vanzelf.",
        },
      ],
    },
    {
      id: "modes",
      nav: "Andere modi",
      heading: "Andere manieren om te oefenen",
      blocks: [
        {
          p: "Naast je dagelijkse oefening is er een *Snelheidstest* — een korte eenmalige passage die je woorden-per-minuut en nauwkeurigheid rapporteert zonder les eraan verbonden; een *Indelingen*-verkenner om toetsenbordindelingen en hun vingerkaarten te vergelijken; *Topscores* om te zien hoe je ervoor staat; en *Multiplayer*-races om je snelheid in realtime tegen anderen af te zetten.",
        },
        { lab: "Ze vinden" },
        {
          steps: [
            "Open het menu.",
            "Kies Snelheidstest, Indelingen, Topscores of Multiplayer.",
          ],
        },
      ],
    },
    {
      id: "access",
      nav: "Als iets in de weg zit",
      heading: "Als iets in de app je in de weg zit",
      blocks: [
        {
          p: "Daar is een hele pagina voor, en die staat *per leerling* ingesteld — de aanpassingen van de één veranderen dus nooit iets voor een ander.",
        },
        { lab: "Zo open je hem" },
        {
          steps: [
            "Open het menu en kies Account.",
            "Kies Toegankelijkheid.",
            "Kies bovenaan de leerling en zet daarna zo veel instellingen aan als je nodig hebt.",
          ],
        },
        {
          p: "De vijf instellingen zijn te *combineren*. Iemand met dyslexie én een tremor heeft er twee nodig, en gedwongen worden er één te kiezen zou betekenen dat de app vraagt met welke moeilijkheid ze rekening wil houden.",
        },
        {
          tips: [
            "Rustig — er beweegt niets, er wordt niets geteld, er loopt geen klok, en een gemiste dag breekt je reeks niet.",
            "Minder tegelijk — het oefenen begint met alleen de woorden en het toetsenbord.",
            "Makkelijker te lezen — het lettertype dat voor dyslexie is gemaakt, meer ruimte tussen letters en regels, steviger tekst.",
            "Kleuren uit elkaar — vingerkleuren die ook bij kleurenblindheid verschillend blijven, en fouten die je hoort en niet alleen rood ziet.",
            "Stevigere handen — grotere dingen om aan te raken, nooit twee toetsen tegelijk, en een toets die zichzelf herhaalt telt niet dubbel.",
          ],
        },
        {
          p: "Daaronder opent *Alles zelf instellen* elke schakelaar afzonderlijk — vijftien stuks, waaronder de spreeksnelheid, ondertiteling van alles wat wordt uitgesproken, een vingernummer op elke toets, en hoe lang een herhaalde toets genegeerd wordt. Eén knop zet ze allemaal weer terug.",
        },
      ],
    },
    {
      id: "braille",
      nav: "Braille",
      heading: "Leren op een brailletoetsenbord",
      blocks: [
        {
          p: "Een leerling die blind of slechtziend is krijgt een heel andere pagina — invoer met zes toetsen, een leerlijn in cellen in plaats van letters, en gesproken begeleiding van begin tot eind. Het is een eigen manier om te leren typen, niet de pagina voor zienden die wordt voorgelezen.",
        },
        { lab: "Het aanzetten voor een leerling" },
        {
          steps: [
            "Open het menu en kies Account, dan Leerlingen.",
            "Bewerk de leerling, of voeg een nieuwe toe.",
            "Zet zichtondersteuning aan en sla op.",
          ],
        },
        {
          p: "Die leerling komt nu meteen op de braillepagina terecht zodra hij of zij aan de beurt is om te oefenen. De voortgang wordt in cellen geteld in plaats van in letters, en er valt een certificaat te verdienen op precies dezelfde voorwaarden als voor ieder ander.",
        },
      ],
    },
    {
      id: "courses",
      nav: "De twee cursussen",
      heading: "Begeleide oefening, Klassiek en code",
      blocks: [
        {
          p: "*Begeleide oefening* is de adaptieve cursus: hij kijkt welke toetsen je afremmen en bouwt je lessen daaromheen, en voegt pas een letter toe zodra je de letters die je hebt zowel snel als accuraat kunt typen.",
        },
        {
          p: "De *Klassieke cursus* is de ouderwetse — een vaste ladder van lessen in een vaste volgorde, zoals een typeboek het zou aanleren. Sommige mensen weten nu eenmaal graag wat er hierna komt.",
        },
        {
          p: "Het zijn aparte cursussen met een aparte geschiedenis, en een certificaat verdien je op de één of op de ander — nooit op de twee bij elkaar opgeteld, want dan zou je eerste week dubbel meetellen. De Cursuspagina in je account vertelt over welke van de twee ze rapporteert.",
        },
        {
          p: "*Codewerk* is een derde soort oefening: echte fragmenten in een taal die je zelf kiest, zodat de haakjes, puntkomma's en inspringingen de training krijgen die gewone tekst ze nooit geeft.",
        },
        { lab: "Ertussen wisselen" },
        {
          steps: [
            "Open op het oefenscherm de lesinstellingen.",
            "Kies Begeleide oefening, Klassieke cursus of Codewerk.",
          ],
        },
      ],
    },
    {
      id: "certificates",
      nav: "Certificaten",
      heading: "Een certificaat verdienen",
      blocks: [
        {
          p: "Een certificaat zegt dat een met naam genoemde leerling op een bepaalde datum in een bepaalde taal met een gemeten snelheid en nauwkeurigheid heeft getypt. Het wordt door ons uitgegeven — het is geen diploma dat een examencommissie of werkgever heeft toegezegd te erkennen — en het is een eerlijk bewijs van wat iemand daadwerkelijk heeft gedaan.",
        },
        { lab: "Zien hoe ver je nog moet" },
        {
          steps: [
            "Open het menu en kies Account.",
            "Kies Cursus.",
            "Elke leerling heeft een rij met alle voorwaarden erin en hoe ver het ermee staat.",
          ],
        },
        {
          p: "De voorwaarden zijn dingen als: elke letter geïntroduceerd, elke letter betrouwbaar en niet alleen maar één keer tegengekomen, genoeg lessen, genoeg verschillende dagen, en een snelheid en nauwkeurigheid die je volhoudt. Zijn ze allemaal gehaald, dan verschijnt op die rij een link om de proef af te leggen.",
        },
        {
          p: "De proef is kort en wordt op onze servers beoordeeld in plaats van in je browser. Haal je hem, dan wordt het certificaat uitgegeven met een nummer erop. Iedereen aan wie je dat nummer geeft, kan het nakijken op de pagina *Een certificaat controleren* — en jij bepaalt of je naam daarbij wordt getoond.",
        },
      ],
    },
    {
      id: "security",
      nav: "Je account veilig houden",
      heading: "Passkeys, codes en wie er heeft ingelogd",
      blocks: [
        {
          p: "Je kunt inloggen met een wachtwoord, met een aanbieder zoals Google, met een link die we naar je e-mail sturen — of met een *passkey*, en die zouden wij kiezen. Een passkey gebruikt de vingerafdruk, het gezicht of de pincode van je eigen apparaat; er is geen wachtwoord dat kan uitlekken, en met niets wat wij bewaren kan iemand als jou inloggen.",
        },
        { lab: "Een passkey toevoegen" },
        {
          steps: [
            "Open het menu en kies Account, dan Beveiliging.",
            "Kies Een passkey toevoegen en volg de aanwijzing van je apparaat.",
          ],
        },
        {
          p: "*Verificatie in twee stappen* is er ook, met een authenticator-app en herstelcodes voor het geval je je telefoon kwijtraakt. Druk ze af en bewaar ze ergens anders dan op die telefoon.",
        },
        {
          p: "Dezelfde pagina toont de recente activiteit — keren dat er is ingelogd, mislukte pogingen, een toegevoegde passkey, een gewijzigd wachtwoord — telkens met de globale locatie waar het vandaan kwam, zodat iets wat jij niet hebt gedaan meteen opvalt. Klopt er iets niet, dan beëindigt *overal uitloggen* elke sessie behalve die waarin je nu zit.",
        },
        {
          p: "Er is ook een *ouderpincode*, die de accountinstellingen op slot zet zodat een kind op het gezinsapparaat ze niet kan wijzigen en geen profiel kan verwijderen.",
        },
      ],
    },
    {
      id: "yours",
      nav: "Maak het van jou",
      heading: "Maak het van jou",
      blocks: [
        { lab: "Het thema wijzigen" },
        {
          steps: [
            "Open het menu en kies Account, dan Weergave.",
            "Kies licht, donker of het apparaat volgen.",
          ],
        },
        {
          p: "Als geen van de meegeleverde thema's het juiste is, kun je met de *themaontwerper* je eigen thema mengen — inclusief de vingerkleuren waarmee het toetsenbord je leert. De app meet het contrast van wat je kiest en weigert combinaties die niemand zou kunnen lezen.",
        },
        {
          p: "Elke leerling in huis kan een eigen kleur hebben, zodat een gedeeld apparaat toch aanvoelt alsof het van degene is die ervoor zit.",
        },
        { lab: "De taal van de site wijzigen" },
        {
          steps: ["Open het menu.", "Kies onder Sitetaal jouw taal."],
        },
        {
          p: "Op het oefenscherm kun je ook de tekst vergroten of verkleinen en geluiden aan- of uitzetten wanneer je maar wilt.",
        },
      ],
    },
    {
      id: "privacy",
      nav: "Privacy",
      heading: "Privacy, in één zin",
      blocks: [
        {
          p: "Geen advertenties en geen trackers. Het profiel van een kind verlaat nooit je browser. Log alleen in als je wilt synchroniseren of delen; anders blijft alles op dit apparaat, en ben je vrij om het op elk moment te verwijderen.",
        },
      ],
    },
    {
      id: "signout",
      nav: "Afmelden",
      heading: "Afmelden",
      blocks: [
        { lab: "Uitloggen" },
        { steps: ["Open het menu.", "Kies Uitloggen en bevestig."] },
        {
          p: "Je oefengeschiedenis blijft veilig op dit apparaat — en op je account, als je er een hebt gemaakt — klaar voor de volgende keer dat je gaat zitten om te typen.",
        },
      ],
    },
    {
      id: "tips",
      nav: "Tips",
      heading: "Een paar gewoonten die echt helpen",
      blocks: [
        {
          tips: [
            "Nauwkeurigheid vóór snelheid — zuiver typen is wat beklijft.",
            "Herstel fouten rustig; race niet om je in te halen.",
            "Laat je vingers rusten op de thuisrij — F en J hebben kleine bultjes.",
            "Een paar minuten elke dag is beter dan een uur eens per week.",
          ],
        },
      ],
    },
  ],
};
