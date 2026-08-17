# Отчёт Lighthouse — 2026-08-17

**URL:** https://calendar-app-96il.onrender.com
**Дата проверки:** 17 августа 2026, ~22:18 UTC
**Инструмент:** Lighthouse CLI 13.4.1 (headless Chrome)

## Оценки по категориям

| Категория          | Оценка |
| ------------------ | ------ |
| Performance        | 98     |
| Accessibility      | 94     |
| Best Practices     | 100    |
| SEO                | 82     |

## Ключевые метрики производительности

| Метрика | Значение |
| ------- | -------- |
| FCP     | 1,9 s    |
| LCP     | 1,9 s    |
| TBT     | 40 ms    |
| CLS     | 0        |
| SI      | 3,0 s    |
| TTI     | 2,0 s    |

Страница отдаёт всего 4 запроса и ~177 KiB суммарно. Performance и Best Practices практически идеальны.

## Найденные проблемы

### 1. Доступность — низкая контрастность текста (Accessibility, −6)

Ошибка `color-contrast`: на кнопке «Записаться →» белый текст (`#ffffff`) на синем фоне `#228be6` (Mantine blue.6). Контраст 3,55:1 — ниже требуемых 4,5:1 для обычного текста 18px. Это дефолтная primary-кнопка Mantine.

### 2. SEO — отсутствует meta description (−9)

Ошибка `meta-description`: в `front/index.html` нет `<meta name="description">`. В сниппете поисковой выдачи описание не формируется.

### 3. SEO — невалидный robots.txt (−9)

Ошибка `robots-txt`: `/robots.txt` возвращает HTML-страницу SPA (HTTP 200) вместо текстового robots.txt. Статический хостинг (Render) отдаёт `index.html` как fallback для неизвестного пути. Роботы не могут понять правила индексации.

## Рекомендуемые правки (front/)

Приоритет **высокий** (метрики SEO и a11y, легко проверить повторным аудитом):

1. **`front/index.html`** — добавить meta description, например:
   ```html
   <meta name="description" content="Календарь встреч — онлайн-запись на консультации и события" />
   ```
   После этого пересобрать и задеплоить.

2. **`front/public/robots.txt`** — создать файл с допустимым содержимым (Vite копирует `public/` в корень сборки):
   ```
   User-agent: *
   Allow: /
   ```
   Проверить, что после деплоя `/robots.txt` отдаёт именно этот файл, а не SPA-fallback.

3. **`front/src/main.tsx`** — поднять контраст primary-кнопок через Mantine-тему: задать `primaryShade` 8 (синий `#1971c2`, контраст белого текста ~4,5:1), например:
   ```tsx
   import { createTheme, MantineProvider } from "@mantine/core";
   const theme = createTheme({ primaryShade: { light: 8, dark: 8 } });
   // <MantineProvider theme={theme} defaultColorScheme="light">
   ```
   Либо использовать кастомный primary-цвет с достаточной контрастностью. После правки прогнать Lighthouse ещё раз — контраст должен перестать падать.

Приоритет **низкий** (не влияет на оценки, опционально):

4. Настроить на стороне хостинга (Render) корректную отдачу статических файлов (`robots.txt`, favicon) без SPA-fallback, либо убедиться, что `public/robots.txt` попадает в продакшен-сборку.