# Verse Opener: the concept

This file describes what Verse Opener is for and what makes it what it is, so anyone, or their
AI, can build their own version with the same values. How this version does it is in
[IMPLEMENTATION.md](IMPLEMENTATION.md).

## The purpose

Sermon notes, study guides and articles are full of Bible references, and looking each one
up breaks the flow of reading. Verse Opener turns "every reference on this page" into one
action: the passages open together, in the reader's own translation, at the source.

It also helps the passages stay with you: the ones you open can be kept in a personal log
and practised until they're memorised.

## Core values

1. **Scripture in its own setting.** Open the passage at a full Bible site, where its
   context is one scroll away, rather than pulling excerpts out of it.
2. **Respect for the sources.** Link to a Bible site as an ordinary visitor would. Never copy
   or collect text from websites. Verse text in the log is only what the person types or
   pastes in themselves.
3. **The reader decides.** Nothing happens until they ask. They see every reference found and
   choose which to open, which translation, and whether to keep a log.
4. **Private by default.** The page is read only when the person asks, and only to find
   references. The log and practice stay on their own device, in a plain file they can keep.
   No accounts, ads, tracking or analytics, and nothing is sent to the developer.
5. **Formation, not just lookup.** Memorising Scripture is worth the effort; practice should
   make it easier, step by step, and never feel like a test.
6. **Free and given away.** No payment, no promotion, and the idea is free to rebuild.

## Requirements

**Finding references**
- Recognise full book names and common abbreviations (John, Jn, 1 Cor., I John, First
  Corinthians), verse ranges and lists (Rom 8:28-30, 35; John 3:16, 18; 4:5-7), cross-chapter
  ranges (Rev 21:1-22:5) and whole chapters (Romans 8, Genesis 1-3).
- Check chapter and verse numbers against the real size of each book, so things like times
  ("3:16pm") aren't mistaken for references.
- Work on the whole page or just the selected text.

**Opening**
- One action opens all the chosen passages together; the person can untick any first.
- The translation is the person's choice and is remembered.
- Optionally include a verse of context before and after each reference.
- A keyboard shortcut opens everything without any questions.
- The list can be copied as text.

**The log (optional, off until turned on)**
- Keeps the references opened, with when and where they were found (without private parts of
  addresses such as query strings).
- Verse text is added only by the person, by typing or pasting.
- Readable and editable; entries can be removed one by one or all at once.
- Can be kept as a plain Markdown file the person owns.

**Practice**
- Levels that build up: put the phrases in order, then every word, then type it.
- Progress is kept on the device, and the practice can also run as a stand-alone page that
  reads the person's own Markdown file.

**Notices**
- Say plainly that the tool is independent of any Bible site or publisher.
- Where Bible text is shown, follow that translation's publisher's notice rules.
