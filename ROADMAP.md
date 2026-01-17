# Roadmap

## Phase 1: Core words CRUD
- [x] Create SQLite schema for words
- [x] Create, list, search, edit, delete words
- [x] Render word table in the UI

## Phase 2: SRS-lite fields
- [x] Add stage and next_review to words
- [x] Set new words to stage 0 and due today
- [x] Show next review date in the table

## Phase 3: Review flow
- [x] GET /api/review/today to fetch due words
- [x] POST /api/review/{id} to record good or bad
- [x] Review card UI with reveal, know, and still learning buttons

## Phase 4: Stats
- [x] Count due today
- [x] Count reviewed today
- [x] Count new words in 7 days
- [x] Count due in next 7 days

## Phase 5: Product polish
- [ ] Import and export CSV
- [ ] Reverse card mode (translation first)
- [ ] Favorites (starred)
- [ ] De-dup term values
- [ ] Add basic unit tests for SRS logic

## Phase 6: Topic training (multi-level drills)
- [ ] Add topic selector (tag-based list or explicit topics table)
- [ ] Training entrypoint: choose a topic and load all words for that topic
- [ ] Level 1: multiple choice (1 correct + 3 distractors)
- [ ] Level 2: matching (8 words + 8 translations to pair)
- [ ] Level 3: typing (8 prompts + text blanks to enter translations)
- [ ] Level 4: context challenge (8 examples with a blank; user types the missing word or translation)

## Phase 7: DuoLingo-style UI/UX polish
- [ ] Use friendly character illustrations and a playful visual language (soft gradients, rounded cards)
- [ ] Add lesson map with progress nodes and animated unlocks
- [ ] Build animated feedback states: bounce for correct, shake for wrong, confetti for streaks
- [ ] Add staggered card entrance, progress bar fill, and success modal transitions
- [ ] Use sound toggles and haptic-style micro-animations (scale, ripple) for key actions
