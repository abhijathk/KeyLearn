import { type GuideTranslation } from "../guide-content.tsx";

export const lt: GuideTranslation = {
  kicker: "Viskas, ką gali daryti",
  title: "Naudotojo vadovas",
  dateline: "Visas KeyLearn vadovas — nuo pirmo apsilankymo iki atsijungimo",
  navLabel: "Šiame puslapyje",
  sections: [
    {
      id: "account",
      nav: "Ar man reikia paskyros?",
      heading: "Ar man reikia paskyros?",
      blocks: [
        {
          p: "Ne. Rašyti gali pradėti vos atėjęs, o tavo pažanga išsaugoma čia pat, šiame įrenginyje. Nemokamą paskyrą kurk tik tada, jei nori, kad istorija sektų tave į kitus įrenginius, jei nori atsarginės kopijos arba profilio nuorodos, kuria galėtum pasidalyti. Nieko naudingo už prisijungimo neslepiame.",
        },
      ],
    },
    {
      id: "signin",
      nav: "Prisijungimas ir slaptažodžiai",
      heading: "Registracija, prisijungimas ir slaptažodžiai",
      blocks: [
        {
          p: "Viskas yra meniu viršuje dešinėje, po Prisijungti arba registruotis — tos pačios durys, nesvarbu, ar paskyrą jau turi, ar ne.",
        },
        { lab: "Susikurti paskyrą arba prisijungti" },
        {
          steps: [
            "Atidaryk meniu ir pasirink Prisijungti arba registruotis.",
            "Tęsk su „Google“, „Facebook“ arba slaptarakčiu — arba įvesk savo el. pašto adresą ir spausk Tęsti.",
            "Su nauju el. pašto adresu nusistatysi slaptažodį; su jau esamu jo bus paprašyta.",
          ],
        },
        { lab: "Atkurti pamirštą slaptažodį" },
        {
          steps: [
            "Prisijungimo ekrane įvesk savo el. pašto adresą ir spausk Tęsti.",
            "Pasirink Pamiršote slaptažodį?",
            "Atidaryk atkūrimo nuorodą, kurią tau atsiųsime.",
            "Pasirink naują slaptažodį ir prisijunk.",
          ],
        },
      ],
    },
    {
      id: "profiles",
      nav: "Profiliai",
      heading: "Profiliai visiems namiškiams",
      blocks: [
        {
          p: "KeyLearn sukurtas kaip namų ūkis: vienoje paskyroje telpa iki keturių profilių (aštuoni su premium), suaugusieji ir vaikai bet kokiu deriniu. Kiekvienas profilis šiame įrenginyje saugo *savo* atskirą pažangą — niekas niekada nesumaišoma.",
        },
        { lab: "Pridėti profilį" },
        {
          steps: [
            "Atidaryk meniu ir pasirink Paskyra (arba „Nustatyti profilius“).",
            "Pasirink Pridėti profilį.",
            "Įrašyk vardą.",
            "Pažymėk, ar tai Suaugusysis, ar Vaikas.",
            "Pasirink paveikslėlį — draugišką piktogramą arba Nuotrauką iš savo įrenginio.",
            "Vaikui nurodyk gimimo metus (taip tik priderinami žodžiai ir tempas prie jo amžiaus).",
            "Išsaugok.",
          ],
        },
        { lab: "Perjungti į kitą mokinį" },
        {
          steps: [
            "Atidaryk meniu.",
            "Bakstelėk veidą skiltyje Mokiniai — programa tęs nuo tos vietos, kur jis baigė.",
          ],
        },
        { lab: "Redaguoti arba pašalinti profilį" },
        {
          steps: [
            "Atidaryk meniu ir pasirink Paskyra.",
            "Ties profiliu pasirink Redaguoti arba ištrink jį, kad atlaisvintum vietą.",
          ],
        },
        {
          p: "Vaikų profiliai gauna supaprastintą, apribotą meniu, o suaugusiųjų veiksmai slepiasi už greito matematikos klausimo „kiek yra A kart B?“, kad mažieji neužklystų į nustatymus.",
        },
      ],
    },
    {
      id: "screen",
      nav: "Pratybų ekranas",
      heading: "Pratybų ekranas",
      blocks: [
        {
          p: "Tiesiog pradėk rašyti. Reikiamas žodis plūduriuoja tiesiai virš ekrano klaviatūros; švytinti kometa rodo į patį kitą klavišą; klavišai nuspalvinti pagal pirštų zonas, kad išmoktum, kuris pirštas kur siekia; o blyški ilsinčių rankų pora rodo, kur pirštai laukia tarp paspaudimų. Visas įgūdis — vienas įprotis: laikyk akis ant žodžių, o ne ant rankų.",
        },
      ],
    },
    {
      id: "journey",
      nav: "Tavo kelionė",
      heading: "Kaip auga pamokos — tavo kelionė",
      blocks: [
        {
          p: "KeyLearn yra *prisitaikantis*. Jis matuoja, kaip greitai ir kaip švariai pataikai į kiekvieną klavišą, ir naują raidę į tavo rinkinį įtraukia tik tada, kai esamas rašai ir greitai, ir tiksliai. Tas augantis rinkinys ir yra tavo kelionė — nuo saujelės raidžių iki visos abėcėlės. Sunkumas kyla lygiai taip greitai, kaip ir tu, niekada ne greičiau, tad visada dirbi ties savo riba.",
        },
      ],
    },
    {
      id: "readout",
      nav: "Tiesioginė statistika",
      heading: "Tiesioginis skydelis",
      blocks: [
        {
          p: "Kol rašai, plūduriuojantis skydelis rodo dabartinį tavo greitį ir tikslumą, mažą pastarųjų bandymų grafiką, tikslų eigą ir tavo dienų seriją. Jis skirtas tave padrąsinti, o ne bambėti.",
        },
        {
          p: "*− ir +* šalia tikslo iš karto pakelia arba nuleidžia šiandienos tikslą, neatidarant Nustatymų. Nuleisk jį, jei tos pačios kelios raidės nustojo gerėti; greitis, kurį raidė turi pasiekti, yra vienintelis dalykas, nuo kurio priklauso, kaip greitai atsirakina naujos.",
        },
        {
          p: "Jei pasirinkai profilio paveikslėlį, jo iliustracija gali blankiai matytis už tų skaičių — Paskyra, Išvaizda, *Jūsų kūrinys už statistikos*, su slankikliu ryškumui nustatyti. Išjungta, kol pats neįjungsi.",
        },
      ],
    },
    {
      id: "tools",
      nav: "Pratybų įrankiai",
      heading: "Pratybų įrankiai",
      blocks: [
        {
          p: "Maži įrankiai šalia teksto leidžia atverti vedamą apžvalgą, pradėti dabartinę pamoką iš naujo (Ctrl + kairėn), peršokti į kitą (Ctrl + dešinėn), parodyti arba paslėpti ekrano klaviatūrą ir pakeisti pratybų teksto dydį. Krumpliaratis atveria visus Nustatymus, aprašytus toliau.",
        },
      ],
    },
    {
      id: "content",
      nav: "Ką rašai",
      heading: "Pasirink, ką rašysi",
      blocks: [
        {
          p: "Atverk Nustatymus ir eik į Pratybų turinys, kad pasirinktum, kaip sudaromi tavo žodžiai:",
        },
        {
          tips: [
            "*Vedamos pratybos* — prisitaikanti numatytoji veiksena, auginanti tavo abėcėlę po vieną klavišą.",
            "*Klasikinis kursas* — nustatytas, iš eilės einantis žygis per klavišus.",
            "*Išeities kodas* — tikras kodas iš tikrų karkasų.",
            "*Dažniausi žodžiai* — dažniausi tavo kalbos žodžiai.",
            "*Knygų tekstas* — rašyk per tikras knygas, įdėtas į programą.",
            "*Citatos* — trumpos, užbaigtos mintys su tikromis didžiosiomis raidėmis ir skyrybos ženklais.",
            "*Tavo tekstas* — įklijuok, ką nori, ir mokykis su juo.",
            "*Skaičių pratimai* — skaičių eilutė ir skaičių klaviatūra.",
          ],
        },
        { lab: "Pakeisti tai, ką rašai" },
        {
          steps: [
            "Atverk Nustatymus (krumpliaratis prie pratybų teksto).",
            "Eik į Pratybų turinys.",
            "Pasirink veikseną — Knygų tekstui pasirink knygą, Savo tekstui įklijuok savo žodžius.",
            "Užverk Nustatymus ir rašyk toliau.",
          ],
        },
        {
          p: "Tame pačiame ekrane nustatomas abėcėlės dydis, siekiamas greitis, kiek trunka kiekviena pamoka ir dienos tikslas.",
        },
      ],
    },
    {
      id: "smart",
      nav: "Išmaniosios pratybos",
      heading: "Išmaniųjų pratybų pagalbininkai",
      blocks: [
        {
          p: "Be vedamų pratybų, Išmaniosios pratybos prideda švelnių pagalbininkų: siaurų vietų pratimą, kuris medžioja lėčiausias tavo klavišų poras, kartojimą su intervalais, atnaujinimus prieš įgūdžių dilimą, grįžtančius prie aprūdijusių klavišų, išmanųjį pasitikėjimą ir klavišų atgavimą. Numatytai visi jie įjungti.",
        },
        { lab: "Įjungti arba išjungti pagalbininką" },
        {
          steps: [
            "Atverk Nustatymus.",
            "Eik į Išmaniosios pratybos.",
            "Perjunk bet kurį pagalbininką — arba palik visus įjungtus.",
          ],
        },
      ],
    },
    {
      id: "keyboard",
      nav: "Klaviatūros sąranka",
      heading: "Klaviatūros nustatymas",
      blocks: [
        {
          p: "Nustatymų skiltyje Klaviatūra pritaikai KeyLearn prie savo klaviatūros ir išdėstymo, kurį nori išmokti.",
        },
        { lab: "Pakeisti klaviatūros išdėstymą" },
        {
          steps: [
            "Atidaryk Nustatymus.",
            "Eik į Klaviatūra.",
            "Pasirink kalbą, tada išdėstymą (QWERTY, Dvorak, Colemak ir kitus).",
            "Palik įjungtą „Emuliuoti išdėstymą“, kad galėtum jį praktikuoti, kad ir kaip būtų nustatytas tavo kompiuteris.",
            "Patvirtink pažiūrėjęs į tiesioginę peržiūrą.",
          ],
        },
        {
          p: "Tame pačiame ekrane gali pasirinkti klaviatūros formą, nuspalvinti klavišus pagal pirštų zonas ir paryškinti kitą klavišą, kol dar mokaisi, kur kas yra.",
        },
        {
          p: "Klaviatūros *apdaila* — klavišų išvaizda — ateina kartu su paskyra. Prisijungęs gali rinktis iš penkių, o apvalioji būna šešių spalvų; viena iš jų seka tavo temos spalvą. Visa kita tavo bet kuriuo atveju: kalba, išdėstymas, forma ir pirštų zonos niekada neribojamos, nes būtent jos pritaiko programą prie priešais tave esančios klaviatūros.",
        },
      ],
    },
    {
      id: "display",
      nav: "Rodinys",
      heading: "Rodinys ir pojūtis",
      blocks: [
        {
          p: "Nustatymai Įvairūs ir Spausdinimas leidžia rodyti greitį žodžiais arba ženklais per minutę ir tiksliai suderinti, kaip jaučiasi rašymas. Atstatyti visada už vieno spustelėjimo, jei nori pradėti iš naujo.",
        },
        {
          p: "Visos svetainės išvaizda yra skiltyje Paskyra, Išvaizda: šviesi, tamsi arba pagal sistemą, temos spalva ir teksto dydis, kuris galioja kiekviename puslapyje. Kiekvienas namų mokinys turi savo nustatymus, ir jie keliauja kartu su juo — žr. *Kaip rūpintis savo duomenimis*.",
        },
      ],
    },
    {
      id: "progress",
      nav: "Tavo pažanga",
      heading: "Tavo pažanga — Profilio puslapis",
      blocks: [
        {
          p: "Profilio puslapis — tavo pilnas įrašas: viršuje Visų laikų ir Šiandienos statistika (kiek laiko mokeisi, kiek pamokų atlikai, geriausias ir įprastas greitis bei tikslumas ir kaip atrodo šiandiena); žemėlapis su kiekviena atrakinta raide; pasakojimas, kaip greitėjo kiekvienas atskiras klavišas, su glodinimo slankikliu; bendras visų klavišų vaizdas laikui bėgant; ir lėčiausi perėjimai, vis dar tave stabdantys. Gali net lenktyniauti su savo paskutiniu bandymu kaip su šmėkla, kad pažangą pajustum tiesiogiai.",
        },
        { lab: "Atverti savo pažangą" },
        {
          steps: [
            "Atidaryk meniu.",
            "Pasirink Profilis.",
          ],
        },
      ],
    },
    {
      id: "data",
      nav: "Tavo duomenys",
      heading: "Kaip rūpintis savo duomenimis",
      blocks: [
        { lab: "Išvalyti profilio statistiką" },
        {
          steps: [
            "Atidaryk mokinio, kurį nori atstatyti, Profilį.",
            "Slink iki atstatymo valdiklio puslapio apačioje.",
            "Patvirtink „Ištrinti viską“ — išvalomas tik šis profilis.",
          ],
        },
        { lab: "Atsisiųsti savo duomenis" },
        {
          steps: [
            "Atidaryk Profilį.",
            "Atsisiuntimo parinktimi išsaugok savo istoriją kaip failą.",
          ],
        },
        {
          p: "Prisijunk, jei nori, kad tavo istorija būtų sinchronizuojama tarp įrenginių, ir norėdamas dalytis viešo profilio nuoroda. Nėra jokių reklamos tinklų ir jokių sekiklių, o savo duomenis — ar visą paskyrą — gali ištrinti kada tik nori.",
        },
        {
          p: "Prisijungus dabar perkeliami ne tik rezultatai. Tavo nustatymai, tema ir teksto dydis, prieinamumo pasirinkimai ir kiekvieno mokinio nuostatos seka profilį, o ne naršyklę — todėl mokinys, atsidaręs KeyLearn naujame kompiuteryje, tęsia ten, kur baigė, tame pačiame ekrane ir taip pat nustatytame, o ne pradeda iš naujo nuo numatytųjų nustatymų.",
        },
      ],
    },
    {
      id: "kids",
      nav: "Vaikų veiksena",
      heading: "Vaikų veiksena",
      blocks: [
        {
          p: "Vaikai mokosi žaismingame take. Kiekvienas teisingas klavišas nuveda jų personažą žingsniu arčiau namų, o personažas auga nuo mažo kūdikio iki suaugusio herojaus, kai atrakinama vis daugiau raidžių. Ką tik išmoktas klavišas sukelia mažą šventę, o kiekvienas užsiėmimas baigiasi prie jaukaus laužo.",
        },
        { lab: "Perjungti į Vaikus" },
        {
          steps: [
            "Atidaryk meniu.",
            "Pasirink Vaikai — arba pasirink vaiko profilį skiltyje Mokiniai.",
          ],
        },
        {
          p: "Galima rinktis iš dviejų pasaulių — Dino Run su draugišku dinozauru ir Hero Trail, kur riteris keliauja per mišką — ir kiekviename dar pasirenkamas personažas.",
        },
      ],
    },
    {
      id: "toybox",
      nav: "Vaikų žaislų dėžė",
      heading: "Vaikų žaislų dėžė",
      blocks: [
        { lab: "Atverti žaislų dėžę" },
        {
          steps: [
            "Vaikų ekrane bakstelėk krumpliaratį žaidimo srities viršuje.",
          ],
        },
        {
          p: "Viduje gali nustatyti pasaulį ir personažą, Dideles raides, Garsus, Pagalbines rankas (švytintį pirštų vedlį), Klaviatūrą (paslėptą, paprastą arba visą suaugusiųjų), Raides ant tako (žodžius, rodomus kaip kaladėlės tiesiai žaidime), užsiėmimo Laikmatį, Padrąsinimus (mažas paskatinančias žinutes) ir — paslėptus po Išplėstiniais — slankiklius Ryškumui, Spalvai ir tam, kaip gyva atrodo pasaulis. Yra ir ramus naktinis vaizdas, ne tik šviesus dieninis.",
        },
        {
          p: "*Key style* keičia tai, kaip klavišai nuspalvinti, o patys klavišai nejuda: *Crayon* — tai baltas klavišas, apvestas savo piršto spalva, o *Rainbow* — pagrindinių spalvų mokomoji klaviatūra: žalias rėmelis, raudoni skaičiai, mėlynos raidės, balsės išskirtos atskirai; joje rėmelio klavišai yra rodyklės, o ne žodžiai, vaikui, kuris dar nemoka perskaityti „enter“. Visi pradeda nuo Crayon. Šalia esantis *Finger colours* visiškai išjungia spalvinimą vaikui, kuriam jo nebereikia.",
        },
      ],
    },
    {
      id: "ages",
      nav: "Augimas",
      heading: "Augti kartu su vaiku",
      blocks: [
        {
          p: "KeyLearn tyliai prisiderina prie vaiko amžiaus. Patys mažiausi mato dideles, draugiškas raides, atlaidų tempą, raidžių kaladėles tiesiai ant tako ir švelniausią pagalbą; vyresni vaikai pereina prie ilgesnių žodžių, visos klaviatūros ir švaresnio vaizdo. Tiesiog nurodyk profilyje gimimo metus, o visa kita įvyks savaime.",
        },
      ],
    },
    {
      id: "modes",
      nav: "Kitos veiksenos",
      heading: "Kiti būdai mokytis",
      blocks: [
        {
          p: "Be kasdienių pratybų, yra *Greičio testas* — trumpa vienkartinė ištrauka, parodanti tavo žodžius per minutę ir tikslumą be jokios pamokos; *Išdėstymų* naršyklė, kur palyginami klaviatūrų išdėstymai ir jų pirštų žemėlapiai; *Geriausi rezultatai*, kad pamatytum, kaip atrodai tarp kitų; ir *Kelių žaidėjų* lenktynės, kuriose greitį gali matuoti su kitais realiu laiku.",
        },
        { lab: "Kur juos rasti" },
        {
          steps: [
            "Atidaryk meniu.",
            "Pasirink Greičio testas, Išdėstymai, Geriausi rezultatai arba Kelių žaidėjų režimas.",
          ],
        },
      ],
    },
    {
      id: "access",
      nav: "Jei kas nors trukdo",
      heading: "Jei kas nors programoje tau trukdo",
      blocks: [
        {
          p: "Tam skirtas visas puslapis, ir tai nustatoma *kiekvienam mokiniui atskirai* — tad vieno žmogaus pritaikymai niekada nepakeičia niekieno kito.",
        },
        { lab: "Kaip jį atverti" },
        {
          steps: [
            "Atidaryk meniu ir pasirink Paskyra.",
            "Pasirink Prieinamumas.",
            "Viršuje pasirink mokinį, tada įjunk tiek nustatymų, kiek reikia.",
          ],
        },
        {
          p: "Šie penki nustatymai *jungiasi*. Žmogui, turinčiam disleksiją ir rankų drebėjimą, reikia dviejų iš jų, o versti rinktis vieną reikštų, kad programa klausia, kuriam sunkumui pritaikyti.",
        },
        {
          tips: [
            "Ramu — niekas nejuda, niekas neskaičiuojama, niekas nematuojama laiku, o praleista diena nenutraukia serijos.",
            "Mažiau dalykų iš karto — pratybos atsiveria vien su žodžiais ir klaviatūra.",
            "Lengviau skaityti — disleksijai sukurtas šriftas, daugiau tarpų tarp raidžių ir eilučių, ryškesnis tekstas.",
            "Spalvos atskirai — pirštų spalvos, likančios atskiriamos ir esant spalvų aklumui, o klaidos pasakomos garsu, ne vien raudonai.",
            "Tvirtesnės rankos — didesni spaudžiami elementai, niekada du klavišai iš karto, o pats save pakartojantis klavišas neįskaitomas du kartus.",
          ],
        },
        {
          p: "Po jais *Nustatyti kiekvieną pačiam* atveria kiekvieną jungiklį atskirai — jų penkiolika, tarp jų kalbos greitis, subtitrai viskam, kas sakoma balsu, piršto numeris ant kiekvieno klavišo ir tai, kiek laiko nepaisyti pasikartojančio klavišo. Vienas mygtukas viską grąžina atgal.",
        },
      ],
    },
    {
      id: "braille",
      nav: "Brailio raštas",
      heading: "Mokymasis Brailio klaviatūra",
      blocks: [
        {
          p: "Neregys ar silpnaregis mokinys gauna visai kitą puslapį — šešių klavišų Brailio įvestį, mokymo programą, matuojamą langeliais, o ne raidėmis, ir kalbinį vedimą visą kelią. Tai atskiras būdas mokytis rašyti, o ne matantiesiems skirtas puslapis, perskaitytas balsu.",
        },
        { lab: "Įjungti tai mokiniui" },
        {
          steps: [
            "Atidaryk meniu ir pasirink Paskyra, tada Mokiniai.",
            "Redaguok mokinį arba pridėk naują.",
            "Įjunk regos pagalbą ir išsaugok.",
          ],
        },
        {
          p: "Nuo šiol tas mokinys, kai tik mokosi būtent jis, patenka tiesiai į Brailio puslapį. Jo pažanga skaičiuojama langeliais, o ne raidėmis, ir sertifikatą jis gali užsidirbti tomis pačiomis sąlygomis kaip ir bet kas kitas.",
        },
      ],
    },
    {
      id: "courses",
      nav: "Du kursai",
      heading: "Vedamos pratybos, Klasikinis kursas ir kodas",
      blocks: [
        {
          p: "*Vedamos pratybos* — prisitaikantis kursas: jis stebi, kurie klavišai tave stabdo, ir kuria pamokas aplink juos, naują raidę pridėdamas tik tada, kai jau turimas rašai ir greitai, ir tiksliai.",
        },
        {
          p: "*Klasikinis kursas* — senamadiškas: nekintantys pamokų laiptai nustatyta tvarka, kaip mokytų senas rašymo vadovėlis. Kai kuriems žmonėms tiesiog patinka žinoti, kas bus toliau.",
        },
        {
          p: "Tai atskiri kursai su atskira istorija, o sertifikatas užsidirbamas viename arba kitame — niekada abiejuose sudėjus, nes tada tavo pirmoji savaitė būtų įskaityta du kartus. Kurso puslapis tavo paskyroje pasako, apie kurį iš jų praneša.",
        },
        {
          p: "*Kodo amatas* — trečia pratybų rūšis: tikros iškarpos tavo pasirinkta kalba, kad skliaustai, kabliataškiai ir įtraukos gautų tokį treniravimą, kokio įprasta proza jiems niekada neduoda.",
        },
        { lab: "Kaip perjungti tarp jų" },
        {
          steps: [
            "Pratybų ekrane atverk pamokos nustatymus.",
            "Pasirink Vedamos pratybos, Klasikinis kursas arba Kodo amatas.",
          ],
        },
      ],
    },
    {
      id: "certificates",
      nav: "Sertifikatai",
      heading: "Kaip užsidirbti sertifikatą",
      blocks: [
        {
          p: "Sertifikatas liudija, kad įvardytas mokinys rašė išmatuotu greičiu ir tikslumu, tam tikra kalba, tam tikrą dieną. Jį išduodame mes — tai nėra kvalifikacija, kurią kokia nors egzaminų institucija ar darbdavys būtų sutikę pripažinti — ir tai sąžiningas įrodymas, ką žmogus iš tikrųjų padarė.",
        },
        { lab: "Pažiūrėk, kiek dar trūksta" },
        {
          steps: [
            "Atidaryk meniu ir pasirink Paskyra.",
            "Pasirink Kursas.",
            "Kiekvienas mokinys turi eilutę, rodančią visas sąlygas ir kiek toli jis yra pažengęs.",
          ],
        },
        {
          p: "Sąlygos yra tokios: pristatyta kiekviena raidė, kiekviena raidė patikima, o ne vien kartą sutikta, pakankamai pamokų, pakankamai atskirų dienų ir pastovus greitis bei tikslumas. Kai visos įvykdytos, toje eilutėje atsiranda nuoroda laikyti vertinimą.",
        },
        {
          p: "Vertinimas trumpas, ir jis vertinamas mūsų serveriuose, o ne tavo naršyklėje. Išlaikyk jį, ir sertifikatas išduodamas su numeriu. Bet kas, kam duosi tą numerį, gali jį patikrinti puslapyje *Patikrinti sertifikatą* — o tu pats renkiesi, ar jam bus rodomas tavo vardas.",
        },
      ],
    },
    {
      id: "security",
      nav: "Paskyros sauga",
      heading: "Prieigos raktai, kodai ir kas jungėsi",
      blocks: [
        {
          p: "Prisijungti gali slaptažodžiu, per tiekėją, pavyzdžiui, Google, per nuorodą, atsiųstą į el. paštą — arba *prieigos raktu*, ir būtent jį rinktumėmės mes. Prieigos raktas naudoja paties tavo įrenginio piršto atspaudą, veidą ar PIN; nėra slaptažodžio, kuris galėtų nutekėti, ir niekas, ką laikome mes, negalėtų būti panaudota prisijungti tavo vardu.",
        },
        { lab: "Pridėti prieigos raktą" },
        {
          steps: [
            "Atidaryk meniu ir pasirink Paskyra, tada Sauga.",
            "Pasirink Pridėti prieigos raktą ir vykdyk savo įrenginio nurodymą.",
          ],
        },
        {
          p: "*Dviejų veiksmų patvirtinimas* taip pat yra, su tapatybės nustatymo programėle ir atkūrimo kodais tam atvejui, jei pamestum telefoną. Atsispausdink juos kur nors, kas nėra telefonas.",
        },
        {
          p: "Tame pačiame puslapyje surašyta paskutinė veikla — prisijungimai, nepavykę prisijungimai, pridėtas prieigos raktas, pakeistas slaptažodis — kiekvienas su apytiksle vieta, iš kurios buvo, kad tai, ko nedarei tu, būtų lengva pastebėti. Jei kas atrodo ne taip, *atsijungti visur* nutraukia visus seansus, išskyrus tą, kurį naudoji dabar.",
        },
        {
          p: "Yra ir *tėvų PIN*, kuris užrakina paskyros nustatymus, kad vaikas prie šeimos įrenginio negalėtų jų keisti ar ištrinti profilio.",
        },
      ],
    },
    {
      id: "yours",
      nav: "Pritaikyk sau",
      heading: "Pritaikyk sau",
      blocks: [
        { lab: "Pakeisti temą" },
        {
          steps: [
            "Atidaryk meniu ir pasirink Paskyra, tada Išvaizda.",
            "Pasirink šviesią, tamsią arba sek įrenginiu.",
          ],
        },
        {
          p: "Jei nė viena iš pateiktų temų nėra ta, kurios nori, *temų kūrėjas* leidžia sumaišyti savąją — įskaitant pirštų spalvas, kuriomis moko klaviatūra. Programa išmatuoja bet kurio tavo pasirinkimo kontrastą ir atmeta derinius, kurių niekas negalėtų perskaityti.",
        },
        {
          p: "Kiekvienas namų mokinys gali turėti savo spalvą, tad bendras įrenginys vis tiek atrodo priklausantis tam, kuris prie jo sėdi.",
        },
        { lab: "Pakeisti svetainės kalbą" },
        {
          steps: [
            "Atidaryk meniu.",
            "Skiltyje Svetainės kalba pasirink savo kalbą.",
          ],
        },
        {
          p: "Pratybų ekrane taip pat gali keisti teksto dydį ir įjungti ar išjungti garsus kada tik nori.",
        },
      ],
    },
    {
      id: "privacy",
      nav: "Privatumas",
      heading: "Privatumas vienu sakiniu",
      blocks: [
        {
          p: "Jokių reklamos tinklų ir jokių sekiklių. Vaiko profilis niekada nepalieka tavo naršyklės. Prisijunk tik jei nori sinchronizavimo ar bendrinimo; kitaip viskas lieka šiame įrenginyje, ir gali tai ištrinti bet kada.",
        },
        {
          p: "Kai kuriuose puslapiuose gali pamatyti *remiamą eilutę*. Tai vieta, kurią patys pardavėme ir patys rodome — čia nėra reklamos tinklo ir niekas tavęs neseka už svetainės ribų. Ji parenkama pagal puslapį, kuriame esi, niekada ne pagal tai, ką apie tave žinome, ir niekada nerodoma vaikui, vaikų pasaulyje, mokyklos paskyroje ar vykstant pamokai. Bakstelėk *Kodėl tai matau?* prie bet kurios iš jų, ir ten pat gausi tą patį paaiškinimą; projektą parėmę žmonės jų nemato visai.",
        },
      ],
    },
    {
      id: "support",
      nav: "Pagalba",
      heading: "Kaip gauti pagalbos",
      blocks: [
        {
          p: "Kiekviena žinutė, kurią mums atsiunti, tampa *pokalbiu, prie kurio gali grįžti*, o ne dingstančiu el. laišku. Jis yra skiltyje Paskyra ir turi savo nuorodos numerį — tą, kurį reikia nurodyti, jei kada nors vėl skambinsi ar rašysi.",
        },
        { lab: "Paprašyti pagalbos" },
        {
          steps: [
            "Atidaryk meniu ir pasirink Paskyra, tada Pagalba.",
            "Pasirink Registruoti užklausą ir parašyk, kas vyksta.",
            "Pridėk ekrano kopiją, jei tai padeda — PNG, JPG arba PDF, kiekviena iki 10 MB.",
          ],
        },
        {
          p: "Atsakymai pasirodo tame pokalbyje, o antraštėje esantis varpelis užsidega, kai jų ateina, todėl nereikia sėdėti ir stebėti puslapio. Tai, kas jau sutvarkyta, susiskleidžia po Išspręsta, kuris iš pradžių uždarytas — matai tai, ko dar lauki.",
        },
        { lab: "Kas atsako" },
        {
          p: "Pirmiausia ją perskaito asistentas, vardu Tab, ir atsako, į ką gali. Jis tau pasakys, kad yra dirbtinis intelektas — niekada neapsimeta kitaip — ir tiesiai pasakys, kai ko nors nežino.",
        },
        {
          p: "Žmogus perima, kai tik tai geresnis atsakymas: viskas, kas susiję su pinigais, tavo duomenimis, saugumu, ar tiesiog todėl, kad paprašei. Niekada nereikia prašyti dukart ir niekada nereikia kartotis — kas bebūtų perėmęs, jau mato viską, ką pasakei.",
        },
        {
          p: "Jei žinutė kada nors atrodo kaip tikra skubi pagalba, atsakymas kaskart tas pats ir ateina iš nustatyto teksto, o ne iš asistento: skubiosios pagalbos numeris ten, kur esi, ir iš karto įspėjamas žmogus mūsų pusėje. Mes negalime paskambinti už tave ir tai pasakome.",
        },
        { lab: "Tvarkymasis" },
        {
          p: "Pokalbį iš savo sąrašo gali bet kada pašalinti šalia esančia šiukšliadėžės piktograma. Maža pastaba prie *Registruoti užklausą* skaičiuoja, kiek jų išvalei, todėl dingęs pokalbis niekada nėra paslaptis.",
        },
        {
          p: "Bendrame šeimos įrenginyje skiltis Pagalba prieš atsidarydama paprašo suaugusiojo PIN kodo — pagalbos pokalbiai yra paskyros reikalas, o tas, kuris praktikuojasi, ne visada yra tas, kuris paskyrą sukūrė.",
        },
      ],
    },
    {
      id: "signout",
      nav: "Atsijungimas",
      heading: "Atsijungimas",
      blocks: [
        { lab: "Atsijungti" },
        { steps: ["Atidaryk meniu.", "Pasirink Atsijungti ir patvirtink."] },
        {
          p: "Tavo pratybų istorija saugiai lieka šiame įrenginyje — ir tavo paskyroje, jei ją susikūrei — pasiruošusi kitam kartui, kai atsisėsi rašyti.",
        },
      ],
    },
    {
      id: "tips",
      nav: "Patarimai",
      heading: "Keli įpročiai, kurie tikrai padeda",
      blocks: [
        {
          tips: [
            "Tikslumas pirmiau greičio — būtent švarus rašymas ir prilimpa.",
            "Klaidas taisyk ramiai; neskubėk vytis prarasto laiko.",
            "Laikyk pirštus ant pagrindinės eilutės — ant F ir J yra maži kauburėliai.",
            "Kelios minutės kiekvieną dieną vertesnės už valandą kartą per savaitę.",
          ],
        },
      ],
    },
  ],
};
