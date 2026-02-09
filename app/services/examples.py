from __future__ import annotations

import json
import re
import urllib.parse
import urllib.request
from typing import Optional


def _fetch_tatoeba_sentence(term: str, timeout_s: float = 6.0) -> Optional[str]:
    """
    Пытаемся получить реальный пример из Tatoeba по термину.
    Возвращаем текст предложения или None.
    """
    query = term.strip()
    if not query:
        return None

    url = "https://tatoeba.org/en/api_v0/search?" + urllib.parse.urlencode(
        {"query": query}
    )
    req = urllib.request.Request(url, headers={"User-Agent": "WordFlow/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=timeout_s) as resp:
            payload = json.load(resp)
    except Exception:
        return None

    results = payload.get("results") or []
    if not isinstance(results, list) or not results:
        return None

    needle = query.lower()
    # Если термин похож на слово/фразу из букв/цифр/пробелов/дефисов — ищем по границам.
    boundary_ok = bool(re.fullmatch(r"[0-9A-Za-zА-Яа-яЁё\\-\\s']+", query))
    boundary_re = re.compile(rf"\\b{re.escape(query)}\\b", re.IGNORECASE) if boundary_ok else None

    def score(text: str) -> tuple[int, int]:
        # Чем короче и точнее совпадение — тем лучше.
        length = len(text)
        exact = 0
        if boundary_re and boundary_re.search(text):
            exact = 2
        elif needle in text.lower():
            exact = 1
        return (-exact, length)

    candidates: list[str] = []
    for item in results:
        text = str(item.get("text") or "").strip()
        if not text:
            continue
        if len(text) > 180:
            continue
        if boundary_re:
            if not boundary_re.search(text):
                continue
        else:
            if needle not in text.lower():
                continue
        candidates.append(text)

    if not candidates:
        return None

    candidates.sort(key=score)
    return candidates[0]


def generate_example_sentence(term: str, translation: Optional[str] = None) -> str:
    """
    Генерируем пример предложения для слова.
    1) Пытаемся получить реальное предложение из интернета (Tatoeba).
    2) Если не получилось — возвращаем аккуратный шаблон, содержащий термин.
    """
    clean_term = str(term or "").strip()
    clean_translation = str(translation or "").strip()
    if not clean_term:
        return "____"

    sentence = _fetch_tatoeba_sentence(clean_term)
    if sentence:
        return sentence

    if clean_translation:
        return f'I learned “{clean_term}” — it means “{clean_translation}”.'
    return f'Today I learned “{clean_term}”.'

