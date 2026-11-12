# Design notes

## Product framing

SIYAQ is a focused learning workbook for employees who need practical workplace English. Its home screen answers “where do I start?” and “what should I practice next?” before it asks the learner to browse. The course paths borrow the *idea* of a guided sequence and interleaved review from language-learning products; the look, tone, and content are specific to SIYAQ.

## Visual system

- Warm ivory `#FBF8F3`, deep oxblood `#602E38`, antique gold `#D3A75C`, charcoal `#292523`, and sand `#E9E1D6`.
- Arabic is the page’s reading direction. English examples use explicit LTR spans, so punctuation and word order remain intact.
- Editorial type hierarchy, generous line spacing, restrained rules and numbered path markers establish a workbook feel without repeating equal dashboard cards.
- The desktop header becomes a fixed safe-area-aware bottom navigation on small screens. Buttons are touch-sized and have visible keyboard focus.
- Transitions are short and optional under `prefers-reduced-motion`.
- Icons are local inline SVG shapes; there are no emoji icons, remote fonts, tracking scripts, or runtime packages.

## Learning interaction

The home page proposes one lesson. Lessons then follow one consistent, demanding sequence: three connected dialogue turns, two sentence-building challenges, one writing check, one listening comprehension, and one speaking practice. That mix builds related skills in short units while keeping the learner on a clear path. Review remains available in the bottom navigation.

## References

- Mobbin was used as a reference point for studying shipped mobile and web interaction patterns, not as a source of copied screens or assets.
- Duolingo’s home-screen article informed the guided-path and practice-in-the-path concept. SIYAQ uses its own typography, palette, learning content, and interaction design.
