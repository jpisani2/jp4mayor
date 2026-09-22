/* The house rules, as data.

   Edit the text here — it's the one file in the app meant to be rewritten by
   hand as the group changes its mind. Nothing else reads from it, so a typo
   can't break anything. Add, remove or reword freely.

   Rules marked `settled` came out of an actual argument or decision. Worth
   keeping the reasoning attached: it stops the same debate happening twice. */

export const SECTIONS = [
  {
    title: "Calling a bet",
    rules: [
      { text: "Anyone in the game can call a bet, from the list or written from scratch." },
      { text: "Whoever calls it picks their side as part of calling it, so every bet starts with one side taken." },
      { text: "The person calling the bet sets the odds. Changed odds show up in a different color, with what they were changed from." },
      { text: "Even money is always available — both sides risk the base stake and the odds are ignored." },
      { text: "Ten bets can be open at once. More than that and nobody can keep track." },
      { text: "You can pull your own bet while nobody else has picked. After that it takes the admin PIN.",
        settled: "Stops someone calling a bet, watching three people take the other side, and yanking it." },
      { text: "Argue about the odds before the bet is posted, never after. Once it's up, the price is the price." },
      { text: "The two sides are whatever they said when the bet went up. No renegotiating them afterwards." },
      { text: "The base stake is set when the game is set up and doesn't change mid-game." },
    ],
  },
  {
    title: "Taking a side",
    rules: [
      { text: "Change your mind as often as you like until the bet locks." },
      { text: "Sitting out risks nothing and counts as answering." },
      { text: "Anyone in the bet can lock it. Every bet must be called and accepted before the ball is snapped — late calls are void." },
      { text: "Whoever hasn't answered when it locks is out.",
        settled: "The clock doesn't wait. Silence is a decision." },
      { text: "A bet can't lock with everyone on one side.",
        settled: "The winners would split a pot they funded themselves and nobody would net anything." },
    ],
  },
  {
    title: "The money",
    rules: [
      { text: "Risk to take a side is twice the base stake times the chance that side happens. The long side is cheap, the short side is dear." },
      { text: "Your risk is set by the odds, not by choice. Backing the favorite costs more than backing the longshot." },
      { text: "Winners split the whole pot in proportion to what they risked. Losers lose their risk." },
      { text: "What you'd win isn't fixed until picks close, because it depends on how many end up on each side." },
      { text: "Nothing is real until it's graded, and a grade can always be undone." },
    ],
  },
  {
    title: "Before kickoff",
    rules: [
      { text: "The pregame board goes up when the admin sets the game up, and stays open until kickoff." },
      { text: "Nobody can see who's on which side until kickoff. You see how many are in and who hasn't answered.",
        settled: "The pot is hidden too — with the count visible you could work the sides out from it." },
      { text: "Change any pregame pick right up until kickoff." },
      { text: "At kickoff, anything with both sides covered locks. Anything one-sided voids.",
        settled: "A bet nobody took the other side of never had a bet in it." },
    ],
  },
  {
    title: "Grading the tricky ones",
    rules: [
      { text: "A penalty that wipes out a play means the play never happened. Run the bet again on the replayed down." },
      { text: "A play that gets reviewed grades on the final ruling, not the call on the field." },
      { text: "The two-minute warning, a timeout, or an injury does not void an open bet. It's still live." },
      { text: "If the quarter or half ends before a bet can resolve, it's a push. Everyone gets their risk back." },
      { text: "A defensive or special teams touchdown is neither run nor pass. Push on run-versus-pass bets." },
      { text: "A safety counts as a score for next-score bets. Two points, even." },
      { text: "Announcer and broadcast bets grade on what actually airs on your feed." },
    ],
  },
  {
    title: "Ending the night",
    rules: [
      { text: "Every locked bet gets an answer at close-out — a winner, a push, or never happened.",
        settled: "It's the last moment anyone remembers what actually happened." },
      { text: "Bets still taking picks when the night ends are voided without asking. Nobody committed to them." },
      { text: "A wrong grade can be reopened afterwards. Balances move accordingly." },
    ],
  },
  {
    title: "Settling up",
    rules: [
      { text: "Everything is tracked to the cent. Only the settle-up screen rounds." },
      { text: "Round against yourself: whoever owes rounds up, whoever is owed rounds down.",
        settled: "It always sums to zero, and it's a sentence you can say out loud." },
      { text: "Leaving early? Round what you owe up to the next dollar and pay before you go." },
      { text: "A leaver's money goes out in this order: skip anyone owed under a dollar, then a dollar each — biggest owed first if it won't stretch — then whatever's left pays down whoever is owed most, over and over.",
        settled: "Levelling everyone out beats clearing one person and leaving three at odd numbers." },
      { text: "The suggested transfers are a guide. Log what actually gets handed over.",
        settled: "Somebody always has two twenties and no fives." },
      { text: "Settle at the end of the game, not the end of each quarter." },
      { text: "Cash changes hands in person. The site only keeps score." },
    ],
  },
  {
    title: "Seats and names",
    rules: [
      { text: "Tap your own name, every week, on whatever device you're holding. Never someone else's.",
        settled: "It's the only real way to make a mess, and it's the admin who has to clean it up." },
      { text: "Go quiet for five bets in a row and you drop off everyone else's screen until you pick something. Nothing is lost." },
      { text: "Balances ride from week to week until someone pays." },
      { text: "The site is the log. Nobody keeps a separate one.",
        settled: "Replaces the old rule about one person keeping the sheet — there's one record now and everyone can see it." },
    ],
  },
];
