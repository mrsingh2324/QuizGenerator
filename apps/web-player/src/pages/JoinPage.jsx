import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useQuiz } from "../context/QuizContext";
import { joinQuiz } from "../services/api";
import { getSocket } from "../services/socket";

function JoinPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setAttemptId, setJoinCode, setParticipants, setPlayerName, setQuestion, setRemainingSeconds, setPhase, setTheme } =
    useQuiz();
  const [code, setCode] = useState(searchParams.get("code") || "");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("Enter the game code to join the quiz.");

  useEffect(() => {
    const queryCode = searchParams.get("code");
    if (queryCode) {
      setCode(queryCode);
    }
  }, [searchParams]);

  async function handleJoin(event) {
    event.preventDefault();

    const rawCode = code.trim();
    const normalizedCode = /^[A-Z0-9]{6}$/i.test(rawCode) ? rawCode.toUpperCase() : rawCode.toLowerCase();
    const normalizedName = name.trim();

    if (!/^[A-Z0-9]{6}$/.test(normalizedCode) && !/^[a-z0-9-]{3,40}$/.test(normalizedCode)) {
      setMessage("Enter a valid quiz code or custom link slug.");
      return;
    }

    if (normalizedName.length < 2) {
      setMessage("Please enter a valid participant name.");
      return;
    }

    setMessage("Joining...");

    try {
      const result = await joinQuiz(normalizedCode, normalizedName, "", password.trim());
      setJoinCode(result.quiz.joinCode);
      setPlayerName(result.participant.name);
      setAttemptId(result.attemptId);
      if (result.quiz.theme) {
        setTheme(result.quiz.theme);
      }

      const socket = getSocket();
      socket.emit(
        "room:join",
        {
          joinCode: result.quiz.joinCode,
          role: "participant",
          attemptId: result.attemptId,
          name: result.participant.name,
        },
        (response) => {
          if (!response.ok) {
            setMessage(response.message || "Unable to enter the lobby.");
            return;
          }

          setParticipants(response.data?.participants || [result.participant.name]);
          if (response.data?.remainingSeconds) {
            setRemainingSeconds(response.data.remainingSeconds);
          }
          if (response.data?.activeQuestion) {
            setQuestion(response.data.activeQuestion);
          }
          setPhase(response.data?.phase || "waiting_for_players");
          navigate("/live");
        }
      );
    } catch (error) {
      setMessage(error.message || "Unable to join right now. Make sure the backend is running.");
    }
  }

  return (
    <main className="player-shell">
      <section className="join-card animate-pop">
        <p className="eyebrow">Participant Access</p>
        <h1>Join Live Quiz</h1>
        <p className="support-copy">{message}</p>

        <form className="join-form" onSubmit={handleJoin}>
          <input
            placeholder="Quiz code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            required
          />
          <input
            placeholder="Your name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
          <input
            placeholder="Quiz password (if required)"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
          />
          <button type="submit">Join Now</button>
        </form>
      </section>
    </main>
  );
}

export default JoinPage;
