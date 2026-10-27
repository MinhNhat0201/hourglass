# Hourglass

Đồng hồ cát cho người thích sự đơn giản: lộn ngược điện thoại để thả cát, lộn lại để đảo dòng cát, đặt nằm phẳng để tạm dừng. Mọi thao tác đều có nút bấm thay thế.

MVP theo spec "Ứng dụng Hourglass Timer". Các câu hỏi mở ở mục 12 dùng đúng mặc định đề xuất: lộn lần đầu là bắt đầu, lộn khi đang chạy là đảo cát, tracked time không bị trừ, chạy cả iOS lẫn Android, hiện số đếm (có thể ẩn), tạm dừng khi nằm phẳng (có thể tắt).

## Stack

Expo SDK 58 (React Native 0.88, TypeScript), một codebase cho iOS và Android.

| Việc | Thư viện |
|---|---|
| Điều hướng | expo-router (`src/app`) |
| Vẽ đồng hồ cát | @shopify/react-native-skia |
| Cảm biến | expo-sensors (Accelerometer) |
| Thông báo hết giờ | expo-notifications (lên lịch theo giờ, `alarmClock` trên Android) |
| Âm thanh, rung | expo-audio, expo-haptics |
| Lưu trữ | expo-sqlite (bản xem trên web dùng localStorage) |
| Đa ngôn ngữ | expo-localization + từ điển vi/en (`src/i18n`) |

## Chạy

```sh
npm install            # postinstall chép canvaskit.wasm vào public/ cho bản web
npm test               # test đơn vị phần lõi
npm run typecheck
npx expo lint
npx expo run:ios       # hoặc run:android. Cần development build vì có Skia/SQLite/notifications,
                       # không chạy được trong Expo Go
npx expo start --web   # xem nhanh giao diện trên trình duyệt (chỉ dùng nút, không có cảm biến)
```

## Cấu trúc

```
src/domain/          Lõi thuần TypeScript, không phụ thuộc React Native
  engine.ts          Mô hình A/B và máy trạng thái (spec §3, §4, §7)
  clock.ts           Đồng hồ đơn điệu vẫn đếm khi máy ngủ
  flipDetector.ts    Nhận diện lộn / nằm phẳng: hysteresis + debounce (§5.2)
  motionSimulator.ts Sinh dữ liệu cảm biến giả để test
  format.ts          Định dạng thời gian, gom lịch sử theo ngày/tuần
  __tests__/         Test cho các quy tắc §3, §4, §7 và tiêu chí chấp nhận 1, 2, 4, 5
src/services/        Cảm biến, thông báo, chuông/rung, lưu trữ
src/state/           AppProvider: nối engine với cảm biến, thông báo, lưu trữ
src/components/hourglass/  Hình đồng hồ cát (Skia) và hình học thể tích cát
src/app/             Màn hình: trang chủ, đồng hồ, tạo/sửa, lịch sử, cài đặt
```

## Ghi chú thiết kế

- **Thời gian.** Engine không đếm tick. Mỗi lần chuyển trạng thái, engine tính lại từ mốc thời gian lần trước. Khi app chạy, khoảng thời gian lấy từ `performance.now()`, nên chỉnh giờ hệ thống hay đổi múi giờ không ảnh hưởng. Đồng hồ này dừng khi máy ngủ, nên nếu giờ thực trôi nhiều hơn rõ rệt thì lấy theo giờ thực (`clock.ts`). Khi app bị kill rồi mở lại, phần thời gian đã trôi tính theo giờ thực (không bao giờ âm). Nếu đã quá hạn thì session được ghi `completed` với `endedAt` là thời điểm hết giờ dự kiến.
- **Thông báo.** Khi cát đang chảy, luôn có một thông báo được lên lịch vào thời điểm hết giờ dự kiến. Mỗi lần lộn, tạm dừng hay kết thúc thì huỷ và lên lịch lại. Vì vậy app ở nền, khoá màn hình hay bị kill vẫn báo đúng giờ. Khi app đang mở, thông báo bị chặn và chuông trong app kêu thay. Android dùng `USE_EXACT_ALARM` (quyền dành cho app hẹn giờ) cùng `delivery: 'alarmClock'` để không bị chế độ tiết kiệm pin làm trễ.
- **Hướng máy.** UI khoá dọc. Cát được vẽ theo tư thế vật lý: buồng đang ở phía trên theo trọng lực chứa `A`. Khi máy lộn ngược, chữ số cũng xoay theo để vẫn đọc được. Bề mặt cát nghiêng theo trọng lực, chỉ là hiệu ứng, không ảnh hưởng logic. Lật bằng nút có hiệu ứng xoay nửa vòng.
- **Nhận diện lộn.** Cần lệch ≥ 135° khỏi tư thế hiện tại và giữ ổn định 300 ms. Chỉ huỷ khi quay về dưới 120° (hysteresis). Mẫu có độ lớn ngoài khoảng 0,6–1,4 g bị bỏ qua vì đó là rung lắc, không phải trọng lực. Nằm phẳng (nghiêng < 25°) liên tục 2 giây thì tạm dừng, dựng lên (> 35°) thì chạy tiếp. Tạm dừng bằng nút chỉ tiếp tục được bằng nút.
- **Session.** Mỗi lượt chạy là một session. "Lặp lại" (hoặc lộn khi bật Tự lặp) tạo session mới.

## Đã kiểm tra / chưa kiểm tra

- Đã kiểm tra: 41 test đơn vị cho lõi (mô hình thời gian, máy trạng thái, khôi phục sau khi kill, nhận diện lộn với rung tay và lộn liên tiếp nhanh). Typecheck và lint sạch. Bản web chạy thật trong trình duyệt headless: bắt đầu, lật, tạm dừng, kết thúc, hết giờ 10 giây và ghi lịch sử đều đúng.
- **Chưa kiểm tra trên máy thật** vì chưa có thiết bị trong môi trường này: cảm biến, thông báo nền, SQLite, chuông/rung, hiệu năng 60 fps. Riêng dấu trục Y của accelerometer trên iOS (`src/services/sensors.ts`) suy ra từ mã nguồn expo-sensors, cần xác nhận khi chạy lần đầu.
- iOS không cho tắt rung riêng cho từng thông báo. Công tắc "Rung" vẫn áp dụng cho chuông trong app và trên Android.
