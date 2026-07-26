// Piper synthesis worker. Runs as a page-origin blob worker created by
// the content script (a page-origin worker cannot be constructed from a
// chrome-extension:// URL), so it has no extension APIs: every asset
// location arrives in the init message. Built by scripts/builder/
// build-worker.ts as a self-contained IIFE — onnxruntime-web is aliased
// to its bundled build so no code is ever fetched at runtime; only the
// wasm binaries (packaged in the extension) and the voice model (user-
// consented Hugging Face download, cached in the AO3 origin's OPFS).
//
// The spike measured Piper WASM at ~2.9x realtime on CPU while fully
// starving whatever thread it runs on — which is exactly why it lives
// here and not in the content script.

import {
  download,
  remove,
  stored,
  TtsSession,
} from "@mintplex-labs/piper-tts-web";
import { env as ortEnv } from "onnxruntime-web";
import type {
  PiperWorkerRequest,
  PiperWorkerResponse,
} from "@src/common/tts/piper-protocol";

// Piper sets numThreads to hardwareConcurrency, but a page-origin worker
// can never be crossOriginIsolated, so ORT would only warn and fall back
// to one thread after a failed spawn. Pin it so init skips the attempt.
try {
  Object.defineProperty(ortEnv.wasm, "numThreads", {
    configurable: true,
    get: () => 1,
    set() {
      /* Pinned single-thread */
    },
  });
} catch {
  ortEnv.wasm.numThreads = 1;
}

const scope = self as unknown as {
  postMessage(message: PiperWorkerResponse, transfer?: Transferable[]): void;
  onmessage: ((event: MessageEvent<PiperWorkerRequest>) => void) | null;
};

let session: TtsSession | null = null;

function reportError(context: string, error: unknown): void {
  scope.postMessage({
    type: "error",
    context,
    error:
      error instanceof Error ? (error.stack ?? error.message) : String(error),
  });
}

async function handle(message: PiperWorkerRequest): Promise<void> {
  switch (message.type) {
    case "init": {
      // Re-init after a content-side cancel is a no-op; the session
      // survives in the worker
      if (session) {
        scope.postMessage({ type: "ready" });
        break;
      }

      session = await TtsSession.create({
        voiceId: message.voiceId,
        wasmPaths: message.wasmPaths as never,
        progress(progress) {
          scope.postMessage({
            type: "progress",
            loaded: progress.loaded,
            total: progress.total,
          });
        },
      });
      scope.postMessage({ type: "ready" });
      break;
    }

    case "synthesize": {
      if (!session) {
        throw new Error("synthesize before init");
      }

      const wav = await session.predict(message.text);
      const buffer = await wav.arrayBuffer();

      scope.postMessage({ type: "audio", id: message.id, buffer }, [buffer]);
      break;
    }

    case "download": {
      await download(message.voiceId, (progress) => {
        scope.postMessage({
          type: "progress",
          loaded: progress.loaded,
          total: progress.total,
        });
      });
      scope.postMessage({ type: "downloaded", voices: await stored() });
      break;
    }

    case "remove": {
      await remove(message.voiceId);
      scope.postMessage({ type: "removed", voices: await stored() });
      break;
    }

    case "stored": {
      scope.postMessage({ type: "stored", voices: await stored() });
      break;
    }

    default:
      break;
  }
}

scope.onmessage = (event) => {
  handle(event.data).catch((error: unknown) => {
    reportError(event.data.type, error);
  });
};

scope.postMessage({ type: "boot" });
