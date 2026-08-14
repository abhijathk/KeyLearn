import { type GuideTranslation } from "../guide-content.tsx";

export const sl: GuideTranslation = {
  kicker: "Vse, kar lahko počneš",
  title: "Uporabniški priročnik",
  dateline: "Popoln vodnik po KeyLearnu — od prvega obiska do odjave",
  navLabel: "Na tej strani",
  sections: [
    {
      id: "account",
      nav: "Ali potrebujem račun?",
      heading: "Ali potrebujem račun?",
      blocks: [
        {
          p: "Ne. Tipkati lahko začneš takoj, ko prideš sem, in tvoj napredek se shranjuje kar tu, na tej napravi. Brezplačen račun ustvari samo, če želiš, da ti zgodovina sledi na druge naprave, če želiš varnostno kopijo ali deliti povezavo do profila. Nič uporabnega ni zaklenjeno za prijavo.",
        },
      ],
    },
    {
      id: "signin",
      nav: "Prijava in gesla",
      heading: "Registracija, prijava in gesla",
      blocks: [
        { p: "Vse najdeš v meniju zgoraj desno." },
        { lab: "Ustvari račun" },
        {
          steps: [
            "Odpri meni (zgoraj desno).",
            "Izberi Registracija.",
            "Vnesi e-poštni naslov in geslo.",
            "Potrdi — in že si notri.",
          ],
        },
        { lab: "Prijava" },
        {
          steps: [
            "Odpri meni in izberi Prijava.",
            "Vnesi svoj e-poštni naslov in geslo.",
          ],
        },
        { lab: "Ponastavitev pozabljenega gesla" },
        {
          steps: [
            "Na prijavnem zaslonu izberi Pozabljeno geslo.",
            "Vnesi svoj e-poštni naslov.",
            "Odpri povezavo za ponastavitev, ki ti jo pošljemo.",
            "Izberi novo geslo in se prijavi.",
          ],
        },
      ],
    },
    {
      id: "profiles",
      nav: "Profili",
      heading: "Profili za vse gospodinjstvo",
      blocks: [
        {
          p: "KeyLearn je zasnovan kot gospodinjstvo: en račun ima do štiri profile (osem s premium različico), odrasle in otroke v poljubni mešanici. Vsak profil ima na tej napravi *svoj lasten* ločen napredek — nič se nikoli ne pomeša.",
        },
        { lab: "Dodaj profil" },
        {
          steps: [
            "Odpri meni in izberi Račun (ali „Nastavi profile“).",
            "Izberi Dodaj profil.",
            "Vpiši ime.",
            "Označi ga kot Odraslega ali Otroka.",
            "Izberi avatar — prijazno ikono ali Fotografijo iz svoje naprave.",
            "Pri otroku dodaj letnico rojstva (po njej se samo uglasita besedišče in tempo njegovi starosti).",
            "Shrani.",
          ],
        },
        { lab: "Preklopi na drugega učenca" },
        {
          steps: [
            "Odpri meni.",
            "Tapni obraz pod Učenci — aplikacija nadaljuje tam, kjer je ostal.",
          ],
        },
        { lab: "Uredi ali odstrani profil" },
        {
          steps: [
            "Odpri meni in izberi Račun.",
            "Pri profilu izberi Uredi ali ga izbriši in sprosti mesto.",
          ],
        },
        {
          p: "Otroški profili dobijo poenostavljen, zaklenjen meni, dejanja za odrasle pa se skrivajo za hitrim računskim vprašanjem „koliko je A krat B?“, da se najmlajši ne zaidejo v nastavitve.",
        },
      ],
    },
    {
      id: "screen",
      nav: "Zaslon za vadbo",
      heading: "Zaslon za vadbo",
      blocks: [
        {
          p: "Kar začni tipkati. Beseda, ki jo potrebuješ, lebdi tik nad zaslonsko tipkovnico; svetleč komet kaže na čisto naslednjo tipko; tipke so obarvane po prstnih conah, da se naučiš, kateri prst seže kam; rahel par počivajočih rok pa kaže, kje tvoji prsti živijo med udarci. Vsa veščina je ena sama navada: oči drži na besedah, ne na rokah.",
        },
      ],
    },
    {
      id: "journey",
      nav: "Tvoja pot",
      heading: "Kako lekcije rastejo — tvoja pot",
      blocks: [
        {
          p: "KeyLearn je *prilagodljiv*. Meri, kako hitro in čisto zadeneš vsako tipko, in novo črko doda v tvoj nabor šele, ko znaš obstoječe tipkati hitro in natančno. Ta rastoči nabor je tvoja pot, od peščice črk do celotne abecede — težavnost narašča točno tako hitro kot ti, nikoli hitreje, tako da vedno delaš prav na svojem robu.",
        },
      ],
    },
    {
      id: "readout",
      nav: "Statistika v živo",
      heading: "Prikaz v živo",
      blocks: [
        {
          p: "Med tipkanjem lebdeča plošča kaže tvojo trenutno hitrost in natančnost, majhen graf zadnjih poskusov, napredek pri ciljih in tvoj niz dni. Tu je zato, da te spodbuja, ne da te priganja.",
        },
      ],
    },
    {
      id: "tools",
      nav: "Orodja za vadbo",
      heading: "Orodja za vadbo",
      blocks: [
        {
          p: "Majhna orodja ob besedilu ti omogočajo, da odpreš vodeni ogled, znova zaženeš trenutno lekcijo (Ctrl + levo), preskočiš na naslednjo (Ctrl + desno), pokažeš ali skriješ zaslonsko tipkovnico in spremeniš velikost vadbenega besedila. Zobnik odpre celotne Nastavitve, ki so opisane v nadaljevanju.",
        },
      ],
    },
    {
      id: "content",
      nav: "Kaj tipkaš",
      heading: "Izbira tega, kaj tipkaš",
      blocks: [
        {
          p: "Odpri Nastavitve in pojdi na Vsebina vadbe, da izbereš, kako nastajajo tvoje besede:",
        },
        {
          tips: [
            "*Vodena vadba* — prilagodljiva privzeta izbira, ki tvojo abecedo širi tipko za tipko.",
            "*Klasični tečaj* — trden, urejen pohod skozi tipke.",
            "*Pogoste besede* — najpogostejše besede tvojega jezika.",
            "*Besedilo iz knjige* — pretipkaj se skozi prave knjige, vgrajene v aplikacijo.",
            "*Lastno besedilo* — prilepi karkoli želiš in vadi na tem.",
            "*Odlomki kode* — oklepaji, simboli in ritem kode.",
            "*Vaje s števili* — številska vrstica in številčnica.",
          ],
        },
        { lab: "Spremeni, kaj tipkaš" },
        {
          steps: [
            "Odpri Nastavitve (zobnik ob vadbenem besedilu).",
            "Pojdi na Vsebina vadbe.",
            "Izberi način — pri Besedilu iz knjige izberi knjigo, pri Lastnem besedilu prilepi svoje besede.",
            "Zapri Nastavitve in tipkaj naprej.",
          ],
        },
        {
          p: "Na istem zaslonu nastaviš velikost svoje abecede, ciljno hitrost, kako dolga je vsaka lekcija in dnevni cilj.",
        },
      ],
    },
    {
      id: "smart",
      nav: "Pametna vadba",
      heading: "Pomočniki pametne vadbe",
      blocks: [
        {
          p: "Poleg vodene vadbe Pametna vadba dodaja nežne pomočnike: vajo za ozka grla, ki izsledi tvoje najpočasnejše pare tipk, razporejeno ponavljanje, osvežitve za bledeče znanje, ki se vrnejo k zarjavelim tipkam, pametno samozavest in obnovo tipk. Vsi so privzeto vklopljeni.",
        },
        { lab: "Vklopi ali izklopi pomočnika" },
        {
          steps: [
            "Odpri Nastavitve.",
            "Pojdi na Pametna vadba.",
            "Preklopi katerega koli pomočnika — ali pa jih pusti vse vklopljene.",
          ],
        },
      ],
    },
    {
      id: "keyboard",
      nav: "Nastavitev tipkovnice",
      heading: "Nastavitev tvoje tipkovnice",
      blocks: [
        {
          p: "V Nastavitvah, pod Nastavitev tipkovnice, uskladiš KeyLearn s svojo tipkovnico in z razporeditvijo, ki se je želiš naučiti.",
        },
        { lab: "Spremeni razporeditev tipkovnice" },
        {
          steps: [
            "Odpri Nastavitve.",
            "Pojdi na Nastavitev tipkovnice.",
            "Izberi svoj jezik in nato razporeditev (QWERTY, Dvorak, Colemak in druge).",
            "Pusti vklopljeno „Simuliraj to razporeditev“, da jo lahko vadiš ne glede na to, kako je nastavljen tvoj računalnik.",
            "Za potrditev opazuj predogled v živo.",
          ],
        },
        {
          p: "Na istem zaslonu lahko izbereš obliko tipkovnice, obarvaš tipke po prstnih conah in osvetliš naslednjo tipko, dokler se še učiš, kje je kaj.",
        },
      ],
    },
    {
      id: "display",
      nav: "Prikaz",
      heading: "Prikaz in občutek",
      blocks: [
        {
          p: "Nastavitvi Prikaz in Vnos besedila ti omogočata, da hitrost prikažeš v besedah ali znakih na minuto in natančno uglasiš, kakšen je občutek pri tipkanju. Obnovi privzeto je vedno en klik stran, če želiš začeti na novo.",
        },
      ],
    },
    {
      id: "progress",
      nav: "Tvoj napredek",
      heading: "Tvoj napredek — stran Profil",
      blocks: [
        {
          p: "Stran Profil je tvoj celoten zapis: zgoraj statistika Ves čas in Danes (čas vadbe, opravljene lekcije, tvoja najboljša in običajna hitrost ter natančnost in kako se današnji dan primerja); zemljevid vseh črk, ki si jih odklenil; zgodba o tem, kako je vsaka posamezna tipka postajala hitrejša, z drsnikom za glajenje; celotna slika vseh tipk skozi čas; in najpočasnejši prehodi, ki te še vedno zavirajo. Lahko se celo poganjaš s svojim zadnjim poskusom kot z duhom in napredek občutiš čisto neposredno.",
        },
        { lab: "Odpri svoj napredek" },
        {
          steps: [
            "Odpri meni.",
            "Izberi Profil.",
            "Z vrstico filtrov se osredotoči na Črke, Števke, Ločila ali Simbole.",
          ],
        },
      ],
    },
    {
      id: "data",
      nav: "Tvoji podatki",
      heading: "Skrb za tvoje podatke",
      blocks: [
        { lab: "Počisti statistiko profila" },
        {
          steps: [
            "Odpri Profil učenca, ki ga želiš ponastaviti.",
            "Podrsaj do gumba za ponastavitev na dnu strani.",
            "Potrdi „Izbriši vse“ — počisti se samo ta profil.",
          ],
        },
        { lab: "Prenesi svoje podatke" },
        {
          steps: [
            "Odpri Profil.",
            "Z možnostjo prenosa shrani svojo zgodovino kot datoteko.",
          ],
        },
        {
          p: "Prijavi se, če želiš, da se tvoja zgodovina sinhronizira med napravami in da lahko deliš javno povezavo do profila. Ni oglasov in ni sledilcev, svoje podatke — ali cel račun — pa lahko izbrišeš, kadar koli želiš.",
        },
      ],
    },
    {
      id: "kids",
      nav: "Otroški način",
      heading: "Otroški način",
      blocks: [
        {
          p: "Otroci vadijo na igrivi stezi. Vsaka pravilna tipka popelje njihov lik korak bližje domu, lik pa iz drobnega dojenčka zraste v odraslega junaka, ko se odklepa vse več črk. Na novo naučena tipka sproži majhno slavje, vsako srečanje pa se konča ob prijetnem taborniškem ognju.",
        },
        { lab: "Preklopi na Otroke" },
        {
          steps: [
            "Odpri meni.",
            "Izberi Otroci — ali izberi otroški profil pod Učenci.",
          ],
        },
        {
          p: "Na voljo sta dva svetova — Dino Run s prijaznim dinozavrom in Hero Trail, kjer se vitez odpravi na pohod skozi gozd — v vsakem pa izbereš svoj lik.",
        },
      ],
    },
    {
      id: "toybox",
      nav: "Otroška skrinja z igračami",
      heading: "Otroška skrinja z igračami",
      blocks: [
        { lab: "Odpri skrinjo" },
        {
          steps: [
            "Na otroškem zaslonu tapni zobnik na vrhu igralnega prostora.",
          ],
        },
        {
          p: "Znotraj lahko nastaviš svet in lik, Velike črke, Zvoke, Pomožne roke (svetleče vodilo za prste), Tipkovnico (skrito, preprosto ali celotno za odrasle), Črke na stezi (besede, prikazane kot kocke kar v igri), Časovnik srečanja, Navijanje (male spodbudne besede) in — skrite pod Napredno — drsnike za Svetlost, Barvo in za to, kako živahen je svet. Poleg svetle dnevne je na voljo tudi mirna nočna podoba.",
        },
      ],
    },
    {
      id: "ages",
      nav: "Odraščanje",
      heading: "Rastemo s tvojim otrokom",
      blocks: [
        {
          p: "KeyLearn se tiho uglasi na otrokovo starost. Najmlajši vidijo velike, prijazne črke, prizanesljiv tempo, črkovne kocke kar na stezi in najnežnejšo pomoč; starejši otroci napredujejo k daljšim besedam, celotni tipkovnici in čistejšemu videzu. Na profilu preprosto nastavi letnico rojstva in vse ostalo se zgodi samo.",
        },
      ],
    },
    {
      id: "modes",
      nav: "Drugi načini",
      heading: "Drugi načini vadbe",
      blocks: [
        {
          p: "Poleg vsakodnevne vadbe je tu *Test hitrosti* — hiter enkraten odlomek, ki sporoči tvoje besede na minuto in natančnost, brez pripete lekcije; raziskovalec *Razporeditve* za primerjanje razporeditev tipkovnic in njihovih prstnih zemljevidov; *Najboljši rezultati*, kjer vidiš, kako se odrežeš; in *Večigralske* dirke, kjer svojo hitrost v resničnem času meriš z drugimi.",
        },
        { lab: "Kje jih najdeš" },
        {
          steps: [
            "Odpri meni.",
            "Izberi Test hitrosti, Razporeditve, Najboljši rezultati ali Večigralsko igro.",
          ],
        },
      ],
    },
    {
      id: "access",
      nav: "Če ti kaj napoti",
      heading: "Če ti je pri aplikaciji kaj napoti",
      blocks: [
        {
          p: "Za to obstaja cela stran in nastavlja se *za vsakega učenca posebej* — tako prilagoditve enega nikoli ne spremenijo ničesar drugim.",
        },
        { lab: "Kje jo odpreš" },
        {
          steps: [
            "Odpri meni in izberi Račun.",
            "Izberi Dostopnost.",
            "Na vrhu izberi učenca in nato vklopi toliko nastavitev, kolikor jih potrebuješ.",
          ],
        },
        {
          p: "Teh pet nastavitev se *združuje*. Nekdo z disleksijo in tresenjem rok potrebuje dve od njiju in siliti ga, naj izbere eno, bi pomenilo, da aplikacija sprašuje, kateri težavi naj gre naproti.",
        },
        {
          tips: [
            "Mirno — nič se ne premika, nič se ne šteje, nič ni na čas in izpuščen dan ne prekine niza.",
            "Manj stvari hkrati — vadba se odpre samo z besedami in tipkovnico.",
            "Lažje branje — pisava, narejena za disleksijo, več prostora med črkami in vrsticami, močnejše besedilo.",
            "Ločene barve — barve prstov, ki ostanejo razločne tudi pri barvni slepoti, in napake, izrečene z zvokom, ne le z rdečo.",
            "Mirnejše roke — večje površine za pritisk, nikoli dve tipki hkrati in tipka, ki se sama ponovi, se ne šteje dvakrat.",
          ],
        },
        {
          p: "Pod njimi *Vsako nastavim sam* odpre vsako stikalo posebej — petnajst jih je, med njimi hitrost govora, podnapisi za vse, kar je izgovorjeno na glas, številka prsta na vsaki tipki in to, kako dolgo naj se ponovljena tipka prezre. En sam gumb vse skupaj vrne nazaj.",
        },
      ],
    },
    {
      id: "braille",
      nav: "Braille",
      heading: "Učenje na braillovi tipkovnici",
      blocks: [
        {
          p: "Učenec, ki je slep ali slaboviden, dobi povsem drugačno stran — šesttipkovni braillov vnos, učni načrt v celicah namesto v črkah in govorjeno vodenje ves čas. To je samostojen način učenja tipkanja, ne pa stran za videče, prebrana na glas.",
        },
        { lab: "Vklopi ga za učenca" },
        {
          steps: [
            "Odpri meni in izberi Račun, nato Učenci.",
            "Uredi učenca ali dodaj novega.",
            "Vklopi podporo za slepe in slabovidne ter shrani.",
          ],
        },
        {
          p: "Ta učenec zdaj gre naravnost na braillovo stran vsakič, ko je on tisti, ki vadi. Njegov napredek se šteje v celicah namesto v črkah, potrdilo pa lahko pridobi pod enakimi pogoji kot kdor koli drug.",
        },
      ],
    },
    {
      id: "courses",
      nav: "Dva tečaja",
      heading: "Vodena vadba, Klasični tečaj in koda",
      blocks: [
        {
          p: "*Vodena vadba* je prilagodljiv tečaj: opazuje, katere tipke te upočasnjujejo, in okoli njih gradi tvoje lekcije — novo črko doda šele, ko znaš dosedanje tipkati hitro in natančno.",
        },
        {
          p: "*Klasični tečaj* je tisti staromodni — trdna lestev lekcij v določenem vrstnem redu, tako kot bi učila knjiga o tipkanju. Nekaterim je preprosto ljubše, da vedo, kaj pride naslednje.",
        },
        {
          p: "To sta ločena tečaja z ločeno zgodovino in potrdilo se pridobi na enem ali na drugem — nikoli na obeh, seštetih skupaj, saj bi ti to prvi teden preštelo dvakrat. Stran Tečaj v tvojem računu pove, o katerem od njiju poroča.",
        },
        {
          p: "*Mojstrstvo kode* je tretja vrsta vadbe: pravi odlomki v jeziku, ki ga izbereš, tako da oklepaji, podpičja in zamiki dobijo trening, ki jim ga navadna proza nikoli ne da.",
        },
        { lab: "Preklapljanje med njimi" },
        {
          steps: [
            "Na zaslonu za vadbo odpri nastavitve lekcije.",
            "Izberi Vodena vadba, Klasični tečaj ali Mojstrstvo kode.",
          ],
        },
      ],
    },
    {
      id: "certificates",
      nav: "Potrdila",
      heading: "Kako pridobiš potrdilo",
      blocks: [
        {
          p: "Potrdilo pove, da je imenovani učenec tipkal z izmerjeno hitrostjo in natančnostjo, v določenem jeziku in na določen datum. Izdamo ga mi — ni kvalifikacija, ki bi jo kakšna izpitna komisija ali delodajalec obljubila priznavati — je pa pošten dokaz o tem, kar je nekdo res naredil.",
        },
        { lab: "Poglej, koliko ti še manjka" },
        {
          steps: [
            "Odpri meni in izberi Račun.",
            "Izberi Tečaj.",
            "Vsak učenec ima vrstico z vsemi pogoji in s tem, kako daleč je pri njih.",
          ],
        },
        {
          p: "Pogoji so stvari, kot so: vse črke uvedene, vsaka črka zanesljiva in ne le enkrat srečana, dovolj lekcij, dovolj različnih dni ter vzdržana hitrost in natančnost. Ko so izpolnjeni vsi, se v tisti vrstici pojavi povezava do preizkusa.",
        },
        {
          p: "Preizkus je kratek in se ocenjuje na naših strežnikih, ne v tvojem brskalniku. Če ga opraviš, se potrdilo izda s številko. Kdor koli, ki mu to številko daš, jo lahko preveri na strani *Preveri potrdilo* — ti pa izbereš, ali se mu pokaže tvoje ime.",
        },
      ],
    },
    {
      id: "security",
      nav: "Varnost tvojega računa",
      heading: "Ključi za dostop, kode in kdo se je prijavljal",
      blocks: [
        {
          p: "Prijaviš se lahko z geslom, prek ponudnika, kot je Google, s povezavo, poslano na e-pošto — ali s *ključem za dostop*, ki bi ga izbrali mi. Ključ za dostop uporablja prstni odtis, obraz ali PIN tvoje naprave; ni gesla, ki bi lahko ušlo, in nič od tega, kar hranimo mi, ne bi bilo mogoče uporabiti za prijavo namesto tebe.",
        },
        { lab: "Dodaj ključ za dostop" },
        {
          steps: [
            "Odpri meni in izberi Račun, nato Varnost.",
            "Izberi Dodaj ključ za dostop in sledi navodilom svoje naprave.",
          ],
        },
        {
          p: "Tu je tudi *dvostopenjsko preverjanje* z aplikacijo za overjanje in obnovitvenimi kodami, če telefon izgubiš. Natisni jih nekam, kjer ni tega telefona.",
        },
        {
          p: "Ista stran našteva nedavno dogajanje — prijave, neuspele prijave, dodan ključ za dostop, spremenjeno geslo — vsakič s približno lokacijo, od koder je prišlo, tako da je nekaj, česar nisi storil ti, lahko opaziti. Če je videti narobe, *odjava povsod* konča vse seje razen tiste, ki jo uporabljaš.",
        },
        {
          p: "Na voljo je tudi *starševski PIN*, ki zaklene nastavitve računa, da jih otrok na družinski napravi ne more spreminjati ali izbrisati profila.",
        },
      ],
    },
    {
      id: "yours",
      nav: "Naredi si po svoje",
      heading: "Naredi si po svoje",
      blocks: [
        { lab: "Spremeni temo" },
        {
          steps: [
            "Odpri meni in izberi Račun, nato Videz.",
            "Izberi svetlo, temno ali po napravi.",
          ],
        },
        {
          p: "Če nobena od priloženih tem ni tista prava, ti *oblikovalnik tem* omogoči, da zmešaš svojo — vključno z barvami prstov, s katerimi uči tipkovnica. Aplikacija izmeri kontrast vsega, kar izbereš, in zavrne kombinacije, ki jih nihče ne bi mogel prebrati.",
        },
        {
          p: "Vsak učenec v gospodinjstvu ima lahko svojo barvo, tako da si skupna naprava še vedno zdi last tistega, ki trenutno sedi za njo.",
        },
        { lab: "Spremeni jezik strani" },
        {
          steps: ["Odpri meni.", "Pod Jezik strani izberi svoj jezik."],
        },
        {
          p: "Na zaslonu za vadbo lahko kadar koli spremeniš tudi velikost besedila ter vklopiš ali izklopiš zvoke.",
        },
      ],
    },
    {
      id: "privacy",
      nav: "Zasebnost",
      heading: "Zasebnost, v enem stavku",
      blocks: [
        {
          p: "Brez oglasov in brez sledilcev. Otrokov profil nikoli ne zapusti tvojega brskalnika. Prijavi se samo, če želiš sinhronizacijo ali deljenje; sicer vse ostane na tej napravi in lahko to kadar koli izbrišeš.",
        },
      ],
    },
    {
      id: "signout",
      nav: "Odjava",
      heading: "Odjava",
      blocks: [
        { lab: "Odjavi se" },
        { steps: ["Odpri meni.", "Izberi Odjava in potrdi."] },
        {
          p: "Tvoja zgodovina vadbe ostane varno na tej napravi — in na tvojem računu, če si ga ustvaril — pripravljena za naslednjič, ko sedeš k tipkanju.",
        },
      ],
    },
    {
      id: "tips",
      nav: "Nasveti",
      heading: "Nekaj navad, ki resnično pomagajo",
      blocks: [
        {
          tips: [
            "Natančnost pred hitrostjo — čisto tipkanje je tisto, kar se prime.",
            "Napake popravljaj mirno; ne hiti, da bi nadoknadil.",
            "Prste naslanjaj na osnovno vrsto — F in J imata majhni izboklini.",
            "Nekaj minut vsak dan je bolje kot ura enkrat na teden.",
          ],
        },
      ],
    },
  ],
};
