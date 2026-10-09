import { Share } from 'react-native';
import type { ChangeProposal, Agreement } from '@/types/domain';

export class ShareService {
  static async shareProposal(proposal: ChangeProposal, projectTitle: string): Promise<boolean> {
    const feeText = proposal.freelancerFeeEstimate != null
      ? `${proposal.currency} ${proposal.freelancerFeeEstimate.toLocaleString()}`
      : 'TBD';
    const daysText = proposal.freelancerDaysEstimate != null
      ? `${proposal.freelancerDaysEstimate} additional days`
      : 'TBD';

    const itemsFormatted = proposal.selectedItems.map((item, idx) => `  ${idx + 1}. ${item}`).join('\n');

    const message = `Project: ${projectTitle}
Scope Change Proposal

${proposal.draftMessage}

Summary of Proposed Additions:
${itemsFormatted}

Fee: ${feeText}
Timeline: ${daysText}
`;

    try {
      const result = await Share.share({
        message,
        title: `Scope Change Proposal — ${projectTitle}`,
      });
      return result.action === Share.sharedAction;
    } catch {
      return false;
    }
  }

  static async shareAgreement(agreement: Agreement, projectTitle: string): Promise<boolean> {
    const reqsFormatted = agreement.requirements
      .map((r) => `[${r.id}] ${r.title} (${r.category})\n${r.description}`)
      .join('\n\n');

    const exclusions = agreement.exclusions.length > 0 ? agreement.exclusions.join('\n- ') : 'None recorded';

    const message = `${projectTitle}
${agreement.title} (Confirmed v${agreement.versionNumber})

Confirmed Deliverables & Scope:
${reqsFormatted}

Exclusions:
- ${exclusions}

Budget: ${agreement.budgetAmount != null ? `${agreement.budgetCurrency} ${agreement.budgetAmount.toLocaleString()}` : 'Unspecified'}
Timeline: ${agreement.durationDays != null ? `${agreement.durationDays} days` : 'Unspecified'}
Revision Terms: ${agreement.revisionTerms || 'Unspecified'}

Confirmed Date: ${new Date(agreement.confirmedAt).toLocaleDateString()}
`;

    try {
      const result = await Share.share({
        message,
        title: `${agreement.title} — ${projectTitle}`,
      });
      return result.action === Share.sharedAction;
    } catch {
      return false;
    }
  }
}
