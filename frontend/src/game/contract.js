// ESM facade over the shared CJS game contract.
// Keep this file a thin re-export so host and student stay on the same language.
import gameContract from "../../../shared/gameContract.js";

export const GAME_PHASE = gameContract.GAME_PHASE;
export const EVENTS = gameContract.EVENTS;
export const CLOSE_REASON = gameContract.CLOSE_REASON;
export const HIGHLIGHT_TYPE = gameContract.HIGHLIGHT_TYPE;
export const PODIUM = gameContract.PODIUM;
export const QTKN_BY_PLACE = gameContract.QTKN_BY_PLACE;
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
export const questionOpenedPayload = gameContract.questionOpenedPayload;
export const personalResultPayload = gameContract.personalResultPayload;
export const partialRankingPayload = gameContract.partialRankingPayload;
export const finalResultPayload = gameContract.finalResultPayload;

export default gameContract;
