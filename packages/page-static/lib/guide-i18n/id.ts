import { type GuideTranslation } from "../guide-content.tsx";

export const id: GuideTranslation = {
  kicker: "Semua yang bisa kamu lakukan",
  title: "Panduan Pengguna",
  dateline:
    "Panduan lengkap KeyLearn — dari kunjungan pertamamu sampai keluar dari akun",
  navLabel: "Di halaman ini",
  sections: [
    {
      id: "account",
      nav: "Apakah aku butuh akun?",
      heading: "Apakah aku butuh akun?",
      blocks: [
        {
          p: "Tidak. Kamu bisa langsung mengetik begitu tiba di sini, dan kemajuanmu tersimpan di perangkat ini. Buat akun gratis hanya kalau kamu ingin riwayatmu ikut ke perangkat lain, punya cadangan, atau membagikan tautan profil. Tidak ada hal berguna yang dikunci di balik proses masuk.",
        },
      ],
    },
    {
      id: "signin",
      nav: "Masuk dan kata sandi",
      heading: "Mendaftar, masuk, dan kata sandi",
      blocks: [
        { p: "Semuanya ada di menu di kanan atas." },
        { lab: "Membuat akun" },
        {
          steps: [
            "Buka menu (kanan atas).",
            "Pilih Daftar.",
            "Masukkan email dan kata sandi.",
            "Konfirmasi — kamu sudah masuk.",
          ],
        },
        { lab: "Masuk" },
        {
          steps: [
            "Buka menu dan pilih Masuk.",
            "Masukkan email dan kata sandimu.",
          ],
        },
        { lab: "Mengatur ulang kata sandi yang lupa" },
        {
          steps: [
            "Di layar Masuk, pilih Lupa Kata Sandi.",
            "Masukkan alamat emailmu.",
            "Buka tautan pengaturan ulang yang kami kirim.",
            "Pilih kata sandi baru lalu masuk.",
          ],
        },
      ],
    },
    {
      id: "profiles",
      nav: "Profil",
      heading: "Profil untuk seluruh keluarga",
      blocks: [
        {
          p: "KeyLearn dibangun seperti sebuah rumah tangga: satu akun menampung sampai empat profil (delapan dengan premium), orang dewasa dan anak-anak dalam campuran apa pun. Setiap profil menyimpan kemajuannya *sendiri* secara terpisah di perangkat ini — tidak pernah ada yang tercampur.",
        },
        { lab: "Menambah profil" },
        {
          steps: [
            "Buka menu dan pilih Akun (atau “Siapkan profil”).",
            "Pilih Tambah profil.",
            "Ketik nama depan.",
            "Tandai sebagai Dewasa atau Anak.",
            "Pilih avatar — ikon yang ramah, atau Foto dari perangkatmu.",
            "Untuk anak, tambahkan tahun lahir (ini hanya menyesuaikan kata dan temponya dengan usia mereka).",
            "Simpan.",
          ],
        },
        { lab: "Berpindah ke pelajar lain" },
        {
          steps: [
            "Buka menu.",
            "Ketuk sebuah wajah di bawah Pelajar — aplikasi melanjutkan dari tempat mereka berhenti.",
          ],
        },
        { lab: "Mengubah atau menghapus profil" },
        {
          steps: [
            "Buka menu dan pilih Akun.",
            "Pilih Ubah pada sebuah profil, atau hapus untuk mengosongkan slot.",
          ],
        },
        {
          p: "Profil anak mendapat menu yang disederhanakan dan terkunci, dan tindakan khusus orang dewasa berada di balik gerbang matematika singkat “berapa A kali B?”, supaya si kecil tidak nyasar ke pengaturan.",
        },
      ],
    },
    {
      id: "screen",
      nav: "Layar latihan",
      heading: "Layar latihan",
      blocks: [
        {
          p: "Langsung saja mengetik. Kata yang kamu butuhkan melayang tepat di atas papan ketik di layar; komet bercahaya menunjuk tombol berikutnya; tombol-tombol diwarnai menurut zona jari supaya kamu belajar jari mana menjangkau ke mana; dan sepasang tangan samar yang beristirahat menunjukkan di mana jarimu berada di antara ketukan. Seluruh keterampilan ini adalah satu kebiasaan: jaga matamu pada kata-kata, bukan pada tanganmu.",
        },
      ],
    },
    {
      id: "journey",
      nav: "Perjalananmu",
      heading: "Bagaimana pelajaran tumbuh — perjalananmu",
      blocks: [
        {
          p: "KeyLearn bersifat *adaptif*. Ia mengukur seberapa cepat dan bersih kamu menekan setiap tombol, dan hanya menambahkan huruf baru ke himpunanmu begitu kamu bisa mengetik huruf yang ada dengan cepat sekaligus akurat. Himpunan yang terus tumbuh itulah perjalananmu, dari segelintir huruf sampai seluruh abjad — tingkat kesulitannya naik persis secepat kamu, tidak pernah lebih cepat, jadi kamu selalu berlatih tepat di batas kemampuanmu.",
        },
      ],
    },
    {
      id: "readout",
      nav: "Statistik langsung",
      heading: "Tampilan langsung",
      blocks: [
        {
          p: "Saat kamu mengetik, panel melayang menampilkan kecepatan dan akurasimu saat ini, grafik mungil dari sesi-sesi terakhir, capaian targetmu, dan rentetan harianmu. Ia ada untuk menyemangatimu, bukan untuk mengomel.",
        },
      ],
    },
    {
      id: "tools",
      nav: "Alat latihan",
      heading: "Alat latihan",
      blocks: [
        {
          p: "Alat-alat kecil di samping teks memungkinkanmu membuka tur berpemandu, mengulang pelajaran saat ini (Ctrl + Kiri), melompat ke pelajaran berikutnya (Ctrl + Kanan), menampilkan atau menyembunyikan papan ketik di layar, dan mengubah ukuran teks latihan. Ikon gerigi membuka Pengaturan lengkap, yang dijelaskan berikut ini.",
        },
      ],
    },
    {
      id: "content",
      nav: "Apa yang kamu ketik",
      heading: "Memilih apa yang kamu ketik",
      blocks: [
        {
          p: "Buka Pengaturan lalu ke Materi Latihan untuk memilih bagaimana kata-katamu dibentuk:",
        },
        {
          tips: [
            "*Latihan berpemandu* — mode adaptif bawaan yang menumbuhkan abjadmu tombol demi tombol.",
            "*Kursus klasik* — langkah tetap dan berurutan melewati tombol-tombol.",
            "*Kata sering dipakai* — kata-kata paling umum dalam bahasamu.",
            "*Teks Buku* — ketiklah menyusuri buku sungguhan yang tersedia di aplikasi.",
            "*Teksmu Sendiri* — tempel apa pun yang kamu suka dan berlatihlah dengannya.",
            "*Cuplikan Kode* — kurung, simbol, dan irama kode.",
            "*Latihan Angka* — baris angka dan papan angka.",
          ],
        },
        { lab: "Mengubah apa yang kamu ketik" },
        {
          steps: [
            "Buka Pengaturan (ikon gerigi di dekat teks latihan).",
            "Ke Materi Latihan.",
            "Pilih sebuah mode — untuk Teks Buku pilih sebuah buku, untuk Teksmu Sendiri tempel kata-katamu.",
            "Tutup Pengaturan dan lanjutkan mengetik.",
          ],
        },
        {
          p: "Layar yang sama mengatur ukuran abjadmu, kecepatan target, berapa lama setiap pelajaran berlangsung, dan target harian.",
        },
      ],
    },
    {
      id: "smart",
      nav: "Latihan Cerdas",
      heading: "Pembantu Latihan Cerdas",
      blocks: [
        {
          p: "Di atas latihan berpemandu, Latihan Cerdas menambahkan pembantu yang lembut: latihan penyumbatan yang memburu pasangan tombol paling lambatmu, pengulangan berjarak, penyegar untuk keterampilan yang memudar dan meninjau kembali tombol yang berkarat, kepercayaan diri cerdas, dan pemulihan tombol. Semuanya aktif secara bawaan.",
        },
        { lab: "Menyalakan atau mematikan pembantu" },
        {
          steps: [
            "Buka Pengaturan.",
            "Ke Latihan Cerdas.",
            "Nyalakan atau matikan pembantu mana pun yang kamu mau — atau biarkan semuanya menyala.",
          ],
        },
      ],
    },
    {
      id: "keyboard",
      nav: "Penyiapan papan ketik",
      heading: "Menyiapkan papan ketikmu",
      blocks: [
        {
          p: "Pengaturan, Penyiapan Papan Ketik adalah tempat kamu menyelaraskan KeyLearn dengan papan ketikmu dan dengan tata letak yang ingin kamu pelajari.",
        },
        { lab: "Mengubah tata letak papan ketikmu" },
        {
          steps: [
            "Buka Pengaturan.",
            "Ke Penyiapan Papan Ketik.",
            "Pilih bahasamu, lalu tata letakmu (QWERTY, Dvorak, Colemak, dan lainnya).",
            "Biarkan “Simulasikan tata letak ini” menyala supaya kamu bisa berlatih apa pun pengaturan komputermu.",
            "Perhatikan pratinjau langsung untuk memastikan.",
          ],
        },
        {
          p: "Di layar yang sama kamu bisa memilih bentuk papan ketik, mewarnai tombol menurut zona jari, dan menyorot tombol berikutnya selagi kamu masih belajar letak segalanya.",
        },
      ],
    },
    {
      id: "display",
      nav: "Tampilan",
      heading: "Tampilan dan rasa",
      blocks: [
        {
          p: "Pengaturan Tampilan dan Masukan Teks memungkinkanmu menampilkan kecepatan sebagai kata atau karakter per menit dan menyetel halus bagaimana rasanya mengetik. Kembalikan Bawaan selalu hanya sejauh satu klik kalau kamu ingin mulai dari awal.",
        },
      ],
    },
    {
      id: "progress",
      nav: "Kemajuanmu",
      heading: "Kemajuanmu — halaman Profil",
      blocks: [
        {
          p: "Halaman Profil adalah catatan lengkapmu: statistik Sepanjang Waktu dan Hari Ini di bagian atas (waktu berlatih, pelajaran yang selesai, kecepatan dan akurasi terbaik serta khasmu, dan bagaimana hari ini dibandingkan); peta setiap huruf yang sudah kamu buka; kisah bagaimana tiap tombol menjadi lebih cepat, lengkap dengan penggeser penghalus; gambaran besar semua tombol dari waktu ke waktu; dan transisi paling lambat yang masih menahanmu. Kamu bahkan bisa berlomba melawan sesi terakhirmu sendiri sebagai bayangan untuk merasakan kemajuannya langsung.",
        },
        { lab: "Membuka kemajuanmu" },
        {
          steps: [
            "Buka menu.",
            "Pilih Profil.",
            "Gunakan baris filter untuk fokus pada Huruf, Angka, Tanda Baca, atau Simbol.",
          ],
        },
      ],
    },
    {
      id: "data",
      nav: "Datamu",
      heading: "Menjaga datamu",
      blocks: [
        { lab: "Menghapus statistik sebuah profil" },
        {
          steps: [
            "Buka Profil untuk pelajar yang ingin kamu setel ulang.",
            "Gulir ke kontrol setel ulang di bagian bawah halaman.",
            "Konfirmasi “Hapus semuanya” — hanya profil ini yang dibersihkan.",
          ],
        },
        { lab: "Mengunduh datamu" },
        {
          steps: [
            "Buka Profil.",
            "Gunakan pilihan unduh untuk menyimpan riwayatmu sebagai berkas.",
          ],
        },
        {
          p: "Masuklah kalau kamu ingin riwayatmu tersinkron antarperangkat dan ingin membagikan tautan profil publik. Tidak ada iklan dan tidak ada pelacak, dan kamu bisa menghapus datamu — atau seluruh akunmu — kapan pun kamu mau.",
        },
      ],
    },
    {
      id: "kids",
      nav: "Mode anak",
      heading: "Mode anak",
      blocks: [
        {
          p: "Anak-anak berlatih di jalur yang menyenangkan. Setiap tombol yang benar membuat karakter mereka melangkah satu langkah lebih dekat ke rumah, dan karakternya tumbuh dari bayi mungil menjadi pahlawan dewasa seiring makin banyak huruf terbuka. Tombol yang baru dipelajari memicu perayaan kecil, dan setiap sesi berakhir di api unggun yang hangat.",
        },
        { lab: "Beralih ke mode anak" },
        {
          steps: [
            "Buka menu.",
            "Pilih Anak — atau pilih profil anak di bawah Pelajar.",
          ],
        },
        {
          p: "Ada dua dunia untuk dipilih — Dino Run, dengan dinosaurus yang ramah, dan Hero Trail, tempat seorang ksatria menjelajah hutan — masing-masing dengan karakter yang bisa dipilih.",
        },
      ],
    },
    {
      id: "toybox",
      nav: "Kotak mainan anak",
      heading: "Kotak mainan anak",
      blocks: [
        { lab: "Membuka kotak mainan" },
        {
          steps: [
            "Di layar anak, ketuk ikon gerigi di bagian atas area bermain.",
          ],
        },
        {
          p: "Di dalamnya kamu bisa mengatur dunia dan karakter, Huruf besar, Suara, Tangan pembantu (panduan jari yang bercahaya), Papan ketik (tersembunyi, sederhana, atau papan lengkap untuk orang dewasa), Huruf di jalur (kata-kata yang tampil sebagai balok langsung di dalam permainan), Pengatur waktu sesi, Sorakan (pesan-pesan kecil yang menyemangati), dan — terselip di bawah Lanjutan — penggeser untuk Kecerahan, Warna, dan seberapa hidup dunia terasa. Ada juga tampilan malam yang tenang selain tampilan siang yang cerah.",
        },
      ],
    },
    {
      id: "ages",
      nav: "Tumbuh besar",
      heading: "Tumbuh bersama anakmu",
      blocks: [
        {
          p: "KeyLearn diam-diam menyesuaikan diri dengan usia anak. Yang paling kecil melihat huruf besar dan ramah, tempo yang pemaaf, balok huruf langsung di jalur, dan bantuan yang paling lembut; anak yang lebih besar naik ke kata yang lebih panjang, papan ketik penuh, dan tampilan yang lebih bersih. Cukup setel tahun lahir di profil, sisanya mengikuti dengan sendirinya.",
        },
      ],
    },
    {
      id: "modes",
      nav: "Mode lain",
      heading: "Cara lain untuk berlatih",
      blocks: [
        {
          p: "Selain latihan harianmu ada *Tes Kecepatan* — satu petikan singkat sekali jalan yang melaporkan kata per menit dan akurasimu tanpa pelajaran apa pun; penjelajah *Tata Letak* untuk membandingkan tata letak papan ketik dan peta jarinya; *Skor Tertinggi* untuk melihat posisimu; dan balapan *Multipemain* untuk memacu kecepatanmu melawan orang lain secara langsung.",
        },
        { lab: "Menemukannya" },
        {
          steps: [
            "Buka menu.",
            "Pilih Tes Kecepatan, Tata Letak, Skor Tertinggi, atau Multipemain.",
          ],
        },
      ],
    },
    {
      id: "access",
      nav: "Kalau ada yang menghalangi",
      heading: "Kalau ada yang menghalangimu di aplikasi ini",
      blocks: [
        {
          p: "Ada satu halaman khusus untuk ini, dan pengaturannya *per pelajar* — jadi penyesuaian satu orang tidak pernah mengubah milik orang lain.",
        },
        { lab: "Membukanya" },
        {
          steps: [
            "Buka menu dan pilih Akun.",
            "Pilih Aksesibilitas.",
            "Pilih pelajar di bagian atas, lalu nyalakan sebanyak apa pun pengaturan yang kamu butuhkan.",
          ],
        },
        {
          p: "Kelima pengaturan itu bisa *digabungkan*. Seseorang dengan disleksia dan tangan gemetar membutuhkan dua di antaranya, dan memaksanya memilih salah satu sama saja dengan aplikasi bertanya kesulitan mana yang mau diakomodasi.",
        },
        {
          tips: [
            "Tenang — tidak ada yang bergerak, tidak ada yang dihitung, tidak ada yang diukur waktunya, dan satu hari yang terlewat tidak memutus rentetan.",
            "Lebih sedikit sekaligus — latihan dibuka hanya dengan kata-kata dan papan ketik.",
            "Lebih mudah dibaca — huruf yang dirancang untuk disleksia, jarak antarhuruf dan antarbaris yang lebih lega, teks yang lebih tebal.",
            "Warna terpisah — warna jari yang tetap dapat dibedakan pada buta warna, dan kesalahan disampaikan lewat suara selain lewat warna merah.",
            "Tangan lebih mantap — sasaran tekan yang lebih besar, tidak ada dua tombol sekaligus, dan tombol yang mengulang dirinya sendiri tidak dihitung dua kali.",
          ],
        },
        {
          p: "Di bawahnya, *Atur sendiri satu per satu* membuka setiap sakelar secara terpisah — ada lima belas, termasuk kecepatan bicara, teks untuk apa pun yang diucapkan, nomor jari di setiap tombol, dan berapa lama tombol berulang diabaikan. Satu tombol mengembalikan semuanya.",
        },
      ],
    },
    {
      id: "braille",
      nav: "Braille",
      heading: "Belajar dengan papan ketik braille",
      blocks: [
        {
          p: "Pelajar yang tunanetra atau berpenglihatan lemah mendapat halaman yang sama sekali berbeda — masukan braille enam tombol, kurikulum dalam sel alih-alih huruf, dan panduan lisan sepanjang jalan. Ini cara belajar mengetik yang tersendiri, bukan halaman untuk orang awas yang dibacakan.",
        },
        { lab: "Menyalakannya untuk seorang pelajar" },
        {
          steps: [
            "Buka menu dan pilih Akun, lalu Pelajar.",
            "Ubah pelajar itu, atau tambahkan yang baru.",
            "Nyalakan dukungan penglihatan lalu simpan.",
          ],
        },
        {
          p: "Pelajar itu kini langsung menuju halaman braille setiap kali dialah yang berlatih. Kemajuannya dihitung dalam sel alih-alih huruf, dan dia bisa memperoleh sertifikat dengan syarat yang sama seperti siapa pun.",
        },
      ],
    },
    {
      id: "courses",
      nav: "Dua kursus",
      heading: "Latihan berpemandu, Klasik, dan kode",
      blocks: [
        {
          p: "*Latihan berpemandu* adalah kursus adaptif: ia mengamati tombol mana yang memperlambatmu dan menyusun pelajaranmu di sekitarnya, menambah huruf hanya setelah kamu bisa mengetik huruf yang sudah ada dengan cepat sekaligus akurat.",
        },
        {
          p: "*Kursus klasik* adalah yang kuno — tangga pelajaran tetap dengan urutan baku, seperti cara buku mengetik mengajarkannya. Sebagian orang memang lebih suka tahu apa yang datang berikutnya.",
        },
        {
          p: "Keduanya adalah kursus terpisah dengan riwayat terpisah, dan sertifikat diperoleh pada salah satunya — tidak pernah dari keduanya yang dijumlahkan, karena itu akan menghitung minggu pertamamu dua kali. Halaman Kursus di akunmu menyebutkan yang mana yang sedang dilaporkan.",
        },
        {
          p: "*Code craft* adalah jenis latihan ketiga: cuplikan nyata dalam bahasa yang kamu pilih, sehingga kurung, titik koma, dan indentasi mendapat latihan yang tak pernah diberikan oleh prosa biasa.",
        },
        { lab: "Berpindah di antara keduanya" },
        {
          steps: [
            "Di layar latihan, buka pengaturan pelajaran.",
            "Pilih Latihan berpemandu, Kursus klasik, atau Code craft.",
          ],
        },
      ],
    },
    {
      id: "certificates",
      nav: "Sertifikat",
      heading: "Mendapatkan sertifikat",
      blocks: [
        {
          p: "Sertifikat menyatakan bahwa seorang pelajar dengan nama tertentu mengetik pada kecepatan dan akurasi yang terukur, dalam bahasa tertentu, pada tanggal tertentu. Sertifikat ini kami yang menerbitkan — ini bukan kualifikasi yang telah disepakati untuk diakui oleh badan ujian atau pemberi kerja mana pun — dan ia adalah bukti jujur atas apa yang benar-benar dilakukan seseorang.",
        },
        { lab: "Melihat seberapa jauh lagi" },
        {
          steps: [
            "Buka menu dan pilih Akun.",
            "Pilih Kursus.",
            "Setiap pelajar punya satu baris yang menampilkan semua syarat, beserta sejauh mana pencapaiannya.",
          ],
        },
        {
          p: "Syaratnya berupa hal-hal seperti semua huruf sudah diperkenalkan, semua huruf sudah andal dan bukan sekadar pernah ditemui, cukup banyak pelajaran, cukup banyak hari terpisah, serta kecepatan dan akurasi yang bertahan. Ketika semuanya terpenuhi, tautan untuk mengikuti asesmen muncul di baris itu.",
        },
        {
          p: "Asesmennya singkat, dan dinilai di server kami, bukan di peramban kamu. Lulus, dan sertifikat diterbitkan dengan nomor di atasnya. Siapa pun yang kamu beri nomor itu bisa memeriksanya di halaman *Periksa sertifikat* — dan kamu yang memutuskan apakah namamu ditampilkan kepada mereka.",
        },
      ],
    },
    {
      id: "security",
      nav: "Menjaga akunmu tetap aman",
      heading: "Passkey, kode, dan siapa saja yang sudah masuk",
      blocks: [
        {
          p: "Kamu bisa masuk dengan kata sandi, dengan penyedia seperti Google, dengan tautan yang dikirim ke emailmu — atau dengan *passkey*, yang akan kami pilih. Passkey memakai sidik jari, wajah, atau PIN milik perangkatmu sendiri; tidak ada kata sandi yang bisa bocor, dan tidak ada yang kami simpan yang bisa dipakai untuk masuk sebagai dirimu.",
        },
        { lab: "Menambahkan passkey" },
        {
          steps: [
            "Buka menu dan pilih Akun, lalu Keamanan.",
            "Pilih Tambah passkey dan ikuti petunjuk di perangkatmu.",
          ],
        },
        {
          p: "*Verifikasi dua langkah* juga tersedia, memakai aplikasi autentikator, dengan kode pemulihan seandainya ponselnya hilang. Cetaklah kode itu dan simpan di tempat yang bukan ponsel.",
        },
        {
          p: "Halaman yang sama memuat aktivitas terbaru — masuk berhasil, masuk gagal, passkey ditambahkan, kata sandi diubah — masing-masing dengan perkiraan lokasi asalnya, sehingga hal yang bukan kamu lakukan mudah terlihat. Kalau ada yang janggal, *keluar dari semua perangkat* mengakhiri setiap sesi kecuali yang sedang kamu pakai.",
        },
        {
          p: "Ada juga *PIN orang tua*, yang mengunci pengaturan akun supaya anak yang memakai perangkat keluarga tidak bisa mengubahnya atau menghapus profil.",
        },
      ],
    },
    {
      id: "yours",
      nav: "Jadikan milikmu",
      heading: "Jadikan milikmu",
      blocks: [
        { lab: "Mengubah tema" },
        {
          steps: [
            "Buka menu dan pilih Akun, lalu Tampilan.",
            "Pilih terang, gelap, atau ikut perangkat.",
          ],
        },
        {
          p: "Kalau tidak ada tema bawaan yang pas untukmu, *perancang tema* memungkinkanmu meracik sendiri — termasuk warna jari yang dipakai papan ketik untuk mengajar. Aplikasi mengukur kontras apa pun yang kamu pilih dan menolak perpaduan yang tidak bisa dibaca siapa pun.",
        },
        {
          p: "Setiap pelajar di rumah bisa punya warnanya sendiri, jadi perangkat bersama tetap terasa milik siapa pun yang sedang duduk di depannya.",
        },
        { lab: "Mengubah bahasa situs" },
        {
          steps: ["Buka menu.", "Di bawah Bahasa situs, pilih bahasamu."],
        },
        {
          p: "Di layar latihan kamu juga bisa mengubah ukuran teks dan menyalakan atau mematikan suara kapan saja.",
        },
      ],
    },
    {
      id: "privacy",
      nav: "Privasi",
      heading: "Privasi, dalam satu kalimat",
      blocks: [
        {
          p: "Tidak ada iklan, dan tidak ada pelacak. Profil seorang anak tidak pernah keluar dari peramban kamu. Masuklah hanya kalau kamu ingin sinkronisasi atau berbagi; selain itu semuanya tetap di perangkat ini, dan kamu bebas menghapusnya kapan saja.",
        },
      ],
    },
    {
      id: "signout",
      nav: "Keluar",
      heading: "Keluar",
      blocks: [
        { lab: "Keluar dari akun" },
        { steps: ["Buka menu.", "Pilih Keluar dan konfirmasi."] },
        {
          p: "Riwayat latihanmu tetap aman di perangkat ini — dan di akunmu, kalau kamu membuatnya — siap untuk lain kali saat kamu duduk untuk mengetik.",
        },
      ],
    },
    {
      id: "tips",
      nav: "Tips",
      heading: "Beberapa kebiasaan yang benar-benar membantu",
      blocks: [
        {
          tips: [
            "Akurasi sebelum kecepatan — ketikan yang bersihlah yang melekat.",
            "Perbaiki kesalahan dengan tenang; jangan buru-buru mengejar ketertinggalan.",
            "Istirahatkan jarimu di baris pangkal — F dan J punya tonjolan kecil.",
            "Beberapa menit setiap hari lebih baik daripada satu jam seminggu sekali.",
          ],
        },
      ],
    },
  ],
};
