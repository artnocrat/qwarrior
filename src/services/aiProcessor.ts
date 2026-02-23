import prisma from '../lib/prisma';
import OpenAI from 'openai';
import { IngestionStatus, QuestionType, QuestionStatus } from '@prisma/client';
import { AIResponse, AIQuestion } from '../types/ai';

// Initialize OpenAI client
// In a real app, this would be process.env.OPENAI_API_KEY
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'mock-key',
});

const SYSTEM_PROMPT = `
You are an expert academic assistant and question bank generator. Your task is to process the provided academic material (which may be an image of a document or text) and extract multiple-choice questions or theory questions.

For each question identified:
1. **Extract** the question text and any associated images.
2. **Identify** all options (if multiple choice).
3. **Solve** the question to find the correct answer.
4. **Generate** a detailed, helpful explanation for why the correct answer is correct and why others are incorrect.
5. **Tag** the question with a specific topic (e.g., "Thermodynamics", "Calculus", "Circuit Theory").
6. **Determine** the difficulty level (1-5).

**Strict Output Format:**
You must return a valid JSON object matching the following structure exactly. Do not include any markdown formatting (like \`\`\`json) or conversational text.

{
  "questions": [
    {
      "question_text": "The text of the question...",
      "question_type": "MULTIPLE_CHOICE" or "THEORY",
      "options": [
        { "text": "Option A text", "is_correct": false },
        { "text": "Option B text", "is_correct": true }
      ],
      "correct_answer_explanation": "Detailed explanation...",
      "topic": "Topic Name",
      "difficulty_level": 3
    }
  ]
}
`;

export async function processFile(
  fileBuffer: Buffer,
  mimeType: string,
  ingestionJobId: string,
  courseId: string
) {
  try {
    // 1. Update status to PROCESSING
    await prisma.ingestionJob.update({
      where: { id: ingestionJobId },
      data: { status: IngestionStatus.PROCESSING },
    });

    // 2. Prepare content for AI
    // For images, we send base64. For text/pdf, we would extract text.
    // Here we handle images directly for GPT-4o.
    // For PDF, we assume it's converted to images or text extraction is done separately.
    // This example focuses on the AI interaction part.

    let userContent: any;

    if (mimeType.startsWith('image/')) {
      const base64Image = fileBuffer.toString('base64');
      userContent = [
        {
          type: 'text',
          text: 'Please analyze this image and extract the questions as per the instructions.',
        },
        {
          type: 'image_url',
          image_url: {
            url: `data:${mimeType};base64,${base64Image}`,
          },
        },
      ];
    } else {
      // Assume text for other formats or implement PDF extraction
      userContent = [
        {
          type: 'text',
          text: `Please analyze the following text content and extract the questions:\n\n${fileBuffer.toString('utf-8')}`,
        },
      ];
    }

    // 3. Call AI Model
    let aiResponseText = '';

    if (process.env.OPENAI_API_KEY) {
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo', // or gpt-4o
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });
      aiResponseText = response.choices[0].message.content || '{}';
    } else {
      // Mock response for testing/development without API key
      console.log('Mocking OpenAI response...');
      aiResponseText = JSON.stringify({
        questions: [
          {
            question_text: "What is the capital of France?",
            question_type: "MULTIPLE_CHOICE",
            options: [
              { text: "Paris", is_correct: true },
              { text: "London", is_correct: false },
              { text: "Berlin", is_correct: false }
            ],
            correct_answer_explanation: "Paris is the capital of France.",
            topic: "Geography",
            difficulty_level: 1
          }
        ]
      });
    }

    // 4. Parse Response
    const parsedData: AIResponse = JSON.parse(aiResponseText);

    // 5. Database Transaction to save everything
    await prisma.$transaction(async (tx) => {
      // Fetch the course to get department and level (though we might already have them)
      // Assuming courseId is passed and valid.

      for (const q of parsedData.questions) {
        // Find or create Topic
        // We need to ensure the topic exists within the course
        // Using upsert might be tricky with relations, so findFirst then create is safer or connectOrCreate

        let topic = await tx.topic.findFirst({
            where: {
                name: q.topic,
                courseId: courseId
            }
        });

        if (!topic) {
            topic = await tx.topic.create({
                data: {
                    name: q.topic,
                    courseId: courseId
                }
            });
        }

        // Create Question
        const question = await tx.question.create({
          data: {
            content: q.question_text,
            type: q.question_type as QuestionType,
            difficulty: q.difficulty_level,
            topicId: topic.id,
            status: QuestionStatus.DRAFT,
            ingestionJobId: ingestionJobId,
          },
        });

        // Create Options
        if (q.options && q.options.length > 0) {
          await tx.option.createMany({
            data: q.options.map((opt) => ({
              content: opt.text,
              isCorrect: opt.is_correct,
              questionId: question.id,
            })),
          });
        }

        // Create Explanation
        if (q.correct_answer_explanation) {
          await tx.explanation.create({
            data: {
              content: q.correct_answer_explanation,
              questionId: question.id,
            },
          });
        }
      }

      // Update IngestionJob status to COMPLETED
      await tx.ingestionJob.update({
        where: { id: ingestionJobId },
        data: { status: IngestionStatus.COMPLETED },
      });
    });

    console.log(`Successfully processed ingestion job ${ingestionJobId}`);
    return parsedData;

  } catch (error) {
    console.error('Error processing file:', error);
    // Update IngestionJob status to FAILED
    await prisma.ingestionJob.update({
      where: { id: ingestionJobId },
      data: { status: IngestionStatus.FAILED },
    });
    throw error;
  }
}
