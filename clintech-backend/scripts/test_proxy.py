import requests
import time
import random

# ProxyMesh данные
USERNAME = "adilet"
PASSWORD = "Ado000999888"

class KaspiParser:
    def __init__(self):
        self.proxy_server = 'us-ca.proxymesh.com:31280'  # Для других серверов нужен платный план
        
        self.headers = {
            'Accept': 'application/json, text/*',
            'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7,kk;q=0.6,la;q=0.5',
            'Connection': 'keep-alive',
            'Cookie': 'ym_uid=1638856834231835799; ssaid=fd1be0d0-5722-11ec-8ee7-7d2bbae521af; kaspi.storefront.cookie.city=750000000',
            'Referer': 'https://kaspi.kz/shop/search/?text=DCF900P2T&qs=history',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
            'sec-ch-ua': '"Not/A)Brand";v="99", "Google Chrome";v="115", "Chromium";v="115"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'Authorization': 'Bearer 4btQF5hKhAuBpEBWi0vXaqpbNo9hRQnnmKtmmeuIeUA='
        }
    
    def get_proxy(self):
        proxy_url = f'http://{USERNAME}:{PASSWORD}@{self.proxy_server}'
        return {'http': proxy_url, 'https': proxy_url}
    
    def search_products(self, query, page=0):
        # Используем точно такой же URL как в вашем рабочем curl
        url = f"https://kaspi.kz/yml/product-view/pl/results?page={page}&q=%3AallMerchants%3A8498010"
        
        try:
            time.sleep(random.uniform(2, 4))
            
            response = requests.get(
                url,
                headers=self.headers,
                proxies=self.get_proxy(),
                timeout=20
            )
            
            print(f"URL: {url}")
            print(f"Статус: {response.status_code}")
            
            if response.status_code == 200:
                return response.json()
            else:
                print(f"Ошибка: {response.status_code}")
                print(f"Ответ: {response.text[:200]}")
                return None
                
        except Exception as e:
            print(f"Ошибка запроса: {e}")
            return None

# Использование
if __name__ == "__main__":
    parser = KaspiParser()
    
    results = parser.search_products("DCF900P2T", page=0)
    
    if results and 'data' in results:
        print(f"Найдено товаров: {len(results['data'])}")
        
        # Сначала посмотрим структуру первого товара
        if results['data']:
            print("\nСтруктура первого товара:")
            first_product = results['data'][0]
            for key, value in first_product.items():
                print(f"   {key}: {value}")
        
        print("\n" + "="*50)
        print("ТОВАРЫ:")
        
        for i, product in enumerate(results['data'][:10]):
            print(f"\n{i+1}. Товар ID: {product.get('id', 'Не указан')}")
            
            # Пробуем разные возможные названия полей
            name_fields = ['name', 'title', 'productName', 'itemName']
            price_fields = ['price', 'cost', 'amount', 'priceValue']
            merchant_fields = ['merchantName', 'seller', 'shopName', 'vendor']
            
            for field in name_fields:
                if product.get(field):
                    print(f"   Название: {product[field]}")
                    break
            else:
                print("   Название: Не найдено")
                
            for field in price_fields:
                if product.get(field):
                    print(f"   Цена: {product[field]} тенге")
                    break
            else:
                print("   Цена: Не найдена")
                
            for field in merchant_fields:
                if product.get(field):
                    print(f"   Продавец: {product[field]}")
                    break
            else:
                print("   Продавец: Не найден")
                
            print(f"   Рейтинг: {product.get('rating', 'Без рейтинга')}")
            
    else:
        print("Товары не найдены")