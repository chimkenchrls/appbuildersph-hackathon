import { Share } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import type { ChangeProposal, Agreement, ContractOptions } from '@/types/domain';
import { ContractGeneratorService } from './contractGeneratorService';

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
        title: `Scope Change Proposal: ${projectTitle}`,
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
        title: `${agreement.title}: ${projectTitle}`,
      });
      return result.action === Share.sharedAction;
    } catch {
      return false;
    }
  }

  static async shareContract(agreement: Agreement, options?: ContractOptions): Promise<boolean> {
    const contractText = ContractGeneratorService.generateContractText(agreement, options);

    try {
      const result = await Share.share({
        message: contractText,
        title: `Contract: ${agreement.title}`,
      });
      return result.action === Share.sharedAction;
    } catch {
      return false;
    }
  }

  /**
   * Generates a formal, printable PDF contract via expo-print and opens
   * the native file sharing sheet via expo-sharing (or invokes system print dialog).
   */
  static async shareContractPdf(agreement: Agreement, options?: ContractOptions): Promise<boolean> {
    try {
      const html = ContractGeneratorService.generateContractHtml(agreement, options);
      const isSharingAvailable = await Sharing.isAvailableAsync();

      const rawClient = (options?.clientName || 'Client').trim();
      const sanitizedClient = rawClient.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'Client';
      const pdfFileName = `Contract Form ${sanitizedClient}.pdf`;

      if (isSharingAvailable) {
        const { uri } = await Print.printToFileAsync({ html });
        let targetUri = uri;

        try {
          if (FileSystem.cacheDirectory) {
            const newUri = `${FileSystem.cacheDirectory}${pdfFileName}`;
            await FileSystem.copyAsync({
              from: uri,
              to: newUri,
            });
            targetUri = newUri;
          }
        } catch {
          // Fallback to original uri if platform filesystem copy encounters an error
        }

        await Sharing.shareAsync(targetUri, {
          mimeType: 'application/pdf',
          dialogTitle: `Contract Form ${sanitizedClient}`,
          UTI: 'com.adobe.pdf',
        });
        return true;
      } else {
        // Fallback for web or platforms where file sharing sheet is unavailable
        await Print.printAsync({ html });
        return true;
      }
    } catch {
      return false;
    }
  }

  /**
   * Directly prints or saves contract to PDF using device print services.
   */
  static async printContract(agreement: Agreement, options?: ContractOptions): Promise<void> {
    const html = ContractGeneratorService.generateContractHtml(agreement, options);
    await Print.printAsync({ html });
  }
}
