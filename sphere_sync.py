# -*- coding: utf-8 -*-

from __future__ import annotations

import argparse
import datetime as dt
import subprocess
import sys
from pathlib import Path


PROJECT_DIR = Path(r"C:\Users\roman\SFERA1")

NOTES_FILE = PROJECT_DIR / "PROJECT_NOTES.md"
STATE_FILE = PROJECT_DIR / "PROJECT_STATE.md"
LAST_SYNC_FILE = PROJECT_DIR / ".last_sync"


KEY_FILES = [
    ".clinerules",
    "AGENTS.md",
    "API-CONTRACT-AUDIT.md",
    "server/package.json",
    "server/server.js",
    "server/src/app.js",
    "server/src/middleware/auth.js",
    "server/src/models/User.js",
    "server/src/models/Message.js",
    "server/src/routes/authRoutes.js",
    "server/src/routes/chatRoutes.js",
    "server/src/controllers/authController.js",
    "server/src/controllers/chatController.js",
    "server/src/sockets/index.js",
    "server/src/sockets/serverSocket.js",
    "public/js/api.js",
    "public/js/socket.js",
    "public/js/messenger-backend.js",
    "public/js/i18n.js",
    "public/messenger.html",
]


def выполнить_git(*args):
    try:
        return subprocess.run(
            ["git", *args],
            cwd=PROJECT_DIR,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
    except FileNotFoundError:
        print("ОШИБКА: Git не найден в PATH.")
        sys.exit(1)


def git_output(*args):
    result = выполнить_git(*args)

    if result.returncode != 0:
        return ""

    return result.stdout.strip()


def дата_сейчас():
    return dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def прочитать_utf8(path):
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return path.read_text(encoding="utf-8-sig")


def безопасно_прочитать(path):
    try:
        return прочитать_utf8(path)
    except Exception as exc:
        return f"[ОШИБКА ЧТЕНИЯ: {exc}]"


def проверить_репозиторий():
    if not PROJECT_DIR.exists():
        print("ОШИБКА: папка проекта не существует:")
        print(PROJECT_DIR)
        sys.exit(1)

    if not PROJECT_DIR.is_dir():
        print("ОШИБКА: путь проекта не является папкой:")
        print(PROJECT_DIR)
        sys.exit(1)

    result = выполнить_git("rev-parse", "--is-inside-work-tree")

    if result.returncode != 0 or result.stdout.strip().lower() != "true":
        print("ОШИБКА: указанная папка не является Git-репозиторием:")
        print(PROJECT_DIR)

        if result.stderr.strip():
            print(result.stderr.strip())

        sys.exit(1)


def создать_notes_если_нет():
    if NOTES_FILE.exists():
        return

    текст = """# SFERA — PROJECT NOTES

## Цели

Здесь находятся ручные заметки по текущему состоянию проекта.

## Принятые решения

- 

## Открытые вопросы

- 

## Текущая задача

- 

## Важные ограничения

- Не менять утверждённый дизайн без отдельного решения.
- Сохранять существующую DOM-структуру при frontend-изменениях.
- Не ломать существующую архитектуру и рабочие модули.
- Проверять изменения перед commit/push.

## Последние заметки

"""

    NOTES_FILE.write_text(текст, encoding="utf-8")


def добавить_заметку(текст):
    создать_notes_если_нет()

    текущий = прочитать_utf8(NOTES_FILE)

    запись = (
        "\n## Заметка — "
        + дата_сейчас()
        + "\n\n"
        + текст.strip()
        + "\n"
    )

    NOTES_FILE.write_text(
        текущий.rstrip() + "\n" + запись,
        encoding="utf-8",
    )


def получить_head():
    return git_output("rev-parse", "HEAD")


def получить_ветку():
    ветка = git_output("branch", "--show-current")

    if ветка:
        return ветка

    return "(detached HEAD)"


def получить_status():
    status = git_output("status", "--short")

    if status:
        return status

    return "(рабочее дерево чистое)"


def получить_последние_коммиты():
    commits = git_output(
        "log",
        "-15",
        "--date=format:%Y-%m-%d %H:%M:%S",
        "--pretty=format:%h | %ad | %s",
    )

    if commits:
        return commits

    return "(коммиты отсутствуют)"


def получить_предыдущий_head():
    if not LAST_SYNC_FILE.exists():
        return None

    try:
        value = прочитать_utf8(LAST_SYNC_FILE).strip()
    except Exception:
        return None

    return value or None


def получить_diff_stat():
    предыдущий = получить_предыдущий_head()

    if not предыдущий:
        return "(Предыдущая синхронизация отсутствует.)"

    проверка = выполнить_git(
        "cat-file",
        "-e",
        f"{предыдущий}^{{commit}}",
    )

    if проверка.returncode != 0:
        return (
            "(Хэш предыдущей синхронизации не найден: "
            + предыдущий
            + ")"
        )

    result = выполнить_git(
        "diff",
        "--stat",
        предыдущий,
        "HEAD",
    )

    if result.returncode != 0:
        return (
            "(Не удалось получить diff --stat.)\n\n"
            + result.stderr.strip()
        )

    if result.stdout.strip():
        return result.stdout.strip()

    return "(Изменений нет.)"


def получить_файлы():
    result = выполнить_git("ls-files", "-z")

    if result.returncode != 0:
        return []

    return [
        имя
        for имя in result.stdout.split("\x00")
        if имя
    ]


def количество_строк(path):
    try:
        with path.open(
            "r",
            encoding="utf-8",
            errors="replace",
        ) as file:
            return sum(1 for _ in file)
    except Exception:
        return -1


def построить_таблицу_файлов():
    файлы = получить_файлы()

    if not файлы:
        return "(Отслеживаемые файлы не найдены.)"

    строки = [
        "| Файл | Строк |",
        "|---|---:|",
    ]

    for имя in файлы:
        путь = PROJECT_DIR / имя

        if not путь.exists():
            строки.append(f"| `{имя}` | отсутствует |")
            continue

        if not путь.is_file():
            строки.append(f"| `{имя}` | не файл |")
            continue

        количество = количество_строк(путь)

        if количество >= 0:
            строки.append(
                f"| `{имя}` | {количество} |"
            )
        else:
            строки.append(
                f"| `{имя}` | недоступно |"
            )

    return "\n".join(строки)


def собрать_ключевые_файлы():
    блоки = []

    for имя in KEY_FILES:
        путь = PROJECT_DIR / имя

        if not путь.exists():
            блоки.append(
                f"### `{имя}`\n\n"
                "Файл отсутствует.\n"
            )
            continue

        if not путь.is_file():
            блоки.append(
                f"### `{имя}`\n\n"
                "Путь существует, но это не файл.\n"
            )
            continue

        содержимое = безопасно_прочитать(путь)

        блоки.append(
            f"### `{имя}`\n\n"
            "```text\n"
            + содержимое.rstrip()
            + "\n```\n"
        )

    return "\n".join(блоки)


def создать_state():
    head = получить_head()
    ветка = получить_ветку()
    status = получить_status()
    commits = получить_последние_коммиты()
    diff_stat = получить_diff_stat()
    таблица = построить_таблицу_файлов()
    notes = безопасно_прочитать(NOTES_FILE)

    предыдущий = получить_предыдущий_head()

    if not предыдущий:
        предыдущий = "(нет)"

    ключевые_файлы = собрать_ключевые_файлы()

    state = (
        "# SFERA — PROJECT STATE\n\n"
        "> Готовый снимок проекта для передачи в новый чат.\n"
        "> Сформирован: **"
        + дата_сейчас()
        + "**\n"
        "> Локальная папка: `"
        + str(PROJECT_DIR)
        + "`\n\n"
        "---\n\n"
        "# 1. ИДЕНТИФИКАЦИЯ ПРОЕКТА\n\n"
        "- Проект: **SFERA / СФЕРА**\n"
        "- Путь: `"
        + str(PROJECT_DIR)
        + "`\n"
        "- Git branch: `"
        + ветка
        + "`\n"
        "- Текущий HEAD: `"
        + head
        + "`\n"
        "- HEAD предыдущей синхронизации: `"
        + предыдущий
        + "`\n\n"
        "---\n\n"
        "# 2. PROJECT NOTES\n\n"
        + notes.rstrip()
        + "\n\n"
        "---\n\n"
        "# 3. GIT STATUS\n\n"
        "```text\n"
        + status
        + "\n```\n\n"
        "---\n\n"
        "# 4. ПОСЛЕДНИЕ 15 КОММИТОВ\n\n"
        "```text\n"
        + commits
        + "\n```\n\n"
        "---\n\n"
        "# 5. DIFF --STAT С ПРЕДЫДУЩЕЙ СИНХРОНИЗАЦИИ\n\n"
        "```text\n"
        + diff_stat
        + "\n```\n\n"
        "---\n\n"
        "# 6. ВСЕ ОТСЛЕЖИВАЕМЫЕ ФАЙЛЫ\n\n"
        + таблица
        + "\n\n"
        "---\n\n"
        "# 7. ПОЛНОЕ СОДЕРЖИМОЕ КЛЮЧЕВЫХ ФАЙЛОВ\n\n"
        + ключевые_файлы
        + "\n\n"
        "---\n\n"
        "# 8. ИНСТРУКЦИЯ ДЛЯ НОВОГО ЧАТА\n\n"
        "Используй этот файл как актуальный технический снимок "
        "проекта SFERA.\n\n"
        "1. Сохраняй текущую архитектуру проекта.\n"
        "2. Не переписывай архитектуру без прямого указания.\n"
        "3. Не меняй утверждённый frontend-дизайн без прямого указания.\n"
        "4. Перед изменением существующих файлов учитывай их "
        "текущее содержимое.\n"
        "5. Используй Git-состояние и историю выше как источник "
        "текущего состояния разработки.\n"
        "6. Не считай старые решения актуальными, если текущие "
        "файлы и последние коммиты им противоречат.\n"
        "7. При продолжении разработки сначала определи текущую "
        "точку проекта по этому снимку.\n"
        "8. Не удаляй существующий функционал только ради "
        "упрощения кода.\n"
    )

    STATE_FILE.write_text(state, encoding="utf-8")


def сохранить_last_sync(head):
    LAST_SYNC_FILE.write_text(
        head + "\n",
        encoding="utf-8",
    )


def синхронизировать_git(базовый_head):
    add = выполнить_git("add", "-A")

    if add.returncode != 0:
        print("ОШИБКА: git add -A не выполнен.")
        print(add.stderr.strip())
        return

    staged = выполнить_git(
        "diff",
        "--cached",
        "--quiet",
    )

    if staged.returncode == 0:
        print("Изменений для commit нет.")
        print("Пустой commit не создаётся.")
        return

    if staged.returncode != 1:
        print("ОШИБКА: не удалось проверить изменения.")
        print(staged.stderr.strip())
        return

    сообщение = (
        "sync: "
        + dt.datetime.now().strftime("%Y-%m-%d %H:%M")
    )

    commit = выполнить_git(
        "commit",
        "-m",
        сообщение,
    )

    if commit.returncode != 0:
        print("ОШИБКА: commit не создан.")
        print(commit.stderr.strip())
        return

    print("Commit создан:")
    print(сообщение)

    ветка = получить_ветку()

    push = выполнить_git(
        "push",
        "origin",
        ветка,
    )

    if push.returncode != 0:
        print("ОШИБКА: git push не выполнен.")
        print("stderr Git:")
        print(push.stderr.strip())
        return

    print(f"Push выполнен: origin/{ветка}")

    сохранить_last_sync(базовый_head)

    add_sync = выполнить_git(
        "add",
        ".last_sync",
    )

    if add_sync.returncode != 0:
        print(
            "ПРЕДУПРЕЖДЕНИЕ: "
            ".last_sync не удалось добавить."
        )
        print(add_sync.stderr.strip())
        return

    commit_sync = выполнить_git(
        "commit",
        "-m",
        f"sync: сохранить точку {базовый_head[:12]}",
    )

    if commit_sync.returncode != 0:
        print(
            "ПРЕДУПРЕЖДЕНИЕ: "
            ".last_sync не закоммичен."
        )
        print(commit_sync.stderr.strip())
        return

    push_sync = выполнить_git(
        "push",
        "origin",
        ветка,
    )

    if push_sync.returncode != 0:
        print(
            "ПРЕДУПРЕЖДЕНИЕ: "
            ".last_sync не отправлен на GitHub."
        )
        print(push_sync.stderr.strip())
        return

    print("Точка синхронизации сохранена.")


def main():
    parser = argparse.ArgumentParser(
        description=(
            "SFERA — создание снимка проекта "
            "и синхронизация Git."
        )
    )

    parser.add_argument(
        "--note",
        type=str,
        help="Добавить заметку перед сборкой состояния.",
    )

    args = parser.parse_args()

    проверить_репозиторий()

    print("=== SFERA PROJECT SYNC ===")
    print(f"Проект: {PROJECT_DIR}")

    базовый_head = получить_head()

    print(
        "HEAD до синхронизации: "
        + базовый_head
    )

    создать_notes_если_нет()

    if args.note:
        добавить_заметку(args.note)
        print("Заметка добавлена.")

    создать_state()

    print("PROJECT_STATE.md создан.")
    print("Начинается Git-синхронизация...")

    синхронизировать_git(базовый_head)

    print("=== ГОТОВО ===")


if __name__ == "__main__":
    main()