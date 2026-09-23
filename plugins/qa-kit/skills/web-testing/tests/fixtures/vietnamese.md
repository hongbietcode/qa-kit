# Đăng nhập

| Mã TC | Tiêu đề | Điều kiện tiên quyết | Các bước | Dữ liệu | Kết quả mong đợi | Ưu tiên | Người phụ trách |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TC-01 | Đăng nhập hợp lệ | Tài khoản đã tồn tại | 1. Mở /login<br>2. Nhập tên `a\|b`<br>3. Nhấn Đăng nhập | email: qa@example.test | Hiển thị trang tổng quan | Cao | Linh |
| TC-02 | Thiếu mật khẩu |  | Nhấn Đăng nhập | mật khẩu: trống | Hiển thị lỗi bắt buộc | Trung bình | An |
