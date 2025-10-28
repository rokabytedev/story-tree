export type StoryArtifact = {
  constitutionMarkdown: string;
  scriptYaml: string;
  visualDesignJson: Record<string, unknown>;
  visualReferenceJson: Record<string, unknown>;
  audioDesignJson: Record<string, unknown>;
};

export type StorySummary = {
  id: string;
  title: string;
  author: string;
  accentColor: string;
};

export const mockStory: StoryArtifact & StorySummary = {
  id: "sample-story-id",
  title: "The Luminous Grove",
  author: "Story Tree Agent",
  accentColor: "#6366f1",
  constitutionMarkdown: `# The Luminous Grove

## Tone & Themes
- Encourage curiosity and collaboration between child explorers.
- Balance wonder with gentle tension resolved through teamwork.

## Narrative Pillars
1. Discovery of a mysterious bioluminescent forest.
2. Meeting sentient fireflies that protect the grove.
3. Helping the grove heal from a creeping shadow.`,
  scriptYaml: `scenelet-1:
  description: Twins Mira and Sol discover a glowing trail leading into a forest.
  dialogue:
    - { speaker: Mira, line: "Do you see that light?" }
    - { speaker: Sol, line: "Let's find where it leads!" }
  choices:
    - handle: follow-trail
      label: Follow the glowing trail
scenelet-2:
  description: The twins meet a chorus of friendly fireflies.
  dialogue:
    - { speaker: Firefly Chorus, line: "We guard the grove. Will you help us?" }
  parent: follow-trail`,
  visualDesignJson: {
    summary:
      "Cool twilight palette with accents of neon violet and teal to highlight bioluminescent foliage.",
    key_locations: [
      {
        id: "grove-heart",
        palette: ["#1e1b4b", "#34d399", "#fbbf24"],
        inspiration: ["misty forest", "glowing fungi"],
      },
    ],
  },
  visualReferenceJson: {
    moodboard: [
      {
        label: "Firefly chorus concept",
        prompt: "children meet luminous firefly spirits in dense forest clearing night",
      },
    ],
    lighting_notes: "Soft volumetric light shafts with sparkling particles.",
  },
  audioDesignJson: {
    ambience: {
      description:
        "Layered night forest ambience with gentle drones and sporadic chimes.",
      instrumentation: ["glass harmonica", "soft synth pads", "handpan"],
    },
    motifs: [
      { name: "Firefly shimmer", tempo: 92, key: "D Mixolydian" },
      { name: "Grove heartbeat", tempo: 60, key: "F minor" },
    ],
  },
};

export const mockStories: StorySummary[] = [
  {
    id: mockStory.id,
    title: mockStory.title,
    author: mockStory.author,
    accentColor: mockStory.accentColor,
  },
  {
    id: "story-sea-song",
    title: "Sea Song for the Moon",
    author: "Story Tree Agent",
    accentColor: "#0ea5e9",
  },
  {
    id: "story-clockwork",
    title: "Clockwork Lantern",
    author: "Story Tree Agent",
    accentColor: "#f97316",
  },
];
