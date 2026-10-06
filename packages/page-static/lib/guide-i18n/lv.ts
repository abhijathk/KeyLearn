import { type GuideTranslation } from "../guide-content.tsx";

export const lv: GuideTranslation = {
  kicker: "Viss, ko vari darīt",
  title: "Lietotāja rokasgrāmata",
  dateline:
    "Pilnā KeyLearn rokasgrāmata — no pirmās reizes līdz izrakstīšanās brīdim",
  navLabel: "Šajā lapā",
  sections: [
    {
      id: "account",
      nav: "Vai man vajag kontu?",
      heading: "Vai man vajag kontu?",
      blocks: [
        {
          p: "Nē. Rakstīt vari sākt jau tajā brīdī, kad ienāc, un tavs progress tiek saglabāts turpat šajā ierīcē. Izveido bezmaksas kontu tikai tad, ja gribi, lai vēsture tev seko uz citām ierīcēm, ja vēlies rezerves kopiju vai profila saiti, ar ko dalīties. Nekas noderīgs nav paslēpts aiz pieteikšanās.",
        },
      ],
    },
    {
      id: "signin",
      nav: "Pieteikšanās un paroles",
      heading: "Reģistrēšanās, pieteikšanās un paroles",
      blocks: [
        {
          p: "Viss atrodams izvēlnē augšējā labajā stūrī, sadaļā Piesakies vai reģistrējies — tās pašas durvis neatkarīgi no tā, vai tev jau ir konts.",
        },
        { lab: "Izveidot kontu vai pieteikties" },
        {
          steps: [
            "Atver izvēlni un izvēlies Piesakies vai reģistrējies.",
            "Turpini ar Google, Facebook vai piekļuves atslēgu — vai ieraksti savu e-pasta adresi un nospied Turpināt.",
            "Ar jaunu e-pasta adresi tu iestatīsi paroli; ar esošu tev to pajautās.",
          ],
        },
        { lab: "Atjaunot aizmirstu paroli" },
        {
          steps: [
            "Pieteikšanās logā ievadi savu e-pasta adresi un nospied Turpināt.",
            "Izvēlies Aizmirsi paroli?",
            "Atver atjaunošanas saiti, ko tev nosūtām.",
            "Izvēlies jaunu paroli un piesakies.",
          ],
        },
      ],
    },
    {
      id: "profiles",
      nav: "Profili",
      heading: "Profili visai mājsaimniecībai",
      blocks: [
        {
          p: "KeyLearn ir veidots kā mājsaimniecība: vienā kontā ietilpst līdz četriem profiliem (astoņi ar premium), pieaugušie un bērni jebkādā kombinācijā. Katrs profils šajā ierīcē glabā *savu* atsevišķo progresu — nekas nekad netiek sajaukts kopā.",
        },
        { lab: "Pievienot profilu" },
        {
          steps: [
            "Atver izvēlni un izvēlies Konts (vai “Iestatīt profilus”).",
            "Izvēlies Pievienot profilu.",
            "Ieraksti vārdu.",
            "Atzīmē, vai tas ir Pieaugušais vai Bērns.",
            "Izvēlies attēlu — draudzīgu ikonu vai Fotoattēlu no savas ierīces.",
            "Bērnam pievieno dzimšanas gadu (tas tikai pieskaņo vārdus un tempu viņa vecumam).",
            "Saglabā.",
          ],
        },
        { lab: "Pārslēgties uz citu skolēnu" },
        {
          steps: [
            "Atver izvēlni.",
            "Pieskaries kādai sejai sadaļā Skolēni — lietotne turpina tieši no tās vietas, kur viņš apstājās.",
          ],
        },
        { lab: "Rediģēt vai noņemt profilu" },
        {
          steps: [
            "Atver izvēlni un izvēlies Konts.",
            "Izvēlies Rediģēt pie profila vai izdzēs to, lai atbrīvotu vietu.",
          ],
        },
        {
          p: "Bērnu profili saņem vienkāršotu, ierobežotu izvēlni, bet pieaugušo darbības slēpjas aiz ātras matemātikas pārbaudes “cik ir A reiz B?”, lai mazie neieklīstu iestatījumos.",
        },
      ],
    },
    {
      id: "screen",
      nav: "Prakses ekrāns",
      heading: "Prakses ekrāns",
      blocks: [
        {
          p: "Vienkārši sāc rakstīt. Vajadzīgais vārds peld tieši virs ekrāna tastatūras; mirdzoša komēta norāda uz pašu nākamo taustiņu; taustiņi ir iekrāsoti pēc pirkstu zonām, lai tu iemācītos, kurš pirksts kur sniedzas; un blāvs atpūtā esošu roku pāris rāda, kur pirksti mīt starp piesitieniem. Visa prasme ir viens vienīgs ieradums: turi acis uz vārdiem, nevis uz rokām.",
        },
      ],
    },
    {
      id: "journey",
      nav: "Tavs ceļš",
      heading: "Kā aug nodarbības — tavs ceļš",
      blocks: [
        {
          p: "KeyLearn ir *pielāgojošs*. Tas mēra, cik ātri un cik tīri tu trāpi katram taustiņam, un pievieno tavai kopai jaunu burtu tikai tad, kad esošos raksti gan ātri, gan precīzi. Šī augošā kopa ir tavs ceļš — no dažiem burtiem līdz visam alfabētam. Grūtība ceļas tieši tik ātri, cik tu pats, nekad ātrāk, tāpēc tu vienmēr strādā tieši uz savas robežas.",
        },
      ],
    },
    {
      id: "readout",
      nav: "Tiešraides statistika",
      heading: "Tiešraides rādījumi",
      blocks: [
        {
          p: "Kamēr raksti, peldošais panelis rāda tavu pašreizējo ātrumu un precizitāti, nelielu nesenāko piegājienu līkni, tavus mērķus un sēriju. Tas ir šeit, lai tevi iedrošinātu, nevis lai uzbāztos.",
        },
        {
          p: "*− un +* blakus mērķim tūlīt paceļ vai pazemina šodienas mērķi, neatverot Iestatījumus. Pazemini to, ja tie paši daži burti vairs neuzlabojas; ātrums, kas burtam jāsasniedz, ir vienīgais, kas nosaka, cik ātri atveras jauni burti.",
        },
        {
          p: "Ja esi izvēlējies profila attēlu, tā zīmējums var vāji rādīties aiz šiem skaitļiem — Konts, Izskats, *Jūsu attēls aiz statistikas*, ar slīdni, kas nosaka, cik spilgts tas ir. Izslēgts, ja vien to neieslēdz.",
        },
      ],
    },
    {
      id: "tools",
      nav: "Prakses rīki",
      heading: "Prakses rīki",
      blocks: [
        {
          p: "Mazie rīki blakus tekstam ļauj atvērt pavadītu ievadapskatu, sākt pašreizējo nodarbību no jauna (Ctrl + pa kreisi), pārlekt uz nākamo (Ctrl + pa labi), parādīt vai paslēpt ekrāna tastatūru un mainīt prakses teksta izmēru. Zobratiņš atver pilnos Iestatījumus, kas aprakstīti tālāk.",
        },
      ],
    },
    {
      id: "content",
      nav: "Ko tu raksti",
      heading: "Izvēlies, ko rakstīt",
      blocks: [
        {
          p: "Atver Iestatījumus un dodies uz Prakses saturs, lai izvēlētos, kā tiek veidoti tavi vārdi:",
        },
        {
          tips: [
            "*Vadītā prakse* — pielāgojošais noklusējums, kas audzē tavu alfabētu taustiņu pa taustiņam.",
            "*Klasiskais kurss* — noteikts, sakārtots gājiens cauri taustiņiem.",
            "*Koda meistarība* — īsts kods no īstiem ietvariem.",
            "*Biežākie vārdi* — visbiežāk lietotie vārdi tavā valodā.",
            "*Grāmatu teksts* — raksti cauri īstām grāmatām, kas iebūvētas lietotnē.",
            "*Citāti* — īsas, pabeigtas domas ar īstiem lielajiem burtiem un pieturzīmēm.",
            "*Tavs paša teksts* — ielīmē, ko vien vēlies, un praktizējies ar to.",
            "*Ciparu treniņi* — ciparu rinda un ciparu bloks.",
          ],
        },
        { lab: "Nomainīt to, ko raksti" },
        {
          steps: [
            "Atver Iestatījumus (zobratiņš pie prakses teksta).",
            "Dodies uz Prakses saturs.",
            "Izvēlies režīmu — Grāmatu tekstam izvēlies grāmatu, Savam tekstam ielīmē savus vārdus.",
            "Aizver Iestatījumus un turpini rakstīt.",
          ],
        },
        {
          p: "Tajā pašā ekrānā iestata alfabēta lielumu, mērķa ātrumu, cik ilgi turpinās katra nodarbība, un dienas mērķi.",
        },
      ],
    },
    {
      id: "smart",
      nav: "Gudrā prakse",
      heading: "Gudrās prakses palīgi",
      blocks: [
        {
          p: "Papildus vadītajai praksei Gudrā prakse pievieno maigus palīgus: šauro vietu treniņu, kas izķer tavus lēnākos taustiņu pārus, atkārtošanu ar atstarpēm, atsvaidzinātājus pret prasmju rūsēšanu, kas atgriežas pie piemirstiem taustiņiem, gudro pārliecību un taustiņu atgūšanu. Pēc noklusējuma visi ir ieslēgti.",
        },
        { lab: "Ieslēgt vai izslēgt palīgu" },
        {
          steps: [
            "Atver Iestatījumus.",
            "Dodies uz Gudrā prakse.",
            "Pārslēdz jebkuru palīgu, kādu vēlies — vai atstāj visus ieslēgtus.",
          ],
        },
      ],
    },
    {
      id: "keyboard",
      nav: "Tastatūras iestatīšana",
      heading: "Tastatūras iestatīšana",
      blocks: [
        {
          p: "Iestatījumos sadaļā Tastatūras iestatīšana tu pielāgo KeyLearn savai tastatūrai un izkārtojumam, ko vēlies apgūt.",
        },
        { lab: "Mainīt tastatūras izkārtojumu" },
        {
          steps: [
            "Atver Iestatījumus.",
            "Dodies uz Tastatūras iestatīšana.",
            "Izvēlies valodu un pēc tam izkārtojumu (QWERTY, Dvorak, Colemak un citus).",
            "Atstāj ieslēgtu “Simulēt šo izkārtojumu”, lai varētu to trenēt neatkarīgi no tā, kā iestatīts tavs dators.",
            "Pārbaudi tiešraides priekšskatījumā.",
          ],
        },
        {
          p: "Tajā pašā ekrānā vari izvēlēties tastatūras formu, iekrāsot taustiņus pēc pirkstu zonām un izcelt nākamo taustiņu, kamēr vēl mācies, kur kas atrodas.",
        },
        {
          p: "Tastatūras *apdare* — taustiņu izskats — nāk līdzi kontam. Kad esi pieteicies, vari izvēlēties no piecām, un apaļā ir sešās krāsās; viena no tām seko tavas tēmas krāsai. Viss pārējais iepriekš minētais tev pieder jebkurā gadījumā: valoda, izkārtojums, forma un pirkstu zonas nekad netiek liegtas, jo tieši tās ļauj lietotnei atbilst tastatūrai, kas ir tavā priekšā.",
        },
      ],
    },
    {
      id: "display",
      nav: "Attēlošana",
      heading: "Attēlošana un sajūta",
      blocks: [
        {
          p: "Iestatījumi Attēlošana un Teksta ievade ļauj rādīt ātrumu vārdos vai rakstzīmēs minūtē un smalki noregulēt, kā jūtas rakstīšana. Atjaunot noklusējumus vienmēr ir viena klikšķa attālumā, ja gribi sākt no jauna.",
        },
        {
          p: "Visas vietnes izskats atrodams sadaļā Konts, Izskats: gaišs, tumšs vai pēc sistēmas, tēmas krāsa un teksta izmērs, kas saglabājas katrā lapā. Katrs mājsaimniecības skolēns patur savus iestatījumus, un tie ceļo līdzi — skati *Rūpes par taviem datiem*.",
        },
      ],
    },
    {
      id: "progress",
      nav: "Tavs progress",
      heading: "Tavs progress — Profila lapa",
      blocks: [
        {
          p: "Profila lapa ir tavs pilnais ieraksts: augšā Kopš sākuma un Šodien statistika (nopraktizētais laiks, izpildītās nodarbības, tavs labākais un ierastais ātrums un precizitāte, un kā šodiena salīdzinās); karte ar katru burtu, ko esi atslēdzis; stāsts par to, kā paātrinājies katrs atsevišķais taustiņš, ar izlīdzināšanas slīdni; kopaina par visiem taustiņiem laika gaitā; un lēnākās pārejas, kas vēl tevi aiztur. Vari pat sacensties ar savu paša pēdējo piegājienu kā spoku, lai progresu sajustu tieši.",
        },
        { lab: "Atvērt savu progresu" },
        {
          steps: [
            "Atver izvēlni.",
            "Izvēlies Profils.",
          ],
        },
      ],
    },
    {
      id: "data",
      nav: "Tavi dati",
      heading: "Rūpes par taviem datiem",
      blocks: [
        { lab: "Notīrīt profila statistiku" },
        {
          steps: [
            "Atver Profilu tam skolēnam, kuru gribi atiestatīt.",
            "Ritini līdz atiestatīšanas vadīklai lapas apakšā.",
            "Apstiprini “Dzēst visu” — tiek notīrīts tikai šis profils.",
          ],
        },
        { lab: "Lejupielādēt savus datus" },
        {
          steps: [
            "Atver Profilu.",
            "Izmanto lejupielādes iespēju, lai saglabātu savu vēsturi failā.",
          ],
        },
        {
          p: "Piesakies, ja vēlies, lai tava vēsture sinhronizētos starp ierīcēm, un lai kopīgotu publisku profila saiti. Nav reklāmu tīklu un nav izsekotāju, un tu vari izdzēst savus datus — vai visu kontu — kad vien vēlies.",
        },
        {
          p: "Pieteikšanās tagad saglabā vairāk nekā tikai rezultātus. Tavi iestatījumi, tēma un teksta izmērs, tevis izvēlētās pieejamības iespējas un katra skolēna paša preferences seko profilam, nevis pārlūkam — tāpēc skolēns, kurš atver KeyLearn jaunā datorā, turpina tur, kur palika, tajā pašā ekrānā un tāpat iestatītā, nevis sāk no jauna ar noklusējumiem.",
        },
      ],
    },
    {
      id: "kids",
      nav: "Bērnu režīms",
      heading: "Bērnu režīms",
      blocks: [
        {
          p: "Bērni praktizējas rotaļīgā takā. Katrs pareizs taustiņš pavirza viņu tēlu soli tuvāk mājām, un tēls aug no maza mazuļa līdz pieaugušam varonim, kad atslēdzas arvien vairāk burtu. Tikko apgūts taustiņš sarīko nelielus svētkus, un katra nodarbība beidzas pie mājīga ugunskura.",
        },
        { lab: "Pārslēgties uz Bērniem" },
        {
          steps: [
            "Atver izvēlni.",
            "Izvēlies Bērni — vai izvēlies bērna profilu sadaļā Skolēni.",
          ],
        },
        {
          p: "Ir divas pasaules, ko izvēlēties — Dino Run ar draudzīgu dinozauru un Hero Trail, kur bruņinieks dodas ceļojumā cauri mežam — un katrā vēl var izvēlēties tēlu.",
        },
      ],
    },
    {
      id: "toybox",
      nav: "Bērnu rotaļu kaste",
      heading: "Bērnu rotaļu kaste",
      blocks: [
        { lab: "Atvērt rotaļu kasti" },
        {
          steps: [
            "Bērnu ekrānā pieskaries zobratiņam spēles laukuma augšā.",
          ],
        },
        {
          p: "Iekšā vari iestatīt pasauli un tēlu, Lielos burtus, Skaņas, Palīgrokas (mirdzošo pirkstu ceļvedi), Tastatūru (paslēptu, vienkāršu vai pilno pieaugušo tastatūru), Burtus uz takas (vārdi, kas parādīti kā klucīši tieši spēlē), nodarbības Taimeri, Uzmundrinājumus (mazus iedrošinošus vēstījumus) un — paslēptus zem Papildu — slīdņus Spilgtumam, Krāsai un tam, cik dzīva jūtas pasaule. Ir arī mierīgs nakts izskats, ne tikai spilgtais dienas.",
        },
        {
          p: "*Key style* maina to, kā taustiņi ir nokrāsoti, bet paši taustiņi nepārvietojas: *Crayon* ir balts taustiņš ar apmali sava pirksta krāsā, un *Rainbow* ir mācību tastatūra pamatkrāsās — zaļš rāmis, sarkani cipari, zili burti ar atsevišķi izceltiem patskaņiem —, kur rāmja taustiņi ir bultiņas, nevis vārdi, bērnam, kurš vēl neprot izlasīt “enter”. Visi sāk ar Crayon. *Finger colours* blakus pilnībā izslēdz iekrāsojumu bērnam, kuram tas vairs nav vajadzīgs.",
        },
      ],
    },
    {
      id: "ages",
      nav: "Augšana",
      heading: "Augt kopā ar savu bērnu",
      blocks: [
        {
          p: "KeyLearn klusiņām pieskaņojas bērna vecumam. Mazākie redz lielus, draudzīgus burtus, piedodošu tempu, burtu klucīšus turpat uz takas un vismaigāko palīdzību; vecāki bērni pāriet uz garākiem vārdiem, pilno tastatūru un tīrāku izskatu. Vienkārši profilā ieraksti dzimšanas gadu, un pārējais notiek pats no sevis.",
        },
      ],
    },
    {
      id: "modes",
      nav: "Citi režīmi",
      heading: "Citi veidi, kā praktizēties",
      blocks: [
        {
          p: "Papildus ikdienas praksei ir *Ātruma tests* — īss vienreizējs fragments, kas parāda tavus vārdus minūtē un precizitāti bez piesaistes kādai nodarbībai; *Izkārtojumu* pārlūks, kur salīdzināt tastatūru izkārtojumus un to pirkstu kartes; *Labākie rezultāti*, lai redzētu, kā tev klājas salīdzinājumā ar citiem; un *Vairāku spēlētāju* sacīkstes, kur reāllaikā mēroties ātrumā ar citiem.",
        },
        { lab: "Kur tos atrast" },
        {
          steps: [
            "Atver izvēlni.",
            "Izvēlies Ātruma tests, Izkārtojumi, Labākie rezultāti vai Vairāku spēlētāju režīms.",
          ],
        },
      ],
    },
    {
      id: "access",
      nav: "Ja kaut kas traucē",
      heading: "Ja kaut kas lietotnē tev traucē",
      blocks: [
        {
          p: "Tam ir atvēlēta vesela lapa, un tas tiek iestatīts *katram skolēnam atsevišķi* — tāpēc viena cilvēka pielāgojumi nekad nemaina neviena cita iestatījumus.",
        },
        { lab: "Kā to atvērt" },
        {
          steps: [
            "Atver izvēlni un izvēlies Konts.",
            "Izvēlies Pieejamība.",
            "Augšā izvēlies skolēnu, tad ieslēdz tik daudz iestatījumu, cik nepieciešams.",
          ],
        },
        {
          p: "Šie pieci iestatījumi *savienojas*. Cilvēkam ar disleksiju un roku trīci vajag divus no tiem, un likt izvēlēties tikai vienu nozīmētu, ka lietotne jautā, kurai grūtībai tā pielāgosies.",
        },
        {
          tips: [
            "Mierīgi — nekas nekustas, nekas netiek skaitīts, nekas netiek mērīts ar laiku, un izlaista diena nepārtrauc sēriju.",
            "Mazāk lietu uzreiz — prakse atveras tikai ar vārdiem un tastatūru.",
            "Vieglāk lasāms — disleksijai veidots burtveidols, vairāk atstarpes starp burtiem un rindām, izteiktāks teksts.",
            "Krāsas atsevišķi — pirkstu krāsas, kas paliek atšķiramas arī krāsu akluma gadījumā, un kļūdas, kas pateiktas ar skaņu, ne tikai ar sarkanu.",
            "Stabilākas rokas — lielāki nospiežamie elementi, nekad divi taustiņi vienlaikus, un taustiņš, kas atkārtojas pats, netiek skaitīts divreiz.",
          ],
        },
        {
          p: "Zem tiem *Iestatīt katru pašam* atver katru slēdzi atsevišķi — piecpadsmit no tiem, tostarp runas ātrumu, subtitrus visam, kas tiek pateikts skaļi, pirksta numuru uz katra taustiņa un to, cik ilgi ignorēt atkārtotu taustiņu. Viena poga visus atgriež sākotnējā stāvoklī.",
        },
      ],
    },
    {
      id: "braille",
      nav: "Braila raksts",
      heading: "Mācīšanās ar Braila tastatūru",
      blocks: [
        {
          p: "Skolēns, kurš ir neredzīgs vai vājredzīgs, saņem pavisam citu lapu — sešu taustiņu Braila ievadi, mācību programmu šūnās, nevis burtos, un runātus norādījumus visa ceļa garumā. Tas ir atsevišķs veids, kā mācīties rakstīt, nevis redzīgo lapa, nolasīta skaļi.",
        },
        { lab: "Ieslēgt to kādam skolēnam" },
        {
          steps: [
            "Atver izvēlni un izvēlies Konts, tad Skolēni.",
            "Rediģē skolēnu vai pievieno jaunu.",
            "Ieslēdz redzes atbalstu un saglabā.",
          ],
        },
        {
          p: "Šis skolēns tagad nokļūst tieši Braila lapā ikreiz, kad praktizējas tieši viņš. Viņa progress tiek skaitīts šūnās, nevis burtos, un sertifikātu viņš var nopelnīt ar tādiem pašiem noteikumiem kā jebkurš cits.",
        },
      ],
    },
    {
      id: "courses",
      nav: "Divi kursi",
      heading: "Vadītā prakse, Klasiskais kurss un kods",
      blocks: [
        {
          p: "*Vadītā prakse* ir pielāgojošais kurss: tas vēro, kuri taustiņi tevi bremzē, un veido nodarbības ap tiem, pievienojot jaunu burtu tikai tad, kad jau esošos raksti gan ātri, gan precīzi.",
        },
        {
          p: "*Klasiskais kurss* ir vecmodīgais — nemainīgas nodarbību kāpnes noteiktā secībā, tieši tā, kā mācītu veca rakstīšanas grāmata. Dažiem cilvēkiem vienkārši patīk zināt, kas būs nākamais.",
        },
        {
          p: "Tie ir atsevišķi kursi ar atsevišķu vēsturi, un sertifikāts tiek nopelnīts vienā vai otrā — nekad abos kopā saskaitītos, jo tad tava pirmā nedēļa tiktu ieskaitīta divreiz. Kursa lapa tavā kontā pasaka, par kuru no tiem tā ziņo.",
        },
        {
          p: "*Koda amats* ir trešais prakses veids: īsti fragmenti tevis izvēlētā valodā, lai iekavas, semikoli un atkāpes tiktu izvingrinātas tā, kā parasta proza tās nekad neizvingrina.",
        },
        { lab: "Kā pārslēgties starp tiem" },
        {
          steps: [
            "Prakses ekrānā atver nodarbības iestatījumus.",
            "Izvēlies Vadītā prakse, Klasiskais kurss vai Koda amats.",
          ],
        },
      ],
    },
    {
      id: "certificates",
      nav: "Sertifikāti",
      heading: "Kā nopelnīt sertifikātu",
      blocks: [
        {
          p: "Sertifikāts apliecina, ka nosaukts skolēns rakstīja ar izmērītu ātrumu un precizitāti, noteiktā valodā, noteiktā datumā. To izdodam mēs — tā nav kvalifikācija, ko kāda eksāmenu komisija vai darba devējs būtu apņēmies atzīt — un tā ir godīga liecība par to, ko cilvēks patiešām paveica.",
        },
        { lab: "Cik tālu vēl trūkst" },
        {
          steps: [
            "Atver izvēlni un izvēlies Konts.",
            "Izvēlies Kurss.",
            "Katram skolēnam ir rinda, kurā redzams katrs nosacījums un cik tālu viņš tajā ticis.",
          ],
        },
        {
          p: "Nosacījumi ir tādi kā: ieviests katrs burts, katrs burts droši apgūts, nevis tikai reizi saticis, pietiekami daudz nodarbību, pietiekami daudz atsevišķu dienu un noturīgs ātrums un precizitāte. Kad visi izpildīti, tajā rindā parādās saite, lai kārtotu pārbaudījumu.",
        },
        {
          p: "Pārbaudījums ir īss, un to vērtē mūsu serveri, nevis tava pārlūkprogramma. Nokārto to, un sertifikāts tiek izdots ar numuru uz tā. Ikviens, kam iedosi šo numuru, var to pārbaudīt lapā *Pārbaudīt sertifikātu* — un tu izvēlies, vai viņam rādīt tavu vārdu.",
        },
      ],
    },
    {
      id: "security",
      nav: "Konta drošība",
      heading: "Piekļuves atslēgas, kodi un tas, kurš ir pieteicies",
      blocks: [
        {
          p: "Vari pieteikties ar paroli, ar pakalpojuma sniedzēju, piemēram, Google, ar saiti, kas nosūtīta uz e-pastu — vai ar *piekļuves atslēgu*, un tieši to mēs izvēlētos. Piekļuves atslēga izmanto tavas pašas ierīces pirksta nospiedumu, seju vai PIN; nav paroles, kas varētu noplūst, un neko no tā, kas glabājas pie mums, nevarētu izmantot, lai pieteiktos tavā vietā.",
        },
        { lab: "Pievienot piekļuves atslēgu" },
        {
          steps: [
            "Atver izvēlni un izvēlies Konts, tad Drošība.",
            "Izvēlies Pievienot piekļuves atslēgu un seko savas ierīces norādei.",
          ],
        },
        {
          p: "*Divpakāpju apstiprināšana* arī ir pieejama, izmantojot autentifikatora lietotni, ar atkopšanas kodiem gadījumam, ja pazaudē tālruni. Izdrukā tos kaut kur, kas nav tālrunis.",
        },
        {
          p: "Tajā pašā lapā uzskaitītas pēdējās darbības — pieteikšanās, neizdevušās pieteikšanās, pievienota piekļuves atslēga, nomainīta parole — katra ar aptuveno vietu, no kurienes tā nākusi, lai kaut ko, ko neesi darījis tu, būtu viegli pamanīt. Ja kaut kas izskatās aplam, *iziet visur* pārtrauc visas sesijas, izņemot to, kuru lieto tagad.",
        },
        {
          p: "Ir arī *vecāku PIN*, kas noslēdz konta iestatījumus, lai bērns pie ģimenes ierīces tos nevarētu mainīt vai izdzēst profilu.",
        },
      ],
    },
    {
      id: "yours",
      nav: "Pielāgo sev",
      heading: "Pielāgo sev",
      blocks: [
        { lab: "Nomainīt motīvu" },
        {
          steps: [
            "Atver izvēlni un izvēlies Konts, tad Izskats.",
            "Izvēlies gaišo, tumšo vai seko ierīcei.",
          ],
        },
        {
          p: "Ja neviens no gatavajiem motīviem nav tas īstais, *motīvu veidotājs* ļauj samiksēt savējo — arī pirkstu krāsas, ar kurām māca tastatūra. Lietotne izmēra jebkuras tavas izvēles kontrastu un atsakās no salikumiem, kurus neviens nespētu izlasīt.",
        },
        {
          p: "Katram mājsaimniecības skolēnam var būt sava krāsa, tāpēc koplietota ierīce joprojām šķiet piederam tam, kurš pie tās sēž.",
        },
        { lab: "Nomainīt vietnes valodu" },
        {
          steps: [
            "Atver izvēlni.",
            "Sadaļā Vietnes valoda izvēlies savu valodu.",
          ],
        },
        {
          p: "Prakses ekrānā vari arī mainīt teksta izmēru un ieslēgt vai izslēgt skaņas, kad vien vēlies.",
        },
      ],
    },
    {
      id: "privacy",
      nav: "Privātums",
      heading: "Privātums vienā teikumā",
      blocks: [
        {
          p: "Nav reklāmu tīklu un nav izsekotāju. Bērna profils nekad nepamet tavu pārlūku. Piesakies tikai tad, ja vēlies sinhronizēt vai kopīgot; citādi viss paliek šajā ierīcē, un tu to vari izdzēst jebkurā laikā.",
        },
        {
          p: "Dažās lapās tu vari redzēt *sponsorētu rindu*. To esam pārdevuši un rādām paši — šeit nav reklāmu tīkla, un nekas tev neseko ārpus vietnes. To izvēlas lapa, kurā atrodies, nekad ne kaut kas, ko mēs par tevi zinām, un tā nekad netiek rādīta bērnam, bērnu pasaulē, skolas kontā vai nodarbības laikā. Pieskaries *Kāpēc es to redzu?* pie jebkuras no tām, lai turpat saņemtu to pašu paskaidrojumu, un tie, kas atbalstījuši projektu, tās neredz nekad.",
        },
      ],
    },
    {
      id: "support",
      nav: "Palīdzības saņemšana",
      heading: "Palīdzības saņemšana",
      blocks: [
        {
          p: "Katra ziņa, ko mums sūti, kļūst par *sarunu, pie kuras vari atgriezties*, nevis e-pastu, kas pazūd. Tā atrodas sadaļā Konts, un tai ir savs atsauces numurs — to nosauc, ja kādreiz atkal zvani vai raksti.",
        },
        { lab: "Lūgt palīdzību" },
        {
          steps: [
            "Atver izvēlni un izvēlies Konts, pēc tam Atbalsts.",
            "Izvēlies Reģistrēt pieprasījumu un pastāsti, kas notiek.",
            "Pievieno ekrānuzņēmumu, ja tas palīdz — PNG, JPG vai PDF, līdz 10 MB katrs.",
          ],
        },
        {
          p: "Atbildes parādās tajā sarunā, un zvaniņš galvenē iedegas, kad kāda pienāk, tāpēc tev nav jāsēž un jāskatās lapā. Viss jau atrisinātais tiek salocīts zem Atrisināts, kas sākumā ir aizvērts — tas, ko vēl gaidi, ir tas, ko redzi.",
        },
        { lab: "Kas atbild" },
        {
          p: "Asistents vārdā Tab to izlasa pirmais un atbild uz to, ko spēj. Tas tev pateiks, ka ir mākslīgais intelekts — tas nekad neizliekas par ko citu un skaidri pasaka, ja kaut ko nezina.",
        },
        {
          p: "Cilvēks pārņem sarunu, kad tā ir labākā atbilde: viss, kas saistīts ar naudu, taviem datiem, drošību, vai vienkārši tāpēc, ka tu to palūdzi. Tev nekad nav jāprasa divreiz un nekad nav jāatkārtojas — tas, kurš to pārņem, jau redz visu, ko esi teicis.",
        },
        {
          p: "Ja kāda ziņa izklausās pēc īstas ārkārtas situācijas, atbilde katru reizi ir tā pati un nāk no noteikta teksta, nevis no asistenta: ārkārtas tālruņa numurs tavā atrašanās vietā, un kāds no mūsu puses tiek nekavējoties brīdināts. Mēs nevaram piezvanīt tavā vietā, un mēs to arī pasakām.",
        },
        { lab: "Sakārtošana" },
        {
          p: "Sarunu no saraksta vari noņemt jebkurā laikā ar miskastes ikonu blakus tai. Neliela piezīme pie *Reģistrēt pieprasījumu* skaita, cik esi notīrījis, tāpēc pazudusi saruna nekad nav mīkla.",
        },
        {
          p: "Koplietotā ģimenes ierīcē sadaļa Atbalsts pirms atvēršanas prasa pieaugušo PIN — atbalsta sarunas ir konta lieta, un tas, kurš trenējas, ne vienmēr ir tas, kurš kontu izveidoja.",
        },
      ],
    },
    {
      id: "signout",
      nav: "Izrakstīšanās",
      heading: "Izrakstīšanās",
      blocks: [
        { lab: "Iziet" },
        { steps: ["Atver izvēlni.", "Izvēlies Iziet un apstiprini."] },
        {
          p: "Tava prakses vēsture droši paliek šajā ierīcē — un tavā kontā, ja tādu izveidoji — gatava nākamajai reizei, kad apsēdīsies rakstīt.",
        },
      ],
    },
    {
      id: "tips",
      nav: "Padomi",
      heading: "Daži ieradumi, kas tiešām palīdz",
      blocks: [
        {
          tips: [
            "Precizitāte pirms ātruma — paliek tieši tīra rakstīšana.",
            "Labo kļūdas mierīgi; nesteidzies tās atgūt skrējienā.",
            "Balsti pirkstus pamatrindā — uz F un J ir mazi izciļņi.",
            "Dažas minūtes katru dienu ir labāk nekā stunda reizi nedēļā.",
          ],
        },
      ],
    },
  ],
};
