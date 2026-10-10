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
   * Engineered strictly to fit on a single page (Letter / A4) with zero overflow.
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
      String(text || '')
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
        ? `${escape(agreement.budgetCurrency || 'PHP')} ${agreement.budgetAmount.toLocaleString()}`
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
          'Quoted fees are net of creditable withholding tax. If withholding applies under BIR rules, Client shall furnish a certified BIR Form 2307 upon payment.';
        break;
      case 'subject_to_2307':
        taxDescription =
          'Subject to expanded withholding tax (5% or 10% per BIR regulations) with certified BIR Form 2307 issued to Freelancer at payment.';
        break;
      case 'inclusive':
        taxDescription =
          'Compensation is inclusive of all applicable local taxes payable by the Freelancer.';
        break;
      case 'none_specified':
      default:
        taxDescription =
          'Payable in full without deductions. Each party remains independently responsible for their respective tax filings.';
        break;
    }

    const deliverablesRowsHtml =
      agreement.requirements && agreement.requirements.length > 0
        ? agreement.requirements
            .map(
              (r, idx) => `
              <tr>
                <td style="width: 22px; text-align: center; color: #64748B; font-weight: 600;">${idx + 1}</td>
                <td style="width: 70px;"><span class="req-badge">${escape(r.id)}</span></td>
                <td style="width: 175px; font-weight: 700; color: #0F172A;">${escape(r.title)}</td>
                <td style="color: #475569; font-size: 8px;">${escape(r.description || 'Deliverable according to project specifications.')}</td>
              </tr>`,
            )
            .join('')
        : '<tr><td colspan="4" style="text-align: center; color: #64748B; padding: 6px;">Specifications established in confirmed scope baseline.</td></tr>';

    const exclusionsHtml =
      agreement.exclusions && agreement.exclusions.length > 0
        ? agreement.exclusions
            .slice(0, 5)
            .map((e) => `<li>${escape(e)}</li>`)
            .join('')
        : '<li>None explicitly recorded at signing.</li>';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Contract Form ${escape(clientName || 'Client')}</title>
  <style>
    @page {
      size: letter portrait;
      margin: 8mm 11mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      max-height: 100%;
      overflow: hidden !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0F172A;
      background: #FFFFFF;
      font-size: 9.2pt;
      line-height: 1.35;
    }
    .document-page {
      width: 100%;
      height: 100%;
      max-height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      page-break-inside: avoid !important;
      page-break-after: avoid !important;
      page-break-before: avoid !important;
      overflow: hidden !important;
    }

    /* 1. Header */
    .header-bar {
      border-bottom: 2px solid #0F172A;
      padding-bottom: 7px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .doc-eyebrow {
      font-size: 8pt;
      font-weight: 700;
      letter-spacing: 1.2px;
      text-transform: uppercase;
      color: #4D8B8B;
      margin-bottom: 3px;
    }
    .doc-title {
      font-size: 16.5pt;
      font-weight: 800;
      color: #0F172A;
      margin: 0;
      letter-spacing: -0.3px;
      line-height: 1.15;
    }
    .project-name {
      font-size: 10.5pt;
      font-weight: 600;
      color: #334155;
      margin-top: 2px;
    }
    .header-meta {
      text-align: right;
      font-size: 8.5pt;
      color: #475569;
      line-height: 1.35;
    }
    .version-tag {
      display: inline-block;
      background: #E8F2F2;
      color: #2D6A6A;
      border: 1px solid #B4D5D5;
      font-weight: 700;
      font-size: 8pt;
      padding: 2px 8px;
      border-radius: 4px;
      margin-top: 3px;
      letter-spacing: 0.4px;
      text-transform: uppercase;
    }

    /* 2. Parties Grid */
    .parties-grid {
      display: flex;
      gap: 12px;
    }
    .party-card {
      flex: 1;
      border: 1px solid #E2E8F0;
      border-radius: 6px;
      padding: 8px 12px;
      background: #F8FAFC;
    }
    .party-role {
      font-size: 7.5pt;
      font-weight: 700;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 2px;
    }
    .party-name {
      font-size: 11pt;
      font-weight: 700;
      color: #0F172A;
      margin-bottom: 2px;
    }
    .party-detail {
      font-size: 8.5pt;
      color: #475569;
      line-height: 1.25;
    }

    /* Section Structure */
    .section-block {
      display: flex;
      flex-direction: column;
    }
    .section-title {
      font-size: 8.8pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #0F172A;
      border-bottom: 1px solid #E2E8F0;
      padding-bottom: 3px;
      margin-bottom: 6px;
    }

    /* 3. Deliverables Table */
    .deliverables-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.8pt;
    }
    .deliverables-table th {
      background: #F1F5F9;
      color: #475569;
      font-weight: 700;
      font-size: 7.8pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      text-align: left;
      padding: 5px 8px;
      border-top: 1px solid #E2E8F0;
      border-bottom: 1px solid #E2E8F0;
    }
    .deliverables-table td {
      padding: 6px 8px;
      border-bottom: 1px solid #F1F5F9;
      vertical-align: top;
      line-height: 1.35;
    }
    .deliverables-table tr:last-child td {
      border-bottom: 1px solid #E2E8F0;
    }
    .req-badge {
      display: inline-block;
      background: #E8F2F2;
      border: 1px solid #B4D5D5;
      color: #2D6A6A;
      font-weight: 700;
      font-size: 8pt;
      padding: 2px 6px;
      border-radius: 4px;
    }

    /* 4. Terms Grid */
    .terms-grid {
      display: flex;
      gap: 8px;
      margin-bottom: 5px;
    }
    .term-card {
      flex: 1;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 5px;
      padding: 7px 10px;
    }
    .term-label {
      font-size: 7.2pt;
      font-weight: 700;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      margin-bottom: 2px;
    }
    .term-value {
      font-size: 10pt;
      font-weight: 700;
      color: #0F172A;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Tax Box */
    .tax-box {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-left: 3.5px solid #4D8B8B;
      border-radius: 4px;
      padding: 5px 9px;
      font-size: 8.2pt;
      color: #334155;
      line-height: 1.3;
    }
    .tax-box strong {
      color: #0F172A;
    }

    /* 5. Dual Legal & Exclusions Box */
    .legal-grid {
      display: flex;
      gap: 10px;
    }
    .legal-card {
      flex: 1;
      border: 1px solid #E2E8F0;
      border-radius: 5px;
      padding: 7px 10px;
      background: #FFFFFF;
    }
    .legal-card-title {
      font-size: 7.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #0F172A;
      margin-bottom: 4px;
    }
    .exclusions-list {
      margin: 0;
      padding-left: 14px;
      font-size: 8.2pt;
      color: #475569;
      line-height: 1.35;
    }
    .exclusions-list li {
      margin-bottom: 2px;
    }
    .statutory-text {
      font-size: 7.8pt;
      color: #475569;
      line-height: 1.3;
      margin: 0;
    }
    .statutory-text div {
      margin-bottom: 2px;
    }
    .statutory-text strong {
      color: #0F172A;
    }

    /* 6. Signatures Section */
    .signatures-section {
      border-top: 1px solid #E2E8F0;
      padding-top: 7px;
    }
    .signatures-preamble {
      font-size: 7.8pt;
      color: #64748B;
      font-style: italic;
      margin-bottom: 7px;
    }
    .signatures-row {
      display: flex;
      gap: 16px;
    }
    .signature-card {
      flex: 1;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 5px;
      padding: 8px 12px;
    }
    .sig-role {
      font-size: 7.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #64748B;
    }
    .sig-name {
      font-size: 10.5pt;
      font-weight: 700;
      color: #0F172A;
      margin: 2px 0 10px 0;
    }
    .sig-lines {
      border-top: 1px dashed #CBD5E1;
      padding-top: 5px;
      display: flex;
      justify-content: space-between;
      font-size: 7.8pt;
      color: #64748B;
    }

    /* 7. Footer */
    .footer-bar {
      border-top: 1px solid #E2E8F0;
      padding-top: 5px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 7.5pt;
      color: #94A3B8;
    }
    .footer-seal {
      font-weight: 600;
      color: #64748B;
    }
  </style>
</head>
<body>
  <div class="document-page">
    <div class="header-bar">
      <div>
        <div class="doc-eyebrow">OwlSet · Kasunduan Vault</div>
        <h1 class="doc-title">FREELANCE SERVICE AGREEMENT</h1>
        <div class="project-name">${escape(agreement.title)}</div>
      </div>
      <div class="header-meta">
        <div>Ref: <strong>${escape(agreement.id)}</strong></div>
        <div>Effective: <strong>${escape(formattedDate)}</strong></div>
        <div class="version-tag">Version ${agreement.versionNumber}.0 · Sealed</div>
      </div>
    </div>

    <div class="parties-grid">
      <div class="party-card">
        <div class="party-role">Client / Principal</div>
        <div class="party-name">${escape(clientName)}</div>
        <div class="party-detail">
          ${clientTin && clientTin !== 'N/A' ? `TIN: ${escape(clientTin)} · ` : ''}${escape(clientAddress || 'Address on file with project')}
        </div>
      </div>
      <div class="party-card">
        <div class="party-role">Independent Freelancer</div>
        <div class="party-name">${escape(freelancerName)}</div>
        <div class="party-detail">
          ${freelancerTin && freelancerTin !== 'N/A' ? `TIN: ${escape(freelancerTin)} · ` : ''}${escape(freelancerAddress || 'Independent Contractor · Manila, Philippines')}
        </div>
      </div>
    </div>

    <div class="section-block">
      <div class="section-title">1. Agreed Deliverables &amp; Specifications</div>
      <table class="deliverables-table">
        <thead>
          <tr>
            <th style="width: 24px; text-align: center;">#</th>
            <th style="width: 76px;">Item Code</th>
            <th style="width: 190px;">Deliverable Name</th>
            <th>Detailed Scope &amp; Deliverable Specifications</th>
          </tr>
        </thead>
        <tbody>
          ${deliverablesRowsHtml}
        </tbody>
      </table>
    </div>

    <div class="section-block">
      <div class="section-title">2. Commercial Terms &amp; Statutory Tax Compliance</div>
      <div class="terms-grid">
        <div class="term-card">
          <div class="term-label">Total Compensation</div>
          <div class="term-value">${feeText}</div>
        </div>
        <div class="term-card">
          <div class="term-label">Timeline</div>
          <div class="term-value">${timelineText}</div>
        </div>
        <div class="term-card">
          <div class="term-label">Payment Method</div>
          <div class="term-value">${escape(paymentMethod)}</div>
        </div>
        <div class="term-card">
          <div class="term-label">Included Revisions</div>
          <div class="term-value">${escape(agreement.revisionTerms || '2 rounds included')}</div>
        </div>
      </div>
      <div class="tax-box">
        <strong>Statutory Tax Compliance (EOPT Act RA 11976 / BIR):</strong> ${taxDescription} Official commercial or BIR invoice issued upon milestone settlement.
      </div>
    </div>

    <div class="section-block">
      <div class="section-title">3. ScopeGuard™ Exclusions &amp; Legal Governance</div>
      <div class="legal-grid">
        <div class="legal-card">
          <div class="legal-card-title">Explicit Scope Exclusions</div>
          <ul class="exclusions-list">
            ${exclusionsHtml}
          </ul>
        </div>
        <div class="legal-card">
          <div class="legal-card-title">Statutory Legal Protections</div>
          <div class="statutory-text">
            <div>• <strong>RA 8293 IP Code:</strong> Deliverable copyrights transfer to Client solely upon 100% full payment settlement.</div>
            <div>• <strong>ScopeGuard™ Protocol:</strong> Any out-of-scope requests require a mutually signed Change Order prior to work.</div>
            <div>• <strong>RA 10173 Data Privacy:</strong> Proprietary data, source assets, and communications strictly safeguarded.</div>
          </div>
        </div>
      </div>
    </div>

    <div class="signatures-section">
      <div class="signatures-preamble">
        IN WITNESS WHEREOF, the Parties hereto execute this Agreement enforceable under Philippine commercial law as of the Effective Date.
      </div>
      <div class="signatures-row">
        <div class="signature-card">
          <div class="sig-role">Confirmed by Client</div>
          <div class="sig-name">${escape(clientName)}</div>
          <div class="sig-lines">
            <span>Signature: __________________________</span>
            <span>Date: ____________</span>
          </div>
        </div>
        <div class="signature-card">
          <div class="sig-role">Confirmed by Freelancer</div>
          <div class="sig-name">${escape(freelancerName)}</div>
          <div class="sig-lines">
            <span>Signature: __________________________</span>
            <span>Date: ____________</span>
          </div>
        </div>
      </div>
    </div>

    <div class="footer-bar">
      <span>Ref: ${escape(agreement.id)} · Sealed Offline Baseline</span>
      <span class="footer-seal">OwlSet Kasunduan Vault · Republic of the Philippines</span>
      <span>Page 1 of 1</span>
    </div>
  </div>
</body>
</html>`;
  }
}
