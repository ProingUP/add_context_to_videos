<script lang='ts'>
	import UIContextBubble from "$components/UIContextBubble.svelte";
    import { createMediaPrompts, generateContextDetails, generateContextMoments, generateTranscript, type ContextMoment, type EnrichedContextMoment, type EnrichedContextMomentWithImages, type EnrichedLogicalChunk, type LogicalChunk, type TextContextItem, type TimelinePoint, type TranscriptSegment } from "$lib/api/ai";
	import Loading from "$components/Loading.svelte";
	import { onDestroy, tick } from "svelte";

    type EnrichedChunkWithImage = EnrichedLogicalChunk & {
        imageUrl?: string | null;
        imageStatus?: 'idle' | 'generating' | 'done' | 'error';
        imageError?: string | null;
    };

    // TEST DATA
    const FINAL_TRANSCRIPT = `Do you think the scaling laws are holding strong on, um, there's a lot of ways to describe the scaling laws for AI, but on the pre-training on the post-training fronts. So the flip side of that, do you anticipate AI progress will hit a wall? Is there a wall? You know, it's a cherished micro kitchen conversation. Once in a while I have it, uh, you know, like when Demis is visiting or, you know, if Demis, Cori, Jeff, Noam, Sergey, a bunch of our people, like we sit and, uh, you know, you know, talk about this. Right. And, um, look, I, we see a lot of headroom ahead, right. I think, uh, we've been able to optimize and improve on all fronts, right. Uh, pre-training, post-training, test time, compute, tool use, right over time, making these more agentic. So getting these models to be more general world models in that direction, like VO3, uh, you know, the physics understanding is dramatically better than what VO1 or something like that was. So you kind of see on all those dimensions, I, I feel, you know, progress is very obvious to see, and I feel like there is significant headroom. More importantly, you know, I'm fortunate to work with some of the best researchers on the planet. Right. They think, uh, there is more headroom to be had here. Uh, and so I think we have an exciting trajectory ahead. It's tougher to say, you know, each year I sit and say, okay, we are going to throw 10X more compute over the course of next year at it, and like, will we see progress? Sitting here today, I feel like the year ahead will have a lot of progress. And do you feel any limitations like, uh, that, or the bottlenecks, compute limited, uh, data limited, idea limited, do you feel any of those limitations or is it full steam ahead on all fronts? I think it's compute limited in this sense, right? Like, you know, we can all, part of the reason you've seen us do flash, nano flash and pro models, but not an ultra model. It's like for each generation, we feel like we've been able to get the pro model at like, I don't know, 80, 90% of ultras capability, but ultra would be a lot more, uh, like slow and a lot more expensive to serve. But what we've been able to do is to go to the next generation and make the next generation's pro as good as the previous generation's ultra, but be able to serve it in a way that it's fast and you can use it and so on. So I do think scaling laws are working, but it's tough to get at any given time. The models we all use the most is maybe like a few months behind the maximum capability we can deliver, right? Because that won't be the fastest, easiest to use, et cetera. Also that's in terms of intelligence, it becomes harder and harder to measure, uh, performance in quotes because, you know, you could argue Gemini flash is much more impactful than pro just because of the latency is super intelligent already. I mean, sometimes like latency is, uh, maybe more important than intelligence, especially when the intelligence is just a little bit less and flash not, it's still incredibly smart model. And so you have to now start measuring impact and then it feels like benchmarks are less and less capable of capturing the intelligence of models, the effectiveness of models, the usefulness, the real world usefulness of models.`
    const FINAL_LOGICAL_CHUNKS = [
        {
            segmentEnd: 86,
            segmentStart: 0,
            summary: "Interviewer asks whether AI scaling laws continue to hold and if progress will hit a wall.",
            text: "Do you think the scaling laws are holding strong on, um, there's a lot of ways to describe the scaling laws for AI, but on the pre-training on the post-training fronts. So the flip side of that, do you anticipate AI progress will hit a wall? Is there a wall? You know, it's a cherished micro kitchen conversation. Once in a while I have it, uh, you know, like when Demis is visiting or, you know, if Demis, Cori, Jeff, Noam, Sergey, a bunch of our people, like we sit and, uh, you know, you know, talk about this. Right.",
            title: "Question about scaling laws and potential limits",
        },

        {
            segmentEnd: 214,
            segmentStart: 87,
            summary: "Speaker notes clear progress across pre-training, post-training, test-time, compute, and tool use, and improved world models in newer generations.",
            text: "I think, uh, we've been able to optimize and improve on all fronts, right. Uh, pre-training, post-training, test time, compute, tool use, right over time, making these more agentic. So getting these models to be more general world models in that direction, like VO3, uh, you know, the physics understanding is dramatically better than what VO1 or something like that was. So you kind of see on all those dimensions, I, I feel, you know, progress is very obvious to see, and I feel like there is significant headroom.",
            title: "Observed progress across multiple dimensions",
        },          

        {
            segmentEnd: 354,
            segmentStart: 215,
            summary: "Speaker cites working with top researchers as reason for optimism and expects significant progress in the coming year, while acknowledging uncertainty about exact resource use.",
            text: "More importantly, you know, I'm fortunate to work with some of the best researchers on the planet. Right. They think, uh, there is more headroom to be had here. Uh, and so I think we have an exciting trajectory ahead. It's tougher to say, you know, each year I sit and say, okay, we are going to throw 10X more compute over the course of next year at it, and like, will we see progress? Sitting here today, I feel like the year ahead will have a lot of progress.",
            title: "Confidence due to team expertise and outlook",
        },

        {
            segmentEnd: 529,
            segmentStart: 355,
            summary: "When asked about bottlenecks, the speaker identifies compute as the primary limitation and explains product decisions driven by serving costs and latency.",
            text: "And do you feel any limitations like, uh, that, or the bottlenecks, compute limited, uh, data limited, idea limited, do you feel any of those limitations? Or is it full steam ahead on all fronts? I think it's compute limited in this sense, right? Like, you know, we can all, part of the reason you've seen us do flash, nano flash and pro models, but not an ultra model. It's like for each generation, we feel like we've been able to get the pro model at like, I don't know, 80, 90% of ultras capability, but ultra would be, uh, a lot more, uh, like slow and a lot more expensive to serve.",
            title: "Bottlenecks and compute limitations",
        },

        { 
            segmentEnd: 950,
            segmentStart: 530,
            summary: "Describes strategy of making next-gen pro match prior ultra while being faster and cheaper, and discusses difficulties measuring intelligence and real-world impact versus benchmarks.",
            text: "But what we've been able to do is to go to the next generation and make the next generation's pro as good as the previous generation's ultra, but be able to serve it in a way that it's fast and you can use it and so on. So I do think scaling laws are working, but it's tough to get at any given time. The models we all use the most is maybe like a few months behind the maximum capability we can deliver, right? Because that won't be the fastest, easiest to use, et cetera. Also that's in terms of intelligence, it becomes harder and harder to measure, uh, performance in quotes because, you know, you could argue Gemini flash is much more impactful than pro just because of the latency is super intelligent already. I mean, sometimes like latency is, uh, maybe more important than intelligence, especially when the intelligence is just a little bit less and flash not, it's still incredibly smart model. And so you have to now start measuring impact and then it feels like benchmarks are less and less capable of capturing the intelligence of models, the effectiveness of models, the usefulness, the real world usefulness of models.",
            title: "Strategy of improving generation serving and measurement challenges",
        }
    ];

    const FINAL_ENRICHED_LOGICAL_CHUNKS = [
        {
            segmentEnd: 86,
            segmentStart: 0,
            chunkIndex: 0,
            summary: "Interviewer asks whether AI scaling laws continue to hold and if progress will hit a wall.",
            text: "Do you think the scaling laws are holding strong on, um, there's a lot of ways to describe the scaling laws for AI, but on the pre-training on the post-training fronts. So the flip side of that, do you anticipate AI progress will hit a wall? Is there a wall? You know, it's a cherished micro kitchen conversation. Once in a while I have it, uh, you know, like when Demis is visiting or, you know, if Demis, Cori, Jeff, Noam, Sergey, a bunch of our people, like we sit and, uh, you know, you know, talk about this. Right.",
            title: "Question about scaling laws and potential limits",
            prompt: `A conceptual illustration of a late-night kitchen table conversation among a small group of four anonymous silhouettes (no identifiable faces), leaning in around a laptop and a whiteboard covered in equations and graphs labeled "Scaling Laws?" and "Wall?"; warm domestic lighting, coffee cups, thought bubbles containing tiny neural network diagrams and a brick wall fading into circuit patterns, moody contemplative atmosphere, cinematic depth of field.`
        },

        {
            segmentEnd: 214,
            segmentStart: 87,
            chunkIndex: 1,
            summary: "Speaker notes clear progress across pre-training, post-training, test-time, compute, and tool use, and improved world models in newer generations.",
            text: "I think, uh, we've been able to optimize and improve on all fronts, right. Uh, pre-training, post-training, test time, compute, tool use, right over time, making these more agentic. So getting these models to be more general world models in that direction, like VO3, uh, you know, the physics understanding is dramatically better than what VO1 or something like that was. So you kind of see on all those dimensions, I, I feel, you know, progress is very obvious to see, and I feel like there is significant headroom.",
            title: "Observed progress across multiple dimensions",
            prompt: `A layered infographic showing multiple horizontal tracks labeled: "Pre-training", "Post-training", "Test-time", "Compute", "Tool Use"; each track contains a rising performance curve and small pictograms (data stacks, tuning knobs, stopwatch, GPU, robotic arm); a highlighted vertical \"Generations\" axis with markers VO1 -> VO3 and an inset cutaway of a neural network turning into a simplified 3D world model (physics symbols like falling ball, trajectory lines) to convey improved world understanding.`,
        },          

        {
            segmentEnd: 354,
            segmentStart: 215,
            chunkIndex: 2,
            summary: "Speaker cites working with top researchers as reason for optimism and expects significant progress in the coming year, while acknowledging uncertainty about exact resource use.",
            text: "More importantly, you know, I'm fortunate to work with some of the best researchers on the planet. Right. They think, uh, there is more headroom to be had here. Uh, and so I think we have an exciting trajectory ahead. It's tougher to say, you know, each year I sit and say, okay, we are going to throw 10X more compute over the course of next year at it, and like, will we see progress? Sitting here today, I feel like the year ahead will have a lot of progress.",
            title: "Confidence due to team expertise and outlook",
            prompt: `A team-focused scene: a modern research lab table with three generic researchers (no recognizable faces) gathered around a transparent holographic timeline labeled "Next Year" showing projected compute usage and progress bars; floating annotations like "Top researchers" "Headroom" and a translucent calendar and resource meter; optimistic color palette, dynamic lighting, subtle motion blur implying forward momentum.`,
        },

        {
            segmentEnd: 529,
            segmentStart: 355,
            chunkIndex: 3,
            summary: "When asked about bottlenecks, the speaker identifies compute as the primary limitation and explains product decisions driven by serving costs and latency.",
            text: "And do you feel any limitations like, uh, that, or the bottlenecks, compute limited, uh, data limited, idea limited, do you feel any of those limitations? Or is it full steam ahead on all fronts? I think it's compute limited in this sense, right? Like, you know, we can all, part of the reason you've seen us do flash, nano flash and pro models, but not an ultra model. It's like for each generation, we feel like we've been able to get the pro model at like, I don't know, 80, 90% of ultras capability, but ultra would be, uh, a lot more, uh, like slow and a lot more expensive to serve.",
            title: "Bottlenecks and compute limitations",
            prompt: `A technical diagram titled "Compute Bottleneck and Product Tradeoffs": left side shows a stack of GPUs and a gauge labeled "Compute" near max; center shows branching product options: "Pro" (fast, cheaper, 80–90% capability) vs "Ultra" (slower, expensive, higher capability) with arrows to serving cost and latency icons; right side shows a flowchart of decision factors (serveability, latency, cost) with callouts and simple numeric percentages, clean vector style, muted professional colors.`,
        },

        { 
            segmentEnd: 950,
            segmentStart: 530,
            chunkIndex: 4,
            summary: "Describes strategy of making next-gen pro match prior ultra while being faster and cheaper, and discusses difficulties measuring intelligence and real-world impact versus benchmarks.",
            text: "But what we've been able to do is to go to the next generation and make the next generation's pro as good as the previous generation's ultra, but be able to serve it in a way that it's fast and you can use it and so on. So I do think scaling laws are working, but it's tough to get at any given time. The models we all use the most is maybe like a few months behind the maximum capability we can deliver, right? Because that won't be the fastest, easiest to use, et cetera. Also that's in terms of intelligence, it becomes harder and harder to measure, uh, performance in quotes because, you know, you could argue Gemini flash is much more impactful than pro just because of the latency is super intelligent already. I mean, sometimes like latency is, uh, maybe more important than intelligence, especially when the intelligence is just a little bit less and flash not, it's still incredibly smart model. And so you have to now start measuring impact and then it feels like benchmarks are less and less capable of capturing the intelligence of models, the effectiveness of models, the usefulness, the real world usefulness of models.",
            title: "Strategy of improving generation serving and measurement challenges",
            prompt: `A split-panel visualization: left panel shows two stylized model icons "Previous Ultra" and "Next Gen Pro" with arrows indicating parity in capability but differences in speed (stopwatch icon) and cost (coin stacks); right panel is a conceptual measurement dashboard with degraded benchmark bars, a separate real-world impact meter, and a slider labeled "Latency vs Intelligence" demonstrating how lower latency increases real-world usefulness; annotated, infographic style with emphasis on measurement challenges and practical impact.`
        }
    ]

    let uploadedFile: File | null = $state(null);
    let files: FileList | null = $state(null); // Add this for binding to the input

    async function getAudioFileForTranscription(original: File): Promise<File> {
        // For now, always send to worker.
        // Worker will pass-through audio and extract if video.
        const fd = new FormData();
        fd.append("file", original);

        const res = await fetch("http://localhost:7777/extract-audio", {
            method: "POST",
            body: fd
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Local media worker error (${res.status}): ${text}`);
        }

        const audioBlob = await res.blob();

        // Keep a stable filename for your downstream pipeline.
        // (You can get fancy later by reading Content-Disposition.)
        const audioFile = new File([audioBlob], "audio.mp3", {
            type: audioBlob.type || "audio/mpeg"
        });

        return audioFile;
    }

    let transcribingAudio = $state(false);
    let transcriptText = $state('');
    let transcriptWords = $state<any[]>([]);
    let transcriptionSegments = $state<any[]>([]);
    async function transcribeAudio(file: File): Promise<string | void> {
        if (transcribingAudio) return;
        transcribingAudio = true;

        try {
            const audioFile = await getAudioFileForTranscription(file);
            console.log("audioFile:", audioFile)
            const response = await generateTranscript(audioFile);
    
            if (!response.success) {
                throw new Error('Transcription failed');
            }

            const data = response.data;
            transcriptText = data.text;
            console.log('transcriptText:', transcriptText);
            transcriptWords = data.words;
            console.log('transcriptWords:', transcriptWords);
            transcriptionSegments = data.segments;
            console.log('transcriptionSegments:', transcriptionSegments);
            

            // console.log("transcriptText: ", transcriptText)
            // console.log("transcriptWords: ", transcriptWords)
            // console.log("transcriptionSegments: ", transcriptionSegments)
    
            transcribingAudio = false;
        } catch (error) {
            transcribingAudio = false;
            console.error('Error during transcription:', error);
        }
    }

    let generatingContextMoments = $state(false);
    let contextMoments = $state<ContextMoment[]>([]);
    async function handleGenerateContextMoments(transcript: string): Promise<void> {
        if (generatingContextMoments) return;
        generatingContextMoments = true;

        try {
            // Call your context moments generation API here
            const response = await generateContextMoments(transcript);

            if (!response.success) {
                throw new Error('Context moments generation failed');
            }
        
            const data = response.data;

            console.log('data.contextMoments', data.moments);

            contextMoments = data.moments;

            generatingContextMoments = false;
        } catch (error) {
            generatingContextMoments = false;
            console.error('Error generating context moments:', error);
        }
    }

    let creatingMediaPrompts = $state(false);
    let enrichedChunks = $state<EnrichedChunkWithImage[]>([]);
    async function handleCreateMediaPrompt(generatedTextChunks: LogicalChunk[]): Promise<void> {
        if (creatingMediaPrompts || !generatedTextChunks) return;

        creatingMediaPrompts = true;
        try {
            let response = await createMediaPrompts(generatedTextChunks);

            if (!response.success) {
                throw new Error('Transcription failed');
            }
        
            const data = response.data;

            console.log('data.enrichedChunks', data.enrichedChunks);

            enrichedChunks = data.enrichedChunks;

            creatingMediaPrompts = false;
        } catch (error) {
            creatingMediaPrompts = false;
            console.error('Error creating media prompts:', error);
        }
    }

    let generatingContextDetails = $state(false);
    let enrichedContextMoments = $state<OrderedMoment[]>([]);
    async function handleGenerateContextDetails(
        moments: ContextMoment[],
        transcriptText?: string
    ): Promise<void> {
        if (generatingContextDetails) return;
        if (!moments || moments.length === 0) return;

        generatingContextDetails = true;

        try {
            const response = await generateContextDetails(moments, transcriptText);

            if (!response.success) {
                throw new Error(response.error || 'Context details generation failed');
            }

            const data = response.data;
            console.log('data.enrichedContextMoments', data.moments);

            enrichedContextMoments = data.moments ?? [];
            generatingContextDetails = false;
        } catch (error) {
            generatingContextDetails = false;
            console.error('Error generating context details:', error);
        }
    }


    let handlingEntireFlow = $state(false);
    async function handleEntireFlow(uploadedFile: File | null = null): Promise<void> {
        if (handlingEntireFlow || !uploadedFile) return;

        handlingEntireFlow = true;

        if (files && files.length > 0) {
            uploadedFile = files[0];

            // TEMPORARY
            // transcriptText = FINAL_TRANSCRIPT;
            // generatedTextChunks = FINAL_LOGICAL_CHUNKS;
            // enrichedChunks = FINAL_ENRICHED_LOGICAL_CHUNKS;

            await transcribeAudio(uploadedFile);
            await handleGenerateContextMoments(transcriptText);
            await handleGenerateContextDetails(contextMoments, transcriptText);
            
            // NEW: order them by where the triggerQuote appears in the transcript
            enrichedContextMoments = orderEnrichedMomentsByTranscript(
                enrichedContextMoments,
                transcriptWords,
                { skipNotFound: true } // or false if you want unmatched at the end
            );

            await tick();

            contextTimeline = createContextTimeline(enrichedContextMoments, transcriptWords, {
                durationSec: 14,
                gapSec: 0.5
            });
            console.log("contextTimeline: ", contextTimeline)

            // await sendTimelineToServer(uploadedFile, contextTimeline);


            // await handleGenerateLogicalChunks(transcriptText);
            
            // await handleCreateMediaPrompt(generatedTextChunks);

            // if (enrichedChunks && enrichedChunks.length > 0) {
            //     for (const chunk of enrichedChunks) {
            //         if (!chunk.prompt) continue;

            //         // mark as generating (reactive)
            //         enrichedChunks = enrichedChunks.map((c) =>
            //             c.chunkIndex === chunk.chunkIndex
            //                 ? { ...c, imageStatus: 'generating', imageError: null }
            //                 : c
            //         );

            //         const imageData = await handleGenerateImage(chunk.prompt);

            //         if (imageData?.url) {
            //             enrichedChunks = enrichedChunks.map((c) =>
            //                 c.chunkIndex === chunk.chunkIndex
            //                 ? { ...c, imageUrl: imageData.url, imageStatus: 'done' }
            //                 : c
            //             );
            //         } else {
            //             enrichedChunks = enrichedChunks.map((c) =>
            //                 c.chunkIndex === chunk.chunkIndex
            //                 ? { ...c, imageStatus: 'error', imageError: 'No image returned' }
            //                 : c
            //             );
            //         }
            //     }
            // }

            handlingEntireFlow = false;
        } else {
            console.error('No file selected');
            handlingEntireFlow = false;
        }
    }

    let previewUrl: string | null = $state(null);
    let previewKind: "video" | "audio" | "unknown" = $state("unknown");

    function isProbablyVideo(file: File) {
        // Good enough for preview purposes (don’t use for security decisions)
        if (file.type?.startsWith("video/")) return true;
        const ext = file.name.split(".").pop()?.toLowerCase();
        return ext === "mp4" || ext === "mov" || ext === "webm" || ext === "mkv";
    }

    function isProbablyAudio(file: File) {
        if (file.type?.startsWith("audio/")) return true;
        const ext = file.name.split(".").pop()?.toLowerCase();
        return ext === "mp3" || ext === "m4a" || ext === "wav" || ext === "ogg";
    }

    function setPreviewForFile(file: File | null) {
        // cleanup old preview URL
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        previewUrl = null;
        previewKind = "unknown";

        if (!file) return;

        previewUrl = URL.createObjectURL(file);
        if (isProbablyVideo(file)) previewKind = "video";
        else if (isProbablyAudio(file)) previewKind = "audio";
        else previewKind = "unknown";
    }

    onDestroy(() => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
    });

    function formatImageCredit(img: any): string {
        const bits: string[] = [];
        if (img.source) bits.push(img.source);
        if (img.author) bits.push(`Author: ${img.author}`);
        if (img.licenseShort) bits.push(`License: ${img.licenseShort}`);
        return bits.join(' • ');
    }

    // Helpers for matching triggerQuote inside a segment
    function normalizeForSearch(s: string): string {
        return (s ?? '')
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .replace(/[“”‘’]/g, "'")
            .replace(/[^a-z0-9' ]/g, '') // drop punctuation
            .trim();
    }

    function includesNormalized(haystack: string, needle: string): boolean {
        const h = normalizeForSearch(haystack);
        const n = normalizeForSearch(needle);
        if (!h || !n) return false;
        return h.includes(n);
    }

    function getSegStart(seg: TranscriptSegment): number | null {
        const v = seg.start ?? seg.segmentStart;
        return typeof v === 'number' && Number.isFinite(v) ? v : null;
    }

    // FOR ORDERING ENRICHED MOMENTS TO MATCH TRANSCRIPT FLOW
    type TranscriptIndex = {
        flatTokens: string[];
        tokenToWordIndex: number[]; // flatTokens[i] came from transcriptWords[tokenToWordIndex[i]]
    };

    function buildTranscriptIndex(transcriptWords: TranscriptWord[]): TranscriptIndex {
        const flatTokens: string[] = [];
        const tokenToWordIndex: number[] = [];

        for (let wi = 0; wi < transcriptWords.length; wi++) {
            const raw = getWordText(transcriptWords[wi]);
            const toks = normalizeTranscriptWordToTokens(raw); // you already have this
            for (const t of toks) {
                flatTokens.push(t);
                tokenToWordIndex.push(wi);
            }
        }

        return { flatTokens, tokenToWordIndex };
    }

    function findQuoteInIndex(
        idx: TranscriptIndex,
        transcriptWords: TranscriptWord[],
        quoteTokens: string[],
        startFromWordIndex: number
    ): { matchWordIndex: number; t_start: number } | null {
        if (!quoteTokens.length) return null;
        if (!idx.flatTokens.length) return null;

        // Convert word cursor -> token cursor
        let tokenCursor = 0;
        if (startFromWordIndex > 0) {
            tokenCursor = idx.tokenToWordIndex.findIndex((wi) => wi >= startFromWordIndex);
            if (tokenCursor < 0) tokenCursor = idx.flatTokens.length;
        }

        const first = quoteTokens[0];

        for (let ti = tokenCursor; ti < idx.flatTokens.length; ti++) {
            if (idx.flatTokens[ti] !== first) continue;

            let ok = true;
            for (let j = 1; j < quoteTokens.length; j++) {
            const k = ti + j;
            if (k >= idx.flatTokens.length || idx.flatTokens[k] !== quoteTokens[j]) {
                ok = false;
                break;
            }
            }
            if (!ok) continue;

            const matchWordIndex = idx.tokenToWordIndex[ti];
            const t0 = getWordStartTime(transcriptWords[matchWordIndex]);
            if (t0 == null) return null;

            return { matchWordIndex, t_start: t0 };
        }

        return null;
    }

    type OrderedMoment = EnrichedContextMomentWithImages & {
        startWordIndex: number; // for ordering
        matchFound: boolean;
        matchTimeStart: number | null; // optional debug/use
    };

    /**
     * Compute start word index for each moment and return them ordered by transcript position.
     */
    function orderEnrichedMomentsByTranscript(
        enrichedMoments: EnrichedContextMomentWithImages[],
        transcriptWords: TranscriptWord[],
        opts?: {
            skipNotFound?: boolean; // default false
        }
    ): OrderedMoment[] {
        const skipNotFound = opts?.skipNotFound ?? false;

        if (!enrichedMoments?.length || !transcriptWords?.length) return [];

        const index = buildTranscriptIndex(transcriptWords);

        const located = enrichedMoments.map((m, origIndex) => {
            const quoteRaw = (m.triggerQuote ?? "").trim();
            const quoteTokens = tokenizeQuote(quoteRaw);

            if (!quoteTokens.length) {
                return {
                    ...m,
                    startWordIndex: Number.POSITIVE_INFINITY,
                    matchFound: false,
                    matchTimeStart: null,
                    __origIndex: origIndex
                } as any;
            }

            // IMPORTANT: for ordering, search from the beginning (word 0)
            const found = findQuoteInIndex(index, transcriptWords, quoteTokens, 0);

            if (!found) {
                return {
                        ...m,
                        startWordIndex: Number.POSITIVE_INFINITY,
                        matchFound: false,
                        matchTimeStart: null,
                        __origIndex: origIndex
                    } as any;
            }

            return {
                ...m,
                startWordIndex: found.matchWordIndex,
                matchFound: true,
                matchTimeStart: found.t_start,
                __origIndex: origIndex
            } as any;
        });

        let filtered = located;
        if (skipNotFound) filtered = located.filter((m) => m.matchFound);

        // Stable sort: by startWordIndex then original array order
        filtered.sort((a: any, b: any) => {
            const da = a.startWordIndex;
            const db = b.startWordIndex;
            if (da !== db) return da - db;
            return a.__origIndex - b.__origIndex;
        });

        // Strip helper
        return filtered.map(({ __origIndex, ...rest }: any) => rest);
        }


    // TRANSCRIPT WORDS HELPER FUNCTIONS FOR TIMELINE
    type TranscriptWord = {
        word?: string;      // whisper often uses "word"
        text?: string;      // sometimes "text"
        start?: number;     // seconds
        end?: number;       // seconds
        startTime?: number; // alt
        endTime?: number;   // alt
        };

    // Keep apostrophes, strip everything else punctuation-wise.
    function normalizeTokenKeepApostrophes(raw: string): string {
        return (raw ?? "")
            .toLowerCase()
            .replace(/[“”]/g, '"')
            .replace(/[‘’]/g, "'")
            .replace(/[^a-z0-9'\s]/g, " ")  // drop punctuation but KEEP apostrophes
            .replace(/\s+/g, " ")
            .trim();
    }

    function tokenizeQuote(quote: string): string[] {
        if (!quote) return [];

        // 1) Normalize unicode dashes to a simple hyphen, then turn hyphens into spaces
        // so "test-time" becomes "test time"
        const dashNormalized = quote
            .replace(/[‐-‒–—―]/g, "-") // all common dash chars -> "-"
            .replace(/-/g, " ");      // hyphen -> space

        // 2) Your existing normalization (keeps apostrophes)
        const cleaned = normalizeTokenKeepApostrophes(dashNormalized);
        if (!cleaned) return [];

        return cleaned.split(" ").filter(Boolean);
    }

    function normalizeTranscriptWordToTokens(raw: string): string[] {
        const dashNormalized = (raw ?? "")
            .replace(/[‐-‒–—―]/g, "-")
            .replace(/-/g, " ");

        const cleaned = normalizeTokenKeepApostrophes(dashNormalized);
        if (!cleaned) return [];
        return cleaned.split(" ").filter(Boolean);
    }


    function getWordText(w: TranscriptWord): string {
        // robust across different formats
        return (w.word ?? w.text ?? "").toString();
    }

    function getWordStartTime(w: TranscriptWord): number | null {
        const v =
            w.start ??
            w.startTime ??
            // sometimes timestamps are nested or stringy; be defensive
            (typeof (w as any).timestamp === "number" ? (w as any).timestamp : undefined);

        return typeof v === "number" && Number.isFinite(v) ? v : null;
    }
    
    function findQuoteInWords(
        transcriptWords: TranscriptWord[],
        quoteTokens: string[],
        startFromIndex: number
    ): { matchIndex: number; t_start: number; nextCursor: number } | null {
        if (!quoteTokens.length) return null;
        if (!transcriptWords?.length) return null;

        // Flatten transcript into tokens, but keep mapping back to the original word index
        const flatTokens: string[] = [];
        const tokenToWordIndex: number[] = [];

        for (let wi = 0; wi < transcriptWords.length; wi++) {
            const raw = getWordText(transcriptWords[wi]);
            const toks = normalizeTranscriptWordToTokens(raw);
            for (const t of toks) {
                flatTokens.push(t);
                tokenToWordIndex.push(wi);
            }
        }

        // Convert "wordCursor" (word index) into a token cursor
        let tokenCursor = 0;
        if (startFromIndex > 0) {
            // find first token whose mapped word index >= startFromIndex
            tokenCursor = tokenToWordIndex.findIndex((wi) => wi >= startFromIndex);
            if (tokenCursor < 0) tokenCursor = flatTokens.length;
        }

        const first = quoteTokens[0];

        for (let ti = Math.max(0, tokenCursor); ti < flatTokens.length; ti++) {
            if (flatTokens[ti] !== first) continue;

            let ok = true;
            for (let j = 1; j < quoteTokens.length; j++) {
                const idx = ti + j;
                if (idx >= flatTokens.length || flatTokens[idx] !== quoteTokens[j]) {
                    ok = false;
                    break;
                }
            }
            if (!ok) continue;

            // Timestamp should come from the FIRST underlying transcript "word" that contributed tokens
            const matchedWordIndex = tokenToWordIndex[ti];
            const t0 = getWordStartTime(transcriptWords[matchedWordIndex]);
            if (t0 == null) return null;

            // next cursor should advance past the last matched token's underlying word index
            const lastMatchedWordIndex = tokenToWordIndex[ti + quoteTokens.length - 1];
            const nextCursor = lastMatchedWordIndex + 1;

            return {
                matchIndex: matchedWordIndex,
                t_start: t0,
                nextCursor
            };
        }

        return null;
    }





    type TimelinePoint = {
        momentIndex: number;
        segmentIndex: number;
        triggerQuote: string;
        title: string;
        importance: number;
        visual: any;
        visualQuery: string | null;
        context: string;

        t_start: number;
        t_end: number;
    };    
    let creatingContextTimeline = $state(false);
    let contextTimeline = $state<any>(null);
    function createContextTimeline(
        enrichedMoments: EnrichedContextMomentWithImages[],
        transcriptWords: TranscriptWord[],
        opts?: {
            durationSec?: number; // bubble length (default 10)
            gapSec?: number;      // minimum gap when bumping (default 0.5)
            allowSkipIfNotFound?: boolean; // default true
        }
    ): TimelinePoint[] {
        const durationSec = opts?.durationSec ?? 10;
        const gapSec = opts?.gapSec ?? 0.5;
        const allowSkipIfNotFound = opts?.allowSkipIfNotFound ?? true;

        console.log("inside createContextTimeline - enrichedMoments:", enrichedMoments);
        console.log("inside createContextTimeline - transcriptWords:", transcriptWords);

        if (!enrichedMoments?.length || !transcriptWords?.length) return [];

        const timeline: TimelinePoint[] = [];
        let wordCursor = 0;

        for (let mi = 0; mi < enrichedMoments.length; mi++) {
            const m = enrichedMoments[mi];
            const quoteRaw = (m.triggerQuote ?? "").trim();
            if (!quoteRaw) continue;

            const quoteTokens = tokenizeQuote(quoteRaw);
            if (!quoteTokens.length) continue;

            const startFrom = (m as any).startWordIndex ?? wordCursor;
            const found = findQuoteInWords(transcriptWords, quoteTokens, startFrom);

            if (!found) {
            console.log("No word-level match for:", quoteRaw);
            if (allowSkipIfNotFound) continue;

            // Forced fallback: place it after previous bubble end (or 0)
            const fallbackStart = timeline.at(-1)?.t_end ?? 0;
            let t_start = fallbackStart;
            let t_end = t_start + durationSec;

            const prev = timeline.at(-1);
            if (prev && t_start < prev.t_end) {
                t_start = prev.t_end + gapSec;
                t_end = t_start + durationSec;
            }

            timeline.push({
                momentIndex: mi,
                segmentIndex: -1, // not segment-based anymore
                triggerQuote: m.triggerQuote,
                title: m.title,
                importance: m.importance,
                visual: m.visual,
                visualQuery: m.visualQuery ?? null,
                context: m.context,
                t_start,
                t_end
            });

            continue;
            }

            // Advance cursor so later matches occur after earlier ones
            wordCursor = found.nextCursor;

            // 2) Compute window
            let t_start = found.t_start;
            let t_end = t_start + durationSec;

            // 3) Avoid overlap
            const prev = timeline.at(-1);
            if (prev && t_start < prev.t_end) {
            t_start = prev.t_end + gapSec;
            t_end = t_start + durationSec;
            }

            timeline.push({
            momentIndex: mi,
            segmentIndex: -1, // we’re word-indexing now
            triggerQuote: m.triggerQuote,
            title: m.title,
            importance: m.importance,
            visual: m.visual,
            visualQuery: m.visualQuery ?? null,
            context: m.context,
            t_start,
            t_end
            });
        }

        return timeline;
    }

    let processingVideo = $state(false);
    let processingVideoError = $state<string | null>(null);

    // If your server returns a processed video blob:
    let processedVideoUrl = $state<string | null>(null);

    // If your server returns a JSON with { url: "..." }:
    let processedVideoRemoteUrl = $state<string | null>(null);

    onDestroy(() => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        if (processedVideoUrl) URL.revokeObjectURL(processedVideoUrl);
    });
    
    async function sendTimelineToServer(
        originalFile: File,
        timeline: TimelinePoint[]
    ): Promise<void> {
        if (!originalFile) throw new Error("Missing video/audio file");
        if (!timeline?.length) throw new Error("Timeline is empty");

        processingVideo = true;
        processingVideoError = null;

        // clear previous output
        if (processedVideoUrl) {
            URL.revokeObjectURL(processedVideoUrl);
            processedVideoUrl = null;
        }
        processedVideoRemoteUrl = null;

        try {
            const fd = new FormData();

            // Send original file (video or audio)
            fd.append("file", originalFile);

            // Send timeline as JSON text
            fd.append("timeline", JSON.stringify(timeline));

            // Optional: include settings your ffmpeg pipeline might want
            // fd.append("opts", JSON.stringify({ fontSize: 28, bubbleWidth: 800 }));

            const res = await fetch("http://localhost:7777/render-context-bubbles", {
                method: "POST",
                body: fd
            });

            if (!res.ok) {
                const txt = await res.text().catch(() => "");
                throw new Error(`Server error (${res.status}): ${txt || "unknown error"}`);
            }

            // ---- Choose ONE of these patterns depending on what your server returns ----

            // Pattern A) Server returns a VIDEO FILE (recommended for localhost dev)
            const contentType = res.headers.get("content-type") || "";
            if (contentType.includes("video/") || contentType.includes("application/octet-stream")) {
                const blob = await res.blob();
                processedVideoUrl = URL.createObjectURL(blob);
                return;
            }

            // Pattern B) Server returns JSON like { url: "http://..." }
            const data = await res.json();
            if (data?.url) {
                processedVideoRemoteUrl = data.url;
                return;
            }

            throw new Error("Server response did not include a video blob or a url");
        } catch (err: any) {
            processingVideoError = err?.message ?? "Failed to process video";
            console.error("sendTimelineToServer error:", err);
        } finally {
            processingVideo = false;
        }
    }


    // --- Video overlay preview state ---
    let videoEl: HTMLVideoElement | null = $state(null);
    let currentTimeSec = $state(0);

    // which boxes should be visible right now
    let activeTimelinePoints = $state<TimelinePoint[]>([]);
    // optional: for smooth showing/hiding
    const OVERLAY_FADE_MS = 180;

    // fast lookup helper
    function computeActivePoints(t: number, timeline: TimelinePoint[]): TimelinePoint[] {
        if (!timeline?.length) return [];
        // show any timeline point whose window contains current time
        return timeline.filter((p) => t >= p.t_start && t <= p.t_end);
    }

    // called on time updates / seeking
    function syncActiveBoxes() {
        if (!videoEl) return;
        currentTimeSec = videoEl.currentTime ?? 0;
        activeTimelinePoints = computeActivePoints(currentTimeSec, contextTimeline ?? []);
    }



</script>

<div class=''>
    <h1 class='font-bold text-2xl'>Podcast Context / Visualizer</h1>
</div>

<div>
    <input
        type="file"
        bind:files
        accept=".mp3,.m4a,.wav,.ogg,.mp4,.mov,.webm"
        class='border rounded p-2 mt-4'
        onchange={() => setPreviewForFile(files?.[0] ?? null)}
    />
</div>

{#if previewUrl && previewKind === "video"}
    <div class="mt-4">
        <div class="text-sm font-semibold opacity-80 mb-2">Video preview</div>

        <div class="relative w-full max-w-5xl mx-auto">
        <video
            bind:this={videoEl}
            class="w-full rounded border"
            src={previewUrl}
            controls
            playsinline
            preload="metadata"
            ontimeupdate={syncActiveBoxes}
            onseeked={syncActiveBoxes}
            onloadedmetadata={syncActiveBoxes}
            onplay={syncActiveBoxes}
        />

        <!-- Overlay layer -->
        {#if activeTimelinePoints && activeTimelinePoints.length > 0}
            <div class="pointer-events-none absolute inset-0">
            <div class="absolute left-0 right-0 bottom-10 px-4">
                {#each activeTimelinePoints as p (p.momentIndex + '|' + p.t_start)}
                    <UIContextBubble {p} />
                {/each}
            </div>
            </div>
        {/if}
        </div>

        {#if contextTimeline?.length}
        <div class="mt-2 text-xs opacity-70">
            t = {currentTimeSec.toFixed(2)}s • active: {activeTimelinePoints.length}
        </div>
        {/if}
    </div>
{:else if previewUrl && previewKind === "audio"}
    <div class="mt-4">
        <div class="text-sm font-semibold opacity-80 mb-2">Audio preview</div>
        <audio class="w-full max-w-2xl" src={previewUrl} controls preload="metadata" />
    </div>
{/if}

<!-- Button -->
<div class='flex flex-col'>
    {#if transcribingAudio}
        <div>
            <Loading />
            <div>
                <span>Transcribing...</span>
            </div>
        </div>
    {:else}
        <div class='flex flex-col mt-2'>
            <div class={[
                'w-min px-2 py-1 border-2 border-blue-700 rounded-lg bg-blue-300',
                (!files || files.length <= 0) && 'opacity-50',
                files && files.length <= 0 && 'opacity-50'
            ]}>
                <span
                    onclick={async () => { 
                        if (files && files.length > 0) {
                            uploadedFile = files[0];
                            await handleEntireFlow(uploadedFile);
                        } else {
                            console.error('No file selected');
                        }
                    }}
                    class='cursor-pointer text-nowrap'
                >Run Entire Flow</span>
            </div>
        </div>

        {#if transcriptText}
            <div>
                <span>{transcriptText}</span>
            </div>
        {/if}
    {/if}

    <!-- Context Moments -->
    {#if generatingContextMoments}
        <div class="mt-6">
            <Loading />
            <div>
                <span>Finding context moments...</span>
            </div>
        </div>
    {:else if contextMoments && contextMoments.length > 0}
        <div class="mt-6">
            <h2 class="font-bold text-xl mt-4">Context Moments (candidates)</h2>

            {#each contextMoments as m, index}
                <div class="border p-3 my-3 rounded">
                <div class="flex items-center justify-between">
                    <h3 class="font-semibold">Moment {index + 1}</h3>

                    <div class="text-xs opacity-70 flex items-center gap-2">
                    <span class="px-2 py-0.5 border rounded">
                        {m.importance}
                    </span>

                    {#if m.segmentStart != null || m.segmentEnd != null}
                        <span>
                        Segments: {m.segmentStart ?? '—'}–{m.segmentEnd ?? '—'}
                        </span>
                    {/if}
                    </div>
                </div>

                <div class="mt-2">
                    <div class="text-sm font-semibold opacity-80">Title</div>
                    <div>{m.title}</div>
                </div>

                <div class="mt-2">
                    <div class="text-sm font-semibold opacity-80">Trigger Quote</div>
                    <p class="whitespace-pre-wrap">"{m.triggerQuote}"</p>
                </div>
                </div>
            {/each}
        </div>
    {/if}

    <!-- Enriched Context Details -->
    {#if generatingContextDetails}
        <div class="mt-6">
            <Loading />
            <div>
                <span>Generating context explanations...</span>
            </div>
        </div>
    {:else if enrichedContextMoments && enrichedContextMoments.length > 0}
        <div class="mt-6">
            <h2 class="font-bold text-xl mt-4">Context Details (enriched)</h2>

            {#each enrichedContextMoments as m, index}
                <div class="border p-3 my-3 rounded">
                    <div class="flex items-center justify-between">
                        <h3 class="font-semibold">Context {index + 1}</h3>

                        <div class="text-xs opacity-70 flex items-center gap-2">
                        <span class="px-2 py-0.5 border rounded">
                            {m.importance}
                        </span>

                        {#if m.segmentStart != null || m.segmentEnd != null}
                            <span>
                            Segments: {m.segmentStart ?? '—'}–{m.segmentEnd ?? '—'}
                            </span>
                        {/if}
                        </div>
                    </div>

                    <div class="mt-2">
                        <div class="text-sm font-semibold opacity-80">Title</div>
                        <div>{m.title}</div>
                    </div>

                    <div class="mt-2">
                        <div class="text-sm font-semibold opacity-80">Trigger Quote</div>
                        <p class="whitespace-pre-wrap">"{m.triggerQuote}"</p>
                    </div>

                    <!-- <div class="mt-3 border-t pt-3">
                        <div class="text-sm font-semibold opacity-80">Explanation</div>
                        <p class="whitespace-pre-wrap">{m.context}</p>
                    </div> -->
                    <div class="mt-3 border-t pt-3">
                        <div class="text-sm font-semibold opacity-80">Explanation</div>
                        <p class="whitespace-pre-wrap">{m.context}</p>
                        
                        {#if m.images && m.images.length > 0}
                            <div class="mt-4">
                            <div class="text-sm font-semibold opacity-80">Related images</div>
                        
                            <div class="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {#each m.images as img (img.pageUrl + '|' + img.imageUrl)}
                                    <div class="rounded border overflow-hidden">
                                        <a
                                            href={img.pageUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            class="block"
                                            title="Open source page (Wikimedia Commons)"
                                        >
                                            <img
                                                src={img.imageUrl}
                                                alt={img.title ?? 'Related image'}
                                                class="w-full h-48 object-cover"
                                                loading="lazy"
                                            />
                                        </a>
                            
                                        <div class="p-2 text-xs opacity-80 space-y-1">
                                            <div class="font-semibold truncate">{img.title}</div>
                                
                                            {#if img.attribution}
                                                <div class="opacity-90 whitespace-pre-wrap break-words">
                                                    {img.attribution}
                                                </div>
                                            {/if}
                                
                                            <div class="opacity-70">
                                                {#if formatImageCredit(img)}
                                                    <div class="opacity-70">
                                                        {formatImageCredit(img)}
                                                    </div>
                                                {/if}
                                            </div>
                                
                                            <div class="flex flex-wrap gap-2 pt-1">
                                                <a
                                                href={img.pageUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                class="underline opacity-80 hover:opacity-100"
                                                >
                                                Source
                                                </a>
                                
                                                {#if img.licenseUrl}
                                                <a
                                                    href={img.licenseUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    class="underline opacity-80 hover:opacity-100"
                                                >
                                                    License
                                                </a>
                                                {/if}
                                            </div>
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        
                            <div class="mt-2 text-[11px] opacity-60">
                                Images are pulled from Wikimedia Commons and may have different licenses. Use the Source/License links for details.
                            </div>
                            </div>
                        {/if}
                    </div>
                </div>
            {/each}
        </div>
    {/if}

    {#if processingVideo}
        <div class="mt-6">
            <Loading />
            <div class="mt-2">
            <span>Processing video...</span>
            </div>
        </div>
    {:else if processingVideoError}
        <div class="mt-6 text-red-700">
            Failed processing video: {processingVideoError}
        </div>
    {/if}

    {#if processedVideoUrl}
        <div class="mt-6">
            <div class="text-sm font-semibold opacity-80 mb-2">Processed output</div>
            <video
                class="w-full max-w-2xl rounded border"
                src={processedVideoUrl}
                controls
                playsinline
            />
        </div>
    {/if}


</div>