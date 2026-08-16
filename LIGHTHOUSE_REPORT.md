# Отчёт Lighthouse — 16.08.2026

- **URL:** https://calendar-app-96il.onrender.com
- **Дата проверки:** 2026-08-16, 22:14 UTC
- **Инструмент:** Lighthouse CLI 13.4.1 (Chrome 151), headless
- **Категории:** Performance, Accessibility, Best Practices, SEO

## Оценки по категориям

| Категория | Оценка |
|---|---|
| Performance | 98% |
| Accessibility | 94% |
| Best Practices | 100% |
| SEO | 82% |

## Ключевые метрики

| Метрика | Значение |
|---|---|
| First Contentful Paint (FCP) | 1.9 s |
| Largest Contentful Paint (LCP) | 1.9 s |
| Total Blocking Time (TBT) | 30 ms |
| Cumulative Layout Shift (CLS) | 0 |
| Speed Index (SI) | 1.9 s |
| Time to Interactive (TTI) | 2.0 s |
| Ответ сервера (TTFB) | 100 ms |

Общая картина хорошая: приложение быстродействующее, стабильное (CLS = 0), без нарушений Best Practices. Провалы сосредоточены в SEO (из-за отсутствия robots.txt и meta description) и одном элементе с недостаточным контрастом.

## Найденные проблемы

### SEO (82%)
1. **Отсутствует `meta description`** — страница без описания, снижает привлекательность сниппета в поиске.
2. **`robots.txt` невалиден** — по `/robots.txt` сервер отдаёт SPA-fallback (`index.html`), Lighthouse фиксирует 14 ошибок синтаксиса. Файл `robots.txt` в проекте отсутствует.

### Accessibility (94%)
3. **Недостаточная контрастность кнопки «Записаться →»** — белый текст (#ffffff) на фирменном синем Mantine (#228be6), контраст 3.55:1 при норме 4.5:1. Элемент: `Button` на лендинге (`front/src/pages/LandingPage.tsx:22`).

### Performance (98%)
4. **Рендер-блокирующий CSS** — `/assets/index-MgNbK8ar.css` (~40 KiB) задерживает первый рендер примерно на 300 ms.
5. **Неиспользуемый CSS** — ~90% CSS-бандла (35 KiB) не используется (передаётся в дереве Mantine).
6. **Неиспользуемый JS** — ~55% JS-бандла (75 KiB) не исполняется при загрузке лендинга.
7. **Нет cache-заголовков для статики** — assets отдаются с `cacheLifetimeMs: 0`; потенциальная экономия при повторных визитах ~175 KiB.

## Правки (по приоритетам)

### Высокий приоритет
1. **Добавить `robots.txt`** (`front/public/robots.txt`) — минимальный файл (`User-agent: *` + `Allow: /`). Плюс в `backend/src/server.js` (статик-роутинг, `sendStatic`) не отдавать SPA-fallback для `/robots.txt`, чтобы роботы и аудит получали файл, а не HTML. Влияет на SEO.
2. **Добавить `meta description`** в `front/index.html` (язык — русский, напр. «Онлайн-запись на встречи: выберите тип события и удобное время»). Влияет на SEO.
3. **Поправить контраст кнопки «Записаться →»** — использовать более тёмный оттенок синего (контраст ≥ 4.5:1) или задать кастомный цвет через Mantine theme (например, `theme.colors.blue[8]`). Влияет на Accessibility.
4. **Добавить `Cache-Control` для статики** в `backend/src/server.js` (в `sendStatic`): для `/assets/*` — `Cache-Control: public, max-age=31536000, immutable` (имена с хешем), для `index.html` — `no-cache`. Ускорит повторные визиты.

### Средний приоритет
5. **Сократить неиспользуемый CSS** — настроить импорт стилей Mantine с CSS layers (`@import "@mantine/core/styles.layer.css"` + `@layer` в `styles.css`) или подключение только используемых компонентов. Сэкономит ~35 KiB и снизит рендер-блокировку.
6. **Сократить неиспользуемый JS** — ленивая загрузка страниц через `React.lazy`/`Suspense` для маршрутов (лендинг, страница бронирования, админка). Сэкономит ~75 KiB на старте.

### Низкий приоритет
7. **Рендер-блокирующий CSS** — после сокращения CSS рассмотреть inline критических стилей или preload. Текущее влияние — около 300 ms на FCP, метрика и так в зелёной зоне.

> Замечание: категория Best Practices (100%) нарушений не показала, все метрики Core Web Vitals (LCP, TBT, CLS) в зелёной зоне.