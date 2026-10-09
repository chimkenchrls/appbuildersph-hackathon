import type { Agreement, ContractOptions } from '@/types/domain';

export class ContractGeneratorService {
  /**
   * Generates a formal, legally compliant Freelance Service Agreement
   * directly from confirmed agreement data and optional party details.
   */
  static generateContractText(agreement: Agreement, options: ContractOptions = {}): string {
    const {
      freelancerName = 'Independent Contractor',
      freelancerTin,
      freelancerAddress,
      clientName = 'Client',
      clientTin,
      clientAddress,
      taxTreatment = agreement.taxTreatment || 'net_of_withholding',
      paymentMethod = 'Bank Transfer / Digital Wallet',
    } = options;

    const formattedDate = new Date(agreement.confirmedAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const feeText =
      agreement.budgetAmount != null
        ? `${agreement.budgetCurrency} ${agreement.budgetAmount.toLocaleString()}`
        : 'To be determined';

    const timelineText =
      agreement.durationDays != null
        ? `${agreement.durationDays} business days`
        : agreement.deadline
          ? `Deadline: ${agreement.deadline}`
          : 'As mutually scheduled';

    // 1. Deliverables list
    const deliverablesList = agreement.requirements
      .map(
        (r, idx) =>
          `   ${idx + 1}. [${r.id}] ${r.title} (${r.category})\n      ${r.description}`,
      )
      .join('\n\n');

    // 2. Exclusions list
    const exclusionsList =
      agreement.exclusions.length > 0
        ? agreement.exclusions.map((e, idx) => `   ${idx + 1}. ${e}`).join('\n')
        : '   None explicitly recorded at time of signing.';

    // 3. Tax compliance clause based on selected treatment
    let taxClause = '';
    switch (taxTreatment) {
      case 'net_of_withholding':
        taxClause =
          'All professional fees quoted herein are net of any applicable creditable withholding taxes. If the Client is required to withhold taxes under Bureau of Internal Revenue (BIR) regulations, the Client shall furnish the Freelancer with a certified BIR Form 2307 (Certificate of Creditable Tax Withheld at Source) upon payment, or adjust payment accordingly.';
        break;
      case 'subject_to_2307':
        taxClause =
          'The Client is authorized to withhold the prescribed expanded withholding tax (5% or 10% pursuant to BIR regulations) upon timely delivery of a certified BIR Form 2307 certificate to the Freelancer at the time of payment.';
        break;
      case 'inclusive':
        taxClause =
          'The agreed compensation is inclusive of all applicable local taxes payable by the Freelancer.';
        break;
      case 'none_specified':
      default:
        taxClause =
          'The agreed compensation is payable in full without deduction. Each party shall remain independently responsible for their respective tax filings and liabilities under applicable Philippine law.';
        break;
    }

    return `================================================================================
                           FREELANCE SERVICE AGREEMENT
================================================================================

Reference: ${agreement.id}
Effective Date: ${formattedDate}
Project: ${agreement.title}

BETWEEN:

1. FREELANCER:
   Name: ${freelancerName}
   ${freelancerAddress ? `Address: ${freelancerAddress}\n   ` : ''}${freelancerTin ? `TIN: ${freelancerTin}\n   ` : ''}
AND

2. CLIENT:
   Name: ${clientName}
   ${clientAddress ? `Address: ${clientAddress}\n   ` : ''}${clientTin ? `TIN: ${clientTin}\n   ` : ''}

(Collectively referred to as the "Parties")

--------------------------------------------------------------------------------
RECITALS
--------------------------------------------------------------------------------
WHEREAS, the Client desires to retain the Freelancer to provide professional
independent development/design services as set forth herein; and

WHEREAS, the Freelancer agrees to provide such services under the terms,
specifications, and consideration established in this Agreement;

NOW, THEREFORE, the Parties agree as follows:

1. SCOPE OF SERVICES & DELIVERABLES
   The Freelancer shall perform and provide the following discrete deliverables:

${deliverablesList}

2. COMPENSATION, INVOICING & TAX COMPLIANCE
   a. Professional Fee: The total agreed compensation for the complete scope
      specified in Section 1 is ${feeText}.
   b. Payment Method: Payment shall be remitted via ${paymentMethod}.
   c. Tax Compliance & Invoicing:
      ${taxClause}
   d. Official Invoicing: Pursuant to the Ease of Paying Taxes (EOPT) Act
      (Republic Act No. 11976), the Freelancer shall issue an official commercial
      or BIR invoice upon milestone completion or final delivery.

3. SCHEDULE & CLIENT COOPERATION
   a. Timeline: The estimated project timeline is ${timelineText} following receipt
      of project deposit and required onboarding assets.
   b. Client Cooperation: The Client shall provide all text, brand assets, photos,
      and feedback within three (3) business days of request. Failure to provide
      required assets shall automatically extend the delivery timeline.

4. REVISIONS & CHANGE PROPOSALS (SCOPEGUARD)
   a. Included Revisions: ${agreement.revisionTerms || 'Up to two (2) rounds of revisions are included.'}
   b. Excluded Services: The following items are explicitly excluded from this Agreement:
${exclusionsList}
   c. Scope Expansion: Any request for additional features, deliverables, or
      revision cycles beyond those specified herein shall require a formal
      Change Proposal detailing additional fees and timeline extensions. Work on
      additional scope shall not commence until accepted in writing.

5. INTELLECTUAL PROPERTY RIGHTS
   Pursuant to Republic Act No. 8293 (Intellectual Property Code of the Philippines),
   all intellectual property rights, copyrights, and source files for the deliverables
   shall transfer to the Client ONLY upon full and complete settlement of all agreed
   compensation set forth in Section 2.

6. CONFIDENTIALITY & DATA PRIVACY
   Pursuant to Republic Act No. 10173 (Data Privacy Act of 2012), both Parties agree
   to protect and maintain the strict confidentiality of all proprietary project
   information, user communications, and personal data disclosed during this project.

7. GOVERNING LAW
   This Agreement shall be construed, interpreted, and governed in accordance with
   the laws of the Republic of the Philippines.

================================================================================
SIGNATURES & MUTUAL ACKNOWLEDGMENT
================================================================================

IN WITNESS WHEREOF, the Parties have executed this Agreement as of the Effective Date:


CLIENT:

Signature: ____________________________________
Printed Name: ${clientName}
Date: _________________________________________


FREELANCER:

Signature: ____________________________________
Printed Name: ${freelancerName}
Date: _________________________________________
`;
  }
}
