# System Architecture: Engineering Quiz Platform

## 1. Core Architecture & Data Hierarchy

The system is built on a scalable, enterprise-grade architecture using Next.js, Python (FastAPI), and PostgreSQL. The data model enforces a strict hierarchy to support multiple departments and academic levels.

### Data Hierarchy

The database schema is designed to support the following drill-down structure:

1.  **Department**: The academic department (e.g., Electrical Engineering, Computer Science).
2.  **Level**: The academic year (e.g., 100 Level, 200 Level).
3.  **Course**: The specific subject (e.g., GET 209, SSG 203).
    *   A Course belongs to one Department and one Level.
    *   *Note: For cross-departmental courses, they are assigned to the primary department offering them.*
4.  **Topic (Module)**: A specific area within a course (e.g., "Calculus", "Thermodynamics").
5.  **Question**: The individual assessment item.
    *   Includes text, images, options (for MCQ), and detailed explanations.
    *   Tagged with a specific Topic.

## 2. AI Content Ingestion Engine

The core USP is the "Upload-to-Quiz" pipeline, allowing admins to bulk-upload raw content which is automatically processed into structured quiz data.

### Pipeline Architecture

```mermaid
graph TD
    A[Admin Client] -->|Upload File| B(Next.js API)
    B -->|Save to Storage| C[Object Storage (S3/Supabase)]
    B -->|Create IngestionJob| D[PostgreSQL DB]
    B -->|Trigger Processing| E[AI Service (Python/FastAPI)]

    subgraph "AI Processing Pipeline"
    E -->|Fetch File| C
    E -->|1. OCR & Extraction| F[Text/Image Extractor]
    F -->|Raw Content| G[LLM Agent (OpenAI/Claude)]
    G -->|2. Analyze & Solve| H[Structured JSON]
    end

    H -->|3. Save Draft Questions| D
    D -->|Update Job Status| I[Admin Dashboard]

    I -->|Review & Publish| J[Live Quiz Platform]
```

### Process Flow

1.  **Upload**: Admin uploads raw files (PDF, Word, Image) via the Admin Dashboard.
2.  **Ingestion Job**: The system creates an `IngestionJob` record with status `PENDING`.
3.  **AI Processing**:
    *   **Extraction**: The Python service downloads the file and uses OCR (e.g., Tesseract, Unstructured) to extract text and identify images.
    *   **Analysis**: An LLM (Large Language Model) analyzes the content to identify questions, options, and context.
    *   **Solving**: The LLM solves each question to determine the correct answer and generates a detailed step-by-step explanation.
    *   **Tagging**: Questions are categorized into relevant Topics.
4.  **Draft Mode**: Extracted questions are saved to the database with `status: DRAFT`.
5.  **Review**: Admins review the drafted questions, make necessary edits, and change status to `PUBLISHED`.

## 3. Student Experience

### Navigation
Students use a drill-down selector to find content:
`Department -> Level -> Course -> Topic`

### Modes
*   **Practice Mode**: Immediate feedback with AI-generated explanations after every question.
*   **Exam Mode**: Timed simulation with no feedback until submission.

### Gamification
*   **XP System**: Points awarded for correct answers and streaks.
*   **Leaderboards**: Global rankings filterable by Department and Level.
