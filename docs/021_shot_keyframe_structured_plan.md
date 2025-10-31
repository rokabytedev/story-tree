problem
- during shot production, the generated prompt loses some fidality from the original shot storyboard artifacts.
- use the storyboard artifacts from the shot directly solves this problem

goal
- change the shot key frame image generation to use a different prompt method
- deprecate the "key_frame_prompt". use the following method to assemble the prompt
- don't touch first frame image generation or video prompt, don't remove the key frame prompt or something even it's not used any more.

key frame prompt method
- the prompt will consist of the following parts
    - from visual design document:
        - global_aesthetic
            - include every field in visual_style
            - include every field in master_color_palette
        - character_designs and environment_designs
            - but look at the referencedDesigns from the shot's storyboard_payload
            - only include the character design(s) and environment design(s) that are referenced in referencedDesigns field. remove anything else.
    - from `shots` table, the row of this current shot whose image is being generated:
        - the entirety of the storyboard_payload field
        - but remove the `dialogue` (including it will accidentally generate caption in the image sometimes)

below is an example of the final assembled prompt to gemini.
```json
// Context for the image generation:
{
  "global_aesthetic": {
    "visual_style": {
      "name": "Vibrant Storybook Animation",
      "description": "The style is a clean, bright, and friendly 2D animation reminiscent of a modern, high-quality children's storybook brought to life. Character designs feature soft, rounded shapes, simple yet highly expressive facial features, and no harsh angles. Line work is clean and consistent in weight, with a subtle, organic feel. Backgrounds are rich and painterly, layered with soft textures to give a sense of depth and wonder, while technology and spacecrafts have a sleek, friendly, and slightly chunky 'toyetic' feel. The overall impression is one of warmth, optimism, and boundless curiosity, making complex scientific concepts feel accessible and exciting."
    },
    "master_color_palette": [
      {
        "hex_code": "#0A1931",
        "color_name": "Cosmic Blue",
        "usage_notes": "The primary color for deep space. It's a dark, rich blue, not a flat black, allowing for depth and subtle gradients to suggest the vastness of the cosmos."
      },
      {
        "hex_code": "#2E8B57",
        "color_name": "Jungle Green",
        "usage_notes": "Represents the lush, vibrant life of Cosmo's home jungle. Used for canopy leaves and natural elements in his workshop, symbolizing his connection to nature."
      },
      {
        "hex_code": "#C0C0C0",
        "color_name": "Starship Silver",
        "usage_notes": "The main color for The Stardust Cruiser and Cosmo's jumpsuit. It's a clean, bright silver with soft highlights, representing technology, optimism, and adventure."
      },
      {
        "hex_code": "#00FFFF",
        "color_name": "A.I.D.A. Cyan",
        "usage_notes": "The signature color for A.I.D.A.'s holographic interface, text, and visual presence. It evokes intelligence, clarity, and friendly, helpful technology."
      },
      {
        "hex_code": "#D35400",
        "color_name": "Martian Rust",
        "usage_notes": "The dominant color for the planet Mars, representing its iron-oxide surface. It's a warm, dusty orange-red, creating a sense of ancient, alien desert landscapes."
      },
      {
        "hex_code": "#E67E22",
        "color_name": "Jupiter Swirl Orange",
        "usage_notes": "A primary color in Jupiter's swirling cloud bands and the Great Red Spot. It conveys the immense, chaotic energy of the gas giant."
      },
      {
        "hex_code": "#F1C40F",
        "color_name": "Curiosity Yellow",
        "usage_notes": "An accent color used for lights on Cosmo's dashboard, highlights on his rocket, and important icons. It signifies discovery, energy, and his bright ideas."
      }
    ]
  },
  "character_designs": [
    {
      "role": "Main Character",
      "character_id": "cosmo",
      "detailed_description": {
        "attire": "He wears a one-piece, retro-futuristic silver jumpsuit made of a sleek, slightly padded material (#C0C0C0). It has a soft, dark grey collar and cuffs. On the left shoulder is a circular mission patch depicting a stylized rocket circling a ringed planet. When in space, he wears a perfectly spherical, clear glass helmet with a silver base that seals seamlessly to his suit's collar.",
        "physique": "Small and nimble, with a build typical of a curious young monkey. His proportions are slightly stylized for appeal: a slightly larger head and hands than realistic, emphasizing his intelligence and hands-on nature. His posture is energetic and alert, often leaning forward with excitement. He has a long, prehensile tail that he uses for balance and to express emotion.",
        "facial_features": "Cosmo is a young capuchin monkey. His face is framed with light beige fur, while the fur on the top of his head is a warm, friendly brown. His eyes are very large, round, and a deep, expressive chocolate brown (#4A2C2A), with large white pupils that dilate and constrict to show emotion. He has a small, simple black nose and a wide, highly expressive mouth that forms easy smiles and looks of wonder. He has large, rounded ears that are slightly darker than his facial fur."
      },
    },
    {
      "role": "Supporting Character",
      "character_id": "a-i-d-a",
      "detailed_description": {
        "attire": "N/A. Her visual form is her 'attire'. The cyan orb is semi-transparent with a brighter core, and it emits a gentle, friendly glow that illuminates the cockpit.",
        "physique": "N/A. A.I.D.A.'s presence is represented through light and sound. Her primary visual form is a soft, glowing orb of 'A.I.D.A. Cyan' (#00FFFF) light that materializes from a holographic projector in the center of the cockpit. When she speaks, concentric circles of light gently pulse from the orb. Her voice is also visualized on monitors as a clean, flowing cyan soundwave.",
        "facial_features": "N/A. A.I.D.A. is a non-corporeal AI and has no physical face."
      },
    }
  ],
  "environment_designs": [
    {
      "environment_id": "cosmos-jungle-workshop",
      "detailed_description": {
        "color_tones": "Dominated by 'Jungle Green' (#2E8B57) and warm wood browns. This is contrasted sharply by the high-tech glow of 'A.I.D.A. Cyan' (#00FFFF) on the screens and the 'Starship Silver' (#C0C0C0) of the rocket.",
        "key_elements": "The bottle-shaped 'Stardust Cruiser' rocket, multiple flickering computer monitors with green and cyan readouts, a large corkboard covered in spaceship designs and star maps, vines with glowing bioluminescent flowers providing natural light, a telescope made from a cardboard tube and scavenged lenses pointing out at the sky.",
        "overall_description": "A sprawling, open-air treehouse workshop built high in the jungle canopy. It's a whimsical fusion of nature and scavenged technology. The structure is made from bamboo and sturdy planks of wood, with thick, green jungle vines interwoven throughout. The Stardust Cruiser sits on a central launchpad, surrounded by workbenches cluttered with wires, spare parts, and monitors displaying star charts.",
        "lighting_and_atmosphere": "Warm, inviting, and magical. During the day (scenelet-1), dappled sunlight filters through the leaves, creating moving patterns on the floor. In the evening (scenelet-34, 49), the workshop is lit by the soft glow of monitors and the twinkling bioluminescent flowers, creating a cozy and inspiring atmosphere."
      },
    },
    {
      "environment_id": "the-stardust-cruiser-cockpit",
      "detailed_description": {
        "color_tones": "The interior is primarily neutral greys and 'Starship Silver', allowing the external environment and the colorful glows from the console ('A.I.D.A. Cyan', 'Curiosity Yellow') to provide the dominant mood and color.",
        "key_elements": "A large, main bubble-viewport offering a panoramic view of space. A central holographic projector for A.I.D.A. and star maps. A dashboard with large, friendly, colorful buttons and levers. A small photo of Olympus Mons or Jupiter is pinned to the dashboard in some terminal scenes. A deployable 'super-telescope' lens array that unfolds from the ceiling.",
        "overall_description": "The interior of the Stardust Cruiser is cozy, functional, and clearly built by Cosmo. It's a single, small, spherical room with a large, bubble-like viewport at the front. The walls are padded with a light grey, insulated material. Wires are neatly bundled and run along the curved walls. The captain's chair is a repurposed bucket seat.",
        "lighting_and_atmosphere": "The lighting is almost entirely diegetic, coming from the soft glow of dashboard screens ('A.I.D.A. Cyan' and 'Curiosity Yellow'), A.I.D.A.'s holographic form, and the external light from stars and nearby planets filtering through the main viewport. The mood shifts from exciting and awe-inspiring to tense during hazardous navigation."
      },
    },
  ]
},
// Image generation instruction:
{
  "cameraDynamics": "Static shot.",
  "continuityNotes": "This is the first shot, establishing the location and the relationship between Cosmo, his workshop, and the ship.",
  "framingAndAngle": "Wide Establishing Shot, eye-level.",
  "referencedDesigns": {
    "characters": [
      "cosmo",
      "a-i-d-a"
    ],
    "environments": [
      "cosmos-jungle-workshop",
      "the-stardust-cruiser-cockpit"
    ]
  },
  "compositionAndContent": "The sprawling jungle workshop fills the frame, establishing the blend of nature and scavenged tech. The magnificent, bottle-shaped Stardust Cruiser is the central focus, gleaming under dappled sunlight. Cosmo, a small figure, is visible beside it, making a final adjustment. Vines and wires hang from the banyan tree canopy above. Monitors flicker in the background.",
  "lightingAndAtmosphere": "The mood is creative and full of potential. Warm, dappled sunlight filters through the lush green leaves, creating moving patterns of light and shadow on the workshop floor and the silver rocket.",
  "characterActionAndEmotion": "Cosmo is focused on his work, a tiny figure full of purpose. His body language shows concentration."
}
```

requirements
- the only thing we're proposing to change here is the prompt used to generate the **key frame image** of a shot
- don't change the other images / video
- don't change the gemini client config etc.
- still upload the same reference images as before (the referenced designs)

your task
- expand this doc into detailed openspec spec doc + design doc + other docs
    - make sure the tasks doc has checklist
    - tasks should be batched into major milestones
    - tasks do not include manual verification or integration test etc.
- let me review first
- implementation once i confirm design is ok.