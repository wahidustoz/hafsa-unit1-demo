# Hafsa Phonics — Unit 1

A teacher-led demo of Unit 1 (letters **A**, **B**, **C** — nine words).

**Live:** https://wahidustoz.github.io/hafsa-unit1-demo/

## The lesson

The teacher drives every screen. Each step has a pause/continue control and a way back to the
step list, so the pace follows the class rather than a timer.

| Step | What happens |
|------|--------------|
| **Hello** | Each word is introduced — the letters `A a` animate as they are spoken, then the object and the word `apple` pop in. |
| **What's this?** | The object appears with a pointing hand. The teacher taps it, the class answers, and the word is revealed. |
| **Chanting** | The full Unit 1 chant, with all nine objects lighting up in turn, in time with the recording. |
| **Peek-a-boo** | The object flashes for a moment. The class shouts the word, then the teacher hits **Reveal!** |

## Running it locally

No build step — it is plain ES modules.

```
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Audio

The spoken "A a apple!" prompts are taken from the original course chant recording, so they match
the voice the children hear during the Chanting step.
