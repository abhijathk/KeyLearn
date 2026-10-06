import { type GuideTranslation } from "../guide-content.tsx";

export const da: GuideTranslation = {
  kicker: "Alt det du kan",
  title: "Brugerguide",
  dateline:
    "Den komplette guide til KeyLearn — fra dit første besøg til du logger ud",
  navLabel: "På denne side",
  sections: [
    {
      id: "account",
      nav: "Skal jeg have en konto?",
      heading: "Skal jeg have en konto?",
      blocks: [
        {
          p: "Nej. Du kan begynde at skrive, så snart du kommer ind, og dine fremskridt gemmes lige her på denne enhed. Opret kun en gratis konto, hvis du vil have din historik med over på andre enheder, gerne vil have en sikkerhedskopi eller vil dele et profillink. Intet brugbart er låst inde bag et login.",
        },
      ],
    },
    {
      id: "signin",
      nav: "Login og adgangskoder",
      heading: "Oprettelse, login og adgangskoder",
      blocks: [
        {
          p: "Det hele ligger i menuen øverst til højre under Log ind eller opret konto — den samme dør, uanset om du allerede har en konto eller ej.",
        },
        { lab: "Opret en konto eller log ind" },
        {
          steps: [
            "Åbn menuen, og vælg Log ind eller opret konto.",
            "Fortsæt med Google, Facebook eller en adgangsnøgle — eller skriv din e-mail, og tryk på Fortsæt.",
            "En ny e-mail får dig til at vælge en adgangskode; en, vi kender i forvejen, beder dig om den.",
          ],
        },
        { lab: "Nulstil en glemt adgangskode" },
        {
          steps: [
            "Skriv din e-mail på login-skærmen, og tryk på Fortsæt.",
            "Vælg Glemt din adgangskode?",
            "Åbn det nulstillingslink, vi sender dig.",
            "Vælg en ny adgangskode, og log ind.",
          ],
        },
      ],
    },
    {
      id: "profiles",
      nav: "Profiler",
      heading: "Profiler til hele husstanden",
      blocks: [
        {
          p: "KeyLearn er bygget som en husstand: én konto rummer op til fire profiler (otte med premium), voksne og børn i enhver blanding. Hver profil har sine *egne* fremskridt på denne enhed — intet bliver nogensinde blandet sammen.",
        },
        { lab: "Tilføj en profil" },
        {
          steps: [
            "Åbn menuen og vælg Konto (eller “Opret profiler”).",
            "Vælg Tilføj en profil.",
            "Skriv et fornavn.",
            "Marker den som Voksen eller Barn.",
            "Vælg en avatar — et venligt ikon, eller et Foto fra din enhed.",
            "For et barn tilføjer du et fødselsår (det bruges kun til at tilpasse ord og tempo til alderen).",
            "Gem.",
          ],
        },
        { lab: "Skift til en anden elev" },
        {
          steps: [
            "Åbn menuen.",
            "Tryk på et ansigt under Elever — appen fortsætter, hvor de slap.",
          ],
        },
        { lab: "Rediger eller fjern en profil" },
        {
          steps: [
            "Åbn menuen og vælg Konto.",
            "Vælg Rediger ved en profil, eller slet den for at frigøre en plads.",
          ],
        },
        {
          p: "Børneprofiler får en forenklet, låst menu, og voksentingene ligger bag en hurtig “hvad er A gange B?”-regneopgave, så de mindste ikke kommer til at rode rundt i indstillingerne.",
        },
      ],
    },
    {
      id: "screen",
      nav: "Øveskærmen",
      heading: "Øveskærmen",
      blocks: [
        {
          p: "Bare begynd at skrive. Ordet, du skal bruge, svæver lige over skærmtastaturet; en lysende komet peger på den allernæste tast; tasterne er farvet efter fingerzone, så du lærer, hvilken finger der rækker hvorhen; og et svagt par hvilende hænder viser, hvor fingrene bor mellem anslagene. Hele kunsten er én vane: hold øjnene på ordene, ikke på hænderne.",
        },
      ],
    },
    {
      id: "journey",
      nav: "Din rejse",
      heading: "Sådan vokser lektionerne — din rejse",
      blocks: [
        {
          p: "KeyLearn er *adaptiv*. Den måler, hvor hurtigt og hvor rent du rammer hver tast, og føjer først et nyt bogstav til dit sæt, når du kan skrive de nuværende både hurtigt og præcist. Det voksende sæt er din rejse, fra en håndfuld bogstaver til hele alfabetet — sværhedsgraden stiger præcis lige så hurtigt som du selv, aldrig hurtigere, så du altid arbejder lige på kanten af det, du kan.",
        },
      ],
    },
    {
      id: "readout",
      nav: "Live-statistik",
      heading: "Live-visningen",
      blocks: [
        {
          p: "Mens du skriver, viser det svævende panel din aktuelle hastighed og præcision, en lille kurve over de seneste omgange, dine mål og din stime. Den er der for at opmuntre dig, ikke for at brokke sig.",
        },
        {
          p: "*− og +* ved siden af målet skruer dagens mål op eller ned med det samme, uden at du skal åbne Indstillinger. Sæt det lavere, hvis de samme få bogstaver ikke længere rykker sig; den hastighed, et bogstav skal nå, er det eneste, der afgør, hvor hurtigt nye bliver låst op.",
        },
        {
          p: "Hvis du har valgt et profilbillede, kan dets motiv ligge svagt bag tallene — Konto, Udseende, *Dit motiv bag statistikken*, med en skyder til, hvor kraftigt det står. Slået fra, medmindre du slår det til.",
        },
      ],
    },
    {
      id: "tools",
      nav: "Øveværktøjer",
      heading: "Øveværktøjer",
      blocks: [
        {
          p: "De små værktøjer ved siden af teksten lader dig åbne en rundvisning, starte lektionen forfra (Ctrl + Venstre), springe til den næste (Ctrl + Højre), vise eller skjule skærmtastaturet og ændre størrelsen på øveteksten. Tandhjulet åbner de fulde Indstillinger, som beskrives herunder.",
        },
      ],
    },
    {
      id: "content",
      nav: "Hvad du skriver",
      heading: "Vælg hvad du skriver",
      blocks: [
        {
          p: "Åbn Indstillinger og gå til Øveindhold for at vælge, hvordan dine ord bliver til:",
        },
        {
          tips: [
            "*Guidet træning* — den adaptive standard, der udvider dit alfabet tast for tast.",
            "*Klassisk kursus* — en fast, ordnet march gennem tasterne.",
            "*Kildekode* — rigtig kode fra rigtige frameworks.",
            "*Hyppige ord* — de mest almindelige ord på dit sprog.",
            "*Bogtekst* — skriv dig gennem rigtige bøger, der er indbygget i appen.",
            "*Citater* — korte, hele tanker med deres rigtige store bogstaver og tegnsætning.",
            "*Din egen tekst* — indsæt lige hvad du har lyst til, og øv på det.",
            "*Taltræning* — talrækken og det numeriske tastatur.",
          ],
        },
        { lab: "Skift hvad du skriver" },
        {
          steps: [
            "Åbn Indstillinger (tandhjulet ved øveteksten).",
            "Gå til Øveindhold.",
            "Vælg en tilstand — ved Bogtekst vælger du en bog, ved Din egen tekst indsætter du dine ord.",
            "Luk Indstillinger og skriv videre.",
          ],
        },
        {
          p: "Samme skærm sætter størrelsen på dit alfabet, en målhastighed, hvor længe hver lektion varer, og et dagligt mål.",
        },
      ],
    },
    {
      id: "smart",
      nav: "Smart træning",
      heading: "Hjælperne i Smart træning",
      blocks: [
        {
          p: "Oven på den guidede træning lægger Smart træning nogle nænsomme hjælpere: en flaskehalsøvelse, der jagter dine langsomste tastepar, spredt gentagelse, opfriskning af rustne taster, smart selvtillid og tastegenopretning. De er alle slået til fra start.",
        },
        { lab: "Slå en hjælper til eller fra" },
        {
          steps: [
            "Åbn Indstillinger.",
            "Gå til Smart træning.",
            "Slå de hjælpere til og fra, du har lyst til — eller lad dem alle være tændt.",
          ],
        },
      ],
    },
    {
      id: "keyboard",
      nav: "Tastaturopsætning",
      heading: "Sæt dit tastatur op",
      blocks: [
        {
          p: "Under Indstillinger, Tastaturopsætning tilpasser du KeyLearn til dit tastatur og til det layout, du gerne vil lære.",
        },
        { lab: "Skift tastaturlayout" },
        {
          steps: [
            "Åbn Indstillinger.",
            "Gå til Tastaturopsætning.",
            "Vælg dit sprog og derefter dit layout (QWERTY, Dvorak, Colemak med flere).",
            "Lad “Simuler dette layout” være slået til, så du kan øve det, uanset hvad computeren er sat til.",
            "Se den løbende forhåndsvisning for at være sikker.",
          ],
        },
        {
          p: "På samme skærm kan du vælge tastaturets form, farve tasterne efter fingerzone og fremhæve den næste tast, mens du stadig er ved at lære, hvor tingene ligger.",
        },
        {
          p: "Tastaturets *finish* — hvordan tasterne ser ud — følger med en konto. Når du er logget ind, er der fem at vælge imellem, og den runde fås i seks farver; én af dem følger dit temas farve. Alt det ovenfor er dit under alle omstændigheder: sproget, layoutet, formen og fingerzonerne holdes aldrig tilbage, for det er dem, der får appen til at passe til tastaturet foran dig.",
        },
      ],
    },
    {
      id: "display",
      nav: "Visning",
      heading: "Visning og fornemmelse",
      blocks: [
        {
          p: "Under Visning og Tekstindtastning kan du vise din hastighed som ord eller tegn i minuttet og finjustere, hvordan det føles at skrive. Gendan standardindstillinger er altid kun ét klik væk, hvis du vil starte forfra.",
        },
        {
          p: "Hvordan hele siden ser ud, finder du under Konto, Udseende: lyst, mørkt eller som systemet, en temafarve og en tekststørrelse, der gælder på alle sider. Hver elev i husstanden har sit eget, og det følger med dem — se *Pas på dine data*.",
        },
      ],
    },
    {
      id: "progress",
      nav: "Dine fremskridt",
      heading: "Dine fremskridt — profilsiden",
      blocks: [
        {
          p: "Profilsiden er hele din historik: statistik for I alt og I dag øverst (tid brugt på at øve, gennemførte lektioner, din bedste og din typiske hastighed og præcision, og hvordan i dag ser ud i forhold til det); et kort over hvert bogstav, du har låst op; historien om, hvordan hver enkelt tast er blevet hurtigere, med en udjævningsskyder; det store billede af alle taster over tid; og de langsomste overgange, der stadig holder dig tilbage. Du kan endda køre om kap med din egen sidste omgang som et spøgelse og mærke fremskridtet direkte.",
        },
        { lab: "Åbn dine fremskridt" },
        {
          steps: [
            "Åbn menuen.",
            "Vælg Profil.",
          ],
        },
      ],
    },
    {
      id: "data",
      nav: "Dine data",
      heading: "Pas på dine data",
      blocks: [
        { lab: "Ryd en profils statistik" },
        {
          steps: [
            "Åbn Profil for den elev, du vil nulstille.",
            "Rul ned til nulstillingsknappen nederst på siden.",
            "Bekræft “Slet alt” — kun denne profil bliver ryddet.",
          ],
        },
        { lab: "Hent dine data" },
        {
          steps: [
            "Åbn Profil.",
            "Brug download-muligheden for at gemme din historik som en fil.",
          ],
        },
        {
          p: "Log ind, hvis du vil have din historik synkroniseret på tværs af enheder og kunne dele et offentligt profillink. Der er ingen annoncenetværk og ingen trackere, og du kan slette dine data — eller hele din konto — når du vil.",
        },
        {
          p: "Når du er logget ind, følger der nu mere med end dine resultater. Dine indstillinger, dit tema og din tekststørrelse, de tilgængelighedsvalg, du har truffet, og hver elevs egne præferencer følger profilen i stedet for browseren — så en elev, der åbner KeyLearn på en ny computer, fortsætter, hvor de slap, på samme skærm og sat op på samme måde, i stedet for at starte forfra fra standardindstillingerne.",
        },
      ],
    },
    {
      id: "kids",
      nav: "Børnetilstand",
      heading: "Børnetilstand",
      blocks: [
        {
          p: "Børn øver sig på en legende sti. Hver rigtig tast får deres figur et skridt nærmere hjem, og figuren vokser fra en lillebitte baby til en fuldvoksen helt, efterhånden som flere bogstaver bliver låst op. En nylært tast udløser en lille fest, og hver session slutter ved et hyggeligt bål.",
        },
        { lab: "Skift til børnetilstand" },
        {
          steps: [
            "Åbn menuen.",
            "Vælg Børn — eller vælg en børneprofil under Elever.",
          ],
        },
        {
          p: "Der er to verdener at vælge imellem — Dino Run med en venlig dinosaur, og Hero Trail, hvor en ridder drager gennem en skov — hver med en figur, man kan vælge.",
        },
      ],
    },
    {
      id: "toybox",
      nav: "Børnenes legekasse",
      heading: "Børnenes legekasse",
      blocks: [
        { lab: "Åbn legekassen" },
        {
          steps: [
            "Tryk på tandhjulet øverst i spilleområdet på børneskærmen.",
          ],
        },
        {
          p: "Indeni kan du vælge verden og figur, Store bogstaver, Lyde, Hjælpehænder (den lysende fingerguide), Tastaturet (skjult, enkelt eller det fulde voksentastatur), Bogstaver på stien (ordene vist som klodser inde i selve spillet), en session-Timer, Tilråb (små opmuntrende beskeder) og — gemt under Avanceret — skydere til Lysstyrke, Farve og hvor livlig verden føles. Der er både et roligt natudseende og det lyse dagudseende.",
        },
        {
          p: "*Key style* ændrer, hvordan tasterne er malet, og selve tasterne flytter sig ikke: *Crayon* er den hvide tast med en ring i sin fingerfarve, og *Rainbow* er læringstastaturet i grundfarver — grøn ramme, røde tal, blå bogstaver med vokalerne sat for sig — hvor rammetasterne er pile i stedet for ord, til et barn, der endnu ikke kan læse „enter“. Alle starter med Crayon. *Finger colours* ved siden af slår farvningen helt fra for et barn, der ikke længere har brug for den.",
        },
      ],
    },
    {
      id: "ages",
      nav: "At blive stor",
      heading: "Vokser sammen med dit barn",
      blocks: [
        {
          p: "KeyLearn tilpasser sig stille og roligt barnets alder. De mindste ser store, venlige bogstaver, et tilgivende tempo, bogstavklodser direkte på stien og den blideste hjælp; større børn rykker op til længere ord, hele tastaturet og et mere enkelt udtryk. Sæt bare fødselsåret på profilen, så følger resten af sig selv.",
        },
      ],
    },
    {
      id: "modes",
      nav: "Andre tilstande",
      heading: "Andre måder at øve på",
      blocks: [
        {
          p: "Ud over den daglige træning er der en *Hastighedstest* — et hurtigt engangsstykke tekst, der viser dine ord i minuttet og din præcision uden nogen lektion bagved; en *Layouts*-udforsker til at sammenligne tastaturlayouts og deres fingerkort; *Highscores*, hvor du kan se, hvordan du klarer dig; og *Multiplayer*-løb, hvor du kan presse din hastighed mod andre i realtid.",
        },
        { lab: "Sådan finder du dem" },
        {
          steps: [
            "Åbn menuen.",
            "Vælg Hastighedstest, Layouts, Highscores eller Multiplayer.",
          ],
        },
      ],
    },
    {
      id: "access",
      nav: "Hvis noget står i vejen",
      heading: "Hvis noget ved appen står i vejen for dig",
      blocks: [
        {
          p: "Der er en hel side til det, og den sættes *for hver elev* — så én persons tilpasninger ændrer aldrig nogen andens.",
        },
        { lab: "Sådan åbner du den" },
        {
          steps: [
            "Åbn menuen og vælg Konto.",
            "Vælg Tilgængelighed.",
            "Vælg eleven øverst, og slå så lige så mange indstillinger til, som du har brug for.",
          ],
        },
        {
          p: "De fem indstillinger *kan kombineres*. En, der er ordblind og har rysten på hænderne, har brug for to af dem, og at blive tvunget til at vælge én ville være appen, der spurgte, hvilken vanskelighed den skulle tage hensyn til.",
        },
        {
          tips: [
            "Rolig — intet bevæger sig, intet tælles, intet tages der tid på, og en sprunget dag ødelægger ikke stimen.",
            "Færre ting ad gangen — træningen åbner med kun ordene og tastaturet.",
            "Lettere at læse — skrifttypen lavet til ordblinde, mere luft mellem bogstaver og linjer, kraftigere tekst.",
            "Tydeligere farver — fingerfarver, der stadig kan skelnes ved farveblindhed, og fejl der siges med lyd og ikke kun vises med rødt.",
            "Roligere hænder — større ting at trykke på, aldrig to taster på én gang, og en tast, der gentager sig selv, tælles ikke to gange.",
          ],
        },
        {
          p: "Nedenunder åbner *Indstil hver ting selv* hver enkelt kontakt for sig — femten i alt, blandt andet talehastighed, undertekster til alt hvad der siges højt, et fingernummer på hver tast, og hvor længe en gentaget tast skal ignoreres. Én knap sætter dem alle sammen tilbage.",
        },
      ],
    },
    {
      id: "braille",
      nav: "Punktskrift",
      heading: "At lære på et punktskriftstastatur",
      blocks: [
        {
          p: "En elev, der er blind eller svagtseende, får en helt anden side — punktskriftindtastning med seks taster, et forløb i celler i stedet for bogstaver og talt vejledning hele vejen. Det er en selvstændig måde at lære at skrive på, ikke den seendes side læst højt.",
        },
        { lab: "Slå det til for en elev" },
        {
          steps: [
            "Åbn menuen og vælg Konto, derefter Elever.",
            "Rediger eleven, eller tilføj en ny.",
            "Slå synsstøtte til og gem.",
          ],
        },
        {
          p: "Den elev går nu direkte til punktskriftsiden, hver gang det er dem, der øver sig. Deres fremskridt tælles i celler i stedet for bogstaver, og de kan optjene et certifikat på helt samme vilkår som alle andre.",
        },
      ],
    },
    {
      id: "courses",
      nav: "De to kurser",
      heading: "Guidet træning, Klassisk og kode",
      blocks: [
        {
          p: "*Guidet træning* er det adaptive kursus: det holder øje med, hvilke taster der sinker dig, og bygger lektionerne op omkring dem — og føjer først et bogstav til, når du kan skrive dem, du har, både hurtigt og præcist.",
        },
        {
          p: "*Klassisk kursus* er den gammeldags slags — en fast stige af lektioner i en bestemt rækkefølge, sådan som en maskinskrivningsbog ville lære fra sig. Nogle foretrækker simpelthen at vide, hvad der kommer nu.",
        },
        {
          p: "Det er to adskilte kurser med hver sin historik, og et certifikat optjenes på det ene eller det andet — aldrig på de to lagt sammen, for så ville din første uge tælle to gange. Kursus-siden på din konto fortæller, hvilket af dem den viser.",
        },
        {
          p: "*Kodehåndværk* er en tredje slags træning: rigtige kodestumper i et sprog, du selv vælger, så parenteser, semikolonner og indrykning får den træning, som almindelig tekst aldrig giver dem.",
        },
        { lab: "Skift mellem dem" },
        {
          steps: [
            "Åbn lektionsindstillingerne på øveskærmen.",
            "Vælg Guidet træning, Klassisk kursus eller Kodehåndværk.",
          ],
        },
      ],
    },
    {
      id: "certificates",
      nav: "Certifikater",
      heading: "Sådan optjener du et certifikat",
      blocks: [
        {
          p: "Et certifikat siger, at en navngiven elev skrev med en målt hastighed og præcision, på et bestemt sprog, på en bestemt dato. Det udstedes af os — det er ikke en kvalifikation, som nogen eksamensinstans eller arbejdsgiver har sagt god for — og det er ærligt bevis på, hvad nogen rent faktisk har gjort.",
        },
        { lab: "Se hvor langt du er fra målet" },
        {
          steps: [
            "Åbn menuen og vælg Konto.",
            "Vælg Kursus.",
            "Hver elev har en række, der viser alle betingelserne, og hvor langt de er med dem.",
          ],
        },
        {
          p: "Betingelserne er ting som alle bogstaver introduceret, alle bogstaver sikre og ikke bare mødt én gang, lektioner nok, spredt over dage nok, og en vedvarende hastighed og præcision. Når de alle er opfyldt, dukker der et link op i rækken, så du kan tage prøven.",
        },
        {
          p: "Prøven er kort, og den bedømmes på vores servere frem for i din browser. Består du, udstedes certifikatet med et nummer på. Alle, du giver det nummer, kan tjekke det på siden *Tjek et certifikat* — og du bestemmer selv, om dit navn bliver vist for dem.",
        },
      ],
    },
    {
      id: "security",
      nav: "Hold din konto sikker",
      heading: "Adgangsnøgler, koder og hvem der har logget ind",
      blocks: [
        {
          p: "Du kan logge ind med en adgangskode, med en udbyder som Google, med et link sendt til din e-mail — eller med en *adgangsnøgle*, som er den, vi ville vælge. En adgangsnøgle bruger enhedens eget fingeraftryk, ansigt eller PIN; der er ingen adgangskode, der kan lække, og intet af det, vi opbevarer, kan bruges til at logge ind som dig.",
        },
        { lab: "Tilføj en adgangsnøgle" },
        {
          steps: [
            "Åbn menuen og vælg Konto, derefter Sikkerhed.",
            "Vælg Tilføj en adgangsnøgle, og følg din enheds vejledning.",
          ],
        },
        {
          p: "*To-trinsbekræftelse* er der også, med en autentificeringsapp og gendannelseskoder, hvis du mister telefonen. Print dem ud, og gem dem et sted, der ikke er telefonen.",
        },
        {
          p: "Samme side viser den seneste aktivitet — logins, mislykkede logins, en adgangsnøgle tilføjet, en adgangskode ændret — hver med den omtrentlige placering, den kom fra, så noget, du ikke selv har gjort, er let at få øje på. Ser det forkert ud, afslutter *log ud alle steder* alle sessioner undtagen den, du sidder i.",
        },
        {
          p: "Der er også en *forældre-PIN*, som låser kontoindstillingerne, så et barn på familiens enhed hverken kan ændre dem eller slette en profil.",
        },
      ],
    },
    {
      id: "yours",
      nav: "Gør den til din",
      heading: "Gør den til din",
      blocks: [
        { lab: "Skift tema" },
        {
          steps: [
            "Åbn menuen og vælg Konto, derefter Udseende.",
            "Vælg lyst, mørkt, eller følg enheden.",
          ],
        },
        {
          p: "Hvis ingen af de medfølgende temaer er det, du vil have, kan du med *temadesigneren* blande dit helt eget — også fingerfarverne, som tastaturet underviser med. Appen måler kontrasten i det, du vælger, og afviser kombinationer, som ingen ville kunne læse.",
        },
        {
          p: "Hver elev i husstanden kan have sin egen farve, så en delt enhed stadig føles, som om den hører til den, der sidder ved den.",
        },
        { lab: "Skift sprog på siden" },
        {
          steps: ["Åbn menuen.", "Under Sidesprog vælger du dit sprog."],
        },
        {
          p: "På øveskærmen kan du også ændre tekststørrelsen og slå lyde til eller fra, lige når du har lyst.",
        },
      ],
    },
    {
      id: "privacy",
      nav: "Privatliv",
      heading: "Privatliv, i én sætning",
      blocks: [
        {
          p: "Ingen annoncenetværk og ingen trackere. Et barns profil forlader aldrig din browser. Log kun ind, hvis du vil synkronisere eller dele; ellers bliver alt på denne enhed, og du kan frit slette det når som helst.",
        },
        {
          p: "Du kan se en *sponsoreret linje* på nogle sider. Det er en, vi selv har solgt og selv viser — der er intet annoncenetværk her, og intet følger efter dig væk fra siden. Den vælges ud fra den side, du er på, aldrig ud fra noget, vi ved om dig, og den vises aldrig for et barn, i børneverdenen, på en skolekonto eller mens en lektion er i gang. Tryk på *Hvorfor ser jeg det her?* ved en hvilken som helst af dem for at få samme forklaring på stedet — og folk, der har støttet projektet, ser aldrig en.",
        },
      ],
    },
    {
      id: "support",
      nav: "Få hjælp",
      heading: "Få hjælp",
      blocks: [
        {
          p: "Hver besked, du sender os, bliver til en *samtale, du kan vende tilbage til*, ikke en e-mail, der forsvinder. Den ligger under Konto og har sit eget referencenummer — det, du skal oplyse, hvis du nogensinde ringer eller skriver igen.",
        },
        { lab: "Bed om hjælp" },
        {
          steps: [
            "Åbn menuen, og vælg Konto og derefter Support.",
            "Vælg Indsend en sag, og fortæl, hvad der sker.",
            "Vedhæft et skærmbillede, hvis det hjælper — PNG, JPG eller PDF, op til 10 MB hver.",
          ],
        },
        {
          p: "Svar dukker op i samtalen, og klokken i toppen lyser op, når et kommer, så du ikke behøver sidde og holde øje med siden. Alt, hvad der allerede er klaret, foldes væk under Løst, som starter lukket — det, du stadig venter på, er det, du ser.",
        },
        { lab: "Hvem svarer" },
        {
          p: "En assistent ved navn Tab læser den først og svarer på det, den kan. Den fortæller dig, at den er en AI — den lader aldrig som andet, og den siger klart, når den ikke ved noget.",
        },
        {
          p: "Et menneske tager over, når det er det bedre svar: alt om penge, dine data, sikkerhed, eller bare fordi du bad om det. Du skal aldrig spørge to gange, og du skal aldrig gentage dig selv — den, der tager over, kan allerede se alt, hvad du har skrevet.",
        },
        {
          p: "Hvis en besked nogensinde lyder som en rigtig nødsituation, er svaret det samme hver gang og kommer fra en fast tekst i stedet for fra assistenten: alarmnummeret, hvor du er, og et menneske hos os, der får besked med det samme. Vi kan ikke ringe opkaldet for dig, og det siger vi også.",
        },
        { lab: "Ryd op" },
        {
          p: "Du kan fjerne en samtale fra din liste når som helst med skraldespandsikonet ved siden af. En lille note ved *Indsend en sag* tæller, hvor mange du har ryddet, så en tråd, der er forsvundet, aldrig er et mysterium.",
        },
        {
          p: "På en fælles familieenhed beder Support-sektionen om PIN for voksne, før den åbner — supporttråde er kontoens sag, og den, der øver, er ikke altid den, der oprettede kontoen.",
        },
      ],
    },
    {
      id: "signout",
      nav: "Log ud",
      heading: "Log ud",
      blocks: [
        { lab: "Log ud" },
        { steps: ["Åbn menuen.", "Vælg Log ud og bekræft."] },
        {
          p: "Din øvehistorik bliver liggende trygt på denne enhed — og på din konto, hvis du har oprettet en — klar til næste gang, du sætter dig til tasterne.",
        },
      ],
    },
    {
      id: "tips",
      nav: "Gode råd",
      heading: "Et par vaner, der virkelig hjælper",
      blocks: [
        {
          tips: [
            "Præcision før hastighed — det er den rene skrivning, der sætter sig fast.",
            "Ret fejl i ro og mag; stress ikke for at indhente det.",
            "Lad fingrene hvile på midterrækken — F og J har små buler.",
            "Et par minutter hver dag slår en time én gang om ugen.",
          ],
        },
      ],
    },
  ],
};
