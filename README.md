# Interactive Animated Storybook Creation AI Agent

This project is an AI-powered agent that creates interactive and animated storybooks. It uses a "Story Constitution" as a blueprint for generating stories, which is a high-level creative outline that defines the story's theme, characters, setting, and interactive elements.

## Features

*   **Story Constitution Generation:** Automatically generates a comprehensive creative outline for a story based on a simple idea.
*   **Interactive Storytelling:** Creates stories with branching narratives and interactive elements.
*   **AI-Powered:** Uses Google Gemini to generate creative content.
*   **Supabase Integration:** Stores and manages stories in a Supabase database.

## Technology Stack

*   **Backend:** TypeScript, Node.js
*   **AI:** Google Gemini
*   **Storage:** Supabase

## Getting Started

### Prerequisites

*   Node.js
*   npm
*   Supabase account and project

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/your-username/story-tree.git
    ```
2.  Install the dependencies:
    ```bash
    npm install
    ```

### Configuration

1.  Create a `.env` file in the root of the project and add the following environment variables:
    ```
    GEMINI_API_KEY=your-gemini-api-key
    SUPABASE_URL=your-supabase-url
    SUPABASE_KEY=your-supabase-key
    ```

## Usage

### Generating a Story Constitution

To generate a new story constitution, run the following command:

```bash
npm run story-constitution:cli -- --brief "A story about a brave little robot who explores a mysterious planet."
```

This will generate a new story constitution and save it to the database.

### Managing Stories

The `supabase:stories-cli` provides a command-line interface for managing stories in the database.

**Commands:**

*   `list`: List all stories.
*   `get <id>`: Get a story by its ID.
*   `delete <id>`: Delete a story by its ID.

**Usage:**

```bash
npm run supabase:stories-cli list
npm run supabase:stories-cli get 1
npm run supabase:stories-cli delete 1
```
