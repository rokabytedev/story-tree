problem
- during shot production, the generated prompt loses some fidality from the original shot storyboard artifacts.
- use the storyboard artifacts from the shot directly solves this problem

goal
- change the shot image generation to use a different prompt method (direct assembly, no more "middleman" prompt)
- deprecate all the generation prompts: first_frame_prompt, key_frame_prompt, video_clip_prompt.
- my new intent is to have only two assets generated for each shot:
    - a key frame image - served as a "preview" of the video clip for this shot
    - the video clip for this shot
    - (no more "first frame")
- use the following method to assemble the prompt.

shot production format change
- i already changed the shot generation system prompt (system_prompts/create_shot_production.md).
- the new system prompt will instruct gemini to generate a different format of output json.
- no more generation prompts. the storyboard_entry will have more fields that need to be persisted to db (the entirety of storyboard_entry field should be persisted to the existing shots table column storyboard_payload), and used for image/video generation.
- read the new system_prompts/create_shot_production.md file to understand the new structure.
- make code change to adapt to this new output structure.
- deprecate the generation prompts related code logic, db schema, etc.

new prompt method for key frame image generation:
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
        - but remove the `audio_and_narrative` (including it will accidentally generate caption in the image sometimes)

video generation prompt is out of scope for now.

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
    "referenced_designs": {
        "characters": [
            "char-id-elara"
        ],
        "environments": [
            "env-id-crystal-caves"
        ]
    },
    "framing_and_angle": "Intimate Medium Close-Up (MCU) from a direct Eye-Level Angle, creating a direct emotional connection with the character and her discovery.",
    "composition_and_content": "Elara is framed from the chest up, positioned on the right vertical third of the frame, with her dominant eye perfectly aligned with the upper-right rule-of-thirds intersection. FOREGROUND: A massive, out-of-focus, deep sapphire blue crystal juts into the frame from the bottom-left, creating a natural frame element and enhancing depth. MIDGROUND: Elara herself is the sharp focus. The intricate silver embroidery on the collar of her tunic is clearly visible, and individual strands of her luminescent hair catch the ambient light. BACKGROUND: The cavern wall is a soft-focus tapestry of glowing crystal veins in hues of amethyst and soft magenta, creating a dazzling, natural bokeh effect of overlapping circles of light. ATMOSPHERIC ELEMENTS: Tiny, shimmering motes of magical dust drift lazily in the air between the camera and Elara, catching the light.",
    "character_action_and_emotion": "Elara's expression is one of pure, unadulterated awe. Her eyes are wide, reflecting the crystal light, her pupils slightly dilated. Her lips are parted in a soft, breathless 'o' of wonder. Her posture is frozen as she slowly, almost reverently, lifts her right hand into the frame, palm open, fingers slightly curled, as if to touch something incredibly fragile just beyond the camera's view.",
    "camera_dynamics": "Perfectly static shot on a tripod. The lack of movement emphasizes the stillness and reverence of the moment, allowing the audience to soak in the beauty of the scene and Elara's profound reaction.",
    "lighting_and_atmosphere": "The lighting is exclusively diegetic and low-key, sourced from the glowing crystals. The key light is a soft, cool blue-violet glow from off-screen left, sculpting one side of Elara's face. The fill light is a gentler, warm magenta from the background, preventing shadows from being completely black and adding color depth. The atmosphere is magical, serene, and charged with latent energy.",
    "continuity_notes": "This shot establishes Elara's POV for the next shot, which will be a reveal of the Heart Crystal she is looking at. Her hand position and gaze direction (screen-left) must be matched precisely in the subsequent shot."
}
```

requirements
- main two changes:
    - handle new shot production format
    - handle updated prompt assembly method for shot image generation.
- don't change the gemini client config etc.
- don't change the system prompt for shot image generation.
    - still use system_prompts/create_shot_images.md as system prompt for image generation request to gemini.
- aspect ratio is still 16:9
- still upload the same reference images as before (the referenced designs)

your task
- carefully research current logic, code, status quo of the related code base
- expand this doc into detailed openspec spec doc + design doc + other docs
    - make sure the tasks doc has checklist
    - tasks should be batched into major milestones
    - tasks do not include manual verification or integration test etc.
- let me review first
- implementation once i confirm design is ok.