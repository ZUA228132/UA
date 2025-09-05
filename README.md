
# Telegram Face WebApp — Enterprise
FaceID‑подобный WebApp на Next.js (Vercel) + Human (embeddings в браузере) + Postgres/pgvector.  
Фичи: **очередь модерации**, **экспорт/импорт (CSV/JSON)**, **детальные логи антиспуф‑метрик**, **чарты в админке**, **deep‑link сценарии (verification/identification)**.

## 0) Требования
- Node 18+ (Vercel default).
- Postgres (Neon/Supabase/Timescale) с включенным `pgvector` (>=0.5).
- Telegram bot (BotFather) с подключённым **WebApp** (Menu Button или inline `web_app`).

## 1) Установка
```bash
pnpm i  # или npm i / yarn
```
Переменные окружения (Vercel → Settings → Environment Variables):
- `BOT_TOKEN` — токен бота для подписи `initData`
- `DATABASE_URL` — Postgres с SSL
- `BLOB_READ_WRITE_TOKEN` — токен Vercel Blob
- `ADMIN_SECRET` — длинная секретная строка
- `ADMIN_ALLOWED_USER_IDS` — csv‑список Telegram ID админов (опционально)
- `ALLOWED_USER_IDS` — можно оставить пустым (пускаем всех с валидной подписью)

## 2) База данных
Расширение `pgvector` и таблицы создаются **автоматически** при первом запросе (`ensureSchema()`).
Схема:
- `faces(id, tg_user_id, display_name, profile_url, embedding VECTOR(1024), image_url, approved, created_at)`
- `reviews(id, face_id, status, note, created_at)` — очередь модерации (pending/approved/rejected)
- `logs(id, at, tg_user_id, event, meta)` — события + антиспуф метрики
- `bans(tg_user_id, reason, banned_at)`

Индексы: IVFFlat по `embedding` (cosine, с fallback на L2).

## 3) Сборка/деплой
Локально:
```bash
pnpm dev
```
Vercel:
- Подключите репо → Deploy
- Node.js Runtime 18+ (по умолчанию)
- Добавьте ENV (см. выше)

## 4) Подключение WebApp к боту
- В BotFather укажите URL деплоя как **Web App** (Menu Button или inline кнопка).
- Клиент получает `window.Telegram.WebApp.initData` и шлёт в `/api/*` для верификации подписи.

## 5) Deep‑links (режимы)
- Формат: `https://t.me/<ваш_бот>?startapp=mode=verification&subjectId=123`
- Параметры оказываются в `initData.start_param`. Также поддерживается `?mode=verification&subjectId=123` в URL самого WebApp.
- На странице `app/page.tsx` deep‑link отображается и используется в кнопке **Verify (1:1)**.

## 6) Потоки
### Enroll (с ревью)
1. Клиент: скан (16 кадров) → антиспуф метрики → эмбеддинг (усреднение).
2. `POST /api/enroll` — запись в `faces(approved=false)` + создание `reviews(pending)` + загрузка изображения в Blob.
3. Админка `/admin`: approve/reject.
   - Approve → `faces.approved=true`, `reviews.status='approved'`.
   - Reject → запись в reviews + удаление лица.

### Identify (1:N)
- `POST /api/verify-mode` с `mode='identification'`. Поиск только по `approved=true` с порогом `minSimilarity` (по умолчанию 0.6).

### Verify (1:1)
- `POST /api/verify-mode` с `mode='verification'` и `subjectId`.

## 7) Антиспуф/живость (клиент)
Пороговые константы в `app/page.tsx`:
- `FRAMES=16`, `SIM_MIN=0.86` (межкадровая схожесть)
- `YAW_MIN=12°`, `BLINK_DROP=0.25` (моргание)
- `SPEC_MIN=0.0005` (дисперсия яркости), `MOIRE_MAX=40000` (градиентная энергия), `MICRO_MIN=0.0015` (суммарные микродвижения)
Метрики уходят на бэк в `metrics` и логируются в `logs.meta`.

## 8) Админка (`/admin`)
- Ввод `ADMIN_SECRET` → загрузка данных через `POST /api/admin/index`.
- **Очередь ревью**: approve/reject.
- **Экспорт**: `POST /api/admin/export` (`format=json|csv`).
- **Импорт**: `POST /api/admin/import` (JSON: `{faces:[{tg_user_id,display_name,profile_url,image_url,approved,embedding: [...]}, ...]}`).
- **Чарт активности**: простая гистограмма событий за последние дни.

## 9) Безопасность
- Все API требуют валидной подписи `initData`.
- Админ‑API дополнительно требуют `ADMIN_SECRET` или ID в `ADMIN_ALLOWED_USER_IDS`.
- Поиск/верификация только по `approved=true`.

## 10) Тюнинг точности
- Увеличивайте `FRAMES` и `SIM_MIN` для стабильности.
- Подбирайте `minSimilarity` 0.6–0.7 (или выше) под ваш датасет.
- Для продвинутого антиспуфинга используйте специализированные SDK (IR/Depth/Liveness).

## 11) Команды для BotFather (пример)
- Инлайн‑кнопка в обычном боте:
  ```json
  {"reply_markup":{"inline_keyboard":[[{"text":"Открыть WebApp","web_app":{"url":"https://<ваш-деплой>.vercel.app"}}]]}}
  ```
- Меню WebApp: в настройках бота укажите URL приложения.

## 12) Тест чек‑лист
- ✅ initData валиден.
- ✅ Enroll создаёт `faces.approved=false` и запись в `reviews`.
- ✅ Admin approve делает `approved=true`.
- ✅ Search/Verify работают только по `approved=true`.
- ✅ Экспорт/Импорт проходят с разумным объёмом (проверяйте лимиты Vercel).

> Примечание: ответственность за законность обработки биометрии несёте вы. Шаблон рассчитан на опт‑ин/внутреннее использование.
