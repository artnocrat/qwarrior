# Product Requirement Document (PRD): Engineering Quiz Platform

## 1. Project Overview

**Project Goal**: Build a responsive web application that serves as a gamified "Past Question Bank" and "Interactive Quiz Platform" for university engineering students.

**Target Audience**: University Engineering Students, specifically those taking the following courses:
-   **The Big Four**: GET 209 (Maths I), GET 201 (Applied Electricity I), GET 205 (Fluid Mechanics), GET 211 (Computing).
-   **Core Courses**: SSG 203 (Solid Modelling), LAG-EEG 213 (Signals & Systems), LAG-GET 207 (Mechanics), ENT 211 (Entrepreneurship).

## 2. Core Features

### 2.1 Student Interface (Frontend)
-   **Course Selection & Filtering**:
    -   Users can select a specific course (e.g., GET 205).
    -   Users can filter questions by specific Topics (e.g., "Bernoulli's Equation").
-   **Quiz Mode**:
    -   Interactive interface for answering questions.
    -   Immediate feedback (Correct/Incorrect).
    -   **Detailed Explanation**: A dropdown available for every question explaining the solution.
-   **Dashboard**:
    -   View progress, recent quiz scores, and earned badges.

### 2.2 Gamification
-   **User Profiles**:
    -   Track XP (Experience Points) gained from completing quizzes.
    -   Leveling system based on XP.
-   **Leaderboard**:
    -   Global ranking based on Accuracy (percentage correct) and Streak (consecutive days/quizzes).
-   **Badges**:
    -   Awarded for specific achievements (e.g., "Fluid Mechanics Master" for scoring >90% in GET 205).

### 2.3 Admin Automation (AI Pipeline)
-   **Admin Dashboard**:
    -   Interface for uploading raw files: PDF slides, Images of past papers, Word documents.
-   **AI Processing Agent**:
    -   **Input**: Raw file.
    -   **Process**:
        1.  **Ingestion**: Scan document.
        2.  **Extraction**: Identify questions and options (if multiple choice) or problem statements.
        3.  **Solving**: Solve the problem to determine the correct answer.
        4.  **Explanation**: Generate a step-by-step explanation.
        5.  **Categorization**: Tag the question with the relevant Course and Topic.
    -   **Output**: Structured data (JSON) inserted into the database.

## 3. Technical Architecture

### 3.1 Tech Stack Recommendation
-   **Frontend**: **Next.js (React)**
    -   Why: Excellent for SEO, server-side rendering (SSR) for initial load, and a rich ecosystem of UI components (e.g., Shadcn/UI, Tailwind CSS).
-   **Backend**: **Next.js API Routes** (for standard CRUD) + **Python (FastAPI)** (for AI Microservice)
    -   Why: Next.js handles the application logic well. Python is superior for document processing (OCR, PDF parsing) and LLM integration.
-   **Database**: **PostgreSQL** (via **Supabase**)
    -   Why: Relational data is crucial for the structured nature of Courses/Topics/Questions. Supabase offers easy auth and real-time features.
-   **ORM**: **Prisma**
    -   Why: Type-safe database access, easy schema management, and great integration with Next.js.
-   **AI/ML**:
    -   **OCR**: Tesseract, Azure Document Intelligence, or `unstructured` library (Python).
    -   **LLM**: OpenAI GPT-4o or Anthropic Claude 3.5 Sonnet (accessed via API).

### 3.2 "Upload-to-Quiz" AI Pipeline Logic

1.  **Upload**: Admin uploads a file to the Next.js API.
2.  **Storage**: File is stored in a temporary bucket (e.g., Supabase Storage or AWS S3).
3.  **Trigger**: Next.js triggers the Python AI Service with the file URL.
4.  **Python Processing**:
    ```python
    def process_document(file_url):
        # 1. Extract Text/Images
        content = extract_content(file_url) # using 'unstructured' or similar

        # 2. LLM Processing
        # Prompt the LLM to identify questions, solve them, and categorize.
        # Enforce JSON output format.
        prompt = f"""
        Analyze the following content from an engineering past question paper.
        Extract all questions. For each question:
        - Identify the Question Text.
        - Identify Options (if applicable).
        - Solve it and provide the Correct Answer.
        - Write a detailed Explanation.
        - Categorize it into a Topic.
        Content: {content}
        Output JSON format: [...]
        """
        response = call_llm(prompt)
        return parse_json(response)
    ```
5.  **Database Insertion**: The structured JSON is sent back to the Next.js backend (or inserted directly by the Python service) to populate the `Question`, `Option`, and `Explanation` tables.

## 4. Data Structure (Database Schema)

The database will follow a hierarchical structure:

-   **User**: Stores profile, XP, stats.
-   **Course**: Top-level category (e.g., GET 205).
-   **Topic**: Sub-category within a course (e.g., Fluid Dynamics).
-   **Question**: The actual problem statement, linked to a Topic.
-   **Option**: Choices for the question (if MCQ).
-   **Answer/Explanation**: The correct solution and reasoning.
-   **QuizAttempt**: Records a user's attempt at a quiz/question.

### Schema Relationships
-   `Course` 1-to-many `Topic`
-   `Topic` 1-to-many `Question`
-   `Question` 1-to-many `Option`
-   `Question` 1-to-1 `Explanation`
-   `User` 1-to-many `QuizAttempt`
