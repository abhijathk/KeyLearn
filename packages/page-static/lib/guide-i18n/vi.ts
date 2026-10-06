import { type GuideTranslation } from "../guide-content.tsx";

export const vi: GuideTranslation = {
  kicker: "Mọi điều bạn có thể làm",
  title: "Hướng dẫn sử dụng",
  dateline:
    "Hướng dẫn đầy đủ về KeyLearn — từ lần ghé thăm đầu tiên đến khi đăng xuất",
  navLabel: "Trên trang này",
  sections: [
    {
      id: "account",
      nav: "Tôi có cần tài khoản không?",
      heading: "Tôi có cần tài khoản không?",
      blocks: [
        {
          p: "Không. Bạn có thể gõ ngay khi vừa vào, và tiến trình của bạn được lưu ngay trên thiết bị này. Chỉ tạo tài khoản miễn phí nếu bạn muốn lịch sử của mình theo bạn sang thiết bị khác, muốn có bản sao lưu, hoặc muốn chia sẻ liên kết hồ sơ. Không có gì hữu ích bị khoá sau việc đăng nhập cả.",
        },
      ],
    },
    {
      id: "signin",
      nav: "Đăng nhập và mật khẩu",
      heading: "Đăng ký, đăng nhập và mật khẩu",
      blocks: [
        {
          p: "Mọi thứ đều nằm trong menu ở góc trên bên phải, dưới mục Đăng nhập hoặc đăng ký — cùng một cánh cửa dù bạn đã có tài khoản hay chưa.",
        },
        { lab: "Tạo tài khoản hoặc đăng nhập" },
        {
          steps: [
            "Mở menu và chọn Đăng nhập hoặc đăng ký.",
            "Tiếp tục với Google, Facebook hoặc mã khóa — hoặc nhập email rồi nhấn Tiếp tục.",
            "Email mới sẽ giúp bạn tạo mật khẩu; email đã có sẽ hỏi mật khẩu của bạn.",
          ],
        },
        { lab: "Đặt lại mật khẩu đã quên" },
        {
          steps: [
            "Ở màn hình đăng nhập, nhập email rồi nhấn Tiếp tục.",
            "Chọn Quên mật khẩu?",
            "Mở liên kết đặt lại mà chúng tôi gửi cho bạn.",
            "Chọn mật khẩu mới và đăng nhập.",
          ],
        },
      ],
    },
    {
      id: "profiles",
      nav: "Hồ sơ",
      heading: "Hồ sơ cho cả nhà",
      blocks: [
        {
          p: "KeyLearn được dựng như một gia đình: một tài khoản chứa tối đa bốn hồ sơ (tám nếu dùng bản premium), người lớn và trẻ em pha trộn tuỳ ý. Mỗi hồ sơ giữ tiến trình *riêng* của mình trên thiết bị này — không bao giờ bị trộn lẫn.",
        },
        { lab: "Thêm một hồ sơ" },
        {
          steps: [
            "Mở menu và chọn Tài khoản (hoặc “Thiết lập hồ sơ”).",
            "Chọn Thêm hồ sơ.",
            "Nhập tên.",
            "Đánh dấu là Người lớn hay Trẻ em.",
            "Chọn ảnh đại diện — một biểu tượng thân thiện, hoặc một Ảnh từ thiết bị của bạn.",
            "Với trẻ em, thêm năm sinh (nó chỉ dùng để chỉnh từ ngữ và nhịp độ cho hợp lứa tuổi).",
            "Lưu lại.",
          ],
        },
        { lab: "Chuyển sang người học khác" },
        {
          steps: [
            "Mở menu.",
            "Chạm vào một gương mặt dưới mục Người học — ứng dụng tiếp tục ngay chỗ họ đã dừng.",
          ],
        },
        { lab: "Sửa hoặc xoá một hồ sơ" },
        {
          steps: [
            "Mở menu và chọn Tài khoản.",
            "Chọn Sửa trên một hồ sơ, hoặc xoá nó để giải phóng một chỗ.",
          ],
        },
        {
          p: "Hồ sơ trẻ em có menu đơn giản và bị khoá bớt, còn các thao tác dành cho người lớn nằm sau một câu hỏi toán nhanh “A nhân B bằng mấy?”, để các bé không lạc vào phần cài đặt.",
        },
      ],
    },
    {
      id: "screen",
      nav: "Màn hình luyện tập",
      heading: "Màn hình luyện tập",
      blocks: [
        {
          p: "Cứ gõ thôi. Từ bạn cần trôi ngay phía trên bàn phím ảo; một ngôi sao chổi phát sáng chỉ vào phím kế tiếp; các phím được tô màu theo vùng ngón tay để bạn học được ngón nào với tới đâu; và một đôi bàn tay mờ đang đặt hờ cho thấy các ngón nằm ở đâu giữa những lần gõ. Cả kỹ năng này chỉ gói trong một thói quen: giữ mắt ở các con chữ, đừng nhìn tay.",
        },
      ],
    },
    {
      id: "journey",
      nav: "Hành trình của bạn",
      heading: "Bài học lớn lên thế nào — hành trình của bạn",
      blocks: [
        {
          p: "KeyLearn *thích ứng* theo bạn. Nó đo bạn gõ mỗi phím nhanh và gọn đến đâu, và chỉ thêm một chữ cái mới vào bộ chữ của bạn khi bạn đã gõ được những chữ hiện có vừa nhanh vừa chính xác. Bộ chữ lớn dần ấy chính là hành trình của bạn, từ dăm ba chữ cái đến trọn bảng chữ cái — độ khó tăng đúng bằng nhịp bạn tiến bộ, không bao giờ nhanh hơn, nên bạn luôn tập ngay ở ngưỡng của mình.",
        },
      ],
    },
    {
      id: "readout",
      nav: "Số liệu trực tiếp",
      heading: "Bảng số liệu trực tiếp",
      blocks: [
        {
          p: "Khi bạn gõ, bảng nổi hiển thị tốc độ và độ chính xác hiện tại, một biểu đồ nhỏ của các lượt gần đây, các vạch mục tiêu và chuỗi ngày luyện tập của bạn. Nó ở đó để động viên bạn, không phải để cằn nhằn.",
        },
        {
          p: "Nút *− và +* cạnh mục tiêu giúp bạn tăng hoặc giảm mục tiêu hôm nay ngay tại chỗ, không cần mở Cài đặt. Hãy hạ thấp nếu mấy chữ cái quen thuộc mãi không tiến bộ; tốc độ mà một chữ cái phải đạt chính là điều duy nhất quyết định chữ mới được mở khoá nhanh đến đâu.",
        },
        {
          p: "Nếu bạn đã chọn ảnh hồ sơ, bạn có thể để hình vẽ đó hiện mờ mờ phía sau những con số — Tài khoản, Giao diện, *Tác phẩm của bạn phía sau thống kê*, với thanh trượt chỉnh độ đậm nhạt. Tính năng này tắt cho đến khi bạn bật lên.",
        },
      ],
    },
    {
      id: "tools",
      nav: "Công cụ luyện tập",
      heading: "Công cụ luyện tập",
      blocks: [
        {
          p: "Những công cụ nhỏ bên cạnh phần chữ cho phép bạn mở phần hướng dẫn tham quan, làm lại bài hiện tại (Ctrl + Trái), nhảy sang bài kế tiếp (Ctrl + Phải), hiện hoặc ẩn bàn phím ảo, và đổi cỡ chữ luyện tập. Bánh răng mở toàn bộ Cài đặt, được nói đến ngay sau đây.",
        },
      ],
    },
    {
      id: "content",
      nav: "Bạn gõ gì",
      heading: "Chọn nội dung bạn gõ",
      blocks: [
        {
          p: "Mở Cài đặt rồi vào Nội dung luyện tập để chọn cách tạo ra các từ cho bạn:",
        },
        {
          tips: [
            "*Luyện tập có hướng dẫn* — chế độ thích ứng mặc định, mở rộng bảng chữ của bạn từng phím một.",
            "*Khoá học cổ điển* — một lộ trình cố định, đi qua các phím theo thứ tự định sẵn.",
            "*Mã nguồn* — mã thật từ những framework thật.",
            "*Từ thông dụng* — những từ phổ biến nhất trong ngôn ngữ của bạn.",
            "*Văn bản sách* — gõ xuyên qua những cuốn sách thật có sẵn trong ứng dụng.",
            "*Trích dẫn* — những ý trọn vẹn, ngắn gọn, giữ nguyên chữ hoa và dấu câu thật.",
            "*Văn bản của bạn* — dán bất cứ thứ gì bạn thích rồi luyện với nó.",
            "*Luyện số* — hàng số và bàn phím số.",
          ],
        },
        { lab: "Đổi nội dung bạn gõ" },
        {
          steps: [
            "Mở Cài đặt (bánh răng cạnh phần chữ luyện tập).",
            "Vào Nội dung luyện tập.",
            "Chọn một chế độ — với Văn bản sách hãy chọn một cuốn sách, với Văn bản của bạn hãy dán chữ của bạn vào.",
            "Đóng Cài đặt và gõ tiếp.",
          ],
        },
        {
          p: "Cũng ở màn hình đó, bạn đặt kích thước bảng chữ, tốc độ mục tiêu, độ dài mỗi bài học và mục tiêu mỗi ngày.",
        },
      ],
    },
    {
      id: "smart",
      nav: "Luyện tập thông minh",
      heading: "Các trợ thủ Luyện tập thông minh",
      blocks: [
        {
          p: "Bên cạnh luyện tập có hướng dẫn, Luyện tập thông minh thêm vào những trợ thủ nhẹ nhàng: bài tập gỡ nút thắt săn tìm các cặp phím chậm nhất của bạn, lặp lại ngắt quãng, bài ôn chống mai một để quay lại những phím đã han gỉ, tăng tự tin thông minh, và phục hồi phím. Tất cả đều được bật sẵn.",
        },
        { lab: "Bật hoặc tắt một trợ thủ" },
        {
          steps: [
            "Mở Cài đặt.",
            "Vào Luyện tập thông minh.",
            "Bật tắt trợ thủ nào bạn muốn — hoặc cứ để bật hết.",
          ],
        },
      ],
    },
    {
      id: "keyboard",
      nav: "Thiết lập bàn phím",
      heading: "Thiết lập bàn phím của bạn",
      blocks: [
        {
          p: "Mục Bàn phím trong Cài đặt là nơi bạn làm cho KeyLearn khớp với bàn phím của mình và với bố cục bạn muốn học.",
        },
        { lab: "Đổi bố cục bàn phím" },
        {
          steps: [
            "Mở Cài đặt.",
            "Vào mục Bàn phím.",
            "Chọn ngôn ngữ, rồi chọn bố cục (QWERTY, Dvorak, Colemak và nhiều hơn nữa).",
            "Để bật “Mô phỏng bố cục” để bạn luyện được bố cục đó dù máy tính đang đặt bố cục nào.",
            "Xem bản xem trước trực tiếp để kiểm tra.",
          ],
        },
        {
          p: "Trên cùng màn hình đó, bạn có thể chọn hình dạng bàn phím, tô màu phím theo vùng ngón tay và làm nổi bật phím tiếp theo trong lúc bạn vẫn đang học vị trí các phím.",
        },
        {
          p: "*Kiểu hoàn thiện* của bàn phím — vẻ ngoài của các phím — đi kèm với tài khoản. Khi đã đăng nhập, bạn có năm kiểu để chọn và kiểu tròn có sáu màu; một trong số đó đi theo màu chủ đề của bạn. Mọi thứ ở trên đều luôn là của bạn: ngôn ngữ, bố cục, hình dạng và vùng ngón tay không bao giờ bị giới hạn, vì chính chúng làm cho ứng dụng khớp với chiếc bàn phím trước mặt bạn.",
        },
      ],
    },
    {
      id: "display",
      nav: "Hiển thị",
      heading: "Hiển thị và cảm giác gõ",
      blocks: [
        {
          p: "Phần cài đặt Hiển thị và Gõ phím cho phép bạn hiện tốc độ theo từ hoặc ký tự mỗi phút và tinh chỉnh cảm giác khi gõ. Nút Cài lại luôn chỉ cách một cú nhấp nếu bạn muốn bắt đầu lại từ đầu.",
        },
        {
          p: "Giao diện của cả trang web nằm trong Tài khoản, Giao diện: sáng, tối hoặc theo hệ thống, một màu chủ đề và cỡ chữ áp dụng trên mọi trang. Mỗi người học trong nhà giữ thiết lập riêng, và thiết lập ấy đi theo họ — xem *Chăm sóc dữ liệu của bạn*.",
        },
      ],
    },
    {
      id: "progress",
      nav: "Tiến bộ của bạn",
      heading: "Tiến bộ của bạn — trang Hồ sơ",
      blocks: [
        {
          p: "Trang Hồ sơ là bản ghi đầy đủ của bạn: số liệu Toàn thời gian và Hôm nay ở trên cùng (thời gian đã luyện, số bài đã xong, tốc độ và độ chính xác tốt nhất cũng như thường ngày, và hôm nay so với mọi khi ra sao); bản đồ mọi chữ cái bạn đã mở khoá; câu chuyện từng phím một đã nhanh lên thế nào, kèm thanh trượt làm mượt; bức tranh tổng thể của mọi phím theo thời gian; và những chuyển phím chậm nhất còn đang níu chân bạn. Bạn thậm chí có thể đua với chính lượt gõ trước của mình dưới dạng một bóng ma để cảm nhận tiến bộ ngay lập tức.",
        },
        { lab: "Mở phần tiến bộ" },
        {
          steps: [
            "Mở menu.",
            "Chọn Hồ sơ.",
          ],
        },
      ],
    },
    {
      id: "data",
      nav: "Dữ liệu của bạn",
      heading: "Chăm sóc dữ liệu của bạn",
      blocks: [
        { lab: "Xóa số liệu của một hồ sơ" },
        {
          steps: [
            "Mở Hồ sơ của người học bạn muốn đặt lại.",
            "Cuộn xuống nút đặt lại ở cuối trang.",
            "Xác nhận “Xóa tất cả” — chỉ hồ sơ này bị xóa.",
          ],
        },
        { lab: "Tải dữ liệu của bạn về" },
        {
          steps: [
            "Mở Hồ sơ.",
            "Dùng tùy chọn tải về để lưu lịch sử của bạn thành một tệp.",
          ],
        },
        {
          p: "Hãy đăng nhập nếu bạn muốn lịch sử đồng bộ giữa các thiết bị và muốn chia sẻ liên kết hồ sơ công khai. Không có mạng quảng cáo, không có trình theo dõi, và bạn có thể xóa dữ liệu — hoặc cả tài khoản — bất cứ lúc nào.",
        },
        {
          p: "Giờ đây, đăng nhập không chỉ mang theo kết quả của bạn. Cài đặt, chủ đề và cỡ chữ, các lựa chọn trợ năng bạn đã chọn và sở thích riêng của từng người học đều đi theo hồ sơ chứ không theo trình duyệt — nên một người học mở KeyLearn trên máy tính mới sẽ tiếp tục đúng chỗ đã dừng, trên cùng màn hình, với cùng thiết lập, thay vì bắt đầu lại từ mặc định.",
        },
      ],
    },
    {
      id: "kids",
      nav: "Chế độ trẻ em",
      heading: "Chế độ trẻ em",
      blocks: [
        {
          p: "Trẻ luyện tập trên một con đường vui nhộn. Mỗi phím gõ đúng đưa nhân vật của bé tiến thêm một bước về nhà, và nhân vật lớn dần từ một em bé tí hon thành một người hùng trưởng thành khi càng nhiều chữ cái được mở. Một phím vừa học xong sẽ châm ngòi cho màn ăn mừng nho nhỏ, và mỗi buổi tập kết thúc bên đống lửa trại ấm cúng.",
        },
        { lab: "Chuyển sang chế độ trẻ em" },
        {
          steps: [
            "Mở menu.",
            "Chọn Trẻ em — hoặc chọn một hồ sơ trẻ em dưới mục Người học.",
          ],
        },
        {
          p: "Có hai thế giới để chọn — Dino Run, với một chú khủng long thân thiện, và Hero Trail, nơi một hiệp sĩ phiêu lưu qua khu rừng — mỗi thế giới đều có nhân vật để bạn chọn.",
        },
      ],
    },
    {
      id: "toybox",
      nav: "Hộp đồ chơi",
      heading: "Hộp đồ chơi cho trẻ",
      blocks: [
        { lab: "Mở hộp đồ chơi" },
        {
          steps: [
            "Ở màn hình trẻ em, chạm vào bánh răng phía trên khu vực chơi.",
          ],
        },
        {
          p: "Bên trong, bạn có thể đặt thế giới và nhân vật, Chữ to, Âm thanh, Bàn tay trợ giúp (hướng dẫn ngón tay phát sáng), Bàn phím (ẩn, đơn giản, hoặc bàn phím đầy đủ của người lớn), Chữ cái trên đường đi (các từ hiện thành khối ngay trong trò chơi), Hẹn giờ buổi tập, Lời cổ vũ (những câu động viên nho nhỏ), và — nằm gọn trong mục Nâng cao — các thanh trượt cho Độ sáng, Màu sắc và độ sinh động của thế giới. Ngoài vẻ ban ngày rực rỡ còn có vẻ ban đêm dịu êm.",
        },
        {
          p: "*Key style* thay đổi cách tô màu các phím, còn bản thân các phím thì không dịch chuyển: *Crayon* là phím trắng viền màu của ngón tay, còn *Rainbow* là bàn phím học tập với các màu cơ bản — khung xanh lá, số màu đỏ, chữ cái màu xanh dương với các nguyên âm được tách riêng — trong đó các phím ở khung hiện mũi tên thay vì chữ, dành cho trẻ chưa đọc được chữ “enter”. Ai cũng bắt đầu với Crayon. *Finger colours* bên cạnh sẽ tắt hẳn phần tô màu cho trẻ không còn cần đến nữa.",
        },
      ],
    },
    {
      id: "ages",
      nav: "Lớn lên",
      heading: "Lớn lên cùng con bạn",
      blocks: [
        {
          p: "KeyLearn lặng lẽ tự điều chỉnh theo tuổi của trẻ. Các bé nhỏ nhất thấy chữ to, thân thiện, nhịp độ dễ chịu, các khối chữ ngay trên đường đi và sự trợ giúp dịu dàng nhất; trẻ lớn hơn chuyển lên từ dài hơn, bàn phím đầy đủ và giao diện gọn gàng hơn. Bạn chỉ cần đặt năm sinh trong hồ sơ, phần còn lại tự khắc theo sau.",
        },
      ],
    },
    {
      id: "modes",
      nav: "Chế độ khác",
      heading: "Những cách luyện tập khác",
      blocks: [
        {
          p: "Ngoài việc luyện tập hằng ngày còn có *Kiểm tra tốc độ* — một đoạn văn ngắn gõ một lần, báo cho bạn số từ mỗi phút và độ chính xác mà không gắn với bài học nào; trình khám phá *Kiểu bố trí* để so sánh các kiểu bố trí bàn phím và bản đồ ngón tay của chúng; *Bảng thành tích* để xem bạn đứng ở đâu; và các cuộc đua *Nhiều người chơi* để so tốc độ với người khác theo thời gian thực.",
        },
        { lab: "Tìm chúng ở đâu" },
        {
          steps: [
            "Mở menu.",
            "Chọn Kiểm tra tốc độ, Kiểu bố trí, Bảng thành tích hoặc Nhiều người chơi.",
          ],
        },
      ],
    },
    {
      id: "access",
      nav: "Nếu có gì đó gây trở ngại",
      heading: "Nếu có gì đó trong ứng dụng gây trở ngại cho bạn",
      blocks: [
        {
          p: "Có hẳn một trang dành cho việc này, và nó được đặt *cho từng người học* — nên điều chỉnh của người này không bao giờ làm thay đổi của người khác.",
        },
        { lab: "Mở trang đó" },
        {
          steps: [
            "Mở menu và chọn Tài khoản.",
            "Chọn Trợ năng.",
            "Chọn người học ở trên cùng, rồi bật bao nhiêu tuỳ chọn bạn cần.",
          ],
        },
        {
          p: "Năm tuỳ chọn này *kết hợp* được với nhau. Một người mắc chứng khó đọc kèm run tay cần đến hai trong số đó, và bắt họ phải chọn một chẳng khác nào ứng dụng hỏi xem nên chiều theo khó khăn nào.",
        },
        {
          tips: [
            "Bình yên — không có gì chuyển động, không đếm, không tính giờ, và bỏ lỡ một ngày cũng không làm đứt chuỗi.",
            "Ít thứ cùng lúc — phần luyện tập chỉ mở ra với các con chữ và bàn phím.",
            "Dễ đọc hơn — kiểu chữ dành cho chứng khó đọc, giãn cách chữ và dòng rộng hơn, chữ đậm hơn.",
            "Màu tách bạch — màu ngón tay vẫn phân biệt được với người mù màu, và lỗi được báo bằng âm thanh chứ không chỉ bằng màu đỏ.",
            "Tay vững hơn — mục tiêu bấm to hơn, không cần bấm hai phím cùng lúc, và một phím tự lặp lại sẽ không bị tính hai lần.",
          ],
        },
        {
          p: "Bên dưới đó, *Tự đặt từng mục* mở ra từng công tắc riêng — mười lăm cái, gồm cả tốc độ đọc, phụ đề cho mọi thứ được đọc lên, số ngón tay trên từng phím, và khoảng thời gian bỏ qua một phím lặp. Một nút bấm đưa tất cả trở lại như cũ.",
        },
      ],
    },
    {
      id: "braille",
      nav: "Chữ nổi",
      heading: "Học trên bàn phím chữ nổi",
      blocks: [
        {
          p: "Người học khiếm thị hoặc nhìn kém sẽ có một trang hoàn toàn khác — nhập chữ nổi bằng sáu phím, chương trình học tính theo ô thay vì chữ cái, và hướng dẫn bằng lời suốt chặng đường. Đó là một cách học gõ riêng biệt, chứ không phải trang dành cho người sáng mắt đọc thành tiếng.",
        },
        { lab: "Bật cho một người học" },
        {
          steps: [
            "Mở menu và chọn Tài khoản, rồi Người học.",
            "Sửa người học đó, hoặc thêm người mới.",
            "Bật hỗ trợ thị lực rồi lưu lại.",
          ],
        },
        {
          p: "Từ giờ, người học đó sẽ vào thẳng trang chữ nổi mỗi khi đến lượt họ luyện tập. Tiến bộ của họ được tính theo ô thay vì chữ cái, và họ có thể nhận chứng nhận với cùng điều kiện như mọi người.",
        },
      ],
    },
    {
      id: "courses",
      nav: "Hai khoá học",
      heading: "Luyện tập có hướng dẫn, Cổ điển và mã nguồn",
      blocks: [
        {
          p: "*Luyện tập có hướng dẫn* là khoá học thích ứng: nó theo dõi những phím nào làm bạn chậm lại và xây bài học quanh chúng, chỉ thêm một chữ cái khi bạn đã gõ được những chữ đang có vừa nhanh vừa chính xác.",
        },
        {
          p: "*Khoá học cổ điển* là kiểu xưa cũ — một cái thang bài học cố định theo thứ tự định sẵn, đúng cách một cuốn sách dạy gõ vẫn dạy. Có người đơn giản là thích biết trước điều gì đến tiếp theo.",
        },
        {
          p: "Đó là hai khoá học riêng biệt với lịch sử riêng biệt, và chứng nhận được cấp trên khoá này hoặc khoá kia — không bao giờ trên tổng của cả hai, vì như thế sẽ tính tuần đầu tiên của bạn hai lần. Trang Khoá học trong tài khoản cho biết nó đang báo cáo về khoá nào.",
        },
        {
          p: "*Code craft* là kiểu luyện tập thứ ba: những đoạn mã thật trong ngôn ngữ bạn chọn, để dấu ngoặc, dấu chấm phẩy và thụt lề được rèn theo cách mà văn xuôi thông thường không bao giờ mang lại.",
        },
        { lab: "Chuyển qua lại giữa chúng" },
        {
          steps: [
            "Ở màn hình luyện tập, mở phần cài đặt bài học.",
            "Chọn Luyện tập có hướng dẫn, Khoá học cổ điển hoặc Code craft.",
          ],
        },
      ],
    },
    {
      id: "certificates",
      nav: "Chứng nhận",
      heading: "Nhận chứng nhận",
      blocks: [
        {
          p: "Một chứng nhận nói rằng người học có tên đó đã gõ ở tốc độ và độ chính xác đo được, bằng một ngôn ngữ nhất định, vào một ngày nhất định. Nó do chúng tôi cấp — đây không phải bằng cấp mà hội đồng thi hay nhà tuyển dụng nào đã đồng ý công nhận — và nó là bằng chứng trung thực về điều một người thực sự đã làm.",
        },
        { lab: "Xem bạn còn cách bao xa" },
        {
          steps: [
            "Mở menu và chọn Tài khoản.",
            "Chọn Khoá học.",
            "Mỗi người học có một hàng liệt kê mọi điều kiện, kèm mức độ đã đạt được.",
          ],
        },
        {
          p: "Các điều kiện gồm những thứ như đã giới thiệu hết mọi chữ cái, mọi chữ cái đều thành thạo chứ không chỉ mới gặp qua, đủ số bài học, đủ số ngày khác nhau, cùng tốc độ và độ chính xác duy trì được. Khi tất cả đã đạt, một liên kết để làm bài đánh giá sẽ hiện ra trên hàng đó.",
        },
        {
          p: "Bài đánh giá ngắn thôi, và được chấm trên máy chủ của chúng tôi chứ không phải trong trình duyệt của bạn. Vượt qua là chứng nhận được cấp kèm một mã số. Bất kỳ ai bạn đưa mã số đó đều có thể kiểm tra ở trang *Kiểm tra chứng nhận* — và bạn tự chọn có hiện tên mình cho họ hay không.",
        },
      ],
    },
    {
      id: "security",
      nav: "Giữ tài khoản an toàn",
      heading: "Passkey, mã xác thực và ai đã đăng nhập",
      blocks: [
        {
          p: "Bạn có thể đăng nhập bằng mật khẩu, bằng một nhà cung cấp như Google, bằng liên kết gửi tới email — hoặc bằng *passkey*, cách mà chính chúng tôi sẽ chọn. Passkey dùng vân tay, khuôn mặt hay mã PIN của chính thiết bị bạn; không có mật khẩu nào để rò rỉ, và không có thứ gì chúng tôi giữ có thể dùng để đăng nhập thay bạn.",
        },
        { lab: "Thêm một passkey" },
        {
          steps: [
            "Mở menu và chọn Tài khoản, rồi Bảo mật.",
            "Chọn Thêm passkey và làm theo hướng dẫn trên thiết bị của bạn.",
          ],
        },
        {
          p: "*Xác thực hai bước* cũng có sẵn, dùng ứng dụng xác thực, kèm mã khôi phục phòng khi bạn mất điện thoại. Hãy in chúng ra và cất ở nơi nào đó không phải chiếc điện thoại ấy.",
        },
        {
          p: "Cũng trang đó liệt kê hoạt động gần đây — các lần đăng nhập, các lần đăng nhập thất bại, một passkey được thêm, một mật khẩu được đổi — mỗi mục kèm vị trí ước chừng, để bạn dễ nhận ra điều gì không phải mình làm. Nếu thấy có gì sai, *đăng xuất khỏi mọi nơi* sẽ kết thúc mọi phiên trừ phiên bạn đang dùng.",
        },
        {
          p: "Còn có cả *mã PIN của phụ huynh*, khoá phần cài đặt tài khoản để trẻ dùng chung thiết bị gia đình không thể đổi chúng hay xoá một hồ sơ.",
        },
      ],
    },
    {
      id: "yours",
      nav: "Biến nó thành của bạn",
      heading: "Biến nó thành của bạn",
      blocks: [
        { lab: "Đổi giao diện" },
        {
          steps: [
            "Mở menu và chọn Tài khoản, rồi Giao diện.",
            "Chọn sáng, tối, hoặc theo thiết bị.",
          ],
        },
        {
          p: "Nếu không giao diện có sẵn nào hợp ý bạn, *trình thiết kế giao diện* cho phép bạn tự pha lấy — kể cả những màu ngón tay mà bàn phím dùng để dạy. Ứng dụng đo độ tương phản của bất cứ lựa chọn nào và từ chối những phối màu không ai đọc nổi.",
        },
        {
          p: "Mỗi người học trong nhà có thể có màu riêng, nên một thiết bị dùng chung vẫn thấy như thuộc về người đang ngồi trước nó.",
        },
        { lab: "Đổi ngôn ngữ trang web" },
        {
          steps: [
            "Mở menu.",
            "Trong mục Ngôn ngữ trang web, chọn ngôn ngữ của bạn.",
          ],
        },
        {
          p: "Ở màn hình luyện tập, bạn cũng có thể đổi cỡ chữ và bật tắt âm thanh bất cứ lúc nào.",
        },
      ],
    },
    {
      id: "privacy",
      nav: "Quyền riêng tư",
      heading: "Quyền riêng tư, trong một câu",
      blocks: [
        {
          p: "Không mạng quảng cáo, không trình theo dõi. Hồ sơ của trẻ không bao giờ rời khỏi trình duyệt của bạn. Chỉ đăng nhập nếu bạn muốn đồng bộ hoặc chia sẻ; nếu không, mọi thứ ở lại trên thiết bị này và bạn có thể xóa bất cứ lúc nào.",
        },
        {
          p: "Bạn có thể thấy một *dòng tài trợ* trên một số trang. Đó là dòng do chính chúng tôi bán và tự hiển thị — ở đây không có mạng quảng cáo và không có gì theo bạn ra khỏi trang. Dòng đó được chọn theo trang bạn đang xem, không bao giờ theo bất cứ điều gì chúng tôi biết về bạn, và nó không bao giờ hiện với trẻ em, trong thế giới trẻ em, trên tài khoản trường học hay khi đang có bài học. Chạm vào *Tại sao tôi thấy điều này?* trên bất kỳ dòng nào để xem lời giải thích ngay tại chỗ, còn những ai đã ủng hộ dự án sẽ không bao giờ thấy dòng nào cả.",
        },
      ],
    },
    {
      id: "support",
      nav: "Nhận trợ giúp",
      heading: "Nhận trợ giúp",
      blocks: [
        {
          p: "Mỗi tin nhắn bạn gửi cho chúng tôi đều trở thành *một cuộc trò chuyện bạn có thể quay lại*, chứ không phải một email biến mất. Nó nằm trong Tài khoản và có số tham chiếu riêng — số bạn nên nêu nếu sau này gọi điện hoặc viết thư lại.",
        },
        { lab: "Xin trợ giúp" },
        {
          steps: [
            "Mở menu và chọn Tài khoản, rồi chọn Hỗ trợ.",
            "Chọn Ghi yêu cầu và kể điều đang xảy ra.",
            "Đính kèm ảnh chụp màn hình nếu có ích — PNG, JPG hoặc PDF, mỗi tệp tối đa 10 MB.",
          ],
        },
        {
          p: "Câu trả lời sẽ hiện trong cuộc trò chuyện đó, và chiếc chuông ở đầu trang sẽ sáng lên khi có câu trả lời mới, nên bạn không cần ngồi canh trang. Những gì đã xong sẽ được gấp vào mục Đã giải quyết, mục này ban đầu đóng lại — điều bạn vẫn đang chờ chính là điều bạn nhìn thấy.",
        },
        { lab: "Ai trả lời" },
        {
          p: "Một trợ lý tên là Tab sẽ đọc trước và trả lời những gì nó có thể. Nó sẽ nói cho bạn biết nó là AI — không bao giờ giả vờ khác đi, và sẽ nói thẳng khi nó không biết điều gì đó.",
        },
        {
          p: "Một người thật sẽ tiếp nhận bất cứ khi nào đó là cách trả lời tốt hơn: mọi chuyện về tiền bạc, dữ liệu của bạn, sự an toàn, hoặc đơn giản vì bạn yêu cầu. Bạn không bao giờ phải hỏi hai lần, cũng không phải kể lại từ đầu — người tiếp nhận đã thấy hết những gì bạn nói.",
        },
        {
          p: "Nếu một tin nhắn có vẻ là tình huống khẩn cấp thật sự, câu trả lời lần nào cũng giống nhau và đến từ một kịch bản cố định chứ không phải từ trợ lý: số điện thoại khẩn cấp nơi bạn ở, và một người bên chúng tôi được báo ngay lập tức. Chúng tôi không thể gọi cuộc gọi đó thay bạn, và chúng tôi nói rõ điều ấy.",
        },
        { lab: "Dọn dẹp" },
        {
          p: "Bạn có thể xóa một cuộc trò chuyện khỏi danh sách bất cứ lúc nào bằng biểu tượng thùng rác bên cạnh. Một ghi chú nhỏ cạnh *Ghi yêu cầu* đếm số cuộc trò chuyện bạn đã xóa, nên một cuộc trò chuyện biến mất sẽ không bao giờ là điều bí ẩn.",
        },
        {
          p: "Trên thiết bị dùng chung trong gia đình, mục Hỗ trợ sẽ hỏi mã PIN của người lớn trước khi mở — các cuộc trò chuyện hỗ trợ là việc của tài khoản, và người đang luyện gõ không phải lúc nào cũng là người đã lập tài khoản.",
        },
      ],
    },
    {
      id: "signout",
      nav: "Đăng xuất",
      heading: "Đăng xuất",
      blocks: [
        { lab: "Đăng xuất" },
        { steps: ["Mở menu.", "Chọn Đăng xuất và xác nhận."] },
        {
          p: "Lịch sử luyện tập của bạn vẫn nằm an toàn trên thiết bị này — và trong tài khoản, nếu bạn đã tạo — sẵn sàng cho lần sau khi bạn ngồi xuống gõ.",
        },
      ],
    },
    {
      id: "tips",
      nav: "Mẹo nhỏ",
      heading: "Vài thói quen thật sự có ích",
      blocks: [
        {
          tips: [
            "Chính xác trước, tốc độ sau — gõ sạch mới là thứ đọng lại.",
            "Sửa lỗi thật bình tĩnh; đừng vội vàng gõ bù.",
            "Đặt hờ ngón tay trên hàng phím cơ sở — F và J có gờ nổi nhỏ.",
            "Vài phút mỗi ngày hơn hẳn một tiếng mỗi tuần.",
          ],
        },
      ],
    },
  ],
};
