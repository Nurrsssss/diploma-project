#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Тестовый скрипт для проверки подключения к серверу Clintech
"""

import requests
import json

def test_server_connection():
    """Проверка доступности сервера Clintech"""
    server_ip = "185.125.46.62"
    gateway_port = 8800
    base_url = f"http://{server_ip}:{gateway_port}"
    
    print("🔍 Тестирую подключение к серверу Clintech...")
    print(f"📍 Сервер: {server_ip}:{gateway_port}")
    print()
    
    # Тест 1: Проверка health endpoint
    print("1️⃣ Проверяю health endpoint...")
    try:
        response = requests.get(f"{base_url}/health", timeout=10)
        if response.status_code == 200:
            print("✅ Health endpoint доступен")
        else:
            print(f"⚠️ Health endpoint вернул: {response.status_code}")
    except Exception as e:
        print(f"❌ Health endpoint недоступен: {e}")
    
    # Тест 2: Проверка identity service через gateway
    print("\n2️⃣ Проверяю identity service...")
    try:
        # Попробуем зарегистрировать тестового пользователя
        test_payload = {
            "email": f"test.{int(__import__('time').time())}@test.com",
            "password": "TestPassword123!",
            "role": "patient"
        }
        
        response = requests.post(
            f"{base_url}/api/identity/auth/register",
            json=test_payload,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code in [200, 201]:
            print("✅ Identity service работает (регистрация успешна)")
        elif response.status_code == 400 and "already exists" in response.text:
            print("✅ Identity service работает (пользователь уже существует)")
        else:
            print(f"⚠️ Identity service вернул: {response.status_code} - {response.text}")
            
    except Exception as e:
        print(f"❌ Identity service недоступен: {e}")
    
    # Тест 3: Проверка specialist service через gateway
    print("\n3️⃣ Проверяю specialist service...")
    try:
        response = requests.get(
            f"{base_url}/api/specialist/doctors",
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            total_doctors = data.get("total_doctors", 0)
            print(f"✅ Specialist service работает (найдено {total_doctors} врачей)")
        else:
            print(f"⚠️ Specialist service вернул: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Specialist service недоступен: {e}")
    
    print("\n" + "="*50)
    print("📊 РЕЗУЛЬТАТ ТЕСТИРОВАНИЯ:")
    print(f"🌐 Сервер: {base_url}")
    print("🚀 Если все тесты прошли успешно - можно запускать импорт врачей!")
    print("="*50)

if __name__ == "__main__":
    test_server_connection() 