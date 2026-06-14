#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import pika
import json
import uuid

def test_rabbitmq_event():
    """Отправляем тестовое событие напрямую в RabbitMQ"""
    
    try:
        # Подключаемся к RabbitMQ
        connection = pika.BlockingConnection(
            pika.ConnectionParameters(host='185.125.46.62', port=5672)
        )
        channel = connection.channel()
        
        # Создаем тестовое событие регистрации пользователя
        event = {
            "user_id": str(uuid.uuid4()),
            "email": "rabbitmq_test@example.com", 
            "role": "patient",
            "phone": "77476708705"
        }
        
        print("🐰 Отправляем событие в RabbitMQ...")
        print(f"📧 Exchange: clintech")
        print(f"🔑 Routing key: user.created")
        print(f"📄 Event: {json.dumps(event, indent=2)}")
        
        # Публикуем событие
        channel.basic_publish(
            exchange='clintech',
            routing_key='user.created',
            body=json.dumps(event),
            properties=pika.BasicProperties(
                delivery_mode=2,  # make message persistent
            )
        )
        
        print("✅ Событие отправлено в RabbitMQ!")
        print("📱 Проверьте, придет ли SMS...")
        
        connection.close()
        
    except Exception as e:
        print(f"❌ Ошибка: {e}")

if __name__ == "__main__":
    test_rabbitmq_event() 