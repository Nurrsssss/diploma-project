#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ИСПРАВЛЕННЫЙ скрипт для автоматической загрузки врачей в систему Clintech
Версия с правильным двухэтапным процессом регистрации
"""

import re
import json
import requests
import time
from typing import List, Dict, Optional
import uuid

class DoctorImporter:
    def __init__(self, gateway_url: str = "http://185.125.46.62:8800"):
        self.gateway_url = gateway_url
        
        # Маппинг специальностей
        self.specialties_map = {
            "Терапевт": "Терапевт",
            "Гастроэнтеролог": "Гастроэнтеролог", 
            "Невролог": "Невролог",
            "Гинеколог": "Гинеколог",
            "Уролог": "Уролог",
            "Педиатр": "Педиатр",
            "Эндокринолог": "Эндокринолог",
            "Кардиолог": "Кардиолог",
            "Нейрохирург": "Нейрохирург",
            "Ревматолог": "Ревматолог",
            "Отоларинголог": "Отоларинголог",
            "Хирург": "Хирург",
            "Пульмонолог": "Пульмонолог",
            "Онколог": "Онколог",
            "Инфекционист": "Инфекционист",
            "Ортопед-Травматолог": "Ортопед-травматолог",
            "Офтальмолог": "Офтальмолог"
        }
        
        # Список созданных врачей с паролями
        self.created_doctors = []
    
    def parse_doctors_file(self, file_path: str) -> List[Dict]:
        """Парсинг файла с данными врачей"""
        doctors = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Разделяем на блоки врачей
            doctor_blocks = content.split('\n\n')
            
            for block in doctor_blocks:
                if not block.strip():
                    continue
                    
                doctor = self._parse_doctor_block(block.strip())
                if doctor:
                    doctors.append(doctor)
                    
            print(f"📋 Найдено {len(doctors)} врачей в файле")
            return doctors
            
        except Exception as e:
            print(f"❌ Ошибка чтения файла: {e}")
            return []
    
    def _parse_doctor_block(self, block: str) -> Optional[Dict]:
        """Парсинг одного блока данных врача"""
        lines = block.split('\n')
        if len(lines) < 3:
            return None
            
        try:
            # Парсим ФИО (первая строка)
            full_name = lines[0].strip()
            name_parts = full_name.split()
            
            # Специальность (вторая строка)
            specialty = lines[1].strip()
            
            # Описание и цена
            description_lines = []
            price = 0.0
            
            for line in lines[2:]:
                if line.startswith("Стоимость консультации:"):
                    # Извлекаем цену
                    price_match = re.search(r'(\d+(?:\s?\d+)*)\s*тг', line)
                    if price_match:
                        price_str = price_match.group(1).replace(' ', '')
                        price = float(price_str)
                else:
                    description_lines.append(line.strip())
            
            description = ' '.join(description_lines).strip()
            
            # Генерируем email и пароль
            email = self._generate_email(full_name)
            password = self._generate_password()
            
            # Маппим специальность
            mapped_specialty = self.specialties_map.get(specialty, specialty)
            
            doctor_data = {
                "full_name": full_name,
                "first_name": name_parts[1] if len(name_parts) > 1 else "",
                "middle_name": name_parts[2] if len(name_parts) > 2 else "",
                "last_name": name_parts[0] if name_parts else "",
                "specialty": mapped_specialty,
                "description": description,
                "price": price,
                "email": email,
                "password": password,  # Сохраняем пароль для вывода
                "phone": "+7 (777) 123-45-67"
            }
            
            return doctor_data
            
        except Exception as e:
            print(f"❌ Ошибка парсинга врача: {e}")
            return None
    
    def _generate_email(self, full_name: str) -> str:
        """Генерация email на основе ФИО"""
        name_parts = full_name.split()
        if len(name_parts) >= 2:
            surname = self._transliterate(name_parts[0]).lower()
            name = self._transliterate(name_parts[1]).lower()
            return f"{surname}.{name}@clintech.clinic"
        else:
            return f"doctor.{str(uuid.uuid4())[:8]}@clintech.clinic"
    
    def _generate_password(self) -> str:
        """Генерация временного пароля"""
        return f"Clintech{str(uuid.uuid4())[:8]}!"
    
    def _transliterate(self, text: str) -> str:
        """Простая транслитерация кириллицы в латиницу"""
        translit_map = {
            'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
            'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
            'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
            'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
            'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
        }
        
        result = ""
        for char in text.lower():
            result += translit_map.get(char, char)
        
        return result
    
    def register_doctor_user(self, doctor_data: Dict) -> bool:
        """Регистрация пользователя врача через identity service (БЕЗ токена)"""
        try:
            user_payload = {
                "email": doctor_data["email"],
                "password": doctor_data["password"],
                "role": "doctor"
            }
            
            response = requests.post(
                f"{self.gateway_url}/auth/register",
                json=user_payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code in [200, 201]:
                print(f"✅ Пользователь зарегистрирован: {doctor_data['email']}")
                print("   ⏳ Ожидаю автоматического создания заготовки профиля...")
                return True
            else:
                print(f"❌ Ошибка регистрации {doctor_data['email']}: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Ошибка запроса регистрации: {e}")
            return False
    
    def login_doctor(self, doctor_data: Dict) -> Optional[Dict]:
        """Вход врача для получения токена и user_id"""
        try:
            login_payload = {
                "email": doctor_data["email"],
                "password": doctor_data["password"]
            }
            
            response = requests.post(
                f"{self.gateway_url}/auth/login",
                json=login_payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                token = data.get("token")
                
                if not token:
                    print(f"❌ Токен не получен для {doctor_data['email']}")
                    return None
                
                # Получаем user_id из токена через /auth/validate
                user_data = self._get_user_from_token(token)
                if user_data:
                    print(f"✅ Вход выполнен: {doctor_data['email']}")
                    return {
                        "token": token,
                        "user_id": user_data.get("user_id")
                    }
                else:
                    print(f"❌ Не удалось получить данные пользователя из токена")
                    return None
            else:
                print(f"❌ Ошибка входа {doctor_data['email']}: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            print(f"❌ Ошибка запроса входа: {e}")
            return None
    
    def _get_user_from_token(self, token: str) -> Optional[Dict]:
        """Получение данных пользователя из токена"""
        try:
            response = requests.post(
                f"{self.gateway_url}/auth/validate",
                headers={"Authorization": f"Bearer {token}"}
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                return None
                
        except Exception as e:
            print(f"❌ Ошибка валидации токена: {e}")
            return None
    
    def update_doctor_profile(self, doctor_data: Dict, auth_data: Dict) -> bool:
        """ОБНОВЛЕНИЕ профиля врача через specialist service (правильный подход)"""
        try:
            # Используем правильный эндпоинт для ОБНОВЛЕНИЯ профиля
            user_id = auth_data["user_id"]
            token = auth_data["token"]
            
            doctor_payload = {
                "user_id": user_id,  # Реальный user_id из токена
                "first_name": doctor_data["first_name"],
                "middle_name": doctor_data["middle_name"],
                "last_name": doctor_data["last_name"],
                "description": doctor_data["description"],
                "email": doctor_data["email"],
                "phone": doctor_data["phone"],
                "avatar_url": "",
                "roles": [doctor_data["specialty"]],
                "price": doctor_data["price"],
                "education": [f"Медицинское образование, стаж работы в области медицины"],
                "certificates": ["Сертификат специалиста", "Квалификационная категория"]
            }
            
            # ПРАВИЛЬНЫЙ эндпоинт для обновления профиля врача!
            response = requests.put(
                f"{self.gateway_url}/users/{user_id}/doctor",
                json=doctor_payload,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {token}"
                }
            )
            
            if response.status_code in [200, 201]:
                data = response.json()
                doctor_id = data.get("id")
                print(f"✅ Профиль врача обновлен: {doctor_data['full_name']} -> {doctor_id}")
                return True
            else:
                print(f"❌ Ошибка обновления профиля {doctor_data['full_name']}: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Ошибка запроса обновления профиля: {e}")
            return False
    
    def import_doctors(self, file_path: str, delay: float = 2.0) -> None:
        """Основной метод импорта врачей"""
        print("🚀 Начинаю импорт врачей...")
        print("ℹ️  Правильный процесс: регистрация → автоматическая заготовка → вход → обновление профиля")
        print()
        
        # Парсинг файла
        doctors = self.parse_doctors_file(file_path)
        if not doctors:
            print("❌ Не найдено врачей для импорта")
            return
        
        # Счетчики
        success_count = 0
        error_count = 0
        
        print(f"📊 Начинаю создание {len(doctors)} врачей...\n")
        
        for i, doctor_data in enumerate(doctors, 1):
            print(f"👨‍⚕️ [{i}/{len(doctors)}] Обрабатываю: {doctor_data['full_name']}")
            
            # Шаг 1: Регистрируем пользователя (система автоматически создает заготовку через RabbitMQ)
            if not self.register_doctor_user(doctor_data):
                error_count += 1
                print("   ⚠️  Пропускаю этого врача\n")
                continue
            
            # Даем время RabbitMQ и specialist_service обработать событие
            print("   ⏳ Ожидаю обработки события (5 сек)...")
            time.sleep(5)
            
            # Шаг 2: Входим для получения токена и user_id
            auth_data = self.login_doctor(doctor_data)
            if not auth_data:
                error_count += 1
                print("   ⚠️  Пропускаю этого врача\n")
                continue
            
            time.sleep(delay)
            
            # Шаг 3: Обновляем профиль врача полными данными
            if self.update_doctor_profile(doctor_data, auth_data):
                success_count += 1
                # Сохраняем данные для отчета
                self.created_doctors.append({
                    "name": doctor_data["full_name"],
                    "email": doctor_data["email"],
                    "password": doctor_data["password"],
                    "specialty": doctor_data["specialty"]
                })
            else:
                error_count += 1
            
            time.sleep(delay)
            print()
        
        # Отчет
        self._print_final_report(success_count, error_count, len(doctors))
        self._save_credentials_file()
    
    def _print_final_report(self, success_count: int, error_count: int, total: int) -> None:
        """Печать финального отчета"""
        print("=" * 60)
        print(f"📊 РЕЗУЛЬТАТЫ ИМПОРТА:")
        print(f"✅ Успешно создано: {success_count}")
        print(f"❌ Ошибок: {error_count}")
        print(f"📋 Всего обработано: {total}")
        print("=" * 60)
        
        if success_count > 0:
            print("\n📧 ДАННЫЕ СОЗДАННЫХ ВРАЧЕЙ:")
            for doctor in self.created_doctors:
                print(f"👨‍⚕️ {doctor['name']} ({doctor['specialty']})")
                print(f"   📧 Email: {doctor['email']}")
                print(f"   🔑 Пароль: {doctor['password']}")
                print()
    
    def _save_credentials_file(self) -> None:
        """Сохранение данных врачей в файл"""
        if not self.created_doctors:
            return
            
        filename = f"врачи_данные_{int(time.time())}.txt"
        try:
            with open(filename, 'w', encoding='utf-8') as f:
                f.write("ДАННЫЕ СОЗДАННЫХ ВРАЧЕЙ В Clintech\n")
                f.write("=" * 50 + "\n\n")
                
                for doctor in self.created_doctors:
                    f.write(f"Врач: {doctor['name']}\n")
                    f.write(f"Специальность: {doctor['specialty']}\n")
                    f.write(f"Email: {doctor['email']}\n")
                    f.write(f"Пароль: {doctor['password']}\n")
                    f.write("-" * 30 + "\n\n")
                
                f.write(f"\nВсего создано: {len(self.created_doctors)} врачей\n")
                f.write(f"Дата создания: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
            
            print(f"💾 Данные врачей сохранены в файл: {filename}")
            
        except Exception as e:
            print(f"❌ Ошибка сохранения файла: {e}")

    def create_test_doctor(self) -> Dict:
        """Создание тестового врача с реалистичными данными"""
        print("👨‍⚕️ Создаю тестового врача...")
        
        test_doctor = {
            "full_name": "Жумабеков Арман Серикович",
            "first_name": "Арман", 
            "middle_name": "Серикович",
            "last_name": "Жумабеков",
            "specialty": "Кардиолог",
            "description": "Врач-кардиолог высшей категории. Специализируется на диагностике и лечении заболеваний сердечно-сосудистой системы. Опыт работы более 15 лет. Проводит эхокардиографию, холтеровское мониторирование, нагрузочные пробы. Принимает пациентов с ишемической болезнью сердца, артериальной гипертензией, нарушениями ритма сердца.",
            "price": 25000.0,
            "email": "zhumabekov.arman@clintech.clinic",
            "password": "TestDoctor2024!",
            "phone": "+7 (777) 555-12-34"
        }
        
        print(f"✅ Тестовый врач создан: {test_doctor['full_name']}")
        print(f"📧 Email: {test_doctor['email']}")
        print(f"🔑 Пароль: {test_doctor['password']}")
        print(f"⚕️ Специальность: {test_doctor['specialty']}")
        print()
        
        return test_doctor

    def import_test_doctor(self, delay: float = 2.0) -> None:
        """Импорт одного тестового врача"""
        print("🧪 ТЕСТОВЫЙ РЕЖИМ: Создание одного врача")
        print("=" * 50)
        
        # Создаем тестового врача
        doctor_data = self.create_test_doctor()
        
        print("🚀 Начинаю тестовый импорт...")
        print("ℹ️  Процесс: регистрация → автоматическая заготовка → вход → обновление профиля")
        print()
        
        success = False
        
        print(f"👨‍⚕️ Обрабатываю: {doctor_data['full_name']}")
        
        # Шаг 1: Регистрируем пользователя
        if not self.register_doctor_user(doctor_data):
            print("❌ Не удалось зарегистрировать тестового врача")
            return
        
        # Даем время RabbitMQ и specialist_service обработать событие
        print("   ⏳ Ожидаю обработки события (5 сек)...")
        time.sleep(5)
        
        # Шаг 2: Входим для получения токена и user_id
        auth_data = self.login_doctor(doctor_data)
        if not auth_data:
            print("❌ Не удалось войти в систему")
            return
        
        time.sleep(delay)
        
        # Шаг 3: Обновляем профиль врача полными данными
        if self.update_doctor_profile(doctor_data, auth_data):
            success = True
            # Сохраняем данные для отчета
            self.created_doctors.append({
                "name": doctor_data["full_name"],
                "email": doctor_data["email"],
                "password": doctor_data["password"],
                "specialty": doctor_data["specialty"]
            })
        
        print()
        
        # Отчет
        if success:
            print("=" * 60)
            print("🎉 ТЕСТОВЫЙ ИМПОРТ УСПЕШЕН!")
            print(f"✅ Врач создан: {doctor_data['full_name']}")
            print(f"📧 Email: {doctor_data['email']}")
            print(f"🔑 Пароль: {doctor_data['password']}")
            print(f"⚕️ Специальность: {doctor_data['specialty']}")
            print("=" * 60)
            
            # Сохраняем в файл
            self._save_credentials_file()
        else:
            print("=" * 60)
            print("❌ ТЕСТОВЫЙ ИМПОРТ НЕ УДАЛСЯ")
            print("Проверьте логи выше для диагностики проблемы")
            print("=" * 60)

def main():
    """Главная функция"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Импорт врачей в систему Clintech (ПРАВИЛЬНАЯ ВЕРСИЯ)')
    parser.add_argument('file_path', nargs='?', help='Путь к файлу с данными врачей (не нужен для --test)')
    parser.add_argument('--gateway-url', default='http://185.125.46.62:8800', help='URL Gateway сервиса')
    parser.add_argument('--delay', type=float, default=2.0, help='Задержка между запросами (сек)')
    parser.add_argument('--test', action='store_true', help='Создать одного тестового врача вместо импорта из файла')
    
    args = parser.parse_args()
    
    importer = DoctorImporter(gateway_url=args.gateway_url)
    
    if args.test:
        # Тестовый режим - создаем одного врача
        importer.import_test_doctor(delay=args.delay)
    else:
        # Обычный режим - импорт из файла
        if not args.file_path:
            print("❌ Ошибка: Укажите путь к файлу с врачами или используйте --test для тестового режима")
            parser.print_help()
            return
        
        importer.import_doctors(args.file_path, delay=args.delay)

if __name__ == "__main__":
    main() 