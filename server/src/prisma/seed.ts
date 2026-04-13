import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('🌱 Seeding database...');

  // Create demo user
  const user = await prisma.user.upsert({
    where: { email: 'pm@telus.com' },
    update: {},
    create: {
      email: 'pm@telus.com',
      name: 'Demo PM',
      role: 'ADMIN',
      settings: {
        create: {
          language: 'en',
          tone: 'Formal',
          systemPromptPrefix:
            'You are working within Telus Digital, a Canadian digital transformation consultancy. ' +
            'Always follow Telus brand voice: clear, helpful, and human. ' +
            'All products must consider accessibility (WCAG 2.1 AA), bilingual requirements (English/French), ' +
            'and Canadian privacy regulations (PIPEDA/CPPA).',
        },
      },
    },
  });

  // Create sample project
  const project = await prisma.project.upsert({
    where: { id: 'seed-project-001' },
    update: {},
    create: {
      id: 'seed-project-001',
      name: 'Koodo Mobile App Redesign',
      description: 'Redesign of the Koodo self-serve mobile application',
      clientContext:
        'Client: Koodo Mobile (Telus subsidiary)\n' +
        'Industry: Telecommunications\n' +
        'Business goals: Increase self-serve adoption by 40%, reduce call centre volume, improve NPS by 15 points\n' +
        'User types: Koodo prepaid and postpaid subscribers aged 18–45, tech-comfortable but not tech-savvy\n' +
        'Tech constraints: React Native (iOS + Android), REST APIs, no native device SDKs beyond push notifications\n' +
        'Regulatory: CRTC consumer protection, PIPEDA data privacy, WCAG 2.1 AA accessibility\n' +
        'Existing systems: Amdocs BSS, Salesforce CRM, Adobe Analytics',
    },
  });

  // Add user to project
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId: user.id } },
    update: {},
    create: {
      projectId: project.id,
      userId: user.id,
      role: 'ADMIN',
    },
  });

  // Create sample PRD
  await prisma.document.upsert({
    where: { id: 'seed-doc-001' },
    update: {},
    create: {
      id: 'seed-doc-001',
      title: 'Koodo App — Account Overview Redesign PRD',
      type: 'PRD',
      status: 'DRAFT',
      content: JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'Account Overview Redesign PRD' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Click "Generate" to populate this document with AI-generated content.' }],
          },
        ],
      }),
      projectId: project.id,
      authorId: user.id,
    },
  });

  console.log('✅ Seed complete');
  console.log(`   User: ${user.email}`);
  console.log(`   Project: ${project.name}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
