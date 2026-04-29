import { Link } from "react-router-dom";

import { useQuiz } from "../context/QuizContext";

const MEDALS = ["🥇", "🥈", "🥉"];

function LeaderboardPage() {
  const { leaderboard } = useQuiz();

  const podium = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  return (
    <div className="leaderboard-shell">
      <div className="leaderboard-card animate-pop">
        <div className="lb-header">
          <div>
            <p className="eyebrow">Final Ranking</p>
            <h1>Leaderboard</h1>
          </div>
          <Link className="lb-join-link" to="/">
            Play again
          </Link>
        </div>

        {/* Top 3 podium */}
        {podium.length > 0 && (
          <div className="lb-podium">
            {podium.map((entry, i) => (
              <div
                key={`${entry.rank}-${entry.participant}`}
                className={`lb-podium-slot rank-${i + 1}`}
              >
                <div className="lb-medal">{MEDALS[i]}</div>
                <div className="lb-podium-name">{entry.participant}</div>
                <div className="lb-podium-score">{entry.score} pts</div>
              </div>
            ))}
          </div>
        )}

        {/* Remaining entries */}
        {rest.length > 0 && (
          <div className="lb-list">
            {rest.map((entry) => (
              <div
                className="lb-row"
                key={`${entry.rank}-${entry.participant}`}
              >
                <span className="lb-rank">#{entry.rank}</span>
                <span className="lb-name">{entry.participant}</span>
                <span className="lb-score">{entry.score} pts</span>
              </div>
            ))}
          </div>
        )}

        {leaderboard.length === 0 && (
          <div style={{ textAlign: "center", padding: "2rem", color: "rgba(200,215,235,0.5)" }}>
            No scores yet.
          </div>
        )}
      </div>
    </div>
  );
}

export default LeaderboardPage;
