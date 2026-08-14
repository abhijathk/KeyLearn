import { type GuideTranslation } from "../guide-content.tsx";

export const sq: GuideTranslation = {
  kicker: "Gjithçka që mund të bësh",
  title: "Udhëzuesi i përdoruesit",
  dateline:
    "Udhëzuesi i plotë për KeyLearn — nga vizita jote e parë deri te dalja nga llogaria",
  navLabel: "Në këtë faqe",
  sections: [
    {
      id: "account",
      nav: "A më duhet një llogari?",
      heading: "A më duhet një llogari?",
      blocks: [
        {
          p: "Jo. Mund të fillosh të shkruash që në çastin që mbërrin, dhe progresi yt ruhet pikërisht këtu, në këtë pajisje. Krijo një llogari falas vetëm nëse dëshiron që historiku yt të të ndjekë edhe në pajisje të tjera, të mbash një kopje rezervë ose të ndash një lidhje profili. Asgjë e dobishme nuk rri e mbyllur pas hyrjes në llogari.",
        },
      ],
    },
    {
      id: "signin",
      nav: "Hyrja dhe fjalëkalimet",
      heading: "Regjistrimi, hyrja dhe fjalëkalimet",
      blocks: [
        { p: "Gjithçka gjendet te menyja lart djathtas." },
        { lab: "Krijo një llogari" },
        {
          steps: [
            "Hap menynë (lart djathtas).",
            "Zgjidh Regjistrohu.",
            "Shkruaj një email dhe një fjalëkalim.",
            "Konfirmo — ja ku je brenda.",
          ],
        },
        { lab: "Hyr në llogari" },
        {
          steps: [
            "Hap menynë dhe zgjidh Hyr.",
            "Shkruaj email-in dhe fjalëkalimin tënd.",
          ],
        },
        { lab: "Rivendos një fjalëkalim të harruar" },
        {
          steps: [
            "Në faqen e hyrjes, zgjidh Harrova fjalëkalimin.",
            "Shkruaj adresën tënde të email-it.",
            "Hap lidhjen e rivendosjes që të dërgojmë.",
            "Zgjidh një fjalëkalim të ri dhe hyr.",
          ],
        },
      ],
    },
    {
      id: "profiles",
      nav: "Profilet",
      heading: "Profile për gjithë familjen",
      blocks: [
        {
          p: "KeyLearn është ndërtuar si një familje: një llogari mban deri në katër profile (tetë me premium), të rritur dhe fëmijë në çfarëdo përzierjeje. Çdo profil ruan progresin e *vet* të veçantë në këtë pajisje — asgjë nuk përzihet kurrë.",
        },
        { lab: "Shto një profil" },
        {
          steps: [
            "Hap menynë dhe zgjidh Llogaria (ose “Konfiguro profilet”).",
            "Zgjidh Shto një profil.",
            "Shkruaj një emër.",
            "Shënoje si i Rritur ose si Fëmijë.",
            "Zgjidh një avatar — një ikonë simpatike, ose një Foto nga pajisja jote.",
            "Për një fëmijë, shto vitin e lindjes (kjo vetëm i përshtat fjalët dhe ritmin me moshën e tij).",
            "Ruaje.",
          ],
        },
        { lab: "Kalo te një nxënës tjetër" },
        {
          steps: [
            "Hap menynë.",
            "Prek një fytyrë te Nxënësit — aplikacioni vazhdon aty ku e la.",
          ],
        },
        { lab: "Ndrysho ose hiq një profil" },
        {
          steps: [
            "Hap menynë dhe zgjidh Llogaria.",
            "Zgjidh Ndrysho te një profil, ose fshije për të liruar një vend.",
          ],
        },
        {
          p: "Profilet e fëmijëve marrin një meny të thjeshtuar dhe të kufizuar, ndërsa veprimet e të rriturve rrinë pas një porte të shpejtë matematike “sa bëjnë A herë B?”, që të vegjlit të mos enden nëpër cilësimet.",
        },
      ],
    },
    {
      id: "screen",
      nav: "Ekrani i praktikës",
      heading: "Ekrani i praktikës",
      blocks: [
        {
          p: "Thjesht fillo të shkruash. Fjala që të duhet noton pikërisht mbi tastierën në ekran; një kometë ndriçuese tregon tastin që vjen; tastet janë me ngjyra sipas zonës së gishtave, që të mësosh cili gisht arrin ku; dhe një palë duar të zbehta në pushim tregojnë ku rrinë gishtat mes shtypjeve. E gjithë aftësia është një zakon i vetëm: mbaji sytë te fjalët, jo te duart.",
        },
      ],
    },
    {
      id: "journey",
      nav: "Udhëtimi yt",
      heading: "Si rriten mësimet — udhëtimi yt",
      blocks: [
        {
          p: "KeyLearn është *përshtatës*. Ai mat sa shpejt dhe sa pastër e godet çdo tast dhe shton një shkronjë të re në grupin tënd vetëm kur i shkruan ato të tanishmet edhe shpejt edhe saktë. Ai grup që rritet është udhëtimi yt, nga një grusht shkronjash deri te i gjithë alfabeti — vështirësia ngjitet pikërisht aq shpejt sa ti, kurrë më shpejt, kështu që punon gjithmonë në kufirin tënd.",
        },
      ],
    },
    {
      id: "readout",
      nav: "Statistika të drejtpërdrejta",
      heading: "Paneli i drejtpërdrejtë",
      blocks: [
        {
          p: "Ndërsa shkruan, paneli notues tregon shpejtësinë dhe saktësinë e tanishme, një grafik të vockël të provave të fundit, ecurinë e objektivave dhe serinë tënde. Është aty për të të inkurajuar, jo për të të bezdisur.",
        },
      ],
    },
    {
      id: "tools",
      nav: "Mjetet e praktikës",
      heading: "Mjetet e praktikës",
      blocks: [
        {
          p: "Mjetet e vogla pranë tekstit të lejojnë të hapësh një udhërrëfim me hapa, të rinisësh mësimin e tanishëm (Ctrl + Majtas), të kalosh te i radhës (Ctrl + Djathtas), të shfaqësh ose të fshehësh tastierën në ekran dhe të ndryshosh madhësinë e tekstit të praktikës. Ingranazhi hap Cilësimet e plota, që përshkruhen më poshtë.",
        },
      ],
    },
    {
      id: "content",
      nav: "Çfarë shkruan",
      heading: "Zgjedhja e asaj që shkruan",
      blocks: [
        {
          p: "Hap Cilësimet dhe shko te Përmbajtja e praktikës për të zgjedhur si formohen fjalët e tua:",
        },
        {
          tips: [
            "*Praktikë e udhëhequr* — parazgjedhja përshtatëse që ta rrit alfabetin tast pas tasti.",
            "*Kursi klasik* — një ecje e caktuar, me radhë, nëpër taste.",
            "*Fjalë të shpeshta* — fjalët më të zakonshme në gjuhën tënde.",
            "*Tekst librash* — shkruaj përmes librave të vërtetë të përfshirë në aplikacion.",
            "*Teksti yt* — ngjit çfarë të duash dhe praktiko mbi të.",
            "*Copëza kodi* — kllapa, simbole dhe ritmi i kodit.",
            "*Ushtrime me numra* — rreshti i numrave dhe tastiera numerike.",
          ],
        },
        { lab: "Ndrysho çfarë shkruan" },
        {
          steps: [
            "Hap Cilësimet (ingranazhi pranë tekstit të praktikës).",
            "Shko te Përmbajtja e praktikës.",
            "Zgjidh një mënyrë — për Tekst librash zgjidh një libër, për Tekstin tënd ngjit fjalët e tua.",
            "Mbyll Cilësimet dhe vazhdo të shkruash.",
          ],
        },
        {
          p: "I njëjti ekran cakton madhësinë e alfabetit, një shpejtësi të synuar, sa gjatë zgjat çdo mësim dhe një objektiv ditor.",
        },
      ],
    },
    {
      id: "smart",
      nav: "Praktika e zgjuar",
      heading: "Ndihmësit e Praktikës së zgjuar",
      blocks: [
        {
          p: "Përveç praktikës së udhëhequr, Praktika e zgjuar shton ndihmësa të butë: një ushtrim ngushticash që gjuan çiftet e tua më të ngadalta të tasteve, përsëritje me hapësira, rifreskime kundër harresës që kthehen te tastet e ndryshkura, besim të zgjuar dhe rimëkëmbje tastesh. Të gjithë janë të ndezur si parazgjedhje.",
        },
        { lab: "Ndiz ose fik një ndihmës" },
        {
          steps: [
            "Hap Cilësimet.",
            "Shko te Praktika e zgjuar.",
            "Kthe çdo ndihmës që dëshiron — ose lëri të gjithë të ndezur.",
          ],
        },
      ],
    },
    {
      id: "keyboard",
      nav: "Konfigurimi i tastierës",
      heading: "Konfigurimi i tastierës sate",
      blocks: [
        {
          p: "Te Cilësimet, Konfigurimi i tastierës është vendi ku e përputh KeyLearn me tastierën tënde dhe me shpërndarjen që do të mësosh.",
        },
        { lab: "Ndrysho shpërndarjen e tastierës" },
        {
          steps: [
            "Hap Cilësimet.",
            "Shko te Konfigurimi i tastierës.",
            "Zgjidh gjuhën tënde, pastaj shpërndarjen (QWERTY, Dvorak, Colemak e të tjera).",
            "Lëre të ndezur “Simulo këtë shpërndarje”, që ta praktikosh pavarësisht se si është vendosur kompjuteri yt.",
            "Shiko paraparjen e drejtpërdrejtë për ta konfirmuar.",
          ],
        },
        {
          p: "Në të njëjtin ekran mund të zgjedhësh formën e tastierës, të ngjyrosësh tastet sipas zonës së gishtave dhe të ndriçosh tastin që vjen, ndërsa je ende duke mësuar ku ndodhet çdo gjë.",
        },
      ],
    },
    {
      id: "display",
      nav: "Pamja",
      heading: "Pamja dhe ndjesia",
      blocks: [
        {
          p: "Cilësimet e Pamjes dhe të Futjes së tekstit të lejojnë ta shfaqësh shpejtësinë si fjalë ose si shenja në minutë dhe ta rregullosh imtësisht se si ndihet të shkruarit. Rikthe parazgjedhjet rri gjithmonë vetëm një klikim larg, nëse do të nisësh nga e para.",
        },
      ],
    },
    {
      id: "progress",
      nav: "Progresi yt",
      heading: "Progresi yt — faqja e Profilit",
      blocks: [
        {
          p: "Faqja e Profilit është regjistri yt i plotë: statistikat e Gjithë kohës dhe të Sotmes lart (koha e praktikuar, mësimet e kryera, shpejtësia dhe saktësia jote më e mirë e ajo e zakonshme, dhe si krahasohet sot); një hartë e çdo shkronje që ke zhbllokuar; historia se si është përshpejtuar secili tast veç e veç, me një rrëshqitës zbutjeje; pamja e gjerë e çdo tasti me kalimin e kohës; dhe kalimet më të ngadalta që ende të mbajnë prapa. Madje mund të garosh me provën tënde të fundit si fantazmë, që ta ndiesh progresin drejtpërdrejt.",
        },
        { lab: "Hap progresin tënd" },
        {
          steps: [
            "Hap menynë.",
            "Zgjidh Profili.",
            "Përdor rreshtin e filtrave për t'u përqendruar te Shkronjat, Shifrat, Pikësimi ose Simbolet.",
          ],
        },
      ],
    },
    {
      id: "data",
      nav: "Të dhënat e tua",
      heading: "Kujdesi për të dhënat e tua",
      blocks: [
        { lab: "Pastro statistikat e një profili" },
        {
          steps: [
            "Hap Profilin e nxënësit që do të rivendosësh.",
            "Rrëshqit deri te kontrolli i rivendosjes në fund të faqes.",
            "Konfirmo “Fshi gjithçka” — pastrohet vetëm ky profil.",
          ],
        },
        { lab: "Shkarko të dhënat e tua" },
        {
          steps: [
            "Hap Profilin.",
            "Përdor mundësinë e shkarkimit për ta ruajtur historikun si skedar.",
          ],
        },
        {
          p: "Hyr në llogari nëse dëshiron që historiku yt të sinkronizohet nëpër pajisje dhe të ndash një lidhje publike profili. Nuk ka reklama dhe nuk ka gjurmues, dhe mund t'i fshish të dhënat — ose gjithë llogarinë — kurdo që të duash.",
        },
      ],
    },
    {
      id: "kids",
      nav: "Modaliteti për fëmijë",
      heading: "Modaliteti për fëmijë",
      blocks: [
        {
          p: "Fëmijët praktikojnë në një shteg lozonjar. Çdo tast i saktë e çon personazhin e tyre një hap më pranë shtëpisë, dhe personazhi rritet nga një foshnjë e vockël në një hero të rritur, ndërsa zhbllokohen më shumë shkronja. Një tast i sapomësuar nis një festë të vogël, dhe çdo seancë përfundon te një zjarr i ngrohtë kampi.",
        },
        { lab: "Kalo te Fëmijët" },
        {
          steps: [
            "Hap menynë.",
            "Zgjidh Fëmijët — ose zgjidh një profil fëmije te Nxënësit.",
          ],
        },
        {
          p: "Ka dy botë për të zgjedhur — Dino Run, me një dinozaur miqësor, dhe Hero Trail, ku një kalorës kalon nëpër një pyll — secila me një personazh për të zgjedhur.",
        },
      ],
    },
    {
      id: "toybox",
      nav: "Kutia e lodrave",
      heading: "Kutia e lodrave për fëmijë",
      blocks: [
        { lab: "Hap kutinë e lodrave" },
        {
          steps: [
            "Në ekranin e fëmijëve, prek ingranazhin në krye të zonës së lojës.",
          ],
        },
        {
          p: "Brenda mund të caktosh botën dhe personazhin, Shkronja të mëdha, Tinguj, Duar ndihmëse (udhëzuesi ndriçues i gishtave), Tastierën (e fshehur, e thjeshtë, ose tabela e plotë e të rriturve), Shkronjat në shteg (fjalët e shfaqura si blloqe pikërisht brenda lojës), një Kohëmatës seance, Brohoritje (mesazhe të vogla inkurajuese) dhe — të fshehura te Të përparuara — rrëshqitës për Ndriçimin, Ngjyrën dhe sa e gjallë ndihet bota. Ka edhe një pamje të qetë nate përveç asaj të ndritshme të ditës.",
        },
      ],
    },
    {
      id: "ages",
      nav: "Duke u rritur",
      heading: "Të rritesh bashkë me fëmijën tënd",
      blocks: [
        {
          p: "KeyLearn përshtatet në heshtje me moshën e një fëmije. Më të vegjlit shohin shkronja të mëdha e miqësore, ritëm falës, blloqe shkronjash pikërisht mbi shteg dhe ndihmën më të butë; fëmijët më të rritur kalojnë te fjalë më të gjata, te tastiera e plotë dhe te një pamje më e pastër. Thjesht cakto vitin e lindjes te profili dhe pjesa tjetër vjen vetvetiu.",
        },
      ],
    },
    {
      id: "modes",
      nav: "Mënyra të tjera",
      heading: "Mënyra të tjera për të praktikuar",
      blocks: [
        {
          p: "Përtej praktikës sate të përditshme ka një *Test shpejtësie* — një pjesë e shkurtër njëherëshe që raporton fjalët e tua për minutë dhe saktësinë, pa asnjë mësim të lidhur; një eksplorues *Shpërndarjesh* për të krahasuar shpërndarjet e tastierës dhe hartat e tyre të gishtave; *Rezultatet më të larta*, për të parë si qëndron kundrejt të tjerëve; dhe gara *Shumëlojtarëshe*, për ta shtyrë shpejtësinë tënde përballë të tjerëve në kohë reale.",
        },
        { lab: "Gjeji ato" },
        {
          steps: [
            "Hap menynë.",
            "Zgjidh Test shpejtësie, Shpërndarje, Rezultatet më të larta ose Shumëlojtarësh.",
          ],
        },
      ],
    },
    {
      id: "access",
      nav: "Nëse diçka të pengon",
      heading: "Nëse diçka te aplikacioni të pengon",
      blocks: [
        {
          p: "Ka një faqe të tërë për këtë, dhe caktohet *për çdo nxënës* — kështu që rregullimet e njërit nuk ndryshojnë kurrë ato të tjetrit.",
        },
        { lab: "Hape atë" },
        {
          steps: [
            "Hap menynë dhe zgjidh Llogaria.",
            "Zgjidh Aksesueshmëria.",
            "Zgjidh nxënësin lart, pastaj ndiz sa cilësime të duhen.",
          ],
        },
        {
          p: "Të pesë cilësimet *kombinohen*. Dikush me disleksi dhe me dridhje duarsh ka nevojë për dy prej tyre, dhe po të detyrohej të zgjidhte vetëm një, do të ishte sikur aplikacioni të pyeste cilës vështirësi t'i përshtatet.",
        },
        {
          tips: [
            "I qetë — asgjë nuk lëviz, asgjë nuk numërohet, asgjë nuk matet me kohë, dhe një ditë e humbur nuk e prish serinë.",
            "Më pak gjëra njëherësh — praktika hapet vetëm me fjalët dhe tastierën.",
            "Më e lehtë për t'u lexuar — shkronjat e ndërtuara për disleksinë, më shumë hapësirë mes shkronjave e rreshtave, tekst më i fortë.",
            "Ngjyra të ndara — ngjyra gishtash që mbeten të dallueshme edhe me daltonizëm, dhe gabime që thuhen me tingull, jo vetëm me të kuqe.",
            "Duar më të qeta — gjëra më të mëdha për t'u shtypur, kurrë dy taste njëherësh, dhe një tast që përsërit vetveten nuk numërohet dy herë.",
          ],
        },
        {
          p: "Poshtë tyre, *Cakto secilin vetë* hap çdo çelës më vete — pesëmbëdhjetë gjithsej, përfshirë shpejtësinë e të folurit, titrat për gjithçka që thuhet me zë, një numër gishti mbi çdo tast dhe sa gjatë të shpërfillet një tast i përsëritur. Një buton i vetëm i kthen të gjitha në vend.",
        },
      ],
    },
    {
      id: "braille",
      nav: "Brajli",
      heading: "Të mësosh në një tastierë brajli",
      blocks: [
        {
          p: "Një nxënës që është i verbër ose sheh pak merr një faqe krejt tjetër — shkrim brajli me gjashtë taste, një program mësimor me qeliza në vend të shkronjave dhe udhëzim me zë gjatë gjithë kohës. Është një mënyrë më vete për të mësuar shkrimin, jo faqja e atyre që shohin, e lexuar me zë.",
        },
        { lab: "Ndize për një nxënës" },
        {
          steps: [
            "Hap menynë dhe zgjidh Llogaria, pastaj Nxënësit.",
            "Ndrysho nxënësin, ose shto një të ri.",
            "Ndiz mbështetjen për shikimin dhe ruaje.",
          ],
        },
        {
          p: "Ai nxënës tani shkon drejt e te faqja e brajlit sa herë që praktikon ai vetë. Progresi i tij numërohet me qeliza në vend të shkronjave, dhe mund të fitojë një certifikatë me të njëjtat kushte si gjithë të tjerët.",
        },
      ],
    },
    {
      id: "courses",
      nav: "Dy kurset",
      heading: "Praktika e udhëhequr, Kursi klasik dhe kodi",
      blocks: [
        {
          p: "*Praktika e udhëhequr* është kursi përshtatës: ai vëzhgon cilët taste të ngadalësojnë dhe i ndërton mësimet rreth tyre, duke shtuar një shkronjë vetëm kur i shkruan ato që ke tashmë edhe shpejt edhe saktë.",
        },
        {
          p: "*Kursi klasik* është ai i modës së vjetër — një shkallë e caktuar mësimesh me radhë të përcaktuar, ashtu si do ta mësonte një libër daktilografie. Disa njerëz thjesht pëlqejnë ta dinë çfarë vjen më pas.",
        },
        {
          p: "Janë kurse të veçanta me historikë të veçantë, dhe një certifikatë fitohet në njërin ose në tjetrin — kurrë mbi të dyja së bashku, sepse kjo do ta numëronte javën tënde të parë dy herë. Faqja e Kursit në llogarinë tënde thotë për cilin po raporton.",
        },
        {
          p: "*Zanati i kodit* është një lloj i tretë praktike: copëza të vërteta në një gjuhë që e zgjedh ti, që kllapat, pikëpresjet dhe shmangiet të marrin stërvitjen që proza e zakonshme nuk ua jep kurrë.",
        },
        { lab: "Kalo mes tyre" },
        {
          steps: [
            "Në ekranin e praktikës, hap cilësimet e mësimit.",
            "Zgjidh Praktika e udhëhequr, Kursi klasik ose Zanati i kodit.",
          ],
        },
      ],
    },
    {
      id: "certificates",
      nav: "Certifikatat",
      heading: "Si të fitosh një certifikatë",
      blocks: [
        {
          p: "Një certifikatë thotë se një nxënës me emër shkroi me një shpejtësi e saktësi të matur, në një gjuhë të caktuar, në një datë të caktuar. Ajo lëshohet nga ne — nuk është një kualifikim që ndonjë bord provimesh a punëdhënës ka pranuar ta njohë — dhe është dëshmi e ndershme e asaj që dikush bëri vërtet.",
        },
        { lab: "Shih sa larg je" },
        {
          steps: [
            "Hap menynë dhe zgjidh Llogaria.",
            "Zgjidh Kursi.",
            "Çdo nxënës ka një rresht që tregon çdo kusht, bashkë me sa larg ka arritur.",
          ],
        },
        {
          p: "Kushtet janë gjëra si: çdo shkronjë e prezantuar, çdo shkronjë e besueshme e jo thjesht e takuar një herë, mësime të mjaftueshme, ditë të veçanta të mjaftueshme, dhe një shpejtësi e saktësi e qëndrueshme. Kur plotësohen të gjitha, në atë rresht shfaqet një lidhje për ta dhënë vlerësimin.",
        },
        {
          p: "Vlerësimi është i shkurtër dhe gjykohet në serverët tanë e jo në shfletuesin tënd. Kaloje dhe certifikata lëshohet me një numër mbi të. Kushdo që t'i japësh atë numër mund ta kontrollojë te faqja *Kontrollo një certifikatë* — dhe ti zgjedh nëse emri yt u shfaqet atyre.",
        },
      ],
    },
    {
      id: "security",
      nav: "Mbaje llogarinë të sigurt",
      heading: "Passkey-t, kodet dhe kush ka hyrë",
      blocks: [
        {
          p: "Mund të hysh me një fjalëkalim, me një ofrues si Google, me një lidhje të dërguar në email — ose me një *passkey*, që është ai që do të zgjidhnim ne. Një passkey përdor gjurmën e gishtit, fytyrën ose PIN-in e vetë pajisjes sate; nuk ka fjalëkalim që të rrjedhë, dhe asgjë nga ajo që mbajmë ne nuk mund të përdorej për të hyrë si ti.",
        },
        { lab: "Shto një passkey" },
        {
          steps: [
            "Hap menynë dhe zgjidh Llogaria, pastaj Siguria.",
            "Zgjidh Shto një passkey dhe ndiq udhëzimin e pajisjes sate.",
          ],
        },
        {
          p: "*Verifikimi në dy hapa* është gjithashtu aty, me një aplikacion vërtetuesi dhe me kode rimëkëmbjeje për rastin kur humb telefonin. Printoji diku që nuk është telefoni.",
        },
        {
          p: "E njëjta faqe rendit veprimtarinë e fundit — hyrjet, hyrjet e dështuara, një passkey i shtuar, një fjalëkalim i ndryshuar — secila me vendndodhjen e përafërt nga erdhi, që diçka që nuk e ke bërë ti të bjerë lehtë në sy. Nëse duket gabim, *dil kudo* mbyll çdo seancë përveç asaj që po përdor.",
        },
        {
          p: "Ka edhe një *PIN prindëror*, që i kyç cilësimet e llogarisë, që një fëmijë në pajisjen familjare të mos i ndryshojë dot ato dhe të mos fshijë një profil.",
        },
      ],
    },
    {
      id: "yours",
      nav: "Bëje tëndin",
      heading: "Bëje tëndin",
      blocks: [
        { lab: "Ndrysho temën" },
        {
          steps: [
            "Hap menynë dhe zgjidh Llogaria, pastaj Pamja.",
            "Zgjidh të çelët, të errët, ose ndiq pajisjen.",
          ],
        },
        {
          p: "Nëse asnjë nga temat e gatshme nuk është ajo që kërkon, *krijuesi i temave* të lejon të përziesh tënden — përfshirë ngjyrat e gishtave me të cilat mëson tastiera. Aplikacioni mat kontrastin e çdo gjëje që zgjedh dhe refuzon kombinime që nuk do t'i lexonte dot askush.",
        },
        {
          p: "Çdo nxënës i familjes mund të ketë ngjyrën e vet, kështu që një pajisje e përbashkët prapë ndihet sikur i përket atij që rri para saj.",
        },
        { lab: "Ndrysho gjuhën e faqes" },
        {
          steps: ["Hap menynë.", "Te Gjuha e faqes, zgjidh gjuhën tënde."],
        },
        {
          p: "Në ekranin e praktikës mund të ndryshosh gjithashtu madhësinë e tekstit dhe t'i ndezësh a fikësh tingujt kurdo që të duash.",
        },
      ],
    },
    {
      id: "privacy",
      nav: "Privatësia",
      heading: "Privatësia, me një fjali",
      blocks: [
        {
          p: "Pa reklama dhe pa gjurmues. Profili i një fëmije nuk del kurrë nga shfletuesi yt. Hyr në llogari vetëm nëse do sinkronizim ose ndarje; përndryshe gjithçka rri në këtë pajisje, dhe je i lirë ta fshish në çdo çast.",
        },
      ],
    },
    {
      id: "signout",
      nav: "Dalja",
      heading: "Dalja nga llogaria",
      blocks: [
        { lab: "Dil" },
        { steps: ["Hap menynë.", "Zgjidh Dil dhe konfirmo."] },
        {
          p: "Historiku yt i praktikës rri i sigurt në këtë pajisje — dhe në llogarinë tënde, nëse ke krijuar një — gati për herën tjetër që ulesh të shkruash.",
        },
      ],
    },
    {
      id: "tips",
      nav: "Këshilla",
      heading: "Disa zakone që ndihmojnë vërtet",
      blocks: [
        {
          tips: [
            "Saktësia para shpejtësisë — të shkruarit pastër është ajo që mbetet.",
            "Ndreqi gabimet me qetësi; mos vrapo për t'i marrë të humburat.",
            "Mbaji gishtat në rreshtin bazë — F dhe J kanë gunga të vogla.",
            "Pak minuta çdo ditë vlejnë më shumë se një orë një herë në javë.",
          ],
        },
      ],
    },
  ],
};
