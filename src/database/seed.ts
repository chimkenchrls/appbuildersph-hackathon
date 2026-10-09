import type { SQLiteDatabase } from 'expo-sqlite';
import { ProjectRepository } from './repositories/projectRepository';
import { AgreementRepository } from './repositories/agreementRepository';
import { ScopeGuardRepository } from './repositories/scopeGuardRepository';
import { ProposalRepository } from './repositories/proposalRepository';
import { SettingsRepository } from './repositories/settingsRepository';

export async function seedDemoDataAsync(db: SQLiteDatabase, force: boolean = false): Promise<boolean> {
  const projectRepo = new ProjectRepository(db);
  const existingHarbor = await projectRepo.getById('proj_harbor_studio');

  if (existingHarbor && !force) {
    return false; // Database already has Harbor Studio seed data
  }

  if (existingHarbor && force) {
    await db.runAsync('DELETE FROM proposals;');
    await db.runAsync('DELETE FROM scope_analyses;');
    await db.runAsync('DELETE FROM client_requests;');
    await db.runAsync('DELETE FROM requirements;');
    await db.runAsync('DELETE FROM agreements;');
    await db.runAsync('DELETE FROM projects;');
  }

  const agreementRepo = new AgreementRepository(db);
  const scopeGuardRepo = new ScopeGuardRepository(db);
  const proposalRepo = new ProposalRepository(db);
  const settingsRepo = new SettingsRepository(db);

  // Set default LM Studio URL in settings if not configured
  const defaultUrl = process.env.EXPO_PUBLIC_LM_STUDIO_URL || 'http://10.0.2.2:1234/v1';
  const defaultModel = process.env.EXPO_PUBLIC_LM_STUDIO_MODEL || 'local-model';
  await settingsRepo.set('lm_studio_url', defaultUrl);
  await settingsRepo.set('lm_studio_model', defaultModel);

  const now = new Date().toISOString();
  const earlier = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // 1. Create Harbor Studio Project
  await projectRepo.create({
    id: 'proj_harbor_studio',
    title: 'Harbor Studio',
    clientName: 'Harbor Studio',
    description: 'Project field',
  });

  // Harbor Studio: Agreement v1
  await agreementRepo.create({
    id: 'agmt_harbor_v1',
    projectId: 'proj_harbor_studio',
    versionNumber: 1,
    title: 'Website design & development · Agreement v1',
    requirements: [
      {
        id: 'REQ-01',
        title: 'Five responsive pages',
        description: 'Home, About, Services, Work and Contact.',
        category: 'deliverable',
      },
      {
        id: 'REQ-02',
        title: 'Contact form',
        description: 'Send enquiries to the client.',
        category: 'deliverable',
      },
    ],
    budgetAmount: 15000,
    budgetCurrency: 'PHP',
    budgetNotes: 'Agreed fixed price for initial scope.',
    durationDays: 14,
    deadline: null,
    timelineNotes: '2 weeks turnaround from deposit.',
    revisionTerms: 'One round of revisions included.',
    exclusions: [
      'User account authentication and member portal',
      'Appointment booking calendar engine',
    ],
    missingInformation: [
      'Copywriting and high-resolution photo assets from client',
    ],
    taxTreatment: 'net_of_withholding',
    confirmedAt: earlier,
  });

  // Harbor Studio: Agreement v2 (Confirmed Baseline)
  await agreementRepo.create({
    id: 'agmt_harbor_v2',
    projectId: 'proj_harbor_studio',
    versionNumber: 2,
    title: 'Website design & development · Agreement v2',
    requirements: [
      {
        id: 'REQ-01',
        title: 'Five responsive pages',
        description: 'Home, About, Services, Work and Contact.',
        category: 'deliverable',
      },
      {
        id: 'REQ-02',
        title: 'Contact form',
        description: 'Send enquiries to the client.',
        category: 'deliverable',
      },
      {
        id: 'REQ-04',
        title: 'Website handover guide',
        description: 'A short guide for updating the five agreed pages.',
        category: 'deliverable',
      },
    ],
    budgetAmount: 18000,
    budgetCurrency: 'PHP',
    budgetNotes: 'Agreed fixed price for 5-page scope and handover guide.',
    durationDays: 21,
    deadline: '2026-10-30',
    timelineNotes: '3 weeks',
    revisionTerms: '2 rounds',
    exclusions: [
      'Hosting and domain fees: Purchased and paid for by the client.',
      'Ongoing maintenance: A separate agreement is required after handover.',
    ],
    missingInformation: [
      'Copywriting and high-resolution photo assets from client',
    ],
    taxTreatment: 'none_specified',
    confirmedAt: now,
  });

  // Harbor Studio: Sample Client Request (ScopeGuard)
  await scopeGuardRepo.createRequest({
    id: 'req_harbor_01',
    projectId: 'proj_harbor_studio',
    agreementId: 'agmt_harbor_v2',
    rawText: 'Can we also add customer accounts and appointment booking? Please update the contact form colours too. And make the site feel more premium.',
    createdAt: now,
  });

  // Harbor Studio: ScopeGuard Analysis
  await scopeGuardRepo.createAnalysis({
    id: 'ana_harbor_01',
    requestId: 'req_harbor_01',
    agreementId: 'agmt_harbor_v2',
    classification: 'potential_additional',
    summary: 'Compared with Agreement v2. Two potential additions, one included revision, and one item needing clarification.',
    findings: [
      {
        item: 'Customer accounts',
        classification: 'potential_additional',
        explanation: 'An account system is not listed in the recorded deliverables.',
        evidenceRequirementIds: ['REQ-01', 'REQ-02'],
      },
      {
        item: 'Appointment booking',
        classification: 'potential_additional',
        explanation: 'The agreed pages and enquiry form do not describe booking functionality.',
        evidenceRequirementIds: ['REQ-01', 'REQ-02'],
      },
      {
        item: 'Contact form colour update',
        classification: 'included',
        explanation: 'Fits the agreed contact form and revision terms. Confirm a revision round is available.',
        evidenceRequirementIds: ['REQ-02'],
      },
      {
        item: '"Make it feel more premium"',
        classification: 'needs_clarification',
        explanation: 'Which pages or visual details should change? Ask for examples before classifying.',
        evidenceRequirementIds: ['REQ-01', 'REQ-04'],
      },
    ],
    clarificationQuestions: [
      'Which pages or visual details should change? Ask for examples before classifying.',
    ],
    createdAt: now,
  });

  // Harbor Studio: Change Proposal
  await proposalRepo.create({
    id: 'prop_harbor_01',
    projectId: 'proj_harbor_studio',
    analysisId: 'ana_harbor_01',
    selectedItems: [
      'Customer accounts',
      'Appointment booking',
    ],
    freelancerFeeEstimate: null,
    freelancerDaysEstimate: null,
    currency: 'PHP',
    draftMessage:
      "Hi! Thanks for sharing the updates. Customer accounts and appointment booking would add to the pages and contact form in our current scope. Please review this proposed change and let me know if you would like to proceed. I'll record your approval before starting the additional work.",
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  });

  // 2. Create Cedar identity kit Project
  await projectRepo.create({
    id: 'proj_cedar_coffee',
    title: 'Cedar identity kit',
    clientName: 'Cedar Coffee',
    description: 'Brand identity & packaging design',
  });

  await agreementRepo.create({
    id: 'agmt_cedar_v1',
    projectId: 'proj_cedar_coffee',
    versionNumber: 1,
    title: 'Brand identity & packaging · Agreement v1',
    requirements: [
      {
        id: 'REQ-01',
        title: 'Primary and secondary logo marks',
        description: 'Vector logo assets in monochrome and full color variants.',
        category: 'deliverable',
      },
      {
        id: 'REQ-02',
        title: 'Color palette & typography guide',
        description: 'Comprehensive brand style board with accessible hex colors.',
        category: 'deliverable',
      },
      {
        id: 'REQ-03',
        title: 'Coffee bag packaging label templates',
        description: 'Print-ready label files for 250g and 1kg bags.',
        category: 'deliverable',
      },
    ],
    budgetAmount: 25000,
    budgetCurrency: 'PHP',
    budgetNotes: 'Full brand kit and label package.',
    durationDays: 21,
    deadline: null,
    timelineNotes: '3 weeks design sprint.',
    revisionTerms: 'Three rounds of design feedback included.',
    exclusions: [
      'Print production costs and physical packaging manufacturing',
      'Advertising and marketing management',
    ],
    missingInformation: [],
    taxTreatment: 'net_of_withholding',
    confirmedAt: now,
  });

  // 3. Create Portfolio redesign Project (Draft)
  await projectRepo.create({
    id: 'proj_portfolio_redesign',
    title: 'Portfolio redesign',
    clientName: 'Personal website',
    description: 'Interactive portfolio refresh',
  });

  return true;
}
