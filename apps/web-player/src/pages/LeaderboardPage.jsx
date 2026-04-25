import { Link } from "react-router-dom";

import { useQuiz } from "../context/QuizContext";

function LeaderboardPage() {
  const { leaderboard } = useQuiz();

  return (
    <main className="player-shell">
      <section className="leaderboard-card animate-pop">
        <div className="leaderboard-header">
          <div>
            <p className="eyebrow">Final Ranking</p>
            <h1>Leaderboard</h1>
          </div>
          <Link className="ghost-link" to="/">
            Join another quiz
          </Link>
        </div>

        <div className="leaderboard-list">
          {leaderboard.map((entry) => (
            <article className="leaderboard-row" key={`${entry.rank}-${entry.participant}`}>
              <strong>#{entry.rank}</strong>
              <span>{entry.participant}</span>
              <span>{entry.status}</span>
              <strong>{entry.score} pts</strong>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

export default LeaderboardPage;
