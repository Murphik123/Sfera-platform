import os
import json

base_dir = os.path.join(os.path.dirname(__file__), 'public', 'languages')
tm_file = os.path.join(base_dir, 'tm.json')
ru_file = os.path.join(base_dir, 'ru.json')
en_file = os.path.join(base_dir, 'en.json')

with open(tm_file, 'r', encoding='utf-8') as f:
    tm_data = json.load(f)

# Базовые переводы для частых элементов интерфейса Sfera
translations = {
    "ru": {
        "app_title": "Sfera — Мультиплатформа",
        "login": "Вход",
        "register": "Регистрация",
        "welcome": "Добро пожаловать в Sfera",
        "marketplace": "Маркетплейс",
        "bank": "Банк",
        "messenger": "Мессенджер",
        "tm_coin": "TM Coin",
        "tm_pay": "TM Pay",
        "ai_assistant": "ИИ Ассистент",
        "documents": "Документы",
        "dashboard": "Панель управления",
        "profile": "Профиль",
        "logout": "Выйти",
        "settings": "Настройки",
        "search_placeholder": "Поиск...",
        "save": "Сохранить",
        "cancel": "Отмена"
    },
    "en": {
        "app_title": "Sfera — Multi-platform",
        "login": "Login",
        "register": "Register",
        "welcome": "Welcome to Sfera",
        "marketplace": "Marketplace",
        "bank": "Bank",
        "messenger": "Messenger",
        "tm_coin": "TM Coin",
        "tm_pay": "TM Pay",
        "ai_assistant": "AI Assistant",
        "documents": "Documents",
        "dashboard": "Dashboard",
        "profile": "Profile",
        "logout": "Logout",
        "settings": "Settings",
        "search_placeholder": "Search...",
        "save": "Save",
        "cancel": "Cancel"
    }
}

for lang, lang_file in [('ru', ru_file), ('en', en_file)]:
    current_data = {}
    if os.path.exists(lang_file):
        with open(lang_file, 'r', encoding='utf-8') as f:
            current_data = json.load(f)
            
    # Заполняем все ключи из tm.json
    for key, tm_val in tm_data.items():
        # Если есть готовый качественный перевод в словаре translations
        if key in translations[lang]:
            current_data[key] = translations[lang][key]
        # Если ключа не было или там дубликаты из tm.json
        elif key not in current_data or current_data[key] == tm_val:
            current_data[key] = tm_val

    with open(lang_file, 'w', encoding='utf-8') as f:
        json.dump(current_data, f, ensure_ascii=False, indent=2)

    print(f"Словарь {lang}.json успешно актуализирован!")