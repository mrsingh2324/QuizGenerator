import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useQuiz } from "../context/QuizContext";
import { getSocket } from "../services/socket";

const OPTION_LETTERS = ["A", "B", "C", "D"];

// SVG circle math for the timer ring
const RING_R = 26;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_R;

function timerStroke(remaining, total) {
  if (!total || total <= 0) return RING_CIRCUMFERENCE;
  const fraction = Math.max(0, Math.min(1, remaining / total));
  return RING_CIRCUMFERENCE * (1 - fraction);
}

function timerColor(remaining, total) {
  if (!total) return "#a78bfa";
  const pct = remaining / total;
  if (pct > 0.5) return "#43d68a";
  if (pct > 0.2) return "#ffc857";
  return "#ff4b57";
}

function LiveQuizPage() {
  const navigate = useNavigate();
  const {
    attemptId,
    joinCode,
    phase,
    playerName,
    question,
    remainingSeconds,
    setLastSummary,
    setLeaderboard,
    setPhase,
    setQuestion,
    setRemainingSeconds,
  } = useQuiz();

  const [selectedOption, setSelectedOption] = useState(null);
  const [summaryData, setSummaryData] = useState(null); // { counts, correctOptionIndex, durationSeconds }
  const [summaryCountdown, setSummaryCountdown] = useState(0);
  const summaryTimerRef = useRef(null);

  // Total seconds for the current question (used to drive the ring fill)
  const totalSecondsRef = useRef(remainingSeconds);
  useEffect(() => {
    if (phase === "question_live") {
      totalSecondsRef.current = remainingSeconds;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    const socket = getSocket();

    function handleQuestionBroadcast(payload) {
      setPhase(payload.phase);
      setQuestion(payload.question);
      setRemainingSeconds(payload.remainingSeconds);
      totalSecondsRef.current = payload.remainingSeconds;
      setSelectedOption(null);
      setSummaryData(null);
      setSummaryCountdown(0);
      if (summaryTimerRef.current) {
        clearInterval(summaryTimerRef.current);
        summaryTimerRef.current = null;
      }
    }

    function handleTimerTick(payload) {
      setRemainingSeconds(payload.remainingSeconds);
    }

    function handleTimerSync(payload) {
      setPhase(payload.phase);
      setRemainingSeconds(payload.remainingSeconds);
      if (payload.phase === "question_live") {
        totalSecondsRef.current = payload.remainingSeconds;
      }
    }

    function handleSummary(payload) {
      setPhase("answer_summary");
      setLastSummary(payload);
      setSummaryData(payload);

      const dur = payload.durationSeconds || 5;
      setSummaryCountdown(dur);

      if (summaryTimerRef.current) clearInterval(summaryTimerRef.current);
      summaryTimerRef.current = setInterval(() => {
        setSummaryCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(summaryTimerRef.current);
            summaryTimerRef.current = null;
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    function handleLeaderboard(payload) {
      setLeaderboard(payload);
    }

    function handleFinished(payload) {
      if (payload.leaderboard) setLeaderboard(payload.leaderboard);
      navigate("/leaderboard");
    }

    socket.on("question:broadcast", handleQuestionBroadcast);
    socket.on("timer:tick", handleTimerTick);
    socket.on("timer:sync", handleTimerSync);
    socket.on("question:summary", handleSummary);
    socket.on("leaderboard:update", handleLeaderboard);
    socket.on("quiz:finished", handleFinished);

    return () => {
      socket.off("question:broadcast", handleQuestionBroadcast);
      socket.off("timer:tick", handleTimerTick);
      socket.off("timer:sync", handleTimerSync);
      socket.off("question:summary", handleSummary);
      socket.off("leaderboard:update", handleLeaderboard);
      socket.off("quiz:finished", handleFinished);
      if (summaryTimerRef.current) clearInterval(summaryTimerRef.current);
    };
  }, [navigate, setLastSummary, setLeaderboard, setPhase, setQuestion, setRemainingSeconds]);

  function handleSelectOption(optionIndex) {
    if (!joinCode || !attemptId || !question?.id) return;
    if (selectedOption !== null || phase !== "question_live") return;

    setSelectedOption(optionIndex);

    getSocket().emit(
      "player:submit-answer",
      { joinCode, attemptId, questionId: question.id, selectedOptionIndex: optionIndex },
      (response) => {
        if (!response.ok) {
          // Roll back selection on error
          setSelectedOption(null);
        }
      }
    );
  }

  if (phase === "waiting_for_players") {
    return (
      <main className="player-shell">
        <div className="cosmos-card animate-pop">
          <div className="waiting-screen">
            <div className="waiting-pulse" />
            <h2>Waiting for host…</h2>
            <p>The quiz will start when the host is ready.</p>
          </div>
        </div>
      </main>
    );
  }

  const progress =
    question?.totalQuestions > 0
      ? ((question.index + 1) / question.totalQuestions) * 100
      : 0;

  const isSummary = phase === "answer_summary" && summaryData;

  return (
    <main className="player-shell">
      <div className="cosmos-card animate-pop">
        {/* Top bar */}
        <div className="live-topbar">
          <div className="player-chip">
            <div className="player-avatar">
              {(playerName || "G")[0].toUpperCase()}
            </div>
            <span className="player-chip-name">{playerName || "Guest"}</span>
          </div>

          {/* Circular timer */}
          <div className="timer-ring-wrap">
            <svg className="timer-ring-svg" viewBox="0 0 64 64">
              <circle
                className="timer-ring-track"
                cx="32" cy="32" r={RING_R}
              />
              <circle
                className="timer-ring-fill"
                cx="32" cy="32" r={RING_R}
                stroke={timerColor(remainingSeconds, totalSecondsRef.current)}
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={timerStroke(remainingSeconds, totalSecondsRef.current)}
              />
            </svg>
            <div
              className="timer-ring-number"
              style={{ color: timerColor(remainingSeconds, totalSecondsRef.current) }}
            >
              {Math.max(0, remainingSeconds)}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="question-progress">
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="q-label">
            {question?.index + 1 || 1} / {question?.totalQuestions || 1}
          </span>
        </div>

        {/* Question text */}
        <p className="question-text">{question?.prompt || "Waiting for host…"}</p>

        {/* Options */}
        <div className="option-grid">
          {(question?.options || []).map((option, idx) => {
            const isSelected = selectedOption === idx;
            const isCorrect = isSummary && summaryData.correctOptionIndex === idx;
            const isWrong = isSummary && !isCorrect;

            // percentage fill
            let pct = 0;
            if (isSummary) {
              const total = summaryData.totalParticipants || 0;
              const count = summaryData.counts?.find((c) => c.optionIndex === idx)?.count || 0;
              pct = total > 0 ? Math.round((count / total) * 100) : 0;
            }

            let classes = `option-btn opt-${idx}`;
            if (isCorrect) classes += " opt-correct";
            else if (isSummary && isSelected) classes += " opt-wrong opt-selected";
            else if (isSummary) classes += " opt-wrong";
            else if (isSelected) classes += " opt-selected";

            return (
              <button
                key={option}
                className={classes}
                onClick={() => handleSelectOption(idx)}
                disabled={isSummary || selectedOption !== null || phase !== "question_live"}
                type="button"
              >
                <span className="opt-letter">{OPTION_LETTERS[idx]}</span>
                <span className="opt-text">{option}</span>
                {isSummary && (
                  <span className="opt-pct">{pct}%</span>
                )}
                {isCorrect && (
                  <span className="opt-badge">✓</span>
                )}
                {isSummary && isSelected && !isCorrect && (
                  <span className="opt-badge">✗</span>
                )}
                {isSummary && (
                  <div
                    className="opt-result-bar"
                    style={{ width: `${pct}%` }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Summary countdown strip */}
        {isSummary && summaryCountdown > 0 && (
          <div className="summary-strip">
            <span>
              {selectedOption === summaryData.correctOptionIndex
                ? "✓ Correct!"
                : selectedOption !== null
                  ? "✗ Not quite"
                  : "Time's up"}
            </span>
            <span>Next in <strong>{summaryCountdown}s</strong></span>
          </div>
        )}

        {/* Status line */}
        {!isSummary && (
          <p className="status-line">
            {phase === "question_live" && selectedOption === null && "Tap your answer before time runs out"}
            {phase === "question_live" && selectedOption !== null && "Answer locked in — waiting for others…"}
          </p>
        )}
      </div>
    </main>
  );
}

export default LiveQuizPage;
