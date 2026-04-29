import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useQuiz } from "../context/QuizContext";
import { getSocket } from "../services/socket";

function LiveQuizPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    attemptId,
    joinCode,
    lastSummary,
    participants,
    phase,
    playerName,
    question,
    remainingSeconds,
    setLastSummary,
    setLeaderboard,
    setParticipants,
    setPhase,
    setQuestion,
    setRemainingSeconds,
    theme,
  } = useQuiz();
  const [selectedOption, setSelectedOption] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [feedback, setFeedback] = useState("Waiting for the next question...");
  const playerStyle = {
    "--player-primary": theme.primaryColor || "#2563eb",
    "--player-accent": theme.accentColor || "#f59e0b",
    "--player-bg": theme.backgroundColor || "#0f172a",
    fontFamily: theme.fontFamily || "Inter",
  };

  useEffect(() => {
    if (joinCode && attemptId) {
      return;
    }

    const queryCode = searchParams.get("code");
    navigate(queryCode ? `/?code=${queryCode}` : "/", { replace: true });
  }, [attemptId, joinCode, navigate, searchParams]);

  useEffect(() => {
    if (!joinCode || !attemptId) {
      return undefined;
    }

    const socket = getSocket();

    function handleQuestionBroadcast(payload) {
      setPhase(payload.phase);
      setQuestion(payload.question);
      setRemainingSeconds(payload.remainingSeconds);
      setSelectedOption(null);
      setIsSubmitted(false);
      setFeedback("Choose your answer before the timer ends.");
    }

    function handleTimerTick(payload) {
      setRemainingSeconds(payload.remainingSeconds);
    }

    function handleTimerSync(payload) {
      setPhase(payload.phase);
      setRemainingSeconds(payload.remainingSeconds);
    }

    function handleSummary(payload) {
      setPhase("answer_summary");
      setLastSummary(payload);
      setFeedback("Answer summary is live.");
    }

    function handleLeaderboard(payload) {
      setLeaderboard(payload);
    }

    function handleParticipantJoined(payload) {
      setParticipants(payload.participants || []);
      if (phase === "waiting_for_players") {
        setFeedback(`${payload.name || "A player"} joined the lobby.`);
      }
    }

    function handleFinished(payload) {
      if (payload.leaderboard) {
        setLeaderboard(payload.leaderboard);
      }
      navigate("/leaderboard");
    }

    socket.on("question:broadcast", handleQuestionBroadcast);
    socket.on("timer:tick", handleTimerTick);
    socket.on("timer:sync", handleTimerSync);
    socket.on("question:summary", handleSummary);
    socket.on("leaderboard:update", handleLeaderboard);
    socket.on("room:participant-joined", handleParticipantJoined);
    socket.on("quiz:finished", handleFinished);

    return () => {
      socket.off("question:broadcast", handleQuestionBroadcast);
      socket.off("timer:tick", handleTimerTick);
      socket.off("timer:sync", handleTimerSync);
      socket.off("question:summary", handleSummary);
      socket.off("leaderboard:update", handleLeaderboard);
      socket.off("room:participant-joined", handleParticipantJoined);
      socket.off("quiz:finished", handleFinished);
    };
  }, [
    navigate,
    phase,
    setLastSummary,
    setLeaderboard,
    setParticipants,
    setPhase,
    setQuestion,
    setRemainingSeconds,
  ]);

  function handleSubmit(optionIndex) {
      if (!joinCode || !attemptId || !question?.id) {
        return;
      }

      if (selectedOption !== null || phase !== "question_live") {
        return;
      }

      setSelectedOption(optionIndex);
      setIsSubmitted(true);
      setFeedback("Answer submitted - waiting for others...");

      getSocket().emit(
        "player:submit-answer",
        {
          joinCode,
          attemptId,
          questionId: question.id,
          selectedOptionIndex: optionIndex,
        },
        (response) => {
          if (!response.ok) {
            setFeedback(response.message || "Unable to submit answer.");
          }
        }
      );
    }

  if (phase === "waiting_for_players") {
    return (
      <main className={`player-shell themed-player player-${theme.playerStyle || "vibrant"}`} style={playerStyle}>
        <section className="lobby-card animate-pop">
          <div className="live-topbar">
            <div>
              <p className="eyebrow">{theme.logoText || "Lobby"}</p>
              <h1>{joinCode || "Waiting"}</h1>
            </div>
            <div className="phase-chip">{participants.length} joined</div>
          </div>

          <div className="lobby-body">
            <div>
              <h2>Host will start soon</h2>
              <p className="support-copy">
                You are in as {playerName || "Guest"}. Keep this tab open.
              </p>
              {theme.coverImageUrl ? (
                <img className="player-cover-image" src={theme.coverImageUrl} alt="Quiz cover" />
              ) : null}
            </div>

            <div className="participant-list">
              {participants.length === 0 ? (
                <p className="participant-row">Waiting for players...</p>
              ) : (
                participants.map((participant, index) => (
                  <p className="participant-row" key={`${participant}-${index}`}>
                    <span>{index + 1}</span>
                    {participant}
                  </p>
                ))
              )}
            </div>
          </div>

          <p className="support-copy">{feedback}</p>
        </section>
      </main>
    );
  }

  return (
    <main className={`player-shell themed-player player-${theme.playerStyle || "vibrant"}`} style={playerStyle}>
      <section className="live-card animate-pop">
        <div className="live-topbar">
          <div>
            <p className="eyebrow">{theme.logoText || "Player"}</p>
            <h1>{playerName || "Guest"}</h1>
          </div>
          <div className="timer-badge">{remainingSeconds}s</div>
        </div>

        <div className="question-meta">
          <span>
            Question {(question?.index || 0) + 1} / {question?.totalQuestions || 0}
          </span>
          <span className="phase-chip">{phase.replaceAll("_", " ")}</span>
        </div>

        <h2 className="question-title">{question?.prompt || "Waiting for host..."}</h2>
        {theme.coverImageUrl && phase === "waiting_for_players" ? (
          <img className="player-cover-image" src={theme.coverImageUrl} alt="Quiz cover" />
        ) : null}

        <div className="option-grid">
          {(question?.options || []).map((option, index) => (
            <button
              key={option}
              className={`option-card ${selectedOption === index ? "selected" : ""}`}
              onClick={() => handleSubmit(index)}
              type="button"
            >
              <span>{String.fromCharCode(65 + index)}</span>
              <strong>{option}</strong>
            </button>
          ))}
        </div>

        {lastSummary ? (
          <div className="summary-strip">
            <div className="results-bar-container">
              {lastSummary.counts.map((item) => {
                const percentage = lastSummary.totalParticipants > 0
                  ? Math.round((item.count / lastSummary.totalParticipants) * 100)
                  : 0;
                return (
                  <div key={item.optionIndex} className="result-bar-group">
                    <div className="result-bar-label">
                      Option {String.fromCharCode(65 + item.optionIndex)}
                    </div>
                    <div className="result-bar-track">
                      <div
                        className="result-bar-fill"
                        style={{ width: `${percentage}%` }}
                      >
                        <span className="result-bar-percentage">
                          {percentage}%
                        </span>
                      </div>
                    </div>
                    <div className="result-bar-count">
                      {item.count} participant{item.count !== 1 ? 's' : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <p className="support-copy">
          {phase === "question_live" && !isSubmitted && "Choose your answer before the timer ends."}
          {phase === "question_live" && isSubmitted && "Answer submitted - waiting for others..."}
          {phase === "answer_summary" && "Results are in - see how everyone voted above"}
          {phase === "waiting_for_players" && "Waiting for more players to join..."}
          {phase !== "question_live" && phase !== "answer_summary" && phase !== "waiting_for_players" && feedback}
        </p>
      </section>
    </main>
  );
}

export default LiveQuizPage;
