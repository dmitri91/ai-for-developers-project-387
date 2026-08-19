# Отчёт Lighthouse — 19.08.2026

- **Дата проверки:** 19.08.2026, 22:18 UTC
- **URL:** https://calendar-app-96il.onrender.com/
- **Профиль:** mobile, Lighthouse 13.4.1 (headless Chrome 151)
- **Среда:** production (Render), эмуляция мобильного устройства

## Оценки по категориям

| Категория | Оценка |
| --- | --- |
| Performance | 98 |
| Accessibility | 94 |
| Best Practices | 100 |
| SEO | 82 |

## Ключевые метрики (Performance)

| Метрика | Значение | Оценка |
| --- | --- | --- |
| First Contentful Paint (FCP) | 1.9 с | 0.87 |
| Largest Contentful Paint (LCP) | 1.9 с | 0.98 |
| Total Blocking Time (TBT) | 30 мс | — |
| Cumulative Layout Shift (CLS) | 0 | — |
| Speed Index (SI) | 2.6 с | 0.97 |
| Time to Interactive (TTI) | 2.0 с | — |

Ответ сервера для корневого документа — 80 мс. Существенных возможностей оптимизации (overallSavingsMs > 0) Lighthouse не нашёл.

## Сводка найденных проблем

1. **SEO — robots.txt не валиден.** Запрос `/robots.txt` возвращает 200, но отдаёт HTML страницы приложения (SPA-fallback). Lighthouse фиксирует 14 ошибок синтаксиса (весь index.html). Краулеры не могут понять правила индексации.
2. **SEO — нет meta description.** `<head>` не содержит `<meta name="description">`, страница не получает краткое описание в выдаче.
3. **Accessibility — недостаточная контрастность.** Кнопка «Записаться →» (LandingPage, Mantine `Button` с дефолтным синим `#228be6` и белым текстом) имеет контраст 3.55:1 вместо требуемых 4.5:1.
4. **Performance, Best Practices — замечаний нет.** CLS = 0, TBT 30 мс, BP = 100.

## Правки для внесения в `front/`

| Приоритет | Правка | Файл | Эффект |
| --- | --- | --- | --- |
| Высокий | Добавить настоящий `robots.txt` (Vite отдаёт `public/` в корень) | `front/public/robots.txt` | SEO: убирает 14 ошибок, даёт валидные правила для краулеров |
| Высокий | Добавить `<meta name="description" content="…">` | `front/index.html` | SEO: описание страницы в выдаче |
| Средний | Затемнить основной цвет кнопок (напр. `blue.8` `#1971c2`) через `primaryColor`/`primaryShade` в теме или `color` у `Button` | `front/src/main.tsx`, `front/src/pages/LandingPage.tsx` | Accessibility: контраст ≥ 4.5:1 на «Записаться →» |
| Низкий | FCP ~1.9 с — держать бандл компактным, следить за ростом зависимостей | — | Performance: удержание 98+ |

**Решение для команды:** достаточно закрыть первые две правки (SEO, 82 → 100) и третью (Accessibility, 94 → 100). Performance и Best Practices уже на уровне 98/100.