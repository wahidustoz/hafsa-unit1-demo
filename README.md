# Hafsa Phonics

A teacher-led demo. Two units are open: **Unit 1** (letters A, B, C — nine words) and
**Digits** (the numbers 1 to 9, and 0).

**Live:** https://wahidustoz.github.io/hafsa-unit1-demo/

## The lesson

The teacher drives every screen. Nothing is timed, nothing can be failed, and a wrong tap only
brings a gentle nudge — the pace follows the class.

### Unit 1 — Aa Bb Cc

| Step | What happens |
|------|--------------|
| **Hello** | Each word is introduced — the letters `A a` animate as they are spoken, then the object and the word `apple` pop in. |
| **What's this?** | The object appears with a pointing hand. The teacher taps it, the class answers, and the word is revealed. |
| **Chanting** | The full Unit 1 chant, with all nine objects lighting up in turn, in time with the recording. |
| **Peek-a-boo** | The object flashes for a moment. The class shouts the word, then the teacher taps the card to reveal it. |
| **Story** | A picnic scene where each animal glows as it is named. |
| **Bubble Pop** | Pop the bubbles holding words that start with the letter sound. |
| **Pop-Up Friends** | Objects rise from burrows; tap the one that was named. |

### Digits — 1 2 3 4 5 6 7 8 9 0

| Step | What happens |
|------|--------------|
| **Numbers** | Each digit is met in turn, alongside that many objects. |
| **Count Along** | Count the objects together, one tap at a time. |
| **How many?** | Objects appear; the class says how many, then the number is shown. |
| **Add it up!** | `3 apples + 2 apples` — the apples land one by one, exactly on the spoken count. |
| **Number Match** | Match a digit to that many objects. |

The progress dots in the top right are buttons — tap one to jump straight to any word or round.

## Running it locally

No build step — it is plain ES modules.

```
npx serve
```

Then open the address it prints.

Use a server that answers range requests. `python3 -m http.server` does not, so the browser
cannot seek inside an audio file, and jumping to a later word in Chanting or Story silently
restarts the track from the beginning. GitHub Pages answers range requests, so the published
site is unaffected.

## Audio

The spoken "A a apple!" prompts are taken from the original course chant recording, so they match
the voice the children hear during the Chanting step.
