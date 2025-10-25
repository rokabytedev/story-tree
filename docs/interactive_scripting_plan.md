# Goal

**MUST** first immerse to read and understand system_prompts/interactive_scriptwriter.md file carefully to understand the Gemini API generation prompt and response JSON format.

1.  **The Generation Algorithm:** A stateful, iterative process for calling the Gemini API to build out the complete story tree.
2.  **The Database Schema:** A design for storing the story tree's scenelets efficiently in a Supabase (PostgreSQL) database.

---

# Technical Design Document: Interactive Story Generator

## 1. Story Tree Generation Algorithm

### High-Level Concept

The core of this process is a **Depth-First Traversal (DFS)** algorithm. We will generate one complete path of the story from beginning to end, and then backtrack to the most recent unexplored branch to generate its path. This continues until the entire story tree is populated.

To manage the state of the generation process (i.e., which branches we still need to explore), we will use a **stack**. Each item on the stack will represent a "task" or an unexplored path that needs to be generated.

### State Management & Data Structures

We'll manage the generation process using a stack called `generation_stack`. Each element in the stack will be an object representing the starting point for a new generation sequence:

```typescript
interface GenerationTask {
  story_id: string;
  parent_scenelet_id: string | null; // null for the root
  path_context: Scenelet[]; // The linear history of scenelets leading to this point
}
```

### Algorithm Pseudocode

Here is the step-by-step logic, which can be implemented in a server-side environment (e.g., a Node.js script, a Python Celery task, or a serverless function).

When implementing this function(s), should make the core business and "shell code" separate so that the core business is easily testable without needing real DB interactions.

```python
#
# Main Orchestrator Function
#
def generate_full_story_tree(story_id, story_constitution):
    # 1. Validate story_id and story_constitution not empty and some other validations.

    # 2. Initialize
    generation_stack = []
    
    # 3. Push the first generation task onto the stack
    initial_task = {
        "story_id": story_id,
        "parent_scenelet_id": null, # means it's the root scenelet
        "path_context": []
    }
    generation_stack.push(initial_task)

    # 4. Main Generation Loop
    while generation_stack is not empty:
        current_task = generation_stack.pop()
        
        # 5. Prepare API Payload
        # The 'path_context' is the linear sequence of scenelets for the AI
        # Setting `instruction` to different value based on if this is root scenelet
        # (can check `path_context` being empty or `parent_scenelet_id` being null).
        api_payload = {
            "story_constitution": story_constitution,
            "current_narrative_path": current_task.path_context
            "instruction": "Now start with the first scenelet (if root)" | "Now continue (if not root)"
        }

        # 6. Call Gemini API
        # call_gemini_scriptwriter_api should do:
        # Use the content from system_prompts/interactive_scriptwriter.md as the system prompt
        # Concat `story_constitution`, `current_narrative_path` and `instruction`
        # (with proper section headers and spacing)
        # (handle empty `current_narrative_path` properly - not adding that section)
        # to format the user prompt for Gemini API call to generate content.
        api_response = call_gemini_scriptwriter_api(api_payload) # Returns parsed JSON

        # 7. Process Response and Update State
        parent_id_for_new_scenelets = current_task.parent_scenelet_id

        # --- Case A: Linear Continuation (No Branch) ---
        if not api_response.branch_point and not api_response.is_concluding_scene:
            new_scenelet_data = api_response.next_scenelets[0]
            
            # Save the single new scenelet to the DB
            new_scenelet_id = save_scenelet_to_db(
                story_id=story_id,
                parent_id=parent_id_for_new_scenelets,
                content=new_scenelet_data
            )
            
            # Create the next task and push it to the stack to continue this path
            next_task = {
                "story_id": story_id,
                "parent_scenelet_id": new_scenelet_id,
                # note that this should be a deep copy instead of a reference to avoid different tasks interfere
                # with each other.
                "path_context": current_task.path_context + [new_scenelet_data]
            }
            generation_stack.push(next_task)
        
        # --- Case B: Narrative Branch ---
        # api_response.branch_point is true but not concluding scene yet.
        else if not api_response.is_concluding_scene:
            # Mark the parent scenelet as a branch point in the DB
            # Also need to store the `choice_prompt` to the parent scenelet
            mark_scenelet_as_branch_point(parent_id_for_new_scenelets, api_response.choice_prompt)
            
            scenelet_A_data = api_response.next_scenelets[0]
            scenelet_B_data = api_response.next_scenelets[1]

            # Save both potential scenelets to the DB
            scenelet_A_id = save_scenelet_to_db(
                story_id=story_id,
                parent_id=parent_id_for_new_scenelets,
                choice_label=scenelet_A_data.choice_label,
                content=scenelet_A_data
            )
            scenelet_B_id = save_scenelet_to_db(
                story_id=story_id,
                parent_id=parent_id_for_new_scenelets,
                choice_label=scenelet_B_data.choice_label,
                content=scenelet_B_data
            )

            # We now have two new paths to explore. We push them BOTH onto the stack.
            # The DFS nature of the stack means we'll fully explore one before the other.
            
            # Push task for Path B first (will be processed later)
            task_B = {
                "story_id": story_id,
                "parent_scenelet_id": scenelet_B_id,
                "path_context": current_task.path_context + [scenelet_B_data]
            }
            generation_stack.push(task_B)

            # Push task for Path A last (will be processed next)
            task_A = {
                "story_id": story_id,
                "parent_scenelet_id": scenelet_A_id,
                "path_context": current_task.path_context + [scenelet_A_data]
            }
            generation_stack.push(task_A)

        # --- Case C: Concluding Scene ---
        else: # api_response.is_concluding_scene is true
            concluding_scenelet_data = api_response.next_scenelets[0]
            
            # Save the concluding scenelet to the DB
            new_scenelet_id = save_scenelet_to_db(
                story_id=story_id,
                parent_id=parent_id_for_new_scenelets,
                content=concluding_scenelet_data
            )

            # No more scenelets down the current story path. Continue with the other branches.
            
    print(f"Story tree generation for story_id {story_id} is complete.")

```

## 2. Supabase Database Schema Design

To store the story tree, we will use two tables: `stories` (which you mentioned already exists) and a new `scenelets` table.

### `stories` Table (Existing)

This table holds the high-level information for each story.

```sql
CREATE TABLE public.stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_constitution JSONB, -- Storing the entire constitution here
    -- other columns ...
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### `scenelets` Table (New Design)

This is the core table for storing the nodes of our story tree. Each row is a single scenelet. The tree structure is created via the `parent_id` self-referencing link.

```sql
CREATE TABLE public.scenelets (
    -- Core Columns
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
    
    -- Tree Structure Columns
    parent_id UUID REFERENCES public.scenelets(id) ON DELETE CASCADE, -- NULL for the root scenelet
    choice_label_from_parent TEXT, -- The user-facing text for the choice that led to this scenelet (e.g., "Explore the shipwreck"). Only set if the parent is a branching point
    choice_prompt TEXT, -- A clear, user-facing question that presents the choice. (e.g., 'What should Finn do next?'). Only set if this scenelet is a branching point

    -- Content Column
    content JSONB NOT NULL, -- Stores the full JSON from the Gemini API: description, dialogue, shot_suggestions etc.

    -- Metadata and Flags
    is_branch_point BOOLEAN DEFAULT false, -- Flagged as TRUE if this scenelet leads to a choice
    is_terminal_node BOOLEAN DEFAULT false, -- Flagged as TRUE when the generation algo determines a path has ended
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performant lookups
CREATE INDEX idx_scenelets_story_id ON public.scenelets(story_id);
CREATE INDEX idx_scenelets_parent_id ON public.scenelets(parent_id);
```

### Schema Explanation:

1.  **`id` (Primary Key):** A unique identifier for each scenelet.
2.  **`story_id` (Foreign Key):** Links each scenelet back to its parent story. `ON DELETE CASCADE` ensures that if a story is deleted, all its associated scenelets are also deleted.
3.  **`parent_id` (Self-Referencing Foreign Key):** This is the key to our tree structure. It points to the `id` of the scenelet that came directly before this one. The very first scenelet of a story (the root) will have a `NULL` `parent_id`.
4.  **`choice_label_from_parent` (TEXT):** When a scenelet is the result of a choice, this field stores the text of that choice (e.g., "Follow the dolphin"). This is crucial for displaying the correct button text when a user is playing the story.
5. **`choice_prompt` (TEXT):** When the scenelet is a branching point, this field stores the text of the question that presents the choice (e.g., 'What should Finn do next?').
6.  **`content` (JSONB):** We use a `JSONB` column to flexibly store the entire content payload from the Gemini API. This is highly efficient and means we don't need separate columns for `description`, `dialogue`, etc. We can add or remove fields from the AI's output without changing our database schema.
7.  **`is_branch_point` (BOOLEAN):** A simple flag to quickly identify nodes that present a choice to the user. This is useful for UI rendering and for our generation algorithm.
8.  **`is_terminal_node` (BOOLEAN):** A flag to mark the end of a narrative path. This can be set if the AI returns a specific signal or if a path reaches a certain depth.
9.  **Indexes:** Indexes on `story_id` and `parent_id` are critical for quickly retrieving all scenelets for a story or finding the children of a specific scenelet.
