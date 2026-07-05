-- Добавляем колонку для фото товаров
ALTER TABLE products ADD COLUMN IF NOT EXISTS photo_url TEXT DEFAULT NULL;
