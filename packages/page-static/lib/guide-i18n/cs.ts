import { type GuideTranslation } from "../guide-content.tsx";

export const cs: GuideTranslation = {
  kicker: "Všechno, co tu můžeš dělat",
  title: "Uživatelská příručka",
  dateline:
    "Kompletní průvodce aplikací KeyLearn — od první návštěvy až po odhlášení",
  navLabel: "Na této stránce",
  sections: [
    {
      id: "account",
      nav: "Potřebuji účet?",
      heading: "Potřebuji účet?",
      blocks: [
        {
          p: "Ne. Psát můžeš začít hned, jakmile dorazíš, a tvůj pokrok se ukládá přímo tady na tomto zařízení. Bezplatný účet si vytvoř jen tehdy, když chceš, aby tě tvoje historie provázela i na jiná zařízení, chceš mít zálohu nebo sdílet odkaz na profil. Nic užitečného není za přihlášením zamčené.",
        },
      ],
    },
    {
      id: "signin",
      nav: "Přihlášení a hesla",
      heading: "Registrace, přihlášení a hesla",
      blocks: [
        { p: "Všechno najdeš v nabídce vpravo nahoře." },
        { lab: "Vytvoření účtu" },
        {
          steps: [
            "Otevři nabídku (vpravo nahoře).",
            "Zvol Registrace.",
            "Zadej e-mail a heslo.",
            "Potvrď — a jsi uvnitř.",
          ],
        },
        { lab: "Přihlášení" },
        {
          steps: [
            "Otevři nabídku a zvol Přihlásit se.",
            "Zadej svůj e-mail a heslo.",
          ],
        },
        { lab: "Obnovení zapomenutého hesla" },
        {
          steps: [
            "Na přihlašovací obrazovce zvol Zapomenuté heslo.",
            "Zadej svou e-mailovou adresu.",
            "Otevři odkaz pro obnovení, který ti pošleme.",
            "Zvol nové heslo a přihlas se.",
          ],
        },
      ],
    },
    {
      id: "profiles",
      nav: "Profily",
      heading: "Profily pro celou domácnost",
      blocks: [
        {
          p: "KeyLearn je postavený jako domácnost: jeden účet pojme až čtyři profily (osm s prémiovou verzí), dospělé i děti v libovolném složení. Každý profil si na tomto zařízení uchovává *svůj vlastní* oddělený pokrok — nikdy se nic nemíchá dohromady.",
        },
        { lab: "Přidání profilu" },
        {
          steps: [
            "Otevři nabídku a zvol Účet (nebo „Nastavit profily“).",
            "Vyber Přidat profil.",
            "Napiš křestní jméno.",
            "Označ ho jako Dospělý, nebo Dítě.",
            "Vyber avatara — přátelskou ikonku, nebo Fotku ze svého zařízení.",
            "U dítěte přidej rok narození (jen podle něj se ladí slova a tempo k jeho věku).",
            "Ulož.",
          ],
        },
        { lab: "Přepnutí na jiného žáka" },
        {
          steps: [
            "Otevři nabídku.",
            "Klepni na obličej pod položkou Žáci — aplikace naváže tam, kde skončil.",
          ],
        },
        { lab: "Úprava nebo odebrání profilu" },
        {
          steps: [
            "Otevři nabídku a zvol Účet.",
            "U profilu vyber Upravit, nebo ho smaž a uvolni místo.",
          ],
        },
        {
          p: "Dětské profily mají zjednodušenou, zamčenou nabídku a akce pro dospělé jsou schované za rychlou početní otázkou „kolik je A krát B?“, aby se malí nedostali do nastavení.",
        },
      ],
    },
    {
      id: "screen",
      nav: "Obrazovka procvičování",
      heading: "Obrazovka procvičování",
      blocks: [
        {
          p: "Prostě začni psát. Slovo, které potřebuješ, se vznáší přímo nad klávesnicí na obrazovce; zářící kometa ukazuje na úplně další klávesu; klávesy jsou obarvené podle prstových zón, takže se naučíš, který prst kam dosáhne; a jemná dvojice odpočívajících rukou ukazuje, kde tvoje prsty mezi úhozy bydlí. Celá ta dovednost je jediný návyk: drž oči na slovech, ne na rukou.",
        },
      ],
    },
    {
      id: "journey",
      nav: "Tvoje cesta",
      heading: "Jak lekce rostou — tvoje cesta",
      blocks: [
        {
          p: "KeyLearn je *adaptivní*. Měří, jak rychle a čistě trefuješ každou klávesu, a nové písmeno do tvojí sady přidá teprve tehdy, až ta stávající zvládneš psát rychle i přesně. Ta rostoucí sada je tvoje cesta, od hrstky písmen až po celou abecedu — obtížnost stoupá přesně tak rychle jako ty, nikdy rychleji, takže pracuješ vždycky přesně na svojí hranici.",
        },
      ],
    },
    {
      id: "readout",
      nav: "Živé statistiky",
      heading: "Živý přehled",
      blocks: [
        {
          p: "Zatímco píšeš, plovoucí panel ukazuje tvoji aktuální rychlost a přesnost, malý graf posledních běhů, plnění tvých cílů a tvoji sérii. Je tu od toho, aby tě povzbuzoval, ne aby tě otravoval.",
        },
      ],
    },
    {
      id: "tools",
      nav: "Nástroje k procvičování",
      heading: "Nástroje k procvičování",
      blocks: [
        {
          p: "Malé nástroje vedle textu ti umožní spustit prohlídku s průvodcem, restartovat aktuální lekci (Ctrl + vlevo), přeskočit na další (Ctrl + vpravo), zobrazit nebo skrýt klávesnici na obrazovce a změnit velikost cvičného textu. Ozubené kolečko otevře kompletní Nastavení, o kterých je řeč hned dál.",
        },
      ],
    },
    {
      id: "content",
      nav: "Co píšeš",
      heading: "Výběr toho, co píšeš",
      blocks: [
        {
          p: "Otevři Nastavení a přejdi na Obsah procvičování, kde vybereš, jak se tvoje slova tvoří:",
        },
        {
          tips: [
            "*Vedené procvičování* — adaptivní výchozí režim, který rozšiřuje tvoji abecedu klávesu po klávese.",
            "*Klasický kurz* — pevný, uspořádaný pochod klávesami.",
            "*Častá slova* — nejběžnější slova tvého jazyka.",
            "*Text z knihy* — propiš se skrz opravdové knihy zabudované v aplikaci.",
            "*Vlastní text* — vlož si cokoli chceš a procvičuj na tom.",
            "*Úryvky kódu* — závorky, symboly a rytmus kódu.",
            "*Cvičení s čísly* — číselná řada a numerická klávesnice.",
          ],
        },
        { lab: "Změna toho, co píšeš" },
        {
          steps: [
            "Otevři Nastavení (ozubené kolečko u cvičného textu).",
            "Přejdi na Obsah procvičování.",
            "Vyber režim — u Textu z knihy zvol knihu, u Vlastního textu vlož svoje slova.",
            "Zavři Nastavení a piš dál.",
          ],
        },
        {
          p: "Na téže obrazovce nastavíš velikost svojí abecedy, cílovou rychlost, jak dlouho každá lekce trvá a denní cíl.",
        },
      ],
    },
    {
      id: "smart",
      nav: "Chytré procvičování",
      heading: "Pomocníci chytrého procvičování",
      blocks: [
        {
          p: "Nad rámec vedeného procvičování přidává Chytré procvičování jemné pomocníky: cvičení na úzká místa, které vyslídí tvoje nejpomalejší dvojice kláves, rozložené opakování, oživování slábnoucích dovedností, které se vrací k zrezivělým klávesám, chytrou jistotu a obnovu kláves. Všichni jsou ve výchozím nastavení zapnutí.",
        },
        { lab: "Zapnutí nebo vypnutí pomocníka" },
        {
          steps: [
            "Otevři Nastavení.",
            "Přejdi na Chytré procvičování.",
            "Přepni libovolného pomocníka — nebo je nech všechny zapnuté.",
          ],
        },
      ],
    },
    {
      id: "keyboard",
      nav: "Nastavení klávesnice",
      heading: "Nastavení tvojí klávesnice",
      blocks: [
        {
          p: "V Nastavení, v části Nastavení klávesnice, sladíš KeyLearn se svojí klávesnicí a s rozložením, které se chceš naučit.",
        },
        { lab: "Změna rozložení klávesnice" },
        {
          steps: [
            "Otevři Nastavení.",
            "Přejdi na Nastavení klávesnice.",
            "Vyber svůj jazyk a pak rozložení (QWERTY, Dvorak, Colemak a další).",
            "Nech zapnuté „Simulovat toto rozložení“, abys ho mohl procvičovat bez ohledu na to, jak máš nastavený počítač.",
            "Pro kontrolu sleduj živý náhled.",
          ],
        },
        {
          p: "Na téže obrazovce si můžeš vybrat tvar klávesnice, obarvit klávesy podle prstových zón a zvýraznit další klávesu, dokud se ještě učíš, kde co je.",
        },
      ],
    },
    {
      id: "display",
      nav: "Zobrazení",
      heading: "Zobrazení a pocit z psaní",
      blocks: [
        {
          p: "Nastavení Zobrazení a Zadávání textu ti umožní ukazovat rychlost ve slovech nebo ve znacích za minutu a doladit, jak psaní působí. Obnovit výchozí nastavení je vždycky na jedno kliknutí, kdybys chtěl začít nanovo.",
        },
      ],
    },
    {
      id: "progress",
      nav: "Tvůj pokrok",
      heading: "Tvůj pokrok — stránka Profil",
      blocks: [
        {
          p: "Stránka Profil je tvůj kompletní záznam: nahoře statistiky Za celou dobu a Dnes (odcvičený čas, dokončené lekce, tvoje nejlepší i obvyklá rychlost a přesnost a jak si dnešek stojí ve srovnání); mapa všech písmen, která jsi odemkl; příběh o tom, jak každá jednotlivá klávesa zrychlovala, s posuvníkem vyhlazení; celkový obraz všech kláves v čase; a nejpomalejší přechody, které tě pořád brzdí. Můžeš dokonce závodit se svým vlastním posledním během jako s duchem a cítit pokrok úplně přímo.",
        },
        { lab: "Otevření tvého pokroku" },
        {
          steps: [
            "Otevři nabídku.",
            "Zvol Profil.",
            "Pomocí řádku filtrů se zaměř na Písmena, Číslice, Interpunkci nebo Symboly.",
          ],
        },
      ],
    },
    {
      id: "data",
      nav: "Tvoje data",
      heading: "Péče o tvoje data",
      blocks: [
        { lab: "Vymazání statistik profilu" },
        {
          steps: [
            "Otevři Profil žáka, kterého chceš vynulovat.",
            "Sjeď dolů k ovládacímu prvku pro vynulování na konci stránky.",
            "Potvrď „Vymazat všechno“ — vymaže se jen tenhle profil.",
          ],
        },
        { lab: "Stažení tvých dat" },
        {
          steps: [
            "Otevři Profil.",
            "Pomocí možnosti stažení ulož svoji historii jako soubor.",
          ],
        },
        {
          p: "Přihlas se, pokud chceš, aby se tvoje historie synchronizovala mezi zařízeními a abys mohl sdílet veřejný odkaz na profil. Nejsou tu žádné reklamy ani sledovací nástroje a svoje data — nebo celý účet — můžeš smazat, kdykoli se ti zachce.",
        },
      ],
    },
    {
      id: "kids",
      nav: "Dětský režim",
      heading: "Dětský režim",
      blocks: [
        {
          p: "Děti procvičují na hravé stezce. Každá správná klávesa posune jejich postavičku o krok blíž domů a postavička roste z malinkého miminka v dospělého hrdinu, jak se odemyká víc písmen. Nově naučená klávesa spustí malou oslavu a každé sezení končí u útulného táboráku.",
        },
        { lab: "Přepnutí do Dětského režimu" },
        {
          steps: [
            "Otevři nabídku.",
            "Zvol Děti — nebo vyber dětský profil pod položkou Žáci.",
          ],
        },
        {
          p: "Na výběr jsou dva světy — Dino Run s přátelským dinosaurem a Hero Trail, kde se rytíř vydává na výpravu lesem — a v každém si vybereš postavu.",
        },
      ],
    },
    {
      id: "toybox",
      nav: "Dětská bedýnka hraček",
      heading: "Dětská bedýnka hraček",
      blocks: [
        { lab: "Otevření bedýnky" },
        {
          steps: [
            "Na dětské obrazovce klepni na ozubené kolečko nahoře v herní ploše.",
          ],
        },
        {
          p: "Uvnitř nastavíš svět a postavu, Velká písmena, Zvuky, Pomocné ruce (zářícího průvodce prsty), Klávesnici (skrytou, jednoduchou, nebo celou pro dospělé), Písmena na stezce (slova zobrazená jako kostky přímo ve hře), Časovač sezení, Povzbuzování (malé pochvalné vzkazy) a — schované pod Pokročilým nastavením — posuvníky pro Jas, Barvu a to, jak živě svět působí. Kromě jasného denního vzhledu je tu i klidný noční.",
        },
      ],
    },
    {
      id: "ages",
      nav: "Jak dítě roste",
      heading: "Rosteme s tvým dítětem",
      blocks: [
        {
          p: "KeyLearn se nenápadně ladí podle věku dítěte. Nejmenší vidí velká, přátelská písmena, shovívavé tempo, písmenkové kostky přímo na stezce a tu nejjemnější pomoc; starší děti postupují k delším slovům, plné klávesnici a čistšímu vzhledu. Stačí u profilu nastavit rok narození a zbytek se udělá sám.",
        },
      ],
    },
    {
      id: "modes",
      nav: "Další režimy",
      heading: "Další způsoby, jak procvičovat",
      blocks: [
        {
          p: "Kromě každodenního procvičování je tu *Test rychlosti* — rychlá jednorázová pasáž, která ohlásí tvoje slova za minutu a přesnost bez připojené lekce; průzkumník *Rozložení* na porovnávání rozložení klávesnic a jejich prstových map; *Nejlepší výsledky*, kde uvidíš, jak si stojíš; a závody pro *Více hráčů*, kde poměříš svoji rychlost s ostatními v reálném čase.",
        },
        { lab: "Kde je najdeš" },
        {
          steps: [
            "Otevři nabídku.",
            "Zvol Test rychlosti, Rozložení, Nejlepší výsledky nebo Více hráčů.",
          ],
        },
      ],
    },
    {
      id: "access",
      nav: "Když ti něco překáží",
      heading: "Když ti na aplikaci něco překáží",
      blocks: [
        {
          p: "Je na to celá stránka a nastavuje se *pro každého žáka zvlášť* — takže úpravy jednoho člověka nikdy nic nezmění ostatním.",
        },
        { lab: "Kde ji otevřeš" },
        {
          steps: [
            "Otevři nabídku a zvol Účet.",
            "Zvol Přístupnost.",
            "Nahoře vyber žáka a pak zapni tolik nastavení, kolik potřebuješ.",
          ],
        },
        {
          p: "Těch pět nastavení se *kombinuje*. Někdo s dyslexií a s třesem potřebuje dvě z nich a nutit ho vybrat si jedno by znamenalo, že se aplikace ptá, kterému znevýhodnění má vyjít vstříc.",
        },
        {
          tips: [
            "Klid — nic se nehýbe, nic se nepočítá, nic se neměří na čas a vynechaný den sérii nepřeruší.",
            "Míň věcí najednou — procvičování se otevře jen se slovy a klávesnicí.",
            "Snazší čtení — písmo vytvořené pro dyslexii, větší rozestupy mezi písmeny i řádky, výraznější text.",
            "Odlišné barvy — barvy prstů, které zůstanou rozlišitelné i při barvosleposti, a chyby oznámené zvukem, nejen červeně.",
            "Klidnější ruce — větší plochy k stisknutí, žádné dvě klávesy naráz a klávesa, která se sama zopakuje, se nepočítá dvakrát.",
          ],
        },
        {
          p: "Pod nimi *Nastavit si každé zvlášť* otevře všechny přepínače jednotlivě — je jich patnáct, včetně rychlosti řeči, titulků ke všemu, co zazní nahlas, čísla prstu na každé klávese a toho, jak dlouho ignorovat opakovanou klávesu. Jedno tlačítko vrátí všechny zpátky.",
        },
      ],
    },
    {
      id: "braille",
      nav: "Braillovo písmo",
      heading: "Učení na braillské klávesnici",
      blocks: [
        {
          p: "Žák, který je nevidomý nebo slabozraký, dostane úplně jinou stránku — šestiklávesové braillské psaní, osnovu v buňkách místo v písmenech a mluvené vedení po celou dobu. Je to samostatný způsob, jak se naučit psát, ne stránka pro vidící čtená nahlas.",
        },
        { lab: "Zapnutí pro konkrétního žáka" },
        {
          steps: [
            "Otevři nabídku a zvol Účet, pak Žáci.",
            "Uprav žáka, nebo přidej nového.",
            "Zapni podporu pro zrakové postižení a ulož.",
          ],
        },
        {
          p: "Takový žák teď zamíří rovnou na braillskou stránku pokaždé, když je na řadě on. Jeho pokrok se počítá v buňkách místo v písmenech a certifikát může získat za stejných podmínek jako kdokoli jiný.",
        },
      ],
    },
    {
      id: "courses",
      nav: "Dva kurzy",
      heading: "Vedené procvičování, Klasický kurz a kód",
      blocks: [
        {
          p: "*Vedené procvičování* je adaptivní kurz: sleduje, které klávesy tě zpomalují, a staví kolem nich tvoje lekce — nové písmeno přidá, teprve až ta dosavadní zvládneš psát rychle i přesně.",
        },
        {
          p: "*Klasický kurz* je ten staromódní — pevný žebřík lekcí v daném pořadí, tak jak by to učila učebnice psaní na stroji. Někteří lidé prostě mají radši, když vědí, co přijde dál.",
        },
        {
          p: "Jsou to oddělené kurzy s oddělenou historií a certifikát se získává na jednom, nebo na druhém — nikdy na obou sečtených dohromady, protože to by ti první týden započítalo dvakrát. Stránka Kurz ve tvém účtu říká, o kterém z nich zrovna podává zprávu.",
        },
        {
          p: "*Řemeslo kódu* je třetí druh procvičování: opravdové úryvky v jazyce, který si vybereš, takže závorky, středníky a odsazení dostanou trénink, jaký jim běžná próza nikdy nedá.",
        },
        { lab: "Přepínání mezi nimi" },
        {
          steps: [
            "Na obrazovce procvičování otevři nastavení lekce.",
            "Zvol Vedené procvičování, Klasický kurz nebo Řemeslo kódu.",
          ],
        },
      ],
    },
    {
      id: "certificates",
      nav: "Certifikáty",
      heading: "Jak získat certifikát",
      blocks: [
        {
          p: "Certifikát říká, že jmenovaný žák psal naměřenou rychlostí a přesností, v určitém jazyce a k určitému datu. Vydáváme ho my — není to kvalifikace, kterou by nějaká zkušební komise nebo zaměstnavatel slíbili uznávat — a je to poctivý doklad o tom, co někdo doopravdy zvládl.",
        },
        { lab: "Jak zjistíš, kolik ti ještě schází" },
        {
          steps: [
            "Otevři nabídku a zvol Účet.",
            "Zvol Kurz.",
            "Každý žák má řádek se všemi podmínkami a s tím, jak daleko v nich je.",
          ],
        },
        {
          p: "Podmínky jsou věci jako uvedení všech písmen, spolehlivé zvládnutí každého písmene, ne jen to, že se s ním potkal, dost lekcí, dost různých dnů a dlouhodobě udržená rychlost a přesnost. Když jsou splněné všechny, objeví se na tom řádku odkaz na zkoušku.",
        },
        {
          p: "Zkouška je krátká a vyhodnocuje se na našich serverech, ne ve tvém prohlížeči. Když ji složíš, certifikát se vydá s číslem. Kdokoli, komu to číslo dáš, si ho může ověřit na stránce *Ověřit certifikát* — a ty si vybereš, jestli se mu ukáže tvoje jméno.",
        },
      ],
    },
    {
      id: "security",
      nav: "Bezpečnost tvého účtu",
      heading: "Přístupové klíče, kódy a kdo se přihlašoval",
      blocks: [
        {
          p: "Přihlásit se můžeš heslem, přes poskytovatele jako Google, odkazem poslaným na e-mail — nebo *přístupovým klíčem*, který bychom si vybrali my. Přístupový klíč používá otisk prstu, obličej nebo PIN tvého vlastního zařízení; není tu žádné heslo, které by mohlo uniknout, a nic z toho, co u nás leží, by nešlo použít k přihlášení za tebe.",
        },
        { lab: "Přidání přístupového klíče" },
        {
          steps: [
            "Otevři nabídku a zvol Účet, pak Zabezpečení.",
            "Zvol Přidat přístupový klíč a řiď se pokyny svého zařízení.",
          ],
        },
        {
          p: "Je tu i *dvoufázové ověření* pomocí ověřovací aplikace, se záložními kódy pro případ, že o telefon přijdeš. Vytiskni si je někam, kde ten telefon není.",
        },
        {
          p: "Na téže stránce najdeš i nedávnou aktivitu — přihlášení, neúspěšná přihlášení, přidaný přístupový klíč, změněné heslo — vždycky s přibližným místem, odkud přišla, takže je snadné si všimnout něčeho, co jsi nedělal. Když to vypadá špatně, *odhlásit všude* ukončí všechna sezení kromě toho, které máš zrovna otevřené.",
        },
        {
          p: "Je tu také *rodičovský PIN*, který zamkne nastavení účtu, aby dítě na rodinném zařízení nemohlo nic měnit ani smazat profil.",
        },
      ],
    },
    {
      id: "yours",
      nav: "Uprav si to podle sebe",
      heading: "Uprav si to podle sebe",
      blocks: [
        { lab: "Změna motivu" },
        {
          steps: [
            "Otevři nabídku a zvol Účet, pak Vzhled.",
            "Vyber světlý, tmavý, nebo podle zařízení.",
          ],
        },
        {
          p: "Pokud ti žádný z dodaných motivů nesedne, *návrhář motivů* ti nechá namíchat vlastní — včetně barev prstů, kterými klávesnice učí. Aplikace měří kontrast toho, co si vybereš, a odmítne kombinace, které by nikdo nepřečetl.",
        },
        {
          p: "Každý žák v domácnosti může mít vlastní barvu, takže sdílené zařízení pořád působí, že patří tomu, kdo u něj zrovna sedí.",
        },
        { lab: "Změna jazyka stránek" },
        {
          steps: ["Otevři nabídku.", "V části Jazyk stránek vyber svůj jazyk."],
        },
        {
          p: "Na obrazovce procvičování můžeš navíc kdykoli změnit velikost textu a zapnout nebo vypnout zvuky.",
        },
      ],
    },
    {
      id: "privacy",
      nav: "Soukromí",
      heading: "Soukromí, v jedné větě",
      blocks: [
        {
          p: "Žádné reklamy a žádné sledovací nástroje. Profil dítěte nikdy neopustí tvůj prohlížeč. Přihlas se jen tehdy, když chceš synchronizovat nebo sdílet; jinak všechno zůstane na tomhle zařízení a můžeš to kdykoli smazat.",
        },
      ],
    },
    {
      id: "signout",
      nav: "Odhlášení",
      heading: "Odhlášení",
      blocks: [
        { lab: "Odhlásit se" },
        { steps: ["Otevři nabídku.", "Zvol Odhlásit se a potvrď."] },
        {
          p: "Tvoje historie procvičování zůstane v bezpečí na tomhle zařízení — a na tvém účtu, pokud sis nějaký založil — připravená na příště, až si zase sedneš psát.",
        },
      ],
    },
    {
      id: "tips",
      nav: "Tipy",
      heading: "Pár návyků, které opravdu pomáhají",
      blocks: [
        {
          tips: [
            "Přesnost před rychlostí — čisté psaní je to, co se usadí.",
            "Chyby oprav v klidu; nežeň se, abys to dohnal.",
            "Nech prsty odpočívat na základní řadě — F a J mají malé hrbolky.",
            "Pár minut každý den je lepší než hodina jednou týdně.",
          ],
        },
      ],
    },
  ],
};
