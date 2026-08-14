import { type GuideTranslation } from "../guide-content.tsx";

export const is: GuideTranslation = {
  kicker: "Allt sem þú getur gert",
  title: "Notendahandbók",
  dateline:
    "Heildarleiðarvísirinn að KeyLearn — frá fyrstu heimsókn til útskráningar",
  navLabel: "Á þessari síðu",
  sections: [
    {
      id: "account",
      nav: "Þarf ég aðgang?",
      heading: "Þarf ég aðgang?",
      blocks: [
        {
          p: "Nei. Þú getur byrjað að skrifa um leið og þú kemur inn, og framvindan þín geymist hér á þessu tæki. Búðu aðeins til ókeypis aðgang ef þú vilt að ferillinn fylgi þér yfir í önnur tæki, hafa afrit, eða deila hlekk á prófílinn þinn. Ekkert gagnlegt er læst á bak við innskráningu.",
        },
      ],
    },
    {
      id: "signin",
      nav: "Innskráning og lykilorð",
      heading: "Nýskráning, innskráning og lykilorð",
      blocks: [
        { p: "Allt er í valmyndinni efst til hægri." },
        { lab: "Búa til aðgang" },
        {
          steps: [
            "Opnaðu valmyndina (efst til hægri).",
            "Veldu Nýskrá.",
            "Sláðu inn netfang og lykilorð.",
            "Staðfestu — og þú ert kominn inn.",
          ],
        },
        { lab: "Skrá sig inn" },
        {
          steps: [
            "Opnaðu valmyndina og veldu Skrá inn.",
            "Sláðu inn netfangið þitt og lykilorðið.",
          ],
        },
        { lab: "Endurstilla gleymt lykilorð" },
        {
          steps: [
            "Á innskráningarskjánum velurðu Gleymt lykilorð.",
            "Sláðu inn netfangið þitt.",
            "Opnaðu endurstillingarhlekkinn sem við sendum þér.",
            "Veldu nýtt lykilorð og skráðu þig inn.",
          ],
        },
      ],
    },
    {
      id: "profiles",
      nav: "Prófílar",
      heading: "Prófílar fyrir allt heimilið",
      blocks: [
        {
          p: "KeyLearn er byggt eins og heimili: einn aðgangur rúmar allt að fjóra prófíla (átta með premium), fullorðna og börn í hvaða blöndu sem er. Hver prófíll geymir *sína eigin* framvindu á þessu tæki — engu er nokkurn tíma blandað saman.",
        },
        { lab: "Bæta við prófíl" },
        {
          steps: [
            "Opnaðu valmyndina og veldu Aðgangur (eða „Setja upp prófíla“).",
            "Veldu Bæta við prófíl.",
            "Sláðu inn fornafn.",
            "Merktu hann sem Fullorðinn eða Barn.",
            "Veldu mynd — vinalegt tákn, eða Ljósmynd úr tækinu þínu.",
            "Fyrir barn skaltu bæta við fæðingarári (það stillir aðeins orðin og hraðann að aldrinum).",
            "Vistaðu.",
          ],
        },
        { lab: "Skipta yfir á annan nemanda" },
        {
          steps: [
            "Opnaðu valmyndina.",
            "Ýttu á andlit undir Nemendur — appið heldur áfram þar sem frá var horfið.",
          ],
        },
        { lab: "Breyta prófíl eða eyða honum" },
        {
          steps: [
            "Opnaðu valmyndina og veldu Aðgangur.",
            "Veldu Breyta á prófíl, eða eyddu honum til að losa pláss.",
          ],
        },
        {
          p: "Barnaprófílar fá einfaldaða og læsta valmynd, og aðgerðir fullorðinna eru á bak við snöggt „hvað er A sinnum B?“ reikningshlið, svo þau litlu villist ekki inn í stillingarnar.",
        },
      ],
    },
    {
      id: "screen",
      nav: "Æfingaskjárinn",
      heading: "Æfingaskjárinn",
      blocks: [
        {
          p: "Byrjaðu bara að skrifa. Orðið sem þú þarft svífur rétt fyrir ofan lyklaborðið á skjánum; glóandi halastjarna bendir á næsta lykil; lyklarnir eru litaðir eftir fingrasvæði svo þú lærir hvaða fingur nær hvert; og daufar hendur í hvíld sýna hvar fingurnir eiga að liggja milli áslátta. Öll kúnstin er einn vani: haltu augunum á orðunum, ekki á höndunum.",
        },
      ],
    },
    {
      id: "journey",
      nav: "Ferðalagið þitt",
      heading: "Hvernig æfingarnar vaxa — ferðalagið þitt",
      blocks: [
        {
          p: "KeyLearn er *aðlagandi*. Það mælir hversu hratt og hreint þú slærð hvern lykil og bætir aðeins nýjum staf við safnið þitt þegar þú getur skrifað þá sem fyrir eru bæði hratt og rétt. Þetta vaxandi safn er ferðalagið þitt, frá örfáum stöfum upp í allt stafrófið — erfiðleikinn eykst nákvæmlega jafn hratt og þú, aldrei hraðar, svo þú vinnur alltaf á þínum eigin mörkum.",
        },
      ],
    },
    {
      id: "readout",
      nav: "Lifandi tölur",
      heading: "Lifandi mælaborðið",
      blocks: [
        {
          p: "Meðan þú skrifar sýnir fljótandi spjaldið hraðann þinn og nákvæmni, litla línu yfir nýlegar umferðir, markmiðin þín og samfelluna. Það er þar til að hvetja þig, ekki til að nöldra.",
        },
      ],
    },
    {
      id: "tools",
      nav: "Æfingatól",
      heading: "Æfingatól",
      blocks: [
        {
          p: "Litlu tólin við hliðina á textanum leyfa þér að opna leiðsögn, byrja núverandi æfingu upp á nýtt (Ctrl + Örvatakki vinstri), hoppa yfir á þá næstu (Ctrl + Örvatakki hægri), sýna eða fela lyklaborðið á skjánum, og breyta stærð æfingatextans. Tannhjólið opnar allar Stillingar, sem lýst er hér á eftir.",
        },
      ],
    },
    {
      id: "content",
      nav: "Hvað þú skrifar",
      heading: "Að velja hvað þú skrifar",
      blocks: [
        {
          p: "Opnaðu Stillingar og farðu í Æfingaefni til að velja hvernig orðin þín verða til:",
        },
        {
          tips: [
            "*Leidd æfing* — aðlagandi sjálfgefna leiðin sem stækkar stafrófið þitt lykil fyrir lykil.",
            "*Klassískt námskeið* — föst og skipuleg ganga í gegnum lyklana.",
            "*Algeng orð* — algengustu orðin í tungumálinu þínu.",
            "*Bókatexti* — skrifaðu þig í gegnum alvöru bækur sem fylgja appinu.",
            "*Þinn eigin texti* — límdu inn hvað sem þú vilt og æfðu þig á því.",
            "*Kóðabútar* — svigar, tákn og taktur kóðans.",
            "*Töluæfingar* — talnaröðin og talnaborðið.",
          ],
        },
        { lab: "Breyta því sem þú skrifar" },
        {
          steps: [
            "Opnaðu Stillingar (tannhjólið við æfingatextann).",
            "Farðu í Æfingaefni.",
            "Veldu ham — fyrir Bókatexta velurðu bók, fyrir Þinn eigin texta límirðu inn orðin þín.",
            "Lokaðu Stillingum og haltu áfram að skrifa.",
          ],
        },
        {
          p: "Á sama skjá stillirðu stærð stafrófsins, hraðamarkmið, hversu lengi hver æfing stendur, og daglegt markmið.",
        },
      ],
    },
    {
      id: "smart",
      nav: "Snjöll æfing",
      heading: "Hjálparhellur snjallrar æfingar",
      blocks: [
        {
          p: "Ofan á leidda æfingu bætir Snjöll æfing við mildum hjálparhellum: flöskuhálsaæfingu sem eltir uppi hægustu lyklapörin þín, dreifða upprifjun, upprifjun á ryðguðum lyklum, snjallt sjálfstraust, og lyklaendurheimt. Þær eru allar kveiktar sjálfgefið.",
        },
        { lab: "Kveikja eða slökkva á hjálparhellu" },
        {
          steps: [
            "Opnaðu Stillingar.",
            "Farðu í Snjalla æfingu.",
            "Kveiktu eða slökktu á þeim sem þú vilt — eða láttu þær allar vera á.",
          ],
        },
      ],
    },
    {
      id: "keyboard",
      nav: "Uppsetning lyklaborðs",
      heading: "Að stilla lyklaborðið þitt",
      blocks: [
        {
          p: "Í Stillingum, undir Uppsetning lyklaborðs, samræmirðu KeyLearn við lyklaborðið þitt og við uppsetninguna sem þú vilt læra.",
        },
        { lab: "Skipta um lyklaborðsuppsetningu" },
        {
          steps: [
            "Opnaðu Stillingar.",
            "Farðu í Uppsetningu lyklaborðs.",
            "Veldu tungumálið þitt, síðan uppsetninguna (QWERTY, Dvorak, Colemak og fleiri).",
            "Hafðu „Herma eftir þessari uppsetningu“ kveikt svo þú getir æft hana hvernig sem tölvan þín er stillt.",
            "Fylgstu með lifandi forskoðuninni til að staðfesta.",
          ],
        },
        {
          p: "Á sama skjá geturðu valið lögun lyklaborðsins, litað lyklana eftir fingrasvæði, og látið næsta lykil lýsa upp meðan þú ert enn að læra hvar hlutirnir eru.",
        },
      ],
    },
    {
      id: "display",
      nav: "Útlit",
      heading: "Útlit og tilfinning",
      blocks: [
        {
          p: "Stillingarnar Útlit og Textainnsláttur leyfa þér að sýna hraðann þinn í orðum eða stöfum á mínútu og fínstilla hvernig innslátturinn upplifist. Endurstilla sjálfgefið er alltaf einn smellur í burtu ef þú vilt byrja upp á nýtt.",
        },
      ],
    },
    {
      id: "progress",
      nav: "Framvindan þín",
      heading: "Framvindan þín — prófílsíðan",
      blocks: [
        {
          p: "Prófílsíðan er heildarskráin þín: tölur fyrir Allan tímann og Í dag efst (æfður tími, kláraðar æfingar, besti og dæmigerði hraði og nákvæmni, og hvernig dagurinn í dag stendur í samanburði); kort af hverjum staf sem þú hefur opnað; sagan af því hvernig hver einstakur lykill hefur hraðað sér, með sléttunarsleða; heildarmyndin af öllum lyklum yfir tíma; og hægustu skiptin sem enn halda aftur af þér. Þú getur meira að segja keppt við þína eigin síðustu umferð sem draug til að finna framförina beint.",
        },
        { lab: "Opna framvinduna þína" },
        {
          steps: [
            "Opnaðu valmyndina.",
            "Veldu Prófíll.",
            "Notaðu síuröðina til að einbeita þér að Bókstöfum, Tölustöfum, Greinarmerkjum eða Táknum.",
          ],
        },
      ],
    },
    {
      id: "data",
      nav: "Gögnin þín",
      heading: "Að passa upp á gögnin þín",
      blocks: [
        { lab: "Hreinsa tölfræði prófíls" },
        {
          steps: [
            "Opnaðu Prófíl fyrir nemandann sem þú vilt núllstilla.",
            "Skrunaðu niður að endurstillingarstýringunni neðst á síðunni.",
            "Staðfestu „Eyða öllu“ — aðeins þessi prófíll er hreinsaður.",
          ],
        },
        { lab: "Sækja gögnin þín" },
        {
          steps: [
            "Opnaðu Prófíl.",
            "Notaðu niðurhalsvalkostinn til að vista ferilinn þinn sem skrá.",
          ],
        },
        {
          p: "Skráðu þig inn ef þú vilt að ferillinn samstillist milli tækja og til að deila opinberum prófílhlekk. Það eru engar auglýsingar og engir rekjarar, og þú getur eytt gögnunum þínum — eða öllum aðgangnum — hvenær sem þú vilt.",
        },
      ],
    },
    {
      id: "kids",
      nav: "Barnahamur",
      heading: "Barnahamur",
      blocks: [
        {
          p: "Börn æfa sig á leikandi slóð. Hver réttur lykill færir persónuna þeirra einu skrefi nær heim, og persónan vex úr pínulitlu barni í fullvaxna hetju eftir því sem fleiri stafir opnast. Nýlærður lykill setur af stað litla hátíð, og hver lota endar við notalegan varðeld.",
        },
        { lab: "Skipta yfir í Börn" },
        {
          steps: [
            "Opnaðu valmyndina.",
            "Veldu Börn — eða veldu barnaprófíl undir Nemendur.",
          ],
        },
        {
          p: "Það eru tveir heimar til að velja úr — Dino Run, með vinalegri risaeðlu, og Hero Trail, þar sem riddari fer í leiðangur um skóg — hvor með sína persónu til að velja.",
        },
      ],
    },
    {
      id: "toybox",
      nav: "Leikfangakassi barnanna",
      heading: "Leikfangakassi barnanna",
      blocks: [
        { lab: "Opna leikfangakassann" },
        {
          steps: ["Á barnaskjánum ýtirðu á tannhjólið efst á leiksvæðinu."],
        },
        {
          p: "Þar inni geturðu stillt heiminn og persónuna, Stóra stafi, Hljóð, Hjálparhendur (glóandi fingraleiðsögnina), Lyklaborðið (falið, einfalt, eða fullorðinsborðið í heild), Stafi á slóðinni (orðin sýnd sem kubbar beint í leiknum), Tímamæli fyrir lotuna, Hvatningu (lítil uppörvandi skilaboð), og — falið undir Ítarlegt — sleða fyrir Birtu, Liti og hversu fjörugur heimurinn er. Það er til rólegt næturútlit jafnt sem bjarta dagsútlitið.",
        },
      ],
    },
    {
      id: "ages",
      nav: "Að vaxa",
      heading: "Að vaxa með barninu þínu",
      blocks: [
        {
          p: "KeyLearn stillir sig hljóðlega að aldri barnsins. Þau yngstu sjá stóra og vinalega stafi, mildan hraða, stafakubba beint á slóðinni og allra blíðustu hjálpina; eldri börn færast yfir í lengri orð, allt lyklaborðið og hreinna útlit. Þú stillir bara fæðingarárið á prófílnum og afgangurinn fylgir af sjálfu sér.",
        },
      ],
    },
    {
      id: "modes",
      nav: "Aðrir hamir",
      heading: "Aðrar leiðir til að æfa",
      blocks: [
        {
          p: "Fyrir utan daglegu æfinguna er *Hraðapróf* — stuttur einstakur texti sem segir þér orð á mínútu og nákvæmni án nokkurrar æfingar; *Uppsetningar* til að bera saman lyklaborðsuppsetningar og fingrakortin þeirra; *Stigatafla* til að sjá hvar þú stendur; og *Fjölspilun* þar sem þú keppir við aðra í rauntíma.",
        },
        { lab: "Finna þau" },
        {
          steps: [
            "Opnaðu valmyndina.",
            "Veldu Hraðapróf, Uppsetningar, Stigatöflu eða Fjölspilun.",
          ],
        },
      ],
    },
    {
      id: "access",
      nav: "Ef eitthvað er fyrir þér",
      heading: "Ef eitthvað í appinu er fyrir þér",
      blocks: [
        {
          p: "Það er heil síða fyrir þetta, og hún er stillt *fyrir hvern nemanda* — svo breytingar eins manns hafa aldrei áhrif á neinn annan.",
        },
        { lab: "Opna hana" },
        {
          steps: [
            "Opnaðu valmyndina og veldu Aðgangur.",
            "Veldu Aðgengi.",
            "Veldu nemandann efst, kveiktu svo á eins mörgum stillingum og þú þarft.",
          ],
        },
        {
          p: "Stillingarnar fimm *vinna saman*. Sá sem er lesblindur og með skjálfta þarf tvær þeirra, og að vera neyddur til að velja eina væri appið að spyrja hvorn erfiðleikann eigi að taka tillit til.",
        },
        {
          tips: [
            "Ró — ekkert hreyfist, ekkert er talið, ekkert er tímamælt, og týndur dagur slítur ekki samfelluna.",
            "Færra í einu — æfingin opnast með aðeins orðunum og lyklaborðinu.",
            "Auðveldara að lesa — letrið sem gert er fyrir lesblindu, meira bil milli stafa og lína, sterkari texti.",
            "Aðgreindir litir — fingralitir sem haldast aðgreindir við litblindu, og mistök sögð með hljóði jafnt sem rauðu.",
            "Stöðugri hendur — stærri hlutir til að ýta á, aldrei tveir lyklar í einu, og lykill sem endurtekur sig er ekki talinn tvisvar.",
          ],
        },
        {
          p: "Undir þeim opnar *Stilla hvert atriði sjálf* alla rofana hvern fyrir sig — fimmtán talsins, þar á meðal talhraða, skjátexta fyrir allt sem sagt er upphátt, fingranúmer á hverjum lykli, og hversu lengi eigi að hunsa endurtekinn lykil. Einn hnappur setur þá alla til baka.",
        },
      ],
    },
    {
      id: "braille",
      nav: "Blindraletur",
      heading: "Að læra á blindraletursborð",
      blocks: [
        {
          p: "Nemandi sem er blindur eða sjónskertur fær allt aðra síðu — sex lykla blindraletursinnslátt, námskrá í sellum frekar en stöfum, og talaða leiðsögn allan tímann. Þetta er önnur leið til að læra að vélrita, ekki síðan fyrir sjáandi lesin upphátt.",
        },
        { lab: "Kveikja á því fyrir nemanda" },
        {
          steps: [
            "Opnaðu valmyndina og veldu Aðgangur, svo Nemendur.",
            "Breyttu nemandanum, eða bættu við nýjum.",
            "Kveiktu á sjónstuðningi og vistaðu.",
          ],
        },
        {
          p: "Sá nemandi fer nú beint á blindraletursíðuna þegar hann er sá sem æfir. Framvindan hans er talin í sellum frekar en stöfum, og hann getur unnið sér inn skírteini á sömu forsendum og allir aðrir.",
        },
      ],
    },
    {
      id: "courses",
      nav: "Námskeiðin tvö",
      heading: "Leidd æfing, Klassískt og kóði",
      blocks: [
        {
          p: "*Leidd æfing* er aðlagandi námskeiðið: það fylgist með hvaða lyklar hægja á þér og byggir æfingarnar í kringum þá, og bætir staf aðeins við þegar þú getur skrifað þá sem þú hefur bæði hratt og rétt.",
        },
        {
          p: "*Klassískt námskeið* er það gamaldags — fastur stigi æfinga í ákveðinni röð, eins og vélritunarbók myndi kenna. Sumum finnst einfaldlega betra að vita hvað kemur næst.",
        },
        {
          p: "Þetta eru aðskilin námskeið með aðskildum ferli, og skírteini er unnið á öðru hvoru — aldrei á báðum lögðum saman, því þá teldist fyrsta vikan þín tvisvar. Námskeiðssíðan á aðgangnum þínum segir hvort hún er að fjalla um.",
        },
        {
          p: "*Kóðasmíð* er þriðja tegund æfingar: alvöru bútar á tungumáli sem þú velur, svo svigarnir, semíkommurnar og inndrátturinn fái þá þjálfun sem venjulegur texti gefur þeim aldrei.",
        },
        { lab: "Skipta á milli þeirra" },
        {
          steps: [
            "Á æfingaskjánum opnarðu æfingastillingarnar.",
            "Veldu Leidda æfingu, Klassískt námskeið eða Kóðasmíð.",
          ],
        },
      ],
    },
    {
      id: "certificates",
      nav: "Skírteini",
      heading: "Að vinna sér inn skírteini",
      blocks: [
        {
          p: "Skírteini segir að tilgreindur nemandi hafi skrifað á mældum hraða og með mældri nákvæmni, á tilteknu tungumáli, á tilteknum degi. Það er gefið út af okkur — það er ekki réttindi sem nokkurt prófanefnd eða vinnuveitandi hefur samþykkt að viðurkenna — og það er heiðarleg sönnun þess sem einhver raunverulega gerði.",
        },
        { lab: "Sjá hversu langt í land er" },
        {
          steps: [
            "Opnaðu valmyndina og veldu Aðgangur.",
            "Veldu Námskeið.",
            "Hver nemandi hefur röð sem sýnir hvert skilyrði og hversu langt hann er kominn.",
          ],
        },
        {
          p: "Skilyrðin eru hlutir eins og að hver stafur hafi verið kynntur, hver stafur sé traustur en ekki bara snertur, nógu margar æfingar, nógu margir aðskildir dagar, og viðvarandi hraði og nákvæmni. Þegar öllum er náð birtist hlekkur á röðinni til að taka matið.",
        },
        {
          p: "Matið er stutt, og það er dæmt á netþjónum okkar frekar en í vafranum þínum. Standist þú það er skírteinið gefið út með númeri á. Hver sem þú gefur það númer getur athugað það á síðunni *Athuga skírteini* — og þú ræður hvort nafnið þitt sé sýnt.",
        },
      ],
    },
    {
      id: "security",
      nav: "Að halda aðgangnum þínum öruggum",
      heading: "Aðgangslyklar, kóðar og hverjir hafa skráð sig inn",
      blocks: [
        {
          p: "Þú getur skráð þig inn með lykilorði, með þjónustu eins og Google, með hlekk sendum í tölvupósti — eða með *aðgangslykli*, sem er það sem við myndum velja. Aðgangslykill notar fingrafar, andlit eða PIN tækisins þíns; það er ekkert lykilorð sem getur lekið, og ekkert sem við geymum gæti verið notað til að skrá sig inn sem þú.",
        },
        { lab: "Bæta við aðgangslykli" },
        {
          steps: [
            "Opnaðu valmyndina og veldu Aðgangur, svo Öryggi.",
            "Veldu Bæta við aðgangslykli og fylgdu leiðbeiningum tækisins.",
          ],
        },
        {
          p: "*Tveggja þrepa staðfesting* er líka til staðar, með auðkenningarforriti og endurheimtarkóðum ef þú týnir símanum. Prentaðu þá út einhvers staðar sem er ekki síminn.",
        },
        {
          p: "Sama síða telur upp nýlega virkni — innskráningar, misheppnaðar innskráningar, aðgangslykil bætt við, lykilorði breytt — hverja með grófri staðsetningu, svo það er auðvelt að koma auga á eitthvað sem þú gerðir ekki. Ef eitthvað lítur rangt út þá *skráir út alls staðar* þig út úr öllum lotum nema þeirri sem þú ert að nota.",
        },
        {
          p: "Það er líka til *foreldra-PIN*, sem læsir aðgangsstillingunum svo barn á fjölskyldutækinu geti ekki breytt þeim eða eytt prófíl.",
        },
      ],
    },
    {
      id: "yours",
      nav: "Gerðu það að þínu",
      heading: "Gerðu það að þínu",
      blocks: [
        { lab: "Skipta um þema" },
        {
          steps: [
            "Opnaðu valmyndina og veldu Aðgangur, svo Útlit.",
            "Veldu ljóst, dökkt, eða fylgja tækinu.",
          ],
        },
        {
          p: "Ef ekkert af þemunum sem fylgja er það sem þú vilt þá leyfir *þemahönnuðurinn* þér að blanda þitt eigið — þar á meðal fingralitina sem lyklaborðið kennir með. Appið mælir birtuskil þess sem þú velur og hafnar samsetningum sem enginn gæti lesið.",
        },
        {
          p: "Hver nemandi á heimilinu getur haft sinn eigin lit, svo sameiginlegt tæki finnst samt tilheyra þeim sem situr við það.",
        },
        { lab: "Skipta um tungumál síðunnar" },
        {
          steps: [
            "Opnaðu valmyndina.",
            "Undir Tungumál síðunnar velurðu þitt tungumál.",
          ],
        },
        {
          p: "Á æfingaskjánum geturðu líka breytt stærð textans og kveikt eða slökkt á hljóðum hvenær sem þér sýnist.",
        },
      ],
    },
    {
      id: "privacy",
      nav: "Persónuvernd",
      heading: "Persónuvernd, í einni setningu",
      blocks: [
        {
          p: "Engar auglýsingar og engir rekjarar. Prófíll barns fer aldrei út úr vafranum þínum. Skráðu þig aðeins inn ef þú vilt samstillingu eða deilingu; annars helst allt á þessu tæki, og þér er frjálst að eyða því hvenær sem er.",
        },
      ],
    },
    {
      id: "signout",
      nav: "Útskráning",
      heading: "Útskráning",
      blocks: [
        { lab: "Skrá sig út" },
        {
          steps: ["Opnaðu valmyndina.", "Veldu Skrá út og staðfestu."],
        },
        {
          p: "Æfingaferillinn þinn helst öruggur á þessu tæki — og á aðgangnum þínum, ef þú bjóst hann til — tilbúinn næst þegar þú sest niður til að skrifa.",
        },
      ],
    },
    {
      id: "tips",
      nav: "Ráð",
      heading: "Nokkrar venjur sem hjálpa virkilega",
      blocks: [
        {
          tips: [
            "Nákvæmni á undan hraða — hreinn innsláttur er það sem festist.",
            "Lagaðu mistök í rólegheitum; ekki þjóta til að vinna upp tímann.",
            "Hvíldu fingurna á heimaröðinni — F og J eru með litlar upphleyptar merkingar.",
            "Nokkrar mínútur á hverjum degi eru betri en klukkutími einu sinni í viku.",
          ],
        },
      ],
    },
  ],
};
