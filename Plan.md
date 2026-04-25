Why This Structure
apps/
Holds user-facing products. Admin and participant experiences should be separate because their flows, permissions, and UI states are very different.

api/
Owns business rules, persistence, auth, quiz publishing, scoring, and coordination between UI and background services.

services/ai-orchestrator/
Keeps AI logic out of the main API. This matters because prompt pipelines, retries, model switching, and validation will change often.

services/document-processor/
Document parsing is its own problem: PDF/text/doc extraction, OCR, cleanup, and chunking should not be mixed with quiz logic.

services/realtime-gateway/
Live quiz timing, room presence, answer windows, and leaderboard broadcasts need a dedicated realtime boundary.

packages/
Shared types, quiz engine logic, validation schemas, UI system, and API client should be reused across apps without duplication.

docs/
This project has enough behavior complexity that architecture docs should exist before implementation. Otherwise the build will drift.

Architecture Design
I would use a modular monolith + background services approach initially.

That means:

One main backend API for core business logic.
One AI/document pipeline service for asynchronous processing.
One realtime session gateway for live quiz events.
Shared packages for consistency across admin, player, and backend.
This is better than full microservices right now because:

You are still in product-definition stage.
Requirements will change quickly.
Full microservices would add cost and coordination overhead too early.
Core Domain Modules
Inside the backend/API, define these modules clearly:

auth
Admin login/session management. Participants may join with lightweight identity only.

documents
Stores uploaded files, extracted text, parsing status, and source metadata.

ai-processing
Tracks the lifecycle:

uploaded
parsing
classified
question extraction
generation
validation
awaiting admin confirmation
approved
question-bank
Canonical question entities. This is important because AI output should not directly become a live quiz without normalization.

quiz-drafts
Editable draft quiz before publishing.

quiz-publishing
Turns a draft into a launchable quiz session.

live-sessions
Join code, QR data, session state, timer state, active question, room status.

participants
Name entry, join validation, participant presence.

answers
Captures answer submissions and timing.

scoring
Evaluates correctness and generates scores.

leaderboard
Maintains score ordering and post-question summary.

analytics
Useful later for admin reports and quiz quality checks.

AI Pipeline
This is the most important part of your product. I would model it as a pipeline, not a single AI call.

Flow:

Input received:

document upload
topic text
Input classification:

document with ready-made questions
explanatory text / study material
invalid or low-quality input
Processing path:

if ready-made questions: extract, normalize, detect options, detect correct answer if possible
if explanatory text/topic: ask admin for difficulty, count, maybe class/subject, then generate questions
Validation:

duplicate detection
malformed options
ambiguous correct answers
unsupported language/content
low-confidence AI output
Admin review:

confirm/edit/reject/regenerate
Publish:

create join code
create QR
prepare live session payload
Do not let the AI service directly publish quizzes. Always force a normalized draft plus admin confirmation.

Realtime Session Architecture
For gameplay, model session state explicitly.

Main states:

draft
waiting_for_players
question_live
answer_summary
final_results
closed
Per-question cycle:

Question shown
20-30 second timer starts
Stop early if all answered
Lock submissions
Show answer distribution for 5 seconds
Move to next question
Show final leaderboard
The realtime service should own:

room membership
countdown timers
early completion detection
answer collection events
result broadcast events
The API should still remain source of truth for persisted data.

Data Model Direction
You do not need exact tables yet, but these entities should exist in the design:

Admin
UploadedDocument
TopicRequest
AIJob
Question
QuestionOption
QuizDraft
PublishedQuiz
LiveSession
SessionQuestion
Participant
ParticipantAnswer
ScoreEntry
SessionEvent
That separation matters because:

a question may exist before a quiz is published
a quiz may be reused later
a live session is not the same thing as a draft
Frontend Split
web-admin
For:

upload document
enter topic
choose difficulty/count
review AI-generated questions
edit quiz
launch session
view live progress and final score
web-player
For:

join via code/QR
enter name
wait in lobby
answer timed questions
see answer distribution
see final score/leaderboard
This separation prevents the admin UI from becoming cluttered and keeps participant screens lightweight and fast.

Documentation to Write Before Coding
Before implementation, I would create these documents first:

docs/product/user-flows.md
docs/architecture/system-overview.md
docs/architecture/ai-pipeline.md
docs/architecture/realtime-engine.md
docs/architecture/domain-model.md
docs/ux/states-and-edge-cases.md
Those six docs will remove most ambiguity before code starts.

Practical Build Order
If you want the architecture to stay controlled, build in this order:

Product flows and data model
Admin draft creation flow
Document parsing + AI classification
Quiz generation + admin confirmation
Publishing + join code + QR
Player join flow
Live timed session engine
Scoring + final leaderboard
Analytics and self-test mode later