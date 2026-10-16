// ESM facade over the shared CJS game contract.
// Keep this file a thin re-export so host and student stay on the same language.
//
// Import through the '@quizchain/contract' alias, never by relative path: the alias
// is listed in optimizeDeps.include, so Vite pre-bundles the CJS file into ESM.
// Dev (esbuild) only gives that bundle a default export, so read the named values
// off the default object instead of using named imports.
import gameContract from "@quizchain/contract";

export const GAME_PHASE = gameContract.GAME_PHASE;
export const EVENTS = gameContract.EVENTS;
export const CLOSE_REASON = gameContract.CLOSE_REASON;
export const HIGHLIGHT_TYPE = gameContract.HIGHLIGHT_TYPE;
export const PODIUM = gameContract.PODIUM;
export const QTKN_BY_PLACE = gameContract.QTKN_BY_PLACE;
export const QTKN_FIRST = gameContract.QTKN_FIRST;
export const QTKN_FLOOR_CORRECT = gameContract.QTKN_FLOOR_CORRECT;
export const QTKN_INCORRECT = gameContract.QTKN_INCORRECT;
export const qtknForPlace = gameContract.qtknForPlace;
export const emptyPlayerScore = gameContract.emptyPlayerScore;
export const awardQuestionQtkn = gameContract.awardQuestionQtkn;
export const rankPlayers = gameContract.rankPlayers;
export const withGaps = gameContract.withGaps;
export const applyQuestionScores = gameContract.applyQuestionScores;
export const podiumMedal = gameContract.podiumMedal;
export const publicPodium = gameContract.publicPodium;
export const personalResult = gameContract.personalResult;
export const canAcceptAnswer = gameContract.canAcceptAnswer;
export const phaseFromStatus = gameContract.phaseFromStatus;
export const normalizeAddress = gameContract.normalizeAddress;
export const sameAddress = gameContract.sameAddress;
export const normalizeRoomCode = gameContract.normalizeRoomCode;
export const questionOpenedPayload = gameContract.questionOpenedPayload;
export const personalResultPayload = gameContract.personalResultPayload;
export const partialRankingPayload = gameContract.partialRankingPayload;
export const finalResultPayload = gameContract.finalResultPayload;

export default gameContract;
