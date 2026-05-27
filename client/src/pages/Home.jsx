import React, { useState, useMemo } from 'react';

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [testCases, setTestCases] = useState([]);
  const [loading, setLoading] = useState(false);

  // Advanced UX Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedTestCaseForCode, setSelectedTestCaseForCode] = useState(null);
  const [automationFramework, setAutomationFramework] = useState('Playwright');

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/generate-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt }),
      });

      const result = await response.json();
      if (result.success) {
        const enrichedCases = result.data.map(tc => ({
          ...tc,
          status: 'Untested',
          actualResult: ''
        }));
        setTestCases(enrichedCases);
        setSelectedTestCaseForCode(null);
      } else {
        alert(result.error || 'Something went wrong');
      }
    } catch (error) {
      console.error("Error generating test cases:", error);
      alert('Could not connect to the server.');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = (id, newStatus) => {
    setTestCases(prev => prev.map(tc => tc.id === id ? { ...tc, status: newStatus } : tc));
  };

  const handleActualResultChange = (id, value) => {
    setTestCases(prev => prev.map(tc => tc.id === id ? { ...tc, actualResult: value } : tc));
  };

  // Smart Bulk Action: Toggles between marking all as passed or resetting them all
  const toggleAllFilteredStatus = () => {
    const filteredIds = filteredTestCases.map(tc => tc.id);
    const hasExecutedTests = filteredTestCases.some(tc => tc.status !== 'Untested');

    setTestCases(prev => prev.map(tc => {
      if (filteredIds.includes(tc.id)) {
        return hasExecutedTests
          ? { ...tc, status: 'Untested', actualResult: '' }
          : { ...tc, status: 'Passed' };
      }
      return tc;
    }));
  };

  // Metrics Engine
  const metrics = useMemo(() => {
    const total = testCases.length;
    if (total === 0) return { total: 0, passed: 0, failed: 0, blocked: 0, untested: 0, completion: 0 };
    const passed = testCases.filter(tc => tc.status === 'Passed').length;
    const failed = testCases.filter(tc => tc.status === 'Failed').length;
    const blocked = testCases.filter(tc => tc.status === 'Blocked').length;
    const untested = testCases.filter(tc => tc.status === 'Untested').length;
    const completion = Math.round(((passed + failed + blocked) / total) * 100);
    return { total, passed, failed, blocked, untested, completion };
  }, [testCases]);

  // Real-time Search and Filter Logic
  const filteredTestCases = useMemo(() => {
    return testCases.filter(tc => {
      const matchesSearch = tc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tc.expectedResult.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = typeFilter === 'All' || tc.type === typeFilter;
      const matchesStatus = statusFilter === 'All' || tc.status === statusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [testCases, searchQuery, typeFilter, statusFilter]);

  // Automation Script Generation Template Engine
  const generatedCodeSnippet = useMemo(() => {
    if (!selectedTestCaseForCode) return '';
    const tc = selectedTestCaseForCode;
    const cleanTitle = tc.title.replace(/'/g, "\\'");

    if (automationFramework === 'Playwright') {
      return `test('${cleanTitle}', async ({ page }) => {\n  // Precondition: ${tc.preconditions || 'None'}\n${tc.steps?.map(s => `  // Step: ${s}\n  await page.locator('//your-selector').click();`).join('\n')}\n  \n  // Expected: ${tc.expectedResult}\n  await expect(page.locator('body')).toBeVisible(); \n});`;
    } else {
      return `describe('QA Automation Suite', () => {\n  it('${cleanTitle}', () => {\n    // Precondition: ${tc.preconditions || 'None'}\n${tc.steps?.map(s => `    // Step: ${s}`).join('\n')}\n    \n    // Expected: ${tc.expectedResult}\n    cy.get('.main-container').should('exist');\n  });\n});`;
    }
  }, [selectedTestCaseForCode, automationFramework]);

  // Export Engine
  const exportToCSV = () => {
    if (testCases.length === 0) return;
    const headers = ['ID', 'Type', 'Title', 'Preconditions', 'Expected Result', 'Status', 'Actual Result'];
    const rows = testCases.map(tc => [
      tc.id, tc.type, `"${tc.title.replace(/"/g, '""')}"`,
      `"${(tc.preconditions || '').replace(/"/g, '""')}"`,
      `"${tc.expectedResult.replace(/"/g, '""')}"`, tc.status, `"${tc.actualResult.replace(/"/g, '""')}"`
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", "qa_matrix_execution_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const hasExecutedTests = filteredTestCases.some(tc => tc.status !== 'Untested');

  return (
    <div className="p-8 max-w-[1600px] mx-auto font-sans text-slate-800 bg-slate-50 min-h-screen">

      {/* Top Studio Control Header bar */}
      <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm mb-8">
        <div>
          <h1 className="m-0 text-2xl font-extrabold text-slate-900">⚡ Professional QA Execution Hub</h1>
          <p className="text-slate-500 mt-1 text-sm">Analyze system requirements, maintain cross-functional test suites, and scaffold automation code blocks.</p>
        </div>
        {metrics.total > 0 && (
          <button onClick={exportToCSV} className="bg-emerald-500 hover:bg-emerald-600 text-white border-none py-2.5 px-4 rounded-md font-semibold text-sm cursor-pointer transition-colors">
            📥 Export Test Suite (.CSV)
          </button>
        )}
      </div>

      {/* Split Window Workspace Layout */}
      <div className="grid grid-cols-1 gap-8">

        {/* Input & Matrix Management Form */}
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <form onSubmit={handleGenerate}>
            <label className="font-bold text-sm uppercase tracking-wider text-slate-500 block mb-2">Requirement Specifications & Target Acceptance Criteria</label>
            <textarea
              rows="7"
              className="w-100 w-full p-3 rounded-md text-sm border border-slate-300 box-border font-inherit focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="Paste raw requirements text specifications here..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
            <button type="submit" disabled={loading} className="py-2.5 px-5 mt-3 cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white border-none rounded-md font-bold text-sm disabled:opacity-50 transition-colors">
              {loading ? 'Generating Structured Matrix Logs...' : '✨ Parse Requirements & Generate Tests'}
            </button>
          </form>
        </div>

        {/* Dashboard Analytics Bar */}
        {metrics.total > 0 && (
          <div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 mb-4">
              <div className="bg-white p-4 rounded-lg border-l-4 border-slate-500 shadow-xs">
                <div className="text-[11px] font-bold text-slate-500 uppercase">TOTAL SCENARIOS</div>
                <div className="text-2xl font-extrabold mt-0.5 text-slate-900">{metrics.total}</div>
              </div>
              <div className="bg-white p-4 rounded-lg border-l-4 border-emerald-500 shadow-xs">
                <div className="text-[11px] font-bold text-emerald-600 uppercase">PASSED</div>
                <div className="text-2xl font-extrabold mt-0.5 text-emerald-600">{metrics.passed}</div>
              </div>
              <div className="bg-white p-4 rounded-lg border-l-4 border-red-500 shadow-xs">
                <div className="text-[11px] font-bold text-red-500 uppercase">FAILED</div>
                <div className="text-2xl font-extrabold mt-0.5 text-red-500">{metrics.failed}</div>
              </div>
              <div className="bg-white p-4 rounded-lg border-l-4 border-amber-500 shadow-xs">
                <div className="text-[11px] font-bold text-amber-500 uppercase">BLOCKED</div>
                <div className="text-2xl font-extrabold mt-0.5 text-amber-500">{metrics.blocked}</div>
              </div>
              <div className="bg-white p-4 rounded-lg border-l-4 border-slate-400 shadow-xs">
                <div className="text-[11px] font-bold text-slate-400 uppercase">UNTESTED</div>
                <div className="text-2xl font-extrabold mt-0.5 text-slate-600">{metrics.untested}</div>
              </div>
            </div>

            {/* Visual Tracking Progress Gauge */}
            <div className="bg-white p-4 rounded-xl shadow-sm mb-6">
              <div className="flex justify-between text-xs font-bold text-slate-600 mb-1.5">
                <span>TEST RUN EXECUTION PROGRESS</span>
                <span>{metrics.completion}% COMPLETE</span>
              </div>
              <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                <div className="bg-indigo-600 h-full transition-all duration-300 ease-out" style={{ width: `${metrics.completion}%` }} />
              </div>
            </div>
          </div>
        )}

        {/* Filters Matrix Control Row Panel */}
        {metrics.total > 0 && (
          <div className="bg-white p-4 rounded-xl shadow-sm flex flex-wrap gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-3 flex-1">
              <input
                type="text"
                placeholder="🔍 Search test title or outcomes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="py-2 px-3 rounded-md border border-slate-300 w-64 text-sm focus:outline-none focus:border-indigo-500"
              />
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="p-2 rounded-md border border-slate-300 text-sm bg-white focus:outline-none focus:border-indigo-500">
                <option value="All">All Testing Horizons</option>
                <option value="Positive">Positive Paths</option>
                <option value="Negative">Negative Paths</option>
                <option value="Boundary">Boundary Values</option>
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="p-2 rounded-md border border-slate-300 text-sm bg-white focus:outline-none focus:border-indigo-500">
                <option value="All">All Statuses</option>
                <option value="Untested">Untested</option>
                <option value="Passed">Passed</option>
                <option value="Failed">Failed</option>
                <option value="Blocked">Blocked</option>
              </select>
            </div>
            <div>
              <button
                onClick={toggleAllFilteredStatus}
                className={`py-2 px-3.5 border rounded-md text-xs font-semibold cursor-pointer transition-all duration-200 ${
                  hasExecutedTests
                    ? 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                {hasExecutedTests ? '⟲ Reset / Unmark All Filtered' : '✓ Bulk Mark Filtered as Passed'}
              </button>
            </div>
          </div>
        )}

        {/* Main Interface Execution Logs Grid */}
        {metrics.total === 0 && !loading ? (
          <div className="p-12 border-2 border-dashed border-slate-300 rounded-xl text-center bg-white">
            <p className="text-slate-400 italic m-0">No dynamic test execution matrix logs compiled. Submit a project scope requirement prompt to begin.</p>
          </div>
        ) : (
          metrics.total > 0 && (
            <div className={`grid gap-6 items-start ${selectedTestCaseForCode ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1'}`}>

              {/* Left Column Table Container */}
              <div className={`bg-white rounded-xl shadow-sm overflow-hidden ${selectedTestCaseForCode ? 'lg:col-span-2' : ''}`}>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                        <th className="p-3 w-10">ID</th>
                        <th className="p-3 w-80">Test Case Scenario Configuration Descriptions</th>
                        <th className="p-3 w-56">Expected Verification Output</th>
                        <th className="p-3 w-28 text-center">Execution Status Switch</th>
                        <th className="p-3 w-48">Actual Test Run Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredTestCases.map((tc) => {
                        const isRowSelected = selectedTestCaseForCode?.id === tc.id;
                        
                        // Computes background colors based on row status
                        let rowBg = 'bg-transparent';
                        if (isRowSelected) rowBg = 'bg-indigo-50/70';
                        else if (tc.status === 'Passed') rowBg = 'bg-emerald-50/50';
                        else if (tc.status === 'Failed') rowBg = 'bg-red-50/50';
                        else if (tc.status === 'Blocked') rowBg = 'bg-amber-50/50';

                        return (
                          <tr key={tc.id} className={`align-top transition-colors ${rowBg}`}>
                            <td className="p-3 font-bold text-slate-400">{tc.id}</td>
                            <td className="p-3">
                              <div className="flex gap-2 items-center mb-1.5">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  tc.type === 'Positive' ? 'bg-emerald-100 text-emerald-800' :
                                  tc.type === 'Negative' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'
                                }`}>
                                  {tc.type}
                                </span>
                                <button onClick={() => setSelectedTestCaseForCode(tc)} className="bg-transparent border-none text-indigo-600 hover:text-indigo-800 cursor-pointer text-xs p-0 underline">
                                  Code Template
                                </button>
                              </div>
                              <div className="font-bold text-slate-900 mb-1">{tc.title}</div>
                              <div className="text-xs text-slate-500 bg-slate-100 p-1.5 rounded mb-2.5">
                                <strong>Preconditions:</strong> {tc.preconditions}
                              </div>
                              <ol className="m-0 pl-4 text-slate-600 text-[13px] list-decimal space-y-0.5">
                                {tc.steps?.map((s, i) => <li key={i}>{s}</li>)}
                              </ol>
                            </td>
                            <td className="p-3 text-slate-600 leading-relaxed text-[13px]">{tc.expectedResult}</td>
                            <td className="p-3 text-center">
                              <select 
                                value={tc.status} 
                                onChange={(e) => updateStatus(tc.id, e.target.value)} 
                                className={`p-1.5 rounded font-bold text-xs text-white border-none cursor-pointer focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 ${
                                  tc.status === 'Passed' ? 'bg-emerald-500' : 
                                  tc.status === 'Failed' ? 'bg-red-500' : 
                                  tc.status === 'Blocked' ? 'bg-amber-500' : 'bg-slate-400'
                                }`}
                              >
                                <option value="Untested">Untested</option>
                                <option value="Passed">PASS</option>
                                <option value="Failed">FAIL</option>
                                <option value="Blocked">BLOCK</option>
                              </select>
                            </td>
                            <td className="p-3">
                              <textarea 
                                rows="2" 
                                placeholder="Run observation notes..." 
                                value={tc.actualResult} 
                                onChange={(e) => handleActualResultChange(tc.id, e.target.value)} 
                                className="w-full p-1.5 rounded border border-slate-300 text-xs font-inherit box-border focus:outline-none focus:border-indigo-500" 
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right Automation Code Context Sidebar Drawer Panel */}
              {selectedTestCaseForCode && (
                <div className="bg-slate-900 text-slate-100 p-5 rounded-xl shadow-lg sticky top-4">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[11px] font-extrabold text-sky-400 tracking-wider">AUTOMATION ENGINE</span>
                    <button onClick={() => setSelectedTestCaseForCode(null)} className="bg-transparent border-none text-slate-400 hover:text-slate-200 cursor-pointer text-xl p-0">×</button>
                  </div>
                  <h4 className="m-0 mb-4 text-sm font-semibold text-white">Scaffold for Case #{selectedTestCaseForCode.id}</h4>

                  <div className="flex gap-2 mb-4">
                    <button 
                      onClick={() => setAutomationFramework('Playwright')} 
                      className={`flex-1 py-1.5 px-2 text-xs font-bold rounded border-none cursor-pointer transition-colors ${
                        automationFramework === 'Playwright' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      Playwright
                    </button>
                    <button 
                      onClick={() => setAutomationFramework('Cypress')} 
                      className={`flex-1 py-1.5 px-2 text-xs font-bold rounded border-none cursor-pointer transition-colors ${
                        automationFramework === 'Cypress' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      Cypress
                    </button>
                  </div>

                  <pre className="m-0 p-3 bg-slate-800 rounded-md overflow-x-auto text-xs font-mono text-slate-200 @leading-relaxed whiteSpace-pre-wrap break-all">
                    {generatedCodeSnippet}
                  </pre>
                </div>
              )}

            </div>
          )
        )}

      </div>
    </div>
  );
}