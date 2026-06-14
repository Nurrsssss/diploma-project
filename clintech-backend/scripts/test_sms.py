#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import requests
import json

# Тестируем SMS уведомление через API
def test_sms_notification():
    # Данные для тестирования
    url = "http://185.125.46.62:8806/notifications"
    
    # Нужно добавить recipientId (UUID) - используем случайный для теста
    import uuid
    
    notification_data = {
        "type": "user.registered",
        "channel": "sms",
        "recipientId": str(uuid.uuid4()),  # Добавляем обязательный recipientId
        "recipient": "77476708705",  # Ваш номер
        "message": "user_registered",
        "metadata": {
            "email": "test@example.com",
            "role": "patient"
        }
    }
    
    headers = {
        "Content-Type": "application/json"
        # Убираем Authorization для простоты
    }
    
    try:
        print("📱 Отправляем тестовое SMS уведомление...")
        print(f"URL: {url}")
        print(f"Данные: {json.dumps(notification_data, indent=2, ensure_ascii=False)}")
        
        response = requests.post(url, json=notification_data, headers=headers)
        
        print(f"\n📊 Статус ответа: {response.status_code}")
        print(f"📄 Ответ сервера: {response.text}")
        
        if response.status_code == 200 or response.status_code == 201:
            print("✅ SMS уведомление отправлено успешно!")
        else:
            print("❌ Ошибка отправки SMS уведомления")
            
    except requests.exceptions.ConnectionError:
        print("❌ Не удается подключиться к серверу. Проверьте что notification_service запущен.")
    except Exception as e:
        print(f"❌ Ошибка: {e}")

# Тестируем прямой вызов SMSC.kz API
def test_smsc_direct():
    import urllib.parse
    
    # Параметры
    login = "clintech"
    password = "123QWEqwe!"
    phone = "77476708705"  # Ваш номер
    message = "Тест SMS через SMSC.kz API от Clintech"
    
    # Формируем URL
    params = {
        'login': login,
        'psw': password,
        'phones': phone,
        'mes': message,
        'fmt': '3'  # JSON формат
    }
    
    url = "https://smsc.kz/sys/send.php?" + urllib.parse.urlencode(params)
    
    try:
        print("\n🔗 Тестируем прямой вызов SMSC.kz API...")
        print(f"URL: {url}")
        
        response = requests.get(url)
        
        print(f"\n📊 Статус ответа: {response.status_code}")
        print(f"📄 Ответ SMSC: {response.text}")
        
        if response.status_code == 200:
            if "OK" in response.text or '"id"' in response.text:
                print("✅ Прямой вызов SMSC API успешен!")
            else:
                print("❌ SMSC API вернул ошибку")
        else:
            print("❌ Ошибка HTTP при вызове SMSC API")
            
    except Exception as e:
        print(f"❌ Ошибка: {e}")

if __name__ == "__main__":
    print("🧪 Тестирование SMS интеграции SMSC.kz")
    print("=" * 50)
    
    # Сначала тестируем прямой API
    test_smsc_direct()
    
    # Потом тестируем через наш сервис
    test_sms_notification()
    
    print("\n✨ Тестирование завершено!") 