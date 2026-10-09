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

  /**
   * Generates a beautifully styled, print-ready HTML document suitable
   * for converting into a professional PDF via expo-print.
   */
  static generateContractHtml(agreement: Agreement, options: ContractOptions = {}): string {
    const {
      freelancerName = 'Independent Contractor',
      freelancerTin = 'N/A',
      freelancerAddress = '',
      clientName = 'Client',
      clientTin = 'N/A',
      clientAddress = '',
      taxTreatment = agreement.taxTreatment || 'net_of_withholding',
      paymentMethod = 'Bank Transfer / Digital Wallet',
    } = options;

    const escape = (text: string) =>
      text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const formattedDate = new Date(agreement.confirmedAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const feeText =
      agreement.budgetAmount != null
        ? `${escape(agreement.budgetCurrency)} ${agreement.budgetAmount.toLocaleString()}`
        : 'To be determined';

    const timelineText =
      agreement.durationDays != null
        ? `${agreement.durationDays} business days`
        : agreement.deadline
          ? `Deadline: ${escape(agreement.deadline)}`
          : 'As mutually scheduled';

    let taxDescription = '';
    switch (taxTreatment) {
      case 'net_of_withholding':
        taxDescription =
          'Net of Withholding: All quoted fees are net of creditable withholding tax. If withholding applies under BIR regulations, Client shall provide a certified BIR Form 2307 upon payment.';
        break;
      case 'subject_to_2307':
        taxDescription =
          'Subject to BIR 2307: Expanded withholding tax (5% or 10%) applies with certified BIR Form 2307 issued to Freelancer at payment.';
        break;
      case 'inclusive':
        taxDescription =
          'Tax Inclusive: Compensation is inclusive of all local taxes payable by the Freelancer.';
        break;
      case 'none_specified':
      default:
        taxDescription =
          'Payable in full without deductions. Each party remains independently responsible for respective tax liabilities.';
        break;
    }

    const deliverablesHtml = agreement.requirements
      .map(
        (r, idx) => `
        <div class="deliverable-item">
          <div class="deliverable-header">
            <span class="deliverable-num">${idx + 1}</span>
            <span class="deliverable-badge">${escape(r.id)}</span>
            <span class="deliverable-title">${escape(r.title)}</span>
          </div>
          <p class="deliverable-desc">${escape(r.description || 'Deliverable according to project specifications.')}</p>
        </div>`,
      )
      .join('');

    const exclusionsHtml =
      agreement.exclusions.length > 0
        ? agreement.exclusions
            .map((e) => `<li class="exclusion-item">${escape(e)}</li>`)
            .join('')
        : '<li class="exclusion-item">No exclusions explicitly recorded at signing.</li>';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Service Agreement - ${escape(agreement.title)}</title>
  <style>
    @page {
      margin: 18mm 16mm;
      size: letter;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #1A1A1A;
      line-height: 1.5;
      font-size: 13px;
      margin: 0;
      padding: 0;
      background: #FFFFFF;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
    }
    .header-bar {
      border-bottom: 2px solid #1A1A1A;
      padding-bottom: 14px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .doc-eyebrow {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: #6B7280;
      margin-bottom: 4px;
    }
    .doc-title {
      font-size: 22px;
      font-weight: 800;
      color: #1A1A1A;
      margin: 0;
      letter-spacing: -0.5px;
    }
    .header-meta {
      text-align: right;
      font-size: 11px;
      color: #4B5563;
    }
    .version-tag {
      display: inline-block;
      background: #E5E7EB;
      color: #1A1A1A;
      font-weight: 700;
      font-size: 10px;
      padding: 2px 8px;
      border-radius: 4px;
      margin-top: 4px;
    }
    .parties-grid {
      display: flex;
      gap: 16px;
      margin-bottom: 22px;
    }
    .party-card {
      flex: 1;
      border: 1px solid #E5E7EB;
      border-radius: 8px;
      padding: 12px 14px;
      background: #F9FAFB;
    }
    .party-role {
      font-size: 10px;
      font-weight: 700;
      color: #6B7280;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 4px;
    }
    .party-name {
      font-size: 14px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 4px;
    }
    .party-detail {
      font-size: 11px;
      color: #4B5563;
      margin: 2px 0;
    }
    .section-title {
      font-size: 13px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #111827;
      border-bottom: 1px solid #E5E7EB;
      padding-bottom: 6px;
      margin: 18px 0 10px 0;
    }
    .deliverable-item {
      border-left: 3px solid #1A1A1A;
      padding: 6px 0 6px 12px;
      margin-bottom: 10px;
    }
    .deliverable-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 3px;
    }
    .deliverable-num {
      font-weight: 700;
      font-size: 11px;
      color: #6B7280;
    }
    .deliverable-badge {
      background: #F3F4F6;
      border: 1px solid #E5E7EB;
      font-size: 9.5px;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 4px;
      color: #374151;
    }
    .deliverable-title {
      font-size: 13px;
      font-weight: 700;
      color: #111827;
    }
    .deliverable-desc {
      font-size: 12px;
      color: #4B5563;
      margin: 0;
    }
    .terms-box {
      background: #F9FAFB;
      border: 1px solid #E5E7EB;
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 16px;
    }
    .terms-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      font-size: 12px;
    }
    .terms-label {
      color: #6B7280;
      font-weight: 600;
    }
    .terms-value {
      color: #111827;
      font-weight: 700;
    }
    .tax-clause-text {
      font-size: 11.5px;
      color: #374151;
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px dashed #E5E7EB;
      line-height: 1.4;
    }
    .exclusions-box {
      background: #FFFBEB;
      border: 1px solid #FDE68A;
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 16px;
    }
    .exclusions-box-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: #92400E;
      margin-bottom: 6px;
    }
    .exclusions-list {
      margin: 0;
      padding-left: 18px;
      font-size: 11.5px;
      color: #78350F;
    }
    .exclusion-item {
      margin-bottom: 3px;
    }
    .clauses-text {
      font-size: 11px;
      color: #4B5563;
      line-height: 1.45;
      margin-bottom: 10px;
    }
    .signatures-grid {
      display: flex;
      gap: 32px;
      margin-top: 28px;
      page-break-inside: avoid;
    }
    .signature-col {
      flex: 1;
      border-top: 1px solid #9CA3AF;
      padding-top: 8px;
    }
    .sign-role {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #6B7280;
    }
    .sign-name {
      font-size: 13px;
      font-weight: 700;
      color: #111827;
      margin-top: 2px;
    }
    .sign-line {
      font-size: 11px;
      color: #6B7280;
      margin-top: 12px;
    }
    .footer-note {
      margin-top: 32px;
      text-align: center;
      font-size: 10px;
      color: #9CA3AF;
      border-top: 1px solid #F3F4F6;
      padding-top: 8px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header-bar">
      <div>
        <div class="doc-eyebrow">Kasunduan Vault · Service Agreement</div>
        <h1 class="doc-title">${escape(agreement.title)}</h1>
      </div>
      <div class="header-meta">
        <div>Effective: <strong>${escape(formattedDate)}</strong></div>
        <div class="version-tag">Version ${agreement.versionNumber}.0</div>
      </div>
    </div>

    <div class="parties-grid">
      <div class="party-card">
        <div class="party-role">Client</div>
        <div class="party-name">${escape(clientName)}</div>
        ${clientTin ? `<div class="party-detail">TIN: ${escape(clientTin)}</div>` : ''}
        ${clientAddress ? `<div class="party-detail">Address: ${escape(clientAddress)}</div>` : ''}
      </div>
      <div class="party-card">
        <div class="party-role">Independent Freelancer</div>
        <div class="party-name">${escape(freelancerName)}</div>
        ${freelancerTin ? `<div class="party-detail">TIN: ${escape(freelancerTin)}</div>` : ''}
        ${freelancerAddress ? `<div class="party-detail">Address: ${escape(freelancerAddress)}</div>` : ''}
      </div>
    </div>

    <div class="section-title">1. Agreed Deliverables & Scope</div>
    ${deliverablesHtml}

    <div class="section-title">2. Financials & Tax Compliance</div>
    <div class="terms-box">
      <div class="terms-row">
        <span class="terms-label">Total Compensation:</span>
        <span class="terms-value">${feeText}</span>
      </div>
      <div class="terms-row">
        <span class="terms-label">Payment Method:</span>
        <span class="terms-value">${escape(paymentMethod)}</span>
      </div>
      <div class="terms-row">
        <span class="terms-label">Delivery Timeline:</span>
        <span class="terms-value">${timelineText}</span>
      </div>
      <div class="terms-row">
        <span class="terms-label">Included Revisions:</span>
        <span class="terms-value">${escape(agreement.revisionTerms || '2 rounds included')}</span>
      </div>
      <div class="tax-clause-text">
        <strong>Tax Compliance (EOPT Act RA 11976 / BIR):</strong> ${taxDescription}
      </div>
    </div>

    <div class="section-title">3. ScopeGuard Exclusions & Change Management</div>
    <div class="exclusions-box">
      <div class="exclusions-box-title">Explicitly Excluded from Scope</div>
      <ul class="exclusions-list">
        ${exclusionsHtml}
      </ul>
    </div>
    <p class="clauses-text">
      Any requests outside the specified deliverables require an explicit Change Proposal and fee agreement before commencement. Intellectual property rights transfer upon complete settlement pursuant to RA 8293. Confidentiality is safeguarded pursuant to RA 10173 (Data Privacy Act of 2012).
    </p>

    <div class="signatures-grid">
      <div class="signature-col">
        <div class="sign-role">Confirmed by Client</div>
        <div class="sign-name">${escape(clientName)}</div>
        <div class="sign-line">Signature: __________________________</div>
        <div class="sign-line">Date: _______________________________</div>
      </div>
      <div class="signature-col">
        <div class="sign-role">Confirmed by Freelancer</div>
        <div class="sign-name">${escape(freelancerName)}</div>
        <div class="sign-line">Signature: __________________________</div>
        <div class="sign-line">Date: _______________________________</div>
      </div>
    </div>

    <div class="footer-note">
      Document Ref: ${escape(agreement.id)} · Diligent Dev Kasunduan Vault · Sealed Offline Baseline
    </div>
  </div>
</body>
</html>`;
  }
}
