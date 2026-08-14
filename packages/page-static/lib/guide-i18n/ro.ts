import { type GuideTranslation } from "../guide-content.tsx";

export const ro: GuideTranslation = {
  kicker: "Tot ce poți face",
  title: "Ghidul utilizatorului",
  dateline:
    "Ghidul complet al KeyLearn — de la prima vizită până la deconectare",
  navLabel: "Pe această pagină",
  sections: [
    {
      id: "account",
      nav: "Am nevoie de un cont?",
      heading: "Am nevoie de un cont?",
      blocks: [
        {
          p: "Nu. Poți începe să scrii din clipa în care ajungi aici, iar progresul tău se salvează chiar aici, pe acest dispozitiv. Creează-ți un cont gratuit doar dacă vrei ca istoricul să te urmeze pe alte dispozitive, să ai o copie de siguranță sau să distribui un link către profil. Nimic util nu stă ascuns în spatele autentificării.",
        },
      ],
    },
    {
      id: "signin",
      nav: "Autentificare și parole",
      heading: "Înregistrare, autentificare și parole",
      blocks: [
        { p: "Totul se află în meniul din dreapta sus." },
        { lab: "Creează un cont" },
        {
          steps: [
            "Deschide meniul (dreapta sus).",
            "Alege Înregistrare.",
            "Introdu o adresă de e-mail și o parolă.",
            "Confirmă — gata, ești înăuntru.",
          ],
        },
        { lab: "Autentifică-te" },
        {
          steps: [
            "Deschide meniul și alege Autentificare.",
            "Introdu adresa de e-mail și parola.",
          ],
        },
        { lab: "Resetează o parolă uitată" },
        {
          steps: [
            "Pe ecranul de autentificare, alege Am uitat parola.",
            "Introdu adresa ta de e-mail.",
            "Deschide linkul de resetare pe care ți-l trimitem.",
            "Alege o parolă nouă și autentifică-te.",
          ],
        },
      ],
    },
    {
      id: "profiles",
      nav: "Profiluri",
      heading: "Profiluri pentru toată casa",
      blocks: [
        {
          p: "KeyLearn este gândit ca o gospodărie: un singur cont găzduiește până la patru profiluri (opt cu premium), adulți și copii în orice combinație. Fiecare profil își păstrează *propriul* progres, separat, pe acest dispozitiv — nimic nu se amestecă vreodată.",
        },
        { lab: "Adaugă un profil" },
        {
          steps: [
            "Deschide meniul și alege Cont (sau „Configurează profilurile”).",
            "Selectează Adaugă un profil.",
            "Scrie un prenume.",
            "Marchează-l ca Adult sau Copil.",
            "Alege un avatar — o pictogramă prietenoasă sau o Fotografie de pe dispozitivul tău.",
            "Pentru un copil, adaugă anul nașterii (asta doar potrivește cuvintele și ritmul cu vârsta lui).",
            "Salvează.",
          ],
        },
        { lab: "Treci la alt cursant" },
        {
          steps: [
            "Deschide meniul.",
            "Atinge o față de la Cursanți — aplicația reia de unde a rămas.",
          ],
        },
        { lab: "Modifică sau șterge un profil" },
        {
          steps: [
            "Deschide meniul și alege Cont.",
            "Alege Modifică pe un profil sau șterge-l ca să eliberezi un loc.",
          ],
        },
        {
          p: "Profilurile de copil primesc un meniu simplificat și blocat, iar acțiunile pentru adulți stau în spatele unei întrebări rapide de aritmetică, „cât face A ori B?”, ca cei mici să nu ajungă din greșeală în setări.",
        },
      ],
    },
    {
      id: "screen",
      nav: "Ecranul de exersare",
      heading: "Ecranul de exersare",
      blocks: [
        {
          p: "Pur și simplu începe să scrii. Cuvântul de care ai nevoie plutește chiar deasupra tastaturii de pe ecran; o cometă strălucitoare arată exact tasta următoare; tastele sunt colorate pe zone de degete, ca să înveți ce deget ajunge unde; iar o pereche discretă de mâini în repaus îți arată unde stau degetele între apăsări. Toată priceperea se reduce la un singur obicei: ține ochii pe cuvinte, nu pe mâini.",
        },
      ],
    },
    {
      id: "journey",
      nav: "Călătoria ta",
      heading: "Cum cresc lecțiile — călătoria ta",
      blocks: [
        {
          p: "KeyLearn este *adaptiv*. Măsoară cât de repede și de curat apeși fiecare tastă și adaugă o literă nouă în setul tău abia după ce le poți scrie pe cele actuale și rapid, și corect. Setul acesta care crește este călătoria ta, de la câteva litere la tot alfabetul — dificultatea urcă exact la fel de repede ca tine, niciodată mai repede, așa că lucrezi mereu chiar la limita ta.",
        },
      ],
    },
    {
      id: "readout",
      nav: "Statistici live",
      heading: "Afișajul live",
      blocks: [
        {
          p: "În timp ce scrii, panoul plutitor îți arată viteza și acuratețea de acum, un mic grafic al rundelor recente, evoluția față de obiective și seria ta de zile. Este acolo ca să te încurajeze, nu ca să te cicălească.",
        },
      ],
    },
    {
      id: "tools",
      nav: "Unelte de exersare",
      heading: "Unelte de exersare",
      blocks: [
        {
          p: "Uneltele mici de lângă text îți permit să deschizi un tur ghidat, să reiei lecția curentă (Ctrl + Stânga), să sari la următoarea (Ctrl + Dreapta), să afișezi sau să ascunzi tastatura de pe ecran și să schimbi mărimea textului de exersare. Rotița deschide Setările complete, descrise mai jos.",
        },
      ],
    },
    {
      id: "content",
      nav: "Ce scrii",
      heading: "Alegerea a ceea ce scrii",
      blocks: [
        {
          p: "Deschide Setări și mergi la Conținut de exersare ca să alegi cum se alcătuiesc cuvintele tale:",
        },
        {
          tips: [
            "*Exersare ghidată* — varianta implicită, adaptivă, care îți crește alfabetul tastă cu tastă.",
            "*Curs clasic* — un parcurs fix, în ordine, prin toate tastele.",
            "*Cuvinte frecvente* — cele mai obișnuite cuvinte din limba ta.",
            "*Text din cărți* — scrie-ți drumul prin cărți adevărate, incluse în aplicație.",
            "*Textul tău* — lipește ce vrei tu și exersează pe el.",
            "*Fragmente de cod* — paranteze, simboluri și ritmul codului.",
            "*Exerciții cu cifre* — rândul de cifre și blocul numeric.",
          ],
        },
        { lab: "Schimbă ce scrii" },
        {
          steps: [
            "Deschide Setări (rotița de lângă textul de exersare).",
            "Mergi la Conținut de exersare.",
            "Alege un mod — pentru Text din cărți alege o carte, pentru Textul tău lipește cuvintele tale.",
            "Închide Setările și scrie mai departe.",
          ],
        },
        {
          p: "Tot de aici stabilești mărimea alfabetului, o viteză-țintă, cât durează fiecare lecție și un obiectiv zilnic.",
        },
      ],
    },
    {
      id: "smart",
      nav: "Exersare inteligentă",
      heading: "Ajutoarele din Exersare inteligentă",
      blocks: [
        {
          p: "Peste exersarea ghidată, Exersarea inteligentă adaugă ajutoare blânde: un exercițiu care vânează perechile tale de taste cele mai lente, repetiție eșalonată, reîmprospătări împotriva uitării, care revin la tastele ruginite, încredere inteligentă și recuperarea tastelor. Toate sunt pornite din start.",
        },
        { lab: "Pornește sau oprește un ajutor" },
        {
          steps: [
            "Deschide Setări.",
            "Mergi la Exersare inteligentă.",
            "Comută orice ajutor vrei — sau lasă-le pe toate pornite.",
          ],
        },
      ],
    },
    {
      id: "keyboard",
      nav: "Configurarea tastaturii",
      heading: "Configurarea tastaturii tale",
      blocks: [
        {
          p: "În Setări, la Configurarea tastaturii, potrivești KeyLearn cu tastatura ta și cu aranjamentul pe care vrei să-l înveți.",
        },
        { lab: "Schimbă aranjamentul tastaturii" },
        {
          steps: [
            "Deschide Setări.",
            "Mergi la Configurarea tastaturii.",
            "Alege-ți limba, apoi aranjamentul (QWERTY, Dvorak, Colemak și altele).",
            "Lasă pornit „Simulează acest aranjament”, ca să poți exersa pe el indiferent cum e setat calculatorul tău.",
            "Urmărește previzualizarea live ca să te asiguri.",
          ],
        },
        {
          p: "Tot de aici poți alege forma tastaturii, poți colora tastele pe zone de degete și poți evidenția tasta următoare cât timp încă înveți unde se află fiecare lucru.",
        },
      ],
    },
    {
      id: "display",
      nav: "Afișare",
      heading: "Afișare și senzație",
      blocks: [
        {
          p: "Setările de Afișare și Introducere text îți permit să-ți vezi viteza în cuvinte sau caractere pe minut și să reglezi fin cum se simte scrisul. Restabilește valorile implicite este mereu la un clic distanță, dacă vrei să o iei de la capăt.",
        },
      ],
    },
    {
      id: "progress",
      nav: "Progresul tău",
      heading: "Progresul tău — pagina Profil",
      blocks: [
        {
          p: "Pagina Profil este evidența ta completă: statisticile Din totdeauna și Azi, sus (timp exersat, lecții încheiate, viteza și acuratețea ta cea mai bună și cea obișnuită și cum se compară ziua de azi); o hartă a fiecărei litere pe care ai deblocat-o; povestea felului în care fiecare tastă în parte a devenit mai rapidă, cu un cursor de netezire; imaginea de ansamblu a tuturor tastelor în timp; și cele mai lente treceri dintre taste, care încă te țin pe loc. Poți chiar să te întreci cu propria ta rundă anterioară, ca o fantomă, ca să simți progresul pe viu.",
        },
        { lab: "Deschide-ți progresul" },
        {
          steps: [
            "Deschide meniul.",
            "Alege Profil.",
            "Folosește rândul de filtre ca să te concentrezi pe Litere, Cifre, Semne de punctuație sau Simboluri.",
          ],
        },
      ],
    },
    {
      id: "data",
      nav: "Datele tale",
      heading: "Grija față de datele tale",
      blocks: [
        { lab: "Șterge statisticile unui profil" },
        {
          steps: [
            "Deschide Profil pentru cursantul pe care vrei să-l resetezi.",
            "Derulează până la comanda de resetare din josul paginii.",
            "Confirmă „Șterge tot” — se golește doar acest profil.",
          ],
        },
        { lab: "Descarcă-ți datele" },
        {
          steps: [
            "Deschide Profil.",
            "Folosește opțiunea de descărcare ca să-ți salvezi istoricul într-un fișier.",
          ],
        },
        {
          p: "Autentifică-te dacă vrei ca istoricul tău să se sincronizeze între dispozitive și să poți distribui un link public către profil. Nu există reclame și nici urmăritoare, iar datele tale — sau chiar tot contul — le poți șterge oricând.",
        },
      ],
    },
    {
      id: "kids",
      nav: "Modul pentru copii",
      heading: "Modul pentru copii",
      blocks: [
        {
          p: "Copiii exersează pe o potecă jucăușă. Fiecare tastă corectă îi duce personajul cu un pas mai aproape de casă, iar personajul crește dintr-un bebeluș micuț într-un erou în toată firea, pe măsură ce se deblochează mai multe litere. O tastă tocmai învățată pornește o mică sărbătoare, iar fiecare sesiune se încheie lângă un foc de tabără primitor.",
        },
        { lab: "Treci la Copii" },
        {
          steps: [
            "Deschide meniul.",
            "Alege Copii — sau alege un profil de copil de la Cursanți.",
          ],
        },
        {
          p: "Sunt două lumi din care poți alege — Dino Run, cu un dinozaur prietenos, și Hero Trail, unde un cavaler pornește într-o aventură prin pădure — fiecare cu câte un personaj de ales.",
        },
      ],
    },
    {
      id: "toybox",
      nav: "Lădița cu jucării",
      heading: "Lădița cu jucării pentru copii",
      blocks: [
        { lab: "Deschide lădița cu jucării" },
        {
          steps: [
            "Pe ecranul pentru copii, atinge rotița din partea de sus a zonei de joc.",
          ],
        },
        {
          p: "Înăuntru poți alege lumea și personajul, Litere mari, Sunete, Mâini ajutătoare (ghidajul luminos pentru degete), Tastatura (ascunsă, simplă sau cea completă, pentru adulți), Litere pe potecă (cuvintele arătate ca niște cuburi chiar în joc), un Cronometru de sesiune, Urale (mesaje mici de încurajare) și — ascunse la Avansate — cursoare pentru Luminozitate, Culoare și cât de vioaie e lumea. Există și un aspect de noapte, liniștit, pe lângă cel luminos de zi.",
        },
      ],
    },
    {
      id: "ages",
      nav: "Cum cresc copiii",
      heading: "Cum creștem odată cu copilul tău",
      blocks: [
        {
          p: "KeyLearn se potrivește discret după vârsta copilului. Cei mai mici văd litere mari și prietenoase, un ritm îngăduitor, cuburi cu litere chiar pe potecă și cel mai blând ajutor; copiii mai mari trec la cuvinte mai lungi, la tastatura completă și la un aspect mai curat. Pune doar anul nașterii în profil, iar restul vine de la sine.",
        },
      ],
    },
    {
      id: "modes",
      nav: "Alte moduri",
      heading: "Alte feluri de a exersa",
      blocks: [
        {
          p: "Dincolo de exersarea zilnică există un *Test de viteză* — un fragment scurt, de o singură dată, care îți spune cuvintele pe minut și acuratețea, fără nicio lecție atașată; un explorator de *Aranjamente*, ca să compari aranjamentele de tastatură și hărțile lor de degete; *Clasamente*, ca să vezi cum stai față de ceilalți; și curse *Multiplayer*, ca să-ți împingi viteza alături de alții, în timp real.",
        },
        { lab: "Unde le găsești" },
        {
          steps: [
            "Deschide meniul.",
            "Alege Test de viteză, Aranjamente, Clasamente sau Multiplayer.",
          ],
        },
      ],
    },
    {
      id: "access",
      nav: "Dacă ceva îți stă în cale",
      heading: "Dacă ceva din aplicație îți stă în cale",
      blocks: [
        {
          p: "Există o pagină întreagă pentru asta, iar setările se fac *pentru fiecare cursant în parte* — așa că ajustările unei persoane nu schimbă nimic pentru altcineva.",
        },
        { lab: "Cum o deschizi" },
        {
          steps: [
            "Deschide meniul și alege Cont.",
            "Alege Accesibilitate.",
            "Alege cursantul din partea de sus, apoi pornește câte setări ai nevoie.",
          ],
        },
        {
          p: "Cele cinci setări *se combină*. Cineva cu dislexie și cu tremur are nevoie de două dintre ele, iar a fi obligat să alegi una singură ar însemna că aplicația te întreabă de care dificultate să țină cont.",
        },
        {
          tips: [
            "Calm — nimic nu se mișcă, nimic nu se numără, nimic nu e cronometrat, iar o zi sărită nu îți rupe seria.",
            "Mai puține lucruri deodată — exersarea începe doar cu cuvintele și tastatura.",
            "Mai ușor de citit — fontul făcut pentru dislexie, mai mult spațiu între litere și rânduri, text mai apăsat.",
            "Culori distincte — culori pentru degete care rămân deosebite și în caz de daltonism, iar greșelile se aud, nu doar se văd în roșu.",
            "Mâini mai sigure — lucruri mai mari de apăsat, fără două taste deodată, iar o tastă care se repetă singură nu se numără de două ori.",
          ],
        },
        {
          p: "Sub ele, *Le potrivesc eu pe fiecare* deschide fiecare comutator în parte — cincisprezece la număr, printre care viteza vorbirii, subtitrări pentru tot ce se spune cu voce tare, un număr de deget pe fiecare tastă și cât timp să fie ignorată o tastă repetată. Un singur buton le pune pe toate la loc.",
        },
      ],
    },
    {
      id: "braille",
      nav: "Braille",
      heading: "Învățarea pe o tastatură braille",
      blocks: [
        {
          p: "Un cursant nevăzător sau cu vedere slabă primește o pagină cu totul diferită — scriere braille din șase taste, o programă în celule în loc de litere și îndrumare vorbită de la un capăt la altul. Este un mod aparte de a învăța să scrii, nu pagina pentru văzători citită cu voce tare.",
        },
        { lab: "Pornește-o pentru un cursant" },
        {
          steps: [
            "Deschide meniul și alege Cont, apoi Cursanți.",
            "Modifică acel cursant sau adaugă unul nou.",
            "Pornește sprijinul pentru vedere și salvează.",
          ],
        },
        {
          p: "De acum, acel cursant ajunge direct la pagina braille ori de câte ori este rândul lui să exerseze. Progresul i se numără în celule, nu în litere, iar certificatul îl poate obține în aceleași condiții ca oricine altcineva.",
        },
      ],
    },
    {
      id: "courses",
      nav: "Cele două cursuri",
      heading: "Exersare ghidată, Curs clasic și cod",
      blocks: [
        {
          p: "*Exersarea ghidată* este cursul adaptiv: urmărește ce taste te încetinesc și îți construiește lecțiile în jurul lor, adăugând o literă nouă abia după ce le poți scrie pe cele de până acum și repede, și corect.",
        },
        {
          p: "*Cursul clasic* este cel de modă veche — o scară fixă de lecții, într-o ordine dinainte stabilită, așa cum te-ar învăța un manual de dactilografie. Unii oameni pur și simplu preferă să știe ce urmează.",
        },
        {
          p: "Sunt cursuri separate, cu istoric separat, iar certificatul se obține pe unul sau pe celălalt — niciodată pe cele două adunate, fiindcă asta ți-ar număra prima săptămână de două ori. Pagina Curs din contul tău îți spune despre care dintre ele îți raportează.",
        },
        {
          p: "*Meșteșugul codului* este un al treilea fel de exersare: fragmente adevărate de cod într-un limbaj ales de tine, ca parantezele, punctele și virgulele și indentarea să primească antrenamentul pe care proza obișnuită nu li-l dă niciodată.",
        },
        { lab: "Comută între ele" },
        {
          steps: [
            "Pe ecranul de exersare, deschide setările lecției.",
            "Alege Exersare ghidată, Curs clasic sau Meșteșugul codului.",
          ],
        },
      ],
    },
    {
      id: "certificates",
      nav: "Certificate",
      heading: "Obținerea unui certificat",
      blocks: [
        {
          p: "Un certificat spune că un cursant cu nume și prenume a scris cu o viteză și o acuratețe măsurate, într-o anumită limbă, la o anumită dată. Este emis de noi — nu este o calificare pe care vreo comisie de examinare sau vreun angajator s-a angajat să o recunoască — și este o dovadă cinstită a ceea ce a făcut cineva cu adevărat.",
        },
        { lab: "Vezi cât mai ai până acolo" },
        {
          steps: [
            "Deschide meniul și alege Cont.",
            "Alege Curs.",
            "Fiecare cursant are un rând care arată toate condițiile și cât a parcurs din fiecare.",
          ],
        },
        {
          p: "Condițiile sunt lucruri precum: fiecare literă introdusă, fiecare literă stăpânită cu adevărat, nu doar întâlnită o dată, destule lecții, destule zile diferite și o viteză și o acuratețe menținute în timp. Când toate sunt îndeplinite, pe acel rând apare un link către evaluare.",
        },
        {
          p: "Evaluarea este scurtă și se judecă pe serverele noastre, nu în browserul tău. Dacă o treci, certificatul se emite cu un număr pe el. Oricine căruia îi dai numărul acela îl poate verifica pe pagina *Verifică un certificat* — iar tu alegi dacă numele tău îi este arătat.",
        },
      ],
    },
    {
      id: "security",
      nav: "Cum îți ții contul în siguranță",
      heading: "Chei de acces, coduri și cine s-a autentificat",
      blocks: [
        {
          p: "Te poți autentifica cu o parolă, cu un furnizor precum Google, cu un link trimis pe e-mail — sau cu o *cheie de acces*, care este varianta pe care am alege-o noi. O cheie de acces folosește amprenta, chipul sau codul PIN de pe dispozitivul tău; nu există nicio parolă care să scape și nimic din ce păstrăm noi nu poate fi folosit ca să intre cineva în locul tău.",
        },
        { lab: "Adaugă o cheie de acces" },
        {
          steps: [
            "Deschide meniul și alege Cont, apoi Securitate.",
            "Alege Adaugă o cheie de acces și urmează indicația de pe dispozitivul tău.",
          ],
        },
        {
          p: "Există și *verificarea în doi pași*, cu o aplicație de autentificare și coduri de recuperare, în caz că pierzi telefonul. Tipărește-le undeva care să nu fie telefonul.",
        },
        {
          p: "Aceeași pagină îți arată activitatea recentă — autentificări, autentificări eșuate, o cheie de acces adăugată, o parolă schimbată — fiecare cu locul aproximativ din care a venit, ca să observi ușor ceva ce nu ai făcut tu. Dacă ți se pare în neregulă, *deconectează-mă de peste tot* încheie toate sesiunile, în afară de cea pe care o folosești acum.",
        },
        {
          p: "Există și un *PIN pentru părinți*, care blochează setările contului, ca un copil care folosește dispozitivul familiei să nu le poată schimba și să nu poată șterge un profil.",
        },
      ],
    },
    {
      id: "yours",
      nav: "Fă-o a ta",
      heading: "Fă-o a ta",
      blocks: [
        { lab: "Schimbă tema" },
        {
          steps: [
            "Deschide meniul și alege Cont, apoi Aspect.",
            "Alege luminoasă, întunecată sau după dispozitiv.",
          ],
        },
        {
          p: "Dacă niciuna dintre temele incluse nu e cea pe care o vrei, *creatorul de teme* te lasă să-ți amesteci una a ta — inclusiv culorile degetelor cu care predă tastatura. Aplicația măsoară contrastul a ceea ce alegi și refuză combinațiile pe care nu le-ar putea citi nimeni.",
        },
        {
          p: "Fiecare cursant din casă poate avea culoarea lui, așa că un dispozitiv folosit în comun tot pare că îi aparține celui care stă la el.",
        },
        { lab: "Schimbă limba site-ului" },
        {
          steps: ["Deschide meniul.", "La Limba site-ului, alege-ți limba."],
        },
        {
          p: "Pe ecranul de exersare poți, de asemenea, să schimbi mărimea textului și să pornești sau să oprești sunetele oricând vrei.",
        },
      ],
    },
    {
      id: "privacy",
      nav: "Confidențialitate",
      heading: "Confidențialitatea, într-o singură frază",
      blocks: [
        {
          p: "Fără reclame și fără urmăritoare. Profilul unui copil nu îți părăsește niciodată browserul. Autentifică-te doar dacă vrei sincronizare sau partajare; altfel totul rămâne pe acest dispozitiv, iar tu ești liber să-l ștergi oricând.",
        },
      ],
    },
    {
      id: "signout",
      nav: "Deconectare",
      heading: "Deconectare",
      blocks: [
        { lab: "Deconectează-te" },
        { steps: ["Deschide meniul.", "Alege Deconectare și confirmă."] },
        {
          p: "Istoricul tău de exersare rămâne în siguranță pe acest dispozitiv — și în contul tău, dacă ți-ai făcut unul — gata pentru data viitoare când te așezi să scrii.",
        },
      ],
    },
    {
      id: "tips",
      nav: "Sfaturi",
      heading: "Câteva obiceiuri care chiar ajută",
      blocks: [
        {
          tips: [
            "Acuratețea înaintea vitezei — scrisul curat este cel care rămâne.",
            "Îndreaptă greșelile calm; nu te grăbi să recuperezi.",
            "Ține degetele pe rândul de bază — F și J au niște mici proeminențe.",
            "Câteva minute în fiecare zi bat o oră o dată pe săptămână.",
          ],
        },
      ],
    },
  ],
};
