import { type GuideTranslation } from "../guide-content.tsx";

export const sv: GuideTranslation = {
  kicker: "Allt du kan göra",
  title: "Användarguide",
  dateline:
    "Den kompletta guiden till KeyLearn — från ditt första besök till att du loggar ut",
  navLabel: "På den här sidan",
  sections: [
    {
      id: "account",
      nav: "Behöver jag ett konto?",
      heading: "Behöver jag ett konto?",
      blocks: [
        {
          p: "Nej. Du kan börja skriva i samma stund som du kommer hit, och dina framsteg sparas här på den här enheten. Skapa ett gratiskonto bara om du vill att din historik ska följa med till andra enheter, ha en säkerhetskopia eller dela en profillänk. Inget som är värt något är låst bakom en inloggning.",
        },
      ],
    },
    {
      id: "signin",
      nav: "Inloggning och lösenord",
      heading: "Registrering, inloggning och lösenord",
      blocks: [
        { p: "Allt finns i menyn uppe till höger." },
        { lab: "Skapa ett konto" },
        {
          steps: [
            "Öppna menyn (uppe till höger).",
            "Välj Registrera dig.",
            "Ange en e-postadress och ett lösenord.",
            "Bekräfta — nu är du inne.",
          ],
        },
        { lab: "Logga in" },
        {
          steps: [
            "Öppna menyn och välj Logga in.",
            "Ange din e-postadress och ditt lösenord.",
          ],
        },
        { lab: "Återställ ett glömt lösenord" },
        {
          steps: [
            "På inloggningssidan väljer du Glömt lösenord.",
            "Ange din e-postadress.",
            "Öppna återställningslänken som vi skickar till dig.",
            "Välj ett nytt lösenord och logga in.",
          ],
        },
      ],
    },
    {
      id: "profiles",
      nav: "Profiler",
      heading: "Profiler för hela hushållet",
      blocks: [
        {
          p: "KeyLearn är byggt som ett hushåll: ett konto rymmer upp till fyra profiler (åtta med premium), vuxna och barn i vilken blandning som helst. Varje profil behåller sina *egna* framsteg på den här enheten — ingenting blandas någonsin ihop.",
        },
        { lab: "Lägg till en profil" },
        {
          steps: [
            "Öppna menyn och välj Konto (eller ”Ställ in profiler”).",
            "Välj Lägg till en profil.",
            "Skriv ett förnamn.",
            "Markera den som Vuxen eller Barn.",
            "Välj en avatar — en vänlig ikon, eller ett Foto från din enhet.",
            "För ett barn lägger du till ett födelseår (det finjusterar bara orden och tempot efter åldern).",
            "Spara.",
          ],
        },
        { lab: "Byt till en annan elev" },
        {
          steps: [
            "Öppna menyn.",
            "Tryck på ett ansikte under Elever — appen fortsätter där de slutade.",
          ],
        },
        { lab: "Ändra eller ta bort en profil" },
        {
          steps: [
            "Öppna menyn och välj Konto.",
            "Välj Ändra på en profil, eller ta bort den för att frigöra en plats.",
          ],
        },
        {
          p: "Barnprofiler får en förenklad, låst meny, och åtgärder för vuxna ligger bakom en snabb ”vad är A gånger B?”-fråga, så att de små inte kan hamna inne i inställningarna.",
        },
      ],
    },
    {
      id: "screen",
      nav: "Övningsskärmen",
      heading: "Övningsskärmen",
      blocks: [
        {
          p: "Börja bara skriva. Ordet du behöver svävar precis ovanför skärmtangentbordet; en lysande komet pekar på nästa tangent; tangenterna är färgade efter fingerzon så att du lär dig vilket finger som når vart; och ett svagt par vilande händer visar var dina fingrar bor mellan nedslagen. Hela konsten är en enda vana: håll blicken på orden, inte på händerna.",
        },
      ],
    },
    {
      id: "journey",
      nav: "Din resa",
      heading: "Hur lektionerna växer — din resa",
      blocks: [
        {
          p: "KeyLearn är *adaptivt*. Det mäter hur snabbt och rent du träffar varje tangent och lägger till en ny bokstav i din uppsättning först när du kan skriva de nuvarande både snabbt och exakt. Den växande uppsättningen är din resa, från en handfull bokstäver till hela alfabetet — svårighetsgraden stiger precis lika fort som du gör, aldrig snabbare, så du arbetar alltid exakt vid din gräns.",
        },
      ],
    },
    {
      id: "readout",
      nav: "Livestatistik",
      heading: "Liveavläsningen",
      blocks: [
        {
          p: "Medan du skriver visar den svävande panelen din hastighet och träffsäkerhet just nu, en liten kurva över de senaste omgångarna, dina målspår och din svit. Den finns där för att peppa dig, inte för att tjata.",
        },
      ],
    },
    {
      id: "tools",
      nav: "Övningsverktyg",
      heading: "Övningsverktyg",
      blocks: [
        {
          p: "De små verktygen bredvid texten låter dig öppna en guidad rundtur, starta om den aktuella lektionen (Ctrl + vänster), hoppa till nästa (Ctrl + höger), visa eller dölja skärmtangentbordet och ändra storlek på övningstexten. Kugghjulet öppnar de fullständiga Inställningarna, som beskrivs härnäst.",
        },
      ],
    },
    {
      id: "content",
      nav: "Det du skriver",
      heading: "Välja vad du skriver",
      blocks: [
        {
          p: "Öppna Inställningar och gå till Övningsinnehåll för att välja hur dina ord sätts ihop:",
        },
        {
          tips: [
            "*Guidad övning* — det adaptiva standardvalet som bygger ut ditt alfabet tangent för tangent.",
            "*Klassisk kurs* — en fast, ordnad marsch genom tangenterna.",
            "*Vanliga ord* — de vanligaste orden på ditt språk.",
            "*Boktext* — skriv dig genom riktiga böcker som finns inbyggda i appen.",
            "*Din egen text* — klistra in vad du vill och öva på det.",
            "*Kodsnuttar* — parenteser, symboler och kodens rytm.",
            "*Sifferövningar* — sifferraden och det numeriska tangentbordet.",
          ],
        },
        { lab: "Ändra vad du skriver" },
        {
          steps: [
            "Öppna Inställningar (kugghjulet vid övningstexten).",
            "Gå till Övningsinnehåll.",
            "Välj ett läge — för Boktext väljer du en bok, för Din egen text klistrar du in dina ord.",
            "Stäng Inställningar och fortsätt skriva.",
          ],
        },
        {
          p: "På samma skärm ställer du in alfabetets storlek, en målhastighet, hur länge varje lektion pågår och ett dagligt mål.",
        },
      ],
    },
    {
      id: "smart",
      nav: "Smart övning",
      heading: "Hjälpredorna i Smart övning",
      blocks: [
        {
          p: "Ovanpå den guidade övningen lägger Smart övning till milda hjälpredor: en flaskhalsövning som jagar rätt på dina långsammaste tangentpar, spridd repetition, uppfräschning mot färdighetstapp som tar upp rostiga tangenter igen, smart självförtroende och tangentåterhämtning. Alla är på från början.",
        },
        { lab: "Slå på eller av en hjälpreda" },
        {
          steps: [
            "Öppna Inställningar.",
            "Gå till Smart övning.",
            "Slå av och på precis de hjälpredor du vill — eller låt dem alla vara på.",
          ],
        },
      ],
    },
    {
      id: "keyboard",
      nav: "Tangentbordsinställning",
      heading: "Ställa in ditt tangentbord",
      blocks: [
        {
          p: "Under Inställningar, Tangentbordsinställning anpassar du KeyLearn till ditt tangentbord och till den layout du vill lära dig.",
        },
        { lab: "Byt tangentbordslayout" },
        {
          steps: [
            "Öppna Inställningar.",
            "Gå till Tangentbordsinställning.",
            "Välj ditt språk och sedan din layout (QWERTY, Dvorak, Colemak med flera).",
            "Låt ”Simulera den här layouten” vara på, så att du kan öva på den oavsett vad din dator är inställd på.",
            "Titta på förhandsvisningen för att kontrollera.",
          ],
        },
        {
          p: "På samma skärm kan du välja tangentbordets form, färga tangenterna efter fingerzon och lysa upp nästa tangent medan du fortfarande lär dig var allt sitter.",
        },
      ],
    },
    {
      id: "display",
      nav: "Utseende",
      heading: "Utseende och känsla",
      blocks: [
        {
          p: "Inställningarna för Utseende och Textinmatning låter dig visa din hastighet som ord eller tecken per minut och finjustera hur skrivandet känns. Återställ standardvärden är alltid ett klick bort om du vill börja om från början.",
        },
      ],
    },
    {
      id: "progress",
      nav: "Dina framsteg",
      heading: "Dina framsteg — profilsidan",
      blocks: [
        {
          p: "Profilsidan är hela din historik: statistik för Hela tiden och Idag högst upp (övad tid, avklarade lektioner, din bästa och vanliga hastighet och träffsäkerhet, och hur idag står sig); en karta över varje bokstav du har låst upp; berättelsen om hur varje enskild tangent har blivit snabbare, med ett utjämningsreglage; helhetsbilden av alla tangenter över tid; och de långsammaste övergångarna som fortfarande håller dig tillbaka. Du kan till och med tävla mot din egen förra omgång som ett spöke, för att känna framstegen direkt.",
        },
        { lab: "Öppna dina framsteg" },
        {
          steps: [
            "Öppna menyn.",
            "Välj Profil.",
            "Använd filterraden för att fokusera på Bokstäver, Siffror, Skiljetecken eller Symboler.",
          ],
        },
      ],
    },
    {
      id: "data",
      nav: "Dina data",
      heading: "Ta hand om dina data",
      blocks: [
        { lab: "Rensa en profils statistik" },
        {
          steps: [
            "Öppna Profil för den elev du vill nollställa.",
            "Bläddra till nollställningsknappen längst ner på sidan.",
            "Bekräfta ”Radera allt” — bara den här profilen rensas.",
          ],
        },
        { lab: "Ladda ner dina data" },
        {
          steps: [
            "Öppna Profil.",
            "Använd nedladdningsvalet för att spara din historik som en fil.",
          ],
        },
        {
          p: "Logga in om du vill att din historik ska synkas mellan enheter och för att kunna dela en publik profillänk. Det finns inga annonser och inga spårare, och du kan radera dina data — eller hela ditt konto — när du vill.",
        },
      ],
    },
    {
      id: "kids",
      nav: "Barnläge",
      heading: "Barnläge",
      blocks: [
        {
          p: "Barn övar på en lekfull stig. Varje rätt tangent tar deras figur ett steg närmare hemmet, och figuren växer från en pytteliten bebis till en fullvuxen hjälte allteftersom fler bokstäver låses upp. En nyss inlärd tangent utlöser ett litet firande, och varje pass slutar vid en mysig lägereld.",
        },
        { lab: "Byt till Barn" },
        {
          steps: [
            "Öppna menyn.",
            "Välj Barn — eller välj en barnprofil under Elever.",
          ],
        },
        {
          p: "Det finns två världar att välja mellan — Dino Run, med en vänlig dinosaurie, och Hero Trail, där en riddare ger sig ut genom en skog — var och en med en figur att välja.",
        },
      ],
    },
    {
      id: "toybox",
      nav: "Barnens leklåda",
      heading: "Barnens leklåda",
      blocks: [
        { lab: "Öppna leklådan" },
        {
          steps: [
            "På barnskärmen trycker du på kugghjulet högst upp i spelytan.",
          ],
        },
        {
          p: "Inuti kan du ställa in värld och figur, Stora bokstäver, Ljud, Hjälpande händer (den lysande fingerguiden), Tangentbordet (dolt, enkelt, eller hela vuxenbrädan), Bokstäver på stigen (orden som visas som klossar mitt i spelet), en pass-Timer, Hejarop (uppmuntrande små meddelanden) och — undanstoppat under Avancerat — reglage för Ljusstyrka, Färg och hur livlig världen känns. Det finns ett lugnt nattutseende vid sidan av det ljusa dagutseendet.",
        },
      ],
    },
    {
      id: "ages",
      nav: "Att växa upp",
      heading: "Att växa tillsammans med ditt barn",
      blocks: [
        {
          p: "KeyLearn ställer stillsamt in sig efter barnets ålder. De yngsta ser stora, vänliga bokstäver, förlåtande tempo, bokstavsklossar direkt på stigen och den mildaste hjälpen; äldre barn går vidare till längre ord, hela tangentbordet och ett renare utseende. Ange bara födelseåret på profilen, så följer resten av sig självt.",
        },
      ],
    },
    {
      id: "modes",
      nav: "Andra lägen",
      heading: "Andra sätt att öva",
      blocks: [
        {
          p: "Utöver din dagliga övning finns ett *Hastighetstest* — ett snabbt engångsstycke som rapporterar dina ord per minut och din träffsäkerhet utan någon lektion kopplad till sig; en *Layouter*-utforskare för att jämföra tangentbordslayouter och deras fingerkartor; *Topplistor* för att se hur du står dig; och *Flerspelar*-lopp där du kan pressa din hastighet mot andra i realtid.",
        },
        { lab: "Så hittar du dem" },
        {
          steps: [
            "Öppna menyn.",
            "Välj Hastighetstest, Layouter, Topplistor eller Flerspelarläge.",
          ],
        },
      ],
    },
    {
      id: "access",
      nav: "Om något är i vägen",
      heading: "Om något i appen är i vägen för dig",
      blocks: [
        {
          p: "Det finns en hel sida för det här, och den ställs in *per elev* — så en persons anpassningar ändrar aldrig något för någon annan.",
        },
        { lab: "Så öppnar du den" },
        {
          steps: [
            "Öppna menyn och välj Konto.",
            "Välj Tillgänglighet.",
            "Välj eleven högst upp och slå sedan på så många inställningar du behöver.",
          ],
        },
        {
          p: "De fem inställningarna *kombineras*. Någon med dyslexi och darrningar behöver två av dem, och att tvingas välja en enda vore att appen frågade vilken svårighet den ska ta hänsyn till.",
        },
        {
          tips: [
            "Lugnt — inget rör sig, inget räknas, inget tas tid på, och en missad dag bryter inte sviten.",
            "Färre saker på en gång — övningen öppnas med bara orden och tangentbordet.",
            "Lättare att läsa — typsnittet som är gjort för dyslexi, mer plats mellan bokstäver och rader, kraftigare text.",
            "Färger isär — fingerfärger som håller sig tydliga vid färgblindhet, och misstag som sägs med ljud utöver rött.",
            "Stadigare händer — större saker att trycka på, inte två tangenter samtidigt, och en tangent som upprepar sig räknas inte två gånger.",
          ],
        },
        {
          p: "Under dem öppnar *Ställ in varje sak själv* varje reglage för sig — femton av dem, bland annat talhastighet, undertexter för allt som sägs högt, ett fingernummer på varje tangent, och hur länge en upprepad tangent ska ignoreras. En enda knapp ställer tillbaka vartenda ett.",
        },
      ],
    },
    {
      id: "braille",
      nav: "Punktskrift",
      heading: "Att lära sig på ett punktskriftstangentbord",
      blocks: [
        {
          p: "En elev som är blind eller har nedsatt syn får en helt annan sida — inmatning med sex tangenter i punktskrift, en kursplan i celler i stället för bokstäver, och talad vägledning hela vägen. Det är ett eget sätt att lära sig skriva, inte den seende sidan uppläst.",
        },
        { lab: "Slå på det för en elev" },
        {
          steps: [
            "Öppna menyn och välj Konto, sedan Elever.",
            "Ändra eleven, eller lägg till en ny.",
            "Slå på synstöd och spara.",
          ],
        },
        {
          p: "Den eleven går nu direkt till punktskriftssidan varje gång det är den elevens tur att öva. Framstegen räknas i celler i stället för bokstäver, och eleven kan ta ett certifikat på exakt samma villkor som alla andra.",
        },
      ],
    },
    {
      id: "courses",
      nav: "De två kurserna",
      heading: "Guidad övning, Klassisk och kod",
      blocks: [
        {
          p: "*Guidad övning* är den adaptiva kursen: den ser vilka tangenter som bromsar dig och bygger dina lektioner kring dem, och lägger till en bokstav först när du kan skriva dem du redan har både snabbt och exakt.",
        },
        {
          p: "*Klassisk kurs* är den gammaldags varianten — en fast stege av lektioner i en bestämd ordning, så som en skrivmaskinsbok skulle lära ut det. Vissa gillar helt enkelt att veta vad som kommer härnäst.",
        },
        {
          p: "Det är två skilda kurser med varsin historik, och ett certifikat tas på den ena eller den andra — aldrig på de två ihopräknade, vilket skulle räkna din första vecka två gånger. Kurssidan i ditt konto talar om vilken av dem den rapporterar om.",
        },
        {
          p: "*Kodhantverk* är en tredje sorts övning: riktiga kodsnuttar i ett språk du väljer, så att parenteser, semikolon och indrag får den träning som vanlig prosa aldrig ger dem.",
        },
        { lab: "Växla mellan dem" },
        {
          steps: [
            "På övningsskärmen öppnar du lektionsinställningarna.",
            "Välj Guidad övning, Klassisk kurs eller Kodhantverk.",
          ],
        },
      ],
    },
    {
      id: "certificates",
      nav: "Certifikat",
      heading: "Att ta ett certifikat",
      blocks: [
        {
          p: "Ett certifikat säger att en namngiven elev skrev med en uppmätt hastighet och träffsäkerhet, på ett visst språk, ett visst datum. Det utfärdas av oss — det är ingen behörighet som någon examensmyndighet eller arbetsgivare har gått med på att erkänna — och det är ett ärligt bevis på vad någon faktiskt gjorde.",
        },
        { lab: "Se hur långt du har kvar" },
        {
          steps: [
            "Öppna menyn och välj Konto.",
            "Välj Kurs.",
            "Varje elev har en rad som visar alla villkor, med hur långt de har kommit.",
          ],
        },
        {
          p: "Villkoren är saker som att varje bokstav är införd, att varje bokstav sitter säkert och inte bara har mötts en gång, tillräckligt många lektioner, tillräckligt många skilda dagar, och en hastighet och träffsäkerhet som håller i sig. När alla är uppfyllda dyker en länk till provet upp på den raden.",
        },
        {
          p: "Provet är kort, och det bedöms på våra servrar i stället för i din webbläsare. Klarar du det utfärdas certifikatet med ett nummer på. Alla du ger det numret till kan kontrollera det på sidan *Kontrollera ett certifikat* — och du väljer själv om ditt namn visas för dem.",
        },
      ],
    },
    {
      id: "security",
      nav: "Hålla ditt konto säkert",
      heading: "Lösenordsnycklar, koder och vem som har loggat in",
      blocks: [
        {
          p: "Du kan logga in med ett lösenord, med en leverantör som Google, med en länk skickad till din e-post — eller med en *lösenordsnyckel*, som är den vi skulle välja. En lösenordsnyckel använder enhetens eget fingeravtryck, ansikte eller PIN-kod; det finns inget lösenord som kan läcka, och inget vi har kan användas för att logga in som du.",
        },
        { lab: "Lägg till en lösenordsnyckel" },
        {
          steps: [
            "Öppna menyn och välj Konto, sedan Säkerhet.",
            "Välj Lägg till en lösenordsnyckel och följ anvisningen på din enhet.",
          ],
        },
        {
          p: "*Tvåstegsverifiering* finns också, med en autentiseringsapp och återställningskoder ifall du tappar bort telefonen. Skriv ut dem någonstans som inte är telefonen.",
        },
        {
          p: "Samma sida listar den senaste aktiviteten — inloggningar, misslyckade inloggningar, en lösenordsnyckel tillagd, ett lösenord ändrat — var och en med ungefär var den kom ifrån, så att något du inte gjorde är lätt att upptäcka. Ser det fel ut avslutar *logga ut överallt* varje session utom den du använder just nu.",
        },
        {
          p: "Det finns också en *föräldra-PIN*, som låser kontoinställningarna så att ett barn på familjens enhet inte kan ändra dem eller radera en profil.",
        },
      ],
    },
    {
      id: "yours",
      nav: "Gör det till ditt",
      heading: "Gör det till ditt",
      blocks: [
        { lab: "Byt tema" },
        {
          steps: [
            "Öppna menyn och välj Konto, sedan Utseende.",
            "Välj ljust, mörkt, eller följ enheten.",
          ],
        },
        {
          p: "Om inget av de medföljande temana är det du vill ha låter *temadesignern* dig blanda ditt eget — inklusive fingerfärgerna som tangentbordet lär ut med. Appen mäter kontrasten i det du väljer och vägrar kombinationer som ingen skulle kunna läsa.",
        },
        {
          p: "Varje elev i hushållet kan ha sin egen färg, så att en delad enhet ändå känns som att den tillhör den som sitter vid den.",
        },
        { lab: "Byt språk på webbplatsen" },
        {
          steps: [
            "Öppna menyn.",
            "Under Webbplatsens språk väljer du ditt språk.",
          ],
        },
        {
          p: "På övningsskärmen kan du också ändra textstorleken och slå på eller av ljuden precis när du vill.",
        },
      ],
    },
    {
      id: "privacy",
      nav: "Integritet",
      heading: "Integritet, i en enda mening",
      blocks: [
        {
          p: "Inga annonser och inga spårare. Ett barns profil lämnar aldrig din webbläsare. Logga in bara om du vill synka eller dela; annars stannar allt på den här enheten, och du är fri att radera det när som helst.",
        },
      ],
    },
    {
      id: "signout",
      nav: "Logga ut",
      heading: "Logga ut",
      blocks: [
        { lab: "Logga ut" },
        { steps: ["Öppna menyn.", "Välj Logga ut och bekräfta."] },
        {
          p: "Din övningshistorik ligger tryggt kvar på den här enheten — och på ditt konto, om du skapade ett — redo till nästa gång du sätter dig ner för att skriva.",
        },
      ],
    },
    {
      id: "tips",
      nav: "Tips",
      heading: "Några vanor som verkligen hjälper",
      blocks: [
        {
          tips: [
            "Träffsäkerhet före hastighet — det är det rena skrivandet som sitter kvar.",
            "Rätta misstag lugnt; stressa inte för att ta igen.",
            "Vila fingrarna på grundraden — F och J har små knottror.",
            "Några minuter varje dag slår en timme en gång i veckan.",
          ],
        },
      ],
    },
  ],
};
