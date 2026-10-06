import { type GuideTranslation } from "../guide-content.tsx";

export const tr: GuideTranslation = {
  kicker: "Yapabileceğin her şey",
  title: "Kullanım Kılavuzu",
  dateline:
    "KeyLearn’in eksiksiz kılavuzu — ilk ziyaretinden çıkış yapana kadar",
  navLabel: "Bu sayfada",
  sections: [
    {
      id: "account",
      nav: "Hesap açmam gerekir mi?",
      heading: "Hesap açmam gerekir mi?",
      blocks: [
        {
          p: "Hayır. Geldiğin anda yazmaya başlayabilirsin ve ilerlemen tam burada, bu cihazda saklanır. Ücretsiz hesabı yalnızca geçmişinin başka cihazlara da taşınmasını, bir yedek tutmayı ya da profil bağlantını paylaşmayı istiyorsan aç. İşine yarayacak hiçbir şey giriş yapmanın arkasına kilitlenmiş değil.",
        },
      ],
    },
    {
      id: "signin",
      nav: "Giriş ve parolalar",
      heading: "Kaydolma, giriş yapma ve parolalar",
      blocks: [
        {
          p: "Her şey sağ üstteki menüde, Giriş yap veya kaydol altında — hesabın olsa da olmasa da aynı kapı.",
        },
        { lab: "Hesap oluşturma ya da giriş yapma" },
        {
          steps: [
            "Menüyü aç ve Giriş yap veya kaydol’u seç.",
            "Google, Facebook ya da bir geçiş anahtarıyla devam et — veya e-postanı yazıp Devam et’e bas.",
            "Yeni bir e-posta seni bir parolayla kaydeder; kayıtlı bir e-posta ise parolanı sorar.",
          ],
        },
        { lab: "Unutulan parolayı sıfırlama" },
        {
          steps: [
            "Giriş ekranında e-postanı gir ve Devam et’e bas.",
            "Parolanızı mı unuttunuz? seçeneğini seç.",
            "Sana gönderdiğimiz sıfırlama bağlantısını aç.",
            "Yeni bir parola seç ve giriş yap.",
          ],
        },
      ],
    },
    {
      id: "profiles",
      nav: "Profiller",
      heading: "Tüm ev halkı için profiller",
      blocks: [
        {
          p: "KeyLearn bir ev halkı gibi kurgulanmıştır: tek bir hesapta dört profile kadar (premium ile sekiz), yetişkinler ve çocuklar istediğin karışımda yer alır. Her profil bu cihazda *kendi* ayrı ilerlemesini tutar — hiçbir şey birbirine karışmaz.",
        },
        { lab: "Profil ekleme" },
        {
          steps: [
            "Menüyü aç ve Hesap’ı seç (ya da “Profilleri ayarla”).",
            "Profil ekle’yi seç.",
            "Bir ad yaz.",
            "Yetişkin mi Çocuk mu olduğunu işaretle.",
            "Bir avatar seç — sevimli bir simge ya da cihazından bir fotoğraf.",
            "Çocuk için doğum yılını ekle (bu yalnızca kelimeleri ve temposu yaşına göre ayarlar).",
            "Kaydet.",
          ],
        },
        { lab: "Başka bir öğrenene geçme" },
        {
          steps: [
            "Menüyü aç.",
            "Öğrenenler altındaki bir yüze dokun — uygulama kaldığı yerden devam eder.",
          ],
        },
        { lab: "Profili düzenleme veya kaldırma" },
        {
          steps: [
            "Menüyü aç ve Hesap’ı seç.",
            "Bir profilde Düzenle’yi seç ya da yer açmak için sil.",
          ],
        },
        {
          p: "Çocuk profilleri sadeleştirilmiş, kilitli bir menü alır; yetişkinlere ait işlemler ise hızlı bir “A çarpı B kaç eder?” matematik kapısının arkasındadır, böylece küçükler ayarların içine dalamaz.",
        },
      ],
    },
    {
      id: "screen",
      nav: "Alıştırma ekranı",
      heading: "Alıştırma ekranı",
      blocks: [
        {
          p: "Yazmaya başlaman yeterli. İhtiyacın olan kelime ekran klavyesinin hemen üstünde süzülür; parlayan bir kuyruklu yıldız tam sıradaki tuşu gösterir; tuşlar parmak bölgelerine göre renklendirilmiştir, böylece hangi parmağın nereye uzandığını öğrenirsin; ve soluk bir çift dinlenen el, tuşlara basış aralarında parmaklarının nerede durduğunu gösterir. Bu becerinin tamamı tek bir alışkanlıktan ibaret: gözlerini ellerinde değil, kelimelerde tut.",
        },
      ],
    },
    {
      id: "journey",
      nav: "Yolculuğun",
      heading: "Dersler nasıl büyür — senin yolculuğun",
      blocks: [
        {
          p: "KeyLearn *uyarlanabilir*. Her tuşa ne kadar hızlı ve temiz vurduğunu ölçer ve mevcut harfleri hem hızlı hem doğru yazabildiğinde ancak o zaman setine yeni bir harf ekler. İşte bu büyüyen set senin yolculuğun: bir avuç harften tüm alfabeye. Zorluk tam senin hızında artar, asla daha hızlı değil; böylece hep tam sınırında çalışırsın.",
        },
      ],
    },
    {
      id: "readout",
      nav: "Canlı istatistikler",
      heading: "Canlı gösterge",
      blocks: [
        {
          p: "Sen yazarken yüzen panel o anki hızını ve doğruluğunu, son denemelerinin küçük bir çizgi grafiğini, hedef izlerini ve serini gösterir. Seni cesaretlendirmek için orada, başının etini yemek için değil.",
        },
        {
          p: "Hedefin yanındaki *− ve +*, Ayarlar’ı açmadan bugünkü hedefini oracıkta biraz yukarı ya da aşağı çeker. Aynı birkaç harf ilerlemeyi bıraktıysa hedefi düşür; yeni harflerin ne kadar hızlı açılacağını belirleyen tek şey, bir harfin ulaşması gereken hızdır.",
        },
        {
          p: "Bir profil resmi seçtiysen, resmin o sayıların arkasında hafifçe durabilir — Hesap, Görünüm, *İstatistiklerin arkasındaki resminiz*; ne kadar belirgin olacağını bir kaydırıcıyla ayarlarsın. Sen açmadıkça kapalıdır.",
        },
      ],
    },
    {
      id: "tools",
      nav: "Alıştırma araçları",
      heading: "Alıştırma araçları",
      blocks: [
        {
          p: "Metnin yanındaki küçük araçlarla rehberli turu açabilir, mevcut dersi baştan başlatabilir (Ctrl + Sol), bir sonrakine atlayabilir (Ctrl + Sağ), ekran klavyesini gösterip gizleyebilir ve alıştırma metnini büyütüp küçültebilirsin. Dişli simgesi, birazdan anlatacağımız tüm Ayarlar’ı açar.",
        },
      ],
    },
    {
      id: "content",
      nav: "Ne yazacağın",
      heading: "Ne yazacağını seçmek",
      blocks: [
        {
          p: "Kelimelerinin nasıl oluşturulacağını seçmek için Ayarlar’ı aç ve Alıştırma İçeriği’ne git:",
        },
        {
          tips: [
            "*Rehberli alıştırma* — alfabeni tuş tuş büyüten, uyarlanabilir varsayılan seçenek.",
            "*Klasik kurs* — tuşlar arasında sabit ve sıralı bir yürüyüş.",
            "*Kod Parçacıkları* — gerçek yazılım çatılarından gerçek kod.",
            "*Sık kullanılan kelimeler* — kendi dilindeki en yaygın kelimeler.",
            "*Kitap Metni* — uygulamanın içinde hazır duran gerçek kitapları yazarak ilerle.",
            "*Alıntılar* — gerçek büyük harfleri ve noktalamasıyla kısa, eksiksiz düşünceler.",
            "*Kendi Metnin* — istediğin her şeyi yapıştır ve onunla alıştırma yap.",
            "*Sayı Alıştırmaları* — sayı sırası ve sayısal tuş takımı.",
          ],
        },
        { lab: "Ne yazdığını değiştirme" },
        {
          steps: [
            "Ayarlar’ı aç (alıştırma metninin yanındaki dişli).",
            "Alıştırma İçeriği’ne git.",
            "Bir mod seç — Kitap Metni için bir kitap seç, Kendi Metnin için kelimelerini yapıştır.",
            "Ayarlar’ı kapat ve yazmaya devam et.",
          ],
        },
        {
          p: "Aynı ekranda alfabe boyutunu, hedef hızını, her dersin ne kadar süreceğini ve günlük hedefini belirlersin.",
        },
      ],
    },
    {
      id: "smart",
      nav: "Akıllı Alıştırma",
      heading: "Akıllı Alıştırma yardımcıları",
      blocks: [
        {
          p: "Rehberli alıştırmanın üstüne Akıllı Alıştırma nazik yardımcılar ekler: en yavaş tuş çiftlerini avlayan darboğaz çalışması, aralıklı tekrar, paslanmış tuşları yeniden ele alan beceri tazeleyiciler, akıllı özgüven ve tuş toparlama. Hepsi varsayılan olarak açıktır.",
        },
        { lab: "Bir yardımcıyı açma veya kapatma" },
        {
          steps: [
            "Ayarlar’ı aç.",
            "Akıllı Alıştırma’ya git.",
            "Dilediğin yardımcıyı aç ya da kapat — istersen hepsini açık bırak.",
          ],
        },
      ],
    },
    {
      id: "keyboard",
      nav: "Klavye kurulumu",
      heading: "Klavyeni ayarlamak",
      blocks: [
        {
          p: "Ayarlar’daki Klavye bölümü, KeyLearn’ü klavyene ve öğrenmek istediğin düzene uydurduğun yerdir.",
        },
        { lab: "Klavye düzenini değiştirme" },
        {
          steps: [
            "Ayarlar’ı aç.",
            "Klavye bölümüne git.",
            "Önce dilini, sonra düzenini seç (QWERTY, Dvorak, Colemak ve daha fazlası).",
            "Bilgisayarın hangi düzene ayarlı olursa olsun bu düzeni çalışabilmen için “Bu düzeni simüle et”i açık bırak.",
            "Doğrulamak için canlı önizlemeye bak.",
          ],
        },
        {
          p: "Aynı ekranda klavyenin şeklini seçebilir, tuşları parmak bölgelerine göre renklendirebilir ve tuşların yerini hâlâ öğrenirken sıradaki tuşu öne çıkarabilirsin.",
        },
        {
          p: "Klavyenin *kaplaması* — tuşların görünümü — bir hesapla gelir. Giriş yaptığında seçebileceğin beş tane vardır ve yuvarlak olanın altı rengi bulunur; bunlardan biri temanın rengini izler. Yukarıdaki her şey ise her durumda senindir: dil, düzen, şekil ve parmak bölgeleri hiçbir zaman kısıtlanmaz, çünkü uygulamayı önündeki klavyeye uyduran onlardır.",
        },
      ],
    },
    {
      id: "display",
      nav: "Görünüm",
      heading: "Görünüm ve his",
      blocks: [
        {
          p: "Görünüm ve Yazım ayarları, hızını dakikada kelime ya da dakikada karakter olarak göstermeni ve yazmanın nasıl hissettirdiğini ince ayarlamanı sağlar. Baştan başlamak istersen Ayarları sıfırla her zaman bir tık uzağında.",
        },
        {
          p: "Sitenin genel görünümü Hesap, Görünüm altında yer alır: açık, koyu ya da sisteme uy, bir tema rengi ve her sayfada geçerli kalan bir yazı boyutu. Evdeki her öğrenen kendi ayarlarını korur ve bunlar onunla birlikte gider — bkz. *Verilerine göz kulak olmak*.",
        },
      ],
    },
    {
      id: "progress",
      nav: "İlerlemen",
      heading: "İlerlemen — Profil sayfası",
      blocks: [
        {
          p: "Profil sayfası senin eksiksiz kaydın: en üstte Tüm Zamanlar ve Bugün istatistikleri (çalışılan süre, tamamlanan dersler, en iyi ve tipik hızın ile doğruluğun ve bugünün nasıl kıyaslandığı); açtığın her harfin haritası; her bir tuşun nasıl hızlandığının hikâyesi, bir yumuşatma kaydırıcısıyla birlikte; zaman içinde her tuşun genel görünümü; ve seni hâlâ geride tutan en yavaş geçişler. Hatta ilerlemeni doğrudan hissetmek için kendi son turuna hayalet olarak karşı yarışabilirsin.",
        },
        { lab: "İlerlemeni açma" },
        {
          steps: [
            "Menüyü aç.",
            "Profil’i seç.",
          ],
        },
      ],
    },
    {
      id: "data",
      nav: "Verilerin",
      heading: "Verilerine göz kulak olmak",
      blocks: [
        { lab: "Bir profilin istatistiklerini temizleme" },
        {
          steps: [
            "Sıfırlamak istediğin öğrenen için Profil’i aç.",
            "Sayfanın en altındaki sıfırlama kontrolüne kaydır.",
            "“Her şeyi sil”i onayla — yalnızca bu profil temizlenir.",
          ],
        },
        { lab: "Verilerini indirme" },
        {
          steps: [
            "Profil’i aç.",
            "Geçmişini bir dosya olarak kaydetmek için indirme seçeneğini kullan.",
          ],
        },
        {
          p: "Geçmişinin cihazlar arasında eşitlenmesini ve herkese açık bir profil bağlantısı paylaşmayı istiyorsan giriş yap. Reklam ağı da izleyici de yok; verilerini — ya da tüm hesabını — istediğin zaman silebilirsin.",
        },
        {
          p: "Giriş yapmak artık yalnızca sonuçlarını taşımıyor. Ayarların, temanla yazı boyutun, yaptığın erişilebilirlik seçimleri ve her öğrenenin kendi tercihleri tarayıcıya değil profile bağlı kalır — böylece KeyLearn’ü yeni bir bilgisayarda açan bir öğrenen, varsayılanlardan yeniden başlamak yerine kaldığı yerden, aynı ekranda, aynı ayarlarla devam eder.",
        },
      ],
    },
    {
      id: "kids",
      nav: "Çocuk modu",
      heading: "Çocuk modu",
      blocks: [
        {
          p: "Çocuklar oyunlu bir patikada alıştırma yapar. Doğru basılan her tuş karakterlerini eve bir adım daha yaklaştırır ve daha fazla harf açıldıkça karakter minik bir bebekten kocaman bir kahramana dönüşür. Yeni öğrenilen bir tuş küçük bir kutlama başlatır ve her oturum sıcacık bir kamp ateşinin başında biter.",
        },
        { lab: "Çocuk moduna geçme" },
        {
          steps: [
            "Menüyü aç.",
            "Çocuklar’ı seç — ya da Öğrenenler altından bir çocuk profili seç.",
          ],
        },
        {
          p: "Seçebileceğin iki dünya var — sevimli bir dinozorun olduğu Dino Run ve bir şövalyenin ormanda maceraya çıktığı Hero Trail — her birinde seçebileceğin bir karakter bulunur.",
        },
      ],
    },
    {
      id: "toybox",
      nav: "Çocuk oyuncak kutusu",
      heading: "Çocuk oyuncak kutusu",
      blocks: [
        { lab: "Oyuncak kutusunu açma" },
        {
          steps: [
            "Çocuk ekranında, oyun alanının üstündeki dişliye dokun.",
          ],
        },
        {
          p: "İçeride dünyayı ve karakteri, Büyük harfler, Sesler, Yardımcı eller (parlayan parmak rehberi), Klavye (gizli, basit ya da tam yetişkin klavyesi), Patikadaki harfler (oyunun içinde blok olarak gösterilen kelimeler), oturum Zamanlayıcısı, Tezahüratlar (cesaret veren küçük mesajlar) ve — Gelişmiş’in altına saklanmış — Parlaklık, Renk ve dünyanın ne kadar canlı hissettirdiği için kaydırıcılar bulunur. Aydınlık gündüz görünümünün yanı sıra sakin bir gece görünümü de var.",
        },
        {
          p: "*Key style* tuşların nasıl boyandığını değiştirir; tuşların kendisi yerinden oynamaz: *Crayon*, parmak rengiyle çevrelenmiş beyaz tuştur; *Rainbow* ise ana renklerle öğrenme klavyesidir — yeşil çerçeve, kırmızı rakamlar, ünlüleri ayrı tutulmuş mavi harfler — ve burada çerçeve tuşları kelime yerine ok gösterir, henüz “enter” okuyamayan bir çocuk için. Herkes Crayon ile başlar. Yanındaki *Finger colours* ise artık ihtiyacı kalmayan bir çocuk için renklendirmeyi tamamen kapatır.",
        },
      ],
    },
    {
      id: "ages",
      nav: "Büyürken",
      heading: "Çocuğunla birlikte büyümek",
      blocks: [
        {
          p: "KeyLearn kendini sessizce çocuğun yaşına göre ayarlar. En küçükler büyük, sevimli harfler, bağışlayıcı bir tempo, doğrudan patikanın üstünde harf blokları ve en yumuşak yardımı görür; daha büyük çocuklar ise daha uzun kelimelere, tam klavyeye ve daha sade bir görünüme terfi eder. Profilde doğum yılını ayarlaman yeterli, gerisi kendiliğinden gelir.",
        },
      ],
    },
    {
      id: "modes",
      nav: "Diğer modlar",
      heading: "Alıştırma yapmanın başka yolları",
      blocks: [
        {
          p: "Günlük alıştırmanın ötesinde bir *Hız Testi* var — derse bağlı olmayan, dakikada kelime ve doğruluk bildiren hızlı ve tek seferlik bir metin; klavye düzenlerini ve parmak haritalarını karşılaştırmak için bir *Düzenler* gezgini; nerede durduğunu görmek için *Yüksek Skorlar*; ve hızını gerçek zamanlı olarak başkalarına karşı zorlamak için *Çok Oyunculu* yarışlar.",
        },
        { lab: "Bunları bulma" },
        {
          steps: [
            "Menüyü aç.",
            "Hız Testi, Düzenler, Yüksek Skorlar ya da Çok Oyunculu’yu seç.",
          ],
        },
      ],
    },
    {
      id: "access",
      nav: "Bir şey yoluna çıkıyorsa",
      heading: "Uygulamayla ilgili bir şey yoluna çıkıyorsa",
      blocks: [
        {
          p: "Bunun için ayrı bir sayfa var ve ayarlar *her öğrenen için ayrı* tutulur — yani birinin yaptığı düzenlemeler başkasınınkini asla değiştirmez.",
        },
        { lab: "Açma" },
        {
          steps: [
            "Menüyü aç ve Hesap’ı seç.",
            "Erişilebilirlik’i seç.",
            "Üstten öğreneni seç, sonra ihtiyacın olan ayarları dilediğin kadar aç.",
          ],
        },
        {
          p: "Beş ayar *bir arada* kullanılabilir. Elleri titreyen disleksili biri bunlardan ikisine ihtiyaç duyar ve tek birini seçmeye zorlanmak, uygulamanın hangi zorluğu dikkate almaya razı olduğunu sorması demek olurdu.",
        },
        {
          tips: [
            "Sakin — hiçbir şey hareket etmez, sayılmaz, süre tutulmaz ve kaçırılan bir gün seriyi bozmaz.",
            "Aynı anda daha az şey — alıştırma yalnızca kelimeler ve klavyeyle açılır.",
            "Daha kolay okunur — disleksi için tasarlanmış yazı tipi, harfler ve satırlar arasında daha fazla boşluk, daha belirgin metin.",
            "Ayırt edilebilir renkler — renk körlüğünde bile birbirinden ayrılan parmak renkleri ve yalnızca kırmızıyla değil sesle de bildirilen hatalar.",
            "Daha sabit eller — basılacak daha büyük alanlar, aynı anda iki tuş yok ve kendini tekrarlayan bir tuş iki kez sayılmaz.",
          ],
        },
        {
          p: "Bunların altında, *Her birini kendim ayarlayayım* seçeneği her anahtarı tek tek açar — toplam on beş tane; içlerinde konuşma hızı, sesli söylenen her şey için altyazılar, her tuşun üzerinde bir parmak numarası ve tekrarlanan bir tuşun ne kadar süre yok sayılacağı da var. Tek bir düğme hepsini eski hâline döndürür.",
        },
      ],
    },
    {
      id: "braille",
      nav: "Braille",
      heading: "Braille klavyede öğrenmek",
      blocks: [
        {
          p: "Görme engelli ya da az gören bir öğrenen bambaşka bir sayfa görür — altı tuşlu braille girişi, harfler yerine hücrelerden oluşan bir müfredat ve baştan sona sesli rehberlik. Bu, yazmayı öğrenmenin ayrı bir yoludur; gören kişiler için hazırlanmış sayfanın sesli okunmuş hâli değildir.",
        },
        { lab: "Bir öğrenen için açma" },
        {
          steps: [
            "Menüyü aç ve Hesap’ı, ardından Öğrenenler’i seç.",
            "Öğreneni düzenle ya da yeni bir tane ekle.",
            "Görme desteğini aç ve kaydet.",
          ],
        },
        {
          p: "O öğrenen artık sırası geldiğinde doğrudan braille sayfasına gider. İlerlemesi harflerle değil hücrelerle sayılır ve herkesle tamamen aynı koşullarda bir sertifika kazanabilir.",
        },
      ],
    },
    {
      id: "courses",
      nav: "İki kurs",
      heading: "Rehberli alıştırma, Klasik kurs ve kod",
      blocks: [
        {
          p: "*Rehberli alıştırma* uyarlanabilir kurstur: hangi tuşların seni yavaşlattığını izler ve derslerini onların etrafında kurar; eldeki harfleri hem hızlı hem doğru yazabildiğinde ancak o zaman yeni bir harf ekler.",
        },
        {
          p: "*Klasik kurs* eski usul olanıdır — belirli bir sırayla ilerleyen sabit bir ders merdiveni, tıpkı bir daktilo kitabının öğreteceği gibi. Kimileri sıradakinin ne olduğunu bilmeyi tercih eder.",
        },
        {
          p: "Bunlar ayrı geçmişleri olan ayrı kurslardır ve sertifika biri ya da diğeri üzerinden kazanılır — asla ikisi toplanarak değil, çünkü bu ilk haftanı iki kez saymak olurdu. Hesabındaki Kurs sayfası hangisi hakkında rapor verdiğini sana söyler.",
        },
        {
          p: "*Kod zanaatı* üçüncü bir alıştırma türüdür: seçtiğin bir dilde gerçek kod parçacıkları, böylece parantezler, noktalı virgüller ve girintiler sıradan düzyazının onlara asla vermediği çalışmayı almış olur.",
        },
        { lab: "Aralarında geçiş yapma" },
        {
          steps: [
            "Alıştırma ekranında ders ayarlarını aç.",
            "Rehberli alıştırma, Klasik kurs ya da Kod zanaatı’nı seç.",
          ],
        },
      ],
    },
    {
      id: "certificates",
      nav: "Sertifikalar",
      heading: "Sertifika kazanmak",
      blocks: [
        {
          p: "Bir sertifika, adı geçen bir öğrenenin belirli bir tarihte, belirli bir dilde, ölçülmüş bir hız ve doğrulukla yazdığını söyler. Onu biz düzenleriz — herhangi bir sınav kurulunun ya da işverenin tanımayı kabul ettiği bir yeterlilik değildir — ve birinin gerçekten neyi başardığının dürüst bir kanıtıdır.",
        },
        { lab: "Ne kadar uzakta olduğunu görme" },
        {
          steps: [
            "Menüyü aç ve Hesap’ı seç.",
            "Kurs’u seç.",
            "Her öğrenenin, her koşulu ve o koşulda ne kadar ilerlediğini gösteren bir satırı vardır.",
          ],
        },
        {
          p: "Koşullar şunun gibi şeylerdir: her harfin tanıtılmış olması, her harfin bir kez denk gelmekle kalmayıp güvenilir hâle gelmesi, yeterince ders, yeterince ayrı gün ve sürdürülen bir hız ile doğruluk. Hepsi sağlandığında o satırda değerlendirmeye girmek için bir bağlantı belirir.",
        },
        {
          p: "Değerlendirme kısadır ve tarayıcında değil sunucularımızda değerlendirilir. Geçersen sertifika üzerinde bir numarayla düzenlenir. Bu numarayı verdiğin herkes onu *Sertifika doğrula* sayfasından kontrol edebilir — adının onlara gösterilip gösterilmeyeceğine ise sen karar verirsin.",
        },
      ],
    },
    {
      id: "security",
      nav: "Hesabını güvende tutmak",
      heading: "Geçiş anahtarları, kodlar ve kimlerin giriş yaptığı",
      blocks: [
        {
          p: "Şifreyle, Google gibi bir sağlayıcıyla, e-postana gönderilen bir bağlantıyla ya da bir *geçiş anahtarıyla* giriş yapabilirsin — bizim seçeceğimiz sonuncusu olurdu. Geçiş anahtarı senin kendi cihazının parmak izini, yüzünü ya da PIN’ini kullanır; sızabilecek bir şifre yoktur ve elimizde tuttuğumuz hiçbir şey senin yerine giriş yapmak için kullanılamaz.",
        },
        { lab: "Geçiş anahtarı ekleme" },
        {
          steps: [
            "Menüyü aç ve Hesap’ı, ardından Güvenlik’i seç.",
            "Geçiş anahtarı ekle’yi seç ve cihazının yönergesini izle.",
          ],
        },
        {
          p: "*İki adımlı doğrulama* da mevcut: bir kimlik doğrulayıcı uygulamayla ve telefonunu kaybedersen diye kurtarma kodlarıyla birlikte. Kodları yazdır ve telefonun olmayan bir yerde sakla.",
        },
        {
          p: "Aynı sayfa son etkinlikleri listeler — girişler, başarısız girişler, eklenen bir geçiş anahtarı, değiştirilen bir şifre — her biri geldiği yaklaşık konumla birlikte, böylece senin yapmadığın bir şeyi fark etmek kolaylaşır. Bir tuhaflık görürsen, *her yerden çıkış yap* şu an kullandığın oturum dışındaki tüm oturumları sonlandırır.",
        },
        {
          p: "Ayrıca bir *ebeveyn PIN’i* var; hesap ayarlarını kilitler, böylece ailenin ortak cihazındaki bir çocuk bunları değiştiremez ya da bir profili silemez.",
        },
      ],
    },
    {
      id: "yours",
      nav: "Kendine göre ayarla",
      heading: "Kendine göre ayarla",
      blocks: [
        { lab: "Temayı değiştirme" },
        {
          steps: [
            "Menüyü aç ve Hesap’ı, ardından Görünüm’ü seç.",
            "Açık, koyu ya da cihazı takip et seçeneklerinden birini seç.",
          ],
        },
        {
          p: "Hazır temalardan hiçbiri aradığın değilse, *tema tasarımcısı* kendi temanı karmana izin verir — klavyenin ders verirken kullandığı parmak renkleri dâhil. Uygulama seçtiğin renklerin kontrastını ölçer ve kimsenin okuyamayacağı bileşimleri geri çevirir.",
        },
        {
          p: "Evdeki her öğrenenin kendi rengi olabilir, böylece ortak kullanılan bir cihaz bile başındaki kişiye aitmiş gibi hissettirir.",
        },
        { lab: "Site dilini değiştirme" },
        {
          steps: ["Menüyü aç.", "Site dili altından dilini seç."],
        },
        {
          p: "Alıştırma ekranında ayrıca metnin boyutunu değiştirebilir ve canın istediğinde sesleri açıp kapatabilirsin.",
        },
      ],
    },
    {
      id: "privacy",
      nav: "Gizlilik",
      heading: "Tek cümlede gizlilik",
      blocks: [
        {
          p: "Reklam ağı yok, izleyici yok. Bir çocuğun profili tarayıcından hiç çıkmaz. Yalnızca eşitleme ya da paylaşma istiyorsan giriş yap; aksi halde her şey bu cihazda kalır ve istediğin zaman silebilirsin.",
        },
        {
          p: "Bazı sayfalarda bir *sponsorlu satır* görebilirsin. Bunu kendimiz satıyor ve kendimiz gösteriyoruz — burada reklam ağı yok ve hiçbir şey seni site dışında takip etmez. Hangi satırın görüneceğini senin hakkında bildiğimiz herhangi bir şey değil, bulunduğun sayfa belirler; bir çocuğa, çocuk dünyasının içinde, bir okul hesabında ya da ders sürerken asla gösterilmez. Aynı açıklamayı yerinde görmek için herhangi birinde *Bunu neden görüyorum?* seçeneğine dokun; projeyi destekleyenler ise hiçbirini görmez.",
        },
      ],
    },
    {
      id: "support",
      nav: "Yardım almak",
      heading: "Yardım almak",
      blocks: [
        {
          p: "Bize gönderdiğin her mesaj, kaybolup giden bir e-posta değil, *dönüp bakabileceğin bir konuşma* olur. Hesap altında durur ve kendine ait bir referans numarası vardır — bir gün yeniden arar ya da yazarsan belirteceğin numara budur.",
        },
        { lab: "Yardım isteme" },
        {
          steps: [
            "Menüyü aç, Hesap’ı ve ardından Destek’i seç.",
            "Talep kaydet’i seç ve neler olduğunu anlat.",
            "İşe yarayacaksa bir ekran görüntüsü ekle — PNG, JPG ya da PDF, her biri en fazla 10 MB.",
          ],
        },
        {
          p: "Yanıtlar o konuşmada görünür ve biri geldiğinde üst kısımdaki zil yanar; yani oturup sayfayı izlemen gerekmez. Çözülmüş her şey, kapalı başlayan Çözüldü bölümüne katlanır — hâlâ beklediğin şey, gördüğün şeydir.",
        },
        { lab: "Kim yanıtlıyor" },
        {
          p: "Mesajını önce Tab adlı bir asistan okur ve yanıtlayabildiklerini yanıtlar. Sana bir yapay zekâ olduğunu söyler — asla aksini iddia etmez ve bir şeyi bilmediğinde bunu açıkça söyler.",
        },
        {
          p: "Daha iyi yanıt bir insansa, işi bir insan devralır: para, verilerin ya da güvenlikle ilgili her şeyde veya sadece sen istediğin için. Asla iki kez istemen gerekmez, kendini tekrarlaman da gerekmez — konuyu kim devralırsa söylediğin her şeyi zaten görür.",
        },
        {
          p: "Bir mesaj gerçek bir acil durum gibi görünürse, yanıt her seferinde aynıdır ve asistandan değil, sabit bir metinden gelir: bulunduğun yerdeki acil durum numarası ve bizim tarafımızda hemen haberdar edilen bir kişi. O aramayı senin yerine yapamayız ve bunu açıkça söyleriz.",
        },
        { lab: "Ortalığı toplamak" },
        {
          p: "Bir konuşmayı yanındaki çöp kutusu simgesiyle istediğin zaman listenden kaldırabilirsin. *Talep kaydet*’in yanındaki küçük bir not kaç tanesini temizlediğini sayar; böylece kaybolan bir konuşma asla bir muamma olmaz.",
        },
        {
          p: "Ortak kullanılan bir aile cihazında Destek bölümü açılmadan önce yetişkin PIN’ini ister — destek konuşmaları hesapla ilgili işlerdir ve alıştırma yapan kişi her zaman hesabı kuran kişi değildir.",
        },
      ],
    },
    {
      id: "signout",
      nav: "Çıkış yapma",
      heading: "Çıkış yapma",
      blocks: [
        { lab: "Çıkış yapma" },
        { steps: ["Menüyü aç.", "Çıkış Yap’ı seç ve onayla."] },
        {
          p: "Alıştırma geçmişin bu cihazda — ve bir hesap açtıysan hesabında — güvenle durur; yazmak için bir dahaki oturuşunda seni bekliyor olacak.",
        },
      ],
    },
    {
      id: "tips",
      nav: "İpuçları",
      heading: "Gerçekten işe yarayan birkaç alışkanlık",
      blocks: [
        {
          tips: [
            "Hızdan önce doğruluk — kalıcı olan, temiz yazmaktır.",
            "Hataları sakince düzelt; açığı kapatmak için acele etme.",
            "Parmaklarını temel sırada dinlendir — F ve J tuşlarında küçük çıkıntılar vardır.",
            "Her gün birkaç dakika, haftada bir kez bir saatten iyidir.",
          ],
        },
      ],
    },
  ],
};
