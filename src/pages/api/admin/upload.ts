import type { NextApiRequest, NextApiResponse } from 'next';
import multer from 'multer';
import prisma from '../../../lib/prisma';
import { processFile } from '../../../services/aiProcessor';
import { IngestionStatus } from '@prisma/client';

// Configure Multer to store files in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

export const config = {
  api: {
    bodyParser: false,
  },
};

interface ExtendedNextApiRequest extends NextApiRequest {
  file: Express.Multer.File;
  body: {
    courseId?: string;
    adminId?: string;
  };
}

// Middleware helper
function runMiddleware(req: NextApiRequest, res: NextApiResponse, fn: Function) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result: any) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await runMiddleware(req, res, upload.single('file'));

    // Cast req to extended type after middleware has run
    const extendedReq = req as unknown as ExtendedNextApiRequest;
    const file = extendedReq.file;
    const { courseId, adminId } = extendedReq.body; // Multer parses body too

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!courseId) {
      return res.status(400).json({ error: 'Missing courseId' });
    }

    // Check if course exists (optional but good practice)
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
        return res.status(404).json({ error: 'Course not found' });
    }

    // Determine Admin User
    // Ideally, get from session. Here we rely on body or fallback to existing admin.
    let userId = adminId;
    if (!userId) {
       const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
       if (adminUser) {
         userId = adminUser.id;
       } else {
         // Create a fallback admin user if none exists (for testing/demo)
         const newAdmin = await prisma.user.create({
            data: {
                email: 'admin@example.com',
                name: 'Admin User',
                role: 'ADMIN',
            }
         });
         userId = newAdmin.id;
       }
    }

    if (!userId) {
        return res.status(500).json({ error: 'Could not determine admin user' });
    }

    // Create Ingestion Job
    const ingestionJob = await prisma.ingestionJob.create({
      data: {
        fileUrl: file.originalname,
        fileType: file.mimetype,
        status: IngestionStatus.PENDING,
        adminId: userId,
      },
    });

    // Process the file
    // Note: In production, use a queue. Here we await for simplicity/demo.
    await processFile(file.buffer, file.mimetype, ingestionJob.id, courseId);

    return res.status(200).json({
      message: 'File uploaded and processed successfully',
      jobId: ingestionJob.id,
    });

  } catch (error) {
    console.error('Upload handler error:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: (error as Error).message });
  }
}
