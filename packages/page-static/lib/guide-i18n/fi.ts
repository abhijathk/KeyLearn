import { type GuideTranslation } from "../guide-content.tsx";

export const fi: GuideTranslation = {
  kicker: "Kaikki, mitä voit tehdä",
  title: "Käyttöopas",
  dateline:
    "Täydellinen opas KeyLearniin — ensimmäisestä käynnistä uloskirjautumiseen",
  navLabel: "Tällä sivulla",
  sections: [
    {
      id: "account",
      nav: "Tarvitsenko tilin?",
      heading: "Tarvitsenko tilin?",
      blocks: [
        {
          p: "Et. Voit alkaa kirjoittaa heti kun saavut, ja edistymisesi tallentuu tähän laitteeseen. Luo ilmainen tili vain, jos haluat historiasi seuraavan sinua muille laitteille, säilyttää varmuuskopion tai jakaa profiililinkin. Mitään hyödyllistä ei ole lukittu kirjautumisen taakse.",
        },
      ],
    },
    {
      id: "signin",
      nav: "Kirjautuminen ja salasanat",
      heading: "Rekisteröityminen, kirjautuminen ja salasanat",
      blocks: [
        { p: "Kaikki löytyy oikean yläkulman valikosta." },
        { lab: "Luo tili" },
        {
          steps: [
            "Avaa valikko (oikeasta yläkulmasta).",
            "Valitse Rekisteröidy.",
            "Anna sähköpostiosoite ja salasana.",
            "Vahvista — ja olet sisällä.",
          ],
        },
        { lab: "Kirjaudu sisään" },
        {
          steps: [
            "Avaa valikko ja valitse Kirjaudu sisään.",
            "Anna sähköpostiosoitteesi ja salasanasi.",
          ],
        },
        { lab: "Nollaa unohtunut salasana" },
        {
          steps: [
            "Valitse kirjautumisnäytöllä Unohditko salasanan.",
            "Anna sähköpostiosoitteesi.",
            "Avaa lähettämämme nollauslinkki.",
            "Valitse uusi salasana ja kirjaudu sisään.",
          ],
        },
      ],
    },
    {
      id: "profiles",
      nav: "Profiilit",
      heading: "Profiilit koko perheelle",
      blocks: [
        {
          p: "KeyLearn on rakennettu kuin kotitalous: yhdellä tilillä on jopa neljä profiilia (kahdeksan premiumilla), aikuisia ja lapsia missä tahansa yhdistelmässä. Jokainen profiili säilyttää *oman* erillisen edistymisensä tässä laitteessa — mitään ei koskaan sekoiteta keskenään.",
        },
        { lab: "Lisää profiili" },
        {
          steps: [
            "Avaa valikko ja valitse Tili (tai ”Määritä profiilit”).",
            "Valitse Lisää profiili.",
            "Kirjoita etunimi.",
            "Merkitse se Aikuiseksi tai Lapseksi.",
            "Valitse avatar — ystävällinen kuvake tai Valokuva laitteeltasi.",
            "Lisää lapselle syntymävuosi (se vain sovittaa sanat ja tahdin hänen ikäänsä).",
            "Tallenna.",
          ],
        },
        { lab: "Vaihda toiseen oppijaan" },
        {
          steps: [
            "Avaa valikko.",
            "Napauta kasvoja kohdassa Oppijat — sovellus jatkaa siitä, mihin hän jäi.",
          ],
        },
        { lab: "Muokkaa tai poista profiili" },
        {
          steps: [
            "Avaa valikko ja valitse Tili.",
            "Valitse profiilin kohdalla Muokkaa tai poista se vapauttaaksesi paikan.",
          ],
        },
        {
          p: "Lapsiprofiilit saavat yksinkertaistetun, lukitun valikon, ja aikuisten toiminnot ovat nopean ”paljonko on A kertaa B?” -laskuportin takana, jotta pienimmät eivät eksy asetuksiin.",
        },
      ],
    },
    {
      id: "screen",
      nav: "Harjoitusnäyttö",
      heading: "Harjoitusnäyttö",
      blocks: [
        {
          p: "Ala vain kirjoittaa. Tarvitsemasi sana kelluu aivan näyttönäppäimistön yläpuolella; hehkuva komeetta osoittaa aivan seuraavaa näppäintä; näppäimet on sävytetty sormialueittain, jotta opit, mikä sormi yltää minnekin; ja himmeä lepäävien käsien pari näyttää, missä sormesi ovat painallusten välissä. Koko taito on yksi ainoa tapa: pidä katseesi sanoissa, älä käsissäsi.",
        },
      ],
    },
    {
      id: "journey",
      nav: "Matkasi",
      heading: "Miten oppitunnit kasvavat — matkasi",
      blocks: [
        {
          p: "KeyLearn on *mukautuva*. Se mittaa, kuinka nopeasti ja puhtaasti osut kuhunkin näppäimeen, ja lisää joukkoosi uuden kirjaimen vasta, kun osaat kirjoittaa nykyiset sekä nopeasti että tarkasti. Tuo kasvava joukko on sinun matkasi, kourallisesta kirjaimia koko aakkostoon — vaikeus nousee täsmälleen samaa tahtia kuin sinä, ei koskaan nopeammin, joten työskentelet aina juuri omalla rajallasi.",
        },
      ],
    },
    {
      id: "readout",
      nav: "Live-tilastot",
      heading: "Reaaliaikainen näyttö",
      blocks: [
        {
          p: "Kirjoittaessasi kelluva paneeli näyttää nykyisen nopeutesi ja tarkkuutesi, pienen viivakaavion viime suorituksista, tavoitteesi ja putkesi. Se on siellä kannustamassa sinua, ei nalkuttamassa.",
        },
      ],
    },
    {
      id: "tools",
      nav: "Harjoitustyökalut",
      heading: "Harjoitustyökalut",
      blocks: [
        {
          p: "Tekstin vieressä olevilla pienillä työkaluilla voit avata opastetun kierroksen, aloittaa nykyisen oppitunnin alusta (Ctrl + vasen), hypätä seuraavaan (Ctrl + oikea), näyttää tai piilottaa näyttönäppäimistön ja muuttaa harjoitustekstin kokoa. Rattaasta avautuvat täydet Asetukset, jotka kuvataan seuraavaksi.",
        },
      ],
    },
    {
      id: "content",
      nav: "Mitä kirjoitat",
      heading: "Kirjoitettavan sisällön valinta",
      blocks: [
        {
          p: "Avaa Asetukset ja siirry kohtaan Harjoitussisältö valitaksesi, miten sanasi muodostetaan:",
        },
        {
          tips: [
            "*Opastettu harjoitus* — mukautuva oletus, joka kasvattaa aakkostoasi näppäin kerrallaan.",
            "*Klassinen kurssi* — kiinteä, järjestyksessä etenevä marssi näppäinten läpi.",
            "*Yleiset sanat* — kielesi yleisimmät sanat.",
            "*Kirjateksti* — kirjoita itsesi läpi sovellukseen sisältyvien oikeiden kirjojen.",
            "*Oma teksti* — liitä mitä tahansa haluat ja harjoittele sillä.",
            "*Koodinpätkät* — sulkeet, symbolit ja koodin rytmi.",
            "*Numeroharjoitukset* — numerorivi ja numeronäppäimistö.",
          ],
        },
        { lab: "Vaihda kirjoitettavaa sisältöä" },
        {
          steps: [
            "Avaa Asetukset (ratas harjoitustekstin vieressä).",
            "Siirry kohtaan Harjoitussisältö.",
            "Valitse tila — Kirjateksti-tilassa valitse kirja, Oma teksti -tilassa liitä sanasi.",
            "Sulje Asetukset ja jatka kirjoittamista.",
          ],
        },
        {
          p: "Samalla näytöllä asetat aakkostosi koon, tavoitenopeuden, kunkin oppitunnin keston ja päivätavoitteen.",
        },
      ],
    },
    {
      id: "smart",
      nav: "Älyharjoitus",
      heading: "Älyharjoituksen apurit",
      blocks: [
        {
          p: "Opastetun harjoituksen päälle Älyharjoitus lisää lempeitä apureita: pullonkaulaharjoituksen, joka jäljittää hitaimmat näppäinparisi, välistetyn kertauksen, taidon ruostumista torjuvat virkistykset, jotka palaavat ruostuneisiin näppäimiin, älykkään itseluottamuksen ja näppäinten palautuksen. Ne ovat kaikki oletuksena päällä.",
        },
        { lab: "Kytke apuri päälle tai pois" },
        {
          steps: [
            "Avaa Asetukset.",
            "Siirry kohtaan Älyharjoitus.",
            "Kytke mikä tahansa apuri haluamallasi tavalla — tai jätä ne kaikki päälle.",
          ],
        },
      ],
    },
    {
      id: "keyboard",
      nav: "Näppäimistön asetukset",
      heading: "Näppäimistön määrittäminen",
      blocks: [
        {
          p: "Asetusten kohdassa Näppäimistön asetukset sovitat KeyLearnin näppäimistöösi ja siihen asetteluun, jonka haluat oppia.",
        },
        { lab: "Vaihda näppäimistöasettelua" },
        {
          steps: [
            "Avaa Asetukset.",
            "Siirry kohtaan Näppäimistön asetukset.",
            "Valitse kielesi ja sitten asettelusi (QWERTY, Dvorak, Colemak ja muita).",
            "Jätä ”Simuloi tätä asettelua” päälle, jotta voit harjoitella sitä riippumatta siitä, miten tietokoneesi on asetettu.",
            "Vahvista valintasi elävästä esikatselusta.",
          ],
        },
        {
          p: "Samalla näytöllä voit valita näppäimistön muodon, värittää näppäimet sormialueittain ja korostaa seuraavan näppäimen, kun vielä opettelet, missä mikäkin on.",
        },
      ],
    },
    {
      id: "display",
      nav: "Ulkoasu",
      heading: "Ulkoasu ja tuntuma",
      blocks: [
        {
          p: "Ulkoasun ja Tekstinsyötön asetuksilla voit näyttää nopeutesi sanoina tai merkkeinä minuutissa ja hienosäätää sitä, miltä kirjoittaminen tuntuu. Palauta oletukset on aina napin päässä, jos haluat aloittaa puhtaalta pöydältä.",
        },
      ],
    },
    {
      id: "progress",
      nav: "Edistymisesi",
      heading: "Edistymisesi — Profiili-sivu",
      blocks: [
        {
          p: "Profiili-sivu on täysi tallenteesi: ylhäällä Kaikkien aikojen ja Tänään -tilastot (harjoiteltu aika, tehdyt oppitunnit, paras ja tavanomainen nopeutesi ja tarkkuutesi sekä miten tämä päivä vertautuu niihin); kartta kaikista avaamistasi kirjaimista; tarina siitä, miten kukin yksittäinen näppäin on nopeutunut, tasoitusliukurin kera; kokonaiskuva jokaisesta näppäimestä ajan mittaan; ja hitaimmat siirtymät, jotka yhä hidastavat sinua. Voit jopa kilpailla oman edellisen suorituksesi haamua vastaan tunteaksesi edistymisen suoraan.",
        },
        { lab: "Avaa edistymisesi" },
        {
          steps: [
            "Avaa valikko.",
            "Valitse Profiili.",
            "Käytä suodatinriviä keskittyäksesi kirjaimiin, numeroihin, välimerkkeihin tai symboleihin.",
          ],
        },
      ],
    },
    {
      id: "data",
      nav: "Tietosi",
      heading: "Tiedoistasi huolehtiminen",
      blocks: [
        { lab: "Tyhjennä profiilin tilastot" },
        {
          steps: [
            "Avaa Profiili sille oppijalle, jonka haluat nollata.",
            "Vieritä sivun alalaidassa olevaan nollaustoimintoon.",
            "Vahvista ”Pyyhi kaikki” — vain tämä profiili tyhjennetään.",
          ],
        },
        { lab: "Lataa tietosi" },
        {
          steps: [
            "Avaa Profiili.",
            "Tallenna historiasi tiedostoksi lataustoiminnolla.",
          ],
        },
        {
          p: "Kirjaudu sisään, jos haluat historiasi synkronoituvan laitteiden välillä ja haluat jakaa julkisen profiililinkin. Mainoksia tai seuraimia ei ole, ja voit poistaa tietosi — tai koko tilisi — milloin tahansa.",
        },
      ],
    },
    {
      id: "kids",
      nav: "Lastentila",
      heading: "Lastentila",
      blocks: [
        {
          p: "Lapset harjoittelevat leikkisällä polulla. Jokainen oikea näppäin vie hahmoa askeleen lähemmäs kotia, ja hahmo kasvaa pikkuvauvasta täysikasvuiseksi sankariksi, kun lisää kirjaimia avautuu. Vasta opittu näppäin laukaisee pienen juhlan, ja jokainen istunto päättyy kodikkaalle nuotiolle.",
        },
        { lab: "Siirry lastentilaan" },
        {
          steps: [
            "Avaa valikko.",
            "Valitse Lapset — tai valitse lapsiprofiili kohdasta Oppijat.",
          ],
        },
        {
          p: "Valittavana on kaksi maailmaa — Dino Run ystävällisen dinosauruksen kanssa ja Hero Trail, jossa ritari seikkailee metsän halki — kummassakin oma valittava hahmonsa.",
        },
      ],
    },
    {
      id: "toybox",
      nav: "Lasten leikkilaatikko",
      heading: "Lasten leikkilaatikko",
      blocks: [
        { lab: "Avaa leikkilaatikko" },
        {
          steps: ["Napauta lastennäytöllä pelialueen yläreunan ratasta."],
        },
        {
          p: "Sisältä voit asettaa maailman ja hahmon, Isot kirjaimet, Äänet, Auttavat kädet (hehkuvan sormiopastuksen), Näppäimistön (piilotettu, yksinkertainen tai täysi aikuisten näppäimistö), Kirjaimet polulla (sanat näytettynä palikoina suoraan pelissä), istunnon Ajastimen, Kannustukset (rohkaisevat pienet viestit) ja — Lisäasetusten alle kätkettynä — liukurit Kirkkaudelle, Värille ja sille, kuinka eloisalta maailma tuntuu. Tarjolla on rauhallinen yöilme kirkkaan päiväilmeen rinnalla.",
        },
      ],
    },
    {
      id: "ages",
      nav: "Kasvaminen",
      heading: "Kasvamme lapsesi mukana",
      blocks: [
        {
          p: "KeyLearn virittää itsensä huomaamatta lapsen ikään. Nuorimmat näkevät isot, ystävälliset kirjaimet, anteeksiantavan tahdin, kirjainpalikat suoraan polulla ja lempeimmän avun; vanhemmat lapset siirtyvät pidempiin sanoihin, täyteen näppäimistöön ja selkeämpään ulkoasuun. Aseta vain syntymävuosi profiiliin, ja loppu seuraa itsestään.",
        },
      ],
    },
    {
      id: "modes",
      nav: "Muut tilat",
      heading: "Muita tapoja harjoitella",
      blocks: [
        {
          p: "Päivittäisen harjoituksesi lisäksi on *Nopeustesti* — nopea kertaluonteinen kappale, joka kertoo sanat minuutissa ja tarkkuuden ilman oppituntia; *Asettelut*-selain näppäimistöasettelujen ja niiden sormikarttojen vertailuun; *Huipputulokset*, joista näet miten pärjäät; ja *Moninpeli*-kisat, joissa voit koetella nopeuttasi muita vastaan reaaliajassa.",
        },
        { lab: "Mistä ne löytyvät" },
        {
          steps: [
            "Avaa valikko.",
            "Valitse Nopeustesti, Asettelut, Huipputulokset tai Moninpeli.",
          ],
        },
      ],
    },
    {
      id: "access",
      nav: "Jos jokin on tiellä",
      heading: "Jos jokin sovelluksessa on tielläsi",
      blocks: [
        {
          p: "Tätä varten on kokonainen sivu, ja se asetetaan *oppijakohtaisesti* — joten yhden ihmisen säädöt eivät koskaan muuta kenenkään muun asetuksia.",
        },
        { lab: "Avaa se" },
        {
          steps: [
            "Avaa valikko ja valitse Tili.",
            "Valitse Saavutettavuus.",
            "Valitse oppija ylhäältä ja kytke sitten päälle niin monta asetusta kuin tarvitset.",
          ],
        },
        {
          p: "Nämä viisi asetusta *yhdistyvät*. Lukihäiriöinen ihminen, jolla on vapina, tarvitsee niistä kaksi, ja yhden valitsemaan pakottaminen olisi sovelluksen tapa kysyä, kumman vaikeuden se suostuu huomioimaan.",
        },
        {
          tips: [
            "Rauhallinen — mikään ei liiku, mitään ei lasketa, mitään ei ajasteta, eikä väliin jäänyt päivä katkaise putkea.",
            "Vähemmän kerralla — harjoitus avautuu pelkillä sanoilla ja näppäimistöllä.",
            "Helpompi lukea — lukihäiriötä varten suunniteltu kirjasin, enemmän tilaa kirjainten ja rivien välissä, vahvempi teksti.",
            "Värit erilleen — sormivärit, jotka pysyvät erottuvina värisokeudessakin, ja virheet kerrottuna äänellä punaisen lisäksi.",
            "Vakaammat kädet — isommat painettavat kohteet, ei kahta näppäintä yhtä aikaa, eikä itseään toistavaa näppäintä lasketa kahdesti.",
          ],
        },
        {
          p: "Näiden alla *Aseta jokainen itse* avaa jokaisen kytkimen erikseen — niitä on viisitoista, mukaan lukien puhenopeus, tekstitykset kaikelle ääneen sanotulle, sormen numero jokaisessa näppäimessä ja se, kuinka kauan toistuvaa näppäintä ei huomioida. Yksi painike palauttaa ne kaikki ennalleen.",
        },
      ],
    },
    {
      id: "braille",
      nav: "Pistekirjoitus",
      heading: "Oppiminen pistekirjoitusnäppäimistöllä",
      blocks: [
        {
          p: "Sokea tai heikkonäköinen oppija saa aivan oman sivunsa — kuuden näppäimen pistekirjoitussyötön, kirjainten sijaan soluihin perustuvan opetussuunnitelman ja puhutun opastuksen koko matkan ajan. Se on erillinen tapa oppia kirjoittamaan, ei näkevien sivu ääneen luettuna.",
        },
        { lab: "Kytke se päälle oppijalle" },
        {
          steps: [
            "Avaa valikko ja valitse Tili, sitten Oppijat.",
            "Muokkaa oppijaa tai lisää uusi.",
            "Kytke näkötuki päälle ja tallenna.",
          ],
        },
        {
          p: "Kyseinen oppija siirtyy nyt suoraan pistekirjoitussivulle aina kun hän on harjoittelemassa. Hänen edistymisensä lasketaan soluina kirjainten sijaan, ja hän voi ansaita todistuksen samoin ehdoin kuin kuka tahansa muu.",
        },
      ],
    },
    {
      id: "courses",
      nav: "Kaksi kurssia",
      heading: "Opastettu harjoitus, Klassinen ja koodi",
      blocks: [
        {
          p: "*Opastettu harjoitus* on mukautuva kurssi: se tarkkailee, mitkä näppäimet hidastavat sinua, ja rakentaa oppituntisi niiden ympärille lisäten kirjaimen vasta, kun osaat kirjoittaa jo oppimasi sekä nopeasti että tarkasti.",
        },
        {
          p: "*Klassinen kurssi* on vanhanaikainen: kiinteä oppituntien tikapuu määrätyssä järjestyksessä, kuten konekirjoituksen oppikirja opettaisi. Jotkut yksinkertaisesti pitävät siitä, että tietävät mitä seuraavaksi tulee.",
        },
        {
          p: "Ne ovat erillisiä kursseja erillisine historioineen, ja todistus ansaitaan jommallakummalla — ei koskaan molemmilla yhteenlaskettuna, mikä laskisi ensimmäisen viikkosi kahdesti. Tilisi Kurssi-sivu kertoo, kummasta se raportoi.",
        },
        {
          p: "*Koodikäsityö* on kolmas harjoituksen laji: oikeita pätkiä valitsemallasi kielellä, jotta sulkeet, puolipisteet ja sisennykset saavat sen harjoituksen, jota tavallinen proosa ei niille koskaan anna.",
        },
        { lab: "Vaihda niiden välillä" },
        {
          steps: [
            "Avaa harjoitusnäytöllä oppituntiasetukset.",
            "Valitse Opastettu harjoitus, Klassinen kurssi tai Koodikäsityö.",
          ],
        },
      ],
    },
    {
      id: "certificates",
      nav: "Todistukset",
      heading: "Todistuksen ansaitseminen",
      blocks: [
        {
          p: "Todistus kertoo, että nimetty oppija kirjoitti mitatulla nopeudella ja tarkkuudella, tietyllä kielellä, tiettynä päivänä. Sen myönnämme me — se ei ole tutkinto, jonka mikään tutkintolautakunta tai työnantaja olisi suostunut tunnustamaan — ja se on rehellinen todiste siitä, mitä joku on oikeasti tehnyt.",
        },
        { lab: "Katso, kuinka kaukana olet" },
        {
          steps: [
            "Avaa valikko ja valitse Tili.",
            "Valitse Kurssi.",
            "Jokaisella oppijalla on rivi, joka näyttää kaikki ehdot ja sen, kuinka pitkällä hän niissä on.",
          ],
        },
        {
          p: "Ehtoja ovat esimerkiksi se, että jokainen kirjain on esitelty, jokainen kirjain on luotettava eikä vain kertaalleen kohdattu, tarpeeksi oppitunteja, tarpeeksi erillisiä päiviä sekä pysyvä nopeus ja tarkkuus. Kun kaikki täyttyvät, riville ilmestyy linkki kokeen suorittamiseen.",
        },
        {
          p: "Koe on lyhyt, ja se arvioidaan palvelimillamme eikä selaimessasi. Läpäise se, ja todistus myönnetään numerolla varustettuna. Kuka tahansa, jolle annat sen numeron, voi tarkistaa sen *Tarkista todistus* -sivulla — ja sinä päätät, näytetäänkö nimesi hänelle.",
        },
      ],
    },
    {
      id: "security",
      nav: "Tilisi turvana",
      heading: "Pääsyavaimet, koodit ja kuka on kirjautunut sisään",
      blocks: [
        {
          p: "Voit kirjautua salasanalla, palveluntarjoajalla kuten Google, sähköpostiin lähetetyllä linkillä — tai *pääsyavaimella*, jonka me itse valitsisimme. Pääsyavain käyttää laitteesi omaa sormenjälkeä, kasvoja tai PIN-koodia; vuotavaa salasanaa ei ole, eikä mitään hallussamme olevaa voisi käyttää sinuna kirjautumiseen.",
        },
        { lab: "Lisää pääsyavain" },
        {
          steps: [
            "Avaa valikko ja valitse Tili, sitten Turvallisuus.",
            "Valitse Lisää pääsyavain ja seuraa laitteesi kehotetta.",
          ],
        },
        {
          p: "*Kaksivaiheinen vahvistus* on myös tarjolla todennussovelluksella, ja mukana ovat palautuskoodit siltä varalta, että kadotat puhelimen. Tulosta ne jonnekin muualle kuin puhelimeen.",
        },
        {
          p: "Sama sivu listaa viimeaikaisen toiminnan — kirjautumiset, epäonnistuneet kirjautumiset, lisätyn pääsyavaimen, vaihdetun salasanan — kunkin karkean sijainnin kanssa, joten jokin, mitä et itse tehnyt, on helppo huomata. Jos jokin näyttää väärältä, *kirjaudu ulos kaikkialta* päättää jokaisen istunnon paitsi sen, jota juuri käytät.",
        },
        {
          p: "Tarjolla on myös *vanhemman PIN*, joka lukitsee tilin asetukset, jottei perheen laitteella oleva lapsi voi muuttaa niitä tai poistaa profiilia.",
        },
      ],
    },
    {
      id: "yours",
      nav: "Tee siitä omasi",
      heading: "Tee siitä omasi",
      blocks: [
        { lab: "Vaihda teema" },
        {
          steps: [
            "Avaa valikko ja valitse Tili, sitten Ulkoasu.",
            "Valitse vaalea, tumma tai laitteen mukaan.",
          ],
        },
        {
          p: "Jos mikään mukana tulevista teemoista ei ole se oikea, *teemasuunnittelija* antaa sinun sekoittaa omasi — mukaan lukien sormivärit, joilla näppäimistö opettaa. Sovellus mittaa valintojesi kontrastin ja kieltäytyy yhdistelmistä, joita kukaan ei voisi lukea.",
        },
        {
          p: "Jokaisella kotitalouden oppijalla voi olla oma värinsä, joten jaettu laite tuntuu silti kuuluvan sille, joka sen ääressä istuu.",
        },
        { lab: "Vaihda sivuston kieli" },
        {
          steps: ["Avaa valikko.", "Valitse kielesi kohdasta Sivuston kieli."],
        },
        {
          p: "Harjoitusnäytöllä voit myös muuttaa tekstin kokoa ja kytkeä äänet päälle tai pois milloin haluat.",
        },
      ],
    },
    {
      id: "privacy",
      nav: "Yksityisyys",
      heading: "Yksityisyys yhdellä lauseella",
      blocks: [
        {
          p: "Ei mainoksia eikä seuraimia. Lapsen profiili ei koskaan poistu selaimestasi. Kirjaudu sisään vain, jos haluat synkronointia tai jakamista; muuten kaikki pysyy tässä laitteessa, ja voit vapaasti poistaa sen milloin tahansa.",
        },
      ],
    },
    {
      id: "signout",
      nav: "Uloskirjautuminen",
      heading: "Uloskirjautuminen",
      blocks: [
        { lab: "Kirjaudu ulos" },
        {
          steps: ["Avaa valikko.", "Valitse Kirjaudu ulos ja vahvista."],
        },
        {
          p: "Harjoitushistoriasi säilyy turvassa tässä laitteessa — ja tililläsi, jos loit sellaisen — valmiina seuraavaan kertaan, kun istut kirjoittamaan.",
        },
      ],
    },
    {
      id: "tips",
      nav: "Vinkit",
      heading: "Muutama tapa, joista on oikeasti apua",
      blocks: [
        {
          tips: [
            "Tarkkuus ennen nopeutta — puhdas kirjoittaminen on se, joka jää mieleen.",
            "Korjaa virheet rauhassa; älä kiirehdi ottamaan menetettyä kiinni.",
            "Lepuuta sormia perusrivillä — F- ja J-näppäimissä on pienet kohoumat.",
            "Muutama minuutti joka päivä voittaa tunnin kerran viikossa.",
          ],
        },
      ],
    },
  ],
};
