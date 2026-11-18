import { useState } from 'react';
import { PublicLayout } from '../components/PublicLayout.tsx';
import { HSN_DIRECTORY_2026 } from '../data/reaEvidence.ts';

type CalcTab =
  | 'gst'
  | 'hsn'
  | 'incometax'
  | 'salary'
  | 'gratuity'
  | 'ppf'
  | 'fd'
  | 'rd';

export function CalculatorsPage() {
  const [tab, setTab] = useState<CalcTab>('gst');

  // 1. GST Calculator state
  const [gstAmt, setGstAmt] = useState(100000);
  const [gstRate, setGstRate] = useState(18);
  const [gstMode, setGstMode] = useState<'exclusive' | 'inclusive'>('exclusive');
  const [supplyType, setSupplyType] = useState<'intra' | 'inter'>('intra');

  // 2. HSN search
  const [hsnQuery, setHsnQuery] = useState('');

  // 3. Income Tax Comparator (FY 2025-26)
  const [grossIncome, setGrossIncome] = useState(1450000);
  const [deductions80C, setDeductions80C] = useState(225000);

  // 4. Salary Take-Home
  const [annualCtc, setAnnualCtc] = useState(1200000);

  // 5. Gratuity
  const [basicDa, setBasicDa] = useState(65000);
  const [yearsService, setYearsService] = useState(8);

  // 6. PPF
  const [ppfYearly, setPpfYearly] = useState(150000);
  const [ppfYears, setPpfYears] = useState(15);

  // 7. FD
  const [fdPrincipal, setFdPrincipal] = useState(500000);
  const [fdRate, setFdRate] = useState(7.25);
  const [fdYears, setFdYears] = useState(3);

  // 8. RD
  const [rdMonthly, setRdMonthly] = useState(10000);
  const [rdRate, setRdRate] = useState(7.0);
  const [rdMonths, setRdMonths] = useState(36);

  // Computations
  const baseVal =
    gstMode === 'exclusive' ? gstAmt : gstAmt / (1 + gstRate / 100);
  const totalGst =
    gstMode === 'exclusive' ? (gstAmt * gstRate) / 100 : gstAmt - baseVal;
  const grossInvoice = baseVal + totalGst;

  // New Regime FY 2025-26 slabs (Std Deduction ₹75,000, 0-4L 0%, 4-8L 5%, 8-12L 10%, 12-16L 15%, 16-20L 20%, 20-24L 25%, >24L 30%, Sec 87A rebate up to ₹12L taxable)
  const computeNewRegimeTax = (inc: number) => {
    const taxable = Math.max(0, inc - 75000);
    if (taxable <= 1200000) return 0;
    const brackets: [number, number, number][] = [
      [400000, 800000, 0.05],
      [800000, 1200000, 0.1],
      [1200000, 1600000, 0.15],
      [1600000, 2000000, 0.2],
      [2000000, 2400000, 0.25],
      [2400000, Infinity, 0.3],
    ];
    let tax = 0;
    for (const [lo, hi, r] of brackets) {
      if (taxable > lo) tax += (Math.min(taxable, hi) - lo) * r;
    }
    return Math.round(tax * 1.04);
  };

  const computeOldRegimeTax = (inc: number, ded: number) => {
    const taxable = Math.max(0, inc - 50000 - ded);
    if (taxable <= 500000) return 0;
    let tax = 0;
    if (taxable > 250000) tax += (Math.min(taxable, 500000) - 250000) * 0.05;
    if (taxable > 500000) tax += (Math.min(taxable, 1000000) - 500000) * 0.2;
    if (taxable > 1000000) tax += (taxable - 1000000) * 0.3;
    return Math.round(tax * 1.04);
  };

  const newTax = computeNewRegimeTax(grossIncome);
  const oldTax = computeOldRegimeTax(grossIncome, deductions80C);

  // Salary
  const monthlyBasic = Math.round((annualCtc * 0.4) / 12);
  const epfEmployee = Math.round(monthlyBasic * 0.12);
  const profTax = 200;
  const estMonthlyTax = Math.round(computeNewRegimeTax(annualCtc) / 12);
  const monthlyInHand = Math.round(annualCtc / 12 - epfEmployee * 2 - profTax - estMonthlyTax);

  // Gratuity (15/26 * Basic+DA * Years)
  const gratuityPayable = Math.round((basicDa * 15 * yearsService) / 26);

  // PPF @ 7.1% annual compounding
  const ppfRate = 0.071;
  let ppfCorpus = 0;
  for (let y = 0; y < ppfYears; y++) {
    ppfCorpus = (ppfCorpus + ppfYearly) * (1 + ppfRate);
  }

  // FD quarterly compounding
  const fdMaturity = fdPrincipal * Math.pow(1 + fdRate / 400, 4 * fdYears);
  const fdInterest = fdMaturity - fdPrincipal;

  // RD quarterly compounding approximation
  const rQuarter = rdRate / 400;
  let rdMaturity = 0;
  for (let m = 1; m <= rdMonths; m++) {
    const remQuarters = ((rdMonths - m + 1) / 12) * 4;
    rdMaturity += rdMonthly * Math.pow(1 + rQuarter, remQuarters);
  }

  const filteredHsn = HSN_DIRECTORY_2026.filter(
    (h) =>
      h.code.includes(hsnQuery.trim()) ||
      h.description.toLowerCase().includes(hsnQuery.toLowerCase()) ||
      h.chapter.toLowerCase().includes(hsnQuery.toLowerCase())
  );

  return (
    <PublicLayout>
      <section className="pub-section">
        <div className="pub-container">
          <div className="section-head">
            <span className="eyebrow-label">CA Financial &amp; Statutory Toolkit</span>
            <h1 className="pub-h2">8 Interactive Tax Calculators &amp; 2026 6-Digit HSN Finder</h1>
          </div>

          <div className="sub-tabs" style={{ marginBottom: '24px', flexWrap: 'wrap' }}>
            {(
              [
                ['gst', 'GST Split'],
                ['hsn', '2026 HSN/SAC Finder'],
                ['incometax', 'Income Tax (FY 25-26)'],
                ['salary', 'Salary Take-Home'],
                ['gratuity', 'Gratuity (15/26)'],
                ['ppf', 'PPF (7.1%)'],
                ['fd', 'FD & 194A TDS'],
                ['rd', 'RD Maturity'],
              ] as [CalcTab, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`sub-tab ${tab === id ? 'active' : ''}`}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'gst' && (
            <div className="split-two">
              <div className="clean-panel">
                <h3>Indian GST Inclusive / Exclusive Calculator</h3>
                <div className="form-grid">
                  <div className="field">
                    <label>Amount (₹)</label>
                    <input
                      type="number"
                      className="input"
                      value={gstAmt}
                      onChange={(e) => setGstAmt(Number(e.target.value))}
                    />
                  </div>
                  <div className="field">
                    <label>GST Slab (%)</label>
                    <select
                      className="select"
                      value={gstRate}
                      onChange={(e) => setGstRate(Number(e.target.value))}
                    >
                      {[3, 5, 12, 18, 28].map((r) => (
                        <option key={r} value={r}>
                          {r}% GST
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Calculation Mode</label>
                    <select
                      className="select"
                      value={gstMode}
                      onChange={(e) => setGstMode(e.target.value as 'exclusive' | 'inclusive')}
                    >
                      <option value="exclusive">Add GST (Tax Exclusive)</option>
                      <option value="inclusive">Extract GST (Tax Inclusive)</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Place of Supply Type</label>
                    <select
                      className="select"
                      value={supplyType}
                      onChange={(e) => setSupplyType(e.target.value as 'intra' | 'inter')}
                    >
                      <option value="intra">Intra-State (CGST + SGST)</option>
                      <option value="inter">Inter-State (IGST)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="clean-panel">
                <h3>Computed Tax Breakdown</h3>
                <table className="data-table">
                  <tbody>
                    <tr>
                      <td>Taxable Value</td>
                      <td className="num">₹{baseVal.toFixed(2)}</td>
                    </tr>
                    {supplyType === 'intra' ? (
                      <>
                        <tr>
                          <td>CGST ({gstRate / 2}%)</td>
                          <td className="num">₹{(totalGst / 2).toFixed(2)}</td>
                        </tr>
                        <tr>
                          <td>SGST ({gstRate / 2}%)</td>
                          <td className="num">₹{(totalGst / 2).toFixed(2)}</td>
                        </tr>
                      </>
                    ) : (
                      <tr>
                        <td>IGST ({gstRate}%)</td>
                        <td className="num">₹{totalGst.toFixed(2)}</td>
                      </tr>
                    )}
                    <tr>
                      <td>
                        <strong>Gross Invoice Value</strong>
                      </td>
                      <td className="num">
                        <strong>₹{grossInvoice.toFixed(2)}</strong>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'hsn' && (
            <div className="clean-panel">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '16px',
                  flexWrap: 'wrap',
                }}
              >
                <h3 style={{ margin: 0 }}>Mandatory 6-Digit HSN &amp; SAC Quick Directory</h3>
                <input
                  className="input"
                  style={{ minWidth: '280px' }}
                  placeholder="Search HSN code, commodity, SAC, or chapter..."
                  value={hsnQuery}
                  onChange={(e) => setHsnQuery(e.target.value)}
                />
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>HSN / SAC</th>
                      <th>Chapter / Heading</th>
                      <th>Description of Goods / Services</th>
                      <th className="num">GST Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHsn.map((item) => (
                      <tr key={item.code}>
                        <td className="mono">{item.code}</td>
                        <td>{item.chapter}</td>
                        <td>{item.description}</td>
                        <td className="num">
                          <span className="badge badge-info">{item.rate}%</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'incometax' && (
            <div className="split-two">
              <div className="clean-panel">
                <h3>Income Tax Regime Comparator (FY 2025-26 / AY 2026-27)</h3>
                <div className="form-grid">
                  <div className="field">
                    <label>Gross Annual Salary / Income (₹)</label>
                    <input
                      type="number"
                      className="input"
                      value={grossIncome}
                      onChange={(e) => setGrossIncome(Number(e.target.value))}
                    />
                  </div>
                  <div className="field">
                    <label>Chapter VI-A + HRA Deductions (Old Regime ₹)</label>
                    <input
                      type="number"
                      className="input"
                      value={deductions80C}
                      onChange={(e) => setDeductions80C(Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>
              <div className="clean-panel">
                <h3>Tax Payable (Incl. 4% Health &amp; Education Cess)</h3>
                <table className="data-table">
                  <tbody>
                    <tr>
                      <td>New Tax Regime u/s 115BAC (₹75k Std Ded + ₹12L Rebate)</td>
                      <td className="num">
                        <strong>₹{newTax.toLocaleString('en-IN')}</strong>
                      </td>
                    </tr>
                    <tr>
                      <td>Old Tax Regime (₹50k Std Ded + ₹{deductions80C.toLocaleString('en-IN')} Ded)</td>
                      <td className="num">₹{oldTax.toLocaleString('en-IN')}</td>
                    </tr>
                    <tr>
                      <td>Recommended Regime</td>
                      <td className="num">
                        <span className="badge badge-ok">
                          {newTax <= oldTax
                            ? `New Regime saves ₹${(oldTax - newTax).toLocaleString('en-IN')}`
                            : `Old Regime saves ₹${(newTax - oldTax).toLocaleString('en-IN')}`}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'salary' && (
            <div className="split-two">
              <div className="clean-panel">
                <h3>CTC to Monthly In-Hand Salary Calculator</h3>
                <div className="field">
                  <label>Annual Cost to Company (CTC ₹)</label>
                  <input
                    type="number"
                    className="input"
                    value={annualCtc}
                    onChange={(e) => setAnnualCtc(Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="clean-panel">
                <h3>Monthly Payroll Breakdown</h3>
                <table className="data-table">
                  <tbody>
                    <tr>
                      <td>Basic Component (40% of CTC)</td>
                      <td className="num">₹{monthlyBasic.toLocaleString('en-IN')}</td>
                    </tr>
                    <tr>
                      <td>Employee + Employer EPF (12% + 12%)</td>
                      <td className="num">-₹{(epfEmployee * 2).toLocaleString('en-IN')}</td>
                    </tr>
                    <tr>
                      <td>Estimated TDS u/s 192 (New Regime) + PT</td>
                      <td className="num">-₹{(estMonthlyTax + profTax).toLocaleString('en-IN')}</td>
                    </tr>
                    <tr>
                      <td>
                        <strong>Estimated Monthly Net Take-Home</strong>
                      </td>
                      <td className="num">
                        <strong>₹{monthlyInHand.toLocaleString('en-IN')}</strong>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'gratuity' && (
            <div className="split-two">
              <div className="clean-panel">
                <h3>Gratuity Calculator (Payment of Gratuity Act, 1972)</h3>
                <div className="form-grid">
                  <div className="field">
                    <label>Last Drawn Monthly Basic + DA (₹)</label>
                    <input
                      type="number"
                      className="input"
                      value={basicDa}
                      onChange={(e) => setBasicDa(Number(e.target.value))}
                    />
                  </div>
                  <div className="field">
                    <label>Completed Years of Service (&gt;= 5 yrs)</label>
                    <input
                      type="number"
                      className="input"
                      value={yearsService}
                      onChange={(e) => setYearsService(Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>
              <div className="clean-panel">
                <h3>Statutory Gratuity Formula (15 / 26)</h3>
                <div className="kpi-value" style={{ fontSize: '28px', marginBottom: '8px' }}>
                  ₹{gratuityPayable.toLocaleString('en-IN')}
                </div>
                <p style={{ margin: 0 }}>
                  Tax-exempt up to ₹20,00,000 u/s 10(10) of the Income Tax Act.
                </p>
              </div>
            </div>
          )}

          {tab === 'ppf' && (
            <div className="split-two">
              <div className="clean-panel">
                <h3>Public Provident Fund (PPF — EEE 7.1% p.a.)</h3>
                <div className="form-grid">
                  <div className="field">
                    <label>Annual Deposit (Max ₹1,50,000)</label>
                    <input
                      type="number"
                      className="input"
                      value={ppfYearly}
                      onChange={(e) => setPpfYearly(Math.min(150000, Number(e.target.value)))}
                    />
                  </div>
                  <div className="field">
                    <label>Tenure (Years)</label>
                    <input
                      type="number"
                      className="input"
                      value={ppfYears}
                      onChange={(e) => setPpfYears(Math.max(15, Number(e.target.value)))}
                    />
                  </div>
                </div>
              </div>
              <div className="clean-panel">
                <h3>Tax-Free PPF Maturity Value</h3>
                <p>
                  Invested: ₹{(ppfYearly * ppfYears).toLocaleString('en-IN')} · Tax-Free Interest: ₹
                  {Math.round(ppfCorpus - ppfYearly * ppfYears).toLocaleString('en-IN')}
                </p>
                <div className="kpi-value" style={{ fontSize: '28px' }}>
                  ₹{Math.round(ppfCorpus).toLocaleString('en-IN')}
                </div>
              </div>
            </div>
          )}

          {tab === 'fd' && (
            <div className="split-two">
              <div className="clean-panel">
                <h3>Fixed Deposit &amp; Section 194A TDS Check</h3>
                <div className="form-grid">
                  <div className="field">
                    <label>Principal Deposit (₹)</label>
                    <input
                      type="number"
                      className="input"
                      value={fdPrincipal}
                      onChange={(e) => setFdPrincipal(Number(e.target.value))}
                    />
                  </div>
                  <div className="field">
                    <label>Annual Interest Rate (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      className="input"
                      value={fdRate}
                      onChange={(e) => setFdRate(Number(e.target.value))}
                    />
                  </div>
                  <div className="field">
                    <label>Tenure (Years)</label>
                    <input
                      type="number"
                      className="input"
                      value={fdYears}
                      onChange={(e) => setFdYears(Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>
              <div className="clean-panel">
                <h3>Quarterly Compounded Maturity</h3>
                <div className="kpi-value" style={{ fontSize: '28px', marginBottom: '8px' }}>
                  ₹{Math.round(fdMaturity).toLocaleString('en-IN')}
                </div>
                <p style={{ margin: 0 }}>
                  Total Interest: ₹{Math.round(fdInterest).toLocaleString('en-IN')} ·{' '}
                  {fdInterest / fdYears > 50000 ? (
                    <span className="badge badge-warn">10% TDS u/s 194A Applicable (&gt;₹50k/yr)</span>
                  ) : (
                    <span className="badge badge-ok">Below ₹50,000 Annual 194A TDS Threshold</span>
                  )}
                </p>
              </div>
            </div>
          )}

          {tab === 'rd' && (
            <div className="split-two">
              <div className="clean-panel">
                <h3>Recurring Deposit (RD) Calculator</h3>
                <div className="form-grid">
                  <div className="field">
                    <label>Monthly Installment (₹)</label>
                    <input
                      type="number"
                      className="input"
                      value={rdMonthly}
                      onChange={(e) => setRdMonthly(Number(e.target.value))}
                    />
                  </div>
                  <div className="field">
                    <label>Interest Rate (% p.a.)</label>
                    <input
                      type="number"
                      step="0.1"
                      className="input"
                      value={rdRate}
                      onChange={(e) => setRdRate(Number(e.target.value))}
                    />
                  </div>
                  <div className="field">
                    <label>Months</label>
                    <input
                      type="number"
                      className="input"
                      value={rdMonths}
                      onChange={(e) => setRdMonths(Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>
              <div className="clean-panel">
                <h3>RD Maturity Value</h3>
                <p>
                  Total Principal: ₹{(rdMonthly * rdMonths).toLocaleString('en-IN')} · Interest
                  Earned: ₹{Math.round(rdMaturity - rdMonthly * rdMonths).toLocaleString('en-IN')}
                </p>
                <div className="kpi-value" style={{ fontSize: '28px' }}>
                  ₹{Math.round(rdMaturity).toLocaleString('en-IN')}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </PublicLayout>
  );
}
