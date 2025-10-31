## goal
- create a new task for audio speech generation
- this audio will be used with the preview image to form a "live" preview (or you can think of it as a voice storybook)
- handle all layers needed: db storage, task, workflow, cli etc.

## db storage
- add a new column to `shots` table to store the audio file path

## the task, workflow, cli etc
the task should support the modes:
- default: stop if any audio file path already exists in db for any shot of the story.
- resume: to continue with the rest of the shots without audio file path in db.
- override: regenerate every shot no matter if audio file path pre-exists.

- batch mode: generate audio for all shots of a story
- single mode: generate only for one shot, identified by scenelet_id and shot_index.

for cli, reuse existing flags (e.g. --resume, --override), don't invent new flag.
for --override flag, since it's a bool flag, don't require: `--override true` (current behavior), just `--override` should be enough.

## gemini api
reference doc: https://ai.google.dev/gemini-api/docs/speech-generation

gemini speech generation api supports two modes:
- single-speaker
- multi-speaker (only support two speakers for now)

for our case, if the shot has one speaker, use single speaker mode. if the shot has two speakers, use multi-speaker mode. if there are three speakers, report a validation error for now.
note that we're talking about the number of speakers, not the number of lines. there could be multiple lines belong to the same speaker.

example for your reference:

- single-speaker
```javascript
import {GoogleGenAI} from '@google/genai';
import wav from 'wav';

async function saveWaveFile(
   filename,
   pcmData,
   channels = 1,
   rate = 24000,
   sampleWidth = 2,
) {
   return new Promise((resolve, reject) => {
      const writer = new wav.FileWriter(filename, {
            channels,
            sampleRate: rate,
            bitDepth: sampleWidth * 8,
      });

      writer.on('finish', resolve);
      writer.on('error', reject);

      writer.write(pcmData);
      writer.end();
   });
}

async function main() {
   const ai = new GoogleGenAI({});

   const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: 'Say cheerfully: Have a wonderful day!' }] }],
      config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
               voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: 'Kore' },
               },
            },
      },
   });

   const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
   const audioBuffer = Buffer.from(data, 'base64');

   const fileName = 'out.wav';
   await saveWaveFile(fileName, audioBuffer);
}
await main();
```

- multi-speaker
```javascript
import {GoogleGenAI} from '@google/genai';
import wav from 'wav';

async function saveWaveFile(
   filename,
   pcmData,
   channels = 1,
   rate = 24000,
   sampleWidth = 2,
) {
   return new Promise((resolve, reject) => {
      const writer = new wav.FileWriter(filename, {
            channels,
            sampleRate: rate,
            bitDepth: sampleWidth * 8,
      });

      writer.on('finish', resolve);
      writer.on('error', reject);

      writer.write(pcmData);
      writer.end();
   });
}

async function main() {
   const ai = new GoogleGenAI({});

   const prompt = `TTS the following conversation between Joe and Jane:
         Joe: How's it going today Jane?
         Jane: Not too bad, how about you?`;

   const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
               multiSpeakerVoiceConfig: {
                  speakerVoiceConfigs: [
                        {
                           speaker: 'Joe',
                           voiceConfig: {
                              prebuiltVoiceConfig: { voiceName: 'Kore' }
                           }
                        },
                        {
                           speaker: 'Jane',
                           voiceConfig: {
                              prebuiltVoiceConfig: { voiceName: 'Puck' }
                           }
                        }
                  ]
               }
            }
      }
   });

   const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
   const audioBuffer = Buffer.from(data, 'base64');

   const fileName = 'out.wav';
   await saveWaveFile(fileName, audioBuffer);
}

await main();
```

## prompt
the prompt sent to gemini api should be assembled with the following data:
- the entirety of the `character_voice_profiles[]` json array, filter to keep only the characters that is in the shot (to avoid confusing ai model with unnecessary information)
- if there is line for narrator, include the `narrator_voice_profile` field in its entirety.
- the shot's `storyboard_payload.audioAndNarrative[]` in its entirety.

## speaker config
for each speaker, need to config two things:
- the speaker name: use the character-id that matches the value in the `audioAndNarrative.source` field. this is very important. must be exact match.
- the voice config voice name. this should come from the story's audio design document. use the character-id to match the `character_voice_profiles[].character_id` field and then use the `character_voice_profiles[].voice_name` as the exact value for `prebuiltVoiceConfig: { voiceName: '<voice_name>' }`.
- for narrator, find its value from the special `narrator_voice_profile` field in audio_design_document.

## audio file
- for audio file will be saved and served from local file system
- path will be something like `apps/story-tree-ui/public/generated/<story-id>>/shots/<scenelet-id>/<shot-index>_audio.wav`
- audio file format will be wave (or is there better format for web app serving (smaller, faster etc)? that is also supported? you can design. but low priority if hard)
