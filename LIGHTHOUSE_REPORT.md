# Отчёт Lighthouse — 2026-08-18

**URL проверки:** https://calendar-app-96il.onrender.com/
**Дата проверки:** 2026-08-18 22:16 UTC
**Lighthouse:** 13.4.1 · Chrome headless

## Оценки по категориям

| Категория | Оценка |
|---|---|
| Performance | 98 |
| Accessibility | 94 |
| Best Practices | 100 |
| SEO | 82 |

## Ключевые метрики

| Метрика | Значение |
|---|---|
| First Contentful Paint (FCP) | 1,9 с |
| Largest Contentful Paint (LCP) | 1,9 с |
| Speed Index (SI) | 1,9 с |
| Time to Interactive (TTI) | 2,0 с |
| Total Blocking Time (TBT) | 40 мс |
| Cumulative Layout Shift (CLS) | 0 |
| Время ответа сервера | 90 мс |

## Сводка найденных проблем

Производительность и Best Practices в порядке: отличный отклик сервера, нулевой CLS, минимальный TBT. Единственная «шероховатость» — FCP/LCP 1,9 с (за счёт крупного JS-бандла SPA), но категорию это почти не роняет (98).

Реальные проблемы — три:

1. **Некорректный `robots.txt` (SEO).** `/robots.txt` на продакшене отдаёт HTML-страницу приложения (SPA-fallback), а не текстовый файл с правилами. Crawlers не могут понять правила индексации.
2. **Нет `meta description` (SEO).** В `front/index.html` отсутствует тег `<meta name="description">`.
3. **Низкий контраст текста кнопки (Accessibility).** Кнопка «Записаться →» (белый текст `#ffffff` на синем `#228be6`) имеет контраст 3,55:1 вместо требуемых 4,5:1.

## Правки для внесения (фронтенд)

### Высокий приоритет

- **Добавить `front/public/robots.txt`** с минимальным содержимым:
  ```
  User-agent: *
  Allow: /
  ```
  Файл из `public/` будет раздаваться как `/robots.txt` и перестанет подменяться SPA-fallback'ом. Проверка после деплоя: `curl -s https://calendar-app-96il.onrender.com/robots.txt`.

- **Добавить `<meta name="description">` в `front/index.html`** (в `<head>`), например:
  ```html
  <meta name="description" content="Календарь встреч: выберите тип события и забронируйте удобное время за минуту." />
  ```

### Средний приоритет

- **Поднять контраст кнопки «Записаться →»** (`front/src/pages/LandingPage.tsx:22`). Сейчас используется дефолтный синий Mantine (`blue.6`, `#228be6`). Варианты:
  - задать в `MantineProvider` тему через `createTheme` с более тёмным `primaryColor` (например, `blue.8` `#1971c2`), или
  - на кнопке указать `color="blue.8"`.
  Контраст белого на `#1971c2` ≈ 4,9:1 — проходит порог 4,5:1.

### Информационно

- FCP/LCP ≈ 1,9 с — при желании можно сократить за счёт code-splitting и отложенной загрузки неиспользуемых модулей Mantine, но категория уже 98, приоритет низкий.