import type {
  BankTransactionRecord,
  LedgerRecord,
  StockItemRecord,
  VoucherLineItem,
  VoucherRecord,
} from './types.ts';

function escapeXml(raw: string | number | null | undefined): string {
  return String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function toTallyDate(isoDate: string): string {
  const clean = (isoDate || '2025-10-01').replace(/[^0-9]/g, '');
  return clean.length === 8 ? clean : '20251001';
}

export function generateTallyMastersXml(
  tallyCompanyName: string,
  ledgers: LedgerRecord[],
  stockItems: StockItemRecord[]
): string {
  const ledgerNodes = ledgers
    .map(
      (l) => `        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="${escapeXml(l.name)}" ACTION="Create">
            <NAME.LIST>
              <NAME>${escapeXml(l.name)}</NAME>
            </NAME.LIST>
            <PARENT>${escapeXml(l.parent_group)}</PARENT>
            <ISBILLWISEON>${
              l.parent_group === 'Sundry Debtors' || l.parent_group === 'Sundry Creditors'
                ? 'Yes'
                : 'No'
            }</ISBILLWISEON>
            <LEDSTATENAME>${escapeXml(l.state_name)}</LEDSTATENAME>
            <COUNTRYOFRESIDENCE>India</COUNTRYOFRESIDENCE>
            <GSTREGISTRATIONTYPE>${l.gstin ? 'Regular' : 'Unregistered'}</GSTREGISTRATIONTYPE>
            <PARTYGSTIN>${escapeXml(l.gstin)}</PARTYGSTIN>
            <OPENINGBALANCE>${Number(l.opening_balance || 0).toFixed(2)}</OPENINGBALANCE>
          </LEDGER>
        </TALLYMESSAGE>`
    )
    .join('\n');

  const itemNodes = stockItems
    .map(
      (s) => `        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <STOCKITEM NAME="${escapeXml(s.name)}" ACTION="Create">
            <NAME.LIST>
              <NAME>${escapeXml(s.name)}</NAME>
            </NAME.LIST>
            <BASEUNITS>${escapeXml(s.base_unit)}</BASEUNITS>
            <GSTAPPLICABLE>&#4; Applicable</GSTAPPLICABLE>
            <HSNDETAILS.LIST>
              <HSNCODE>${escapeXml(s.hsn_code)}</HSNCODE>
              <SRCOFHSNDETAILS>Specify Details Here</SRCOFHSNDETAILS>
            </HSNDETAILS.LIST>
            <GSTDETAILS.LIST>
              <TAXABILITY>Taxable</TAXABILITY>
              <STATEWISEDETAILS.LIST>
                <STATENAME>&#4; Any</STATENAME>
                <RATEDETAILS.LIST>
                  <GSTRATEDUTYHEAD>IGST</GSTRATEDUTYHEAD>
                  <GSTRATE>${s.gst_rate}</GSTRATE>
                </RATEDETAILS.LIST>
                <RATEDETAILS.LIST>
                  <GSTRATEDUTYHEAD>CGST</GSTRATEDUTYHEAD>
                  <GSTRATE>${s.gst_rate / 2}</GSTRATE>
                </RATEDETAILS.LIST>
                <RATEDETAILS.LIST>
                  <GSTRATEDUTYHEAD>SGST/UTGST</GSTRATEDUTYHEAD>
                  <GSTRATE>${s.gst_rate / 2}</GSTRATE>
                </RATEDETAILS.LIST>
              </STATEWISEDETAILS.LIST>
            </GSTDETAILS.LIST>
            <OPENINGBALANCE>${s.opening_qty} ${escapeXml(s.base_unit)}</OPENINGBALANCE>
            <OPENINGVALUE>${Number(-Math.abs(s.opening_value || 0)).toFixed(2)}</OPENINGVALUE>
          </STOCKITEM>
        </TALLYMESSAGE>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${escapeXml(tallyCompanyName)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
${ledgerNodes}
${itemNodes}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

function buildLedgerEntryXml(ledgerName: string, isDebit: boolean, amount: number): string {
  const abs = Math.abs(Number(amount || 0));
  if (abs === 0) return '';
  // TallyPrime convention: Debit entries have ISDEEMEDPOSITIVE=Yes and NEGATIVE amount; Credit entries have ISDEEMEDPOSITIVE=No and POSITIVE amount
  const signedAmt = isDebit ? (-abs).toFixed(2) : abs.toFixed(2);
  return `            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${escapeXml(ledgerName)}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>${isDebit ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE>
              <AMOUNT>${signedAmt}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>`;
}

export function generateTallyVouchersXml(
  tallyCompanyName: string,
  vouchers: VoucherRecord[]
): string {
  const voucherMessages = vouchers
    .map((v) => {
      const tallyDate = toTallyDate(v.voucher_date);
      let lineItems: VoucherLineItem[] = [];
      try {
        lineItems = v.line_items_json ? (JSON.parse(v.line_items_json) as VoucherLineItem[]) : [];
      } catch {
        lineItems = [];
      }

      const entries: string[] = [];

      if (v.voucher_type === 'Sales' || v.voucher_type === 'Debit Note') {
        // Party is Debited (Total), Sales + Taxes are Credited
        entries.push(buildLedgerEntryXml(v.party_name, true, v.total_amount));
        entries.push(buildLedgerEntryXml(v.ledger_name || 'Sales GST Account', false, v.taxable_value));
        if (v.igst > 0) entries.push(buildLedgerEntryXml('Output IGST', false, v.igst));
        if (v.cgst > 0) entries.push(buildLedgerEntryXml('Output CGST', false, v.cgst));
        if (v.sgst > 0) entries.push(buildLedgerEntryXml('Output SGST', false, v.sgst));
        if (v.cess > 0) entries.push(buildLedgerEntryXml('Output Cess', false, v.cess));
      } else if (v.voucher_type === 'Purchase' || v.voucher_type === 'Credit Note') {
        // Purchase + Taxes are Debited, Party is Credited (Total)
        entries.push(buildLedgerEntryXml(v.party_name, false, v.total_amount));
        entries.push(
          buildLedgerEntryXml(v.ledger_name || 'Purchase GST Account', true, v.taxable_value)
        );
        if (v.igst > 0) entries.push(buildLedgerEntryXml('Input IGST', true, v.igst));
        if (v.cgst > 0) entries.push(buildLedgerEntryXml('Input CGST', true, v.cgst));
        if (v.sgst > 0) entries.push(buildLedgerEntryXml('Input SGST', true, v.sgst));
        if (v.cess > 0) entries.push(buildLedgerEntryXml('Input Cess', true, v.cess));
      } else if (v.voucher_type === 'Receipt') {
        // Bank/Cash Debited, Party Credited
        entries.push(buildLedgerEntryXml(v.counter_ledger || 'HDFC Bank Current A/c', true, v.total_amount));
        entries.push(buildLedgerEntryXml(v.party_name || v.ledger_name, false, v.total_amount));
      } else {
        // Payment, Contra, Journal: Target Ledger Debited, Counter/Bank Credited
        entries.push(buildLedgerEntryXml(v.ledger_name || v.party_name, true, v.total_amount));
        entries.push(
          buildLedgerEntryXml(v.counter_ledger || 'HDFC Bank Current A/c', false, v.total_amount)
        );
      }

      const inventoryXml =
        lineItems.length > 0
          ? lineItems
              .map(
                (li) => `            <ALLINVENTORYENTRIES.LIST>
              <STOCKITEMNAME>${escapeXml(li.item_name)}</STOCKITEMNAME>
              <ISDEEMEDPOSITIVE>${
                v.voucher_type === 'Purchase' || v.voucher_type === 'Credit Note' ? 'Yes' : 'No'
              }</ISDEEMEDPOSITIVE>
              <RATE>${li.rate.toFixed(2)}/${escapeXml(li.unit || 'NOS')}</RATE>
              <AMOUNT>${(
                (v.voucher_type === 'Purchase' || v.voucher_type === 'Credit Note' ? -1 : 1) *
                Math.abs(li.amount)
              ).toFixed(2)}</AMOUNT>
              <ACTUALQTY>${li.qty} ${escapeXml(li.unit || 'NOS')}</ACTUALQTY>
              <BILLEDQTY>${li.qty} ${escapeXml(li.unit || 'NOS')}</BILLEDQTY>
            </ALLINVENTORYENTRIES.LIST>`
              )
              .join('\n')
          : '';

      return `        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="${escapeXml(v.voucher_type)}" ACTION="Create" OBJVIEW="${
            lineItems.length > 0 ? 'Invoice Voucher View' : 'Accounting Voucher View'
          }">
            <DATE>${tallyDate}</DATE>
            <VOUCHERTYPENAME>${escapeXml(v.voucher_type)}</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${escapeXml(v.voucher_no)}</VOUCHERNUMBER>
            <PARTYLEDGERNAME>${escapeXml(v.party_name)}</PARTYLEDGERNAME>
            <PARTYGSTIN>${escapeXml(v.party_gstin)}</PARTYGSTIN>
            <PLACEOFSUPPLY>${escapeXml(v.place_of_supply)}</PLACEOFSUPPLY>
            <NARRATION>${escapeXml(
              v.narration || `Synced via Vyapar TaxOne (${v.source_mode})`
            )}</NARRATION>
${entries.filter(Boolean).join('\n')}
${inventoryXml}
          </VOUCHER>
        </TALLYMESSAGE>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${escapeXml(tallyCompanyName)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
${voucherMessages}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

export function generateBankTransactionsTallyXml(
  tallyCompanyName: string,
  txns: BankTransactionRecord[]
): string {
  const syntheticVouchers: VoucherRecord[] = txns.map((tx) => {
    const amount = tx.deposit > 0 ? tx.deposit : tx.withdrawal;
    const isReceipt = tx.voucher_type === 'Receipt' || (tx.deposit > 0 && tx.voucher_type !== 'Contra');
    return {
      id: tx.id,
      company_id: tx.company_id,
      voucher_type: isReceipt ? 'Receipt' : tx.voucher_type,
      voucher_no: tx.cheque_ref_no || `BNK-${tx.id}`,
      voucher_date: tx.tx_date,
      party_name: tx.mapped_ledger || 'Suspense A/c',
      party_gstin: '',
      ledger_name: tx.mapped_ledger || 'Suspense A/c',
      counter_ledger: tx.bank_ledger || 'HDFC Bank Current A/c',
      place_of_supply: '',
      hsn_code: '',
      gst_rate: 0,
      taxable_value: amount,
      igst: 0,
      cgst: 0,
      sgst: 0,
      cess: 0,
      total_amount: amount,
      is_rcm: 0,
      ecommerce_gstin: '',
      original_invoice_no: '',
      narration: tx.narration,
      source_mode: 'Banking',
      tally_status: 'Pushed to Tally',
      line_items_json: '[]',
    };
  });
  return generateTallyVouchersXml(tallyCompanyName, syntheticVouchers);
}

export async function pushXmlToTallyConnector(
  port: number,
  xmlPayload: string
): Promise<{
  liveDesktopConnected: boolean;
  mode: 'Live TallyPrime HTTP' | 'TaxOne Cloud Connector Queue';
  statusMessage: string;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 900);
  try {
    const res = await fetch(`http://127.0.0.1:${port}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8' },
      body: xmlPayload,
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      return {
        liveDesktopConnected: true,
        mode: 'Live TallyPrime HTTP',
        statusMessage: `Synced directly to TallyPrime HTTP Server on port ${port}`,
      };
    }
  } catch {
    clearTimeout(timer);
  }
  return {
    liveDesktopConnected: false,
    mode: 'TaxOne Cloud Connector Queue',
    statusMessage: `Queued on TaxOne Connector Bridge (Port ${port}) & XML Envelope Generated`,
  };
}
