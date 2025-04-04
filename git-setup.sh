#!/bin/bash
# Скрипт для настройки удаленного Git репозитория для проекта NeuroMail

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}===============================================${NC}"
echo -e "${GREEN}Настройка удаленного репозитория для NeuroMail${NC}"
echo -e "${BLUE}===============================================${NC}"
echo ""

echo -e "${YELLOW}[ИНСТРУКЦИЯ]${NC}"
echo "1. Создайте новый репозиторий на GitHub (или другом сервисе)"
echo "2. Не добавляйте README, .gitignore или лицензию при создании"
echo "3. После создания репозитория скопируйте его URL"
echo "4. Вставьте URL ниже:"
echo ""

read -p "Введите URL репозитория (например, https://github.com/username/neuromail.git): " repo_url

if [ -z "$repo_url" ]; then
    echo -e "${RED}Ошибка: URL репозитория не может быть пустым${NC}"
    exit 1
fi

# Добавление удаленного репозитория
echo -e "\n${YELLOW}Добавление удаленного репозитория...${NC}"
git remote add origin $repo_url

# Проверка успешного добавления
if [ $? -eq 0 ]; then
    echo -e "${GREEN}Удаленный репозиторий успешно добавлен!${NC}"
else
    echo -e "${RED}Ошибка при добавлении удаленного репозитория${NC}"
    exit 1
fi

# Пуш в удаленный репозиторий
echo -e "\n${YELLOW}Отправка кода в удаленный репозиторий...${NC}"
git push -u origin main

# Проверка успешного push
if [ $? -eq 0 ]; then
    echo -e "${GREEN}Код успешно отправлен в удаленный репозиторий!${NC}"
    echo -e "\n${BLUE}===============================================${NC}"
    echo -e "${GREEN}NeuroMail теперь доступен в GitHub!${NC}"
    echo -e "${BLUE}===============================================${NC}"
else
    echo -e "${RED}Ошибка при отправке кода${NC}"
    echo -e "${YELLOW}Попробуйте выполнить команду вручную:${NC}"
    echo "git push -u origin main"
    exit 1
fi

echo -e "\n${GREEN}Готово! Ваш проект теперь доступен по адресу:${NC}"
echo -e "${BLUE}$repo_url${NC}" 