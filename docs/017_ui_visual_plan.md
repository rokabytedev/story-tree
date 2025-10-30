goal
- for the visuals tab in the story ui, it only shows the json of the visual design document.
- extend this ui tab to include:
    - character and environment reference images
    - the visual reference package json

requirements:
- keep the current visual design document json
- add the visual reference package json below it
- at the top of the page (the "Visuals" tab), add a section to display the reference images:
    - a sub-section for characters
        for each character (leading with the character id):
            - all the images associated with this character saved in visual reference.
                - shown in a grid-like layout. each image is a "card"
            - for each image, show its "plate_description" (image at top of the card, description in the bottom of the card with background separation)
            - clicking on the image shows a detailed panel on the right of the page (similar to the storyboard right panel)
                - the panel should include everything from visual reference
                - show all the metadata nicely with proper ui elements. don't just show raw json.  (e.g. properly render newline "\n")
            - below the images grid, shows the character design details from the visual design doc.
                - all the fields from the detailed_description field, nicely showned in ui.
    - a sub-section for the environments
        for each environment (leading with environment id):
            - all the images assocciated from visual reference
                - shown in a grid-like layout. each image is a "card". same as character.
            - for each image, show its "keyframe_description" (image at top of the card, description in the bottom of the card with background separation)
            - clicking on the image shows a detailed panel on the right of the page (same as above for character)
                - the panel should include everything from visual reference
                - show all the metadata nicely with proper ui elements. don't just show raw json. (e.g. properly render newline "\n")
            - below the images grid, shows the environment design details from the visual design doc.
                - all the fields from the detailed_description field, nicely showned in ui.
    - a sub-section for global_aesthetic
        - nicely show everything from visual_style
        - nicely show everything from master_color_palette
            - show each color's name, code, usage
            - in a grid kind layout. keep it concise
- overall the ui layout should have generous spacing but don't waste space.

your task
- expand this doc into detailed openspec spec doc + design doc + other docs
    - IMPORTANT: make sure the tasks doc has checklist
    - tasks should be batched into major milestones
    - tasks do not include manual verification or integration test etc.
- let me review first
- implementation once i confirm design is ok.

---
example jsons:

visual design document:
```json
{
  "global_aesthetic": {
    "visual_style": {
      "name": "Vibrant Sci-Fi Storybook",
      "description": "A clean, bright, and inviting 2D animation style that feels like a premium children's television show or an interactive digital storybook. The style uses bold, clean vector-like lines for characters and technology, creating clear and readable silhouettes. Backgrounds, especially natural ones like the jungle or planetary surfaces, incorporate soft, painterly textures to add depth and a sense of wonder. The overall impression is optimistic, colorful, and designed to make complex scientific concepts feel exciting and accessible. Character animation should be expressive and full of personality."
    },
    "master_color_palette": [
      {
        "hex_code": "#2E7D32",
        "color_name": "Jungle Green",
        "usage_notes": "Represents home, nature, and safety. The dominant color for Cosmo's treehouse workshop and the view of Earth from space."
      },
      {
        "hex_code": "#C0C0C0",
        "color_name": "Rocket Silver",
        "usage_notes": "The primary color for the Stardust Cruiser and Cosmo's jumpsuit. Represents technology, exploration, and ingenuity. It should have a slightly reflective, metallic sheen."
      },
      {
        "hex_code": "#0D1B2A",
        "color_name": "Deep Space Blue",
        "usage_notes": "The foundational color for space. It's a very dark, rich blue, not pure black, allowing for subtle background nebulae and distant stars to be visible."
      },
      {
        "hex_code": "#FF8F00",
        "color_name": "Curiosity Orange",
        "usage_notes": "A warm, energetic accent color used for control panel buttons, Cosmo's mission patches, and UI highlights. Symbolizes Cosmo's adventurous and curious spirit."
      },
      {
        "hex_code": "#00BCD4",
        "color_name": "A.I.D.A. Cyan",
        "usage_notes": "The signature color for A.I.D.A.'s holographic interface and text displays. Represents friendly intelligence, data, and guidance."
      }
    ]
  },
  "character_designs": [
    {
      "role": "Main Character",
      "character_id": "cosmo",
      "detailed_description": {
        "attire": "He wears a slightly baggy, one-piece silver (#C0C0C0) jumpsuit that looks like it was made from a metallic, crinkly material similar to a space blanket. It has short sleeves and legs, revealing his brown fur. There is a circular mission patch on the left breast with a cartoon rocket ship design in 'Curiosity Orange'. The suit has oversized, chunky zippers and a few visible, colorful patches, suggesting it's homemade. He also has a clear, perfectly round glass bubble helmet that he can wear, which seals around his neck with a soft grey collar.",
        "physique": "Small, slender, and agile. He has a wiry build, not muscular, emphasizing his youth and cleverness over strength. His limbs are long for his body, and he has a long, prehensile tail that he often uses to hang from things or steady himself in zero-gravity. His posture is energetic and always leaning slightly forward with curiosity.",
        "facial_features": "Cosmo is a young capuchin monkey. His face is framed with light tan fur, while the rest of his head has short, warm brown fur. His eyes are very large, expressive, and a deep, curious chocolate brown (#5D4037) with large black pupils that dilate and contract with his emotions. He has a small, simple black nose and a wide, highly expressive mouth capable of big grins and pouty frowns. He has large, rounded ears that are slightly darker than his facial fur."
      }
    },
    {
      "role": "Supporting Character / Ship AI",
      "character_id": "a-i-d-a",
      "detailed_description": {
        "attire": "A.I.D.A.'s visual representation is a holographic interface projected in the center of the Stardust Cruiser's cockpit. Her primary form is a glowing orb of 'A.I.D.A. Cyan' light, about the size of a basketball. This orb pulses gently in time with her speech. When displaying data, the orb expands and flattens into holographic screens showing star maps, fuel gauges, and scientific analyses. Text and graphics are always rendered in the same clean, cyan color. Her 'icon' or avatar, which appears in the corner of these screens, is a simple, stylized line-art monkey face, also in cyan.",
        "physique": "N/A.",
        "facial_features": "N/A. A.I.D.A. is a non-corporeal AI."
      }
    }
  ],
  "environment_designs": [
    {
      "environment_id": "cosmos-jungle-workshop",
      "detailed_description": {
        "color_tones": "Dominated by 'Jungle Green' and warm wood browns. The technology provides pops of color, especially the constant glow of 'A.I.D.A. Cyan' from the main screen.",
        "key_elements": "The Stardust Cruiser on its launchpad. A main console made from an old arcade cabinet. A large corkboard covered in star charts and spaceship blueprints. Wires and vines coexisting everywhere.",
        "overall_description": "A sprawling, open-air workshop built into the canopy of a giant, ancient banyan tree. The floor is made of sturdy wooden planks, interwoven with the tree's natural branches. Thick vines hang down, some of which are used as conduits for colorful wires connecting various pieces of scavenged tech. The workshop is a vibrant clutter of old computer monitors, keyboards, toolboxes, and half-finished gadgets. In the center is the launchpad for the Stardust Cruiser.",
        "lighting_and_atmosphere": "The mood is creative, cozy, and full of potential. Dappled sunlight filters through the lush green leaves of the canopy, creating moving patterns of light and shadow. For landing scenes, the lighting shifts to a warm, golden sunset or a soft twilight, with the workshop's monitors providing a welcoming glow."
      },
      "associated_scenelet_ids": [
        "scenelet-1",
        "scenelet-34",
        "scenelet-43",
        "scenelet-49",
        "scenelet-53"
      ]
    },
    {
      "environment_id": "the-stardust-cruiser-cockpit",
      "detailed_description": {
        "color_tones": "The base color is 'Rocket Silver', with the environment outside the window dictating the ambient light color. Controls provide pops of 'Curiosity Orange' and other primary colors.",
        "key_elements": "The large bubble viewport, Cosmo's central command chair, the holographic A.I.D.A. projector, and the tactile, kid-friendly control panel. A small hatch for deploying probes and a rover.",
        "overall_description": "The interior of Cosmo's bottle-shaped rocket. It's snug and designed for one. A single, well-worn captain's chair sits before a large, bubble-like viewport that serves as the main screen. The walls are metallic silver, with exposed wiring neatly bundled. The control panel is a tactile mix of oversized, colorful buttons, chunky levers, and a few high-tech holographic displays projected by A.I.D.A. A small corkboard on one wall is used for mission souvenirs (like photos).",
        "lighting_and_atmosphere": "Cozy, safe, and exciting. The primary light source is external, casting the colors of nearby celestial bodies (the blue of Earth, red of Mars) into the cockpit. A constant, soft 'A.I.D.A. Cyan' glow emanates from the holographic projector."
      },
      "associated_scenelet_ids": [
        "scenelet-1",
        "scenelet-2",
        "scenelet-3",
        "scenelet-4",
        "scenelet-5",
        "scenelet-6",
        "scenelet-7",
        "scenelet-8",
        "scenelet-9",
        "scenelet-11",
        "scenelet-12",
        "scenelet-13",
        "scenelet-14",
        "scenelet-16",
        "scenelet-17",
        "scenelet-18",
        "scenelet-19",
        "scenelet-20",
        "scenelet-21",
        "scenelet-23",
        "scenelet-24",
        "scenelet-25",
        "scenelet-27",
        "scenelet-28",
        "scenelet-29",
        "scenelet-30",
        "scenelet-31",
        "scenelet-32",
        "scenelet-33",
        "scenelet-35",
        "scenelet-36",
        "scenelet-37",
        "scenelet-38",
        "scenelet-39",
        "scenelet-40",
        "scenelet-41",
        "scenelet-42",
        "scenelet-44",
        "scenelet-45",
        "scenelet-46",
        "scenelet-47",
        "scenelet-48",
        "scenelet-50",
        "scenelet-51",
        "scenelet-52"
      ]
    },
    {
      "environment_id": "the-asteroid-belt",
      "detailed_description": {
        "color_tones": "A muted palette of greys, charcoals, and browns. This makes the colorful Stardust Cruiser stand out dramatically against the background.",
        "key_elements": "A high density of varied asteroids, creating a navigational maze. Dust clouds that catch the distant sunlight. A few exceptionally large, characterful asteroids.",
        "overall_description": "A vast, three-dimensional river of rock and dust. The asteroids range in size from small, fast-moving pebbles to colossal, city-sized boulders that tumble slowly through space. Their shapes are irregular and potato-like, with surfaces pocked by craters. Their color is predominantly a neutral grey, but with visible streaks of other minerals like reddish iron deposits.",
        "lighting_and_atmosphere": "Mysterious, hazardous, and majestic. The lighting is harsh and high-contrast, coming from the single point of the distant Sun. This creates bright, sunlit surfaces and deep, pure black shadows on the asteroids, making them feel solid and dangerous."
      },
      "associated_scenelet_ids": [
        "scenelet-3",
        "scenelet-4",
        "scenelet-5",
        "scenelet-6",
        "scenelet-10",
        "scenelet-15",
        "scenelet-22",
        "scenelet-26",
        "scenelet-27",
        "scenelet-28"
      ]
    },
    {
      "environment_id": "giant-asteroid-surface-ice-fields",
      "detailed_description": {
        "color_tones": "A stark contrast of dark grey (#424242) rock against brilliant, slightly bluish-white (#F0F8FF) ice. The geyser vapor is pure white.",
        "key_elements": "The sharp contrast between dark, cratered rock and the bright, glittering ice field. The erupting cryogeysers. The curved horizon of the asteroid.",
        "overall_description": "The surface of a particularly massive, dark grey asteroid. Its landscape is rugged and cratered, but one polar region is dominated by a vast, surprisingly smooth field of shimmering water ice. This ice field glitters intensely, reflecting the distant starlight and sunlight. Small fissures in the ice occasionally vent plumes of white vapor (cryogeysers) into the vacuum of space.",
        "lighting_and_atmosphere": "Awe-inspiring and beautiful, with a hint of alien mystery. The light from the sun is weak but creates a brilliant, star-like sparkle across the entire ice field. The rocky parts of the asteroid are cast in deep shadow."
      },
      "associated_scenelet_ids": [
        "scenelet-6",
        "scenelet-7",
        "scenelet-8",
        "scenelet-9",
        "scenelet-10"
      ]
    },
    {
      "environment_id": "giant-asteroid-crystal-ice-tunnel",
      "detailed_description": {
        "color_tones": "The base is the blackness of the unlit cave, but the dominant visual is the full spectrum of the rainbow refracting and reflecting throughout the space.",
        "key_elements": "The gigantic, geometric ice crystals lining every surface. The dark, mysterious entrance and the pinpoint of light at the exit. A few massive, free-floating crystals.",
        "overall_description": "A massive, natural cavern or lava tube that runs through the center of the giant asteroid. The tunnel is immense, dwarfing the Stardust Cruiser. Its walls are not bare rock, but are entirely covered in massive, perfectly-formed, translucent ice crystals of varying sizes. These crystals act like giant prisms.",
        "lighting_and_atmosphere": "Magical, wondrous, and slightly dangerous. The only light source is the Stardust Cruiser's own headlights. As the light hits the crystals, the entire cavern is illuminated in a dazzling, ever-shifting display of rainbow colors. The atmosphere is quiet and awe-inspiring, but also feels unstable."
      },
      "associated_scenelet_ids": [
        "scenelet-13",
        "scenelet-14",
        "scenelet-15",
        "scenelet-18",
        "scenelet-19",
        "scenelet-20",
        "scenelet-21",
        "scenelet-22",
        "scenelet-24",
        "scenelet-25",
        "scenelet-26"
      ]
    },
    {
      "environment_id": "mars-planet-view-landscape",
      "detailed_description": {
        "color_tones": "A monochromatic palette of reds, oranges, and tans. The ground is a rusty ochre (#CC7722), and the sky is a pale salmon pink (#FF91A4).",
        "key_elements": "The distinct red soil. The thin, pink sky. The massive scale of Olympus Mons and Valles Marineris. The bright white polar ice caps made of water ice and frozen carbon dioxide.",
        "overall_description": "Mars is a world of epic scale, defined by its rusty red color. From orbit, it is a dusty red sphere with brilliant white polar ice caps. The surface is a vast, rocky desert of orange-red sand and rock fields under a thin, pale pinkish-tan sky. Key landmarks are exaggerated for visual impact: Olympus Mons is a shield volcano so wide its slope is barely perceptible, and Valles Marineris is a colossal canyon system that scars the planet's face.",
        "lighting_and_atmosphere": "Lonely, grand, and ancient. The sunlight is dimmer than on Earth, giving the landscape a slightly washed-out, high-contrast feel with long, sharp shadows. The thin atmosphere means the sky fades to black at high altitudes."
      },
      "associated_scenelet_ids": [
        "scenelet-29",
        "scenelet-30",
        "scenelet-31",
        "scenelet-32",
        "scenelet-33",
        "scenelet-34",
        "scenelet-35",
        "scenelet-36",
        "scenelet-37",
        "scenelet-38",
        "scenelet-39",
        "scenelet-40",
        "scenelet-41",
        "scenelet-42",
        "scenelet-43"
      ]
    },
    {
      "environment_id": "jupiter-planet-view",
      "detailed_description": {
        "color_tones": "A rich, warm palette of swirling colors. Creams (#FFFDD0), oranges (#FF7F50), tans (#D2B48C), and browns (#964B00) are all present, but the scene is dominated by the deep, powerful crimson (#DC143C) of the Great Red Spot.",
        "key_elements": "The sheer, overwhelming scale. The distinct cloud bands. The mesmerizing, swirling vortex of the Great Red Spot. Its faint, thin ring system might be subtly visible.",
        "overall_description": "An immense gas giant that dominates the viewport, appearing as a colossal, swirling ball of painterly clouds. It has no solid surface. The view is of its dynamic atmosphere, with distinct horizontal bands of cream, orange, and brown clouds moving at different speeds. The defining feature is the Great Red Spot, a gigantic, deep crimson storm that churns with visible, detailed vortices.",
        "lighting_and_atmosphere": "Breathtaking, powerful, and majestic. The planet seems to glow with its own energy. The lighting is soft, diffused by the thick cloud layers. The mood is one of profound, cosmic grandeur."
      },
      "associated_scenelet_ids": [
        "scenelet-11",
        "scenelet-12",
        "scenelet-15",
        "scenelet-16",
        "scenelet-22",
        "scenelet-23",
        "scenelet-28",
        "scenelet-44",
        "scenelet-45",
        "scenelet-46",
        "scenelet-47",
        "scenelet-48",
        "scenelet-49",
        "scenelet-50",
        "scenelet-51",
        "scenelet-52"
      ]
    }
  ]
}
```

visual reference package:

```json
{
  "environment_keyframes": [
    {
      "keyframes": [
        {
          "keyframe_description": "Daytime in the workshop. The mood is creative and full of potential, with bright, dappled sunlight.",
          "image_generation_prompt": "Environment keyframe for Cosmo's Jungle Workshop during the day.\n// STYLE & AESTHETICS:\nStyle Name: Vibrant Sci-Fi Storybook\nDescription: A clean, bright, and inviting 2D animation style that feels like a premium children's television show or an interactive digital storybook. The style uses bold, clean vector-like lines for characters and technology, creating clear and readable silhouettes. Backgrounds, especially natural ones like the jungle or planetary surfaces, incorporate soft, painterly textures to add depth and a sense of wonder. The overall impression is optimistic, colorful, and designed to make complex scientific concepts feel exciting and accessible. Character animation should be expressive and full of personality.\nMaster Color Palette: Jungle Green (#2E7D32), Rocket Silver (#C0C0C0), Deep Space Blue (#0D1B2A), Curiosity Orange (#FF8F00), A.I.D.A. Cyan (#00BCD4).\n// SUBJECT DETAILS:\nA sprawling, open-air workshop in a giant banyan tree. Wooden planks, hanging vines, and scavenged tech coexist. The Stardust Cruiser sits on its central launchpad. A corkboard is covered in star charts. Dominated by 'Jungle Green' and warm wood browns, with pops of color from tech.\n// COMPOSITION & CAMERA:\nWide establishing shot, showing the full scope of the workshop and its integration with the jungle canopy.\n// LIGHTING & MOOD:\nBright, cheerful, and creative mood. Dappled sunlight filters through the lush green leaves above, creating beautiful, shifting patterns of light and shadow across the floor and equipment."
        },
        {
          "keyframe_description": "Twilight in the workshop after a successful mission. The mood is cozy, warm, and welcoming.",
          "image_generation_prompt": "Environment keyframe for Cosmo's Jungle Workshop at twilight.\n// STYLE & AESTHETICS:\nStyle Name: Vibrant Sci-Fi Storybook\nDescription: A clean, bright, and inviting 2D animation style that feels like a premium children's television show or an interactive digital storybook. The style uses bold, clean vector-like lines for characters and technology, creating clear and readable silhouettes. Backgrounds, especially natural ones like the jungle or planetary surfaces, incorporate soft, painterly textures to add depth and a sense of wonder. The overall impression is optimistic, colorful, and designed to make complex scientific concepts feel exciting and accessible. Character animation should be expressive and full of personality.\nMaster Color Palette: Jungle Green (#2E7D32), Rocket Silver (#C0C0C0), Deep Space Blue (#0D1B2A), Curiosity Orange (#FF8F00), A.I.D.A. Cyan (#00BCD4).\n// SUBJECT DETAILS:\nA sprawling, open-air workshop in a giant banyan tree. The Stardust Cruiser is safely landed on its launchpad. Tools are neatly put away. Star charts and new souvenirs are pinned to the corkboard.\n// COMPOSITION & CAMERA:\nMedium wide shot, focusing on the main console area and the landed rocket, creating a sense of homecoming.\n// LIGHTING & MOOD:\nWarm, cozy, and safe mood. The sun has set, and the scene is lit by a soft twilight. The primary light sources are the warm, inviting glow from the various computer monitors and the gentle pulse of A.I.D.A.'s cyan light, creating a welcoming atmosphere."
        }
      ],
      "environment_id": "cosmos-jungle-workshop"
    },
    {
      "keyframes": [
        {
          "keyframe_description": "The cockpit interior with the blue and white marble of Earth filling the main viewport, casting a gentle light.",
          "image_generation_prompt": "Environment keyframe for the Stardust Cruiser Cockpit in Earth orbit.\n// STYLE & AESTHETICS:\nStyle Name: Vibrant Sci-Fi Storybook\nDescription: A clean, bright, and inviting 2D animation style that feels like a premium children's television show or an interactive digital storybook. The style uses bold, clean vector-like lines for characters and technology, creating clear and readable silhouettes. Backgrounds, especially natural ones like the jungle or planetary surfaces, incorporate soft, painterly textures to add depth and a sense of wonder. The overall impression is optimistic, colorful, and designed to make complex scientific concepts feel exciting and accessible. Character animation should be expressive and full of personality.\nMaster Color Palette: Jungle Green (#2E7D32), Rocket Silver (#C0C0C0), Deep Space Blue (#0D1B2A), Curiosity Orange (#FF8F00), A.I.D.A. Cyan (#00BCD4).\n// SUBJECT DETAILS:\nThe snug, silver (#C0C0C0) interior of a homemade rocket. A single command chair faces a large bubble viewport. The walls have neatly bundled wires and a small corkboard. A.I.D.A.'s cyan holographic projector is active.\n// COMPOSITION & CAMERA:\nInterior shot from over the pilot's shoulder, looking out the main viewport at the magnificent view.\n// LIGHTING & MOOD:\nAwe-inspiring and peaceful. The only significant light source is the massive, beautiful planet Earth outside, casting a soft, cool, blue-and-white ambient light throughout the entire cockpit."
        },
        {
          "keyframe_description": "The cockpit interior illuminated by the rusty red glow of Mars, creating a lonely and ancient mood.",
          "image_generation_prompt": "Environment keyframe for the Stardust Cruiser Cockpit in Mars orbit.\n// STYLE & AESTHETICS:\nStyle Name: Vibrant Sci-Fi Storybook\nDescription: A clean, bright, and inviting 2D animation style that feels like a premium children's television show or an interactive digital storybook. The style uses bold, clean vector-like lines for characters and technology, creating clear and readable silhouettes. Backgrounds, especially natural ones like the jungle or planetary surfaces, incorporate soft, painterly textures to add depth and a sense of wonder. The overall impression is optimistic, colorful, and designed to make complex scientific concepts feel exciting and accessible. Character animation should be expressive and full of personality.\nMaster Color Palette: Jungle Green (#2E7D32), Rocket Silver (#C0C0C0), Deep Space Blue (#0D1B2A), Curiosity Orange (#FF8F00), A.I.D.A. Cyan (#00BCD4).\n// SUBJECT DETAILS:\nThe snug, silver (#C0C0C0) interior of the rocket cockpit. The large bubble viewport shows the dusty, red, cratered surface of Mars.\n// COMPOSITION & CAMERA:\nInterior shot, looking from the side at the empty command chair and the control panel, with the viewport prominent in the frame.\n// LIGHTING & MOOD:\nQuiet, lonely, and ancient. The entire cockpit is bathed in a warm, rusty-red ambient light reflected from the surface of Mars below. The cyan glow from A.I.D.A.'s projector provides a cool color contrast."
        },
        {
          "keyframe_description": "The cockpit interior during a red alert, with flashing lights and a sense of immediate danger.",
          "image_generation_prompt": "Environment keyframe for the Stardust Cruiser Cockpit during a red alert.\n// STYLE & AESTHETICS:\nStyle Name: Vibrant Sci-Fi Storybook\nDescription: A clean, bright, and inviting 2D animation style that feels like a premium children's television show or an interactive digital storybook. The style uses bold, clean vector-like lines for characters and technology, creating clear and readable silhouettes. Backgrounds, especially natural ones like the jungle or planetary surfaces, incorporate soft, painterly textures to add depth and a sense of wonder. The overall impression is optimistic, colorful, and designed to make complex scientific concepts feel exciting and accessible. Character animation should be expressive and full of personality.\nMaster Color Palette: Jungle Green (#2E7D32), Rocket Silver (#C0C0C0), Deep Space Blue (#0D1B2A), Curiosity Orange (#FF8F00), A.I.D.A. Cyan (#00BCD4).\n// SUBJECT DETAILS:\nThe silver interior of the rocket cockpit is shown in a state of chaos. Outside the viewport, sharp shards of ice are tumbling past.\n// COMPOSITION & CAMERA:\nA Dutch angle shot of the cockpit interior to create a sense of unease and action.\n// LIGHTING & MOOD:\nDangerous and urgent. The normal lighting is replaced by the insistent, rhythmic flashing of red alert lights. This casts the entire scene in stark, pulsing shades of red and deep shadow, creating high drama."
        }
      ],
      "environment_id": "the-stardust-cruiser-cockpit"
    },
    {
      "keyframes": [
        {
          "keyframe_description": "A majestic wide view of the asteroid belt, showing its vast scale and density.",
          "image_generation_prompt": "Environment keyframe of the Asteroid Belt.\n// STYLE & AESTHETICS:\nStyle Name: Vibrant Sci-Fi Storybook\nDescription: A clean, bright, and inviting 2D animation style that feels like a premium children's television show or an interactive digital storybook. The style uses bold, clean vector-like lines for characters and technology, creating clear and readable silhouettes. Backgrounds, especially natural ones like the jungle or planetary surfaces, incorporate soft, painterly textures to add depth and a sense of wonder. The overall impression is optimistic, colorful, and designed to make complex scientific concepts feel exciting and accessible. Character animation should be expressive and full of personality.\nMaster Color Palette: Jungle Green (#2E7D32), Rocket Silver (#C0C0C0), Deep Space Blue (#0D1B2A), Curiosity Orange (#FF8F00), A.I.D.A. Cyan (#00BCD4).\n// SUBJECT DETAILS:\nA vast, three-dimensional field of tumbling grey and brown rocks against the 'Deep Space Blue' background. Asteroids range from tiny pebbles to city-sized, potato-shaped boulders. Wisps of dust catch the distant sunlight.\n// COMPOSITION & CAMERA:\nAn extreme wide shot to establish the immense scale. The Stardust Cruiser is a tiny silver speck approaching the dense field, emphasizing the challenge ahead.\n// LIGHTING & MOOD:\nMysterious, majestic, and hazardous. The single, distant sun creates harsh, high-contrast light. Each asteroid has a brightly lit side and a side of pure, deep black shadow, giving them a solid, dangerous feel."
        },
        {
          "keyframe_description": "A colossal, potato-shaped asteroid looms, completely blocking the path and casting a deep shadow.",
          "image_generation_prompt": "Environment keyframe of a colossal asteroid blocking the path.\n// STYLE & AESTHETICS:\nStyle Name: Vibrant Sci-Fi Storybook\nDescription: A clean, bright, and inviting 2D animation style that feels like a premium children's television show or an interactive digital storybook. The style uses bold, clean vector-like lines for characters and technology, creating clear and readable silhouettes. Backgrounds, especially natural ones like the jungle or planetary surfaces, incorporate soft, painterly textures to add depth and a sense of wonder. The overall impression is optimistic, colorful, and designed to make complex scientific concepts feel exciting and accessible. Character animation should be expressive and full of personality.\nMaster Color Palette: Jungle Green (#2E7D32), Rocket Silver (#C0C0C0), Deep Space Blue (#0D1B2A), Curiosity Orange (#FF8F00), A.I.D.A. Cyan (#00BCD4).\n// SUBJECT DETAILS:\nA single, immense, irregularly shaped grey asteroid dominates the frame. Its surface is pocked with craters of various sizes. Smaller asteroids drift in the background.\n// COMPOSITION & CAMERA:\nA low-angle wide shot from the perspective of the approaching Stardust Cruiser, making the asteroid feel overwhelmingly large and imposing.\n// LIGHTING & MOOD:\nOminous and challenging. The colossal asteroid blocks the light from the distant sun, plunging the immediate area into a deep, dark shadow. Only the asteroid's rim is highlighted by the sun, creating a dramatic, eclipsing effect."
        }
      ],
      "environment_id": "the-asteroid-belt"
    },
    {
      "keyframes": [
        {
          "keyframe_description": "A wide, beautiful view of the glittering ice fields covering the pole of a dark asteroid.",
          "image_generation_prompt": "Environment keyframe of the ice fields on a giant asteroid's surface.\n// STYLE & AESTHETICS:\nStyle Name: Vibrant Sci-Fi Storybook\nDescription: A clean, bright, and inviting 2D animation style that feels like a premium children's television show or an interactive digital storybook. The style uses bold, clean vector-like lines for characters and technology, creating clear and readable silhouettes. Backgrounds, especially natural ones like the jungle or planetary surfaces, incorporate soft, painterly textures to add depth and a sense of wonder. The overall impression is optimistic, colorful, and designed to make complex scientific concepts feel exciting and accessible. Character animation should be expressive and full of personality.\nMaster Color Palette: Jungle Green (#2E7D32), Rocket Silver (#C0C0C0), Deep Space Blue (#0D1B2A), Curiosity Orange (#FF8F00), A.I.D.A. Cyan (#00BCD4).\n// SUBJECT DETAILS:\nThe curved horizon of a massive, dark grey (#424242) asteroid. A vast expanse of its surface is covered in a flat field of brilliant, bluish-white (#F0F8FF) ice, which contrasts sharply with the dark rock.\n// COMPOSITION & CAMERA:\nA sweeping wide shot, showing the Stardust Cruiser flying low over the icy terrain to emphasize the vastness of the field.\n// LIGHTING & MOOD:\nAwe-inspiring and beautiful. The weak, distant sun's light hits the crystalline ice and refracts into thousands of tiny, star-like sparkles. The rocky parts of the asteroid are in deep, contrasting shadow. The mood is one of alien beauty and discovery."
        },
        {
          "keyframe_description": "A cryogeyser erupts from a fissure in the ice, venting a plume of vapor into space.",
          "image_generation_prompt": "Environment keyframe of a cryogeyser erupting on an asteroid.\n// STYLE & AESTHETICS:\nStyle Name: Vibrant Sci-Fi Storybook\nDescription: A clean, bright, and inviting 2D animation style that feels like a premium children's television show or an interactive digital storybook. The style uses bold, clean vector-like lines for characters and technology, creating clear and readable silhouettes. Backgrounds, especially natural ones like the jungle or planetary surfaces, incorporate soft, painterly textures to add depth and a sense of wonder. The overall impression is optimistic, colorful, and designed to make complex scientific concepts feel exciting and accessible. Character animation should be expressive and full of personality.\nMaster Color Palette: Jungle Green (#2E7D32), Rocket Silver (#C0C0C0), Deep Space Blue (#0D1B2A), Curiosity Orange (#FF8F00), A.I.D.A. Cyan (#00BCD4).\n// SUBJECT DETAILS:\nA close-up view of the asteroid's icy surface. A crack in the bluish-white ice is venting a plume of pure white vapor and tiny ice crystals into the blackness of space.\n// COMPOSITION & CAMERA:\nA medium shot, focused on the erupting geyser. The Stardust Cruiser might be visible in the background for scale, observing the phenomenon.\n// LIGHTING & MOOD:\nDynamic and mysterious. The backlit vapor plume catches the distant sunlight, making it glow brilliantly against the 'Deep Space Blue' background and the shadowy surface of the asteroid. It feels like witnessing a secret, active process of the solar system."
        }
      ],
      "environment_id": "giant-asteroid-surface-ice-fields"
    },
    {
      "keyframes": [
        {
          "keyframe_description": "The wondrous moment the ship's headlights turn on, revealing the massive, rainbow-colored ice crystals lining the tunnel.",
          "image_generation_prompt": "Environment keyframe of the crystal ice tunnel inside an asteroid.\n// STYLE & AESTHETICS:\nStyle Name: Vibrant Sci-Fi Storybook\nDescription: A clean, bright, and inviting 2D animation style that feels like a premium children's television show or an interactive digital storybook. The style uses bold, clean vector-like lines for characters and technology, creating clear and readable silhouettes. Backgrounds, especially natural ones like the jungle or planetary surfaces, incorporate soft, painterly textures to add depth and a sense of wonder. The overall impression is optimistic, colorful, and designed to make complex scientific concepts feel exciting and accessible. Character animation should be expressive and full of personality.\nMaster Color Palette: Jungle Green (#2E7D32), Rocket Silver (#C0C0C0), Deep Space Blue (#0D1B2A), Curiosity Orange (#FF8F00), A.I.D.A. Cyan (#00BCD4).\n// SUBJECT DETAILS:\nThe interior of a massive cavern inside an asteroid. The walls are completely covered in gigantic, translucent, geometric ice crystals. The Stardust Cruiser is near the entrance, its headlights just switched on.\n// COMPOSITION & CAMERA:\nA wide shot from behind the Stardust Cruiser, showing the headlight beams cutting through the darkness and illuminating the incredible sight before it.\n// LIGHTING & MOOD:\nMagical, wondrous, and awe-inspiring. The scene transitions from pure black to a dazzling display of rainbow colors as the ship's light refracts through the giant ice crystals, filling the entire space with shifting, vibrant light."
        },
        {
          "keyframe_description": "The chaotic collapse of the ice tunnel, with the ship racing for the exit amid falling, glittering debris.",
          "image_generation_prompt": "Environment keyframe of the ice tunnel collapsing.\n// STYLE & AESTHETICS:\nStyle Name: Vibrant Sci-Fi Storybook\nDescription: A clean, bright, and inviting 2D animation style that feels like a premium children's television show or an interactive digital storybook. The style uses bold, clean vector-like lines for characters and technology, creating clear and readable silhouettes. Backgrounds, especially natural ones like the jungle or planetary surfaces, incorporate soft, painterly textures to add depth and a sense of wonder. The overall impression is optimistic, colorful, and designed to make complex scientific concepts feel exciting and accessible. Character animation should be expressive and full of personality.\nMaster Color Palette: Jungle Green (#2E7D32), Rocket Silver (#C0C0C0), Deep Space Blue (#0D1B2A), Curiosity Orange (#FF8F00), A.I.D.A. Cyan (#00BCD4).\n// SUBJECT DETAILS:\nThe ice crystal cavern is shaking violently. Large crystals are breaking loose from the ceiling and walls. A shower of smaller, sharp ice shards fills the air. The Stardust Cruiser is accelerating towards a bright pinpoint of light marking the exit.\n// COMPOSITION & CAMERA:\nA dynamic action shot from the side, showing the ship dodging a massive falling crystal. Motion blur should be used to convey speed and urgency.\n// LIGHTING & MOOD:\nDangerous, chaotic, and thrilling. The lighting is erratic as the crystals fracture and fall, sending unpredictable flashes of rainbow light everywhere. The ship's engines cast a bright blue glow, illuminating the glittering, hazardous debris."
        }
      ],
      "environment_id": "giant-asteroid-crystal-ice-tunnel"
    },
    {
      "keyframes": [
        {
          "keyframe_description": "A breathtaking wide shot of the colossal volcano Olympus Mons, emphasizing its unbelievable scale.",
          "image_generation_prompt": "Environment keyframe of Olympus Mons on Mars.\n// STYLE & AESTHETICS:\nStyle Name: Vibrant Sci-Fi Storybook\nDescription: A clean, bright, and inviting 2D animation style that feels like a premium children's television show or an interactive digital storybook. The style uses bold, clean vector-like lines for characters and technology, creating clear and readable silhouettes. Backgrounds, especially natural ones like the jungle or planetary surfaces, incorporate soft, painterly textures to add depth and a sense of wonder. The overall impression is optimistic, colorful, and designed to make complex scientific concepts feel exciting and accessible. Character animation should be expressive and full of personality.\nMaster Color Palette: Jungle Green (#2E7D32), Rocket Silver (#C0C0C0), Deep Space Blue (#0D1B2A), Curiosity Orange (#FF8F00), A.I.D.A. Cyan (#00BCD4).\n// SUBJECT DETAILS:\nThe Martian landscape, dominated by the immense shield volcano Olympus Mons. It is so wide its gentle slope stretches to the horizon. The surface is a rusty ochre (#CC7722), and the thin sky above is a pale salmon pink (#FF91A4).\n// COMPOSITION & CAMERA:\nAn extreme wide shot showing the Stardust Cruiser as a tiny, insignificant speck flying alongside the vast slope of the volcano to establish its epic scale.\n// LIGHTING & MOOD:\nLonely, grand, and ancient. The dimmer sunlight creates a high-contrast look with long, sharp, dark shadows. The atmosphere is thin and clear, conveying a sense of empty grandeur."
        },
        {
          "keyframe_description": "A dramatic view looking down into the massive canyon system of Valles Marineris.",
          "image_generation_prompt": "Environment keyframe of Valles Marineris on Mars.\n// STYLE & AESTHETICS:\nStyle Name: Vibrant Sci-Fi Storybook\nDescription: A clean, bright, and inviting 2D animation style that feels like a premium children's television show or an interactive digital storybook. The style uses bold, clean vector-like lines for characters and technology, creating clear and readable silhouettes. Backgrounds, especially natural ones like the jungle or planetary surfaces, incorporate soft, painterly textures to add depth and a sense of wonder. The overall impression is optimistic, colorful, and designed to make complex scientific concepts feel exciting and accessible. Character animation should be expressive and full of personality.\nMaster Color Palette: Jungle Green (#2E7D32), Rocket Silver (#C0C0C0), Deep Space Blue (#0D1B2A), Curiosity Orange (#FF8F00), A.I.D.A. Cyan (#00BCD4).\n// SUBJECT DETAILS:\nA colossal canyon system scarring the red surface of Mars. The canyon walls are massive cliffs showing layers of red and orange rock, descending into hazy, unseen depths.\n// COMPOSITION & CAMERA:\nA dramatic high-angle shot from the point-of-view of the Stardust Cruiser, peering over the edge and down into the seemingly bottomless canyon, emphasizing its depth and length.\n// LIGHTING & MOOD:\nAwe-inspiring and epic. One canyon wall is brightly lit by the sun, showcasing the vibrant red and orange rock layers, while the opposite wall is cast in deep, dramatic shadow, enhancing the sense of immense scale and geological time."
        }
      ],
      "environment_id": "mars-planet-view-landscape"
    },
    {
      "keyframes": [
        {
          "keyframe_description": "A majestic, full-frame view of Jupiter, showcasing its immense scale and the iconic Great Red Spot.",
          "image_generation_prompt": "Environment keyframe of the planet Jupiter.\n// STYLE & AESTHETICS:\nStyle Name: Vibrant Sci-Fi Storybook\nDescription: A clean, bright, and inviting 2D animation style that feels like a premium children's television show or an interactive digital storybook. The style uses bold, clean vector-like lines for characters and technology, creating clear and readable silhouettes. Backgrounds, especially natural ones like the jungle or planetary surfaces, incorporate soft, painterly textures to add depth and a sense of wonder. The overall impression is optimistic, colorful, and designed to make complex scientific concepts feel exciting and accessible. Character animation should be expressive and full of personality.\nMaster Color Palette: Jungle Green (#2E7D32), Rocket Silver (#C0C0C0), Deep Space Blue (#0D1B2A), Curiosity Orange (#FF8F00), A.I.D.A. Cyan (#00BCD4).\n// SUBJECT DETAILS:\nThe colossal gas giant Jupiter fills the frame. Its painterly atmosphere shows distinct horizontal bands of swirling cream (#FFFDD0), orange (#FF7F50), and brown (#964B00) clouds. The Great Red Spot, a deep crimson (#DC143C) vortex, is the dominant feature.\n// COMPOSITION & CAMERA:\nAn extreme wide shot. The tiny silver Stardust Cruiser is positioned in the foreground to create a staggering sense of scale against the planet that fills the entire background.\n// LIGHTING & MOOD:\nBreathtaking, majestic, and powerful. The light is soft and diffused, appearing to emanate from the planet itself. The mood is one of profound cosmic grandeur and awe."
        },
        {
          "keyframe_description": "A highly detailed, super-telescope close-up of the swirling clouds within the Great Red Spot.",
          "image_generation_prompt": "Environment keyframe showing a telescopic view of Jupiter's Great Red Spot.\n// STYLE & AESTHETICS:\nStyle Name: Vibrant Sci-Fi Storybook\nDescription: A clean, bright, and inviting 2D animation style that feels like a premium children's television show or an interactive digital storybook. The style uses bold, clean vector-like lines for characters and technology, creating clear and readable silhouettes. Backgrounds, especially natural ones like the jungle or planetary surfaces, incorporate soft, painterly textures to add depth and a sense of wonder. The overall impression is optimistic, colorful, and designed to make complex scientific concepts feel exciting and accessible. Character animation should be expressive and full of personality.\nMaster Color Palette: Jungle Green (#2E7D32), Rocket Silver (#C0C0C0), Deep Space Blue (#0D1B2A), Curiosity Orange (#FF8F00), A.I.D.A. Cyan (#00BCD4).\n// SUBJECT DETAILS:\nAn abstract, painterly image showing the fine, detailed filaments of cloud within Jupiter's massive storm. It's a complex tapestry of crimson, deep orange, and cream-colored gases whipping past each other in mesmerizing, chaotic patterns.\n// COMPOSITION & CAMERA:\nAn extreme close-up, abstract composition that fills the entire frame. There is no sense of up or down, only the violent, beautiful motion of the storm.\n// LIGHTING & MOOD:\nHypnotic, violent, and beautiful. The scene is self-illuminated by the swirling gases. The mood is one of witnessing the raw, unstoppable power of nature on a cosmic scale."
        }
      ],
      "environment_id": "jupiter-planet-view"
    }
  ],
  "character_model_sheets": [
    {
      "character_id": "cosmo",
      "reference_plates": [
        {
          "type": "CHARACTER_MODEL_SHEET",
          "plate_description": "Character model sheet for Cosmo in a T-pose, showing front, side, and back views. One version with his bubble helmet on, one with it off.",
          "image_generation_prompt": "Character model sheet for a young capuchin monkey named Cosmo. Render in T-pose with front, side, and back views on a neutral background. Include a version with his helmet on and a version with it off.\n// STYLE & AESTHETICS:\nStyle Name: Vibrant Sci-Fi Storybook\nDescription: A clean, bright, and inviting 2D animation style that feels like a premium children's television show or an interactive digital storybook. The style uses bold, clean vector-like lines for characters and technology, creating clear and readable silhouettes. Backgrounds, especially natural ones like the jungle or planetary surfaces, incorporate soft, painterly textures to add depth and a sense of wonder. The overall impression is optimistic, colorful, and designed to make complex scientific concepts feel exciting and accessible. Character animation should be expressive and full of personality.\nMaster Color Palette: Jungle Green (#2E7D32), Rocket Silver (#C0C0C0), Deep Space Blue (#0D1B2A), Curiosity Orange (#FF8F00), A.I.D.A. Cyan (#00BCD4).\n// SUBJECT DETAILS:\nPhysique: Small, slender, agile capuchin monkey with a wiry build, long limbs, and a long prehensile tail. Fur is warm brown, with light tan fur framing the face. Attire: A slightly baggy, one-piece silver (#C0C0C0) jumpsuit made from a crinkly, space-blanket-like material. Short sleeves and legs. A circular mission patch on the left breast with a 'Curiosity Orange' cartoon rocket ship. Oversized, chunky zippers and colorful patches. A clear, round glass bubble helmet seals at the neck with a soft grey collar. Facial Features: Very large, expressive, chocolate brown (#5D4037) eyes. Small black nose, wide expressive mouth. Large, rounded ears.\n// COMPOSITION & CAMERA:\nFull body character turnaround shot. Eye-level. Even spacing between poses.\n// ACTION & EXPRESSION:\nStatic T-pose with a neutral, pleasant facial expression.\n// LIGHTING & MOOD:\nFlat, even, shadowless studio lighting to clearly display all details and colors accurately."
        },
        {
          "type": "CHARACTER_ACTION_SHOT",
          "plate_description": "Cosmo inside the cockpit during launch, pushed back in his seat with an expression of thrill and awe.",
          "image_generation_prompt": "Action shot of the character Cosmo during his rocket launch.\n// STYLE & AESTHETICS:\nStyle Name: Vibrant Sci-Fi Storybook\nDescription: A clean, bright, and inviting 2D animation style that feels like a premium children's television show or an interactive digital storybook. The style uses bold, clean vector-like lines for characters and technology, creating clear and readable silhouettes. Backgrounds, especially natural ones like the jungle or planetary surfaces, incorporate soft, painterly textures to add depth and a sense of wonder. The overall impression is optimistic, colorful, and designed to make complex scientific concepts feel exciting and accessible. Character animation should be expressive and full of personality.\nMaster Color Palette: Jungle Green (#2E7D32), Rocket Silver (#C0C0C0), Deep Space Blue (#0D1B2A), Curiosity Orange (#FF8F00), A.I.D.A. Cyan (#00BCD4).\n// SUBJECT DETAILS:\nCosmo, a small capuchin monkey with large brown eyes, wearing a silver jumpsuit and a clear bubble helmet, sits in his rocket's command chair.\n// COMPOSITION & CAMERA:\nMedium close-up on Cosmo from the chest up, slightly from the side.\n// ACTION & EXPRESSION:\nCosmo is pushed back in his seat by the force of acceleration. His body is tense. His facial expression is a mix of pure thrill and awe, with wide eyes and a huge, open-mouthed grin. His cheeks are slightly puffed back from the G-forces.\n// LIGHTING & MOOD:\nDramatic interior lighting. The main light source is the bright white-yellow glow of the rocket engines firing, visible through a rear window, casting strong highlights. The front of his face is lit by the glow of the control panels."
        },
        {
          "type": "CHARACTER_ACTION_SHOT",
          "plate_description": "Cosmo doing a joyous, slow-motion backflip in zero-gravity inside the cockpit.",
          "image_generation_prompt": "Action shot of the character Cosmo floating in zero gravity.\n// STYLE & AESTHETICS:\nStyle Name: Vibrant Sci-Fi Storybook\nDescription: A clean, bright, and inviting 2D animation style that feels like a premium children's television show or an interactive digital storybook. The style uses bold, clean vector-like lines for characters and technology, creating clear and readable silhouettes. Backgrounds, especially natural ones like the jungle or planetary surfaces, incorporate soft, painterly textures to add depth and a sense of wonder. The overall impression is optimistic, colorful, and designed to make complex scientific concepts feel exciting and accessible. Character animation should be expressive and full of personality.\nMaster Color Palette: Jungle Green (#2E7D32), Rocket Silver (#C0C0C0), Deep Space Blue (#0D1B2A), Curiosity Orange (#FF8F00), A.I.D.A. Cyan (#00BCD4).\n// SUBJECT DETAILS:\nCosmo, a small capuchin monkey wearing a silver jumpsuit (helmet off), floating inside his rocket cockpit.\n// COMPOSITION & CAMERA:\nMedium shot, capturing Cosmo's full body as he floats in the center of the frame. The camera is slightly tilted to enhance the sense of weightlessness.\n// ACTION & EXPRESSION:\nCosmo is in the middle of a slow-motion backflip. His limbs are loose and floating, and his long prehensile tail is curled in a happy 'S' shape. His facial expression is one of pure, unadulterated joy, with his eyes closed and a massive, happy smile on his face.\n// LIGHTING & MOOD:\nSoft, ambient light fills the cockpit. The primary light source is the beautiful blue and white glow of the Earth visible through the main viewport, casting a gentle blue light on Cosmo."
        },
        {
          "type": "CHARACTER_ACTION_SHOT",
          "plate_description": "Cosmo's expression shifting from brief disappointment to renewed wonder as he looks at Jupiter.",
          "image_generation_prompt": "Action shot showing an emotional shift for the character Cosmo.\n// STYLE & AESTHETICS:\nStyle Name: Vibrant Sci-Fi Storybook\nDescription: A clean, bright, and inviting 2D animation style that feels like a premium children's television show or an interactive digital storybook. The style uses bold, clean vector-like lines for characters and technology, creating clear and readable silhouettes. Backgrounds, especially natural ones like the jungle or planetary surfaces, incorporate soft, painterly textures to add depth and a sense of wonder. The overall impression is optimistic, colorful, and designed to make complex scientific concepts feel exciting and accessible. Character animation should be expressive and full of personality.\nMaster Color Palette: Jungle Green (#2E7D32), Rocket Silver (#C0C0C0), Deep Space Blue (#0D1B2A), Curiosity Orange (#FF8F00), A.I.D.A. Cyan (#00BCD4).\n// SUBJECT DETAILS:\nCosmo, a small capuchin monkey with large brown eyes, wearing a silver jumpsuit. He is floating inside his cockpit.\n// COMPOSITION & CAMERA:\nClose-up on Cosmo's face and shoulders. The immense, swirling planet of Jupiter is visible and slightly out of focus in the background through the viewport.\n// ACTION & EXPRESSION:\nCosmo's expression captures a moment of transition. His ears are slightly drooped from a moment of disappointment, but his eyes are now wide with renewed wonder and his mouth is beginning to form a new, excited grin as he fully comprehends the magnificent sight of Jupiter.\n// LIGHTING & MOOD:\nThe primary light is the warm, soft, orange-and-cream-colored light reflected from Jupiter, casting a gentle glow on his face and highlighting his wide eyes."
        }
      ]
    },
    {
      "character_id": "a-i-d-a",
      "reference_plates": [
        {
          "type": "CHARACTER_MODEL_SHEET",
          "image_path": "999c2177-c02b-41e1-bb4d-ec9dff2bb403/visuals/characters/a-i-d-a/character-model-sheet-1.png",
          "plate_description": "Model sheet for A.I.D.A. showing its two primary states: the default glowing orb and an expanded holographic data screen.",
          "image_generation_prompt": "Character model sheet for the AI named A.I.D.A. on a neutral, dark background.\n// STYLE & AESTHETICS:\nStyle Name: Vibrant Sci-Fi Storybook\nDescription: A clean, bright, and inviting 2D animation style that feels like a premium children's television show or an interactive digital storybook. The style uses bold, clean vector-like lines for characters and technology, creating clear and readable silhouettes. Backgrounds, especially natural ones like the jungle or planetary surfaces, incorporate soft, painterly textures to add depth and a sense of wonder. The overall impression is optimistic, colorful, and designed to make complex scientific concepts feel exciting and accessible. Character animation should be expressive and full of personality.\nMaster Color Palette: Jungle Green (#2E7D32), Rocket Silver (#C0C0C0), Deep Space Blue (#0D1B2A), Curiosity Orange (#FF8F00), A.I.D.A. Cyan (#00BCD4).\n// SUBJECT DETAILS:\nShow two states side-by-side. State 1: A.I.D.A.'s default form, a glowing, basketball-sized orb of pure 'A.I.D.A. Cyan' (#00BCD4) light, pulsing gently with a soft outer glow. State 2: The orb expanded into a flat, rectangular holographic screen, also in cyan. This screen displays a sample star map with orbital lines. In the corner of the screen is A.I.D.A.'s avatar, a simple, stylized line-art monkey face.\n// COMPOSITION & CAMERA:\nEye-level, straight-on view of the two states.\n// ACTION & EXPRESSION:\nN/A. Static display of the AI's forms.\n// LIGHTING & MOOD:\nA.I.D.A. is the light source. The cyan light should cast a soft glow on the surrounding area. The effect should feel clean, intelligent, and friendly."
        },
        {
          "type": "CHARACTER_ACTION_SHOT",
          "plate_description": "A.I.D.A. in its holographic screen form, displaying a critical fuel warning.",
          "image_generation_prompt": "Action shot of the AI character A.I.D.A. displaying a warning.\n// STYLE & AESTHETICS:\nStyle Name: Vibrant Sci-Fi Storybook\nDescription: A clean, bright, and inviting 2D animation style that feels like a premium children's television show or an interactive digital storybook. The style uses bold, clean vector-like lines for characters and technology, creating clear and readable silhouettes. Backgrounds, especially natural ones like the jungle or planetary surfaces, incorporate soft, painterly textures to add depth and a sense of wonder. The overall impression is optimistic, colorful, and designed to make complex scientific concepts feel exciting and accessible. Character animation should be expressive and full of personality.\nMaster Color Palette: Jungle Green (#2E7D32), Rocket Silver (#C0C0C0), Deep Space Blue (#0D1B2A), Curiosity Orange (#FF8F00), A.I.D.A. Cyan (#00BCD4).\n// SUBJECT DETAILS:\nA.I.D.A. is projected as a large holographic screen inside the Stardust Cruiser cockpit. The screen displays a stylized fuel gauge icon which is mostly empty and flashing a pulsing, alarming red color. The text 'FUEL LEVEL CRITICAL' is displayed in large, blocky cyan letters.\n// COMPOSITION & CAMERA:\nMedium shot, centered on the holographic display. The cockpit interior is visible but out of focus in the background.\n// ACTION & EXPRESSION:\nThe holographic screen flickers slightly to convey urgency. The red warning light pulses rhythmically.\n// LIGHTING & MOOD:\nThe primary light source is the hologram itself, casting a mix of cyan and pulsing red light into the otherwise dimly lit cockpit, creating a tense and urgent mood."
        }
      ]
    }
  ]
}
```