---
name: lighthouse-audit
description: Ночной аудит Lighthouse продакшен-приложения — запустить Lighthouse CLI (Chrome установлен, CHROME_PATH задан), собрать оценки по категориям, записать LIGHTHOUSE_REPORT.md со списком правок и открыть отчётный PR «Отчёт Lighthouse <дата>». Использовать для scheduled-проверки по расписанию.
---

# Lighthouse audit

Выполни аудит Lighthouse и зафиксируй результат так, чтобы утром команда могла принять решение о правках.

## Шаги

1. Убедись, что окружение готово: переменная `CHROME_PATH` задана, Lighthouse CLI установлен глобально (команда `lighthouse`).
2. Создай каталог `lighthouse` и запусти проверку для переданного URL:
   ```
   lighthouse <URL> --quiet --output=html,json --output-path=./lighthouse/report \
     --chrome-flags="--headless --no-sandbox --disable-gpu" \
     --only-categories=performance,accessibility,best-practices,seo
   ```
   Если аудит не завершился из-за временной ошибки сети — повтори до трёх раз.
3. Прочитай `./lighthouse/report.json` и собери результаты: оценки (score 0–1, переведи в проценты) по категориям Performance, Accessibility, Best Practices, SEO и ключевые метрики (FCP, LCP, TBT, CLS, SI).
4. Запиши отчёт в `LIGHTHOUSE_REPORT.md`:
   - дата и URL проверки;
   - таблица оценок по категориям;
   - сводка найденных проблем;
   - конкретный список правок, которые нужно внести в проект (`front/`), с приоритетами — чтобы команда утром решила, что делать.
   - Комментарии и формулировки — на русском.
5. Закоммить `lighthouse/report.html`, `lighthouse/report.json` и `LIGHTHOUSE_REPORT.md` и открой pull request «Отчёт Lighthouse <дата>» с кратким описанием результатов в теле PR.

## Правила

- Отчёт должен быть самостоятельным: оценки + метрики + правки с приоритетами.
- Не приукрашивай и не выдумывай проблемы — бери факты из `report.json`.
- Если какой-то категории нет в данных — честно отметь N/A.