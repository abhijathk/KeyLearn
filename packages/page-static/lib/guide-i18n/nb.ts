import { type GuideTranslation } from "../guide-content.tsx";

export const nb: GuideTranslation = {
  kicker: "Alt du kan gjøre",
  title: "Brukerveiledning",
  dateline:
    "Den komplette guiden til KeyLearn — fra første besøk til du logger ut",
  navLabel: "På denne siden",
  sections: [
    {
      id: "account",
      nav: "Trenger jeg en konto?",
      heading: "Trenger jeg en konto?",
      blocks: [
        {
          p: "Nei. Du kan begynne å skrive i det øyeblikket du kommer inn, og fremgangen din lagres her på denne enheten. Opprett en gratis konto bare hvis du vil at historikken din skal følge deg til andre enheter, ha en sikkerhetskopi eller dele en profillenke. Ingenting nyttig er låst bak innlogging.",
        },
      ],
    },
    {
      id: "signin",
      nav: "Innlogging og passord",
      heading: "Registrering, innlogging og passord",
      blocks: [
        { p: "Alt ligger i menyen øverst til høyre." },
        { lab: "Opprett en konto" },
        {
          steps: [
            "Åpne menyen (øverst til høyre).",
            "Velg Registrer deg.",
            "Skriv inn en e-postadresse og et passord.",
            "Bekreft — og du er inne.",
          ],
        },
        { lab: "Logg inn" },
        {
          steps: [
            "Åpne menyen og velg Logg inn.",
            "Skriv inn e-postadressen og passordet ditt.",
          ],
        },
        { lab: "Tilbakestill et glemt passord" },
        {
          steps: [
            "På innloggingssiden velger du Glemt passord.",
            "Skriv inn e-postadressen din.",
            "Åpne lenken for tilbakestilling som vi sender deg.",
            "Velg et nytt passord og logg inn.",
          ],
        },
      ],
    },
    {
      id: "profiles",
      nav: "Profiler",
      heading: "Profiler for hele husstanden",
      blocks: [
        {
          p: "KeyLearn er bygget som en husstand: én konto rommer opptil fire profiler (åtte med premium), voksne og barn i hvilken som helst blanding. Hver profil beholder sin *egen* fremgang på denne enheten — ingenting blandes noen gang sammen.",
        },
        { lab: "Legg til en profil" },
        {
          steps: [
            "Åpne menyen og velg Konto (eller «Sett opp profiler»).",
            "Velg Legg til en profil.",
            "Skriv inn et fornavn.",
            "Merk den som Voksen eller Barn.",
            "Velg en avatar — et vennlig ikon, eller et Bilde fra enheten din.",
            "For et barn legger du til fødselsår (det justerer bare ordene og tempoet etter alderen).",
            "Lagre.",
          ],
        },
        { lab: "Bytt til en annen elev" },
        {
          steps: [
            "Åpne menyen.",
            "Trykk på et ansikt under Elever — appen fortsetter der de slapp.",
          ],
        },
        { lab: "Rediger eller fjern en profil" },
        {
          steps: [
            "Åpne menyen og velg Konto.",
            "Velg Rediger på en profil, eller slett den for å frigjøre en plass.",
          ],
        },
        {
          p: "Barneprofiler får en forenklet, låst meny, og handlinger for voksne ligger bak en rask «hva er A ganger B?»-regneoppgave, så de små ikke kan rote seg bort i innstillingene.",
        },
      ],
    },
    {
      id: "screen",
      nav: "Øvingsskjermen",
      heading: "Øvingsskjermen",
      blocks: [
        {
          p: "Bare begynn å skrive. Ordet du trenger svever rett over tastaturet på skjermen; en glødende komet peker på den aller neste tasten; tastene er farget etter fingersone slik at du lærer hvilken finger som når hvor; og et svakt par hvilende hender viser hvor fingrene dine bor mellom anslagene. Hele ferdigheten er én vane: hold øynene på ordene, ikke på hendene.",
        },
      ],
    },
    {
      id: "journey",
      nav: "Reisen din",
      heading: "Hvordan leksjonene vokser — reisen din",
      blocks: [
        {
          p: "KeyLearn er *adaptiv*. Den måler hvor raskt og rent du treffer hver tast, og legger først en ny bokstav til settet ditt når du kan skrive de nåværende både raskt og nøyaktig. Det voksende settet er reisen din, fra en håndfull bokstaver til hele alfabetet — vanskelighetsgraden stiger nøyaktig like fort som du gjør, aldri fortere, så du jobber alltid akkurat på grensen din.",
        },
      ],
    },
    {
      id: "readout",
      nav: "Live-statistikk",
      heading: "Live-visningen",
      blocks: [
        {
          p: "Mens du skriver, viser det svevende panelet farten og nøyaktigheten din akkurat nå, en liten kurve over de siste øktene, målsporene dine og rekken din. Det er der for å oppmuntre deg, ikke for å mase.",
        },
      ],
    },
    {
      id: "tools",
      nav: "Øvingsverktøy",
      heading: "Øvingsverktøy",
      blocks: [
        {
          p: "De små verktøyene ved siden av teksten lar deg åpne en guidet omvisning, starte leksjonen på nytt (Ctrl + venstre), hoppe til den neste (Ctrl + høyre), vise eller skjule tastaturet på skjermen og endre størrelsen på øvingsteksten. Tannhjulet åpner de fullstendige Innstillingene, som beskrives nedenfor.",
        },
      ],
    },
    {
      id: "content",
      nav: "Det du skriver",
      heading: "Velge hva du skriver",
      blocks: [
        {
          p: "Åpne Innstillinger og gå til Øvingsinnhold for å velge hvordan ordene dine settes sammen:",
        },
        {
          tips: [
            "*Guidet øving* — det adaptive standardvalget som utvider alfabetet ditt tast for tast.",
            "*Klassisk kurs* — en fast, ordnet marsj gjennom tastene.",
            "*Vanlige ord* — de vanligste ordene på språket ditt.",
            "*Boktekst* — skriv deg gjennom ekte bøker som er innebygd i appen.",
            "*Din egen tekst* — lim inn hva du vil og øv på det.",
            "*Kodesnutter* — parenteser, symboler og rytmen i kode.",
            "*Talløvelser* — tallrekken og det numeriske tastaturet.",
          ],
        },
        { lab: "Endre hva du skriver" },
        {
          steps: [
            "Åpne Innstillinger (tannhjulet ved øvingsteksten).",
            "Gå til Øvingsinnhold.",
            "Velg en modus — for Boktekst velger du en bok, for Din egen tekst limer du inn ordene dine.",
            "Lukk Innstillinger og skriv videre.",
          ],
        },
        {
          p: "På samme skjerm angir du alfabetstørrelsen, en målfart, hvor lenge hver leksjon varer og et daglig mål.",
        },
      ],
    },
    {
      id: "smart",
      nav: "Smart øving",
      heading: "Hjelperne i Smart øving",
      blocks: [
        {
          p: "På toppen av den guidede øvingen legger Smart øving til milde hjelpere: en flaskehalsøvelse som jakter på de tregeste tasteparene dine, spredt repetisjon, oppfriskere mot ferdighetsforfall som tar opp igjen rustne taster, smart selvtillit og tastegjenoppretting. Alle er på som standard.",
        },
        { lab: "Slå en hjelper av eller på" },
        {
          steps: [
            "Åpne Innstillinger.",
            "Gå til Smart øving.",
            "Slå av og på akkurat de hjelperne du vil — eller la dem alle stå på.",
          ],
        },
      ],
    },
    {
      id: "keyboard",
      nav: "Tastaturoppsett",
      heading: "Sette opp tastaturet ditt",
      blocks: [
        {
          p: "Under Innstillinger, Tastaturoppsett tilpasser du KeyLearn til tastaturet ditt og til utlegget du vil lære.",
        },
        { lab: "Bytt tastaturutlegg" },
        {
          steps: [
            "Åpne Innstillinger.",
            "Gå til Tastaturoppsett.",
            "Velg språket ditt, og deretter utlegget (QWERTY, Dvorak, Colemak og flere).",
            "La «Simuler dette utlegget» stå på, så du kan øve på det uansett hva datamaskinen din er stilt inn på.",
            "Se på den levende forhåndsvisningen for å bekrefte.",
          ],
        },
        {
          p: "På samme skjerm kan du velge tastaturform, farge tastene etter fingersone og fremheve neste tast mens du fortsatt lærer hvor ting ligger.",
        },
      ],
    },
    {
      id: "display",
      nav: "Visning",
      heading: "Visning og følelse",
      blocks: [
        {
          p: "Innstillingene for Visning og Tekstinntasting lar deg vise farten din som ord eller tegn per minutt og finjustere hvordan skrivingen føles. Gjenopprett standardverdier er alltid ett klikk unna hvis du vil begynne på nytt.",
        },
      ],
    },
    {
      id: "progress",
      nav: "Fremgangen din",
      heading: "Fremgangen din — profilsiden",
      blocks: [
        {
          p: "Profilsiden er hele historikken din: statistikk for All tid og I dag øverst (tid øvd, leksjoner fullført, din beste og typiske fart og nøyaktighet, og hvordan i dag står seg); et kart over hver bokstav du har låst opp; historien om hvordan hver enkelt tast har blitt raskere, med en utjevningsglider; det store bildet av alle tastene over tid; og de tregeste overgangene som fortsatt holder deg tilbake. Du kan til og med kjøre om kapp med ditt eget forrige forsøk som et spøkelse, for å kjenne fremgangen direkte.",
        },
        { lab: "Åpne fremgangen din" },
        {
          steps: [
            "Åpne menyen.",
            "Velg Profil.",
            "Bruk filterraden for å konsentrere deg om Bokstaver, Tall, Tegnsetting eller Symboler.",
          ],
        },
      ],
    },
    {
      id: "data",
      nav: "Dataene dine",
      heading: "Ta vare på dataene dine",
      blocks: [
        { lab: "Slett statistikken til en profil" },
        {
          steps: [
            "Åpne Profil for eleven du vil nullstille.",
            "Bla ned til nullstillingsknappen nederst på siden.",
            "Bekreft «Slett alt» — bare denne profilen tømmes.",
          ],
        },
        { lab: "Last ned dataene dine" },
        {
          steps: [
            "Åpne Profil.",
            "Bruk nedlastingsvalget for å lagre historikken din som en fil.",
          ],
        },
        {
          p: "Logg inn hvis du vil at historikken din skal synkroniseres mellom enheter, og for å kunne dele en offentlig profillenke. Det finnes ingen reklame og ingen sporere, og du kan slette dataene dine — eller hele kontoen din — når du vil.",
        },
      ],
    },
    {
      id: "kids",
      nav: "Barnemodus",
      heading: "Barnemodus",
      blocks: [
        {
          p: "Barn øver på en leken sti. Hver riktige tast fører figuren deres et skritt nærmere hjem, og figuren vokser fra en bitte liten baby til en fullvoksen helt etter hvert som flere bokstaver låses opp. En nylig lært tast utløser en liten feiring, og hver økt slutter ved et koselig leirbål.",
        },
        { lab: "Bytt til Barn" },
        {
          steps: [
            "Åpne menyen.",
            "Velg Barn — eller velg en barneprofil under Elever.",
          ],
        },
        {
          p: "Det er to verdener å velge mellom — Dino Run, med en vennlig dinosaur, og Hero Trail, der en ridder legger ut på ferd gjennom en skog — hver med en figur å velge.",
        },
      ],
    },
    {
      id: "toybox",
      nav: "Lekekassen for barn",
      heading: "Lekekassen for barn",
      blocks: [
        { lab: "Åpne lekekassen" },
        {
          steps: [
            "På barneskjermen trykker du på tannhjulet øverst i spillområdet.",
          ],
        },
        {
          p: "Inni kan du stille inn verden og figuren, Store bokstaver, Lyder, Hjelpehender (den glødende fingerguiden), Tastaturet (skjult, enkelt, eller det fulle voksentastaturet), Bokstaver på stien (ordene vist som klosser rett i spillet), en økt-Timer, Heiarop (oppmuntrende små meldinger) og — gjemt under Avansert — glidere for Lysstyrke, Farge og hvor livlig verden føles. Det finnes et rolig nattutseende i tillegg til det lyse dagutseendet.",
        },
      ],
    },
    {
      id: "ages",
      nav: "Å vokse opp",
      heading: "Å vokse sammen med barnet ditt",
      blocks: [
        {
          p: "KeyLearn stiller seg stille inn etter barnets alder. De yngste ser store, vennlige bokstaver, tilgivende tempo, bokstavklosser rett på stien og den mildeste hjelpen; eldre barn går videre til lengre ord, hele tastaturet og et renere uttrykk. Bare sett fødselsåret på profilen, så følger resten av seg selv.",
        },
      ],
    },
    {
      id: "modes",
      nav: "Andre moduser",
      heading: "Andre måter å øve på",
      blocks: [
        {
          p: "Utover den daglige øvingen finnes det en *Fartstest* — et raskt engangsavsnitt som rapporterer ord per minutt og nøyaktighet uten noen leksjon knyttet til; en *Utlegg*-utforsker for å sammenligne tastaturutlegg og fingerkartene deres; *Rekordlister* for å se hvordan du ligger an; og *Flerspiller*-løp der du kan presse farten din mot andre i sanntid.",
        },
        { lab: "Slik finner du dem" },
        {
          steps: [
            "Åpne menyen.",
            "Velg Fartstest, Utlegg, Rekordlister eller Flerspiller.",
          ],
        },
      ],
    },
    {
      id: "access",
      nav: "Hvis noe står i veien",
      heading: "Hvis noe ved appen står i veien for deg",
      blocks: [
        {
          p: "Det finnes en hel side for dette, og den stilles inn *per elev* — så tilpasningene til én person endrer aldri noe for de andre.",
        },
        { lab: "Slik åpner du den" },
        {
          steps: [
            "Åpne menyen og velg Konto.",
            "Velg Tilgjengelighet.",
            "Velg eleven øverst, og slå så på så mange innstillinger du trenger.",
          ],
        },
        {
          p: "De fem innstillingene *kombineres*. Noen som har dysleksi og skjelvinger trenger to av dem, og å bli tvunget til å velge én ville vært appen som spør hvilken vanske den skal ta hensyn til.",
        },
        {
          tips: [
            "Rolig — ingenting beveger seg, ingenting telles, ingenting tas tiden på, og en dag uten øving bryter ikke rekken.",
            "Færre ting om gangen — øvingen åpner med bare ordene og tastaturet.",
            "Lettere å lese — skrifttypen som er laget for dysleksi, mer plass mellom bokstaver og linjer, kraftigere tekst.",
            "Farger fra hverandre — fingerfarger som holder seg tydelige ved fargeblindhet, og feil som sies med lyd i tillegg til rødt.",
            "Stødigere hender — større ting å trykke på, ikke to taster samtidig, og en tast som gjentar seg selv telles ikke to ganger.",
          ],
        },
        {
          p: "Under dem åpner *Still inn hver enkelt selv* hver bryter for seg — femten av dem, blant annet talehastighet, teksting av alt som sies høyt, et fingernummer på hver tast, og hvor lenge en gjentatt tast skal ignoreres. Én knapp setter hver eneste av dem tilbake.",
        },
      ],
    },
    {
      id: "braille",
      nav: "Punktskrift",
      heading: "Å lære på et punktskrifttastatur",
      blocks: [
        {
          p: "En elev som er blind eller har nedsatt syn får en helt annen side — inntasting med seks taster i punktskrift, en læreplan i celler i stedet for bokstaver, og talt veiledning hele veien. Det er en egen måte å lære å skrive på, ikke den seende siden lest høyt.",
        },
        { lab: "Slå det på for en elev" },
        {
          steps: [
            "Åpne menyen og velg Konto, deretter Elever.",
            "Rediger eleven, eller legg til en ny.",
            "Slå på synsstøtte og lagre.",
          ],
        },
        {
          p: "Den eleven går nå rett til punktskriftsiden hver gang det er den elevens tur til å øve. Fremgangen telles i celler i stedet for bokstaver, og eleven kan tjene et sertifikat på nøyaktig samme vilkår som alle andre.",
        },
      ],
    },
    {
      id: "courses",
      nav: "De to kursene",
      heading: "Guidet øving, Klassisk og kode",
      blocks: [
        {
          p: "*Guidet øving* er det adaptive kurset: det følger med på hvilke taster som gjør deg treg og bygger leksjonene rundt dem, og legger til en bokstav først når du kan skrive dem du allerede har både raskt og nøyaktig.",
        },
        {
          p: "*Klassisk kurs* er det gammeldagse — en fast stige av leksjoner i en bestemt rekkefølge, slik en skrivebok ville lært det bort. Noen liker rett og slett å vite hva som kommer videre.",
        },
        {
          p: "Det er to atskilte kurs med hver sin historikk, og et sertifikat tjenes på det ene eller det andre — aldri på de to lagt sammen, som ville telt den første uken din to ganger. Kurs-siden i kontoen din sier hvilket av dem den rapporterer om.",
        },
        {
          p: "*Kodehåndverk* er en tredje form for øving: ekte kodesnutter i et språk du velger, slik at parenteser, semikolon og innrykk får den treningen vanlig prosa aldri gir dem.",
        },
        { lab: "Bytt mellom dem" },
        {
          steps: [
            "På øvingsskjermen åpner du leksjonsinnstillingene.",
            "Velg Guidet øving, Klassisk kurs eller Kodehåndverk.",
          ],
        },
      ],
    },
    {
      id: "certificates",
      nav: "Sertifikater",
      heading: "Å tjene et sertifikat",
      blocks: [
        {
          p: "Et sertifikat sier at en navngitt elev skrev med en målt fart og nøyaktighet, på et bestemt språk, på en bestemt dato. Det er utstedt av oss — det er ikke en kvalifikasjon som noen eksamensmyndighet eller arbeidsgiver har gått med på å anerkjenne — og det er et ærlig bevis på hva noen faktisk har gjort.",
        },
        { lab: "Se hvor langt du har igjen" },
        {
          steps: [
            "Åpne menyen og velg Konto.",
            "Velg Kurs.",
            "Hver elev har en rad som viser hvert krav, med hvor langt de er kommet.",
          ],
        },
        {
          p: "Kravene er ting som at hver bokstav er innført, at hver bokstav sitter støtt og ikke bare er møtt én gang, nok leksjoner, nok forskjellige dager, og en fart og nøyaktighet som holder seg over tid. Når alle er oppfylt, dukker det opp en lenke til prøven i den raden.",
        },
        {
          p: "Prøven er kort, og den vurderes på serverne våre i stedet for i nettleseren din. Består du den, utstedes sertifikatet med et nummer på. Alle du gir det nummeret til kan sjekke det på siden *Sjekk et sertifikat* — og du velger selv om navnet ditt vises for dem.",
        },
      ],
    },
    {
      id: "security",
      nav: "Holde kontoen din trygg",
      heading: "Passnøkler, koder og hvem som har logget inn",
      blocks: [
        {
          p: "Du kan logge inn med et passord, med en leverandør som Google, med en lenke sendt til e-posten din — eller med en *passnøkkel*, som er den vi ville valgt. En passnøkkel bruker enhetens eget fingeravtrykk, ansikt eller PIN; det finnes ikke noe passord som kan lekke, og ingenting vi oppbevarer kan brukes til å logge inn som deg.",
        },
        { lab: "Legg til en passnøkkel" },
        {
          steps: [
            "Åpne menyen og velg Konto, deretter Sikkerhet.",
            "Velg Legg til en passnøkkel og følg beskjeden på enheten din.",
          ],
        },
        {
          p: "*Tostegsbekreftelse* finnes også, med en autentiseringsapp og gjenopprettingskoder i tilfelle du mister telefonen. Skriv dem ut et sted som ikke er telefonen.",
        },
        {
          p: "Den samme siden viser nylig aktivitet — innlogginger, mislykkede innlogginger, en passnøkkel lagt til, et passord endret — hver med omtrent hvor den kom fra, så noe du ikke har gjort er lett å oppdage. Ser det galt ut, avslutter *logg ut overalt* alle økter bortsett fra den du bruker nå.",
        },
        {
          p: "Det finnes også en *foreldre-PIN*, som låser kontoinnstillingene slik at et barn på familiens enhet ikke kan endre dem eller slette en profil.",
        },
      ],
    },
    {
      id: "yours",
      nav: "Gjør det til ditt",
      heading: "Gjør det til ditt",
      blocks: [
        { lab: "Bytt tema" },
        {
          steps: [
            "Åpne menyen og velg Konto, deretter Utseende.",
            "Velg lyst, mørkt, eller følg enheten.",
          ],
        },
        {
          p: "Hvis ingen av temaene som følger med er det du vil ha, lar *temadesigneren* deg blande ditt eget — inkludert fingerfargene tastaturet lærer bort med. Appen måler kontrasten i det du velger, og nekter kombinasjoner ingen kunne lest.",
        },
        {
          p: "Hver elev i husstanden kan ha sin egen farge, så en delt enhet fortsatt føles som den tilhører den som sitter ved den.",
        },
        { lab: "Bytt språk på nettstedet" },
        {
          steps: [
            "Åpne menyen.",
            "Under Nettstedsspråk velger du språket ditt.",
          ],
        },
        {
          p: "På øvingsskjermen kan du også endre tekststørrelsen og slå lyder av eller på akkurat når du vil.",
        },
      ],
    },
    {
      id: "privacy",
      nav: "Personvern",
      heading: "Personvern, i én setning",
      blocks: [
        {
          p: "Ingen reklame og ingen sporere. Profilen til et barn forlater aldri nettleseren din. Logg inn bare hvis du vil synkronisere eller dele; ellers blir alt værende på denne enheten, og du står fritt til å slette det når som helst.",
        },
      ],
    },
    {
      id: "signout",
      nav: "Logge ut",
      heading: "Logge ut",
      blocks: [
        { lab: "Logg ut" },
        { steps: ["Åpne menyen.", "Velg Logg ut og bekreft."] },
        {
          p: "Øvingshistorikken din blir trygt værende på denne enheten — og på kontoen din, hvis du opprettet en — klar til neste gang du setter deg ned for å skrive.",
        },
      ],
    },
    {
      id: "tips",
      nav: "Tips",
      heading: "Noen få vaner som virkelig hjelper",
      blocks: [
        {
          tips: [
            "Nøyaktighet før fart — ren skriving er det som sitter.",
            "Rett opp feil med ro; ikke stress for å ta igjen.",
            "La fingrene hvile på midtstillingsraden — F og J har små kuler.",
            "Noen få minutter hver dag slår en time én gang i uken.",
          ],
        },
      ],
    },
  ],
};
