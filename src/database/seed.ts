import type { SQLiteDatabase } from 'expo-sqlite';
import { ProjectRepository } from './repositories/projectRepository';
import { AgreementRepository } from './repositories/agreementRepository';
import { ScopeGuardRepository } from './repositories/scopeGuardRepository';
import { ProposalRepository } from './repositories/proposalRepository';
import { SettingsRepository } from './repositories/settingsRepository';

export async function seedDemoDataAsync(db: SQLiteDatabase): Promise<boolean> {
  const projectRepo = new ProjectRepository(db);
  const existingProjects = await projectRepo.list();

  if (existingProjects.length > 0) {
    return false; // Database already has data, do not duplicate
  }

  const agreementRepo = new AgreementRepository(db);
  const scopeGuardRepo = new ScopeGuardRepository(db);
  const proposalRepo = new ProposalRepository(db);
  const settingsRepo = new SettingsRepository(db);

  // Set default LM Studio URL in settings if not configured
  await settingsRepo.set('lm_studio_url', 'http://10.0.2.2:1234/v1');
  await settingsRepo.set('lm_studio_model', 'local-model');

  const projectId = 'proj_demo_website_01';
  const agreementId = 'agmt_demo_v1_01';
  const requestId = 'req_demo_request_01';
  const analysisId = 'ana_demo_analysis_01';
  const proposalId = 'prop_demo_proposal_01';
  const now = new Date().toISOString();

  // 1. Create Project
  await projectRepo.create({
    id: projectId,
    title: 'Acme Studios: 5-Page Website',
    clientName: 'Acme Studios (Sarah)',
    description: 'Corporate website design and development agreed via chat.',
  });

  // 2. Create Agreement v1
  await agreementRepo.create({
    id: agreementId,
    projectId,
    versionNumber: 1,
    title: 'Website Design and Build Agreement v1',
    requirements: [
      {
        id: 'REQ-01',
        title: 'Five responsive website pages',
        description: 'Home, About, Services, Portfolio, and Contact pages built for mobile and desktop.',
        category: 'deliverable',
      },
      {
        id: 'REQ-02',
        title: 'Contact form integration',
        description: 'Basic inquiry form sending customer submissions to client inbox.',
        category: 'deliverable',
      },
      {
        id: 'REQ-03',
        title: 'Two rounds of revisions',
        description: 'Up to two revision cycles included during the design and staging phase.',
        category: 'term',
      },
    ],
    budgetAmount: 15000,
    budgetCurrency: 'PHP',
    budgetNotes: 'Agreed fixed price for initial 5-page scope.',
    durationDays: 14,
    deadline: null,
    timelineNotes: 'Two-week estimated turnaround from deposit.',
    revisionTerms: 'Two rounds of revisions included. Additional revisions quoted separately.',
    exclusions: [
      'User account authentication and member portal',
      'Appointment booking calendar engine',
    ],
    missingInformation: [
      'Copywriting and high-resolution photo assets from client',
    ],
    taxTreatment: 'net_of_withholding',
    confirmedAt: now,
  });

  // 3. Create Sample Client Request
  await scopeGuardRepo.createRequest({
    id: requestId,
    projectId,
    agreementId,
    rawText: 'Could you also add a login portal for our clients and an appointment booking calendar?',
    createdAt: now,
  });

  // 4. Create ScopeGuard Analysis
  await scopeGuardRepo.createAnalysis({
    id: analysisId,
    requestId,
    agreementId,
    classification: 'potential_additional',
    summary: 'Both the client login portal and appointment booking calendar introduce new capabilities beyond Agreement v1.',
    findings: [
      {
        item: 'Client login portal',
        classification: 'potential_additional',
        explanation: 'No authentication or member portal exists in the recorded deliverables (REQ-01..REQ-03).',
        evidenceRequirementIds: [],
      },
      {
        item: 'Appointment booking calendar',
        classification: 'potential_additional',
        explanation: 'The confirmed agreement includes only a basic contact inquiry form (REQ-02), not a calendar booking engine.',
        evidenceRequirementIds: ['REQ-02'],
      },
    ],
    clarificationQuestions: [
      'Does appointment booking require external calendar sync (Google/Outlook) or online payment collection?',
    ],
    createdAt: now,
  });

  // 5. Create Change Proposal
  await proposalRepo.create({
    id: proposalId,
    projectId,
    analysisId,
    selectedItems: [
      'Client login portal',
      'Appointment booking calendar',
    ],
    freelancerFeeEstimate: 7000,
    freelancerDaysEstimate: 5,
    currency: 'PHP',
    draftMessage:
      'Hi Sarah! Thanks for the update. Looking over our initial agreement, the client login portal and appointment booking calendar are additions to our confirmed 5-page scope and contact form. I would love to build these for you! That will take about 5 additional working days and PHP 7,000. Let me know if that works for you and I will prepare the updated schedule!',
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  });

  return true;
}
