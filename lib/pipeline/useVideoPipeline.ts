import { useCallback, useRef, useState } from 'react';
import type { GenerationInput, GeneratedVideo, PipelineProgress } from './types';
import { runGenerationPipeline } from './runPipeline';
import { runSeriesPipeline } from './runSeriesPipeline';

export interface UseVideoPipelineResult {
  progress: PipelineProgress | null;
  result: GeneratedVideo | null;        // last completed video (single or last part)
  completedParts: GeneratedVideo[];     // all finished parts so far (series only)
  isRunning: boolean;
  isSeries: boolean;
  currentPart: number;                  // 1-indexed part being generated
  totalParts: number;
  start: (
    input: GenerationInput,
    onPartDone?: (video: GeneratedVideo) => void
  ) => Promise<void>;
  reset: () => void;
}

export function useVideoPipeline(): UseVideoPipelineResult {
  const [progress, setProgress] = useState<PipelineProgress | null>(null);
  const [result, setResult] = useState<GeneratedVideo | null>(null);
  const [completedParts, setCompletedParts] = useState<GeneratedVideo[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isSeries, setIsSeries] = useState(false);
  const [currentPart, setCurrentPart] = useState(1);
  const [totalParts, setTotalParts] = useState(1);
  const runIdRef = useRef(0);

  const start = useCallback(async (
    input: GenerationInput,
    onPartDone?: (video: GeneratedVideo) => void
  ) => {
    const runId = ++runIdRef.current;
    const numParts = input.numParts ?? 1;
    const series = numParts > 1;

    setIsRunning(true);
    setResult(null);
    setCompletedParts([]);
    setIsSeries(series);
    setCurrentPart(1);
    setTotalParts(numParts);
    setProgress({
      stage: series ? 'planning_series' : 'writing_story',
      overallPercent: 0,
      detail: 'Starting…',
    });

    try {
      if (series) {
        const videos = await runSeriesPipeline(
          { ...input, numParts },
          (p) => { if (runIdRef.current === runId) setProgress(p); },
          (video, partNum, total) => {
            if (runIdRef.current !== runId) return;
            setCompletedParts((prev) => [...prev, video]);
            setResult(video);
            setCurrentPart(Math.min(partNum + 1, total));
            onPartDone?.(video);
          }
        );
        if (runIdRef.current === runId) {
          setResult(videos[videos.length - 1] ?? null);
          setIsRunning(false);
        }
      } else {
        const video = await runGenerationPipeline(input, (p) => {
          if (runIdRef.current === runId) setProgress(p);
        });
        if (runIdRef.current === runId) {
          setResult(video);
          setCompletedParts([video]);
          onPartDone?.(video);
          setIsRunning(false);
        }
      }
    } catch (err) {
      if (runIdRef.current === runId) {
        setProgress({
          stage: 'error',
          overallPercent: 0,
          detail: 'Generation failed',
          errorMessage:
            err instanceof Error ? err.message : 'Something went wrong. Please try again.',
        });
        setIsRunning(false);
      }
    }
  }, []);

  const reset = useCallback(() => {
    runIdRef.current += 1;
    setProgress(null);
    setResult(null);
    setCompletedParts([]);
    setIsRunning(false);
    setIsSeries(false);
    setCurrentPart(1);
    setTotalParts(1);
  }, []);

  return { progress, result, completedParts, isRunning, isSeries, currentPart, totalParts, start, reset };
}
