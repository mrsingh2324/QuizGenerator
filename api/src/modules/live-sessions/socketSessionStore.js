const sessionStateByCode = new Map();

function getSessionState(joinCode) {
  return sessionStateByCode.get(joinCode);
}

function setSessionState(joinCode, state) {
  sessionStateByCode.set(joinCode, state);
  return state;
}

function removeSessionState(joinCode) {
  const state = sessionStateByCode.get(joinCode);

  if (state && state.questionTimer) {
    clearInterval(state.questionTimer);
  }

  if (state && state.summaryTimer) {
    clearTimeout(state.summaryTimer);
  }

  sessionStateByCode.delete(joinCode);
}

module.exports = {
  getSessionState,
  setSessionState,
  removeSessionState,
};
