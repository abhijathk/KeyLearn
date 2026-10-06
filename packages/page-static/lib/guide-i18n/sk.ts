import { type GuideTranslation } from "../guide-content.tsx";

export const sk: GuideTranslation = {
  kicker: "Všetko, čo tu môžeš robiť",
  title: "Používateľská príručka",
  dateline:
    "Kompletný sprievodca aplikáciou KeyLearn — od prvej návštevy až po odhlásenie",
  navLabel: "Na tejto stránke",
  sections: [
    {
      id: "account",
      nav: "Potrebujem účet?",
      heading: "Potrebujem účet?",
      blocks: [
        {
          p: "Nie. Písať môžeš začať hneď, ako sem prídeš, a tvoj pokrok sa ukladá priamo tu na tomto zariadení. Bezplatný účet si vytvor len vtedy, keď chceš, aby ťa tvoja história sprevádzala aj na iné zariadenia, chceš mať zálohu alebo zdieľať odkaz na profil. Nič užitočné nie je za prihlásením zamknuté.",
        },
      ],
    },
    {
      id: "signin",
      nav: "Prihlásenie a heslá",
      heading: "Registrácia, prihlásenie a heslá",
      blocks: [
        {
          p: "Všetko nájdeš v ponuke vpravo hore, pod Prihlásiť sa alebo zaregistrovať — sú to tie isté dvere, či už účet máš, alebo nie.",
        },
        { lab: "Vytvorenie účtu alebo prihlásenie" },
        {
          steps: [
            "Otvor ponuku a zvoľ Prihlásiť sa alebo zaregistrovať.",
            "Pokračuj cez Google, Facebook alebo prístupový kľúč — alebo zadaj svoj e-mail a stlač Pokračovať.",
            "Pri novom e-maile si nastavíš heslo; pri existujúcom ťa oň požiadame.",
          ],
        },
        { lab: "Obnovenie zabudnutého hesla" },
        {
          steps: [
            "Na prihlasovacej obrazovke zadaj svoj e-mail a stlač Pokračovať.",
            "Zvoľ Zabudli ste heslo?",
            "Otvor odkaz na obnovenie, ktorý ti pošleme.",
            "Zvoľ nové heslo a prihlás sa.",
          ],
        },
      ],
    },
    {
      id: "profiles",
      nav: "Profily",
      heading: "Profily pre celú domácnosť",
      blocks: [
        {
          p: "KeyLearn je postavený ako domácnosť: jeden účet pojme až štyri profily (osem s prémiovou verziou), dospelých aj deti v ľubovoľnom zložení. Každý profil si na tomto zariadení uchováva *svoj vlastný* oddelený pokrok — nikdy sa nič nemieša dokopy.",
        },
        { lab: "Pridanie profilu" },
        {
          steps: [
            "Otvor ponuku a zvoľ Účet (alebo „Nastaviť profily“).",
            "Vyber Pridať profil.",
            "Napíš krstné meno.",
            "Označ ho ako Dospelý alebo Dieťa.",
            "Vyber avatara — priateľskú ikonku alebo Fotku zo svojho zariadenia.",
            "Pri dieťati pridaj rok narodenia (podľa neho sa len ladia slová a tempo k jeho veku).",
            "Ulož.",
          ],
        },
        { lab: "Prepnutie na iného žiaka" },
        {
          steps: [
            "Otvor ponuku.",
            "Ťukni na tvár pod položkou Žiaci — aplikácia nadviaže tam, kde skončil.",
          ],
        },
        { lab: "Úprava alebo odstránenie profilu" },
        {
          steps: [
            "Otvor ponuku a zvoľ Účet.",
            "Pri profile vyber Upraviť, alebo ho zmaž a uvoľni miesto.",
          ],
        },
        {
          p: "Detské profily majú zjednodušenú, zamknutú ponuku a akcie pre dospelých sú schované za rýchlou počtovou otázkou „koľko je A krát B?“, aby sa malí nedostali do nastavení.",
        },
      ],
    },
    {
      id: "screen",
      nav: "Obrazovka precvičovania",
      heading: "Obrazovka precvičovania",
      blocks: [
        {
          p: "Jednoducho začni písať. Slovo, ktoré potrebuješ, sa vznáša priamo nad klávesnicou na obrazovke; žiariaca kométa ukazuje na úplne najbližší kláves; klávesy sú zafarbené podľa prstových zón, takže sa naučíš, ktorý prst kam dosiahne; a jemná dvojica odpočívajúcich rúk ukazuje, kde tvoje prsty medzi údermi bývajú. Celá tá zručnosť je jediný návyk: drž oči na slovách, nie na rukách.",
        },
      ],
    },
    {
      id: "journey",
      nav: "Tvoja cesta",
      heading: "Ako lekcie rastú — tvoja cesta",
      blocks: [
        {
          p: "KeyLearn je *adaptívny*. Meria, ako rýchlo a čisto trafíš každý kláves, a nové písmeno do tvojej sady pridá až vtedy, keď tie doterajšie zvládneš písať rýchlo aj presne. Tá rastúca sada je tvoja cesta, od hŕstky písmen až po celú abecedu — náročnosť stúpa presne tak rýchlo ako ty, nikdy rýchlejšie, takže pracuješ vždy presne na svojej hranici.",
        },
      ],
    },
    {
      id: "readout",
      nav: "Živé štatistiky",
      heading: "Živý prehľad",
      blocks: [
        {
          p: "Kým píšeš, plávajúci panel ukazuje tvoju aktuálnu rýchlosť a presnosť, malý graf posledných behov, plnenie tvojich cieľov a tvoju sériu. Je tu na to, aby ťa povzbudzoval, nie aby ťa otravoval.",
        },
        {
          p: "Tlačidlá *− a +* vedľa cieľa hneď zvýšia alebo znížia dnešný cieľ, bez otvárania Nastavení. Zníž ho, ak sa tých istých pár písmen prestalo hýbať; rýchlosť, ktorú musí písmeno dosiahnuť, je to jediné, čo rozhoduje o tom, ako rýchlo sa odomykajú nové.",
        },
        {
          p: "Ak si si vybral profilový obrázok, jeho ilustrácia môže jemne presvitať za týmito číslami — Účet, Vzhľad, *Vaša ilustrácia za číslami*, s posuvníkom pre silu efektu. Je vypnutá, kým ju nezapneš.",
        },
      ],
    },
    {
      id: "tools",
      nav: "Nástroje na precvičovanie",
      heading: "Nástroje na precvičovanie",
      blocks: [
        {
          p: "Malé nástroje vedľa textu ti umožnia spustiť sprievodcu, reštartovať aktuálnu lekciu (Ctrl + vľavo), preskočiť na ďalšiu (Ctrl + vpravo), zobraziť alebo skryť klávesnicu na obrazovke a zmeniť veľkosť cvičného textu. Ozubené koliesko otvorí kompletné Nastavenia, o ktorých je reč hneď ďalej.",
        },
      ],
    },
    {
      id: "content",
      nav: "Čo píšeš",
      heading: "Výber toho, čo píšeš",
      blocks: [
        {
          p: "Otvor Nastavenia a prejdi na Obsah precvičovania, kde vyberieš, ako sa tvoje slová tvoria:",
        },
        {
          tips: [
            "*Vedené precvičovanie* — adaptívny východiskový režim, ktorý rozširuje tvoju abecedu kláves po klávese.",
            "*Klasický kurz* — pevný, usporiadaný pochod klávesmi.",
            "*Zdrojový kód* — skutočný kód zo skutočných frameworkov.",
            "*Časté slová* — najbežnejšie slová tvojho jazyka.",
            "*Text z knihy* — prepíš sa cez naozajstné knihy zabudované v aplikácii.",
            "*Citáty* — krátke, ucelené myšlienky so skutočnými veľkými písmenami a interpunkciou.",
            "*Vlastný text* — vlož si čokoľvek chceš a precvičuj na tom.",
            "*Cvičenia s číslami* — číselný riadok a numerická klávesnica.",
          ],
        },
        { lab: "Zmena toho, čo píšeš" },
        {
          steps: [
            "Otvor Nastavenia (ozubené koliesko pri cvičnom texte).",
            "Prejdi na Obsah precvičovania.",
            "Vyber režim — pri Texte z knihy zvoľ knihu, pri Vlastnom texte vlož svoje slová.",
            "Zavri Nastavenia a píš ďalej.",
          ],
        },
        {
          p: "Na tej istej obrazovke nastavíš veľkosť svojej abecedy, cieľovú rýchlosť, ako dlho každá lekcia trvá a denný cieľ.",
        },
      ],
    },
    {
      id: "smart",
      nav: "Chytré precvičovanie",
      heading: "Pomocníci chytrého precvičovania",
      blocks: [
        {
          p: "Nad rámec vedeného precvičovania pridáva Chytré precvičovanie jemných pomocníkov: cvičenie na úzke miesta, ktoré vysliedi tvoje najpomalšie dvojice klávesov, rozložené opakovanie, oživovanie slabnúcich zručností, ktoré sa vracia k zhrdzaveným klávesom, chytrú istotu a obnovu klávesov. Všetci sú predvolene zapnutí.",
        },
        { lab: "Zapnutie alebo vypnutie pomocníka" },
        {
          steps: [
            "Otvor Nastavenia.",
            "Prejdi na Chytré precvičovanie.",
            "Prepni ľubovoľného pomocníka — alebo ich nechaj všetkých zapnutých.",
          ],
        },
      ],
    },
    {
      id: "keyboard",
      nav: "Nastavenie klávesnice",
      heading: "Nastavenie tvojej klávesnice",
      blocks: [
        {
          p: "V Nastaveniach, v časti Nastavenie klávesnice, zladíš KeyLearn so svojou klávesnicou a s rozložením, ktoré sa chceš naučiť.",
        },
        { lab: "Zmena rozloženia klávesnice" },
        {
          steps: [
            "Otvor Nastavenia.",
            "Prejdi na Nastavenie klávesnice.",
            "Vyber svoj jazyk a potom rozloženie (QWERTY, Dvorak, Colemak a ďalšie).",
            "Nechaj zapnuté „Simulovať toto rozloženie“, aby si ho mohol precvičovať bez ohľadu na to, ako máš nastavený počítač.",
            "Pre kontrolu sleduj živý náhľad.",
          ],
        },
        {
          p: "Na tej istej obrazovke si môžeš vybrať tvar klávesnice, zafarbiť klávesy podľa prstových zón a zvýrazniť ďalší kláves, kým sa ešte učíš, kde čo je.",
        },
        {
          p: "*Povrch* klávesnice — vzhľad klávesov — prichádza s účtom. Po prihlásení máš na výber päť a okrúhly existuje v šiestich farbách; jedna z nich sa riadi farbou tvojej témy. Všetko vyššie je tvoje tak či tak: jazyk, rozloženie, tvar ani prstové zóny nie sú nikdy zamknuté, pretože práve vďaka nim aplikácia sedí ku klávesnici, ktorú máš pred sebou.",
        },
      ],
    },
    {
      id: "display",
      nav: "Zobrazenie",
      heading: "Zobrazenie a pocit z písania",
      blocks: [
        {
          p: "Nastavenia Zobrazenie a Zadávanie textu ti umožnia ukazovať rýchlosť v slovách alebo v znakoch za minútu a doladiť, ako písanie pôsobí. Obnoviť predvolené je vždy na jedno kliknutie, keby si chcel začať odznova.",
        },
        {
          p: "Vzhľad celej stránky nájdeš v Účet, Vzhľad: svetlý, tmavý alebo podľa systému, farba témy a veľkosť textu, ktorá platí na každej stránke. Každý žiak v domácnosti má svoje vlastné nastavenia a tie putujú s ním — pozri *Starostlivosť o tvoje údaje*.",
        },
      ],
    },
    {
      id: "progress",
      nav: "Tvoj pokrok",
      heading: "Tvoj pokrok — stránka Profil",
      blocks: [
        {
          p: "Stránka Profil je tvoj kompletný záznam: hore štatistiky Za celý čas a Dnes (odcvičený čas, dokončené lekcie, tvoja najlepšia aj obvyklá rýchlosť a presnosť a ako si dnešok stojí v porovnaní); mapa všetkých písmen, ktoré si odomkol; príbeh o tom, ako každý jednotlivý kláves zrýchľoval, s posuvníkom vyhladenia; celkový obraz všetkých klávesov v čase; a najpomalšie prechody, ktoré ťa stále brzdia. Môžeš dokonca pretekať so svojím vlastným posledným behom ako s duchom a cítiť pokrok úplne priamo.",
        },
        { lab: "Otvorenie tvojho pokroku" },
        {
          steps: [
            "Otvor ponuku.",
            "Zvoľ Profil.",
          ],
        },
      ],
    },
    {
      id: "data",
      nav: "Tvoje údaje",
      heading: "Starostlivosť o tvoje údaje",
      blocks: [
        { lab: "Vymazanie štatistík profilu" },
        {
          steps: [
            "Otvor Profil žiaka, ktorého chceš vynulovať.",
            "Prejdi nadol k ovládaču vynulovania na konci stránky.",
            "Potvrď „Vymazať všetko“ — vymaže sa iba tento profil.",
          ],
        },
        { lab: "Stiahnutie údajov" },
        {
          steps: [
            "Otvor Profil.",
            "Pomocou možnosti stiahnutia si ulož históriu do súboru.",
          ],
        },
        {
          p: "Prihlás sa, ak chceš, aby sa história synchronizovala medzi zariadeniami, a aby si mohol zdieľať verejný odkaz na profil. Nie sú tu žiadne reklamné siete ani sledovače a svoje údaje — alebo celý účet — môžeš vymazať, kedykoľvek chceš.",
        },
        {
          p: "Prihlásenie teraz prenáša viac než len výsledky. Tvoje nastavenia, téma a veľkosť textu, zvolené možnosti prístupnosti aj vlastné predvoľby každého žiaka idú s profilom, nie s prehliadačom — takže žiak, ktorý otvorí KeyLearn na novom počítači, pokračuje tam, kde prestal, na tej istej obrazovke a s rovnakým nastavením, namiesto toho, aby začínal odznova s predvolenými hodnotami.",
        },
      ],
    },
    {
      id: "kids",
      nav: "Detský režim",
      heading: "Detský režim",
      blocks: [
        {
          p: "Deti precvičujú na hravom chodníku. Každý správny kláves posunie ich postavičku o krok bližšie domov a postavička rastie z maličkého bábätka na dospelého hrdinu, ako sa odomyká viac písmen. Novo naučený kláves spustí malú oslavu a každé sedenie končí pri útulnej vatre.",
        },
        { lab: "Prepnutie do Detského režimu" },
        {
          steps: [
            "Otvor ponuku.",
            "Zvoľ Deti — alebo vyber detský profil pod položkou Žiaci.",
          ],
        },
        {
          p: "Na výber sú dva svety — Dino Run s priateľským dinosaurom a Hero Trail, kde sa rytier vydáva na výpravu lesom — a v každom si vyberieš postavu.",
        },
      ],
    },
    {
      id: "toybox",
      nav: "Detská debnička hračiek",
      heading: "Detská debnička hračiek",
      blocks: [
        { lab: "Otvorenie debničky" },
        {
          steps: [
            "Na detskej obrazovke ťukni na ozubené koliesko hore v hracej ploche.",
          ],
        },
        {
          p: "Vnútri nastavíš svet a postavu, Veľké písmená, Zvuky, Pomocné ruky (žiariaceho sprievodcu prstami), Klávesnicu (skrytú, jednoduchú alebo celú pre dospelých), Písmená na chodníku (slová zobrazené ako kocky priamo v hre), Časovač sedenia, Povzbudzovanie (malé pochvalné odkazy) a — schované pod Pokročilými nastaveniami — posuvníky pre Jas, Farbu a to, ako živo svet pôsobí. Okrem jasného denného vzhľadu je tu aj pokojný nočný.",
        },
        {
          p: "*Key style* mení, ako sú klávesy vymaľované, a samotné klávesy sa nepohnú: *Crayon* je biely kláves orámovaný farbou svojho prsta a *Rainbow* je učebná klávesnica v základných farbách — zelený rám, červené čísla, modré písmená s odlíšenými samohláskami — kde sú klávesy rámu šípky namiesto slov, pre dieťa, ktoré ešte nevie prečítať „enter“. Všetci začínajú so štýlom Crayon. *Finger colours* hneď vedľa úplne vypne zafarbenie pre dieťa, ktoré ho už nepotrebuje.",
        },
      ],
    },
    {
      id: "ages",
      nav: "Ako dieťa rastie",
      heading: "Rastieme s tvojím dieťaťom",
      blocks: [
        {
          p: "KeyLearn sa nenápadne ladí podľa veku dieťaťa. Najmenší vidia veľké, priateľské písmená, zhovievavé tempo, písmenkové kocky priamo na chodníku a tú najjemnejšiu pomoc; staršie deti postupujú k dlhším slovám, plnej klávesnici a čistejšiemu vzhľadu. Stačí pri profile nastaviť rok narodenia a zvyšok sa urobí sám.",
        },
      ],
    },
    {
      id: "modes",
      nav: "Ďalšie režimy",
      heading: "Ďalšie spôsoby, ako precvičovať",
      blocks: [
        {
          p: "Okrem každodenného precvičovania je tu *Test rýchlosti* — rýchla jednorazová pasáž, ktorá ohlási tvoje slová za minútu a presnosť bez pripojenej lekcie; prieskumník *Rozloženia* na porovnávanie rozložení klávesníc a ich prstových máp; *Najlepšie výsledky*, kde uvidíš, ako si stojíš; a preteky pre *Viac hráčov*, kde si zmeriaš rýchlosť s ostatnými v reálnom čase.",
        },
        { lab: "Kde ich nájdeš" },
        {
          steps: [
            "Otvor ponuku.",
            "Zvoľ Test rýchlosti, Rozloženia, Najlepšie výsledky alebo Viac hráčov.",
          ],
        },
      ],
    },
    {
      id: "access",
      nav: "Keď ti niečo prekáža",
      heading: "Keď ti na aplikácii niečo prekáža",
      blocks: [
        {
          p: "Je na to celá stránka a nastavuje sa *pre každého žiaka zvlášť* — takže úpravy jedného človeka nikdy nič nezmenia ostatným.",
        },
        { lab: "Kde ju otvoríš" },
        {
          steps: [
            "Otvor ponuku a zvoľ Účet.",
            "Zvoľ Prístupnosť.",
            "Hore vyber žiaka a potom zapni toľko nastavení, koľko potrebuješ.",
          ],
        },
        {
          p: "Tých päť nastavení sa *kombinuje*. Niekto s dyslexiou a s trasom potrebuje dve z nich a nútiť ho vybrať si jedno by znamenalo, že sa aplikácia pýta, ktorému znevýhodneniu má vyjsť v ústrety.",
        },
        {
          tips: [
            "Pokoj — nič sa nehýbe, nič sa nepočíta, nič sa nemeria na čas a vynechaný deň sériu nepreruší.",
            "Menej vecí naraz — precvičovanie sa otvorí len so slovami a klávesnicou.",
            "Ľahšie čítanie — písmo vytvorené pre dyslexiu, väčšie rozostupy medzi písmenami aj riadkami, výraznejší text.",
            "Odlíšené farby — farby prstov, ktoré zostanú rozlíšiteľné aj pri farbosleposti, a chyby oznámené zvukom, nielen červenou.",
            "Pokojnejšie ruky — väčšie plochy na stlačenie, žiadne dva klávesy naraz a kláves, ktorý sa sám zopakuje, sa nepočíta dvakrát.",
          ],
        },
        {
          p: "Pod nimi *Nastaviť si každé zvlášť* otvorí všetky prepínače jednotlivo — je ich pätnásť, vrátane rýchlosti reči, titulkov ku všetkému, čo zaznie nahlas, čísla prsta na každom klávese a toho, ako dlho ignorovať zopakovaný kláves. Jedno tlačidlo vráti všetky späť.",
        },
      ],
    },
    {
      id: "braille",
      nav: "Braillovo písmo",
      heading: "Učenie na braillovej klávesnici",
      blocks: [
        {
          p: "Žiak, ktorý je nevidiaci alebo slabozraký, dostane úplne inú stránku — šesťklávesové braillovo písanie, osnovu v bunkách namiesto v písmenách a hovorené vedenie po celý čas. Je to samostatný spôsob, ako sa naučiť písať, nie stránka pre vidiacich čítaná nahlas.",
        },
        { lab: "Zapnutie pre konkrétneho žiaka" },
        {
          steps: [
            "Otvor ponuku a zvoľ Účet, potom Žiaci.",
            "Uprav žiaka alebo pridaj nového.",
            "Zapni podporu pre zrakové postihnutie a ulož.",
          ],
        },
        {
          p: "Taký žiak teraz zamieri rovno na braillovu stránku vždy, keď je na rade on. Jeho pokrok sa počíta v bunkách namiesto v písmenách a certifikát môže získať za rovnakých podmienok ako ktokoľvek iný.",
        },
      ],
    },
    {
      id: "courses",
      nav: "Dva kurzy",
      heading: "Vedené precvičovanie, Klasický kurz a kód",
      blocks: [
        {
          p: "*Vedené precvičovanie* je adaptívny kurz: sleduje, ktoré klávesy ťa spomaľujú, a stavia okolo nich tvoje lekcie — nové písmeno pridá až vtedy, keď tie doterajšie zvládneš písať rýchlo aj presne.",
        },
        {
          p: "*Klasický kurz* je ten staromódny — pevný rebrík lekcií v danom poradí, tak ako by to učila učebnica písania na stroji. Niektorí ľudia jednoducho radšej vedia, čo príde ďalej.",
        },
        {
          p: "Sú to oddelené kurzy s oddelenou históriou a certifikát sa získava na jednom alebo na druhom — nikdy na oboch spočítaných dokopy, lebo to by ti prvý týždeň započítalo dvakrát. Stránka Kurz v tvojom účte hovorí, o ktorom z nich práve podáva správu.",
        },
        {
          p: "*Remeslo kódu* je tretí druh precvičovania: naozajstné úryvky v jazyku, ktorý si vyberieš, takže zátvorky, bodkočiarky a odsadenie dostanú tréning, aký im bežná próza nikdy nedá.",
        },
        { lab: "Prepínanie medzi nimi" },
        {
          steps: [
            "Na obrazovke precvičovania otvor nastavenia lekcie.",
            "Zvoľ Vedené precvičovanie, Klasický kurz alebo Remeslo kódu.",
          ],
        },
      ],
    },
    {
      id: "certificates",
      nav: "Certifikáty",
      heading: "Ako získať certifikát",
      blocks: [
        {
          p: "Certifikát hovorí, že menovaný žiak písal nameranou rýchlosťou a presnosťou, v určitom jazyku a k určitému dátumu. Vydávame ho my — nie je to kvalifikácia, ktorú by nejaká skúšobná komisia alebo zamestnávateľ sľúbili uznávať — a je to poctivý doklad o tom, čo niekto naozaj zvládol.",
        },
        { lab: "Ako zistíš, koľko ti ešte chýba" },
        {
          steps: [
            "Otvor ponuku a zvoľ Účet.",
            "Zvoľ Kurz.",
            "Každý žiak má riadok so všetkými podmienkami a s tým, ako ďaleko v nich je.",
          ],
        },
        {
          p: "Podmienky sú veci ako uvedenie všetkých písmen, spoľahlivé zvládnutie každého písmena, nielen to, že sa s ním stretol, dosť lekcií, dosť rôznych dní a dlhodobo udržaná rýchlosť a presnosť. Keď sú splnené všetky, objaví sa v tom riadku odkaz na skúšku.",
        },
        {
          p: "Skúška je krátka a vyhodnocuje sa na našich serveroch, nie v tvojom prehliadači. Keď ju zložíš, certifikát sa vydá s číslom. Ktokoľvek, komu to číslo dáš, si ho môže overiť na stránke *Overiť certifikát* — a ty si vyberieš, či sa mu ukáže tvoje meno.",
        },
      ],
    },
    {
      id: "security",
      nav: "Bezpečnosť tvojho účtu",
      heading: "Prístupové kľúče, kódy a kto sa prihlasoval",
      blocks: [
        {
          p: "Prihlásiť sa môžeš heslom, cez poskytovateľa ako Google, odkazom poslaným na e-mail — alebo *prístupovým kľúčom*, ktorý by sme si vybrali my. Prístupový kľúč používa odtlačok prsta, tvár alebo PIN tvojho vlastného zariadenia; nie je tu žiadne heslo, ktoré by mohlo uniknúť, a nič z toho, čo u nás leží, by sa nedalo použiť na prihlásenie za teba.",
        },
        { lab: "Pridanie prístupového kľúča" },
        {
          steps: [
            "Otvor ponuku a zvoľ Účet, potom Zabezpečenie.",
            "Zvoľ Pridať prístupový kľúč a riaď sa pokynmi svojho zariadenia.",
          ],
        },
        {
          p: "Je tu aj *dvojstupňové overenie* pomocou overovacej aplikácie, so záložnými kódmi pre prípad, že o telefón prídeš. Vytlač si ich niekam, kde ten telefón nie je.",
        },
        {
          p: "Na tej istej stránke nájdeš aj nedávnu aktivitu — prihlásenia, neúspešné prihlásenia, pridaný prístupový kľúč, zmenené heslo — vždy s približným miestom, odkiaľ prišla, takže je ľahké si všimnúť niečo, čo si nerobil. Keď to vyzerá zle, *odhlásiť všade* ukončí všetky relácie okrem tej, ktorú máš práve otvorenú.",
        },
        {
          p: "Je tu aj *rodičovský PIN*, ktorý zamkne nastavenia účtu, aby dieťa na rodinnom zariadení nemohlo nič meniť ani zmazať profil.",
        },
      ],
    },
    {
      id: "yours",
      nav: "Uprav si to podľa seba",
      heading: "Uprav si to podľa seba",
      blocks: [
        { lab: "Zmena motívu" },
        {
          steps: [
            "Otvor ponuku a zvoľ Účet, potom Vzhľad.",
            "Vyber svetlý, tmavý alebo podľa zariadenia.",
          ],
        },
        {
          p: "Ak ti žiadny z dodaných motívov nesadne, *návrhár motívov* ti dovolí namiešať si vlastný — vrátane farieb prstov, ktorými klávesnica učí. Aplikácia meria kontrast toho, čo si vyberieš, a odmietne kombinácie, ktoré by nikto neprečítal.",
        },
        {
          p: "Každý žiak v domácnosti môže mať vlastnú farbu, takže zdieľané zariadenie stále pôsobí, že patrí tomu, kto pri ňom práve sedí.",
        },
        { lab: "Zmena jazyka stránok" },
        {
          steps: ["Otvor ponuku.", "V časti Jazyk stránok vyber svoj jazyk."],
        },
        {
          p: "Na obrazovke precvičovania môžeš navyše kedykoľvek zmeniť veľkosť textu a zapnúť alebo vypnúť zvuky.",
        },
      ],
    },
    {
      id: "privacy",
      nav: "Súkromie",
      heading: "Súkromie v jednej vete",
      blocks: [
        {
          p: "Žiadne reklamné siete a žiadne sledovače. Detský profil nikdy neopustí tvoj prehliadač. Prihlás sa iba vtedy, ak chceš synchronizáciu alebo zdieľanie; inak všetko zostane v tomto zariadení a môžeš to kedykoľvek vymazať.",
        },
        {
          p: "Na niektorých stránkach môžeš vidieť *sponzorovaný riadok*. Predali sme ho a zobrazujeme ho sami — nie je tu žiadna reklamná sieť a nič ťa nesleduje mimo stránky. Vyberá ho stránka, na ktorej práve si, nikdy nič, čo o tebe vieme, a nikdy sa nezobrazí dieťaťu, v detskom svete, na školskom účte ani počas lekcie. Ťukni pri ktoromkoľvek z nich na *Prečo to vidím?* a to isté vysvetlenie sa ukáže priamo tam; ľudia, ktorí projekt podporili, ho neuvidia vôbec.",
        },
      ],
    },
    {
      id: "support",
      nav: "Pomoc",
      heading: "Ako získať pomoc",
      blocks: [
        {
          p: "Každá správa, ktorú nám pošleš, sa stane *konverzáciou, ku ktorej sa môžeš vrátiť*, nie e-mailom, ktorý zmizne. Nájdeš ju v Účte a má vlastné referenčné číslo — to, ktoré uvedieš, ak niekedy znova zavoláš alebo napíšeš.",
        },
        { lab: "Požiadaj o pomoc" },
        {
          steps: [
            "Otvor ponuku a zvoľ Účet, potom Podpora.",
            "Zvoľ Podať žiadosť a napíš, čo sa deje.",
            "Ak to pomôže, prilož snímku obrazovky — PNG, JPG alebo PDF, každý do 10 MB.",
          ],
        },
        {
          p: "Odpovede sa zobrazujú v tejto konverzácii a zvonček v hlavičke sa rozsvieti, keď nejaká príde, takže nemusíš sedieť a sledovať stránku. Všetko vybavené sa zbalí pod Vyriešené, ktoré je na začiatku zatvorené — vidíš to, na čo ešte čakáš.",
        },
        { lab: "Kto odpovedá" },
        {
          p: "Najprv ju prečíta asistent menom Tab a odpovie na to, na čo vie. Povie ti, že je AI — nikdy nepredstiera opak — a priamo povie, keď niečo nevie.",
        },
        {
          p: "Vždy, keď je to lepšia odpoveď, to prevezme človek: všetko, čo sa týka peňazí, tvojich údajov, bezpečnosti, alebo jednoducho preto, že si o to požiadal. Nikdy nemusíš žiadať dvakrát ani sa opakovať — ten, kto to prevezme, už vidí všetko, čo si napísal.",
        },
        {
          p: "Ak správa niekedy vyzerá ako skutočná núdzová situácia, odpoveď je zakaždým rovnaká a pochádza z pevného textu, nie od asistenta: tiesňové číslo tam, kde sa nachádzaš, a okamžite upozornený človek na našej strane. Zavolať za teba nemôžeme a hovoríme to otvorene.",
        },
        { lab: "Upratovanie" },
        {
          p: "Konverzáciu môžeš kedykoľvek odstrániť zo zoznamu ikonou koša vedľa nej. Malá poznámka pri *Podať žiadosť* počíta, koľko si ich odstránil, takže zmiznuté vlákno nikdy nie je záhadou.",
        },
        {
          p: "Na spoločnom rodinnom zariadení si sekcia Podpora pred otvorením vypýta PIN pre dospelých — vlákna podpory sú záležitosťou účtu a ten, kto precvičuje, nie je vždy ten, kto účet založil.",
        },
      ],
    },
    {
      id: "signout",
      nav: "Odhlásenie",
      heading: "Odhlásenie",
      blocks: [
        { lab: "Odhlásiť sa" },
        { steps: ["Otvor ponuku.", "Zvoľ Odhlásiť sa a potvrď."] },
        {
          p: "Tvoja história precvičovania zostane v bezpečí na tomto zariadení — a na tvojom účte, ak si si nejaký založil — pripravená na nabudúce, keď si zase sadneš písať.",
        },
      ],
    },
    {
      id: "tips",
      nav: "Tipy",
      heading: "Pár návykov, ktoré naozaj pomáhajú",
      blocks: [
        {
          tips: [
            "Presnosť pred rýchlosťou — čisté písanie je to, čo sa usadí.",
            "Chyby oprav v pokoji; nežeň sa, aby si to dobehol.",
            "Nechaj prsty odpočívať na základnom rade — F a J majú malé hrbolčeky.",
            "Pár minút každý deň je lepších ako hodina raz za týždeň.",
          ],
        },
      ],
    },
  ],
};
