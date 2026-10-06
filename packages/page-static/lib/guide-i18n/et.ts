import { type GuideTranslation } from "../guide-content.tsx";

export const et: GuideTranslation = {
  kicker: "Kõik, mida saad teha",
  title: "Kasutusjuhend",
  dateline: "Täielik KeyLearni juhend — esimesest külastusest välja logimiseni",
  navLabel: "Sellel lehel",
  sections: [
    {
      id: "account",
      nav: "Kas mul on kontot vaja?",
      heading: "Kas mul on kontot vaja?",
      blocks: [
        {
          p: "Ei. Võid kohe kirjutama hakata ja sinu edenemine salvestatakse siinsamas selles seadmes. Loo tasuta konto ainult siis, kui soovid, et su ajalugu järgneks sulle teistesse seadmetesse, tahad varukoopiat hoida või profiililinki jagada. Midagi kasulikku ei ole sisselogimise taha lukustatud.",
        },
      ],
    },
    {
      id: "signin",
      nav: "Sisselogimine ja paroolid",
      heading: "Registreerumine, sisselogimine ja paroolid",
      blocks: [
        {
          p: "Kõik asub paremas ülanurgas menüüs, valiku Logi sisse või registreeru all — sama uks, olgu sul konto juba olemas või mitte.",
        },
        { lab: "Loo konto või logi sisse" },
        {
          steps: [
            "Ava menüü ja vali Logi sisse või registreeru.",
            "Jätka Google’i, Facebooki või pääsuvõtmega — või sisesta oma e-posti aadress ja vajuta Jätka.",
            "Uue aadressiga saad määrata parooli; olemasoleva aadressi puhul küsitakse sinult parooli.",
          ],
        },
        { lab: "Lähtesta unustatud parool" },
        {
          steps: [
            "Sisesta sisselogimisekraanil oma e-posti aadress ja vajuta Jätka.",
            "Vali Unustasid parooli?",
            "Ava lähtestuslink, mille sulle saadame.",
            "Vali uus parool ja logi sisse.",
          ],
        },
      ],
    },
    {
      id: "profiles",
      nav: "Profiilid",
      heading: "Profiilid kogu perele",
      blocks: [
        {
          p: "KeyLearn on üles ehitatud nagu kodu: üks konto mahutab kuni neli profiili (kaheksa preemiumiga), täiskasvanuid ja lapsi igas kombinatsioonis. Iga profiil hoiab selles seadmes *oma* eraldi edenemist — midagi ei segata kunagi kokku.",
        },
        { lab: "Lisa profiil" },
        {
          steps: [
            "Ava menüü ja vali Konto (või „Seadista profiilid“).",
            "Vali Lisa profiil.",
            "Kirjuta eesnimi.",
            "Märgi see Täiskasvanuks või Lapseks.",
            "Vali avatar — sõbralik ikoon või Foto oma seadmest.",
            "Lapse puhul lisa sünniaasta (see üksnes kohandab sõnad ja tempo tema vanusele).",
            "Salvesta.",
          ],
        },
        { lab: "Vaheta teisele õppijale" },
        {
          steps: [
            "Ava menüü.",
            "Puuduta nägu jaotises Õppijad — rakendus jätkab sealt, kus pooleli jäi.",
          ],
        },
        { lab: "Muuda või eemalda profiil" },
        {
          steps: [
            "Ava menüü ja vali Konto.",
            "Vali profiilil Muuda või kustuta see, et koht vabastada.",
          ],
        },
        {
          p: "Lasteprofiilid saavad lihtsustatud ja lukustatud menüü ning täiskasvanute toimingud on peidus kiire „mis on A korda B?“ arvutusvärava taga, nii et pisikesed ei satu kogemata seadetesse.",
        },
      ],
    },
    {
      id: "screen",
      nav: "Harjutusekraan",
      heading: "Harjutusekraan",
      blocks: [
        {
          p: "Lihtsalt hakka kirjutama. Vajalik sõna hõljub otse ekraaniklaviatuuri kohal; helendav komeet osutab kohe järgmisele klahvile; klahvid on värvitud sõrmetsoonide järgi, et õpiksid, milline sõrm kuhu ulatub; ja kahvatu puhkavate käte paar näitab, kus su sõrmed vajutuste vahel elavad. Kogu oskus on üksainus harjumus: hoia silmad sõnadel, mitte kätel.",
        },
      ],
    },
    {
      id: "journey",
      nav: "Sinu teekond",
      heading: "Kuidas õppetunnid kasvavad — sinu teekond",
      blocks: [
        {
          p: "KeyLearn on *kohanduv*. See mõõdab, kui kiiresti ja puhtalt sa iga klahvi tabad, ning lisab su komplekti uue tähe alles siis, kui suudad olemasolevaid kirjutada nii kiiresti kui ka täpselt. See kasvav komplekt ongi sinu teekond, peotäiest tähtedest kogu tähestikuni — raskus tõuseb täpselt sama kiiresti kui sina ise, mitte kunagi kiiremini, nii et töötad alati just oma piiri peal.",
        },
      ],
    },
    {
      id: "readout",
      nav: "Reaalajastatistika",
      heading: "Reaalajas näidik",
      blocks: [
        {
          p: "Kirjutamise ajal näitab hõljuv paneel sinu praegust kiirust ja täpsust, väikest viimaste katsete graafikut, sinu eesmärkide edenemist ja seeriat. See on olemas selleks, et sind julgustada, mitte selleks, et nokkida.",
        },
        {
          p: "Sihi kõrval olevad *− ja +* tõstavad või langetavad tänast eesmärki kohe samas, ilma seadeid avamata. Sea see madalamaks, kui samad paar tähte on paigale jäänud; kiirus, mille täht peab saavutama, on ainus asi, mis otsustab, kui kiiresti uued tähed avanevad.",
        },
        {
          p: "Kui oled valinud profiilipildi, võib selle pilt nende numbrite taga tuhmilt paista — Konto, Välimus, *Sinu pilt numbrite taga*, koos liuguriga selle tugevuse jaoks. Väljas, kuni sa selle sisse lülitad.",
        },
      ],
    },
    {
      id: "tools",
      nav: "Harjutusvahendid",
      heading: "Harjutusvahendid",
      blocks: [
        {
          p: "Teksti kõrval olevad väikesed tööriistad lasevad avada juhendatud tuuri, alustada praegust õppetundi otsast (Ctrl + Vasak), hüpata järgmise juurde (Ctrl + Parem), näidata või peita ekraaniklaviatuuri ja muuta harjutusteksti suurust. Hammasratas avab täielikud Seaded, mida kirjeldame järgmisena.",
        },
      ],
    },
    {
      id: "content",
      nav: "Mida sa kirjutad",
      heading: "Kirjutatava valimine",
      blocks: [
        {
          p: "Ava Seaded ja mine jaotisse Harjutuse sisu, et valida, kuidas su sõnad koostatakse:",
        },
        {
          tips: [
            "*Juhendatud harjutamine* — kohanduv vaikevalik, mis kasvatab su tähestikku klahv klahvi haaval.",
            "*Klassikaline kursus* — kindel ja järjestatud marss läbi klahvide.",
            "*Lähtekood* — päris kood päris raamistikest.",
            "*Sagedased sõnad* — sinu keele kõige tavalisemad sõnad.",
            "*Raamatutekst* — kirjuta end läbi rakendusse sisse ehitatud päris raamatute.",
            "*Tsitaadid* — lühikesed terviklikud mõtted koos nende päris suurtähtede ja kirjavahemärkidega.",
            "*Sinu oma tekst* — kleebi sisse, mida soovid, ja harjuta sellega.",
            "*Numbriharjutused* — numbririda ja numbriklahvistik.",
          ],
        },
        { lab: "Muuda seda, mida kirjutad" },
        {
          steps: [
            "Ava Seaded (hammasratas harjutusteksti kõrval).",
            "Mine jaotisse Harjutuse sisu.",
            "Vali režiim — Raamatuteksti puhul vali raamat, Sinu oma teksti puhul kleebi oma sõnad.",
            "Sulge Seaded ja kirjuta edasi.",
          ],
        },
        {
          p: "Samal ekraanil saad määrata tähestiku suuruse, sihtkiiruse, iga õppetunni pikkuse ja päevase eesmärgi.",
        },
      ],
    },
    {
      id: "smart",
      nav: "Nutikas harjutamine",
      heading: "Nutika harjutamise abilised",
      blocks: [
        {
          p: "Lisaks juhendatud harjutamisele lisab Nutikas harjutamine leebeid abilisi: kitsaskohaharjutuse, mis jahib su kõige aeglasemaid klahvipaare, hajutatud kordamise, oskuste kustumise vastased värskendused, mis naasevad roostetanud klahvide juurde, nutika enesekindluse ja klahvide taastamise. Kõik on vaikimisi sisse lülitatud.",
        },
        { lab: "Lülita abiline sisse või välja" },
        {
          steps: [
            "Ava Seaded.",
            "Mine jaotisse Nutikas harjutamine.",
            "Lülita ükskõik millist abilist — või jäta kõik sisse.",
          ],
        },
      ],
    },
    {
      id: "keyboard",
      nav: "Klaviatuuri seadistus",
      heading: "Klaviatuuri seadistamine",
      blocks: [
        {
          p: "Seadete jaotises Klaviatuuri seadistus sobitad KeyLearni oma klaviatuuri ja selle paigutusega, mida soovid õppida.",
        },
        { lab: "Muuda klaviatuuripaigutust" },
        {
          steps: [
            "Ava Seaded.",
            "Mine jaotisse Klaviatuuri seadistus.",
            "Vali oma keel ja seejärel paigutus (QWERTY, Dvorak, Colemak ja teised).",
            "Jäta „Simuleeri seda paigutust“ sisse, et saaksid seda harjutada olenemata sellest, mis on arvutis seadistatud.",
            "Kinnitamiseks vaata reaalajas eelvaadet.",
          ],
        },
        {
          p: "Samal ekraanil saad valida klaviatuuri kuju, värvida klahvid sõrmetsoonide järgi ja tõsta esile järgmise klahvi, kuni alles õpid, kus mis asub.",
        },
        {
          p: "Klaviatuuri *viimistlus* — klahvide välimus — käib kontoga kaasas. Sisse logituna on valida viie vahel ja ümar klaviatuur on saadaval kuues värvis; üks neist järgib sinu teema värvi. Kõik eelnev on sinu igal juhul: keelt, paigutust, kuju ja sõrmetsoone ei hoita kunagi kinni, sest just need panevad rakenduse sobima sinu ees oleva klaviatuuriga.",
        },
      ],
    },
    {
      id: "display",
      nav: "Kuvamine",
      heading: "Kuvamine ja tunnetus",
      blocks: [
        {
          p: "Seaded Kuvamine ja Tekstisisestus lasevad näidata kiirust sõnades või märkides minutis ja peenhäälestada seda, kuidas kirjutamine tundub. Taasta vaikeseaded on alati ühe klõpsu kaugusel, kui soovid puhtalt lehelt alustada.",
        },
        {
          p: "Kogu saidi välimus asub jaotises Konto, Välimus: hele, tume või süsteemi järgi, teemavärv ja teksti suurus, mis kehtib igal lehel. Iga pereliige hoiab oma seadeid ja need liiguvad temaga kaasa — vaata *Oma andmete eest hoolitsemine*.",
        },
      ],
    },
    {
      id: "progress",
      nav: "Sinu edenemine",
      heading: "Sinu edenemine — profiilileht",
      blocks: [
        {
          p: "Profiilileht on sinu täielik kroonika: üleval kogu aja ja tänase päeva statistika (harjutatud aeg, tehtud õppetunnid, sinu parim ja tavapärane kiirus ja täpsus ning see, kuidas tänane päev nendega võrreldes on); kaart kõigist tähtedest, mille oled avanud; lugu sellest, kuidas iga üksik klahv on kiiremaks muutunud, koos silumisliuguriga; suur pilt kõigist klahvidest ajas; ja kõige aeglasemad üleminekud, mis sind ikka veel tagasi hoiavad. Võid isegi võistelda oma eelmise katsega nagu vaimuga, et edenemist vahetult tunda.",
        },
        { lab: "Ava oma edenemine" },
        {
          steps: [
            "Ava menüü.",
            "Vali Profiil.",
          ],
        },
      ],
    },
    {
      id: "data",
      nav: "Sinu andmed",
      heading: "Oma andmete eest hoolitsemine",
      blocks: [
        { lab: "Kustuta profiili statistika" },
        {
          steps: [
            "Ava selle õppija Profiil, keda soovid lähtestada.",
            "Keri lehe allossa lähtestamisnupu juurde.",
            "Kinnita „Kustuta kõik“ — kustutatakse ainult see profiil.",
          ],
        },
        { lab: "Laadi oma andmed alla" },
        {
          steps: [
            "Ava Profiil.",
            "Kasuta allalaadimisvalikut, et salvestada oma ajalugu failina.",
          ],
        },
        {
          p: "Logi sisse, kui soovid, et sinu ajalugu sünkroonitaks seadmete vahel, ja jagada avalikku profiililinki. Reklaamivõrgustikke ega jälgijaid ei ole ning saad oma andmed — või kogu konto — kustutada millal iganes soovid.",
        },
        {
          p: "Sisselogimine hoiab nüüd alles rohkemat kui sinu tulemused. Sinu seaded, teema ja teksti suurus, tehtud ligipääsetavuse valikud ja iga õppija enda eelistused järgivad profiili, mitte brauserit — nii jätkab õppija, kes avab KeyLearni uues arvutis, sealt, kus pooleli jäi, samal ekraanil ja samamoodi seadistatuna, selle asemel et alustada uuesti vaikeseadetest.",
        },
      ],
    },
    {
      id: "kids",
      nav: "Lasterežiim",
      heading: "Lasterežiim",
      blocks: [
        {
          p: "Lapsed harjutavad mängulisel rajal. Iga õige klahv viib nende tegelase sammu võrra kodule lähemale ja tegelane kasvab pisikesest beebist täiskasvanud kangelaseks, kui rohkem tähti avaneb. Äsja õpitud klahv käivitab väikese peo ja iga harjutuskord lõpeb hubase lõkke ääres.",
        },
        { lab: "Lülitu Lasterežiimi" },
        {
          steps: [
            "Ava menüü.",
            "Vali Lapsed — või vali jaotises Õppijad lapse profiil.",
          ],
        },
        {
          p: "Valida on kahe maailma vahel — Dino Run sõbraliku dinosaurusega ja Hero Trail, kus rüütel rändab läbi metsa — ja mõlemas saab valida oma tegelase.",
        },
      ],
    },
    {
      id: "toybox",
      nav: "Laste mängukast",
      heading: "Laste mängukast",
      blocks: [
        { lab: "Ava mängukast" },
        {
          steps: [
            "Puuduta lasteekraanil mänguala ülaosas olevat hammasratast.",
          ],
        },
        {
          p: "Sealt saad määrata maailma ja tegelase, Suured tähed, Helid, Abikäed (helendav sõrmejuhis), Klaviatuuri (peidetud, lihtne või täielik täiskasvanute oma), Tähed rajal (sõnad, mida näidatakse plokkidena otse mängus), harjutuskorra Taimeri, Hõisked (julgustavad väikesed sõnumid) ja — peidus jaotises Täpsemalt — liugurid Heleduse, Värvi ja selle jaoks, kui elav maailm tundub. Peale ereda päevavaate on olemas ka rahulik öövaade.",
        },
        {
          p: "*Key style* muudab, kuidas klahvid on värvitud, ja klahvid ise ei liigu: *Crayon* on valge klahv, mille ümber on tema sõrme värv, ja *Rainbow* on põhivärvides õppeklaviatuur — roheline raam, punased numbrid, sinised tähed, täishäälikud eraldi —, kus raami klahvid on sõnade asemel nooled, lapsele, kes ei oska veel lugeda sõna „enter”. Kõik alustavad valikuga Crayon. Selle kõrval olev *Finger colours* lülitab toonimise täiesti välja lapsele, kes seda enam ei vaja.",
        },
      ],
    },
    {
      id: "ages",
      nav: "Suureks kasvamine",
      heading: "Kasvamine koos su lapsega",
      blocks: [
        {
          p: "KeyLearn häälestab end vaikselt lapse vanuse järgi. Kõige nooremad näevad suuri ja sõbralikke tähti, andestavat tempot, tähtede plokke otse rajal ja kõige leebemat abi; vanemad lapsed liiguvad edasi pikemate sõnade, täieliku klaviatuuri ja puhtama välimuse juurde. Määra lihtsalt profiilil sünniaasta ja ülejäänu järgneb ise.",
        },
      ],
    },
    {
      id: "modes",
      nav: "Muud režiimid",
      heading: "Muud viisid harjutamiseks",
      blocks: [
        {
          p: "Peale igapäevase harjutamise on olemas *Kiirustest* — kiire ühekordne lõik, mis näitab su sõnu minutis ja täpsust ilma ühegi õppetunnita; *Paigutuste* uurija klaviatuuripaigutuste ja nende sõrmekaartide võrdlemiseks; *Edetabelid*, et näha, kuidas sa teistega võrreldes hakkama saad; ja *Mitmikmängu* võidusõidud, et mõõta oma kiirust teistega reaalajas.",
        },
        { lab: "Kust need leiab" },
        {
          steps: [
            "Ava menüü.",
            "Vali Kiirustest, Paigutused, Edetabelid või Mitmikmäng.",
          ],
        },
      ],
    },
    {
      id: "access",
      nav: "Kui miski jääb ette",
      heading: "Kui miski rakenduse juures jääb sulle ette",
      blocks: [
        {
          p: "Selle jaoks on terve leht ja see seatakse *iga õppija jaoks eraldi* — nii et ühe inimese kohandused ei muuda kunagi kellegi teise omi.",
        },
        { lab: "Ava see" },
        {
          steps: [
            "Ava menüü ja vali Konto.",
            "Vali Ligipääsetavus.",
            "Vali üleval õppija ja lülita sisse nii palju seadeid, kui vajad.",
          ],
        },
        {
          p: "Need viis seadet *toimivad koos*. Düslektikul, kellel on ka värin, on neist vaja kahte, ja valima sundimine tähendaks, et rakendus küsib, millise raskusega arvestada.",
        },
        {
          tips: [
            "Rahulik — miski ei liigu, midagi ei loeta, midagi ei mõõdeta ajaga ja vahelejäänud päev ei katkesta seeriat.",
            "Vähem korraga — harjutus avaneb ainult sõnade ja klaviatuuriga.",
            "Kergem lugeda — düsleksia jaoks loodud kirjatüüp, rohkem ruumi tähtede ja ridade vahel, tugevam tekst.",
            "Värvid lahus — sõrmevärvid, mis jäävad värvipimeduse korral eristatavaks, ja vigadest antakse teada nii heliga kui ka punasega.",
            "Kindlam käsi — suuremad asjad, mida vajutada, ei mingit kahte klahvi korraga, ja iseennast kordavat klahvi ei loeta kaks korda.",
          ],
        },
        {
          p: "Nende all avab *Sean kõik ise* iga lüliti eraldi — neid on viisteist, sealhulgas kõne kiirus, subtiitrid kõigele, mis öeldakse valjusti, sõrme number igal klahvil ja see, kui kaua korduvat klahvi eirata. Üks nupp paneb kõik jälle paika.",
        },
      ],
    },
    {
      id: "braille",
      nav: "Punktkiri",
      heading: "Õppimine punktkirjaklaviatuuril",
      blocks: [
        {
          p: "Pime või vaegnägija õppija saab hoopis teistsuguse lehe — kuue klahviga punktkirjasisestuse, õppekava tähtede asemel punktkirjamärkides ja kõnelise juhendamise algusest lõpuni. See on omaette viis kirjutamist õppida, mitte nägija leht valjusti ette loetud.",
        },
        { lab: "Lülita see õppija jaoks sisse" },
        {
          steps: [
            "Ava menüü ja vali Konto, seejärel Õppijad.",
            "Muuda õppijat või lisa uus.",
            "Lülita sisse nägemistugi ja salvesta.",
          ],
        },
        {
          p: "See õppija läheb nüüd otse punktkirjalehele alati, kui tema on see, kes harjutab. Tema edenemist loetakse tähtede asemel punktkirjamärkides ja ta saab teenida tunnistuse samadel tingimustel kui igaüks teine.",
        },
      ],
    },
    {
      id: "courses",
      nav: "Kaks kursust",
      heading: "Juhendatud harjutamine, Klassikaline kursus ja kood",
      blocks: [
        {
          p: "*Juhendatud harjutamine* on kohanduv kursus: see jälgib, millised klahvid sind aeglustavad, ja ehitab su õppetunnid nende ümber, lisades uue tähe alles siis, kui suudad olemasolevaid kirjutada nii kiiresti kui ka täpselt.",
        },
        {
          p: "*Klassikaline kursus* on vanamoodne — kindel õppetundide redel kindlas järjekorras, täpselt nii, nagu kirjutamisõpik seda õpetaks. Mõnele lihtsalt meeldib teada, mis järgmisena tuleb.",
        },
        {
          p: "Need on eraldi kursused eraldi ajalooga ja tunnistus teenitakse ühel või teisel — mitte kunagi mõlemal kokku liidetuna, mis loeks su esimest nädalat kaks korda. Sinu konto Kursuse leht ütleb, kumma kohta ta aru annab.",
        },
        {
          p: "*Koodimeisterdamine* on kolmandat sorti harjutamine: päris koodijupid sinu valitud keeles, nii et sulud, semikoolonid ja taanded saavad selle harjutamise, mida tavaline proosa neile kunagi ei anna.",
        },
        { lab: "Vaheta nende vahel" },
        {
          steps: [
            "Ava harjutusekraanil õppetunni seaded.",
            "Vali Juhendatud harjutamine, Klassikaline kursus või Koodimeisterdamine.",
          ],
        },
      ],
    },
    {
      id: "certificates",
      nav: "Tunnistused",
      heading: "Tunnistuse teenimine",
      blocks: [
        {
          p: "Tunnistus ütleb, et nimeline õppija kirjutas mõõdetud kiiruse ja täpsusega, kindlas keeles ja kindlal kuupäeval. Selle väljastame meie — see ei ole kvalifikatsioon, mille tunnustamises oleks kokku leppinud mõni eksamikomisjon või tööandja — ja see on aus tõend selle kohta, mida keegi tegelikult tegi.",
        },
        { lab: "Vaata, kui kaugel sa oled" },
        {
          steps: [
            "Ava menüü ja vali Konto.",
            "Vali Kursus.",
            "Igal õppijal on rida, kus on näha kõik tingimused ja see, kui kaugele ta on jõudnud.",
          ],
        },
        {
          p: "Tingimused on näiteks need: kõik tähed tutvustatud, kõik tähed usaldusväärsed, mitte lihtsalt korra kohatud, piisavalt õppetunde, piisavalt eri päevi ning püsiv kiirus ja täpsus. Kui kõik on täidetud, ilmub sellele reale link hindamisele minekuks.",
        },
        {
          p: "Hindamine on lühike ja seda hinnatakse meie serverites, mitte sinu brauseris. Läbi see ja tunnistus antakse välja koos numbriga. Igaüks, kellele selle numbri annad, saab seda kontrollida lehel *Kontrolli tunnistust* — ja sina valid, kas su nime talle näidatakse.",
        },
      ],
    },
    {
      id: "security",
      nav: "Konto turvalisena hoidmine",
      heading: "Pääsuvõtmed, koodid ja see, kes on sisse loginud",
      blocks: [
        {
          p: "Sisse saad logida parooliga, teenusepakkujaga nagu Google, e-postiga saadetud lingiga — või *pääsuvõtmega*, mille meie ise valiksime. Pääsuvõti kasutab su seadme enda sõrmejälge, nägu või PIN-koodi; lekkida pole ühtki parooli ja miski, mida meie hoiame, ei võimaldaks sinuna sisse logida.",
        },
        { lab: "Lisa pääsuvõti" },
        {
          steps: [
            "Ava menüü ja vali Konto, seejärel Turvalisus.",
            "Vali Lisa pääsuvõti ja järgi oma seadme juhiseid.",
          ],
        },
        {
          p: "Olemas on ka *kaheastmeline kinnitamine*, mis kasutab autentimisrakendust, ja taastekoodid juhuks, kui telefon kaob. Prindi need välja kuhugi mujale kui telefoni.",
        },
        {
          p: "Sama leht loetleb hiljutise tegevuse — sisselogimised, ebaõnnestunud sisselogimised, lisatud pääsuvõti, muudetud parool — igaüks koos ligikaudse asukohaga, kust see tuli, nii et midagi, mida sina ei teinud, torkab kohe silma. Kui midagi tundub vale, lõpetab *logi kõikjalt välja* kõik seansid peale selle, mida praegu kasutad.",
        },
        {
          p: "Olemas on ka *vanema PIN-kood*, mis lukustab konto seaded, et pereseadmes olev laps ei saaks neid muuta ega profiili kustutada.",
        },
      ],
    },
    {
      id: "yours",
      nav: "Tee see enda omaks",
      heading: "Tee see enda omaks",
      blocks: [
        { lab: "Muuda teemat" },
        {
          steps: [
            "Ava menüü ja vali Konto, seejärel Välimus.",
            "Vali hele, tume või seadme järgi.",
          ],
        },
        {
          p: "Kui ükski kaasas olev teema pole see õige, laseb *teemakujundaja* sul enda oma kokku segada — sealhulgas sõrmevärvid, millega klaviatuur õpetab. Rakendus mõõdab valitud värvide kontrasti ja keeldub kombinatsioonidest, mida keegi lugeda ei suudaks.",
        },
        {
          p: "Igal pere õppijal võib olla oma värv, nii et ühine seade tundub ikkagi selle oma, kes parasjagu selle taga istub.",
        },
        { lab: "Muuda saidi keelt" },
        {
          steps: ["Ava menüü.", "Vali jaotises Saidi keel oma keel."],
        },
        {
          p: "Harjutusekraanil saad ka igal ajal teksti suurust muuta ja helid sisse või välja lülitada.",
        },
      ],
    },
    {
      id: "privacy",
      nav: "Privaatsus",
      heading: "Privaatsus ühe lausega",
      blocks: [
        {
          p: "Ei mingeid reklaamivõrgustikke ega jälgijaid. Lapse profiil ei lahku kunagi sinu brauserist. Logi sisse ainult siis, kui soovid sünkroonimist või jagamist; muidu jääb kõik sellesse seadmesse ja võid selle igal ajal kustutada.",
        },
        {
          p: "Mõnel lehel võid näha *sponsoreeritud rida*. See on rida, mille oleme ise müünud ja ise näitame — siin pole ühtki reklaamivõrgustikku ja miski ei jälgi sind väljaspool saiti. Selle valib leht, millel oled, mitte miski, mida me sinu kohta teame, ning seda ei näidata kunagi lapsele, lastemaailmas, koolikontol ega tunni ajal. Puuduta ükskõik millise juures *Miks ma seda näen?*, et näha sama selgitust kohapeal, ja need, kes on projekti toetanud, ei näe seda kunagi.",
        },
      ],
    },
    {
      id: "support",
      nav: "Abi saamine",
      heading: "Abi saamine",
      blocks: [
        {
          p: "Iga sõnum, mille meile saadad, muutub *vestluseks, mille juurde saad tagasi tulla*, mitte kaduvaks e-kirjaks. See asub jaotises Konto ja sellel on oma viitenumber — see, mida nimetada, kui kunagi uuesti helistad või kirjutad.",
        },
        { lab: "Küsi abi" },
        {
          steps: [
            "Ava menüü ja vali Konto, seejärel Tugi.",
            "Vali Registreeri pilet ja kirjuta, mis toimub.",
            "Lisa kuvatõmmis, kui see aitab — PNG, JPG või PDF, igaüks kuni 10 MB.",
          ],
        },
        {
          p: "Vastused ilmuvad sellesse vestlusesse ja päises olev kelluke süttib, kui mõni saabub, nii et sa ei pea lehte valvama. Kõik juba lahendatu koondub jaotisesse Lahendatud, mis on alguses suletud — see, mida sa veel ootad, on see, mida näed.",
        },
        { lab: "Kes vastab" },
        {
          p: "Esimesena loeb selle assistent nimega Tab ja vastab sellele, mida oskab. Ta ütleb sulle, et on tehisintellekt — ta ei teeskle kunagi muud — ja ütleb otse, kui ta midagi ei tea.",
        },
        {
          p: "Inimene võtab üle alati, kui see on parem vastus: kõik, mis puudutab raha, sinu andmeid või turvalisust, või lihtsalt siis, kui sa seda palusid. Sa ei pea kunagi kaks korda küsima ega end kordama — kes iganes selle üle võtab, näeb juba kõike, mida oled öelnud.",
        },
        {
          p: "Kui mõni sõnum näib tõelise hädaolukorrana, on vastus alati sama ja tuleb kindlast tekstist, mitte assistendilt: sinu asukoha hädaabinumber ja meie poolel kohe teavitatud inimene. Me ei saa seda kõnet sinu eest teha ja ütleme seda ka.",
        },
        { lab: "Korrastamine" },
        {
          p: "Saad vestluse oma loendist igal ajal eemaldada selle kõrval oleva prügikasti ikooniga. Väike märge valiku *Registreeri pilet* juures loeb, mitu oled eemaldanud, nii et kadunud vestlus pole kunagi mõistatus.",
        },
        {
          p: "Jagatud pereseadmes küsib tugijaotis enne avanemist täiskasvanu PIN-koodi — tugivestlused on konto asi ja see, kes harjutab, pole alati see, kes konto lõi.",
        },
      ],
    },
    {
      id: "signout",
      nav: "Välja logimine",
      heading: "Välja logimine",
      blocks: [
        { lab: "Logi välja" },
        { steps: ["Ava menüü.", "Vali Logi välja ja kinnita."] },
        {
          p: "Sinu harjutamisajalugu jääb turvaliselt sellesse seadmesse — ja su kontole, kui sa selle tegid — valmis järgmiseks korraks, kui kirjutama istud.",
        },
      ],
    },
    {
      id: "tips",
      nav: "Näpunäited",
      heading: "Mõned harjumused, mis tõesti aitavad",
      blocks: [
        {
          tips: [
            "Täpsus enne kiirust — puhas kirjutamine on see, mis külge jääb.",
            "Paranda vead rahulikult; ära kihuta järelejõudmiseks.",
            "Puhka sõrmi kodureal — F-il ja J-l on väikesed muhud.",
            "Paar minutit iga päev on parem kui tund korra nädalas.",
          ],
        },
      ],
    },
  ],
};
