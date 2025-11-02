# goal
add background music to player

# requirements
music files are in `apps/story-tree-ui/public/generated/<story-id>/music` folder. each file is named after the `cue_name` field in audio design document `music_and_ambience_cues[].cue_name`.

when building the story player ui bundle, should include the background music files as well. and when playing the story, for the shots in the corresponding scenes in the `music_and_ambience_cues[].associated_scenelet_ids` field, should play the background music from `<story-id>/music/<cue_name>.m4a`.

the background music will be played at the same time as the image shows immediately. i.e. it doesn't have the same "grace period" as the dialog audio plays. the volume of the music should be configurable (with code, not ui). so that i can tune it to be balanced with the dialog audio volume (which should also be configurable).
by "configurable" - i mean simply a constant in code or something is enough. nothing fancy needed.

the music file will always cover consecutive scenes. meaning the `music_and_ambience_cues[].associated_scenelet_ids` field will always be like:
```json
        "associated_scenelet_ids": [
          "scenelet-<N>",
          "scenelet-<N+1>",
          "scenelet-<N+2>"
          // ...
        ],

```
if not, it's a validation error. but you can ignore it for now. print a WARNING to console for now, if your code change needs to touch this part.

so that means the player should respect the music's continuity when switching shots from one scenelet to the next scenelet. e.g. the music should continue when switching scene, if the both scenes are using the same music, instead of playing the music from start again.

for example:
```json

{
    "cue_name": "Music Piece A",
        "associated_scenelet_ids": [
          "scenelet-3",
          "scenelet-4"
        ],
    "cue_name": "Music Piece B",
        "associated_scenelet_ids": [
          "scenelet-6"
        ],
}
```
then the music should play like this:
- for shots in "scenelet-3", play `Music Piece A.m4a`.
- for shots in "scenelet-4", continue the music `Music Piece A.m4a`, don't stop, don't start over from beginning.
- for shots in "scenelet-6", switch to play `Music Piece B.m4a`. stop `Music Piece A.m4a` and play `Music Piece B.m4a` from start.

transistion:
when switching music, there should be cross-fade effect. the cross-fade period should configurable with a code constant or something like that simple. by default it's 0.5s to just make the transition not too abruptive.

for scenes without music file existing, it's totally fine for now. maybe an WARNING. but not breaking the player bundle creation process. when no music is present, just don't play music during playing the storybook.
