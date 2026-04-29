import cv2
import face_recognition
import numpy as np

def run_camera_test():
    # 1. Başlangıç - Kamerayı açıyoruz
    video_capture = cv2.VideoCapture(0)

    if not video_capture.isOpened():
        print("Hata: Kamera açılamadı.")
        return

    print("Kamera Testi Başlatıldı... Çıkmak için 'q' tuşuna basın.")

    while True:
        # Görüntü karesini yakala
        ret, frame = video_capture.read()
        if not ret:
            print("Görüntü alınamıyor.")
            break

        # İşlem hızını artırmak için küçük bir kopya kullanılabilir ama orijinal üzerinden devam ediyoruz
        # OpenCV BGR formatını kullanır, face_recognition ise RGB formatını bekler
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        # Görüntüdeki tüm yüzleri ve konumlarını bul
        face_locations = face_recognition.face_locations(rgb_frame)

        # Bulunan her yüz için bir kare çiz
        for (top, right, bottom, left) in face_locations:
            # Yüzün etrafına YEŞİL bir kare çiz (B, G, R) -> (0, 255, 0)
            cv2.rectangle(frame, (left, top), (right, bottom), (0, 255, 0), 2)

        # Sonucu göster
        cv2.imshow('Face Recognition Camera Test', frame)

        # 'q' tuşuna basıldığında döngüden çık
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    # Temizlik
    video_capture.release()
    cv2.destroyAllWindows()
    print("Kamera Testi Sonlandırıldı.")

if __name__ == "__main__":
    run_camera_test()
