// Stands in for the real Azure SDK package in the browser test (Vite alias). ?sdk=down makes the import fail, like Azure being unreachable.
import { createFakeSdk } from "../../../helpers/fakeSdk.mjs";

if (new URLSearchParams(location.search).get("sdk") === "down") throw new Error("Azure unreachable");

const sdk = createFakeSdk();
window.__sdk = sdk;

export default sdk;
export const ResultReason = sdk.ResultReason;
export const CancellationReason = sdk.CancellationReason;
export const OutputFormat = sdk.OutputFormat;
export const PropertyId = sdk.PropertyId;
export const AudioStreamFormat = sdk.AudioStreamFormat;
export const AudioConfig = sdk.AudioConfig;
export const AutoDetectSourceLanguageConfig = sdk.AutoDetectSourceLanguageConfig;
export const AutoDetectSourceLanguageResult = sdk.AutoDetectSourceLanguageResult;
export const AudioInputStream = sdk.AudioInputStream;
export const SpeechTranslationConfig = sdk.SpeechTranslationConfig;
export const TranslationRecognizer = sdk.TranslationRecognizer;
export const SpeechConfig = sdk.SpeechConfig;
export const SpeechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat;
export const SpeechSynthesizer = sdk.SpeechSynthesizer;
