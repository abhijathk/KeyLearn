import { type GuideTranslation } from "../guide-content.tsx";

export const pl: GuideTranslation = {
  kicker: "Wszystko, co możesz tu robić",
  title: "Przewodnik użytkownika",
  dateline:
    "Kompletny przewodnik po KeyLearn — od pierwszej wizyty po wylogowanie",
  navLabel: "Na tej stronie",
  sections: [
    {
      id: "account",
      nav: "Czy potrzebuję konta?",
      heading: "Czy potrzebuję konta?",
      blocks: [
        {
          p: "Nie. Możesz zacząć pisać w chwili, w której tu trafisz, a twoje postępy zapisują się tutaj, na tym urządzeniu. Załóż darmowe konto tylko wtedy, gdy chcesz, żeby historia podążała za tobą na inne urządzenia, mieć kopię zapasową albo udostępnić link do profilu. Nic przydatnego nie jest zamknięte za logowaniem.",
        },
      ],
    },
    {
      id: "signin",
      nav: "Logowanie i hasła",
      heading: "Rejestracja, logowanie i hasła",
      blocks: [
        { p: "Wszystko znajdziesz w menu w prawym górnym rogu." },
        { lab: "Załóż konto" },
        {
          steps: [
            "Otwórz menu (prawy górny róg).",
            "Wybierz Zarejestruj się.",
            "Podaj adres e-mail i hasło.",
            "Potwierdź — i już jesteś w środku.",
          ],
        },
        { lab: "Zaloguj się" },
        {
          steps: [
            "Otwórz menu i wybierz Zaloguj się.",
            "Wpisz swój e-mail i hasło.",
          ],
        },
        { lab: "Zresetuj zapomniane hasło" },
        {
          steps: [
            "Na ekranie logowania wybierz Nie pamiętam hasła.",
            "Podaj swój adres e-mail.",
            "Otwórz link do resetowania, który do ciebie wyślemy.",
            "Wybierz nowe hasło i zaloguj się.",
          ],
        },
      ],
    },
    {
      id: "profiles",
      nav: "Profile",
      heading: "Profile dla całego domu",
      blocks: [
        {
          p: "KeyLearn jest pomyślany jak dom: jedno konto mieści do czterech profili (osiem w wersji premium), dorosłych i dzieci w dowolnym składzie. Każdy profil ma *własne*, osobne postępy na tym urządzeniu — nic nigdy się nie miesza.",
        },
        { lab: "Dodaj profil" },
        {
          steps: [
            "Otwórz menu i wybierz Konto (albo „Skonfiguruj profile”).",
            "Wybierz Dodaj profil.",
            "Wpisz imię.",
            "Zaznacz, czy to Dorosły, czy Dziecko.",
            "Wybierz awatar — sympatyczną ikonę albo Zdjęcie z twojego urządzenia.",
            "Przy dziecku podaj rok urodzenia (służy tylko do dopasowania słów i tempa do wieku).",
            "Zapisz.",
          ],
        },
        { lab: "Przełącz się na innego ucznia" },
        {
          steps: [
            "Otwórz menu.",
            "Dotknij twarzy w sekcji Uczniowie — aplikacja wróci tam, gdzie ta osoba skończyła.",
          ],
        },
        { lab: "Edytuj lub usuń profil" },
        {
          steps: [
            "Otwórz menu i wybierz Konto.",
            "Wybierz Edytuj przy profilu albo usuń go, żeby zwolnić miejsce.",
          ],
        },
        {
          p: "Profile dzieci dostają uproszczone, zabezpieczone menu, a czynności dla dorosłych chowają się za szybkim pytaniem „ile to A razy B?”, żeby maluchy nie zawędrowały do ustawień.",
        },
      ],
    },
    {
      id: "screen",
      nav: "Ekran ćwiczeń",
      heading: "Ekran ćwiczeń",
      blocks: [
        {
          p: "Po prostu zacznij pisać. Słowo, którego potrzebujesz, unosi się tuż nad klawiaturą ekranową; świecąca kometa wskazuje kolejny klawisz; klawisze są pokolorowane według stref palców, dzięki czemu uczysz się, który palec gdzie sięga; a delikatna para spoczywających dłoni pokazuje, gdzie twoje palce mieszkają między uderzeniami. Cała ta umiejętność to jeden nawyk: trzymaj wzrok na słowach, a nie na dłoniach.",
        },
      ],
    },
    {
      id: "journey",
      nav: "Twoja podróż",
      heading: "Jak rosną lekcje — twoja podróż",
      blocks: [
        {
          p: "KeyLearn jest *adaptacyjny*. Mierzy, jak szybko i czysto trafiasz w każdy klawisz, i dokłada nową literę do twojego zestawu dopiero wtedy, gdy obecne piszesz i szybko, i bezbłędnie. Ten rosnący zestaw to twoja podróż — od garstki liter po cały alfabet. Trudność rośnie dokładnie w tempie, w jakim rośniesz ty, nigdy szybciej, więc zawsze pracujesz tuż przy swojej granicy.",
        },
      ],
    },
    {
      id: "readout",
      nav: "Statystyki na żywo",
      heading: "Podgląd na żywo",
      blocks: [
        {
          p: "W trakcie pisania pływający panel pokazuje twoją aktualną szybkość i dokładność, mały wykres ostatnich przebiegów, postęp celów i twoją serię. Jest po to, żeby cię zachęcać, a nie zrzędzić.",
        },
      ],
    },
    {
      id: "tools",
      nav: "Narzędzia ćwiczeń",
      heading: "Narzędzia ćwiczeń",
      blocks: [
        {
          p: "Małe narzędzia obok tekstu pozwalają otworzyć przewodnik po aplikacji, zacząć bieżącą lekcję od nowa (Ctrl + strzałka w lewo), przeskoczyć do następnej (Ctrl + strzałka w prawo), pokazać lub ukryć klawiaturę ekranową i zmienić wielkość tekstu do ćwiczeń. Zębatka otwiera pełne Ustawienia, opisane niżej.",
        },
      ],
    },
    {
      id: "content",
      nav: "Co piszesz",
      heading: "Wybór tego, co piszesz",
      blocks: [
        {
          p: "Otwórz Ustawienia i przejdź do Treści ćwiczeń, aby wybrać, z czego powstają twoje słowa:",
        },
        {
          tips: [
            "*Ćwiczenie prowadzone* — adaptacyjne ustawienie domyślne, które rozbudowuje twój alfabet klawisz po klawiszu.",
            "*Kurs klasyczny* — stały, uporządkowany marsz przez klawisze.",
            "*Częste słowa* — najczęstsze słowa w twoim języku.",
            "*Tekst z książki* — przepisuj prawdziwe książki wbudowane w aplikację.",
            "*Własny tekst* — wklej cokolwiek chcesz i ćwicz na tym.",
            "*Fragmenty kodu* — nawiasy, symbole i rytm kodu.",
            "*Ćwiczenia z liczbami* — rząd cyfr i klawiatura numeryczna.",
          ],
        },
        { lab: "Zmień to, co piszesz" },
        {
          steps: [
            "Otwórz Ustawienia (zębatka obok tekstu do ćwiczeń).",
            "Przejdź do Treści ćwiczeń.",
            "Wybierz tryb — przy Tekście z książki wybierz książkę, przy Własnym tekście wklej swoje słowa.",
            "Zamknij Ustawienia i pisz dalej.",
          ],
        },
        {
          p: "Na tym samym ekranie ustawisz wielkość alfabetu, docelową szybkość, długość każdej lekcji i cel dzienny.",
        },
      ],
    },
    {
      id: "smart",
      nav: "Inteligentne ćwiczenie",
      heading: "Pomocnicy Inteligentnego ćwiczenia",
      blocks: [
        {
          p: "Oprócz ćwiczenia prowadzonego Inteligentne ćwiczenie dorzuca łagodnych pomocników: trening wąskich gardeł, który tropi twoje najwolniejsze pary klawiszy, powtórki rozłożone w czasie, odświeżanie zapominanych umiejętności, które wraca do zardzewiałych klawiszy, inteligentną pewność i odzyskiwanie klawiszy. Wszystkie są domyślnie włączone.",
        },
        { lab: "Włącz lub wyłącz pomocnika" },
        {
          steps: [
            "Otwórz Ustawienia.",
            "Przejdź do Inteligentnego ćwiczenia.",
            "Przełącz dowolnego pomocnika — albo zostaw wszystkie włączone.",
          ],
        },
      ],
    },
    {
      id: "keyboard",
      nav: "Ustawienia klawiatury",
      heading: "Konfiguracja klawiatury",
      blocks: [
        {
          p: "W Ustawieniach, w sekcji Ustawienia klawiatury, dopasujesz KeyLearn do swojej klawiatury i do układu, którego chcesz się nauczyć.",
        },
        { lab: "Zmień układ klawiatury" },
        {
          steps: [
            "Otwórz Ustawienia.",
            "Przejdź do Ustawień klawiatury.",
            "Wybierz swój język, a potem układ (QWERTY, Dvorak, Colemak i inne).",
            "Zostaw włączone „Symuluj ten układ”, żeby móc go ćwiczyć niezależnie od tego, co ustawione jest w komputerze.",
            "Sprawdź podgląd na żywo, żeby się upewnić.",
          ],
        },
        {
          p: "Na tym samym ekranie wybierzesz kształt klawiatury, pokolorujesz klawisze według stref palców i podświetlisz następny klawisz, dopóki jeszcze uczysz się, gdzie co leży.",
        },
      ],
    },
    {
      id: "display",
      nav: "Wygląd",
      heading: "Wygląd i odczucia",
      blocks: [
        {
          p: "Ustawienia Wygląd i Wprowadzanie tekstu pozwalają pokazywać szybkość w słowach albo w znakach na minutę i dopieścić to, jak pisanie się odczuwa. Przywróć domyślne jest zawsze o jedno kliknięcie stąd, jeśli chcesz zacząć od zera.",
        },
      ],
    },
    {
      id: "progress",
      nav: "Twoje postępy",
      heading: "Twoje postępy — strona Profil",
      blocks: [
        {
          p: "Strona Profil to twój pełny zapis: na górze statystyki Ogółem i Dzisiaj (czas ćwiczeń, ukończone lekcje, twoja najlepsza i typowa szybkość oraz dokładność, a także jak wypada dzisiejszy dzień); mapa wszystkich odblokowanych liter; historia tego, jak przyspieszał każdy pojedynczy klawisz, z suwakiem wygładzania; szeroki obraz wszystkich klawiszy w czasie; i najwolniejsze przejścia, które wciąż cię hamują. Możesz nawet ścigać się z własnym poprzednim przebiegiem jak z duchem i poczuć postęp bezpośrednio.",
        },
        { lab: "Otwórz swoje postępy" },
        {
          steps: [
            "Otwórz menu.",
            "Wybierz Profil.",
            "Użyj wiersza filtrów, aby skupić się na Literach, Cyfrach, Interpunkcji lub Symbolach.",
          ],
        },
      ],
    },
    {
      id: "data",
      nav: "Twoje dane",
      heading: "Dbanie o twoje dane",
      blocks: [
        { lab: "Wyczyść statystyki profilu" },
        {
          steps: [
            "Otwórz Profil osoby, którą chcesz zresetować.",
            "Przewiń do przycisku resetowania na dole strony.",
            "Potwierdź „Usuń wszystko” — czyszczony jest tylko ten profil.",
          ],
        },
        { lab: "Pobierz swoje dane" },
        {
          steps: [
            "Otwórz Profil.",
            "Skorzystaj z opcji pobierania, aby zapisać historię jako plik.",
          ],
        },
        {
          p: "Zaloguj się, jeśli chcesz, żeby historia synchronizowała się między urządzeniami i żeby udostępniać publiczny link do profilu. Nie ma reklam ani śledzenia, a swoje dane — albo całe konto — możesz usunąć, kiedy tylko zechcesz.",
        },
      ],
    },
    {
      id: "kids",
      nav: "Tryb dziecięcy",
      heading: "Tryb dziecięcy",
      blocks: [
        {
          p: "Dzieci ćwiczą na wesołym szlaku. Każdy poprawny klawisz przesuwa ich postać o krok bliżej domu, a postać rośnie z maleńkiego bobasa w dorosłego bohatera, w miarę jak odblokowują się kolejne litery. Świeżo nauczony klawisz wywołuje małe świętowanie, a każda sesja kończy się przy przytulnym ognisku.",
        },
        { lab: "Przełącz się na tryb dziecięcy" },
        {
          steps: [
            "Otwórz menu.",
            "Wybierz Dzieci — albo wskaż profil dziecka w sekcji Uczniowie.",
          ],
        },
        {
          p: "Do wyboru są dwa światy — Dino Run z sympatycznym dinozaurem i Hero Trail, gdzie rycerz wyrusza na wyprawę przez las — a w każdym z nich wybierzesz postać.",
        },
      ],
    },
    {
      id: "toybox",
      nav: "Skrzynia zabawek",
      heading: "Dziecięca skrzynia zabawek",
      blocks: [
        { lab: "Otwórz skrzynię zabawek" },
        {
          steps: ["Na ekranie dla dzieci dotknij zębatki u góry pola zabawy."],
        },
        {
          p: "W środku ustawisz świat i postać, Duże litery, Dźwięki, Pomocne dłonie (świecącą prowadnicę palców), Klawiaturę (ukrytą, prostą albo pełną, dla dorosłych), Litery na szlaku (słowa pokazywane jako klocki wprost w grze), Minutnik sesji, Doping (małe zachęcające wiadomości) oraz — schowane w sekcji Zaawansowane — suwaki Jasności, Koloru i tego, jak żywy jest świat. Obok jasnej wersji dziennej jest też spokojna nocna.",
        },
      ],
    },
    {
      id: "ages",
      nav: "Dorastanie",
      heading: "Rośniemy razem z dzieckiem",
      blocks: [
        {
          p: "KeyLearn po cichu dostraja się do wieku dziecka. Najmłodsi widzą duże, przyjazne litery, wyrozumiałe tempo, klocki z literami wprost na szlaku i najłagodniejszą pomoc; starsze dzieci przechodzą do dłuższych słów, pełnej klawiatury i czystszego wyglądu. Wystarczy ustawić w profilu rok urodzenia, a reszta dzieje się sama.",
        },
      ],
    },
    {
      id: "modes",
      nav: "Inne tryby",
      heading: "Inne sposoby ćwiczenia",
      blocks: [
        {
          p: "Poza codziennym ćwiczeniem jest jeszcze *Test szybkości* — krótki, jednorazowy fragment, który podaje twoją liczbę słów na minutę i dokładność, bez żadnej lekcji; przeglądarka *Układów* do porównywania układów klawiatury i ich map palców; *Najlepsze wyniki*, żeby zobaczyć, jak wypadasz; oraz wyścigi *Wieloosobowe*, w których zmierzysz swoją szybkość z innymi na żywo.",
        },
        { lab: "Gdzie ich szukać" },
        {
          steps: [
            "Otwórz menu.",
            "Wybierz Test szybkości, Układy, Najlepsze wyniki albo Tryb wieloosobowy.",
          ],
        },
      ],
    },
    {
      id: "access",
      nav: "Jeśli coś przeszkadza",
      heading: "Jeśli coś w aplikacji ci przeszkadza",
      blocks: [
        {
          p: "Jest na to osobna strona, a ustawienia działają *dla każdego ucznia osobno* — więc czyjeś dopasowania nigdy nie zmieniają niczyich innych.",
        },
        { lab: "Jak ją otworzyć" },
        {
          steps: [
            "Otwórz menu i wybierz Konto.",
            "Wybierz Dostępność.",
            "Wskaż ucznia u góry, a potem włącz tyle ustawień, ile potrzebujesz.",
          ],
        },
        {
          p: "Te pięć ustawień *łączy się* ze sobą. Osoba z dysleksją i drżeniem rąk potrzebuje dwóch z nich, a zmuszanie do wyboru jednego byłoby pytaniem aplikacji, którą trudność zechce uwzględnić.",
        },
        {
          tips: [
            "Spokój — nic się nie rusza, nic nie jest liczone, nic nie jest na czas, a opuszczony dzień nie przerywa serii.",
            "Mniej rzeczy naraz — ćwiczenie otwiera się z samymi słowami i klawiaturą.",
            "Łatwiej czytać — krój pisma stworzony dla dysleksji, więcej miejsca między literami i wierszami, mocniejszy tekst.",
            "Rozdzielone kolory — kolory palców, które pozostają rozróżnialne przy daltonizmie, i błędy sygnalizowane dźwiękiem, nie tylko czerwienią.",
            "Pewniejsze dłonie — większe rzeczy do naciśnięcia, żadnych dwóch klawiszy naraz, a klawisz, który się powtórzy, nie liczy się dwa razy.",
          ],
        },
        {
          p: "Pod nimi *Ustawienia po swojemu* otwierają każdy przełącznik z osobna — piętnaście sztuk, w tym tempo mowy, napisy do wszystkiego, co jest wypowiadane, numer palca na każdym klawiszu i to, jak długo ignorować powtórzony klawisz. Jeden przycisk przywraca je wszystkie.",
        },
      ],
    },
    {
      id: "braille",
      nav: "Brajl",
      heading: "Nauka na klawiaturze brajlowskiej",
      blocks: [
        {
          p: "Osoba niewidoma lub słabowidząca dostaje zupełnie inną stronę — sześcioklawiszowe pisanie brajlem, program nauki liczony w znakach brajlowskich zamiast w literach i mówione wskazówki na każdym kroku. To osobny sposób nauki pisania, a nie strona dla widzących czytana na głos.",
        },
        { lab: "Włącz to dla ucznia" },
        {
          steps: [
            "Otwórz menu i wybierz Konto, a potem Uczniowie.",
            "Edytuj ucznia albo dodaj nowego.",
            "Włącz wsparcie dla osób niewidomych i zapisz.",
          ],
        },
        {
          p: "Ta osoba trafia teraz prosto na stronę brajlowską, ilekroć to ona ćwiczy. Jej postępy liczone są w znakach brajlowskich, a nie w literach, i może zdobyć certyfikat na takich samych zasadach jak każdy inny.",
        },
      ],
    },
    {
      id: "courses",
      nav: "Dwa kursy",
      heading: "Ćwiczenie prowadzone, kurs klasyczny i kod",
      blocks: [
        {
          p: "*Ćwiczenie prowadzone* to kurs adaptacyjny: obserwuje, które klawisze cię spowalniają, i buduje wokół nich twoje lekcje, dokładając literę dopiero wtedy, gdy te, które już masz, piszesz i szybko, i dokładnie.",
        },
        {
          p: "*Kurs klasyczny* to ten staroświecki — stała drabina lekcji w ustalonej kolejności, tak jak uczyłby podręcznik maszynopisania. Niektórzy po prostu wolą wiedzieć, co będzie dalej.",
        },
        {
          p: "To osobne kursy z osobnymi historiami, a certyfikat zdobywa się na jednym albo na drugim — nigdy na obu zsumowanych, bo wtedy pierwszy tydzień liczyłby się dwa razy. Strona Kurs w twoim koncie mówi, o którym z nich raportuje.",
        },
        {
          p: "*Rzemiosło kodu* to trzeci rodzaj ćwiczeń: prawdziwe fragmenty w wybranym przez ciebie języku, żeby nawiasy, średniki i wcięcia dostały trening, jakiego zwykła proza nigdy im nie daje.",
        },
        { lab: "Przełączanie między nimi" },
        {
          steps: [
            "Na ekranie ćwiczeń otwórz ustawienia lekcji.",
            "Wybierz Ćwiczenie prowadzone, Kurs klasyczny albo Rzemiosło kodu.",
          ],
        },
      ],
    },
    {
      id: "certificates",
      nav: "Certyfikaty",
      heading: "Zdobywanie certyfikatu",
      blocks: [
        {
          p: "Certyfikat mówi, że wskazana z imienia osoba pisała ze zmierzoną szybkością i dokładnością, w określonym języku, określonego dnia. Wystawiamy go my — to nie jest kwalifikacja, którą zgodziła się uznać jakakolwiek komisja egzaminacyjna czy pracodawca — i jest uczciwym dowodem tego, co ktoś naprawdę zrobił.",
        },
        { lab: "Sprawdź, ile ci brakuje" },
        {
          steps: [
            "Otwórz menu i wybierz Konto.",
            "Wybierz Kurs.",
            "Każdy uczeń ma wiersz z wszystkimi warunkami i tym, jak daleko zaszedł.",
          ],
        },
        {
          p: "Warunki to na przykład: wprowadzone wszystkie litery, każda litera opanowana, a nie tylko poznana, dość lekcji, dość osobnych dni oraz utrzymana szybkość i dokładność. Kiedy wszystkie są spełnione, w tym wierszu pojawia się link do egzaminu.",
        },
        {
          p: "Egzamin jest krótki i oceniany na naszych serwerach, a nie w twojej przeglądarce. Zdaj go, a certyfikat zostanie wystawiony z numerem. Każdy, komu podasz ten numer, może go sprawdzić na stronie *Sprawdź certyfikat* — a ty decydujesz, czy zobaczy twoje imię.",
        },
      ],
    },
    {
      id: "security",
      nav: "Bezpieczeństwo konta",
      heading: "Klucze dostępu, kody i kto się logował",
      blocks: [
        {
          p: "Możesz logować się hasłem, przez dostawcę takiego jak Google, linkiem wysłanym na e-mail — albo *kluczem dostępu*, i to jego sami byśmy wybrali. Klucz dostępu korzysta z odcisku palca, twarzy lub PIN-u twojego urządzenia; nie ma hasła, które mogłoby wyciec, a z tego, co przechowujemy, nikt nie zaloguje się jako ty.",
        },
        { lab: "Dodaj klucz dostępu" },
        {
          steps: [
            "Otwórz menu i wybierz Konto, a potem Bezpieczeństwo.",
            "Wybierz Dodaj klucz dostępu i postępuj zgodnie z podpowiedzią urządzenia.",
          ],
        },
        {
          p: "Jest też *weryfikacja dwuetapowa* z aplikacją uwierzytelniającą i kodami zapasowymi na wypadek zgubienia telefonu. Wydrukuj je i trzymaj gdzieś poza telefonem.",
        },
        {
          p: "Ta sama strona wypisuje ostatnią aktywność — logowania, nieudane logowania, dodany klucz dostępu, zmienione hasło — każde z przybliżoną lokalizacją, więc łatwo dostrzec coś, co nie pochodzi od ciebie. Jeśli coś wygląda źle, *wyloguj wszędzie* kończy każdą sesję poza tą, w której właśnie jesteś.",
        },
        {
          p: "Jest też *PIN rodzica*, który blokuje ustawienia konta, żeby dziecko na rodzinnym urządzeniu nie mogło ich zmienić ani usunąć profilu.",
        },
      ],
    },
    {
      id: "yours",
      nav: "Dostosuj to do siebie",
      heading: "Dostosuj to do siebie",
      blocks: [
        { lab: "Zmień motyw" },
        {
          steps: [
            "Otwórz menu i wybierz Konto, a potem Wygląd.",
            "Wybierz jasny, ciemny albo zgodny z urządzeniem.",
          ],
        },
        {
          p: "Jeśli żaden z gotowych motywów nie jest tym właściwym, *kreator motywów* pozwala zmieszać własny — łącznie z kolorami palców, którymi uczy klawiatura. Aplikacja mierzy kontrast tego, co wybierzesz, i odrzuca zestawienia, których nikt nie byłby w stanie odczytać.",
        },
        {
          p: "Każdy uczeń w domu może mieć swój własny kolor, więc wspólne urządzenie wciąż wydaje się należeć do tego, kto właśnie przy nim siedzi.",
        },
        { lab: "Zmień język strony" },
        {
          steps: ["Otwórz menu.", "W sekcji Język strony wybierz swój język."],
        },
        {
          p: "Na ekranie ćwiczeń możesz też w każdej chwili zmienić wielkość tekstu oraz włączyć lub wyłączyć dźwięki.",
        },
      ],
    },
    {
      id: "privacy",
      nav: "Prywatność",
      heading: "Prywatność w jednym zdaniu",
      blocks: [
        {
          p: "Żadnych reklam ani śledzenia. Profil dziecka nigdy nie opuszcza twojej przeglądarki. Zaloguj się tylko wtedy, gdy chcesz synchronizacji albo udostępniania; poza tym wszystko zostaje na tym urządzeniu, a ty możesz to skasować, kiedy tylko zechcesz.",
        },
      ],
    },
    {
      id: "signout",
      nav: "Wylogowanie",
      heading: "Wylogowanie",
      blocks: [
        { lab: "Wyloguj się" },
        { steps: ["Otwórz menu.", "Wybierz Wyloguj się i potwierdź."] },
        {
          p: "Historia twoich ćwiczeń zostaje bezpiecznie na tym urządzeniu — i na koncie, jeśli je masz — gotowa na następny raz, gdy siądziesz do pisania.",
        },
      ],
    },
    {
      id: "tips",
      nav: "Wskazówki",
      heading: "Kilka nawyków, które naprawdę pomagają",
      blocks: [
        {
          tips: [
            "Dokładność przed szybkością — to czyste pisanie zostaje na dłużej.",
            "Poprawiaj błędy spokojnie; nie pędź, żeby nadrobić.",
            "Trzymaj palce na rzędzie podstawowym — F i J mają małe wypustki.",
            "Kilka minut każdego dnia bije godzinę raz w tygodniu.",
          ],
        },
      ],
    },
  ],
};
