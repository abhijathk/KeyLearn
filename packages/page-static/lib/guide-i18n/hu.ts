import { type GuideTranslation } from "../guide-content.tsx";

export const hu: GuideTranslation = {
  kicker: "Minden, amit megtehetsz",
  title: "Felhasználói kézikönyv",
  dateline:
    "A teljes KeyLearn-útmutató — az első látogatástól a kijelentkezésig",
  navLabel: "Ezen az oldalon",
  sections: [
    {
      id: "account",
      nav: "Szükségem van fiókra?",
      heading: "Szükségem van fiókra?",
      blocks: [
        {
          p: "Nem. Már az érkezés pillanatában elkezdhetsz gépelni, és a haladásod itt, ezen az eszközön tárolódik. Csak akkor hozz létre ingyenes fiókot, ha azt szeretnéd, hogy az előzményeid más eszközökre is elkísérjenek, ha biztonsági másolatot tartanál, vagy ha megosztanál egy profillinket. Semmi hasznos nincs a bejelentkezés mögé zárva.",
        },
      ],
    },
    {
      id: "signin",
      nav: "Bejelentkezés és jelszavak",
      heading: "Regisztráció, bejelentkezés és jelszavak",
      blocks: [
        { p: "Minden a jobb felső sarokban lévő menüben található." },
        { lab: "Fiók létrehozása" },
        {
          steps: [
            "Nyisd meg a menüt (jobb felül).",
            "Válaszd a Regisztráció lehetőséget.",
            "Add meg az e-mail-címed és egy jelszót.",
            "Erősítsd meg — és már bent is vagy.",
          ],
        },
        { lab: "Bejelentkezés" },
        {
          steps: [
            "Nyisd meg a menüt, és válaszd a Bejelentkezés lehetőséget.",
            "Add meg az e-mail-címed és a jelszavad.",
          ],
        },
        { lab: "Elfelejtett jelszó visszaállítása" },
        {
          steps: [
            "A Bejelentkezés képernyőn válaszd az Elfelejtett jelszó lehetőséget.",
            "Add meg az e-mail-címed.",
            "Nyisd meg a küldött visszaállítási linket.",
            "Válassz új jelszót, és jelentkezz be.",
          ],
        },
      ],
    },
    {
      id: "profiles",
      nav: "Profilok",
      heading: "Profilok az egész családnak",
      blocks: [
        {
          p: "A KeyLearn úgy épül fel, mint egy háztartás: egy fiókban akár négy profil is elfér (nyolc a prémium változatban), felnőttek és gyerekek tetszőleges keverékben. Minden profil a *saját*, külön haladását őrzi ezen az eszközön — semmi sem keveredik össze.",
        },
        { lab: "Profil hozzáadása" },
        {
          steps: [
            "Nyisd meg a menüt, és válaszd a Fiók lehetőséget (vagy a „Profilok beállítása” pontot).",
            "Válaszd a Profil hozzáadása lehetőséget.",
            "Írj be egy keresztnevet.",
            "Jelöld meg Felnőttként vagy Gyerekként.",
            "Válassz avatárt — egy barátságos ikont vagy egy Fényképet az eszközödről.",
            "Gyereknél add meg a születési évet is (ez csak a szavakat és a tempót hangolja a korához).",
            "Mentsd el.",
          ],
        },
        { lab: "Váltás másik tanulóra" },
        {
          steps: [
            "Nyisd meg a menüt.",
            "Koppints egy arcra a Tanulók alatt — az alkalmazás onnan folytatja, ahol abbahagyta.",
          ],
        },
        { lab: "Profil szerkesztése vagy törlése" },
        {
          steps: [
            "Nyisd meg a menüt, és válaszd a Fiók lehetőséget.",
            "Válaszd a Szerkesztés lehetőséget egy profilnál, vagy töröld, hogy felszabadíts egy helyet.",
          ],
        },
        {
          p: "A gyerekprofilok egyszerűsített, lezárt menüt kapnak, a felnőtteknek szóló műveletek pedig egy gyors „mennyi A-szor B?” számolási kapu mögött vannak, hogy a kicsik ne tévedjenek be a beállításokba.",
        },
      ],
    },
    {
      id: "screen",
      nav: "A gyakorlóképernyő",
      heading: "A gyakorlóképernyő",
      blocks: [
        {
          p: "Csak kezdj el gépelni. A keresett szó közvetlenül a képernyő-billentyűzet felett lebeg; egy ragyogó üstökös mutat a soron következő billentyűre; a billentyűk ujjzónák szerint vannak színezve, hogy megtanuld, melyik ujj hová ér el; egy halvány, pihenő kézpár pedig megmutatja, hol laknak az ujjaid a leütések között. Az egész tudás egyetlen szokáson múlik: a szavakat nézd, ne a kezed.",
        },
      ],
    },
    {
      id: "journey",
      nav: "Az utad",
      heading: "Hogyan nőnek a leckék — az utad",
      blocks: [
        {
          p: "A KeyLearn *alkalmazkodik*. Megméri, milyen gyorsan és tisztán találod el az egyes billentyűket, és csak akkor vesz fel új betűt a készletedbe, ha a mostaniakat gyorsan és pontosan is le tudod gépelni. Ez a növekvő készlet a te utad, egy maroknyi betűtől az egész ábécéig — a nehézség pontosan olyan gyorsan emelkedik, ahogy te fejlődsz, sosem gyorsabban, így mindig a saját határodon dolgozol.",
        },
      ],
    },
    {
      id: "readout",
      nav: "Élő statisztika",
      heading: "Az élő kijelző",
      blocks: [
        {
          p: "Gépelés közben a lebegő panel mutatja az aktuális sebességed és pontosságod, egy kis grafikont a legutóbbi körökről, a céljaid állását és a sorozatod. Azért van ott, hogy bátorítson, nem azért, hogy nyaggasson.",
        },
      ],
    },
    {
      id: "tools",
      nav: "Gyakorlóeszközök",
      heading: "Gyakorlóeszközök",
      blocks: [
        {
          p: "A szöveg melletti apró eszközökkel megnyithatsz egy vezetett bemutatót, újraindíthatod az aktuális leckét (Ctrl + Balra), átugorhatsz a következőre (Ctrl + Jobbra), megjelenítheted vagy elrejtheted a képernyő-billentyűzetet, és átméretezheted a gyakorlószöveget. A fogaskerék a teljes Beállításokat nyitja meg, amelyekről mindjárt szó lesz.",
        },
      ],
    },
    {
      id: "content",
      nav: "Amit gépelsz",
      heading: "Válaszd ki, mit gépelsz",
      blocks: [
        {
          p: "Nyisd meg a Beállításokat, és lépj a Gyakorlás tartalma pontra, hogy kiválaszd, miből állnak össze a szavaid:",
        },
        {
          tips: [
            "*Vezetett gyakorlás* — az alkalmazkodó alapbeállítás, amely billentyűről billentyűre bővíti az ábécédet.",
            "*Klasszikus tanfolyam* — kötött, sorrendbe szedett menetelés a billentyűkön át.",
            "*Gyakori szavak* — a nyelved leggyakoribb szavai.",
            "*Könyvszöveg* — gépeld végig magad az alkalmazásba épített igazi könyveken.",
            "*Saját szöveg* — illessz be bármit, ami tetszik, és gyakorolj rajta.",
            "*Kódrészletek* — zárójelek, jelek és a kód ritmusa.",
            "*Számgyakorlatok* — a számsor és a numerikus billentyűzet.",
          ],
        },
        { lab: "Változtasd meg, mit gépelsz" },
        {
          steps: [
            "Nyisd meg a Beállításokat (a fogaskerék a gyakorlószöveg mellett).",
            "Lépj a Gyakorlás tartalma pontra.",
            "Válassz módot — Könyvszövegnél válassz könyvet, Saját szövegnél illeszd be a szavaidat.",
            "Zárd be a Beállításokat, és gépelj tovább.",
          ],
        },
        {
          p: "Ugyanezen a képernyőn állíthatod be az ábécéd méretét, a célsebességet, az egyes leckék hosszát és a napi célt.",
        },
      ],
    },
    {
      id: "smart",
      nav: "Okos gyakorlás",
      heading: "Az Okos gyakorlás segítői",
      blocks: [
        {
          p: "A vezetett gyakorlás mellé az Okos gyakorlás szelíd segítőket ad: szűk keresztmetszet elleni gyakorlatot, amely felkutatja a leglassabb billentyűpárjaidat, szakaszos ismétlést, a megkopó tudást felfrissítő gyakorlatokat, amelyek visszatérnek a berozsdásodott billentyűkhöz, okos magabiztosságot és billentyű-helyreállítást. Alapból mind be van kapcsolva.",
        },
        { lab: "Segítő be- vagy kikapcsolása" },
        {
          steps: [
            "Nyisd meg a Beállításokat.",
            "Lépj az Okos gyakorlás pontra.",
            "Kapcsold be vagy ki bármelyik segítőt — vagy hagyd mindet bekapcsolva.",
          ],
        },
      ],
    },
    {
      id: "keyboard",
      nav: "Billentyűzet beállítása",
      heading: "A billentyűzeted beállítása",
      blocks: [
        {
          p: "A Beállítások Billentyűzet beállítása pontjában hangolod össze a KeyLearnt a billentyűzeteddel és azzal a kiosztással, amelyet meg szeretnél tanulni.",
        },
        { lab: "Billentyűzetkiosztás módosítása" },
        {
          steps: [
            "Nyisd meg a Beállításokat.",
            "Lépj a Billentyűzet beállítása pontra.",
            "Válaszd ki a nyelved, majd a kiosztásod (QWERTY, Dvorak, Colemak és még sok más).",
            "Hagyd bekapcsolva a „Kiosztás szimulálása” lehetőséget, hogy attól függetlenül gyakorolhasd, hogyan van beállítva a géped.",
            "Az élő előnézeten ellenőrizd.",
          ],
        },
        {
          p: "Ugyanezen a képernyőn kiválaszthatod a billentyűzet formáját, ujjzónák szerint színezheted a billentyűket, és kiemelheted a következő billentyűt, amíg még tanulod, hol mi található.",
        },
      ],
    },
    {
      id: "display",
      nav: "Megjelenítés",
      heading: "Megjelenítés és érzet",
      blocks: [
        {
          p: "A Megjelenítés és a Szövegbevitel beállításaival percenkénti szóban vagy karakterben mutathatod a sebességed, és finomhangolhatod, milyen érzés a gépelés. Az Alapértelmezések visszaállítása mindig egy kattintásnyira van, ha tiszta lappal indulnál.",
        },
      ],
    },
    {
      id: "progress",
      nav: "A haladásod",
      heading: "A haladásod — a Profil oldal",
      blocks: [
        {
          p: "A Profil oldal a teljes krónikád: felül az Összesített és a Mai statisztikák (gyakorlással töltött idő, elvégzett leckék, a legjobb és a szokásos sebességed és pontosságod, valamint hogy a mai nap hogyan viszonyul ezekhez); térkép az összes betűről, amit már feloldottál; annak története, hogyan gyorsult fel az egyes billentyűk használata, simító csúszkával; a nagy kép minden billentyűről az idő során; és a leglassabb átmenetek, amelyek még visszafognak. Akár a saját előző köröddel is versenyezhetsz szellemként, hogy közvetlenül érezd a fejlődést.",
        },
        { lab: "Nyisd meg a haladásod" },
        {
          steps: [
            "Nyisd meg a menüt.",
            "Válaszd a Profil lehetőséget.",
            "A szűrősorral szűkíthetsz Betűkre, Számjegyekre, Írásjelekre vagy Jelekre.",
          ],
        },
      ],
    },
    {
      id: "data",
      nav: "Az adataid",
      heading: "Vigyázz az adataidra",
      blocks: [
        { lab: "Egy profil statisztikáinak törlése" },
        {
          steps: [
            "Nyisd meg a Profilt annál a tanulónál, akit alaphelyzetbe állítanál.",
            "Görgess az oldal alján lévő visszaállító vezérlőhöz.",
            "Erősítsd meg a „Minden törlése” lehetőséget — csak ez az egy profil ürül ki.",
          ],
        },
        { lab: "Az adataid letöltése" },
        {
          steps: [
            "Nyisd meg a Profilt.",
            "A letöltés lehetőséggel mentsd fájlba az előzményeidet.",
          ],
        },
        {
          p: "Jelentkezz be, ha azt szeretnéd, hogy az előzményeid eszközök között szinkronizálódjanak, és hogy megoszthass egy nyilvános profillinket. Nincsenek hirdetések és nyomkövetők, az adataidat — vagy a teljes fiókodat — pedig bármikor törölheted.",
        },
      ],
    },
    {
      id: "kids",
      nav: "Gyerekmód",
      heading: "Gyerekmód",
      blocks: [
        {
          p: "A gyerekek egy játékos ösvényen gyakorolnak. Minden helyes billentyű egy lépéssel közelebb viszi a figurájukat az otthonához, a figura pedig apró babából teljesen felnőtt hőssé cseperedik, ahogy egyre több betű oldódik fel. Egy frissen megtanult billentyű kis ünneplést indít, és minden alkalom egy hangulatos tábortűznél ér véget.",
        },
        { lab: "Váltás Gyerekmódra" },
        {
          steps: [
            "Nyisd meg a menüt.",
            "Válaszd a Gyerekek lehetőséget — vagy válassz egy gyerekprofilt a Tanulók alatt.",
          ],
        },
        {
          p: "Két világ közül választhatsz — a Dino Run egy barátságos dinoszaurusszal, és a Hero Trail, ahol egy lovag kalandozik az erdőn át —, mindkettőben választható figurával.",
        },
      ],
    },
    {
      id: "toybox",
      nav: "Gyerek játékdoboz",
      heading: "A gyerek játékdoboz",
      blocks: [
        { lab: "A játékdoboz megnyitása" },
        {
          steps: [
            "A gyerekképernyőn koppints a játéktér tetején lévő fogaskerékre.",
          ],
        },
        {
          p: "Belül beállíthatod a világot és a figurát, a Nagy betűket, a Hangokat, a Segítő kezeket (a világító ujjmutatót), a Billentyűzetet (rejtett, egyszerű vagy a teljes felnőtt billentyűzet), a Betűket az ösvényen (a szavak kockákként, egyenesen a játékban), az alkalom Időzítőjét, a Biztatásokat (bátorító kis üzenetek), és — a Speciális rész alá rejtve — csúszkákat a Fényerőhöz, a Színhez és ahhoz, mennyire élénk a világ. Van egy nyugodt éjszakai megjelenés is a világos nappali mellett.",
        },
      ],
    },
    {
      id: "ages",
      nav: "Együtt nőni",
      heading: "Együtt nőni a gyerekeddel",
      blocks: [
        {
          p: "A KeyLearn csendben a gyerek korához hangolja magát. A legkisebbek nagy, barátságos betűket, elnéző tempót, betűkockákat egyenesen az ösvényen és a leggyengédebb segítséget kapják; a nagyobbak hosszabb szavakra, a teljes billentyűzetre és letisztultabb megjelenésre lépnek tovább. Csak add meg a születési évet a profilban, a többi magától jön.",
        },
      ],
    },
    {
      id: "modes",
      nav: "Más módok",
      heading: "További gyakorlási módok",
      blocks: [
        {
          p: "A napi gyakorláson túl van *Sebességteszt* — egy gyors, egyszeri szövegrészlet, amely lecke nélkül mondja meg a percenkénti szavaid számát és a pontosságod; egy *Kiosztások* böngésző a billentyűzetkiosztások és ujjtérképeik összehasonlítására; *Toplista*, hogy lásd, hol tartasz a többiekhez képest; és *Többjátékos* versenyek, ahol valós időben mérheted össze a sebességed másokkal.",
        },
        { lab: "Hol találod ezeket" },
        {
          steps: [
            "Nyisd meg a menüt.",
            "Válaszd a Sebességteszt, Kiosztások, Toplista vagy Többjátékos lehetőséget.",
          ],
        },
      ],
    },
    {
      id: "access",
      nav: "Ha valami útban van",
      heading: "Ha valami az alkalmazásban az utadban van",
      blocks: [
        {
          p: "Erre külön oldal van, és *tanulónként* állítható — így az egyik ember beállításai soha nem változtatnak meg senki másét.",
        },
        { lab: "Nyisd meg" },
        {
          steps: [
            "Nyisd meg a menüt, és válaszd a Fiók lehetőséget.",
            "Válaszd az Akadálymentesítés pontot.",
            "Válaszd ki felül a tanulót, majd kapcsolj be annyi beállítást, amennyire szükséged van.",
          ],
        },
        {
          p: "Az öt beállítás *együtt is működik*. Egy diszlexiás embernek, akinek remeg a keze, kettőre van szüksége, és ha választani kényszerítenénk, azzal az alkalmazás azt kérdezné, melyik nehézséget hajlandó figyelembe venni.",
        },
        {
          tips: [
            "Nyugodt — semmi nem mozog, semmit nem számolunk, semmit nem mérünk órával, és egy kihagyott nap nem szakítja meg a sorozatot.",
            "Kevesebb egyszerre — a gyakorlás csak a szavakkal és a billentyűzettel indul.",
            "Könnyebben olvasható — a diszlexiához tervezett betűtípus, több hely a betűk és a sorok között, erősebb szöveg.",
            "Színek szétválasztva — ujjszínek, amelyek színvakság mellett is elkülönülnek, és a hibák a piros mellett hangban is megjelennek.",
            "Biztosabb kéz — nagyobb megnyomható elemek, nincs két billentyű egyszerre, és az önmagát ismétlő billentyű nem számít kétszer.",
          ],
        },
        {
          p: "Ezek alatt a *Mindent állítsak be magam* minden kapcsolót külön megnyit — tizenötöt, köztük a beszéd sebességét, a hangosan elmondottak feliratozását, az ujj számát minden billentyűn, és azt, meddig hagyjuk figyelmen kívül az ismétlődő billentyűt. Egyetlen gomb mindet visszaállítja.",
        },
      ],
    },
    {
      id: "braille",
      nav: "Braille",
      heading: "Tanulás Braille-billentyűzeten",
      blocks: [
        {
          p: "A vak vagy gyengénlátó tanuló egészen más oldalt kap — hatbillentyűs Braille-bevitelt, betűk helyett cellákban haladó tananyagot és végig beszélt útmutatást. Ez a gépelés tanulásának külön útja, nem pedig a látóknak szánt oldal felolvasva.",
        },
        { lab: "Bekapcsolás egy tanulónál" },
        {
          steps: [
            "Nyisd meg a menüt, válaszd a Fiók, majd a Tanulók lehetőséget.",
            "Szerkeszd a tanulót, vagy vegyél fel újat.",
            "Kapcsold be a látástámogatást, és ments.",
          ],
        },
        {
          p: "Ez a tanuló mostantól egyenesen a Braille-oldalra kerül, valahányszor ő gyakorol. A haladását betűk helyett cellákban számoljuk, és ugyanolyan feltételekkel szerezhet oklevelet, mint bárki más.",
        },
      ],
    },
    {
      id: "courses",
      nav: "A két tanfolyam",
      heading: "Vezetett gyakorlás, Klasszikus és kód",
      blocks: [
        {
          p: "A *Vezetett gyakorlás* az alkalmazkodó tanfolyam: figyeli, mely billentyűk lassítanak le, és azok köré építi a leckéidet, új betűt pedig csak akkor vesz fel, ha a meglévőket gyorsan és pontosan is le tudod gépelni.",
        },
        {
          p: "A *Klasszikus tanfolyam* a régimódi: kötött leckelétra megadott sorrendben, ahogy egy gépíráskönyv tanítaná. Van, aki egyszerűen szereti tudni, mi következik.",
        },
        {
          p: "Ez két külön tanfolyam, külön előzményekkel, és az oklevelet az egyikkel vagy a másikkal lehet megszerezni — soha nem a kettő összeadásával, mert az kétszer számolná az első hetedet. A fiókod Tanfolyam oldala megmondja, melyikről szól a jelentés.",
        },
        {
          p: "A *Kódműhely* a gyakorlás harmadik fajtája: valódi részletek az általad választott nyelven, hogy a zárójelek, a pontosvesszők és a behúzások is megkapják azt a gyakorlást, amit a hétköznapi próza soha nem ad meg nekik.",
        },
        { lab: "Váltás közöttük" },
        {
          steps: [
            "A gyakorlóképernyőn nyisd meg a lecke beállításait.",
            "Válaszd a Vezetett gyakorlás, a Klasszikus tanfolyam vagy a Kódműhely lehetőséget.",
          ],
        },
      ],
    },
    {
      id: "certificates",
      nav: "Oklevelek",
      heading: "Oklevél megszerzése",
      blocks: [
        {
          p: "Az oklevél azt mondja ki, hogy egy megnevezett tanuló mért sebességgel és pontossággal gépelt, egy adott nyelven, egy adott napon. Mi állítjuk ki — nem olyan képesítés, amelyet bármely vizsgabizottság vagy munkáltató elismerni vállalt volna —, és őszinte bizonyítéka annak, amit valaki valóban teljesített.",
        },
        { lab: "Nézd meg, mennyi van hátra" },
        {
          steps: [
            "Nyisd meg a menüt, és válaszd a Fiók lehetőséget.",
            "Válaszd a Tanfolyam pontot.",
            "Minden tanulónak van egy sora, amely az összes feltételt mutatja, és azt, hol tart bennük.",
          ],
        },
        {
          p: "A feltételek olyanok, mint hogy minden betű bevezetésre került, minden betű megbízható, nem csak találkoztál vele, elég lecke, elég külön nap, valamint tartósan meglévő sebesség és pontosság. Ha mind teljesül, azon a soron megjelenik egy link a vizsga elvégzéséhez.",
        },
        {
          p: "A vizsga rövid, és a szervereinken értékeljük, nem a böngésződben. Ha átmész rajta, az oklevél sorszámmal együtt készül el. Bárki, akinek megadod ezt a számot, ellenőrizheti az *Oklevél ellenőrzése* oldalon — és te döntöd el, hogy a neved látszik-e neki.",
        },
      ],
    },
    {
      id: "security",
      nav: "A fiókod biztonsága",
      heading: "Belépési kulcsok, kódok és hogy ki jelentkezett be",
      blocks: [
        {
          p: "Bejelentkezhetsz jelszóval, egy szolgáltatóval, például a Google-lel, az e-mailedre küldött linkkel — vagy *belépési kulccsal*, amit mi választanánk. A belépési kulcs az eszközöd saját ujjlenyomatát, arcfelismerését vagy PIN-kódját használja; nincs kiszivárogtatható jelszó, és semmi, ami nálunk van, nem lenne alkalmas arra, hogy a nevedben bejelentkezzenek.",
        },
        { lab: "Belépési kulcs hozzáadása" },
        {
          steps: [
            "Nyisd meg a menüt, válaszd a Fiók, majd a Biztonság lehetőséget.",
            "Válaszd a Belépési kulcs hozzáadása lehetőséget, és kövesd az eszközöd utasítását.",
          ],
        },
        {
          p: "A *kétlépcsős azonosítás* is elérhető, hitelesítő alkalmazással, és helyreállítási kódokkal arra az esetre, ha elveszítenéd a telefont. Nyomtasd ki őket valahová, ami nem a telefon.",
        },
        {
          p: "Ugyanez az oldal felsorolja a legutóbbi eseményeket — bejelentkezések, sikertelen bejelentkezések, hozzáadott belépési kulcs, megváltoztatott jelszó —, mindegyiket a hozzávetőleges hellyel, ahonnan érkezett, így könnyű észrevenni, ha valamit nem te csináltál. Ha valami gyanús, a *kijelentkezés mindenhonnan* minden munkamenetet lezár azon kívül, amelyiket éppen használod.",
        },
        {
          p: "Van *szülői PIN* is, amely lezárja a fiókbeállításokat, hogy a családi eszközön gépelő gyerek ne tudja megváltoztatni őket, sem profilt törölni.",
        },
      ],
    },
    {
      id: "yours",
      nav: "Tedd a sajátoddá",
      heading: "Tedd a sajátoddá",
      blocks: [
        { lab: "A téma módosítása" },
        {
          steps: [
            "Nyisd meg a menüt, válaszd a Fiók, majd a Megjelenés lehetőséget.",
            "Válassz világosat, sötétet, vagy kövesd az eszköz beállítását.",
          ],
        },
        {
          p: "Ha a beépített témák közül egyik sem az igazi, a *tématervező* segítségével kikeverheted a sajátodat — beleértve azokat az ujjszíneket is, amelyekkel a billentyűzet tanít. Az alkalmazás megméri a választott színek kontrasztját, és elutasítja azokat a kombinációkat, amelyeket senki nem tudna elolvasni.",
        },
        {
          p: "A háztartás minden tanulójának lehet saját színe, így egy közös eszköz is annak érzi magát, aki éppen előtte ül.",
        },
        { lab: "Az oldal nyelvének módosítása" },
        {
          steps: [
            "Nyisd meg a menüt.",
            "Az Oldal nyelve alatt válaszd ki a nyelved.",
          ],
        },
        {
          p: "A gyakorlóképernyőn bármikor átméretezheted a szöveget, és be- vagy kikapcsolhatod a hangokat.",
        },
      ],
    },
    {
      id: "privacy",
      nav: "Adatvédelem",
      heading: "Adatvédelem, egyetlen mondatban",
      blocks: [
        {
          p: "Nincsenek hirdetések és nincsenek nyomkövetők. Egy gyerek profilja soha nem hagyja el a böngésződet. Csak akkor jelentkezz be, ha szinkronizálni vagy megosztani szeretnél; egyébként minden ezen az eszközön marad, és bármikor szabadon törölheted.",
        },
      ],
    },
    {
      id: "signout",
      nav: "Kijelentkezés",
      heading: "Kijelentkezés",
      blocks: [
        { lab: "Kijelentkezés" },
        {
          steps: [
            "Nyisd meg a menüt.",
            "Válaszd a Kijelentkezés lehetőséget, és erősítsd meg.",
          ],
        },
        {
          p: "A gyakorlási előzményeid biztonságban maradnak ezen az eszközön — és a fiókodban, ha létrehoztál egyet —, készen a következő alkalomra, amikor leülsz gépelni.",
        },
      ],
    },
    {
      id: "tips",
      nav: "Tippek",
      heading: "Néhány szokás, ami tényleg segít",
      blocks: [
        {
          tips: [
            "Pontosság a sebesség előtt — a tiszta gépelés az, ami megmarad.",
            "Nyugodtan javítsd a hibákat; ne siess, hogy behozd a lemaradást.",
            "Pihentesd az ujjaid az alapsoron — az F és a J billentyűn kis bütyök van.",
            "Napi néhány perc többet ér, mint heti egy óra.",
          ],
        },
      ],
    },
  ],
};
