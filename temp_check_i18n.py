import json, os
base = 'public/languages'
tm = json.load(open(os.path.join(base, 'tm.json'), encoding='utf-8'))
ru = json.load(open(os.path.join(base, 'ru.json'), encoding='utf-8'))
en = json.load(open(os.path.join(base, 'en.json'), encoding='utf-8'))
for name, data in [('ru', ru), ('en', en)]:
    missing = [k for k in tm if k not in data]
    tm_like = [k for k in data if isinstance(data[k], str) and k in tm and data[k] == tm[k]]
    print(name, 'missing', len(missing), 'tm_like', len(tm_like))
    if missing:
        print(' sample missing:', missing[:20])
    if tm_like:
        print(' sample tm_like:', tm_like[:20])
