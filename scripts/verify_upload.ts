import prisma from '../src/lib/prisma';
import { processFile } from '../src/services/aiProcessor';
import { IngestionStatus } from '@prisma/client';

async function main() {
  console.log('Starting verification...');

  try {
    // 1. Setup Data
    console.log('Setting up test data...');

    // Create Department
    const department = await prisma.department.upsert({
      where: { code: 'TEST_DEPT' },
      update: {},
      create: {
        name: 'Test Department',
        code: 'TEST_DEPT',
      },
    });

    // Create Level
    const level = await prisma.level.upsert({
      where: { value: 100 },
      update: {},
      create: {
        name: '100 Level',
        value: 100,
      },
    });

    // Create Course
    const course = await prisma.course.upsert({
      where: { code: 'TEST_101' },
      update: {},
      create: {
        title: 'Test Course 101',
        code: 'TEST_101',
        departmentId: department.id,
        levelId: level.id,
      },
    });

    // Create Admin User
    const adminUser = await prisma.user.upsert({
        where: { email: 'admin@test.com' },
        update: {},
        create: {
            email: 'admin@test.com',
            name: 'Test Admin',
            role: 'ADMIN'
        }
    });

    console.log(`Course created/found: ${course.id}`);

    // 2. Create IngestionJob
    console.log('Creating IngestionJob...');
    const ingestionJob = await prisma.ingestionJob.create({
      data: {
        fileUrl: 'test-file.txt',
        fileType: 'text/plain',
        status: IngestionStatus.PENDING,
        adminId: adminUser.id,
      },
    });

    console.log(`IngestionJob created: ${ingestionJob.id}`);

    // 3. Process File (Mock)
    console.log('Processing file...');
    const mockFileBuffer = Buffer.from('This is a test content for the AI to process.');
    const mimeType = 'text/plain';

    // Call the service directly
    // Note: This will use the mock OpenAI response if API key is missing
    const result = await processFile(mockFileBuffer, mimeType, ingestionJob.id, course.id);

    console.log('Processing complete. Result:', JSON.stringify(result, null, 2));

    // 4. Verify Database Records
    console.log('Verifying database records...');

    // Check IngestionJob status
    const updatedJob = await prisma.ingestionJob.findUnique({
      where: { id: ingestionJob.id },
      include: { questions: true },
    });

    if (updatedJob?.status !== IngestionStatus.COMPLETED) {
      throw new Error(`IngestionJob status is ${updatedJob?.status}, expected COMPLETED`);
    }
    console.log('IngestionJob status verified: COMPLETED');

    // Check Questions
    const questions = await prisma.question.findMany({
      where: { ingestionJobId: ingestionJob.id },
      include: { options: true, explanation: true, topic: true },
    });

    console.log(`Found ${questions.length} questions created.`);

    if (questions.length === 0) {
      throw new Error('No questions were created.');
    }

    const q = questions[0];
    console.log('First Question:', {
      content: q.content,
      topic: q.topic.name,
      optionsCount: q.options.length,
      explanation: q.explanation?.content,
    });

    // Basic assertions
    if (q.topic.courseId !== course.id) {
        throw new Error('Topic is not linked to the correct course.');
    }

    console.log('Verification SUCCESS!');

  } catch (error) {
    console.error('Verification FAILED:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
