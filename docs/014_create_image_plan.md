
now implement new tasks for image generation for the shots (e.g. CREATE_SHOT_IMAGE or some better name) and visual references (e.g. CREATE_VISUAL_REFERENCE_IMAGE or some other better name, you decide).

the tasks take story id as input and do all image generations. should support resume mode from workflow and cli layer etc.
the tasks also support generating individual image by id (e.g. scenelet id and shot index, or character name and index etc). should support this individual mode from both workflow and cli (with some flags).

first should create some underlying gemini client function for the image generation logic.

for now, to keep thigns simple, the generated file is saved to a local file system folder.
- the folder and file name can follow some naming pattern so that it's easy for human to understand:
- e.g. 
  - `<story-id>/shots/<scenelet-id>_<shot-index>.png|jpg|...`
  - `<story-id>/visuals/<character-name>/model_sheet_<sequence_number>.png|jpg|...`
  - or something like that. you should design this naming scheme and document it clearly.
- this folder should be under the ui web app directory because the images need to be served in the web app ui.
    - e.g. `apps/story-tree-ui/[some proper folder name like "assets"? you decide]/<story-id>/shots/...`
- the relative path to the root image folder (not the project root) should be saved to db in the corresponding json.
e.g. 
```
{
    "environment_keyframes":
    [
        {
            "keyframes":
            [
                {
                    "keyframe_description": "Establishing shot, daytime, pre-launch excitement.",
                    "image_generation_prompt": "Environment concept art. Cosmo's Jungle Workshop. An open-air treehouse built high in a jungle canopy, blending nature and scavenged tech. The floor is worn wood, with thick 'Jungle Canopy Green' (#2E7D32) vines woven throughout. Cluttered with tools, monitors, and blueprints. The lighting is warm and welcoming, with dappled sunlight filtering through the leaves, creating shifting patterns of light and shadow. The atmosphere is imaginative and full of potential."
                    "image_path": "<story-id>/[some proper naming convention]/<image-uuid>.<image-ext>"
                }
            ]
        }
    ]
}
```

for visual references, the gemini generation only takes the prompt as input.
for shot image generation, the gemini request need to take:
- system prompt: system_prompts/create_shot_images.md
- user prompt: 
    - the shot image generation prompt
    - upload reference images to gemini (for now, let's do character images only. find from visual references based on character name matching. ERROR if can't find)
    - so that means shot image generation can't happen until visual references image generation is done. do some pre-validation and fail immediately.

code example from gemini for image generation api call. for your reference:
- this is from google aistudio get example code from ui
- upload image (maybe not suitable for this use case. the file is uploaded to google drive in google aistudio ui), and save generated file
- no need to streaming output. just wait and download when complete is totally fine for this use case.
```
// To run this code you need to install the following dependencies:
// npm install @google/genai mime
// npm install -D @types/node

import {
  GoogleGenAI,
} from '@google/genai';
import mime from 'mime';
import { writeFile } from 'fs';

function saveBinaryFile(fileName: string, content: Buffer) {
  writeFile(fileName, content, 'utf8', (err) => {
    if (err) {
      console.error(`Error writing file ${fileName}:`, err);
      return;
    }
    console.log(`File ${fileName} saved to file system.`);
  });
}

async function main() {
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });
  const config = {
    responseModalities: [
        'IMAGE',
        'TEXT',
    ],
    imageConfig: {
      aspectRatio: '16:9',
    },
    systemInstruction: [
        {
          text: `system prompt here...`,
        }
    ],
  };
  const model = 'gemini-2.5-flash-image';
  const contents = [
    {
      role: 'user',
      parts: [
        {
          inlineData: {
            data: `<Drive file: 1NWLxKS_1v5nxSmSgtjsoWoXx97xoABF2>`,
            mimeType: `image/png`,
          },
        },
        {
          text: `user prompt here...`,
        },
      ],
    },
  ];

  const response = await ai.models.generateContentStream({
    model,
    config,
    contents,
  });
  let fileIndex = 0;
  for await (const chunk of response) {
    if (!chunk.candidates || !chunk.candidates[0].content || !chunk.candidates[0].content.parts) {
      continue;
    }
    if (chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData) {
      const fileName = `ENTER_FILE_NAME_${fileIndex++}`;
      const inlineData = chunk.candidates[0].content.parts[0].inlineData;
      const fileExtension = mime.getExtension(inlineData.mimeType || '');
      const buffer = Buffer.from(inlineData.data || '', 'base64');
      saveBinaryFile(`${fileName}.${fileExtension}`, buffer);
    }
    else {
      console.log(chunk.text);
    }
  }
}

main();

```

your task
- research first. find the correct way to do gemini image generation e.g. how to upload and use reference image(s). how to download generated image file. etc.
- expand this doc into a requirements doc + design doc
- let me review first
- do openspec documentation and let me review again
- implementation once i confirm design is ok.