import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
import uuid

TARGET_I = -18.0
TARGET_TP = -1.5
TARGET_LRA = 11.0
RATE = 44100
NOISE_DB = -35
SILENCE_D = 0.12
TRAIL_EPS_S = 0.15
MAX_TRIES = 6

VOICE_ID = 'ptBd2v6mebIps3ZQEXD7'
MODEL_ID = 'eleven_v3'
VOICE_SETTINGS = {'stability': 0, 'similarity_boost': 0.75, 'style': 0.95, 'use_speaker_boost': True}
STT_MODEL_ID = 'scribe_v1'

HERE = os.path.dirname(os.path.abspath(__file__))
DEMO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
RAW = os.path.join(DEMO, '.verify', 'unit2-takes')
WORK = os.path.join(DEMO, '.verify', 'unit2-work')
DATA_JS = os.path.join(DEMO, 'js', 'data.js')
MANIFEST = os.path.join(HERE, 'manifest.json')

DIGIT_ORDER = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']
NAMES = {'0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four',
         '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine'}
OBJECTS = {
    '1': ('ball', 'ball'), '2': ('cup', 'cups'), '3': ('apple', 'apples'),
    '4': ('car', 'cars'), '5': ('bear', 'bears'), '6': ('bag', 'bags'),
    '7': ('cow', 'cows'), '8': ('ant', 'ants'), '9': ('apple', 'apples'),
    '0': ('car', 'cars'),
}
PROBLEMS = [
    (1, 1, 'ball', 'ball', 'balls'),
    (2, 1, 'cup', 'cup', 'cups'),
    (2, 2, 'car', 'car', 'cars'),
    (3, 1, 'bear', 'bear', 'bears'),
    (3, 2, 'apple', 'apple', 'apples'),
]
PROMPTS = {
    'count-with-me': "[excited] Let's count together!",
    'how-many': '[excited] How many can you see?',
    'lets-add': "[excited] Let's add them up!",
    'find-the-number': '[excited] Find the number!',
    'find-that-many': '[excited] Find that many!',
    'nice-counting': '[excited] Nice counting!',
    'you-know-your-numbers': '[excited] You know your numbers!',
}


def title(d):
    return NAMES[d].capitalize()


def digit_text(d):
    return '[excited] This is %s... %s %s!' % (NAMES[d], NAMES[d], OBJECTS[d][1])


def label(n, singular, plural):
    return singular if n == 1 else plural


def problem_text(a, b, singular, plural):
    lead = '%s %s... plus %s %s... is...' % (
        title(str(a)), label(a, singular, plural), NAMES[str(b)], label(b, singular, plural))
    mid = ' '.join('%s...' % NAMES[str(k)] for k in range(1, a + b))
    tail = '%s %s!' % (NAMES[str(a + b)], plural)
    return '[excited] %s %s %s' % (lead, mid, tail)


def num_text(n):
    return '[excited] %s!' % title(str(n))


def total_text(n):
    return "[excited] That's %s!" % NAMES[str(n)]


def norm_words(text):
    text = text.lower()
    text = re.sub(r'\[.*?\]', ' ', text)
    text = re.sub(r'[^a-z0-9 ]', ' ', text)
    return [w for w in text.split() if w]


def clips():
    out = []
    for d in DIGIT_ORDER:
        out.append({'id': 'digit-' + d, 'text': digit_text(d), 'kind': 'digit', 'digit': d})
    for d in DIGIT_ORDER:
        out.append({'id': 'num-' + d, 'text': num_text(d), 'kind': 'plain'})
    for n in range(1, 6):
        out.append({'id': 'total-%d' % n, 'text': total_text(n), 'kind': 'plain'})
    for i, (a, b, img, sg, pl) in enumerate(PROBLEMS):
        out.append({'id': 'add-%d' % (i + 1), 'text': problem_text(a, b, sg, pl),
                    'kind': 'add', 'a': a, 'b': b, 'sum': a + b, 'img': img, 'obj': sg, 'objPlural': pl})
    for key in sorted(PROMPTS):
        out.append({'id': key, 'text': PROMPTS[key], 'kind': 'plain'})
    for c in out:
        c['expectedWords'] = expected_words(c)
    return out


def expected_words(c):
    if c['kind'] == 'digit':
        d = c['digit']
        return ['this', 'is', NAMES[d], NAMES[d]] + norm_words(OBJECTS[d][1])
    if c['kind'] == 'add':
        a, b, s, sg, pl = c['a'], c['b'], c['sum'], c['obj'], c['objPlural']
        lead = [NAMES[str(a)], label(a, sg, pl), 'plus', NAMES[str(b)], label(b, sg, pl), 'is']
        mid = [NAMES[str(k)] for k in range(1, s)]
        tail = [NAMES[str(s)]] + norm_words(pl)
        return lead + mid + tail
    return norm_words(c['text'])


def api_key():
    cfg = json.load(open(os.path.expanduser('~/.claude.json')))
    return cfg['mcpServers']['elevenlabs']['env']['ELEVENLABS_API_KEY']


def synth(text, dst, key):
    body = json.dumps({'text': text, 'model_id': MODEL_ID, 'voice_settings': VOICE_SETTINGS}).encode()
    url = 'https://api.elevenlabs.io/v1/text-to-speech/%s?output_format=mp3_44100_128' % VOICE_ID
    req = urllib.request.Request(url, data=body, headers={'xi-api-key': key,
                                                          'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=120) as res:
        payload = res.read()
    with open(dst, 'wb') as fh:
        fh.write(payload)


def speech_to_text(path, key):
    boundary = uuid.uuid4().hex
    data = open(path, 'rb').read()
    parts = [
        ('--%s\r\nContent-Disposition: form-data; name="model_id"\r\n\r\n%s\r\n'
         % (boundary, STT_MODEL_ID)).encode(),
        ('--%s\r\nContent-Disposition: form-data; name="file"; filename="c.mp3"\r\n'
         'Content-Type: audio/mpeg\r\n\r\n' % boundary).encode(),
        data,
        ('\r\n--%s--\r\n' % boundary).encode(),
    ]
    body = b''.join(parts)
    req = urllib.request.Request('https://api.elevenlabs.io/v1/speech-to-text', data=body,
                                  headers={'xi-api-key': key,
                                          'Content-Type': 'multipart/form-data; boundary=%s' % boundary})
    with urllib.request.urlopen(req, timeout=90) as res:
        return json.load(res)


def run(args):
    return subprocess.run(args, capture_output=True, text=True).stderr


def loudnorm_measure(src):
    err = run(['ffmpeg', '-hide_banner', '-nostats', '-i', src, '-af',
               'loudnorm=I=%s:TP=%s:LRA=%s:print_format=json' % (TARGET_I, TARGET_TP, TARGET_LRA),
               '-f', 'null', '-'])
    blob = re.search(r'\{[^{}]*\}', err, re.S)
    return json.loads(blob.group(0))


def loudnorm_apply(src, dst, m):
    flt = ('loudnorm=I=%s:TP=%s:LRA=%s:measured_I=%s:measured_TP=%s:measured_LRA=%s:'
           'measured_thresh=%s:offset=%s:linear=true:print_format=summary'
           % (TARGET_I, TARGET_TP, TARGET_LRA, m['input_i'], m['input_tp'], m['input_lra'],
              m['input_thresh'], m['target_offset']))
    run(['ffmpeg', '-hide_banner', '-nostats', '-y', '-i', src, '-af', flt,
         '-ar', str(RATE), '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '192k', dst])


def duration_ms(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                          '-of', 'csv=p=0', path], capture_output=True, text=True).stdout
    return int(round(float(out.strip()) * 1000))


def silence_gaps(path, db):
    err = run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af',
               'silencedetect=noise=%ddB:d=%s' % (db, SILENCE_D), '-f', 'null', '-'])
    starts = [float(v) for v in re.findall(r'silence_start: ([0-9.]+)', err)]
    ends = [float(v) for v in re.findall(r'silence_end: ([0-9.]+)', err)]
    return starts, ends


def silence_cross_check(path, dur_ms):
    out = {}
    for db in (NOISE_DB, -30, -40):
        starts, ends = silence_gaps(path, db)
        kept = [int(round(e * 1000)) for e in ends if e * 1000 < dur_ms - TRAIL_EPS_S * 1000]
        out[db] = kept
    return out


def loudness_of(path):
    return float(loudnorm_measure(path)['input_i'])


def cmd_gen(force):
    os.makedirs(RAW, exist_ok=True)
    key = api_key()
    for c in clips():
        dst = os.path.join(RAW, c['id'] + '.mp3')
        if os.path.exists(dst) and not force:
            continue
        ok = False
        last = None
        for attempt in range(1, MAX_TRIES + 1):
            try:
                synth(c['text'], dst, key)
                result = speech_to_text(dst, key)
            except (urllib.error.HTTPError, urllib.error.URLError) as err:
                print('  %s try%d transport error: %s' % (c['id'], attempt, err))
                time.sleep(2)
                continue
            actual = norm_words(result['text'])
            last = result
            match = actual == c['expectedWords']
            print('gen %-24s try%d match=%s :: %s' % (c['id'], attempt, match, result['text']))
            if match:
                ok = True
                break
        if not ok:
            raise SystemExit('%s: content did not match after %d tries; last transcript: %r'
                             % (c['id'], MAX_TRIES, last['text'] if last else None))


def word_onsets(c, words, key):
    if c['kind'] == 'digit':
        return {'wordAtMs': int(round(words[3]['start'] * 1000))}
    if c['kind'] == 'add':
        s = c['sum']
        is_idx = next(i for i, w in enumerate(words) if re.sub(r'[^a-z]', '', w['text'].lower()) == 'is')
        counts = [int(round(words[is_idx + 1 + k]['start'] * 1000)) for k in range(s)]
        return {
            'aAtMs': int(round(words[0]['start'] * 1000)),
            'joinAtMs': int(round(words[2]['start'] * 1000)),
            'bAtMs': int(round(words[2]['start'] * 1000)),
            'countAtMs': counts,
            'sumWordAtMs': counts[-1],
        }
    return {}


def js_digits(entries):
    lines = ['export const DIGITS = [']
    for d in DIGIT_ORDER:
        e = entries['digit-' + d]
        lines.append(
            "  { digit: '%s', name: '%s', count: %d, obj: '%s', img: './assets/images/%s.png',\n"
            "    clip: './assets/audio/unit2/digit-%s.mp3', wordAtMs: %d, durMs: %d },"
            % (d, NAMES[d], int(d), OBJECTS[d][1], OBJECTS[d][0], d, e['wordAtMs'], e['durMs']))
    lines.append(']')
    return '\n'.join(lines)


def js_problems(entries):
    lines = ['export const MATH_PROBLEMS = [']
    for i, (a, b, img, sg, pl) in enumerate(PROBLEMS):
        e = entries['add-%d' % (i + 1)]
        lines.append(
            "  { a: %d, b: %d, sum: %d, obj: '%s', objPlural: '%s', img: './assets/images/%s.png',\n"
            "    clip: './assets/audio/unit2/add-%d.mp3',\n"
            "    aAtMs: %d, joinAtMs: %d, bAtMs: %d, countAtMs: [%s], sumWordAtMs: %d, durMs: %d },"
            % (a, b, a + b, sg, pl, img, i + 1, e['aAtMs'], e['joinAtMs'], e['bAtMs'],
               ', '.join(str(x) for x in e['countAtMs']), e['sumWordAtMs'], e['durMs']))
    lines.append(']')
    return '\n'.join(lines)


def write_data_js(entries):
    src = open(DATA_JS).read()
    head = src.split('export const DIGITS = [')[0].rstrip() + '\n'
    open(DATA_JS, 'w').write(head + '\n' + js_digits(entries) + '\n\n' + js_problems(entries) + '\n')


def cmd_build():
    os.makedirs(WORK, exist_ok=True)
    key = api_key()
    entries = {}
    for c in clips():
        src = os.path.join(RAW, c['id'] + '.mp3')
        dst = os.path.join(HERE, c['id'] + '.mp3')
        m = loudnorm_measure(src)
        loudnorm_apply(src, dst, m)
        dur = duration_ms(dst)

        result = speech_to_text(dst, key)
        actual = norm_words(result['text'])
        if actual != c['expectedWords']:
            raise SystemExit('%s: post-loudnorm transcript drifted: expected %s got %s'
                             % (c['id'], c['expectedWords'], actual))
        words = [w for w in result['words'] if w['type'] == 'word']

        onset_fields = word_onsets(c, words, key)
        cross = silence_cross_check(dst, dur) if c['kind'] in ('digit', 'add') else None

        entries[c['id']] = {
            'text': c['text'], 'kind': c['kind'], 'transcript': result['text'],
            'durMs': dur, 'loudnessLufs': round(loudness_of(dst), 2),
            'sttWords': [{'text': w['text'], 'startMs': int(round(w['start'] * 1000)),
                         'endMs': int(round(w['end'] * 1000))} for w in words],
            'silenceCrossCheck': cross,
            **onset_fields,
        }
        extra = ''
        if c['kind'] == 'digit':
            extra = 'wordAtMs=%d' % onset_fields['wordAtMs']
        elif c['kind'] == 'add':
            extra = 'a=%d join=%d b=%d counts=%s sum=%d' % (
                onset_fields['aAtMs'], onset_fields['joinAtMs'], onset_fields['bAtMs'],
                onset_fields['countAtMs'], onset_fields['sumWordAtMs'])
        print('%-24s dur=%6d lufs=%6s %s' % (c['id'], dur, entries[c['id']]['loudnessLufs'], extra))

    spread = [e['loudnessLufs'] for e in entries.values()]
    manifest = {
        'voice': {'provider': 'elevenlabs', 'voiceName': 'Adela', 'voiceId': VOICE_ID,
                  'modelId': MODEL_ID, 'settings': VOICE_SETTINGS},
        'assembly': ('every clip is a single ElevenLabs eleven_v3 generation of one natural '
                     'sentence (the [excited] audio tag plus "..." ellipses pace the delivery); '
                     'there is no concatenation of separately-synthesised fragments and no '
                     'injected silence gaps; each generation is verified with speech-to-text '
                     '(scribe_v1) and regenerated on any content mismatch, up to %d attempts'
                     % MAX_TRIES),
        'processing': ('standard two-pass loudnorm(I=%s:TP=%s:LRA=%s): a measurement pass, then '
                       'a second pass fed the measured_I/measured_TP/measured_LRA/measured_thresh/'
                       'offset values with linear=true -> 44100Hz mono libmp3lame 192k'
                       % (TARGET_I, TARGET_TP, TARGET_LRA)),
        'onsetMethod': ('primary onsets are word-start timestamps from ElevenLabs speech-to-text '
                        '(scribe_v1) on the final processed file, mapped to aAtMs/joinAtMs/bAtMs/'
                        'countAtMs/sumWordAtMs/wordAtMs by word position; ffmpeg '
                        'silencedetect=noise=Xdb:d=%s at -35/-30/-40dB is run on the same file as '
                        'an independent cross-check and stored per clip (silenceCrossCheck)'
                        % SILENCE_D),
        'loudnessSpreadLu': round(max(spread) - min(spread), 2),
        'clips': entries,
    }
    open(MANIFEST, 'w').write(json.dumps(manifest, indent=2) + '\n')
    write_data_js(entries)
    print('loudness spread %.2f LU' % manifest['loudnessSpreadLu'])
    print('manifest -> %s' % MANIFEST)
    print('data.js  -> %s' % DATA_JS)


if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'build'
    if mode == 'gen':
        cmd_gen('--force' in sys.argv)
    elif mode == 'list':
        for c in clips():
            print('%-24s %s' % (c['id'], c['text']))
    else:
        cmd_build()
