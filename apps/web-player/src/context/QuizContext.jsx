import { createContext, useContext, useMemo, useState } from "react";

const QuizContext = createContext(null);

const sampleQuestion = {
  id: "sample-question-1",
  prompt: "Which planet is known as the Red Planet?",
  options: ["Earth", "Mars", "Jupiter", "Venus"],
  difficulty: "easy",
  index: 0,
  totalQuestions: 5,
};

const sampleLeaderboard = [
  { rank: 1, participant: "Aanya", score: 40, status: "completed" },
  { rank: 2, participant: "Ravi", score: 30, status: "completed" },
  { rank: 3, participant: "Neha", score: 20, status: "in_progress" },
];

export function QuizProvider({ children }) {
  const [joinCode, setJoinCode] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [attemptId, setAttemptId] = useState("");
  const [phase, setPhase] = useState("waiting_for_players");
  const [remainingSeconds, setRemainingSeconds] = useState(20);
  const [question, setQuestion] = useState(sampleQuestion);
  const [leaderboard, setLeaderboard] = useState(sampleLeaderboard);
  const [lastSummary, setLastSummary] = useState(null);

  const value = useMemo(
    () => ({
      joinCode,
      setJoinCode,
      playerName,
      setPlayerName,
      attemptId,
      setAttemptId,
      phase,
      setPhase,
      remainingSeconds,
      setRemainingSeconds,
      question,
      setQuestion,
      leaderboard,
      setLeaderboard,
      lastSummary,
      setLastSummary,
    }),
    [attemptId, joinCode, lastSummary, leaderboard, phase, playerName, question, remainingSeconds]
  );

  return <QuizContext.Provider value={value}>{children}</QuizContext.Provider>;
}

export function useQuiz() {
  const context = useContext(QuizContext);

  if (!context) {
    throw new Error("useQuiz must be used inside QuizProvider");
  }

  return context;
}
