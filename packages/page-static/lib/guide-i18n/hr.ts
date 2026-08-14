import { type GuideTranslation } from "../guide-content.tsx";

export const hr: GuideTranslation = {
  kicker: "Sve što možeš raditi",
  title: "Korisnički vodič",
  dateline: "Potpuni vodič kroz KeyLearn — od prvog posjeta do odjave",
  navLabel: "Na ovoj stranici",
  sections: [
    {
      id: "account",
      nav: "Trebam li račun?",
      heading: "Trebam li račun?",
      blocks: [
        {
          p: "Ne. Možeš početi tipkati čim dođeš, a tvoj se napredak sprema ovdje, na ovom uređaju. Besplatan račun otvori samo ako želiš da te povijest prati na druge uređaje, da imaš sigurnosnu kopiju ili da podijeliš poveznicu na profil. Ništa korisno nije zaključano iza prijave.",
        },
      ],
    },
    {
      id: "signin",
      nav: "Prijava i lozinke",
      heading: "Registracija, prijava i lozinke",
      blocks: [
        { p: "Sve se nalazi u izborniku gore desno." },
        { lab: "Otvori račun" },
        {
          steps: [
            "Otvori izbornik (gore desno).",
            "Odaberi Registracija.",
            "Upiši e-poštu i lozinku.",
            "Potvrdi — i unutra si.",
          ],
        },
        { lab: "Prijavi se" },
        {
          steps: [
            "Otvori izbornik i odaberi Prijava.",
            "Upiši svoju e-poštu i lozinku.",
          ],
        },
        { lab: "Poništi zaboravljenu lozinku" },
        {
          steps: [
            "Na zaslonu za prijavu odaberi Zaboravljena lozinka.",
            "Upiši svoju adresu e-pošte.",
            "Otvori poveznicu za poništavanje koju ti pošaljemo.",
            "Odaberi novu lozinku i prijavi se.",
          ],
        },
      ],
    },
    {
      id: "profiles",
      nav: "Profili",
      heading: "Profili za cijelo kućanstvo",
      blocks: [
        {
          p: "KeyLearn je zamišljen kao kućanstvo: jedan račun drži do četiri profila (osam uz premium), odrasle i djecu u bilo kojoj kombinaciji. Svaki profil čuva *vlastiti*, odvojeni napredak na ovom uređaju — ništa se nikad ne miješa.",
        },
        { lab: "Dodaj profil" },
        {
          steps: [
            "Otvori izbornik i odaberi Račun (ili „Postavi profile”).",
            "Odaberi Dodaj profil.",
            "Upiši ime.",
            "Označi je li riječ o Odrasloj osobi ili o Djetetu.",
            "Odaberi avatar — simpatičnu ikonu ili Fotografiju sa svog uređaja.",
            "Za dijete dodaj godinu rođenja (ona samo prilagođava riječi i ritam njegovoj dobi).",
            "Spremi.",
          ],
        },
        { lab: "Prebaci se na drugog polaznika" },
        {
          steps: [
            "Otvori izbornik.",
            "Dodirni lice pod Polaznici — aplikacija nastavlja tamo gdje je stalo.",
          ],
        },
        { lab: "Uredi ili ukloni profil" },
        {
          steps: [
            "Otvori izbornik i odaberi Račun.",
            "Odaberi Uredi na profilu ili ga izbriši da oslobodiš mjesto.",
          ],
        },
        {
          p: "Dječji profili dobivaju pojednostavljen, zaključan izbornik, a radnje za odrasle skrivene su iza brzog matematičkog pitanja „koliko je A puta B?”, da mališani ne odlutaju u postavke.",
        },
      ],
    },
    {
      id: "screen",
      nav: "Zaslon za vježbu",
      heading: "Zaslon za vježbu",
      blocks: [
        {
          p: "Samo počni tipkati. Riječ koja ti treba lebdi tik iznad zaslonske tipkovnice; užareni komet pokazuje na sljedeću tipku; tipke su obojene po zonama prstiju pa učiš koji prst kamo poseže; a blijedi par ruku u mirovanju pokazuje gdje tvoji prsti žive između pritisaka. Cijela je vještina jedna jedina navika: drži pogled na riječima, a ne na rukama.",
        },
      ],
    },
    {
      id: "journey",
      nav: "Tvoje putovanje",
      heading: "Kako lekcije rastu — tvoje putovanje",
      blocks: [
        {
          p: "KeyLearn je *prilagodljiv*. Mjeri koliko brzo i koliko čisto pogađaš svaku tipku i dodaje novo slovo u tvoj skup tek kad postojeća tipkaš i brzo i točno. Taj skup koji raste tvoje je putovanje, od šačice slova do cijele abecede — težina raste točno onoliko brzo koliko i ti, nikad brže, pa uvijek radiš baš na svojoj granici.",
        },
      ],
    },
    {
      id: "readout",
      nav: "Statistika uživo",
      heading: "Prikaz uživo",
      blocks: [
        {
          p: "Dok tipkaš, plutajuća ploča pokazuje tvoju trenutnu brzinu i točnost, mali grafikon posljednjih pokušaja, napredak prema ciljevima i tvoj niz. Tu je da te ohrabri, a ne da gnjavi.",
        },
      ],
    },
    {
      id: "tools",
      nav: "Alati za vježbu",
      heading: "Alati za vježbu",
      blocks: [
        {
          p: "Mali alati uz tekst omogućuju ti da otvoriš vođeni obilazak, ponovno pokreneš trenutnu lekciju (Ctrl + lijevo), preskočiš na sljedeću (Ctrl + desno), pokažeš ili sakriješ zaslonsku tipkovnicu i promijeniš veličinu teksta za vježbu. Zupčanik otvara pune Postavke, opisane u nastavku.",
        },
      ],
    },
    {
      id: "content",
      nav: "Što tipkaš",
      heading: "Biranje onoga što tipkaš",
      blocks: [
        {
          p: "Otvori Postavke i idi na Sadržaj vježbe da odabereš od čega nastaju tvoje riječi:",
        },
        {
          tips: [
            "*Vođena vježba* — prilagodljiva zadana postavka koja ti abecedu širi tipku po tipku.",
            "*Klasični tečaj* — čvrst, uređen marš kroz tipke.",
            "*Česte riječi* — najčešće riječi tvojega jezika.",
            "*Tekst iz knjige* — protipkaj se kroz prave knjige ugrađene u aplikaciju.",
            "*Vlastiti tekst* — zalijepi što god želiš i vježbaj na tome.",
            "*Isječci koda* — zagrade, simboli i ritam koda.",
            "*Vježbe s brojevima* — red brojeva i numerička tipkovnica.",
          ],
        },
        { lab: "Promijeni što tipkaš" },
        {
          steps: [
            "Otvori Postavke (zupčanik uz tekst za vježbu).",
            "Idi na Sadržaj vježbe.",
            "Odaberi način rada — za Tekst iz knjige odaberi knjigu, za Vlastiti tekst zalijepi svoje riječi.",
            "Zatvori Postavke i nastavi tipkati.",
          ],
        },
        {
          p: "Isti zaslon postavlja veličinu tvoje abecede, ciljanu brzinu, trajanje svake lekcije i dnevni cilj.",
        },
      ],
    },
    {
      id: "smart",
      nav: "Pametna vježba",
      heading: "Pomagači Pametne vježbe",
      blocks: [
        {
          p: "Uz vođenu vježbu, Pametna vježba dodaje nježne pomagače: vježbu uskih grla koja lovi tvoje najsporije parove tipki, razmaknuto ponavljanje, osvježavanje zahrđalih vještina koje se vraća zaboravljenim tipkama, pametno samopouzdanje i oporavak tipki. Svi su uključeni prema zadanim postavkama.",
        },
        { lab: "Uključi ili isključi pomagač" },
        {
          steps: [
            "Otvori Postavke.",
            "Idi na Pametnu vježbu.",
            "Uključi ili isključi koji god želiš — ili ih ostavi sve uključene.",
          ],
        },
      ],
    },
    {
      id: "keyboard",
      nav: "Postavljanje tipkovnice",
      heading: "Postavljanje tvoje tipkovnice",
      blocks: [
        {
          p: "U Postavkama, pod Postavljanje tipkovnice, usklađuješ KeyLearn sa svojom tipkovnicom i s rasporedom koji želiš naučiti.",
        },
        { lab: "Promijeni raspored tipkovnice" },
        {
          steps: [
            "Otvori Postavke.",
            "Idi na Postavljanje tipkovnice.",
            "Odaberi svoj jezik, pa svoj raspored (QWERTY, Dvorak, Colemak i drugi).",
            "Ostavi uključeno „Simuliraj ovaj raspored” da ga možeš vježbati bez obzira na to kako je postavljeno tvoje računalo.",
            "Provjeri u pregledu uživo.",
          ],
        },
        {
          p: "Na istom zaslonu možeš odabrati oblik tipkovnice, obojiti tipke po zonama prstiju i istaknuti sljedeću tipku dok još učiš gdje je što.",
        },
      ],
    },
    {
      id: "display",
      nav: "Prikaz",
      heading: "Prikaz i osjećaj",
      blocks: [
        {
          p: "Postavke Prikaz i Unos teksta omogućuju ti da brzinu prikazuješ u riječima ili u znakovima u minuti i da fino podesiš kakav je osjećaj tipkanja. Vrati zadano uvijek je jedan klik daleko ako želiš krenuti ispočetka.",
        },
      ],
    },
    {
      id: "progress",
      nav: "Tvoj napredak",
      heading: "Tvoj napredak — stranica Profil",
      blocks: [
        {
          p: "Stranica Profil tvoj je potpuni zapis: gore statistika Ukupno i Danas (provedeno vrijeme, odrađene lekcije, tvoja najbolja i uobičajena brzina i točnost te kako se današnji dan uspoređuje); karta svih slova koja su ti se otključala; priča o tome kako je svaka pojedina tipka ubrzala, s klizačem zaglađivanja; velika slika svih tipki kroz vrijeme; i najsporiji prijelazi koji te još koče. Možeš se čak utrkivati s vlastitim posljednjim pokušajem kao s duhom i izravno osjetiti napredak.",
        },
        { lab: "Otvori svoj napredak" },
        {
          steps: [
            "Otvori izbornik.",
            "Odaberi Profil.",
            "Redom filtara usredotoči se na Slova, Znamenke, Interpunkciju ili Simbole.",
          ],
        },
      ],
    },
    {
      id: "data",
      nav: "Tvoji podaci",
      heading: "Briga o tvojim podacima",
      blocks: [
        { lab: "Izbriši statistiku profila" },
        {
          steps: [
            "Otvori Profil polaznika kojeg želiš vratiti na nulu.",
            "Klizni do kontrole za poništavanje na dnu stranice.",
            "Potvrdi „Izbriši sve” — briše se samo ovaj profil.",
          ],
        },
        { lab: "Preuzmi svoje podatke" },
        {
          steps: [
            "Otvori Profil.",
            "Upotrijebi mogućnost preuzimanja da spremiš svoju povijest kao datoteku.",
          ],
        },
        {
          p: "Prijavi se ako želiš da se povijest usklađuje među uređajima i da možeš podijeliti javnu poveznicu na profil. Nema oglasa ni pratitelja, a svoje podatke — ili cijeli račun — možeš izbrisati kad god poželiš.",
        },
      ],
    },
    {
      id: "kids",
      nav: "Dječji način",
      heading: "Dječji način",
      blocks: [
        {
          p: "Djeca vježbaju na razigranoj stazi. Svaka točna tipka pomiče njihov lik korak bliže domu, a lik raste od sićušne bebe do odraslog junaka kako se otključava sve više slova. Tek naučena tipka pokreće malo slavlje, a svaka sesija završava kraj ugodne logorske vatre.",
        },
        { lab: "Prijeđi na Djecu" },
        {
          steps: [
            "Otvori izbornik.",
            "Odaberi Djeca — ili odaberi dječji profil pod Polaznici.",
          ],
        },
        {
          p: "Na izbor su dva svijeta — Dino Run, s prijaznim dinosaurom, i Hero Trail, gdje vitez kreće u pohod kroz šumu — a u svakome biraš svoj lik.",
        },
      ],
    },
    {
      id: "toybox",
      nav: "Škrinja igračaka",
      heading: "Dječja škrinja igračaka",
      blocks: [
        { lab: "Otvori škrinju igračaka" },
        {
          steps: ["Na dječjem zaslonu dodirni zupčanik na vrhu igrališta."],
        },
        {
          p: "Unutra možeš postaviti svijet i lik, Velika slova, Zvukove, Ruke pomoćnice (svjetleći vodič za prste), Tipkovnicu (skrivenu, jednostavnu ili punu, onu za odrasle), Slova na stazi (riječi prikazane kao kocke izravno u igri), Mjerač vremena za sesiju, Bodrenje (male poruke ohrabrenja) i — skriveno pod Napredno — klizače za Svjetlinu, Boju i za to koliko je svijet živahan. Uz svijetli dnevni izgled postoji i mirni noćni.",
        },
      ],
    },
    {
      id: "ages",
      nav: "Odrastanje",
      heading: "Rastemo s tvojim djetetom",
      blocks: [
        {
          p: "KeyLearn se tiho prilagođava djetetovoj dobi. Najmlađi vide velika, prijazna slova, popustljiv ritam, kocke sa slovima izravno na stazi i najnježniju pomoć; starija djeca prelaze na dulje riječi, punu tipkovnicu i čistiji izgled. Samo postavi godinu rođenja na profilu i ostalo ide samo od sebe.",
        },
      ],
    },
    {
      id: "modes",
      nav: "Ostali načini",
      heading: "Ostali načini vježbanja",
      blocks: [
        {
          p: "Osim svakodnevne vježbe, tu je i *Test brzine* — kratak, jednokratan odlomak koji javlja tvoj broj riječi u minuti i točnost, bez ikakve lekcije; preglednik *Rasporeda* za usporedbu tipkovničkih rasporeda i njihovih karata prstiju; *Najbolji rezultati* da vidiš kako stojiš; i *Višeigrač* utrke u kojima svoju brzinu u stvarnom vremenu mjeriš s drugima.",
        },
        { lab: "Gdje ih naći" },
        {
          steps: [
            "Otvori izbornik.",
            "Odaberi Test brzine, Rasporedi, Najbolji rezultati ili Višeigrač.",
          ],
        },
      ],
    },
    {
      id: "access",
      nav: "Ako ti nešto smeta",
      heading: "Ako ti nešto u aplikaciji smeta",
      blocks: [
        {
          p: "Za to postoji cijela stranica, a postavlja se *za svakog polaznika posebno* — pa nečije prilagodbe nikad ne mijenjaju ničije druge.",
        },
        { lab: "Kako je otvoriti" },
        {
          steps: [
            "Otvori izbornik i odaberi Račun.",
            "Odaberi Pristupačnost.",
            "Odaberi polaznika na vrhu, pa uključi onoliko postavki koliko ti treba.",
          ],
        },
        {
          p: "Tih se pet postavki *kombinira*. Netko s disleksijom i s tremorom treba dvije od njih, a prisiljavanje na izbor jedne značilo bi da aplikacija pita koju teškoću želi uvažiti.",
        },
        {
          tips: [
            "Mirno — ništa se ne miče, ništa se ne broji, ništa nije na vrijeme, a propušten dan ne prekida niz.",
            "Manje toga odjednom — vježba se otvara samo s riječima i tipkovnicom.",
            "Lakše za čitanje — pismo izrađeno za disleksiju, više prostora među slovima i redcima, jači tekst.",
            "Razdvojene boje — boje prstiju koje ostaju razlučive kod daltonizma i pogreške izrečene zvukom, a ne samo crvenom.",
            "Mirnije ruke — veće stvari za pritisnuti, nikad dvije tipke odjednom, a tipka koja se ponovi ne broji se dvaput.",
          ],
        },
        {
          p: "Ispod njih *Sve postavi sam* otvara svaku sklopku zasebno — njih petnaest, uključujući brzinu govora, titlove za sve izgovoreno, broj prsta na svakoj tipki i to koliko dugo zanemarivati ponovljenu tipku. Jedan gumb sve ih vraća natrag.",
        },
      ],
    },
    {
      id: "braille",
      nav: "Brajica",
      heading: "Učenje na brajičnoj tipkovnici",
      blocks: [
        {
          p: "Polaznik koji je slijep ili slabovidan dobiva sasvim drugu stranicu — unos brajice sa šest tipki, program učenja u brajičnim znakovima umjesto u slovima i govorne upute kroz cijelo vrijeme. To je zaseban način učenja tipkanja, a ne stranica za videće pročitana naglas.",
        },
        { lab: "Uključi to za polaznika" },
        {
          steps: [
            "Otvori izbornik i odaberi Račun, pa Polaznici.",
            "Uredi polaznika ili dodaj novoga.",
            "Uključi podršku za slabovidne i spremi.",
          ],
        },
        {
          p: "Taj polaznik sada ide ravno na brajičnu stranicu kad god on vježba. Njegov se napredak broji u brajičnim znakovima umjesto u slovima, a potvrdu može zaraditi pod istim uvjetima kao i bilo tko drugi.",
        },
      ],
    },
    {
      id: "courses",
      nav: "Dva tečaja",
      heading: "Vođena vježba, Klasični tečaj i kod",
      blocks: [
        {
          p: "*Vođena vježba* prilagodljiv je tečaj: prati koje te tipke usporavaju i oko njih gradi tvoje lekcije, dodajući slovo tek kad ona koja već imaš tipkaš i brzo i točno.",
        },
        {
          p: "*Klasični tečaj* onaj je staromodni — čvrste ljestve lekcija utvrđenim redom, onako kako bi te učila knjiga o strojopisu. Nekima jednostavno više odgovara znati što slijedi.",
        },
        {
          p: "To su odvojeni tečajevi, svaki sa svojom poviješću, a potvrda se stječe na jednom ili na drugom — nikad na oba zbrojena, jer bi ti se prvi tjedan brojao dvaput. Stranica Tečaj u tvojem računu kaže o kojem izvještava.",
        },
        {
          p: "*Kodni zanat* treća je vrsta vježbe: pravi isječci u jeziku koji odabereš, da zagrade, točke sa zarezom i uvlake dobiju uvježbavanje kakvo im obična proza nikad ne pruža.",
        },
        { lab: "Prebacivanje između njih" },
        {
          steps: [
            "Na zaslonu za vježbu otvori postavke lekcije.",
            "Odaberi Vođena vježba, Klasični tečaj ili Kodni zanat.",
          ],
        },
      ],
    },
    {
      id: "certificates",
      nav: "Potvrde",
      heading: "Stjecanje potvrde",
      blocks: [
        {
          p: "Potvrda govori da je imenovani polaznik tipkao izmjerenom brzinom i točnošću, na određenom jeziku, određenog datuma. Izdajemo je mi — nije to kvalifikacija koju je neko ispitno tijelo ili poslodavac pristao priznati — i poštena je potvrda onoga što je netko doista napravio.",
        },
        { lab: "Vidi koliko ti još fali" },
        {
          steps: [
            "Otvori izbornik i odaberi Račun.",
            "Odaberi Tečaj.",
            "Svaki polaznik ima redak sa svim uvjetima i s time koliko je daleko stigao.",
          ],
        },
        {
          p: "Uvjeti su stvari poput: uvedeno je svako slovo, svako je slovo pouzdano, a ne tek dotaknuto, dovoljno lekcija, dovoljno zasebnih dana te održana brzina i točnost. Kad su svi ispunjeni, u tom se retku pojavi poveznica za pristupanje provjeri.",
        },
        {
          p: "Provjera je kratka i ocjenjuje se na našim poslužiteljima, a ne u tvojem pregledniku. Položi je i potvrda se izdaje s brojem na sebi. Svatko kome daš taj broj može je provjeriti na stranici *Provjeri potvrdu* — a ti biraš hoće li mu se prikazati tvoje ime.",
        },
      ],
    },
    {
      id: "security",
      nav: "Čuvanje računa",
      heading: "Pristupni ključevi, kodovi i tko se prijavljivao",
      blocks: [
        {
          p: "Možeš se prijaviti lozinkom, preko pružatelja poput Googlea, poveznicom poslanom na e-poštu — ili *pristupnim ključem*, koji bismo mi izabrali. Pristupni ključ koristi otisak prsta, lice ili PIN tvojega uređaja; nema lozinke koja bi mogla iscuriti, a ništa što mi čuvamo ne može se upotrijebiti za prijavu u tvoje ime.",
        },
        { lab: "Dodaj pristupni ključ" },
        {
          steps: [
            "Otvori izbornik i odaberi Račun, pa Sigurnost.",
            "Odaberi Dodaj pristupni ključ i slijedi upute svojega uređaja.",
          ],
        },
        {
          p: "Tu je i *provjera u dva koraka*, uz aplikaciju za autentifikaciju i kodove za oporavak ako izgubiš telefon. Ispiši ih i drži negdje izvan telefona.",
        },
        {
          p: "Ista stranica navodi nedavnu aktivnost — prijave, neuspjele prijave, dodan pristupni ključ, promijenjenu lozinku — svaku s približnim mjestom s kojeg je došla, pa je lako uočiti nešto što nije došlo od tebe. Ako nešto izgleda krivo, *odjava sa svih uređaja* prekida svaku sesiju osim one u kojoj si sada.",
        },
        {
          p: "Postoji i *roditeljski PIN*, koji zaključava postavke računa da ih dijete na obiteljskom uređaju ne može mijenjati niti izbrisati profil.",
        },
      ],
    },
    {
      id: "yours",
      nav: "Neka bude tvoje",
      heading: "Neka bude tvoje",
      blocks: [
        { lab: "Promijeni temu" },
        {
          steps: [
            "Otvori izbornik i odaberi Račun, pa Izgled.",
            "Odaberi svijetlu, tamnu ili onu koja prati uređaj.",
          ],
        },
        {
          p: "Ako nijedna ugrađena tema nije baš ona prava, *dizajner tema* pušta te da izmiješaš vlastitu — uključujući boje prstiju kojima tipkovnica podučava. Aplikacija mjeri kontrast onoga što odabereš i odbija kombinacije koje nitko ne bi mogao pročitati.",
        },
        {
          p: "Svaki polaznik u kućanstvu može imati svoju boju, pa se zajednički uređaj i dalje čini kao da pripada onome tko za njim sjedi.",
        },
        { lab: "Promijeni jezik stranice" },
        {
          steps: ["Otvori izbornik.", "Pod Jezik stranice odaberi svoj jezik."],
        },
        {
          p: "Na zaslonu za vježbu možeš i mijenjati veličinu teksta te uključivati i isključivati zvukove kad god poželiš.",
        },
      ],
    },
    {
      id: "privacy",
      nav: "Privatnost",
      heading: "Privatnost, u jednoj rečenici",
      blocks: [
        {
          p: "Nema oglasa ni pratitelja. Dječji profil nikad ne napušta tvoj preglednik. Prijavi se samo ako želiš usklađivanje ili dijeljenje; inače sve ostaje na ovom uređaju i slobodno to možeš izbrisati u bilo kojem trenutku.",
        },
      ],
    },
    {
      id: "signout",
      nav: "Odjava",
      heading: "Odjava",
      blocks: [
        { lab: "Odjavi se" },
        { steps: ["Otvori izbornik.", "Odaberi Odjava i potvrdi."] },
        {
          p: "Povijest tvoje vježbe ostaje sigurno na ovom uređaju — i na tvojem računu, ako ga imaš — spremna za sljedeći put kad sjedneš tipkati.",
        },
      ],
    },
    {
      id: "tips",
      nav: "Savjeti",
      heading: "Nekoliko navika koje stvarno pomažu",
      blocks: [
        {
          tips: [
            "Točnost prije brzine — čisto tipkanje je ono što ostaje.",
            "Ispravljaj pogreške mirno; nemoj juriti da nadoknadiš.",
            "Odmaraj prste na osnovnom redu — F i J imaju male izbočine.",
            "Nekoliko minuta svaki dan bolje je od sat vremena jednom tjedno.",
          ],
        },
      ],
    },
  ],
};
